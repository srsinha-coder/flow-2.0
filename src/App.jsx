// Flow — Main App Shell
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { setTheme, c, body, space, layout } from "./styles/theme";
import AnimStyles from "./components/AnimStyles";
import CommandPalette from "./components/CommandPalette";
import ShortcutHintBar from "./components/ShortcutHintBar";
import useKeyboard from "./hooks/useKeyboard";
import { tactile } from "./hooks/useTactile";
import useSupabaseData from "./hooks/useSupabaseData";
import { useSyncedSetters } from "./hooks/useSyncedSetters";
import useAuth from "./hooks/useAuth";
import useAlerts from "./hooks/useAlerts";
import LoginScreen from "./components/LoginScreen";
import PendingApprovalScreen from "./components/PendingApprovalScreen";
import QAReviewView from "./views/QAReviewView";
import OnboardingScreen from "./components/OnboardingScreen";
import { Header, NAV } from "./components/AppShell";
import SummaryView from "./views/SummaryView";
import ProjectsView from "./views/ProjectsView";
import PeopleDeepDive from "./views/PeopleDeepDive";
import SettingsView from "./views/SettingsView";
import GuideView from "./views/GuideView";
import LogsView from "./views/LogsView";
import TerminalView from "./views/TerminalView";
import FlowLogo from "./components/FlowLogo";
import SyncToast from "./components/SyncToast";
import ActionToast from "./components/ActionToast";
import DevOverlayProvider from "./components/DevOverlay";
import WelcomeTutorial from "./components/WelcomeTutorial";
import { isDevSeedMode, devStore } from "./data/devSeed";
import { makeCanChecker, loadPermConfig, savePermConfig } from "./lib/permissions";

