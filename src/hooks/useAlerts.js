import { useMemo, useState, useCallback } from "react";

const FROZEN_DAYS = 7;
const NEW_PROJECT_HOURS = 24;

export default function useAlerts(projects, phaseDurationDefaults) {
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("flow_alert_read") || "[]"); }
    catch { return []; }
  });

  const alerts = useMemo(() => {
    if (!projects?.length) return [];
    const now = Date.now();
    const dayAgo = now - NEW_PROJECT_HOURS * 3_600_000;
    const result = [];

    projects.forEach(p => {
      if (p.status === "deprioritized" || p.status === "upcoming") return;

      if (p.isBlocked) {
        const days = p.blockedAt ? Math.floor((now - new Date(p.blockedAt).getTime()) / 86_400_000) : 0;
        result.push({ id: `blocked-${p.id}`, type: "blocker", projectId: p.id, projectName: p.name,
          squad: p.squad, message: p.blockedReason || "Blocked", days, severity: "critical" });
      }

      if (p.lastActivityAt && new Date(p.lastActivityAt).getTime() >= dayAgo) {
        result.push({ id: `new-${p.id}`, type: "new_project", projectId: p.id, projectName: p.name,
          squad: p.squad, message: "New project", severity: "info" });
      }

      const frozenCheck = p.lastActivityAt ? (now - new Date(p.lastActivityAt).getTime()) / 86_400_000 : Infinity;
      if (p.status !== "shipped" && frozenCheck > FROZEN_DAYS) {
        result.push({ id: `frozen-${p.id}`, type: "frozen", projectId: p.id, projectName: p.name,
          squad: p.squad, days: Math.floor(frozenCheck),
          message: `No activity for ${Math.floor(frozenCheck)}d`, severity: "warning" });
      }
    });

    projects.forEach(p => {
      if (p.status !== "upcoming" || !p.tentativeStartDate) return;
      const tentMs = new Date(p.tentativeStartDate + "T00:00:00").getTime();
      if (tentMs < now) {
        const days = Math.floor((now - tentMs) / 86_400_000);
        result.push({ id: `start-overdue-${p.id}`, type: "start_overdue",
          projectId: p.id, projectName: p.name, squad: p.squad, days,
          message: `Tentative start date passed by ${days}d`, severity: "warning" });
      }
    });

    result.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9);
    });

    return result;
  }, [projects, phaseDurationDefaults]);

  const unreadCount = useMemo(() =>
    alerts.filter(a => !readIds.includes(a.id)).length,
  [alerts, readIds]);

  const markRead = useCallback((ids) => {
    const arr = Array.isArray(ids) ? ids : [ids];
    setReadIds(prev => {
      const next = [...new Set([...prev, ...arr])];
      try { sessionStorage.setItem("flow_alert_read", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    const all = alerts.map(a => a.id);
    setReadIds(all);
    try { sessionStorage.setItem("flow_alert_read", JSON.stringify(all)); } catch {}
  }, [alerts]);

  return { alerts, unreadCount, markRead, markAllRead };
}
