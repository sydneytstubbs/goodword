// The shapes the email functions in supabase/migrations/*_email.sql return.

export type EmailTitle = {
  id: string;
  tmdb_id: number;
  type: "movie" | "tv";
  title: string;
  year: number | null;
  poster_path: string | null;
  accent: "clay" | "ochre" | "moss" | "plum" | null;
};

/** One title in the digest: who vouched, the newest note, and the group only when that's how it reached you (PRD F7.1). */
export type DigestTitle = EmailTitle & { vouchers: string[]; note: string | null; group: { id: string; name: string } | null };

/** The weekly digest (PRD F7.1, F7.5): what Home shows, then each group's conversation summary. */
export type DigestContent = {
  good_words: number;
  group_names: string[];
  /** Titles with something new; the email lists up to 8. */
  total_titles: number;
  titles: DigestTitle[];
  /** Friends' imports, one line each, counting only what you can see. */
  rollups: Array<{ name: string; count: number }>;
  /** Groups with new comments. */
  groups: Array<{
    id: string;
    name: string;
    comments: number;
    conversations: number;
    top_conversations: Array<EmailTitle & { comments: number }>;
  }>;
};

/**
 * One conversation's mentions for one person: a group's (group_id and
 * group_name), or the one under a good word (good_word_id, and whose it is:
 * PRD F16.9).
 */
export type MentionBatch = {
  group_id: string | null;
  group_name: string | null;
  title: EmailTitle;
  comments: Array<{ id: string; author: string; body: string | null; is_spoiler: boolean; created_at: string }>;
  good_word_id?: string | null;
  word_author_id?: string | null;
  word_author_name?: string | null;
  /** The person it's for, so "your good word" reads right. */
  user_id?: string;
};

export type JoinBatch = Array<{ group_id: string; group_name: string; name: string; at: string }>;

/** Where links point, and the signed unsubscribe link for this email. */
export type EmailLinks = { origin: string; unsubscribe: string };
