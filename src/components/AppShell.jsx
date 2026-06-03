// Flow — App Shell (two-layer header)
// Layer 1: Logo · Primary Nav · Utility (search, theme)
// Layer 2: Week controls · Filter trigger · Applied chips
// Filter drawer slides from right when triggered
import React, { useState, useRef, useEffect, useCallback } from "react";
import { c, typo, layout, space, motion, mono } from "../styles/theme";
import { FilterChip, Btn, Modal, selChevron } from "./shared";
import { ANNOUNCEMENTS } from "../data/announcements";
import { isDevSeedMode, devStore } from "../data/devSeed";
import { addProjectCommentToDB } from "../lib/mutations";
import { timeAgo, fmtAbsolute } from "../lib/time";
import { buildNotifications } from "../lib/notifications";
import FlowLogo from "./FlowLogo";
import { supabase } from "../lib/supabase";
import useDevLabel from "../hooks/useDevLabel";
import { initialsOf } from "../lib/names";

// weekConfig now passed via props from App.jsx

/* ════════════════════════════════════════════════════════════════════
   NAV
   ════════════════════════════════════════════════════════════════════ */
export const NAV = [
  { key: "summary",  label: "Summary",  num: 1 },
  { key: "projects", label: "Projects", num: 2 },
  { key: "people",   label: "People",   num: 3 },
  { key: "sep1",     separator: true },
  { key: "guide",    label: "Guide",    num: 4 },
  { key: "settings", label: "Settings", num: null },
  { key: "logs",     label: "Logs",     num: null },
  { key: "rant",     label: "Rant",     num: null },
];

// Primary nav = tabs shown in the header bar (guide stays here)
const PRIMARY_NAV = NAV.filter(t => !["settings", "logs", "rant"].includes(t.key) || t.separator);
// Utility nav = behind the terminal icon
const UTILITY_NAV = NAV.filter(t => ["settings", "logs", "rant"].includes(t.key));

/* ── Terminal Icon SVG ── */
const TerminalIcon = ({ size = 18, color = c.textMid }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);



/* ════════════════════════════════════════════════════════════════════
   DAY RHYTHM — contextual day-of-week indicator
   Mon=Focus · Tue/Wed=Sprint · Thu=Release · Fri=Review
   ════════════════════════════════════════════════════════════════════ */
const DAY_RHYTHM = [
  { label: "Focus day",   color: () => c.purple, icon: "◎" },  // 0 = Sunday
  { label: "Focus day",   color: () => c.purple, icon: "◎" },  // 1 = Monday
  { label: "Sprint day",  color: () => c.green,  icon: "⚡" }, // 2 = Tuesday
  { label: "Sprint day",  color: () => c.green,  icon: "⚡" }, // 3 = Wednesday
  { label: "Release day", color: () => c.orange, icon: "🚀" }, // 4 = Thursday
  { label: "Review day",  color: () => c.cyan,   icon: "✓" },  // 5 = Friday
  { label: "Rest day",    color: () => c.textDim, icon: "💤" }, // 6 = Saturday
];

function getDayRhythm() {
  const day = new Date().getDay();
  return DAY_RHYTHM[day] || null;
}


/* ════════════════════════════════════════════════════════════════════
   TIMEFRAME PICKER — quarter selector + custom range
   ════════════════════════════════════════════════════════════════════ */
const QUARTER_MONTHS = [
  { q: "Q1", months: "Jan - Mar", start: "-01-01", end: "-03-31" },
  { q: "Q2", months: "Apr - Jun", start: "-04-01", end: "-06-30" },
  { q: "Q3", months: "Jul - Sep", start: "-07-01", end: "-09-30" },
  { q: "Q4", months: "Oct - Dec", start: "-10-01", end: "-12-31" },
];

