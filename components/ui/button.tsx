"use client";

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { useDelayedFlag } from "@/lib/hooks";
import { t } from "@/lib/messages";
import { Icon, type IconName } from "../icon";
import { buttonBase, buttonSizes, buttonVariants, type ButtonSize, type ButtonVariant } from "./button-styles";
import { Spinner } from "./spinner";

export { buttonBase, buttonSizes, buttonVariants, type ButtonSize, type ButtonVariant };

// Button (DESIGN-SYSTEM.md 4.1.1). One primary per screen. Prefer
// aria-disabled plus an explanation over disabling (3.8).

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Replaces the label with a spinner after 300ms, keeping the width. */
  loading?: boolean;
  /** Full width: the main action of a sheet or form on mobile. */
  fullWidth?: boolean;
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
