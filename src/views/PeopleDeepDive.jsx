// Flow — People Deep Dive (Project-centric team visibility)
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { c, motion, layout, typo, space, typeConfig, phaseColors as getPhaseColors, entityColors } from "../styles/theme";
import { Tag, EmptyState, Sel, Inp, Btn, Modal, Label, selChevron } from "../components/shared";
import { KpiGrid, KpiCard, SectionHead, Pill, PillRow } from "../components/kpi";
import PersonProjects from "../components/PersonProjects";
import useKeyboard from "../hooks/useKeyboard";
import useDevLabel from "../hooks/useDevLabel";
import { initialsOf } from "../lib/names";
import { isDevSeedMode, devStore, seedPeople } from "../data/devSeed";
import { addPersonToDB } from "../lib/mutations";


const firstGlyph = (name) => {
  if (!name) return "?";
  const arr = [...String(name).trim()];
  return arr.length ? arr[0].toUpperCase() : "?";
};

// ── Capacity model for member workload (active = in_flight + blocked) ──
//   1–2 healthy (green) · 3 watch (amber) · 4+ overloaded (red) · 0 unassigned.
const CAPACITY_FULL = 4;        // 4+ active projects fills the bar / flags overload
const OVERLOAD_AT = 4;          // threshold for the "overloaded" alert (more than 3)
function capacityOf(count) {
  if (count >= OVERLOAD_AT) return { zone: "overloaded", color: c.red, label: "Overloaded" };
  if (count === 3) return { zone: "watch", color: c.amber, label: "At capacity" };
  if (count >= 1) return { zone: "healthy", color: c.green, label: "Healthy" };
  return { zone: "idle", color: c.textDim, label: "Unassigned" };
}

// Key squad roles we proactively check coverage for.
const KEY_ROLES = [
  { label: "PM", test: r => /product manager|^pm$/i.test(r) },
  { label: "Engineer", test: r => /engineer|developer|^swe$/i.test(r) },
  { label: "Designer", test: r => /design/i.test(r) },
];

/* ═══════════════════════════════════════════════════════════ */
/*  PEOPLE DEEP DIVE                                         */
/* ═══════════════════════════════════════════════════════════ */

