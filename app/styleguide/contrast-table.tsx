"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { contrastRatio, parseColor } from "@/lib/contrast";

// Live contrast (DESIGN-SYSTEM.md 3.1.3): recomputed from the tokens as the
// browser resolves them, in both themes, and flagged below threshold.

type Pair = { fg: string; bg: string; min: 4.5 | 3; documented: [number, number]; note?: string };

const PAIRS: Pair[] = [
  { fg: "--text", bg: "--surface", min: 4.5, documented: [19.0, 17.9] },
  { fg: "--text", bg: "--surface-raised", min: 4.5, documented: [19.8, 16.3] },
  { fg: "--text", bg: "--surface-sunken", min: 4.5, documented: [17.8, 18.5] },
  { fg: "--text-muted", bg: "--surface", min: 4.5, documented: [5.1, 7.6] },
  { fg: "--text-muted", bg: "--surface-raised", min: 4.5, documented: [5.3, 6.9] },
  { fg: "--text-muted", bg: "--surface-sunken", min: 4.5, documented: [4.8, 7.8] },
  { fg: "--action", bg: "--surface", min: 4.5, documented: [5.7, 8.2] },
  { fg: "--action", bg: "--surface-raised", min: 4.5, documented: [5.9, 7.4] },
  { fg: "--action-text", bg: "--action-wash", min: 4.5, documented: [6.8, 6.6] },
  { fg: "--on-action", bg: "--action", min: 4.5, documented: [5.9, 8.3] },
  { fg: "--danger", bg: "--surface", min: 4.5, documented: [6.3, 8.5] },
  { fg: "--danger", bg: "--danger-tint", min: 4.5, documented: [6.1, 7.0] },
  { fg: "--success", bg: "--surface", min: 4.5, documented: [4.8, 11.2] },
  { fg: "--success", bg: "--surface-sunken", min: 4.5, documented: [4.5, 11.6], note: "At the limit; no small success text on sunken" },
  { fg: "--inverse-text", bg: "--inverse-surface", min: 4.5, documented: [19.8, 18.2] },
  { fg: "--on-people", bg: "--people-1", min: 4.5, documented: [6.2, 6.2] },
  { fg: "--on-people", bg: "--people-2", min: 4.5, documented: [6.3, 6.3] },
  { fg: "--on-people", bg: "--people-3", min: 4.5, documented: [7.3, 7.3] },
  { fg: "--on-people", bg: "--people-4", min: 4.5, documented: [8.1, 8.1] },
  { fg: "--border-strong", bg: "--surface", min: 3, documented: [3.3, 4.0] },
  { fg: "--border-strong", bg: "--surface-raised", min: 3, documented: [3.5, 3.6] },
  { fg: "--border-strong", bg: "--surface-sunken", min: 3, documented: [3.1, 4.1] },
  { fg: "--focus-ring", bg: "--surface", min: 3, documented: [5.7, 8.2] },
  { fg: "--focus-ring", bg: "--surface-raised", min: 3, documented: [5.9, 7.4] },
  { fg: "--focus-ring", bg: "--surface-sunken", min: 3, documented: [5.3, 8.4] },
];

// People tones on the dark page sit below 3:1 by design; a poster-edge ring
// compensates and they never carry meaning alone (3.1.3).
const PEOPLE_ON_PAGE: Pair[] = ["--people-1", "--people-2", "--people-3", "--people-4"].map((fg) => ({
  fg,
  bg: "--surface",
  min: 3,
  documented: [5.9, 2.4],
  note: "Dark: documented exception, ringed",
}));

type Row = Pair & { light: number; dark: number };

function measure(probe: HTMLElement, pair: Pair): number {
  const style = getComputedStyle(probe);
  const fg = parseColor(style.getPropertyValue(pair.fg));
  const bg = parseColor(style.getPropertyValue(pair.bg));
  return fg && bg ? contrastRatio(fg, bg) : NaN;
}

export function ContrastTable() {
  const lightProbe = useRef<HTMLDivElement>(null);
  const darkProbe = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const light = lightProbe.current;
    const dark = darkProbe.current;
    if (!light || !dark) return;
    // Reading computed tokens from the DOM is an external read, done once on mount.
    setRows(
      [...PAIRS, ...PEOPLE_ON_PAGE].map((pair) => ({
        ...pair,
        light: measure(light, pair),
        dark: measure(dark, pair),
      })),
    );
  }, []);

  const failures = rows.filter((r) => r.light < r.min || (r.dark < r.min && !r.note?.startsWith("Dark:"))).length;

  return (
    <div className="flex flex-col gap-3">
      <div ref={lightProbe} data-theme="light" hidden />
      <div ref={darkProbe} data-theme="dark" hidden />
      <p role="status" className={cn("text-body-strong", failures ? "text-danger" : "text-success")}>
        {rows.length === 0 ? "Measuring…" : failures ? `${failures} pairing(s) below threshold` : `All ${rows.length} pairings pass`}
      </p>
      <div role="region" aria-label="Contrast table" tabIndex={0} className="overflow-x-auto rounded-card border border-subtle">
        <table className="w-full min-w-150 border-collapse text-start text-caption">
          <caption className="sr-only">WCAG contrast of every token pairing, light and dark</caption>
          <thead className="bg-surface-sunken text-default">
            <tr>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Foreground</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Background</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Needs</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Light (doc)</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Dark (doc)</th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const lightFail = row.light < row.min;
              const darkFail = row.dark < row.min;
              return (
                <tr key={`${row.fg}-${row.bg}`} className="border-t border-subtle">
                  <td className="px-3 py-2 text-default">{row.fg}</td>
                  <td className="px-3 py-2 text-default">{row.bg}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{row.min}:1</td>
                  <td className={cn("px-3 py-2 tabular-nums", lightFail ? "font-semibold text-danger" : "text-default")}>
                    {row.light.toFixed(2)} ({row.documented[0]}) {lightFail ? "Fail" : "Pass"}
                  </td>
                  <td className={cn("px-3 py-2 tabular-nums", darkFail ? "font-semibold text-danger" : "text-default")}>
                    {row.dark.toFixed(2)} ({row.documented[1]}) {darkFail ? "Below" : "Pass"}
                  </td>
                  <td className="px-3 py-2 text-muted">{row.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
