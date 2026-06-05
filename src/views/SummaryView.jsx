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

  const frozen = active.filter(p => {
    if (!p.lastActivityAt) return true;
    const diff = (todayMs - new Date(p.lastActivityAt).getTime()) / 86_400_000;
    return diff > FROZEN_DAYS;
  });

  const overdue = active.filter(p => {
    if (!p.endDate) return false;
    const end = new Date(p.endDate + "T00:00:00");
    return end.getTime() < todayMs;
  });

  const needsAttention = blocked.length + frozen.length + overdue.length;

  return {
    active, shipped, blocked, deprioritized, upcoming,
    byPhase,
    frozen, overdue,
    needsAttention,
  };
}

function generateWeeklyDigest(projects, allEvents) {
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const recentEvents = allEvents.filter(e => new Date(e.created_at).getTime() >= weekAgo);

  const phaseChanges = recentEvents.filter(e => e.action === "project_phase_changed");
  const newProjects = recentEvents.filter(e => e.action === "project_created");
  const blockerEvents = recentEvents.filter(e => e.action === "project_blocked");

  const shipEvents = phaseChanges.filter(e => ["Alpha", "Beta", "GA"].includes(e.details?.to));
  const blockedProjects = projects.filter(p => p.isBlocked);

  const squadActivity = {};
  recentEvents.forEach(e => {
    const proj = projects.find(p => p.id === e.entity_id);
    if (proj?.squad) squadActivity[proj.squad] = (squadActivity[proj.squad] || 0) + 1;
  });
  const mostActiveSquad = Object.entries(squadActivity).sort((a, b) => b[1] - a[1])[0];

  const lines = [];


  if (shipEvents.length > 0) {
    const shipped = shipEvents.map(e => {
      const proj = projects.find(p => p.id === e.entity_id);
      return proj ? `${proj.name} → ${e.details.to}` : null;
    }).filter(Boolean);
    lines.push(`**Shipping:** ${shipped.join(", ")}.`);
  }

  if (blockedProjects.length > 0) {
    lines.push(`**Blockers:** ${blockedProjects.length} project${blockedProjects.length > 1 ? "s" : ""} blocked — ${blockedProjects.map(p => p.name).slice(0, 3).join(", ")}.`);
  }

  if (newProjects.length > 0) {
    lines.push(`**New:** ${newProjects.length} project${newProjects.length > 1 ? "s" : ""} created this week.`);
  }

  const upcomingProjects = projects.filter(p => p.status === "upcoming");
  if (upcomingProjects.length > 0) {
    const overdueStart = upcomingProjects.filter(p => p.tentativeStartDate && new Date(p.tentativeStartDate + "T00:00:00").getTime() < now);
    lines.push(`**Upcoming:** ${upcomingProjects.length} project${upcomingProjects.length > 1 ? "s" : ""} in the pipeline.${overdueStart.length > 0 ? ` ⚠ ${overdueStart.length} past tentative start date.` : ""}`);
  }

  if (mostActiveSquad) {
    lines.push(`**Most Active Squad:** ${mostActiveSquad[0]} with ${mostActiveSquad[1]} events.`);
  }

  if (lines.length === 0) {
    lines.push("Quiet week across all squads. No major movements or blockers detected.");
  }

  return lines;
}

const TIMELINE_OPTIONS = [
  { key: "7d", label: "7 days", ms: 7 * 86_400_000 },
  { key: "30d", label: "30 days", ms: 30 * 86_400_000 },
  { key: "90d", label: "90 days", ms: 90 * 86_400_000 },
];


const SummaryView = ({
  loading, error,
  projects, people, squads,
  globalFilters, onNavigate,
  phaseDurationDefaults,
  followedProjects = [], viewerSquad,
  timeframe,
}) => {
  const devRef = useDevLabel('SummaryView', 'src/views/SummaryView.jsx', 'Project-centric dashboard');

  const gf = globalFilters || {};
  const filteredProjects = useMemo(() => {
    let p = projects;
    if (gf.squad?.length) p = p.filter(x => gf.squad.includes(x.squad));
    if (gf.owner?.length) p = p.filter(x => gf.owner.includes(x.owner));
    // People filter: keep projects where any selected person is the owner/DRI OR
    // a team member. Person values are names; owner/members may be stored by name
    // or id, so we match against both (mirrors ProjectsView's projectPeople).
    if (gf.person?.length) {
      const idToName = new Map((people || []).map(pp => [pp.id, pp.name]));
      p = p.filter(proj => {
        const assoc = new Set();
        if (proj.owner) assoc.add(proj.owner);
        if (proj.owner_id != null) {
          assoc.add(proj.owner_id);
          const on = idToName.get(proj.owner_id);
          if (on) assoc.add(on);
        }
        if (isDevSeedMode()) {
          (devStore.listMembers(proj.id) || []).forEach(m => {
            assoc.add(m.person_id);
            const nm = idToName.get(m.person_id);
            if (nm) assoc.add(nm);
          });
        }
        return gf.person.some(fp => assoc.has(fp));
      });
    }
    if (timeframe?.start && timeframe?.end) {
      p = p.filter(proj => {
        const pStart = proj.startDate || proj.tentativeStartDate || proj.createdAt?.slice(0, 10);
        const pEnd = proj.endDate || proj.shipped_at?.slice(0, 10);
        if (!pStart) return true;
        return pStart <= timeframe.end && (pEnd ? pEnd >= timeframe.start : true);
      });
    }
    return p;
  }, [projects, people, gf.squad, gf.owner, gf.person, viewerSquad, followedProjects, timeframe]);

  const metrics = useMemo(
    () => computeProjectMetrics(filteredProjects, phaseDurationDefaults),
    [filteredProjects, phaseDurationDefaults]
  );

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
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {digest.map((line, i) => (
              <div key={i} style={{
                fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                color: c.text, lineHeight: 1.6,
              }}
                dangerouslySetInnerHTML={{
                  __html: line
                    .replace(/\*\*(.*?)\*\*/g, `<span style="font-weight:700;color:${c.text}">$1</span>`)
                    .replace(/⚠/g, `<span style="color:${c.red}">⚠</span>`)
                }}
              />
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