function TimeframePicker({ timeframe, setTimeframe }) {
  const [open, setOpen] = React.useState(false);
  const [customMode, setCustomMode] = React.useState(false);
  const [customStart, setCustomStart] = React.useState(timeframe.start);
  const [customEnd, setCustomEnd] = React.useState(timeframe.end);
  const [yearOffset, setYearOffset] = React.useState(0);
  const ref = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCustomMode(false); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const baseYear = new Date().getFullYear() + yearOffset;
  const currentQ = Math.floor(new Date().getMonth() / 3);
  const currentYear = new Date().getFullYear();

  const selectQuarter = (qi) => {
    const qm = QUARTER_MONTHS[qi];
    setTimeframe({
      label: qm.q,
      year: baseYear,
      start: `${baseYear}${qm.start}`,
      end: `${baseYear}${qm.end}`,
    });
    setOpen(false);
    setCustomMode(false);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd || customStart > customEnd) return;
    const s = new Date(customStart);
    const e = new Date(customEnd);
    const sMonth = s.toLocaleDateString("en-US", { month: "short" });
    const eMonth = e.toLocaleDateString("en-US", { month: "short" });
    setTimeframe({
      label: `${sMonth} - ${eMonth}`,
      year: s.getFullYear() === e.getFullYear() ? s.getFullYear() : `${s.getFullYear()}-${e.getFullYear()}`,
      start: customStart,
      end: customEnd,
    });
    setOpen(false);
    setCustomMode(false);
  };

  // Display label
  const isCurrentQ = timeframe.year === currentYear && timeframe.label === `Q${currentQ + 1}`;
  const displayLabel = `${timeframe.label} ${timeframe.year}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          borderRadius: layout.radiusSm,
          border: `1px solid ${isCurrentQ ? c.accent + "40" : c.border}`,
          background: isCurrentQ ? `${c.accent}08` : c.surfaceAlt,
          padding: `2px ${space[2]}px 2px ${space[2] + 2}px`,
          cursor: "pointer",
          fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
          fontWeight: 700, color: isCurrentQ ? c.accent : c.textMid,
          letterSpacing: "0.03em",
          transition: `border-color 150ms, background 150ms`,
        }}
      >
        {displayLabel}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={c.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms" }}>
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: c.surfaceSolid,
          borderRadius: layout.radiusMd,
          border: `1px solid ${c.border}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
          minWidth: 260,
          overflow: "hidden",
        }}>
          {!customMode ? (
            <>
              {/* Year selector */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${space[2]}px ${space[3]}px`,
                borderBottom: `1px solid ${c.border}`,
                background: c.surfaceAlt,
              }}>
                <button type="button" onClick={() => setYearOffset(y => y - 1)} style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  fontFamily: typo.monoSm.font, fontSize: 14, color: c.textMid, padding: "2px 6px",
                  borderRadius: 4,
                }} onMouseEnter={e => { e.currentTarget.style.background = `${c.border}60`; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>◂</button>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 13, fontWeight: 700, color: c.text,
                }}>{baseYear}</span>
                <button type="button" onClick={() => setYearOffset(y => y + 1)} style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  fontFamily: typo.monoSm.font, fontSize: 14, color: c.textMid, padding: "2px 6px",
                  borderRadius: 4,
                }} onMouseEnter={e => { e.currentTarget.style.background = `${c.border}60`; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>▸</button>
              </div>

              {/* Quarter grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[1], padding: space[2] }}>
                {QUARTER_MONTHS.map((qm, qi) => {
                  const isSelected = timeframe.label === qm.q && timeframe.year === baseYear;
                  const isCurrent = baseYear === currentYear && qi === currentQ;
                  return (
                    <button
                      key={qm.q}
                      type="button"
                      onClick={() => selectQuarter(qi)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        padding: `${space[2]}px ${space[2]}px`,
                        borderRadius: layout.radiusSm,
                        border: isSelected ? `2px solid ${c.accent}` : isCurrent ? `1px solid ${c.accent}40` : `1px solid transparent`,
                        background: isSelected ? `${c.accent}10` : "transparent",
                        cursor: "pointer",
                        transition: "background 120ms, border-color 120ms",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = c.surfaceAlt; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{
                        fontFamily: typo.monoSm.font, fontSize: 13, fontWeight: 700,
                        color: isSelected ? c.accent : c.text,
                      }}>{qm.q}</span>
                      <span style={{
                        fontFamily: typo.bodySm.font, fontSize: 10,
                        color: isSelected ? c.accent : c.textDim,
                      }}>{qm.months}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom range button */}
              <div style={{ padding: `${space[1]}px ${space[2]}px ${space[2]}px`, borderTop: `1px solid ${c.border}` }}>
                <button
                  type="button"
                  onClick={() => { setCustomMode(true); setCustomStart(timeframe.start); setCustomEnd(timeframe.end); }}
                  style={{
                    width: "100%", padding: `${space[2]}px`,
                    border: "none", background: "transparent",
                    cursor: "pointer", borderRadius: layout.radiusSm,
                    fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                    fontWeight: 600, color: c.textMid, textAlign: "center",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  Custom range...
                </button>
              </div>
            </>
          ) : (
            /* Custom date range mode */
            <div style={{ padding: space[3], display: "flex", flexDirection: "column", gap: space[3] }}>
              <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: c.text }}>Custom Range</div>
              <div style={{ display: "flex", gap: space[2], alignItems: "center" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600, color: c.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>From</label>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{
                    fontFamily: typo.monoSm.font, fontSize: 12, color: c.text,
                    padding: `${space[1]}px ${space[2]}px`, borderRadius: layout.radiusSm,
                    border: `1px solid ${c.border}`, background: c.surfaceAlt,
                    outline: "none", width: "100%",
                  }} />
                </div>
                <span style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim, paddingTop: 16 }}>to</span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600, color: c.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>To</label>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{
                    fontFamily: typo.monoSm.font, fontSize: 12, color: c.text,
                    padding: `${space[1]}px ${space[2]}px`, borderRadius: layout.radiusSm,
                    border: `1px solid ${c.border}`, background: c.surfaceAlt,
                    outline: "none", width: "100%",
                  }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setCustomMode(false)} style={{
                  padding: `${space[1]}px ${space[3]}px`, borderRadius: layout.radiusSm,
                  border: `1px solid ${c.border}`, background: "transparent",
                  fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600,
                  color: c.textMid, cursor: "pointer",
                }}>Back</button>
                <button type="button" onClick={applyCustom} style={{
                  padding: `${space[1]}px ${space[3]}px`, borderRadius: layout.radiusSm,
                  border: "none", background: c.accent, color: "#fff",
                  fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600,
                  cursor: "pointer", opacity: (!customStart || !customEnd || customStart > customEnd) ? 0.4 : 1,
                }}>Apply</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HEADER — two-layer shell
   Layer 1 (52px): [Logo] | [Nav tabs] ····· [🔍] [◐]
   Layer 2 (38px): [Week ◂ date ▸] | ····· [chips] [Filters btn]
   Detail mode:    Layer 1 shows breadcrumb, Layer 2 hidden
   ════════════════════════════════════════════════════════════════════ */
export function Header({
  onLogoClick,
  detailLabel, onBack, breadcrumbLabel,
  activeTab, onTabSwitch,
  onCmdOpen,
  // ── Global filter props ──
  globalFilters, pendingFilters, setPendingFilters,
  applyFilters, clearGlobalFilters, globalFilterCount,
  allOwners, allSquads, allPeople,
  // ── Auth ──
  currentUser,
  alertCount = 0,
  // ── Inbox modal data ──
  projects, people, currentPerson, onNavigate,
  // ── My Lens ──
  myLens = false, toggleMyLens, followedProjects = [],
  // ── Timeframe ──
  timeframe, setTimeframe,
}) {

  const devRef = useDevLabel('Header', 'src/components/AppShell.jsx', 'Two-layer app header with nav, week controls, and filters');
  const showContextBar = !detailLabel;
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // ── Scroll-aware collapse: hide headers on scroll-down, reveal on scroll-up/hover ──
  // Listen in capture phase so we catch scroll on any inner container
  // (several views use internal overflow:auto scrollers, not window scroll).
  const [scrollHidden, setScrollHidden] = React.useState(false);
  const [hoverPeek, setHoverPeek] = React.useState(false);
  const lastYMapRef = React.useRef(new WeakMap());
  const peekTimerRef = React.useRef(null);
  React.useEffect(() => {
    const REVEAL_TOP = 40;
    const DELTA = 6;
    const HIDE_AFTER = 120;
    const onAnyScroll = (e) => {
      const t = e.target;
      const isDoc = (t === document || t === document.documentElement || t === document.body);
      const el = isDoc ? (document.scrollingElement || document.documentElement) : t;
      if (!el || typeof el.scrollTop !== "number") return;
      // Ignore tiny inner scrollers (tables, dropdowns, popovers) — only the main
      // page scroll region should drive header collapse.
      if (!isDoc) {
        const vh = window.innerHeight || 800;
        if (el.clientHeight < vh * 0.5) return;
      }
      const y = el.scrollTop;
      const prev = lastYMapRef.current.get(el) ?? 0;
      const dy = y - prev;
      if (y <= REVEAL_TOP) {
        setScrollHidden(false);
      } else if (dy > DELTA && y > HIDE_AFTER) {
        setScrollHidden(true);
      } else if (dy < -DELTA) {
        setScrollHidden(false);
      }
      lastYMapRef.current.set(el, y);
    };
    document.addEventListener('scroll', onAnyScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onAnyScroll, { capture: true });
  }, []);

  // Reset collapse state when the active tab or detail context changes
  React.useEffect(() => { setScrollHidden(false); }, [activeTab, detailLabel]);

  const collapsed = scrollHidden && !hoverPeek;

  // Sync CSS var + body class so sticky content below the app header knows
  // whether to offset by the header's height (expanded) or 0 (collapsed/hidden).
  // The header itself uses transform to hide, so its layout box still reserves
  // ~104px at the top — but when visually hidden we want sticky inner headers
  // (table columns, section titles) to rise to the viewport top.
  React.useEffect(() => {
    const headerH = showContextBar ? 104 : 52;
    document.documentElement.style.setProperty('--flow-header-h', `${headerH}px`);
    document.documentElement.style.setProperty('--flow-header-offset', collapsed ? '60px' : `${headerH}px`);
    document.body.classList.toggle('flow-chrome-collapsed', collapsed);
    return () => document.body.classList.remove('flow-chrome-collapsed');
  }, [collapsed, showContextBar]);

  const triggerPeek = () => {
    setHoverPeek(true);
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
  };
  const endPeek = () => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => setHoverPeek(false), 180);
  };

  // Current page label for the floating pill
  const currentNav = NAV.find(n => n.key === activeTab && !n.separator);
  const floatingLabel = detailLabel || currentNav?.label || "";

  // Local draft state for the drawer — syncs from pendingFilters when opening
  const [draft, setDraft] = React.useState({ owner: [], squad: [], person: [], track: [] });

  // Pending-apply flag: when set, triggers applyFilters on next render after setPendingFilters
  const applyNextRef = React.useRef(false);
  React.useEffect(() => {
    if (applyNextRef.current) {
      applyNextRef.current = false;
      applyFilters();
    }
  }, [pendingFilters, applyFilters]);

  const openDrawer = () => {
    setDraft({ ...pendingFilters });
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const handleApply = () => {
    setPendingFilters({ ...draft });
    applyNextRef.current = true;
    setDrawerOpen(false);
  };

  const handleClearAll = () => {
    setDraft({ owner: [], squad: [], person: [], track: [] });
    clearGlobalFilters();
    setDrawerOpen(false);
  };

  const draftCount = Object.values(draft).filter(v => v.length > 0).length;
  const draftChanged = JSON.stringify(draft) !== JSON.stringify(globalFilters);

  // Remove a single applied filter chip
  const removeAppliedFilter = (key) => {
    const updated = { ...globalFilters, [key]: [] };
    setPendingFilters(updated);
    applyNextRef.current = true;
  };

  return (
    <>
    {/* ─── Top hover-peek trigger: invisible strip that reveals collapsed header ─── */}
    <div
      aria-hidden
      onMouseEnter={triggerPeek}
      onMouseLeave={endPeek}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 14,
        zIndex: 54,
        pointerEvents: collapsed ? "auto" : "none",
      }}
    />

    {/* ═══ SCROLL-AWARE HEADER WRAPPER — slides up on scroll down ═══
       Uses transform (GPU, no layout reflow) rather than height animation —
       resizing the wrapper mid-scroll causes the main scroll container's
       scrollTop to shift, which creates artifact scroll events and oscillation. */}
    <div
      onMouseEnter={() => { if (scrollHidden) triggerPeek(); }}
      onMouseLeave={endPeek}
      style={{
        position: "sticky", top: 0, zIndex: 50,
        width: "100%", minWidth: 0,
        background: c.headerBg || "#111111",
        transform: collapsed ? "translate3d(0,-100%,0)" : "translate3d(0,0,0)",
        opacity: collapsed ? 0 : 1,
        transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease",
        willChange: "transform",
      }}
    >
    {/* ═══ LAYER 1 — Primary navigation bar (solid black header — Obsidian) ═══ */}
    <header ref={devRef} className="flow-header" style={{
      height: 52, display: "flex", alignItems: "center",
      padding: `0 ${space[7]}px`,
      background: c.headerBg || "#111111",
      borderBottom: "none",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      position: "relative", zIndex: 2,
      minWidth: 0,
      transition: "background 280ms cubic-bezier(0.16, 1, 0.3, 1)",
    }}>

      {/* ── Logo — connected dots + FLOW wordmark (white on black header) ── */}
      <div onClick={onLogoClick} className="flow-logo-group" style={{
        display: "flex", alignItems: "center", gap: space[2] + 2,
        cursor: "pointer", marginRight: space[5], flexShrink: 0,
      }}>
        <div className="flow-logo-mark" style={{
          flexShrink: 0, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FlowLogo size={26} color="#FFFFFF" />
        </div>
        <span style={{
          fontFamily: mono, fontSize: 15,
          fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.04em",
        }}>FLOW</span>
      </div>

      {/* ── Vertical separator (subtle on dark header) ── */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.15)", marginRight: space[3], flexShrink: 0 }} />

      {/* ── Nav tabs (or breadcrumb in detail mode) ── */}
      {detailLabel ? (
        <DetailBreadcrumb
          breadcrumbLabel={breadcrumbLabel}
          detailLabel={detailLabel}
          onBack={onBack}
        />
      ) : (
        <nav className="flow-nav-rail" style={{ display: "flex", alignItems: "stretch", gap: 2, flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden", height: "100%", scrollbarWidth: "none" }}>
          {PRIMARY_NAV.map(tab => {
            if (tab.separator) {
              return <div key={tab.key} style={{ width: 1, height: 20, alignSelf: "center", background: "rgba(255,255,255,0.12)", margin: `0 ${space[1]}px`, flexShrink: 0 }} />;
            }
            const active = activeTab === tab.key;
            // Render as an anchor so Chrome's right-click → "Open in new tab"
            // and Cmd/Ctrl-click both work natively. Left-click is
            // intercepted to stay inside the SPA; modified clicks (middle,
            // cmd/ctrl/shift/alt) fall through to the browser.
            return (
              <a
                key={tab.key}
                href={`?tab=${tab.key}`}
                {...(tab.key === "guide" ? { "data-tour": "guide-tab" } : {})}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                  e.preventDefault();
                  onTabSwitch(tab.key);
                }}
                className={`flow-header-tab${active ? " flow-tab-active" : ""}`}
                style={{
                  padding: `0 ${space[3] + 2}px`, borderRadius: 0,
                  border: "none", cursor: "pointer",
                  background: "transparent",
                  fontFamily: typo.bodySm.font, fontSize: 13,
                  fontWeight: 600,
                  color: active ? "#FFFFFF" : "rgba(255,255,255,0.50)",
                  textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 6,
                  position: "relative", flexShrink: 0, whiteSpace: "nowrap",
                  transition: `color ${motion.fast.duration} ${motion.fast.easing}`,
                }}>
                {tab.label}
                {tab.key === "summary" && alertCount > 0 && !active && (
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#FFFFFF", flexShrink: 0,
                    animation: "flow-accent-pulse 2s ease-in-out infinite",
                  }} />
                )}
                {/* Numeric shortcut hint — subtle hotkey on dark header */}
                {tab.num && <span className="flow-tab-hotkey" style={{
                  fontFamily: typo.monoSm.font, fontSize: 11,
                  fontWeight: 700, letterSpacing: typo.monoSm.tracking,
                  color: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
                  lineHeight: 1, flexShrink: 0,
                  padding: "2px 5px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 3,
                  transition: `background ${motion.fast.duration}, border-color ${motion.fast.duration}, color ${motion.fast.duration}, opacity ${motion.fast.duration}`,
                  position: "relative", top: -1,
                }}>{tab.num}</span>}
                {/* Active indicator — white underline on dark header */}
                {active && (
                  <div style={{
                    position: "absolute", bottom: -1, left: 0, right: 0,
                    height: 3,
                    background: "#FFFFFF",
                    borderRadius: 1.5,
                  }} />
                )}
              </a>
            );
          })}
        </nav>
      )}

      {/* Spacer removed — nav-rail grows to fill remaining space (flex:1) */}
      <div style={{ width: space[2], flexShrink: 0 }} />

      {/* ── Utility cluster: lens · search · user ── */}
      <div style={{ display: "flex", alignItems: "center", gap: space[2], flexShrink: 0 }}>
        {/* ── My Lens toggle switch (disabled on People & Guide tabs) ── */}
        {toggleMyLens && (() => {
          const lensDisabled = activeTab === "people" || activeTab === "guide";
          return (
          <div
            data-tour="my-lens"
            onClick={lensDisabled ? undefined : toggleMyLens}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              cursor: lensDisabled ? "default" : "pointer",
              padding: "0 4px", userSelect: "none",
              opacity: lensDisabled ? 0.3 : 1,
              transition: `opacity ${motion.fast.duration} ${motion.fast.easing}`,
            }}
            title={lensDisabled ? "My Lens is not available on this tab" : myLens ? "My Lens ON — showing your squad + followed projects" : "My Lens — filter to your squad + followed projects"}
          >
            <span style={{
              fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
              color: myLens ? "#FFFFFF" : "rgba(255,255,255,0.45)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>My Lens</span>
            <div style={{
              width: 36, height: 20, borderRadius: 10,
              background: myLens ? "#FFFFFF" : "rgba(255,255,255,0.2)",
              position: "relative",
              transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
              flexShrink: 0,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                background: myLens ? "#111111" : "rgba(255,255,255,0.5)",
                position: "absolute", top: 2,
                left: myLens ? 18 : 2,
                transition: `left ${motion.fast.duration} ${motion.fast.easing}, background ${motion.fast.duration}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>
          );
        })()}

        <CompactSearch onClick={onCmdOpen} />

        {/* ── Inbox (mentions) ── */}
        <InboxBell
          projects={projects}
          people={people}
          currentPerson={currentPerson}
          onNavigate={onNavigate}
          myLens={myLens}
        />

        {/* ── Announcements (What's new) ── */}
        <AnnouncementsBell projects={projects} people={people} currentPerson={currentPerson} onNavigate={onNavigate} />

        {/* ── Terminal button (Settings, Logs & Rant) ── */}
        <button
          onClick={() => onTabSwitch("terminal")}
          style={{
            width: 34, height: 34, borderRadius: layout.radiusSm,
            border: `1px solid ${["terminal","settings","logs","rant"].includes(activeTab) ? "rgba(132,255,149,0.3)" : "rgba(255,255,255,0.15)"}`,
            background: ["terminal","settings","logs","rant"].includes(activeTab) ? "rgba(132,255,149,0.12)" : "rgba(255,255,255,0.08)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
          }}
          title="Terminal"
        >
          <TerminalIcon size={16} color={["terminal","settings","logs","rant"].includes(activeTab) ? "#84FF95" : "rgba(255,255,255,0.55)"} />
        </button>

        {/* ── Notification bell (urgency-tiered project notifications) ── */}
        <div className="flow-bell-sm-hide" style={{ display: "flex", alignItems: "center" }}>
          <NotificationBell
            projects={projects}
            people={people}
            currentPerson={currentPerson}
            onNavigate={onNavigate}
          />
        </div>

        {/* ── User avatar + logout ── */}
        {(currentUser?.user || currentPerson) && (
          <UserBadge
            user={currentUser?.user || null}
            personProfile={currentUser?.personProfile || currentPerson || null}
            personName={currentPerson?.name || currentUser?.personProfile?.name || currentUser?.user?.user_metadata?.full_name}
            onSignOut={currentUser?.signOut || (() => {})}
            onRefreshProfile={currentUser?.refreshProfile}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </header>

    {/* ═══ LAYER 2 — Context bar (glassmorphic — Obsidian) ═══ */}
    {showContextBar && (
      <div className="flow-context-bar" style={{
        height: 52, display: "flex", alignItems: "center",
        padding: `0 ${space[7]}px`, gap: space[2],
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(255,255,255,0.35)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        position: "relative", zIndex: 1,
        borderRadius: `${layout.radiusLg}px ${layout.radiusLg}px 0 0`,
      }}>

        {/* ── Today's date + Quarter picker ── */}
        <div style={{ display: "flex", alignItems: "center", gap: space[2], flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center",
            borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
            background: c.surfaceAlt,
            padding: `2px ${space[2]}px`,
            flexShrink: 0, gap: 4,
          }}>
            <span style={{
              fontFamily: typo.bodyXs.font, fontSize: typo.bodyXs.size, fontWeight: 600,
              color: c.textMid, whiteSpace: "nowrap",
            }}>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          {timeframe && setTimeframe && <TimeframePicker timeframe={timeframe} setTimeframe={setTimeframe} />}
        </div>

        {/* ── Separator ── */}
        <div style={{ width: 1, alignSelf: "stretch", margin: "6px 2px", background: c.border, flexShrink: 0 }} />

        {/* ── Tab help text ── */}
        <TabHelpText activeTab={activeTab} onNavigate={onTabSwitch} />

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Active filter chips (inline) ── */}
        {globalFilterCount > 0 && activeTab !== "guide" && (
          <div style={{ display: "flex", alignItems: "center", gap: space[1] + 2, flexShrink: 0, flexWrap: "wrap" }}>
            {globalFilters.owner.length > 0 && (
              <FilterChip label={`Owner: ${globalFilters.owner.join(", ")}`} onClick={() => removeAppliedFilter("owner")} />
            )}
            {globalFilters.squad.length > 0 && (
              <FilterChip label={`Squad: ${globalFilters.squad.join(", ")}`} onClick={() => removeAppliedFilter("squad")} />
            )}
            {globalFilters.person?.length > 0 && (
              <FilterChip label={`People: ${globalFilters.person.join(", ")}`} onClick={() => removeAppliedFilter("person")} />
            )}
            {globalFilters.track?.length > 0 && (
              <FilterChip label={`Track: ${globalFilters.track.join(", ")}`} onClick={() => removeAppliedFilter("track")} />
            )}
          </div>
        )}

        {/* ── Day rhythm pill ── */}
        <DayRhythmPill onNavigateToGuide={() => onTabSwitch("guide")} />

        {/* ── Filter trigger button — hidden on Guide (no filterable content). ── */}
        {activeTab !== "guide" && (
        <button onClick={openDrawer} className="flow-filter-trigger" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: `3px ${space[3]}px`, height: 26,
          borderRadius: layout.radiusSm,
          border: `1px solid ${globalFilterCount > 0 ? c.accent + "40" : c.border}`,
          background: globalFilterCount > 0 ? c.accentDim : c.surfaceAlt,
          color: globalFilterCount > 0 ? c.accent : c.textMid,
          fontFamily: typo.bodyXs.font, fontSize: typo.bodyXs.size,
          fontWeight: 600, cursor: "pointer",
          transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
          flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
            <path d="M1 3h14M4 8h8M6 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {globalFilterCount > 0 ? (
            <>
              {globalFilterCount} filter{globalFilterCount !== 1 ? "s" : ""} applied
              <span style={{
                fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                color: c.accent, background: `${c.accent}18`,
                padding: "1px 5px", borderRadius: layout.radiusTag + 1, lineHeight: 1.4,
              }}>{globalFilterCount}</span>
            </>
          ) : "Filters"}
        </button>
        )}
      </div>
    )}
    </div>
    {/* ═══ END SCROLL-AWARE HEADER WRAPPER ═══ */}

    {/* ═══ FLOATING GLASS PILLS — visible when header collapsed ═══ */}
    <FloatingHeaderPills
      visible={collapsed}
      label={floatingLabel}
      onLogoClick={onLogoClick}
      onSearchClick={onCmdOpen}
      onPeekEnter={triggerPeek}
      onPeekLeave={endPeek}
    />

    {/* ═══ MOBILE BOTTOM NAV — visible only at ≤640px so all 6 tabs stay reachable ═══ */}
    <MobileBottomNav activeTab={activeTab} onTabSwitch={onTabSwitch} />

    {/* ═══ FILTER DRAWER — slides from right ═══ */}
    <FilterDrawer
      open={drawerOpen}
      onClose={closeDrawer}
      draft={draft}
      setDraft={setDraft}
      onApply={handleApply}
      onClearAll={handleClearAll}
      draftCount={draftCount}
      draftChanged={draftChanged}
      globalFilterCount={globalFilterCount}
      allOwners={allOwners || []}
      allSquads={allSquads || []}
      allPeople={allPeople || []}
    />
    </>
  );
}


