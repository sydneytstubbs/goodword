import { ImageResponse } from "next/og";
import { Monogram, instrumentSerif } from "./_brand/monogram";

// Favicon: the cobalt monogram (BRAND.md 4.2), drawn large so it survives 16px.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<Monogram size={32} radius={7} />, { ...size, fonts: await instrumentSerif() });
}
