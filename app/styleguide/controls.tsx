"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

// Dev-only controls (DESIGN-SYSTEM.md 14): theme (also ?theme=dark),
// reduced-motion simulation, and 200% text.

function useRootFlag(attribute: "theme" | "motion" | "textScale", on: string) {
  const [enabled, setEnabled] = useState(false);

  // Read what the inline script (or a previous toggle) already applied.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(document.documentElement.dataset[attribute] === on);
  }, [attribute, on]);

  function set(next: boolean) {
    setEnabled(next);
    if (next) document.documentElement.dataset[attribute] = on;
    else delete document.documentElement.dataset[attribute];
  }
  return [enabled, set] as const;
}

export function Controls() {
  const [dark, setDark] = useRootFlag("theme", "dark");
  const [reduced, setReduced] = useRootFlag("motion", "reduce");
  const [bigText, setBigText] = useRootFlag("textScale", "200");

  function setTheme(next: boolean) {
    setDark(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("theme", "dark");
    else url.searchParams.delete("theme");
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
      <Switch label="Dark theme" description="Prepared, not shipped (3.10)" checked={dark} onCheckedChange={setTheme} />
      <Switch label="Reduce motion" description="Simulates the OS setting (3.7.3)" checked={reduced} onCheckedChange={setReduced} />
      <Switch label="200% text" description="Text only, no zoom (7.1)" checked={bigText} onCheckedChange={setBigText} />
    </div>
  );
}
