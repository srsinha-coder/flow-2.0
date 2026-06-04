// Flow — Gantt Chart Component
// Pure CSS/div-based timeline visualization, no external chart libs
import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { c, typo, space, layout, motion, phaseColors as getPhaseColors, phaseMids as getPhaseMids } from "../styles/theme";
import { getActiveTracks } from "../lib/tracks";
import useDevLabel from "../hooks/useDevLabel";

/* ── Helpers ── */
const parseDate = (s) => new Date(s + "T00:00:00");
const mondayOf = (d) => { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const diffDays = (a, b) => Math.round((b - a) / 86400000);
const fmtMonth = (d) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const COL_W = 48;
const ROW_H = 48;
const HDR_H = 52;
const TOOLBAR_H = 40;
const LEFT_W = 260;

const BAR_COLOR = "#111111";
const SHIPPED_BAR_COLOR = "#166534";
const ALPHABETA_BAR_COLOR = "#86efac";
const BLOCKED_BAR_COLOR = "#fca5a5";


/* ══════════════════════════════════════════════════════════════════
   GANTT CHART
   ══════════════════════════════════════════════════════════════════ */
export default function GanttChart({ projects, today: todayProp, onProjectClick }) {
  const devRef = useDevLabel("GanttChart", "Interactive timeline visualization for project schedules with zoom and tooltips");
  const today = useMemo(() => parseDate(todayProp || new Date().toISOString().split("T")[0]), [todayProp]);

  const filteredProjects = projects;
  const pc = getPhaseColors();
  const pcMid = getPhaseMids();

  // ── Compute time axis ──
  const { weeks, timelineStart, totalWidth } = useMemo(() => {
    let min = new Date("2099-01-01"), max = new Date("2000-01-01");
    filteredProjects.forEach(p => {
      if (!p.startDate || !p.endDate) return;
      const s = parseDate(p.startDate), e = parseDate(p.endDate);
      if (s < min) min = s;
      if (e > max) max = e;
      if (p.actualStartDate) { const as = parseDate(p.actualStartDate); if (as < min) min = as; }
      if (p.actualEndDate) { const ae = parseDate(p.actualEndDate); if (ae > max) max = ae; }
    });
    const start = mondayOf(min);
    const end = addDays(mondayOf(max), 7);
    const wks = [];
    let cursor = new Date(start);
    while (cursor <= end) { wks.push(new Date(cursor)); cursor = addDays(cursor, 7); }
    return { weeks: wks, timelineStart: start, totalWidth: wks.length * COL_W };
  }, [filteredProjects]);

  // ── Sort flat by start date (skip projects missing dates) ──
  const sortedProjects = useMemo(() =>
    [...filteredProjects]
      .filter(p => p.startDate && p.endDate && p.status !== "upcoming")
      .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate)),
  [filteredProjects]);

  // ── Tooltip ──
  const [tooltip, setTooltip] = useState(null);
  const tooltipRef = useRef(null);

  const hideTimer = useRef(null);
  const showTooltip = useCallback((e, p) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    setTooltip({ project: p, x: e.clientX + 12, y: e.clientY + 12 });
  }, []);
  const hideTooltip = useCallback(() => {
    hideTimer.current = setTimeout(() => setTooltip(null), 150);
  }, []);
  const cancelHide = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);

  // Position tooltip
  useEffect(() => {
    if (tooltip && tooltipRef.current) {
      const el = tooltipRef.current;
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth - 16) el.style.left = `${tooltip.x - r.width - 16}px`;
      if (r.bottom > window.innerHeight - 16) el.style.top = `${window.innerHeight - r.height - 16}px`;
    }
  }, [tooltip]);

  // ── Sync scroll ──
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const scrolling = useRef(null);

  const onRightScroll = useCallback(() => {
    if (scrolling.current === "left") return;
    scrolling.current = "right";
    if (leftRef.current && rightRef.current) leftRef.current.scrollTop = rightRef.current.scrollTop;
    requestAnimationFrame(() => { scrolling.current = null; });
  }, []);

  const onLeftScroll = useCallback(() => {
    if (scrolling.current === "right") return;
    scrolling.current = "left";
    if (leftRef.current && rightRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
    requestAnimationFrame(() => { scrolling.current = null; });
  }, []);

  // ── Auto-scroll to today on mount ──
  useEffect(() => {
    if (rightRef.current) {
      const todayOff = diffDays(timelineStart, today) / 7 * COL_W;
      rightRef.current.scrollLeft = Math.max(0, todayOff - rightRef.current.clientWidth * 0.3);
    }
  }, [timelineStart, today]);

  // ── Build row data (flat list) ──
  const rows = useMemo(() =>
    sortedProjects.map(p => ({ type: "project", project: p })),
  [sortedProjects]);

  // ── Bar position calc ──
  const barPos = useCallback((startDate, endDate) => {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    const left = diffDays(timelineStart, s) / 7 * COL_W;
    const width = Math.max(COL_W * 0.4, diffDays(s, e) / 7 * COL_W);
    return { left, width };
  }, [timelineStart]);

  // ── Scroll timeline to a project's bar ──
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);
  const scrollToProject = useCallback((p) => {
    if (!rightRef.current || !p.startDate) return;
    const { left } = barPos(p.startDate, p.endDate);
    rightRef.current.scrollTo({ left: Math.max(0, left - rightRef.current.clientWidth * 0.15), behavior: "smooth" });
    setHighlightId(p.id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1500);
  }, [barPos]);

  const todayOffset = diffDays(timelineStart, today) / 7 * COL_W;

  // ── Month spans for header ──
  const monthSpans = useMemo(() => {
    const spans = [];
    let i = 0;
    while (i < weeks.length) {
      const m = weeks[i].getMonth(), y = weeks[i].getFullYear();
      let count = 0;
      while (i + count < weeks.length && weeks[i + count].getMonth() === m && weeks[i + count].getFullYear() === y) count++;
      spans.push({ label: fmtMonth(weeks[i]), width: count * COL_W });
      i += count;
    }
    return spans;
  }, [weeks]);

  return (
    <div ref={devRef} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", borderRadius: layout.radius, border: `1px solid ${c.border}` }}>

      {/* ── Legend ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: space[4], flexShrink: 0,
        padding: `${space[2]}px ${space[4]}px`,
        borderBottom: `1px solid ${c.border}`, background: c.bg,
      }}>
        {[
          { label: "Shipped", swatch: { background: SHIPPED_BAR_COLOR } },
          { label: "In flight", swatch: { background: BAR_COLOR } },
          { label: "Blocked", swatch: { background: "#ef4444" } },
          { label: "Deprioritized", swatch: { background: `repeating-linear-gradient(-45deg, #9ca3af, #9ca3af 3px, #d1d5db 3px, #d1d5db 6px)` } },
        ].map(item => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 10, borderRadius: 3, ...item.swatch }} />
            <span style={{ fontFamily: typo.bodySm.font, fontSize: 11, fontWeight: 600, color: c.textMid }}>{item.label}</span>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* ── LEFT PANEL (frozen) ── */}
      <div ref={leftRef} onScroll={onLeftScroll} style={{
        width: LEFT_W, flexShrink: 0, background: c.bg,
        borderRight: `1px solid ${c.border}`,
        overflowY: "auto", overflowX: "hidden",
        boxShadow: `4px 0 16px ${c.shadow}`,
        scrollbarWidth: "thin", scrollbarColor: `${c.border} transparent`,
      }}>
        {/* Header — Project Timeline + count */}
        <div style={{ height: HDR_H, position: "sticky", top: 0, background: c.bg, zIndex: 3,
          borderBottom: `1px solid ${c.border}`,
          display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${space[4]}px`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text, letterSpacing: "-0.2px", lineHeight: 1.3 }}>Project Timeline</div>
          <div style={{ fontSize: 11, color: c.textDim, fontWeight: 500, lineHeight: 1.3 }}>
            {sortedProjects.length} project{sortedProjects.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => {
          const p = row.project;
          return (
            <div key={p.id + "-left"} onClick={() => scrollToProject(p)}
              style={{
                height: ROW_H, display: "flex", alignItems: "center", padding: `0 ${space[4]}px`,
                gap: space[2], cursor: "pointer", borderBottom: `1px solid rgba(0,0,0,0.04)`,
                transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                background: highlightId === p.id ? "rgba(0,0,0,0.04)" : "transparent",
              }}
              onMouseEnter={(e) => { if (highlightId !== p.id) e.currentTarget.style.background = `rgba(0,0,0,0.03)`; }}
              onMouseLeave={(e) => { if (highlightId !== p.id) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.orange, letterSpacing: "0.3px",
                fontFamily: typo.monoSm.font, flexShrink: 0, minWidth: 32 }}>{p.id}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: c.textDim,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{p.squad}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── RIGHT PANEL (scrollable timeline) ── */}
      <div ref={rightRef} onScroll={onRightScroll} style={{
        flex: 1, overflow: "auto", background: c.surfaceData, position: "relative",
        scrollbarWidth: "thin", scrollbarColor: `${c.border} transparent`,
      }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 4, background: c.bg,
          borderBottom: `1px solid ${c.border}`, height: HDR_H, width: totalWidth, minWidth: "100%" }}>
          {/* Month row */}
          <div style={{ display: "flex", height: 26 }}>
            {monthSpans.map((ms, i) => (
              <div key={i} style={{ width: ms.width, flexShrink: 0, fontSize: 12, fontWeight: 700,
                color: c.textMid, padding: "5px 0 0 0", textAlign: "center",
                borderLeft: `1px solid rgba(0,0,0,0.06)`, letterSpacing: "0.2px",
                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{ms.label}</div>
            ))}
          </div>
          {/* Week row */}
          <div style={{ display: "flex", height: 26 }}>
            {weeks.map((w, i) => {
              const isMonthStart = i === 0 || w.getMonth() !== weeks[i - 1].getMonth();
              return (
                <div key={i} style={{ width: COL_W, flexShrink: 0, fontSize: 11, color: c.textDim,
                  textAlign: "center", padding: "3px 0",
                  borderLeft: `1px solid ${isMonthStart ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)"}` }}>
                  {fmtShort(w)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ position: "relative", width: totalWidth, minWidth: "100%" }}>
          {/* Grid lines */}
          {weeks.map((w, i) => {
            const isMonthStart = i === 0 || w.getMonth() !== weeks[i - 1].getMonth();
            return (
              <div key={`g-${i}`} style={{ position: "absolute", top: 0, bottom: 0,
                left: i * COL_W, width: 1, pointerEvents: "none", zIndex: 0,
                background: isMonthStart ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.02)" }} />
            );
          })}

          {/* Today line */}
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: todayOffset, width: 2, zIndex: 3,
            background: c.accent, opacity: 0.5, pointerEvents: "none",
          }}>
            <span style={{ position: "absolute", top: 4, left: 6, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.8px", color: c.accent, whiteSpace: "nowrap" }}>TODAY</span>
          </div>

          {/* Rows */}
          {rows.map((row, i) => {
            const p = row.project;
            const { left, width } = barPos(p.startDate, p.endDate);
            const isDepri = p.status === "deprioritized";
            const isShipped = p.status === "shipped" || p.status === "complete";
            const isBlocked = p.status === "blocked" || p.isBlocked;
            const active = getActiveTracks(p);
            const hasAlphaBeta = active.some(t => t === "Alpha" || t === "Beta");
            // Base bar is black (active); shipped green; alpha/beta light green.
            const barFill = isShipped ? SHIPPED_BAR_COLOR : hasAlphaBeta ? ALPHABETA_BAR_COLOR : BAR_COLOR;

            // Status segments: red during blocked periods, grey during depri
            // periods, computed as % offsets within the bar so the bar shows
            // black → red (blocked) → black (resumed) → grey (depri), etc.
            const barStartMs = p.startDate ? parseDate(p.startDate).getTime() : null;
            const barEndMs = p.endDate ? parseDate(p.endDate).getTime() : null;
            const barSpan = (barStartMs != null && barEndMs != null) ? (barEndMs - barStartMs) : 0;
            const statusSegments = [];
            if (barSpan > 0) {
              const hist = (p.statusHistory && p.statusHistory.length)
                ? p.statusHistory
                : (isBlocked && p.blockedAt ? [{ type: "blocked", from: p.blockedAt, to: null }]
                  : isDepri && p.deprioritizedAt ? [{ type: "deprioritized", from: p.deprioritizedAt, to: null }]
                  : []);
              for (const h of hist) {
                const f = parseDate(h.from.slice(0, 10)).getTime();
                const t = h.to ? parseDate(h.to.slice(0, 10)).getTime() : Date.now();
                const segStart = Math.max(f, barStartMs);
                const segEnd = Math.min(t, barEndMs);
                if (segEnd <= segStart) continue;
                statusSegments.push({
                  type: h.type,
                  leftPx: left + ((segStart - barStartMs) / barSpan) * width,
                  widthPx: ((segEnd - segStart) / barSpan) * width,
                });
              }
            }

            return (
              <div key={p.id + "-bar"} style={{ height: ROW_H, position: "relative",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
                background: highlightId === p.id ? "rgba(0,0,0,0.04)" : "transparent",
                transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
              }}>

                {/* Main bar */}
                <div
                  className="flow-gantt-bar"
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProjectClick?.(p.id); } }}
                  onClick={() => onProjectClick?.(p.id)}
                  onMouseEnter={(e) => { showTooltip(e, p); const el = e.currentTarget; el.style.willChange = "transform, filter"; el.style.filter = "brightness(1.08)"; el.style.boxShadow = "0 4px 10px rgba(0,0,0,0.12)"; el.style.zIndex = 5; }}
                  onMouseLeave={(e) => { hideTooltip(); const el = e.currentTarget; el.style.transform = "scale(1)"; el.style.filter = "none"; el.style.boxShadow = "none"; el.style.zIndex = 1; setTimeout(() => { if (el) el.style.willChange = "auto"; }, 160); }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  style={{
                    position: "absolute", top: 12, height: 24, left, width,
                    borderRadius: 5, cursor: "pointer", overflow: "hidden",
                    display: "flex", alignItems: "center",
                    transformOrigin: "center",
                    transition: `transform ${motion.fast.duration} ${motion.fast.easing}, filter ${motion.fast.duration} ${motion.fast.easing}, box-shadow ${motion.fast.duration} ${motion.fast.easing}`,
                  }}
                >
                  {/* Base fill (black / shipped green / alpha-beta) */}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: 5,
                    background: barFill,
                  }} />
                  {/* Track labels on bar */}
                  {(active.length > 0 || isShipped) && (
                    <span style={{
                      position: "relative", zIndex: 2, paddingLeft: 8,
                      fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600,
                      letterSpacing: "0.03em",
                      color: hasAlphaBeta ? "#14532d" : "#ffffff",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      lineHeight: "24px", pointerEvents: "none",
                    }}>
                      {(isShipped ? ["Shipped"] : active).join(" · ")}
                    </span>
                  )}
                </div>

                {/* Blocked / deprioritized blocks — overlay matching bar height */}
                {statusSegments.map((s, si) => (
                  <div key={`seg-${si}`}
                    title={s.type === "blocked" ? "Blocked" : "Deprioritized"}
                    style={{
                      position: "absolute", top: 12, height: 24,
                      left: s.leftPx, width: Math.max(4, s.widthPx),
                      borderRadius: 5, zIndex: 4, pointerEvents: "none",
                      ...(s.type === "blocked"
                        ? { background: "#ef4444", border: "1px solid #dc2626" }
                        : {
                            background: `repeating-linear-gradient(-45deg, #9ca3af, #9ca3af 4px, #d1d5db 4px, #d1d5db 8px)`,
                            border: "1px solid #9ca3af",
                          }),
                    }} />
                ))}

                {/* Shipped rocket marker — positioned at the end of the bar */}
                {(p.phase === "GA" || p.status === "complete") && (
                  <div style={{
                    position: "absolute", top: 10, left: left + width + 4,
                    fontSize: 14, lineHeight: 1, pointerEvents: "none", zIndex: 2,
                  }}>🚀</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>{/* close left+right flex wrapper */}

      {/* ── Tooltip ── */}
      {tooltip && (() => {
        const p = tooltip.project;
        const active = getActiveTracks(p);
        const isShippedTip = p.status === "shipped" || p.status === "complete";

        return (
          <div ref={tooltipRef} style={{
            position: "fixed", left: tooltip.x, top: tooltip.y, zIndex: 100,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: `1px solid rgba(255,255,255,0.5)`, borderRadius: 10,
            padding: "14px 18px", minWidth: 220, maxWidth: 280, boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
            cursor: "pointer", pointerEvents: "auto",
          }}
          onClick={() => { setTooltip(null); if (onProjectClick) onProjectClick(p.id); }}
          onMouseEnter={cancelHide}
          onMouseLeave={hideTooltip}
          >
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{p.name}</span>
            </div>
            {/* Active track pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
              {isShippedTip ? (
                <span style={{
                  padding: "2px 7px", borderRadius: layout.radiusXs,
                  background: `${c.green}15`, color: c.green,
                  fontFamily: typo.bodyXs.font, fontSize: 11, fontWeight: 700,
                }}>Shipped</span>
              ) : active.length > 0 ? active.map(t => (
                <span key={t} style={{
                  padding: "2px 7px", borderRadius: layout.radiusXs,
                  background: pcMid[t] || c.surfaceAlt,
                  color: pc[t] || c.textDim,
                  fontFamily: typo.bodyXs.font, fontSize: 11, fontWeight: 700,
                }}>{t}</span>
              )) : (
                <span style={{ fontSize: 11, color: c.textDim }}>No active tracks</span>
              )}
            </div>
            {p.isBlocked && (
              <div style={{ fontSize: 11, fontWeight: 700, color: c.red, background: c.redDim,
                padding: "3px 8px", borderRadius: layout.radiusXs, marginBottom: 6, textAlign: "center" }}>BLOCKED</div>
            )}
            {[
              ["Owner", p.owner || "—"],
              ["Squad", p.squad || "—"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: c.textDim }}>{label}</span>
                <span style={{ color: c.text, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
            <div style={{
              marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              fontSize: 11, color: c.accent, fontWeight: 600,
            }}>
              View project →
            </div>
          </div>
        );
      })()}
    </div>
  );
}
