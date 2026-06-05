// Flow — Project list ordering + grouping
// ─────────────────────────────────────────────────────────────────────────────
// Strict order for the project registry:
//   1. Pinned    — most recently pinned first (by pin timestamp)
//   2. Following — projects the viewer follows / is a member of
//   3. All other projects
// A project that is both pinned and followed appears in Pinned only.
// Followed / rest use the caller-supplied `sortWithin` (so the table's column
// sort keeps working; it defaults to last-activity order).

export const SECTION_LABELS = {
  pinned: "📌 Pinned",
  followed: "👁 Following",
  rest: "All Projects",
};

/**
 * @param projects   array of project objects
 * @param isPinned   (id) => bool
 * @param isFollowed (id) => bool
 * @param pinnedAt   (id) => epoch ms (for ordering the pinned group)
 * @param sortWithin (list) => list  (applied to followed + rest)
 * @returns { list, pinned, followed, rest, boundaries }
 *          `boundaries` maps a flat-list index → section label, for the row
 *          immediately starting each non-empty group.
 */
export function groupProjects({ projects = [], isPinned, isFollowed, pinnedAt, sortWithin = (l) => l }) {
  const pinned = projects
    .filter((p) => isPinned(p.id))
    .sort((a, b) => (pinnedAt(b.id) || 0) - (pinnedAt(a.id) || 0));

  const followed = sortWithin(
    projects.filter((p) => !isPinned(p.id) && isFollowed(p.id))
  );

  const rest = sortWithin(
    projects.filter((p) => !isPinned(p.id) && !isFollowed(p.id))
  );

  const boundaries = {};
  if (pinned.length) boundaries[0] = SECTION_LABELS.pinned;
  if (followed.length) boundaries[pinned.length] = SECTION_LABELS.followed;
  if (rest.length) boundaries[pinned.length + followed.length] = SECTION_LABELS.rest;

  return { list: [...pinned, ...followed, ...rest], pinned, followed, rest, boundaries };
}

/**
 * Show the "follow this project?" pin tooltip only when the viewer is neither a
 * team member nor already following. If either is true, pin silently.
 */
export function shouldShowPinTooltip({ isTeamMember, isFollowing }) {
  return !isTeamMember && !isFollowing;
}
