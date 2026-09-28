"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";

// Switch (DESIGN-SYSTEM.md 4.1.7): for settings that take effect
// immediately. A visible On/Off label means state isn't color or position alone.

export type SwitchProps = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
};

export function Switch({ label, description, checked, onCheckedChange, id, className }: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const descriptionId = `${switchId}-description`;
  return (
    <div className={cn("flex min-h-target items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col">
        <label htmlFor={switchId} className="text-body text-default">
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="text-caption text-muted">
            {description}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span aria-hidden="true" className="text-label text-muted">
          {checked ? t("common.on") : t("common.off")}
        </span>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={description ? descriptionId : undefined}
          onClick={() => onCheckedChange(!checked)}
          className="group relative grid h-11 w-11 place-items-center"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative block h-6.5 w-11 rounded-pill transition duration-fast ease-standard fc-edge",
              checked ? "bg-action fc-selected" : "bg-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5.5 rounded-pill bg-surface-raised shadow-sm transition duration-fast ease-standard",
                checked && "translate-x-4.5",
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
