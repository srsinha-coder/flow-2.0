// Flow — Admin Settings View (Real Settings)
// Admin-only panel inside TerminalView for replying to rants, changing status, etc.
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { c, space, body, terminal, terminalRadius } from "../styles/theme";
import { supabase } from "../lib/supabase";
import useDevLabel from "../hooks/useDevLabel";
import AccessRequestsAdmin from "../components/AccessRequestsAdmin";

const MONO = body;

/* ── ACTION_CONFIG (mirrors LogsView) ─────────────────────────── */
const ACTION_CONFIG = {
  login:              { icon: "→", color: () => c.cyan, label: "signed in" },
  logout:             { icon: "←", color: () => c.textDim, label: "signed out" },
  lock_commitment:    { icon: "\u{1F512}", color: () => c.green, label: "locked commitment" },
  unlock_commitment:  { icon: "\u{1F513}", color: () => c.orange, label: "unlocked commitment" },
  edit_commitment:    { icon: "\u270E", color: () => c.purple, label: "edited commitment" },
  edit_project:       { icon: "\u270E", color: () => c.accent, label: "edited project" },
  create_project:     { icon: "+", color: () => c.green, label: "created project" },
  add_person:         { icon: "+", color: () => c.cyan, label: "added person" },
  settings_change:    { icon: "\u2699", color: () => c.orange, label: "changed settings" },
  onboard:            { icon: "\u2605", color: () => c.orange, label: "joined Flow" },
  terminal_unlock:    { icon: "\u{1F513}", color: () => c.green, label: "unlocked terminal" },
  terminal_attempt:   { icon: "\u26A0", color: () => c.red, label: "failed terminal attempt" },
  admin_unlock:       { icon: "\u{1F513}", color: () => c.orange, label: "unlocked admin" },
  admin_attempt:      { icon: "\u26A0", color: () => c.red, label: "failed admin attempt" },
};
const DEFAULT_ACTION = { icon: "\u00B7", color: () => c.textDim, label: "action" };

const CATEGORIES = [
  { key: "feature", label: "Feature Request", icon: "✦", color: () => c.purple },
  { key: "bug", label: "Bug Report", icon: "⚠", color: () => c.red },
  { key: "rant", label: "General Rant", icon: "🔥", color: () => c.red },
];

const STATUSES = [
  { key: "pending", label: "Pending", color: () => c.orange, icon: "◷" },
  { key: "approved", label: "Approved", color: () => c.green, icon: "✓" },
  { key: "rejected", label: "Rejected", color: () => c.red, icon: "✗" },
  { key: "shipped", label: "Shipped", color: () => c.cyan, icon: "🚀" },
];