export default function FlowApp() {
  // ── Auth ──
  const auth = useAuth();
  const [signInError, setSignInError] = React.useState(null);
  const [signingIn, setSigningIn] = React.useState(false);

  const handleSignIn = React.useCallback(async () => {
    setSignInError(null);
    setSigningIn(true);
    const result = await auth.signIn();
    if (result?.error) {
      setSignInError(result.error);
      setSigningIn(false);
    }
  }, [auth.signIn]);

  const loginError = signInError || auth.authError;

  // ── Auth gates ──
  if (auth.loading) {
    return (
      <div style={{
        minHeight: "100vh", background: c.bg, color: c.text, fontFamily: body,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <style>{`
          @keyframes flow-auth-pulse {
            0%, 100% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.06); opacity: 1; }
          }
        `}</style>
        <div style={{ animation: "flow-auth-pulse 2s ease-in-out infinite" }}>
          <FlowLogo size={100} />
        </div>
        <div style={{ marginTop: 20, fontSize: 16, color: c.textDim, fontWeight: 500 }}>Loading...</div>
      </div>
    );
  }

  // Skip auth on localhost for dev, or when built with VITE_SKIP_AUTH
  // To preview login screen on localhost, set this to false temporarily
  const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || import.meta.env.VITE_SKIP_AUTH === "true";

  // Preview gate — ?login=1 shows the login screen even on localhost
  const params = new URLSearchParams(window.location.search);
  if (params.has("qaReview")) {
    return <QAReviewView />;
  }
  if (params.has("login")) {
    return <LoginScreen onSignIn={() => {
      // On localhost preview, skip OAuth and show welcome/tutorial flow
      if (isDev) {
        try { localStorage.removeItem("flow_tutorial_seen"); } catch {}
        params.delete("login");
        const qs = params.toString();
        window.location.href = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
        return;
      }
      handleSignIn();
    }} loading={signingIn} error={loginError} />;
  }
  if (params.has("pending")) {
    return (
      <PendingApprovalScreen
        user={{ email: "preview@noon.com", user_metadata: { full_name: "Preview User" } }}
        personProfile={{ name: "Preview User", status: params.get("pending") === "rejected" ? "rejected" : "pending" }}
        status={params.get("pending") === "rejected" ? "rejected" : "pending"}
        onSignOut={() => { /* preview only */ }}
      />
    );
  }

  if (!isDev && !auth.isAuthenticated) {
    return <LoginScreen onSignIn={handleSignIn} loading={signingIn} error={loginError} />;
  }

  if (!isDev && auth.needsOnboarding) {
    return <OnboardingScreen user={auth.user} onComplete={auth.completeOnboarding} />;
  }

  if (!isDev && auth.isAuthenticated && auth.personProfile && !auth.isApproved) {
    return (
      <PendingApprovalScreen
        user={auth.user}
        personProfile={auth.personProfile}
        status={auth.personProfile.status}
        onSignOut={auth.signOut}
      />
    );
  }

  return <DevOverlayProvider><FlowDashboard auth={auth} /></DevOverlayProvider>;
}

function FlowDashboard({ auth }) {
  const [activeTab, setActiveTab] = useState(() => {
    // Honor ?tab=<key> on initial load; also auto-route to Pulse when
    // a Pulse-specific param (?mode=people) is present.
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const validTabs = NAV.filter(n => !n.separator).map(n => n.key);
      if (tab && validTabs.includes(tab)) return tab;
    } catch { /* ignore */ }
    return "summary";
  });
  const [navPayload, setNavPayload] = useState(() => {
    // Honor ?id= (projects) and ?person= (commit/people) on initial load so
    // deeplinks land directly on the deep-dive view.
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const person = params.get("person");
      if (person) return person;
      if (id) return id;
    } catch { /* ignore */ }
    return null;
  });
  const darkMode = false;
  const [terminalUnlocked, setTerminalUnlocked] = useState(() => sessionStorage.getItem("flow_terminal_unlocked") === "true");

  // ── Supabase data (replaces seed.js) ──
  const {
    loading, error,
    squads, setSquads: rawSetSquads,
    roles, setRoles: rawSetRoles,
    people, setPeople: rawSetPeople,
    projects, setProjects: rawSetProjects,
    commitments, setCommitments: rawSetCommitments,
    history: supabaseHistory,
    weekConfig: supabaseWeekConfig,
    appSettings, setAppSettings,
    projectLinks, setProjectLinks,
    phaseDurationDefaults,
    lookups,
  } = useSupabaseData();

  const { alerts, unreadCount: alertCount, markRead: markAlertRead, markAllRead: markAllAlertsRead } = useAlerts(projects, phaseDurationDefaults);

  // Use Supabase data directly — no seed fallbacks
  const history = supabaseHistory && Object.keys(supabaseHistory).length > 0 ? supabaseHistory : {};

  // ── Synced setters: optimistic UI + background Supabase writes ──
  const {
    setSquads, setRoles, setPeople, setProjects, setCommitments,
    flushDirtyToDB,
  } = useSyncedSetters({
    rawSetSquads, rawSetRoles, rawSetPeople, rawSetProjects, rawSetCommitments,
    squads, roles, people, projects, commitments,
    lookups,
    weekConfig: supabaseWeekConfig,
    onSyncStart: () => window.__flowSyncToast?.show(),
    onSyncDone: (name) => window.__flowSyncToast?.done(name),
  });

  const [detailLabel, setDetailLabel] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const goBackRef = useRef(null);
  const suppressBackRef = useRef(false);
  const searchRef = useRef(null);
  const [showHints, setShowHints] = useState(false);

  // ── My Lens (personal filter: my squad + followed projects) ──
  const [myLens, setMyLens] = useState(() => {
    try { return localStorage.getItem("flow_my_lens") === "true"; } catch { return false; }
  });
  // Explicit cross-squad follows
  const [extraFollows, setExtraFollows] = useState(() => {
    try { return JSON.parse(localStorage.getItem("flow_followed_projects") || "[]"); } catch { return []; }
  });
  // Explicit unfollows of auto-followed (squad) projects where viewer is not owner/member
  const [unfollowedProjects, setUnfollowedProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem("flow_unfollowed_projects") || "[]"); } catch { return []; }
  });

  // ── Welcome tutorial (first-run onboarding) ──
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem("flow_tutorial_seen"); } catch { return false; }
  });

  // ── Toggle sound (Web Audio API — subtle click) ──
  const playToggleSound = useCallback((isOn) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = isOn ? 740 : 580;
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
      setTimeout(() => ctx.close(), 150);
    } catch {}
  }, []);

  const toggleMyLens = useCallback(() => setMyLens(v => {
    const next = !v;
    try { localStorage.setItem("flow_my_lens", String(next)); } catch {}
    playToggleSound(next);
    return next;
  }), [playToggleSound]);

  // ── Timeframe (quarter / custom range) ──
  const [timeframe, setTimeframe] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const q = Math.floor(now.getMonth() / 3); // 0-3
    const qStart = new Date(y, q * 3, 1);
    const qEnd = new Date(y, q * 3 + 3, 0); // last day of quarter
    return { label: `Q${q + 1}`, year: y, start: qStart.toISOString().slice(0, 10), end: qEnd.toISOString().slice(0, 10) };
  });

  // ── Global filters (header bar) ──
  const [globalFilters, setGlobalFilters] = useState({ owner: [], squad: [], person: [], track: [], type: [] });
  const [pendingFilters, setPendingFilters] = useState({ owner: [], squad: [], person: [], track: [], type: [] });
  const applyFilters = useCallback(() => setGlobalFilters({ ...pendingFilters }), [pendingFilters]);
  const clearGlobalFilters = useCallback(() => { const empty = { owner: [], squad: [], person: [], track: [], type: [] }; setGlobalFilters(empty); setPendingFilters(empty); }, []);
  const globalFilterCount = useMemo(() => Object.values(globalFilters).filter(v => v.length > 0).length, [globalFilters]);
  const allSquads = useMemo(() => [...new Set(projects.map(p => p.squad).filter(Boolean))].sort(), [projects]);
  // Contextual options: filter Person/Owner by selected Squad
  const allOwners = useMemo(() => {
    const src = pendingFilters.squad.length > 0 ? projects.filter(p => pendingFilters.squad.includes(p.squad)) : projects;
    return [...new Set(src.map(p => p.owner).filter(Boolean))].sort();
  }, [projects, pendingFilters.squad]);
  const allPeople = useMemo(() => {
    const src = pendingFilters.squad.length > 0 ? people.filter(p => pendingFilters.squad.includes(p.squad)) : people;
    return src.map(p => p.name).sort();
  }, [people, pendingFilters.squad]);

  const setGoBack = useCallback((fn) => { goBackRef.current = fn; }, []);
  const returnContextRef = useRef(null);
  // Remember the last non-Terminal tab so Escape / close from Terminal
  // drops the user back where they came from instead of always Summary.
  const prevNonTerminalTabRef = useRef("summary");
  useEffect(() => {
    if (activeTab !== "terminal") prevNonTerminalTabRef.current = activeTab;
  }, [activeTab]);

  const handleTerminalUnlock = useCallback((moduleKey) => {
    sessionStorage.setItem("flow_terminal_unlocked", "true");
    setTerminalUnlocked(true);
    if (moduleKey === "settings" || moduleKey === "logs") {
      flushDirtyToDB();
      setActiveTab(moduleKey);
      setNavPayload(null);
      setDetailLabel(null);
      goBackRef.current = null;
    }
  }, [flushDirtyToDB]);

  const [terminalResetKey, setTerminalResetKey] = useState(0);
  const [projResetKey, setProjResetKey] = useState(0);

  const handleTabSwitch = useCallback((key) => {
    // Flush any unsaved commit drafts to DB before leaving
    flushDirtyToDB();
    // If already on terminal and clicking terminal again, reset to root
    if (key === "terminal" && activeTab === "terminal") {
      setTerminalResetKey(k => k + 1);
      tactile.click();
      return;
    }
    // Gate settings/logs/rant behind terminal — these render inside TerminalView
    if ((key === "settings" || key === "logs" || key === "rant") && !terminalUnlocked) {
      setActiveTab("terminal");
      setNavPayload(null);
    } else if (key === "rant") {
      // Rant only renders inside TerminalView as a module, not as a top-level tab
      setActiveTab("terminal");
      setNavPayload("rant");
    } else {
      setActiveTab(key);
      setNavPayload(null);
    }
    setDetailLabel(null);
    goBackRef.current = null;
    if (returnContextRef.current) returnContextRef.current = null;
    tactile.click();
  }, [flushDirtyToDB, terminalUnlocked, activeTab]);

  const handleBack = useCallback(() => {
    flushDirtyToDB();
    const ret = returnContextRef.current;
    if (ret && ret.tab) {
      returnContextRef.current = null;
      setNavPayload(ret.id || null);
      setActiveTab(ret.tab);
      setDetailLabel(null);
      goBackRef.current = null;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }
    if (goBackRef.current) {
      goBackRef.current();
      setDetailLabel(null);
      goBackRef.current = null;
    }
  }, [flushDirtyToDB]);

  // Intercept browser back button: keep users inside the app and route
  // the gesture to in-app back navigation (deep-dive → list) instead of
  // exiting to about:blank. Push a sentinel entry on mount so the first
  // back press has somewhere to land, and re-push after each pop.
  React.useEffect(() => {
    window.history.pushState({ flowInApp: true }, "");
    const onPop = () => {
      if (goBackRef.current) handleBack();
      window.history.pushState({ flowInApp: true }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [handleBack]);

  const handleNavigate = useCallback((tab, id, returnTo) => {
    flushDirtyToDB();
    returnContextRef.current = returnTo || null;
    setNavPayload(id);
    setActiveTab(tab);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [flushDirtyToDB]);

  // ── URL sync ─────────────────────────────────────────────────────
  // Keep the address bar in sync with (activeTab, navPayload) so users can
  // copy a URL and land back on the same page. Use replaceState — the
  // popstate trap above relies on a single sentinel entry, so pushing a new
  // history entry per tab change would break the back-button behavior.
  // - Terminal-gated views (settings/logs/rant) and transient nav payload
  //   fields (prefillProject, prefillForce, commitIdx) are intentionally not
  //   serialized — those are one-shot navigation hints, not shareable state.
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      // App.jsx owns `tab` and `person`. `id` (project) is owned by
      // ProjectsView's own URL-sync effect.
      params.delete("tab");
      params.delete("person");
      // Drop any legacy params from the retired Pulse/Commit tabs so they
      // don't dangle in the address bar after this rewrite.
      ["mode", "phase", "sort", "dir", "status", "risks", "commitIdx", "prefillProject", "prefillForce"].forEach(k => params.delete(k));
      const hiddenTabs = ["terminal", "settings", "logs", "rant"];
      if (!hiddenTabs.includes(activeTab)) {
        params.set("tab", activeTab);
      }
      // Clear `id` when we leave the projects tab so the stale project
      // doesn't dangle in the URL.
      if (activeTab !== "projects") params.delete("id");
      // Serialize `person` for the people tab. People is the only consumer
      // now that the Commit tab has been retired.
      if (navPayload && !hiddenTabs.includes(activeTab)) {
        if (activeTab === "people" && typeof navPayload === "string") {
          params.set("person", navPayload);
        }
      }
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(window.history.state, "", next);
      }
    } catch { /* URL updates are best-effort */ }
  }, [activeTab, navPayload]);

  const c = setTheme(darkMode);
  const activeNavItem = NAV.find(n => n.key === activeTab);

  // Logged-in viewer's person row. In dev (auth skipped on localhost) fall back
  // to the first person in the roster so the "Add commit" CTAs are testable.
  const viewerProfile = React.useMemo(() => {
    if (auth.personProfile?.name) return auth.personProfile;
    const devFallback = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (devFallback && Array.isArray(people) && people.length > 0) {
      const first = people[0];
      // Include `id` in the dev fallback — comments + members mutations need
      // a real people-row id, not just a name.
      return { id: first.id, name: first.name, squad: first.squad, role: first.role, isAdmin: !!first.isAdmin };
    }
    return null;
  }, [auth.personProfile, people]);

  // Global admin flag: person-level isAdmin OR email-based owner list
  const isAdmin = !!(viewerProfile?.isAdmin || auth?.isOwner);

  // ── Permission config (editable from Settings > Permissions) ──
  const [permConfig, setPermConfig] = useState(() => loadPermConfig());
  const permCan = useMemo(() => makeCanChecker(permConfig), [permConfig]);
  const handleSetPermConfig = useCallback((cfg) => {
    setPermConfig(cfg);
    savePermConfig(cfg);
  }, []);

  // ── My Lens: compute "my projects" ──
  // All squad projects + any cross-squad project where viewer is owner or member
  const myProjectIds = useMemo(() => {
    if (!viewerProfile?.id || !viewerProfile?.squad) return [];
    return projects.filter(p => {
      // All projects in my squad are "mine"
      if (p.squad === viewerProfile.squad) return true;
      // Cross-squad: only if I own or am a member
      if (p.owner_id === viewerProfile.id) return true;
      if (isDevSeedMode()) {
        const members = devStore.listMembers(p.id) || [];
        return members.some(m => m.person_id === viewerProfile.id);
      }
      return false;
    }).map(p => p.id);
  }, [projects, viewerProfile]);

  // Locked follows — viewer owns or is a member; these can never be unfollowed
  const lockedProjectIds = useMemo(() => {
    if (!viewerProfile?.id) return [];
    return projects.filter(p => {
      if (p.owner_id === viewerProfile.id) return true;
      if (isDevSeedMode()) {
        const members = devStore.listMembers(p.id) || [];
        return members.some(m => m.person_id === viewerProfile.id);
      }
      return false;
    }).map(p => p.id);
  }, [projects, viewerProfile]);

  // Effective followed = my projects + extra follows, minus explicit unfollows
  // (locked owner/member projects always stay followed)
  const followedProjects = useMemo(() => {
    const set = new Set(myProjectIds);
    extraFollows.forEach(id => set.add(id));
    unfollowedProjects.forEach(id => { if (!lockedProjectIds.includes(id)) set.delete(id); });
    return [...set];
  }, [myProjectIds, extraFollows, unfollowedProjects, lockedProjectIds]);

  const toggleFollowProject = useCallback((projectId) => {
    // Block unfollow only when viewer owns or is a member
    if (lockedProjectIds.includes(projectId)) {
      window.__flowToast?.({ message: "Can’t unfollow — you own or are a member of this project", icon: "warn" });
      return;
    }
    const isCurrentlyFollowed = followedProjects.includes(projectId);
    if (isCurrentlyFollowed) {
      // Drop any explicit follow, and record an explicit unfollow for auto-followed squad projects
      setExtraFollows(prev => {
        const next = prev.filter(id => id !== projectId);
        try { localStorage.setItem("flow_followed_projects", JSON.stringify(next)); } catch {}
        return next;
      });
      if (myProjectIds.includes(projectId)) {
        setUnfollowedProjects(prev => {
          if (prev.includes(projectId)) return prev;
          const next = [...prev, projectId];
          try { localStorage.setItem("flow_unfollowed_projects", JSON.stringify(next)); } catch {}
          return next;
        });
      }
      window.__flowToast?.("Project unfollowed");
    } else {
      // Clear any explicit unfollow; add to extra follows if not auto-followed
      setUnfollowedProjects(prev => {
        if (!prev.includes(projectId)) return prev;
        const next = prev.filter(id => id !== projectId);
        try { localStorage.setItem("flow_unfollowed_projects", JSON.stringify(next)); } catch {}
        return next;
      });
      if (!myProjectIds.includes(projectId)) {
        setExtraFollows(prev => {
          if (prev.includes(projectId)) return prev;
          const next = [...prev, projectId];
          try { localStorage.setItem("flow_followed_projects", JSON.stringify(next)); } catch {}
          return next;
        });
      }
      window.__flowToast?.("Project followed");
    }
  }, [lockedProjectIds, followedProjects, myProjectIds]);

  useKeyboard([
    { key: "1", fn: () => handleTabSwitch("summary") },
    { key: "2", fn: () => handleTabSwitch("projects") },
    { key: "3", fn: () => handleTabSwitch("people") },
    { key: "4", fn: () => handleTabSwitch("guide") },
    { key: "k", ctrl: true, fn: () => { setCmdOpen(v => !v); tactile.cmdOpen(); }, force: true },
    { key: "k", meta: true, fn: () => { setCmdOpen(v => !v); tactile.cmdOpen(); }, force: true },
    { key: "Escape", fn: () => { if (cmdOpen) { setCmdOpen(false); } else if (suppressBackRef.current) { /* child handled it */ } else if (goBackRef.current) handleBack(); }, force: true },
    // Removed bare "f" shortcut — conflicted with typing F in any input across
    // the app (e.g. new-project name field). Cmd/Ctrl+K is the canonical way
    // to open the command palette.
    // No `force` — "/" should only focus search when NOT already typing in a
    // field, otherwise it steals the slash key (and blocks pasting paths/URLs).
    { key: "/", fn: () => { if (searchRef.current) searchRef.current.focus(); } },
    { key: "?", fn: () => setShowHints(v => !v) },
    { key: "t", fn: () => handleTabSwitch("terminal") },
  ], [activeTab, cmdOpen]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: c.bg, color: c.text, fontFamily: body,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <style>{`
          @keyframes flow-load-pulse {
            0%, 100% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.08); opacity: 1; }
          }
          @keyframes flow-load-bar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes flow-load-fade-in {
            0% { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Logo — animated, large */}
        <div style={{
          animation: "flow-load-pulse 2s ease-in-out infinite",
          marginBottom: 32,
        }}>
          <FlowLogo size={120} />
        </div>

        {/* "Flow" text */}
        <div style={{
          fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em",
          color: c.textDim,
          animation: "flow-load-fade-in 0.6s ease-out both",
          animationDelay: "0.2s",
        }}>Flow</div>

        {/* Progress bar — fixed to bottom */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: 6,
          background: "rgba(0,0,0,0.04)", overflow: "hidden",
        }}>
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(90deg, ${c.accent}00, ${c.accent}, ${c.accent}00)`,
            backgroundSize: "200% 100%",
            animation: "flow-load-bar 1.4s cubic-bezier(0.22, 1, 0.36, 1) infinite",
          }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: body, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40, background: c.surfaceAlt, border: `1px solid ${c.border}`, borderRadius: 12, maxWidth: 400 }}>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: c.red }}>Failed to load data</div>
          <div style={{ fontSize: 16, color: c.textMid, marginBottom: 8 }}>{error}</div>
          <div style={{ fontSize: 14, color: c.textDim, marginBottom: 24 }}>If the problem persists, check your connection.</div>
          <button
            className="flow-btn"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px", borderRadius: 8,
              background: c.surfaceAlt, border: `1px solid ${c.borderHover}`,
              color: c.text, fontSize: 16, fontWeight: 500, fontFamily: body, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: body, position: "relative" }}>
      <AnimStyles />

      {/* ═══ SINGLE HEADER ═══ (hidden for dark-themed Terminal view) */}
      {activeTab !== "terminal" && (
      <Header
        onLogoClick={() => {
          handleTabSwitch("projects");
          setNavPayload(null);
          setDetailLabel(null);
          goBackRef.current = null;
          // Force ProjectsView to remount so it drops any open detail view
          setProjResetKey(k => k + 1);
          // Clear stale ?id= from URL so the list view loads cleanly
          try {
            const params = new URLSearchParams(window.location.search);
            if (params.has("id")) {
              params.delete("id");
              const qs = params.toString();
              window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
            }
          } catch {}
          // Smooth-scroll to the top — without this, clicking the logo mid-page
          // switches tabs but leaves the user halfway down the new page, which
          // reads as "nothing happened".
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        detailLabel={detailLabel}
        onBack={handleBack}
        breadcrumbLabel={activeNavItem?.label}
        activeTab={activeTab}
        onTabSwitch={handleTabSwitch}
        onCmdOpen={() => { setCmdOpen(true); tactile.cmdOpen(); }}
        globalFilters={globalFilters}
        pendingFilters={pendingFilters}
        setPendingFilters={setPendingFilters}
        applyFilters={applyFilters}
        clearGlobalFilters={clearGlobalFilters}
        globalFilterCount={globalFilterCount}
        allOwners={allOwners}
        allSquads={allSquads}
        allPeople={allPeople}
        currentUser={auth}
        alertCount={alertCount}
        projects={projects}
        people={people}
        currentPerson={viewerProfile}
        onNavigate={handleNavigate}
        myLens={myLens}
        toggleMyLens={toggleMyLens}
        followedProjects={followedProjects}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
      />
      )}

      {/* ═══ TERMINAL VIEW (full-bleed, outside main) ═══ */}
      {activeTab === "terminal" && <TerminalView onUnlock={handleTerminalUnlock} unlockedSections={terminalUnlocked} auth={auth} appSettings={appSettings} setAppSettings={setAppSettings} resetKey={terminalResetKey} initialModule={navPayload} onConsumePayload={() => setNavPayload(null)} onExit={() => handleTabSwitch(prevNonTerminalTabRef.current || "summary")} />}

      {/* ═══ MAIN CANVAS ═══ */}
      {activeTab !== "terminal" && (
      <main key={activeTab} className="flow-page" style={{ maxWidth: 1440, margin: "0 auto", padding: `${space[7] - 4}px ${space[7]}px ${space[8] + 20}px` }}>
        <ErrorCatcher key={activeTab}>
          {activeTab === "summary" && <SummaryView loading={loading} error={error} projects={projects} people={people} squads={squads} globalFilters={globalFilters} onNavigate={handleNavigate} phaseDurationDefaults={phaseDurationDefaults} myLens={myLens} followedProjects={followedProjects} viewerSquad={viewerProfile?.squad} timeframe={timeframe} />}
          {activeTab === "projects" && <ProjectsView key={navPayload || `proj-${projResetKey}`} projects={projects} setProjects={setProjects} people={people} squads={squads} history={history} personProfile={viewerProfile} isAdmin={isAdmin} permCan={permCan} initialId={navPayload} onNavigate={handleNavigate} setDetailLabel={setDetailLabel} setGoBack={setGoBack} searchRef={searchRef} globalFilters={globalFilters} suppressBackRef={suppressBackRef} projectLinks={projectLinks} setProjectLinks={setProjectLinks} phaseDurationDefaults={phaseDurationDefaults} myLens={myLens} followedProjects={followedProjects} toggleFollowProject={toggleFollowProject} timeframe={timeframe} />}

          {activeTab === "people" && <PeopleDeepDive key={navPayload || "ppl"} loading={loading} error={error} people={people} setPeople={setPeople} projects={projects} history={history} initialPerson={navPayload} onNavigate={handleNavigate} setDetailLabel={setDetailLabel} setGoBack={setGoBack} searchRef={searchRef} globalFilters={globalFilters} myLens={myLens} followedProjects={followedProjects} viewerSquad={viewerProfile?.squad} viewerName={viewerProfile?.name} isAdmin={isAdmin} timeframe={timeframe} />}
          {activeTab === "settings" && <SettingsView squads={squads} setSquads={setSquads} roles={roles} setRoles={setRoles} people={people} setPeople={setPeople} projects={projects} setProjects={setProjects} permConfig={permConfig} setPermConfig={handleSetPermConfig} />}
          {activeTab === "guide" && (
            <React.Suspense fallback={<div style={{ padding: 40, color: c.textDim, fontFamily: body, fontSize: 16, textAlign: "center" }}>Loading...</div>}>
              <GuideView onNavigate={handleTabSwitch} />
            </React.Suspense>
          )}
          {activeTab === "logs" && <LogsView />}
        </ErrorCatcher>
      </main>
      )}

      {/* ═══ COMMAND PALETTE — Cmd/Ctrl+K ═══ */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onTabSwitch={handleTabSwitch}
        projects={projects}
        people={people}
        onNavigate={handleNavigate}
      />

      {showHints && <ShortcutHintBar activeTab={activeTab} hasDetail={!!detailLabel} isLocked={isLocked} visible={showHints} />}

      {/* ═══ WELCOME TUTORIAL (first-run onboarding) ═══ */}
      {showTutorial && (
        <WelcomeTutorial
          userName={viewerProfile?.name || auth?.user?.user_metadata?.full_name}
          squads={squads}
          roles={roles}
          projects={projects}
          onStartTour={() => {
            // Switch to Projects tab so tour targets are visible
            setActiveTab("projects");
            setNavPayload(null);
          }}
          onOpenProject={(id) => {
            // Navigate to a project detail for tour steps 3-5
            setActiveTab("projects");
            setNavPayload(id);
          }}
          onBackToList={() => {
            // Return to project list for list-context steps
            setActiveTab("projects");
            setNavPayload(null);
            setDetailLabel(null);
            goBackRef.current = null;
          }}
          onComplete={() => {
            setShowTutorial(false);
            // Turn on My Lens and switch to Projects tab
            if (!myLens) toggleMyLens();
            setActiveTab("projects");
            setNavPayload(null);
            setDetailLabel(null);
            goBackRef.current = null;
          }}
        />
      )}

      {/* Sync toast — terminal-style notification */}
      <SyncToast />
      <ActionToast />
    </div>
  );
}

class ErrorCatcher extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, color: c.red, fontFamily: body, fontSize: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Render Error</div>
        <pre style={{ whiteSpace: "pre-wrap", color: c.textMid }}>{this.state.error?.message}</pre>
        <pre style={{ whiteSpace: "pre-wrap", color: c.textDim, marginTop: 8 }}>{this.state.error?.stack}</pre>
        <button
          className="flow-btn"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16, padding: "8px 20px", borderRadius: 8,
            background: c.surfaceAlt, border: `1px solid ${c.border}`,
            color: c.text, fontSize: 14, fontFamily: body, cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}
