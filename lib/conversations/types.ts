import type { CommentData } from "@/components/domain/types";
import type { GroupWithCount } from "@/components/domain/visibility-line";

// Conversation data shared by the server queries and the screens (PRD F13).

/**
 * A comment as the viewer may see it. `covered` is someone else's spoiler:
 * its text isn't in the page until they reveal it (DS 4.2.12).
 */
export type ConversationComment = CommentData & { covered: boolean };

/** A group's conversation about a title, for title detail's preview (DS 5.17). */
export type ConversationPreview = {
  group: GroupWithCount;
  count: number;
  latestAt?: Date;
  /** The title is on this group's shelf. */
  onShelf: boolean;
  /** The 3 most recent comments, oldest first. */
  recent: ConversationComment[];
};

export type ConversationPage = {
  comments: ConversationComment[];
  /** Earlier comments exist above the first one loaded. */
  hasOlder: boolean;
  count: number;
  /** The first comment from someone else since the viewer last read, for the New divider. */
  firstUnseenId?: string;
};

/** Comments on a shelf card's title in one group (DS 4.2.2). */
export type CommentCount = { count: number; unseen: boolean };
