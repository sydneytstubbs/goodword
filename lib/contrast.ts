// WCAG 2.x contrast (DESIGN-SYSTEM.md 3.1.3). Used by /styleguide to
// recompute every pairing live from the tokens, in both themes.

export type RGBA = { r: number; g: number; b: number; a: number };

/** Parses #rgb, #rrggbb, #rrggbbaa, rgb(r g b / a) and rgb(r, g, b, a). */
export function parseColor(input: string): RGBA | null {
  const value = input.trim().toLowerCase();
  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const alpha = parts[3];
    const a = alpha === undefined ? 1 : alpha.endsWith("%") ? parseFloat(alpha) / 100 : Number(alpha);
    if ([r, g, b, a].some((x) => Number.isNaN(x))) return null;
    return { r, g, b, a };
  }
  return null;
}

/** Composite a translucent color over an opaque background. */
export function composite(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }: RGBA): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: RGBA, bg: RGBA): number {
  const top = fg.a < 1 ? composite(fg, bg) : fg;
  const l1 = luminance(top);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
