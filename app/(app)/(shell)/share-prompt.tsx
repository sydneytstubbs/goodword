"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Poster } from "@/components/domain/poster";
import { titleMeta } from "@/components/domain/title-meta";
import type { Person, Title } from "@/components/domain/types";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { answerSharePrompt, type SharePromptAction } from "@/lib/share-prompt/actions";

// "Share your list with friends?" (PRD F16.10, DS 5.20), once after the flip:
// your friends, then Share all (the one primary action), Choose, and Not now.
// Choose turns the sheet into a checklist of your good words friends can't
// see yet, all unchecked. Closing the sheet counts as Not now, so it never
// comes back. Nothing is shared until you say so.
export function SharePrompt({ friends, goodWords }: { friends: Person[]; goodWords: Array<{ id: string; title: Title }> }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [pickOne, setPickOne] = useState(false);
  const [busy, setBusy] = useState(false);

  async function answer(action: SharePromptAction) {
    if (action === "choose" && chosen.length === 0) {
      setPickOne(true);
      return;
    }
    setBusy(true);
    const shared = await answerSharePrompt(action, chosen, friends.length).catch(() => null);
    setBusy(false);
    if (shared === null) {
      // Not now just closes; anything else offers Retry (DS 5.10).
      if (action === "not_now") setOpen(false);
      else showToast({ message: t("sharePrompt.didntSave"), action: { label: t("common.retry"), onAction: () => void answer(action) } });
      return;
    }
    setOpen(false);
    if (action !== "not_now") {
      showToast({ message: t("sharePrompt.done", { count: shared }) });
      router.refresh();
    }
  }

  const toggle = (id: string, on: boolean) => {
    setPickOne(false);
    setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
  };

  return (
    <Sheet
      open={open}
      onClose={() => void answer("not_now")}
      title={choosing ? t("sharePrompt.chooseTitle") : t("sharePrompt.title")}
      footer={
        choosing ? (
          <div className="flex flex-col gap-3">
            {pickOne && (
              <p role="alert" className="text-caption text-danger">
                {t("sharePrompt.pickOne")}
              </p>
            )}
            <Button variant="primary" size="lg" fullWidth loading={busy} onClick={() => void answer("choose")}>
              {chosen.length > 0 ? t("sharePrompt.shareCount", { count: chosen.length }) : t("sharePrompt.share")}
            </Button>
            <Button variant="ghost" size="lg" fullWidth onClick={() => setChoosing(false)}>
              {t("common.back")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button variant="primary" size="lg" fullWidth loading={busy} onClick={() => void answer("share_all")}>
              {t("sharePrompt.shareAll")}
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => setChoosing(true)}>
              {t("sharePrompt.choose")}
            </Button>
            <Button variant="ghost" size="lg" fullWidth onClick={() => void answer("not_now")}>
              {t("sharePrompt.notNow")}
            </Button>
          </div>
        )
      }
    >
      {choosing ? (
        <fieldset>
          <legend className="sr-only">{t("sharePrompt.chooseTitle")}</legend>
          {goodWords.map(({ id, title }) => (
            <Checkbox
              key={id}
              label={title.name}
              description={titleMeta(title)}
              leading={<Poster title={title} size="row" />}
              checked={chosen.includes(id)}
              onChange={(e) => toggle(id, e.target.checked)}
              className="py-2"
            />
          ))}
        </fieldset>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-default">{t("sharePrompt.body")}</p>
          <div className="flex items-center gap-3">
            <AvatarStack people={friends} size={32} ring="surface-raised" />
            <p className="min-w-0 text-body text-muted">{nameList(friends.map((f) => f.name))}</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}
