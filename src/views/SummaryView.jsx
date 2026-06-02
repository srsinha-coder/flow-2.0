// Flow — Summary View (Project-centric)
// Product head dashboard — answers in 30s:
//   1) Weekly digest 2) Pipeline shape 3) What needs attention?
import React, { useState, useMemo } from "react";
import { c, typo, space, layout, motion, shipPhases, phaseColors, allPhases, phaseNames, trackNames } from "../styles/theme";
import { getActiveTracks, getTrackActiveDays } from "../lib/tracks";
import { Surface, Label, EmptyState } from "../components/shared";
import { KpiGrid, KpiCard, SectionHead, Pill, PillRow } from "../components/kpi";
import { isDevSeedMode, devStore } from "../data/devSeed";
import useDevLabel from "../hooks/useDevLabel";

const PRIORITY_COLORS = { P0: c.red, P1: c.orange || c.amber, P2: c.textMid, P3: c.textDim };
const FROZEN_DAYS = 7;

function computeProjectMetrics(projects, phaseDurationDefaults) {
  const today = new Date();
  const todayMs = today.getTime();
  const weekAgo = new Date(todayMs - 7 * 86_400_000);

  const active = projects.filter(p => p.status === "in_flight");
  const shipped = projects.filter(p => p.status === "shipped");
  const blocked = projects.filter(p => p.status === "blocked" || p.isBlocked);
  const deprioritized = projects.filter(p => p.status === "deprioritized");
  const upcoming = projects.filter(p => p.status === "upcoming");

  const byPhase = {};
  allPhases.forEach(ph => { byPhase[ph] = 0; });
  projects.filter(p => p.status === "in_flight" || p.status === "blocked").forEach(p => { byPhase[p.phase] = (byPhase[p.phase] || 0) + 1; });

  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  active.forEach(p => { byPriority[p.priority || "P2"]++; });

  const frozen = active.filter(p => {
    if (!p.lastActivityAt) return true;
    const diff = (todayMs - new Date(p.lastActivityAt).getTime()) / 86_400_000;
    return diff > FROZEN_DAYS;
  });

  const phaseOverstay = active.filter(p => {
    const overrides = p.phaseDurationOverrides || {};
    const threshold = overrides[p.phase] ?? phaseDurationDefaults?.[p.phase];
    if (!threshold) return false;
    if (!p.lastActivityAt) return false;
    const daysInPhase = Math.floor((todayMs - new Date(p.lastActivityAt).getTime()) / 86_400_000);
    return daysInPhase > threshold;
  });

  const overdue = active.filter(p => {
    if (!p.endDate) return false;
    const end = new Date(p.endDate + "T00:00:00");
    return end.getTime() < todayMs;
  });

  const needsAttention = blocked.length + frozen.length + phaseOverstay.length + overdue.length;

  return {
    active, shipped, blocked, deprioritized, upcoming,
    byPhase, byPriority,
    frozen, phaseOverstay, overdue,
    needsAttention,
  };
}

// Reconstruct approximate project status at a past dateMs using timestamp fields.
// Used for WoW/MoM KPI deltas. Only shipped_at gives a precise transition point;
// everything else stays at current status.
function computeCountsAt(projects, dateMs) {
  let active = 0, shipped = 0, blocked = 0, overdue = 0;
  projects.forEach(p => {
    const createdMs = new Date(p.createdAt || p.created_at || 0).getTime();
    if (createdMs > dateMs) return;
    let histStatus = p.status;
    if (p.status === "shipped" && p.shipped_at) {
      if (new Date(p.shipped_at).getTime() > dateMs) histStatus = "in_flight";
    }
    if (histStatus === "in_flight") active++;
    else if (histStatus === "shipped") shipped++;
    else if (histStatus === "blocked") blocked++;
    if (p.endDate && histStatus !== "shipped" && histStatus !== "deprioritized") {
      if (new Date(p.endDate + "T00:00:00").getTime() < dateMs) overdue++;
    }
  });
  return { active, shipped, needsAttention: blocked + overdue };
}

// Builds the "This Week at a Glance" digest as structured data (not strings),
// so the renderer can attach color-coded badges, clickable project links,
// callout styling, and WoW trend chips. Returns { health, rows } where each
// row is { key, badge:{label,color}, callout?, segments:[{text}|{link}], delta? }.
const STALE_MS = 3 * 86_400_000; // "no recent activity" threshold for P0 / attention