/* ════════════════════════════════════════════════════════════════════
   FLOATING HEADER PILLS — shown when the main header is collapsed.
   Left pill: Flow logo mark. Right pill: current page label + search.
   ════════════════════════════════════════════════════════════════════ */
function FloatingHeaderPills({ visible, label, onLogoClick, onSearchClick, onPeekEnter, onPeekLeave }) {
  const pillBg = c.surface;
  const pillBorder = `1px solid ${c.border}`;
  const pillShadow = c.shadowCard;
  const radius = layout.radiusPill;

  return (
    <>
      {/* Top scrim — hides content scrolling behind the pills.
          Only visible while pills are shown. Height 52 matches --flow-sticky-top
          so sticky table headers pin cleanly below the scrim. zIndex 54 sits
          above the pulse stacking context but below the pills (55). */}
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 60,
        // Solid page-bg through the full scrim so there is no translucent seam
        // between the scrim's end and the sticky table header's start. A 6px
        // soft fade BELOW the scrim masks any sub-pixel rounding without
        // letting the content row behind bleed through.
        background: c.bg,
        boxShadow: `0 6px 6px -6px ${c.bg}`,
        pointerEvents: "none", zIndex: 54,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.28s ease",
      }} />
    <div
      onMouseEnter={onPeekEnter}
      onMouseLeave={onPeekLeave}
      style={{
        position: "fixed", top: 12, left: 16, right: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: space[3], zIndex: 55,
        pointerEvents: visible ? "auto" : "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 0.28s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* ── Left pill: logo mark + page label stacked ── */}
      <button
        onClick={onLogoClick}
        title="Home"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "6px 14px 6px 8px", height: 40,
          borderRadius: radius, border: pillBorder,
          background: pillBg,
          boxShadow: pillShadow,
          cursor: "pointer",
          transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
        }}
      >
        <FlowLogo size={24} />
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-start",
          lineHeight: 1.05, gap: 1,
        }}>
          <span style={{
            fontFamily: mono,
            fontSize: 13, fontWeight: 700,
            color: c.text, letterSpacing: "0.04em",
          }}>FLOW</span>
          {label && (
            <span style={{
              fontFamily: typo.bodyXs.font, fontSize: 11,
              fontWeight: 500, color: c.textMid,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap", maxWidth: 180,
              overflow: "hidden", textOverflow: "ellipsis",
            }}>{label}</span>
          )}
        </div>
      </button>

      {/* ── Right pill: search only ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        height: 40, padding: "0 6px",
        borderRadius: radius, border: pillBorder,
        background: pillBg,
        boxShadow: pillShadow,
      }}>
        <button
          onClick={onSearchClick}
          title="Search (F)"
          className="flow-hide-mobile"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            height: 28, padding: "0 10px 0 8px",
            borderRadius: radius,
            border: `1px solid ${c.border}`,
            background: c.surfaceAlt,
            cursor: "pointer",
            transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5" stroke={c.textDim} strokeWidth="1.5" />
            <path d="M11 11l3 3" stroke={c.textDim} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{
            fontFamily: typo.bodyXs.font, fontSize: 12,
            color: c.textMid, userSelect: "none",
          }}>Search</span>
          <span style={{
            fontFamily: typo.monoSm.font, fontSize: 10,
            fontWeight: 600, color: c.textDim,
            background: c.surface, border: `1px solid ${c.border}`,
            padding: "0px 5px", borderRadius: layout.radiusTag + 1,
            lineHeight: 1.4,
          }}>⌘K</span>
        </button>
      </div>
    </div>
    </>
  );
}


/* ════════════════════════════════════════════════════════════════════
   MOBILE BOTTOM NAV — fixed footer bar with all 6 primary tabs.
   Visible only at ≤640px (CSS gate). Stays reachable when the top
   header is scroll-collapsed.
   ════════════════════════════════════════════════════════════════════ */
function MobileBottomNav({ activeTab, onTabSwitch }) {
  const tabs = PRIMARY_NAV.filter(t => !t.separator);
  return (
    <nav className="flow-mobile-bottom-nav" aria-label="Primary navigation" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 56,
      display: "none",
      background: c.surface,
      borderTop: `1px solid ${c.border}`,
      boxShadow: c.shadowCard,
      paddingBottom: "env(safe-area-inset-bottom, 0)",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", justifyContent: "space-around", height: 56 }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <a
              key={tab.key}
              href={`?tab=${tab.key}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                e.preventDefault();
                onTabSwitch(tab.key);
              }}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              style={{
                flex: 1, minWidth: 0, height: "100%",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                background: "none", border: 0, padding: "4px 2px",
                cursor: "pointer", textDecoration: "none",
                color: active ? c.accent : c.textMid,
                fontFamily: typo.bodyXs.font, fontSize: 11, fontWeight: 600,
                borderTop: `2px solid ${active ? c.accent : "transparent"}`,
                transition: `color ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}`,
              }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}


/* ════════════════════════════════════════════════════════════════════
   FILTER DRAWER — full-height right panel with search per group
   ════════════════════════════════════════════════════════════════════ */
function FilterDrawer({
  open, onClose,
  draft, setDraft,
  onApply, onClearAll,
  draftCount, draftChanged, globalFilterCount,
  allOwners, allSquads, allPeople,
}) {
  const devRef = useDevLabel('FilterDrawer', 'src/components/AppShell.jsx', 'Full-height right panel with search-per-group filter controls');
  const drawerRef = React.useRef(null);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  const allTracks = ["PRD", "Design", "Dev", "QA", "Alpha", "Beta"];
  const filterGroups = [
    { key: "squad",  label: "Squad",  options: allSquads },
    { key: "owner",  label: "Owner",  options: allOwners },
    { key: "person", label: "People", options: allPeople },
    { key: "track",  label: "Track",  options: allTracks },
  ];

  const activeCount = [draft.squad, draft.owner, draft.person, draft.track].filter(v => v?.length > 0).length;

  return (
    <>
      {/* Overlay — dark + blur */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: `opacity ${motion.normal.duration} ${motion.normal.easing}`,
        }}
      />

      {/* Drawer panel */}
      <div
        ref={(el) => { drawerRef.current = el; if (devRef) devRef.current = el; }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 360,
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          borderLeft: `1px solid ${c.border}`,
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${motion.normal.duration} ${motion.normal.easing}`,
          display: "flex", flexDirection: "column",
          boxShadow: open ? c.shadowElevated : "none",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: `${space[4]}px ${space[5]}px`,
          borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M1 3h14M4 8h8M6 13h4" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{
              fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size,
              fontWeight: typo.displaySm.weight, letterSpacing: typo.displaySm.tracking,
              color: c.text,
            }}>Filters</span>
            {activeCount > 0 && (
              <span style={{
                fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                color: c.accent, background: c.accentDim,
                padding: "1px 6px", borderRadius: layout.radiusPill,
                lineHeight: 1.4,
              }}>{activeCount}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
            {globalFilterCount > 0 && (
              <button onClick={onClearAll} className="flow-drawer-close" style={{
                height: 28, borderRadius: layout.radiusSm, padding: `0 ${space[2]}px`,
                border: `1px solid ${c.border}`, background: c.surfaceAlt,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                color: c.textDim, transition: `background ${motion.interaction.duration}, border-color ${motion.interaction.duration}, color ${motion.interaction.duration}, box-shadow ${motion.interaction.duration}, transform ${motion.interaction.duration}, opacity ${motion.interaction.duration}`,
                fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                fontWeight: typo.monoSm.weight, letterSpacing: typo.monoSm.tracking,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = c.red; e.currentTarget.style.borderColor = `${c.red}40`; }}
              onMouseLeave={e => { e.currentTarget.style.color = c.textDim; e.currentTarget.style.borderColor = c.border; }}
              >Reset</button>
            )}
            <button onClick={onClose} className="flow-drawer-close" style={{
              width: 28, height: 28, borderRadius: layout.radiusSm,
              border: `1px solid ${c.border}`, background: c.surfaceAlt,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: c.textMid, transition: `background ${motion.interaction.duration}, border-color ${motion.interaction.duration}, color ${motion.interaction.duration}, box-shadow ${motion.interaction.duration}, transform ${motion.interaction.duration}, opacity ${motion.interaction.duration}`,
            }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Filter groups ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: `${space[3]}px ${space[5]}px`,
          display: "flex", flexDirection: "column", gap: space[4],
          scrollbarWidth: "none",
        }}>
          {filterGroups.map(group => (
            <DrawerFilterGroup
              key={group.key}
              label={group.label}
              options={group.options}
              value={draft[group.key]}
              onChange={v => setDraft(d => ({ ...d, [group.key]: v }))}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: `${space[3]}px ${space[5]}px ${space[4]}px`,
          borderTop: `1px solid ${c.border}`,
          display: "flex", flexDirection: "column", gap: space[3],
        }}>
          {/* Draft indicator */}
          {draftChanged && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
              fontWeight: typo.monoSm.weight, letterSpacing: typo.monoSm.tracking,
              color: c.orange,
            }}>
              <div className="flow-draft-dot flow-accent-pulse" style={{
                width: 6, height: 6, borderRadius: "50%", background: c.orange,
              }} />
              {draftCount > 0
                ? `${draftCount} pending change${draftCount !== 1 ? "s" : ""}`
                : "Clearing all filters"
              }
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: space[2] }}>
            <Btn variant="secondary" onClick={onClose} style={{
              flex: 1, justifyContent: "center", fontSize: typo.bodySm.size,
            }}>Cancel</Btn>
            <Btn
              variant={draftChanged ? "primary" : "secondary"}
              onClick={onApply}
              disabled={!draftChanged}
              style={{ flex: 2, justifyContent: "center", fontSize: typo.bodySm.size }}
            >
              {draftChanged ? "Apply filters" : "No changes"}
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}


