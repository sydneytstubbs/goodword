"use client";

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { useDelayedFlag } from "@/lib/hooks";
import { t } from "@/lib/messages";
import { Icon, type IconName } from "../icon";
import { Spinner } from "./spinner";

// Button (DESIGN-SYSTEM.md 4.1.1). One primary per screen. Prefer
// aria-disabled plus an explanation over disabling (3.8).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Replaces the label with a spinner after 300ms, keeping the width. */
  loading?: boolean;
  /** Full width: the main action of a sheet or form on mobile. */
  fullWidth?: boolean;
};

export const buttonBase =
  "relative inline-flex items-center justify-center gap-2 rounded-control text-label font-semibold whitespace-nowrap select-none transition duration-fast ease-standard motion-ok:active:scale-98 fc-edge aria-disabled:opacity-40 aria-disabled:cursor-not-allowed disabled:opacity-40 disabled:cursor-not-allowed";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover active:bg-action-hover",
  secondary:
    "bg-surface-raised text-default border border-subtle shadow-sm hover:bg-surface-hover active:bg-surface-pressed",
  ghost: "bg-transparent text-default hover:bg-surface-hover active:bg-surface-pressed",
  danger: "bg-surface-raised text-danger border border-subtle shadow-sm hover:bg-danger-tint active:bg-danger-tint",
};

// md and sm extend their hit area to 44px with a pseudo-element (3.9).
export const buttonSizes: Record<ButtonSize, string> = {
  lg: "h-12 px-5",
  md: "h-10 px-4 before:absolute before:inset-x-0 before:-inset-y-0.5",
  sm: "h-8 px-3 before:absolute before:inset-x-0 before:-inset-y-1.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, loading = false, fullWidth, className, children, onClick, type = "button", ...props },
  ref,
) {
  const showSpinner = useDelayedFlag(loading);
  const inactive = props["aria-disabled"] === true || props["aria-disabled"] === "true";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inactive || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], fullWidth && "w-full", className)}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2", showSpinner && "invisible")}>
        {icon && <Icon name={icon} size={20} />}
        {children}
      </span>
      {showSpinner && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={20} />
          <span className="sr-only">{t("common.loading")}</span>
        </span>
      )}
    </button>
  );
});
