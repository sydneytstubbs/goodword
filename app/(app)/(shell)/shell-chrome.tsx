"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ActivityBell } from "@/components/domain/app-bars";
import { Wordmark } from "@/components/domain/wordmark";
import { cn } from "@/lib/cn";
import { isConversationPath } from "@/lib/conversations/paths";
import { t } from "@/lib/messages";
import { useActivityCount } from "./activity-count";
import { OfflineBanner } from "./offline-banner";
import { QueuedGoodWords } from "./queued-good-words";

// The page frame below 1024px (PRD 6.2, DS 4.2.8): the header with the
// wordmark and the Activity bell, and room for the tab bar. The conversation
// screen has its own compact header and composer instead, like a messaging
// screen, so it gets neither.
export function ShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { count } = useActivityCount();
  const immersive = isConversationPath(pathname);

  return (
    <div className={cn("lg:ps-rail lg:pb-0", !immersive && "pb-tabbar-safe")}>
      {!immersive && (
        <header className="flex h-14 items-center justify-between ps-4 pe-2 lg:hidden">
          <NextLink href="/shelf" aria-label={t("wordmark.name")}>
            <Wordmark />
          </NextLink>
          <ActivityBell count={count} />
        </header>
      )}
      <div className={cn(!immersive && "lg:pt-8")}>
        {!immersive && <OfflineBanner />}
        {!immersive && <QueuedGoodWords />}
        {children}
      </div>
    </div>
  );
}
