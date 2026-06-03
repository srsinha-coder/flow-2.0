// ═══════════════════════════════════════════════════════════════════
// ProjectActivity — members row, composer, and the project's activity
// feed rendered as a vertical timeline rail.
//
// Each entry hangs off a vertical line: comments get a solid coloured
// ring node (accent for the viewer's own posts, cyan for others),
// system events get a smaller hollow node and a one-line italic
// label. Reads as one continuous project diary.
//
// Sits below the Timeline card on the project deep-dive. Posts /
// member changes flow through lib/mutations.js which is dev-seed
// aware, so this works without a live Supabase session on localhost.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { c, space, layout, mono, body } from "../styles/theme";
import { initialsOf } from "../lib/names";
import useProjectActivity from "../hooks/useProjectActivity";
import {
  addProjectCommentToDB,
  editProjectCommentInDB,
  softDeleteProjectCommentFromDB,
  addProjectMemberToDB,
  removeProjectMemberFromDB,
} from "../lib/mutations";
import { timeAgo, fmtAbsolute } from "../lib/time";
import { Modal } from "./shared";

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const WEEKLY_UPDATE_TAG = "[weekly-update]";

// ── Avatar ──────────────────────────────────────────────────────────
function Avatar({ name, size = 28, accent = false, white = false }) {
  const bg = white ? (c.surfaceSolid || "#fff") : accent ? c.accentDim : c.cyanDim;
  const fg = white ? c.text : accent ? c.accent : c.cyan;
  const bd = white ? c.border : (accent ? c.accent : c.cyan) + "33";
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg,
        color: fg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: mono, fontSize: Math.max(10, size * 0.4), fontWeight: 700,
        flexShrink: 0,
        border: `1px solid ${bd}`,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

// Linkify @mentions against the people list.
function renderBody(text, peopleByLowerName, onPersonNavigate) {
  if (!text) return null;
  const parts = [];
  let i = 0;
  const tokens = text.split(/(\s+|\n)/);
  while (i < tokens.length) {
    const tk = tokens[i];
    if (tk?.startsWith("@") && tk.length > 1) {
      const oneName = tk.slice(1).replace(/[.,!?;:]+$/, "");
      const trailingPunct = tk.slice(1 + oneName.length);
      const twoName = (oneName + " " + (tokens[i + 2] || "")).trim();
      const matchTwo = peopleByLowerName.get(twoName.toLowerCase());
      const matchOne = peopleByLowerName.get(oneName.toLowerCase());
      const matched = matchTwo || matchOne;
      const usedTokens = matchTwo ? 3 : 1;
      if (matched) {
        parts.push(
          <button
            type="button"
            key={`m-${i}`}
            onClick={() => onPersonNavigate?.(matched.name)}
            style={{
              color: c.cyan, background: "transparent", border: "none",
              padding: 0, font: "inherit", cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 2, textDecorationThickness: 1,
            }}
          >@{matched.name}</button>
        );
        if (trailingPunct && usedTokens === 1) parts.push(trailingPunct);
        i += usedTokens;
        continue;
      }
    }
    parts.push(tk);
    i += 1;
  }
  return parts;
}

function actionLabel(ev, peopleByLowerName) {
  const d = ev.details || {};
  const who = ev.user_name || "Someone";
  const link = (name) => name ? (peopleByLowerName.get(name.toLowerCase())?.name || name) : null;
  switch (ev.action) {
    case "project_created":         return `${who} created this project`;
    case "project_started":         return d.tracks ? `${who} started this project with ${d.tracks} tracks` : `${who} started the project in ${d.phase || "?"} phase`;
    case "project_phase_changed": {
      const to = d.to || "?";
      if (["Alpha", "Beta", "GA"].includes(to)) return `${who} shipped the project to ${to}`;
      return `${who} moved the project from ${d.from || "?"} to ${to}`;
    }
    case "project_status_changed": {
      if (d.to === "deprioritized") return `${who} deprioritized the project`;
      if (d.from === "deprioritized") return `${who} moved the project back to active`;
      return `${who} changed the project status to ${d.to || "?"}`;
    }
    case "project_blocked":         return `${who} marked the project as blocked${d.reason ? ` — ${d.reason}` : ""}`;
    case "project_unblocked":       return `${who} unblocked the project`;
    case "project_updated":         return `${who} updated the project details`;
    case "edit_project":            return `${who} edited the project details`;
    case "project_owner_changed":   return `${who} changed the owner to ${link(d.to) || "—"}`;
    case "project_squad_changed":   return `${who} moved the project to ${d.to || "—"} squad`;
    case "project_start_date_moved": return `${who} moved the tentative start date to ${d.to || "—"}`;
    case "member_added":            return `${who} added ${link(d.person_name) || "a member"} to the team`;
    case "member_removed":          return `${who} removed ${link(d.person_name) || "a member"} from the team`;
    case "resource_added":          return `${who} added a ${d.label || "resource"} link`;
    case "resource_removed":        return `${who} removed a resource link`;
    case "track_started": {
      let msg = `${who} started the ${d.track || "?"} track`;
      if (d.rolloutPct) msg += ` (${d.rolloutPct}%)`;
      if (d.note) msg += ` — ${d.note}`;
      return msg;
    }
    case "track_completed":         return `${who} completed the ${d.track || "?"} track`;
    case "track_reopened": {
      let msg = `${who} reopened the ${d.track || "?"} track`;
      if (d.reason) msg += ` — ${d.reason}`;
      return msg;
    }
    case "project_shipped":         return `${who} shipped the project`;
    default:                        return `${who} · ${ev.action}`;
  }
}

// ── Members row — pill format with initial bubbles + name + designation ──
function MembersRow({ ownerPerson, memberPeople, canManage, canRemove = true, onPersonNavigate, onManage, project }) {
  const allPeople = [ownerPerson, ...memberPeople].filter(Boolean);
  const isEmpty = allPeople.length === 0;

  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!removeTarget || !project?.id) return;
    setRemoving(true);
    const meta = { personName: removeTarget.name, projectName: project?.name, reason: removeReason.trim() || undefined };
    await removeProjectMemberFromDB(project.id, removeTarget.id, meta);
    window.__flowToast?.(`${removeTarget.name} removed from team`);
    setRemoving(false);
    setRemoveTarget(null);
    setRemoveReason("");
  };

  const MemberPill = ({ person, isOwner }) => {
    const [hovered, setHovered] = useState(false);
    const showRemove = hovered && canRemove && !isOwner;

    return (
      <div
        style={{ position: "relative", display: "inline-flex" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          onClick={() => onPersonNavigate?.(person?.name)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 46, boxSizing: "border-box",
            padding: `0 12px 0 6px`, borderRadius: 12,
            background: c.surfaceAlt, border: `1px solid ${c.border}`,
            cursor: "pointer", transition: "border-color 120ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = c.textMid; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; }}
        >
          <Avatar name={person?.name} size={32} accent={isOwner} white />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
            <span style={{ fontFamily: body, fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: "nowrap", lineHeight: 1.2 }}>
              {person?.name || "Unknown"}
            </span>
            <span style={{ fontFamily: body, fontSize: 11, fontWeight: 500, color: c.textDim, whiteSpace: "nowrap", lineHeight: 1.2 }}>
              {isOwner ? "Owner" : person?.role || person?.designation || "Member"}
            </span>
          </div>
        </button>
        {showRemove && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setRemoveTarget(person); }}
            title={`Remove ${person?.name}`}
            style={{
              position: "absolute", top: -6, right: -6, zIndex: 2,
              width: 20, height: 20, borderRadius: 99,
              background: c.red, border: `2px solid ${c.surfaceSolid || "#fff"}`,
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, lineHeight: 1,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              transition: `transform 100ms ease, background 100ms ease`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
      {isEmpty ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${space[3]}px ${space[4]}px`, borderRadius: layout.radiusSm,
          background: c.surfaceAlt, border: `1px dashed ${c.border}`,
        }}>
          <span style={{ fontFamily: body, fontSize: 13, color: c.textDim }}>
            No team members yet — add people to keep everyone in the loop.
          </span>
          {canManage && (
            <button type="button" onClick={onManage}
              style={{
                padding: `4px 12px`, borderRadius: 999,
                background: c.accent, border: "none", color: "#fff",
                fontFamily: body, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >+ Add member</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
          {allPeople.map((p, idx) => (
            <MemberPill key={p?.id || idx} person={p} isOwner={p === ownerPerson} />
          ))}
          {canManage && (
            <button type="button" onClick={onManage}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: `6px 14px 6px 10px`, borderRadius: 12,
                background: "transparent", border: `1px dashed ${c.border}`,
                color: c.textDim, fontFamily: body, fontSize: 13, fontWeight: 600,
                cursor: "pointer", height: 46,
                transition: "border-color 120ms ease, color 120ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textDim; }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add
            </button>
          )}
        </div>
      )}

      {/* Remove member confirmation modal */}
      {removeTarget && (
        <Modal open onClose={() => { setRemoveTarget(null); setRemoveReason(""); }} title="Remove team member">
          <div style={{ fontFamily: body, fontSize: 14, color: c.textMid, lineHeight: 1.6, marginBottom: space[4] }}>
            Remove <strong style={{ color: c.text }}>{removeTarget.name}</strong> from <strong style={{ color: c.text }}>{project?.name || "this project"}</strong>?
          </div>
          <div style={{ marginBottom: space[4] }}>
            <label style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: c.textDim, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Reason <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={removeReason}
              onChange={e => setRemoveReason(e.target.value.slice(0, 200))}
              placeholder="e.g. Moved to another squad, project scope changed..."
              rows={2}
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm,
                border: `1px solid ${c.border}`, background: c.surfaceAlt,
                color: c.text, fontFamily: body, fontSize: 13,
                resize: "none", outline: "none", lineHeight: 1.5,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = c.accent; }}
              onBlur={e => { e.currentTarget.style.borderColor = c.border; }}
            />
          </div>
          <div style={{ display: "flex", gap: space[3], justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setRemoveTarget(null); setRemoveReason(""); }}
              style={{
                padding: `8px 16px`, borderRadius: layout.radiusSm,
                background: "transparent", border: `1px solid ${c.border}`,
                color: c.text, fontFamily: body, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >Cancel</button>
            <button type="button" onClick={handleRemove} disabled={removing}
              style={{
                padding: `8px 20px`, borderRadius: layout.radiusSm,
                background: c.red, border: "none",
                color: "#fff", fontFamily: body, fontSize: 13, fontWeight: 600,
                cursor: removing ? "wait" : "pointer",
                opacity: removing ? 0.7 : 1,
              }}
            >{removing ? "Removing..." : "Remove"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── @-mention dropdown ─────────────────────────────────────────────
function MentionDropdown({ query, people, onSelect, position }) {
  const q = query.toLowerCase();
  const matches = (people || [])
    .filter(p => p?.name?.toLowerCase().includes(q))
    .slice(0, 6);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { setActiveIdx(0); }, [query]);

  if (!matches.length) return null;

  return (
    <div style={{
      position: "absolute",
      left: position.left ?? 0, bottom: position.bottom ?? 44,
      zIndex: 50, minWidth: 200, maxWidth: 280,
      background: c.surfaceSolid, border: `1px solid ${c.border}`,
      borderRadius: layout.radiusSm, boxShadow: c.shadowElevated,
      padding: space[1], display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: `${space[1]}px ${space[2]}px`, fontSize: 11, color: c.textDim, fontFamily: body, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        People
      </div>
      {matches.map((p, i) => (
        <button key={p.id} type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
          onMouseEnter={() => setActiveIdx(i)}
          style={{
            display: "flex", alignItems: "center", gap: space[2],
            padding: `6px ${space[2]}px`, borderRadius: layout.radiusXs,
            background: i === activeIdx ? c.surfaceAlt : "transparent",
            border: "none", cursor: "pointer", textAlign: "left",
          }}
        >
          <Avatar name={p.name} size={24} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: body, fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
            {p.role && <div style={{ fontFamily: body, fontSize: 11, color: c.textDim }}>{p.role}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Composer (auto-grows, expands on focus, @-mention, Enter to post) ──
function Composer({ placeholder, posting, draft, setDraft, focused, setFocused, onSubmit, error, people }) {
  const ref = useRef(null);
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [draft]);

  // Detect @mention trigger
  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setDraft(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  }, [setDraft]);

  const insertMention = useCallback((person) => {
    const el = ref.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const textBefore = draft.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    const before = draft.slice(0, atIdx);
    const after = draft.slice(cursor);
    const newDraft = `${before}@${person.name} ${after}`;
    setDraft(newDraft);
    setMentionQuery(null);
    // Restore focus after insert
    requestAnimationFrame(() => {
      const newPos = atIdx + person.name.length + 2;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  }, [draft, setDraft]);

  const onKey = (e) => {
    // Shift+Enter always inserts a newline — let it through
    if (e.key === "Enter" && e.shiftKey) return;

    if (mentionQuery !== null) {
      if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
      if (e.key === "Enter") {
        const q = mentionQuery.toLowerCase();
        const match = (people || []).find(p => p?.name?.toLowerCase().includes(q));
        if (match) { e.preventDefault(); insertMention(match); return; }
      }
    }
    // Enter to post
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onSubmit?.();
      return;
    }
  };

  const expanded = focused || !!draft.trim();

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      style={{
        padding: `${space[3]}px ${space[4]}px`,
        background: c.surface,
        border: `1px solid ${focused ? c.accent : c.border}`,
        borderRadius: layout.radiusSm,
        boxShadow: focused ? `${c.shadowCard}, 0 0 0 3px ${c.accent}1a` : c.shadowSm,
        transition: "border-color 140ms ease, box-shadow 140ms ease",
        position: "relative",
      }}
    >
      {mentionQuery !== null && (
        <MentionDropdown
          query={mentionQuery}
          people={people}
          onSelect={insertMention}
          position={{ left: 0, bottom: "100%" }}
        />
      )}
      <textarea
        ref={ref}
        value={draft}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { if (!draft.trim()) setFocused(false); setMentionQuery(null); }}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={posting}
        rows={1}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: 0, border: "none", outline: "none",
          background: "transparent",
          fontFamily: body, fontSize: 13, color: c.text, lineHeight: 1.4,
          resize: "none", overflow: "auto", minHeight: 20,
          display: "block", verticalAlign: "middle",
        }}
      />
      {expanded && (
        <div style={{
          marginTop: space[3], paddingTop: space[3],
          borderTop: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2],
        }}>
          <div style={{ fontSize: 11, color: c.textDim, fontFamily: body }}>
            @-mention to tag · Enter to post · Shift+Enter for new line
          </div>
          <div style={{ display: "flex", gap: space[2] }}>
            <button
              type="button"
              onClick={() => { setDraft(""); setFocused(false); setMentionQuery(null); ref.current?.blur(); }}
              style={{
                padding: `6px 12px`, borderRadius: layout.radiusSm,
                background: "transparent", border: `1px solid ${c.border}`,
                color: c.textMid, fontFamily: body, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >Cancel</button>
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              style={{
                padding: `6px 16px`, borderRadius: layout.radiusSm,
                background: draft.trim() && !posting ? c.accent : c.surfaceAlt,
                color: draft.trim() && !posting ? "#fff" : c.textDim,
                border: "none", fontFamily: body, fontSize: 13, fontWeight: 600,
                cursor: draft.trim() && !posting ? "pointer" : "not-allowed",
              }}
            >{posting ? "Posting…" : "Post"}</button>
          </div>
        </div>
      )}
      {error && (
        <div role="alert" style={{ marginTop: space[2], fontSize: 12, color: c.red }}>{error}</div>
      )}
    </form>
  );
}

// ── Hover-revealed ⋯ menu on each comment ───────────────────────────
function CommentMenu({ canEdit, canDelete, busy, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canEdit && !canDelete) return null;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Comment actions"
        style={{
          width: 24, height: 24, padding: 0,
          borderRadius: layout.radiusXs,
          background: open ? c.surfaceAlt : "transparent",
          border: "none", color: c.textDim, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, lineHeight: 1, fontWeight: 700,
        }}
      >⋯</button>
      {open && (
        <div role="menu" style={{
          position: "absolute", top: 28, right: 0, zIndex: 10, minWidth: 120,
          padding: space[1], background: c.surfaceSolid,
          border: `1px solid ${c.border}`, borderRadius: layout.radiusSm,
          boxShadow: c.shadowElevated,
          display: "flex", flexDirection: "column",
        }}>
          {canEdit && (
            <button type="button" role="menuitem"
              onClick={() => { setOpen(false); onEdit?.(); }}
              onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              style={{
                padding: `7px 10px`, textAlign: "left",
                background: "transparent", border: "none", borderRadius: layout.radiusXs,
                color: c.text, fontFamily: body, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >Edit</button>
          )}
          {canDelete && (
            <button type="button" role="menuitem"
              onClick={() => { setOpen(false); onDelete?.(); }}
              disabled={busy}
              onMouseEnter={e => { e.currentTarget.style.background = c.redDim; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              style={{
                padding: `7px 10px`, textAlign: "left",
                background: "transparent", border: "none", borderRadius: layout.radiusXs,
                color: c.red, fontFamily: body, fontSize: 13, fontWeight: 500,
                cursor: busy ? "wait" : "pointer",
              }}
            >Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline editor (when a comment is being edited) ──────────────────
function InlineEditor({ value, onSave, onCancel, busy }) {
  const [draft, setDraft] = useState(value);
  return (
    <div style={{ marginTop: space[2], display: "flex", flexDirection: "column", gap: space[2] }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        autoFocus
        style={{
          width: "100%", boxSizing: "border-box",
          padding: space[3], borderRadius: layout.radiusSm,
          background: c.surfaceAlt, border: `1px solid ${c.border}`,
          fontFamily: body, fontSize: 14, color: c.text, resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: space[2] }}>
        <button type="button"
          onClick={() => { if (draft.trim()) onSave?.(draft.trim()); }}
          disabled={busy || !draft.trim()}
          style={{
            padding: `6px 14px`, borderRadius: layout.radiusSm,
            background: c.accent, color: "#fff", border: "none",
            fontFamily: body, fontSize: 13, fontWeight: 600,
            cursor: busy ? "wait" : "pointer", opacity: draft.trim() ? 1 : 0.6,
          }}
        >Save</button>
        <button type="button" onClick={onCancel} disabled={busy}
          style={{
            padding: `6px 14px`, borderRadius: layout.radiusSm,
            background: "transparent", color: c.textMid, border: `1px solid ${c.border}`,
            fontFamily: body, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
export default function ProjectActivity({
  project, people, currentPerson, isAppOwner = false,
  onPersonNavigate, membersOnly = false, membersInline = false, hideMembers = false,
  canManageMembers: canManageMembersProp, canRemoveMembers: canRemoveMembersProp,
}) {
  const projectId = project?.id;
  const { comments, members, events, loading, error } = useProjectActivity(projectId);

  const peopleById = useMemo(() => {
    const m = new Map();
    (people || []).forEach(p => m.set(p.id, p));
    return m;
  }, [people]);

  const peopleByLowerName = useMemo(() => {
    const m = new Map();
    (people || []).forEach(p => { if (p?.name) m.set(p.name.toLowerCase(), p); });
    return m;
  }, [people]);

  const ownerPerson = useMemo(() => {
    if (!project) return null;
    if (project.owner_id) return peopleById.get(project.owner_id) || null;
    if (project.owner) return peopleByLowerName.get(project.owner.toLowerCase()) || null;
    return null;
  }, [project, peopleById, peopleByLowerName]);

  const memberPeople = useMemo(
    () => (members || [])
      .map(m => peopleById.get(m.person_id))
      .filter(Boolean)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [members, peopleById],
  );

  const isProjectOwner = !!(currentPerson?.id && ownerPerson?.id && currentPerson.id === ownerPerson.id);
  const isMember = !!(currentPerson?.id && (members || []).some(m => m.person_id === currentPerson.id));
  const canPost = true;
  const canManageMembers = canManageMembersProp !== undefined ? canManageMembersProp : true;
  const canRemoveMembers = canRemoveMembersProp !== undefined ? canRemoveMembersProp : true;

  const feed = useMemo(() => {
    const items = [];
    (comments || []).forEach(cmt => items.push({ kind: "comment", ts: cmt.created_at, data: cmt }));
    (events   || []).filter(ev => ev.action !== "shoutout" && ev.action !== "feedback" && ev.action !== "project_shipped").forEach(ev  => items.push({ kind: "event",   ts: ev.created_at,  data: ev  }));
    items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return items;
  }, [comments, events]);

  // Composer state
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState(null);

  const handlePost = useCallback(async () => {
    if (!projectId || !currentPerson?.id) return;
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    setComposerError(null);
    const res = await addProjectCommentToDB(projectId, currentPerson.id, text);
    setPosting(false);
    if (!res?.ok) {
      setComposerError(res?.error?.message || "Couldn't post that — try again.");
      return;
    }
    setDraft("");
    setFocused(false);
  }, [draft, projectId, currentPerson?.id]);

  const handleQuote = useCallback((quoteText) => {
    setDraft(prev => prev ? `${prev}\n${quoteText}\n` : `${quoteText}\n`);
    setFocused(true);
  }, []);

  const onEditComment = useCallback(async (commentId, body) => editProjectCommentInDB(commentId, body), []);
  const onDeleteComment = useCallback(async (commentId) => {
    if (!window.confirm("Delete this comment? It will show as removed in the timeline.")) return;
    await softDeleteProjectCommentFromDB(commentId);
  }, []);

  const [membersModalOpen, setMembersModalOpen] = useState(false);

  if (membersOnly) {
    const inner = (
      <>
        <MembersRow
          ownerPerson={ownerPerson}
          memberPeople={memberPeople}
          canManage={canManageMembers}
          canRemove={canRemoveMembers}
          onPersonNavigate={onPersonNavigate}
          onManage={() => setMembersModalOpen(true)}
          project={project}
        />
        {membersModalOpen && (
          <ManageMembersModal
            project={project}
            members={members}
            people={people}
            currentPersonId={currentPerson?.id}
            onClose={() => setMembersModalOpen(false)}
          />
        )}
      </>
    );
    if (membersInline) return inner;
    return (
      <div style={{
        padding: `${space[4]}px ${space[5]}px`,
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: layout.radiusLg,
        boxShadow: c.shadowCard,
      }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{
      padding: `${space[4]}px ${space[5]}px ${space[5]}px`,
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: layout.radiusLg,
      boxShadow: c.shadowCard,
      display: "flex", flexDirection: "column", gap: space[4],
    }}>
      {!hideMembers && (
        <MembersRow
          ownerPerson={ownerPerson}
          memberPeople={memberPeople}
          canManage={canManageMembers}
          canRemove={canRemoveMembers}
          onPersonNavigate={onPersonNavigate}
          onManage={() => setMembersModalOpen(true)}
          project={project}
        />
      )}

      {canPost ? (
        <Composer
          placeholder={`Post an update on ${project?.name || "this project"}…`}
          posting={posting}
          draft={draft}
          setDraft={setDraft}
          focused={focused}
          setFocused={setFocused}
          error={composerError}
          onSubmit={handlePost}
          people={people}
        />
      ) : (
        <div style={{
          padding: `${space[3]}px ${space[4]}px`,
          background: c.surfaceAlt, border: `1px dashed ${c.border}`,
          borderRadius: layout.radiusLg,
          fontSize: 13, color: c.textDim, fontFamily: body,
        }}>
          Only the project owner and members can post. Ask {ownerPerson?.name || "the owner"} to add you.
        </div>
      )}

      {/* Feed — vertical timeline rail */}
      {loading ? (
        <div style={{ padding: `${space[6]}px ${space[4]}px`, textAlign: "center", color: c.textDim, fontSize: 13 }}>
          Loading activity…
        </div>
      ) : error ? (
        <div role="alert" style={{
          padding: space[4], color: c.red, fontSize: 13,
          background: c.redDim, border: `1px solid ${c.red}30`, borderRadius: layout.radiusSm,
        }}>Couldn't load activity: {error}</div>
      ) : feed.length === 0 ? (
        <div style={{
          padding: `${space[7]}px ${space[4]}px`, textAlign: "center",
          color: c.textDim, fontSize: 14, fontFamily: body,
        }}>
          No activity yet. {canPost
            ? "Be the first to post — your team will see it here."
            : "Updates from the team will land here."}
        </div>
      ) : (
        <ul style={{
          listStyle: "none", margin: 0,
          padding: `${space[2]}px 0 ${space[2]}px 32px`,
          position: "relative",
          display: "flex", flexDirection: "column", gap: space[5],
        }}>
          {/* Vertical rail line — center at 11px from ul left (matches node centers) */}
          <span aria-hidden="true" style={{
            position: "absolute", left: 10, top: 19, bottom: 19,
            width: 2, background: c.border, borderRadius: 1,
          }} />

          {feed.map(item => item.kind === "comment"
            ? (
              <RailComment
                key={`c-${item.data.id}`}
                comment={item.data}
                author={peopleById.get(item.data.author_id)}
                currentPerson={currentPerson}
                isProjectOwner={isProjectOwner}
                isAppOwner={isAppOwner}
                peopleByLowerName={peopleByLowerName}
                onPersonNavigate={onPersonNavigate}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                onQuote={handleQuote}
              />
            )
            : (
              <li key={`e-${item.data.id}`} style={{ position: "relative", paddingTop: 1, paddingBottom: 1 }}>
                {/* Opaque dot: white backing circle covers the rail, dot sits on top */}
                {(() => {
                  const isShipEvent = item.data.action === "project_shipped" || (item.data.action === "project_phase_changed" && ["Alpha", "Beta", "GA"].includes(item.data.details?.to));
                  const isAlphaBetaTrack = ["track_started", "track_completed", "track_reopened"].includes(item.data.action) && ["Alpha", "Beta"].includes(item.data.details?.track);
                  const isTrackEvent = ["track_started", "track_completed", "track_reopened"].includes(item.data.action);
                  const isGreenEvent = isShipEvent || isAlphaBetaTrack;
                  const dotColor = isGreenEvent ? c.green : isTrackEvent ? c.accent : c.border;
                  const textColor = isGreenEvent ? c.green : isTrackEvent ? c.textMid : c.textDim;
                  return (
                    <>
                      <span aria-hidden="true" style={{
                        position: "absolute", left: -29, top: 1,
                        width: 16, height: 16, borderRadius: "50%",
                        background: c.surfaceSolid, zIndex: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
                      </span>
                      <div style={{
                        fontFamily: body, fontSize: 12, color: textColor,
                        display: "flex", alignItems: "baseline", gap: space[1], flexWrap: "wrap",
                        lineHeight: 1.4, fontWeight: isGreenEvent ? 600 : 400,
                      }}>
                        <span>{actionLabel(item.data, peopleByLowerName)}</span>
                        <span title={fmtAbsolute(item.data.created_at)} style={{ fontSize: 11, color: c.textGhost || c.textDim, fontWeight: 400 }}>· {timeAgo(item.data.created_at)}</span>
                      </div>
                    </>
                  );
                })()}
              </li>
            )
          )}
        </ul>
      )}

      {membersModalOpen && (
        <ManageMembersModal
          project={project}
          members={members}
          people={people}
          currentPersonId={currentPerson?.id}
          onClose={() => setMembersModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── A single comment node on the rail ──────────────────────────────
function RailComment({ comment, author, currentPerson, isProjectOwner, isAppOwner, peopleByLowerName, onPersonNavigate, onEdit, onDelete, onQuote }) {
  const isAuthor = !!(currentPerson?.id && comment.author_id === currentPerson.id);
  const withinEditWindow = (Date.now() - new Date(comment.created_at).getTime()) < EDIT_WINDOW_MS;
  const canEdit = isAuthor && withinEditWindow && !comment.deleted_at;
  const canDelete = !comment.deleted_at && (isAuthor || isProjectOwner || isAppOwner);
  const isWeeklyUpdate = comment.body?.startsWith(WEEKLY_UPDATE_TAG);
  const displayBody = isWeeklyUpdate ? comment.body.slice(WEEKLY_UPDATE_TAG.length).trim() : comment.body;

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  // Persistent reactions via sessionStorage
  const reactionKey = `flow_reactions_${comment.id}`;
  const initReactions = () => {
    try { return JSON.parse(sessionStorage.getItem(reactionKey) || "{}"); } catch (_e) { return {}; }
  };
  const [thumbed, setThumbedRaw] = useState(() => !!initReactions().thumbed);
  const [hearted, setHeartedRaw] = useState(() => !!initReactions().hearted);
  const setThumbed = useCallback((v) => {
    setThumbedRaw(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        const cur = JSON.parse(sessionStorage.getItem(reactionKey) || "{}");
        cur.thumbed = next;
        sessionStorage.setItem(reactionKey, JSON.stringify(cur));
      } catch (_e) { /* ignore */ }
      return next;
    });
  }, [reactionKey]);
  const setHearted = useCallback((v) => {
    setHeartedRaw(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        const cur = JSON.parse(sessionStorage.getItem(reactionKey) || "{}");
        cur.hearted = next;
        sessionStorage.setItem(reactionKey, JSON.stringify(cur));
      } catch (_e) { /* ignore */ }
      return next;
    });
  }, [reactionKey]);

  const save = async (text) => {
    setBusy(true);
    const r = await onEdit?.(comment.id, text);
    setBusy(false);
    if (r?.ok) setEditing(false);
  };

  const copyAsRef = () => {
    const quote = `> ${(author?.name || "Someone")}: ${(displayBody || "").split("\n")[0].slice(0, 120)}`;
    if (onQuote) onQuote(quote);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <li
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative" }}
    >
      {/* Opaque ring: white backing circle covers the rail, colored ring sits on top */}
      <span aria-hidden="true" style={{
        position: "absolute", left: -31, top: 1,
        width: 20, height: 20, borderRadius: "50%",
        background: c.surfaceSolid, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          width: 14, height: 14, borderRadius: "50%",
          background: isWeeklyUpdate ? c.accentDim : c.surface,
          border: `3px solid ${isWeeklyUpdate ? c.accent : isAuthor ? c.accent : c.cyan}`,
          boxSizing: "border-box",
        }} />
      </span>

      {isWeeklyUpdate && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: `2px 8px`, borderRadius: 999, marginBottom: 4,
          background: c.accentDim, border: `1px solid ${c.accent}30`,
          fontFamily: mono, fontSize: 10, fontWeight: 700,
          color: c.accent, letterSpacing: "0.04em", textTransform: "uppercase",
        }}>Weekly Update</div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: space[2], flexWrap: "wrap" }}>
        <button type="button"
          onClick={() => onPersonNavigate?.(author?.name)}
          disabled={!author?.name}
          style={{
            background: "transparent", border: "none", padding: 0,
            fontFamily: body, fontSize: 14, fontWeight: 700, color: c.text,
            cursor: author?.name ? "pointer" : "default",
          }}
        >{author?.name || "Unknown"}</button>
        <span title={fmtAbsolute(comment.created_at)} style={{ fontSize: 12, color: c.textDim }}>
          {timeAgo(comment.created_at)}{comment.edited_at ? " · edited" : ""}
        </span>
        <span style={{ flex: 1 }} />
        {!editing && !comment.deleted_at && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            opacity: hover ? 1 : 0, transition: "opacity 120ms ease",
          }}>
            <button type="button" onClick={() => setThumbed(l => !l)} title="Thumbs up"
              style={{
                width: 24, height: 24, padding: 0, border: "none", borderRadius: layout.radiusXs,
                background: thumbed ? c.accentDim : "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: thumbed ? c.accent : c.textDim,
              }}
            >👍</button>
            <button type="button" onClick={() => setHearted(l => !l)} title="Heart"
              style={{
                width: 24, height: 24, padding: 0, border: "none", borderRadius: layout.radiusXs,
                background: hearted ? c.accentDim : "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13,
              }}
            >❤️</button>
            <button type="button" onClick={copyAsRef} title={copied ? "Copied!" : "Quote in reply"}
              style={{
                width: 24, height: 24, padding: 0, border: "none", borderRadius: layout.radiusXs,
                background: copied ? c.greenDim : "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: copied ? c.green : c.textDim,
              }}
            >{copied ? "✓" : "↩"}</button>
            {canDelete && (
              <button type="button"
                onClick={async () => { setBusy(true); await onDelete?.(comment.id); setBusy(false); }}
                disabled={busy}
                style={{
                  padding: `2px 8px`, border: "none", borderRadius: layout.radiusXs,
                  background: "transparent", cursor: busy ? "wait" : "pointer",
                  fontFamily: body, fontSize: 12, fontWeight: 500, color: c.red,
                }}
              >Delete</button>
            )}
          </div>
        )}
      </div>

      {comment.deleted_at ? (
        <div style={{ marginTop: 2, fontSize: 13, color: c.textDim, fontStyle: "italic" }}>Comment deleted.</div>
      ) : editing ? (
        <InlineEditor value={comment.body} onSave={save} onCancel={() => setEditing(false)} busy={busy} />
      ) : (() => {
        // Split into quoted lines (starting with "> ") and regular lines
        const lines = (displayBody || "").split("\n");
        const blocks = [];
        let currentQuote = [];
        let currentText = [];
        const flushQuote = () => { if (currentQuote.length) { blocks.push({ type: "quote", text: currentQuote.join("\n") }); currentQuote = []; } };
        const flushText = () => { if (currentText.length) { blocks.push({ type: "text", text: currentText.join("\n") }); currentText = []; } };
        lines.forEach(line => {
          if (line.startsWith("> ")) {
            flushText();
            currentQuote.push(line.slice(2));
          } else {
            flushQuote();
            currentText.push(line);
          }
        });
        flushQuote(); flushText();

        return (
          <div style={{
            marginTop: 4,
            ...(isWeeklyUpdate ? {
              padding: `${space[3]}px ${space[4]}px`,
              background: c.surfaceAlt, borderRadius: layout.radiusSm,
              borderLeft: `3px solid ${c.accent}`,
            } : {}),
          }}>
            {blocks.map((block, bi) =>
              block.type === "quote" ? (
                <div key={bi} style={{
                  padding: `${space[2]}px ${space[3]}px`,
                  marginBottom: space[1],
                  background: c.surfaceAlt, borderRadius: layout.radiusSm,
                  borderLeft: `3px solid ${c.border}`,
                  fontSize: 13, lineHeight: 1.5, color: c.textDim,
                  fontStyle: "italic",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{renderBody(block.text, peopleByLowerName, onPersonNavigate)}</div>
              ) : (
                <div key={bi} style={{
                  fontSize: 14, lineHeight: 1.55, color: c.text,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{renderBody(block.text, peopleByLowerName, onPersonNavigate)}</div>
              )
            )}
          </div>
        );
      })()}

      {(thumbed || hearted) && (
        <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
          {thumbed && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 6px", borderRadius: 999,
              background: c.surfaceAlt, border: `1px solid ${c.border}`,
              fontSize: 12, color: c.textMid, cursor: "pointer",
            }} onClick={() => setThumbed(false)}>
              👍 <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600 }}>1</span>
            </div>
          )}
          {hearted && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 6px", borderRadius: 999,
              background: c.surfaceAlt, border: `1px solid ${c.border}`,
              fontSize: 12, color: c.textMid, cursor: "pointer",
            }} onClick={() => setHearted(false)}>
              ❤️ <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600 }}>1</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ── Manage Members modal ───────────────────────────────────────────
function ManageMembersModal({ project, members, people, currentPersonId, onClose }) {
  const [query, setQuery] = useState("");
  const [busyIds, setBusyIds] = useState(new Set());

  const memberIds = useMemo(() => new Set((members || []).map(m => m.person_id)), [members]);
  const ownerId = project?.owner_id || null;

  const eligible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people || [])
      .filter(p => p.id !== ownerId)
      .filter(p => !q || p.name?.toLowerCase().includes(q) || (p.squad || "").toLowerCase().includes(q) || (p.role || "").toLowerCase().includes(q))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [people, ownerId, query]);

  const markBusy = (id, busy) => setBusyIds(prev => {
    const n = new Set(prev);
    if (busy) n.add(id); else n.delete(id);
    return n;
  });

  const toggle = async (person) => {
    const isMember = memberIds.has(person.id);
    markBusy(person.id, true);
    const meta = { personName: person.name, projectName: project?.name };
    if (isMember) {
      await removeProjectMemberFromDB(project.id, person.id, meta);
      window.__flowToast?.(`${person.name} removed from team`);
    } else {
      await addProjectMemberToDB(project.id, person.id, currentPersonId, meta);
      window.__flowToast?.(`${person.name} added to team`);
    }
    markBusy(person.id, false);
  };

  return (
    <Modal open onClose={onClose} title={`Manage members · ${project?.name || ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: space[3], minHeight: 320 }}>
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, squad, or role…"
          autoFocus
          style={{
            padding: `10px 14px`, borderRadius: layout.radiusSm,
            background: c.surfaceAlt, border: `1px solid ${c.border}`,
            fontFamily: body, fontSize: 14, color: c.text,
          }}
        />
        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {eligible.length === 0 ? (
            <div style={{ padding: space[4], textAlign: "center", color: c.textDim, fontSize: 13 }}>No people match.</div>
          ) : eligible.map(p => {
            const isMember = memberIds.has(p.id);
            const busy = busyIds.has(p.id);
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: space[3],
                padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm,
                background: isMember ? c.surfaceAlt : "transparent",
              }}>
                <Avatar name={p.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: body, fontSize: 14, fontWeight: 600, color: c.text }}>{p.name}</div>
                  <div style={{ fontFamily: body, fontSize: 12, color: c.textDim }}>
                    {[p.role, p.squad].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <button type="button" onClick={() => toggle(p)} disabled={busy}
                  style={{
                    padding: `6px 14px`, borderRadius: layout.radiusSm,
                    background: isMember ? c.redDim : c.accent,
                    color: isMember ? c.red : "#fff",
                    border: isMember ? `1px solid ${c.red}30` : "none",
                    fontFamily: body, fontSize: 12, fontWeight: 600,
                    cursor: busy ? "wait" : "pointer", minWidth: 80,
                  }}
                >{busy ? "…" : isMember ? "Remove" : "Add"}</button>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}
            style={{
              padding: `8px 16px`, borderRadius: layout.radiusSm,
              background: "transparent", border: `1px solid ${c.border}`,
              color: c.text, fontFamily: body, fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >Done</button>
        </div>
      </div>
    </Modal>
  );
}
