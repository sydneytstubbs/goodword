import type { Title } from "@/components/domain/types";
import { conversationPreviews, defaultGroupId } from "@/lib/conversations/queries";
import type { GroupSummary } from "@/lib/groups/queries";
import { ConversationPreviewError, ConversationPreviewSection } from "@/components/domain/conversation-preview";

// Loads title detail's conversation preview (PRD F6, DS 5.17). Streams in
// after the rest of the title; if it fails, only this region shows an error.
// Hidden when you're in no groups.
export async function ConversationPreviewLoader({
  title,
  titleId,
  groups,
  viewerId,
  askedGroupId,
}: {
  title: Title;
  titleId: string | null;
  groups: GroupSummary[];
  viewerId: string;
  askedGroupId?: string | null;
}) {
  if (groups.length === 0) return null;
  const previews = await conversationPreviews(titleId, groups, viewerId).catch(() => null);
  if (!previews) return <ConversationPreviewError />;
  const selectedId = defaultGroupId(previews, askedGroupId);
  if (!selectedId) return null;
  return (
    <ConversationPreviewSection
      title={title}
      previews={previews}
      selectedId={selectedId}
      viewerId={viewerId}
      pathname={`/title/${title.type}/${title.tmdbId}`}
    />
  );
}