function generateWeeklyDigest(projects, allEvents) {
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const twoWeeksAgo = now - 14 * 86_400_000;
  const recentEvents = allEvents.filter(e => new Date(e.created_at).getTime() >= weekAgo);

  const phaseChanges = recentEvents.filter(e => e.action === "project_phase_changed");
  const shipEvents = phaseChanges.filter(e => ["Alpha", "Beta", "GA"].includes(e.details?.to));
  const p0Projects = projects.filter(p => p.priority === "P0" && (p.status === "in_flight" || p.status === "blocked"));
  const blockedProjects = projects.filter(p => p.isBlocked);

  const isStale = (p) => !p.lastActivityAt || (now - new Date(p.lastActivityAt).getTime()) > STALE_MS;
  const p0Stale = p0Projects.filter(isStale);

  // ── (6) Portfolio health score — evaluated worst-case first ──
  let health;
  if (blockedProjects.length >= 3 || p0Stale.length > 0) {
    health = { label: "Critical", color: c.red };
  } else if ((blockedProjects.length >= 1 && blockedProjects.length <= 2) || p0Projects.length >= 3) {
    health = { label: "At Risk", color: c.amber };
  } else {
    health = { label: "On Track", color: c.green };
  }

  // ── (4) WoW deltas, sourced from project_created activity log ──
  const createdEvents = allEvents.filter(e => e.action === "project_created");
  const createdBetween = (start, end) => createdEvents.filter(e => {
    const t = new Date(e.created_at).getTime();
    return t >= start && t < end;
  }).length;
  const newThisWeek = createdBetween(weekAgo, now + 1);
  const newPrevWeek = createdBetween(twoWeeksAgo, weekAgo);
  const newDelta = newThisWeek - newPrevWeek;

  const upcomingProjects = projects.filter(p => p.status === "upcoming");
  // Placeholder: status transitions aren't timestamped, so a true prior-week
  // upcoming count isn't reconstructable yet. Wire delta=null until a periodic
  // snapshot table exists; the renderer already supports a delta here.
  const upcomingDelta = null;

  // Helper: turn a list of projects into linkable name segments with separators.
  const linkSegments = (list, max = 3) => {
    const shown = list.slice(0, max);
    const segs = [];
    shown.forEach((p, i) => {
      segs.push({ link: { id: p.id, name: p.name } });
      if (i < shown.length - 1) segs.push({ text: ", " });
    });
    if (list.length > max) segs.push({ text: ` +${list.length - max} more` });
    return segs;
  };

  const rows = [];

  // ── (1,2) P0 Watch — red badge, clickable project links ──
  if (p0Projects.length > 0) {
    const p0Blocked = p0Projects.filter(p => p.isBlocked);
    rows.push({
      key: "p0",
      badge: { label: "P0 Watch", color: c.red },
      segments: [
        { text: `${p0Projects.length} critical project${p0Projects.length > 1 ? "s" : ""} active — ` },
        ...linkSegments(p0Projects),
        { text: `.${p0Blocked.length > 0 ? ` ⚠ ${p0Blocked.length} blocked.` : " All moving."}` },
      ],
    });
  }

  // ── Shipping — cyan badge, clickable project links ──
  if (shipEvents.length > 0) {
    const shipped = shipEvents
      .map(e => ({ proj: projects.find(p => p.id === e.entity_id), to: e.details.to }))
      .filter(s => s.proj);
    const segments = [];
    shipped.forEach((s, i) => {
      segments.push({ link: { id: s.proj.id, name: s.proj.name } });
      segments.push({ text: ` → ${s.to}` });
      segments.push({ text: i < shipped.length - 1 ? ", " : "." });
    });
    rows.push({ key: "shipping", badge: { label: "Shipping", color: c.cyan }, segments });
  }

  // ── (1,2,3) Blockers — amber badge, clickable links, urgent callout ──
  if (blockedProjects.length > 0) {
    rows.push({
      key: "blockers",
      badge: { label: "Blockers", color: c.amber },
      callout: true,
      segments: [
        { text: `${blockedProjects.length} project${blockedProjects.length > 1 ? "s" : ""} blocked — ` },
        ...linkSegments(blockedProjects),
        { text: "." },
      ],
    });
  }

  // ── (1,4) New — green badge + WoW delta ──
  if (newThisWeek > 0) {
    rows.push({
      key: "new",
      badge: { label: "New", color: c.green },
      segments: [{ text: `${newThisWeek} project${newThisWeek > 1 ? "s" : ""} created this week.` }],
      delta: newDelta,
    });
  }

  // ── (1,4) Upcoming — blue badge + WoW delta (placeholder) ──
  if (upcomingProjects.length > 0) {
    const overdueStart = upcomingProjects.filter(p => p.tentativeStartDate && new Date(p.tentativeStartDate + "T00:00:00").getTime() < now);
    rows.push({
      key: "upcoming",
      badge: { label: "Upcoming", color: c.blue },
      segments: [{ text: `${upcomingProjects.length} project${upcomingProjects.length > 1 ? "s" : ""} in the pipeline.${overdueStart.length > 0 ? ` ⚠ ${overdueStart.length} past tentative start date.` : ""}` }],
      delta: upcomingDelta,
    });
  }

  // ── (5) Needs Your Attention — neutral badge, replaces Most Active Squad ──
  // Surfaces blocked projects with no activity in 3+ days (stuck, awaiting an
  // unblock/decision). No explicit "awaiting approval" field exists in the
  // schema yet — extend this filter once one is added.
  const attention = blockedProjects.filter(isStale);
  if (attention.length > 0) {
    rows.push({
      key: "attention",
      badge: { label: "Needs Your Attention", color: c.textMid },
      segments: [...linkSegments(attention), { text: " — awaiting decision" }],
    });
  }

  if (rows.length === 0) {
    rows.push({ key: "quiet", badge: null, segments: [{ text: "Quiet week across all squads. No major movements or blockers detected." }] });
  }

  return { health, rows };
}

