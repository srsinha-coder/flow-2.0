// Flow — NotificationColumn
// One bento column in the In the Loop grid (Mentions / Updates / Needs
// Attention). Shows a header with its own unread badge, 2–3 preview items, and
// a "[+X more] Click to expand" affordance. The whole column is clickable and
// opens the full list in ExpandedColumnView.
import React from "react";
import { c, mono, typo, space, motion } from "../../styles/theme";
import { Surface, EntityLink, Btn } from "../shared";

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
// Uniform card geometry — every notification card shares these so columns read
// as a clean, even grid. (min-height keeps short cards from collapsing; the
// 2-line clamps keep long ones from overflowing.)
const CARD = {
  position: "relative",
  minHeight: 96,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 14,
  borderRadius: 10,
  background: "#FFFFFF",
  border: "1px solid #e8e8e8",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};
const ACCENT = { mentions: c.cyan, attention: c.red, updates: c.amber };
const clamp = (lines) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" });

export function NotificationItem({ kind, item, goProject, unread = false }) {
  const onProj = (e) => { e.stopPropagation(); goProject?.(item.projectId); };
  const accent = ACCENT[kind] || c.amber;
  const time = fmtRelative(item.ts);

  let title, body;
  if (kind === "mentions") {
    const author = item.author?.name?.split(/\s+/)[0] || "Someone";
    const text = (item.body || "").replace(/\s+/g, " ").trim();
    title = (
      <>
        {author} mentioned you on{" "}
        <EntityLink type="project" underline onClick={onProj}>{item.projectName}</EntityLink>
      </>
    );
    body = text ? `“${text}”` : null;
  } else {
    // updates / attention — lead with the (clickable) project name, then phrase.
    const detail = item.title?.startsWith(item.projectName)
      ? item.title.slice(item.projectName.length).replace(/^\s+/, "")
      : item.title;
    title = (
      <>
        <EntityLink type="project" underline onClick={onProj}>{item.projectName}</EntityLink>
        {detail ? ` ${detail}` : ""}
      </>
    );
    body = item.meta || null;
  }

  return (
    <div style={CARD}>
      {unread && (
        <span style={{ position: "absolute", top: 14, right: 14, width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      )}
      {/* Title — bold */}
      <div style={{ fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 700, color: c.text, lineHeight: 1.4, paddingRight: unread ? 14 : 0, ...clamp(2) }}>
        {title}
      </div>
      {/* Body — regular weight, muted */}
      {body && (
        <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, fontWeight: 400, color: c.textMid, lineHeight: 1.5, ...clamp(2) }}>
          {body}
        </div>
      )}
      {/* Footer — metadata + CTA, pinned to the bottom for an even baseline */}
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: "auto", paddingTop: space[1] }}>
        {time && <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, color: c.textDim }}>{time}</span>}
        {kind === "attention" && item.cta && (
          <Btn variant="secondary" size="sm" onClick={onProj} style={{ marginLeft: "auto" }}>{item.cta}</Btn>
        )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
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
