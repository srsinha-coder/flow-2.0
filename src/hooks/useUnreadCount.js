// Flow — useUnreadCount
// Returns { mentions, updates, attention, total } — counts of UNSEEN items in
// each In-the-Loop bucket. Reads the same seen-state the center writes
// (localStorage "flow_notif_seen" + sessionStorage "flow_inbox_read") and
// recomputes when that state changes (storage event or in-app "flow-notif-seen").
import { useMemo, useState, useEffect } from "react";
import useNotifications from "./useNotifications";

const NOTIF_SEEN_KEY = "flow_notif_seen";
const INBOX_READ_KEY = "flow_inbox_read";

function readSet(key, storage) {
  try { return new Set(JSON.parse(storage.getItem(key) || "[]")); } catch { return new Set(); }
}

export default function useUnreadCount({ projects = [], people = [], viewer = null, followedProjects = [] } = {}) {
  const { mentions, updates, attention } = useNotifications({ projects, people, viewer, followedProjects });

  const [seenVer, setSeenVer] = useState(0);
  useEffect(() => {
    const bump = () => setSeenVer((v) => v + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("flow-notif-seen", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("flow-notif-seen", bump);
    };
  }, []);

  return useMemo(() => {
    const notifSeen = readSet(NOTIF_SEEN_KEY, localStorage);
    const mentionRead = readSet(INBOX_READ_KEY, sessionStorage);
    const m = mentions.filter((x) => !mentionRead.has(x.commentId)).length;
    const u = updates.filter((x) => !notifSeen.has(x.id)).length;
    const a = attention.filter((x) => !notifSeen.has(x.id)).length;
    return { mentions: m, updates: u, attention: a, total: m + u + a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentions, updates, attention, seenVer]);
}
