"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { GoodWordSource } from "@/components/domain/types";

// Where this visit came from (PRD F7.1, 11): links in the digest carry
// ref=digest, so good words put in during that browser session record
// source "digest". Kept for the session in sessionStorage; the parameter is
// then dropped from the address so shared links don't carry it.

const KEY = "gw:ref";
const SOURCES: GoodWordSource[] = ["digest", "nudge_email"];

export function visitSource(): GoodWordSource | null {
  try {
    const value = sessionStorage.getItem(KEY);
    return SOURCES.includes(value as GoodWordSource) ? (value as GoodWordSource) : null;
  } catch {
    return null;
  }
}

export function useCaptureVisitSource() {
  const pathname = usePathname();
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (!ref) return;
    if (SOURCES.includes(ref as GoodWordSource)) {
      try {
        sessionStorage.setItem(KEY, ref);
      } catch {
        // Storage unavailable: this visit just counts as organic.
      }
    }
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [pathname]);
}
