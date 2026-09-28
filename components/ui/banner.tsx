"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon, type IconName } from "../icon";
import { IconButton } from "./icon-button";

// Banner (DESIGN-SYSTEM.md 4.1.16): a persistent inline message for an
// ongoing condition. role="alert" only for errors that block the current task.

export type BannerTone = "info" | "warning" | "error";

export function Banner({
  tone = "info",
  icon,
  children,
  action,
  onDismiss,
  blocking = false,
  className,
}: {
  tone?: BannerTone;
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
  /** Non-critical banners are dismissible. */
  onDismiss?: () => void;
  blocking?: boolean;
  className?: string;
}) {
  const tinted = tone !== "info";
  return (
    <div
      role={blocking ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-card border border-subtle px-4 py-3 fc-edge",
        tinted ? "bg-danger-tint" : "bg-surface-sunken",
        className,
      )}
    >
      <Icon
        name={icon ?? (tinted ? "error" : "help")}
        size={20}
        className={cn("mt-0.5 shrink-0", tinted ? "text-danger" : "text-muted")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-body text-default">{children}</p>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {onDismiss && (
        <IconButton icon="close" label={t("common.close")} tone="muted" onClick={onDismiss} className="-my-2 -me-3" />
      )}
    </div>
  );
}
