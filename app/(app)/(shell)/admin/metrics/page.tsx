import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t, type MessageKey } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Metrics · Good Word" };

// /admin/metrics (PRD 11.4): the hypotheses, week by week, from first-party
// events. Sydney's account only; anyone else gets a plain not-found, so the
// page doesn't admit it exists. Tables, no charts.

type Week = {
  week_start: string;
  invite_opens: number;
  joins: number;
  new_members: number;
  contributed_7d: number;
  median_log_seconds: number | null;
  adds_opened: number;
  good_words_created: number;
  source_organic: number;
  source_digest: number;
  source_nudge_email: number;
  source_join_prompt: number;
  source_other: number;
  where_to_watch_clicks: number;
  title_views_from_shelf: number;
  cohort_4w: number;
  active_4w: number;
  comments: number;
  commenters: number;
};

const weekLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const number = new Intl.NumberFormat("en");

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : t("metrics.none");
}

type Column = { label: MessageKey; value: (w: Week) => string };

export default async function MetricsPage() {
  await requireOnboardedUser("/admin/metrics");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (isAdmin !== true) notFound();
  const { data, error } = await supabase.rpc("admin_metrics", { p_weeks: 8 });
  const weeks = (data ?? []) as Week[];

  const sections: Array<{ heading: MessageKey; target: MessageKey; columns: Column[] }> = [
    {
      heading: "metrics.h1",
      target: "metrics.h1Target",
      columns: [
        { label: "metrics.inviteOpens", value: (w) => number.format(w.invite_opens) },
        { label: "metrics.joins", value: (w) => number.format(w.joins) },
        { label: "metrics.rate", value: (w) => percent(w.joins, w.invite_opens) },
      ],
    },
    {
      heading: "metrics.h2",
      target: "metrics.h2Target",
      columns: [
        { label: "metrics.newMembers", value: (w) => number.format(w.new_members) },
        { label: "metrics.contributed", value: (w) => number.format(w.contributed_7d) },
        { label: "metrics.rate", value: (w) => percent(w.contributed_7d, w.new_members) },
      ],
    },
    {
      heading: "metrics.h3",
      target: "metrics.h3Target",
      columns: [
        { label: "metrics.median", value: (w) => (w.median_log_seconds === null ? t("metrics.none") : t("metrics.seconds", { value: w.median_log_seconds })) },
        { label: "metrics.completion", value: (w) => percent(w.good_words_created, w.adds_opened) },
      ],
    },
    {
      heading: "metrics.h4",
      target: "metrics.h4Target",
      columns: [
        { label: "metrics.goodWords", value: (w) => number.format(w.good_words_created) },
        { label: "metrics.organic", value: (w) => percent(w.source_organic, w.good_words_created) },
        {
          label: "metrics.nudged",
          value: (w) => percent(w.source_digest + w.source_nudge_email + w.source_join_prompt, w.good_words_created),
        },
      ],
    },
    {
      heading: "metrics.h5",
      target: "metrics.h5Target",
      columns: [
        { label: "metrics.whereToWatch", value: (w) => number.format(w.where_to_watch_clicks) },
        { label: "metrics.titleViews", value: (w) => number.format(w.title_views_from_shelf) },
      ],
    },
    {
      heading: "metrics.h6",
      target: "metrics.h6Target",
      columns: [
        { label: "metrics.cohort", value: (w) => number.format(w.cohort_4w) },
        { label: "metrics.active", value: (w) => number.format(w.active_4w) },
        { label: "metrics.rate", value: (w) => percent(w.active_4w, w.cohort_4w) },
      ],
    },
    {
      heading: "metrics.h7",
      target: "metrics.h7Target",
      columns: [
        { label: "metrics.comments", value: (w) => number.format(w.comments) },
        { label: "metrics.commenters", value: (w) => number.format(w.commenters) },
      ],
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-l text-default">{t("metrics.title")}</h1>
        <p className="text-body text-muted">{t("metrics.intro")}</p>
      </div>
      {error ? (
        <p role="alert" className="text-body text-danger">
          {t("metrics.failed")}
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-title-m text-default">{t(section.heading)}</h2>
            <p className="text-caption text-muted">{t(section.target)}</p>
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="border-b border-strong text-left">
                  <th scope="col" className="py-2 pr-3 text-label text-muted">
                    {t("metrics.week")}
                  </th>
                  {section.columns.map((column) => (
                    <th key={column.label} scope="col" className="py-2 pr-3 text-right text-label text-muted last:pr-0">
                      {t(column.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.week_start} className="border-b border-subtle">
                    <th scope="row" className="py-2 pr-3 text-left font-regular text-default">
                      {weekLabel.format(new Date(`${week.week_start}T00:00:00Z`))}
                    </th>
                    {section.columns.map((column) => (
                      <td key={column.label} className="py-2 pr-3 text-right text-default tabular-nums last:pr-0">
                        {column.value(week)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </main>
  );
}