const PeopleDeepDive = ({ people, setPeople, commitments = [], projects, history, onNavigate, initialPerson, setDetailLabel, setGoBack, searchRef, isHistorical = false, selectedWeekKey, weekConfig: weekConfigProp, globalFilters = {}, loading, error, viewerSquad, viewerName, isAdmin = false }) => {
  const devRef = useDevLabel(
    'PeopleDeepDive',
    'src/views/PeopleDeepDive.jsx',
    'Person detail view with project involvement and activity'
  );
  const [selectedPerson, setSelectedPerson] = useState(initialPerson || null);

  const [search, setSearch] = useState("");
  const [fSquad, setFSquad] = useState("");
  const [fRole, setFRole] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const [kbActive, setKbActive] = useState(false);
  const localSearchRef = useRef(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const allSquads = [...new Set(people.map(p => p.squad).filter(Boolean))].sort();
  const allRoles = [...new Set(people.map(p => p.role).filter(Boolean))].sort();

  const gfSquads = Array.isArray(globalFilters.squad) ? globalFilters.squad : (globalFilters.squad ? [globalFilters.squad] : []);
  const gfPerson = Array.isArray(globalFilters.person) ? globalFilters.person : (globalFilters.person ? [globalFilters.person] : []);
  const effectiveSquad = fSquad || "";
  const effectiveRole = fRole || "";
  const localFilterCount = [effectiveSquad, effectiveRole, search].filter(Boolean).length;
  const globalFilterCount = gfSquads.length + gfPerson.length;

  const filtered = people.filter(p => {
    if (effectiveSquad && (p.squad || "") !== effectiveSquad) return false;
    if (effectiveRole && (p.role || "") !== effectiveRole) return false;
    if (gfSquads.length > 0 && !gfSquads.includes(p.squad)) return false;
    if (gfPerson.length > 0 && !gfPerson.includes(p.name)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.squad || "").toLowerCase().includes(q) && !(p.role || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const squadsRaw = {};
  filtered.forEach(p => {
    const sq = p.squad || "Consumer Product";
    if (!squadsRaw[sq]) squadsRaw[sq] = [];
    squadsRaw[sq].push(p);
  });
  const sortedSquadKeys = Object.keys(squadsRaw).sort((a, b) => {
    if (a === "Consumer Product") return 1;
    if (b === "Consumer Product") return -1;
    return a.localeCompare(b);
  });
  const squadsWithPeople = {};
  sortedSquadKeys.forEach(k => { squadsWithPeople[k] = squadsRaw[k]; });
  const flatFiltered = [];
  Object.values(squadsWithPeople).forEach(members => flatFiltered.push(...members));

  // Compute per-person active project counts (in_flight + blocked only)
  const personProjectCounts = useMemo(() => {
    const map = {};
    const activeProjs = (projects || []).filter(p => p.status === "in_flight" || p.status === "blocked");
    people.forEach(p => {
      const count = activeProjs.filter(proj =>
        proj.owner_id === p.id ||
        (isDevSeedMode() && devStore.listMembers(proj.id)?.some(m => m.person_id === p.id))
      ).length;
      map[p.id] = count;
    });
    return map;
  }, [people, projects]);

  useEffect(() => {
    if (searchRef) searchRef.current = localSearchRef.current;
  }, [searchRef, selectedPerson]);

  const goBackToList = useCallback(() => {
    setSelectedPerson(null);
    setKbActive(false);
    if (setDetailLabel) setDetailLabel(null);
    if (setGoBack) setGoBack(null);
  }, [setDetailLabel, setGoBack]);

  const openPerson = useCallback((name) => {
    setSelectedPerson(name);
    if (setDetailLabel) setDetailLabel(name);
    if (setGoBack) setGoBack(goBackToList);
  }, [setDetailLabel, setGoBack, goBackToList]);

  useEffect(() => {
    if (initialPerson && setDetailLabel) {
      setDetailLabel(initialPerson);
      if (setGoBack) setGoBack(goBackToList);
    }
  }, [initialPerson, setDetailLabel, setGoBack, goBackToList]);

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [selectedPerson]);

  useKeyboard(!selectedPerson ? [
    { key: "Escape", fn: () => { if (search) { setSearch(""); setFocusIdx(0); localSearchRef.current?.blur(); } else if (document.activeElement === localSearchRef.current) { localSearchRef.current.blur(); } else if (kbActive) { setKbActive(false); } }, force: true },
    { key: "ArrowUp", fn: () => { localSearchRef.current?.blur(); setKbActive(true); setFocusIdx(i => Math.max(0, i - 1)); }, force: true },
    { key: "ArrowDown", fn: () => { localSearchRef.current?.blur(); setKbActive(true); setFocusIdx(i => Math.min(flatFiltered.length - 1, i + 1)); }, force: true },
    { key: "Enter", fn: () => { const target = flatFiltered[focusIdx] || flatFiltered[0]; if (target) openPerson(target.name); }, force: true },
  ] : [
    { key: "Escape", fn: () => { goBackToList(); }, force: true },
  ], [flatFiltered.length, focusIdx, selectedPerson, search, kbActive, goBackToList]);

  useEffect(() => {
    if (focusIdx >= flatFiltered.length && flatFiltered.length > 0) setFocusIdx(flatFiltered.length - 1);
  }, [flatFiltered.length, focusIdx]);


  /* ═══ DETAIL-VIEW MEMOS (must be before early returns) ═══ */
  const selectedPersonObj = people.find(p => p.name === selectedPerson) || null;

  const activityScore = useMemo(() => {
    if (!isDevSeedMode() || !selectedPersonObj?.id) return 0;
    let totalComments = 0;
    (projects || []).forEach(proj => {
      const comments = devStore.listComments(proj.id) || [];
      totalComments += comments.filter(cmt => cmt.author_id === selectedPersonObj.id && !cmt.deleted_at).length;
    });
    return totalComments;
  }, [selectedPersonObj?.id, projects]);

  /* ═══ LOADING / ERROR GATE ═══════════════════════════════ */

  if (error) {
    return (
      <EmptyState
        icon="◌"
        title="Couldn't load team"
        message={typeof error === "string" ? error : (error?.message || "Something went wrong fetching team data.")}
        action="Retry"
        onAction={() => { if (typeof window !== "undefined") window.location.reload(); }}
      />
    );
  }
  if (loading && people.length === 0) {
    return (
      <div className="flow-loading-delayed" style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: `${space[8]}px ${space[5]}px`, color: c.textMid,
        fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size, fontWeight: typo.monoMd.weight,
        letterSpacing: "0.08em", textTransform: "uppercase",
      }}>Loading team…</div>
    );
  }

  /* ═══ LIST VIEW ═══════════════════════════════════════════ */

  if (!selectedPerson) {
    let flatIdx = 0;

    // ─── KPI aggregates ────
    const teamSize = people.length;
    const roleCounts = people.reduce((acc, p) => {
      const r = (p.role || "").trim();
      if (!r) return acc;
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const roleEntries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
    const topRoles = roleEntries.slice(0, 3);
    const moreRoles = roleEntries.length - topRoles.length;

    const realSquads = [...new Set(people.map(p => p.squad).filter(Boolean))];
    const squadCount = realSquads.length;

    // Average team per project
    const activeProjects = (projects || []).filter(p => p.status !== "deprioritized");
    const totalMembers = activeProjects.reduce((sum, proj) => {
      if (isDevSeedMode()) {
        const members = devStore.listMembers(proj.id) || [];
        return sum + members.length;
      }
      return sum + 1; // fallback
    }, 0);
    const avgTeamPerProject = activeProjects.length > 0
      ? (totalMembers / activeProjects.length).toFixed(1)
      : "0";

    return (
      <div ref={devRef} style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <div style={{ position: "relative", zIndex: 1, padding: `0 ${space[4]}px`, display: "flex", flexDirection: "column", gap: space[3] }}>

        {/* ═══ KPI GRID ═══ */}
        <KpiGrid cols="1fr 1fr 1fr">
          <KpiCard
            label="Team"
            value={teamSize}
            sub={`${roleEntries.length} role${roleEntries.length === 1 ? "" : "s"}`}
          >
            <PillRow style={{ flexWrap: "nowrap", overflow: "hidden" }}>
              {topRoles.map(([role, count]) => (
                <Pill key={role} count={count} label={role} color={c.cyan} style={{ whiteSpace: "nowrap", flexShrink: 0 }} />
              ))}
              {moreRoles > 0 && (
                <Pill count={`+${moreRoles}`} label="more" color={c.textDim} style={{ whiteSpace: "nowrap", flexShrink: 0 }} />
              )}
            </PillRow>
          </KpiCard>
          <KpiCard
            label="Squads"
            value={squadCount}
            sub={`${squadCount} active squad${squadCount === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Avg Team / Project"
            value={avgTeamPerProject}
            sub={`across ${activeProjects.length} active projects`}
          />
        </KpiGrid>

        {/* ═══ TEAM HEALTH — proactive capacity & coverage alerts ═══ */}
        {(() => {
          const flags = [];

          // 1. Overloaded members (4+ active projects → red)
          people
            .filter(p => (personProjectCounts[p.id] || 0) >= OVERLOAD_AT)
            .sort((a, b) => (personProjectCounts[b.id] || 0) - (personProjectCounts[a.id] || 0))
            .forEach(p => {
              const n = personProjectCounts[p.id] || 0;
              flags.push({ sev: "critical", text: `${p.name.split(" ")[0]} is overloaded — ${n} active projects`, action: () => openPerson(p.name) });
            });

          // Group ALL people by squad (not the filtered view) for structural checks.
          const squadMembers = {};
          people.forEach(p => { const s = (p.squad || "").trim() || "Unassigned"; (squadMembers[s] = squadMembers[s] || []).push(p); });

          // 2. Single-member squads (bus-factor risk → amber)
          Object.entries(squadMembers)
            .filter(([sq, m]) => sq !== "Unassigned" && m.length === 1)
            .forEach(([sq]) => flags.push({ sev: "warning", text: `${sq} squad has only 1 member` }));

          // 3. Squads missing a key role (PM / Engineer / Designer → amber).
          // Skip single-member squads — they obviously lack roles (already flagged).
          Object.entries(squadMembers)
            .filter(([sq, m]) => sq !== "Unassigned" && m.length >= 2)
            .forEach(([sq, m]) => {
              const missing = KEY_ROLES.filter(role => !m.some(p => role.test(p.role || "")));
              if (missing.length > 0) {
                flags.push({ sev: "warning", text: `${sq} squad has no ${missing.map(r => r.label).join(", ")} assigned` });
              }
            });

          // 4. Untagged resources — members on no active project (→ neutral)
          const idle = people.filter(p => (personProjectCounts[p.id] || 0) === 0);
          if (idle.length > 0) {
            const names = idle.slice(0, 4).map(p => p.name.split(" ")[0]).join(", ");
            flags.push({ sev: "info", text: `${idle.length} member${idle.length === 1 ? "" : "s"} unassigned to any active project — ${names}${idle.length > 4 ? ` +${idle.length - 4} more` : ""}` });
          }

          const counts = {
            critical: flags.filter(f => f.sev === "critical").length,
            warning: flags.filter(f => f.sev === "warning").length,
            info: flags.filter(f => f.sev === "info").length,
          };
          const dotColor = { critical: c.red, warning: c.amber, info: c.textDim, ok: c.green };
          const rowBg = { critical: c.red + "0A", warning: c.amber + "0C", info: c.textDim + "0A", ok: c.green + "0A" };
          const rowBorder = { critical: c.red + "20", warning: c.amber + "22", info: c.border, ok: c.green + "20" };

          return (
            <div style={{
              background: c.surfaceSolid,
              borderRadius: layout.radiusLg,
              border: `1px solid ${c.border}`,
              boxShadow: c.shadowCard,
              padding: `${space[4]}px`,
              display: "flex", flexDirection: "column", gap: space[2],
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[1] }}>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 700,
                  letterSpacing: "0.08em", color: c.text, textTransform: "uppercase",
                }}>Team Health</span>
                {/* Severity tally chips */}
                {flags.length === 0 ? (
                  <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.green }}>● All clear</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                    {counts.critical > 0 && <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.red }}>● {counts.critical}</span>}
                    {counts.warning > 0 && <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.amber }}>● {counts.warning}</span>}
                    {counts.info > 0 && <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.textDim }}>● {counts.info}</span>}
                  </div>
                )}
              </div>

              {flags.length === 0 ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: space[2],
                  padding: `${space[2]}px ${space[3]}px`, borderRadius: layout.radiusSm,
                  background: rowBg.ok, border: `1px solid ${rowBorder.ok}`,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor.ok, flexShrink: 0 }} />
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.text, lineHeight: 1.5 }}>
                    No capacity or coverage risks detected — team looks healthy.
                  </span>
                </div>
              ) : flags.map((f, i) => (
                <div key={i}
                  onClick={f.action || undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: space[2],
                    padding: `${space[2]}px ${space[3]}px`,
                    borderRadius: layout.radiusSm,
                    background: rowBg[f.sev],
                    border: `1px solid ${rowBorder[f.sev]}`,
                    cursor: f.action ? "pointer" : "default",
                    transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
                  }}
                  onMouseEnter={f.action ? e => { e.currentTarget.style.background = dotColor[f.sev] + "16"; } : undefined}
                  onMouseLeave={f.action ? e => { e.currentTarget.style.background = rowBg[f.sev]; } : undefined}
                >
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor[f.sev], flexShrink: 0 }} />
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.text, lineHeight: 1.5 }}>{f.text}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ═══ SEARCH ROW ═══ */}
        <div style={{ position: "relative" }}>
          <input ref={localSearchRef} value={search} onChange={e => { setSearch(e.target.value); setFocusIdx(0); }}
            aria-label="Search people by name, squad, or role"
            placeholder="Search people by name, squad, or role..."
            style={{
              width: "100%", height: 40,
              padding: `0 ${space[4]}px 0 38px`,
              borderRadius: layout.radiusSm,
              border: `1px solid ${c.border}`,
              background: c.surfaceAlt, color: c.text,
              fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
              outline: "none", boxSizing: "border-box",
            }} />
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10.5" cy="10.5" r="7" /><line x1="15.5" y1="15.5" x2="21" y2="21" />
          </svg>
          {!search && (
            <span aria-hidden="true" style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 600,
              color: c.textDim, lineHeight: 1,
              padding: `3px 7px 4px`, borderRadius: layout.radiusXs,
              background: c.surface, border: `1px solid ${c.border}`,
              pointerEvents: "none",
            }}>/</span>
          )}
        </div>

        {/* People grouped by squad */}
        {Object.entries(squadsWithPeople).map(([squad, members]) => {
          const startIdx = flatIdx;
          flatIdx += members.length;
          return (
            <div key={squad}>
              <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[3], marginTop: space[5] }}>
                <span style={{ fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size, fontWeight: typo.monoMd.weight, letterSpacing: "0.08em", color: c.text, textTransform: "uppercase" }}>{squad}</span>
                <span style={{ fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size, fontWeight: typo.monoMd.weight, color: c.textGhost || c.textDim }}>·</span>
                <span style={{ fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size, fontWeight: typo.monoMd.weight, color: c.text, fontVariantNumeric: "tabular-nums" }}>{members.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: space[4] }}>
                {members.map((p, gi) => {
                  const isFocused = kbActive && (startIdx + gi) === focusIdx;
                  const projCount = personProjectCounts[p.id] || 0;
                  const cap = capacityOf(projCount);
                  const fillPct = Math.min(projCount / CAPACITY_FULL, 1) * 100;

                  return (
                    <div key={p.name} role="button" tabIndex={0} aria-label={`Open ${p.name}, ${projCount} active projects, ${cap.label}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPerson(p.name); } }} className={`flow-row${isFocused ? " flow-kb-focus" : ""}`} onClick={() => openPerson(p.name)} style={{
                      display: "flex", flexDirection: "column", gap: space[4],
                      padding: space[6], background: c.surface,
                      borderRadius: layout.radiusLg, cursor: "pointer",
                      border: `1px solid ${isFocused ? c.accent : c.border}`,
                      boxShadow: c.shadowCard,
                      animation: `fadeIn ${motion.normal.duration} ${motion.normal.easing} both`,
                      animationDelay: `${Math.min(gi * 30, 400)}ms`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
                        <div style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0, flex: 1 }}>
                          <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", background: c.surfaceAlt, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size, fontWeight: typo.monoMd.weight, color: c.textMid, flexShrink: 0 }}>
                            {firstGlyph(p.name)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                              <span title={p.name} style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, letterSpacing: typo.displaySm.tracking, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{p.name}</span>
                            </div>
                            <div title={p.role || ""} style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: typo.bodySm.weight, color: c.textMid, marginTop: space[1], lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p.role || "—"}
                            </div>
                          </div>
                        </div>
                        {/* Project count + capacity zone */}
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: space[3], display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div style={{ fontFamily: typo.monoLg.font, fontSize: 22, fontWeight: 700, color: cap.color, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                            {projCount}
                          </div>
                          <div style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: typo.monoSm.weight, letterSpacing: typo.monoSm.tracking, color: cap.color, marginTop: space[1], textTransform: "uppercase" }}>
                            {cap.label}
                          </div>
                        </div>
                      </div>

                      {/* ── Capacity bar ── */}
                      <div style={{ display: "flex", flexDirection: "column", gap: space[1] + 2 }}>
                        <div aria-hidden="true" style={{ position: "relative", height: 4, borderRadius: 2, background: c.surfaceAlt, overflow: "hidden" }}>
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: `${fillPct}%`, background: cap.color, borderRadius: 2,
                            transition: `width ${motion.normal.duration} ${motion.normal.easing}, background ${motion.fast.duration} ${motion.fast.easing}`,
                          }} />
                        </div>
                        <div style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: typo.monoSm.weight, color: c.textMid, letterSpacing: typo.monoSm.tracking, fontVariantNumeric: "tabular-nums" }}>
                          {projCount} active project{projCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState
            icon="◌"
            title={people.length === 0 ? "No people yet" : "No people match"}
            message={
              people.length === 0
                ? "Add team members to see them here."
                : localFilterCount > 0
                  ? "Try adjusting your filters or search query."
                  : globalFilterCount > 0
                    ? "No teammates match the global filter. Clear it from the app header to see everyone."
                    : "No teammates to show."
            }
            action={localFilterCount > 0 ? "Clear filters" : null}
            onAction={() => { setSearch(""); setFSquad(""); setFRole(""); setFocusIdx(0); }}
          />
        )}

        {/* Sticky Add Member FAB */}
        <button
          className="flow-btn"
          onClick={() => setShowAddMember(true)}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 100,
            display: "flex", alignItems: "center", gap: space[2],
            padding: `${space[3]}px ${space[5]}px`,
            background: c.accent, color: "#fff",
            border: "none", borderRadius: layout.radiusLg,
            fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 600,
            cursor: "pointer",
            boxShadow: `0 4px 16px ${c.accent}50, ${c.shadowElevated}`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Member
        </button>

        {/* Add Member Modal */}
        <Modal open={showAddMember} title="Add Team Member" onClose={() => setShowAddMember(false)}>
          <AddMemberForm
            squads={allSquads}
            roles={allRoles}
            projects={projects}
            setPeople={setPeople}
            onClose={() => setShowAddMember(false)}
            viewerSquad={viewerSquad}
          />
        </Modal>

      </div>{/* end scrollable content */}
      </div>
    );
  }


  /* ═══ DETAIL VIEW ═══════════════════════════════════════ */

  const personObj = selectedPersonObj;
  if (!personObj) {
    return (
      <EmptyState
        icon="◌"
        title="Person not found"
        message={`"${selectedPerson}" is not in the current people list.`}
        action="Back to list"
        onAction={goBackToList}
      />
    );
  }

  // Compute person's projects
  const personProjects = (projects || []).filter(proj =>
    proj.owner_id === personObj.id ||
    (isDevSeedMode() && devStore.listMembers(proj.id)?.some(m => m.person_id === personObj.id))
  );
  const inFlightProjects = personProjects.filter(p => p.status === "in_flight" || p.status === "blocked");
  const shippedProjects = personProjects.filter(p => p.status === "shipped");

  // Weeks active (rough: divide total comments by some weekly average)
  const weeksActive = Math.max(1, Math.ceil(activityScore / 3));
  const weeklyAvg = activityScore > 0 ? (activityScore / weeksActive).toFixed(1) : "0";

  // Can edit this person's squad/role? Only if viewing self or admin
  const canEditProfile = (viewerName && selectedPerson === viewerName) || isAdmin;

  return (
    <div key={selectedPerson} className="flow-enter-slide" style={{ display: "flex", flexDirection: "column", gap: space[4] }}>

      {/* ═══ HERO CARD ═══ */}
      <PersonHeroCard
        personObj={personObj}
        selectedPerson={selectedPerson}
        canEdit={canEditProfile}
        allSquads={allSquads}
        allRoles={allRoles}
        setPeople={setPeople}
      />

      {/* ═══ KPI GRID — In Flight / Shipped / Activity ═══ */}
      <KpiGrid cols="1fr 1fr 1fr">
        <KpiCard
          label="In Flight"
          value={inFlightProjects.length}
          sub={inFlightProjects.length === 0 ? "No active projects" : `${inFlightProjects.length} project${inFlightProjects.length !== 1 ? "s" : ""} in progress`}
        />
        <KpiCard
          label="Shipped"
          value={shippedProjects.length}
          sub={shippedProjects.length === 0 ? "No shipped projects" : `${shippedProjects.length} in Alpha/Beta/GA`}
        />
        <KpiCard
          label="Activity"
          value={activityScore}
          sub={activityScore === 0 ? "No comments yet" : `~${weeklyAvg} comments/week`}
        />
      </KpiGrid>


      {/* ═══ PROJECT INVOLVEMENT ═══ */}
      <PersonProjects
        person={personObj}
        projects={projects}
        onProjectNavigate={(id) => onNavigate && onNavigate("projects", id, { tab: "people", id: selectedPerson })}
      />
    </div>
  );
};

