import type { CSSProperties } from "react";

/** Small ring spinner used inline (buttons, cards, panels). */
export function Loader({ size = 20 }: { size?: number }) {
  return (
    <span className="app-loader" style={{ "--loader-size": `${size}px` } as CSSProperties} role="status" aria-label="Loading">
      <span className="ring" />
      <span className="punch" />
    </span>
  );
}

/** Inline loader with a trailing label, e.g. "Loading events...". */
export function InlineLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <span className="inline-loader">
      <Loader size={16} />
      {label}
    </span>
  );
}

/** Full-page branded loader for route transitions and first paint. */
export function PageLoader({ label = "Getting things ready" }: { label?: string }) {
  return (
    <div className="page-loader">
      <span className="brand-mark">
        <span className="dot" />
        Pulseframe
      </span>
      <Loader size={40} />
      <p>{label}</p>
    </div>
  );
}
