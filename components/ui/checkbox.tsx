"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../icon";

// Checkbox (DESIGN-SYSTEM.md 4.1.6): a native checkbox, restyled. The whole
// row is the 44px hit target. Used in the group picker.

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  /** Secondary text on the row, e.g. "6 people". */
  description?: ReactNode;
  /** Leading visual, e.g. a group dot. */
  leading?: ReactNode;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, leading, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-target cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed has-disabled:opacity-40",
        className,
      )}
    >
      <span className="relative grid size-5 shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded-checkbox border border-strong bg-surface-raised transition duration-fast ease-standard checked:border-action checked:bg-action fc-edge"
          {...props}
        />
        <Icon
          name="vouched"
          size={16}
          weight="fill"
          className="pointer-events-none absolute text-on-action opacity-0 peer-checked:opacity-100"
        />
      </span>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-default">{label}</span>
        {description && <span className="text-caption text-muted">{description}</span>}
      </span>
    </label>
  );
});
