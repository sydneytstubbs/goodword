"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent } from "react";
import { GroupPickerFields, VisibilityLine, type GroupWithCount } from "@/components/domain/visibility-line";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deckHref } from "@/lib/import/paths";
import { shrinkImage, type Shrunk } from "@/lib/import/shrink";
import { MAX_SCREENSHOTS, MAX_TEXT } from "@/lib/import/text";
import { t } from "@/lib/messages";
import { useAdd } from "../../add";

// Add recs (PRD F15.1, DS 5.18): paste, dictate, or add up to 5 Letterboxd
// screenshots, pick who sees them, then Find my titles. While it looks, the
// count streams in with Cancel; the list is kept through errors and Cancel.

const DRAFT_KEY = "gw:import-draft";

type Phase =
  | { kind: "input" }
  | { kind: "finding"; count: number }
  | { kind: "nothing"; allAlready: boolean }
  | { kind: "error"; message: string };

type StreamMessage =
  | { type: "found"; count: number }
  | { type: "done"; importId: string; found: number; duplicates: number; truncated: boolean }
  | { type: "error"; reason: string };

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(text: string) {
  try {
    if (text) sessionStorage.setItem(DRAFT_KEY, text);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable: the draft lasts as long as the page.
  }
}

const ERRORS: Record<string, string> = {
  limited: "importRecs.limited",
  too_much: "importRecs.tooMuch",
  offline: "importRecs.offline",
};

