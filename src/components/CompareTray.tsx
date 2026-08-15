"use client";

import { useEffect, useState } from "react";
import type { ScoredVenue } from "@/lib/types";
import { TrustBadge, priceSignal } from "./TrustBadge";

export function CompareTray({
  entries,
  onRemove,
  onClear,
}: {
  entries: ScoredVenue[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (entries.length < 2) setOpen(false);
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="sticker px-4 py-3 flex items-center gap-3 bg-paper">
          <span className="font-display font-semibold">
            {entries.length} venue{entries.length > 1 ? "s" : ""} picked
          </span>
          <div className="flex -space-x-2">
            {entries.map((e, i) => (
              <span
                key={e.venue.id}
                className="w-8 h-8 rounded-full bg-sunshine border-2 border-ink flex items-center justify-center font-display font-bold text-sm"
                title={e.venue.name}
                style={{ zIndex: 10 - i }}
              >
                {e.venue.name[0]}
              </span>
            ))}
          </div>
          <button
            className="btn-pop bg-coral text-paper px-4 py-1.5 text-sm disabled:opacity-50"
            disabled={entries.length < 2}
            onClick={() => setOpen(true)}
          >
            Compare
          </button>
          <button className="font-mono text-xs underline text-ink-soft" onClick={onClear}>
            clear
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1200] bg-ink/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Compare venues"
        >
          <div
            className="sticker bg-paper max-w-5xl w-full max-h-[85vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-2xl">Side by side</h2>
              <button className="btn-pop bg-paper px-3 py-1" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft w-32 pb-3" />
                    {entries.map((e) => (
                      <th key={e.venue.id} className="text-left pb-3 pr-4 align-top">
                        <div className="font-display font-semibold text-base leading-tight">
                          {e.venue.name}
                        </div>
                        <button
                          className="font-mono text-[0.65rem] underline text-ink-soft"
                          onClick={() => onRemove(e.venue.id)}
                        >
                          remove
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row label="Trust">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4">
                        <TrustBadge trust={e.venue.trust} tilt={false} />
                      </td>
                    ))}
                  </Row>
                  <Row label={entries.some((e) => e.commute?.mode === "driving") ? "Drive" : "Walk"}>
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4 font-mono">
                        {e.commute ? `${Math.round(e.commute.duration_minutes)} min` : "—"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Best space">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4">
                        {e.bestRoom
                          ? `${e.bestRoom.is_full_buyout ? "Full buyout" : e.bestRoom.name}`
                          : "—"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Seated / standing">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4 font-mono">
                        {e.venue.max_seated ?? "?"} / {e.venue.max_standing ?? "?"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Price">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono">{priceSignal(e.venue) ?? "—"}</span>
                          <TrustBadge trust={e.venue.price_trust} tilt={false} />
                        </div>
                      </td>
                    ))}
                  </Row>
                  <Row label="Dietary">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4 text-[0.8rem]">
                        {e.venue.dietary_options.length > 0
                          ? e.venue.dietary_options.map((d) => d.replace("_", "-")).join(", ")
                          : "—"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Contact">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4 font-mono text-[0.75rem]">
                        {e.venue.events_email ?? e.venue.events_phone ?? e.venue.phone ?? "—"}
                      </td>
                    ))}
                  </Row>
                  <Row label="Fit score">
                    {entries.map((e) => (
                      <td key={e.venue.id} className="py-2 pr-4">
                        <span className="chip bg-sunshine/60">{Math.round(e.score * 100)}/100</span>
                      </td>
                    ))}
                  </Row>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t-2 border-ink/10">
      <td className="py-2 pr-3 font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft align-top">
        {label}
      </td>
      {children}
    </tr>
  );
}
