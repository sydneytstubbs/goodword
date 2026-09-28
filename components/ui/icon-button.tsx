"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "../icon";
import { Tooltip } from "./tooltip";

// Icon button (DESIGN-SYSTEM.md 4.1.2): 44px hit area, 36px hover/press
// background, required accessible name mirrored by a desktop tooltip.

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  icon: IconName;
  /** Required: the accessible name, also shown as the desktop tooltip. */
  label: string;
  iconSize?: 20 | 24;
  tone?: "default" | "muted";
  /** Filled icon for toggles that are on. */
  weight?: "regular" | "fill";
  /** A count badge or dot pinned to the icon (Activity bell). */
  badge?: ReactNode;
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom";
  tooltipAlign?: "center" | "end";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, iconSize = 20, tone = "default", weight = "regular", badge, tooltip = true, tooltipSide, tooltipAlign, className, type = "button", ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "group relative grid size-target shrink-0 place-items-center rounded-control transition duration-fast ease-standard",
        "aria-disabled:opacity-40 disabled:opacity-40",
        tone === "muted" ? "text-muted" : "text-default",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute inset-1 rounded-control transition duration-fast ease-standard group-hover:bg-surface-hover group-active:bg-surface-pressed"
      />
      <span className="relative">
        <Icon name={icon} size={iconSize} weight={weight} />
        {badge && <span className="absolute -top-2 -right-2">{badge}</span>}
      </span>
    </button>
  );
  return tooltip ? (
    <Tooltip content={label} side={tooltipSide} align={tooltipAlign}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
