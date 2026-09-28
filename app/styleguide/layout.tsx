import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import "./styleguide.css";

// /styleguide (DESIGN-SYSTEM.md 14): the living reference and the target for
// axe and visual tests. Available locally and on Vercel preview deploys;
// a 404 on production. Never indexed, never linked from the product.

export const metadata: Metadata = {
  title: "Styleguide · Good Word",
  robots: { index: false, follow: false },
};

// Apply ?theme=dark before first paint so there's no flash (DS 3.10).
const themeScript = `(function(){try{var p=new URLSearchParams(location.search);if(p.get("theme")==="dark")document.documentElement.dataset.theme="dark";}catch(e){}})();`;

export default function StyleguideLayout({ children }: LayoutProps<"/styleguide">) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <ToastProvider>{children}</ToastProvider>
    </>
  );
}
