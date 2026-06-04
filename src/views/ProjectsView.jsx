// Flow — Projects View (Rebuild v2: Pulse structural model + PeopleDeepDive history model)
// Two states: Registry (Pulse-style table with tabs) → Project Deep Dive (PeopleDeepDive-style)
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { c, typo, space, layout, motion, phaseNames, shipPhases, allPhases, trackNames, typeConfig, phaseColors as getPhaseColors, phaseMids as getPhaseMids, phaseDims as getPhaseDims, statusColors, statusConfig, entityColors, colWidths } from "../styles/theme";
import { Badge, Tag, Modal, Label, Btn, Inp, Sel, SearchSelect, EmptyState, TelemetryLabel, Th as SharedTh, TableShell, StickyLeftTd } from "../components/shared";
import { KpiGrid, KpiCard, SectionHead, SegmentedToggle, Pill, PillRow } from "../components/kpi";
import useKeyboard from "../hooks/useKeyboard";
import useExitAnimation from "../hooks/useExitAnimation";
import GanttChart from "../components/GanttChart";
import FlowLogo from "../components/FlowLogo";
import ProjectActivity from "../components/ProjectActivity";
import ProjectTimeline from "../components/ProjectTimeline";
import TrackGantt from "../components/TrackGantt";
import { isDevSeedMode, devStore } from "../data/devSeed";
import { getProjectRole, can as defaultCan } from "../lib/permissions";
import { initialsOf } from "../lib/names";
import { timeAgo, isStale, fmtAbsolute } from "../lib/time";
import { getProjectDependencies, deleteProjectFromDB, updateProjectInDB, addProjectLinkToDB, deleteProjectLinkFromDB, startTrackInDB, completeTrackInDB, reopenTrackInDB, shipProjectInDB, recordBackdatedTrackInDB } from "../lib/mutations";
import { getActiveTracks, getTrackStatus, getTrackActiveDays, getCompletedTracks, derivePrimaryPhase, applyBackdatedTransition, isShipped, isInFlight, hasShipMarker, shippedDateOf, furthestStageOf } from "../lib/tracks";
import { supabase } from "../lib/supabase";
import useDevLabel from "../hooks/useDevLabel";



/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */
const ensureStatus = (p) => ({ ...p, status: p.status || "active" });

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
};

const fmtDate = (d) => {
  if (!d) return "—";
  const [, m, day] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day, 10)} ${months[parseInt(m, 10) - 1]}`;
};

// statusColors imported from theme.js


/* ══════════════════════════════════════════════════════════════════
   GANTT MULTI-SELECT FILTER — dropdown with checkboxes
   ══════════════════════════════════════════════════════════════════ */
function GanttMultiFilter({ label, options, selected, onToggle, onClear }) {
  useDevLabel('GanttMultiFilter', 'src/views/ProjectsView.jsx', 'Multi-select dropdown filter with checkboxes for Gantt chart filtering');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const active = selected.length > 0;
  const anim = useExitAnimation(open, 180);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="flow-btn" onClick={() => setOpen(o => !o)} style={{
        padding: `${space[1]}px ${space[2]}px`,
        borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
        background: active ? c.accentDim : c.surfaceAlt,
        color: active ? c.accent : c.textDim,
        fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600,
        cursor: "pointer", outline: "none",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {active ? `${label} (${selected.length})` : `All ${label}`}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={active ? c.accent : c.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: `transform ${motion.fast.duration} ${motion.fast.easing}` }}>
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>
      {anim.mounted && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 900,
          minWidth: 180, maxHeight: 260, overflowY: "auto",
          background: c.surfaceSolid, border: `1px solid ${c.border}`,
          borderRadius: layout.radiusMd, boxShadow: c.shadowFloat,
          padding: `${space[1]}px 0`,
          animation: `${anim.visible ? "fadeScaleIn" : "fadeScaleOut"} ${motion.fast.duration} ${motion.fast.easing} both`,
          transformOrigin: "top left",
        }}>
          {active && (
            <button type="button" onClick={() => { onClear(); }} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: `${space[1]}px ${space[3]}px`, cursor: "pointer",
              fontFamily: typo.bodyXs.font, fontSize: typo.bodyXs.size,
              color: c.textMid, fontWeight: 600, borderTop: "none", borderLeft: "none", borderRight: "none",
              borderBottom: `1px solid ${c.border}`,
              marginBottom: space[1], background: "transparent",
            }}>Clear all</button>
          )}
          {options.map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <button type="button" key={opt} onClick={() => onToggle(opt)}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = c.surfaceAlt; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                style={{
                width: "100%", textAlign: "left", border: "none",
                padding: `${space[1]}px ${space[3]}px`, cursor: "pointer",
                display: "flex", alignItems: "center", gap: space[2],
                background: isSelected ? c.surfaceAlt : "transparent",
                fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                color: isSelected ? c.text : c.textMid,
                transition: `background ${motion.fast.duration} ${motion.fast.easing}, color ${motion.fast.duration} ${motion.fast.easing}`,
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: layout.radiusXs,
                  border: `1px solid ${isSelected ? c.accent : c.textDim}`,
                  background: isSelected ? c.accent : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: c.textOnAccent, fontWeight: 700,
                }}>{isSelected ? "✓" : ""}</span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Complexity-based phase thresholds (days). No threshold for Alpha/Beta/GA.
const COMPLEXITY_THRESHOLDS = {
  S:  { PRD: 3,  Design: 3,  Dev: 7,  QA: 3 },
  M:  { PRD: 5,  Design: 10, Dev: 14, QA: 5 },
  L:  { PRD: 10, Design: 14, Dev: 21, QA: 7 },
  XL: { PRD: 10, Design: 14, Dev: 21, QA: 7 },
};
const DEFAULT_THRESHOLDS = COMPLEXITY_THRESHOLDS.M;
function getPhaseThreshold(complexity, phase) {
  const map = COMPLEXITY_THRESHOLDS[complexity] || DEFAULT_THRESHOLDS;
  return map[phase] ?? null;
}

/* ══════════════════════════════════════════════════════════════════
   DATA DERIVATION — full-history metrics per project
   ══════════════════════════════════════════════════════════════════ */
function deriveProjectMetrics(projects, history, today) {
  const map = {};

  for (const proj of projects) {
    const id = proj.id;
    const m = {
      historyTotal: 0,
      phaseBreakdown: { PRD: 0, Design: 0, Dev: 0, QA: 0 },
      people: new Set(),
      lastActivity: null,
      weeklyData: [],
      isBlocked: !!proj.isBlocked,
      endingSoon: false,
      overdue: false,
      atRisk: false,
      isStale: false,
      noActivityWeek: false,
      teamMembers: [], // filled below from devStore
    };

    if (proj.status === "upcoming") { map[id] = m; continue; }

    const projHist = history[id] || [];
    for (const wk of projHist) {
      const entries = wk.entries || [];
      if (entries.length > 0) {
        m.lastActivity = wk.week;
        m.historyTotal += entries.length;
        const weekEntries = [];
        for (const e of entries) {
          if (e.person) m.people.add(e.person);
          const stage = e.stage || "PRD";
          if (m.phaseBreakdown[stage] !== undefined) m.phaseBreakdown[stage]++;
          weekEntries.push(e);
        }
        m.weeklyData.push({ week: wk.week, entries: weekEntries });
      }
    }

    m.peopleList = [...m.people];

    // Team members from devStore (includes owner)
    if (isDevSeedMode()) {
      const members = devStore.listMembers(proj.id) || [];
      m.teamMembers = members.map(mem => mem.person_id);
    }

    // Staleness checks
    const daysSinceActivity = proj.lastActivityAt
      ? Math.round((new Date(today + "T00:00:00") - new Date(proj.lastActivityAt)) / 86400000)
      : 999;
    m.isStale = daysSinceActivity > 14;
    m.noActivityWeek = daysSinceActivity > 7;

    // Risk flags
    const daysToEnd = daysBetween(today, proj.endDate);
    const shipped = isShipped(proj);
    if (daysToEnd <= 14 && daysToEnd > 0 && !shipped) m.endingSoon = true;
    if (daysToEnd < 0 && !shipped) m.overdue = true;

    // Active tracks
    m.activeTracks = getActiveTracks(proj);

    // Phase overstay tracking (per-track: use longest active track)
    const overrides = proj.phaseDurationOverrides || {};
    {
      let maxDaysInTrack = 0;
      let trackThreshold = null;
      if (m.activeTracks.length > 0) {
        for (const t of m.activeTracks) {
          const days = getTrackActiveDays(proj, t);
          const th = overrides[t] ?? getPhaseThreshold(proj.complexity, t);
          if (days > maxDaysInTrack) {
            maxDaysInTrack = days;
            trackThreshold = th;
          }
        }
      } else {
        const age = daysBetween(proj.startDate, today);
        maxDaysInTrack = age;
        trackThreshold = overrides[proj.phase] ?? getPhaseThreshold(proj.complexity, proj.phase);
      }
      m.daysInPhase = maxDaysInTrack;
      m.phaseThreshold = trackThreshold;
    }

    // At Risk: overdue OR no activity in 1 week OR blocked
    m.atRisk = proj.status !== "deprioritized" && !shipped && proj.status !== "upcoming" && (
      m.overdue || m.noActivityWeek || m.isBlocked
    );

    map[id] = m;
  }
  return map;
}

/* ══════════════════════════════════════════════════════════════════
   SORT — mirrors Pulse sort pattern
   ══════════════════════════════════════════════════════════════════ */
function sortList(list, key, dir, metrics, today) {
  if (!key) return [...list].sort((a, b) => (a.squad || "").localeCompare(b.squad || "") || (a.name || "").localeCompare(b.name || ""));
  const d = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (key) {
      case "squad": return d * (a.squad || "").localeCompare(b.squad || "");
      case "project": {
        const aN = parseInt((a.id || "").replace(/\D/g, ""), 10) || 0;
        const bN = parseInt((b.id || "").replace(/\D/g, ""), 10) || 0;
        return d * (aN - bN);
      }
      case "owner": return d * (a.owner || "").localeCompare(b.owner || "");
      case "status": return d * (a.status || "active").localeCompare(b.status || "active");
      case "phase":
      case "tracks": return d * (allPhases.indexOf(a.phase) - allPhases.indexOf(b.phase));
      case "total": return d * ((metrics[a.id]?.historyTotal || 0) - (metrics[b.id]?.historyTotal || 0));
      case "people": return d * ((metrics[a.id]?.teamMembers.length || 0) - (metrics[b.id]?.teamMembers.length || 0));
      case "last": {
        // Sort by the project's actual lastActivityAt timestamp (newest first
        // when dir=asc=−1). Missing timestamps sort to the end.
        const aT = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bT = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return d * (aT - bT);
      }
      case "daysInPhase": return d * ((metrics[a.id]?.daysInPhase ?? 0) - (metrics[b.id]?.daysInPhase ?? 0));
      case "timeline": return d * (daysBetween(today, a.endDate) - daysBetween(today, b.endDate));
      case "actualEnd": return d * ((a.actualEndDate || "").localeCompare(b.actualEndDate || ""));
      case "createdAt": return d * ((a.createdAt || "").localeCompare(b.createdAt || ""));
      case "startDate": return d * ((a.startDate || a.tentativeStartDate || "").localeCompare(b.startDate || b.tentativeStartDate || ""));
      default: return 0;
    }
  });
}

// Info affordance for the board's "Single Track Mode" toggle. The (i) icon is
// keyboard-focusable; hover or focus reveals a styled tooltip explaining the
// de-dupe behaviour and the fixed stage progression. Replaces the old
// "De-duplicated · N hidden" summary line.
const STAGE_ORDER_LABEL = "PRD → Design → Dev → QA → Alpha → Beta";
function BoardStageInfo() {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={`About Single Track Mode. Shows each project only in its most advanced stage. Stage order: ${STAGE_ORDER_LABEL}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(s => !s); }}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, padding: 0, flexShrink: 0,
          border: "none", background: "transparent",
          color: show ? c.accent : c.textDim, cursor: "help",
          transition: `color ${motion.fast.duration} ${motion.fast.easing}`,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {show && (
        <div role="tooltip" style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300,
          width: 284, padding: `${space[2] + 2}px ${space[3]}px`,
          background: c.surfaceSolid, border: `1px solid ${c.border}`,
          borderRadius: layout.radiusMd,
          boxShadow: "0 12px 40px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.07)",
          textAlign: "left", pointerEvents: "none",
        }}>
          <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 4 }}>
            Single Track Mode
          </div>
          <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 400, color: c.textMid, lineHeight: 1.5 }}>
            When enabled, a project spanning multiple stages appears only in its most advanced stage — removed from the earlier ones.
          </div>
          <div style={{
            marginTop: 7, paddingTop: 6, borderTop: `1px solid ${c.border}`,
            fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600, color: c.textDim, letterSpacing: "0.02em",
          }}>
            {STAGE_ORDER_LABEL}
          </div>
        </div>
      )}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════ */
