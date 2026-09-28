// Button styles (DESIGN-SYSTEM.md 4.1.1), in a plain module so server
// components can style a link as a button too (the marketing CTA).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

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