export function AddRecsForm({
  groups,
  peopleIn,
  friends,
}: {
  groups: GroupWithCount[];
  peopleIn: Record<string, string[]>;
  /** Friends are an audience, on by default (PRD F16.2). */
  friends?: { count: number };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { openAdd } = useAdd();
  const [text, setText] = useState("");
  const [shots, setShots] = useState<Shrunk[]>([]);
  // The same default as a single good word: all your groups, or Friends with the flag (F15.1, F16.2).
  const [selected, setSelected] = useState<string[]>(friends ? [] : groups.map((g) => g.id));
  const [friendsOn, setFriendsOn] = useState(true);
  const friendsPick = friends ? { on: friendsOn, count: friends.count } : undefined;
  const [picking, setPicking] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  // The typed list survives a reload or a trip to search, for the session.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(readDraft());
  }, []);

  // Object URLs are freed when a screenshot goes away.
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const hasInput = text.trim().length > 0 || shots.length > 0;
  const finding = phase.kind === "finding";
  const chosen = groups.filter((g) => selected.includes(g.id));
  const people = new Set(selected.flatMap((id) => peopleIn[id] ?? [])).size;

  async function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length < files.length) showToast({ message: t("importRecs.notAnImage") });
    const room = MAX_SCREENSHOTS - shots.length;
    if (images.length > room) showToast({ message: t("importRecs.tooManyScreenshots") });
    const shrunk = (await Promise.all(images.slice(0, Math.max(0, room)).map(shrinkImage))).filter((s): s is Shrunk => s !== null);
    if (shrunk.length < Math.min(images.length, room)) showToast({ message: t("importRecs.notAnImage") });
    setShots((current) => [...current, ...shrunk].slice(0, MAX_SCREENSHOTS));
  }

  function removeShot(index: number) {
    setShots((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });
  }

  // Desktop: drop screenshots on the form, or paste them (Cmd/Ctrl + V).
  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!finding) void addFiles([...event.dataTransfer.files]);
  }
  function onPaste(event: ReactClipboardEvent) {
    const files = [...event.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0 || finding) return;
    event.preventDefault();
    void addFiles(files);
  }

  async function find() {
    if (!hasInput || finding) return;
    if (!navigator.onLine) {
      setPhase({ kind: "error", message: t("importRecs.offline") });
      return;
    }
    const body = new FormData();
    body.set("text", text.trim().slice(0, MAX_TEXT));
    shots.forEach((s, i) => body.append("image", s.blob, `screenshot-${i + 1}.jpg`));
    selected.forEach((id) => body.append("group", id));
    if (friendsPick?.on) body.append("friends", "1");
    const abort = new AbortController();
    controller.current = abort;
    setPhase({ kind: "finding", count: 0 });

    let done: Extract<StreamMessage, { type: "done" }> | null = null;
    let failed: string | null = null;
    try {
      const res = await fetch("/api/import", { method: "POST", body, signal: abort.signal });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        failed = data.error ?? "failed";
      } else {
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done: ended } = await reader.read();
          if (ended) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const message = JSON.parse(line) as StreamMessage;
            if (message.type === "found") setPhase({ kind: "finding", count: message.count });
            else if (message.type === "done") done = message;
            else failed = message.reason;
          }
        }
        if (!done && !failed) failed = "failed";
      }
    } catch {
      if (abort.signal.aborted) return;
      failed = navigator.onLine ? "failed" : "offline";
    } finally {
      controller.current = null;
    }

    if (failed) {
      setPhase({ kind: "error", message: t((ERRORS[failed] ?? "importRecs.error") as "importRecs.error") });
      return;
    }
    if (!done) return;
    if (done.found === 0) {
      setPhase({ kind: "nothing", allAlready: done.duplicates > 0 });
      return;
    }
    writeDraft("");
    router.push(`${deckHref(done.importId)}${done.truncated ? "?more=1" : ""}`);
  }

  function cancel() {
    controller.current?.abort();
    setPhase({ kind: "input" });
    showToast({ message: t("importRecs.cancelled") });
  }

  if (phase.kind === "nothing") {
    return (
      <EmptyState
        title={phase.allAlready ? t("importRecs.allAlready") : t("importRecs.nothingTitle")}
        body={t("importRecs.nothingBody")}
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => setPhase({ kind: "input" })}>
              {t("common.retry")}
            </Button>
            <Button onClick={() => openAdd({ entryPoint: "empty_state", source: "import" })}>{t("importRecs.searchInstead")}</Button>
          </div>
        }
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void find();
      }}
      onDragOver={(event) => {
        if (finding) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      {phase.kind === "error" && (
        <Banner tone="error" icon="error" blocking>
          {phase.message}
        </Banner>
      )}

      <div
        className={cn(
          "flex flex-col gap-5 rounded-card transition duration-fast ease-standard",
          dragging && "border border-dashed border-strong bg-surface-sunken p-3",
          finding && "opacity-60",
        )}
      >
        <Textarea
          label={t("importRecs.label")}
          helper={
            <>
              <span className="lg:hidden">{t("importRecs.tipPhone")}</span>
              <span className="hidden lg:inline">{t("importRecs.tipDesktop")}</span>
            </>
          }
          value={text}
          onValueChange={(value) => {
            setText(value);
            writeDraft(value);
          }}
          maxLength={MAX_TEXT}
          minRows={6}
          maxRows={14}
          readOnly={finding}
          autoComplete="off"
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon="screenshots"
              onClick={() => fileInput.current?.click()}
              aria-disabled={finding || shots.length >= MAX_SCREENSHOTS}
            >
              {t("importRecs.addScreenshots")}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(event) => {
                void addFiles([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
          </div>
          <p className="text-caption text-muted">
            <span className="lg:hidden">{t("importRecs.screenshotsHelp")}</span>
            <span className="hidden lg:inline">{t("importRecs.screenshotsHelpDesktop")}</span>
          </p>
          {shots.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {shots.map((shot, i) => (
                <li key={shot.url} className="relative">
                  {/* A local preview of the shrunk screenshot; nothing to optimize. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.url}
                    alt={t("importRecs.screenshotAlt", { n: i + 1 })}
                    className="size-20 rounded-control border border-subtle object-cover"
                  />
                  <IconButton
                    icon="close"
                    label={t("importRecs.removeScreenshot", { n: i + 1 })}
                    onClick={() => removeShot(i)}
                    disabled={finding}
                    className="absolute -top-3 -right-3"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <VisibilityLine
        groups={chosen}
        peopleCount={people}
        friends={friendsPick}
        onChange={(groups.length > 0 || friends) && !finding ? () => setPicking(true) : undefined}
        className="self-start"
      />

      {finding ? (
        <div className="flex flex-wrap items-center gap-4">
          <p role="status" className="flex items-center gap-3 text-body text-default">
            <Spinner size={20} />
            {phase.count > 0 ? t("importRecs.found", { count: phase.count }) : t("importRecs.finding")}
          </p>
          <Button onClick={cancel}>{t("importRecs.cancel")}</Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            aria-disabled={!hasInput}
            aria-describedby={hasInput ? undefined : "import-submit-hint"}
            className="w-full md:w-auto"
          >
            {t("importRecs.submit")}
          </Button>
          {!hasInput && (
            <p id="import-submit-hint" className="text-caption text-muted">
              {t("importRecs.submitHint")}
            </p>
          )}
        </div>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title={t("visibility.pickerTitle")}
        footer={
          <Button variant="primary" size="lg" fullWidth onClick={() => setPicking(false)}>
            {t("common.done")}
          </Button>
        }
      >
        <GroupPickerFields
          groups={groups}
          selectedIds={selected}
          onSelectedChange={setSelected}
          friends={friendsPick}
          onFriendsChange={setFriendsOn}
        />
      </Sheet>
    </form>
  );
}