/* ════════════════════════════════════════════════════════════════════
   DRAWER FILTER GROUP — single filter with search + option list
   ════════════════════════════════════════════════════════════════════ */
function DrawerFilterGroup({ label, options, value = [], onChange }) {
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef(null);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Pin selected items to top when not searching
  const sorted = (!search && value.length > 0)
    ? [...value.filter(v => filtered.includes(v)), ...filtered.filter(o => !value.includes(o))]
    : filtered;

  const allSelected = value.length === 0;

  const toggle = (opt) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <div>
      {/* Label row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: space[2],
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
          <span style={{
            fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
            fontWeight: typo.monoSm.weight, letterSpacing: "0.06em",
            color: c.textDim, textTransform: "uppercase",
          }}>{label}</span>
          {value.length > 0 && (
            <span style={{
              fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
              color: c.accent, background: c.accentDim,
              padding: "1px 5px", borderRadius: layout.radiusPill,
              lineHeight: 1.4,
            }}>{value.length}</span>
          )}
        </div>
        {value.length > 0 && (
          <span
            onClick={() => { onChange([]); setSearch(""); }}
            style={{
              fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 500,
              color: c.textDim, cursor: "pointer",
              padding: "1px 5px", borderRadius: layout.radiusTag,
              transition: `background ${motion.interaction.duration}, border-color ${motion.interaction.duration}, color ${motion.interaction.duration}, box-shadow ${motion.interaction.duration}, transform ${motion.interaction.duration}, opacity ${motion.interaction.duration}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = c.accent; }}
            onMouseLeave={e => { e.currentTarget.style.color = c.textDim; }}
          >Clear</span>
        )}
      </div>

      {/* Search input */}
      <div style={{ position: "relative", marginBottom: space[2] }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          opacity: 0.4, pointerEvents: "none",
        }}>
          <circle cx="7" cy="7" r="5" stroke={c.textDim} strokeWidth="1.5" />
          <path d="M11 11l3 3" stroke={c.textDim} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && filtered.length === 1) {
              toggle(filtered[0]);
              setSearch("");
            }
          }}
          style={{
            width: "100%", height: 32, padding: `0 ${space[3]}px 0 32px`,
            border: `1px solid ${c.border}`, borderRadius: layout.radiusSm,
            background: c.surfaceAlt, color: c.text,
            fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
            outline: "none", boxSizing: "border-box",
            transition: `border-color ${motion.interaction.duration}`,
          }}
          onFocus={e => { e.target.style.borderColor = c.accent + "60"; }}
          onBlur={e => { e.target.style.borderColor = c.border; }}
        />
      </div>

      {/* Option list */}
      <div style={{
        maxHeight: 160, overflowY: "auto",
        borderRadius: layout.radiusSm,
        border: `1px solid ${c.border}`,
        background: c.surfaceSolid,
        scrollbarWidth: "thin",
        scrollbarColor: `${c.textDim}30 transparent`,
      }}>
        {/* All option */}
        <div
          onClick={() => { onChange([]); setSearch(""); }}
          className="flow-dropdown-item"
          style={{
            padding: `6px ${space[3]}px`, cursor: "pointer",
            fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
            color: allSelected ? c.accent : c.textMid,
            fontWeight: allSelected ? 600 : 400,
            background: allSelected ? `${c.accent}08` : "transparent",
            borderBottom: `1px solid ${c.border}`,
            display: "flex", alignItems: "center", gap: space[2],
            transition: `background ${motion.interaction.duration}`,
          }}
        >
          <span style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1.5px solid ${allSelected ? c.accent : c.textDim}`,
            background: allSelected ? c.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: `background ${motion.interaction.duration}, border-color ${motion.interaction.duration}, color ${motion.interaction.duration}, box-shadow ${motion.interaction.duration}, transform ${motion.interaction.duration}, opacity ${motion.interaction.duration}`,
          }}>
            {allSelected && (
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5 5-5" stroke={c.textOnAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          All {label.toLowerCase()}s
        </div>

        {sorted.map(opt => {
          const selected = value.includes(opt);
          return (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              className="flow-dropdown-item"
              style={{
                padding: `6px ${space[3]}px`, cursor: "pointer",
                fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                color: selected ? c.accent : c.text,
                fontWeight: selected ? 600 : 400,
                background: selected ? `${c.accent}08` : "transparent",
                display: "flex", alignItems: "center", gap: space[2],
                borderBottom: selected ? `1px solid ${c.accent}20` : `1px solid ${c.border}30`,
                transition: `background ${motion.interaction.duration}`,
              }}
            >
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: `1.5px solid ${selected ? c.accent : c.textDim}`,
                background: selected ? c.accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: `background ${motion.interaction.duration}, border-color ${motion.interaction.duration}, color ${motion.interaction.duration}, box-shadow ${motion.interaction.duration}, transform ${motion.interaction.duration}, opacity ${motion.interaction.duration}`,
              }}>
                {selected && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6l2.5 2.5 5-5" stroke={c.textOnAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {opt}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div style={{
            padding: `${space[3]}px`, fontFamily: typo.bodySm.font,
            fontSize: typo.bodySm.size, color: c.textDim, textAlign: "center",
          }}>
            No matches
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════
   DETAIL BREADCRUMB — structured breadcrumb for detail pages
   Shows parent section and detail title with clear hierarchy
   ════════════════════════════════════════════════════════════════════ */
function DetailBreadcrumb({ breadcrumbLabel, detailLabel, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0, flex: 1 }}>
      {/* Back link — parent section. On narrow viewports, collapse to chevron only. */}
      <span onClick={onBack} className="flow-breadcrumb" style={{
        fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
        fontWeight: 500, color: "rgba(255,255,255,1)", cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 5,
        padding: `3px ${space[2]}px 3px ${space[2] - 2}px`,
        borderRadius: layout.radiusSm,
        border: "1px solid transparent",
      }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 1 }}>
          <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flow-breadcrumb-label">{breadcrumbLabel}</span>
      </span>

      {/* Separator — chevron */}
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
        <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Detail title — on dark header */}
      <div style={{
        display: "flex", alignItems: "center", gap: space[2],
        padding: `3px ${space[3]}px`,
        borderRadius: layout.radiusSm,
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.15)",
        minWidth: 0, flex: 1,
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "#FFFFFF",
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: typo.displaySm.font, fontSize: 14,
          fontWeight: 700, color: "#FFFFFF",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          minWidth: 0,
        }}>{detailLabel}</span>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════
   TAB HELP TEXT — contextual one-liner per tab
   ════════════════════════════════════════════════════════════════════ */
const TAB_HELP = {
  summary:  { text: "Week-on-week progress at a glance", section: "guide-summary" },
  pulse:    { text: "Live team activity — who's doing what right now", section: "guide-pulse" },
  commit:   { text: "Your commits for the week — add, lock, ship", section: "guide-commit" },
  projects: { text: "Every project, one view — roadmap & status", section: "guide-projects" },
  people:   { text: "Person deep-dive — commitments, momentum, activity timeline", section: "guide-people" },
  guide:    { text: "How Flow works — the playbook", section: null },
};

function TabHelpText({ activeTab, onNavigate }) {
  const help = TAB_HELP[activeTab];
  if (!help) return null;

  const handleClick = () => {
    if (!help.section || !onNavigate) return;
    onNavigate("guide");
    // Wait for the guide tab to render, then scroll with offset for sticky headers (104px)
    setTimeout(() => {
      const el = document.getElementById(help.section);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 150);
  };

  return (
    <span
      className="flow-tab-help-chip"
      onClick={handleClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: `3px ${space[2] + 2}px`,
        borderRadius: layout.radiusTag + 1,
        background: `${c.accent}06`,
        border: `1px solid ${c.accent}10`,
        flexShrink: 1, minWidth: 0, overflow: "hidden",
        cursor: help.section ? "pointer" : "default",
        transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
      }}
      onMouseEnter={e => { if (help.section) { e.currentTarget.style.background = `${c.accent}14`; e.currentTarget.style.borderColor = `${c.accent}25`; } }}
      onMouseLeave={e => { e.currentTarget.style.background = `${c.accent}06`; e.currentTarget.style.borderColor = `${c.accent}10`; }}
      title={help.section ? "Click to learn more in the Guide" : undefined}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
        <circle cx="8" cy="8" r="6.5" stroke={c.accent} strokeWidth="1.2" />
        <path d="M6.5 6.2a1.5 1.5 0 0 1 2.83.7c0 1-1.33 1.2-1.33 1.2" stroke={c.accent} strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.6" fill={c.accent} />
      </svg>
      <span style={{
        fontFamily: typo.bodyXs.font, fontSize: typo.bodyXs.size,
        color: c.textMid, fontWeight: 500, fontStyle: "italic",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{help.text}</span>
    </span>
  );
}


/* ════════════════════════════════════════════════════════════════════
   DAY RHYTHM PILL — contextual day indicator in context bar
   ════════════════════════════════════════════════════════════════════ */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayRhythmPill({ onNavigateToGuide }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const currentDay = new Date().getDay();
  const rhythm = DAY_RHYTHM[currentDay];
  if (!rhythm) return null;
  const color = rhythm.color();

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span ref={ref} className="flow-day-rhythm" style={{ position: "relative", flexShrink: 0 }}>
      <span
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: `4px ${space[2]}px`,
          height: 24, boxSizing: "border-box",
          borderRadius: layout.radiusTag + 1,
          background: `${color}12`,
          border: `1px solid ${color}25`,
          fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
          fontWeight: typo.monoSm.weight, letterSpacing: typo.monoSm.tracking,
          color, lineHeight: 1, cursor: "pointer",
          whiteSpace: "nowrap",
          transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${color}20`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = `${color}12`; }}
      >
        <span style={{ fontSize: 11, lineHeight: 1 }}>{rhythm.icon}</span>
        {rhythm.label}
      </span>

      {/* Popup */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          zIndex: 900, minWidth: 200,
          background: c.surfaceOverlay,
          border: `1px solid ${c.border}`,
          borderRadius: layout.radiusMd,
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          padding: `${space[3]}px`,
          fontFamily: typo.bodyXs.font,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.08em", color: c.textDim,
            marginBottom: space[2],
          }}>
            Weekly rhythm
          </div>
          {DAY_RHYTHM.map((r, i) => {
            const rc = r.color();
            const isToday = i === currentDay;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: `4px ${space[2]}px`,
                borderRadius: layout.radiusTag,
                background: isToday ? `${rc}15` : "transparent",
                marginBottom: 2,
              }}>
                <span style={{
                  width: 32, fontSize: 11, color: isToday ? c.text : c.textDim,
                  fontWeight: isToday ? 600 : 400,
                  fontFamily: typo.monoSm.font,
                }}>
                  {DAY_NAMES[i]}
                </span>
                <span style={{ fontSize: 11, lineHeight: 1 }}>{r.icon}</span>
                <span style={{
                  fontSize: 12, color: isToday ? rc : c.textMid,
                  fontWeight: isToday ? 600 : 400,
                  flex: 1,
                }}>
                  {r.label}
                </span>
              </div>
            );
          })}
          {/* Deeplink to Guide */}
          <div
            onClick={() => {
              setOpen(false);
              if (onNavigateToGuide) {
                onNavigateToGuide();
                setTimeout(() => {
                  const el = document.getElementById("weekly-rhythm");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 120);
              }
            }}
            style={{
              marginTop: space[2], paddingTop: space[2],
              borderTop: `1px solid ${c.border}`,
              display: "flex", alignItems: "center", gap: 4,
              cursor: "pointer",
              fontSize: 11, color: c.accent,
              fontFamily: typo.monoSm.font, fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = c.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = c.accent; }}
          >
            Learn more in Guide →
          </div>
        </div>
      )}
    </span>
  );
}


