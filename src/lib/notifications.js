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
import { isShipped, shippedDateOf, furthestStageOf } from "./tracks";

const DAY_MS = 86_400_000;
const ARCHIVE_DAYS = 30;     // older than this is auto-archived (excluded)

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

/**
 * Collect the raw notification feed for a viewer — every candidate item across
 * all tiers (action / heads / fyi), unsorted and unfiltered by role/ownership.
 * The strict filters in notificationFilters.js layer their own filtering on top.
 * @returns array of notification objects.
 */
export function collectNotifications({ projects = [], people = [], viewer = null } = {}) {
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
    out.push({
      id: `block-${p.id}`,
      tier: "action", type: "block",
      projectId: p.id, projectName: p.name, owner: firstName(p.owner),
      title: `${p.name} has been blocked${daysBlocked != null ? ` for ${daysBlocked} day${daysBlocked === 1 ? "" : "s"}` : ""}`,
      meta: `${p.blockedReason ? `${p.blockedReason} · ` : ""}Owner: ${firstName(p.owner)}`,
      ts: p.blockedAt || p.lastActivityAt || new Date(now).toISOString(),
      cta: "Resolve", resolved: false,
      ownedByViewer: ownedByViewer(p.id),
      reason: p.blockedReason || null,
    });
  });

  // ── ACTION: beyond timeline (deadline/end date has passed) ──
  // Overdue = due date in the past. Activity level is irrelevant — an actively
  // worked-on project that blew its deadline still needs attention.
  projects.forEach((p) => {
    if (!p.endDate) return;
    if (["shipped", "deprioritized", "upcoming", "complete"].includes(p.status)) return;
    if (p.status === "blocked" || p.isBlocked) return; // already surfaced as blocked
    const end = new Date(p.endDate + "T00:00:00").getTime();
    if (end >= now) return; // not past the deadline yet → not overdue
    const daysOver = Math.floor((now - end) / DAY_MS);
    out.push({
      id: `overdue-${p.id}`,
      tier: "action", type: "overdue",
      projectId: p.id, projectName: p.name, owner: firstName(p.owner),
      title: `${p.name} is overdue by ${daysOver} day${daysOver === 1 ? "" : "s"}`,
      meta: `Due ${fmtDate(p.endDate)} · Owner: ${firstName(p.owner)}`,
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

  return out;
}

const TIER_RANK = { action: 0, heads: 1, fyi: 2 };
export function sortFeed(list) {
  return [...list].sort((a, b) => {
    if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (!!a.resolved !== !!b.resolved) return a.resolved ? 1 : -1; // resolved sink within tier
    return new Date(b.ts) - new Date(a.ts);
  });
}

// ── Mentions ────────────────────────────────────────────────────────────────
// Pull @mentions of the viewer out of project comments. Self-authored comments
// and archived (>30d) comments are excluded so the inbox stays tight.
const MENTION_RE = /@([A-Za-z]\w*(?:\s[A-Z]\w*)?)/g;
export function extractMentions(text) {
  if (!text) return [];
  const set = new Set();
  let m;
  while ((m = MENTION_RE.exec(text)) !== null) {
    const full = m[1].toLowerCase();
    set.add(full);
    const fn = full.split(/\s+/)[0];
    if (fn !== full) set.add(fn);
  }
  return [...set];
}

export function buildMentions({ projects = [], people = [], viewer = null } = {}) {
  if (!isDevSeedMode() || !viewer?.name) return [];
  const peopleById = new Map((people || []).map((p) => [p.id, p]));
  const vn = viewer.name.toLowerCase();
  const fn = viewer.name.split(/\s+/)[0]?.toLowerCase();
  const cutoff = Date.now() - ARCHIVE_DAYS * DAY_MS;
  const out = [];
  (projects || []).forEach((p) => {
    (devStore.listComments(p.id) || []).forEach((cmt) => {
      if (cmt.deleted_at) return;
      if (viewer.id && cmt.author_id === viewer.id) return;     // self
      if (new Date(cmt.created_at).getTime() < cutoff) return;  // archived
      const names = extractMentions(cmt.body);
      if (!names.some((n) => n === vn || n === fn)) return;
      out.push({
        id: `mention-${cmt.id}`,
        commentId: cmt.id,
        projectId: p.id,
        projectName: p.name,
        author: peopleById.get(cmt.author_id) || null,
        body: cmt.body || "",
        ts: cmt.created_at,
      });
    });
  });
  return out.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

// ── What's New (timeline) ─────────────────────────────────────────────────────
// Product-wide good news, newest first. Each shipped project surfaces exactly
// ONCE at its furthest release stage (derived from project state, not the event
// log), so rapid Alpha→Beta→GA steps never spam duplicates. Authored
// announcements are interleaved by date.
//   kind: "launched" (GA) | "shipped" (Alpha/Beta) | "announce"
export function buildWhatsNew({ projects = [], announcements = [] } = {}) {
  const items = [];

  (projects || []).forEach((p) => {
    if (!isShipped(p)) return;
    const date = shippedDateOf(p);
    if (!date) return;
    const stage = furthestStageOf(p); // Alpha | Beta | GA
    const launched = stage === "GA";
    // Version label: explicit field if present, else derived from release stage
    // (GA reads as a 1.0 launch; Alpha/Beta keep their stage + rollout %).
    const version = p.version
      || (launched ? "v1.0 · GA" : `${stage}${p.shipPct != null ? ` · ${p.shipPct}%` : ""}`);
    items.push({
      id: `wn-ship-${p.id}`,
      kind: launched ? "launched" : "shipped",
      date: date.slice(0, 10),
      projectId: p.id,
      projectName: p.name,
      squad: p.squad || null,
      owner: p.owner || null,
      description: p.description || null,
      releaseNotes: p.shipNote || p.releaseNotes || null,
      version,
      stage,
      title: p.name,
    });
  });

  (announcements || []).forEach((a) => {
    if (!a?.date) return;
    items.push({
      id: `wn-ann-${a.id}`,
      kind: "announce",
      date: a.date.slice(0, 10),
      title: a.title,
      body: a.body || "",
      tag: a.tag || "update",
      link: a.link || null,
    });
  });

  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
