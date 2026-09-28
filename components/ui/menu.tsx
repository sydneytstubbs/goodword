"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "../icon";

// Menu (DESIGN-SYSTEM.md 4.1.12): 3 or more secondary actions on an object.
// A sheet of full-width rows on mobile; a popover anchored to the trigger on
// desktop. Menu button pattern: arrow keys move, Esc closes and returns
// focus, Tab closes. Destructive items sit last, after a divider.

export type MenuItem = {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  destructive?: boolean;
};

export type MenuProps = {
  /** Accessible name of the menu, e.g. "More actions for Priya's comment". */
  label: string;
  items: MenuItem[];
  /** Renders the trigger; spread the props onto a button. */
  trigger: (props: {
    ref: (el: HTMLButtonElement | null) => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  }) => ReactNode;
  align?: "start" | "end";
};

export function Menu({ label, items, trigger, align = "end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  // State rather than a ref, so the trigger can be handed to render props.
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const ordered = [...items.filter((i) => !i.destructive), ...items.filter((i) => i.destructive)];
  const firstDestructive = ordered.findIndex((i) => i.destructive);

  function focusItem(index: number) {
    const count = ordered.length;
    itemRefs.current[((index % count) + count) % count]?.focus();
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerEl?.focus();
  }

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node) && !triggerEl?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // focusItem is stable enough for this effect; only re-run on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, triggerEl]);

  function onMenuKeyDown(e: KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(ordered.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="relative inline-flex">
      {trigger({
        ref: setTriggerEl,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": menuId,
        onClick: () => setOpen((o) => !o),
        onKeyDown: onTriggerKeyDown,
      })}
      {open && (
        <>
          {/* Mobile: a scrim behind the menu sheet. Tapping it closes the menu. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-scrim bg-scrim motion-ok:animate-fade-in lg:hidden"
            onClick={() => close()}
          />
          <div
            ref={containerRef}
            className={cn(
              "fixed inset-x-0 bottom-0 z-sheet rounded-t-sheet border border-subtle bg-surface-raised px-2 pt-2 pb-safe-footer shadow-lg fc-edge motion-ok:animate-sheet-in",
              "lg:absolute lg:inset-x-auto lg:top-full lg:bottom-auto lg:mt-1 lg:min-w-56 lg:rounded-card lg:p-1 lg:shadow-md lg:motion-ok:animate-fade-in",
              align === "end" ? "lg:end-0" : "lg:start-0",
            )}
          >
            <div id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className="flex flex-col">
              {ordered.map((item, i) => (
                <div key={item.label} className="contents">
                  {i === firstDestructive && i > 0 && (
                    <div role="separator" className="my-1 border-t border-subtle" />
                  )}
                  <button
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                    className={cn(
                      "flex min-h-target items-center gap-3 rounded-control px-3 text-start text-body transition duration-fast ease-standard lg:min-h-10",
                      "hover:bg-surface-hover focus-visible:bg-surface-hover active:bg-surface-pressed",
                      item.destructive ? "text-danger" : "text-default",
                    )}
                  >
                    {item.icon && <Icon name={item.icon} size={20} />}
                    {item.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
