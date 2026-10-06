import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Poster } from "./poster";
import { titleMeta } from "./title-meta";
import type { Title } from "./types";

// Robot guess card (DESIGN-SYSTEM.md 4.2.9): shown only when someone asks.
// Unmistakable from a friend's good word: sunken, dashed border, a Robot
// label, and no avatars, quote, or vouched-by row. Never inside a list.

export function RobotGuessCard({ title, vouchButton }: { title: Title; vouchButton?: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-dashed border-strong bg-surface-sunken p-4">
      <p className="inline-flex items-center gap-2 text-caption font-semibold text-default">
        <Icon name="robot" size={16} />
        {t("robot.label")}
      </p>
      <div className="flex items-center gap-3">
        <Poster title={title} size="row" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-card-title text-default">{title.name}</h3>
          <p className="text-caption text-muted">{titleMeta(title)}</p>
        </div>
      </div>
      {vouchButton && <div>{vouchButton}</div>}
    </article>
  );
}