const TIMELINE_OPTIONS = [
  { key: "7d", label: "7 days", ms: 7 * 86_400_000 },
  { key: "30d", label: "30 days", ms: 30 * 86_400_000 },
  { key: "90d", label: "90 days", ms: 90 * 86_400_000 },
];


// Colored ↑/↓/= chip for WoW/MoM deltas.
// inverted=true flips the color semantics (down = good, e.g. Needs Attention).
const DeltaChip = ({ delta, label, inverted = false }) => {
  if (!Number.isFinite(delta)) return null;
  const isZero = delta === 0;
  const color = isZero ? c.textGhost
    : (delta > 0) === !inverted ? c.green : c.red;
  return (
    <span style={{
      fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
      color, fontVariantNumeric: "tabular-nums",
    }}>
      {isZero ? "=" : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`} {label}
    </span>
  );
};

// ── Weekly Digest primitives ─────────────────────────────────────────────
// Color-coded category badge (P0 Watch / Blockers / New / Upcoming / etc).
const DigestBadge = ({ label, color }) => (
  <span style={{
    display: "inline-block", flexShrink: 0,
    fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
    color, background: `${color}1A`,
    padding: "2px 7px", borderRadius: layout.radiusXs,
    letterSpacing: "0.05em", textTransform: "uppercase",
    whiteSpace: "nowrap", lineHeight: 1.5,
  }}>{label}</span>
);

// Inline clickable project link → navigates to the project detail page.
const DigestLink = ({ id, name, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate?.("projects", id)}
    style={{
      background: "none", border: "none", padding: 0, margin: 0,
      font: "inherit", cursor: "pointer", fontWeight: 700, color: c.accent,
    }}
    onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
    onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
  >{name}</button>
);

// Week-on-week trend chip ("↑2 vs last week"). Hidden when delta unavailable.
const DigestTrend = ({ delta }) => {
  if (delta == null || !Number.isFinite(delta)) return null;
  const isZero = delta === 0;
  const color = isZero ? c.textGhost : delta > 0 ? c.green : c.red;
  return (
    <span style={{
      fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
      color, fontVariantNumeric: "tabular-nums", marginLeft: 6, whiteSpace: "nowrap",
    }}>
      {isZero ? "±0" : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`} vs last week
    </span>
  );
};

// Renders a text segment, coloring any ⚠ warning marker red (preserves the
// old dangerouslySetInnerHTML behavior without the raw HTML).
const renderDigestText = (txt) =>
  txt.split("⚠").map((part, k) => (
    <React.Fragment key={k}>
      {k > 0 && <span style={{ color: c.red }}>⚠</span>}
      {part}
    </React.Fragment>
  ));

// One digest line: badge + linkified text (+ optional trend). Blocker rows
// render inside an amber alert callout so they stand out as urgent.
const DigestRow = ({ row, onNavigate }) => {
  const body = (
    <span style={{
      fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
      color: c.text, lineHeight: 1.6,
    }}>
      {row.segments.map((seg, j) =>
        seg.link
          ? <DigestLink key={j} id={seg.link.id} name={seg.link.name} onNavigate={onNavigate} />
          : <React.Fragment key={j}>{renderDigestText(seg.text)}</React.Fragment>
      )}
      <DigestTrend delta={row.delta} />
    </span>
  );
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: space[2],
      ...(row.callout ? {
        background: c.amberDim,
        border: `1px solid ${c.amberBorder}`,
        borderLeft: `3px solid ${c.amber}`,
        borderRadius: layout.radiusSm,
        padding: `${space[2]}px ${space[3]}px`,
      } : {}),
    }}>
      {row.badge && <DigestBadge label={row.badge.label} color={row.badge.color} />}
      {body}
    </div>
  );
};

