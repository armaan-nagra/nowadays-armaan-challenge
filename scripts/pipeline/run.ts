/**
 * Offline enrichment pipeline - thin CLI over src/lib/enrich.ts.
 *
 * Usage:
 *   npm run pipeline -- --area times-square
 *   npm run pipeline -- --all
 *   npm run pipeline -- --address "some address" --radius 1500
 * Flags: --limit N (default 28), --force (re-enrich venues already in DB)
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { geocode } from "../../src/lib/google";
import { researchArea } from "../../src/lib/enrich";

const AREAS: Record<string, { address: string; radiusM: number; extraQueries: string[] }> = {
  "times-square": {
    address: "Times Square, New York, NY",
    radiusM: 1600, // ~20 min walk
    extraQueries: ["upscale restaurant private dining midtown"],
  },
  "salesforce-tower": {
    address: "415 Mission St, San Francisco, CA 94105",
    radiusM: 1200, // ~15 min walk
    extraQueries: ["restaurant group dining SOMA financial district"],
  },
  waikiki: {
    address: "Hilton Hawaiian Village Waikiki Beach Resort, Honolulu, HI 96815",
    radiusM: 1200, // ~15 min walk
    extraQueries: [
      "large event venue reception",
      "hotel banquet oceanfront",
      "luau venue",
      "rooftop bar private events",
    ],
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    area: get("--area"),
    address: get("--address"),
    radius: get("--radius") ? parseInt(get("--radius")!) : undefined,
    limit: get("--limit") ? parseInt(get("--limit")!) : 28,
    all: args.includes("--all"),
    force: args.includes("--force"),
  };
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars in .env.local");
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as never },
  });
}

async function runArea(
  name: string,
  address: string,
  radiusM: number,
  extraQueries: string[],
  limit: number,
  force: boolean
) {
  console.log(`\n━━━ ${name}: ${address} (radius ${radiusM}m) ━━━`);
  const origin = await geocode(address);
  console.log(`  origin: ${origin.formatted} (${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)})`);
  const city = address.split(",").slice(-2).join(",").trim();
  const result = await researchArea(supabase(), origin, radiusM, {
    city,
    limit,
    extraQueries,
    skipExisting: !force,
    log: (msg) => console.log(`  ${msg}`),
  });
  console.log(`  -> enriched ${result.succeeded}/${result.total}`);
}

async function main() {
  const args = parseArgs();
  if (args.all) {
    for (const [name, cfg] of Object.entries(AREAS)) {
      await runArea(name, cfg.address, cfg.radiusM, cfg.extraQueries, args.limit, args.force);
    }
  } else if (args.area) {
    const cfg = AREAS[args.area];
    if (!cfg) {
      console.error(`Unknown area "${args.area}". Options: ${Object.keys(AREAS).join(", ")}`);
      process.exit(1);
    }
    await runArea(args.area, cfg.address, cfg.radiusM, cfg.extraQueries, args.limit, args.force);
  } else if (args.address) {
    await runArea("custom", args.address, args.radius ?? 1600, [], args.limit, args.force);
  } else {
    console.error("Pass --area <name>, --all, or --address <address>");
    process.exit(1);
  }
  console.log("\npipeline done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
