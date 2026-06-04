// Flow — useNotifications
// Fetches the raw notification feed (dev-seed or, in prod, a notifications
// table) and returns the four strictly-filtered buckets the center renders.
// Re-derives live as the dev activity log changes.
import { useMemo, useState, useEffect } from "react";
import { isDevSeedMode, devStore } from "../data/devSeed";
import { ANNOUNCEMENTS } from "../data/announcements";
import { collectNotifications, buildWhatsNew } from "../lib/notifications";
import { filterMentions, filterProjectUpdates, filterNeedsAttention } from "../lib/notificationFilters";

export default function useNotifications({ projects = [], people = [], viewer = null, followedProjects = [] } = {}) {
  // Bump on any activity-log mutation so the feed stays live.
  const [evVer, setEvVer] = useState(0);
  useEffect(() => {
    if (!isDevSeedMode()) return;
    return devStore.subscribe(() => setEvVer((v) => v + 1));
  }, []);

  return useMemo(() => {
    const raw = collectNotifications({ projects, people, viewer });
    return {
      mentions: filterMentions({ projects, people, viewer }),
      updates: filterProjectUpdates(raw, { viewer, followedProjects }),
      attention: filterNeedsAttention(raw),
      whatsNew: buildWhatsNew({ projects, announcements: ANNOUNCEMENTS }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, people, viewer, followedProjects, evVer]);
}
