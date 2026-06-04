// Flow — Notification center generator
//
// Turns raw project state + the activity log into a curated, de-duplicated,
// urgency-tiered notification feed for the bell popout. All the policy lives
// here so the component stays presentational.
//
// Tiers:  action (red) > heads (amber) > fyi (gray)
// Sources: current project state (blocked / overdue) + activity events
//          (phase changes, new projects, status changes, comments, members).
import { isDevSeedMode, devStore } from "../data/devSeed";

const DAY_MS = 86_400_000;
const ARCHIVE_DAYS = 30;     // older than this is auto-archived (excluded)
const STALE_DAYS = 3;        // "no recent activity" threshold for action items

const firstName = (name) => (name ? String(name).split(/\s+/)[0] : "Someone");

function daysBetween(aIso, nowMs) {
  if (!aIso) return null;
  return Math.floor((nowMs - new Date(aIso).getTime()) / DAY_MS);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const s = iso.length === 10 ? iso + "T00:00:00" : iso;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Role lens ──────────────────────────────────────────────────────────────
// Action Required is critical for everyone. Otherwise:
//   Lead (isAdmin)      → sees everything (squad oversight)
//   PM (Product Manager)→ own projects + all phase transitions
//   Stakeholder (any other role / undefined) → shipped, blockers + own
// Always returns true for action-tier so nothing critical is hidden.
function passesRole(n, viewer) {
  if (n.tier === "action") return true;
  if (!viewer || !viewer.role) return true;              // undefined role → show all
  if (viewer.isAdmin) return true;                        // Lead
  const role = String(viewer.role).toLowerCase();
  if (role.includes("product manager") || role === "pm") {
    return n.ownedByViewer || n.type === "phase" || n.type === "shipped";
  }
  // Stakeholder (any person): high-signal items + their own projects
  return n.type === "shipped" || n.ownedByViewer;
}

/**
 * Build the notification feed for a viewer.
 * @returns array of notification objects sorted action→heads→fyi, recent first,
 *          resolved items sunk to the bottom of their tier.
 */
export function buildNotifications({ projects = [], people = [], viewer = null } = {}) {
  if (!isDevSeedMode()) return []; // prod path would read from a notifications table
  const now = Date.now();
  const archiveCutoff = now - ARCHIVE_DAYS * DAY_MS;

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const viewerId = viewer?.id;
  const viewerName = viewer?.name;
  const viewerEmail = viewer?.email;

  // Projects the viewer owns or is a member of (for comment scoping + role lens).
  const myProjectIds = new Set();
  projects.forEach((p) => {
    if (viewerId && p.owner_id === viewerId) { myProjectIds.add(p.id); return; }
    const members = devStore.listMembers(p.id) || [];
    if (viewerId && members.some((m) => m.person_id === viewerId)) myProjectIds.add(p.id);
  });

  // Did the viewer themselves trigger this event? (self-suppression)
  const isSelf = (ev) =>
    (viewerName && ev.user_name === viewerName) ||
    (viewerEmail && ev.user_email && ev.user_email === viewerEmail);

  const out = [];
  const ownedByViewer = (projId) => myProjectIds.has(projId);

  // ── ACTION: currently blocked projects ──
  projects.forEach((p) => {
    const blocked = p.status === "blocked" || p.isBlocked;
    if (!blocked) return;
    const daysBlocked = daysBetween(p.blockedAt, now);
    const daysIdle = daysBetween(p.lastActivityAt, now);
    out.push({
      id: `block-${p.id}`,
      tier: "action", type: "block",
      projectId: p.id, projectName: p.name, owner: firstName(p.owner),
      title: `${p.name} has been blocked${daysBlocked != null ? ` for ${daysBlocked} day${daysBlocked === 1 ? "" : "s"}` : ""}`,
      meta: `${p.lastActivityAt ? `No activity since ${fmtDate(p.lastActivityAt)}` : "No recent activity"}${daysIdle != null ? ` (${daysIdle}d)` : ""} · Owner: ${firstName(p.owner)}`,
      ts: p.blockedAt || p.lastActivityAt || new Date(now).toISOString(),
      cta: "Resolve", resolved: false,
      ownedByViewer: ownedByViewer(p.id),
      reason: p.blockedReason || null,
    });
  });

  // ── ACTION: overdue with no recent activity ──
  projects.forEach((p) => {
    if (!p.endDate) return;
    if (["shipped", "deprioritized", "upcoming", "complete"].includes(p.status)) return;
    if (p.status === "blocked" || p.isBlocked) return; // already surfaced as blocked
    const end = new Date(p.endDate + "T00:00:00").getTime();
    if (end >= now) return;
    const daysOver = Math.floor((now - end) / DAY_MS);
    const daysIdle = daysBetween(p.lastActivityAt, now);
    if (daysIdle != null && daysIdle < STALE_DAYS) return; // overdue but actively moving — not action
    out.push({
      id: `overdue-${p.id}`,
      tier: "action", type: "overdue",
      projectId: p.id, projectName: p.name, owner: firstName(p.owner),
      title: `${p.name} is overdue by ${daysOver} day${daysOver === 1 ? "" : "s"}`,
      meta: `${p.lastActivityAt ? `No activity since ${fmtDate(p.lastActivityAt)}` : "No recent activity"}${daysIdle != null ? ` (${daysIdle}d)` : ""} · Owner: ${firstName(p.owner)}`,
      ts: p.endDate + "T00:00:00",
      cta: "View Project", resolved: false,
      ownedByViewer: ownedByViewer(p.id),
    });
  });

  // ── EVENT-DRIVEN: phase / new / status / comments / members ──
  const events = (devStore.listAllEvents() || []).filter((ev) => {
    const t = new Date(ev.created_at).getTime();
    if (t < archiveCutoff) return false;     // auto-archive >30d
    if (isSelf(ev)) return false;            // never notify about your own actions
    return true;
  });

  // Keep only the LATEST phase change per project (suppress rapid PRD→Design→Dev steps).
  const latestPhaseByProj = new Map();
  events.forEach((ev) => {
    if (ev.action !== "project_phase_changed") return;
    const prev = latestPhaseByProj.get(ev.entity_id);
    if (!prev || new Date(ev.created_at) > new Date(prev.created_at)) latestPhaseByProj.set(ev.entity_id, ev);
  });

  // Detect resolved blockers: a project_blocked followed by a later unblock /
  // not-currently-blocked → show greyed "Resolved" instead of dropping it.
  const blockEvents = events.filter((e) => e.action === "project_blocked");
  blockEvents.forEach((ev) => {
    const p = projectsById.get(ev.entity_id);
    if (!p) return;
    const stillBlocked = p.status === "blocked" || p.isBlocked;
    if (stillBlocked) return; // active blocker already surfaced from state above
    out.push({
      id: `block-resolved-${ev.id}`,
      tier: "action", type: "block",
      projectId: p.id, projectName: p.name, owner: firstName(p.owner),
      title: `${p.name} blocker resolved`,
      meta: `Unblocked · Owner: ${firstName(p.owner)}`,
      ts: ev.created_at,
      cta: "View Project", resolved: true,
      ownedByViewer: ownedByViewer(p.id),
    });
  });

  // Per-(project,type,day) de-dup so the same kind of event on the same day
  // collapses to its latest occurrence.
  const seenDayKey = new Set();
  const dayKey = (projId, type, iso) => `${projId}|${type}|${iso.slice(0, 10)}`;

  events.forEach((ev) => {
    const p = projectsById.get(ev.entity_id);
    if (!p) return;
    const d = ev.details || {};
    const who = firstName(ev.user_name);
    const owned = ownedByViewer(p.id);

    // PHASE CHANGE — latest only, skip deprioritized
    if (ev.action === "project_phase_changed") {
      if (latestPhaseByProj.get(ev.entity_id)?.id !== ev.id) return;
      if (p.status === "deprioritized") return;
      const to = d.to || "?";
      const shipped = ["Alpha", "Beta", "GA"].includes(to);
      // Honor the "Make Announcement" toggle: un-announced ships stay out of the feed.
      if (shipped && p.announce === false) return;
      out.push({
        id: `phase-${ev.id}`,
        tier: "heads", type: shipped ? "shipped" : "phase",
        projectId: p.id, projectName: p.name, owner: firstName(p.owner),
        title: shipped ? `${p.name} shipped to ${to}` : `${p.name} moved ${d.from ? `${d.from} → ${to}` : `to ${to}`}`,
        meta: `${who} · Owner: ${firstName(p.owner)}`,
        ts: ev.created_at, cta: "View Project", resolved: false,
        ownedByViewer: owned,
      });
      return;
    }

    // NEW PROJECT
    if (ev.action === "project_created") {
      const k = dayKey(p.id, "new", ev.created_at);
      if (seenDayKey.has(k)) return; seenDayKey.add(k);
      out.push({
        id: `new-${ev.id}`,
        tier: "heads", type: "new",
        projectId: p.id, projectName: p.name, owner: firstName(p.owner),
        title: `New project: ${p.name}`,
        meta: `Created by ${who}`,
        ts: ev.created_at, cta: "View Project", resolved: false,
        ownedByViewer: owned,
      });
      return;
    }

    // STATUS CHANGE — skip deprioritized projects + no-op changes
    if (ev.action === "project_status_changed") {
      if (p.status === "deprioritized" || d.to === "deprioritized") return;
      if (d.from === d.to) return;
      const k = dayKey(p.id, "status", ev.created_at);
      if (seenDayKey.has(k)) return; seenDayKey.add(k);
      out.push({
        id: `status-${ev.id}`,
        tier: "heads", type: "status",
        projectId: p.id, projectName: p.name, owner: firstName(p.owner),
        title: `${p.name} status changed to ${d.to || "?"}`,
        meta: `${who} · Owner: ${firstName(p.owner)}`,
        ts: ev.created_at, cta: "View Project", resolved: false,
        ownedByViewer: owned,
      });
      return;
    }

    // SHIPPED
    if (ev.action === "project_shipped") {
      // Honor the "Make Announcement" toggle.
      if (p.announce === false) return;
      out.push({
        id: `shipped-${ev.id}`,
        tier: "heads", type: "shipped",
        projectId: p.id, projectName: p.name, owner: firstName(p.owner),
        title: `${p.name} shipped`,
        meta: `${who} · Owner: ${firstName(p.owner)}`,
        ts: ev.created_at, cta: "View Project", resolved: false,
        ownedByViewer: owned,
      });
      return;
    }

    // MEMBER CHANGES → FYI
    if (ev.action === "member_added" || ev.action === "member_removed") {
      const added = ev.action === "member_added";
      out.push({
        id: `member-${ev.id}`,
        tier: "fyi", type: "member",
        projectId: p.id, projectName: p.name, owner: firstName(p.owner),
        title: `${who} ${added ? "added" : "removed"} ${firstName(d.person_name) || "a member"} ${added ? "to" : "from"} ${p.name}`,
        meta: fmtDate(ev.created_at),
        ts: ev.created_at, cta: null, resolved: false,
        ownedByViewer: owned,
      });
      return;
    }
  });

  // ── FYI: comments on projects the viewer owns or is a member of ──
  projects.forEach((p) => {
    if (!myProjectIds.has(p.id)) return; // exclusion: not owner/member → skip
    const comments = devStore.listComments(p.id) || [];
    comments.forEach((cmt) => {
      if (cmt.deleted_at) return;
      if (viewerId && cmt.author_id === viewerId) return; // self
      const t = new Date(cmt.created_at).getTime();
      if (t < archiveCutoff) return;
      const author = people.find((pp) => pp.id === cmt.author_id);
      const snippet = (cmt.body || "").replace(/\s+/g, " ").trim().slice(0, 60);
      out.push({
        id: `comment-${cmt.id}`,
        tier: "fyi", type: "comment",
        projectId: p.id, projectName: p.name, owner: firstName(p.owner),
        title: `${firstName(author?.name)} commented on ${p.name}`,
        meta: snippet ? `“${snippet}${cmt.body.length > 60 ? "…" : ""}”` : fmtDate(cmt.created_at),
        ts: cmt.created_at, cta: "View Project", resolved: false,
        ownedByViewer: true,
      });
    });
  });

  // Role lens + final sort. FYI tier is intentionally excluded from the feed.
  const filtered = out.filter((n) => n.tier !== "fyi" && passesRole(n, viewer));
  const tierRank = { action: 0, heads: 1, fyi: 2 };
  filtered.sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    if (!!a.resolved !== !!b.resolved) return a.resolved ? 1 : -1; // resolved sink within tier
    return new Date(b.ts) - new Date(a.ts);
  });
  return filtered;
}
