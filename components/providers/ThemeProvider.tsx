"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  applyThemePrefs,
  getDefaultAccent,
  getDefaultCustomHex,
  getDefaultTheme,
  persistThemePrefs,
  readThemePrefs,
  type AccentName,
  type ThemeMode,
} from "@/lib/themePrefs";

interface ThemeContextType {
  theme: ThemeMode;
  accent: AccentName;
  customHex: string;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentName) => void;
  setCustomHex: (hex: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getDefaultTheme());
  const [accent, setAccentState] = useState<AccentName>(getDefaultAccent());
  const [customHex, setCustomHexState] = useState<string>(getDefaultCustomHex());

  useEffect(() => {
    // Read from localStorage on mount (preserves theme state across navigations)
    const prefs = readThemePrefs();
    setThemeState(prefs.theme);
    setAccentState(prefs.accent);
    setCustomHexState(prefs.customHex);
    applyThemePrefs(prefs.theme, prefs.accent, prefs.customHex);
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyThemePrefs(newTheme, accent, customHex);
    persistThemePrefs(newTheme, accent, customHex);
  };

  const setAccent = (newAccent: AccentName) => {
    setAccentState(newAccent);
    applyThemePrefs(theme, newAccent, customHex);
    persistThemePrefs(theme, newAccent, customHex);
  };

  /** Updates the live custom color (from a <input type="color">) — always
   * switches accent to "custom" too, since picking a color implies using it. */
  const setCustomHex = (hex: string) => {
    setCustomHexState(hex);
    setAccentState("custom");
    applyThemePrefs(theme, "custom", hex);
    persistThemePrefs(theme, "custom", hex);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "pulseframe:theme" ||
        e.key === "pulseframe:accent" ||
        e.key === "pulseframe:accent-custom-hex" ||
        e.key === "stubline:theme" ||
        e.key === "stubline:accent"
      ) {
        const prefs = readThemePrefs();
        setThemeState(prefs.theme);
        setAccentState(prefs.accent);
        setCustomHexState(prefs.customHex);
        applyThemePrefs(prefs.theme, prefs.accent, prefs.customHex);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, accent, customHex, setTheme, setAccent, setCustomHex, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: getDefaultTheme(),
      accent: getDefaultAccent(),
      customHex: getDefaultCustomHex(),
      setTheme: () => {},
      setAccent: () => {},
      setCustomHex: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
