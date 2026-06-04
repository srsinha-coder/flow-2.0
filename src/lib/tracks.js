import { trackNames } from '../styles/theme';

const DAY_MS = 86_400_000;

// ── Project stage classification — single source of truth ──
//   IN FLIGHT = PRD, Design, Dev, QA       (pre-release build stages)
//   SHIPPED   = Alpha, Beta, GA            (a project counts as shipped once
//                                           it reaches any release stage)
// A project is "shipped" the moment it enters Alpha — Alpha/Beta/GA are all
// release stages. The explicit Ship Project action additionally sets
// status "shipped" (see hasShipMarker), which surfaces the 🚀 ship marker.
export const IN_FLIGHT_STAGES = ["PRD", "Design", "Dev", "QA"];
export const SHIPPED_STAGES = ["Alpha", "Beta", "GA"];

// Full stage order (GA is a status, not a track, so it sits at the end).
const STAGE_ORDER = ["PRD", "Design", "Dev", "QA", "Alpha", "Beta", "GA"];

// The furthest stage a project has reached — from its tracks, with GA derived
// from the shipped status. Returns a stage name or null.
export function furthestStageOf(proj) {
  if (!proj) return null;
  if (proj.status === "shipped") return "GA";
  let best = null, bestIdx = -1;
  if (proj.tracks) {
    for (const name of Object.keys(proj.tracks)) {
      const t = proj.tracks[name];
      if (!t?.periods?.length) continue;
      const idx = STAGE_ORDER.indexOf(name);
      if (idx > bestIdx) { bestIdx = idx; best = name; }
    }
  }
  return best || proj.phase || null;
}

// A project is "shipped" once its furthest reached stage is a release stage
// (Alpha/Beta/GA), or it was explicitly shipped. Deprioritized / upcoming /
// blocked projects keep their own bucket and are never reclassified.
export function isShipped(proj) {
  if (!proj) return false;
  if (proj.status === "shipped") return true;
  if (proj.status !== "in_flight") return false;
  return SHIPPED_STAGES.includes(furthestStageOf(proj));
}

// A project is "in flight" while it is active and still in a build stage
// (PRD/Design/Dev/QA) — i.e. an active project that has not yet shipped.
export function isInFlight(proj) {
  if (!proj) return false;
  if (proj.status !== "in_flight") return false;
  return !SHIPPED_STAGES.includes(furthestStageOf(proj));
}

// The 🚀 ship marker: set when someone explicitly runs the Ship Project action
// (which sets status "shipped"). Distinct from the stage-based isShipped().
export function hasShipMarker(proj) {
  return proj?.status === "shipped";
}

// The date a project entered its furthest release stage ("shipped date"),
// as YYYY-MM-DD: GA → GA date; Beta → Beta entry; Alpha → Alpha entry.
export function shippedDateOf(proj) {
  if (!proj) return null;
  const stage = furthestStageOf(proj);
  if (proj.status === "shipped" || stage === "GA") return gaDateOf(proj);
  if (stage === "Beta" || stage === "Alpha") {
    const first = proj.tracks?.[stage]?.periods?.[0]?.started_at;
    return first ? String(first).slice(0, 10) : null;
  }
  return null;
}

// The date a project transitioned to GA (its "went live" date), as YYYY-MM-DD.
export function gaDateOf(proj) {
  if (!proj) return null;
  const raw = proj.gaEnteredAt || proj.shippedAt || proj.shipped_at || null;
  return raw ? String(raw).slice(0, 10) : null;
}

export function getActiveTracks(proj) {
  if (!proj.tracks) return [];
  return trackNames.filter(name => {
    const t = proj.tracks[name];
    if (!t || !t.periods || t.periods.length === 0) return false;
    return t.periods[t.periods.length - 1].completed_at === null;
  });
}

