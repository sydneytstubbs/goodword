import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Fonts (DESIGN-SYSTEM.md 3.2.2): Latin subset, swap, metric-matched fallbacks.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  // Not preloaded: the metric-matched fallback holds its place without shifting
  // layout, and the display serif (the hero headline, the LCP) loads first.
  preload: false,
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Good Word",
  // Installed on iOS: full screen, status bar over the page (DS 8.2, 8.3).
  appleWebApp: { capable: true, title: "Good Word", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // --surface, so the status bar blends in when installed (DS 8.3).
  themeColor: "#FAFAF9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
