import { ImageResponse } from "next/og";
import { Monogram, instrumentSerif } from "./_brand/monogram";

// Apple touch icon: square; iOS applies its own rounded mask (BRAND.md 4.2).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<Monogram size={180} radius={0} />, { ...size, fonts: await instrumentSerif() });
}
