/**
 * useSupabaseData — Fetches all Flow data from Supabase
 * Returns data in the EXACT same shape as seed.js so views need zero changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  isDevSeedMode,
  seedSquads as devSquads,
  seedRoles as devRoles,
  seedPeople as devPeople,
  getSeedProjects as devGetProjects,
  devStore,
} from '../data/devSeed';

// ─── Fetch helpers ───────────────────────────────────────────
async function fetchSquads() {
  const { data, error } = await supabase.from('squads').select('*').order('name');
  if (error) throw error;
  return data;
}

async function fetchRoles() {
  const { data, error } = await supabase.from('roles').select('*').order('name');
  if (error) throw error;
  return data;
}

async function fetchPeople() {
  const { data, error } = await supabase.from('people').select('*, squads(name), roles(name)').order('name');
  if (error) throw error;
  return data;
}

async function fetchProjects() {
  const { data, error } = await supabase.from('projects').select('*, people!projects_owner_id_fkey(name), squads(name)').order('id');
  if (error) throw error;
  return data;
}

async function fetchProjectLinks() {
  const { data, error } = await supabase.from('project_links').select('*').order('created_at');
  if (error) throw error;
  return data || [];
}

async function fetchWeeks() {
  const { data, error } = await supabase.from('weeks').select('*').order('start_date');
  if (error) throw error;
  return data;
}

// Helper: format YYYY-MM-DD without timezone shift
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Auto-provision: ensure week rows exist from the last known week up to the current Monday
async function ensureCurrentWeek(existingWeeks) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), diff);
  const currentMondayStr = toDateStr(currentMonday);

  // Check if any existing week covers this Monday
  const alreadyExists = existingWeeks.some(w => w.start_date === currentMondayStr);
  if (alreadyExists) return existingWeeks;

  // Find the latest week to know where to start filling gaps
  const latest = existingWeeks.length > 0
    ? existingWeeks.reduce((a, b) => a.start_date > b.start_date ? a : b)
    : null;
  if (latest && latest.start_date >= currentMondayStr) return existingWeeks;

  // Build all missing weeks from the week after the latest through the current Monday
  const startFrom = latest
    ? new Date(latest.start_date + 'T00:00:00')
    : new Date(currentMonday);
  if (latest) startFrom.setDate(startFrom.getDate() + 7); // next Monday after latest

  const newWeeks = [];
  const cursor = new Date(startFrom);
  while (toDateStr(cursor) <= currentMondayStr) {
    const mondayStr = toDateStr(cursor);
    const friday = new Date(cursor);
    friday.setDate(friday.getDate() + 4);
    const fridayStr = toDateStr(friday);
    // Label: "Mon D" format (e.g., "Mar 30", "Apr 6")
    const label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    newWeeks.push({ label, start_date: mondayStr, end_date: fridayStr, status: 'declare' });
    cursor.setDate(cursor.getDate() + 7);
  }

  if (newWeeks.length === 0) return existingWeeks;

  const { data, error } = await supabase
    .from('weeks')
    .insert(newWeeks)
    .select();

  if (error) {
    console.warn('[Flow] Could not auto-create week rows:', error);
    return existingWeeks;
  }

  return [...existingWeeks, ...data];
}

async function fetchCommitments(weekId) {
  const { data, error } = await supabase
    .from('commitments')
    .select('*, people(name), commitment_items(*)')
    .eq('week_id', weekId)
    .order('created_at');
  if (error) throw error;
  return data;
}

async function fetchSettings() {
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) throw error;
  // Return as key-value map
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

async function fetchHistory() {
  // Paginate — Supabase caps list responses at 1000 rows by default, which
  // silently truncates recent weeks as project_history grows.
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('project_history')
      .select('*, weeks(label)')
      .order('created_at')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

// ─── Transform Supabase rows → seed.js shape ────────────────

function toSeedSquads(rows) {
  return rows.map(r => r.name);
}

function toSeedRoles(rows) {
  return rows.map(r => r.name);
}

function toSeedPeople(rows) {
  // `id` was previously dropped here for view-layer simplicity (everything
  // keyed off `name`). The new ProjectActivity component links members and
  // comment authors by `id`, so keep the UUID around.
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    role: r.roles?.name || '',
    squad: r.squads?.name || '',
    squad_id: r.squad_id,
    role_id: r.role_id,
  }));
}

function toSeedProjects(rows) {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    owner: r.people?.name || '',
    owner_id: r.owner_id || null,
    squad: r.squads?.name || '',
    startDate: r.start_date,
    endDate: r.end_date,
    actualStartDate: r.actual_start_date || null,
    actualEndDate: r.actual_end_date || null,
    phase: r.phase,
    // For shipped projects without actual dates, generate reasonable defaults
    ...(!r.actual_start_date && ['Alpha', 'Beta', 'GA'].includes(r.phase) && r.start_date ? {
      actualStartDate: (() => { const d = new Date(r.start_date); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0]; })(),
      actualEndDate: r.end_date ? (() => { const d = new Date(r.end_date); d.setDate(d.getDate() + 5); return d.toISOString().split('T')[0]; })() : null,
    } : {}),
    status: r.status,
    complexity: r.complexity || null,
    isBlocked: r.is_blocked || false,
    blockedReason: r.blocked_reason || null,
    blockedAt: r.blocked_at || null,
    phaseDurationOverrides: r.phase_duration_overrides || null,
    gaEnteredAt: r.ga_entered_at || null,
    // Surfaces "Updated X ago" + stale chip. Falls back to updated_at so
    // empty-DB / pre-migration callers still get a sane timestamp.
    lastActivityAt: r.last_activity_at || r.updated_at || null,
    depriReason: r.depri_reason || (r.status === 'deprioritized' ? ({
      X99: 'Low user demand based on Q4 survey results',
      X100: 'Tech dependency on third-party voice SDK not ready until Q3',
      X101: 'Redirecting team to checkout flow — higher business impact',
      X102: 'Regulatory uncertainty — waiting on compliance review',
      X103: 'Market conditions changed — revisit in H2',
    }[r.id] || 'Deprioritized — reason pending') : null),
  }));
}

function toWeekConfig(weeks, historyRows = []) {
  const today = new Date().toISOString().split('T')[0];

  // Guard: empty weeks table
  if (!weeks || weeks.length === 0) {
    return {
      weekOf: "",
      weekStart: today,
      today,
      historyWeeks: [],
      _weeks: [],
      _currentWeekId: null,
    };
  }

  // Current week = the week whose start_date is <= today (most recent one),
  // so the dashboard auto-advances when a new week begins (every Sunday/Monday).
  const sorted = [...weeks].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const current = [...sorted].reverse().find(w => w.start_date <= today) || sorted[sorted.length - 1];
  // Every past week is navigable, even if it has no project_history yet — otherwise
  // the week stepper's calendar math (weekStart + offset*7 days) drifts out of sync
  // with the historyWeeks index.
  const historyWeeks = sorted
    .filter(w => w.id !== current.id && w.start_date < current.start_date)
    .map(w => w.label);

  return {
    weekOf: current.label,
    weekStart: current.start_date,
    today,
    historyWeeks,
    // Include the raw week data for ID lookups
    _weeks: weeks,
    _currentWeekId: current.id,
  };
}

function toSeedCommitments(rows) {
  return rows.map(r => {
    const rawItems = (r.commitment_items || [])
      .sort((a, b) => a.slot - b.slot)
      .map(ci => ({
        title: ci.title,
        type: ci.type || '',
        project: ci.project_id,
        stage: ci.stage || '',
        ...(ci.duration ? { duration: ci.duration } : {}),
        ...(ci.outcome ? { outcome: ci.outcome } : {}),
        ...(ci.blocked_reason ? { blockedReason: ci.blocked_reason } : {}),
        ...(ci.carry_to ? { carryTo: ci.carry_to } : {}),
        ...(ci.weeks_remaining ? { weeksRemaining: ci.weeks_remaining } : {}),
        ...(ci.carried_from ? { carriedFrom: ci.carried_from } : {}),
      }));

    // Pad to 3 items — views assume exactly 3 slots exist
    const emptyItem = { title: '', type: '', project: '', stage: '' };
    const items = [...rawItems];
    while (items.length < 3) items.push({ ...emptyItem });

    return {
      person: r.people?.name || '',
      items,
      buffer: r.buffer || '',
      deselected: r.deselected ?? -1,
      ...(r.locked_at ? {
        lockedAt: new Date(r.locked_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        lockedAtTime: new Date(r.locked_at).getTime(),
        // Preserve the canonical ISO so subsequent syncs don't stamp "now"
        // via the fallback in syncCommitmentToDB.
        _lockedAtISO: new Date(r.locked_at).toISOString(),
      } : {}),
      // Buffer metadata
      ...(r.buffer_project ? { bufferProject: r.buffer_project } : {}),
      ...(r.buffer_type ? { bufferType: r.buffer_type } : {}),
      ...(r.buffer_stage ? { bufferStage: r.buffer_stage } : {}),
      ...(r.buffer_duration ? { bufferDuration: r.buffer_duration } : {}),
      ...(r.buffer_outcome ? { bufferOutcome: r.buffer_outcome } : {}),
      ...(r.buffer_carry_to ? { bufferCarryTo: r.buffer_carry_to } : {}),
      ...(r.buffer_blocked_reason ? { bufferBlockedReason: r.buffer_blocked_reason } : {}),
      ...(r.depri_reason ? { depriReason: r.depri_reason } : {}),
      ...(r.closed_at ? { closedAt: r.closed_at } : {}),
    };
  });
}

function toSeedHistory(rows) {
  // Group by project_id → array of { week, entries }
  const grouped = {};
  for (const row of rows) {
    const pid = row.project_id;
    const weekLabel = row.weeks?.label || '';
    if (!grouped[pid]) grouped[pid] = {};
    if (!grouped[pid][weekLabel]) grouped[pid][weekLabel] = [];
    grouped[pid][weekLabel].push({
      person: row.person_name,
      type: row.type,
      task: row.task,
      stage: row.stage,
      outcome: row.outcome || null,
    });
  }

  const result = {};
  for (const [pid, weekMap] of Object.entries(grouped)) {
    result[pid] = Object.entries(weekMap).map(([week, entries]) => ({
      week,
      entries,
    }));
  }
  return result;
}


// ─── Main hook ───────────────────────────────────────────────

export default function useSupabaseData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedOnce = useRef(false);

  // Data in seed.js-compatible shape
  const [squads, setSquads] = useState([]);
  const [roles, setRoles] = useState([]);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [history, setHistory] = useState({});
  const [weekConfigData, setWeekConfigData] = useState(null);

  // Raw Supabase data (for lookup maps needed during writes)
  const lookups = useRef({ squadMap: {}, roleMap: {}, personMap: {}, weekMap: {} });

  const [appSettings, setAppSettings] = useState({});
  const [projectLinks, setProjectLinks] = useState([]);

  // Dedupe concurrent load() calls (StrictMode double-invoke + auth-gate remounts
  // were causing each Supabase query to fire 4× on initial render).
  const loadPromiseRef = useRef(null);
  const initialLoadStartedRef = useRef(false);

  const load = useCallback(async (force = false) => {
    if (loadPromiseRef.current && !force) return loadPromiseRef.current;
    if (initialLoadStartedRef.current && !force) return;
    initialLoadStartedRef.current = true;
    const run = (async () => {
    try {
      // Only show loading screen on first load, not refreshes
      if (!hasLoadedOnce.current) setLoading(true);
      setError(null);

      // ── Dev seed shortcut ───────────────────────────────────────
      // On localhost without a real session, RLS would return zero rows
      // for every table. Route through devSeed so the new UI is clickable.
      if (isDevSeedMode()) {
        lookups.current.squadMap  = Object.fromEntries(devSquads.map(s => [s.name, s.id]));
        lookups.current.roleMap   = Object.fromEntries(devRoles.map(r  => [r.name, r.id]));
        lookups.current.personMap = Object.fromEntries(devPeople.map(p => [p.name, p.id]));
        lookups.current.weekMap = {};
        lookups.current.weekIdByStart = {};

        setSquads(devSquads.map(s => s.name));
        setRoles(devRoles.map(r => r.name));
        setPeople(devPeople);
        const seedProjs = devGetProjects();
        setProjects(seedProjs);
        devStore.persistProjects(seedProjs);
        setCommitments([]);            // commit cycle is retired
        setHistory({});
        setWeekConfigData(toWeekConfig([], []));
        setAppSettings({ phase_duration_defaults: { PRD: 14, Design: 21, Dev: 28, QA: 14, Alpha: 7, Beta: 14, GA: null } });
        setProjectLinks(devStore.listAllLinks?.() || []);
        setLoading(false);
        hasLoadedOnce.current = true;
        return;
      }

      const [squadsRaw, rolesRaw, peopleRaw, projectsRaw, weeksRawInitial, historyRaw, settingsRaw, projectLinksRaw] = await Promise.all([
        fetchSquads(),
        fetchRoles(),
        fetchPeople(),
        fetchProjects(),
        fetchWeeks(),
        fetchHistory(),
        fetchSettings(),
        fetchProjectLinks(),
      ]);

      // Auto-provision current week if it doesn't exist yet
      const weeksRaw = await ensureCurrentWeek(weeksRawInitial);

      // Build lookup maps (name → id) for writes
      lookups.current.squadMap = Object.fromEntries(squadsRaw.map(s => [s.name, s.id]));
      lookups.current.roleMap = Object.fromEntries(rolesRaw.map(r => [r.name, r.id]));
      lookups.current.personMap = Object.fromEntries(peopleRaw.map(p => [p.name, p.id]));
      lookups.current.weekMap = Object.fromEntries(weeksRaw.map(w => [w.label, w.id]));
      // Indexed by start_date (YYYY-MM-DD) so sync can resolve the correct
      // week_id for carried-forward rows whose weekStart differs from current.
      lookups.current.weekIdByStart = Object.fromEntries(weeksRaw.map(w => [w.start_date, w.id]));

      const wc = toWeekConfig(weeksRaw, historyRaw);

      // Fetch commitments for current week (skip if no weeks exist)
      const commitmentsRaw = wc._currentWeekId ? await fetchCommitments(wc._currentWeekId) : [];

      const seedPeople = toSeedPeople(peopleRaw);
      const seedCommitments = toSeedCommitments(commitmentsRaw);

      // Ensure every person has a commitment entry (backfill empty ones)
      const committedNames = new Set(seedCommitments.map(cm => cm.person));
      for (const p of seedPeople) {
        if (!committedNames.has(p.name)) {
          const emptyItem = { title: '', type: '', project: '', stage: '' };
          seedCommitments.push({ person: p.name, items: [{ ...emptyItem }, { ...emptyItem }, { ...emptyItem }], buffer: '', deselected: -1 });
        }
      }

      setSquads(toSeedSquads(squadsRaw));
      setRoles(toSeedRoles(rolesRaw));
      setPeople(seedPeople);
      setProjects(toSeedProjects(projectsRaw));
      setCommitments(seedCommitments);
      setHistory(toSeedHistory(historyRaw));
      setWeekConfigData(wc);
      setAppSettings(settingsRaw);
      setProjectLinks(projectLinksRaw);
    } catch (err) {
      console.error('Failed to load data from Supabase:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
    })();
    loadPromiseRef.current = run;
    try { await run; } finally { loadPromiseRef.current = null; }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    loading,
    error,
    squads, setSquads,
    roles, setRoles,
    people, setPeople,
    projects, setProjects,
    commitments, setCommitments,
    history,
    weekConfig: weekConfigData,
    appSettings, setAppSettings,
    projectLinks, setProjectLinks,
    phaseDurationDefaults: appSettings?.phase_duration_defaults
      ? (typeof appSettings.phase_duration_defaults === 'string'
        ? JSON.parse(appSettings.phase_duration_defaults)
        : appSettings.phase_duration_defaults)
      : { PRD: 14, Design: 21, Dev: 28, QA: 14, Alpha: 7, Beta: 14, GA: null },
    lookups,
    reload: useCallback(() => load(true), [load]),
  };
}