export function getTrackStatus(proj, trackName) {
  if (!proj.tracks) return "not_started";
  const t = proj.tracks[trackName];
  if (!t || !t.periods || t.periods.length === 0) return "not_started";
  const last = t.periods[t.periods.length - 1];
  return last.completed_at === null ? "active" : "completed";
}

export function getTrackActiveDays(proj, trackName) {
  if (!proj.tracks) return 0;
  const t = proj.tracks[trackName];
  if (!t || !t.periods || t.periods.length === 0) return 0;
  const now = Date.now();
  let total = 0;
  for (const p of t.periods) {
    const start = new Date(p.started_at).getTime();
    const end = p.completed_at ? new Date(p.completed_at).getTime() : now;
    total += Math.max(0, end - start);
  }
  return Math.round(total / DAY_MS);
}

export function derivePrimaryPhase(proj) {
  if (!proj.tracks) return proj.phase || "PRD";
  const active = getActiveTracks(proj);
  if (active.length > 0) return active[active.length - 1];
  let lastCompleted = null;
  let lastIdx = -1;
  for (const name of trackNames) {
    const t = proj.tracks[name];
    if (t && t.periods && t.periods.length > 0) {
      const idx = trackNames.indexOf(name);
      if (idx > lastIdx) { lastIdx = idx; lastCompleted = name; }
    }
  }
  return lastCompleted || proj.phase || "PRD";
}

/**
 * Get completed tracks with total days and cycle count.
 * A track is "completed" if it has periods and the last period has completed_at set.
 * Cycles = number of periods (1 = opened and closed once, 2 = reopened once, etc.)
 */
export function getCompletedTracks(proj) {
  if (!proj.tracks) return [];
  const now = Date.now();
  const result = [];
  for (const name of trackNames) {
    const t = proj.tracks[name];
    if (!t || !t.periods || t.periods.length === 0) continue;
    const last = t.periods[t.periods.length - 1];
    if (last.completed_at === null) continue; // still active — not completed
    let totalMs = 0;
    for (const p of t.periods) {
      const start = new Date(p.started_at).getTime();
      const end = p.completed_at ? new Date(p.completed_at).getTime() : now;
      totalMs += Math.max(0, end - start);
    }
    result.push({
      name,
      days: Math.round(totalMs / DAY_MS),
      cycles: t.periods.length,
    });
  }
  return result;
}

/**
 * Pause (close) all currently-open track periods at the given ISO time.
 * Returns the list of track names that were open (for later resume).
 */
export function pauseAllTracks(proj, atISO) {
  const open = getActiveTracks(proj);
  for (const name of open) {
    const periods = proj.tracks[name].periods;
    const last = periods[periods.length - 1];
    if (last && last.completed_at === null) last.completed_at = atISO;
  }
  return open;
}

/**
 * Release milestone for a project: the date it shipped, or the date its
 * Alpha/Beta track opened (Alpha/Beta count as ship milestones).
 * Returns { stage: "Shipped"|"Alpha"|"Beta", date: ISO } or null.
 */
export function getReleaseMilestone(proj) {
  if (proj.status === "shipped") {
    const date = proj.shippedAt || proj.shipped_at || proj.gaEnteredAt || null;
    return { stage: "Shipped", date };
  }
  if (!proj.tracks) return null;
  // Beta takes precedence over Alpha as the later milestone
  for (const stage of ["Beta", "Alpha"]) {
    const t = proj.tracks[stage];
    if (t && t.periods && t.periods.length > 0) {
      const firstOpen = t.periods.find(p => p.completed_at === null) || t.periods[0];
      return { stage, date: firstOpen.started_at };
    }
  }
  return null;
}

export function startTrack(proj, trackName) {
  if (!proj.tracks) proj.tracks = {};
  if (!proj.tracks[trackName]) {
    proj.tracks[trackName] = { periods: [], owner: null };
  }
  proj.tracks[trackName].periods.push({
    started_at: new Date().toISOString(),
    completed_at: null,
  });
  proj.phase = derivePrimaryPhase(proj);
  return proj;
}

