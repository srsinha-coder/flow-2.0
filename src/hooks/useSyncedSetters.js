/**
 * useSyncedSetters — Two-tier persistence for Flow
 *
 * TIER 1 (Draft): Every edit saves to localStorage instantly (600ms debounce).
 *   → Survives refresh/tab close. No network calls.
 *
 * TIER 2 (Sync): DB writes happen on intentional actions:
 *   → Lock/unlock commit
 *   → Navigate away from a person (tab switch, back button)
 *   → Browser beforeunload (flush pending drafts)
 *
 * The sync toast fires on Tier 2 writes to give visual feedback.
 *
 * Squads, Roles, People, Projects — still sync immediately (infrequent, intentional actions).
 */
import { useCallback, useRef, useEffect } from 'react';
import {
  addSquadToDB, deleteSquadFromDB, renameSquadInDB,
  addRoleToDB, deleteRoleFromDB, renameRoleInDB,
  addPersonToDB, deletePersonFromDB, updatePersonInDB,
  createProjectInDB, updateProjectInDB,
  syncCommitmentToDB,
} from '../lib/mutations';
import {
  logProjectCreate, logProjectEdit,
  logPersonAdd, logSettingsChange,
  logCommitmentLock, logCommitmentUnlock, logCommitmentEdit,
} from '../lib/activityLog';
import { isDevSeedMode, devStore } from '../data/devSeed';

// ─── localStorage draft helpers ──────────────────────────────
const DRAFT_KEY = 'flow_commitment_drafts';

function saveDraftToLocal(personName, commitment) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    drafts[personName] = { ...commitment, _draftedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch { /* quota exceeded or private mode — ignore */ }
}

function getDraftFromLocal(personName) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    return drafts[personName] || null;
  } catch { return null; }
}

function clearDraftFromLocal(personName) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    delete drafts[personName];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch { /* ignore */ }
}

function getAllDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
  } catch { return {}; }
}

// ─── Main hook ───────────────────────────────────────────────

