import type { Metadata } from "next";
import { t } from "@/lib/messages";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: `${t("legal.terms.title")} · Good Word` };

export default function TermsPage() {
  return <LegalPage doc="terms" />;
}
