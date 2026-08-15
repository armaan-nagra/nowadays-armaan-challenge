/**
 * Tiny hand-drawn-style SVG icons — round caps and slightly wonky paths so they
 * read as marker doodles, not icon-font glyphs. All inherit currentColor.
 */

function Svg({
  children,
  className = "",
  viewBox = "0 0 24 24",
  strokeWidth = 2.1,
}: {
  children: React.ReactNode;
  className?: string;
  viewBox?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={`inline-block ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** stick figure mid-stride */
export function WalkIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="13.2" cy="4.2" r="2" />
      <path d="M13 8.2c-1.8.6-2.8 1.8-3.6 3.4l-1.2 2.6" />
      <path d="M13 8.2c1.6.5 2.2 1.7 2.6 3.4l.6 2.4 2 2.2" />
      <path d="M11.2 13.6l1.4 3-2.8 4.6" />
      <path d="M15 13.8l.4 3.4 1 3.6" />
      <path d="M9.4 11.4l-2.6 1.2" />
    </Svg>
  );
}

/** wobbly little car */
export function CarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4.4 14.6l1.4-4.2c.3-.9 1-1.6 2-1.6h8.4c1 0 1.7.7 2 1.6l1.4 4.2" />
      <path d="M3.4 17.4c-.2-1.5.7-2.8 2.2-2.8h12.8c1.5 0 2.4 1.3 2.2 2.8" />
      <circle cx="7.6" cy="18.6" r="1.7" />
      <circle cx="16.4" cy="18.6" r="1.7" />
    </Svg>
  );
}

/** map pin with a dot */
export function PinIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 21.2c3.4-4 6-7 6-10.4a6 6 0 1 0-12 0c0 3.4 2.6 6.4 6 10.4z" />
      <circle cx="12" cy="10.6" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** loose hand-drawn arrow, pointing down-left; rotate with classes as needed */
export function ScribbleArrow({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <Svg className={className} viewBox="0 0 48 48" strokeWidth={2.4}>
      <path d="M40 8c-2 10-10 22-26 27" />
      <path d="M20 30l-6.5 5.5L22 38" />
    </Svg>
  );
}

/** squiggly "map" doodle for the empty state */
export function MapDoodle({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <Svg className={className} viewBox="0 0 64 64" strokeWidth={2.6}>
      {/* folded map outline */}
      <path d="M8 16l14-6 14 6 14-6v34l-14 6-14-6-14 6V16z" />
      <path d="M22 10v34" />
      <path d="M36 16v34" />
      {/* dotted route */}
      <path d="M14 34c6-8 14-2 18-8s10-6 18-12" strokeDasharray="0.5 5" />
      {/* x marks the spot */}
      <path d="M44 38l4 4m0-4l-4 4" />
    </Svg>
  );
}