// Immutably apply a phase transition / track start to a tracks object:
// closes the `from` track's open period at `at`, and opens a `to` period at `at`.
// `from` may be null (pure "start a track"). `endAt` optionally closes the new
// `to` period (e.g. logging a track that already ran start→finish in the past).
// `backdated` tags the opened period so the UI can mark retroactively-logged
// entries; pass false for a normal "start today" so it reads as real-time.
export function applyBackdatedTransition(tracks, from, to, at, endAt = null, backdated = true) {
  const next = { ...(tracks || {}) };
  if (from && next[from]?.periods?.length) {
    const periods = [...next[from].periods];
    const last = periods[periods.length - 1];
    if (last && last.completed_at === null) {
      periods[periods.length - 1] = { ...last, completed_at: at };
    }
    next[from] = { ...next[from], periods };
  }
  if (to) {
    const existing = next[to] || { periods: [], owner: null };
    const period = { started_at: at, completed_at: endAt || null };
    if (backdated) period.backdated = true;
    next[to] = { ...existing, periods: [...existing.periods, period] };
  }
  return next;
}

export function completeTrack(proj, trackName) {
  if (!proj.tracks || !proj.tracks[trackName]) return proj;
  const periods = proj.tracks[trackName].periods;
  if (periods.length === 0) return proj;
  const last = periods[periods.length - 1];
  if (last.completed_at === null) {
    last.completed_at = new Date().toISOString();
  }
  proj.phase = derivePrimaryPhase(proj);
  return proj;
}

export function reopenTrack(proj, trackName) {
  if (!proj.tracks || !proj.tracks[trackName]) return proj;
  proj.tracks[trackName].periods.push({
    started_at: new Date().toISOString(),
    completed_at: null,
  });
  proj.phase = derivePrimaryPhase(proj);
  return proj;
}

export function migrateProjectToTracks(proj, events) {
  if (proj.status === "upcoming" || !proj.phase) {
    return { tracks: {}, status: proj.status || "upcoming" };
  }

  const phaseEvents = (events || [])
    .filter(e => e.entity_id === proj.id && e.action === "project_phase_changed")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const tracks = {};
  const createdEvent = (events || []).find(
    e => e.entity_id === proj.id && e.action === "project_created"
  );
  const projectStart = createdEvent?.created_at || proj.createdAt || proj.startDate;

  if (phaseEvents.length === 0) {
    tracks[proj.phase] = {
      periods: [{ started_at: projectStart, completed_at: null }],
      owner: null,
    };
  } else {
    let prevStart = projectStart;
    for (const ev of phaseEvents) {
      const from = ev.details.from;
      const to = ev.details.to;
      if (!tracks[from]) {
        tracks[from] = { periods: [{ started_at: prevStart, completed_at: ev.created_at }], owner: null };
      } else {
        const lastPeriod = tracks[from].periods[tracks[from].periods.length - 1];
        if (lastPeriod.completed_at === null) {
          lastPeriod.completed_at = ev.created_at;
        }
      }
      if (to !== "GA") {
        if (!tracks[to]) {
          tracks[to] = { periods: [{ started_at: ev.created_at, completed_at: null }], owner: null };
        } else {
          tracks[to].periods.push({ started_at: ev.created_at, completed_at: null });
        }
      }
      prevStart = ev.created_at;
    }
  }

  let status;
  if (proj.phase === "GA") {
    status = "shipped";
    proj.shippedAt = proj.gaEnteredAt || new Date().toISOString().slice(0, 10);
    for (const name of Object.keys(tracks)) {
      const periods = tracks[name].periods;
      const last = periods[periods.length - 1];
      if (last.completed_at === null) {
        last.completed_at = proj.gaEnteredAt || new Date().toISOString();
      }
    }
  } else if (proj.status === "deprioritized") {
    status = "deprioritized";
  } else if (proj.isBlocked) {
    status = "blocked";
  } else {
    status = "in_flight";
  }

  return { tracks, status };
}
