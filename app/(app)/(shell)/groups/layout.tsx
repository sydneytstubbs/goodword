import { notFound } from "next/navigation";
import { groupsEnabled } from "@/lib/flags";

// Group details and Create a group exist only with the groups flag on (PRD F16.7).
export default function GroupsLayout({ children }: LayoutProps<"/groups">) {
  if (!groupsEnabled) notFound();
  return children;
}
