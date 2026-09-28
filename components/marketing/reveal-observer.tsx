"use client";

import { useEffect } from "react";

// Marketing entrances (spec 8.3): marks each [data-reveal] element visible
// once it's 20% in view. The styles in styles/marketing.css do the rest, and
// skip the motion entirely under reduced motion.

export function RevealObserver() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => (el.dataset.visible = ""));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.visible = "";
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}
