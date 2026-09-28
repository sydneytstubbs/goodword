"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { fieldBase } from "./text-field";

// Textarea / note field (DESIGN-SYSTEM.md 4.1.5): auto-grows 2 to 5 lines.
// Counter appears at 100 of 140 ("40 left"), turns danger at 0, hard-stops
// there, and is announced only at 20 left and at the limit.

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange"> & {
  label: string;
  hideLabel?: boolean;
  optional?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  maxLength?: number;
  /** Characters used before the counter appears. Defaults to maxLength − 40. */
  counterAt?: number;
  minRows?: number;
  maxRows?: number;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hideLabel,
    optional,
    helper,
    error,
    value: controlled,
    defaultValue = "",
    onValueChange,
    maxLength = 140,
    counterAt,
    minRows = 2,
    maxRows = 5,
    id,
    className,
    ...props
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current!);

  const remaining = maxLength - value.length;
  const showCounter = value.length >= (counterAt ?? maxLength - 40);
  const [announcement, setAnnouncement] = useState("");

  const resize = useCallback(() => {
    const el = inner.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const padding = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    el.style.height = "auto";
    const max = lineHeight * maxRows + padding;
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? "auto" : "hidden";
  }, [maxRows]);

  useEffect(resize, [value, resize]);

  function change(next: string) {
    const before = maxLength - value.length;
    const after = maxLength - next.length;
    if (after === 0 && before !== 0) setAnnouncement(t("field.limitReached"));
    else if (after <= 20 && before > 20) setAnnouncement(t("field.charactersLeftAnnounce", { count: after }));
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
  }

  const counterId = `${fieldId}-counter`;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={fieldId} className={cn("text-label text-default", hideLabel && "sr-only")}>
        {label}
        {optional && <span className="text-muted"> {t("field.optional")}</span>}
      </label>
      <textarea
        ref={inner}
        id={fieldId}
        rows={minRows}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => change(e.target.value)}
        className={cn(fieldBase, "resize-none px-3 py-2", error && "border-danger hover:border-danger")}
        {...props}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
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
        {showCounter && (
          <p
            id={counterId}
            aria-hidden="true"
            className={cn("shrink-0 text-caption tabular-nums", remaining === 0 ? "text-danger" : "text-muted")}
          >
            {t("field.charactersLeft", { count: remaining })}
          </p>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
});
