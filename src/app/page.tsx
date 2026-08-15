"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SearchBar } from "@/components/SearchBar";
import { VenueCard } from "@/components/VenueCard";
import { VenueDetail } from "@/components/VenueDetail";
import { CompareTray } from "@/components/CompareTray";
import type { ScoredVenue, SearchParams, SearchResponse } from "@/lib/types";

const MapPanel = dynamic(() => import("@/components/MapPanel"), {
  ssr: false,
  loading: () => (
    <div className="sticker h-full min-h-[420px] flex items-center justify-center">
      <span className="font-display text-ink-soft">unrolling the map…</span>
    </div>
  ),
});

interface ScoutJob {
  key: string;
  total: number;
  done: number;
  succeeded: number;
  finished: boolean;
  error?: string;
}

export default function Home() {
  const [params, setParams] = useState<SearchParams | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [scout, setScout] = useState<ScoutJob | null>(null);
  const scoutParams = useRef<SearchParams | null>(null);
  const searchSeq = useRef(0);

  const fetchResults = useCallback(async (p: SearchParams): Promise<SearchResponse> => {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Search failed");
    return json as SearchResponse;
  }, []);

  const search = useCallback(
    async (p: SearchParams) => {
      searchSeq.current++;
      setLoading(true);
      setError(null);
      setParams(p);
      setCompareIds([]);
      setDetailId(null);
      setScout(null);
      try {
        setData(await fetchResults(p));
      } catch (err) {
        setData(null);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [fetchResults]
  );

  const startScout = useCallback(async () => {
    if (!params) return;
    scoutParams.current = params;
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: params.address, maxMinutes: params.maxMinutes, mode: params.mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't start scouting");
      setScout(json as ScoutJob);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [params]);

  // Poll scout progress; refresh results as venues land.
  useEffect(() => {
    if (!scout || scout.finished) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/research?key=${encodeURIComponent(scout.key)}`);
        if (res.status === 404) {
          // server restarted and lost the in-memory job — stop spinning
          setScout((s) => (s ? { ...s, finished: true } : s));
          return;
        }
        if (!res.ok) return;
        const job = (await res.json()) as ScoutJob;
        setScout(job);
        const p = scoutParams.current;
        if (p && (job.finished || (job.succeeded > 0 && job.done % 4 === 0))) {
          const seq = searchSeq.current;
          try {
            const fresh = await fetchResults(p);
            // only apply if no newer search started while this was in flight
            if (seq === searchSeq.current) setData(fresh);
          } catch {
            // keep old results on transient failure
          }
        }
      } catch {
        // transient poll failure — keep trying
      }
    }, 6000);
    return () => clearInterval(id);
  }, [scout, fetchResults]);

  const results = data?.results ?? [];
  const detail = useMemo(
    () => results.find((r) => r.venue.id === detailId) ?? null,
    [results, detailId]
  );
  const compared = useMemo(
    () =>
      compareIds
        .map((id) => results.find((r) => r.venue.id === id))
        .filter((r): r is ScoredVenue => !!r),
    [compareIds, results]
  );

  const toggleCompare = (id: string) =>
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]
    );

  const scouting = scout != null && !scout.finished;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 pt-5 pb-1 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="font-display font-bold text-3xl sm:text-4xl bg-paper border-[3px] border-ink rounded-2xl px-4 py-1.5 -rotate-1 inline-block"
            style={{ boxShadow: "5px 5px 0 0 #22262b" }}
          >
            Table&nbsp;Scout&nbsp;<span className="text-coral">🍽</span>
          </h1>
          <div className="flex flex-col">
            <span className="font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft">
              private dining finder · by nowadays
            </span>
            <span className="text-sm text-ink-soft">
              Rooms, prices, and how much to trust them — for groups of any size.
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 max-w-7xl w-full mx-auto space-y-4">
        <SearchBar onSearch={search} loading={loading} />

        {error && (
          <div className="sticker p-4 bg-paper border-coral">
            <p className="font-display font-semibold text-coral-deep">Hmm, that didn&apos;t work.</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="sticker p-10 text-center">
            <div className="text-5xl animate-bounce inline-block">🕵️</div>
            <p className="font-display font-semibold text-xl mt-3">Scouting tables…</p>
            <p className="text-sm text-ink-soft mt-1">
              Checking rooms, walking times, and price signals near{" "}
              <span className="font-mono">{params?.address}</span>
            </p>
          </div>
        )}

        {!loading && !data && !error && (
          <div className="sticker p-10 text-center">
            <div className="text-5xl">🗺️</div>
            <p className="font-display font-semibold text-2xl mt-3">Where&apos;s dinner?</p>
            <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
              Type an office, hotel, or landmark and we&apos;ll rank private dining venues within
              walking or driving distance — with capacities, price signals, and a trust label on every fact.
            </p>
            <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-soft mt-4">
              ↑ or hit one of the try-me chips
            </p>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-display font-medium text-lg">
                {results.length > 0 ? (
                  <>
                    Top {results.length} spots for{" "}
                    <span className="bg-sunshine border-2 border-ink rounded-lg px-1.5">
                      {params?.headcount}
                    </span>{" "}
                    near {data.origin.formatted.split(",")[0]}
                  </>
                ) : scouting ? (
                  <>Scouting this area…</>
                ) : (
                  <>No tables in range 😔</>
                )}
              </p>
              <span className="chip bg-paper">
                {params?.mode === "driving" ? "🚗 driving" : "🚶 walking"} mode · ≤ {params?.maxMinutes} min ·{" "}
                {data.meta.totalInRadius} venues scanned
              </span>
            </div>

            {scouting && (
              <div className="sticker p-4 flex items-center gap-4">
                <div className="text-3xl animate-bounce">🔎</div>
                <div className="flex-1">
                  <p className="font-display font-semibold">
                    Live-scouting this neighborhood — reading venue websites…
                  </p>
                  <p className="text-sm text-ink-soft">
                    {scout!.total > 0
                      ? `${scout!.done} of ${scout!.total} venues researched · results appear below as they're confirmed`
                      : "finding candidate venues nearby…"}
                  </p>
                  <div className="mt-2 h-3 border-2 border-ink rounded-full overflow-hidden bg-cloud">
                    <div
                      className="h-full bg-sunshine transition-all duration-700"
                      style={{
                        width: `${scout!.total ? Math.round((scout!.done / scout!.total) * 100) : 5}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {results.length === 0 ? (
              <div className="sticker p-8 text-center">
                {scouting ? (
                  <p className="text-sm text-ink-soft max-w-md mx-auto">
                    First confirmed venues will pop in here — usually within a minute.
                  </p>
                ) : scout?.finished ? (
                  scout.error ? (
                    <>
                      <p className="font-display font-semibold text-coral-deep">
                        Scouting hit a snag
                      </p>
                      <p className="text-sm text-ink-soft max-w-md mx-auto mt-1">
                        {scout.error} — try again in a minute.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-soft max-w-md mx-auto">
                      We scouted {scout.done} venues here and none fit this group within the
                      commute limit. Try a longer commute time or a smaller group.
                    </p>
                  )
                ) : (
                  <>
                    <p className="font-display font-semibold text-xl">
                      We haven&apos;t researched this area yet
                    </p>
                    <p className="text-sm text-ink-soft max-w-md mx-auto mt-2">
                      Table Scout can research it right now: it finds nearby venues, reads their
                      websites, and extracts rooms, capacities, and prices — with a trust label on
                      everything.
                    </p>
                    <button onClick={startScout} className="btn-pop bg-coral text-paper px-6 py-2.5 text-lg mt-4">
                      🔍 Scout this area now (~2–3 min)
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 items-start">
                <div className="space-y-3 order-2 lg:order-1">
                  {results.map((r, i) => (
                    <VenueCard
                      key={r.venue.id}
                      entry={r}
                      rank={i + 1}
                      style={params?.style ?? "any"}
                      active={hoveredId === r.venue.id}
                      compared={compareIds.includes(r.venue.id)}
                      onHover={setHoveredId}
                      onOpen={() => setDetailId(r.venue.id)}
                      onToggleCompare={() => toggleCompare(r.venue.id)}
                    />
                  ))}
                </div>
                <div className="lg:sticky lg:top-4 h-[420px] lg:h-[calc(100vh-2rem)] order-1 lg:order-2">
                  <MapPanel
                    origin={data.origin}
                    results={results}
                    maxMinutes={params?.maxMinutes ?? 15}
                    mode={params?.mode ?? "walking"}
                    hoveredId={hoveredId}
                    onHover={setHoveredId}
                    onOpen={setDetailId}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="px-6 py-4 text-center">
        <p className="font-mono text-[0.65rem] text-ink-soft">
          research & recommendations only — no live booking · walk & drive times via Google Routes ·
          map art by Stamen/Stadia
        </p>
      </footer>

      {detail && <VenueDetail entry={detail} onClose={() => setDetailId(null)} />}
      <CompareTray
        entries={compared}
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        onClear={() => setCompareIds([])}
      />
    </div>
  );
}
