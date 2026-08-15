/**
 * Claude extraction: venue website text → structured private dining facts.
 * Every fact carries `explicitly_stated` so trust labels reflect real provenance.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SiteContent } from "./site";

const RoomSchema = z.object({
  name: z.string(),
  seated_capacity: z.number().nullable(),
  standing_capacity: z.number().nullable(),
  description: z.string().nullable(),
  is_full_buyout: z.boolean(),
  explicitly_stated: z
    .boolean()
    .describe("true only if the room and its capacity are stated verbatim on the pages"),
  source_url: z.string().nullable(),
});

export const ExtractionSchema = z.object({
  has_private_dining_evidence: z
    .boolean()
    .describe("true if the pages show this venue offers private dining / private events"),
  pd_summary: z
    .string()
    .nullable()
    .describe("2-3 sentence planner-facing summary of the private dining offering"),
  rooms: z.array(RoomSchema),
  event_styles: z.array(
    z.enum(["seated_dinner", "reception", "buyout", "semi_private"])
  ),
  cuisines: z.array(z.string()).describe("e.g. Italian, Steakhouse, Japanese; empty if unclear"),
  venue_type: z.enum(["restaurant", "hotel", "event_space", "bar", "rooftop", "other"]),
  price: z.object({
    tier: z.enum(["$", "$$", "$$$", "$$$$"]).nullable(),
    min_spend_low: z.number().nullable().describe("minimum spend in USD, low end"),
    min_spend_high: z.number().nullable(),
    per_person_low: z.number().nullable().describe("per-person price in USD, low end"),
    per_person_high: z.number().nullable(),
    notes: z.string().nullable(),
    explicitly_stated: z
      .boolean()
      .describe("true only if a dollar figure or tier is stated on the pages"),
    source_url: z.string().nullable(),
  }),
  dietary_options: z.array(
    z.enum(["vegetarian", "vegan", "gluten_free", "kosher", "halal", "dairy_free", "nut_free"])
  ),
  dietary_notes: z.string().nullable(),
  events_email: z.string().nullable().describe("email for private events inquiries specifically"),
  events_phone: z.string().nullable(),
  private_dining_url: z
    .string()
    .nullable()
    .describe("URL of the venue's own private dining / events page, if one was provided"),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

// Lazy so the client picks up env vars loaded by the orchestrator's dotenv
// override (static imports are hoisted above that call). Falls back to reading
// .env.local directly if the shell exports an empty ANTHROPIC_API_KEY, which
// Next's env loading won't override.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    try {
      const { readFileSync } = require("fs") as typeof import("fs");
      const line = readFileSync(".env.local", "utf8")
        .split("\n")
        .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
      apiKey = line?.slice("ANTHROPIC_API_KEY=".length).trim();
    } catch {
      // fall through — SDK will throw a clear auth error
    }
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function extractVenueFacts(
  venueName: string,
  site: SiteContent
): Promise<Extraction | null> {
  const pagesBlock = site.pages
    .map((p) => `=== PAGE: ${p.url} ===\n${p.text}`)
    .join("\n\n");
  const hints = [
    site.emails.length ? `Emails found in page source: ${site.emails.join(", ")}` : null,
    site.phones.length ? `Phones found in page source: ${site.phones.join(", ")}` : null,
    site.pdfUrls.length ? `Linked event/PD PDFs (not fetched): ${site.pdfUrls.join(", ")}` : null,
    site.menuUrls.length ? `Linked menu URLs: ${site.menuUrls.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client().messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(ExtractionSchema) },
    system:
      "You extract private-dining facts for corporate event planners from restaurant/venue website text. " +
      "Be conservative: mark explicitly_stated true ONLY when the fact (a room name with a capacity number, a dollar figure) " +
      "appears verbatim in the provided pages. Reasonable inferences are allowed but must have explicitly_stated false. " +
      "Never invent capacities, prices, or contact details. Use null when unknown. " +
      "Capacities: 'seats 40' → seated; 'up to 80 for receptions/standing/cocktail' → standing. " +
      "If the whole venue can be bought out, include it as a room with is_full_buyout true.",
    messages: [
      {
        role: "user",
        content: `Venue: ${venueName}\n\n${hints ? hints + "\n\n" : ""}${pagesBlock}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}
