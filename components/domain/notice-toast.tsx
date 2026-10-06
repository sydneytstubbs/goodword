"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { t } from "@/lib/messages";
import { useToast } from "../ui/toast";

type NoticeKey = "alreadyMember" | "left" | "deleted" | "accountDeleted" | "nowFriends" | "alreadyFriends" | "ownFriendLink";

// Shows a one-time notice set by the server before a redirect (lib/notice.ts).
const COOKIE = "gw_notice";
const KEYS = new Set<string>(["alreadyMember", "left", "deleted", "accountDeleted", "nowFriends", "alreadyFriends", "ownFriendLink"] satisfies NoticeKey[]);

export function NoticeToast() {
  const { showToast } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!raw) return;
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    try {
      const { key, vars } = JSON.parse(decodeURIComponent(raw)) as { key: string; vars: Record<string, string> };
      if (KEYS.has(key)) showToast({ message: t(`notice.${key as NoticeKey}`, vars) });
    } catch {
      // A malformed cookie is dropped.
    }
  }, [pathname, showToast]);

  return null;
}
