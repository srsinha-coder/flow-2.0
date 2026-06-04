// ═══════════════════════════════════════════════════════════════════
// PersonProjects — per-person panel for the People deep-dive.
//
// Three sections:
//   1. In Flight    — all projects (owns + member of) in PRD/Design/Dev/QA
//   2. Shipped      — all projects (owns + member of) in Alpha/Beta/GA
//   3. Recent Activity — comments authored by this person, newest first
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo } from "react";
import { c, typo, space, layout, body, mono, phaseColors as getPhaseColors } from "../styles/theme";
import { getActiveTracks, isShipped, isInFlight } from "../lib/tracks";
import usePersonActivity from "../hooks/usePersonActivity";
import { timeAgo, isStale, fmtAbsolute } from "../lib/time";

// Right-side status badge — Shipped / Blocked / Deprioritized / Upcoming
function statusBadge(proj) {
  if (isShipped(proj)) return { text: "Shipped", color: c.green };
  if (proj.status === "blocked") return { text: "Blocked", color: c.red };
  if (proj.status === "deprioritized") return { text: "Deprioritized", color: c.textDim };
  if (proj.status === "upcoming") return { text: "Upcoming", color: c.textDim };
  return null;
}

const TODAY_STR = new Date().toISOString().slice(0, 10);
function isOverdue(proj) {
  return !isShipped(proj)
    && proj.status !== "deprioritized" && proj.status !== "upcoming"
    && !!proj.endDate && proj.endDate < TODAY_STR;
}

function ProjectRow({ proj, onNavigate, label }) {
  const stale = isStale(proj.lastActivityAt);
  const badge = statusBadge(proj);
  const overdue = isOverdue(proj);

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(proj.id)}
      style={{
        display: "flex", alignItems: "center", gap: space[3],
        width: "100%", textAlign: "left",
        padding: `${space[3]}px ${space[4]}px`,
        background: c.surface, border: `1px solid ${c.border}`, borderRadius: layout.radiusSm,
        cursor: "pointer", color: "inherit",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.surface; }}
    >
      {/* ID */}
      <span style={{
        fontFamily: mono, fontSize: 12, fontWeight: 700,
        color: c.amber, letterSpacing: "0.04em",
        minWidth: 36, flexShrink: 0,
      }}>{proj.id}</span>

      {/* Name + owner label + overdue label */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0 }}>
          <span style={{
            fontFamily: body, fontSize: 14, fontWeight: 600, color: c.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{proj.name}</span>
          {label && (
            <span style={{
              fontFamily: mono, fontSize: 10, fontWeight: 700,
              color: c.accent, letterSpacing: "0.08em",
              background: c.accentDim, padding: `1px 5px`, borderRadius: layout.radiusXs,
              textTransform: "uppercase", flexShrink: 0,
            }}>{label}</span>
          )}
          {overdue && (
            <span style={{
              fontFamily: mono, fontSize: 10, fontWeight: 700,
              color: c.red, letterSpacing: "0.08em",
              background: c.redDim, padding: `1px 5px`, borderRadius: layout.radiusXs,
              textTransform: "uppercase", flexShrink: 0,
            }}>Overdue</span>
          )}
        </div>
      </div>

      {/* Status badge (right side) */}
      {badge && (
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: badge.color, textTransform: "uppercase", flexShrink: 0 }}>{badge.text}</span>
      )}

      {/* Last activity */}
      <span
        title={proj.lastActivityAt ? fmtAbsolute(proj.lastActivityAt) : "No activity yet"}
        style={{
          fontFamily: body, fontSize: 12, fontWeight: 600, flexShrink: 0,
          color: !proj.lastActivityAt ? c.textDim : stale ? c.red : c.textMid,
          padding: stale && proj.lastActivityAt ? `2px 8px` : "2px 0",
          borderRadius: 999,
          background: stale && proj.lastActivityAt ? c.redDim : "transparent",
          border: stale && proj.lastActivityAt ? `1px solid ${c.red}30` : "none",
        }}
      >
        {proj.lastActivityAt ? `${stale ? "⚠ " : ""}${timeAgo(proj.lastActivityAt)}` : "no activity"}
      </span>
    </button>
  );
}

