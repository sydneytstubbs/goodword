import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "../icon";
import { buttonBase, buttonSizes, buttonVariants, type ButtonSize, type ButtonVariant } from "./button-styles";

// A link that looks like a button (DESIGN-SYSTEM.md 4.1.1, 4.1.3): for actions
// that navigate, like "Start a group". Links go somewhere; buttons do things.
export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...props
}: ComponentProps<typeof NextLink> & { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName; fullWidth?: boolean }) {
  return (
    <NextLink className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], fullWidth && "w-full", className)} {...props}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </NextLink>
  );
}
