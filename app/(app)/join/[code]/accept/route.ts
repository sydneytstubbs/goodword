import { NextResponse, type NextRequest } from "next/server";
import { acceptFriendLink } from "@/lib/friends/accept";
import { joinWithCode } from "@/lib/groups/join";
import { getInvitePreview } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

// Accept an invite: a form POST when signed in, or a GET when returning from
// sign-in with ?next= pointing here (DS 5.2, F1). A group invite joins the
// group; a friend link makes you friends (F16.1).
async function handle(request: NextRequest, { params }: RouteContext<"/join/[code]/accept">) {
  const { code } = await params;
  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return go(`/sign-in?next=${encodeURIComponent(`/join/${code}/accept`)}`);

  const preview = await getInvitePreview(code);
  if (preview.status === "active" && preview.kind === "friend") return go(await acceptFriendLink(code));
  return go(await joinWithCode(code));
}

export const GET = handle;
export const POST = handle;
