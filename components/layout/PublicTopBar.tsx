"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon, faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { ACCENT_OPTIONS, THEME_OPTIONS, type ThemeMode } from "@/lib/themePrefs";
import { useTheme } from "@/components/providers/ThemeProvider";

/** Same theme/accent controls as the dashboard topbar, sized for a public
 * marketing/browse page. Keeps light/dark + accent consistent and
 * changeable everywhere, not just once a visitor signs in. */
export function PublicTopBar({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [accentMenuOpen, setAccentMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accentMenuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setAccentMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [accentMenuOpen]);

  return (
    <header className="public-topbar">
      <Link href="/events" className="side-brand" style={{ padding: 0 }}>
        <span className="dot" />
            Pulseframe
      </Link>

      <div className="topbar-actions" style={{ marginLeft: "auto" }}>
        {rightSlot}
        <div className="theme-controls">
          <div className="theme-toggle" aria-label="Theme controls">
            {(["light", "dark"] as ThemeMode[]).map((value) => (
              <button
                key={value}
                className={theme === value ? "active" : ""}
                aria-label={value === "light" ? "Light Mode" : "Dark Mode"}
                title={value === "light" ? "Light Mode" : "Dark Mode"}
                onClick={() => setTheme(value)}
              >
                <FontAwesomeIcon icon={value === "light" ? faSun : faMoon} />
              </button>
            ))}
          </div>
          <div className="accent-picker-wrap" ref={pickerRef}>
            <button
              type="button"
              className={`accent-picker ${accentMenuOpen ? "open" : ""}`}
              aria-label="Accent color"
              aria-haspopup="true"
              aria-expanded={accentMenuOpen}
              onClick={() => setAccentMenuOpen((open) => !open)}
            >
              <span className="accent-dot" />
              <span className="accent-picker-label">{ACCENT_OPTIONS.find((o) => o.value === accent)?.label || "Accent"}</span>
              <FontAwesomeIcon icon={faChevronDown} className="accent-picker-caret" />
            </button>
            {accentMenuOpen ? (
              <div className="accent-menu" role="menu">
                <p className="accent-menu-title">Accent color</p>
                <div className="accent-swatch-grid">
                  {ACCENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={accent === option.value}
                      className={`accent-swatch ${accent === option.value ? "active" : ""}`}
                      style={{ "--swatch-color": option.swatch } as CSSProperties}
                      onClick={() => {
                        setAccent(option.value);
                        setAccentMenuOpen(false);
                      }}
                    >
                      <span className="accent-swatch-dot">{accent === option.value && <FontAwesomeIcon icon={faCheck} />}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