const timeAgo = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function AdminSettingsView({ onBack, appSettings = {}, setAppSettings, currentPersonId, isOwner = false }) {
  const devRef = useDevLabel('Admin panel for rant management and activity log audit');
  const [rants, setRants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [gaWeeks, setGaWeeks] = useState(appSettings.ga_visibility_weeks ?? "2");
  const [gaSaving, setGaSaving] = useState(false);
  const [gaToast, setGaToast] = useState(null);

  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  /* ── Activity Log Admin state ─────────────────────────── */
  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logLoaded, setLogLoaded] = useState(false);
  const [logFilterUser, setLogFilterUser] = useState("");
  const [logFilterAction, setLogFilterAction] = useState("");
  const [logSelected, setLogSelected] = useState(new Set());
  const [logDeleting, setLogDeleting] = useState(false);
  const [logConfirm, setLogConfirm] = useState(false);
  const [logToast, setLogToast] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setLogEntries(data || []);
      setLogLoaded(true);
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setLogLoading(false);
    }
  }, []);

  const logUniqueUsers = useMemo(() =>
    [...new Set(logEntries.map(l => l.user_name || l.user_email).filter(Boolean))].sort(),
    [logEntries]
  );
  const logUniqueActions = useMemo(() =>
    [...new Set(logEntries.map(l => l.action).filter(Boolean))].sort(),
    [logEntries]
  );
  const filteredLogs = useMemo(() =>
    logEntries.filter(l =>
      (!logFilterUser || (l.user_name || l.user_email) === logFilterUser) &&
      (!logFilterAction || l.action === logFilterAction)
    ),
    [logEntries, logFilterUser, logFilterAction]
  );

  const toggleLogSelect = (id) => {
    setLogSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (logSelected.size === filteredLogs.length) {
      setLogSelected(new Set());
    } else {
      setLogSelected(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const handleDeleteLogs = async () => {
    if (logSelected.size === 0) return;
    setLogDeleting(true);
    try {
      const ids = [...logSelected];
      const { error } = await supabase
        .from("activity_log")
        .delete()
        .in("id", ids);
      if (error) throw error;
      setLogEntries(prev => prev.filter(l => !logSelected.has(l.id)));
      setLogSelected(new Set());
      setLogConfirm(false);
      setLogToast(`Deleted ${ids.length} entries`);
      setTimeout(() => setLogToast(null), 3000);
    } catch (err) {
      console.error("Delete failed:", err);
      setLogToast("Delete failed — check RLS policy");
      setTimeout(() => setLogToast(null), 4000);
    } finally {
      setLogDeleting(false);
    }
  };

  const fetchRants = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRants(data || []);
    } catch (err) {
      console.error("Failed to fetch rants:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRants(); }, [fetchRants]);

  const handleGaSave = async () => {
    const val = parseInt(gaWeeks, 10);
    if (isNaN(val) || val < 0) return;
    setGaSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ga_visibility_weeks", value: String(val), updated_at: new Date().toISOString() });
      if (error) throw error;
      if (setAppSettings) setAppSettings(prev => ({ ...prev, ga_visibility_weeks: String(val) }));
      setGaToast("Saved");
      setTimeout(() => setGaToast(null), 2500);
    } catch (err) {
      console.error("GA settings save failed:", err);
      setGaToast("Failed to save");
      setTimeout(() => setGaToast(null), 3000);
    } finally {
      setGaSaving(false);
    }
  };

  const openRant = (r) => {
    setSelected(r);
    setReplyText(r.admin_note || "");
    setNewStatus(r.status || "pending");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("rants")
        .update({ admin_note: replyText.trim() || null, status: newStatus })
        .eq("id", selected.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        // RLS blocked the update — try with explicit session check
        const { data: { session } } = await supabase.auth.getSession();
        console.warn("Rant update returned 0 rows. Auth session:", session ? "active" : "none");
        throw new Error("Update blocked by RLS — are you signed in?");
      }
      // Update local state from actual DB response
      const updated = data[0];
      setRants(prev => prev.map(r => r.id === selected.id ? { ...r, ...updated } : r));
      setSelected(prev => ({ ...prev, ...updated }));
      setToast("Saved");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error("Save failed:", err);
      setToast(err.message || "Failed to save");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const filteredRants = filterStatus === "all" ? rants : rants.filter(r => (r.status || "pending") === filterStatus);

  // ── Detail view ──
  if (selected) {
    const cat = CATEGORIES.find(cc => cc.key === selected.category) || CATEGORIES[0];
    const st = STATUSES.find(s => s.key === (selected.status || "pending")) || STATUSES[0];
    const hasExistingReply = !!selected.admin_note;

    return (
      <div style={{ animation: "flow-load-fade-in 0.3s ease-out" }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            background: "transparent", border: "none", color: c.orange,
            fontFamily: MONO, fontSize: 12, cursor: "pointer", padding: 0,
            marginBottom: space[4], display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>←</span> back to rants
        </button>

        {/* ── Rant header bar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: space[3],
          padding: `${space[2]}px 0`,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: terminalRadius.md,
            background: cat.color() + "18", border: `1px solid ${cat.color()}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>
            {cat.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{selected.title}</div>
            <div style={{ fontSize: 11, color: `${terminal.gold}90`, marginTop: 3, display: "flex", gap: 8, alignItems: "center" }}>
              <span>{selected.user_name}</span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span>{timeAgo(selected.created_at)}</span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span style={{ opacity: 0.5 }}>ID: {selected.id.slice(0, 8)}</span>
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            color: st.color(), padding: "4px 12px",
            background: st.color() + "15", border: `1px solid ${st.color()}35`,
            borderRadius: terminalRadius.sm,
          }}>
            {st.icon} {st.label.toUpperCase()}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            color: cat.color(), padding: "4px 12px",
            background: cat.color() + "15", border: `1px solid ${cat.color()}35`,
            borderRadius: terminalRadius.sm,
          }}>
            {cat.label}
          </span>
        </div>

        {/* ── Rant body ── */}
        {(selected.body || selected.image_url) && (
          <div style={{
            border: "1px solid rgba(0,0,0,0.04)", borderRadius: terminalRadius.md, padding: space[4],
            background: c.surfaceAlt, marginBottom: space[4],
          }}>
            {selected.body && (
              <div style={{ fontSize: 13, color: c.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {selected.body}
              </div>
            )}
            {selected.image_url && (
              <div style={{ marginTop: selected.body ? space[3] : 0 }}>
                <div style={{ fontSize: 11, color: `${terminal.gold}80`, letterSpacing: "0.08em", marginBottom: space[1], fontWeight: 600 }}>ATTACHMENT</div>
                <img
                  src={selected.image_url}
                  alt="attachment"
                  style={{
                    maxWidth: "100%", maxHeight: 400, borderRadius: terminalRadius.md,
                    border: `1px solid ${terminal.gold}20`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── No body/image placeholder ── */}
        {!selected.body && !selected.image_url && (
          <div style={{
            border: "1px dashed rgba(0,0,0,0.06)", borderRadius: terminalRadius.md, padding: space[4],
            background: "transparent", marginBottom: space[4],
            textAlign: "center", color: c.textDim, fontSize: 12, fontFamily: MONO,
          }}>
            No description or attachment provided
          </div>
        )}

        {/* ── Admin reply section ── */}
        <div style={{
          borderRadius: terminalRadius.md, overflow: "hidden",
          border: `1px solid ${terminal.gold}20`,
        }}>
          {/* Status bar */}
          <div style={{
            padding: `${space[2]}px ${space[4]}px`,
            background: `${terminal.gold}08`,
            borderBottom: `1px solid ${terminal.gold}15`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: c.orange, letterSpacing: "0.08em" }}>
              UPDATE STATUS
            </span>
            <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
              {STATUSES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setNewStatus(s.key)}
                  style={{
                    background: newStatus === s.key ? `${s.color()}25` : "transparent",
                    border: `1px solid ${newStatus === s.key ? s.color() + "80" : c.border}`,
                    borderRadius: terminalRadius.sm, padding: "4px 12px",
                    fontFamily: MONO, fontSize: 11,
                    color: newStatus === s.key ? s.color() : c.textDim,
                    cursor: "pointer", transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
                    fontWeight: newStatus === s.key ? 700 : 400,
                  }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reply textarea */}
          <div style={{ padding: space[4], background: c.bg }}>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              aria-label="Admin reply"
              placeholder="Write a response visible to the submitter..."
              rows={3}
              style={{
                width: "100%", background: "transparent", border: `1px solid ${terminal.gold}18`,
                borderRadius: terminalRadius.sm, padding: `${space[2]}px ${space[3]}px`,
                fontFamily: MONO, fontSize: 12, color: c.text,
                resize: "vertical", outline: "none",
                lineHeight: 1.7, boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = `${terminal.gold}40`}
              onBlur={e => e.target.style.borderColor = `${terminal.gold}18`}
            />

            {/* Action row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: space[3] }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: `linear-gradient(135deg, ${terminal.gold}, ${terminal.goldDeep})`,
                  color: c.bg, border: "none",
                  borderRadius: terminalRadius.md, padding: "10px 28px",
                  fontFamily: MONO, fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.05em",
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.5 : 1,
                  transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
                  boxShadow: "0 2px 12px rgba(251,191,36,0.2)",
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = "0 4px 20px rgba(251,191,36,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(251,191,36,0.2)"; }}
              >
                {saving ? "Sending..." : hasExistingReply ? "Update Reply" : "Reply"}
              </button>
              {toast && (
                <span style={{
                  fontSize: 11, fontFamily: MONO, fontWeight: 600,
                  color: toast === "Saved" ? c.green : c.red,
                  animation: "flow-load-fade-in 0.3s ease-out",
                }}>
                  {toast === "Saved" ? "✓ Reply sent" : toast}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div ref={devRef} style={{ animation: "flow-load-fade-in 0.3s ease-out" }}>
      <button
        onClick={onBack}
        style={{
          background: "transparent", border: "none", color: c.orange,
          fontFamily: MONO, fontSize: 12, cursor: "pointer", padding: 0,
          marginBottom: space[4], display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>←</span> back to terminal
      </button>

      <div style={{ fontSize: 11, fontWeight: 700, color: c.orange, letterSpacing: "0.1em", marginBottom: space[3] }}>
        ---- ADMIN SETTINGS ----
      </div>

      {/* GA Visibility Control */}
      <div style={{
        border: `1px solid ${terminal.gold}20`, borderRadius: terminalRadius.md, padding: space[4],
        background: `${terminal.gold}05`, marginBottom: space[5],
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.orange, letterSpacing: "0.08em", marginBottom: space[3] }}>
          GA VISIBILITY IN PULSE
        </div>
        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.5)", marginBottom: space[3], lineHeight: 1.6 }}>
          Projects in GA phase auto-hide from Pulse after this many weeks.
          They remain visible in Projects view.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="number"
            min="0"
            max="52"
            value={gaWeeks}
            aria-label="GA visibility weeks"
            onChange={e => setGaWeeks(e.target.value)}
            style={{
              width: 64, background: c.bg, border: `1px solid ${terminal.gold}30`,
              borderRadius: terminalRadius.sm, padding: "6px 10px",
              fontFamily: MONO, fontSize: 13, color: c.text,
              textAlign: "center", outline: "none",
            }}
            onFocus={e => e.target.style.borderColor = c.orange}
            onBlur={e => e.target.style.borderColor = `${terminal.gold}30`}
          />
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.38)", fontFamily: MONO }}>weeks</span>
          <button
            onClick={handleGaSave}
            disabled={gaSaving}
            style={{
              background: c.orange, color: c.bg, border: "none",
              borderRadius: terminalRadius.sm, padding: "6px 16px", marginLeft: 8,
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              cursor: gaSaving ? "wait" : "pointer",
              opacity: gaSaving ? 0.5 : 1,
              transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
            }}
          >
            {gaSaving ? "..." : "Save"}
          </button>
          {gaToast && (
            <span style={{ fontSize: 11, color: gaToast === "Saved" ? c.green : c.red, fontFamily: MONO, marginLeft: 8 }}>
              {gaToast}
            </span>
          )}
        </div>
      </div>

      {isOwner && <AccessRequestsAdmin currentPersonId={currentPersonId} />}

      <div style={{ fontSize: 11, fontWeight: 700, color: c.orange, letterSpacing: "0.1em", marginBottom: space[3] }}>
        ---- RANT ADMIN ----
      </div>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: space[4], flexWrap: "wrap" }}>
        <button
          onClick={() => setFilterStatus("all")}
          style={{
            background: filterStatus === "all" ? `${terminal.gold}20` : "transparent",
            border: `1px solid ${filterStatus === "all" ? c.orange : c.border}`,
            borderRadius: terminalRadius.sm, padding: "3px 10px",
            fontFamily: MONO, fontSize: 11,
            color: filterStatus === "all" ? c.orange : c.textDim,
            cursor: "pointer",
          }}
        >
          All ({rants.length})
        </button>
        {STATUSES.map(s => {
          const count = rants.filter(r => (r.status || "pending") === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setFilterStatus(s.key)}
              style={{
                background: filterStatus === s.key ? `${s.color()}20` : "transparent",
                border: `1px solid ${filterStatus === s.key ? s.color() : c.border}`,
                borderRadius: terminalRadius.sm, padding: "3px 10px",
                fontFamily: MONO, fontSize: 11,
                color: filterStatus === s.key ? s.color() : c.textDim,
                cursor: "pointer",
              }}
            >
              {s.icon} {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Rant list */}
      {loading ? (
        <div style={{ color: `${terminal.gold}60`, fontSize: 12 }}>Loading rants...</div>
      ) : filteredRants.length === 0 ? (
        <div style={{ color: `${terminal.gold}80`, fontSize: 12 }}>No rants found.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredRants.map(r => {
            const cat = CATEGORIES.find(cc => cc.key === r.category) || CATEGORIES[0];
            const st = STATUSES.find(s => s.key === (r.status || "pending")) || STATUSES[0];
            const hasReply = !!r.admin_note;
            const borderCol = hasReply ? `${terminal.success}30` : `${terminal.gold}12`;
            const bgBase = hasReply ? `${terminal.success}06` : "transparent";
            return (
              <button
                key={r.id}
                onClick={(e) => { e.stopPropagation(); openRant(r); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: `${space[2]}px ${space[3]}px`,
                  width: "100%", border: `1px solid ${borderCol}`,
                  borderRadius: terminalRadius.md, background: bgBase,
                  cursor: "pointer", fontFamily: MONO, fontSize: 12,
                  color: c.text, textAlign: "left",
                  transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
                  ...(hasReply ? { borderLeft: `3px solid ${terminal.success}50` } : {}),
                }}
                onMouseEnter={e => { e.currentTarget.style.background = hasReply ? `${terminal.success}12` : `${terminal.gold}10`; e.currentTarget.style.borderColor = hasReply ? `${terminal.success}50` : `${terminal.gold}30`; }}
                onMouseLeave={e => { e.currentTarget.style.background = bgBase; e.currentTarget.style.borderColor = borderCol; }}
              >
                <span style={{ fontSize: 11, color: st.color(), minWidth: 20, textAlign: "center" }}>{st.icon}</span>
                <span style={{ fontSize: 12, color: cat.color(), minWidth: 14 }}>{cat.icon}</span>
                <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.title}
                </span>
                {hasReply && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.green, padding: "2px 6px", background: `${terminal.success}15`, border: `1px solid ${terminal.success}30`, borderRadius: terminalRadius.xs }}>✓ REPLIED</span>
                )}
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", minWidth: 50, textAlign: "right" }}>{timeAgo(r.created_at)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── ACTIVITY LOG ADMIN ─────────────────────────────── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: c.orange, letterSpacing: "0.1em", marginBottom: space[3], marginTop: space[6] }}>
        ---- ACTIVITY LOG ADMIN ----
      </div>

      {!logLoaded ? (
        <button
          onClick={fetchLogs}
          disabled={logLoading}
          style={{
            background: "transparent", border: `1px solid ${terminal.gold}30`,
            borderRadius: terminalRadius.sm, padding: "8px 20px",
            fontFamily: MONO, fontSize: 12, color: c.orange,
            cursor: logLoading ? "wait" : "pointer",
            transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${terminal.gold}10`; e.currentTarget.style.borderColor = c.orange; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${terminal.gold}30`; }}
        >
          {logLoading ? "Loading..." : "Load Activity Logs"}
        </button>
      ) : (
        <div>
          {/* Filters + Actions bar */}
          <div style={{ display: "flex", gap: 8, marginBottom: space[3], flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={logFilterUser}
              aria-label="Filter logs by user"
              onChange={e => { setLogFilterUser(e.target.value); setLogSelected(new Set()); }}
              style={{
                padding: "5px 24px 5px 8px", fontSize: 11, fontFamily: MONO,
                background: c.bg, border: `1px solid ${terminal.gold}25`, borderRadius: terminalRadius.sm,
                color: c.text, outline: "none", cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23FBBF24' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
              }}
            >
              <option value="" style={{ background: c.bg }}>All users</option>
              {logUniqueUsers.map(u => <option key={u} value={u} style={{ background: c.bg }}>{u}</option>)}
            </select>

            <select
              value={logFilterAction}
              aria-label="Filter logs by action"
              onChange={e => { setLogFilterAction(e.target.value); setLogSelected(new Set()); }}
              style={{
                padding: "5px 24px 5px 8px", fontSize: 11, fontFamily: MONO,
                background: c.bg, border: `1px solid ${terminal.gold}25`, borderRadius: terminalRadius.sm,
                color: c.text, outline: "none", cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23FBBF24' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
              }}
            >
              <option value="" style={{ background: c.bg }}>All actions</option>
              {logUniqueActions.map(a => <option key={a} value={a} style={{ background: c.bg }}>{a}</option>)}
            </select>

            {(logFilterUser || logFilterAction) && (
              <button
                onClick={() => { setLogFilterUser(""); setLogFilterAction(""); setLogSelected(new Set()); }}
                style={{
                  padding: "5px 10px", fontSize: 11, fontFamily: MONO,
                  background: "transparent", border: `1px solid ${terminal.gold}20`, borderRadius: terminalRadius.sm,
                  color: `${terminal.gold}80`, cursor: "pointer",
                }}
              >Clear</button>
            )}

            <span style={{ fontSize: 11, color: `${terminal.gold}50`, fontFamily: MONO, marginLeft: "auto" }}>
              {filteredLogs.length} entries
            </span>
          </div>

          {/* Select all + delete bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: space[2],
            padding: `${space[1]}px ${space[2]}px`,
            background: logSelected.size > 0 ? `${terminal.gold}08` : "transparent",
            border: `1px solid ${logSelected.size > 0 ? `${terminal.gold}25` : "transparent"}`,
            borderRadius: terminalRadius.sm, transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontFamily: MONO, color: `${terminal.gold}80` }}>
              <input
                type="checkbox"
                checked={filteredLogs.length > 0 && logSelected.size === filteredLogs.length}
                onChange={toggleSelectAll}
                style={{ accentColor: c.orange, cursor: "pointer" }}
              />
              Select all
            </label>

            {logSelected.size > 0 && (
              <>
                <span style={{ fontSize: 11, fontFamily: MONO, color: c.orange }}>
                  {logSelected.size} selected
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {!logConfirm ? (
                    <button
                      onClick={() => setLogConfirm(true)}
                      style={{
                        padding: "4px 14px", fontSize: 11, fontFamily: MONO, fontWeight: 700,
                        background: `${terminal.red}15`, border: `1px solid ${terminal.red}40`, borderRadius: terminalRadius.sm,
                        color: c.red, cursor: "pointer", transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${terminal.red}25`; e.currentTarget.style.borderColor = c.red; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${terminal.red}15`; e.currentTarget.style.borderColor = `${terminal.red}40`; }}
                    >
                      Delete selected
                    </button>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, fontFamily: MONO, color: c.red }}>Confirm?</span>
                      <button
                        onClick={handleDeleteLogs}
                        disabled={logDeleting}
                        style={{
                          padding: "4px 14px", fontSize: 11, fontFamily: MONO, fontWeight: 700,
                          background: c.red, border: "none", borderRadius: terminalRadius.sm,
                          color: c.text, cursor: logDeleting ? "wait" : "pointer",
                          opacity: logDeleting ? 0.5 : 1,
                        }}
                      >
                        {logDeleting ? "Deleting..." : "Yes, delete"}
                      </button>
                      <button
                        onClick={() => setLogConfirm(false)}
                        style={{
                          padding: "4px 10px", fontSize: 11, fontFamily: MONO,
                          background: "transparent", border: "1px solid rgba(0,0,0,0.12)", borderRadius: terminalRadius.sm,
                          color: "rgba(0,0,0,0.38)", cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Log entries */}
          <div style={{
            border: `1px solid ${terminal.gold}18`, borderRadius: terminalRadius.md,
            background: terminal.surfaceDeep, maxHeight: 400, overflowY: "auto",
            scrollbarWidth: "thin", scrollbarColor: `${terminal.gold}30 transparent`,
          }}>
            {filteredLogs.length === 0 ? (
              <div style={{ padding: space[4], fontSize: 12, color: `${terminal.gold}40`, fontFamily: MONO, textAlign: "center" }}>
                No log entries match filters.
              </div>
            ) : filteredLogs.map(log => {
              const cfg = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
              const isChecked = logSelected.has(log.id);
              return (
                <div
                  key={log.id}
                  onClick={() => toggleLogSelect(log.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 12px", cursor: "pointer",
                    fontFamily: MONO, fontSize: 11,
                    background: isChecked ? `${terminal.gold}10` : "transparent",
                    borderBottom: "1px solid rgba(0,0,0,0.025)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                  onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = "transparent"; }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{ accentColor: c.orange, cursor: "pointer", flexShrink: 0 }}
                  />
                  <span style={{ color: "rgba(0,0,0,0.38)", width: 65, textAlign: "right", flexShrink: 0 }}>
                    {timeAgo(log.created_at)}
                  </span>
                  <span style={{ color: cfg.color(), width: 16, textAlign: "center", flexShrink: 0 }}>
                    {cfg.icon}
                  </span>
                  <span style={{ color: terminal.cyan, minWidth: 100, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}
                    title={log.user_email}>
                    {log.user_name || log.user_email}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: cfg.color(), background: `${cfg.color()}12`,
                    padding: "1px 5px", borderRadius: terminalRadius.xs, flexShrink: 0,
                  }}>
                    {cfg.label}
                  </span>
                  {log.entity_name && (
                    <span style={{ color: "rgba(0,0,0,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.entity_name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Log toast */}
          {logToast && (
            <div style={{
              marginTop: space[2], fontSize: 11, fontFamily: MONO, fontWeight: 700,
              color: logToast.includes("failed") ? c.red : c.green,
              animation: "flow-load-fade-in 0.3s ease-out",
            }}>
              {logToast}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
