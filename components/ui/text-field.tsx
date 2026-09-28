"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon } from "../icon";

// Text field (DESIGN-SYSTEM.md 4.1.4). Label always visible above, 44px
// field, 16px text (no iOS zoom), helper or error below, never placeholder-only.

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  /** Visually hide the label (it stays the accessible name). For search fields with a clear purpose. */
  hideLabel?: boolean;
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  /** Leading icon, e.g. search. */
  leading?: ReactNode;
  /** Trailing control, e.g. a clear button. */
  trailing?: ReactNode;
};

export const fieldBase =
  "w-full rounded-control border border-strong bg-surface-raised text-body text-default placeholder:text-muted caret-action transition duration-fast ease-standard fc-edge hover:border-muted focus:border-action read-only:border-transparent read-only:bg-surface-sunken disabled:opacity-40";

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, optional, helper, error, leading, trailing, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className={cn("text-label text-default", hideLabel && "sr-only")}>
        {label}
        {optional && <span className="text-muted"> {t("field.optional")}</span>}
      </label>
      <div className="relative flex items-center">
        {leading && <span className="pointer-events-none absolute start-3 text-muted">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldBase,
            "h-11 px-3",
            leading && "ps-10",
            trailing && "pe-12",
            error && "border-danger hover:border-danger",
          )}
          {...props}
        />
        {trailing && <span className="absolute end-0">{trailing}</span>}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1 text-caption text-danger">
          <Icon name="error" size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {helper && (
        <p id={helperId} className="text-caption text-muted">
          {helper}
        </p>
      )}
    </div>
  );
});
