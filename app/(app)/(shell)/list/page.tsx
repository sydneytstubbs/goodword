import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";

// The old List tab: Home is the first tab now (PRD F16.8, F16.10), and group
// lists are reached from its switcher. Keeps an email's ref=digest (and the
// weekend prompt's add=1, which opens Add) through the redirect.
export default async function ListPage({ searchParams }: PageProps<"/list">) {
  await requireOnboardedUser("/list");
  const { ref, add } = await searchParams;
  const keep = new URLSearchParams({ ...(add === "1" ? { add } : {}), ...(typeof ref === "string" ? { ref } : {}) }).toString();
  redirect(`/home${keep ? `?${keep}` : ""}`);
}
