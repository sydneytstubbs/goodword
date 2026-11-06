// Feature flags (PRD F16.7). Read at build time, so server and client agree.
// Set in Vercel's environment and redeploy to change one.

/**
 * Groups: off by default (PRD v1.6.0). With it off, every group entry point is
 * hidden (the switcher, the rail's groups, My list's groups, group toggles,
 * group conversations on the title page, "People from your groups") and group
 * routes are 404s. Nothing is deleted: memberships, group shares, and group
 * conversations stay in the database and come back when it's on.
 */
export const groupsEnabled = process.env.NEXT_PUBLIC_GROUPS_ENABLED === "true";