/* ════════════════════════════════════════════════════════════════════
   NOTIFICATION BELL — urgency-tiered project notification center
   Action Required (red) · Heads Up (amber) · FYI (gray)
   ════════════════════════════════════════════════════════════════════ */
const NOTIF_TIERS = {
  action: { key: "action", label: "Action Required", color: c.red },
  heads:  { key: "heads",  label: "Heads Up",        color: c.amber },
  fyi:    { key: "fyi",    label: "FYI",             color: c.textDim },
};

function NotificationBell({ projects = [], people = [], currentPerson, onNavigate }) {
  const devRef = useDevLabel('NotificationBell', 'src/components/AppShell.jsx', 'Urgency-tiered project notification center');
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("all"); // all | action | heads | fyi
  const ref = React.useRef(null);
  const [seen, setSeen] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("flow_notif_seen") || "[]")); }
    catch { return new Set(); }
  });
  // Re-derive when the dev activity log changes (live updates).
  const [_evVer, _setEvVer] = React.useState(0);
  React.useEffect(() => {
    if (!isDevSeedMode()) return;
    return devStore.subscribe(() => _setEvVer(v => v + 1));
  }, []);

  const notifications = React.useMemo(
    () => buildNotifications({ projects, people, viewer: currentPerson }),
    [projects, people, currentPerson, _evVer]
  );

  const persistSeen = (next) => {
    try { localStorage.setItem("flow_notif_seen", JSON.stringify([...next])); } catch { /* ignore */ }
  };
  const markSeen = React.useCallback((id) => {
    setSeen(prev => { const next = new Set(prev); next.add(id); persistSeen(next); return next; });
  }, []);
  const markAllSeen = React.useCallback(() => {
    setSeen(prev => { const next = new Set(prev); notifications.forEach(n => next.add(n.id)); persistSeen(next); return next; });
  }, [notifications]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isUnread = (n) => !seen.has(n.id);
  const unreadByTier = { action: 0, heads: 0, fyi: 0 };
  notifications.forEach(n => { if (isUnread(n)) unreadByTier[n.tier] += 1; });
  const actionUnread = unreadByTier.action;           // bell badge = Action Required only
  const totalUnread = unreadByTier.action + unreadByTier.heads + unreadByTier.fyi;

  const visible = notifications.filter(n => tab === "all" ? true : n.tier === tab);

  const openNotif = (n) => {
    markSeen(n.id);
    setOpen(false);
    if (onNavigate && n.projectId) onNavigate("projects", n.projectId);
  };

  return (
    <div ref={(el) => { ref.current = el; if (devRef) devRef.current = el; }} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(v => !v); }}
        style={{
          width: 34, height: 34, borderRadius: layout.radiusSm,
          border: `1px solid ${open ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}`,
          background: open ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
        }}
        title={`Notifications${actionUnread > 0 ? ` — ${actionUnread} action required` : ""}`}
        aria-label={`Notifications, ${actionUnread} action required`}
      >
        {/* Bell icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? c.orange : c.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Action-Required count badge (red) — only Action Required, not total */}
        {actionUnread > 0 && (
          <div style={{
            position: "absolute", top: -3, right: -3, minWidth: 16, height: 16,
            padding: "0 4px", borderRadius: 999,
            background: c.red, color: "#fff",
            fontFamily: mono, fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 2px #1A1A1A`,
          }}>{actionUnread > 9 ? "9+" : actionUnread}</div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 6,
          width: 380, maxHeight: 520, display: "flex", flexDirection: "column",
          background: c.surfaceSolid, border: `1px solid ${c.border}`,
          borderRadius: layout.radiusMd, boxShadow: c.shadowElevated,
          zIndex: 200,
          animation: "flow-load-fade-in 0.15s ease-out",
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: c.text, letterSpacing: "0.04em" }}>NOTIFICATIONS</span>
            {totalUnread > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); markAllSeen(); }}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: c.accent, fontFamily: "inherit",
                }}
              >Mark all as read</button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, padding: "8px 10px", borderBottom: `1px solid ${c.border}` }}>
            {[
              { key: "all", label: "All", count: totalUnread },
              { key: "action", label: "Action Required", count: unreadByTier.action },
              { key: "heads", label: "Heads Up", count: unreadByTier.heads },
              { key: "fyi", label: "FYI", count: unreadByTier.fyi },
            ].map(t => {
              const active = tab === t.key;
              const accent = t.key === "action" ? c.red : t.key === "heads" ? c.amber : c.accent;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex: t.key === "action" ? "1 1 auto" : "0 0 auto",
                  padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${active ? accent : c.border}`,
                  background: active ? accent + "14" : "transparent",
                  color: active ? accent : c.textMid,
                  fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {t.label}
                  {t.count > 0 && (
                    <span style={{
                      fontFamily: mono, fontSize: 10, fontWeight: 700,
                      color: active ? accent : c.textDim,
                    }}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Items */}
          <div style={{ overflowY: "auto", scrollbarWidth: "thin", flex: 1 }}>
            {visible.length === 0 ? (
              <div style={{
                padding: "40px 20px", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 30 }}>🎉</span>
                <span style={{ fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600, color: c.text }}>You're all caught up</span>
                <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textDim }}>
                  {tab === "action" ? "Nothing needs your attention right now." : "No notifications in this view."}
                </span>
              </div>
            ) : visible.map(n => {
              const unread = isUnread(n);
              const tier = NOTIF_TIERS[n.tier];
              const nameAtStart = n.title.indexOf(n.projectName) === 0;
              return (
                <button
                  key={n.id}
                  onClick={() => openNotif(n)}
                  style={{
                    width: "100%", padding: "11px 14px",
                    background: unread && !n.resolved ? tier.color + "0A" : "transparent",
                    border: "none", borderBottom: `1px solid ${c.border}`,
                    borderLeft: `3px solid ${n.resolved ? c.border : (unread ? tier.color : "transparent")}`,
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    display: "flex", gap: 10, alignItems: "flex-start",
                    opacity: n.resolved ? 0.62 : 1,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = unread && !n.resolved ? tier.color + "0A" : "transparent"}
                >
                  {/* Urgency dot */}
                  <span aria-hidden="true" style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: n.resolved ? c.textDim : tier.color,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title — project name bold */}
                    <div style={{ fontSize: 12.5, color: c.text, fontWeight: unread ? 600 : 400, lineHeight: 1.4 }}>
                      {nameAtStart ? (<><b style={{ fontWeight: 700 }}>{n.projectName}</b>{n.title.slice(n.projectName.length)}</>) : n.title}
                      {n.resolved && (
                        <span style={{
                          marginLeft: 6, fontFamily: mono, fontSize: 9, fontWeight: 700,
                          color: c.green, background: c.green + "18", padding: "1px 5px",
                          borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>Resolved</span>
                      )}
                    </div>
                    {/* Meta: days since activity · owner · timestamp */}
                    <div style={{
                      fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim, marginTop: 3, lineHeight: 1.4,
                    }}>
                      {n.meta} · {timeAgo(n.ts)}
                    </div>
                    {/* CTA */}
                    {n.cta && !n.resolved && (
                      <span style={{
                        display: "inline-block", marginTop: 5,
                        fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 700,
                        color: n.tier === "action" ? c.red : c.accent,
                      }}>{n.cta} →</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════
   USER BADGE — avatar + dropdown with logout
   ════════════════════════════════════════════════════════════════════ */
function UserBadge({ user, personProfile, personName, onSignOut, onRefreshProfile, onNavigate }) {
  const devRef = useDevLabel('UserBadge', 'src/components/AppShell.jsx', 'User initials avatar — click opens People profile, caret opens account menu');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const displayName = personName || personProfile?.name || user?.user_metadata?.full_name || user?.email || "User";
  const avatar = user?.user_metadata?.avatar_url;

  const goToProfile = () => {
    if (onNavigate && displayName) onNavigate("people", displayName);
    setMenuOpen(false);
  };

  return (
    <div ref={(el) => { ref.current = el; if (devRef) devRef.current = el; }} style={{ position: "relative" }}>
      {/* Avatar — tap opens dropdown */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", padding: 0,
          background: "transparent", border: "none",
          cursor: "pointer", borderRadius: "50%",
        }}
        title={displayName}
        aria-label="Account menu"
      >
        {avatar ? (
          <img src={avatar} alt="" style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.25)",
            transition: "border-color 0.15s",
          }} />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#FFFFFF",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontSize: 12, fontWeight: 700, color: "#111111",
            letterSpacing: "0.02em",
            border: "none",
            transition: "opacity 0.15s",
          }}>
            {initialsOf(displayName)}
          </div>
        )}
      </button>

      {/* Account dropdown */}
      {menuOpen && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 6,
          width: 200, padding: "6px 0",
          background: c.surfaceSolid,
          border: `1px solid ${c.border}`,
          borderRadius: layout.radiusMd,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          zIndex: 200,
          animation: "fadeScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* User info */}
          <div style={{ padding: "8px 14px 10px", borderBottom: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 3 }}>{displayName}</div>
            {(() => {
              const email = user?.email || personProfile?.email;
              const role = personProfile?.role || personProfile?.roles?.name;
              const squad = personProfile?.squad || personProfile?.squads?.name;
              const meta = [role, squad].filter(Boolean).join(" · ");
              return (
                <>
                  {email && <div style={{ fontSize: 11, color: c.textDim, marginBottom: meta ? 2 : 0 }}>{email}</div>}
                  {meta && <div style={{ fontSize: 11, color: c.textDim }}>{meta}</div>}
                </>
              );
            })()}
          </div>

          {/* View profile */}
          <button
            onClick={goToProfile}
            style={{
              width: "100%", padding: "8px 14px", background: "transparent", border: "none",
              textAlign: "left", cursor: "pointer", fontSize: 13, color: c.text, fontFamily: "inherit",
            }}
            onMouseEnter={e => e.currentTarget.style.background = c.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >View profile</button>

          {/* Sign out */}
          <button
            onClick={() => { onSignOut(); setTimeout(() => window.location.reload(), 100); }}
            style={{
              width: "100%", padding: "8px 14px", background: "transparent", border: "none",
              textAlign: "left", cursor: "pointer", fontSize: 13, color: c.red, fontFamily: "inherit",
            }}
            onMouseEnter={e => e.currentTarget.style.background = c.redDim}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >Sign out</button>
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════
   COMPACT SEARCH — click trigger for command palette
   ════════════════════════════════════════════════════════════════════ */
function CompactSearch({ onClick }) {
  return (
    <div className="flow-hide-mobile flow-search-trigger" onClick={onClick} style={{
      position: "relative", width: 200, cursor: "pointer",
      display: "flex", alignItems: "center",
      padding: `8px ${space[3] + 2}px`, gap: 9,
      borderRadius: layout.radiusMd,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(255,255,255,0.08)",
      transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}`,
    }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.55, flexShrink: 0 }}>
        <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M11 11l3 3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{
        fontFamily: typo.bodyXs.font, fontSize: 14,
        color: "rgba(255,255,255,0.45)",
        flex: 1, whiteSpace: "nowrap", overflow: "hidden",
        userSelect: "none",
      }}>Search</span>
      <span style={{
        fontFamily: typo.monoSm.font, fontSize: 11,
        fontWeight: 600,
        color: "rgba(255,255,255,0.4)",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        padding: "1px 5px",
        borderRadius: layout.radiusTag + 1,
        lineHeight: 1.4, flexShrink: 0,
      }}>⌘K</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   INBOX BELL — @mention inbox in a modal dialog
   ════════════════════════════════════════════════════════════════════ */
