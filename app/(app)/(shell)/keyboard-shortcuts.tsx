"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Desktop shortcuts that go somewhere (DS 3.9): `g` then `h` (Home), `y` (My
// list), or `a` (Activity), and `?` for the list in Help. `g` then `s` still
// works and opens Home too. `n` and `/` live with Add. Never while typing,
// never with a sheet or menu open, never required.

const GO: Record<string, string> = { h: "/home", s: "/home", y: "/you", a: "/activity" };
const SEQUENCE_MS = 1500;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function KeyboardShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let pendingG = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector("dialog[open], [role='menu']")) return;
      if (e.key === "?") {
        e.preventDefault();
        router.push("/you/help#shortcuts");
        return;
      }
      const go = GO[e.key];
      if (pendingG && Date.now() - pendingG < SEQUENCE_MS && go) {
        e.preventDefault();
        pendingG = 0;
        router.push(go);
        return;
      }
      pendingG = e.key === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
  return null;
}
