import { cn } from "@/lib/cn";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { peopleTone, toneBg } from "@/lib/people-color";

// Avatar and avatar stack (DESIGN-SYSTEM.md 4.1.10): initials on a people
// tone assigned from the user id. No photos in the MVP.

export type Person = { id: string; name: string };
export type AvatarSize = 24 | 32 | 40 | 56;

const sizes: Record<AvatarSize, string> = {
  24: "size-6 text-caption font-semibold",
  32: "size-8 text-label font-semibold",
  40: "size-10 text-heading",
  56: "size-14 text-title-m",
};

// The "+N" overflow chip matches the avatar height.
const heights: Record<AvatarSize, string> = {
  24: "h-6 min-w-6",
  32: "h-8 min-w-8",
  40: "h-10 min-w-10",
  56: "h-14 min-w-14",
};

// Stack overlap is 25% of the avatar size.
const overlap: Record<AvatarSize, string> = {
  24: "-ms-1.5",
  32: "-ms-2",
  40: "-ms-2.5",
  56: "-ms-3.5",
};

function initial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase("en") ?? "";
}

export function Avatar({
  person,
  size = 32,
  decorative = false,
  edge = true,
  className,
}: {
  person: Person;
  size?: AvatarSize;
  /** Hide from assistive tech when the name is written next to it. */
  decorative?: boolean;
  /** The dark-theme poster-edge ring (3.1.3). Stacks use their own separating ring. */
  edge?: boolean;
  className?: string;
}) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : person.name}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-pill text-on-people select-none",
        edge && "dark:ring-1 dark:ring-poster-edge",
        toneBg[peopleTone(person.id)],
        sizes[size],
        className,
      )}
    >
      {initial(person.name)}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 24,
  max = 3,
  ring = "surface",
  className,
}: {
  people: Person[];
  size?: AvatarSize;
  max?: number;
  /** The background the stack sits on, used for the 2px separating ring. */
  ring?: "surface" | "surface-raised";
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const label = nameList(people.map((p) => p.name));
  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center", className)}>
      {shown.map((person, i) => (
        <Avatar
          key={person.id}
          person={person}
          size={size}
          decorative
          edge={false}
          className={cn("ring-2", ring === "surface" ? "ring-surface" : "ring-surface-raised", i > 0 && overlap[size])}
        />
      ))}
      {extra > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-grid shrink-0 place-items-center rounded-pill bg-surface-sunken px-1 text-caption font-medium text-muted tabular-nums ring-2",
            ring === "surface" ? "ring-surface" : "ring-surface-raised",
            heights[size],
            overlap[size],
          )}
        >
          {t("people.overflow", { count: extra })}
        </span>
      )}
    </span>
  );
}
