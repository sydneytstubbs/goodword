import type { Metadata } from "next";
import { NoticeToast } from "@/components/domain/notice-toast";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "./service-worker";

// Every app route sends noindex (PRD 6.4).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-surface text-default">
      <ToastProvider>
        {children}
        <NoticeToast />
        <ServiceWorker />
      </ToastProvider>
    </div>
  );
}
