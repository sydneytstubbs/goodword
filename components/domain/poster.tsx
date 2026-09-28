"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { accentToTone } from "@/lib/genre-accent";
import { t } from "@/lib/messages";
import { toneBg } from "@/lib/people-color";
import type { Title } from "./types";

// Poster (DESIGN-SYSTEM.md 4.2.1): 2:3, never shifts layout, an inset
// hairline edge so light posters don't bleed into the page. Falls back to a
// typographic poster in the title's genre tone when there's no image or it fails.

export type PosterSize = "row" | "activity" | "grid" | "detail";

const sizes: Record<PosterSize, string> = {
  row: "w-12",
  activity: "w-16",
  grid: "w-full",
  detail: "w-full max-w-80",
};

export function Poster({
  title,
  size = "grid",
  alt,
  loading = false,
  eager = false,
  className,
}: {
  title: Pick<Title, "name" | "year" | "type" | "accent" | "posterUrl">;
  size?: PosterSize;
  /** "Title (year)", or omit when the title is written right next to the poster. */
  alt?: string;
  /** Still fetching the title: a sunken placeholder. */
  loading?: boolean;
  /** Only the first row of posters loads eagerly (DS 9). */
  eager?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const small = size === "row" || size === "activity";
  const showImage = title.posterUrl && !failed;

  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      className={cn(
        "@container relative aspect-2/3 shrink-0 overflow-hidden rounded-poster shadow-sm fc-edge",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-poster after:ring-1 after:ring-poster-edge after:ring-inset",
        loading ? "bg-surface-sunken motion-ok:animate-pulse" : !showImage && toneBg[accentToTone(title.accent)],
        sizes[size],
        className,
      )}
    >
      {!loading && showImage && (
        // TMDB serves its own size variants via srcset (DS 9), so next/image isn't needed here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={title.posterUrl}
          alt=""
          width={342}
          height={513}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {!loading && !showImage && (
        <div aria-hidden="true" className="absolute inset-0 flex flex-col text-on-people">
          {small ? (
            <span className="m-auto text-poster-initial">{Array.from(title.name)[0]}</span>
          ) : (
            <div className="flex h-full flex-col justify-between p-3">
              <span className="line-clamp-3 text-poster-title">{title.name}</span>
              <span className="text-caption">
                {t("title.meta", { type: t(`title.${title.type}`), year: String(title.year) })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
