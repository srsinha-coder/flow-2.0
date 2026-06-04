import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { c, typo, layout, space, motion } from "../styles/theme";
import { getActiveTracks } from "../lib/tracks";
import { allTagsWithCounts } from "../lib/tags";
import useDevLabel from "../hooks/useDevLabel";
import { initialsOf } from "../lib/names";

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL SEARCH — F / Cmd+K
// Steel & Orange palette. Neutral surfaces + single orange accent.
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = [
  { key: "all",      label: "All",      icon: "◎" },
  { key: "projects", label: "Projects", icon: "◆" },
  { key: "tags",     label: "Tags",     icon: "#" },
  { key: "people",   label: "People",   icon: "●" },
];

const SECTION_ORDER = ["Projects", "Tags", "People"];

function scoreMatch(query, text) {
  if (!text) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  return 0;
}

function multiWordMatch(query, ...fields) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 100;
  const combined = fields.filter(Boolean).join(" ").toLowerCase();
  let total = 0;
  for (const w of words) {
    if (!combined.includes(w)) return 0;
    total += combined.startsWith(w) ? 80 : 60;
  }
  return total / words.length;
}


const CommandPalette = ({ open, onClose, onTabSwitch, projects, people, onNavigate, onApplyTagFilter }) => {
  const devRef = useDevLabel("CommandPalette", "src/components/CommandPalette.jsx", "Universal search palette triggered by Cmd+K for projects, people, and navigation");
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [category, setCategory] = useState("all");
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setCategory("all");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build full command list
  const commands = useMemo(() => {
    const cmds = [];

    // ── Projects (ALL) ──
    if (projects) {
      projects.forEach(p => {
        cmds.push({
          id: `proj-${p.id}`,
          label: `${p.id} — ${p.name}`,
          hint: `${p.squad || "No squad"} · ${p.owner || "No owner"} · ${p.status === "shipped" ? "Shipped" : p.status === "upcoming" ? "Upcoming" : getActiveTracks(p).join(", ") || p.phase || ""}`,
          section: "Projects",
          cat: "projects",
          icon: p.id.slice(0, 3),
          action: () => { if (onNavigate) onNavigate("projects", p.id); onClose(); },
        });
      });
    }

    // ── Tags (ALL canonical) — tapping applies the tag as a list filter ──
    allTagsWithCounts(projects).forEach(({ tag, count }) => {
      cmds.push({
        id: `tag-${tag}`,
        label: tag,
        hint: `${count} project${count === 1 ? "" : "s"}`,
        section: "Tags",
        cat: "tags",
        icon: "#",
        action: () => { if (onApplyTagFilter) onApplyTagFilter(tag); onClose(); },
      });
    });

    // ── People (ALL) ──
    if (people) {
      people.forEach(p => {
        cmds.push({
          id: `person-${p.name}`,
          label: p.name,
          hint: `${p.role || "No role"} · ${p.squad || "No squad"}`,
          section: "People",
          cat: "people",
          icon: initialsOf(p.name),
          action: () => { if (onNavigate) onNavigate("people", p.name); onClose(); },
        });
      });
    }

    return cmds;
  }, [projects, people, onNavigate, onApplyTagFilter, onClose]);

  // Filter + rank
  const filtered = useMemo(() => {
    let pool = commands;
    if (category !== "all") {
      pool = pool.filter(cmd => cmd.cat === category);
    }
    if (query.trim()) {
      pool = pool
        .map(cmd => ({
          ...cmd,
          _score: Math.max(
            multiWordMatch(query, cmd.label, cmd.hint),
            scoreMatch(query, cmd.section),
          ),
        }))
        .filter(cmd => cmd._score > 0)
        .sort((a, b) => b._score - a._score);
    }
    return pool.slice(0, 24);
  }, [query, commands, category]);

  useEffect(() => { setActiveIdx(0); }, [filtered.length, query, category]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Keyboard
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIdx]) filtered[activeIdx].action();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const idx = CATEGORIES.findIndex(cat => cat.key === category);
      const next = e.shiftKey
        ? (idx - 1 + CATEGORIES.length) % CATEGORIES.length
        : (idx + 1) % CATEGORIES.length;
      setCategory(CATEGORIES[next].key);
    }
  }, [filtered, activeIdx, onClose, category]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  // Group by section for display
  const sections = [];
  let currentSection = null;
  const sectionOrder = [...SECTION_ORDER];
  const ordered = [...filtered].sort((a, b) => {
    const ai = sectionOrder.indexOf(a.section);
    const bi = sectionOrder.indexOf(b.section);
    if (ai !== bi) return ai - bi;
    return 0;
  });

  let globalIdx = 0;
  ordered.forEach((cmd) => {
    if (cmd.section !== currentSection) {
      currentSection = cmd.section;
      sections.push({ type: "header", label: currentSection });
    }
    sections.push({ type: "item", cmd, idx: globalIdx });
    globalIdx++;
  });

  const trans = `background ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}`;

  return (
    <div ref={devRef} className="flow-cmd-overlay" onClick={onClose}>
      <div
        className="flow-cmd-box"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={e => e.stopPropagation()}
        style={{
          width: 600,
          maxHeight: 540,
          background: c.surfaceSolid,
          border: `1px solid ${c.border}`,
          borderRadius: layout.radiusLg,
          boxShadow: c.shadowElevated,
        }}
      >

        {/* ── Static 2px accent top bar ── */}
        <div className="flow-cmd-topbar" style={{ height: 2, background: c.accent }} />

        {/* ── Search input ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: space[3],
          padding: `${space[4]}px ${space[5]}px ${space[4] - 2}px`,
        }}>
          {/* Neutral search glyph */}
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            color: c.textDim,
          }}>
            <span style={{
              fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size,
              lineHeight: 1, color: query ? c.accent : c.textDim,
            }}>
              {query ? "◉" : "⊙"}
            </span>
          </div>

          <input
            ref={inputRef}
            className="flow-cmd-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tags, people..."
            style={{
              flex: 1, padding: 0, border: "none", background: "transparent",
              fontFamily: typo.bodyLg.font, fontSize: typo.bodyLg.size, fontWeight: 500,
              color: c.text, outline: "none", lineHeight: 1.4,
            }}
          />
          <span style={{
            fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
            fontWeight: 700, letterSpacing: typo.monoSm.tracking,
            color: c.textDim, background: c.surfaceAlt,
            border: `1px solid ${c.border}`, padding: "2px 7px",
            borderRadius: layout.radiusXs,
            flexShrink: 0,
          }}>ESC</span>
        </div>

        {/* ── Divider (neutral) ── */}
        <div style={{
          height: 1, margin: `0 ${space[5]}px`,
          background: c.border,
        }} />

        {/* ── Category pills ── */}
        <div style={{
          display: "flex", gap: space[1], padding: `${space[3] - 2}px ${space[5]}px`,
        }}>
          {CATEGORIES.map(cat => {
            const active = category === cat.key;
            return (
              <button key={cat.key} onClick={() => setCategory(cat.key)}
                className="flow-cmd-category-pill"
                style={{
                  padding: `${space[1]}px ${space[3]}px`,
                  borderRadius: layout.radiusSm,
                  cursor: "pointer",
                  border: active ? `1px solid ${c.accent}30` : `1px solid ${c.border}`,
                  background: active ? c.accentDim : c.surfaceAlt,
                  fontFamily: typo.monoSm.font,
                  fontSize: typo.monoSm.size,
                  fontWeight: 700,
                  letterSpacing: typo.monoSm.tracking,
                  textTransform: "uppercase",
                  color: active ? c.accent : c.textMid,
                  transition: trans,
                  position: "relative",
                }}>
                <span style={{
                  marginRight: 5,
                  opacity: active ? 1 : 0.7,
                }}>{cat.icon}</span>
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ── Divider (neutral) ── */}
        <div style={{
          height: 1, margin: `0 ${space[5]}px`,
          background: c.border,
        }} />

        {/* ── Results ── */}
        <div ref={listRef} className="flow-cmd-results" style={{
          overflowY: "auto", maxHeight: 370, padding: `${space[2]}px 0`,
        }}>
          {sections.length === 0 && (
            <div style={{
              padding: `${space[8]}px ${space[5]}px`, textAlign: "center",
              fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.textDim,
            }}>
              <div style={{ fontSize: 24, marginBottom: space[2], opacity: 0.3 }}>⊘</div>
              {query.trim() ? <>No results for &ldquo;{query}&rdquo;</> : "No items in this category"}
            </div>
          )}
          {sections.map((entry) => {
            if (entry.type === "header") {
              return (
                <div key={`hdr-${entry.label}`} className="flow-cmd-section-header" style={{
                  padding: `${space[3]}px ${space[5]}px 4px`,
                  display: "flex", alignItems: "center", gap: space[2],
                }}>
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    fontWeight: 700, letterSpacing: "0.1em",
                    color: c.textDim, textTransform: "uppercase",
                  }}>{entry.label}</span>
                  <div style={{
                    flex: 1, height: 1,
                    background: c.border,
                  }} />
                </div>
              );
            }

            const { cmd, idx } = entry;
            const isActive = idx === activeIdx;

            return (
              <div
                key={cmd.id}
                data-active={isActive ? "true" : undefined}
                className={`flow-cmd-item${isActive ? " flow-cmd-active" : ""}`}
                onClick={cmd.action}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: "flex", alignItems: "center", gap: space[3],
                  padding: `12px ${space[4]}px`,
                  cursor: "pointer",
                  background: isActive ? "rgba(0,0,0,0.03)" : "transparent",
                  borderLeft: isActive ? `2px solid ${c.accent}` : "2px solid transparent",
                  transition: trans,
                  position: "relative",
                }}
              >
                {/* Icon badge — neutral inset, mono */}
                <div style={{
                  width: 28, height: 28, borderRadius: layout.radiusSm,
                  background: c.surfaceAlt,
                  border: `1px solid ${c.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                  fontWeight: 700,
                  letterSpacing: typo.monoSm.tracking,
                  color: isActive ? c.accent : c.textMid,
                  flexShrink: 0,
                  transition: trans,
                }}>{cmd.icon}</div>

                {/* Label + hint */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
                    fontWeight: 500,
                    color: isActive ? c.text : c.textMid,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    lineHeight: 1.3,
                  }}>{cmd.label}</div>
                  {cmd.hint && (
                    <div style={{
                      fontFamily: typo.bodyXs.font, fontSize: typo.bodyXs.size,
                      fontWeight: 500,
                      color: c.textDim,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      lineHeight: 1.3, marginTop: 2,
                    }}>{cmd.hint}</div>
                  )}
                </div>

                {/* Keyboard shortcut badge */}
                {cmd.kbd && (
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    fontWeight: 700, letterSpacing: typo.monoSm.tracking,
                    color: c.textDim,
                    background: c.surfaceAlt,
                    border: `1px solid ${c.border}`,
                    padding: `2px ${space[2] - 2}px`, borderRadius: layout.radiusXs,
                    flexShrink: 0, lineHeight: 1.4,
                    transition: trans,
                  }}>{cmd.kbd}</span>
                )}

                {/* Enter indicator */}
                {isActive && (
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                    color: c.accent, flexShrink: 0,
                  }}>↵</span>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};


export default CommandPalette;