export default function ProjectsView({
  projects: rawProjects, setProjects, people, squads, history,
  personProfile, isAdmin = false, permCan,
  initialId, onNavigate, setDetailLabel, setGoBack, searchRef, globalFilters = {},
  suppressBackRef,
  projectLinks, setProjectLinks, phaseDurationDefaults,
  myLens = false, followedProjects = [], toggleFollowProject,
  timeframe,
}) {
  const can = permCan || defaultCan;
  const devRef = useDevLabel('ProjectsView', 'src/views/ProjectsView.jsx', 'Project registry table with deep dive and Gantt chart');
  const projects = useMemo(() => rawProjects.map(ensureStatus), [rawProjects]);
  const today = new Date().toISOString().split('T')[0];
  const metrics = useMemo(() => deriveProjectMetrics(projects, history, today), [projects, history, today]);

  const [selectedProject, setSelectedProject] = useState(initialId || null);

  // ── URL sync: mirror selectedProject → ?id= ──
  // Lets users copy a project deep-dive URL and reopen it directly.
  // App.jsx owns `?tab=projects`; this effect only touches `id`.
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (selectedProject) params.set("id", selectedProject);
      else params.delete("id");
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(window.history.state, "", url);
      }
    } catch { /* best-effort */ }
  }, [selectedProject]);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [createError, setCreateError] = useState(null);
  const createErrorTimerRef = useRef(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  const createSuccessTimerRef = useRef(null);

  // Listen for optimistic-create failures from useSyncedSetters.
  // Single timer held in a ref so rapid re-failures don't cut the message short.
  useEffect(() => {
    const handler = (e) => {
      const nm = e?.detail?.name || "project";
      setCreateError(`Failed to create "${nm}". Please try again.`);
      if (createErrorTimerRef.current) clearTimeout(createErrorTimerRef.current);
      createErrorTimerRef.current = setTimeout(() => {
        setCreateError(null);
        createErrorTimerRef.current = null;
      }, 5000);
    };
    const updateHandler = (e) => {
      const nm = e?.detail?.name || "project";
      setCreateError(`Failed to save changes to "${nm}". Please try again.`);
      if (createErrorTimerRef.current) clearTimeout(createErrorTimerRef.current);
      createErrorTimerRef.current = setTimeout(() => {
        setCreateError(null);
        createErrorTimerRef.current = null;
      }, 5000);
    };
    const successHandler = (e) => {
      const nm = e?.detail?.name || "project";
      const id = e?.detail?.id || "";
      setCreateSuccess({ name: nm, id });
      if (createSuccessTimerRef.current) clearTimeout(createSuccessTimerRef.current);
      createSuccessTimerRef.current = setTimeout(() => {
        setCreateSuccess(null);
        createSuccessTimerRef.current = null;
      }, 4500);
    };
    window.addEventListener('flow:project-create-failed', handler);
    window.addEventListener('flow:project-update-failed', updateHandler);
    window.addEventListener('flow:project-create-succeeded', successHandler);
    return () => {
      window.removeEventListener('flow:project-create-failed', handler);
      window.removeEventListener('flow:project-update-failed', updateHandler);
      window.removeEventListener('flow:project-create-succeeded', successHandler);
      if (createErrorTimerRef.current) clearTimeout(createErrorTimerRef.current);
      if (createSuccessTimerRef.current) clearTimeout(createSuccessTimerRef.current);
    };
  }, []);
  const [sortKey, setSortKey] = useState("squad");
  const [sortDir, setSortDir] = useState("asc");
  const [hoveredProject, setHoveredProject] = useState(null);
  const [activityTip, setActivityTip] = useState(null); // { projId, rect }
  const activityTipTimer = useRef(null);
  const showActivityTip = (data) => { clearTimeout(activityTipTimer.current); setActivityTip(data); };
  const hideActivityTip = () => { activityTipTimer.current = setTimeout(() => setActivityTip(null), 120); };
  const [focusIdx, setFocusIdx] = useState(0);
  const [kbActive, setKbActive] = useState(false);
  const [searchGlow, setSearchGlow] = useState(false);
  const searchGlowTimerRef = useRef(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState("registry"); // "registry" | "board" | "timeline"
  const [ganttFullscreen, setGanttFullscreen] = useState(false);
  const [boardFullscreen, setBoardFullscreen] = useState(false);
  const ganttAnim = useExitAnimation(ganttFullscreen, 250);
  const boardAnim = useExitAnimation(boardFullscreen, 250);
  const toastAnim = useExitAnimation(!!createError, 150);
  const successToastAnim = useExitAnimation(!!createSuccess, 200);
  const [listSquadFilter, setListSquadFilter] = useState("");
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("flow_pinned_projects") || "[]")); }
    catch { return new Set(); }
  });
  const togglePin = useCallback((id, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      sessionStorage.setItem("flow_pinned_projects", JSON.stringify([...next]));
      return next;
    });
  }, []);
  // watchlist filter removed
  const [boardSearch, setBoardSearch] = useState("");
  const [boardSquads, setBoardSquads] = useState([]);
  const [boardOwners, setBoardOwners] = useState([]);
  const [boardPhases, setBoardPhases] = useState([]);
  // "Single Track Mode" board toggle — de-dupes multi-track projects to their
  // furthest stage. Persisted within the session so it survives navigating away.
  const [boardLatestOnly, setBoardLatestOnly] = useState(() => {
    try { return sessionStorage.getItem("flow_board_latest_only") === "1"; } catch { return false; }
  });
  const toggleBoardLatestOnly = useCallback(() => {
    setBoardLatestOnly(v => {
      const next = !v;
      try { sessionStorage.setItem("flow_board_latest_only", next ? "1" : "0"); } catch { /* sessionStorage unavailable */ }
      return next;
    });
  }, []);
  const boardSearchRef = useRef(null);
  const [ganttSearch, setGanttSearch] = useState("");
  const [ganttSquads, setGanttSquads] = useState([]);
  const [ganttOwners, setGanttOwners] = useState([]);
  const [ganttPhases, setGanttPhases] = useState([]);
  const toggleFilter = (setter, val) => setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const ganttSearchRef = useRef(null);
  const localSearchRef = useRef(null);
  // Drag-and-drop state for board view (must be at component level, not inside conditional IIFE)
  const colRefs = useRef({});
  const [dragOverPhase, setDragOverPhaseRaw] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const dragOverRef = useRef(null);
  // Board-level reopen modal (separate from detail-view reopen modal)
  const [boardReopenModal, setBoardReopenModal] = useState(null); // { projId, fromTrack, toTrack }
  const [boardReopenReason, setBoardReopenReason] = useState("");
  const [boardHoverId, setBoardHoverId] = useState(null); // which card is hovered (for Done btn)
  const [listStartNowId, setListStartNowId] = useState(null);
  const [listStartNowTracks, setListStartNowTracks] = useState(["PRD"]);
  const [listStartNowEndDate, setListStartNowEndDate] = useState("");

  // Wire searchRef
  useEffect(() => {
    if (searchRef) searchRef.current = localSearchRef.current;
  }, [searchRef, selectedProject]);

  // Shipped tab defaults to newest-first by actual end date. Other tabs keep
  // the default squad sort when re-entered from Shipped.
  useEffect(() => {
    if (activeTab === "shipped") {
      setSortKey("timeline");
      setSortDir("desc");
    } else if (sortKey === "timeline" && activeTab !== "all") {
      setSortKey("squad");
      setSortDir("asc");
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Breadcrumb / detail mode (copied from PeopleDeepDive pattern) ──
  const [detailLeaving, setDetailLeaving] = useState(false);
  const goBackToList = useCallback(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      setDetailLeaving(false);
      setSelectedProject(null);
      if (setDetailLabel) setDetailLabel(null);
      if (setGoBack) setGoBack(null);
    };
    if (reduce) { finish(); return; }
    setDetailLeaving(true);
    setTimeout(finish, 180);
  }, [setDetailLabel, setGoBack]);

  const openProject = useCallback((id) => {
    setSelectedProject(id);
    const p = projects.find(pr => pr.id === id);
    if (p && setDetailLabel) setDetailLabel(`${p.id} / ${p.name}`);
    if (setGoBack) setGoBack(goBackToList);
    // Reset scroll to top so the deep-dive opens at the header (not mid-list)
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "instant" });
    }
  }, [projects, setDetailLabel, setGoBack, goBackToList]);

  useEffect(() => {
    if (initialId) {
      const p = projects.find(pr => pr.id === initialId);
      if (p && setDetailLabel) setDetailLabel(`${p.id} / ${p.name}`);
      if (setGoBack) setGoBack(goBackToList);
    }
  }, [initialId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map person id → name so the People filter can match whether the project
  // stores a person by id (owner_id, member person_id) or by name (owner, weekly
  // history contributors).
  const idToName = useMemo(() => {
    const m = new Map();
    (people || []).forEach(p => { if (p.id != null) m.set(p.id, p.name); });
    return m;
  }, [people]);

  // Every person associated with a project — as owner/DRI OR as a team member —
  // expressed as BOTH their name and id, so the People filter (whose selected
  // values are names) matches regardless of how the field is stored.
  const projectPeople = useCallback((proj, m) => {
    const s = new Set();
    if (proj.owner) s.add(proj.owner);                 // owner stored as name
    if (proj.owner_id != null) {
      s.add(proj.owner_id);                            // owner stored as id
      const on = idToName.get(proj.owner_id);
      if (on) s.add(on);                               // resolve id → name
    }
    (m?.teamMembers || []).forEach(pid => {            // team members (person ids)
      s.add(pid);
      const nm = idToName.get(pid);
      if (nm) s.add(nm);                               // resolve id → name
    });
    (m?.people || []).forEach(nm => s.add(nm));        // weekly history contributors (names)
    return s;
  }, [idToName]);

  // ── Filter (search + global) ──
  const filtered = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
        (p.owner || "").toLowerCase().includes(q) || (p.squad || "").toLowerCase().includes(q)
      );
    }
    if ((globalFilters.owner || []).length > 0) list = list.filter(p => globalFilters.owner.includes(p.owner));
    if ((globalFilters.squad || []).length > 0) list = list.filter(p => globalFilters.squad.includes(p.squad));
    if (listSquadFilter) list = list.filter(p => p.squad === listSquadFilter);
    if ((globalFilters.person || []).length > 0) {
      list = list.filter(p => {
        const assoc = projectPeople(p, metrics[p.id]);
        return globalFilters.person.some(fp => assoc.has(fp));
      });
    }
    if ((globalFilters.track || []).length > 0) {
      list = list.filter(p => globalFilters.track.some(t => (metrics[p.id]?.activeTracks || []).includes(t)));
    }
    // My Lens: show only followed projects (auto-followed squad + explicit follows)
    if (myLens) {
      list = list.filter(p => followedProjects.includes(p.id));
    }
    // Timeframe filter: project overlaps with the selected range
    if (timeframe?.start && timeframe?.end) {
      list = list.filter(p => {
        const pStart = p.startDate || p.tentativeStartDate || p.createdAt?.slice(0, 10);
        const pEnd = p.endDate || p.shipped_at?.slice(0, 10);
        if (!pStart) return true; // no dates at all, include
        // Project starts before timeframe ends AND (project ends after timeframe starts OR project has no end and is still active)
        const startsBeforeEnd = pStart <= timeframe.end;
        const endsAfterStart = pEnd ? pEnd >= timeframe.start : true; // no end date = still running
        return startsBeforeEnd && endsAfterStart;
      });
    }
    return list;
  }, [projects, search, globalFilters, metrics, listSquadFilter, myLens, personProfile, followedProjects, timeframe, projectPeople]);

  // ── Tab splits ──
  // When a search query is active, bypass the tab filter so results surface
  // regardless of tab (searching "X99" while on "Active" tab would otherwise hide
  // shipped/deprioritized matches even though the search matched them).
  const tabProjects = useMemo(() => {
    let list;
    if (search.trim()) {
      list = filtered;
    } else {
      switch (activeTab) {
        case "active": list = filtered.filter(isInFlight); break;
        case "at_risk": list = filtered.filter(p => metrics[p.id]?.atRisk); break;
        case "shipped": list = filtered.filter(isShipped); break;
        case "blocked": list = filtered.filter(p => p.status === "blocked" || metrics[p.id]?.isBlocked); break;
        case "deprioritized": list = filtered.filter(p => p.status === "deprioritized"); break;
        case "upcoming": list = filtered.filter(p => p.status === "upcoming").sort((a, b) =>
          (a.tentativeStartDate || "9999").localeCompare(b.tentativeStartDate || "9999")
        ); break;
        case "overdue": list = filtered.filter(p => isInFlight(p) && metrics[p.id]?.overdue); break;
        default: list = filtered;
      }
    }
    const sorted = sortList(list, sortKey, sortDir, metrics, today);
    const pinned = sorted.filter(p => pinnedIds.has(p.id));
    // Shipped (Alpha/Beta/live) — most recently shipped first.
    const shipped = sorted.filter(p => !pinnedIds.has(p.id) && isShipped(p))
      .sort((a, b) => (shippedDateOf(b) || "").localeCompare(shippedDateOf(a) || ""));
    const regular = sorted.filter(p => !pinnedIds.has(p.id) && isInFlight(p));
    const blocked = sorted.filter(p => !pinnedIds.has(p.id) && p.status === "blocked");
    const depri = sorted.filter(p => !pinnedIds.has(p.id) && p.status === "deprioritized");
    const upcoming = sorted.filter(p => !pinnedIds.has(p.id) && p.status === "upcoming")
      .sort((a, b) => (a.tentativeStartDate || "9999").localeCompare(b.tentativeStartDate || "9999"));
    return [...pinned, ...shipped, ...regular, ...blocked, ...depri, ...upcoming];
  }, [filtered, activeTab, sortKey, sortDir, metrics, today, search, pinnedIds]);

  // ── KPI summary (from filtered data) ──
  // Risk is computed once in `deriveProjectMetrics`; this section
  // never re-derives it, so numbers stay consistent with the table.
  const summary = useMemo(() => {
    const active = filtered.filter(isInFlight);
    const shipped = filtered.filter(isShipped);
    const depri = filtered.filter(p => p.status === "deprioritized");
    const upcomingProjs = filtered.filter(p => p.status === "upcoming");
    const blockedProjs = filtered.filter(p => p.status === "blocked" || metrics[p.id]?.isBlocked);
    const atRiskCount = blockedProjs.length + active.filter(p => metrics[p.id]?.overdue).length;
    // Track distribution: how many in-flight projects have each track active
    const trackCounts = {};
    trackNames.forEach(t => {
      trackCounts[t] = active.filter(p => (metrics[p.id]?.activeTracks || []).includes(t)).length;
    });
    const overdueCount = active.filter(p => metrics[p.id]?.overdue).length;
    const shipMarked = shipped.filter(hasShipMarker).length;
    // Shipped breakdown by furthest release stage. GA reads as "Launched".
    const shippedByStage = { Alpha: 0, Beta: 0, GA: 0 };
    shipped.forEach(p => { const st = furthestStageOf(p); if (shippedByStage[st] != null) shippedByStage[st]++; });
    return { active: active.length, shipped: shipped.length, shipMarked, shippedByStage, depri: depri.length, upcoming: upcomingProjs.length, blocked: blockedProjs.length, overdue: overdueCount, all: filtered.length, atRiskCount, trackCounts };
  }, [filtered, metrics, today]);

  // ── Gantt-specific filter (separate from registry filters) ──
  // Prefer the canonical squads list passed from App.jsx so newly-created
  // squads that haven't been assigned to any project yet still show up in
  // filters/pickers. Fall back to project-derived names only if absent.
  const allSquads = useMemo(
    () => squads && squads.length
      ? [...squads].sort()
      : [...new Set(projects.map(p => p.squad).filter(Boolean))].sort(),
    [squads, projects]
  );
  const allOwners = useMemo(() => people ? people.map(p => p.name).sort() : [...new Set(projects.map(p => p.owner).filter(Boolean))].sort(), [projects, people]);
  const ganttProjects = useMemo(() => {
    let list = projects;
    if (ganttSearch.trim()) {
      const q = ganttSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
        (p.owner || "").toLowerCase().includes(q) || (p.squad || "").toLowerCase().includes(q));
    }
    if (ganttSquads.length > 0) list = list.filter(p => ganttSquads.includes(p.squad));
    if (ganttOwners.length > 0) list = list.filter(p => ganttOwners.includes(p.owner));
    if (ganttPhases.length > 0) list = list.filter(p => ganttPhases.includes(p.phase));
    return list;
  }, [projects, ganttSearch, ganttSquads, ganttOwners, ganttPhases]);

  // ── Board-specific filter (excludes deprioritized) ──
  const boardProjects = useMemo(() => {
    let list = projects.filter(p => p.status !== "deprioritized");
    if (boardSearch.trim()) {
      const q = boardSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
        (p.owner || "").toLowerCase().includes(q) || (p.squad || "").toLowerCase().includes(q));
    }
    if (boardSquads.length > 0) list = list.filter(p => boardSquads.includes(p.squad));
    if (boardOwners.length > 0) list = list.filter(p => boardOwners.includes(p.owner));
    if (boardPhases.length > 0) list = list.filter(p => boardPhases.includes(p.phase));
    return list;
  }, [projects, boardSearch, boardSquads, boardOwners, boardPhases]);

  // ── Sort handler (Pulse pattern) ──
  const toggleSort = useCallback((col) => {
    if (sortKey === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir("asc"); }
  }, [sortKey]);
  const sortIcon = (col) => sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  // ── Keyboard ──
  useKeyboard([
    { key: "Escape", fn: () => { if (suppressBackRef?.current) return; if (ganttFullscreen) { if (document.activeElement === ganttSearchRef.current) { ganttSearchRef.current.blur(); } else { setGanttFullscreen(false); setViewMode("registry"); } } else if (viewMode === "board") { setViewMode("registry"); } else if (selectedProject) goBackToList(); else if (search) { setSearch(""); setFocusIdx(0); localSearchRef.current?.blur(); setKbActive(false); } else if (document.activeElement === localSearchRef.current) { localSearchRef.current.blur(); setKbActive(false); } else if (kbActive) { setKbActive(false); } }, force: true },
    // First arrow press activates kb-focus mode WITHOUT moving, so the highlight
    // lands on the current focusIdx (row 0 on fresh load). Subsequent presses
    // step through rows.
    { key: "ArrowUp", fn: () => { if (!ganttFullscreen && !selectedProject) { localSearchRef.current?.blur(); if (!kbActive) { setKbActive(true); return; } setFocusIdx(i => Math.max(0, i - 1)); } }, force: true },
    { key: "ArrowDown", fn: () => { if (!ganttFullscreen && !selectedProject) { localSearchRef.current?.blur(); if (!kbActive) { setKbActive(true); return; } setFocusIdx(i => Math.min(tabProjects.length - 1, i + 1)); } }, force: true },
    { key: "Enter", fn: () => { if (!ganttFullscreen && !selectedProject && kbActive && tabProjects[focusIdx]) openProject(tabProjects[focusIdx].id); }, force: true },
    { key: "/", fn: (e) => { e.preventDefault(); if (ganttFullscreen) { ganttSearchRef.current?.focus(); } else if (!selectedProject) { localSearchRef.current?.focus(); setSearchGlow(true); setKbActive(false); if (searchGlowTimerRef.current) clearTimeout(searchGlowTimerRef.current); searchGlowTimerRef.current = setTimeout(() => { setSearchGlow(false); searchGlowTimerRef.current = null; }, 1200); } } },
    // Gantt "F to focus search" — only when Gantt is fullscreen AND the user
    // isn't already typing in an input. `force: false` (default) lets the
    // useKeyboard input-guard skip this when focus is in an <input>/textarea,
    // which is what we want: typing 'f' in the create-project Name field or
    // any other overlay input should go to the input, not hijack to Gantt.
    { key: "f", fn: (e) => { if (ganttFullscreen) { e.preventDefault(); ganttSearchRef.current?.focus(); } } },
  ], [selectedProject, goBackToList, tabProjects.length, focusIdx, kbActive, ganttFullscreen, viewMode, suppressBackRef]);

  useEffect(() => {
    if (focusIdx >= tabProjects.length && tabProjects.length > 0) setFocusIdx(tabProjects.length - 1);
  }, [tabProjects.length, focusIdx]);

  useEffect(() => () => { if (searchGlowTimerRef.current) clearTimeout(searchGlowTimerRef.current); }, []);

  const pc = getPhaseColors();
  const pcMid = getPhaseMids();
  const pcDim = getPhaseDims();
  const sc = statusColors();
  const tc = typeConfig();
  const ec = entityColors();

  // People lookup for team column
  const peopleById = useMemo(() => {
    const m = new Map();
    (people || []).forEach(p => m.set(p.id, p));
    return m;
  }, [people]);

  // Precompute latest activity (comment or event) per project for list hover tooltip
  const latestActivity = useMemo(() => {
    const map = {};
    const actionLabel = (ev) => {
      const d = ev.details || {};
      const who = ev.user_name || "Someone";
      switch (ev.action) {
        case "project_created":         return `${who} created this project`;
        case "project_started":         return `${who} started the project in ${d.phase || "?"} phase`;
        case "project_phase_changed": {
          const to = d.to || "?";
          if (["Alpha", "Beta", "GA"].includes(to)) return `${who} shipped the project to ${to}`;
          return `${who} moved the project from ${d.from || "?"} to ${to}`;
        }
        case "project_status_changed": {
          if (d.to === "deprioritized") return `${who} deprioritized the project`;
          if (d.from === "deprioritized") return `${who} moved the project back to active`;
          return `${who} changed the project status to ${d.to || "?"}`;
        }
        case "project_blocked":         return `${who} marked the project as blocked${d.reason ? ` — ${d.reason}` : ""}`;
        case "project_unblocked":       return `${who} unblocked the project`;
        case "project_updated":         return `${who} updated the project details`;
        case "edit_project":            return `${who} edited the project details`;
        case "project_owner_changed":   return `${who} changed the owner to ${d.to || "—"}`;
        case "project_squad_changed":   return `${who} moved the project to ${d.to || "—"} squad`;
        case "project_start_date_moved": return `${who} moved the tentative start date to ${d.to || "—"}`;
        case "member_added":            return `${who} added ${d.person_name || "a member"} to the team`;
        case "member_removed":          return `${who} removed ${d.person_name || "a member"} from the team`;
        case "resource_added":          return `${who} added a ${d.label || "resource"} link`;
        case "resource_removed":        return `${who} removed a resource link`;
        default:                        return `${who} · ${ev.action}`;
      }
    };
    if (isDevSeedMode()) {
      for (const proj of projects) {
        const comments = devStore.listComments(proj.id);
        const events = devStore.listEvents(proj.id);
        // Merge into a single feed sorted by time descending, pick the latest
        const items = [];
        (comments || []).forEach(cmt => {
          if (!cmt.deleted_at) {
            const author = peopleById.get(cmt.author_id);
            items.push({ kind: "comment", ts: cmt.created_at, body: cmt.body, author: author?.name || "Unknown" });
          }
        });
        (events || []).forEach(ev => {
          if (ev.action === "shoutout" || ev.action === "feedback" || ev.action === "project_shipped") return;
          items.push({ kind: "event", ts: ev.created_at, body: actionLabel(ev) });
        });
        items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
        if (items.length > 0) map[proj.id] = items[0];
      }
    }
    return map;
  }, [projects, peopleById]);

  // ═══════════════════════════════════════════════════════════
  // DETAIL STATE — Project Deep Dive
  // ═══════════════════════════════════════════════════════════
  if (selectedProject) {
    const proj = projects.find(p => p.id === selectedProject);
    if (!proj) return <EmptyState icon="🔍" title="Project not found" message="This project may have been removed." action="Back to overview" onAction={goBackToList} />;
    return <ProjectDeepDive proj={proj} metrics={metrics[proj.id]} history={history} projects={projects} setProjects={setProjects} people={people} squads={squads} personProfile={personProfile} isAdmin={isAdmin} can={can} onNavigate={onNavigate} goBack={goBackToList} pc={pc} pcMid={pcMid} pcDim={pcDim} sc={sc} tc={tc} ec={ec} today={today} leaving={detailLeaving} suppressBackRef={suppressBackRef} projectLinks={projectLinks} setProjectLinks={setProjectLinks} phaseDurationDefaults={phaseDurationDefaults} followedProjects={followedProjects} toggleFollowProject={toggleFollowProject} />;
  }

  // ═══════════════════════════════════════════════════════════
  // REGISTRY STATE — Pulse structural model
  // ═══════════════════════════════════════════════════════════

  const TABS = [
    { key: "all", label: "All", count: summary.all },
    { key: "active", label: "In Flight", count: summary.active },
    { key: "shipped", label: "Shipped", count: summary.shipped },
    { key: "blocked", label: "Blocked", count: summary.blocked },
    { key: "deprioritized", label: "Deprioritized", count: summary.depri },
    { key: "upcoming", label: "Upcoming", count: summary.upcoming },
    { key: "overdue", label: "Overdue", count: summary.overdue },
  ];

  const tabLabelMap = { at_risk: "at risk", active: "in flight", shipped: "shipped", blocked: "blocked", deprioritized: "deprioritized", upcoming: "upcoming", overdue: "overdue", all: "" };
  const isSyntheticTab = activeTab === "at_risk";

  // ── Shared Th wrapper ──
  const Th = ({ col, children, style: s }) => (
    <SharedTh col={col} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
      style={s}>{children}</SharedTh>
  );

  return (
    <div ref={devRef} style={{ display: "flex", flexDirection: "column", gap: space[3] }}>

      {toastAnim.mounted && (
        <div role="alert" aria-live="assertive" style={{
          position: "fixed", bottom: space[5], left: 0, right: 0, zIndex: 200,
          display: "flex", justifyContent: "center", pointerEvents: "none",
          animation: `${toastAnim.visible ? "slideUp" : "slideDownOut"} ${toastAnim.visible ? motion.normal.duration : motion.fast.duration} ${toastAnim.visible ? motion.normal.easing : "cubic-bezier(0.4, 0, 1, 1)"} both`,
        }}>
        <div style={{
          background: c.redDim, border: `1px solid ${c.red}`, borderRadius: layout.radiusMd,
          padding: `${space[2]}px ${space[4]}px`,
          fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.red,
          boxShadow: c.shadowFloat, display: "flex", alignItems: "center", gap: space[3],
          pointerEvents: "auto",
        }}>
          <span>{createError}</span>
          <button onClick={() => { setCreateError(null); if (createErrorTimerRef.current) clearTimeout(createErrorTimerRef.current); }}
            aria-label="Dismiss"
            style={{ background: "transparent", border: "none", color: c.red, cursor: "pointer", fontSize: 14, fontWeight: 700, padding: space[1], lineHeight: 1, borderRadius: layout.radiusXs }}>
            ✕
          </button>
        </div>
        </div>
      )}

      {successToastAnim.mounted && createSuccess && (
        <div role="status" aria-live="polite" style={{
          position: "fixed", bottom: space[5], left: 0, right: 0, zIndex: 201,
          display: "flex", justifyContent: "center", pointerEvents: "none",
          animation: `${successToastAnim.visible ? "slideUp" : "slideDownOut"} ${successToastAnim.visible ? motion.slow.duration : motion.fast.duration} ${successToastAnim.visible ? motion.slow.easing : "cubic-bezier(0.4, 0, 1, 1)"} both`,
        }}>
          <div style={{
            background: "#FFFFFF",
            border: `1.5px solid ${c.green}`,
            borderLeft: `6px solid ${c.green}`,
            borderRadius: layout.radiusMd,
            padding: `${space[3]}px ${space[4]}px`,
            boxShadow: `0 12px 32px rgba(5,150,105,0.22), 0 4px 12px rgba(15,23,42,0.12)`,
            display: "flex", alignItems: "center", gap: space[3],
            pointerEvents: "auto",
            minWidth: 380, maxWidth: 560,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: c.green, color: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, flexShrink: 0,
              boxShadow: `0 0 0 4px ${c.greenDim}`,
            }}>✓</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: typo.bodyMd.font, fontSize: 15, fontWeight: 700,
                color: c.text, letterSpacing: "-0.01em", lineHeight: 1.2,
              }}>
                Project created
              </div>
              <div style={{
                fontFamily: typo.bodySm.font, fontSize: 13, color: c.textMid,
                display: "flex", alignItems: "center", gap: space[2], overflow: "hidden",
              }}>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: 600, color: c.text,
                }}>{createSuccess.name}</span>
                {createSuccess.id && (
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                    color: c.amber, background: c.amberDim,
                    padding: "2px 7px", borderRadius: layout.radiusXs,
                    letterSpacing: "0.02em", flexShrink: 0,
                  }}>{createSuccess.id}</span>
                )}
              </div>
            </div>
            <button onClick={() => { setCreateSuccess(null); if (createSuccessTimerRef.current) clearTimeout(createSuccessTimerRef.current); }}
              aria-label="Dismiss"
              style={{
                background: "transparent", border: "none", color: c.textDim,
                cursor: "pointer", fontSize: 14, fontWeight: 700,
                padding: space[1], lineHeight: 1, borderRadius: layout.radiusXs,
                flexShrink: 0,
              }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Summary + tabs — scrolls with the page
          ═══════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", flexDirection: "column", gap: space[3],
      }}>

        {/* ═══════════════════════════════════════════════════════════
            KPI GRID — In Flight / Shipped / At Risk / Deprioritized
            Steel & Orange pattern per design-directions.html §KPI CARDS
            ═══════════════════════════════════════════════════════════ */}
        {viewMode !== "board" && viewMode !== "gantt" && <KpiGrid cols="1fr 1fr 1fr 1fr">
          <KpiCard
            index={0}
            label="In Flight"
            value={summary.active}
            onClick={() => setActiveTab("active")}
            active={activeTab === "active"}
          >
            {/* In Flight spans the build stages: PRD → Design → Dev → QA */}
            <PillRow>
              {["PRD", "Design", "Dev", "QA"].map(t => (
                <Pill
                  key={t}
                  count={summary.trackCounts?.[t] || 0}
                  label={t}
                  color={pc[t] || c.textDim}
                />
              ))}
            </PillRow>
          </KpiCard>
          <KpiCard
            index={1}
            label="Shipped"
            value={summary.shipped}
            onClick={() => setActiveTab(activeTab === "shipped" ? "all" : "shipped")}
            active={activeTab === "shipped"}
          >
            {/* Shipped spans the release stages: Launched (GA) · Alpha · Beta */}
            <PillRow>
              <Pill count={summary.shippedByStage?.GA || 0} label="Launched" color={c.green} />
              <Pill count={summary.shippedByStage?.Alpha || 0} label="Alpha" color={pc["Alpha"] || c.textDim} />
              <Pill count={summary.shippedByStage?.Beta || 0} label="Beta" color={pc["Beta"] || c.textDim} />
            </PillRow>
          </KpiCard>
          <KpiCard
            index={2}
            label="At Risk"
            value={summary.atRiskCount}
            onClick={() => setActiveTab(activeTab === "blocked" ? "all" : "blocked")}
            active={activeTab === "blocked"}
          >
            <PillRow>
              <Pill count={summary.blocked} label="Blocked" color={c.red} />
              <Pill count={summary.overdue} label="Overdue" color={c.amber} />
            </PillRow>
          </KpiCard>
          <KpiCard
            index={3}
            label="Deprioritized"
            value={summary.depri}
            onClick={() => setActiveTab(activeTab === "deprioritized" ? "all" : "deprioritized")}
            active={activeTab === "deprioritized"}
          >
            <PillRow>
              <Pill count={summary.depri} label="On hold" color={c.textDim} />
            </PillRow>
          </KpiCard>
        </KpiGrid>}

        {/* VIEW-SCOPE PILLS + view-mode toggle — replaces the old "Projects" section head.
            Left: 4 canonical scopes (In Flight / Shipped / Deprioritized / All) plus
            a "Showing: …" chip when a synthetic tab (at_risk / overdue) is active.
            Right: Table / Board / Gantt. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[3], flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
            {TABS.map(opt => {
              const parentScope = activeTab === "at_risk" ? "active" : activeTab;
              const isActive = parentScope === opt.key;
              return (
                <button
                  key={opt.key}
                  className="flow-btn"
                  onClick={() => setActiveTab(opt.key)}
                  style={{
                    padding: `6px ${space[3]}px`,
                    borderRadius: layout.radiusSm,
                    border: `1px solid ${isActive ? c.accentMid : c.border}`,
                    background: isActive ? c.accentDim : c.surface,
                    color: isActive ? c.accent : c.textDim,
                    fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {opt.label}
                  <span style={{
                    fontFamily: typo.monoSm.font, fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}>{opt.count}</span>
                </button>
              );
            })}
          </div>
          <SegmentedToggle
            options={[
              { key: "registry", label: <span style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>List</span> },
              { key: "board", label: <span style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Board</span> },
              { key: "gantt", label: <span style={{ display: "flex", alignItems: "center", gap: 5 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="12" height="3" rx="1"/><rect x="7" y="10" width="14" height="3" rx="1"/><rect x="5" y="16" width="10" height="3" rx="1"/></svg>Timeline</span> },
            ]}
            value={viewMode}
            onChange={(k) => {
              setViewMode(k);
              if (k === "registry") { setBoardFullscreen(false); setGanttFullscreen(false); }
              else if (k === "board") { setBoardFullscreen(false); setGanttFullscreen(false); }
              else if (k === "gantt") { /* inline now, no fullscreen */ }
            }}
          />
        </div>

        {/* SEARCH ROW */}
        <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <input ref={localSearchRef} value={search}
              onChange={e => { setSearch(e.target.value); setFocusIdx(0); }}
              onBlur={() => { setSearchGlow(false); if (searchGlowTimerRef.current) { clearTimeout(searchGlowTimerRef.current); searchGlowTimerRef.current = null; } }}
              placeholder="Search projects by name, ID, owner, or squad..."
              style={{
                width: "100%", height: 40,
                padding: `0 ${space[4]}px 0 38px`,
                borderRadius: layout.radiusSm,
                border: `1px solid ${searchGlow ? c.accent : c.border}`,
                background: c.surfaceAlt, color: c.text,
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
                boxShadow: searchGlow ? `0 0 0 3px ${c.accentDim}` : "none",
                transition: `border-color ${motion.fast.duration} ${motion.fast.easing}, box-shadow ${motion.fast.duration} ${motion.fast.easing}`,
              }} />
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", transition: `stroke ${motion.fast.duration} ${motion.fast.easing}` }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={searchGlow ? c.accent : c.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="10.5" r="7" /><line x1="15.5" y1="15.5" x2="21" y2="21" />
            </svg>
            {!search && <span style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 600,
              color: c.textDim, lineHeight: 1,
              padding: `3px 7px 4px`, borderRadius: layout.radiusXs,
              background: `linear-gradient(180deg, ${c.surfaceAlt} 0%, ${c.bg} 100%)`,
              border: `1px solid ${c.border}`,
              boxShadow: `0 2px 0 ${c.border}, 0 2px 3px ${c.shadow}`,
              pointerEvents: "none",
            }}>/</span>}
          </div>
        </div>

        {/* RESULT COUNT — shown when a global filter or search narrows the list */}
        {viewMode === "registry" && (globalFilters.person?.length || globalFilters.owner?.length || globalFilters.squad?.length || globalFilters.track?.length || search.trim()) ? (
          <div style={{
            marginTop: space[2],
            fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 600,
            letterSpacing: typo.monoSm.tracking, color: c.textMid,
            fontVariantNumeric: "tabular-nums",
          }}>
            Showing <span style={{ color: c.text, fontWeight: 700 }}>{tabProjects.length}</span> of {projects.length} projects
          </div>
        ) : null}
      </div>
      {/* end frozen top */}

      {/* ═══════════════════════════════════════════════════════════
          SCROLLABLE CONTENT
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ position: "relative", zIndex: 1 }}>

      {/* ── INLINE BOARD VIEW ── */}
      {viewMode === "board" ? (() => {
        const PASTEL_BG = {
          PRD: "#F5EEFF", Design: "#EDF5FF", Dev: "#FFF8E1", QA: "#E8F6F8", Alpha: "#EEF9FF", Beta: "#FFF5E6",
        };
        const PASTEL_BORDER = {
          PRD: "#D8B4FE", Design: "#A5C8FF", Dev: "#FDE68A", QA: "#99D5DB", Alpha: "#A5D8FF", Beta: "#FCD34D",
        };

        // Columns = the 6 tracks (no GA). Stage order is the trackNames order:
        // PRD → Design → Dev → QA → Alpha → Beta.
        const columns = trackNames;
        // Build column data. By default a project appears in every column where it
        // has an active track. With "Single Track Mode" ON, it appears only in its
        // furthest active stage; earlier-stage appearances are counted as hidden.
        const columnProjects = {};
        const hiddenByColumn = {};
        columns.forEach(t => { columnProjects[t] = []; hiddenByColumn[t] = 0; });
        const upcomingBoardProjects = [];
        const shippedBoardProjects = [];
        tabProjects.forEach(proj => {
          if (proj.status === "upcoming") { upcomingBoardProjects.push(proj); return; }
          if (proj.status === "shipped" || proj.status === "complete") { shippedBoardProjects.push(proj); return; }
          const active = getActiveTracks(proj);
          if (active.length === 0) return; // no active tracks, skip
          if (boardLatestOnly) {
            // Furthest active stage = highest index in the fixed stage order.
            let furthest = null, maxIdx = -1;
            active.forEach(t => { const i = columns.indexOf(t); if (i > maxIdx) { maxIdx = i; furthest = t; } });
            if (furthest && columnProjects[furthest]) columnProjects[furthest].push(proj);
            active.forEach(t => { if (t !== furthest && hiddenByColumn[t] != null) hiddenByColumn[t] += 1; });
          } else {
            active.forEach(t => { if (columnProjects[t]) columnProjects[t].push(proj); });
          }
        });

        // Drag helpers
        const setDragOverPhase = (ph) => { dragOverRef.current = ph; setDragOverPhaseRaw(ph); };

        const handleDragStart = (e, projId, fromTrack) => {
          e.dataTransfer.setData("text/plain", JSON.stringify({ projId, fromTrack }));
          e.dataTransfer.effectAllowed = "move";
          setDraggingId(projId);
          requestAnimationFrame(() => {
            e.target.style.opacity = "0.3";
            e.target.style.pointerEvents = "none";
          });
        };
        const handleDragEnd = (e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.pointerEvents = "auto";
          setDraggingId(null);
          setDragOverPhase(null);
        };
        const handleDragOver = (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const mouseX = e.clientX;
          for (const [ph, el] of Object.entries(colRefs.current)) {
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right) {
              if (dragOverRef.current !== ph) setDragOverPhase(ph);
              return;
            }
          }
        };
        const handleDrop = (e, targetTrack) => {
          e.preventDefault();
          const actualTarget = dragOverRef.current || targetTrack;
          setDragOverPhase(null);
          setDraggingId(null);
          let payload;
          try { payload = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
          const { projId, fromTrack } = payload;
          if (!projId || fromTrack === actualTarget) return;
          const proj = projects.find(p => p.id === projId);
          if (!proj) return;
          // Permission check
          const dropMemberIds = isDevSeedMode() ? new Set((devStore.listMembers(proj.id) || []).map(m => m.person_id)) : new Set();
          const dropRole = getProjectRole(personProfile?.id, proj, dropMemberIds, isAdmin);
          if (!can.manageTracks(dropRole)) return;

          // Upcoming project → just start the target track, change status to in_flight
          if (fromTrack === "__upcoming__") {
            const todayStr = new Date().toISOString().slice(0, 10);
            startTrackInDB(proj.id, actualTarget, projects);
            updateProjectInDB(proj.id, { status: "in_flight", startDate: todayStr, tentativeStartDate: null });
            setProjects(prev => prev.map(p => {
              if (p.id !== projId) return p;
              const updated = { ...p, tracks: { ...p.tracks }, status: "in_flight", startDate: todayStr, tentativeStartDate: null, lastActivityAt: new Date().toISOString() };
              if (!updated.tracks[actualTarget]) updated.tracks[actualTarget] = { periods: [], owner: null };
              updated.tracks[actualTarget] = { ...updated.tracks[actualTarget], periods: [...updated.tracks[actualTarget].periods, { started_at: new Date().toISOString(), completed_at: null }] };
              updated.phase = derivePrimaryPhase(updated);
              return updated;
            }));
            window.__flowToast?.(`<b>${proj.name}</b> started with ${actualTarget} track`);
            return;
          }

          // Check if target track is already active
          const targetStatus = getTrackStatus(proj, actualTarget);
          if (targetStatus === "active") {
            window.__flowToast?.({ message: `${actualTarget} track already open on <b>${proj.name}</b>`, icon: "warn" });
            return;
          }

          // If target track was previously completed, show reopen modal
          if (targetStatus === "completed") {
            setBoardReopenModal({ projId, fromTrack, toTrack: actualTarget });
            setBoardReopenReason("");
            return;
          }

          // Normal: complete fromTrack, start toTrack
          completeTrackInDB(proj.id, fromTrack, projects);
          startTrackInDB(proj.id, actualTarget, projects);
          setProjects(prev => prev.map(p => {
            if (p.id !== projId) return p;
            const updated = { ...p, tracks: { ...p.tracks }, lastActivityAt: new Date().toISOString() };
            // Complete fromTrack
            if (updated.tracks[fromTrack]) {
              const periods = [...updated.tracks[fromTrack].periods];
              const last = periods[periods.length - 1];
              if (last && !last.completed_at) periods[periods.length - 1] = { ...last, completed_at: new Date().toISOString() };
              updated.tracks[fromTrack] = { ...updated.tracks[fromTrack], periods };
            }
            // Start toTrack
            if (!updated.tracks[actualTarget]) updated.tracks[actualTarget] = { periods: [], owner: null };
            updated.tracks[actualTarget] = { ...updated.tracks[actualTarget], periods: [...updated.tracks[actualTarget].periods, { started_at: new Date().toISOString(), completed_at: null }] };
            updated.phase = derivePrimaryPhase(updated);
            return updated;
          }));
          window.__flowToast?.(`<b>${proj.name}</b> ${fromTrack} completed & ${actualTarget} started`);
        };

        // Complete a single track on hover-click
        const handleBoardDone = (e, proj, trackName) => {
          e.stopPropagation();
          const doneMemIds = isDevSeedMode() ? new Set((devStore.listMembers(proj.id) || []).map(m => m.person_id)) : new Set();
          const doneRole = getProjectRole(personProfile?.id, proj, doneMemIds, isAdmin);
          if (!can.manageTracks(doneRole)) return;
          completeTrackInDB(proj.id, trackName, projects);
          setProjects(prev => prev.map(p => {
            if (p.id !== proj.id) return p;
            const updated = { ...p, tracks: { ...p.tracks }, lastActivityAt: new Date().toISOString() };
            if (updated.tracks[trackName]) {
              const periods = [...updated.tracks[trackName].periods];
              const last = periods[periods.length - 1];
              if (last && !last.completed_at) periods[periods.length - 1] = { ...last, completed_at: new Date().toISOString() };
              updated.tracks[trackName] = { ...updated.tracks[trackName], periods };
            }
            updated.phase = derivePrimaryPhase(updated);
            return updated;
          }));
          window.__flowToast?.(`<b>${proj.name}</b> ${trackName} track completed`);
        };

        return (
          <div style={{
            display: "flex", flexDirection: "column", gap: space[4],
            minWidth: columns.length * 180,
            padding: `${space[2]}px 0`,
          }}>
            {/* ── Board toolbar: Single Track Mode toggle + info tooltip (right-aligned) ── */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span id="board-lso-desc" style={{
                position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
                overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
              }}>
                Single Track Mode: show each project only in its most advanced stage. Stage order: {STAGE_ORDER_LABEL}.
              </span>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={boardLatestOnly}
                  aria-describedby="board-lso-desc"
                  onClick={toggleBoardLatestOnly}
                  title={`Single Track Mode: show each project only in its most advanced stage. Stage order: ${STAGE_ORDER_LABEL}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: space[2],
                    padding: `5px ${space[3]}px 5px ${space[2]}px`, borderRadius: 999,
                    border: `1px solid ${boardLatestOnly ? c.accent : c.border}`,
                    background: boardLatestOnly ? c.accentDim : c.surfaceAlt,
                    cursor: "pointer",
                    transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}`,
                  }}
                >
                  {/* switch track */}
                  <span aria-hidden="true" style={{
                    position: "relative", width: 30, height: 17, borderRadius: 999, flexShrink: 0,
                    background: boardLatestOnly ? c.accent : c.border,
                    transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                  }}>
                    <span style={{
                      position: "absolute", top: 2, left: boardLatestOnly ? 15 : 2,
                      width: 13, height: 13, borderRadius: "50%", background: "#fff",
                      boxShadow: c.shadowSm,
                      transition: `left ${motion.fast.duration} ${motion.fast.easing}`,
                    }} />
                  </span>
                  <span style={{
                    fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600,
                    color: boardLatestOnly ? c.accent : c.textMid, whiteSpace: "nowrap",
                  }}>Single Track Mode</span>
                </button>
                <BoardStageInfo />
              </div>
            </div>

            {/* Track columns */}
            <div style={{
              display: "flex", gap: space[3],
              maxHeight: "calc(100vh - 280px)", minHeight: 400,
            }}>
            {columns.map(track => {
              const phColor = pc[track] || c.textDim;
              const cards = columnProjects[track] || [];
              const isOver = dragOverPhase === track;
              return (
                <div key={track}
                  ref={el => { colRefs.current[track] = el; }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, track)}
                  style={{
                    flex: 1, minWidth: 180, display: "flex", flexDirection: "column",
                    borderRadius: layout.radiusLg,
                    background: isOver ? `${c.accent}12` : c.surface,
                    border: `1px solid ${isOver ? c.accent : c.border}`,
                    boxShadow: isOver ? `inset 0 0 0 2px ${c.accent}40, 0 0 16px ${c.accent}15` : "none",
                    transform: isOver ? "scale(1.02)" : "scale(1)",
                    transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}, box-shadow ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    padding: `${space[3]}px ${space[4]}px`,
                    borderBottom: `1px solid ${c.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: phColor }} />
                      <span style={{
                        fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                        fontWeight: 700, letterSpacing: "0.06em",
                        color: phColor, textTransform: "uppercase",
                      }}>{track}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: space[1] + 2 }}>
                      {boardLatestOnly && hiddenByColumn[track] > 0 && (
                        <span
                          title={`${hiddenByColumn[track]} project${hiddenByColumn[track] === 1 ? "" : "s"} in earlier stages hidden`}
                          style={{
                            fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                            color: c.textDim, background: "transparent",
                            padding: "2px 6px", borderRadius: layout.radiusPill,
                            border: `1px dashed ${c.border}`, whiteSpace: "nowrap",
                          }}>{hiddenByColumn[track]} hidden</span>
                      )}
                      <span style={{
                        fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                        fontWeight: 700, color: c.textMid,
                        background: c.surfaceAlt, padding: "2px 8px",
                        borderRadius: layout.radiusPill, border: `1px solid ${c.border}`,
                      }}>{cards.length}</span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div style={{
                    flex: 1, overflowY: "auto", padding: space[3],
                    display: "flex", flexDirection: "column", gap: space[2],
                    scrollbarWidth: "thin", scrollbarColor: `${c.textDim}20 transparent`,
                    minHeight: 80,
                  }}>
                    {cards.length === 0 && (
                      <div style={{
                        padding: `${space[6]}px ${space[3]}px`,
                        textAlign: "center",
                        fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                        color: c.textGhost,
                        border: `2px dashed ${c.border}`, borderRadius: layout.radiusMd,
                        pointerEvents: "none",
                      }}>Drop here</div>
                    )}
                    {cards.map(proj => {
                      const m = metrics[proj.id] || {};
                      const pastelBg = PASTEL_BG[track] || "#F9FAFB";
                      const pastelBorder = PASTEL_BORDER[track] || c.border;
                      const active = getActiveTracks(proj);
                      const otherTracks = active.filter(t => t !== track);
                      const isHovered = boardHoverId === `${proj.id}-${track}`;

                      return (
                        <div
                          key={`${proj.id}-${track}`}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => handleDragStart(e, proj.id, track)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openProject(proj.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProject(proj.id); } }}
                          onMouseEnter={(e) => { setBoardHoverId(`${proj.id}-${track}`); const el = e.currentTarget; el.style.transform = "translateY(-2px) scale(1.02)"; el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
                          onMouseLeave={(e) => { setBoardHoverId(null); const el = e.currentTarget; el.style.transform = "translateY(0) scale(1)"; el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                          style={{
                            padding: 14, position: "relative",
                            borderRadius: layout.radiusMd,
                            background: pastelBg,
                            border: `1px solid ${pastelBorder}60`,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            cursor: "grab",
                            display: "flex", flexDirection: "column", gap: space[2],
                            transition: `box-shadow ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
                          }}
                        >
                          {/* Done button — appears on hover */}
                          {isHovered && (
                            <button type="button"
                              onClick={(e) => handleBoardDone(e, proj, track)}
                              title={`Complete ${track} track`}
                              style={{
                                position: "absolute", top: 6, right: 6, zIndex: 2,
                                width: 22, height: 22, borderRadius: 6,
                                background: c.green, border: "none",
                                color: "#fff", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, lineHeight: 1, fontWeight: 700,
                                transition: `opacity ${motion.fast.duration}`,
                                opacity: 0.9,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                            >✓</button>
                          )}

                          {/* ID + blocked */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                              <span style={{
                                fontFamily: typo.monoMd.font, fontSize: 11,
                                fontWeight: 700, letterSpacing: "0.02em",
                                color: ec.project,
                              }}>{proj.id}</span>
                            </div>
                            {m.overdue && <span title="Overdue" style={{ fontSize: 11, lineHeight: 1 }}>⚠️</span>}
                            {m.isBlocked && <Tag color="#fff" bg={c.red} style={{ fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>BLOCKED</Tag>}
                          </div>

                          {/* Name */}
                          <div style={{
                            fontFamily: typo.bodySm.font, fontSize: 13,
                            fontWeight: 600, color: c.text, lineHeight: 1.4,
                          }}>{proj.name}</div>

                          {/* Owner + squad */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            fontFamily: typo.bodySm.font, fontSize: 11, color: c.textMid,
                          }}>
                            <span style={{ fontWeight: 500 }}>{proj.owner || "—"}</span>
                            <span style={{
                              padding: "1px 6px", borderRadius: 999,
                              background: "rgba(255,255,255,0.6)", border: `1px solid ${pastelBorder}40`,
                              fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600, color: c.textDim,
                            }}>{proj.squad}</span>
                          </div>

                          {/* Other active tracks indicator */}
                          {otherTracks.length > 0 && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
                              borderTop: `1px solid ${pastelBorder}40`,
                              paddingTop: space[2], marginTop: 2,
                            }}>
                              <span style={{ fontFamily: typo.monoSm.font, fontSize: 9, color: c.textDim, fontWeight: 600 }}>also:</span>
                              {otherTracks.map(t => (
                                <span key={t} style={{
                                  padding: "1px 5px", borderRadius: layout.radiusXs,
                                  background: pcMid[t] || c.surfaceAlt,
                                  color: pc[t] || c.textDim,
                                  fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700,
                                }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            </div>

            {/* Shipped — horizontal strip */}
            {shippedBoardProjects.length > 0 && (
              <div style={{
                background: c.surface,
                borderRadius: layout.radiusLg,
                border: `1px solid ${c.green}25`,
              }}>
                <div style={{
                  padding: `${space[2]}px ${space[4]}px`,
                  borderBottom: `1px solid ${c.green}15`,
                  display: "flex", alignItems: "center", gap: space[2],
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.green }} />
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    fontWeight: 700, letterSpacing: "0.06em",
                    color: c.green, textTransform: "uppercase",
                  }}>Shipped</span>
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    fontWeight: 700, color: c.textMid,
                    background: c.surfaceAlt, padding: "1px 7px",
                    borderRadius: layout.radiusPill, border: `1px solid ${c.border}`,
                  }}>{shippedBoardProjects.length}</span>
                </div>
                <div style={{
                  display: "flex", gap: space[3], padding: space[3],
                  overflowX: "auto",
                  scrollbarWidth: "thin", scrollbarColor: `${c.textDim}20 transparent`,
                }}>
                  {shippedBoardProjects.map(proj => (
                    <div key={proj.id} role="button" tabIndex={0}
                      onClick={() => openProject(proj.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProject(proj.id); } }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(5,150,105,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                      style={{
                        minWidth: 220, maxWidth: 260, padding: 14, borderRadius: layout.radiusMd,
                        background: "#dcfce7", border: `1px solid #86efac`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: space[2], flexShrink: 0,
                        transition: `box-shadow ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                        <span style={{ fontFamily: typo.monoMd.font, fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color: ec.project }}>{proj.id}</span>
                        <span style={{
                          fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700,
                          color: "#166534", background: "#bbf7d0",
                          padding: "1px 6px", borderRadius: layout.radiusXs,
                        }}>SHIPPED</span>
                      </div>
                      <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, fontWeight: 600, color: "#14532d", lineHeight: 1.4 }}>{proj.name}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: typo.bodySm.font, fontSize: 11, color: "#166534" }}>
                        <span style={{ fontWeight: 500 }}>{proj.owner || "—"}</span>
                        <span style={{ padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.5)", border: `1px solid #86efac60`, fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600, color: "#166534" }}>{proj.squad}</span>
                      </div>
                      {proj.shipped_at && (
                        <div style={{ fontFamily: typo.monoSm.font, fontSize: 9, color: "#15803d", borderTop: "1px solid #86efac60", paddingTop: space[1], marginTop: 2 }}>
                          Shipped {fmtDate(proj.shipped_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming — horizontal strip at bottom */}
            {upcomingBoardProjects.length > 0 && (
              <div style={{
                background: c.surface,
                borderRadius: layout.radiusLg,
                border: `1px solid ${c.border}`,
              }}>
                <div style={{
                  padding: `${space[2]}px ${space[4]}px`,
                  borderBottom: `1px solid ${c.border}`,
                  display: "flex", alignItems: "center", gap: space[2],
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.textDim }} />
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    fontWeight: 700, letterSpacing: "0.06em",
                    color: c.textDim, textTransform: "uppercase",
                  }}>Upcoming</span>
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    fontWeight: 700, color: c.textMid,
                    background: c.surfaceAlt, padding: "1px 7px",
                    borderRadius: layout.radiusPill, border: `1px solid ${c.border}`,
                  }}>{upcomingBoardProjects.length}</span>
                </div>
                <div style={{
                  display: "flex", gap: space[3], padding: space[3],
                  overflowX: "auto",
                  scrollbarWidth: "thin", scrollbarColor: `${c.textDim}20 transparent`,
                }}>
                  {upcomingBoardProjects.map(proj => (
                    <div key={proj.id} role="button" tabIndex={0}
                      draggable
                      onDragStart={(e) => handleDragStart(e, proj.id, "__upcoming__")}
                      onDragEnd={handleDragEnd}
                      onClick={() => openProject(proj.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProject(proj.id); } }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                      style={{
                        minWidth: 220, maxWidth: 260, padding: 14, borderRadius: layout.radiusMd,
                        background: c.surfaceAlt, border: `1px solid ${c.border}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: space[2], flexShrink: 0,
                        transition: `box-shadow ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                        <span style={{ fontFamily: typo.monoMd.font, fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color: ec.project }}>{proj.id}</span>
                      </div>
                      <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, fontWeight: 600, color: c.text, lineHeight: 1.4 }}>{proj.name}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: typo.bodySm.font, fontSize: 11, color: c.textMid }}>
                        <span style={{ fontWeight: 500 }}>{proj.owner || "—"}</span>
                        <span style={{ padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.6)", border: `1px solid ${c.border}`, fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600, color: c.textDim }}>{proj.squad}</span>
                      </div>
                      {proj.tentativeStartDate && (
                        <div style={{ fontFamily: typo.monoSm.font, fontSize: 9, color: c.textDim, borderTop: `1px solid ${c.border}`, paddingTop: space[1], marginTop: 2 }}>
                          Starts {fmtDate(proj.tentativeStartDate)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Board reopen modal */}
            {boardReopenModal && (() => {
              const proj = projects.find(p => p.id === boardReopenModal.projId);
              if (!proj) return null;
              const { fromTrack, toTrack } = boardReopenModal;
              return (
                <Modal open onClose={() => setBoardReopenModal(null)} title={`Reopen ${toTrack} track`} accent={c.amber}>
                  <div style={{ display: "flex", flexDirection: "column", gap: space[3], padding: `${space[2]}px 0` }}>
                    <Body style={{ color: c.textMid }}>
                      <B>{toTrack}</B> was previously completed on <B color={ec.project}>{proj.id}</B>. This will complete <B>{fromTrack}</B> and reopen <B>{toTrack}</B>.
                    </Body>
                    <input
                      placeholder="Reason for reopening (optional)"
                      value={boardReopenReason}
                      onChange={e => setBoardReopenReason(e.target.value)}
                      style={{
                        fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                        padding: `${space[2]}px ${space[3]}px`, borderRadius: layout.radiusSm,
                        border: `1px solid ${c.border}`, background: c.surfaceAlt,
                        color: c.text, outline: "none",
                      }}
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("board-reopen-confirm")?.click(); } }}
                    />
                    <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
                      <Btn variant="secondary" size="sm" onClick={() => setBoardReopenModal(null)}>Cancel</Btn>
                      <Btn id="board-reopen-confirm" variant="command" size="sm" style={{ borderColor: `${c.amber}60`, color: c.amber }} onClick={() => {
                        const reasonVal = boardReopenReason.trim() || null;
                        // Complete fromTrack
                        completeTrackInDB(proj.id, fromTrack, projects);
                        // Reopen toTrack
                        reopenTrackInDB(proj.id, toTrack, projects, { reason: reasonVal });
                        setProjects(prev => prev.map(p => {
                          if (p.id !== proj.id) return p;
                          const updated = { ...p, tracks: { ...p.tracks }, lastActivityAt: new Date().toISOString() };
                          // Complete fromTrack
                          if (updated.tracks[fromTrack]) {
                            const periods = [...updated.tracks[fromTrack].periods];
                            const last = periods[periods.length - 1];
                            if (last && !last.completed_at) periods[periods.length - 1] = { ...last, completed_at: new Date().toISOString() };
                            updated.tracks[fromTrack] = { ...updated.tracks[fromTrack], periods };
                          }
                          // Reopen toTrack
                          if (updated.tracks[toTrack]) {
                            updated.tracks[toTrack] = { ...updated.tracks[toTrack], periods: [...updated.tracks[toTrack].periods, { started_at: new Date().toISOString(), completed_at: null }] };
                          }
                          updated.phase = derivePrimaryPhase(updated);
                          return updated;
                        }));
                        window.__flowToast?.(`<b>${proj.name}</b> ${fromTrack} completed & ${toTrack} reopened`);
                        setBoardReopenModal(null);
                      }}>
                        Reopen {toTrack}
                      </Btn>
                    </div>
                  </div>
                </Modal>
              );
            })()}
          </div>
        );
      })() :

      /* ── INLINE TIMELINE VIEW ── */
      viewMode === "gantt" ? (
        <div style={{ minHeight: 500, border: `1px solid ${c.border}`, borderRadius: layout.radiusLg, overflow: "hidden" }}>
          <GanttChart
            projects={tabProjects}
            today={today}
            onProjectClick={(id) => openProject(id)}
          />
        </div>
      ) :

      /* ── LIST VIEW ── */
      tabProjects.length === 0 ? (() => {
        const hasGlobalFilter = (globalFilters.owner?.length || globalFilters.squad?.length || globalFilters.person?.length);
        const tabWord = tabLabelMap[activeTab] || "";
        let title = "No projects";
        let message = `No ${tabWord ? tabWord + " " : ""}projects found.`;
        // "Add project" never resolves synthetic-tab filters — hide it there.
        let action = !isSyntheticTab ? "Add project" : (isSyntheticTab ? "Back to Active" : null);
        let onAction = isSyntheticTab ? () => setActiveTab("active") : () => setShowCreate(true);
        if (search) {
          title = "No matches";
          message = "No projects match your search.";
          action = "Clear search"; onAction = () => setSearch("");
        } else if (hasGlobalFilter) {
          title = "No matching projects";
          message = "No projects match the current filters. Try adjusting or clearing filters.";
          action = null;
        } else if (projects.length === 0) {
          message = "Add your first project to start tracking work.";
        }
        return <EmptyState icon="📂" title={title} message={message} action={action} onAction={onAction} />;
      })() : (
        <TableShell minWidth={820}>
            <thead>
                <tr>
                  <Th col="squad" style={{ position: "sticky", left: 0, top: "var(--flow-sticky-top, 0px)", background: "rgba(232, 232, 232, 0.72)", backdropFilter: "blur(16px) saturate(1.3)", WebkitBackdropFilter: "blur(16px) saturate(1.3)", zIndex: 11, minWidth: 70 }}>Squad</Th>
                  <Th col="project" style={{ minWidth: 160 }}>Project</Th>
                  <Th col="owner" style={{ minWidth: 80 }}>Owner</Th>
                  <Th col="tracks" style={{ minWidth: 90, textAlign: "center" }}>Tracks</Th>
                  <Th col="people" style={{ minWidth: 70, textAlign: "center" }}>Team</Th>
                  <Th col="last" style={{ minWidth: 80, textAlign: "center" }}>Updated</Th>
                  <Th col="timeline" style={{ minWidth: colWidths.timeline?.min || 110, textAlign: "center" }}>Timeline</Th>
                  {toggleFollowProject && <th style={{ width: 32, padding: 0, position: "sticky", top: "var(--flow-sticky-top, 0px)", zIndex: 10, background: "rgba(232, 232, 232, 0.72)", backdropFilter: "blur(16px) saturate(1.3)", WebkitBackdropFilter: "blur(16px) saturate(1.3)", borderBottom: `1px solid rgba(0,0,0,0.13)` }} />}
                </tr>
              </thead>
              <tbody>
                {tabProjects.map((proj, fi) => {
                  const m = metrics[proj.id] || {};
                  const isFocused = kbActive && fi === focusIdx;
                  const isHovered = hoveredProject === proj.id;
                  const isDimmed = proj.status === "deprioritized";
                  const isUpcoming = proj.status === "upcoming";
                  const isPinned = pinnedIds.has(proj.id);
                  const shipped = isShipped(proj);
                  const isBlockedProj = proj.status === "blocked" || m.isBlocked;
                  const isBlockedOrOverdue = isBlockedProj || m.overdue;
                  const leftBarColor = shipped ? c.green : isBlockedOrOverdue ? c.red : null;

                  const cellBorder = "1px solid rgba(0,0,0,0.03)";
                  const rowBg = isFocused ? `${c.accent}10` : isHovered ? "rgba(0,0,0,0.012)" : c.surface;

                  // Build team members list: owner + members
                  const ownerPerson = (people || []).find(p => p.id === proj.owner_id);
                  const memberIds = m.teamMembers || [];
                  const allTeam = [];
                  if (ownerPerson) allTeam.push(ownerPerson);
                  memberIds.forEach(mid => {
                    if (mid !== proj.owner_id) {
                      const p = peopleById.get(mid);
                      if (p) allTeam.push(p);
                    }
                  });
                  const showTeam = allTeam.slice(0, 3);
                  const extraCount = allTeam.length;

                  const lastActivity = latestActivity[proj.id];

                  return (
                    <React.Fragment key={proj.id}>
                    <tr
                      ref={el => { if (el) el.__projId = proj.id; }}
                      {...(fi === 0 ? { "data-tour": "project-row" } : {})}
                      className={isFocused ? "flow-kb-focus" : undefined}
                      onMouseEnter={(e) => { setHoveredProject(proj.id); e.currentTarget.style.transform = "scale(1.008)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)"; e.currentTarget.style.zIndex = "2"; e.currentTarget.style.position = "relative"; }}
                      onMouseLeave={(e) => { setHoveredProject(null); e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.zIndex = "auto"; e.currentTarget.style.position = "static"; }}
                      onClick={() => openProject(proj.id)}
                      style={{
                        cursor: "pointer",
                        background: rowBg,
                        opacity: isDimmed ? 0.5 : 1,
                        filter: isDimmed ? "grayscale(0.6)" : "none",
                        borderLeft: leftBarColor ? `4px solid ${leftBarColor}` : "4px solid transparent",
                        transition: `background ${motion.fast.duration} ${motion.fast.easing}, opacity ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}, box-shadow ${motion.fast.duration} ${motion.fast.easing}`,
                      }}
                    >
                      {/* Squad — sticky left + pin */}
                      <td style={{
                        padding: `${space[3]}px ${space[4]}px`,
                        fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                        fontWeight: 500, color: isDimmed ? c.textGhost : c.textMid,
                        borderBottom: cellBorder,
                        position: "sticky", left: 0, background: rowBg, zIndex: 1,
                        transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button
                            type="button"
                            title={isPinned ? "Unpin from watchlist" : "Pin to watchlist"}
                            onClick={(e) => togglePin(proj.id, e)}
                            style={{
                              background: "none", border: "none", padding: 0, cursor: "pointer",
                              fontSize: 12, lineHeight: 1, flexShrink: 0,
                              opacity: isPinned ? 1 : isHovered ? 0.5 : 0,
                              color: isPinned ? c.accent : c.textDim,
                              transition: `opacity ${motion.fast.duration} ${motion.fast.easing}`,
                            }}
                          >{isPinned ? "📌" : "📌"}</button>
                          {proj.squad}
                        </div>
                      </td>

                      {/* Project — ID + Name + status/phase labels */}
                      <td style={{
                        padding: `${space[3]}px ${space[4]}px`,
                        borderBottom: cellBorder,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                          <span style={{
                            fontFamily: typo.monoMd.font, fontSize: 12,
                            fontWeight: 700, letterSpacing: "0.02em",
                            color: ec.project, flexShrink: 0,
                          }}>{proj.id}</span>
                          <span style={{
                            fontFamily: typo.bodyMd.font, fontSize: 14,
                            fontWeight: 600, color: c.text,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{proj.name}</span>
                          {m.overdue && <span title={`Overdue by ${Math.abs(daysBetween(today, proj.endDate))}d`} style={{ flexShrink: 0, fontSize: 13, lineHeight: 1 }}>⚠️</span>}
                          {m.isBlocked && <Tag color={c.red} bg={c.redDim} style={{ flexShrink: 0 }}>BLOCKED</Tag>}
                          {proj.status === "deprioritized" && <Tag color={c.textDim} bg={c.surfaceAlt} style={{ flexShrink: 0 }}>DEPRIORITIZED</Tag>}
                          {isUpcoming && <Tag color={c.textDim} bg={c.surfaceAlt} style={{ flexShrink: 0 }}>UPCOMING</Tag>}
                          {shipped && (() => {
                            const stage = furthestStageOf(proj);
                            const stageTxt = stage === "GA" ? "Live" : stage;
                            const sd = shippedDateOf(proj);
                            const dateShort = sd ? new Date(sd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
                            return (
                              <Tag color={c.green} bg={c.greenDim} style={{ flexShrink: 0 }}
                                title={sd ? `Shipped ${new Date(sd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Shipped"}>
                                {hasShipMarker(proj) ? "🚀 " : ""}{stageTxt}{dateShort ? ` · ${dateShort}` : ""}
                              </Tag>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Owner */}
                      <td style={{
                        padding: `${space[3]}px ${space[4]}px`,
                        borderBottom: cellBorder,
                        fontFamily: typo.bodyMd.font, fontSize: 14,
                        fontWeight: 500, color: proj.owner ? c.cyan : c.textDim,
                        whiteSpace: "nowrap",
                      }}>{proj.owner || "Unassigned"}</td>

                      {/* Active Tracks */}
                      <td style={{
                        padding: `${space[3]}px ${space[4]}px`,
                        textAlign: "center",
                        borderBottom: cellBorder,
                      }}>
                        {isUpcoming ? <span style={{ color: c.textDim, fontSize: 11 }}>—</span>
                         : shipped ? (
                          <span style={{
                            padding: "1px 5px", borderRadius: layout.radiusXs,
                            background: `${c.green}15`, color: c.green,
                            fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.04em",
                          }}>Shipped</span>
                        ) : (() => {
                          const active = m.activeTracks || getActiveTracks(proj);
                          if (active.length === 0) return <span style={{ color: c.textDim, fontSize: 11 }}>—</span>;
                          return (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                              {active.map(t => (
                                <span key={t} style={{
                                  padding: "1px 5px", borderRadius: layout.radiusXs,
                                  background: `${pc[t] || c.textDim}15`,
                                  color: pc[t] || c.textDim,
                                  fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  border: "none",
                                }}>{t}</span>
                              ))}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Team — solid filled avatar bubbles */}
                      <td style={{
                        padding: `${space[3]}px ${space[4]}px`, textAlign: "center",
                        borderBottom: cellBorder,
                      }}>
                        {isUpcoming ? <span style={{ color: c.textDim, fontSize: 11 }}>—</span> : (() => {
                          const SOLID_COLORS = ["#0E7490", "#B45309", "#6D28D9", "#059669", "#DC2626", "#E8590C"];
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {showTeam.map((person, idx) => (
                                  <div key={person.id} title={person.name} style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: SOLID_COLORS[idx % SOLID_COLORS.length], color: "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700,
                                    border: "2px solid #fff",
                                    marginLeft: idx > 0 ? -6 : 0,
                                    position: "relative", zIndex: idx + 1,
                                  }}>{initialsOf(person.name)}</div>
                              ))}
                              {extraCount > 0 && (
                                <div style={{
                                  width: 28, height: 28, borderRadius: 8,
                                  background: "#EDEDF0", color: c.textMid,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                                  border: "2px solid #fff",
                                  marginLeft: showTeam.length > 0 ? -6 : 0,
                                  position: "relative", zIndex: showTeam.length + 1,
                                }}>{extraCount}</div>
                              )}
                              {allTeam.length === 0 && <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textDim }}>—</span>}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Updated + activity peek icon */}
                      {isUpcoming ? (
                        <td style={{ padding: `${space[3]}px ${space[4]}px`, textAlign: "center", borderBottom: cellBorder }}>
                          <span style={{ color: c.textDim, fontSize: 11 }}>—</span>
                        </td>
                      ) : (() => {
                        const stale = isStale(proj.lastActivityAt);
                        return (
                          <td
                            style={{
                              padding: `${space[3]}px ${space[4]}px`, textAlign: "center",
                              borderBottom: cellBorder,
                              fontFamily: typo.bodySm.font, fontSize: 12,
                              color: !proj.lastActivityAt ? c.textDim : stale ? c.red : c.textMid,
                              fontWeight: 500,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                              <span title={proj.lastActivityAt ? fmtAbsolute(proj.lastActivityAt) : "No activity yet"}>
                                {proj.lastActivityAt ? timeAgo(proj.lastActivityAt) : "—"}
                              </span>
                              {lastActivity && (
                                <span
                                  style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    width: 16, height: 16, cursor: "default", flexShrink: 0,
                                    opacity: 0.35,
                                    transition: `opacity ${motion.fast.duration} ${motion.fast.easing}`,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = "0.7";
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    showActivityTip({ projId: proj.id, rect });
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = "0.35";
                                    hideActivityTip();
                                  }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={c.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="8" cy="8" r="6.5" />
                                    <line x1="8" y1="7" x2="8" y2="11" />
                                    <circle cx="8" cy="5" r="0.5" fill={c.textDim} stroke="none" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })()}

                      {/* Timeline — start→end with progress bar */}
                      <td style={{
                        padding: `${space[3]}px ${space[4]}px`,
                        borderBottom: cellBorder,
                      }}>
                        {isUpcoming ? (
                          proj.tentativeStartDate ? (
                            <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: c.textDim }}>
                              Starts {fmtDate(proj.tentativeStartDate)}
                            </span>
                          ) : <span style={{ color: c.textDim, fontSize: 11 }}>—</span>
                        ) : (() => {
                          const displayEnd = shipped && proj.shipped_at ? proj.shipped_at.slice(0, 10) : proj.endDate;
                          const allocated = daysBetween(proj.startDate, displayEnd);
                          const elapsed = Math.max(0, Math.min(daysBetween(proj.startDate, today), allocated));
                          const pct = allocated > 0 ? Math.round((elapsed / allocated) * 100) : 0;
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: c.textMid }}>
                                  {fmtDate(proj.startDate)}
                                </span>
                                <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: c.textDim }}>→</span>
                                <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: shipped ? c.green : c.textMid }}>
                                  {fmtDate(displayEnd)}
                                </span>
                              </div>
                              <div style={{ height: 3, borderRadius: 2, background: c.border, overflow: "hidden", width: "100%" }}>
                                <div style={{
                                  height: "100%", borderRadius: 2, width: `${Math.min(pct, 100)}%`,
                                  background: m.overdue ? c.red : pct > 85 ? c.amber : c.green,
                                  transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                                }} />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Follow bookmark — right end */}
                      {toggleFollowProject && (
                        <td style={{
                          padding: `0 ${space[3]}px`, borderBottom: cellBorder,
                          textAlign: "center", width: 32,
                        }}>
                          <button
                            type="button"
                            title={followedProjects.includes(proj.id) ? "Unfollow project" : "Follow project"}
                            onClick={(e) => { e.stopPropagation(); toggleFollowProject(proj.id); }}
                            style={{
                              background: "none", border: "none", padding: 2, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: followedProjects.includes(proj.id) ? 1 : isHovered ? 0.35 : 0,
                              transition: `opacity ${motion.fast.duration} ${motion.fast.easing}`,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={followedProjects.includes(proj.id) ? c.accent : "none"} stroke={followedProjects.includes(proj.id) ? c.accent : c.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
        </TableShell>
      )}
      <div style={{ flexShrink: 0, height: space[8] }} />
      </div>

      {/* Activity peek tooltip — portal to body so it escapes table overflow:clip */}
      {activityTip && (() => {
        const act = latestActivity[activityTip.projId];
        if (!act) return null;
        const r = activityTip.rect;
        const tipW = 280;
        const cx = r.left + r.width / 2;
        const idealLeft = cx - tipW / 2;
        const clampedLeft = Math.max(12, Math.min(idealLeft, window.innerWidth - tipW - 12));
        const arrowLeft = cx - clampedLeft;
        return createPortal(
          <div
            onMouseEnter={() => clearTimeout(activityTipTimer.current)}
            onMouseLeave={() => hideActivityTip()}
            style={{
              position: "fixed",
              top: r.bottom + 8, left: clampedLeft,
              background: c.surfaceSolid, border: `1px solid ${c.border}`,
              borderRadius: layout.radiusSm, boxShadow: c.shadowFloat,
              padding: `${space[2]}px ${space[3]}px`,
              width: tipW, zIndex: 10000,
              animation: `fadeScaleIn ${motion.fast.duration} ${motion.fast.easing} both`,
              transformOrigin: "top center",
            }}
          >
            <div style={{
              position: "absolute", top: -4, left: `${arrowLeft}px`, transform: "translateX(-50%) rotate(45deg)",
              width: 8, height: 8, background: c.surface,
              borderLeft: `1px solid ${c.border}`, borderTop: `1px solid ${c.border}`,
            }} />
            {act.kind === "comment" ? (<>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, flexShrink: 0 }}>💬</span>
                <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.text }}>{act.author}</span>
              </div>
              <div style={{
                fontFamily: typo.bodySm.font, fontSize: 12, lineHeight: 1.4, color: c.textMid,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>{act.body}</div>
            </>) : (
              <div style={{
                fontFamily: typo.bodySm.font, fontSize: 12, lineHeight: 1.4, color: c.textDim, fontStyle: "italic",
              }}>{act.body}</div>
            )}
          </div>,
          document.body
        );
      })()}

      {/* FAB — Add Project (hidden in historical mode) */}
      {<button data-tour="add-project" className="flow-btn" onClick={() => setShowCreate(true)} aria-label="Add project" style={{
        position: "fixed", bottom: space[7], right: space[7], zIndex: 50,
        height: 40, padding: `0 ${space[5]}px`, borderRadius: layout.radiusSm,
        border: "none", cursor: "pointer",
        background: c.accent, color: c.textOnAccent,
        fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center", gap: space[1],
        boxShadow: c.shadowFloat,
        transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = c.accentHover; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.accent; }}
      >Add project</button>}

      {/* Create Project Overlay */}
      {showCreate && <CreateProjectOverlay
        projects={projects} people={people} squads={squads} setProjects={setProjects}
        personProfile={personProfile}
        onClose={() => setShowCreate(false)}
        onCreated={(id, name) => {
          setCreateSuccess({ name, id });
          if (createSuccessTimerRef.current) clearTimeout(createSuccessTimerRef.current);
          createSuccessTimerRef.current = setTimeout(() => { setCreateSuccess(null); createSuccessTimerRef.current = null; }, 4500);
          setSelectedProject(id);
        }}
      />}

      {/* ═══ LIST-LEVEL START NOW MODAL ═══ */}
      {listStartNowId && (() => {
        const targetProj = projects.find(p => p.id === listStartNowId);
        if (!targetProj) return null;
        return (
          <Modal open={true} onClose={() => { setListStartNowId(null); setListStartNowEndDate(""); }} title="Start this project" accent={c.accent}>
            <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, lineHeight: 1.6, marginBottom: space[4] }}>
              Select tracks to start for <strong style={{ color: c.text }}>{targetProj.name}</strong>. The start date will be set to today.
            </div>
            <div style={{ display: "flex", gap: space[2], flexWrap: "wrap", marginBottom: space[4] }}>
              {trackNames.map(t => {
                const sel = listStartNowTracks.includes(t);
                const phColor = pc[t] || c.textDim;
                return (
                  <button key={t} type="button" onClick={() => setListStartNowTracks(prev => sel ? prev.filter(x => x !== t) : [...prev, t])} style={{
                    padding: `8px 16px`, borderRadius: layout.radiusSm,
                    background: sel ? phColor + "18" : c.surfaceAlt,
                    border: `1.5px solid ${sel ? phColor : c.border}`,
                    color: sel ? phColor : c.textMid,
                    fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
                    letterSpacing: "0.04em", cursor: "pointer",
                    transition: `all ${motion.fast.duration} ${motion.fast.easing}`,
                  }}>{t}</button>
                );
              })}
            </div>
            {/* Tentative end date */}
            <div style={{ marginBottom: space[5] }}>
              <label style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.textMid, letterSpacing: "0.03em", display: "block", marginBottom: 6 }}>
                TENTATIVE END DATE
              </label>
              <input
                type="date"
                value={listStartNowEndDate}
                onChange={e => setListStartNowEndDate(e.target.value)}
                min={today}
                style={{
                  width: "100%", boxSizing: "border-box", height: 40,
                  borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                  background: c.surfaceSolid, fontFamily: typo.bodyMd.font, fontSize: 14,
                  color: listStartNowEndDate ? c.text : c.textDim,
                  padding: `0 ${space[3]}px`, outline: "none",
                  colorScheme: "light",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
              <Btn variant="ghost" size="sm" onClick={() => { setListStartNowId(null); setListStartNowEndDate(""); }}>Cancel</Btn>
              <Btn variant="primary" size="sm" disabled={listStartNowTracks.length === 0} onClick={() => {
                const todayStr = today;
                const now = new Date().toISOString();
                const newTracks = {};
                for (const t of listStartNowTracks) {
                  newTracks[t] = { periods: [{ started_at: now, completed_at: null }], owner: null };
                }
                const primaryPhase = listStartNowTracks[listStartNowTracks.length - 1];
                const endDateVal = listStartNowEndDate || null;
                setProjects(prev => prev.map(p => p.id === listStartNowId ? { ...p, status: "in_flight", phase: primaryPhase, tracks: newTracks, startDate: todayStr, tentativeStartDate: null, endDate: endDateVal } : p));
                updateProjectInDB(listStartNowId, { status: "in_flight", phase: primaryPhase, startDate: todayStr, tentativeStartDate: null, endDate: endDateVal });
                if (isDevSeedMode()) {
                  const proj = rawProjects.find(p => p.id === listStartNowId);
                  if (proj) { proj.tracks = newTracks; proj.status = "in_flight"; proj.phase = primaryPhase; proj.startDate = todayStr; proj.endDate = endDateVal; devStore.persistProjects(rawProjects); }
                  const viewerName = personProfile?.name || "AJ";
                  devStore.logEvent({ projectId: listStartNowId, action: "project_started", userName: viewerName, details: { tracks: listStartNowTracks.join(", ") } });
                }
                window.__flowToast?.(`${targetProj.name} started with ${listStartNowTracks.join(", ")}`);
                setListStartNowId(null);
                setListStartNowTracks(["PRD"]);
                setListStartNowEndDate("");
              }}>Start Project</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* Board and Gantt fullscreen overlays removed — both are now inline */}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════
   CREATE PROJECT OVERLAY
   ══════════════════════════════════════════════════════════════════ */
function CreateProjectOverlay({ projects, people, squads, setProjects, onClose, onCreated, personProfile }) {
  useDevLabel('CreateProjectOverlay', 'src/views/ProjectsView.jsx', 'Modal overlay form for creating new projects with all field inputs');
  const [name, setName] = useState("");
  const [owner, setOwner] = useState(personProfile?.name || "");
  const [squad, setSquad] = useState(personProfile?.squad || "");
  const [complexity, setComplexity] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState(["PRD"]);
  const [tentativeStart, setTentativeStart] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dependencies, setDependencies] = useState([]);
  const [depSearch, setDepSearch] = useState("");
  const [depOpen, setDepOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const allSquads = squads && squads.length
    ? [...squads].sort()
    : [...new Set(projects.map(p => p.squad).filter(Boolean))].sort();
  const allOwners = people ? people.map(p => p.name).sort() : [...new Set(projects.map(p => p.owner).filter(Boolean))].sort();

  const previewId = useMemo(() => {
    const nums = projects.map(p => parseInt(p.id.replace(/\D/g, ""), 10)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `X${String(max + 1).padStart(2, "0")}`;
  }, [projects]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const startDate = startNow ? todayStr : tentativeStart;
  const canSave = name.trim() && owner && squad;

  const handleCreate = () => {
    if (!canSave || saving) return;
    setSaving(true);
    const tempId = previewId;
    const now = new Date().toISOString();
    const tracks = {};
    if (startNow && selectedTracks.length > 0) {
      for (const t of selectedTracks) {
        tracks[t] = { periods: [{ started_at: now, completed_at: null }], owner: null };
      }
    }
    const primaryPhase = startNow && selectedTracks.length > 0 ? selectedTracks[selectedTracks.length - 1] : null;
    const newProj = {
      id: tempId, name: name.trim(), description: null,
      owner, squad, phase: primaryPhase, startDate: startNow ? (startDate || null) : null, endDate: endDate || null,
      status: startNow ? "in_flight" : "upcoming",
      tracks,
      tentativeStartDate: startNow ? null : (tentativeStart || null),
      complexity: complexity || null,
      isBlocked: false, blockedReason: null, blockedAt: null,
      lastActivityAt: now, createdAt: now,
      phaseDurationOverrides: null,
      dependencies: dependencies.length > 0 ? dependencies : null,
    };
    setProjects(prev => [...prev, newProj]);
    onClose();
    if (onCreated) onCreated(tempId, name.trim());
  };

  const inputStyle = {
    width: "100%", height: 40, padding: `0 ${space[3]}px`,
    borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
    background: c.surfaceSolid, color: c.text,
    fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
    outline: "none", boxSizing: "border-box",
  };

  const fieldLabel = { fontFamily: typo.bodyXs.font, fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: space[1], letterSpacing: 0 };

  const PillSelector = ({ options, value, onChange }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: space[1] }}>
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              fontFamily: typo.bodySm.font,
              fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${selected ? opt.color : c.border}`,
              background: selected ? opt.color : c.surfaceAlt,
              color: selected ? "#fff" : c.textMid,
              cursor: "pointer",
              transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}, color ${motion.fast.duration} ${motion.fast.easing}`,
              lineHeight: 1,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );


  const complexityOpts = [
    { value: "S", label: "Low", color: c.green },
    { value: "M", label: "Med", color: c.amber },
    { value: "L", label: "High", color: c.red },
  ];

  const depCandidates = useMemo(() => {
    const filtered = projects.filter(p =>
      p.id !== previewId &&
      !dependencies.includes(p.id) &&
      (depSearch === "" || p.name.toLowerCase().includes(depSearch.toLowerCase()) || p.id.toLowerCase().includes(depSearch.toLowerCase()))
    );
    // Squad projects first, then the rest
    const mySquad = squad || personProfile?.squad;
    if (!mySquad) return filtered;
    const inSquad = filtered.filter(p => p.squad === mySquad);
    const rest = filtered.filter(p => p.squad !== mySquad);
    return [...inSquad, ...rest];
  }, [projects, previewId, dependencies, depSearch, squad, personProfile]);

  const depRef = useRef(null);
  useEffect(() => {
    if (!depOpen) return;
    const handler = (e) => { if (depRef.current && !depRef.current.contains(e.target)) setDepOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [depOpen]);

  return (
    <Modal open onClose={onClose} blur={8} width={540} title="New project">
      <div data-suppress-shortcuts style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: space[4] }}>
          <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.textMid }}>
            Create a new project for your squad
          </div>
          <span style={{
            fontFamily: typo.monoMd.font, fontSize: 12, fontWeight: 700,
            color: c.amber, letterSpacing: "0.02em",
            padding: `3px 8px`, borderRadius: layout.radiusXs,
            background: c.amberDim,
          }}>{previewId}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          {/* Name */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={fieldLabel}>Name</div>
              <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: name.length > 100 ? c.red : c.textDim, fontVariantNumeric: "tabular-nums" }}>{name.length}/100</span>
            </div>
            <Inp value={name} onChange={e => { if (e.target.value.length <= 100) setName(e.target.value); }} placeholder="e.g. Checkout Redesign" style={{ width: "100%" }} autoFocus maxLength={100} />
          </div>

          {/* Owner + Squad */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
            <div>
              <div style={fieldLabel}>Owner</div>
              <SearchSelect value={owner} onChange={setOwner} options={allOwners} placeholder="Search people..." />
            </div>
            <div>
              <div style={fieldLabel}>Squad</div>
              <SearchSelect value={squad} onChange={setSquad} options={allSquads} placeholder="Search squads..." />
            </div>
          </div>

          {/* Complexity */}
          <div>
            <div style={fieldLabel}>Complexity <span style={{ fontWeight: 400, color: c.textDim }}>— optional</span></div>
            <PillSelector options={complexityOpts} value={complexity} onChange={v => setComplexity(prev => prev === v ? "" : v)} />
          </div>

          {/* Timeline — toggle + dates */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[1] }}>
              <div style={{ ...fieldLabel, marginBottom: 0 }}>Timeline</div>
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: startNow ? c.text : c.textDim, fontWeight: 500 }}>
                  Start immediately
                </span>
                <button
                  onClick={() => { setStartNow(v => { setTentativeStart(v ? "" : todayStr); return !v; }); }}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                    background: startNow ? c.accent : c.border,
                    position: "relative", flexShrink: 0,
                    transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 8,
                    background: "#fff",
                    position: "absolute", top: 2,
                    left: startNow ? 18 : 2,
                    transition: `left ${motion.fast.duration} ${motion.fast.easing}`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  }} />
                </button>
              </div>
            </div>

            {/* Track pills — revealed when starting immediately (multiselect) */}
            <div style={{
              overflow: "hidden",
              maxHeight: startNow ? 70 : 0,
              opacity: startNow ? 1 : 0,
              marginTop: startNow ? space[2] : 0,
              transition: `max-height ${motion.normal.duration} ${motion.normal.easing}, opacity ${motion.fast.duration} ${motion.fast.easing}, margin-top ${motion.normal.duration} ${motion.normal.easing}`,
            }}>
              <div style={fieldLabel}>Starting Tracks <span style={{ fontWeight: 400, color: c.textDim }}>— select one or more</span></div>
              <div style={{ display: "flex", gap: space[2], flexWrap: "wrap" }}>
                {trackNames.map(t => {
                  const isSelected = selectedTracks.includes(t);
                  const phColor = getPhaseColors()[t] || c.textMid;
                  return (
                    <button key={t} type="button" onClick={() => {
                      setSelectedTracks(prev => isSelected ? prev.filter(x => x !== t) : [...prev, t]);
                    }} style={{
                      padding: `4px 12px`, borderRadius: 999,
                      background: isSelected ? phColor : c.surfaceAlt,
                      color: isSelected ? "#fff" : c.textMid,
                      border: `1px solid ${isSelected ? phColor : c.border}`,
                      fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                      cursor: "pointer", transition: "all 120ms ease",
                    }}>{t}</button>
                  );
                })}
              </div>
            </div>

            {/* Dates row — always side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3], marginTop: space[2] }}>
              <div>
                <div style={fieldLabel}>Tentative start date <span style={{ fontWeight: 400, color: c.textDim }}>— optional</span></div>
                <input
                  type="date"
                  value={startNow ? todayStr : tentativeStart}
                  onChange={e => { if (!startNow) setTentativeStart(e.target.value); }}
                  readOnly={startNow}
                  style={{ ...inputStyle, ...(startNow ? { background: c.surfaceAlt, color: c.textDim, cursor: "default" } : {}) }}
                />
              </div>
              <div>
                <div style={fieldLabel}>Tentative end date <span style={{ fontWeight: 400, color: c.textDim }}>— optional</span></div>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} style={{ ...inputStyle }} />
              </div>
            </div>
            {startDate && endDate && endDate <= startDate && (
              <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.red, marginTop: space[1] }}>End date must be after start date</div>
            )}
          </div>

          {/* Project Dependencies */}
          <div ref={depRef} style={{ position: "relative" }}>
            <div style={fieldLabel}>Dependencies <span style={{ fontWeight: 400, color: c.textDim }}>— optional</span></div>
            <div
              onClick={() => setDepOpen(true)}
              style={{
                ...inputStyle,
                height: "auto", minHeight: 40,
                display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4,
                padding: `4px ${space[2]}px`,
                cursor: "text",
              }}
            >
              {dependencies.map(depId => {
                const dp = projects.find(p => p.id === depId);
                return (
                  <span key={depId} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: layout.radiusXs,
                    background: c.surfaceAlt, border: `1px solid ${c.border}`,
                    fontFamily: typo.bodySm.font, fontSize: 12, color: c.text, lineHeight: 1,
                  }}>
                    <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, color: c.amber, fontWeight: 700 }}>{depId}</span>
                    {dp?.name && <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dp.name}</span>}
                    <button onClick={(e) => { e.stopPropagation(); setDependencies(prev => prev.filter(id => id !== depId)); }} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1,
                      color: c.textDim, fontSize: 14, fontWeight: 400,
                    }}>&times;</button>
                  </span>
                );
              })}
              <input
                value={depSearch}
                onChange={e => { setDepSearch(e.target.value); setDepOpen(true); }}
                onFocus={() => setDepOpen(true)}
                placeholder={dependencies.length === 0 ? "Search projects..." : ""}
                style={{
                  border: "none", outline: "none", background: "transparent",
                  fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.text,
                  flex: 1, minWidth: 80, height: 30, padding: 0,
                }}
              />
            </div>
            {depOpen && depCandidates.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                marginTop: 4, maxHeight: 180, overflowY: "auto",
                background: c.surfaceSolid, border: `1px solid ${c.border}`,
                borderRadius: layout.radiusSm, boxShadow: c.shadowFloat,
                zIndex: 20,
              }}>
                {(() => {
                  const mySquad = squad || personProfile?.squad;
                  const items = depCandidates.slice(0, 25);
                  let shownSeparator = false;
                  return items.map((p, idx) => {
                    const isSquad = mySquad && p.squad === mySquad;
                    const prevIsSquad = idx > 0 && mySquad && items[idx - 1].squad === mySquad;
                    const needSep = mySquad && !isSquad && !shownSeparator && idx > 0 && prevIsSquad;
                    if (needSep) shownSeparator = true;
                    return (
                      <React.Fragment key={p.id}>
                        {needSep && (
                          <div style={{ padding: `${space[1]}px ${space[3]}px`, display: "flex", alignItems: "center", gap: space[2] }}>
                            <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>All projects</span>
                            <span style={{ flex: 1, height: 1, background: c.border }} />
                          </div>
                        )}
                        <div
                          onClick={() => { setDependencies(prev => [...prev, p.id]); setDepSearch(""); }}
                          style={{
                            padding: `${space[2]}px ${space[3]}px`,
                            display: "flex", alignItems: "center", gap: space[2],
                            cursor: "pointer",
                            transition: `background ${motion.instant.duration} ${motion.instant.easing}`,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.amber }}>{p.id}</span>
                          <span style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                          <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, color: c.textDim }}>{p.squad}</span>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: space[2], marginTop: space[3] }}>
            <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
            <button onClick={handleCreate} disabled={!canSave || saving} style={{
              height: 36, padding: `0 ${space[4]}px`, borderRadius: layout.radiusSm,
              border: "none", cursor: canSave && !saving ? "pointer" : "default",
              background: canSave && !saving ? c.accent : c.surfaceAlt,
              color: canSave && !saving ? c.textOnAccent : c.textDim,
              fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 600,
              opacity: canSave && !saving ? 1 : 0.6,
              transition: `background ${motion.fast.duration} ${motion.fast.easing}, color ${motion.fast.duration} ${motion.fast.easing}, opacity ${motion.fast.duration} ${motion.fast.easing}`,
            }}>{saving ? "Creating..." : "Create project"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Combine a date input (YYYY-MM-DD) and a time input (HH:MM) into an ISO
// timestamp in the user's local timezone. Used by the backdating modals so a
// missed transition lands at its true past moment.
function backdatedISO(dateStr, timeStr) {
  if (!dateStr) return new Date().toISOString();
  const [h, mi] = (timeStr || "00:00").split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(mi) ? mi : 0, 0, 0);
  return d.toISOString();
}

/* ══════════════════════════════════════════════════════════════════
   PROJECT DEEP DIVE — PeopleDeepDive structural model
   De-cluttered: hero → history → ledger → supporting metadata
   ══════════════════════════════════════════════════════════════════ */
function ProjectDeepDive({ proj, metrics: m, history, projects, setProjects, people, squads, personProfile, isAdmin = false, can: canProp, onNavigate, goBack, pc, pcMid, pcDim, sc, tc, ec, today, leaving = false, suppressBackRef, projectLinks = [], setProjectLinks, phaseDurationDefaults, followedProjects = [], toggleFollowProject }) {
  const can = canProp || defaultCan;
  useDevLabel('ProjectDeepDive', 'src/views/ProjectsView.jsx', 'Full project detail view with hero telemetry, timeline, and history');
  const [editing, setEditingRaw] = useState(false);
  const [editName, setEditName] = useState(proj.name);
  const [editOwner, setEditOwner] = useState(proj.owner);
  const [editSquad, setEditSquad] = useState(proj.squad);
  const [editPhase, setEditPhase] = useState(proj.phase);
  const [editStatus, setEditStatus] = useState(proj.status || "active");
  const [editStart, setEditStart] = useState(proj.startDate || "");
  const [editEnd, setEditEnd] = useState(proj.endDate || "");
  const [editActualStart, setEditActualStart] = useState(proj.actualStartDate || "");
  const [editActualEnd, setEditActualEnd] = useState(proj.actualEndDate || "");
  const [editComplexity, setEditComplexity] = useState(proj.complexity || "");
  const [editPhaseOverrides, setEditPhaseOverrides] = useState(proj.phaseDurationOverrides || {});
  const setEditing = useCallback((val) => {
    if (val) {
      setEditName(proj.name);
      setEditOwner(proj.owner); setEditSquad(proj.squad);
      setEditPhase(proj.phase); setEditStatus(proj.status || "active");
      setEditStart(proj.startDate || ""); setEditEnd(proj.endDate || "");
      setEditActualStart(proj.actualStartDate || ""); setEditActualEnd(proj.actualEndDate || "");
      setEditComplexity(proj.complexity || "");
    }
    setEditingRaw(val);
  }, [proj.name, proj.owner, proj.squad, proj.phase, proj.status, proj.startDate, proj.endDate, proj.actualStartDate, proj.actualEndDate, proj.complexity]);
  const [depriReasonModal, setDepriReasonModal] = useState(false);
  const [depriReasonText, setDepriReasonText] = useState("");
  const [blockedReasonModal, setBlockedReasonModal] = useState(false);
  const [blockedReasonText, setBlockedReasonText] = useState("");
  const [showOverrides, setShowOverrides] = useState(false);
  const [startNowModal, setStartNowModal] = useState(false);
  const [startNowTracks, setStartNowTracks] = useState(["PRD"]);
  const [startNowEndDate, setStartNowEndDate] = useState("");
  // Ship-phase modals: Alpha/Beta note + GA release note
  const [shipPhaseModal, setShipPhaseModal] = useState(null); // { phase, from }
  const [shipNote, setShipNote] = useState("");
  const [shipPct, setShipPct] = useState("");
  const [gaReleaseNote, setGaReleaseNote] = useState("");
  const [gaFeatureType, setGaFeatureType] = useState("New");
  const [showConfetti, setShowConfetti] = useState(false);
  const [trackReopenModal, setTrackReopenModal] = useState(false);
  const [trackReopenReason, setTrackReopenReason] = useState("");
  const [trackReopenTarget, setTrackReopenTarget] = useState(null);
  const [shipProjectModal, setShipProjectModal] = useState(false);
  const [shipProjectNote, setShipProjectNote] = useState("");
  const [shipProjectFeatureType, setShipProjectFeatureType] = useState("New");

  // Helper: log an event to activity feed, update lastActivityAt, show toast
  const recordAction = useCallback((action, details, toastMsg) => {
    const now = new Date().toISOString();
    // Update lastActivityAt
    setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, lastActivityAt: now } : p));
    // Log to activity feed
    if (isDevSeedMode()) {
      devStore.logEvent({ projectId: proj.id, action, details });
    }
    // Show toast
    if (toastMsg) window.__flowToast?.(toastMsg);
  }, [proj.id, setProjects]);
  const [reactivateModal, setReactivateModal] = useState(false);
  const [retroDateModal, setRetroDateModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(null); // cached overrides when a retro-date confirmation is open
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteDeps, setDeleteDeps] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [depsLoading, setDepsLoading] = useState(false);
  const [depsError, setDepsError] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [phaseTransitions, setPhaseTransitions] = useState([]);

  // ── Backdating: "Log missed transition" + "Add track" modals ──
  const [missedModal, setMissedModal] = useState(false);
  const [missedFrom, setMissedFrom] = useState("");
  const [missedTo, setMissedTo] = useState("");
  const [missedDate, setMissedDate] = useState(today);
  const [missedTime, setMissedTime] = useState("12:00");
  const [missedReason, setMissedReason] = useState("");

  const [addTrackModal, setAddTrackModal] = useState(false);
  const [addTrackPhase, setAddTrackPhase] = useState("");
  const [addTrackStart, setAddTrackStart] = useState(today);   // defaults to today, editable
  const [addTrackEnd, setAddTrackEnd] = useState("");          // optional — leave blank for an ongoing track
  const [addTrackNote, setAddTrackNote] = useState("");

  const openMissedModal = useCallback(() => {
    setMissedFrom(""); setMissedTo(""); setMissedDate(today); setMissedTime("12:00"); setMissedReason("");
    setMissedModal(true);
  }, [today]);
  const openAddTrackModal = useCallback(() => {
    setAddTrackPhase(""); setAddTrackStart(today); setAddTrackEnd(""); setAddTrackNote("");
    setAddTrackModal(true);
  }, [today]);

  // Shared writer for the transition / add-track modals: optimistic React update
  // + persist via the mutations layer (dev seed or Supabase) + timeline refresh.
  // `backdated` controls whether the entry is tagged as retroactively logged.
  const applyBackdated = useCallback(({ from = null, to, at, endAt = null, reason = null, note = null, action, backdated = true }) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== proj.id) return p;
      const tracks = applyBackdatedTransition(p.tracks, from, to, at, endAt, backdated);
      const updated = { ...p, tracks, lastActivityAt: new Date().toISOString() };
      updated.phase = derivePrimaryPhase(updated);
      if (updated.status === "upcoming") updated.status = "in_flight";
      return updated;
    }));
    recordBackdatedTrackInDB(proj.id, { from, to, at, endAt, reason, note, action, backdated }, projects);
    // Only an open (ongoing) track defines the current phase on the timeline.
    if (!endAt) {
      setPhaseTransitions(prev =>
        [...prev, { at, phase: to, by: personProfile?.name || "You", backdated }]
          .sort((a, b) => new Date(a.at) - new Date(b.at))
      );
    }
  }, [proj.id, projects, setProjects, personProfile]);

  const saveMissedTransition = useCallback(() => {
    if (!missedTo) return;
    const at = backdatedISO(missedDate, missedTime);
    applyBackdated({ from: missedFrom || null, to: missedTo, at, reason: missedReason.trim() || null, action: "project_phase_changed", backdated: true });
    setMissedModal(false);
    window.__flowToast?.(`Logged ${missedFrom ? missedFrom + " → " : ""}${missedTo} (backdated)`);
  }, [missedTo, missedFrom, missedDate, missedTime, missedReason, applyBackdated]);

  const saveAddTrack = useCallback(() => {
    if (!addTrackPhase) return;
    const at = backdatedISO(addTrackStart, "12:00");
    // Optional end date → log a track that already ran to completion (ignored if before start).
    const endAt = (addTrackEnd && addTrackEnd >= addTrackStart) ? backdatedISO(addTrackEnd, "12:00") : null;
    const isBackdated = addTrackStart < today; // only flag as backdated when the start is in the past
    applyBackdated({ from: null, to: addTrackPhase, at, endAt, note: addTrackNote.trim() || null, action: "track_started", backdated: isBackdated });
    setAddTrackModal(false);
    window.__flowToast?.(`${addTrackPhase} track ${endAt ? "logged" : "started"}`);
  }, [addTrackPhase, addTrackStart, addTrackEnd, addTrackNote, applyBackdated, today]);

  // Resources IIFE states — hoisted to component level to avoid conditional hook ordering
  const [resAdding, setResAdding] = useState(false);
  const [resNewType, setResNewType] = useState("prd");
  const [resNewLabel, setResNewLabel] = useState("");
  const [resNewUrl, setResNewUrl] = useState("");
  const [resTypeDropOpen, setResTypeDropOpen] = useState(false);
  const resTypeDropRef = useRef(null);
  const editBtnRef = useRef(null);
  const nameInpRef = useRef(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const feedbackFileRef = useRef(null);
  const [feedbackFileName, setFeedbackFileName] = useState("");
  const [shoutouts, setShoutouts] = useState([]);
  const [feedbackEvents, setFeedbackEvents] = useState([]);
  const feedbackSectionRef = useRef(null);

  const memberIds = useMemo(() => {
    if (isDevSeedMode()) {
      return new Set((devStore.listMembers(proj.id) || []).map(m => m.person_id));
    }
    return new Set();
  }, [proj.id]);

  const projRole = getProjectRole(personProfile?.id, proj, memberIds, isAdmin);

  useEffect(() => {
    const target = sessionStorage.getItem("flow_scroll_to");
    if (target === "feedback" && feedbackSectionRef.current) {
      sessionStorage.removeItem("flow_scroll_to");
      setTimeout(() => feedbackSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, []);

  useEffect(() => {
    if (!isDevSeedMode() || proj.status !== "shipped") return;
    const refresh = () => {
      const events = devStore.listEvents(proj.id) || [];
      setShoutouts(events.filter(e => e.action === "shoutout"));
      setFeedbackEvents(events.filter(e => e.action === "feedback"));
    };
    refresh();
    const unsub = devStore.subscribe((change) => {
      if (change.type === "events" && change.projectId === proj.id) refresh();
    });
    return unsub;
  }, [proj.id, proj.status]);


  // Tell App.jsx's global Escape handler to stand down whenever this deep-dive
  // is in edit mode or has a modal open — otherwise pressing Escape to close
  // the edit form would also navigate back to the project list.
  useEffect(() => {
    if (!suppressBackRef) return;
    suppressBackRef.current = !!(editing || deleteModal || depriReasonModal || blockedReasonModal || reactivateModal || retroDateModal || shipPhaseModal || trackReopenModal || shipProjectModal);
    return () => { if (suppressBackRef) suppressBackRef.current = false; };
  }, [editing, deleteModal, depriReasonModal, blockedReasonModal, reactivateModal, retroDateModal, shipPhaseModal, trackReopenModal, shipProjectModal, suppressBackRef]);

  // Fetch phase-change history from activity_log for this project.
  // Two formats coexist:
  //   • Legacy `edit_project` with details.phase   (pre-rewrite)
  //   • New     `project_phase_changed` with details.to  (post-rewrite)
  // Both get mapped to { at, phase, by } so the timeline component
  // doesn't need to know which format produced the row. In dev seed
  // mode we read from the in-memory devStore instead of Supabase.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let rows;
        if (isDevSeedMode()) {
          rows = devStore.listEvents(proj.id)
            .slice()
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else {
          const { data, error } = await supabase
            .from("activity_log")
            .select("created_at, user_name, action, details")
            .eq("entity_type", "project")
            .eq("entity_id", proj.id)
            .in("action", ["edit_project", "project_phase_changed", "project_created"])
            .order("created_at", { ascending: true });
          if (error || cancelled || !data) return;
          rows = data;
        }
        const transitions = (rows || [])
          .map(r => {
            const d = r.details || {};
            if (r.action === "project_phase_changed") {
              return d.to ? { at: r.created_at, phase: d.to, by: r.user_name } : null;
            }
            if (r.action === "edit_project" && d.phase) {
              return { at: r.created_at, phase: d.phase, by: r.user_name };
            }
            if (r.action === "project_created") {
              // Project starts in PRD by default; use creation timestamp.
              return { at: r.created_at, phase: "PRD", by: r.user_name };
            }
            return null;
          })
          .filter(Boolean);
        if (cancelled) return;
        setPhaseTransitions(transitions);
      } catch {
        /* swallow — transitions are a nice-to-have */
      }
    })();
    return () => { cancelled = true; };
  }, [proj.id]);

  // Safe default so missing metrics don't crash the view (e.g. first-render
  // race or brand-new project with no commits yet).
  if (!m) m = { historyTotal: 0, peopleList: [], weeklyData: [], overdue: false, atRisk: false, isBlocked: false, isStale: false };

  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimerRef = useRef(null);
  useEffect(() => () => { if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current); }, []);

  // Enter edit mode: scroll to top + focus Name input
  const enterEdit = useCallback(() => {
    setEditing(true);
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { nameInpRef.current?.focus({ preventScroll: true }); } catch { nameInpRef.current?.focus(); }
      nameInpRef.current?.select?.();
    }));
  }, [setEditing]);

  // Exit edit mode: return focus to the Edit FAB (screen-reader / keyboard users)
  const exitEdit = useCallback(() => {
    setEditing(false);
    setTimeout(() => editBtnRef.current?.focus(), 0);
  }, [setEditing]);

  // Keyboard: E = enter edit, Esc = cancel (when form is open and no modal above)
  useKeyboard([
    { key: "e", fn: () => { if (!editing && !deleteModal && !depriReasonModal && !reactivateModal && !retroDateModal) enterEdit(); } },
    { key: "Escape", force: true, fn: () => { if (editing && !deleteModal && !depriReasonModal && !reactivateModal && !retroDateModal) { cancelEdits(); exitEdit(); } } },
  ], [editing, deleteModal, depriReasonModal, reactivateModal, retroDateModal, enterEdit, exitEdit]);

  const allSquads = useMemo(
    () => squads && squads.length
      ? [...squads].sort()
      : [...new Set(projects.map(p => p.squad).filter(Boolean))].sort(),
    [squads, projects]
  );
  const allOwners = useMemo(() => (people ? people.map(p => p.name).sort() : [...new Set(projects.map(p => p.owner).filter(Boolean))].sort()), [people, projects]);

  const doSave = (overrides = {}) => {
    const finalStatus = overrides.status ?? editStatus;
    const finalReason = overrides.depriReason !== undefined ? overrides.depriReason : proj.depriReason;
    const name = (editName || "").trim() || proj.name;
    // Sync toast is triggered by useSyncedSetters onSyncDone callback — no fake timer
    setProjects(prev => prev.map(p => p.id === proj.id ? {
      ...p,
      name,
      owner: editOwner, squad: editSquad, phase: editPhase,
      status: finalStatus, depriReason: finalReason,
      startDate: editStart || null, endDate: editEnd || null,
      actualStartDate: shipPhases.includes(editPhase) ? (editActualStart || null) : null,
      actualEndDate: shipPhases.includes(editPhase) ? (editActualEnd || null) : null,
      complexity: editComplexity || null,
      phaseDurationOverrides: Object.keys(editPhaseOverrides).length ? editPhaseOverrides : null,
    } : p));
    exitEdit();
    setJustSaved(true);
    if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
    justSavedTimerRef.current = setTimeout(() => setJustSaved(false), 900);
    // Log edit save to activity + toast (unless a more specific action already fired one)
    if (!overrides.status) {
      recordAction("project_updated", { fields: "details" }, "Project updated");
    }
  };

  // Dates must be set together (can't have start without end or vice versa),
  // and end must be strictly after start.
  const dateError = (() => {
    if (!editStart && !editEnd) return null;
    if (!editStart) return "Start date is required when end date is set";
    if (!editEnd) return "End date is required when start date is set";
    if (editEnd < editStart) return "End date must be on or after start date";
    return null;
  })();
  const canSaveEdits = (editName || "").trim().length > 0 && !dateError;

  // Does this project have any history entries from past weeks (i.e., before
  // the current week's start)? If so, changing start/end dates retroactively
  // alters overdue calculations for those frozen weeks.
  const pastHistoryWeekCount = useMemo(() => {
    const projHist = history[proj.id] || [];
    return projHist.filter(w => w.entries?.length > 0).length;
  }, [history, proj.id]);
  const datesChanged = (editStart !== (proj.startDate || "")) || (editEnd !== (proj.endDate || ""));

  const saveEdits = () => {
    if (!canSaveEdits) return;
    // If status is changing to deprioritized, prompt for reason
    if (editStatus === "deprioritized" && proj.status !== "deprioritized") {
      setDepriReasonText("");
      setDepriReasonModal(true);
      return;
    }
    // If reactivating, confirm before clearing the reason (audit affordance).
    // If dates ALSO changed retroactively, the reactivate modal will chain into
    // the retro-date warning before saving (see reactivateModal handler).
    if (editStatus === "active" && proj.status === "deprioritized") {
      setReactivateModal(true);
      return;
    }
    // If plan dates change on a project with prior-week history, warn
    // that overdue status for those frozen weeks will shift.
    if (datesChanged && pastHistoryWeekCount > 0) {
      setPendingSave({});
      setRetroDateModal(true);
      return;
    }
    doSave();
  };
  const cancelEdits = () => {
    setEditName(proj.name);
    setEditOwner(proj.owner); setEditSquad(proj.squad); setEditPhase(proj.phase); setEditStatus(proj.status || "active");
    setEditStart(proj.startDate || ""); setEditEnd(proj.endDate || "");
    setEditActualStart(proj.actualStartDate || ""); setEditActualEnd(proj.actualEndDate || "");
    setEditComplexity(proj.complexity || "");
    exitEdit();
  };

  // ── Delete flow ──
  const handleDeleteClick = async () => {
    setDeleteModal(true);
    setDepsLoading(true);
    setDepsError(null);
    setDeleteDeps(null);
    setDeleteConfirmText("");
    try {
      const deps = await getProjectDependencies(proj.id);
      setDeleteDeps(deps);
    } catch (err) {
      setDepsError(err?.message || "Failed to check dependencies");
    } finally {
      setDepsLoading(false);
    }
  };
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const ok = await deleteProjectFromDB(proj.id);
      if (ok) {
        setProjects(prev => prev.filter(p => p.id !== proj.id));
        setDeleteModal(false);
        goBack();
      } else {
        setDepsError("Delete failed. Please try again.");
        setDeleting(false);
      }
    } catch (err) {
      setDepsError(err?.message || "Delete failed");
      setDeleting(false);
    }
  };

  const sCfg = sc[editStatus] || sc[proj.status] || sc.active;
  const allocated = daysBetween(proj.startDate, proj.endDate);
  const elapsed = Math.max(0, Math.min(daysBetween(proj.startDate, today), allocated));

  // Build full weekly matrix for phase timeline.
  // Entries with an unrecognized stage fall into an "Other" bucket so they're
  // still visible — previously they were silently dropped.
  const { weekPhaseMatrix, hasOtherBucket } = useMemo(() => {
    const projHist = history[proj.id] || [];
    const allWeeks = projHist.map(wk => wk.week);
    const knownPhases = ["PRD", "Design", "Dev", "QA"];
    const matrix = {};
    for (const w of allWeeks) {
      matrix[w] = {};
      for (const ph of knownPhases) matrix[w][ph] = [];
      matrix[w].Other = [];
    }
    let otherSeen = false;
    const place = (weekKey, entry) => {
      if (!matrix[weekKey]) return;
      const stage = entry.stage || "PRD";
      if (matrix[weekKey][stage]) {
        matrix[weekKey][stage].push(entry);
      } else {
        matrix[weekKey].Other.push({ ...entry, _unknownStage: entry.stage });
        otherSeen = true;
      }
    };
    for (const wk of projHist) {
      for (const e of wk.entries) place(wk.week, e);
    }
    return { weekPhaseMatrix: matrix, hasOtherBucket: otherSeen };
  }, [proj.id, history]);

  // ── Derived metrics for hero KPI grid ──
  const remaining = proj.endDate ? daysBetween(today, proj.endDate) : null;
  const hasPlannedDates = allocated > 0;
  const pct = hasPlannedDates ? Math.min(100, Math.round((elapsed / allocated) * 100)) : null;
  const daysUntilStart = proj.startDate ? daysBetween(today, proj.startDate) : 0;
  const notStarted = daysUntilStart > 0;
  const inShip = shipPhases.includes(proj.phase);
  const isDepri = proj.status === "deprioritized";
  const isOverdue = remaining != null && remaining < 0 && !inShip;
  const elapsedLabel = !hasPlannedDates ? "dates not set"
    : notStarted ? `starts in ${daysUntilStart}d`
    : isOverdue ? `${Math.abs(remaining)}d overdue`
    : `${pct}% elapsed`;
  const remainingValue = remaining == null ? "—"
    : notStarted ? `in ${daysUntilStart}d`
    : isDepri ? (remaining < 0 ? `ended ${Math.abs(remaining)}d ago` : `${remaining}d left`)
    : remaining < 0 ? (inShip ? `${Math.abs(remaining)}d past plan` : `${Math.abs(remaining)}d over`)
    : `${remaining}d`;
  const fmtShort = (d) => { if (!d) return "—"; const dt = new Date(d + "T00:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

  // ── Risk tier derived from metrics ──
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: space[3], paddingBottom: 96,
      animation: leaving
        ? `fadeScaleOut ${motion.fast.duration} cubic-bezier(0.4, 0, 1, 1) both`
        : `viewMorphIn ${motion.normal.duration} ${motion.normal.easing} both`,
      transformOrigin: "center top",
    }}>

      {/* ═══ STATE BANNERS — upcoming / deprioritized / blocked ═══ */}
      {proj.status === "upcoming" && (
        <div style={{
          padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          background: c.surfaceAlt, border: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", gap: space[3],
        }}>
          <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 700, color: c.textDim, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Upcoming Project
          </span>
          {proj.tentativeStartDate && (() => {
            const daysOver = Math.round((new Date(today + "T00:00:00") - new Date(proj.tentativeStartDate + "T00:00:00")) / 86400000);
            if (daysOver > 0) return (
              <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.amber }}>
                Tentative start date passed by {daysOver}d
              </span>
            );
            return null;
          })()}
          <div style={{ flex: 1 }} />
          {can.changeStatus(projRole) && <button type="button" onClick={() => { setStartNowTracks(["PRD"]); setStartNowModal(true); }} style={{
            padding: `5px 14px`, borderRadius: 999, flexShrink: 0,
            background: c.accent, border: "none",
            color: c.textOnAccent, fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
            cursor: "pointer",
          }}>Start Now</button>}
        </div>
      )}
      {proj.status === "deprioritized" && (
        <div style={{
          padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          background: c.amberDim, border: `1px solid ${c.amberBorder}`,
          display: "flex", alignItems: "center", gap: space[3],
        }}>
          <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 700, color: c.amber, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Deprioritized
          </span>
          <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, lineHeight: 1.5, flex: 1 }}>
            {proj.depriReason || <span style={{ color: c.textDim, fontStyle: "italic" }}>No reason provided.</span>}
          </div>
          {can.changeStatus(projRole) && <button type="button" onClick={() => {
            setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, status: "in_flight", depriReason: null } : p));
            updateProjectInDB(proj.id, { status: "in_flight", depriReason: null });
            recordAction("project_status_changed", { from: "deprioritized", to: "in_flight" }, "Project moved back to in flight");
          }} style={{
            padding: `4px 12px`, borderRadius: 999, flexShrink: 0,
            background: "transparent", border: `1px solid ${c.amber}`,
            color: c.amber, fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
            cursor: "pointer",
          }}>Move to active</button>}
        </div>
      )}
      {proj.isBlocked && proj.status !== "deprioritized" && (
        <div style={{
          padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          background: c.redDim, border: `1px solid ${c.redBorder}`,
          display: "flex", alignItems: "center", gap: space[3],
        }}>
          <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 700, color: c.red, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Blocked
          </span>
          <span style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, flex: 1 }}>
            {proj.blockedReason || <span style={{ color: c.textDim, fontStyle: "italic" }}>No reason provided.</span>}
          </span>
          {can.changeStatus(projRole) && <button type="button" onClick={() => {
            setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, isBlocked: false, blockedReason: null, blockedAt: null } : p));
            updateProjectInDB(proj.id, { isBlocked: false, blockedReason: null, blockedAt: null });
            recordAction("project_unblocked", { reason: proj.blockedReason }, "Project unblocked");
          }} style={{
            padding: `4px 12px`, borderRadius: 999, flexShrink: 0,
            background: "transparent", border: `1px solid ${c.red}`,
            color: c.red, fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
            cursor: "pointer",
          }}>Unblock</button>}
        </div>
      )}

      {/* ═══ SHIPPED BANNER — above hero card ═══ */}
      {proj.status === "shipped" && (
        <div style={{
          padding: `${space[5]}px ${space[6]}px`,
          borderRadius: layout.radiusLg, background: c.greenDim,
          border: `1px solid ${c.green}25`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3], marginBottom: proj.gaReleaseNote ? space[3] : 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: layout.radiusSm,
              background: `${c.green}18`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, lineHeight: 1,
            }}>🚀</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
                  color: c.green, letterSpacing: "0.04em", textTransform: "uppercase",
                }}>Project Shipped</span>
                {proj.gaFeatureType && (
                  <Tag color={c.green} bg={c.surface} style={{ fontSize: 10 }}>{proj.gaFeatureType}</Tag>
                )}
              </div>
              {(proj.shippedAt || proj.gaEnteredAt) && (
                <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textMid, marginTop: 2 }}>
                  {new Date((proj.shippedAt || proj.gaEnteredAt).slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
            <button type="button" onClick={() => {
              const viewerName = personProfile?.name || "AJ";
              if (isDevSeedMode()) {
                devStore.logEvent({ projectId: proj.id, action: "shoutout", userName: viewerName, details: { from: viewerName, projectName: proj.name } });
              }
              window.__flowToast?.(`🎉 Shoutout sent for ${proj.name}!`);
            }} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: `5px 12px`, borderRadius: layout.radiusSm,
              background: "transparent", border: `1px solid ${c.green}30`,
              color: c.green, fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
              cursor: "pointer", marginLeft: "auto",
              transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}`,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = `${c.green}12`; e.currentTarget.style.borderColor = c.green; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${c.green}30`; }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>👏</span>
              Give shoutout
            </button>
          </div>
          {proj.gaReleaseNote && (
            <div style={{
              fontFamily: typo.bodyMd.font, fontSize: 14, color: c.textMid, lineHeight: 1.6,
              paddingLeft: 36 + space[3], marginTop: space[1],
            }}>
              {proj.gaReleaseNote}
            </div>
          )}
        </div>
      )}

      {/* ═══ ALPHA / BETA RELEASE NOTE — above hero card ═══ */}
      {(() => {
        const hasAlphaOrBeta = (proj.shipNote || proj.shipPct != null) &&
          (proj.phase === "Alpha" || proj.phase === "Beta" ||
           proj.tracks?.Alpha?.periods?.some(p => !p.completed_at) ||
           proj.tracks?.Beta?.periods?.some(p => !p.completed_at));
        if (!hasAlphaOrBeta) return null;
        const releasePhase = proj.tracks?.Beta?.periods?.some(p => !p.completed_at) ? "Beta"
          : proj.tracks?.Alpha?.periods?.some(p => !p.completed_at) ? "Alpha"
          : proj.phase === "Beta" ? "Beta" : "Alpha";
        return (
          <div style={{
            padding: `${space[4]}px ${space[5]}px`,
            borderRadius: layout.radiusSm, background: c.greenDim,
            border: `1px solid ${c.green}20`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[2] }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>
              <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: c.green, letterSpacing: "0.08em", textTransform: "uppercase" }}>{releasePhase} Release</span>
              {proj.shipPct != null && (
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                  color: c.green, background: c.surface, padding: `2px 8px`,
                  borderRadius: layout.radiusXs, border: `1px solid ${c.green}30`,
                  marginLeft: "auto",
                }}>{proj.shipPct}% rollout</span>
              )}
              <button type="button" onClick={() => {
                setShipNote(proj.shipNote || "");
                setShipPct(proj.shipPct != null ? String(proj.shipPct) : "");
                setShipPhaseModal({ phase: releasePhase, from: releasePhase });
              }} style={{
                background: "none", border: "none", cursor: "pointer",
                color: c.textDim, fontSize: 11, fontWeight: 600,
                fontFamily: typo.bodySm.font, textDecoration: "underline",
                flexShrink: 0, marginLeft: proj.shipPct == null ? "auto" : 0,
              }}>Edit</button>
            </div>
            {proj.shipNote && (
              <div style={{ fontFamily: typo.bodyMd.font, fontSize: 14, color: c.textMid, lineHeight: 1.55 }}>
                {proj.shipNote}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ IDENTITY HEADER — project id + name + owner|squad + status + freshness ═══ */}
      <div data-tour="project-hero" style={{
        padding: `${space[5]}px ${space[6]}px`, borderRadius: layout.radiusLg,
        background: c.surface,
        border: `1px solid ${justSaved ? c.green : c.border}`,
        boxShadow: justSaved ? `${c.shadowCard || ""}, 0 0 0 3px ${c.greenDim}` : c.shadowCard,
        transition: `border-color ${motion.normal.duration} ${motion.normal.easing}, box-shadow ${motion.normal.duration} ${motion.normal.easing}`,
        position: "relative", zIndex: 10,
      }}>
        {!editing ? (
          <div key="read" style={{
            animation: `fadeIn ${motion.fast.duration} ${motion.fast.easing} both`,
          }}>
            {/* Row 1: ID · Updated */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.06em", color: ec.project,
                  padding: `2px 6px`, borderRadius: layout.radiusXs,
                  background: c.amberDim,
                }}>{proj.id}</span>
                {proj.complexity && (() => {
                  const cLabels = { S: "Low", M: "Med", L: "High", XL: "High" };
                  return <Tag color={c.textMid} bg={c.surfaceAlt}>{cLabels[proj.complexity] || proj.complexity}</Tag>;
                })()}
              </div>
              {(() => {
                const stale = isStale(proj.lastActivityAt);
                const label = proj.lastActivityAt ? `Updated ${timeAgo(proj.lastActivityAt)}` : "No activity yet";
                return (
                  <span title={proj.lastActivityAt ? fmtAbsolute(proj.lastActivityAt) : ""}
                    style={{
                      fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 500,
                      color: stale ? c.red : c.textDim,
                    }}
                  >
                    {stale && proj.lastActivityAt && "⚠ "}{label}
                  </span>
                );
              })()}
            </div>

            {/* Row 2: Project Name */}
            <div style={{
              fontFamily: typo.displayLg.font, fontSize: typo.displayLg.size,
              fontWeight: typo.displayLg.weight, color: c.text,
              letterSpacing: typo.displayLg.tracking, lineHeight: 1.15,
              marginTop: space[2],
            }}>{proj.name}
              {toggleFollowProject && (
                <button
                  type="button"
                  data-tour="follow-project"
                  title={followedProjects.includes(proj.id) ? "Unfollow project" : "Follow project"}
                  onClick={() => toggleFollowProject(proj.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", verticalAlign: "middle",
                    marginLeft: space[3], padding: 4,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={followedProjects.includes(proj.id) ? c.accent : "none"} stroke={followedProjects.includes(proj.id) ? c.accent : c.textGhost} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Row 3: Owner | Squad */}
            <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[2] }}>
              <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: c.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Owner</span>
              <span style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 600, color: proj.owner ? c.text : c.textMid, fontStyle: proj.owner ? "normal" : "italic" }}>{proj.owner || "Unassigned"}</span>
              {proj.squad && (
                <>
                  <span style={{ color: c.border, fontSize: 11, margin: `0 ${space[1]}px` }}>|</span>
                  <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: c.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Squad</span>
                  <span style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 500, color: c.textMid }}>{proj.squad}</span>
                </>
              )}
              {proj.createdAt && (
                <>
                  <span style={{ color: c.border, fontSize: 11, margin: `0 ${space[1]}px` }}>|</span>
                  <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: c.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Created</span>
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 500, color: c.textDim }}>{fmtShort(proj.createdAt.split("T")[0])}</span>
                </>
              )}
            </div>

            {/* Row 4: Active Tracks + quick-actions — hidden for upcoming and shipped */}
            {proj.status !== "upcoming" && proj.status !== "shipped" && <div style={{ marginTop: space[4], display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
              <div>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim,
                  display: "block", marginBottom: space[1],
                }}>Active Tracks</span>
                <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                  {(() => {
                    const activeTracks = getActiveTracks(proj);
                    const phColors = getPhaseColors();
                    const phMids = getPhaseMids();
                    return (
                      <>
                        {activeTracks.length > 0 ? activeTracks.map(t => (
                          <span key={t} style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: `4px 12px`, borderRadius: 999,
                            background: phMids[t] || c.surfaceAlt, color: phColors[t] || c.textMid,
                            fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            border: `1px solid ${(phColors[t] || c.textMid) + "30"}`,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: phColors[t] || c.textMid }} />
                            {t}
                            <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, color: c.textDim, fontVariantNumeric: "tabular-nums" }}>
                              {getTrackActiveDays(proj, t)}d
                            </span>
                          </span>
                        )) : proj.status !== "shipped" ? (
                          <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textDim, fontStyle: "italic" }}>No active tracks</span>
                        ) : null}
                        {/* + Track button */}
                        {proj.status !== "shipped" && can.manageTracks(projRole) && (
                          <button id="add-track-btn" type="button" onClick={openAddTrackModal} style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: `4px 10px`, borderRadius: 999,
                            background: "transparent", border: `1px dashed ${c.border}`,
                            color: c.textDim, fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                            cursor: "pointer", transition: "border-color 120ms ease, color 120ms ease",
                          }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textDim; }}
                          >+ Track</button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              {can.changeStatus(projRole) && <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                {/* Ship Project */}
                {proj.status === "in_flight" && (
                  <button type="button" onClick={() => {
                    setShipProjectNote("");
                    setShipProjectFeatureType("New");
                    setShipProjectModal(true);
                  }} style={{
                    padding: `4px 10px`, borderRadius: 999,
                    background: c.greenDim, border: `1px solid ${c.green}40`,
                    color: c.green, fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "background 120ms ease",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = c.green; e.currentTarget.style.color = c.surface; }}
                    onMouseLeave={e => { e.currentTarget.style.background = c.greenDim; e.currentTarget.style.color = c.green; }}
                  >Ship Project</button>
                )}
                {!proj.isBlocked && proj.status !== "deprioritized" && proj.status !== "shipped" && (
                  <button type="button" onClick={() => { setBlockedReasonText(""); setBlockedReasonModal(true); }} style={{
                    padding: `4px 10px`, borderRadius: 999,
                    background: "transparent", border: `1px solid ${c.border}`,
                    color: c.textDim, fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "border-color 120ms ease, color 120ms ease",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.red; e.currentTarget.style.color = c.red; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textDim; }}
                  >Mark blocked</button>
                )}
                {proj.status !== "deprioritized" && proj.status !== "shipped" && (
                  <button type="button" onClick={() => { setDepriReasonText(""); setDepriReasonModal(true); }} style={{
                    padding: `4px 10px`, borderRadius: 999,
                    background: "transparent", border: `1px solid ${c.border}`,
                    color: c.textDim, fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "border-color 120ms ease, color 120ms ease",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.amber; e.currentTarget.style.color = c.amber; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textDim; }}
                  >Deprioritize</button>
                )}
              </div>}
            </div>}

            {/* Completed Tracks Summary */}
            {proj.status !== "upcoming" && (() => {
              const completed = getCompletedTracks(proj);
              if (completed.length === 0) return null;
              const phColors = getPhaseColors();
              return (
                <div style={{ marginTop: space[2], display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
                  {completed.map(({ name, days, cycles }) => (
                    <span key={name} style={{
                      fontFamily: typo.bodySm.font, fontSize: 11, color: c.textMid, lineHeight: 1.4,
                    }}>
                      <span style={{ color: phColors[name] || c.textMid, fontWeight: 600 }}>{name}</span>
                      {" "}completed in {days}d
                      {cycles > 1 && <span style={{ color: c.textDim }}>{" "}&middot; {cycles} cycles</span>}
                    </span>
                  ))}
                </div>
              );
            })()}

            {/* Tentative start date for upcoming projects */}
            {proj.status === "upcoming" && (
              <div style={{ marginTop: space[4], display: "flex", alignItems: "center", gap: space[3] }}>
                <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim }}>Tentative Start</span>
                {can.editProject(projRole) ? (
                  <input type="date" value={proj.tentativeStartDate || ""}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const oldDate = proj.tentativeStartDate || "";
                      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, tentativeStartDate: newDate || null } : p));
                      updateProjectInDB(proj.id, { tentativeStartDate: newDate || null });
                      recordAction("project_start_date_moved", { from: oldDate, to: newDate }, `Start date moved to ${newDate || "none"}`);
                    }}
                    style={{
                      height: 32, padding: `0 ${space[2]}px`, borderRadius: layout.radiusXs,
                      border: `1px solid ${c.border}`, background: c.surfaceSolid, color: c.text,
                      fontFamily: typo.monoSm.font, fontSize: 12,
                    }}
                  />
                ) : (
                  <span style={{ fontFamily: typo.monoSm.font, fontSize: 12, color: c.text }}>
                    {proj.tentativeStartDate ? fmtDate(proj.tentativeStartDate) : "—"}
                  </span>
                )}
              </div>
            )}


          </div>
        ) : (
          <div key="edit" data-suppress-shortcuts style={{
            display: "flex", flexDirection: "column", gap: space[3], position: "relative", zIndex: 60,
            animation: `fadeIn ${motion.fast.duration} ${motion.fast.easing} both`,
          }}>
            <div>
              <Label style={{ marginBottom: space[1] }}>Name</Label>
              <Inp ref={nameInpRef} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project name" style={{ width: "100%" }} maxLength={100} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
              <div style={{ position: "relative", zIndex: 6 }}>
                <Label style={{ marginBottom: space[1] }}>Owner</Label>
                <SearchSelect value={editOwner} onChange={setEditOwner} options={allOwners} placeholder="Search people..." />
              </div>
              <div style={{ position: "relative", zIndex: 5 }}>
                <Label style={{ marginBottom: space[1] }}>Squad</Label>
                <SearchSelect value={editSquad} onChange={setEditSquad} options={allSquads} placeholder="Search squads..." />
              </div>
            </div>
            <div>
              <Label style={{ marginBottom: space[1] }}>Complexity</Label>
              <Sel value={editComplexity} onChange={e => setEditComplexity(e.target.value)} style={{ width: "100%" }}>
                <option value="">Not set</option>
                <option value="S">Low</option>
                <option value="M">Medium</option>
                <option value="L">High</option>
                <option value="XL">Very High</option>
              </Sel>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
              <div>
                <Label style={{ marginBottom: space[1] }}>Start date</Label>
                <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} style={{
                  width: "100%", height: 40, padding: `0 ${space[3]}px`,
                  borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                  background: c.surfaceAlt, color: c.text,
                  fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                  outline: "none", boxSizing: "border-box",
                }} />
              </div>
              <div>
                <Label style={{ marginBottom: space[1] }}>End date</Label>
                <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={{
                  width: "100%", height: 40, padding: `0 ${space[3]}px`,
                  borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                  background: c.surfaceAlt, color: c.text,
                  fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                  outline: "none", boxSizing: "border-box",
                }} />
              </div>
            </div>
            {dateError && (
              <div role="alert" style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 600, color: c.red, display: "flex", alignItems: "center", gap: space[2], padding: `${space[2]}px ${space[3]}px`, background: c.redDim, border: `1px solid ${c.redBorder}`, borderRadius: layout.radiusSm }}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {dateError}
              </div>
            )}
            {shipPhases.includes(editPhase) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
                <div>
                  <Label style={{ marginBottom: space[1] }}>Actual start (optional)</Label>
                  <input type="date" value={editActualStart} onChange={e => setEditActualStart(e.target.value)} style={{
                    width: "100%", height: 40, padding: `0 ${space[3]}px`,
                    borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                    background: c.surfaceAlt, color: c.text,
                    fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                    outline: "none", boxSizing: "border-box",
                  }} />
                </div>
                <div>
                  <Label style={{ marginBottom: space[1] }}>Actual end (optional)</Label>
                  <input type="date" value={editActualEnd} onChange={e => setEditActualEnd(e.target.value)} style={{
                    width: "100%", height: 40, padding: `0 ${space[3]}px`,
                    borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                    background: c.surfaceAlt, color: c.text,
                    fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                    outline: "none", boxSizing: "border-box",
                  }} />
                </div>
              </div>
            )}
            {/* Per-project phase threshold overrides */}
            {(() => {
              const existingCount = Object.keys(proj.phaseDurationOverrides || {}).length;
              const updateOverride = (phase, val) => {
                const v = val === "" ? undefined : parseInt(val, 10);
                setEditPhaseOverrides(prev => {
                  const next = { ...prev };
                  if (v === undefined || isNaN(v)) delete next[phase];
                  else next[phase] = v;
                  return next;
                });
              };
              return (
                <div style={{ marginTop: space[2] }}>
                  <button className="flow-btn" onClick={() => setShowOverrides(!showOverrides)} style={{
                    padding: `${space[1]}px ${space[2]}px`, borderRadius: layout.radiusXs,
                    border: `1px solid ${c.border}`, background: "transparent",
                    color: c.textMid, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Phase thresholds
                    {existingCount > 0 && <span style={{ color: c.accent, fontFamily: typo.monoSm.font }}>{existingCount}</span>}
                  </button>
                  {showOverrides && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: space[2], marginTop: space[2] }}>
                      {["PRD", "Design", "Dev", "QA"].map(phase => {
                        const complexityDefault = getPhaseThreshold(editComplexity || proj.complexity, phase);
                        return (
                          <div key={phase} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Label style={{ fontSize: 10 }}>{phase}</Label>
                            <input type="number" min="0" max="365"
                              value={editPhaseOverrides[phase] ?? ""}
                              placeholder={complexityDefault != null ? String(complexityDefault) : "—"}
                              onChange={e => updateOverride(phase, e.target.value)}
                              style={{
                                width: "100%", height: 32, padding: `0 ${space[2]}px`,
                                borderRadius: layout.radiusXs, border: `1px solid ${c.border}`,
                                background: c.surfaceAlt, color: c.text,
                                fontFamily: typo.monoSm.font, fontSize: 12,
                                textAlign: "center", outline: "none", boxSizing: "border-box",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: space[2], marginTop: space[2] }}>
              <div style={{ display: "flex", gap: space[2] }}>
                <Btn variant="command" size="sm" onClick={saveEdits} disabled={!canSaveEdits} style={{ borderColor: canSaveEdits ? c.greenBorder : c.border, color: canSaveEdits ? c.green : c.textDim, opacity: canSaveEdits ? 1 : 0.6, cursor: canSaveEdits ? "pointer" : "not-allowed" }}>Save</Btn>
                <Btn variant="secondary" size="sm" onClick={cancelEdits}>Cancel</Btn>
              </div>
              <Btn variant="secondary" size="sm" onClick={handleDeleteClick} style={{ borderColor: c.redBorder, color: c.red }}>Delete project</Btn>
            </div>
          </div>
        )}

        {/* ═══ RESOURCES — pill-format links subsection inside header card ═══ */}
        {(() => {
          const links = (projectLinks || []).filter(l => l.project_id === proj.id);
          const adding = resAdding, setAdding = setResAdding;
          const newType = resNewType, setNewType = setResNewType;
          const newLabel = resNewLabel, setNewLabel = setResNewLabel;
          const newUrl = resNewUrl, setNewUrl = setResNewUrl;
          const typeIcons = { prd: "📄", figma: "🎨", qa_testcases: "✅", gchat: "💬", jira: "🎫", custom: "🔗" };
          const typeLabels = { prd: "PRD", figma: "Figma", qa_testcases: "QA", gchat: "GChat Space", jira: "Jira Board", custom: "Custom" };
          const addLink = async () => {
            if (!newUrl.trim()) return;
            const result = await addProjectLinkToDB(proj.id, newType, newType === "custom" ? newLabel : null, newUrl.trim());
            if (result.ok && result.row && setProjectLinks) {
              setProjectLinks(prev => [...prev, result.row]);
            }
            const label = newType === "custom" && newLabel ? newLabel : typeLabels[newType] || newType;
            recordAction("resource_added", { type: newType, label, url: newUrl.trim() }, `${label} resource added`);
            setNewType("prd"); setNewLabel(""); setNewUrl(""); setAdding(false);
          };
          const removeLink = async (linkId) => {
            const link = links.find(l => l.id === linkId);
            const result = await deleteProjectLinkFromDB(linkId);
            if (result.ok && setProjectLinks) {
              setProjectLinks(prev => prev.filter(l => l.id !== linkId));
            }
            recordAction("resource_removed", { type: link?.type }, "Resource removed");
          };
          if (editing) return null;
          return (
            <div style={{ marginTop: space[4], paddingTop: space[3], borderTop: `1px solid ${c.border}` }}>
              <span style={{
                fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim,
                display: "block", marginBottom: space[2],
              }}>Resources</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], alignItems: "center" }}>
                {links.map(link => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: `6px 12px 6px 8px`, borderRadius: 12,
                      background: c.surfaceAlt, border: `1px solid ${c.border}`,
                      textDecoration: "none", cursor: "pointer",
                      transition: "border-color 120ms ease",
                      position: "relative",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.textMid; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{typeIcons[link.type] || "🔗"}</span>
                    <span style={{ fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: "nowrap" }}>
                      {link.label || typeLabels[link.type] || link.type}
                    </span>
                    {can.addResources(projRole) && <button onClick={e => { e.preventDefault(); e.stopPropagation(); removeLink(link.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: c.textGhost, padding: 0, fontSize: 11, lineHeight: 1, marginLeft: 2 }}
                      title="Remove"
                    >✕</button>}
                  </a>
                ))}
                {!adding && can.addResources(projRole) && (
                  <button onClick={() => setAdding(true)} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: `6px 12px`, borderRadius: 12,
                    background: "transparent", border: `1px dashed ${c.border}`,
                    cursor: "pointer", color: c.textDim,
                    fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
                    transition: "border-color 120ms ease, color 120ms ease",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textDim; }}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Add link
                  </button>
                )}
              </div>
              {adding && (
                <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[2], flexWrap: "wrap" }}>
                  {/* Custom styled type selector */}
                  {(() => {
                    const TYPE_OPTIONS = [
                      { value: "prd", label: "PRD", icon: "📄" },
                      { value: "figma", label: "Figma", icon: "🎨" },
                      { value: "qa_testcases", label: "QA Testcases", icon: "✅" },
                      { value: "gchat", label: "GChat Space", icon: "💬" },
                      { value: "jira", label: "Jira Board", icon: "🎫" },
                      { value: "custom", label: "Custom", icon: "🔗" },
                    ];
                    const selected = TYPE_OPTIONS.find(o => o.value === newType) || TYPE_OPTIONS[0];
                    return (
                      <div ref={resTypeDropRef} style={{ position: "relative" }}>
                        <button id="res-type-picker-btn" type="button" onClick={() => setResTypeDropOpen(o => !o)} style={{
                          height: 32, padding: `0 ${space[2]}px 0 ${space[2]}px`,
                          borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                          background: c.surfaceSolid, color: c.text, cursor: "pointer",
                          fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 6, minWidth: 140,
                          transition: `border-color ${motion.fast.duration} ${motion.fast.easing}`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = c.textMid; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; }}
                        >
                          <span style={{ fontSize: 13, lineHeight: 1 }}>{selected.icon}</span>
                          <span style={{ flex: 1, textAlign: "left" }}>{selected.label}</span>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={c.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ flexShrink: 0, transform: resTypeDropOpen ? "rotate(180deg)" : "rotate(0deg)", transition: `transform ${motion.fast.duration} ${motion.fast.easing}` }}>
                            <polyline points="4 6 8 10 12 6" />
                          </svg>
                        </button>
                        {resTypeDropOpen && createPortal(
                          <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 99999 }} onClick={() => setResTypeDropOpen(false)} />
                            <div style={{
                              position: "fixed", zIndex: 100000,
                              top: (() => { const btn = document.getElementById("res-type-picker-btn"); return btn ? btn.getBoundingClientRect().bottom + 4 : 0; })(),
                              left: (() => { const btn = document.getElementById("res-type-picker-btn"); return btn ? btn.getBoundingClientRect().left : 0; })(),
                              minWidth: 170, background: c.surfaceSolid, border: `1px solid ${c.border}`,
                              borderRadius: layout.radiusMd, boxShadow: c.shadowFloat,
                              padding: `${space[1]}px 0`, overflow: "hidden",
                            }}>
                              {TYPE_OPTIONS.map(opt => (
                                <button key={opt.value} type="button" onClick={() => { setNewType(opt.value); setResTypeDropOpen(false); }} style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: `${space[2]}px ${space[3]}px`, border: "none",
                                  background: opt.value === newType ? c.accentDim : "transparent",
                                  color: opt.value === newType ? c.accent : c.text, cursor: "pointer",
                                  fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 500,
                                  textAlign: "left",
                                  transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                                }}
                                onMouseEnter={e => { if (opt.value !== newType) e.currentTarget.style.background = c.surfaceAlt; }}
                                onMouseLeave={e => { if (opt.value !== newType) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <span style={{ fontSize: 13, lineHeight: 1, width: 18, textAlign: "center" }}>{opt.icon}</span>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    );
                  })()}
                  {newType === "custom" && <Inp value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label" style={{ width: 120, height: 32 }} />}
                  <Inp value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="URL" style={{ flex: 1, minWidth: 200, height: 32 }} />
                  <Btn variant="command" size="sm" onClick={addLink} disabled={!newUrl.trim()}>Add</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setNewUrl(""); setNewLabel(""); }}>Cancel</Btn>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ DEPENDENCIES — pill-format links subsection inside header card ═══ */}
        {proj.dependencies && proj.dependencies.length > 0 && !editing && (
          <div style={{ marginTop: space[4], paddingTop: space[3], borderTop: `1px solid ${c.border}` }}>
            <span style={{
              fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim,
              display: "block", marginBottom: space[2],
            }}>Dependencies</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], alignItems: "center" }}>
              {proj.dependencies.map(depId => {
                const dp = projects.find(p => p.id === depId);
                if (!dp) return null;
                const depPhaseColor = getPhaseColors()[dp.phase] || c.textDim;
                return (
                  <button
                    key={depId}
                    onClick={() => { if (onNavigate) onNavigate("projects", depId); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: `6px 12px 6px 8px`, borderRadius: 12,
                      background: c.surfaceAlt, border: `1px solid ${c.border}`,
                      cursor: "pointer", textDecoration: "none",
                      transition: "border-color 120ms ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.textMid; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; }}
                  >
                    <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.amber }}>{depId}</span>
                    <span style={{ fontFamily: typo.bodySm.font, fontSize: 13, fontWeight: 600, color: c.text }}>{dp.name}</span>
                    <span style={{
                      fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600,
                      padding: "2px 6px", borderRadius: layout.radiusXs,
                      background: `${depPhaseColor}18`, color: depPhaseColor,
                    }}>{dp.phase || "—"}</span>
                    {dp.isBlocked && <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: c.red }}>BLOCKED</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ TEAM — inline inside header card ═══ */}
        {!editing && (
          <div style={{ marginTop: space[4], paddingTop: space[3], borderTop: `1px solid ${c.border}` }}>
            <span style={{
              fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim,
              display: "block", marginBottom: space[2],
            }}>Team</span>
            <ProjectActivity
              project={proj}
              people={people}
              currentPerson={personProfile}
              isAppOwner={isAdmin}
              onPersonNavigate={(name) => onNavigate && onNavigate("people", name)}
              membersOnly
              membersInline
              canManageMembers={can.addMembers(projRole)}
              canRemoveMembers={can.removeMembers(projRole)}
            />
          </div>
        )}
      </div>

      {/* Team section moved into hero card below */}

      {/* ═══ SHOUTOUTS — displayed for shipped projects ═══ */}
      {proj.status === "shipped" && shoutouts.length > 0 && (
          <div>
            <SectionHead title="Shoutouts" />
            <div style={{ display: "flex", flexDirection: "column", gap: space[1] }}>
              {shoutouts.map(s => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: space[3],
                  padding: `${space[2] + 2}px ${space[3]}px`,
                  borderRadius: layout.radiusSm,
                  background: c.surfaceAlt, border: `1px solid ${c.border}`,
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>👏</span>
                  <div style={{ flex: 1, fontFamily: typo.bodyMd.font, fontSize: 13, color: c.text }}>
                    <span style={{ fontWeight: 600 }}>{s.details?.from || s.user_name || "Someone"}</span>
                    {" gave a shoutout!"}
                  </div>
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: 11, color: c.textDim, flexShrink: 0,
                  }}>{(() => {
                    const d = new Date(s.created_at);
                    const diff = Date.now() - d.getTime();
                    if (diff < 60000) return "just now";
                    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                    return `${Math.floor(diff / 86400000)}d ago`;
                  })()}</span>
                </div>
              ))}
            </div>
          </div>
      )}

      {/* ═══ FEEDBACK — shipped projects ═══ */}
      {proj.status === "shipped" && (
        <div ref={feedbackSectionRef}>
          <SectionHead title="Feedback" />
          <div style={{
            padding: `${space[4]}px`,
            borderRadius: layout.radiusSm,
            background: c.surface, border: `1px solid ${c.border}`,
          }}>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Share your feedback on this shipped project..."
              rows={3}
              style={{
                width: "100%", padding: `${space[3]}px`,
                borderRadius: layout.radiusSm,
                border: `1px solid ${c.border}`, background: c.surfaceAlt,
                color: c.text, fontFamily: typo.bodyMd.font, fontSize: 13,
                resize: "vertical", outline: "none", boxSizing: "border-box",
                lineHeight: 1.5,
              }}
              onFocus={e => e.currentTarget.style.borderColor = c.accent}
              onBlur={e => e.currentTarget.style.borderColor = c.border}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: space[2] }}>
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <input ref={feedbackFileRef} type="file" style={{ display: "none" }} onChange={e => {
                  const f = e.target.files?.[0];
                  setFeedbackFileName(f ? f.name : "");
                }} />
                <button type="button" onClick={() => feedbackFileRef.current?.click()} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: `4px 10px`, borderRadius: layout.radiusXs,
                  background: "transparent", border: `1px solid ${c.border}`,
                  color: c.textMid, fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  Attach file
                </button>
                {feedbackFileName && (
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: 11, color: c.textMid,
                    maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{feedbackFileName}
                    <button type="button" onClick={() => { setFeedbackFileName(""); if (feedbackFileRef.current) feedbackFileRef.current.value = ""; }} style={{
                      background: "transparent", border: "none", color: c.textDim, cursor: "pointer",
                      fontFamily: typo.monoSm.font, fontSize: 11, padding: "0 4px",
                    }}>✕</button>
                  </span>
                )}
              </div>
              <button type="button" disabled={!feedbackText.trim() || feedbackSubmitting}
                onClick={() => {
                  if (!feedbackText.trim()) return;
                  setFeedbackSubmitting(true);
                  if (isDevSeedMode()) {
                    devStore.addComment(proj.id, "viewer", feedbackText.trim());
                    const viewerName = personProfile?.name || "AJ";
                    devStore.logEvent({
                      projectId: proj.id, action: "feedback",
                      userName: viewerName,
                      details: { from: viewerName, projectName: proj.name, comment: feedbackText.trim(), attachment: feedbackFileName || null },
                    });
                  }
                  window.__flowToast?.("Feedback submitted!");
                  setFeedbackText(""); setFeedbackFileName("");
                  if (feedbackFileRef.current) feedbackFileRef.current.value = "";
                  setFeedbackSubmitting(false);
                }}
                style={{
                  padding: `6px 16px`, borderRadius: layout.radiusSm,
                  background: feedbackText.trim() && !feedbackSubmitting ? c.accent : c.surfaceAlt,
                  color: feedbackText.trim() && !feedbackSubmitting ? "#fff" : c.textDim,
                  border: "none", fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
                  cursor: feedbackText.trim() && !feedbackSubmitting ? "pointer" : "not-allowed",
                  transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                }}
              >Submit feedback</button>
            </div>

            {/* Previous feedback */}
            {feedbackEvents.length > 0 && (
                <div style={{ marginTop: space[3], paddingTop: space[3], borderTop: `1px solid ${c.border}` }}>
                  {feedbackEvents.map(fb => (
                    <div key={fb.id} style={{
                      display: "flex", alignItems: "flex-start", gap: space[3],
                      padding: `${space[2]}px 0`,
                      borderBottom: `1px solid ${c.border}`,
                    }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: c.cyanDim || c.surfaceAlt,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: c.cyan, flexShrink: 0,
                        fontFamily: typo.monoSm.font,
                      }}>{(fb.details?.from || fb.user_name || "?")[0]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: typo.bodyMd.font, fontSize: 13, color: c.text }}>
                          <span style={{ fontWeight: 600 }}>{fb.details?.from || fb.user_name || "Someone"}</span>
                          <span style={{ color: c.textDim, fontSize: 11, marginLeft: space[2] }}>
                            {(() => {
                              const d = new Date(fb.created_at);
                              const diff = Date.now() - d.getTime();
                              if (diff < 60000) return "just now";
                              if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                              if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                              return `${Math.floor(diff / 86400000)}d ago`;
                            })()}
                          </span>
                        </div>
                        <div style={{ fontFamily: typo.bodyMd.font, fontSize: 13, color: c.textMid, lineHeight: 1.5, marginTop: 2 }}>
                          {fb.details?.comment}
                        </div>
                        {fb.details?.attachment && (
                          <div style={{
                            marginTop: space[1], fontFamily: typo.monoSm.font, fontSize: 11, color: c.accent,
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                            {fb.details.attachment}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TIMELINE — TrackGantt then alerts below ═══ */}
      {proj.status !== "upcoming" && <div data-tour="track-gantt">
        <SectionHead title="Timeline" right={can.manageTracks(projRole) ? (
          <button type="button" onClick={openMissedModal} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: `4px ${space[2]}px`, borderRadius: layout.radiusSm,
            border: `1px solid ${c.border}`, background: c.surfaceAlt,
            color: c.textMid, cursor: "pointer",
            fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
          }}>⤺ Log missed transition</button>
        ) : null} />

        {/* ── Track Gantt (parallel tracks) ── */}
        <TrackGantt
          proj={proj}
          canManage={can.manageTracks(projRole)}
          onStartTrack={(trackName) => {
            if (trackName === "Alpha" || trackName === "Beta") {
              setShipNote(proj.shipNote || "");
              setShipPct(proj.shipPct != null ? String(proj.shipPct) : "");
              setShipPhaseModal({ phase: trackName, from: proj.phase, isTrackStart: true });
              return;
            }
            startTrackInDB(proj.id, trackName, projects);
            setProjects(prev => prev.map(p => {
              if (p.id !== proj.id) return p;
              const updated = { ...p, tracks: { ...p.tracks } };
              if (!updated.tracks[trackName]) updated.tracks[trackName] = { periods: [], owner: null };
              updated.tracks[trackName] = { ...updated.tracks[trackName], periods: [...updated.tracks[trackName].periods, { started_at: new Date().toISOString(), completed_at: null }] };
              updated.phase = derivePrimaryPhase(updated);
              if (updated.status === "upcoming") updated.status = "in_flight";
              return updated;
            }));
            window.__flowToast?.(`${trackName} track started`);
          }}
          onCompleteTrack={(trackName) => {
            completeTrackInDB(proj.id, trackName, projects);
            setProjects(prev => prev.map(p => {
              if (p.id !== proj.id) return p;
              const updated = { ...p, tracks: { ...p.tracks } };
              if (updated.tracks[trackName]) {
                const periods = [...updated.tracks[trackName].periods];
                const last = periods[periods.length - 1];
                if (last && last.completed_at === null) periods[periods.length - 1] = { ...last, completed_at: new Date().toISOString() };
                updated.tracks[trackName] = { ...updated.tracks[trackName], periods };
              }
              updated.phase = derivePrimaryPhase(updated);
              return updated;
            }));
            window.__flowToast?.(`${trackName} track completed`);
          }}
          onReopenTrack={(trackName) => {
            setTrackReopenTarget(trackName);
            setTrackReopenReason("");
            setTrackReopenModal(true);
          }}
        />

        {/* ── Track overstay + overdue alerts (below timeline) ── */}
        {(() => {
          const projOverrides = proj.phaseDurationOverrides || {};
          const alerts = [];

          if (phaseTransitions.length > 0) {
            for (let i = 0; i < phaseTransitions.length; i++) {
              const seg = phaseTransitions[i];
              const nextAt = i < phaseTransitions.length - 1
                ? phaseTransitions[i + 1].at
                : new Date().toISOString();
              const days = Math.round(
                (new Date(nextAt) - new Date(seg.at)) / 86400000
              );
              const threshold = projOverrides[seg.phase] ?? getPhaseThreshold(proj.complexity, seg.phase);
              if (threshold && days > threshold) {
                const isCurrentPhase = i === phaseTransitions.length - 1;
                alerts.push({
                  type: "overstay",
                  message: isCurrentPhase
                    ? `${seg.phase} phase has gone beyond the ${threshold}-day threshold (${days}d). Needs attention!`
                    : `${seg.phase} phase took ${days}d — more than the ${threshold}-day standard threshold.`,
                });
              }
            }
          }

          const inShipPhase = proj.status === "shipped";
          if (proj.endDate && !inShipPhase) {
            const overdueDays = Math.round(
              (new Date(today + "T00:00:00") - new Date(proj.endDate + "T00:00:00")) / 86400000
            );
            if (overdueDays > 0) {
              alerts.push({
                type: "overdue",
                message: `The project is overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}. Take action!`,
              });
            }
          }

          if (alerts.length === 0) return null;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: space[2],
                    padding: `${space[2]}px ${space[3]}px`,
                    borderRadius: layout.radiusSm,
                    background: a.type === "overdue" ? c.redDim : c.amberDim,
                    border: `1px solid ${a.type === "overdue" ? c.red : c.amber}25`,
                    fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                    color: a.type === "overdue" ? c.red : c.amber,
                    fontWeight: 600, lineHeight: 1.45,
                  }}
                >
                  <span style={{ flexShrink: 0, fontSize: 13, lineHeight: 1.3 }}>⚠️</span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>}

      {/* ═══ ACTIVITY — composer + comments + auto-events ═══ */}
      <div data-tour="activity">
        <SectionHead title="Activity" />
        <ProjectActivity
          project={proj}
          people={people}
          currentPerson={personProfile}
          isAppOwner={isAdmin}
          onPersonNavigate={(name) => onNavigate && onNavigate("people", name)}
          hideMembers
        />
      </div>

      {/* ═══ Edit Project pill — matches "Add project" style. Permission-gated. ═══ */}
      {!editing && can.editProject(projRole) && (() => {
        if (typeof document === "undefined") return null;
        return createPortal(
          <button
            type="button"
            className="flow-btn"
            onClick={enterEdit}
            aria-label="Edit project"
            title="Edit project (E)"
            style={{
              position: "fixed", right: space[7], bottom: space[7], zIndex: 40,
              height: 40, padding: `0 ${space[5]}px`, borderRadius: layout.radiusSm,
              background: c.accent, color: c.textOnAccent, border: "none",
              fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 600,
              boxShadow: c.shadowFloat,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: space[2],
              transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = c.accentHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = c.accent; }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit project
          </button>,
          document.body
        );
      })()}


      {/* FAB removed — edit is now the pencil icon in the header; delete lives in the edit panel. */}

      {/* ═══ LOG MISSED TRANSITION — backdated PRD → Dev style entry ═══ */}
      <Modal open={missedModal} onClose={() => setMissedModal(false)} title="Log missed transition" accent={c.amber}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodySm.size, color: c.textMid, lineHeight: 1.5, marginBottom: space[4] }}>
          Record a phase transition that wasn't logged on time. It'll appear in the timeline at the date you choose, marked <strong style={{ color: c.amber }}>backdated</strong>.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div style={{ display: "flex", gap: space[3] }}>
            <div style={{ flex: 1 }}>
              <Label style={{ marginBottom: space[1] }}>Phase from <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></Label>
              <Sel value={missedFrom} onChange={e => setMissedFrom(e.target.value)} style={{ width: "100%" }}>
                <option value="">— none —</option>
                {trackNames.map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
            </div>
            <div style={{ flex: 1 }}>
              <Label style={{ marginBottom: space[1] }}>Phase to</Label>
              <Sel value={missedTo} onChange={e => setMissedTo(e.target.value)} style={{ width: "100%" }}>
                <option value="">— select —</option>
                {trackNames.filter(t => t !== missedFrom).map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{ display: "flex", gap: space[3] }}>
            <div style={{ flex: 1 }}>
              <Label style={{ marginBottom: space[1] }}>Date</Label>
              <Inp type="date" value={missedDate} max={today} onChange={e => setMissedDate(e.target.value)} style={{ width: "100%", colorScheme: "light" }} />
            </div>
            <div style={{ flex: 1 }}>
              <Label style={{ marginBottom: space[1] }}>Time</Label>
              <Inp type="time" value={missedTime} onChange={e => setMissedTime(e.target.value)} style={{ width: "100%", colorScheme: "light" }} />
            </div>
          </div>
          <div>
            <Label style={{ marginBottom: space[1] }}>Reason for backdating <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></Label>
            <textarea
              value={missedReason}
              onChange={e => setMissedReason(e.target.value)}
              placeholder="e.g. Forgot to log when Dev actually started"
              rows={2}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                background: c.surfaceAlt, color: c.text, resize: "vertical",
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end", marginTop: space[1] }}>
            <Btn variant="ghost" size="sm" onClick={() => setMissedModal(false)}>Cancel</Btn>
            <Btn variant="command" size="sm" disabled={!missedTo} style={{ borderColor: c.amberBorder, color: c.amber }} onClick={saveMissedTransition}>Save transition</Btn>
          </div>
        </div>
      </Modal>

      {/* ═══ ADD TRACK — start a phase (start date defaults to today, optional end) ═══ */}
      <Modal open={addTrackModal} onClose={() => setAddTrackModal(false)} title="Add track" accent={c.accent}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodySm.size, color: c.textMid, lineHeight: 1.5, marginBottom: space[4] }}>
          Start a track. The start date defaults to today — edit it to log when work actually began. Leave the end date blank for an ongoing track.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div>
            <Label style={{ marginBottom: space[1] }}>Phase</Label>
            <Sel value={addTrackPhase} onChange={e => setAddTrackPhase(e.target.value)} style={{ width: "100%" }}>
              <option value="">— select —</option>
              {trackNames.map(t => <option key={t} value={t}>{t}</option>)}
            </Sel>
          </div>
          <div style={{ display: "flex", gap: space[3] }}>
            <div style={{ flex: 1 }}>
              <Label style={{ marginBottom: space[1] }}>Start date</Label>
              <Inp type="date" value={addTrackStart} max={today} onChange={e => setAddTrackStart(e.target.value)} style={{ width: "100%", colorScheme: "light" }} />
            </div>
            <div style={{ flex: 1 }}>
              <Label style={{ marginBottom: space[1] }}>End date <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></Label>
              <Inp type="date" value={addTrackEnd} min={addTrackStart} max={today} onChange={e => setAddTrackEnd(e.target.value)} style={{ width: "100%", colorScheme: "light" }} />
            </div>
          </div>
          <div>
            <Label style={{ marginBottom: space[1] }}>Notes <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></Label>
            <textarea
              value={addTrackNote}
              onChange={e => setAddTrackNote(e.target.value)}
              placeholder={`What's going into ${addTrackPhase || "this track"}?`}
              rows={2}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                background: c.surfaceAlt, color: c.text, resize: "vertical",
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end", marginTop: space[1] }}>
            <Btn variant="ghost" size="sm" onClick={() => setAddTrackModal(false)}>Cancel</Btn>
            <Btn variant="command" size="sm" disabled={!addTrackPhase} onClick={saveAddTrack}>Add track</Btn>
          </div>
        </div>
      </Modal>

      {/* ═══ START NOW MODAL — pick tracks to begin ═══ */}
      <Modal open={startNowModal} onClose={() => { setStartNowModal(false); setStartNowEndDate(""); }} title="Start this project" accent={c.accent}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, lineHeight: 1.6, marginBottom: space[4] }}>
          Select tracks to start for <strong style={{ color: c.text }}>{proj.name}</strong>. The start date will be set to today.
        </div>
        <div style={{ display: "flex", gap: space[2], flexWrap: "wrap", marginBottom: space[4] }}>
          {trackNames.map(t => {
            const sel = startNowTracks.includes(t);
            const phColor = pc[t] || c.textDim;
            return (
              <button key={t} type="button" onClick={() => setStartNowTracks(prev => sel ? prev.filter(x => x !== t) : [...prev, t])} style={{
                padding: `8px 16px`, borderRadius: layout.radiusSm,
                background: sel ? phColor + "18" : c.surfaceAlt,
                border: `1.5px solid ${sel ? phColor : c.border}`,
                color: sel ? phColor : c.textMid,
                fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
                letterSpacing: "0.04em", cursor: "pointer",
                transition: `all ${motion.fast.duration} ${motion.fast.easing}`,
              }}>{t}</button>
            );
          })}
        </div>
        {/* Tentative end date */}
        <div style={{ marginBottom: space[5] }}>
          <label style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.textMid, letterSpacing: "0.03em", display: "block", marginBottom: 6 }}>
            TENTATIVE END DATE
          </label>
          <input
            type="date"
            value={startNowEndDate}
            onChange={e => setStartNowEndDate(e.target.value)}
            min={today}
            style={{
              width: "100%", boxSizing: "border-box", height: 40,
              borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
              background: c.surfaceSolid, fontFamily: typo.bodyMd.font, fontSize: 14,
              color: startNowEndDate ? c.text : c.textDim,
              padding: `0 ${space[3]}px`, outline: "none",
              colorScheme: "light",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" onClick={() => { setStartNowModal(false); setStartNowEndDate(""); }}>Cancel</Btn>
          <Btn variant="primary" size="sm" disabled={startNowTracks.length === 0} onClick={() => {
            const todayStr = today;
            const now = new Date().toISOString();
            const newTracks = {};
            for (const t of startNowTracks) {
              newTracks[t] = { periods: [{ started_at: now, completed_at: null }], owner: null };
            }
            const primaryPhase = startNowTracks[startNowTracks.length - 1];
            const endDateVal = startNowEndDate || null;
            setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, status: "in_flight", phase: primaryPhase, tracks: newTracks, startDate: todayStr, tentativeStartDate: null, endDate: endDateVal } : p));
            updateProjectInDB(proj.id, { status: "in_flight", phase: primaryPhase, startDate: todayStr, tentativeStartDate: null, endDate: endDateVal });
            if (isDevSeedMode()) {
              const raw = projects.find(p => p.id === proj.id);
              if (raw) { raw.tracks = newTracks; raw.status = "in_flight"; raw.phase = primaryPhase; raw.startDate = todayStr; raw.endDate = endDateVal; devStore.persistProjects(projects); }
              for (const t of startNowTracks) {
                devStore.logEvent({ projectId: proj.id, action: "track_started", details: { track: t } });
              }
            }
            recordAction("project_started", { tracks: startNowTracks }, `Project started with ${startNowTracks.join(", ")}`);
            setStartNowModal(false);
            setStartNowEndDate("");
          }}>Start Project</Btn>
        </div>
      </Modal>

      {/* ═══ DEPRIORITIZATION REASON MODAL ═══ */}
      <Modal open={!!depriReasonModal} onClose={() => setDepriReasonModal(false)} title="Why is this being deprioritized?" accent={c.amber}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 400, color: c.textMid, lineHeight: 1.6, marginBottom: space[3] }}>
          Provide context so your team understands why <strong style={{ color: c.text }}>{proj.name}</strong> is being deprioritized.
        </div>
        <div style={{ marginBottom: space[3] }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: space[1] }}>
            <TelemetryLabel color={c.amber}>Reason</TelemetryLabel>
            <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: c.textDim, fontVariantNumeric: "tabular-nums" }}>
              {depriReasonText.length}/200
            </span>
          </div>
          <textarea
            data-autofocus
            value={depriReasonText}
            onChange={e => setDepriReasonText(e.target.value.slice(0, 200))}
            placeholder="e.g. Redirecting team to higher-priority work..."
            rows={3}
            maxLength={200}
            style={{
              width: "100%", padding: `${space[2]}px ${space[3]}px`,
              borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
              background: c.surfaceAlt, color: c.text, resize: "vertical",
              fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setDepriReasonModal(false)}>Cancel</Btn>
          <Btn variant="secondary" style={{ borderColor: c.amberBorder, color: c.amber }}
            disabled={!depriReasonText.trim()}
            onClick={() => {
              const overrides = { status: "deprioritized", depriReason: depriReasonText.trim() };
              setDepriReasonModal(false);
              recordAction("project_status_changed", { from: "active", to: "deprioritized", reason: depriReasonText.trim() }, "Project deprioritized");
              if (datesChanged && pastHistoryWeekCount > 0) {
                setPendingSave(overrides);
                setRetroDateModal(true);
              } else {
                doSave(overrides);
              }
            }}>
            Deprioritize
          </Btn>
        </div>
      </Modal>

      {/* ═══ BLOCKED REASON MODAL ═══ */}
      <Modal open={!!blockedReasonModal} onClose={() => setBlockedReasonModal(false)} title="Why is this project blocked?" accent={c.red}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, fontWeight: 400, color: c.textMid, lineHeight: 1.6, marginBottom: space[3] }}>
          Describe what's blocking <strong style={{ color: c.text }}>{proj.name}</strong> so your team knows what needs to be resolved.
        </div>
        <div style={{ marginBottom: space[3] }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: space[1] }}>
            <TelemetryLabel color={c.red}>Reason</TelemetryLabel>
            <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: c.textDim, fontVariantNumeric: "tabular-nums" }}>
              {blockedReasonText.length}/200
            </span>
          </div>
          <textarea
            data-autofocus
            value={blockedReasonText}
            onChange={e => setBlockedReasonText(e.target.value.slice(0, 200))}
            placeholder="e.g. Waiting on API access from partner team..."
            rows={3}
            maxLength={200}
            style={{
              width: "100%", padding: `${space[2]}px ${space[3]}px`,
              borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
              background: c.surfaceAlt, color: c.text, resize: "vertical",
              fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setBlockedReasonModal(false)}>Cancel</Btn>
          <Btn variant="secondary" style={{ borderColor: c.redBorder, color: c.red }}
            disabled={!blockedReasonText.trim()}
            onClick={() => {
              const now = new Date().toISOString();
              const changes = { isBlocked: true, blockedReason: blockedReasonText.trim(), blockedAt: now };
              setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, ...changes } : p));
              updateProjectInDB(proj.id, changes);
              recordAction("project_blocked", { reason: blockedReasonText.trim() }, "Project marked as blocked");
              setBlockedReasonModal(false);
            }}>
            Mark blocked
          </Btn>
        </div>
      </Modal>

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      <Modal open={deleteModal} onClose={() => {
        if (deleting) return;
        setDeleteModal(false);
      }} title="Delete project?" accent={c.red} width={420}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, lineHeight: 1.6, marginBottom: space[4] }}>
          Are you sure you want to delete <strong style={{ color: c.text }}>{proj.id} — {proj.name}</strong>? This action cannot be undone.
        </div>
        {depsError && (
          <div style={{
            padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
            background: c.redDim, border: `1px solid ${c.redBorder}`, marginBottom: space[4],
            fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.red,
          }}>
            {depsError}
          </div>
        )}
        <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" onClick={() => setDeleteModal(false)} disabled={deleting}>Cancel</Btn>
          <Btn variant="danger" size="sm"
            onClick={confirmDelete}
            disabled={deleting}>
            {deleting ? "Deleting..." : "Delete project"}
          </Btn>
        </div>
      </Modal>

      {/* ═══ RETROACTIVE DATE-CHANGE WARNING ═══ */}
      <Modal open={retroDateModal} onClose={() => { setRetroDateModal(false); setPendingSave(null); }} title="Change affects past weeks?" accent={c.amber}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, lineHeight: 1.6, marginBottom: space[3] }}>
          This project has <strong style={{ color: c.text }}>{pastHistoryWeekCount}</strong> {pastHistoryWeekCount === 1 ? "week" : "weeks"} of historical activity. Changing the plan dates will retroactively alter overdue and timeline calculations for those frozen weeks.
        </div>
        <div style={{
          padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          background: c.amberDim, border: `1px solid ${c.amberBorder}`, marginBottom: space[4],
          fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.amber, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: space[1] }}>
            {proj.startDate ? fmtShort(proj.startDate) : "—"} → {proj.endDate ? fmtShort(proj.endDate) : "—"}
            <span style={{ color: c.textDim, fontWeight: 500 }}> becomes </span>
            {editStart ? fmtShort(editStart) : "—"} → {editEnd ? fmtShort(editEnd) : "—"}
          </div>
          <div style={{ color: c.textMid }}>
            Commitment items and outcomes are unchanged. Only derived metrics shift.
          </div>
        </div>
        <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" onClick={() => { setRetroDateModal(false); setPendingSave(null); }}>Cancel</Btn>
          <Btn variant="secondary" size="sm" style={{ borderColor: c.amberBorder, color: c.amber }}
            onClick={() => { doSave(pendingSave || {}); setRetroDateModal(false); setPendingSave(null); }}>
            Save anyway
          </Btn>
        </div>
      </Modal>

      {/* ═══ REACTIVATE CONFIRMATION MODAL — clears depriReason ═══ */}
      <Modal open={reactivateModal} onClose={() => setReactivateModal(false)} title="Reactivate project?" accent={c.green}>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textMid, lineHeight: 1.6, marginBottom: space[3] }}>
          <strong style={{ color: c.text }}>{proj.id} — {proj.name}</strong> will move back to Active.
        </div>
        {proj.depriReason && (
          <div style={{
            padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
            background: c.surfaceAlt, border: `1px solid ${c.border}`, marginBottom: space[4],
          }}>
            <div style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 700, color: c.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: space[1] }}>
              Current reason (will be cleared)
            </div>
            <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid, lineHeight: 1.5 }}>
              {proj.depriReason}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
          <Btn variant="ghost" size="sm" onClick={() => setReactivateModal(false)}>Cancel</Btn>
          <Btn variant="command" size="sm"
            style={{ borderColor: c.greenBorder, color: c.green }}
            onClick={() => {
              setReactivateModal(false);
              if (datesChanged && pastHistoryWeekCount > 0) {
                setPendingSave({ depriReason: null });
                setRetroDateModal(true);
              } else {
                doSave({ depriReason: null });
              }
            }}>
            Reactivate
          </Btn>
        </div>
      </Modal>

      {/* ═══ ALPHA / BETA — note + optional rollout % ═══ */}
      <Modal open={!!shipPhaseModal && shipPhaseModal.phase !== "GA"} onClose={() => setShipPhaseModal(null)} title={`Start ${shipPhaseModal?.phase || ""} Track`} accent={c.green}>
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div>
            <Label style={{ marginBottom: space[1] }}>Note</Label>
            <textarea
              value={shipNote}
              onChange={e => setShipNote(e.target.value)}
              placeholder={`What's going into ${shipPhaseModal?.phase || "this phase"}?`}
              rows={3}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                background: c.surfaceAlt, color: c.text, resize: "vertical",
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <Label style={{ marginBottom: space[1] }}>Rollout % <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></Label>
            <Inp
              type="number" min="0" max="100"
              value={shipPct}
              onChange={e => setShipPct(e.target.value)}
              placeholder="e.g. 10"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
            <Btn variant="secondary" size="sm" onClick={() => setShipPhaseModal(null)}>Cancel</Btn>
            <Btn variant="command" size="sm" style={{ borderColor: c.greenBorder, color: c.green }} onClick={() => {
              const ph = shipPhaseModal.phase;
              const now = new Date().toISOString();
              if (shipPhaseModal.isTrackStart) {
                const noteVal = shipNote.trim() || null;
                const pctVal = shipPct ? Number(shipPct) : null;
                startTrackInDB(proj.id, ph, projects, { note: noteVal, rolloutPct: pctVal });
                setProjects(prev => prev.map(p => {
                  if (p.id !== proj.id) return p;
                  const updated = { ...p, tracks: { ...p.tracks }, lastActivityAt: now,
                    shipNote: noteVal, shipPct: pctVal };
                  if (!updated.tracks[ph]) updated.tracks[ph] = { periods: [], owner: null };
                  updated.tracks[ph] = { ...updated.tracks[ph], periods: [...updated.tracks[ph].periods, { started_at: now, completed_at: null }] };
                  updated.phase = derivePrimaryPhase(updated);
                  if (updated.status === "upcoming") updated.status = "in_flight";
                  return updated;
                }));
                window.__flowToast?.(`${ph} track started`);
              } else {
                const oldPhase = shipPhaseModal.from;
                setProjects(prev => prev.map(p => p.id === proj.id ? {
                  ...p, phase: ph, lastActivityAt: now,
                  shipNote: shipNote.trim() || null,
                  shipPct: shipPct ? Number(shipPct) : null,
                } : p));
                updateProjectInDB(proj.id, { phase: ph });
                recordAction("project_phase_changed", { from: oldPhase, to: ph, note: shipNote.trim() || null, rolloutPct: shipPct || null }, `Stage updated to ${ph}`);
              }
              setShipPhaseModal(null);
            }}>
              {`Start ${shipPhaseModal?.phase} Track`}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ═══ GA — release note + feature type + confetti ═══ */}
      <Modal open={!!shipPhaseModal && shipPhaseModal?.phase === "GA"} onClose={() => setShipPhaseModal(null)} title="Ship to GA 🚀" accent={c.green}>
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div>
            <Label style={{ marginBottom: space[1] }}>Release note</Label>
            <textarea
              value={gaReleaseNote}
              onChange={e => setGaReleaseNote(e.target.value)}
              placeholder="What shipped? Write a brief release note..."
              rows={3}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                background: c.surfaceAlt, color: c.text, resize: "vertical",
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <Label style={{ marginBottom: space[1] }}>Feature type</Label>
            <Sel value={gaFeatureType} onChange={e => setGaFeatureType(e.target.value)} style={{ width: "100%" }}>
              <option value="New">New Feature</option>
              <option value="Fix">Bug Fix</option>
              <option value="Enhancement">Enhancement</option>
              <option value="UI/UX">UI/UX Improvement</option>
            </Sel>
          </div>
          <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
            <Btn variant="secondary" size="sm" onClick={() => setShipPhaseModal(null)}>Cancel</Btn>
            <Btn variant="command" size="sm" style={{ borderColor: c.greenBorder, color: c.green }} onClick={() => {
              const oldPhase = shipPhaseModal.from;
              const now = new Date().toISOString();
              setProjects(prev => prev.map(p => p.id === proj.id ? {
                ...p, phase: "GA", lastActivityAt: now,
                gaEnteredAt: now.split("T")[0],
                gaReleaseNote: gaReleaseNote.trim() || null,
                gaFeatureType: gaFeatureType,
              } : p));
              updateProjectInDB(proj.id, { phase: "GA" });
              recordAction("project_phase_changed", {
                from: oldPhase, to: "GA",
                releaseNote: gaReleaseNote.trim() || null,
                featureType: gaFeatureType,
              }, `🚀 ${proj.name} shipped to GA!`);
              setShipPhaseModal(null);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 4000);
            }}>
              Ship it!
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ═══ REOPEN TRACK — reason modal ═══ */}
      <Modal open={trackReopenModal} onClose={() => setTrackReopenModal(false)} title={`Reopen ${trackReopenTarget || ""} track`} accent={c.amber}>
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div>
            <Label style={{ marginBottom: space[1] }}>Why is this track being reopened?</Label>
            <textarea
              value={trackReopenReason}
              onChange={e => setTrackReopenReason(e.target.value)}
              placeholder="e.g. QA found regressions, scope change..."
              rows={3}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                background: c.surfaceAlt, color: c.text, resize: "vertical",
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
            <Btn variant="secondary" size="sm" onClick={() => setTrackReopenModal(false)}>Cancel</Btn>
            <Btn variant="command" size="sm" style={{ borderColor: `${c.amber}60`, color: c.amber }} onClick={() => {
              const trackName = trackReopenTarget;
              const reasonVal = trackReopenReason.trim() || null;
              reopenTrackInDB(proj.id, trackName, projects, { reason: reasonVal });
              setProjects(prev => prev.map(p => {
                if (p.id !== proj.id) return p;
                const updated = { ...p, tracks: { ...p.tracks }, lastActivityAt: new Date().toISOString() };
                if (updated.tracks[trackName]) {
                  updated.tracks[trackName] = { ...updated.tracks[trackName], periods: [...updated.tracks[trackName].periods, { started_at: new Date().toISOString(), completed_at: null }] };
                }
                updated.phase = derivePrimaryPhase(updated);
                return updated;
              }));
              window.__flowToast?.(`${trackName} track reopened`);
              setTrackReopenModal(false);
            }}>
              Reopen {trackReopenTarget}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ═══ SHIP PROJECT — release note + feature type + confetti (replaces GA) ═══ */}
      <Modal open={shipProjectModal} onClose={() => setShipProjectModal(false)} title="Ship Project" accent={c.green}>
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div>
            <Label style={{ marginBottom: space[1] }}>Release note</Label>
            <textarea
              value={shipProjectNote}
              onChange={e => setShipProjectNote(e.target.value)}
              placeholder="What shipped? Write a brief release note..."
              rows={3}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                background: c.surfaceAlt, color: c.text, resize: "vertical",
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <Label style={{ marginBottom: space[1] }}>Feature type</Label>
            <Sel value={shipProjectFeatureType} onChange={e => setShipProjectFeatureType(e.target.value)} style={{ width: "100%" }}>
              <option value="New">New Feature</option>
              <option value="Fix">Bug Fix</option>
              <option value="Enhancement">Enhancement</option>
              <option value="UI/UX">UI/UX Improvement</option>
            </Sel>
          </div>
          <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
            <Btn variant="secondary" size="sm" onClick={() => setShipProjectModal(false)}>Cancel</Btn>
            <Btn variant="command" size="sm" style={{ borderColor: c.greenBorder, color: c.green }} onClick={() => {
              const now = new Date().toISOString();
              shipProjectInDB(proj.id, projects);
              setProjects(prev => prev.map(p => {
                if (p.id !== proj.id) return p;
                const newTracks = { ...p.tracks };
                for (const name of Object.keys(newTracks)) {
                  const periods = [...newTracks[name].periods];
                  const last = periods[periods.length - 1];
                  if (last && last.completed_at === null) {
                    periods[periods.length - 1] = { ...last, completed_at: now };
                  }
                  newTracks[name] = { ...newTracks[name], periods };
                }
                return { ...p, status: "shipped", shippedAt: now, tracks: newTracks,
                  phase: derivePrimaryPhase({ ...p, tracks: newTracks }),
                  gaReleaseNote: shipProjectNote.trim() || null,
                  gaFeatureType: shipProjectFeatureType,
                };
              }));
              recordAction("project_shipped", {
                releaseNote: shipProjectNote.trim() || null,
                featureType: shipProjectFeatureType,
              }, `${proj.name} shipped!`);
              setShipProjectModal(false);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 4000);
            }}>
              Ship it!
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ═══ CONFETTI + CELEBRATION TOAST ═══ */}
      {showConfetti && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, pointerEvents: "none", overflow: "hidden" }}>
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            @keyframes celebration-in {
              0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
              100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes celebration-out {
              0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
            }
          `}</style>
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} style={{
              position: "absolute",
              top: -10,
              left: `${Math.random() * 100}%`,
              width: Math.random() * 8 + 4,
              height: Math.random() * 8 + 4,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              background: ["#E8590C", "#059669", "#1D4ED8", "#6D28D9", "#B45309", "#DC2626", "#0E7490", "#F59E0B"][i % 8],
              animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.8}s both`,
            }} />
          ))}
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: c.surfaceSolid, borderRadius: layout.radiusLg,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2)", border: `2px solid ${c.green}`,
            padding: `${space[6]}px ${space[7]}px`, textAlign: "center",
            maxWidth: 420, width: "90%",
            animation: "celebration-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both, celebration-out 0.4s cubic-bezier(0.4, 0, 1, 1) 3s both",
            pointerEvents: "auto",
          }}>
            <div style={{ fontSize: 48, marginBottom: space[3] }}>🚀</div>
            <div style={{
              fontFamily: typo.displayLg.font, fontSize: 22, fontWeight: 700,
              color: c.text, marginBottom: space[2],
            }}>Amazing! Congrats on shipping!</div>
            <div style={{
              fontFamily: typo.bodyMd.font, fontSize: 14, color: c.textMid,
              lineHeight: 1.5,
            }}>
              <strong>{proj.name}</strong> is now live. Keep an eye out for feedback from others on this.
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

