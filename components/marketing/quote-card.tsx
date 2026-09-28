import { cn } from "@/lib/cn";
import { Avatar } from "../ui/avatar";
import type { Person } from "../domain/types";

// Quote card (spec 7.2): a friend's words, set large in serif italic, with a
// cobalt opening quotation mark and their name.

export function QuoteCard({
  quote,
  person,
  context,
  className,
}: {
  quote: string;
  person: Person;
  /** "vouched for The Night Ferry" */
  context?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn("rounded-card border border-subtle bg-surface-raised p-6 shadow-md fc-edge md:p-8", className)}
    >
      <blockquote className="flex flex-col">
        {/* The glyph sits at the top of a tall line box; clip the box to the mark. */}
        <span aria-hidden="true" className="h-8 overflow-visible text-display-l leading-none text-action md:h-10">
          “
        </span>
        <p className="text-quote text-default md:text-display-m md:italic">{quote}</p>
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <Avatar person={person} size={32} decorative />
        <span className="flex flex-col">
          <span className="text-label font-semibold text-default">{person.name}</span>
          {context && <span className="text-caption text-muted">{context}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