function extractMentionsFromBody(text) {
  if (!text) return [];
  const mentions = new Set();
  const regex = /@([A-Z]\w*(?:\s[A-Z]\w*)?)/g;
  const regexLower = /@([a-z]\w*)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    mentions.add(m[1].toLowerCase());
    const fn = m[1].toLowerCase().split(/\s+/)[0];
    if (fn !== m[1].toLowerCase()) mentions.add(fn);
  }
  while ((m = regexLower.exec(text)) !== null) mentions.add(m[1].toLowerCase());
  return [...mentions];
}

function InboxBell({ projects, people, currentPerson, onNavigate, myLens = false }) {
  const [open, setOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("flow_inbox_read") || "[]")); }
    catch (_e) { return new Set(); }
  });
  const [replyingTo, setReplyingTo] = React.useState(null);
  const [replyDraft, setReplyDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [squadFilter, setSquadFilter] = React.useState(null);
  const [_evVer, _setEvVer] = React.useState(0);
  React.useEffect(() => {
    if (!isDevSeedMode()) return;
    return devStore.subscribe(() => _setEvVer(v => v + 1));
  }, []);

  const viewerName = currentPerson?.name;
  const peopleById = React.useMemo(() => {
    const m = new Map();
    (people || []).forEach(p => m.set(p.id, p));
    return m;
  }, [people]);
  const projectsById = React.useMemo(() => {
    const m = new Map();
    (projects || []).forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  const mentions = React.useMemo(() => {
    if (!viewerName || !isDevSeedMode()) return [];
    const vn = viewerName.toLowerCase();
    const firstName = viewerName.split(/\s+/)[0]?.toLowerCase();
    const allComments = (projects || []).flatMap(proj => {
      const comments = devStore.listComments(proj.id) || [];
      return comments.map(cmt => ({ ...cmt, _projectId: proj.id }));
    });
    return allComments
      .filter(cmt => {
        if (cmt.deleted_at) return false;
        if (cmt.author_id === currentPerson?.id) return false;
        const names = extractMentionsFromBody(cmt.body);
        return names.some(n => n === vn || n === firstName);
      })
      .map(cmt => ({
        comment: cmt,
        project: projectsById.get(cmt._projectId || cmt.project_id),
        author: peopleById.get(cmt.author_id),
      }))
      .sort((a, b) => new Date(b.comment.created_at) - new Date(a.comment.created_at));
  }, [projects, people, viewerName, currentPerson?.id, projectsById, peopleById]);

  // Weekly project updates: new projects + phase changes from the last 7 days
  const weeklyUpdates = React.useMemo(() => {
    if (!isDevSeedMode()) return [];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const updates = [];
    (projects || []).forEach(proj => {
      const events = devStore.listEvents(proj.id) || [];
      events.forEach(ev => {
        const ts = new Date(ev.created_at);
        if (ts < oneWeekAgo) return;
        const d = ev.details || {};
        if (ev.action === "project_created") {
          updates.push({
            id: ev.id, icon: "🆕", who: ev.user_name || "Someone",
            label: "created a new project ",
            projectName: proj.name, projectId: proj.id,
            squad: proj.squad, ts: ev.created_at,
          });
        } else if (ev.action === "project_phase_changed") {
          updates.push({
            id: ev.id, icon: "📦", who: ev.user_name || "Someone",
            label: "moved ",
            projectName: proj.name,
            phaseText: `from ${d.from || "?"} → ${d.to || "?"}`,
            projectId: proj.id, squad: proj.squad, ts: ev.created_at,
          });
        } else if (ev.action === "shoutout") {
          updates.push({
            id: ev.id, icon: "👏", who: d.from || ev.user_name || "Someone",
            label: "gave a shoutout for ",
            projectName: proj.name, projectId: proj.id,
            squad: proj.squad, ts: ev.created_at,
          });
        } else if (ev.action === "feedback") {
          updates.push({
            id: ev.id, icon: "💬", who: d.from || ev.user_name || "Someone",
            label: "left feedback on ",
            projectName: proj.name, projectId: proj.id,
            squad: proj.squad, ts: ev.created_at,
          });
        }
      });
    });
    updates.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return updates;
  }, [projects, _evVer]);

  const displayUnread = mentions.filter(m => !readIds.has(m.comment.id)).length;

  const markRead = React.useCallback((id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem("flow_inbox_read", JSON.stringify([...next])); } catch (_e) {}
      return next;
    });
  }, []);
  const markAllRead = React.useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      mentions.forEach(m => next.add(m.comment.id));
      try { sessionStorage.setItem("flow_inbox_read", JSON.stringify([...next])); } catch (_e) {}
      return next;
    });
  }, [mentions]);

  const submitReply = React.useCallback(async (projectId) => {
    if (!replyDraft.trim() || !projectId || !currentPerson?.id) return;
    setPosting(true);
    await addProjectCommentToDB(projectId, currentPerson.id, replyDraft.trim());
    setPosting(false);
    setReplyDraft("");
    setReplyingTo(null);
    window.__flowToast?.("Reply posted");
  }, [replyDraft, currentPerson?.id]);

  const highlightMention = (text, name) => {
    if (!text || !name) return text;
    const parts = [];
    let lastIdx = 0;
    const regex = new RegExp(`@(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
      parts.push(
        <span key={m.index} style={{
          background: c.accentDim, color: c.accent, fontWeight: 600,
          padding: "1px 5px", borderRadius: 4,
        }}>@{m[1]}</span>
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts.length ? parts : text;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={displayUnread > 0 ? `Inbox — ${displayUnread} unread` : "Inbox"}
        title="Inbox"
        style={{
          width: 34, height: 34, borderRadius: layout.radiusSm,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.08)",
          cursor: "pointer", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          outline: "none",
          transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 7l-10 7L2 7" />
        </svg>
        {displayUnread > 0 && (
          <span aria-hidden="true" style={{
            position: "absolute", top: 3, right: 3,
            minWidth: 16, height: 16, borderRadius: 999,
            background: "#FFFFFF", color: "#111111",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontSize: 9, fontWeight: 700,
            padding: "0 4px", boxSizing: "border-box",
            boxShadow: "0 0 0 2px #111111",
          }}>{displayUnread > 9 ? "9+" : displayUnread}</span>
        )}
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setReplyingTo(null); setSquadFilter(null); }} accent={c.accent} width={580}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[3] }}>
          <span style={{
            fontFamily: typo.displayMd.font, fontSize: typo.displayMd.size,
            fontWeight: typo.displayMd.weight, color: c.text,
          }}>Inbox</span>
          {!myLens && (() => {
            const allSquads = [...new Set((projects || []).map(p => p.squad).filter(Boolean))].sort();
            if (allSquads.length < 2) return null;
            return (
              <select
                value={squadFilter || ""}
                onChange={e => setSquadFilter(e.target.value || null)}
                style={{
                  padding: "6px 30px 6px 14px", borderRadius: 999,
                  border: `1px solid ${c.border}`, background: `${c.surfaceSolid} ${selChevron} no-repeat right 10px center / 12px 12px`,
                  fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 500,
                  color: c.text,
                  cursor: "pointer", outline: "none",
                  appearance: "none", WebkitAppearance: "none",
                }}
              >
                <option value="">All squads</option>
                {allSquads.map(sq => <option key={sq} value={sq}>{sq}</option>)}
              </select>
            );
          })()}
        </div>
        <div style={{ height: "min(560px, 65vh)", display: "flex", flexDirection: "column" }}>

        {/* ── Section 1: Mentions ── */}
        {(() => {
          const filtered = squadFilter
            ? mentions.filter(m => m.project?.squad === squadFilter)
            : mentions;
          const filteredUnread = filtered.filter(m => !readIds.has(m.comment.id)).length;
          return (
            <div style={{ marginBottom: space[4], flexShrink: 0, maxHeight: "50%", display: "flex", flexDirection: "column" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: space[3], flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                  <span style={{
                    fontFamily: mono, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim,
                  }}>Mentions</span>
                  {filteredUnread > 0 && (
                    <span style={{
                      padding: "1px 7px", borderRadius: 999,
                      background: c.accentDim, color: c.accent,
                      fontFamily: mono, fontSize: 10, fontWeight: 700,
                    }}>{filteredUnread}</span>
                  )}
                </div>
                {filteredUnread > 0 && (
                  <button type="button" onClick={markAllRead} style={{
                    padding: `3px 8px`, borderRadius: layout.radiusSm,
                    background: "transparent", border: `1px solid ${c.border}`,
                    fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600, color: c.textMid,
                    cursor: "pointer",
                  }}>Mark all read</button>
                )}
              </div>

              {filtered.length === 0 ? (
                <div style={{
                  padding: `${space[4]}px`, textAlign: "center",
                  background: c.surfaceAlt, borderRadius: layout.radiusSm,
                  fontFamily: typo.bodyMd.font, fontSize: 13, color: c.textDim,
                }}>
                  {squadFilter ? `No mentions in ${squadFilter}.` : "No mentions yet. When someone @-mentions you, it'll appear here."}
                </div>
              ) : (
                <div style={{
                  flex: 1, minHeight: 0,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  display: "flex", flexDirection: "column", gap: space[2],
                  paddingRight: space[1],
                }}>
                  {filtered.map(({ comment, project, author }) => {
                    const isUnread = !readIds.has(comment.id);
                    const isReplying = replyingTo === comment.id;
                    return (
                      <div key={comment.id} onClick={() => markRead(comment.id)} style={{
                        padding: `${space[3]}px ${space[4]}px`,
                        background: isUnread ? c.accentDim + "30" : c.surfaceAlt,
                        border: `1px solid ${isUnread ? c.accent + "25" : c.border}`,
                        borderRadius: layout.radiusSm,
                        cursor: "default",
                        transition: "background 150ms ease",
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          marginBottom: space[2],
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                            {isUnread && (
                              <span style={{
                                width: 7, height: 7, borderRadius: "50%", background: c.accent, flexShrink: 0,
                              }} />
                            )}
                            <span style={{
                              fontFamily: mono, fontSize: 10, fontWeight: 700,
                              color: c.amber || c.textMid, letterSpacing: "0.03em",
                            }}>
                              {project?.id || "?"} · {project?.name || "Unknown"}{project?.squad ? <span style={{ color: c.textDim, fontWeight: 500 }}> · {project.squad}</span> : ""}
                            </span>
                          </div>
                          <span title={fmtAbsolute(comment.created_at)} style={{
                            fontSize: 11, color: c.textDim, fontFamily: typo.bodySm.font, whiteSpace: "nowrap",
                          }}>
                            {timeAgo(comment.created_at)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: space[2], alignItems: "flex-start" }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: c.cyanDim, color: c.cyan,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: mono, fontSize: 10, fontWeight: 700, flexShrink: 0,
                            border: `1px solid ${c.cyan}33`,
                          }}>
                            {initialsOf(author?.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 700, color: c.text,
                              marginBottom: 2,
                            }}>{author?.name || "Unknown"}</div>
                            <div style={{
                              fontFamily: typo.bodyMd.font, fontSize: 13, lineHeight: 1.5, color: c.text,
                              whiteSpace: "pre-wrap", wordBreak: "break-word",
                            }}>
                              {highlightMention(comment.body, viewerName)}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          marginTop: space[2], display: "flex", alignItems: "center", gap: space[2],
                        }}>
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setReplyingTo(isReplying ? null : comment.id); setReplyDraft(""); }}
                            style={{
                              padding: `4px 10px`, borderRadius: layout.radiusSm,
                              background: isReplying ? c.accentDim : "transparent",
                              border: `1px solid ${isReplying ? c.accent + "40" : c.border}`,
                              fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                              color: isReplying ? c.accent : c.textMid,
                              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            <span style={{ fontSize: 12 }}>↩</span> Reply
                          </button>
                          <button type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(false);
                              onNavigate?.("projects", project?.id);
                            }}
                            style={{
                              padding: `4px 10px`, borderRadius: layout.radiusSm,
                              background: "transparent", border: `1px solid ${c.border}`,
                              fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600, color: c.textMid,
                              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            Go to project <span style={{ fontSize: 10 }}>→</span>
                          </button>
                        </div>
                        {isReplying && (
                          <div style={{ display: "flex", gap: space[2], marginTop: space[2] }}>
                            <input
                              type="text"
                              value={replyDraft}
                              onChange={(e) => setReplyDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(comment._projectId || comment.project_id); } }}
                              placeholder="Write a reply…"
                              disabled={posting}
                              autoFocus
                              style={{
                                flex: 1, padding: `7px 12px`, borderRadius: layout.radiusSm,
                                background: c.surface, border: `1px solid ${c.border}`,
                                fontFamily: typo.bodyMd.font, fontSize: 13, color: c.text, outline: "none",
                              }}
                            />
                            <button type="button"
                              onClick={() => submitReply(comment._projectId || comment.project_id)}
                              disabled={posting || !replyDraft.trim()}
                              style={{
                                padding: `7px 14px`, borderRadius: layout.radiusSm,
                                background: replyDraft.trim() && !posting ? c.accent : c.surfaceAlt,
                                color: replyDraft.trim() && !posting ? "#fff" : c.textDim,
                                border: "none", fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
                                cursor: replyDraft.trim() && !posting ? "pointer" : "not-allowed",
                              }}
                            >{posting ? "…" : "Reply"}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Section 2: Weekly Project Updates (own scroll) ── */}
        {(() => {
          const effectiveSquad = myLens ? (currentPerson?.squad || null) : squadFilter;
          const filtered = effectiveSquad
            ? weeklyUpdates.filter(u => u.squad === effectiveSquad)
            : weeklyUpdates;
          return (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: space[2],
                marginBottom: space[3], paddingTop: space[3],
                borderTop: `1px solid ${c.border}`, flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase", color: c.textDim,
                }}>Weekly Project Updates</span>
                {filtered.length > 0 && (
                  <span style={{
                    padding: "1px 7px", borderRadius: 999,
                    background: c.surfaceAlt, border: `1px solid ${c.border}`,
                    fontFamily: mono, fontSize: 10, fontWeight: 600, color: c.textMid,
                  }}>{filtered.length}</span>
                )}
              </div>

              {filtered.length === 0 ? (
                <div style={{
                  padding: `${space[4]}px`, textAlign: "center",
                  background: c.surfaceAlt, borderRadius: layout.radiusSm,
                  fontFamily: typo.bodyMd.font, fontSize: 13, color: c.textDim,
                }}>
                  {squadFilter ? `No updates in ${squadFilter} this week.` : "No project updates this week."}
                </div>
              ) : (
                <div style={{
                  flex: 1, minHeight: 0,
                  overflowY: "auto", overscrollBehavior: "contain",
                  display: "flex", flexDirection: "column", gap: 1,
                  paddingRight: space[1],
                }}>
                  {filtered.map((upd, i) => (
                    <div key={upd.id || i} style={{
                      display: "flex", alignItems: "center", gap: space[3],
                      padding: `${space[2] + 2}px ${space[3]}px`,
                      borderRadius: layout.radiusSm,
                      background: c.surfaceAlt,
                      border: `1px solid ${c.border}`,
                      marginBottom: 2,
                    }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: layout.radiusXs,
                        background: upd.icon === "🆕" ? c.greenDim : upd.icon === "👏" ? c.accentDim || c.amberDim : upd.icon === "💬" ? c.cyanDim || c.surfaceAlt : c.amberDim,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, flexShrink: 0,
                      }}>{upd.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: typo.bodyMd.font, fontSize: 13, color: c.text, lineHeight: 1.5,
                        }}>
                          <span style={{ fontWeight: 600 }}>{upd.who}</span>{" "}
                          {upd.label}
                          <button type="button" onClick={() => { setOpen(false); onNavigate?.("projects", upd.projectId); }} style={{
                            background: "transparent", border: "none", padding: 0, margin: 0,
                            fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600,
                            color: c.accent, cursor: "pointer", textDecoration: "underline",
                            textUnderlineOffset: 2, textDecorationThickness: 1,
                          }}>{upd.projectName}</button>
                          {upd.phaseText && (
                            <span style={{ color: c.textMid }}>{" "}{upd.phaseText}</span>
                          )}
                        </div>
                        {upd.squad && (
                          <span style={{
                            display: "inline-block", marginTop: 2,
                            padding: "1px 6px", borderRadius: 999,
                            background: c.surface, border: `1px solid ${c.border}`,
                            fontFamily: mono, fontSize: 9, fontWeight: 600, color: c.textDim,
                          }}>{upd.squad}</span>
                        )}
                      </div>
                      <span style={{
                        fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim,
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>{timeAgo(upd.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        </div>
      </Modal>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ANNOUNCEMENTS — megaphone icon + modal
   ════════════════════════════════════════════════════════════════════
   Shows an accent-orange dot when the newest announcement's date is
   later than `flow_announcements_last_seen` in localStorage. Opening
   the modal stamps the marker and clears the dot.
   Data source: src/data/announcements.js (static). See that file for
   schema + how to publish a new entry. */
const LAST_SEEN_KEY = "flow_announcements_last_seen";

function AnnouncementsBell({ projects = [], people = [], currentPerson, onNavigate }) {
  const devRef = useDevLabel('AnnouncementsBell', 'src/components/AppShell.jsx', 'Megaphone button in header; opens a modal with the announcement timeline.');
  const [open, setOpen] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState(() => {
    try { return localStorage.getItem(LAST_SEEN_KEY) || ""; } catch { return ""; }
  });

  // Newest-first date. Announcements are already authored newest-first,
  // but don't trust authoring order — derive from `date`.
  const newestDate = React.useMemo(() => {
    if (!ANNOUNCEMENTS.length) return "";
    return ANNOUNCEMENTS.reduce((acc, a) => (a.date > acc ? a.date : acc), ANNOUNCEMENTS[0].date);
  }, []);
  const sorted = React.useMemo(() => [...ANNOUNCEMENTS].sort((a, b) => (a.date < b.date ? 1 : -1)), []);
  const hasUnread = !!newestDate && newestDate > (lastSeen || "");

  const markAllRead = () => {
    // Stamp the newest announcement's date (or today, whichever is later).
    // Using "today" alone under-counts future-dated "Coming soon" items —
    // the dot would never clear until that date arrived.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const stamp = newestDate && newestDate > today ? newestDate : today;
      localStorage.setItem(LAST_SEEN_KEY, stamp);
      setLastSeen(stamp);
    } catch { /* localStorage may be disabled — no-op */ }
  };

  const [squadFilter, setSquadFilter] = React.useState("");

  const squads = React.useMemo(
    () => [...new Set(projects.map(p => p.squad).filter(Boolean))].sort(),
    [projects]
  );

  /* ── Shipped projects timeline (never cleared) ── */
  const shippedProjects = React.useMemo(() => {
    return projects
      .filter(p => p.status === "shipped")
      .filter(p => !squadFilter || p.squad === squadFilter)
      .map(p => {
        // Normalize date — shippedAt could be ISO datetime or date-only
        const raw = p.shippedAt || p.gaEnteredAt || "";
        const dateStr = raw.slice(0, 10); // "YYYY-MM-DD"
        return { ...p, _shipDate: dateStr };
      })
      .filter(p => p._shipDate && p._shipDate.length === 10 && !isNaN(new Date(p._shipDate + "T00:00:00")))
      .sort((a, b) => b._shipDate.localeCompare(a._shipDate));
  }, [projects, squadFilter]);

  const shippedGroupedByMonth = React.useMemo(() => {
    const groups = [];
    let currentMonth = null;
    let currentGroup = null;
    for (const p of shippedProjects) {
      const mk = p._shipDate.slice(0, 7);
      if (mk !== currentMonth) {
        currentMonth = mk;
        const d = new Date(p._shipDate + "T00:00:00");
        currentGroup = { month: mk, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(p);
    }
    return groups;
  }, [shippedProjects]);

  const featureTypeColor = (type) => {
    const m = {
      New:         { color: c.green,  bg: "#059669" + "18" },
      Fix:         { color: c.red,    bg: "#DC2626" + "18" },
      Enhancement: { color: c.blue,   bg: "#1D4ED8" + "18" },
      "UI/UX":     { color: c.purple, bg: "#6D28D9" + "18" },
    };
    return m[type] || m.New;
  };

  const openPanel = () => { setOpen(true); markAllRead(); };
  const closePanel = () => setOpen(false);

  return (
    <>
      <button
        ref={devRef}
        type="button"
        onClick={openPanel}
        aria-label={hasUnread ? "Announcements — unread updates" : "Announcements"}
        title="Announcements"
        style={{
          width: 34, height: 34, borderRadius: layout.radiusSm,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.08)",
          cursor: "pointer", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          outline: "none",
          transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        onFocus={e => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.3)"; }}
        onBlur={e => { e.currentTarget.style.boxShadow = "none"; }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <line x1="12" y1="2" x2="12" y2="4" />
        </svg>
        {hasUnread && (
          <span aria-hidden="true" style={{
            position: "absolute", top: 6, right: 6,
            width: 8, height: 8, borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 0 0 2px #111111",
          }} />
        )}
      </button>

      <Modal open={open} onClose={closePanel} title="What's New" accent={c.accent} width={560}>
        <div style={{ maxHeight: 520, overflowY: "auto", marginRight: -space[2], paddingRight: space[2] }}>
          {/* ── Squad filter ── */}
          {squads.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: space[3] }}>
              <select
                value={squadFilter}
                onChange={e => setSquadFilter(e.target.value)}
                style={{
                  height: 28, padding: `0 ${space[2] + 20}px 0 ${space[2]}px`, borderRadius: layout.radiusSm,
                  border: `1px solid ${c.border}`, background: `${c.surfaceSolid} ${selChevron} no-repeat right ${space[2]}px center / 12px 12px`, color: c.text,
                  fontFamily: typo.monoSm.font, fontSize: 11, cursor: "pointer", outline: "none",
                  appearance: "none", WebkitAppearance: "none",
                }}
              >
                <option value="">All squads</option>
                {squads.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {shippedProjects.length === 0 ? (
            <div style={{
              padding: `${space[5]}px`, textAlign: "center",
              borderRadius: layout.radiusSm, background: c.surfaceAlt,
            }}>
              <div style={{ fontSize: 28, marginBottom: space[2] }}>🚀</div>
              <div style={{ fontFamily: typo.bodyMd.font, fontSize: 13, color: c.textDim }}>
                No shipped projects yet. When a project is shipped, it'll appear here.
              </div>
            </div>
          ) : (
            shippedGroupedByMonth.map(group => (
              <div key={group.month} style={{ marginBottom: space[5] }}>
                {/* ── Month header ── */}
                <div style={{
                  display: "flex", alignItems: "center", gap: space[3],
                  padding: `${space[1]}px 0 ${space[3]}px`,
                }}>
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: 11,
                    fontWeight: 700, color: c.textDim,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    flexShrink: 0,
                  }}>{group.label}</span>
                  <span aria-hidden="true" style={{ flex: 1, height: 1, background: c.border }} />
                </div>

                {group.items.map((proj, i) => {
                  const d = new Date(proj._shipDate + "T00:00:00");
                  const dayLabel = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
                  const ftc = featureTypeColor(proj.gaFeatureType);
                  return (
                    <div
                      key={proj.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px 1fr",
                        gap: space[3],
                        padding: `${space[3]}px 0`,
                        borderTop: "none",
                      }}
                    >
                      {/* Date column */}
                      <div style={{
                        fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700,
                        color: c.text,
                        letterSpacing: "0.02em",
                        fontVariantNumeric: "tabular-nums",
                        paddingTop: 2,
                        lineHeight: 1.4,
                      }}>{dayLabel}</div>

                      {/* Content column */}
                      <div style={{ minWidth: 0 }}>
                        {/* Row 1: Project name + release type tag */}
                        <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: 6 }}>
                          <span style={{
                            fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 700,
                            color: c.text, lineHeight: 1.3,
                            flex: 1, minWidth: 0,
                          }}>{proj.name}</span>
                          <span style={{
                            fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            padding: "2px 6px", borderRadius: layout.radiusXs,
                            background: ftc.bg, color: ftc.color,
                            flexShrink: 0,
                          }}>{proj.gaFeatureType || "New"}</span>
                        </div>

                        {/* Row 2: Owner | Squad */}
                        <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: 6 }}>
                          <span style={{
                            fontFamily: typo.bodySm.font, fontSize: 12, color: c.cyan, fontWeight: 600,
                          }}>{proj.owner}</span>
                          <span style={{ color: c.textDim, fontSize: 11 }}>|</span>
                          <span style={{
                            fontFamily: typo.bodySm.font, fontSize: 12, color: c.textMid,
                          }}>{proj.squad}</span>
                        </div>

                        {/* Row 3: Release note */}
                        {proj.gaReleaseNote && (
                          <div style={{
                            fontFamily: typo.bodyMd.font, fontSize: 13,
                            color: c.textMid, lineHeight: 1.55,
                            marginBottom: space[2],
                          }}>{proj.gaReleaseNote}</div>
                        )}

                        {/* Row 4: Action buttons */}
                        <div style={{ display: "flex", gap: space[2] }}>
                          {[
                            { label: "Shoutout", icon: "👏", action: () => {
                              const viewerName = currentPerson?.name || people?.[0]?.name || "AJ";
                              if (isDevSeedMode()) {
                                devStore.logEvent({ projectId: proj.id, action: "shoutout", userName: viewerName, details: { from: viewerName, projectName: proj.name } });
                              }
                              window.__flowToast?.(`🎉 Shoutout sent for ${proj.name}!`);
                            }},
                            { label: "Feedback", icon: "💬", action: () => { closePanel(); sessionStorage.setItem("flow_scroll_to", "feedback"); setTimeout(() => onNavigate?.("projects", proj.id), 100); } },
                            { label: "View", icon: "→", action: () => { closePanel(); setTimeout(() => onNavigate?.("projects", proj.id), 100); } },
                          ].map(btn => (
                            <button key={btn.label} type="button" onClick={btn.action} style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 999,
                              background: "transparent", border: `1px solid ${c.border}`,
                              color: c.textMid, fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600,
                              cursor: "pointer", transition: "border-color 100ms ease, color 100ms ease",
                            }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMid; }}
                            >
                              <span style={{ fontSize: 11, lineHeight: 1 }}>{btn.icon}</span>
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: space[4], paddingTop: space[3], borderTop: `1px solid ${c.border}` }}>
          <Btn variant="ghost" onClick={closePanel}>Close</Btn>
        </div>
      </Modal>
    </>
  );
}
