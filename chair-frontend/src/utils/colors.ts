export interface HSL {
  h: number;
  s: number;
  l: number;
}

function lerpHsl(a: HSL, b: HSL, t: number): HSL {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return {
    h: a.h + dh * t,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  };
}

function hslToCss({ h, s, l }: HSL): string {
  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function interpolateStops(stops: [number, HSL][], date: Date): string {
  const m = minutesOfDay(date);
  for (let i = 0; i < stops.length - 1; i++) {
    const [m1, c1] = stops[i];
    const [m2, c2] = stops[i + 1];
    if (m >= m1 && m < m2)
      return hslToCss(lerpHsl(c1, c2, (m - m1) / (m2 - m1)));
  }
  return hslToCss(stops[0][1]);
}

// ── Hex ↔ HSL conversion ───────────────────────────────────────────────────

export function hexToHsl(hex: string): HSL {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: hue * 360, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: HSL): string {
  const sv = s / 100;
  const lv = l / 100;
  const a = sv * Math.min(lv, 1 - lv);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lv - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ── Color stops ────────────────────────────────────────────────────────────

const BG_STOPS: [number, HSL][] = [
  [0, { h: 218, s: 100, l: 14 }],
  [300, { h: 218, s: 100, l: 14 }],
  [390, { h: 215, s: 95, l: 20 }],
  [480, { h: 213, s: 88, l: 30 }],
  [630, { h: 211, s: 78, l: 44 }],
  [780, { h: 210, s: 73, l: 58 }],
  [930, { h: 211, s: 78, l: 44 }],
  [1080, { h: 213, s: 88, l: 30 }],
  [1170, { h: 215, s: 95, l: 20 }],
  [1260, { h: 218, s: 100, l: 16 }],
  [1440, { h: 218, s: 100, l: 14 }],
];

const LIGHT_STOPS: [number, HSL][] = [
  [0, { h: 20, s: 85, l: 8 }],
  [300, { h: 20, s: 85, l: 8 }],
  [360, { h: 28, s: 90, l: 35 }],
  [480, { h: 36, s: 75, l: 62 }],
  [600, { h: 45, s: 50, l: 78 }],
  [780, { h: 195, s: 20, l: 88 }],
  [900, { h: 45, s: 50, l: 78 }],
  [1080, { h: 36, s: 75, l: 62 }],
  [1140, { h: 28, s: 90, l: 35 }],
  [1320, { h: 20, s: 85, l: 12 }],
  [1440, { h: 20, s: 85, l: 8 }],
];

// Sun during day, moon at night
const ORB_STOPS: [number, HSL][] = [
  [0, { h: 220, s: 35, l: 78 }], // moon — pale cold blue-white
  [300, { h: 220, s: 35, l: 78 }], // still moon
  [360, { h: 32, s: 90, l: 62 }], // sunrise — deep orange
  [480, { h: 45, s: 95, l: 68 }], // morning sun — warm gold
  [780, { h: 48, s: 100, l: 75 }], // noon — brightest gold
  [960, { h: 45, s: 95, l: 68 }], // afternoon sun
  [1080, { h: 28, s: 90, l: 58 }], // sunset orange
  [1140, { h: 220, s: 45, l: 62 }], // dusk — cooling to moon tone
  [1260, { h: 220, s: 35, l: 78 }], // moon
  [1440, { h: 220, s: 35, l: 78 }],
];

export function getTimeBgColor(date: Date): string {
  return interpolateStops(BG_STOPS, date);
}

export function getCircadianLightColor(date: Date): string {
  return interpolateStops(LIGHT_STOPS, date);
}

export function getOrbColor(date: Date): string {
  return interpolateStops(ORB_STOPS, date);
}

export function getAdaptiveAccent(bgHsl: string): {
  accent: string;
  accentText: string;
} {
  const m = bgHsl.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  const bgL = m ? +m[3] : 14;
  // Dark bg → light warm accent. Light bg → dark terracotta.
  const accentL = Math.round(Math.max(28, Math.min(82, 90 - bgL)));
  const accent = hslToCss({ h: 22, s: 72, l: accentL });
  // Text on the accent button should be dark when accent is light, light when dark
  const accentText = accentL > 52 ? "#0a0e1a" : "#eef2ff";
  return { accent, accentText };
}

// ── Blend two colors (hex or hsl) in HSL space ────────────────────────────
export function lerpColor(a: string, b: string, t: number): string {
  const parse = (s: string): HSL => {
    const hslMatch = s.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    if (hslMatch) return { h: +hslMatch[1], s: +hslMatch[2], l: +hslMatch[3] };
    return hexToHsl(s.startsWith("#") ? s : "#000000");
  };
  return hslToCss(lerpHsl(parse(a), parse(b), t));
}
