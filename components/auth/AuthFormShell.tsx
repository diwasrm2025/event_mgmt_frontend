import type { ReactNode } from "react";
import Link from "next/link";
import { PublicTopBar } from "@/components/layout/PublicTopBar";

type AuthFormShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
  brandTitle?: string;
  brandText?: string;
  brandAccent?: string;
};

export function AuthFormShell({
  eyebrow,
  title,
  subtitle,
  footer,
  children,
  brandTitle = "Run every event from one calm dashboard.",
  brandText = "Create listings, track attendance, manage tickets, and keep every booking journey in one place.",
  brandAccent = "Admission - All Access",
}: AuthFormShellProps) {
  return (
    <div className="auth-shell2">
      <PublicTopBar/>
      <div className="auth-grid">
        <div className="auth-brand">
          <div className="brand-mark">
            <span className="dot" />
            Pulseframe
          </div>

          <div className="auth-ticket">
            <div>
              <p className="mono" style={{ fontSize: "11px", letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.85 }}>
                {brandAccent}
              </p>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", marginTop: "10px" }}>Autumn Sound Sessions</h3>
              <p style={{ fontSize: "13px", opacity: 0.88, marginTop: "6px" }}>Riverside Amphitheatre . Gate 3</p>
              <p className="mono" style={{ fontSize: "12px", marginTop: "16px", opacity: 0.72 }}>
                SEAT GA . ROW A
              </p>
            </div>
            <div className="side">
              <span>AUG 14 . 7:00 PM</span>
            </div>
          </div>

          <div className="auth-highlights">
            <span className="auth-pill">
              <span className="auth-pill-dot" />
              Live insights
            </span>
            <span className="auth-pill">
              <span className="auth-pill-dot" />
              Fast check-ins
            </span>
            <span className="auth-pill">
              <span className="auth-pill-dot" />
              Team ready
            </span>
          </div>

          <div className="brand-copy">
            <h2>{brandTitle}</h2>
            <p style={{ marginTop: "10px" }}>{brandText}</p>
          </div>

          <footer>(c) 2026 Pulseframe. All events accounted for.</footer>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-card">
            <div className="brand-mark-mobile">
              <span className="dot" />
              Pulseframe
            </div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="sub">{subtitle}</p>
            {children}
            <div className="auth-foot">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
