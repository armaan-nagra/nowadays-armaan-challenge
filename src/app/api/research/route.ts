import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { geocode } from "@/lib/google";
import { researchArea, type ResearchProgress } from "@/lib/enrich";

export const maxDuration = 300;

interface Job extends ResearchProgress {
  key: string;
  startedAt: number;
  error?: string;
}

// In-memory job registry — fine for a local/single-process deployment, which is
// what this research tool is. A hosted multi-instance version would move this
// to a Postgres table.
const globalJobs = globalThis as unknown as { __researchJobs?: Map<string, Job> };
const jobs = (globalJobs.__researchJobs ??= new Map<string, Job>());

const MAX_CONCURRENT_JOBS = 2;
const LIVE_LIMIT = 18; // venues per live scout — keeps it ~2-3 minutes
const JOB_TIMEOUT_MS = 15 * 60_000; // treat a job as dead after 15 min
const JOB_TTL_MS = 60 * 60_000; // evict finished/dead jobs after an hour

function isStale(j: Job) {
  return !j.finished && Date.now() - j.startedAt > JOB_TIMEOUT_MS;
}

function sweepJobs() {
  for (const [k, j] of jobs) {
    if (isStale(j)) j.finished = true;
    if (j.finished && Date.now() - j.startedAt > JOB_TTL_MS) jobs.delete(k);
  }
}

function jobKey(lat: number, lng: number, radiusM: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${Math.round(radiusM / 100)}`;
}

export async function POST(req: Request) {
  let body: { address?: string; maxMinutes?: number; maxWalkMinutes?: number; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const address = (body.address ?? "").trim();
  const maxMinutes = Math.max(5, Math.min(Number(body.maxMinutes ?? body.maxWalkMinutes) || 15, 30));
  const pace = body.mode === "driving" ? 600 : 80;
  if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });

  let origin;
  try {
    origin = await geocode(address);
  } catch {
    return NextResponse.json({ error: "Couldn't find that address." }, { status: 422 });
  }

  const radiusM = Math.min(maxMinutes * pace, 8000);
  const key = jobKey(origin.lat, origin.lng, radiusM);

  sweepJobs();
  const existing = jobs.get(key);
  if (existing && !existing.finished) {
    return NextResponse.json({ ...existing, key });
  }

  const running = [...jobs.values()].filter((j) => !j.finished).length;
  if (running >= MAX_CONCURRENT_JOBS) {
    return NextResponse.json(
      { error: "Two areas are already being scouted — give them a minute to finish." },
      { status: 429 }
    );
  }

  const job: Job = { key, startedAt: Date.now(), total: 0, done: 0, succeeded: 0, finished: false };
  jobs.set(key, job);

  const city = origin.formatted.split(",").slice(-3).join(",").trim();
  // Fire and forget — the client polls GET for progress.
  researchArea(supabaseAdmin(), origin, radiusM, {
    city,
    limit: LIVE_LIMIT,
    skipExisting: true,
    concurrency: 4,
    onProgress: (p) => Object.assign(job, p),
    log: (msg) => console.log(`[scout ${key}] ${msg}`),
  }).catch((err) => {
    job.error = (err as Error).message;
    job.finished = true;
  });

  return NextResponse.json({ ...job, key });
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  const job = jobs.get(key);
  if (!job) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  return NextResponse.json({ ...job, key });
}
