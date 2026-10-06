"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { NewGoodWordsPill } from "@/components/domain/new-good-words-pill";
import { prefersReducedMotion } from "@/lib/hooks";
import { useBroadcast } from "@/lib/supabase/realtime";
import { useGoodWords } from "../good-words";

// Live new good words on a shelf (PRD F5.6). Others' good words never insert
// themselves, so nothing jumps under your thumb: a pill counts them, and
// tapping it scrolls to the top and brings them in. Your own show at once
// through the usual optimistic update. A good word shared into several of
// your groups counts once.

function ShelfTopic({ groupId, onGoodWord }: { groupId: string; onGoodWord: (payload: Record<string, unknown>) => void }) {
  useBroadcast(`shelf:${groupId}`, "good_word", onGoodWord);
  return null;
}

export function LiveShelf({ groupIds }: { groupIds: string[] }) {
  const router = useRouter();
  const { viewer } = useGoodWords();
  const seen = useRef(new Set<string>());
  const [count, setCount] = useState(0);

  const onGoodWord = useCallback(
    (payload: Record<string, unknown>) => {
      const id = typeof payload.good_word_id === "string" ? payload.good_word_id : null;
      if (!id || payload.user_id === viewer.id || seen.current.has(id)) return;
      seen.current.add(id);
      setCount((c) => c + 1);
    },
    [viewer.id],
  );

  const show = () => {
    setCount(0);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    router.refresh();
  };

  return (
    <>
      {groupIds.map((id) => (
        <ShelfTopic key={id} groupId={id} onGoodWord={onGoodWord} />
      ))}
      <div aria-live="polite" className="pointer-events-none sticky top-2 z-sticky flex justify-center">
        {count > 0 && <NewGoodWordsPill count={count} onShow={show} />}
      </div>
    </>
  );
}
