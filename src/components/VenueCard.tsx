"use client";

import type { ScoredVenue } from "@/lib/types";
import { TrustBadge, priceSignal } from "./TrustBadge";
import { WalkIcon, CarIcon } from "./Doodles";

export function VenueCard({
  entry,
  rank,
  style,
  active,
  compared,
  onHover,
  onOpen,
  onToggleCompare,
}: {
  entry: ScoredVenue;
  rank: number;
  style: "any" | "seated_dinner" | "reception";
  active: boolean;
  compared: boolean;
  onHover: (id: string | null) => void;
  onOpen: () => void;
  onToggleCompare: () => void;
}) {
  const { venue, commute, bestRoom, why } = entry;
  const price = priceSignal(venue);

  return (
    <article
      className={`sticker sticker-hover p-4 cursor-pointer relative ${active ? "ring-4 ring-sunshine" : ""}`}
      onMouseEnter={() => onHover(venue.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-full border-[1.5px] border-ink flex items-center justify-center font-display font-bold text-lg ${
            rank <= 3 ? "bg-coral text-paper" : "bg-sunshine"
          }`}
        >
          {rank}
        </div>

        <div className="min-w-0 flex-1 pr-20">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold text-lg leading-tight truncate">
              {venue.name}
            </h3>
            <TrustBadge trust={venue.trust} />
          </div>
          <p className="text-[0.8rem] text-ink-soft truncate mt-0.5">{venue.address}</p>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {commute && (
              <span className="chip bg-sky">
                {commute.mode === "driving" ? <CarIcon /> : <WalkIcon />}
                {Math.round(commute.duration_minutes)} min
              </span>
            )}
            {bestRoom ? (
              <span className="chip">
                {bestRoom.is_full_buyout ? "full buyout" : bestRoom.name.toLowerCase()} ·{" "}
                {style === "reception" && bestRoom.standing_capacity != null
                  ? `${bestRoom.standing_capacity} standing`
                  : bestRoom.seated_capacity != null
                    ? `${bestRoom.seated_capacity} seats`
                    : `${bestRoom.standing_capacity} standing`}
              </span>
            ) : venue.max_seated || venue.max_standing ? (
              <span className="chip">
                up to {Math.max(venue.max_seated ?? 0, venue.max_standing ?? 0)}
              </span>
            ) : (
              <span className="chip bg-cloud">capacity? call to ask</span>
            )}
            {price && <span className="chip bg-sunshine/50">{price}</span>}
            {venue.cuisines.slice(0, 1).map((c) => (
              <span key={c} className="chip">
                {c.toLowerCase()}
              </span>
            ))}
          </div>

          {why.length > 0 && (
            <p className="text-[0.8rem] mt-2 text-ink-soft leading-snug">
              <span className="font-bold text-ink">Why here:</span> {why.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCompare();
        }}
        className={`absolute top-3 right-3 btn-pop text-[0.7rem] px-2.5 py-1 font-mono ${
          compared ? "bg-pistachio" : "bg-paper"
        }`}
        aria-pressed={compared}
      >
        {compared ? "✓ added" : "+ compare"}
      </button>
    </article>
  );
}
