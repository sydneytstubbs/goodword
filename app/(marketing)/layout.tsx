import "@/styles/marketing.css";

// The marketing route group is a fixed brand surface, always light (DS 3.10).
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="light" className="min-h-dvh bg-surface text-default">
      {children}
    </div>
  );
}
