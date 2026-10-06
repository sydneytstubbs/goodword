"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  barServices,
  clearFilters,
  isFiltered,
  toggle,
  type Filters,
  type Length,
  type Sort,
  type TypeFilter,
} from "@/lib/good-words/filters";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Button } from "../ui/button";
import { ChipButton, FilterChip } from "../ui/chip";
import { Menu } from "../ui/menu";
import { SegmentedControl } from "../ui/segmented-control";
import { Sheet } from "../ui/sheet";
import { TextLink } from "../ui/text-link";
import type { Group, Service } from "./types";

// The list's filter bar (DS 5.6, PRD F5.4): All / Movies / Shows, then the
// five most common streaming services with counts, then More filters, then
// sort. Every active filter stays visible on the bar, with the result count
// and one Clear. Chips are grouped by kind, so OR within a kind and AND
// across kinds reads naturally.

export type Counted<T> = T & { count: number };

/** How the URL changes: the segmented control pushes a history entry; everything else replaces (PRD 6.3). */
export type FilterChange = (next: Filters, history: "push" | "replace") => void;

export type FilterOptions = {
  /** Every service on the list, most common first, with counts under the other filters. */
  services: Array<Counted<Service>>;
  /** Genres on the list, most common first. */
  genres: Array<Counted<{ name: string }>>;
  /** My list only: filter by the groups a good word is shared into (F5.3). */
  groups?: Group[];
  /** Whether the viewer has picked their streaming services, for "On my services" (P1). */
  hasMyServices?: boolean;
};

const LENGTHS: Array<{ value: Length; key: "filters.length30" | "filters.length120" }> = [
  { value: 30, key: "filters.length30" },
  { value: 120, key: "filters.length120" },
];

const sortLabel = (sort: Sort) => t(sort === "newest" ? "filters.newest" : "filters.vouched");

/** Filters inside the More filters sheet that are on. */
function moreCount(filters: Filters, barIds: number[]): number {
  return (
    filters.services.filter((id) => !barIds.includes(id)).length +
    filters.genres.length +
    (filters.length ? 1 : 0) +
    filters.groups.length +
    (filters.mine ? 1 : 0)
  );
}

export function FilterBar({
  filters,
  options,
  resultCount,
  onChange,
  stuck = false,
}: {
  filters: Filters;
  options: FilterOptions;
  resultCount: number;
  onChange: FilterChange;
  /** A hairline once the list scrolls under the bar. */
  stuck?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const bar = barServices(options.services, filters);
  const top = bar.slice(0, 5).map((s) => s.id);
  const filtered = isFiltered(filters);
  const more = moreCount(filters, top);
  const groupName = new Map((options.groups ?? []).map((g) => [g.id, g.name]));

  return (
    <div
      role="group"
      aria-label={t("filters.barLabel")}
      className={cn(
        "sticky top-0 z-sticky -mx-4 flex flex-col gap-2 border-b bg-surface px-4 pt-2 pb-2 transition-colors duration-fast ease-standard",
        stuck ? "border-subtle" : "border-transparent",
      )}
    >
      <div className="flex items-center gap-3">
        <SegmentedControl<TypeFilter>
          label={t("filters.typeLabel")}
          value={filters.type}
          segments={[
            { value: "all", label: t("filters.all") },
            { value: "movie", label: t("filters.movies") },
            { value: "tv", label: t("filters.shows") },
          ]}
          onValueChange={(type) => onChange({ ...filters, type }, "push")}
          className="min-w-0 flex-1 md:w-96 md:flex-none"
        />
        <SortMenu sort={filters.sort} onSort={(sort) => onChange({ ...filters, sort }, "replace")} />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
        {bar.map((service) => (
          <FilterChip
            key={service.id}
            label={service.name}
            count={service.count}
            selected={filters.services.includes(service.id)}
            onClick={() => onChange({ ...filters, services: toggle(filters.services, service.id) }, "replace")}
          />
        ))}
        {filters.genres.map((genre) => (
          <FilterChip
            key={genre}
            label={genre}
            selected
            onClick={() => onChange({ ...filters, genres: toggle(filters.genres, genre) }, "replace")}
          />
        ))}
        {filters.length && (
          <FilterChip
            label={t(filters.length === 30 ? "filters.length30" : "filters.length120")}
            selected
            onClick={() => onChange({ ...filters, length: null }, "replace")}
          />
        )}
        {filters.mine && (
          <FilterChip label={t("filters.onMyServices")} selected onClick={() => onChange({ ...filters, mine: false }, "replace")} />
        )}
        {filters.groups.map((id) => (
          <FilterChip
            key={id}
            label={groupName.get(id) ?? ""}
            selected
            onClick={() => onChange({ ...filters, groups: toggle(filters.groups, id) }, "replace")}
          />
        ))}
        <ChipButton
          label={t("filters.more")}
          count={more}
          countLabel={t("filters.moreActive", { count: more })}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        />
      </div>
      <div className={cn("flex min-h-6 items-center gap-3", !filtered && "sr-only")}>
        <p role="status" className="text-label font-medium text-default tabular-nums">
          {filtered ? t("list.goodWords", { count: resultCount }) : ""}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={() => onChange(clearFilters(filters), "replace")}
            className="relative inline-flex items-center text-label font-medium text-action-text before:absolute before:-inset-x-2 before:-inset-y-2.5 hover:underline hover:underline-offset-3"
          >
            {t("filters.clear")}
          </button>
        )}
      </div>
      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t("filters.sheetTitle")}
        footer={
          <div className="flex items-center gap-3">
            {filtered && (
              <Button variant="ghost" size="lg" onClick={() => onChange(clearFilters(filters), "replace")}>
                {t("filters.clear")}
              </Button>
            )}
            <Button variant="primary" size="lg" fullWidth onClick={() => setMoreOpen(false)}>
              {t("filters.show", { count: resultCount })}
            </Button>
          </div>
        }
      >
        <MoreFilters filters={filters} options={options} onChange={onChange} />
      </Sheet>
    </div>
  );
}

