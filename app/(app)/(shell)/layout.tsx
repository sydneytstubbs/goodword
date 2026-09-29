import NextLink from "next/link";
import { Wordmark } from "@/components/domain/wordmark";
import { Icon } from "@/components/icon";
import { t } from "@/lib/messages";

// Minimal signed-in chrome for step 1. The full top bar, tab bar, and rail
// (components/domain/app-bars.tsx) arrive with groups and the core loop.
export default function ShellLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex h-14 items-center justify-between px-4">
        <NextLink href="/shelf" aria-label={t("wordmark.name")}>
          <Wordmark />
        </NextLink>
        <NextLink
          href="/you"
          aria-label={t("nav.you")}
          className="grid size-target place-items-center rounded-control text-default"
        >
          <Icon name="you" size={24} />
        </NextLink>
      </header>
      {children}
    </>
  );
}