function CommentRow({ comment, project, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(comment.project_id)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4,
        width: "100%", textAlign: "left",
        padding: `${space[3]}px ${space[4]}px`,
        background: c.surface, border: `1px solid ${c.border}`, borderRadius: layout.radiusSm,
        cursor: "pointer", color: "inherit",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.surface; }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: space[2] }}>
        <span style={{
          fontFamily: mono, fontSize: 11, fontWeight: 700, color: c.amber,
          letterSpacing: "0.04em",
        }}>{comment.project_id}</span>
        <span style={{
          fontFamily: body, fontSize: 13, fontWeight: 600, color: c.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{project?.name || "—"}</span>
        <span title={fmtAbsolute(comment.created_at)}
          style={{ marginLeft: "auto", fontSize: 11, color: c.textDim }}>
          {timeAgo(comment.created_at)}
        </span>
      </div>
      <div style={{
        fontFamily: body, fontSize: 13, color: c.textMid, lineHeight: 1.45,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {comment.body}
      </div>
    </button>
  );
}

function SectionTitle({ title, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: space[2],
      marginBottom: space[3],
    }}>
      <span style={{
        fontFamily: mono, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase", color: c.textDim,
      }}>{title}</span>
      <span style={{
        fontFamily: mono, fontSize: 11, color: c.textDim, fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
      }}>{count}</span>
    </div>
  );
}

// Major group divider — "Contributions" / "Previous Projects" with a rule.
function GroupHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: space[4] }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
        <span style={{
          fontFamily: mono, fontSize: 13, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", color: c.text,
          whiteSpace: "nowrap",
        }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: c.border }} />
      </div>
      {subtitle && (
        <div style={{
          marginTop: 4, fontFamily: body, fontSize: 12, color: c.textDim,
        }}>{subtitle}</div>
      )}
    </div>
  );
}


// True when a project's date range overlaps the selected timeframe.
function overlapsTimeframe(p, timeframe) {
  if (!timeframe?.start || !timeframe?.end) return true;
  const pStart = p.startDate || p.tentativeStartDate || p.createdAt?.slice(0, 10);
  const pEnd = p.endDate || p.shipped_at?.slice(0, 10);
  if (!pStart) return true; // no dates at all → always include
  const startsBeforeEnd = pStart <= timeframe.end;
  const endsAfterStart = pEnd ? pEnd >= timeframe.start : true; // no end = still running
  return startsBeforeEnd && endsAfterStart;
}