/* ═══ PERSON HERO CARD — with inline squad/role editing ═══ */

function PersonHeroCard({ personObj, selectedPerson, canEdit, allSquads, allRoles, setPeople }) {
  const [editing, setEditing] = useState(false);
  const [editSquad, setEditSquad] = useState(personObj.squad || "");
  const [editRole, setEditRole] = useState(personObj.role || "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditSquad(personObj.squad || "");
    setEditRole(personObj.role || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editSquad || !editRole) return;
    setSaving(true);
    if (isDevSeedMode()) {
      // Dev seed mode — update in-memory store
      const updated = { ...personObj, squad: editSquad, role: editRole };
      setPeople(prev => prev.map(p => p.id === personObj.id ? { ...p, squad: editSquad, role: editRole } : p));
    } else {
      // Supabase mode — update by matching squad/role names to IDs
      const { supabase: sb } = await import("../lib/supabase");
      const [sqRes, roRes] = await Promise.all([
        sb.from("squads").select("id").eq("name", editSquad).single(),
        sb.from("roles").select("id").eq("name", editRole).single(),
      ]);
      if (sqRes.data && roRes.data) {
        await sb.from("people")
          .update({ squad_id: sqRes.data.id, role_id: roRes.data.id })
          .eq("id", personObj.id);
        setPeople(prev => prev.map(p => p.id === personObj.id ? { ...p, squad: editSquad, role: editRole, squad_id: sqRes.data.id, role_id: roRes.data.id } : p));
      }
    }
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditSquad(personObj.squad || "");
    setEditRole(personObj.role || "");
  };

  return (
    <div style={{
      padding: space[6], background: c.surface,
      border: `1px solid ${c.border}`, borderRadius: layout.radiusLg,
      boxShadow: c.shadowCard,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[4], minWidth: 0 }}>
        <div aria-hidden="true" style={{
          width: 56, height: 56, borderRadius: "50%",
          background: c.surfaceAlt,
          border: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: typo.monoLg.font, fontSize: typo.monoLg.size, fontWeight: typo.monoLg.weight, color: c.textMid,
          flexShrink: 0,
        }}>{initialsOf(selectedPerson)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: typo.displayLg.font, fontSize: typo.displayLg.size, fontWeight: typo.displayLg.weight,
            color: c.text, letterSpacing: typo.displayLg.tracking, lineHeight: typo.displayLg.lineHeight,
          }}>{selectedPerson}</div>

          {!editing ? (
            <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[2], flexWrap: "wrap" }}>
              {personObj.role && (
                <span style={{
                  fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                  fontWeight: 500, color: c.textMid,
                }}>{personObj.role}</span>
              )}
              {personObj.squad && (
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: typo.monoSm.weight,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: c.accent, background: c.accentDim,
                  padding: `${space[1]}px ${space[2]}px`, borderRadius: layout.radiusXs,
                }}>{personObj.squad}</span>
              )}
              {canEdit && (
                <button
                  onClick={startEdit}
                  className="flow-btn"
                  style={{
                    padding: `2px ${space[2]}px`, marginLeft: space[1],
                    borderRadius: layout.radiusXs,
                    border: `1px solid ${c.border}`, background: "transparent",
                    fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 500,
                    color: c.textDim, cursor: "pointer",
                    transition: `background ${motion.fast.duration} ${motion.fast.easing}, color ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}`,
                  }}
                >Edit</button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[2], flexWrap: "wrap" }}>
              <select
                value={editSquad}
                onChange={e => setEditSquad(e.target.value)}
                style={{
                  height: 30, padding: `0 ${space[2] + 18}px 0 ${space[2]}px`,
                  borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                  background: `${c.surfaceSolid} ${selChevron} no-repeat right ${space[2]}px center / 12px 12px`,
                  color: c.text, fontFamily: typo.bodySm.font, fontSize: 13,
                  appearance: "none", WebkitAppearance: "none", cursor: "pointer", outline: "none",
                }}
              >
                <option value="" disabled>Squad</option>
                {allSquads.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                style={{
                  height: 30, padding: `0 ${space[2] + 18}px 0 ${space[2]}px`,
                  borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
                  background: `${c.surfaceSolid} ${selChevron} no-repeat right ${space[2]}px center / 12px 12px`,
                  color: c.text, fontFamily: typo.bodySm.font, fontSize: 13,
                  appearance: "none", WebkitAppearance: "none", cursor: "pointer", outline: "none",
                }}
              >
                <option value="" disabled>Role</option>
                {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={handleSave}
                disabled={saving || !editSquad || !editRole}
                className="flow-btn"
                style={{
                  padding: `3px ${space[3]}px`, borderRadius: layout.radiusSm,
                  border: "none", background: saving ? c.surfaceAlt : c.accent,
                  color: "#fff", fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600,
                  cursor: saving ? "wait" : "pointer",
                }}
              >{saving ? "Saving..." : "Save"}</button>
              <button
                onClick={handleCancel}
                className="flow-btn"
                style={{
                  padding: `3px ${space[3]}px`, borderRadius: layout.radiusSm,
                  border: `1px solid ${c.border}`, background: "transparent",
                  color: c.textMid, fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                }}
              >Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══ ADD MEMBER FORM ═══════════════════════════════════════ */

function AddMemberForm({ squads, roles, projects, setPeople, onClose, viewerSquad }) {
  const [name, setName] = useState("");
  const [squad, setSquad] = useState(viewerSquad || "");
  const [role, setRole] = useState("");
  const [selectedProjects, setSelectedProjects] = useState([]);

  const toggleProject = (id) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (isDevSeedMode()) {
      const newPerson = devStore.addPerson({ name: name.trim(), squad, role });
      // Add to selected projects as member
      selectedProjects.forEach(projId => {
        devStore.addMember(projId, newPerson.id, null);
      });
      // Update React state
      if (setPeople) {
        setPeople([...seedPeople]);
      }
    } else {
      // Real DB path
      try {
        const personId = await addPersonToDB(name.trim(), squad, role);
        if (personId && setPeople) {
          setPeople(prev => [...prev, { id: personId, name: name.trim(), squad, role }]);
        }
      } catch (err) {
        console.error("[Flow] Add member failed:", err);
      }
    }
    onClose();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[4], minWidth: 340 }} data-suppress-shortcuts>
      <div>
        <label style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: space[1], display: "block" }}>Name *</label>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Full name"
          autoFocus
          style={{
            width: "100%", height: 36, padding: `0 ${space[3]}px`,
            borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
            background: c.surfaceAlt, color: c.text,
            fontFamily: typo.bodyMd.font, fontSize: 14, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
        <div>
          <label style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: space[1], display: "block" }}>Squad</label>
          <select
            value={squad} onChange={e => setSquad(e.target.value)}
            style={{
              width: "100%", height: 36, padding: `0 ${space[3] + 20}px 0 ${space[3]}px`,
              borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
              background: `${c.surfaceSolid} ${selChevron} no-repeat right ${space[3]}px center / 12px 12px`, color: c.text,
              fontFamily: typo.bodyMd.font, fontSize: 14, outline: "none",
              appearance: "none", WebkitAppearance: "none", cursor: "pointer",
            }}
          >
            <option value="">Select squad</option>
            {squads.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: space[1], display: "block" }}>Role</label>
          <select
            value={role} onChange={e => setRole(e.target.value)}
            style={{
              width: "100%", height: 36, padding: `0 ${space[3] + 20}px 0 ${space[3]}px`,
              borderRadius: layout.radiusSm, border: `1px solid ${c.border}`,
              background: `${c.surfaceSolid} ${selChevron} no-repeat right ${space[3]}px center / 12px 12px`, color: c.text,
              fontFamily: typo.bodyMd.font, fontSize: 14, outline: "none",
              appearance: "none", WebkitAppearance: "none", cursor: "pointer",
            }}
          >
            <option value="">Select role</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: space[2], display: "block" }}>Projects (optional)</label>
        <div style={{
          maxHeight: 160, overflowY: "auto", border: `1px solid ${c.border}`,
          borderRadius: layout.radiusSm, background: c.surfaceAlt,
        }}>
          {(projects || []).filter(p => p.status !== "deprioritized").map(proj => (
            <label key={proj.id} style={{
              display: "flex", alignItems: "center", gap: space[2],
              padding: `${space[2]}px ${space[3]}px`, cursor: "pointer",
              borderBottom: `1px solid ${c.border}10`,
              background: selectedProjects.includes(proj.id) ? c.accentDim : "transparent",
            }}>
              <input
                type="checkbox"
                checked={selectedProjects.includes(proj.id)}
                onChange={() => toggleProject(proj.id)}
                style={{ accentColor: c.accent }}
              />
              <span style={{ fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700, color: c.orange }}>{proj.id}</span>
              <span style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: space[3], marginTop: space[2] }}>
        <button className="flow-btn" onClick={onClose} style={{
          padding: `${space[2]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          border: `1px solid ${c.border}`, background: c.surfaceSolid, color: c.textMid,
          fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>Cancel</button>
        <button className="flow-btn" onClick={handleSubmit} disabled={!name.trim()} style={{
          padding: `${space[2]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          border: "none", background: name.trim() ? c.accent : c.border, color: "#fff",
          fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed",
        }}>Add Member</button>
      </div>
    </div>
  );
}

export default PeopleDeepDive;
