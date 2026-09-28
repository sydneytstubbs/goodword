import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon } from "../icon";

// Link (DESIGN-SYSTEM.md 4.1.3). Links go somewhere; buttons do things.

export type TextLinkProps = ComponentProps<typeof NextLink> & {
  /** inline: underlined text in a sentence. standalone: "See all 12 comments". */
  variant?: "inline" | "standalone";
  /** Opens in a new tab, with a hidden "(opens in new tab)" and an icon. Only mid-task. */
  newTab?: boolean;
};

const variants = {
  inline:
    "text-default underline decoration-strong decoration-1 underline-offset-3 transition duration-fast ease-standard hover:text-action hover:decoration-action",
  standalone:
    "inline-flex min-h-target items-center text-label font-medium text-action-text hover:underline hover:underline-offset-3",
};

export function TextLink({ variant = "inline", newTab, className, children, ...props }: TextLinkProps) {
  return (
    <NextLink
      className={cn(variants[variant], className)}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {children}
      {newTab && (
        <>
          <Icon name="external" size={16} className="ms-1 inline align-text-bottom" />
          <span className="sr-only"> {t("common.opensInNewTab")}</span>
        </>
      )}
    </NextLink>
  );
}
