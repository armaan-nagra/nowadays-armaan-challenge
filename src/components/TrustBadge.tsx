import type { TrustLabel } from "@/lib/types";

const STYLES: Record<TrustLabel, { bg: string; label: string; icon: string }> = {
  verified: { bg: "bg-pistachio", label: "verified", icon: "✓" },
  likely: { bg: "bg-sunshine", label: "likely", icon: "~" },
  unverified: { bg: "bg-cloud", label: "needs a call", icon: "☎" },
};

export function TrustBadge({
  trust,
  tilt = true,
  className = "",
}: {
  trust: TrustLabel;
  tilt?: boolean;
  className?: string;
}) {
  const s = STYLES[trust];
  return (
    <span
      className={`inline-flex items-center gap-1 border-2 border-ink rounded-full px-2.5 py-0.5 font-mono text-[0.68rem] font-bold lowercase tracking-tight ${s.bg} ${tilt ? "-rotate-2" : ""} ${className}`}
      style={{ boxShadow: "2px 2px 0 0 #22262b" }}
      title={
        trust === "verified"
          ? "Stated on the venue's own website"
          : trust === "likely"
            ? "Good evidence, but not confirmed by the venue"
            : "No published evidence — call to confirm"
      }
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function formatMoney(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}

export function priceSignal(v: {
  min_spend_low: number | null;
  min_spend_high: number | null;
  per_person_low: number | null;
  per_person_high: number | null;
  price_tier: string | null;
}): string | null {
  if (v.min_spend_low != null) {
    return v.min_spend_high != null && v.min_spend_high !== v.min_spend_low
      ? `${formatMoney(v.min_spend_low)}–${formatMoney(v.min_spend_high)} min`
      : `${formatMoney(v.min_spend_low)}+ min spend`;
  }
  if (v.per_person_low != null) {
    return v.per_person_high != null && v.per_person_high !== v.per_person_low
      ? `$${v.per_person_low}–$${v.per_person_high}/person`
      : `$${v.per_person_low}+/person`;
  }
  return v.price_tier;
}
