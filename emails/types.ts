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

export type DigestContent = {
  good_words: number;
  group_names: string[];
  groups: Array<{
    id: string;
    name: string;
    total: number;
    titles: Array<EmailTitle & { vouchers: string[]; note: string | null }>;
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
