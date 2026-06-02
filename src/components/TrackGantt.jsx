import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { c, typo, space, layout, trackNames, phaseColors as getPhaseColors } from "../styles/theme";
import { getTrackStatus, getTrackActiveDays } from "../lib/tracks";

const DAY_MS = 86_400_000;

function toDay(iso) {
  if (!iso) return null;
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).getTime();
}

export default function TrackGantt({ proj, onStartTrack, onCompleteTrack, onReopenTrack, canManage = true }) {
  const pc = useMemo(() => getPhaseColors(), []);
  const scrollRefs = useRef([]);
  const syncing = useRef(false);

  const { timeStart, timeEnd, todayPos, endDatePos, shippedPos } = useMemo(() => {
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
    earliest -= 3 * DAY_MS;
    latest += 7 * DAY_MS;
    const range = latest - earliest;
    const shipDate = proj.shippedAt || proj.gaEnteredAt;
    const shipP = (proj.status === "shipped" && shipDate) ? ((toDay(shipDate.slice(0, 10)) - earliest) / range) * 100 : null;
    return {
      timeStart: earliest, timeEnd: latest,
      todayPos: ((now - earliest) / range) * 100,
      endDatePos: proj.endDate ? ((toDay(proj.endDate) - earliest) / range) * 100 : null,
      shippedPos: shipP,
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
          {(proj.startDate || proj.endDate) && (
            <span style={{
              fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
              color: c.textMid, fontVariantNumeric: "tabular-nums",
            }}>
              {proj.startDate
                ? new Date(proj.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"}
              {" → "}
              {proj.endDate
                ? new Date(proj.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"}
            </span>
          )}
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
                {/* Bars */}
                {trackData?.periods?.map((period, pi) => {
                  const pos = barStyle(period.started_at, period.completed_at);
                  const isDone = !!period.completed_at;
                  return (
                    <div key={pi}
                      title={period.backdated ? "Backdated entry — logged after the fact" : undefined}
                      style={{
                        position: "absolute", top: 8, height: ROW_H - 16,
                        ...pos,
                        background: isDone ? `${color}50` : color,
                        borderRadius: 4, minWidth: 4,
                        // Backdated periods get a dashed outline so they read as
                        // retroactively logged rather than tracked in real time.
                        border: period.backdated ? `1.5px dashed ${c.amber}` : undefined,
                        boxSizing: "border-box",
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

      {/* ═══ FOOTER: Today & Ship Date labels ═══ */}
      <div style={{ display: "flex", height: 20 }}>
        <div style={{ width: LABEL_W, flexShrink: 0 }} />
        <div ref={addScrollRef} onScroll={handleScroll} className="flow-gantt-no-scroll" style={scrollStyleHidden}>
          <div style={{ width: innerW, position: "relative", height: 20 }}>
            {todayPos > 0 && todayPos < 100 && (
              <div style={{
                position: "absolute", left: `${todayPos}%`, top: 3,
                transform: "translateX(-50%)",
                fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700,
                color: c.accent, letterSpacing: "0.04em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>Today</div>
            )}
            {endDatePos != null && endDatePos > 0 && endDatePos < 100 && (
              <div style={{
                position: "absolute", left: `${endDatePos}%`, top: 3,
                transform: "translateX(-50%)",
                fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600,
                color: c.textDim, letterSpacing: "0.04em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>Ship Date</div>
            )}
            {shippedPos != null && shippedPos > 0 && shippedPos < 100 && (
              <div style={{
                position: "absolute", left: `${shippedPos}%`, top: 3,
                transform: "translateX(-50%)",
                fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700,
                color: c.green, letterSpacing: "0.04em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>Shipped</div>
            )}
          </div>
        </div>
        <div style={{ width: DAYS_W + ACTION_W, flexShrink: 0 }} />
      </div>
    </div>
  );
}
