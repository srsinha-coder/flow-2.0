// Flow — InTheLoopTab
// Top unread banner + responsive 3-column bento grid (Mentions · Updates ·
// Needs Attention). Each column previews 2–3 items and expands into a modal.
import React, { useState, useMemo } from "react";
import { c, mono, typo, space, layout } from "../../styles/theme";
import { EmptyState } from "../shared";
import NotificationColumn from "./NotificationColumn";
import ExpandedColumnView from "./ExpandedColumnView";

export default function InTheLoopTab({
  mentions = [], updates = [], attention = [],
  unread = { mentions: 0, updates: 0, attention: 0 },
  total = 0,
  notifSeen, mentionRead,
  goProject, markNotifs, markMentions,
}) {
  const [expandedKey, setExpandedKey] = useState(null);

  const columns = useMemo(() => [
    {
      key: "mentions", title: "Mentions", color: c.cyan, items: mentions, unread: unread.mentions,
      isUnread: (it) => !mentionRead.has(it.commentId),
      markAll: () => markMentions(mentions.map((m) => m.commentId)),
    },
    {
      key: "updates", title: "Updates", color: c.amber, items: updates, unread: unread.updates,
      isUnread: (it) => !notifSeen.has(it.id),
      markAll: () => markNotifs(updates.map((n) => n.id)),
    },
    {
      key: "attention", title: "Needs Attention", color: c.red, items: attention, unread: unread.attention,
      isUnread: (it) => !notifSeen.has(it.id),
      markAll: () => markNotifs(attention.map((n) => n.id)),
    },
  ], [mentions, updates, attention, unread, notifSeen, mentionRead, markNotifs, markMentions]);

  const expandedCol = columns.find((col) => col.key === expandedKey) || null;
  const everythingEmpty = mentions.length === 0 && updates.length === 0 && attention.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
      {/* Top unread banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: space[3],
        padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusMd,
        background: total > 0 ? `${c.accent}10` : c.surfaceAlt,
        border: `1px solid ${total > 0 ? `${c.accent}30` : c.border}`,
      }}>
        <span style={{
          minWidth: 26, height: 26, padding: "0 8px", borderRadius: 999,
          background: total > 0 ? c.accent : c.textGhost, color: "#fff",
          fontFamily: mono, fontSize: 13, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{total}</span>
        <span style={{ fontFamily: typo.bodyMd.font, fontSize: 15, fontWeight: 600, color: c.text }}>
          {total > 0
            ? `You have ${total} unread notification${total === 1 ? "" : "s"}`
            : "You're all caught up"}
        </span>
      </div>

      {everythingEmpty ? (
        <EmptyState icon="✅" title="You're all caught up" message="Mentions, updates on your projects, and anything critical will show up here." />
      ) : (
        <div className="nc-bento">
          {columns.map((col) => (
            <NotificationColumn
              key={col.key}
              kind={col.key}
              title={col.title}
              color={col.color}
              items={col.items}
              unread={col.unread}
              isUnread={col.isUnread}
              goProject={goProject}
              onExpand={() => setExpandedKey(col.key)}
            />
          ))}
        </div>
      )}

      <ExpandedColumnView
        open={!!expandedKey}
        column={expandedCol}
        isUnread={expandedCol?.isUnread}
        onClose={() => setExpandedKey(null)}
        onMarkAll={() => { expandedCol?.markAll?.(); }}
        goProject={goProject}
      />
    </div>
  );
}
