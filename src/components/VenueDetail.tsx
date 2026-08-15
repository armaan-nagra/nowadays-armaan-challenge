"use client";

import { useEffect } from "react";
import type { ScoredVenue } from "@/lib/types";
import { TrustBadge, priceSignal } from "./TrustBadge";
import { WalkIcon, CarIcon } from "./Doodles";

const safeUrl = (u: string | null | undefined): string | null =>
  u && /^https?:\/\//i.test(u) ? u : null;

const DIETARY_LABELS: Record<string, string> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  gluten_free: "gluten-free",
  kosher: "kosher",
  halal: "halal",
  dairy_free: "dairy-free",
  nut_free: "nut-free",
};

export function VenueDetail({ entry, onClose }: { entry: ScoredVenue; onClose: () => void }) {
  const { venue, rooms, commute, why } = entry;
  const price = priceSignal(venue);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1100] bg-ink/40 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={venue.name}
    >
      <div
        className="w-full max-w-xl h-full bg-sand overflow-y-auto border-l-[1.5px] border-ink p-4 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticker p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-2xl leading-tight">{venue.name}</h2>
                <TrustBadge trust={venue.trust} />
              </div>
              <p className="text-sm text-ink-soft mt-1">{venue.address}</p>
            </div>
            <button
              onClick={onClose}
              className="btn-pop bg-paper px-3 py-1 text-lg shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {commute && (
              <span className="chip bg-sky">
                {commute.mode === "driving" ? <CarIcon /> : <WalkIcon />}
                {Math.round(commute.duration_minutes)} min ·{" "}
                {(commute.distance_meters / 1609).toFixed(1)} mi
              </span>
            )}
            {price && <span className="chip bg-sunshine/50">{price}</span>}
            {venue.google_rating != null && (
              <span className="chip">
                ★ {venue.google_rating} ({venue.google_review_count})
              </span>
            )}
            {venue.cuisines.map((c) => (
              <span key={c} className="chip">
                {c.toLowerCase()}
              </span>
            ))}
          </div>
          {venue.pd_summary && <p className="text-sm mt-3 leading-relaxed">{venue.pd_summary}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {safeUrl(venue.private_dining_url) && (
              <a
                href={venue.private_dining_url!}
                target="_blank"
                rel="noreferrer"
                className="btn-cta text-sm px-3.5 py-1.5"
              >
                Private dining page ↗
              </a>
            )}
            {safeUrl(venue.website) && (
              <a
                href={venue.website!}
                target="_blank"
                rel="noreferrer"
                className="btn-pop bg-paper text-sm px-3 py-1.5"
              >
                Website ↗
              </a>
            )}
            {venue.google_maps_url && (
              <a
                href={venue.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="btn-pop bg-paper text-sm px-3 py-1.5"
              >
                Google Maps ↗
              </a>
            )}
          </div>
        </div>

        {/* rooms */}
        <div className="sticker p-4">
          <h3 className="font-display font-semibold text-lg mb-2">Private spaces</h3>
          {rooms.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft text-left">
                    <th className="pb-2 pr-2">Space</th>
                    <th className="pb-2 pr-2">Seated</th>
                    <th className="pb-2 pr-2">Standing</th>
                    <th className="pb-2">Trust</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-t-2 border-ink/10">
                      <td className="py-2 pr-2">
                        <span className="font-semibold">
                          {r.name}
                          {r.is_full_buyout && " (full buyout)"}
                        </span>
                        {r.description && (
                          <p className="text-[0.75rem] text-ink-soft leading-snug">{r.description}</p>
                        )}
                      </td>
                      <td className="py-2 pr-2 font-mono">{r.seated_capacity ?? "-"}</td>
                      <td className="py-2 pr-2 font-mono">{r.standing_capacity ?? "-"}</td>
                      <td className="py-2">
                        {safeUrl(r.source_url) ? (
                          <a href={r.source_url!} target="_blank" rel="noreferrer">
                            <TrustBadge trust={r.trust} tilt={false} />
                          </a>
                        ) : (
                          <TrustBadge trust={r.trust} tilt={false} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              No published room list - the venue may still host private events. Call to ask about
              spaces and capacities.
            </p>
          )}
        </div>

        {/* price */}
        <div className="sticker p-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-lg">Price signal</h3>
            <TrustBadge trust={venue.price_trust} tilt={false} />
          </div>
          <p className="text-sm mt-1.5">
            {price ?? "No pricing published - ask about minimums when you call."}
          </p>
          {venue.price_notes && <p className="text-[0.8rem] text-ink-soft mt-1">{venue.price_notes}</p>}
          {safeUrl(venue.price_source_url) && (
            <a
              href={venue.price_source_url!}
              target="_blank"
              rel="noreferrer"
              className="text-[0.75rem] font-mono underline text-ink-soft"
            >
              source ↗
            </a>
          )}
        </div>

        {/* menus + dietary */}
        {(venue.menu_urls.length > 0 || venue.dietary_options.length > 0 || venue.dietary_notes) && (
          <div className="sticker p-4">
            <h3 className="font-display font-semibold text-lg mb-2">Menus & dietary</h3>
            {venue.menu_urls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {venue.menu_urls.filter((u) => safeUrl(u)).map((u, i) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="chip hover:bg-sunshine transition-colors"
                  >
                    menu {venue.menu_urls.length > 1 ? i + 1 : ""} ↗
                  </a>
                ))}
              </div>
            )}
            {venue.dietary_options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {venue.dietary_options.map((d) => (
                  <span key={d} className="chip bg-pistachio/40">
                    {DIETARY_LABELS[d] ?? d}
                  </span>
                ))}
              </div>
            )}
            {venue.dietary_notes && (
              <p className="text-[0.8rem] text-ink-soft mt-2">{venue.dietary_notes}</p>
            )}
          </div>
        )}

        {/* contact */}
        <div className="sticker p-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-lg">Contact</h3>
            <TrustBadge trust={venue.contact_trust} tilt={false} />
          </div>
          <div className="space-y-1.5 mt-2 text-sm">
            {venue.events_email && (
              <p className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft">
                  email
                </span>
                <span>
                  <a className="underline font-mono" href={`mailto:${venue.events_email}`}>
                    {venue.events_email}
                  </a>{" "}
                  <span className="text-ink-soft text-[0.75rem]">
                    {venue.contact_trust === "verified"
                      ? "(events)"
                      : "(from website - confirm it reaches events)"}
                  </span>
                </span>
              </p>
            )}
            {venue.events_phone && (
              <p className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft">
                  events
                </span>
                <span className="font-mono">{venue.events_phone}</span>
              </p>
            )}
            {venue.phone && (
              <p className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft">
                  main
                </span>
                <span className="font-mono">{venue.phone}</span>
              </p>
            )}
            {!venue.events_email && !venue.events_phone && !venue.phone && (
              <p className="text-ink-soft">No contact found - try the website above.</p>
            )}
          </div>
        </div>

        {/* why + provenance */}
        <div className="sticker p-4">
          <h3 className="font-display font-semibold text-lg mb-2">Why we trust this</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {venue.trust_reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {why.length > 0 && (
            <>
              <h4 className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft mt-3 mb-1">
                Ranking factors
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {venue.sources.length > 0 && (
            <>
              <h4 className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft mt-3 mb-1">
                Sources
              </h4>
              <ul className="space-y-0.5">
                {venue.sources.filter((s) => safeUrl(s.url)).map((s) => (
                  <li key={s.url} className="truncate">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[0.75rem] font-mono underline text-ink-soft"
                    >
                      {s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
