import type { NextConfig } from "next";

// Security headers on every route (PRD 10.4). The Content Security Policy
// allows only this site, Supabase (data, sign-in, and Realtime), and TMDB's
// image host. Scripts allow 'unsafe-inline' because Next.js inlines its own
// bootstrap scripts, and a per-request nonce would force every page, the
// static marketing page included, to render on demand. No third-party
// scripts load anywhere, so there's nothing else to allow.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "*.supabase.co";
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "font-src 'self'",
  `connect-src 'self' https://${supabase} wss://${supabase}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // "Shelf" became "list" (PRD v1.4.0, slice 13). Old links in emails,
  // bookmarks, and Home Screen icons keep working, query string included.
  async redirects() {
    return [
      { source: "/shelf", destination: "/list", permanent: true },
      { source: "/shelf/:path*", destination: "/list/:path*", permanent: true },
      { source: "/api/shelves/:path*", destination: "/api/lists/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