function SortMenu({ sort, onSort }: { sort: Sort; onSort: (sort: Sort) => void }) {
  const sorts: Sort[] = ["newest", "vouched"];
  return (
    <Menu
      label={t("filters.sortLabel", { sort: sortLabel(sort) })}
      items={sorts.map((value) => ({
        label: sortLabel(value),
        ...(value === sort ? { icon: "vouched" as const } : {}),
        onSelect: () => onSort(value),
      }))}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={t("filters.sortLabel", { sort: sortLabel(sort) })}
          className="-me-2 ms-auto inline-flex min-h-target shrink-0 items-center gap-1 rounded-control px-2 text-label font-medium text-default transition duration-fast ease-standard hover:bg-surface-hover active:bg-surface-pressed"
        >
          {sortLabel(sort)}
          <Icon name="switcher" size={16} className="text-muted" />
        </button>
      )}
    />
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-heading text-default">{title}</h3>
      <div className="flex flex-wrap gap-x-2 gap-y-3">{children}</div>
    </section>
  );
}

/** Everything in the More filters sheet: all services, genres, length, and groups on My list. */
export function MoreFilters({ filters, options, onChange }: { filters: Filters; options: FilterOptions; onChange: FilterChange }) {
  const set = (next: Partial<Filters>) => onChange({ ...filters, ...next }, "replace");
  return (
    <div className="flex flex-col gap-6">
      {options.groups && options.groups.length > 0 && (
        <SheetSection title={t("filters.groups")}>
          {options.groups.map((group) => (
            <FilterChip
              key={group.id}
              label={group.name}
              selected={filters.groups.includes(group.id)}
              onClick={() => set({ groups: toggle(filters.groups, group.id) })}
            />
          ))}
        </SheetSection>
      )}
      {options.hasMyServices !== undefined && (
        <SheetSection title={t("filters.myServices")}>
          {options.hasMyServices ? (
            <FilterChip label={t("filters.onMyServices")} selected={filters.mine} onClick={() => set({ mine: !filters.mine })} />
          ) : (
            <TextLink href="/you/settings#services">{t("filters.pickServices")}</TextLink>
          )}
        </SheetSection>
      )}
      <SheetSection title={t("filters.services")}>
        {options.services.length === 0 ? (
          <p className="text-body text-muted">{t("filters.noServices")}</p>
        ) : (
          options.services.map((service) => (
            <FilterChip
              key={service.id}
              label={service.name}
              count={service.count}
              selected={filters.services.includes(service.id)}
              onClick={() => set({ services: toggle(filters.services, service.id) })}
            />
          ))
        )}
      </SheetSection>
      {options.genres.length > 0 && (
        <SheetSection title={t("filters.genres")}>
          {options.genres.map((genre) => (
            <FilterChip
              key={genre.name}
              label={genre.name}
              count={genre.count}
              selected={filters.genres.includes(genre.name)}
              onClick={() => set({ genres: toggle(filters.genres, genre.name) })}
            />
          ))}
        </SheetSection>
      )}
      <SheetSection title={t("filters.length")}>
        <FilterChip label={t("filters.lengthAny")} selected={filters.length === null} onClick={() => set({ length: null })} />
        {LENGTHS.map(({ value, key }) => (
          <FilterChip key={value} label={t(key)} selected={filters.length === value} onClick={() => set({ length: value })} />
        ))}
      </SheetSection>
    </div>
  );
}
