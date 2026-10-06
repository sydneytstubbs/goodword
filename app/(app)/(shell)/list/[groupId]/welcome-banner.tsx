"use client";

import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { t } from "@/lib/messages";
import { markWelcomeSeen } from "../../groups/actions";

// One-time welcome after joining (F10): shown on first arrival, then marked
// seen, so it stays until dismissed or you leave, and never comes back.
export function WelcomeBanner({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    void markWelcomeSeen(groupId);
  }, [groupId]);
  if (!open) return null;
  return <Banner onDismiss={() => setOpen(false)}>{t("shelf.welcome", { group: groupName })}</Banner>;
}
