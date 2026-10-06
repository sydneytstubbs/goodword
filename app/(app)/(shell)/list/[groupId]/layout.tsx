import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getGroup } from "@/lib/groups/queries";

// Membership is checked here, above the list's loading skeleton, so a
// non-member gets a real 404 before anything streams (PRD 6.4). The page's
// own check reuses this request's cached result.
export default async function GroupListLayout({ children, params }: LayoutProps<"/list/[groupId]">) {
  const { groupId } = await params;
  const { user } = await requireOnboardedUser(`/list/${groupId}`);
  if (!(await getGroup(groupId, user.id))) notFound();
  return children;
}
