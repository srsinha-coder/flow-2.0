import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { c, typo, space, layout, trackNames, phaseColors as getPhaseColors } from "../styles/theme";
import { getTrackStatus, getTrackActiveDays, getReleaseMilestone } from "../lib/tracks";

function fmtShort(iso) {
  if (!iso) return "—";
  const s = iso.length === 10 ? iso + "T00:00:00" : iso;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DAY_MS = 86_400_000;

function toDay(iso) {
  if (!iso) return null;
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).getTime();
}

export default function TrackGantt({ proj, onStartTrack, onCompleteTrack, onReopenTrack, canManage = true }) {
  const pc = useMemo(() => getPhaseColors(), []);
  const scrollRefs = useRef([]);
  const syncing = useRef(false);

  const { timeStart, timeEnd, todayPos, endDatePos, shippedPos, statusLines, statusBands, resumeDate } = useMemo(() => {
    const now = Date.now();
    let earliest = now;
    let latest = now + 14 * DAY_MS;

    for (const name of trackNames) {
      const t = proj.tracks?.[name];
      if (!t) continue;
      for (const p of t.periods) {
        const s = toDay(p.started_at);
        if (s && s < earliest) earliest = s;
        const e = p.completed_at ? toDay(p.completed_at) : now;
        if (e > latest) latest = e;
      }
    }
    if (proj.startDate) {
      const s = toDay(proj.startDate);
      if (s && s < earliest) earliest = s;
    }
    if (proj.endDate) {
      const e = toDay(proj.endDate);
      if (e > latest) latest = e + 7 * DAY_MS;
    }
    // Include block/depri/resume dates in the visible range
    for (const h of (proj.statusHistory || [])) {
      const f = toDay(h.from); if (f && f < earliest) earliest = f; if (f && f > latest) latest = f;
      if (h.to) { const tt = toDay(h.to); if (tt && tt < earliest) earliest = tt; if (tt && tt > latest) latest = tt; }
    }
    earliest -= 3 * DAY_MS;
    latest += 7 * DAY_MS;
    const range = latest - earliest;
    const shipDate = proj.shippedAt || proj.gaEnteredAt;
    const shipP = (proj.status === "shipped" && shipDate) ? ((toDay(shipDate.slice(0, 10)) - earliest) / range) * 100 : null;

    // Vertical status lines + translucent bands for blocked/deprioritized periods
    const lines = [];
    const bands = [];
    let latestResume = null;
    for (const h of (proj.statusHistory || [])) {
      const fromPos = ((toDay(h.from) - earliest) / range) * 100;
      if (fromPos > 0 && fromPos < 100) {
        lines.push({ pos: fromPos, color: h.type === "blocked" ? c.red : c.textDim, label: h.type === "blocked" ? "Blocked" : "Deprioritized", dashed: false });
      }
      const endMs = h.to ? toDay(h.to) : now;
      const toPosClamped = Math.min(100, ((endMs - earliest) / range) * 100);
      const fromPosClamped = Math.max(0, fromPos);
      if (toPosClamped > fromPosClamped) {
        bands.push({ left: fromPosClamped, width: toPosClamped - fromPosClamped, color: h.type === "blocked" ? c.red : c.textDim });
      }
      if (h.to) {
        const toPos = ((toDay(h.to) - earliest) / range) * 100;
        if (toPos > 0 && toPos < 100) lines.push({ pos: toPos, color: c.green, label: "Resumed", dashed: true });
        if (!latestResume || toDay(h.to) > toDay(latestResume)) latestResume = h.to;
      }
    }

    return {
      timeStart: earliest, timeEnd: latest,
      todayPos: ((now - earliest) / range) * 100,
      endDatePos: proj.endDate ? ((toDay(proj.endDate) - earliest) / range) * 100 : null,
      shippedPos: shipP,
      statusLines: lines,
      statusBands: bands,
      resumeDate: latestResume,
    };
  }, [proj]);

  const timeRange = timeEnd - timeStart;

  function barStyle(started, completed) {
    const s = toDay(started);
    const e = completed ? toDay(completed) : Date.now();
    const left = ((s - timeStart) / timeRange) * 100;
    const width = Math.max(((e - s) / timeRange) * 100, 0.5);
    return { left: `${left}%`, width: `${width}%` };
  }

  const ROW_H = 36;
  const LABEL_W = 100;
  const DAYS_W = 44;
  const ACTION_W = 64;
  const VISIBLE_MONTHS = 4;

  const { months, weeks } = useMemo(() => {
    const ms = [];
    const ws = [];
    const range = timeEnd - timeStart;
    const d = new Date(timeStart);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    const cur = new Date(d);
    while (cur.getTime() < timeEnd) {
      const startPos = Math.max(((cur.getTime() - timeStart) / range) * 100, 0);
      const year = cur.getUTCFullYear();
      const month = cur.getUTCMonth();
      const nextMonth = new Date(Date.UTC(year, month + 1, 1));
      const endPos = Math.min(((nextMonth.getTime() - timeStart) / range) * 100, 100);
      const label = cur.toLocaleString("en", { month: "short", timeZone: "UTC" });
      if (endPos > 0 && startPos < 100) ms.push({ startPos, endPos, label });
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const weekSize = daysInMonth / 4;
      for (let w = 0; w < 4; w++) {
        const weekStart = new Date(Date.UTC(year, month, Math.floor(w * weekSize) + 1));
        const weekEnd = new Date(Date.UTC(year, month, Math.floor((w + 1) * weekSize) + 1));
        const wStartPos = Math.max(((weekStart.getTime() - timeStart) / range) * 100, 0);
        const wEndPos = Math.min(((weekEnd.getTime() - timeStart) / range) * 100, 100);
        if (wEndPos > 0 && wStartPos < 100) {
          ws.push({ startPos: wStartPos, endPos: wEndPos, label: `W${w + 1}`, isFirstOfMonth: w === 0 });
        }
      }
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return { months: ms, weeks: ws };
  }, [timeStart, timeEnd]);

  const scalePct = months.length > VISIBLE_MONTHS ? (months.length / VISIBLE_MONTHS) * 100 : 100;
  const needsScroll = scalePct > 100;

  // Sync all scroll containers
  const handleScroll = useCallback((e) => {
    if (syncing.current) return;
    syncing.current = true;
    const sl = e.target.scrollLeft;
    scrollRefs.current.forEach(el => {
      if (el && el !== e.target) el.scrollLeft = sl;
    });
    syncing.current = false;
  }, []);

  const addScrollRef = useCallback((el) => {
    if (el && !scrollRefs.current.includes(el)) scrollRefs.current.push(el);
  }, []);

  // Auto-scroll to today on mount
  useEffect(() => {
    if (!needsScroll) return;
    const el = scrollRefs.current[0];
    if (!el) return;
    requestAnimationFrame(() => {
      const sw = el.scrollWidth - el.clientWidth;
      if (sw <= 0) return;
      const target = (todayPos / 100) * el.scrollWidth - el.clientWidth * 0.33;
      const sl = Math.max(0, Math.min(target, sw));
      scrollRefs.current.forEach(r => { if (r) r.scrollLeft = sl; });
    });
  }, [needsScroll, todayPos]);

  const btnBase = {
    padding: "2px 8px", borderRadius: 4,
    fontFamily: typo.bodySm.font, fontSize: 10, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1.4,
  };

  const scrollStyle = needsScroll
    ? { flex: 1, overflowX: "auto", overflowY: "hidden" }
    : { flex: 1, overflow: "hidden" };

  // Track rows scroll is synced from header — use auto but hide scrollbar via CSS
  const scrollStyleHidden = needsScroll
    ? { flex: 1, overflowX: "auto", overflowY: "hidden" }
    : { flex: 1, overflow: "hidden" };

  const innerW = `${scalePct}%`;

  return (
    <div style={{
      background: c.surface, borderRadius: layout.radiusSm,
      border: `1px solid ${c.border}`, overflow: "hidden",
    }}>
      {/* ═══ TITLE ROW ═══ */}
      <div style={{
        padding: `${space[3]}px ${space[4]}px`,
        borderBottom: `1px solid ${c.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", color: c.textDim,
        }}>Track Timeline</span>
        <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
          {(proj.startDate || proj.endDate || proj.tentativeStartDate) && (() => {
            const milestone = getReleaseMilestone(proj);
            const history = proj.statusHistory || [];
            const hasHistory = history.length > 0;

            if (hasHistory) {
              // Segmented: start → first pause date (red/grey) | last resume → end
              const sorted = [...history].sort((a, b) => toDay(a.from) - toDay(b.from));
              const firstPause = sorted[0];
              const lastResume = [...sorted].reverse().find(h => h.to)?.to || null;
              const pauseColor = firstPause.type === "blocked" ? c.red : c.textDim;
              // Total active days = total span minus sum of paused durations
              const startMs = toDay(proj.startDate || proj.tentativeStartDate);
              const endMs = toDay(proj.endDate) || Date.now();
              let pausedMs = 0;
              for (const h of history) {
                const f = toDay(h.from); const t = h.to ? toDay(h.to) : Date.now();
                if (f && t > f) pausedMs += t - f;
              }
              const activeDays = Math.max(0, Math.round(((endMs - startMs) - pausedMs) / DAY_MS));
              return (
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
                  color: c.textMid, fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtShort(proj.startDate || proj.tentativeStartDate)}
                  {" → "}
                  <span style={{ color: pauseColor, fontWeight: 700 }}>{fmtShort(firstPause.from)}</span>
                  {lastResume && (() => {
                    // If the planned end date is already past (overdue while
                    // blocked), clamp the second segment to "→ Today".
                    const endPast = !proj.endDate || toDay(proj.endDate) < Date.now();
                    return <>{"  |  "}{fmtShort(lastResume)}{" → "}{endPast ? "Today" : fmtShort(proj.endDate)}</>;
                  })()}
                  <span style={{ color: c.textDim, fontWeight: 500 }}>{"  ["}{activeDays} active days{"]"}</span>
                </span>
              );
            }

            return (
              <span style={{
                fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
                color: c.textMid, fontVariantNumeric: "tabular-nums",
              }}>
                {fmtShort(proj.startDate || proj.tentativeStartDate)}
                {" → "}
                {fmtShort(proj.endDate)}
                {milestone?.date && (
                  <span style={{ color: milestone.stage === "Shipped" ? c.green : c.cyan, fontWeight: 700 }}>
                    {"  ·  "}{milestone.stage} on {fmtShort(milestone.date)}
                  </span>
                )}
              </span>
            );
          })()}
          {(() => {
            if (!proj.endDate || proj.status === "shipped") return null;
            const endMs = toDay(proj.endDate);
            const overdueDays = Math.floor((Date.now() - endMs) / DAY_MS);
            if (overdueDays <= 0) return null;
            return (
              <span style={{
                fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                letterSpacing: "0.04em", textTransform: "uppercase",
                padding: "2px 8px", borderRadius: layout.radiusXs,
                background: `${c.red}12`, color: c.red,
              }}>Overdue {overdueDays}d</span>
            );
          })()}
        </div>
      </div>

      {/* ═══ HEADER: months + weeks (scrollable) ═══ */}
      <div style={{ display: "flex", borderBottom: `1px solid ${c.border}` }}>
        <div style={{ width: LABEL_W, flexShrink: 0 }} />
        <div ref={addScrollRef} onScroll={handleScroll} className="flow-gantt-no-scroll" style={scrollStyle}>
          <div style={{ width: innerW, position: "relative", height: 40 }}>
            {/* Month labels */}
            {months.map((m, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${m.startPos}%`, width: `${m.endPos - m.startPos}%`,
                top: 0, height: 22,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                color: c.textMid, letterSpacing: "0.06em", textTransform: "uppercase",
                borderLeft: i > 0 ? `1px solid ${c.border}` : "none",
                pointerEvents: "none",
              }}>{m.label}</div>
            ))}
            {/* Week labels */}
            {weeks.map((w, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${w.startPos}%`, width: `${w.endPos - w.startPos}%`,
                top: 22, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 500,
                color: c.textDim, letterSpacing: "0.03em",
                borderLeft: w.isFirstOfMonth ? `1px solid ${c.border}` : `1px solid ${c.border}30`,
                pointerEvents: "none",
              }}>{w.label}</div>
            ))}
          </div>
        </div>
        <div style={{ width: DAYS_W + ACTION_W, flexShrink: 0 }} />
      </div>

      {/* ═══ TRACK ROWS ═══ */}
      {trackNames.map((name, i) => {
        const tStatus = getTrackStatus(proj, name);
        const days = getTrackActiveDays(proj, name);
        const trackData = proj.tracks?.[name];
        const color = pc[name] || c.textDim;

        return (
          <div key={name} style={{
            display: "flex", alignItems: "center",
            height: ROW_H,
          }}>
            {/* Label — fixed left */}
            <div style={{
              width: LABEL_W, flexShrink: 0,
              padding: `0 ${space[3]}px`,
              fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
              color: tStatus === "not_started" ? c.textDim : color,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: tStatus === "not_started" ? c.border : tStatus === "active" ? color : `${color}60`,
                flexShrink: 0,
              }} />
              {name}
            </div>

            {/* Timeline — synced scroll (hidden scrollbar, driven by header) */}
            <div ref={addScrollRef} onScroll={handleScroll} className="flow-gantt-no-scroll" style={scrollStyleHidden}>
              <div style={{ width: innerW, position: "relative", height: ROW_H }}>
                {/* Blocked / Deprioritized bands (translucent fill) */}
                {statusBands.map((b, i) => (
                  <div key={`band-${i}`} style={{
                    position: "absolute", left: `${b.left}%`, width: `${b.width}%`,
                    top: 0, bottom: 0, background: `${b.color}14`, zIndex: 0,
                  }} />
                ))}
                {/* Today line */}
                {todayPos > 0 && todayPos < 100 && (
                  <div style={{
                    position: "absolute", left: `${todayPos}%`, top: 0, bottom: 0,
                    width: 0, borderLeft: `2px dashed ${c.accent}60`, zIndex: 1,
                  }} />
                )}
                {/* End date line */}
                {endDatePos != null && endDatePos > 0 && endDatePos < 100 && (
                  <div style={{
                    position: "absolute", left: `${endDatePos}%`, top: 0, bottom: 0,
                    width: 0, borderLeft: `2px dotted ${c.textDim}30`, zIndex: 1,
                  }} />
                )}
                {/* Shipped line */}
                {shippedPos != null && shippedPos > 0 && shippedPos < 100 && (
                  <div style={{
                    position: "absolute", left: `${shippedPos}%`, top: 0, bottom: 0,
                    width: 0, borderLeft: `2px solid ${c.green}`, zIndex: 2,
                  }} />
                )}
                {/* Block / Deprioritize / Resume lines */}
                {statusLines.map((sl, i) => (
                  <div key={`sl-${i}`} style={{
                    position: "absolute", left: `${sl.pos}%`, top: 0, bottom: 0,
                    width: 0, borderLeft: `2px ${sl.dashed ? "dashed" : "solid"} ${sl.color}`, zIndex: 2,
                  }} />
                ))}
                {/* Bars */}
                {trackData?.periods?.map((period, pi) => {
                  const pos = barStyle(period.started_at, period.completed_at);
                  const isDone = !!period.completed_at;
                  return (
                    <div key={pi} style={{
                      position: "absolute", top: 8, height: ROW_H - 16,
                      ...pos,
                      background: isDone ? `${color}50` : color,
                      borderRadius: 4, minWidth: 4, zIndex: 1,
                    }} />
                  );
                })}
              </div>
            </div>

            {/* Days — fixed right */}
            <div style={{
              width: DAYS_W, flexShrink: 0, textAlign: "right",
              padding: `0 ${space[1]}px`,
              fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
              color: tStatus === "not_started" ? c.textDim : c.textMid,
              fontVariantNumeric: "tabular-nums",
            }}>
              {tStatus !== "not_started" ? `${days}d` : "—"}
            </div>

            {/* Action — fixed right */}
            <div style={{
              width: ACTION_W, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              paddingRight: space[2],
            }}>
              {canManage && tStatus === "active" && onCompleteTrack && (
                <button type="button" onClick={() => onCompleteTrack(name)} style={{
                  ...btnBase, background: `${color}12`, border: `1px solid ${color}40`, color,
                }}>Done</button>
              )}
              {canManage && tStatus === "completed" && onReopenTrack && (
                <button type="button" onClick={() => onReopenTrack(name)} style={{
                  ...btnBase, background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.textMid,
                }}>Reopen</button>
              )}
              {canManage && tStatus === "not_started" && onStartTrack && (
                <button type="button" onClick={() => onStartTrack(name)} style={{
                  ...btnBase, background: "transparent", border: `1px dashed ${color}40`, color: `${color}90`,
                }}>Start</button>
              )}
            </div>
          </div>
        );
      })}

      {/* ═══ FOOTER: Today & Ship Date labels — stacked to avoid overlap ═══ */}
      {(() => {
        // Collect visible labels with their position (%) and estimated half-width (px)
        const raw = [
          todayPos > 0 && todayPos < 100 && { text: "Today", pos: todayPos, color: c.accent, weight: 700, halfW: 18 },
          endDatePos != null && endDatePos > 0 && endDatePos < 100 && { text: "Ship Date", pos: endDatePos, color: c.textDim, weight: 600, halfW: 26 },
          shippedPos != null && shippedPos > 0 && shippedPos < 100 && { text: "Shipped", pos: shippedPos, color: c.green, weight: 700, halfW: 22 },
          ...statusLines.map(sl => ({ text: sl.label, pos: sl.pos, color: sl.color, weight: 700, halfW: sl.label.length * 3 + 6 })),
        ].filter(Boolean).sort((a, b) => a.pos - b.pos);

        // Collision is computed in PERCENT space (positions are already 0-100%
        // of the inner content, which is scalePct% wide). Convert each label's
        // pixel half-width to a percent of the inner content.
        const EST_CONTAINER_PX = 1000;
        const innerPx = EST_CONTAINER_PX * (scalePct / 100);
        const PAD_PCT = (6 / innerPx) * 100;
        const rowRightPct = []; // last label's right-edge (%) per row
        raw.forEach(lbl => {
          const halfPct = (lbl.halfW / innerPx) * 100;
          const leftEdge = lbl.pos - halfPct;
          let row = 0;
          while (row < rowRightPct.length && leftEdge < rowRightPct[row] + PAD_PCT) row++;
          lbl.row = row;
          rowRightPct[row] = lbl.pos + halfPct;
        });
        const rowCount = Math.max(1, rowRightPct.length);
        const ROW_H = 12;
        const footerH = 6 + rowCount * ROW_H;

        return (
          <div style={{ display: "flex", height: footerH }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            <div ref={addScrollRef} onScroll={handleScroll} className="flow-gantt-no-scroll" style={scrollStyleHidden}>
              <div style={{ width: innerW, position: "relative", height: footerH }}>
                {raw.map(lbl => (
                  <div key={lbl.text} style={{
                    position: "absolute", left: `${lbl.pos}%`, top: 3 + lbl.row * ROW_H,
                    transform: "translateX(-50%)",
                    fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: lbl.weight,
                    color: lbl.color, letterSpacing: "0.04em", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>{lbl.text}</div>
                ))}
              </div>
            </div>
            <div style={{ width: DAYS_W + ACTION_W, flexShrink: 0 }} />
          </div>
        );
      })()}

      {/* ═══ Block / Deprioritize history messages ═══ */}
      {(() => {
        const history = proj.statusHistory || [];
        // Only show once a project has been resumed at least once (otherwise the
        // current pause is already shown in the banner above the hero).
        const types = ["blocked", "deprioritized"].filter(t =>
          history.some(h => h.type === t && h.to)
        );
        if (types.length === 0) return null;
        return (
          <div style={{
            marginTop: space[3], paddingTop: space[3], paddingBottom: space[4],
            borderTop: `1px solid ${c.border}`,
            display: "flex", flexDirection: "column", gap: space[2],
          }}>
            {types.map(type => {
              const periods = history
                .filter(h => h.type === type)
                .sort((a, b) => toDay(a.from) - toDay(b.from));
              return (
                <div key={type} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  paddingLeft: space[3],
                  fontFamily: typo.bodySm.font, fontSize: 12, color: c.textMid,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    marginRight: 2,
                    background: type === "blocked" ? c.red : c.textDim,
                  }} />
                  This project was {type === "blocked" ? "blocked" : "deprioritized"} from{" "}
                  {periods.map((h, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && " and "}
                      {h.to ? (
                        <>
                          <strong style={{ color: c.text, fontWeight: 600 }}>{fmtShort(h.from)}</strong>{" to "}
                          <strong style={{ color: c.text, fontWeight: 600 }}>{fmtShort(h.to)}</strong>
                        </>
                      ) : (
                        <><strong style={{ color: c.text, fontWeight: 600 }}>{fmtShort(h.from)}</strong>{" till date"}</>
                      )}
                    </React.Fragment>
                  ))}
                  .
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
