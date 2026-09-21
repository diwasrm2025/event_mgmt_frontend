export type ThemeMode = "light" | "dark";
export type AccentName = "violet" | "emerald" | "amber" | "rose" | "sky" | "indigo" | "custom";

export const ACCENT_OPTIONS: Array<{ value: AccentName; label: string; swatch: string; palette: [string, string, string, string] }> = [
  { value: "violet", label: "Violet", swatch: "#7c5cff", palette: ["#7c5cff", "#a78bfa", "#ec4899", "#38bdf8"] },
  { value: "emerald", label: "Emerald", swatch: "#10b981", palette: ["#10b981", "#34d399", "#06b6d4", "#6366f1"] },
  { value: "amber", label: "Amber", swatch: "#f59e0b", palette: ["#f59e0b", "#fbbf24", "#f97316", "#ef4444"] },
  { value: "rose", label: "Rose", swatch: "#f43f5e", palette: ["#f43f5e", "#fb7185", "#a855f7", "#6366f1"] },
  { value: "sky", label: "Ocean", swatch: "#06b6d4", palette: ["#06b6d4", "#38bdf8", "#3b82f6", "#8b5cf6"] },
  { value: "indigo", label: "Indigo", swatch: "#6366f1", palette: ["#6366f1", "#818cf8", "#d946ef", "#06b6d4"] },
];

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Light Mode" },
  { value: "dark", label: "Dark Mode" },
];

const THEME_KEY = "pulseframe:theme";
const ACCENT_KEY = "pulseframe:accent";
const CUSTOM_HEX_KEY = "pulseframe:accent-custom-hex";
const LEGACY_THEME_KEY = "stubline:theme";
const LEGACY_ACCENT_KEY = "stubline:accent";

const VALID_ACCENTS: AccentName[] = ["violet", "emerald", "amber", "rose", "sky", "indigo", "custom"];

export function getDefaultTheme(): ThemeMode {
  return "light";
}

export function getDefaultAccent(): AccentName {
  return "violet";
}

export function getDefaultCustomHex(): string {
  return "#7c5cff";
}

// ---------------------------------------------------------------------------
// Color math for a user-picked "custom" accent. Presets ship a hand-tuned
// 4-color palette per theme; for a single hex we derive the rest (a lighter
// tint for --accent-2, a darker shade for --accent-strong, plus the card
// gradients) with simple HSL lightness shifts so a custom color gets the
// same visual treatment as the built-in ones, not just a single flat color.
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function shiftLightness(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const newL = Math.max(0, Math.min(1, l + delta));
  const [nr, ng, nb] = hslToRgb(h, s, newL);
  return rgbToHex(nr, ng, nb);
}

export function deriveCustomAccentVars(hex: string) {
  const base = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex) ? hex : getDefaultCustomHex();
  const [r, g, b] = hexToRgb(base);
  const lighter = shiftLightness(base, 0.16);
  const darker = shiftLightness(base, -0.18);
  return {
    "--theme-c1": base,
    "--theme-c2": lighter,
    "--theme-c3": darker,
    "--theme-c4": lighter,
    "--accent": base,
    "--accent-2": lighter,
    "--accent-strong": darker,
    "--accent-tint": `rgba(${r}, ${g}, ${b}, 0.15)`,
    "--accent-rgb": `${r}, ${g}, ${b}`,
    "--card-blue": `linear-gradient(135deg, ${base} 0%, ${lighter} 100%)`,
    "--card-green": `linear-gradient(135deg, ${lighter} 0%, ${base} 100%)`,
    "--card-purple": `linear-gradient(135deg, ${darker} 0%, ${base} 100%)`,
    "--card-indigo": `linear-gradient(135deg, ${lighter} 0%, ${darker} 100%)`,
  } as Record<string, string>;
}

export function readThemePrefs(): { theme: ThemeMode; accent: AccentName; customHex: string } {
  if (typeof window === "undefined") {
    return { theme: getDefaultTheme(), accent: getDefaultAccent(), customHex: getDefaultCustomHex() };
  }

  const theme = window.localStorage.getItem(THEME_KEY) || window.localStorage.getItem(LEGACY_THEME_KEY);
  const accent = window.localStorage.getItem(ACCENT_KEY) || window.localStorage.getItem(LEGACY_ACCENT_KEY);
  const customHex = window.localStorage.getItem(CUSTOM_HEX_KEY) || getDefaultCustomHex();

  return {
    theme: theme === "light" || theme === "dark" ? theme : getDefaultTheme(),
    accent: VALID_ACCENTS.includes(accent as AccentName) ? (accent as AccentName) : getDefaultAccent(),
    customHex,
  };
}