export default function PersonProjects({ person, projects, onProjectNavigate, timeframe }) {
  const personId = person?.id;
  const { memberships, comments, loading, error } = usePersonActivity(personId);

  const projectsById = useMemo(() => {
    const m = new Map();
    (projects || []).forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  // Merge owns + member-of, then split by timeframe and status into buckets.
  const { inFlight, shipped, others, upcoming, previous } = useMemo(() => {
    const empty = { inFlight: [], shipped: [], others: [], upcoming: [], previous: [] };
    if (!personId) return empty;
    const seen = new Set();
    const all = [];

    // Add owned projects
    (projects || []).forEach(p => {
      if (p.owner_id === personId && !seen.has(p.id)) {
        seen.add(p.id);
        all.push({ ...p, isOwner: true });
      }
    });

    // Add member-of projects (not already in owns)
    (memberships || []).forEach(m => {
      if (!seen.has(m.project_id)) {
        const proj = projectsById.get(m.project_id);
        if (proj) {
          seen.add(proj.id);
          all.push({ ...proj, isOwner: false });
        }
      }
    });

    const sortOwnerFirst = (a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0);
    };

    // Upcoming gets its own top-level section (regardless of timeframe).
    const upcomingProjs = all.filter(p => p.status === "upcoming").sort(sortOwnerFirst);
    const rest = all.filter(p => p.status !== "upcoming");

    // In-range vs outside the selected timeframe (upcoming already removed)
    const inRange = rest.filter(p => overlapsTimeframe(p, timeframe));
    const outRange = rest.filter(p => !overlapsTimeframe(p, timeframe));

    const isShippedP = (p) => isShipped(p) || p.status === "shipped";
    const isOtherP = (p) => p.status === "blocked" || p.status === "deprioritized";

    return {
      // In Flight = active work that isn't shipped or in the Others bucket
      inFlight: inRange.filter(p => !isShippedP(p) && !isOtherP(p)).sort(sortOwnerFirst),
      shipped: inRange.filter(isShippedP).sort(sortOwnerFirst),
      // Others = blocked / deprioritized (that aren't shipped)
      others: inRange.filter(p => !isShippedP(p) && isOtherP(p)).sort(sortOwnerFirst),
      upcoming: upcomingProjs,
      // Previous = everything outside the selected timeframe
      previous: outRange.sort(sortOwnerFirst),
    };
  }, [projects, memberships, projectsById, personId, timeframe]);

  // Recent activity, scoped to the selected timeframe.
  const scopedComments = useMemo(() => {
    if (!timeframe?.start || !timeframe?.end) return comments || [];
    return (comments || []).filter(cmt => {
      const d = (cmt.created_at || "").slice(0, 10);
      return d && d >= timeframe.start && d <= timeframe.end;
    });
  }, [comments, timeframe]);

  if (!personId) {
    return (
      <div style={{
        padding: space[5], borderRadius: layout.radiusLg,
        background: c.surface, border: `1px solid ${c.border}`,
        color: c.textDim, fontFamily: body, fontSize: 13, textAlign: "center",
      }}>
        This person hasn't been linked to a Flow account yet, so we can't
        show their projects or activity.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: space[5], borderRadius: layout.radiusLg,
        background: c.surface, border: `1px solid ${c.border}`,
        color: c.textDim, fontFamily: body, fontSize: 13, textAlign: "center",
      }}>Loading activity…</div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{
        padding: space[5], borderRadius: layout.radiusLg,
        background: c.surface, border: `1px solid ${c.border}`,
        color: c.red, fontFamily: body, fontSize: 13,
      }}>Couldn't load activity: {error}</div>
    );
  }

  const emptyBox = (text) => (
    <div style={{
      padding: space[4], borderRadius: layout.radiusSm,
      background: c.surface, border: `1px dashed ${c.border}`,
      color: c.textDim, fontSize: 13, fontFamily: body, textAlign: "center",
    }}>{text}</div>
  );

  const tfLabel = timeframe?.label || "All time";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[7] }}>

      {/* ═══════════ CONTRIBUTIONS ═══════════ */}
      <div>
        <GroupHeader title="Contributions" subtitle={`Recent Projects · Timeline: ${tfLabel}`} />
        <div style={{ display: "flex", flexDirection: "column", gap: space[6] }}>

          {/* In Flight */}
          <div>
            <SectionTitle title="In Flight" count={inFlight.length} />
            {inFlight.length === 0 ? emptyBox("No in-flight projects in this range.") : (
              <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                {inFlight.map(p => (
                  <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
                ))}
              </div>
            )}
          </div>

          {/* Shipped */}
          <div>
            <SectionTitle title="Shipped" count={shipped.length} />
            {shipped.length === 0 ? emptyBox("No shipped projects in this range.") : (
              <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                {shipped.map(p => (
                  <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
                ))}
              </div>
            )}
          </div>

          {/* Others (Upcoming / Blocked / Deprioritized) */}
          {others.length > 0 && (
            <div>
              <SectionTitle title="Others" count={others.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                {others.map(p => (
                  <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
                ))}
              </div>
            </div>
          )}

          {/* Activity — comments within the selected timeframe */}
          <div>
            <SectionTitle title="Activity" count={scopedComments.length} />
            {scopedComments.length === 0 ? emptyBox(`No activity from ${person?.name?.split(" ")[0] || "this person"} in this range.`) : (
              <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                {scopedComments.map(cmt => (
                  <CommentRow
                    key={cmt.id}
                    comment={cmt}
                    project={projectsById.get(cmt.project_id)}
                    onNavigate={onProjectNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ UPCOMING PROJECTS ═══════════ */}
      {upcoming.length > 0 && (
        <div>
          <GroupHeader title="Upcoming Projects" subtitle="Not started yet" />
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {upcoming.map(p => (
              <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ PREVIOUS PROJECTS ═══════════ */}
      {previous.length > 0 && (
        <div>
          <GroupHeader title="Previous Projects" subtitle={`Outside ${tfLabel}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {previous.map(p => (
              <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
