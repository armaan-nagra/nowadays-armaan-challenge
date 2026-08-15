/** One-shot check that all three Google APIs and the Anthropic key work. */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { geocode, searchPlaces, routeTimes } from "../../src/lib/google";

async function main() {
  const o = await geocode("Times Square, New York, NY");
  console.log("geocode OK:", o.formatted);
  const places = await searchPlaces("restaurant with private dining room", o, 1600);
  console.log("places OK:", places.length, "results, e.g.", places[0]?.name);
  const walks = await routeTimes(o, [{ lat: places[0].lat, lng: places[0].lng }]);
  console.log("routes OK:", walks[0]?.durationMinutes, "min walk");

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 50,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "Say OK." }],
  });
  console.log("anthropic OK:", msg.stop_reason);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