export function useSyncedSetters({
  rawSetSquads, rawSetRoles, rawSetPeople, rawSetProjects, rawSetCommitments,
  squads, roles, people, projects, commitments,
  lookups,
  weekConfig,
  onSyncStart,  // callback: () => void — fires when DB sync begins
  onSyncDone,   // callback: (personName) => void — fires when DB sync completes
}) {
  // Refs to always have current values in callbacks
  const squadsRef = useRef(squads);
  squadsRef.current = squads;
  const rolesRef = useRef(roles);
  rolesRef.current = roles;
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const commitmentsRef = useRef(commitments);
  commitmentsRef.current = commitments;
  const weekConfigRef = useRef(weekConfig);
  weekConfigRef.current = weekConfig;
  const lookupsRef = useRef(lookups);
  lookupsRef.current = lookups;
  const onSyncStartRef = useRef(onSyncStart);
  onSyncStartRef.current = onSyncStart;
  const onSyncDoneRef = useRef(onSyncDone);
  onSyncDoneRef.current = onSyncDone;

  // Track which person names have dirty (unsaved) drafts
  const dirtySet = useRef(new Set());
  const flushingRef = useRef(false);

  // ─── Core sync function ────────────────────────────────────
  const syncPersonToDB = useCallback(async (commitment) => {
    const wc = weekConfigRef.current;
    const lk = lookupsRef.current;
    if (!lk?.current || !wc) return;

    // Resolve the right week_id: a carried-forward row sets its own weekStart,
    // and MUST persist against that week's ID — not the current week — or
    // the upsert would overwrite the current-week row for the same person.
    let weekId = wc._currentWeekId;
    const weekStart = commitment.weekStart ? String(commitment.weekStart).slice(0, 10) : null;
    if (weekStart) {
      const byStart = lk.current.weekIdByStart || {};
      if (byStart[weekStart]) {
        weekId = byStart[weekStart];
      } else {
        // Future week row doesn't exist yet — skip sync rather than overwrite
        // current week. Row stays in localStorage draft + React state until
        // the weeks table gets that row (auto-provisioned when that Monday
        // becomes "current"). Log once so this is diagnosable.
        console.warn('[Flow] Skipping sync: no weeks row for', weekStart, '— carry stays in local state for', commitment.person);
        return;
      }
    }

    if (onSyncStartRef.current) onSyncStartRef.current();

    try {
      await syncCommitmentToDB(
        { ...commitment, _weekId: weekId },
        lk.current
      );
      // Clear the localStorage draft after successful DB write
      clearDraftFromLocal(commitment.person);
      if (onSyncDoneRef.current) onSyncDoneRef.current(commitment.person);
    } catch (err) {
      console.error('[Flow DB] Sync failed for', commitment.person, err);
      // Pass a human-readable detail to SyncToast so the user can see WHY
      // the sync failed (Supabase codes are cryptic — prefer message + code).
      const detail = [err?.code, err?.message, err?.details].filter(Boolean).join(' · ')
        || err?.toString?.()
        || 'unknown error';
      if (window.__flowSyncToast?.error) window.__flowSyncToast.error(commitment.person, detail);
    }
  }, []);

  // Flush all dirty commitments to DB (with double-flush guard)
  const flushDirtyToDB = useCallback(async () => {
    if (flushingRef.current) return;
    const cms = commitmentsRef.current;
    const dirty = dirtySet.current;
    if (dirty.size === 0) return;

    flushingRef.current = true;
    const names = [...dirty];
    try {
      const results = await Promise.allSettled(
        names.map(name => {
          const cm = cms.find(c => c.person === name);
          return cm ? syncPersonToDB(cm) : Promise.resolve();
        })
      );
      // Only clear successfully synced names
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') dirty.delete(names[i]);
      });
    } finally {
      flushingRef.current = false;
    }
  }, [syncPersonToDB]);

  // ─── Flush on tab close / navigation ───────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 1. Synchronously mirror every dirty commitment to localStorage. This
      //    is the real safety net — the debounced draft save may have a
      //    pending timer that would be killed by unload.
      const cms = commitmentsRef.current;
      dirtySet.current.forEach(name => {
        const cm = cms.find(c => c.person === name);
        if (cm) saveDraftToLocal(name, cm);
      });

      // 2. Fire the DB sync best-effort. Route through the correct week_id
      //    when the commitment carries its own weekStart, matching
      //    syncPersonToDB above.
      const wc = weekConfigRef.current;
      const lk = lookupsRef.current;
      if (wc && lk?.current) {
        dirtySet.current.forEach(name => {
          const cm = cms.find(c => c.person === name);
          if (!cm) return;
          let weekId = wc._currentWeekId;
          const weekStart = cm.weekStart ? String(cm.weekStart).slice(0, 10) : null;
          if (weekStart) {
            const byStart = lk.current.weekIdByStart || {};
            if (!byStart[weekStart]) return; // skip — would clobber current week
            weekId = byStart[weekStart];
          }
          syncCommitmentToDB(
            { ...cm, _weekId: weekId },
            lk.current
          );
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    // pagehide is more reliable than beforeunload on mobile / bfcache.
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  // ─── SQUADS ──────────────────────────────────────────────
  const setSquads = useCallback((updater) => {
    const prev = squadsRef.current;
    rawSetSquads(updater);

    setTimeout(async () => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Dev-seed mode: persist the squads list to localStorage so it survives reloads.
      if (isDevSeedMode()) devStore.persistSquads(next);
      if (next.length > prev.length) {
        const added = next.find(s => !prev.includes(s));
        if (added) {
          window.__flowSyncToast?.show?.();
          addSquadToDB(added); logSettingsChange('add_squad', { name: added });
          window.__flowSyncToast?.done?.();
        }
      } else if (next.length < prev.length) {
        const removed = prev.find(s => !next.includes(s));
        if (removed) {
          window.__flowSyncToast?.show?.();
          deleteSquadFromDB(removed); logSettingsChange('delete_squad', { name: removed });
          window.__flowSyncToast?.done?.();
        }
      } else {
        // Same length — detect rename by positional diff. CRITICAL: use
        // renameSquadInDB (UPDATE) not delete+add — squad has CASCADE FKs
        // from people and projects, delete+add would destroy their rows.
        for (let i = 0; i < next.length; i++) {
          if (next[i] !== prev[i]) {
            window.__flowSyncToast?.show?.(next[i]);
            const ok = await renameSquadInDB(prev[i], next[i]);
            logSettingsChange('rename_squad', { from: prev[i], to: next[i] });
            // Keep in-memory people/projects in sync so UI reflects the new
            // squad name immediately. In dev-seed mode also persist the cascade.
            if (isDevSeedMode()) {
              const updatedPeople = peopleRef.current.map(p => p.squad === prev[i] ? { ...p, squad: next[i] } : p);
              const updatedProjects = projectsRef.current.map(pr => pr.squad === prev[i] ? { ...pr, squad: next[i] } : pr);
              rawSetPeople(updatedPeople);
              rawSetProjects(updatedProjects);
              devStore.persistPeople(updatedPeople);
              devStore.persistProjects(updatedProjects);
            } else {
              rawSetPeople(list => list.map(p => p.squad === prev[i] ? { ...p, squad: next[i] } : p));
              rawSetProjects(list => list.map(pr => pr.squad === prev[i] ? { ...pr, squad: next[i] } : pr));
            }
            if (ok) window.__flowSyncToast?.done?.(next[i]);
            else window.__flowSyncToast?.error?.(next[i]);
          }
        }
      }
    }, 0);
  }, [rawSetSquads, rawSetPeople, rawSetProjects]);

  // ─── ROLES ───────────────────────────────────────────────
  const setRoles = useCallback((updater) => {
    const prev = rolesRef.current;
    rawSetRoles(updater);

    setTimeout(async () => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Dev-seed mode: persist the roles list to localStorage so it survives reloads.
      if (isDevSeedMode()) devStore.persistRoles(next);
      if (next.length > prev.length) {
        const added = next.find(r => !prev.includes(r));
        if (added) {
          window.__flowSyncToast?.show?.();
          addRoleToDB(added); logSettingsChange('add_role', { name: added });
          window.__flowSyncToast?.done?.();
        }
      } else if (next.length < prev.length) {
        const removed = prev.find(r => !next.includes(r));
        if (removed) {
          window.__flowSyncToast?.show?.();
          deleteRoleFromDB(removed); logSettingsChange('delete_role', { name: removed });
          window.__flowSyncToast?.done?.();
        }
      } else {
        // Same length — detect rename by positional diff. CRITICAL: use
        // renameRoleInDB (UPDATE) not delete+add — people.role_id has
        // ON DELETE CASCADE, delete+add would wipe every holder.
        for (let i = 0; i < next.length; i++) {
          if (next[i] !== prev[i]) {
            window.__flowSyncToast?.show?.(next[i]);
            const ok = await renameRoleInDB(prev[i], next[i]);
            logSettingsChange('rename_role', { from: prev[i], to: next[i] });
            // Refresh in-memory role field on affected people. In dev-seed mode
            // also persist the cascade so holders keep the renamed role on reload.
            if (isDevSeedMode()) {
              const updatedPeople = peopleRef.current.map(p => p.role === prev[i] ? { ...p, role: next[i] } : p);
              rawSetPeople(updatedPeople);
              devStore.persistPeople(updatedPeople);
            } else {
              rawSetPeople(list => list.map(p => p.role === prev[i] ? { ...p, role: next[i] } : p));
            }
            if (ok) window.__flowSyncToast?.done?.(next[i]);
            else window.__flowSyncToast?.error?.(next[i]);
          }
        }
      }
    }, 0);
  }, [rawSetRoles, rawSetPeople]);

  // ─── PEOPLE ──────────────────────────────────────────────
  const setPeople = useCallback((updater) => {
    const prev = peopleRef.current;
    rawSetPeople(updater);

    setTimeout(async () => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Dev-seed mode: persist every people change (incl. isAdmin toggles,
      // role/squad edits) to localStorage so they survive reloads.
      if (isDevSeedMode()) {
        devStore.persistPeople(next);
      }
      if (next.length > prev.length) {
        const added = next.find(p => !prev.some(pp => pp.name === p.name));
        if (added) {
          window.__flowSyncToast?.show?.(added.name);
          const newId = await addPersonToDB(added.name, added.squad, added.role);
          // Update lookup map so commitment sync works for this person
          if (newId) {
            const lk = lookupsRef.current;
            if (lk) lk.personMap = { ...lk.personMap, [added.name]: newId };
            window.__flowSyncToast?.done?.(added.name);
          } else {
            window.__flowSyncToast?.error?.(added.name);
          }
          logPersonAdd(added.name);
          // Create an empty commitment so they appear in Commit immediately
          rawSetCommitments(prev => [
            ...prev,
            { person: added.name, items: [], buffer: '', deselected: -1 },
          ]);
        }
      } else if (next.length < prev.length) {
        const removed = prev.find(p => !next.some(pp => pp.name === p.name));
        if (removed) {
          window.__flowSyncToast?.show?.(removed.name);
          await deletePersonFromDB(removed.name);
          window.__flowSyncToast?.done?.(removed.name);
          logSettingsChange('delete_person', { name: removed.name });
          // Remove their commitment from state
          rawSetCommitments(prev => prev.filter(cm => cm.person !== removed.name));
        }
      } else if (next.length === prev.length) {
        // Detect edits (same length, changed properties). Walk the whole
        // list so bulk renames (e.g. role-rename cascade) all persist.
        const edits = [];
        for (let i = 0; i < next.length; i++) {
          const p = prev[i], n = next[i];
          if (p && n && (p.name !== n.name || p.squad !== n.squad || p.role !== n.role)) {
            edits.push({ p, n });
          }
        }
        for (const { p, n } of edits) {
          window.__flowSyncToast?.show?.(n.name);
          const ok = await updatePersonInDB(p.name, n.name, n.squad, n.role);
          if (ok) window.__flowSyncToast?.done?.(n.name);
          else window.__flowSyncToast?.error?.(n.name);
          logSettingsChange('edit_person', { old: p.name, name: n.name, squad: n.squad, role: n.role });
          // If name changed, update commitments and localStorage drafts
          if (p.name !== n.name) {
            rawSetCommitments(cms => cms.map(cm =>
              cm.person === p.name ? { ...cm, person: n.name } : cm
            ));
            // Update lookup map
            const lk = lookupsRef.current;
            if (lk?.personMap?.[p.name]) {
              lk.personMap[n.name] = lk.personMap[p.name];
              delete lk.personMap[p.name];
            }
          }
        }
      }
    }, 0);
  }, [rawSetPeople, rawSetCommitments]);

  // Persist projects to localStorage on every change (dev seed mode)
  useEffect(() => {
    if (isDevSeedMode() && projects && projects.length > 0) {
      devStore.persistProjects(projects);
    }
  }, [projects]);

  // ─── PROJECTS ────────────────────────────────────────────
  const setProjects = useCallback((updater) => {
    const prev = projectsRef.current;
    rawSetProjects(updater);

    setTimeout(() => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      if (next.length > prev.length) {
        const added = next.find(p => !prev.some(pp => pp.id === p.id));
        if (added) {
          if (!isDevSeedMode()) {
            createProjectInDB(added).then(serverId => {
              if (serverId) {
                if (serverId !== added.id) {
                  rawSetProjects(cur => cur.map(p => p.id === added.id ? { ...p, id: serverId } : p));
                }
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('flow:project-create-succeeded', {
                    detail: { name: added.name, id: serverId },
                  }));
                }
              } else {
                rawSetProjects(cur => cur.filter(p => p.id !== added.id));
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('flow:project-create-failed', {
                    detail: { name: added.name },
                  }));
                }
              }
            }).catch(err => {
              rawSetProjects(cur => cur.filter(p => p.id !== added.id));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('flow:project-create-failed', {
                  detail: { name: added.name, error: err?.message },
                }));
              }
            });
          }
          logProjectCreate(added.id, added.name);
        }
      } else {
        for (const np of next) {
          const op = prev.find(p => p.id === np.id);
          if (!op) continue;
          const changes = {};
          if (op.name !== np.name) changes.name = np.name;
          if (op.owner !== np.owner) changes.owner = np.owner;
          if (op.squad !== np.squad) changes.squad = np.squad;
          if (op.phase !== np.phase) changes.phase = np.phase;
          if (op.status !== np.status) changes.status = np.status;
          if (op.depriReason !== np.depriReason) changes.depriReason = np.depriReason;
          if (op.startDate !== np.startDate) changes.startDate = np.startDate;
          if (op.endDate !== np.endDate) changes.endDate = np.endDate;
          if (op.actualStartDate !== np.actualStartDate) changes.actualStartDate = np.actualStartDate;
          if (op.actualEndDate !== np.actualEndDate) changes.actualEndDate = np.actualEndDate;
          if (Object.keys(changes).length > 0) {
            Promise.resolve(updateProjectInDB(np.id, changes)).catch(err => {
              rawSetProjects(cur => cur.map(p => p.id === np.id ? op : p));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('flow:project-update-failed', {
                  detail: { id: np.id, name: np.name, error: err?.message },
                }));
              }
            });
            logProjectEdit(np.id, np.name, changes);
          }
        }
      }
    }, 0);
  }, [rawSetProjects]);

  // ─── COMMITS (two-tier: localStorage draft + DB on action) ──
  const draftTimers = useRef({});

  const setCommitments = useCallback((updater) => {
    const prev = commitmentsRef.current;
    rawSetCommitments(updater);

    setTimeout(() => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Diff by (person, weekStart). Keying on person alone collides when a
      // carry-forward pushes an additional row for the same person in a
      // future week. Current-week rows have no weekStart.
      const rowKey = (cm) => `${cm.person}|${cm.weekStart ? String(cm.weekStart).slice(0, 10) : ''}`;
      const prevByPerson = new Map(prev.map(cm => [rowKey(cm), cm]));

      // Fields we track for dirty detection. Anything persisted by
      // syncCommitmentToDB must be here or edits silently get dropped.
      const persistFields = [
        'items', 'buffer', 'deselected', 'lockedAt', 'lockedAtTime', 'closedAt',
        'depriReason', 'bufferProject', 'bufferType', 'bufferStage',
        'bufferDuration', 'bufferOutcome', 'bufferCarryTo', 'bufferBlockedReason',
      ];
      const snap = (cm) => {
        if (!cm) return '';
        const out = {};
        for (const k of persistFields) out[k] = cm[k];
        return JSON.stringify(out);
      };

      for (const changed of next) {
        const before = prevByPerson.get(rowKey(changed));
        if (before === changed) continue; // same reference, no work

        // Carried-forward rows (have weekStart) don't participate in the
        // current-week dirty/draft path — drafts are keyed by person alone
        // and would collide with the current week's draft. They'll land in
        // the target week once that week becomes current.
        const isCarriedRow = !!changed.weekStart;
        if (isCarriedRow) continue;

        const wasLocked = before?.lockedAt;
        const nowLocked = changed.lockedAt;
        const wasClosed = !!before?.closedAt;
        const nowClosed = !!changed.closedAt;

        // TIER 2: Immediate DB sync on lock/unlock/close/reopen.
        // Close Week must always sync — diffs on items alone wouldn't catch
        // the closedAt flip or carry-row insertions on other persons.
        if (!wasLocked && nowLocked) {
          syncPersonToDB(changed);
          dirtySet.current.delete(changed.person);
          logCommitmentLock(changed.person, changed.items);
        } else if (wasLocked && !nowLocked) {
          syncPersonToDB(changed);
          dirtySet.current.delete(changed.person);
          logCommitmentUnlock(changed.person);
        } else if (wasClosed !== nowClosed) {
          syncPersonToDB(changed);
          dirtySet.current.delete(changed.person);
        } else if (!before || snap(before) !== snap(changed)) {
          // TIER 1: Save draft to localStorage (debounced per-person)
          dirtySet.current.add(changed.person);
          clearTimeout(draftTimers.current[changed.person]);
          draftTimers.current[changed.person] = setTimeout(() => {
            saveDraftToLocal(changed.person, changed);
            // Build a summary of what changed — commitment items carry `project`
            // (set from ci.project_id in useSupabaseData.js:217).
            const oldItems = before?.items || [];
            const newItems = changed.items || [];
            const changes = [];
            for (let s = 0; s < Math.max(oldItems.length, newItems.length); s++) {
              const o = oldItems[s], n = newItems[s];
              const oPid = o?.project;
              const nPid = n?.project;
              if (!o && n && nPid) { changes.push(`+${nPid}`); }
              else if (o && !n) { changes.push(`-${oPid || '?'}`); }
              else if (o && n) {
                if (oPid !== nPid || o.title !== n.title || o.type !== n.type || o.stage !== n.stage) {
                  changes.push(nPid || '?');
                }
              }
            }
            const detail = changes.length > 0
              ? { projects: changes.join(", ") }
              : { field: 'items' };
            logCommitmentEdit(changed.person, 'items', detail);
          }, 600);
        }
      }
    }, 0);
  }, [rawSetCommitments, syncPersonToDB]);

  return {
    setSquads, setRoles, setPeople, setProjects, setCommitments,
    flushDirtyToDB,       // call when navigating away from Commit view
    getDraftFromLocal,    // for restoring drafts on load
    getAllDrafts,          // for checking if any unsaved drafts exist
  };
}
