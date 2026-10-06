import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getGroup } from "@/lib/groups/queries";

// Membership is checked here, above the shelf's loading skeleton, so a
// non-member gets a real 404 before anything streams (PRD 6.4). The page's
// own check reuses this request's cached result.
export default async function GroupShelfLayout({ children, params }: LayoutProps<"/shelf/[groupId]">) {
  const { groupId } = await params;
  const { user } = await requireOnboardedUser(`/shelf/${groupId}`);
  if (!(await getGroup(groupId, user.id))) notFound();
  return children;
}
