"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loading indicators appear only after 300ms, and once shown stay at least
 * 500ms so they never flicker (DESIGN-SYSTEM.md 4.1.17, 5.10).
 */
export function useDelayedFlag(active: boolean, delay = 300, minVisible = 500): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (active) {
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delay);
    } else if (shownAt.current !== null) {
      const remaining = Math.max(0, minVisible - (Date.now() - shownAt.current));
      timer = setTimeout(() => {
        shownAt.current = null;
        setVisible(false);
      }, remaining);
    }
    return () => clearTimeout(timer);
  }, [active, delay, minVisible]);

  return visible;
}

/** True when motion should be reduced: the media query or the styleguide simulation. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "reduce"
  );
}

/** Desktop-style input: a fine pointer that can hover (DS 3.9, 4.2.11). */
export function isDesktopPointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
