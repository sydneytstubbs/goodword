import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Brand images (BRAND.md 4.2, spec 8.4). Generated images can't read CSS
// variables, so these mirror the primitives in styles/tokens.css.
export const brand = {
  paper: "#FAFAF9",
  ink: "#0A0A0A",
  graphite: "#6B6B6B",
  cobalt: "#2B4BFF",
  white: "#FFFFFF",
};

const FONT_DIR = join(process.cwd(), "node_modules/@fontsource/instrument-serif/files");

export async function instrumentSerif() {
  const [normal, italic] = await Promise.all([
    readFile(join(FONT_DIR, "instrument-serif-latin-400-normal.woff")),
    readFile(join(FONT_DIR, "instrument-serif-latin-400-italic.woff")),
  ]);
  return [
    { name: "Instrument Serif", data: normal, style: "normal" as const, weight: 400 as const },
    { name: "Instrument Serif", data: italic, style: "italic" as const, weight: 400 as const },
  ];
}

/** The monogram: a white serif opening quotation mark on a cobalt square. */
export function Monogram({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: brand.cobalt,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "Instrument Serif",
          color: brand.white,
          fontSize: size * 1.25,
          lineHeight: 1,
          // The mark sits high in its em box; nudge it to the optical center.
          marginTop: size * 0.5,
        }}
      >
        “
      </span>
    </div>
  );
}
