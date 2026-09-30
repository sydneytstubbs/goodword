import type { Metadata } from "next";
import { t } from "@/lib/messages";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: `${t("legal.privacy.title")} · Good Word` };

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
