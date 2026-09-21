import type { ReactNode } from "react";
import Image from "next/image";
import { PublicTopBar } from "@/components/layout/PublicTopBar";
import logo from "../../app/images/logo.png";
import logo1 from "../../app/images/1.png";
import logo2 from "../../app/images/2.png";
import logo3 from "../../app/images/3.png";
import logo4 from "../../app/images/4.png";
import logo5 from "../../app/images/5.png";
import logo6 from "../../app/images/6.png";
import logo7 from "../../app/images/7.jpg";
import logo8 from "../../app/images/8.png";
import logo9 from "../../app/images/9.png";
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
            SRM Group Of Institutions
          </div>

          <div className="auth-logo-grid">
            <div className="auth-logo-tile auth-logo-main">
              <Image src={logo} alt="SRM Group of Institutions logo" fill sizes="(max-width: 920px) 80vw, 420px" />
            </div>
            {[logo1, logo2, logo3, logo4, logo5,logo6,logo7, logo8,logo9].map((image, index) => (
              <div className="auth-logo-tile" key={index}>
                <Image src={image} alt={`Institution logo ${index + 1}`} fill sizes="(max-width: 920px) 24vw, 140px" />
              </div>
            ))}
          </div>

          
          <div className="brand-copy">
            <h2>{brandTitle}</h2>
          </div>

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
