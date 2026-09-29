import type { Metadata } from "next";

// Every app route sends noindex (PRD 6.4).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-surface text-default">{children}</div>;
}
