import type { MetadataRoute } from "next";
import { brand } from "./_brand/monogram";

// Web app manifest (PRD F12, DS 8.3): installable, standalone, opening on the
// shelf. Colors mirror --surface and --action (generated files can't read
// CSS variables).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Good Word",
    short_name: "Good Word",
    description: "A shared shelf of the shows and movies your friends would vouch for.",
    start_url: "/shelf",
    scope: "/",
    display: "standalone",
    background_color: brand.paper,
    theme_color: brand.paper,
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
