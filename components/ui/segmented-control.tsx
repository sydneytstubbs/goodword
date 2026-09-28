"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

// Segmented control (DESIGN-SYSTEM.md 4.1.8): a radio group for 2 to 4
// views of one set. Arrow keys move selection; changes apply immediately.

export type Segment<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  label: string;
  segments: Segment<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
};

const widths = ["", "", "w-1/2", "w-1/3", "w-1/4"];
const positions = ["seg-pos-0", "seg-pos-1", "seg-pos-2", "seg-pos-3"];

export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onValueChange,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, segments.findIndex((s) => s.value === value));

  function onKeyDown(e: KeyboardEvent) {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next: number | undefined;
    if (delta) next = (index + delta + segments.length) % segments.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = segments.length - 1;
    if (next === undefined) return;
    e.preventDefault();
    onValueChange(segments[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative flex rounded-control bg-surface-sunken p-0.5 fc-edge", className)}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0.5 flex">
        <span
          className={cn(
            "h-full rounded-control bg-surface-raised shadow-sm transition-transform duration-fast ease-standard",
            widths[segments.length],
            positions[index],
          )}
        />
      </span>
      {segments.map((segment, i) => {
        const selected = i === index;
        return (
          <button
            key={segment.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(segment.value)}
            className={cn(
              "relative min-h-10 flex-1 rounded-control px-3 text-label transition duration-fast ease-standard before:absolute before:inset-x-0 before:-inset-y-0.5",
              selected ? "font-semibold text-default fc-selected" : "font-medium text-muted hover:text-default",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
