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

function ProjectRow({ proj, onNavigate, label }) {
  const stale = isStale(proj.lastActivityAt);
  const active = getActiveTracks(proj);
  const pc = getPhaseColors();

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

      {/* Name + owner label + tracks sub-line */}
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
        </div>
      </div>

      {/* Status badge (right side) */}
      {isShipped(proj) && (
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: c.green, textTransform: "uppercase", flexShrink: 0 }}>Shipped</span>
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


export default function PersonProjects({ person, projects, onProjectNavigate }) {
  const personId = person?.id;
  const { memberships, comments, loading, error } = usePersonActivity(personId);

  const projectsById = useMemo(() => {
    const m = new Map();
    (projects || []).forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  // Merge owns + member-of into a single deduplicated list, then split by phase
  const { inFlight, shipped } = useMemo(() => {
    if (!personId) return { inFlight: [], shipped: [] };
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
      // Owner projects first, then by activity
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0);
    };

    return {
      inFlight: all.filter(p => isInFlight(p) || p.status === "blocked").sort(sortOwnerFirst),
      shipped: all.filter(isShipped).sort(sortOwnerFirst),
    };
  }, [projects, memberships, projectsById, personId]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[6] }}>
      {/* ── In Flight Projects ─────────────────────────────────── */}
      <div>
        <SectionTitle title="In Flight" count={inFlight.length} />
        {inFlight.length === 0 ? (
          <div style={{
            padding: space[4], borderRadius: layout.radiusSm,
            background: c.surface, border: `1px dashed ${c.border}`,
            color: c.textDim, fontSize: 13, fontFamily: body, textAlign: "center",
          }}>
            No in-flight projects right now.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {inFlight.map(p => (
              <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
            ))}
          </div>
        )}
      </div>

      {/* ── Shipped Projects ───────────────────────────────────── */}
      <div>
        <SectionTitle title="Shipped" count={shipped.length} />
        {shipped.length === 0 ? (
          <div style={{
            padding: space[4], borderRadius: layout.radiusSm,
            background: c.surface, border: `1px dashed ${c.border}`,
            color: c.textDim, fontSize: 13, fontFamily: body, textAlign: "center",
          }}>
            No shipped projects yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {shipped.map(p => (
              <ProjectRow key={p.id} proj={p} onNavigate={onProjectNavigate} label={p.isOwner ? "Owner" : undefined} />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Activity ────────────────────────────────────── */}
      <div>
        <SectionTitle title="Recent Activity" count={comments.length} />
        {comments.length === 0 ? (
          <div style={{
            padding: space[4], borderRadius: layout.radiusSm,
            background: c.surface, border: `1px dashed ${c.border}`,
            color: c.textDim, fontSize: 13, fontFamily: body, textAlign: "center",
          }}>
            No activity yet. When {person?.name || "this person"} comments on a
            project, you'll see the latest activity here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {comments.map(cmt => (
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
  );
}
