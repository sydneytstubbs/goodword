import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";

// Wordmark (BRAND.md 4.1): Instrument Serif, "Word" in italic, the only
// flourish in the identity. Never cobalt on paper.

export function Wordmark({ className }: { className?: string }) {
  const name = t("wordmark.name");
  const split = name.lastIndexOf(" ");
  return (
    <span className={cn("text-wordmark text-default", className)}>
      {name.slice(0, split + 1)}
      <em className="italic">{name.slice(split + 1)}</em>
    </span>
  );
}
