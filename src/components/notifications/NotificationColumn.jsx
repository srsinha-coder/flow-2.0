// Flow — NotificationColumn
// One bento column in the In the Loop grid (Mentions / Updates / Needs
// Attention). Shows a header with its own unread badge, 2–3 preview items, and
// a "[+X more] Click to expand" affordance. The whole column is clickable and
// opens the full list in ExpandedColumnView.
import React from "react";
import { c, mono, typo, space, layout, motion } from "../../styles/theme";
import { Surface, Tag, EntityLink, Btn } from "../shared";

export function fmtRelative(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Shared item renderer (used by both the column preview and the modal) ──
export function NotificationItem({ kind, item, goProject, unread = false }) {
  const onProj = (e) => { e.stopPropagation(); goProject?.(item.projectId); };
  const time = fmtRelative(item.ts);
  const accent = kind === "mentions" ? c.cyan : kind === "attention" ? c.red : c.amber;

  let body;
  if (kind === "mentions") {
    const author = item.author?.name?.split(/\s+/)[0] || "Someone";
    const text = (item.body || "").replace(/\s+/g, " ").trim();
    const snippet = text.slice(0, 90);
    body = (
      <>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: 13, color: c.text, lineHeight: 1.4 }}>
          {author} mentioned you on{" "}
          <EntityLink type="project" underline onClick={onProj}>{item.projectName}</EntityLink>
        </div>
        {snippet && (
          <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textMid, marginTop: 2, lineHeight: 1.5 }}>
            “{snippet}{text.length > 90 ? "…" : ""}”
          </div>
        )}
      </>
    );
  } else {
    // updates / attention — lead with the (clickable) project name, then phrase.
    const detail = item.title?.startsWith(item.projectName)
      ? item.title.slice(item.projectName.length).replace(/^\s+/, "")
      : item.title;
    body = (
      <>
        <div style={{ fontFamily: typo.bodyMd.font, fontSize: 13, color: c.text, lineHeight: 1.4 }}>
          <EntityLink type="project" underline onClick={onProj}>{item.projectName}</EntityLink>
          {detail ? ` ${detail}` : ""}
        </div>
        {item.meta && (
          <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textMid, marginTop: 2, lineHeight: 1.5 }}>
            {item.meta}
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{
      position: "relative",
      padding: `${space[2]}px ${space[3]}px`,
      paddingLeft: space[3] + 6,
      borderRadius: layout.radiusSm,
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderLeft: `3px solid ${item.resolved ? c.textGhost : accent}`,
      opacity: item.resolved ? 0.6 : 1,
    }}>
      {/* unread pip */}
      {unread && !item.resolved && (
        <span style={{
          position: "absolute", top: 10, right: 10,
          width: 7, height: 7, borderRadius: "50%", background: accent,
        }} />
      )}
      {body}
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[2] }}>
        {time && <span style={{ fontFamily: mono, fontSize: 10, color: c.textDim }}>{time}</span>}
        {kind === "attention" && item.cta && !item.resolved && (
          <Btn variant="secondary" size="sm" onClick={onProj} style={{ marginLeft: "auto" }}>{item.cta}</Btn>
        )}
        {item.resolved && <Tag color={c.textDim} bg={c.surfaceAlt} style={{ marginLeft: "auto" }}>Resolved</Tag>}
      </div>
    </div>
  );
}

export default function NotificationColumn({
  kind, title, color, items = [], unread = 0, isUnread = () => false,
  onExpand, goProject, previewCount = 3,
}) {
  const preview = items.slice(0, previewCount);
  const moreCount = items.length - preview.length;

  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand?.(); } };

  return (
    <Surface
      variant="panel"
      accent={color}
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={onKey}
      style={{
        display: "flex", flexDirection: "column", gap: space[3],
        padding: space[4], cursor: "pointer", minHeight: 220,
        transition: `box-shadow ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
      }}
    >
      {/* Header: dot + title + unread badge */}
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: c.textMid }}>
          {title}
        </span>
        {unread > 0 && (
          <span style={{
            marginLeft: "auto", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
            background: color, color: "#fff", fontFamily: mono, fontSize: 10, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>{unread}</span>
        )}
      </div>

      {/* Preview items */}
      {items.length === 0 ? (
        <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textDim, fontStyle: "italic", padding: `${space[3]}px 0` }}>
          Nothing right now.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {preview.map((it) => (
            <NotificationItem key={it.id} kind={kind} item={it} goProject={goProject} unread={isUnread(it)} />
          ))}
        </div>
      )}

      {/* Expand affordance */}
      {items.length > 0 && (
        <div style={{
          marginTop: "auto", paddingTop: space[2],
          fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: color,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {moreCount > 0 ? `+${moreCount} more` : "View all"} · Click to expand →
        </div>
      )}
    </Surface>
  );
}
