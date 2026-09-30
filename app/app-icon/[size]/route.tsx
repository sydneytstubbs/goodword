import { ImageResponse } from "next/og";
import { Monogram, instrumentSerif } from "../../_brand/monogram";

// Home Screen and install icons for the web app manifest (DS 8.3): the
// monogram at 192 and 512. `maskable` fills the square so Android's mask
// never clips the mark (BRAND.md 4.2).
const SIZES = new Set([192, 512]);

export async function GET(_request: Request, { params }: RouteContext<"/app-icon/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response(null, { status: 404 });
  return new ImageResponse(<Monogram size={size} radius={0} />, {
    width: size,
    height: size,
    fonts: await instrumentSerif(),
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