export function persistThemePrefs(theme: ThemeMode, accent: AccentName, customHex?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
    window.localStorage.setItem(ACCENT_KEY, accent);
    if (customHex) window.localStorage.setItem(CUSTOM_HEX_KEY, customHex);
  } catch {
    // no-op
  }
}

const CUSTOM_VAR_NAMES = [
  "--theme-c1", "--theme-c2", "--theme-c3", "--theme-c4",
  "--accent", "--accent-2", "--accent-strong", "--accent-tint", "--accent-rgb",
  "--card-blue", "--card-green", "--card-purple", "--card-indigo",
];

export function applyThemePrefs(theme: ThemeMode, accent: AccentName, customHex?: string) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;

  if (accent === "custom") {
    const vars = deriveCustomAccentVars(customHex || getDefaultCustomHex());
    Object.entries(vars).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  } else {
    // Clear any inline overrides left over from a previous "custom" pick so
    // the preset's own [data-accent="..."] CSS rule takes over cleanly.
    CUSTOM_VAR_NAMES.forEach((key) => document.documentElement.style.removeProperty(key));
  }
}

export function themeBootstrapScript() {
  return `
    (function() {
      try {
        var theme = localStorage.getItem("${THEME_KEY}") || localStorage.getItem("${LEGACY_THEME_KEY}");
        var accent = localStorage.getItem("${ACCENT_KEY}") || localStorage.getItem("${LEGACY_ACCENT_KEY}");
        var customHex = localStorage.getItem("${CUSTOM_HEX_KEY}") || "${getDefaultCustomHex()}";
        var validTheme = theme === "light" || theme === "dark" ? theme : "${getDefaultTheme()}";
        var validAccents = ["violet","emerald","amber","rose","sky","indigo","custom"];
        var validAccent = validAccents.indexOf(accent) >= 0 ? accent : "${getDefaultAccent()}";
        var root = document.documentElement;
        root.dataset.theme = validTheme;
        root.dataset.accent = validAccent;
        if (validAccent === "custom" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(customHex)) {
          function hexToRgb(hex) {
            var c = hex.replace("#", "");
            if (c.length === 3) c = c.split("").map(function(x){return x+x;}).join("");
            var num = parseInt(c, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
          }
          function rgbToHex(r,g,b){
            function h(v){ v=Math.max(0,Math.min(255,Math.round(v))); var s=v.toString(16); return s.length===1?"0"+s:s; }
            return "#"+h(r)+h(g)+h(b);
          }
          function rgbToHsl(r,g,b){
            r/=255; g/=255; b/=255;
            var max=Math.max(r,g,b), min=Math.min(r,g,b), h=0, s=0, l=(max+min)/2, d=max-min;
            if (d !== 0) {
              s = d / (1 - Math.abs(2*l-1));
              if (max === r) h = ((g-b)/d) % 6;
              else if (max === g) h = (b-r)/d + 2;
              else h = (r-g)/d + 4;
              h *= 60; if (h<0) h += 360;
            }
            return [h,s,l];
          }
          function hslToRgb(h,s,l){
            var c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs(((h/60)%2)-1)), m=l-c/2, r=0,g=0,b=0;
            if (h<60) { r=c;g=x;b=0; } else if (h<120) { r=x;g=c;b=0; } else if (h<180) { r=0;g=c;b=x; }
            else if (h<240) { r=0;g=x;b=c; } else if (h<300) { r=x;g=0;b=c; } else { r=c;g=0;b=x; }
            return [(r+m)*255, (g+m)*255, (b+m)*255];
          }
          function shift(hex, delta) {
            var rgb = hexToRgb(hex), hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
            var nl = Math.max(0, Math.min(1, hsl[2] + delta));
            var nrgb = hslToRgb(hsl[0], hsl[1], nl);
            return rgbToHex(nrgb[0], nrgb[1], nrgb[2]);
          }
          var rgb = hexToRgb(customHex);
          var lighter = shift(customHex, 0.16);
          var darker = shift(customHex, -0.18);
          var vars = {
            "--theme-c1": customHex, "--theme-c2": lighter, "--theme-c3": darker, "--theme-c4": lighter,
            "--accent": customHex, "--accent-2": lighter, "--accent-strong": darker,
            "--accent-tint": "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.15)",
            "--accent-rgb": rgb[0] + ", " + rgb[1] + ", " + rgb[2],
            "--card-blue": "linear-gradient(135deg, " + customHex + " 0%, " + lighter + " 100%)",
            "--card-green": "linear-gradient(135deg, " + lighter + " 0%, " + customHex + " 100%)",
            "--card-purple": "linear-gradient(135deg, " + darker + " 0%, " + customHex + " 100%)",
            "--card-indigo": "linear-gradient(135deg, " + lighter + " 0%, " + darker + " 100%)"
          };
          for (var k in vars) { root.style.setProperty(k, vars[k]); }
        }
      } catch (e) {}
    })();
  `;
}
