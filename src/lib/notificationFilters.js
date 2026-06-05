// Flow — Notification filters (strict, no filler)
// ─────────────────────────────────────────────────────────────────────────────
// Pure filter functions applied on top of the raw feed from notifications.js.
// The guiding rule for "In the Loop": only things that are personally relevant
// and actionable. Routine churn never makes it through.
import { collectNotifications, buildMentions, sortFeed } from "./notifications";

// Types that are NEVER "In the Loop" signal — routine churn / pipeline noise.
//   member  — someone added/removed from a project
//   new     — a new project was created
//   comment — ordinary project comments (mentions are handled separately)
const FILLER_TYPES = new Set(["member", "new", "comment"]);

// "Updates" = status changes + milestones only (phase transitions + ships).
const UPDATE_TYPES = new Set(["status", "phase", "shipped"]);

/**
 * Strip filler from any feed: member churn, new-project pings, routine comments,
 * and upcoming-project noise. Used as the final safety net so nothing
 * non-critical leaks into In the Loop.
 */
export function removeFiller(items = []) {
  return items.filter(
    (n) => !FILLER_TYPES.has(n.type) && n.status !== "upcoming" && !n.filler
  );
}

/** Direct @mentions of the viewer only. */
export function filterMentions({ projects = [], people = [], viewer = null } = {}) {
  return buildMentions({ projects, people, viewer });
}

/**
 * Updates for projects the viewer owns or follows — status changes and
 * milestones (phase transitions, ships) only. Routine logs are removed.
 */
export function filterProjectUpdates(raw = [], { viewer = null, followedProjects = [] } = {}) {
  const followed = new Set(followedProjects || []);
  const mine = (n) => n.ownedByViewer || followed.has(n.projectId);
  return sortFeed(
    removeFiller(raw).filter((n) => n.tier !== "action" && UPDATE_TYPES.has(n.type) && mine(n))
  );
}

/**
 * Needs Attention — strictly two conditions, nothing else:
 *   1. Blocked   — status is blocked / has an active blocker flag (type "block",
 *                  not yet resolved).
 *   2. Beyond timeline — the due date / deadline has passed (type "overdue").
 * Explicitly excluded: approaching-but-not-overdue deadlines, low-priority,
 * merely-inactive projects, and routine status updates.
 */
export function filterNeedsAttention(raw = []) {
  return sortFeed(
    raw.filter((n) => (n.type === "block" && !n.resolved) || n.type === "overdue")
  );
}

// Re-export the raw collector so callers can build the feed in one import site.
export { collectNotifications };
