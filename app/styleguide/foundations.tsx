"use client";

import { useState } from "react";
import { Icon, icons, type IconName } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ContrastTable } from "./contrast-table";
import { Component, Note, Section } from "./parts";

// Foundations (DESIGN-SYSTEM.md 3): color, type, space, shape, elevation,
// motion, icons. Swatches read tokens directly, so they use inline styles
// (allowed here; /styleguide is dev tooling, outside the component lint scope).

const SEMANTIC = [
  "surface",
  "surface-raised",
  "surface-sunken",
  "surface-hover",
  "surface-pressed",
  "text",
  "text-muted",
  "border-subtle",
  "border-strong",
  "action",
  "action-hover",
  "action-text",
  "action-wash",
  "on-action",
  "success",
  "danger",
  "danger-tint",
  "inverse-surface",
  "inverse-text",
  "focus-ring",
  "scrim",
  "poster-edge",
];
const PEOPLE = ["people-1", "people-2", "people-3", "people-4"];
const PEOPLE_NAMES = ["clay", "ochre", "moss", "plum"];

function Swatches({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} className="flex flex-col gap-4 rounded-card border border-subtle bg-surface p-4 text-default">
      <p className="text-heading">{theme === "light" ? "Light" : "Dark (prepared, not shipped)"}</p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[...SEMANTIC, ...PEOPLE].map((token) => (
          <li key={token} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-10 shrink-0 rounded-control border border-subtle"
              style={{ background: `var(--${token})` }}
            />
            <span className="min-w-0 truncate text-caption">
              --{token}
              {token.startsWith("people-") && ` (${PEOPLE_NAMES[Number(token.at(-1)) - 1]})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TYPE: Array<{ token: string; sample: string; spec: string }> = [
  { token: "display-xl", sample: "Take your friends' word for it.", spec: "Instrument Serif · clamp(56, 10vw, 144) / 0.95" },
  { token: "display-l", sample: "Different friends, different taste.", spec: "Instrument Serif · clamp(40, 6vw, 80) / 1.0" },
  { token: "display-m", sample: "Your first good word.", spec: "Instrument Serif · clamp(28, 3.5vw, 44) / 1.1" },
  { token: "title-l", sample: "College crew", spec: "Instrument Serif · 56 / 0.92 (the page's h1)" },
  { token: "title-l-step", sample: "Sunday book club and friends", spec: "Instrument Serif · 44 / 0.95 (step-down)" },
  { token: "quote", sample: "“ep 3 is where it gets you”", spec: "Instrument Serif italic · 24 / 1.25" },
  { token: "title-m", sample: "Who can see it", spec: "Inter 600 · 20 / 1.3" },
  { token: "heading", sample: "Where to watch", spec: "Inter 600 · 17 / 1.35" },
  { token: "body", sample: "No recs yet. What's something you'd tell a friend to watch?", spec: "Inter · 16 / 1.5" },
  { token: "body-strong", sample: "Priya", spec: "Inter 600 · 16 / 1.5" },
  { token: "label", sample: "Put in a good word", spec: "Inter 500 (600 on buttons) · 15 / 1.3" },
  { token: "card-title", sample: "The Night Ferry", spec: "Inter 600 · 15 / 1.3" },
  { token: "caption", sample: "Series · 2024", spec: "Inter · 13 / 1.4" },
  { token: "overline", sample: "Coming soon", spec: "Inter 600 · 12, +0.08em, uppercase (marketing only)" },
];

// Class names written out in full so Tailwind finds them.
const TYPE_CLASS: Record<string, string> = {
  "display-xl": "text-display-xl",
  "display-l": "text-display-l",
  "display-m": "text-display-m",
  "title-l": "text-title-l",
  "title-l-step": "text-title-l-step",
  quote: "text-quote",
  "title-m": "text-title-m",
  heading: "text-heading",
  body: "text-body",
  "body-strong": "text-body-strong",
  label: "text-label",
  "card-title": "text-card-title",
  caption: "text-caption",
  overline: "text-overline",
};

const SPACE = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 32];
const RADII = ["poster", "control", "card", "sheet", "device", "pill"];

const MOTION: Array<{ name: string; spec: string; className: string }> = [
  { name: "Toast in", spec: "--dur-base, enter, 6px rise with fade", className: "motion-ok:animate-toast-in" },
  { name: "New card on list", spec: "--dur-base, enter, fade in from 6px above", className: "motion-ok:animate-card-in" },
  { name: "Dialog in", spec: "--dur-base, enter, fade with scale 0.98 → 1", className: "motion-ok:animate-dialog-in" },
  { name: "Milestone", spec: "--dur-slow, enter, fade and 8px rise", className: "motion-ok:animate-rise" },
  { name: "Marketing entrance", spec: "--dur-expressive, enter, fade and 8px rise", className: "motion-ok:animate-rise-expressive" },
  { name: "Skeleton pulse", spec: "The only loop", className: "motion-ok:animate-pulse" },
];

function MotionDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setRun((r) => r + 1)}>Replay motion</Button>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MOTION.map((m) => (
          <li key={m.name} className="flex flex-col gap-2">
            <div className="grid h-24 place-items-center rounded-card border border-subtle bg-surface-sunken">
              <span key={run} className={cn("block h-10 w-24 rounded-control bg-surface-raised shadow-md", m.className)} />
            </div>
            <p className="text-body-strong text-default">{m.name}</p>
            <p className="text-caption text-muted">{m.spec}</p>
          </li>
        ))}
      </ul>
      <Note>With reduce motion on (the control above, or the OS setting), everything appears in its final state.</Note>
    </div>
  );
}

export function Foundations() {
  return (
    <>
      <Section id="color" title="Color" intro="Neutral first; cobalt is the only accent. Components use semantic roles only (3.1).">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Swatches theme="light" />
          <Swatches theme="dark" />
        </div>
        <Component id="contrast" title="Contrast, computed live" spec="3.1.3">
          <ContrastTable />
        </Component>
      </Section>

      <Section id="type" title="Type" intro="Instrument Serif for display at 24px and up; Inter for everything else (3.2).">
        <ul className="flex flex-col gap-6">
          {TYPE.map((row) => (
            <li key={row.token} className="flex flex-col gap-1 border-b border-subtle pb-6">
              <p className="text-caption text-muted">
                {row.token} · {row.spec}
              </p>
              <p className={cn("text-default", TYPE_CLASS[row.token])}>{row.sample}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="space" title="Space, shape, elevation" intro="4px base. Whitespace is the main layout tool (3.3, 3.4).">
        <Component id="spacing" title="Spacing" spec="3.3.1">
          <ul className="flex flex-col gap-2">
            {SPACE.map((n) => (
              <li key={n} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-caption text-muted">--space-{n}</span>
                <span className="h-3 rounded-control bg-action" style={{ width: `var(--space-${n})` }} />
              </li>
            ))}
          </ul>
        </Component>
        <Component id="radii" title="Radii" spec="3.4.1">
          <ul className="flex flex-wrap gap-4">
            {RADII.map((r) => (
              <li key={r} className="flex flex-col items-center gap-2">
                <span
                  className="size-20 border border-strong bg-surface-raised"
                  style={{ borderRadius: `var(--radius-${r})` }}
                />
                <span className="text-caption text-muted">--radius-{r}</span>
              </li>
            ))}
          </ul>
        </Component>
        <Component id="elevation" title="Elevation" spec="3.4.2">
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <li className="flex flex-col gap-2">
              <span className="h-20 rounded-card border border-subtle bg-surface" />
              <span className="text-caption text-muted">0 · part of the page</span>
            </li>
            <li className="flex flex-col gap-2">
              <span className="h-20 rounded-card border border-subtle bg-surface-raised shadow-sm" />
              <span className="text-caption text-muted">1 · cards, posters, inputs</span>
            </li>
            <li className="flex flex-col gap-2">
              <span className="h-20 rounded-card bg-surface-raised shadow-md" />
              <span className="text-caption text-muted">2 · hover, menus, Add</span>
            </li>
            <li className="flex flex-col gap-2">
              <span className="h-20 rounded-card bg-surface-raised shadow-lg" />
              <span className="text-caption text-muted">3 · sheets, dialogs, toasts</span>
            </li>
          </ul>
        </Component>
      </Section>

      <Section id="motion" title="Motion" intro="Quiet and quick. Things fade and settle a few pixels; nothing bounces (3.7).">
        <MotionDemo />
      </Section>

      <Section id="icons" title="Icons" intro="Phosphor, regular weight; fill only for the active tab and toggles that are on (3.5).">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {(Object.keys(icons) as IconName[]).map((name) => (
            <li key={name} className="flex items-center gap-3 rounded-control border border-subtle px-3 py-2">
              <Icon name={name} size={24} />
              <span className="text-caption text-muted">{name}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
