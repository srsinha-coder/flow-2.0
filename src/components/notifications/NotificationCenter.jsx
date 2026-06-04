// Flow — NotificationCenter (full page)
// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: In the Loop (default) — bento grid: Mentions · Updates · Needs Attention
// Tab 2: What's New          — chronological product timeline
// Owns seen-state for the In-the-Loop buckets and passes it down. No "My Lens".
import React, { useState, useMemo, useCallback } from "react";
import { c, mono, typo, space, layout, motion } from "../../styles/theme";
import { Btn } from "../shared";
import useNotifications from "../../hooks/useNotifications";
import useDevLabel from "../../hooks/useDevLabel";
import InTheLoopTab from "./InTheLoopTab";
import WhatsNewTab from "./WhatsNewTab";

const NOTIF_SEEN_KEY = "flow_notif_seen";
const INBOX_READ_KEY = "flow_inbox_read";

function readSet(key, storage) {
  try { return new Set(JSON.parse(storage.getItem(key) || "[]")); } catch { return new Set(); }
}
function writeSet(key, storage, set) {
  try { storage.setItem(key, JSON.stringify([...set])); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("flow-notif-seen")); } catch { /* ignore */ }
}

export default function NotificationCenter({ projects = [], people = [], viewer = null, followedProjects = [], onNavigate }) {
  const devRef = useDevLabel("NotificationCenter", "src/components/notifications/NotificationCenter.jsx", "Full-page center: In the Loop (bento) + What's New (timeline).");
  const [tab, setTab] = useState("loop"); // loop (default) | whatsnew

  const { mentions, updates, attention, whatsNew } = useNotifications({ projects, people, viewer, followedProjects });

  const [notifSeen, setNotifSeen] = useState(() => readSet(NOTIF_SEEN_KEY, localStorage));
  const [mentionRead, setMentionRead] = useState(() => readSet(INBOX_READ_KEY, sessionStorage));

  const unread = useMemo(() => ({
    mentions: mentions.filter((m) => !mentionRead.has(m.commentId)).length,
    updates: updates.filter((n) => !notifSeen.has(n.id)).length,
    attention: attention.filter((n) => !notifSeen.has(n.id)).length,
  }), [mentions, updates, attention, notifSeen, mentionRead]);
  const total = unread.mentions + unread.updates + unread.attention;

  const markNotifs = useCallback((ids) => setNotifSeen((prev) => {
    const n = new Set(prev); ids.forEach((i) => n.add(i)); writeSet(NOTIF_SEEN_KEY, localStorage, n); return n;
  }), []);
  const markMentions = useCallback((ids) => setMentionRead((prev) => {
    const n = new Set(prev); ids.forEach((i) => n.add(i)); writeSet(INBOX_READ_KEY, sessionStorage, n); return n;
  }), []);

  const goProject = useCallback((id) => { if (onNavigate && id) onNavigate("projects", id, "notifications"); }, [onNavigate]);

  const TABS = [
    { key: "loop", label: "In the Loop", count: total },
    { key: "whatsnew", label: "What's New", count: 0 },
  ];

  return (
    <div ref={devRef} style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: space[3] }}>
        <div>
          <h1 style={{ fontFamily: typo.displayMd.font, fontSize: typo.displayMd.size, fontWeight: typo.displayMd.weight, color: c.text, margin: 0 }}>
            Notifications
          </h1>
          <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
                  display: "inline-flex", alignItems: "center", gap: space[2],
                  padding: `${space[2]}px ${space[4]}px`, borderRadius: layout.radiusSm,
                  background: active ? c.surfaceSolid : "transparent",
                  border: `1px solid ${active ? c.border : "transparent"}`,
                  boxShadow: active ? c.shadowSm : "none",
                  fontFamily: typo.bodySm.font, fontSize: 13, fontWeight: active ? 700 : 600,
                  color: active ? c.text : c.textDim, cursor: "pointer",
                  transition: `all ${motion.fast.duration} ${motion.fast.easing}`,
                }}>
                  {t.label}
                  {t.count > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
                      background: c.accent, color: "#fff", fontFamily: mono, fontSize: 10, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {tab === "loop" && total > 0 && (
          <Btn variant="ghost" size="sm" onClick={() => {
            markNotifs([...updates, ...attention].map((n) => n.id));
            markMentions(mentions.map((m) => m.commentId));
          }}>Mark all read</Btn>
        )}
      </div>

      {tab === "loop" ? (
        <InTheLoopTab
          mentions={mentions} updates={updates} attention={attention}
          unread={unread} total={total}
          notifSeen={notifSeen} mentionRead={mentionRead}
          goProject={goProject} markNotifs={markNotifs} markMentions={markMentions}
        />
      ) : (
        <WhatsNewTab whatsNew={whatsNew} goProject={goProject} />
      )}
    </div>
  );
}
