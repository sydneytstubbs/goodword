"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { accentToTone } from "@/lib/genre-accent";
import { toneBg } from "@/lib/people-color";
import { posterSrc, posterSrcSet } from "@/lib/tmdb/images";
import { titleMeta } from "./title-meta";
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

// Rendered widths, so the browser picks w154 for rows, w342 for grid cards,
// and w500 for detail from the srcset (DS 9).
const renderedWidths: Record<PosterSize, string> = {
  row: "48px",
  activity: "64px",
  grid: "(min-width: 768px) 240px, 50vw",
  detail: "320px",
};

export function Poster({
  title,
  size = "grid",
  alt,
  loading = false,
  eager = false,
  className,
}: {
  title: Pick<Title, "name" | "year" | "type" | "accent" | "posterPath" | "posterUrl">;
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
  const src = title.posterPath ? posterSrc(title.posterPath) : title.posterUrl;
  const showImage = src && !failed;

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
          src={src}
          srcSet={title.posterPath ? posterSrcSet(title.posterPath) : undefined}
          sizes={title.posterPath ? renderedWidths[size] : undefined}
          alt=""
          width={342}
          height={513}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          // An image that failed before hydration never fires onError.
          ref={(img) => {
            if (img?.complete && img.currentSrc && img.naturalWidth === 0) setFailed(true);
          }}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {!loading && !showImage && (
        <div aria-hidden="true" className="absolute inset-0 flex flex-col text-on-people">
          {small ? (
            <span className="m-auto text-poster-initial">{Array.from(title.name)[0]}</span>
          ) : (
            // Title sits at the bottom, so a "New" badge on the top-left corner never covers it.
            <div className="flex h-full flex-col justify-end gap-2 p-3">
              <span className="line-clamp-3 text-poster-title wrap-break-word">{title.name}</span>
              <span className="text-caption">{titleMeta(title)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
