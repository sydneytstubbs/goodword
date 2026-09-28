import { ImageResponse } from "next/og";
import { Monogram, brand, instrumentSerif } from "../_brand/monogram";

// Open Graph image (spec 8.4): paper, the hero headline in Instrument Serif,
// the monogram in the corner.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Take your friends' word for it. Good Word.";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: brand.paper,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Monogram size={96} radius={22} />
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Instrument Serif",
            fontSize: 128,
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            color: brand.ink,
            flexWrap: "wrap",
            maxWidth: 1000,
          }}
        >
          <span>Take your friends&apos;&nbsp;</span>
          <span style={{ fontStyle: "italic" }}>word</span>
          <span>&nbsp;for it.</span>
        </div>
      </div>
    ),
    { ...size, fonts: await instrumentSerif() },
  );
}
