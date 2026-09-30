"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/messages";
import { logoSrc } from "@/lib/tmdb/images";
import type { Provider } from "@/lib/tmdb/normalize";
import { saveStreamingServices } from "./actions";

/** The services shown before "Show all": the region's most popular. */
const FIRST = 12;

// Settings › Streaming services (P1, F5.4): tick the services you have and
// "On my services" on a shelf shows only titles on one of them. Each tick
// saves at once and rolls back with a Retry toast if it fails (DS 5.10,
// DS 5.16). Services are per region, so they follow Settings › Region.
export function StreamingServices({ region, providers, initial }: { region: string; providers: Provider[]; initial: number[] }) {
  const [picked, setPicked] = useState(initial);
  // What's ticked right now, so quick ticks in a row each save the whole set.
  const current = useRef(initial);
  const update = (ids: number[]) => {
    current.current = ids;
    setPicked(ids);
  };
  const [all, setAll] = useState(false);
  const { showToast } = useToast();

  const change = async (id: number, on: boolean) => {
    const without = current.current.filter((v) => v !== id);
    update(on ? [...without, id] : without);
    const ok = await saveStreamingServices(region, current.current).catch(() => false);
    if (ok) return;
    const rest = current.current.filter((v) => v !== id);
    update(on ? rest : [...rest, id]);
    showToast({ message: t("settings.didntSave"), action: { label: t("common.retry"), onAction: () => change(id, on) } });
  };

  if (providers.length === 0) return <p className="text-body text-muted">{t("settings.servicesUnavailable")}</p>;

  // Ticked services always show, so nothing you have is hidden behind "Show all".
  const shown = all ? providers : providers.filter((p, i) => i < FIRST || picked.includes(p.id));
  return (
    <div className="flex flex-col items-start gap-2">
      <ul className="flex w-full flex-col" aria-label={t("settings.servicesHeading")}>
        {shown.map((provider) => (
          <li key={provider.id}>
            <Checkbox
              label={provider.name}
              checked={picked.includes(provider.id)}
              onChange={(e) => change(provider.id, e.currentTarget.checked)}
              leading={
                provider.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoSrc(provider.logo)}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    className="size-8 shrink-0 rounded-control bg-surface-sunken"
                  />
                ) : undefined
              }
            />
          </li>
        ))}
      </ul>
      {!all && shown.length < providers.length && (
        <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
          {t("settings.servicesAll", { count: providers.length })}
        </Button>
      )}
    </div>
  );
}
