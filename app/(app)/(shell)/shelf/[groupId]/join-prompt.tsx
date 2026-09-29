"use client";

import { useEffect, useRef, useState } from "react";
import { JoinPromptCard } from "@/components/domain/join-prompt-card";
import { dismissJoinPrompt } from "@/lib/good-words/actions";
import { useAdd } from "../../add";

// The first-good-word prompt (PRD F5.7, DS 5.2): a small inline card at the
// end of the shelf, not a modal. It appears once you've looked around (you
// scrolled to the end, or 20 seconds passed), and doesn't come back for this
// group once dismissed or used.

const DELAY_MS = 20_000;

export function JoinPrompt({ groupId }: { groupId: string }) {
  const { openAdd } = useAdd();
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown) return;
    const timer = setTimeout(() => setShown(true), DELAY_MS);
    // Only a real scroll counts: a short shelf that's all on screen waits for the timer.
    const onScroll = () => {
      const top = sentinel.current?.getBoundingClientRect().top;
      if (top !== undefined && top <= window.innerHeight) setShown(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [shown]);

  function finish() {
    setGone(true);
    void dismissJoinPrompt(groupId);
  }

  if (gone) return null;
  return (
    <div ref={sentinel}>
      {shown && (
        <JoinPromptCard
          onPut={() => {
            openAdd({ source: "join_prompt" });
            finish();
          }}
          onDismiss={finish}
        />
      )}
    </div>
  );
}