const SummaryView = ({
  loading, error,
  projects, people, squads,
  globalFilters, onNavigate,
  phaseDurationDefaults,
  myLens = false, followedProjects = [], viewerSquad,
  timeframe,
}) => {
  const devRef = useDevLabel('SummaryView', 'src/views/SummaryView.jsx', 'Project-centric dashboard');

  const gf = globalFilters || {};
  const filteredProjects = useMemo(() => {
    let p = projects;
    if (gf.squad?.length) p = p.filter(x => gf.squad.includes(x.squad));
    if (gf.owner?.length) p = p.filter(x => gf.owner.includes(x.owner));
    if (myLens) p = p.filter(x => followedProjects.includes(x.id));
    if (timeframe?.start && timeframe?.end) {
      p = p.filter(proj => {
        const pStart = proj.startDate || proj.tentativeStartDate || proj.createdAt?.slice(0, 10);
        const pEnd = proj.endDate || proj.shipped_at?.slice(0, 10);
        if (!pStart) return true;
        return pStart <= timeframe.end && (pEnd ? pEnd >= timeframe.start : true);
      });
    }
    return p;
  }, [projects, gf.squad, gf.owner, myLens, viewerSquad, followedProjects, timeframe]);

  const metrics = useMemo(
    () => computeProjectMetrics(filteredProjects, phaseDurationDefaults),
    [filteredProjects, phaseDurationDefaults]
  );

  // Fixed reference dates (set once on mount) for stable WoW/MoM diffs.
  const weekAgoMs = useMemo(() => Date.now() - 7 * 86_400_000, []);
  const monthAgoMs = useMemo(() => Date.now() - 30 * 86_400_000, []);
  const histWoW = useMemo(() => computeCountsAt(filteredProjects, weekAgoMs), [filteredProjects, weekAgoMs]);
  const histMoM = useMemo(() => computeCountsAt(filteredProjects, monthAgoMs), [filteredProjects, monthAgoMs]);

  const allSquadNames = useMemo(() =>
    (squads && squads.length ? [...squads] : [...new Set(filteredProjects.map(p => p.squad).filter(Boolean))]).sort(),
    [squads, filteredProjects]
  );

  const allEvents = useMemo(() => {
    if (isDevSeedMode()) return devStore.listAllEvents();
    return [];
  }, [filteredProjects]);

  const digest = useMemo(() => generateWeeklyDigest(filteredProjects, allEvents), [filteredProjects, allEvents]);

  const [timelineRange, setTimelineRange] = useState("30d");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const handleSortKey = (key) => {
    if (sortCol === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("desc"); }
  };

  const timelineMs = TIMELINE_OPTIONS.find(t => t.key === timelineRange)?.ms || 30 * 86_400_000;
  const timelineCutoff = Date.now() - timelineMs;

  const heatmapData = useMemo(() => {
    const activeProjs = filteredProjects.filter(p => p.status === "in_flight" || p.status === "blocked");
    const grid = {};
    let maxCount = 0;
    allSquadNames.forEach(sq => {
      grid[sq] = {};
      allPhases.forEach(ph => {
        const count = activeProjs.filter(p => p.squad === sq && p.phase === ph).length;
        grid[sq][ph] = count;
        if (count > maxCount) maxCount = count;
      });
    });
    return { grid, maxCount };
  }, [filteredProjects, allSquadNames]);

  const phaseBarData = useMemo(() => {
    const activeProjs = filteredProjects.filter(p => p.status === "in_flight" || p.status === "blocked");
    const counts = {};
    allPhases.forEach(ph => { counts[ph] = activeProjs.filter(p => p.phase === ph).length; });
    return counts;
  }, [filteredProjects]);

  if (loading) {
    return (
      <div ref={devRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 240px)", flexDirection: "column", gap: space[3] }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${c.border}`, borderTopColor: c.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid }}>Loading summary...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={devRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 240px)" }}>
        <EmptyState icon="!" title="Failed to load summary" message={typeof error === "string" ? error : "An unexpected error occurred."} action="Retry" onAction={() => window.location.reload()} />
      </div>
    );
  }

  if (filteredProjects.length === 0) {
    const hasFilter = gf.squad?.length || gf.owner?.length;
    return (
      <div ref={devRef} style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 240px)" }}>
        <EmptyState
          title={hasFilter ? "No matching projects" : "No projects yet"}
          message={hasFilter ? "No projects match the current filters." : "Add projects to see your dashboard."}
          action={!hasFilter && onNavigate ? "Go to Projects" : null}
          onAction={!hasFilter && onNavigate ? () => onNavigate("projects") : null}
        />
      </div>
    );
  }

  const pc = phaseColors();

  const thStyle = {
    padding: `${space[2]}px ${space[3]}px`, textAlign: "left",
    fontFamily: typo.bodyMd.font, fontSize: 12, fontWeight: 600,
    letterSpacing: "0.03em", textTransform: "uppercase",
    color: c.textDim, borderBottom: `1px solid ${c.border}`,
    background: c.tableHeader, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
  };
  const tdBase = {
    padding: `${space[2]}px ${space[3]}px`,
    fontFamily: typo.monoMd.font, fontSize: 13, fontWeight: 600,
    letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums",
    textAlign: "center", borderBottom: `1px dotted ${c.border}`,
  };

  const maxPhaseBar = Math.max(1, ...Object.values(phaseBarData));

  return (
    <div ref={devRef} style={{ display: "flex", flexDirection: "column", gap: space[4] }}>

      {/* ═══ STATUS KPI CARDS ═══ */}
      <KpiGrid cols="1fr 1fr 1fr 1fr">
        <KpiCard index={0} label="In Flight" value={metrics.active.length} sub="active projects">
          <div style={{ display: "flex", gap: space[3], marginTop: space[3] }}>
            <DeltaChip delta={metrics.active.length - histWoW.active} label="WoW" />
            <DeltaChip delta={metrics.active.length - histMoM.active} label="MoM" />
          </div>
        </KpiCard>
        <KpiCard index={1} label="Shipped" value={metrics.shipped.length} sub="shipped projects">
          <div style={{ display: "flex", gap: space[3], marginTop: space[3] }}>
            <DeltaChip delta={metrics.shipped.length - histWoW.shipped} label="WoW" />
            <DeltaChip delta={metrics.shipped.length - histMoM.shipped} label="MoM" />
          </div>
        </KpiCard>
        <KpiCard index={2} label="Needs Attention" value={metrics.needsAttention} sub="blocked + overdue">
          <div style={{ display: "flex", gap: space[3], marginTop: space[3] }}>
            <DeltaChip delta={metrics.needsAttention - histWoW.needsAttention} label="WoW" inverted />
            <DeltaChip delta={metrics.needsAttention - histMoM.needsAttention} label="MoM" inverted />
          </div>
        </KpiCard>
        <KpiCard index={3} label="Deprioritized" value={metrics.deprioritized.length} sub="paused projects">
          <div style={{ display: "flex", gap: space[3], marginTop: space[3] }}>
            <span style={{
              fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
              color: c.textDim, fontVariantNumeric: "tabular-nums",
            }}>on hold</span>
          </div>
        </KpiCard>
      </KpiGrid>

      {/* ═══ WEEKLY DIGEST ═══ */}
      <div>
        <SectionHead title="Weekly Digest" right={
          <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textDim }}>
            Auto-generated from project activity
          </span>
        } />
        <Surface variant="data" compact style={{ padding: space[6], borderLeft: `3px solid ${c.accent}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <span style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text }}>
              This Week at a Glance
            </span>
            {digest.health && (
              <span style={{
                marginLeft: "auto",
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                color: digest.health.color, background: `${digest.health.color}1A`,
                border: `1px solid ${digest.health.color}40`,
                padding: "3px 11px", borderRadius: 999,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: digest.health.color }} />
                {digest.health.label}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {digest.rows.map(row => (
              <DigestRow key={row.key} row={row} onNavigate={onNavigate} />
            ))}
          </div>
        </Surface>
      </div>

      {/* ═══ HEATMAP + BAR CHART ROW ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[4] }}>

        {/* ── Squad × Phase Heatmap ── */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead title="Squad × Phase" />
          <Surface variant="data" compact style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, cursor: "default", minWidth: 90 }}>Squad</th>
                  {allPhases.map(ph => (
                    <th key={ph} style={{ ...thStyle, textAlign: "center", cursor: "default", fontSize: 10, padding: `${space[1]}px ${space[2]}px` }}>
                      {ph}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allSquadNames.map((sq, i) => (
                  <tr key={sq} style={{ animation: `rowSlideIn 0.3s ${motion.normal.easing} both`, animationDelay: `${Math.min(i * 40, 200)}ms` }}>
                    <td style={{
                      padding: `${space[2]}px ${space[3]}px`,
                      fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600,
                      color: c.text, borderBottom: `1px dotted ${c.border}`,
                    }}>{sq}</td>
                    {allPhases.map(ph => {
                      const count = heatmapData.grid[sq]?.[ph] || 0;
                      const intensity = heatmapData.maxCount > 0 ? count / heatmapData.maxCount : 0;
                      const alpha = count > 0 ? Math.max(0.12, intensity * 0.6) : 0;
                      const bgColor = count > 0 ? `${pc[ph]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : "transparent";
                      return (
                        <td key={ph} style={{
                          ...tdBase,
                          padding: `${space[2]}px ${space[2]}px`,
                          fontSize: 12,
                          background: bgColor,
                          color: count > 0 ? pc[ph] : c.textGhost,
                          fontWeight: count > 0 ? 700 : 400,
                          borderBottom: `1px dotted ${c.border}`,
                        }}>
                          {count > 0 ? count : "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </div>

        {/* ── Phase Bar Chart (vertical) ── */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead title="Pipeline Distribution" />
          <Surface variant="data" compact style={{ padding: space[5], flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1, minHeight: 120 }}>
              {allPhases.map(ph => {
                const count = phaseBarData[ph] || 0;
                const pct = maxPhaseBar > 0 ? (count / maxPhaseBar) * 100 : 0;
                const barH = `${Math.max(count > 0 ? 8 : 4, pct)}%`;
                return (
                  <div key={ph} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <span style={{
                      fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
                      color: count > 0 ? pc[ph] : c.textGhost,
                      fontVariantNumeric: "tabular-nums",
                    }}>{count}</span>
                    <div style={{
                      width: "100%", maxWidth: 48, height: barH,
                      background: count > 0 ? `${pc[ph]}30` : `${c.textGhost}15`,
                      borderTop: count > 0 ? `3px solid ${pc[ph]}` : "none",
                      borderRadius: `${layout.radiusXs}px ${layout.radiusXs}px 0 0`,
                      transition: `height ${motion.normal.duration} ${motion.normal.easing}`,
                    }} />
                    <span style={{
                      fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                      color: count > 0 ? c.textMid : c.textGhost,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>{ph}</span>
                  </div>
                );
              })}
            </div>
          </Surface>
        </div>
      </div>

      {/* ═══ SCROLLABLE SECTIONS ═══ */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[7] }}>

        {/* ── Recently Shipped ── */}
        {(() => {
          // Alpha: in_flight with Alpha track active
          const alphaProjects = filteredProjects.filter(p => p.status === "in_flight" && (p.tracks ? Object.keys(p.tracks).some(t => t === "Alpha" && p.tracks[t]?.periods?.some(per => per.completed_at === null)) : p.phase === "Alpha"));
          // Beta: in_flight with Beta track active
          const betaProjects = filteredProjects.filter(p => p.status === "in_flight" && (p.tracks ? Object.keys(p.tracks).some(t => t === "Beta" && p.tracks[t]?.periods?.some(per => per.completed_at === null)) : p.phase === "Beta"));
          const shippedProjects = metrics.shipped;
          const total = alphaProjects.length + betaProjects.length + shippedProjects.length;
          if (total === 0) return null;

          const Chip = ({ p, label, labelColor, accentColor, rolloutPct }) => (
            <button key={p.id} type="button" onClick={() => onNavigate?.("projects", p.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
              padding: `${space[2]}px ${space[3]}px`,
              borderRadius: layout.radiusSm,
              background: `${accentColor}10`,
              border: `1px solid ${accentColor}25`, cursor: "pointer",
              transition: `border-color ${motion.fast.duration} ${motion.fast.easing}`,
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = accentColor}
              onMouseLeave={e => e.currentTarget.style.borderColor = `${accentColor}25`}
            >
              <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: "0.05em" }}>
                {label}{rolloutPct != null ? ` | ${rolloutPct}% rollout` : ""}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: space[1] }}>
                <span style={{ fontFamily: typo.monoSm.font, color: c.amber, fontSize: 11 }}>{p.id}</span>
                <span style={{ fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600, color: c.text }}>{p.name}</span>
              </span>
            </button>
          );

          return (
            <div>
              <SectionHead title={`Recently Shipped (${total})`} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: space[2] }}>
                {alphaProjects.slice(0, 6).map(p => (
                  <Chip key={p.id} p={p} label="Alpha Release" labelColor="#6D28D9" accentColor="#6D28D9" rolloutPct={p.shipPct ?? null} />
                ))}
                {betaProjects.slice(0, 6).map(p => (
                  <Chip key={p.id} p={p} label="Beta Release" labelColor="#0E7490" accentColor="#0E7490" rolloutPct={p.shipPct ?? null} />
                ))}
                {shippedProjects.slice(0, 12).map(p => (
                  <Chip key={p.id} p={p} label="Shipped" labelColor={c.green} accentColor={c.green} rolloutPct={null} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Needs Attention ── */}
        {metrics.needsAttention > 0 && (
          <div>
            <SectionHead title={`Needs Attention (${metrics.needsAttention})`} />
            <Surface variant="data" compact style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left", cursor: "default" }}>Project</th>
                    <th style={{ ...thStyle, textAlign: "left", cursor: "default" }}>Squad</th>
                    <th style={{ ...thStyle, textAlign: "center", cursor: "default" }}>Issue</th>
                    <th style={{ ...thStyle, textAlign: "left", cursor: "default" }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Overdue */}
                  {metrics.overdue.map(p => {
                    const daysOver = Math.floor((Date.now() - new Date(p.endDate + "T00:00:00").getTime()) / 86_400_000);
                    return (
                      <tr key={`overdue-${p.id}`} className="flow-row" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("projects", p.id)}>
                        <td style={{ ...tdBase, textAlign: "left" }}>
                          <span style={{ fontFamily: typo.monoSm.font, color: c.amber, marginRight: 6 }}>{p.id}</span>
                          <span style={{ fontFamily: typo.bodyMd.font, color: c.text }}>{p.name}</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid }}>{p.squad}</td>

                        <td style={{ ...tdBase }}>
                          <span style={{
                            fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 700,
                            color: c.red, background: `${c.red}12`,
                            padding: "2px 8px", borderRadius: layout.radiusXs,
                          }}>OVERDUE</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.red }}>+{daysOver}d past deadline</td>
                      </tr>
                    );
                  })}
                  {/* Blocked */}
                  {metrics.blocked.map(p => {
                    const days = p.blockedAt ? Math.floor((Date.now() - new Date(p.blockedAt).getTime()) / 86_400_000) : "?";
                    return (
                      <tr key={`blocked-${p.id}`} className="flow-row" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("projects", p.id)}>
                        <td style={{ ...tdBase, textAlign: "left" }}>
                          <span style={{ fontFamily: typo.monoSm.font, color: c.amber, marginRight: 6 }}>{p.id}</span>
                          <span style={{ fontFamily: typo.bodyMd.font, color: c.text }}>{p.name}</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid }}>{p.squad}</td>

                        <td style={{ ...tdBase }}>
                          <span style={{
                            fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 700,
                            color: "#FFFFFF", background: c.red,
                            padding: "2px 8px", borderRadius: layout.radiusXs,
                          }}>BLOCKED</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.blockedReason || "—"} ({days}d)
                        </td>
                      </tr>
                    );
                  })}
                  {/* Frozen (no update in 7d) */}
                  {metrics.frozen.map(p => {
                    const daysSince = p.lastActivityAt ? Math.floor((Date.now() - new Date(p.lastActivityAt).getTime()) / 86_400_000) : "?";
                    return (
                      <tr key={`frozen-${p.id}`} className="flow-row" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("projects", p.id)}>
                        <td style={{ ...tdBase, textAlign: "left" }}>
                          <span style={{ fontFamily: typo.monoSm.font, color: c.amber, marginRight: 6 }}>{p.id}</span>
                          <span style={{ fontFamily: typo.bodyMd.font, color: c.text }}>{p.name}</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid }}>{p.squad}</td>

                        <td style={{ ...tdBase }}>
                          <span style={{
                            fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 700,
                            color: c.cyan, background: `${c.cyan}12`,
                            padding: "2px 8px", borderRadius: layout.radiusXs,
                          }}>FROZEN</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid }}>No update in {daysSince}d</td>
                      </tr>
                    );
                  })}
                  {/* Sloth / Phase Overstay */}
                  {metrics.phaseOverstay.filter(p => !metrics.blocked.includes(p)).map(p => {
                    const overrides = p.phaseDurationOverrides || {};
                    const threshold = overrides[p.phase] ?? phaseDurationDefaults?.[p.phase];
                    const days = p.lastActivityAt ? Math.floor((Date.now() - new Date(p.lastActivityAt).getTime()) / 86_400_000) : "?";
                    return (
                      <tr key={`sloth-${p.id}`} className="flow-row" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("projects", p.id)}>
                        <td style={{ ...tdBase, textAlign: "left" }}>
                          <span style={{ fontFamily: typo.monoSm.font, color: c.amber, marginRight: 6 }}>{p.id}</span>
                          <span style={{ fontFamily: typo.bodyMd.font, color: c.text }}>{p.name}</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid }}>{p.squad}</td>

                        <td style={{ ...tdBase }}>
                          <span style={{
                            fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 700,
                            color: c.amber, background: `${c.amber}12`,
                            padding: "2px 8px", borderRadius: layout.radiusXs,
                          }}>SLOTH</span>
                        </td>
                        <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, color: c.textMid }}>{days}d in {p.phase} (threshold: {threshold}d)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Surface>
          </div>
        )}

        {/* ═══ SQUAD ROLLUP ═══ */}
        <div>
          <SectionHead title="Squad Rollup" />
          <Surface variant="data" compact style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto", maxWidth: "100%" }}>
              {allSquadNames.length === 0 ? (
                <div style={{ padding: space[7], textAlign: "center", fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid }}>
                  No squads defined yet.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr>
                      {[
                        { key: "squad", label: "Squad", align: "left" },
                        { key: "inflight", label: "In Flight" },
                        { key: "shipped", label: "Shipped" },
                        { key: "blocked", label: "Blocked" },
                        { key: "byPhase", label: "Phase Breakdown", align: "left", noSort: true },
                      ].map(col => {
                        const isSorted = sortCol === col.key;
                        return (
                          <th key={col.key} role={col.noSort ? undefined : "button"} tabIndex={col.noSort ? undefined : 0}
                            onClick={col.noSort ? undefined : () => handleSortKey(col.key)}
                            style={{ ...thStyle, textAlign: col.align || "center", ...(isSorted ? { color: c.accent } : {}), ...(col.noSort ? { cursor: "default" } : {}) }}>
                            {col.label}
                            {!col.noSort && <span style={{ display: "inline-block", width: 10, marginLeft: 4, opacity: isSorted ? 1 : 0.25 }}>{isSorted ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = allSquadNames.map(sq => {
                        const sqProjects = filteredProjects.filter(p => p.squad === sq && (p.status === "in_flight" || p.status === "blocked" || p.status === "shipped"));
                        const byPhase = {};
                        allPhases.forEach(ph => { byPhase[ph] = 0; });
                        sqProjects.forEach(p => { byPhase[p.phase] = (byPhase[p.phase] || 0) + 1; });
                        const inflightCount = sqProjects.filter(p => p.status === "in_flight").length;
                        const shippedCount = sqProjects.filter(p => p.status === "shipped").length;
                        const blockedCount = sqProjects.filter(p => p.isBlocked).length;
                        return { sq, inflight: inflightCount, shipped: shippedCount, blockedCount, byPhase };
                      });

                      if (sortCol) {
                        const valFor = (r) => {
                          switch (sortCol) {
                            case "squad": return r.sq;
                            case "inflight": return r.inflight;
                            case "shipped": return r.shipped;
                            case "blocked": return r.blockedCount;
                            default: return 0;
                          }
                        };
                        rows.sort((a, b) => {
                          const av = valFor(a), bv = valFor(b);
                          const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
                          return sortDir === "asc" ? cmp : -cmp;
                        });
                      }

                      return rows.map((r, i) => (
                        <tr key={r.sq} className="flow-row" style={{ animation: `rowSlideIn 0.3s ${motion.normal.easing} both`, animationDelay: `${Math.min(i * 50, 300)}ms` }}>
                          <td style={{ ...tdBase, textAlign: "left", fontFamily: typo.bodyMd.font, fontWeight: 600, color: c.text }}>{r.sq}</td>
                          <td style={{ ...tdBase, color: c.text }}>{r.inflight}</td>
                          <td style={{ ...tdBase, color: r.shipped > 0 ? c.green : c.textDim }}>{r.shipped}</td>
                          <td style={{ ...tdBase, color: r.blockedCount > 0 ? c.red : c.textDim, fontWeight: r.blockedCount > 0 ? 700 : 500 }}>{r.blockedCount}</td>
                          <td style={{ ...tdBase, textAlign: "left", padding: `${space[1]}px ${space[2]}px` }}>
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {allPhases.filter(ph => r.byPhase[ph] > 0).map(ph => (
                                <span key={ph} style={{
                                  fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                                  color: pc[ph], background: `${pc[ph]}15`,
                                  padding: "1px 5px", borderRadius: layout.radiusXs,
                                  letterSpacing: "0.04em",
                                }}>{r.byPhase[ph]} {ph}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </Surface>
        </div>

      </div>
    </div>
  );
};

export default SummaryView;
