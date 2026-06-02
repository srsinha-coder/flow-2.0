import React from "react";
import ReactDOM from "react-dom";
import { c, typo, layout, space, motion, btnVariants, entityColors } from "../styles/theme";
import useDevLabel from "../hooks/useDevLabel";
import useExitAnimation from "../hooks/useExitAnimation";

// ══════════════════════════════════════════════════════════════
// Modal — accessible centered dialog with focus trap
// Props:
//   open: boolean — controls visibility
//   onClose: () => void — called on Escape / backdrop click
//   title?: string — dialog title (sets aria-labelledby)
//   accent?: string — optional colored border (e.g. c.red, c.orange)
//   width?: number — max-width in px (default 460)
//   blur?: number — backdrop blur in px (default 4)
//   children: ReactNode — dialog body content
// ══════════════════════════════════════════════════════════════
export const Modal = ({ open, onClose, title, accent, width = 460, blur = 4, children, style: s }) => {
  const dialogRef = React.useRef(null);
  const previousFocusRef = React.useRef(null);
  const titleId = React.useId ? React.useId() : React.useMemo(() => `modal-title-${Math.random().toString(36).slice(2, 8)}`, []);
  const { mounted, visible } = useExitAnimation(open, 270);

  // Capture focus on open, restore on close
  React.useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    // Focus first focusable element or the dialog itself
    const timer = setTimeout(() => {
      if (!dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const autoFocused = dialogRef.current.querySelector('[autofocus], [data-autofocus]');
      if (autoFocused) autoFocused.focus();
      else if (focusable.length) focusable[0].focus();
      else dialogRef.current.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, [open]);

  // Restore focus on close
  React.useEffect(() => {
    if (open) return;
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Escape key
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Lock background scroll while the modal is open — otherwise scrolling
  // the mouse wheel over the backdrop moves the page behind it, which
  // feels broken when the modal's own list is meant to be the scrollable
  // surface. Preserves whatever the host page had set.
  React.useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // Focus trap
  React.useEffect(() => {
    if (!open || !dialogRef.current) return;
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: blur ? `blur(${blur}px)` : undefined,
          WebkitBackdropFilter: blur ? `blur(${blur}px)` : undefined,
          animation: `${visible ? "fadeIn" : "fadeOut"} ${motion.normal.duration} ${motion.normal.easing} both`,
        }}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{
          position: "relative", zIndex: 1, outline: "none",
          background: c.surfaceSolid || "#FFFFFF",
          border: accent ? `1px solid ${accent}40` : `1px solid ${c.border}`,
          borderLeft: accent ? `3px solid ${accent}` : undefined,
          borderRadius: layout.radiusLg,
          padding: `${space[6]}px`,
          width: "100%", maxWidth: `min(${width}px, calc(100vw - ${space[4] * 2}px))`,
          boxShadow: c.shadowElevated || c.shadowOverlay,
          animation: `${visible ? "fadeScaleIn" : "fadeScaleOut"} ${motion.normal.duration} ${motion.normal.easing} both`,
          ...s,
        }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div
            id={titleId}
            style={{
              fontFamily: typo.displayMd.font, fontSize: typo.displayMd.size,
              fontWeight: typo.displayMd.weight, color: c.text, marginBottom: space[2],
            }}
          >{title}</div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

// ══════════════════════════════════════════════════════════════
// Badge — semantic color pill (uppercase, rounded)
// Use for: status labels, outcome markers, role indicators
// ══════════════════════════════════════════════════════════════
export const Badge = ({ color, bg, children, style: s }) => (
  <span style={{
    fontSize: typo.badge.size, fontFamily: typo.badge.font, fontWeight: typo.badge.weight,
    letterSpacing: typo.badge.tracking, lineHeight: typo.badge.lineHeight,
    color, background: bg, padding: `3px ${space[3] - 2}px`,
    borderRadius: layout.radiusXs, ...s,
  }}>{children}</span>
);

// ══════════════════════════════════════════════════════════════
// Tag — compact mono tag (small, tight, for inline metadata)
// Use for: type indicators, phase labels, quality flags, counts
// ══════════════════════════════════════════════════════════════
export const Tag = ({ color, bg, children, uppercase = true, style: s, className }) => (
  <span className={className} style={{
    fontSize: typo.tag.size, fontFamily: typo.tag.font, fontWeight: typo.tag.weight,
    letterSpacing: typo.tag.tracking, lineHeight: typo.tag.lineHeight,
    textTransform: uppercase ? "uppercase" : "none",
    color, background: bg, padding: `3px ${space[2]}px`,
    borderRadius: layout.radiusXs, ...s,
  }}>{children}</span>
);

// ══════════════════════════════════════════════════════════════
// Surface — standard container
// variant: "panel" (default) | "data" | "hero" | "overlay"
// accent?: color string for colored left border
// ══════════════════════════════════════════════════════════════
const SURFACE_BG = {
  panel:   () => c.surface,
  data:    () => c.surfaceData,
  hero:    () => c.surfaceHero,
  overlay: () => c.surfaceOverlay,
};

export const Surface = ({ children, style: s, accent, className = "", compact = false, variant = "panel", id }) => {
  const devRef = useDevLabel('Container panel with variant backgrounds and optional accent border');
  const bgFn = SURFACE_BG[variant] || SURFACE_BG.panel;
  // Steel & Orange: every card on the page canvas gets shadowCard so it
  // reads as a white panel floating on aluminum. Overlays/heroes escalate.
  const shadow =
    variant === "overlay" ? (c.shadowElevated || c.shadowOverlay) :
    variant === "hero"    ? (c.shadowCard    || c.shadowHero) :
                            (c.shadowCard    || "none");
  return (
    <div ref={devRef} id={id} className={`flow-card ${className}`} style={{
      background: bgFn(),
      border: `1px solid ${c.border}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${c.border}`,
      borderRadius: layout.radiusLg,
      overflow: "clip",
      padding: compact ? layout.padCompact : layout.padCard,
      boxShadow: shadow,
      ...s,
    }}>{children}</div>
  );
};

// ══════════════════════════════════════════════════════════════
// Glass — LEGACY alias → Surface. Kept for import compatibility.
// Blur is removed everywhere. Use Surface for new code.
// ══════════════════════════════════════════════════════════════
export const Glass = ({ children, style: s, className = "", dataMode = false }) => (
  <Surface compact={dataMode} variant={dataMode ? "data" : "panel"} style={s} className={className}>{children}</Surface>
);

// ══════════════════════════════════════════════════════════════
// Card — alias for Surface with variant support
// ══════════════════════════════════════════════════════════════
export const Card = ({ children, style: s, dataMode = false, accent, variant }) => (
  <Surface compact={dataMode} accent={accent} variant={variant || (dataMode ? "data" : "panel")} style={s}>{children}</Surface>
);

// ══════════════════════════════════════════════════════════════
// Label — section header with accent bar (uses displaySm)
// ══════════════════════════════════════════════════════════════
export const Label = ({ children, style: s }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: space[2],
    fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size,
    fontWeight: typo.displaySm.weight, letterSpacing: typo.displaySm.tracking,
    lineHeight: typo.displaySm.lineHeight,
    color: c.text, marginBottom: space[3], ...s,
  }}>
    <div style={{ width: 3, height: space[4], borderRadius: 2, background: c.accent }} />
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════
// Btn — system button with variant support
// variant: "primary" | "secondary" | "ghost" | "danger" | "command"
// size: "default" | "sm"
// ══════════════════════════════════════════════════════════════
export const Btn = ({ children, variant = "secondary", size = "default", style: s, ...rest }) => {
  const devRef = useDevLabel('System button with primary, secondary, ghost, danger, command variants');
  const v = (btnVariants() || {})[variant] || btnVariants().secondary;
  const isSm = size === "sm";
  return (
    <button ref={devRef} {...rest} className="flow-btn" style={{
      padding: isSm ? `5px ${space[3]}px` : `7px ${space[4]}px`,
      borderRadius: layout.radiusSm,
      border: v.border,
      background: v.bg,
      color: v.color,
      fontFamily: typo.bodyMd.font,
      fontSize: 13,
      fontWeight: 600,
      cursor: rest.disabled ? "default" : "pointer",
      opacity: rest.disabled ? 0.4 : 1,
      transition: `background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}, box-shadow ${motion.fast.duration} ${motion.fast.easing}, filter ${motion.fast.duration} ${motion.fast.easing}, opacity ${motion.fast.duration} ${motion.fast.easing}, color ${motion.fast.duration} ${motion.fast.easing}`,
      boxSizing: "border-box",
      display: "inline-flex", alignItems: "center", gap: space[2],
      ...s,
    }}>{children}</button>
  );
};

// ══════════════════════════════════════════════════════════════
// Inp — text input (38–42px height per spec)
// ══════════════════════════════════════════════════════════════
export const Inp = React.forwardRef(({ style: s, ...rest }, ref) => (
  <input ref={ref} {...rest} className="flow-input" style={{
    height: 40, padding: `0 ${space[4] - 2}px`,
    borderRadius: layout.radiusSm,
    border: `1px solid ${c.border}`, background: c.surfaceAlt,
    color: c.text, fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
    outline: "none", boxSizing: "border-box",
    transition: `border-color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}`,
    ...s,
  }} />
));
Inp.displayName = "Inp";

// ══════════════════════════════════════════════════════════════
// TextArea — multi-line text input (matches Inp styling)
// Use for: deliverable descriptions, notes, any multi-line entry
// ══════════════════════════════════════════════════════════════
export const TextArea = ({ style: s, ...rest }) => (
  <textarea {...rest} className="flow-input" style={{
    width: "100%", padding: `${space[2]}px ${space[3]}px`,
    borderRadius: layout.radiusSm,
    border: `1px solid ${c.border}`, background: c.surfaceAlt,
    color: c.text, fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
    fontWeight: typo.bodyMd.weight, lineHeight: typo.bodyMd.lineHeight,
    outline: "none", boxSizing: "border-box",
    resize: "vertical", minHeight: 72,
    transition: `border-color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}`,
    ...s,
  }} />
);

// ══════════════════════════════════════════════════════════════
// ChoiceGroup — single-select toggle button group
// Use for: stage, type, duration pickers in Commit cards
// mono: true → uses monoMd tokens (for type codes); false → bodySm (for labels)
// ══════════════════════════════════════════════════════════════
export const ChoiceGroup = ({ options, value, onChange, mono = false, label }) => {
  const devRef = useDevLabel('Single-select toggle button group for stage and type pickers');
  const font = mono ? typo.monoMd : typo.bodySm;
  // ARIA radiogroup: each option is a role="radio", one is aria-checked.
  // Keyboard: ← ↑ Home go to prev / first; → ↓ End go to next / last.
  // Selection moves WITH focus (per WAI-ARIA radio-group pattern).
  const onKey = (e, idx) => {
    const last = options.length - 1;
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = idx === last ? 0 : idx + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = idx === 0 ? last : idx - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next !== null) {
      e.preventDefault();
      onChange(options[next].value);
      // Focus moves too so the keyboard user can keep nav-ing.
      const buttons = e.currentTarget.parentElement.querySelectorAll('[role="radio"]');
      buttons[next]?.focus();
    }
  };
  return (
    <div ref={devRef} role="radiogroup" aria-label={label} style={{ display: "flex", gap: space[1], flexWrap: "wrap" }}>
      {options.map((opt, idx) => {
        const active = value === opt.value;
        const clr = opt.color || c.accent;
        return (
          <button key={opt.value}
            role="radio"
            aria-checked={active}
            // Roving tabindex: only the selected (or first, if none selected) is tabbable.
            tabIndex={active || (value == null && idx === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKey(e, idx)}
            className="flow-btn" style={{
            padding: `${space[1] + 1}px ${space[3] - 2}px`, borderRadius: layout.radiusSm,
            border: `1px solid ${active ? clr + "40" : c.border}`,
            background: active ? (opt.bg || clr + "12") : "transparent",
            color: active ? clr : c.textDim,
            fontFamily: font.font, fontSize: font.size, fontWeight: mono ? font.weight : 600,
            letterSpacing: font.tracking || "0",
            cursor: "pointer",
            transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
          }}>{opt.label}</button>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// Sel — select dropdown (matches Inp height)
// ══════════════════════════════════════════════════════════════
const selChevron = `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='4 6 8 10 12 6' stroke='%23999999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
export { selChevron };
export const Sel = ({ children, style: s, ...rest }) => (
  <select {...rest} className="flow-input" style={{
    height: 40, padding: `0 ${space[3] + 20}px 0 ${space[3]}px`,
    borderRadius: layout.radiusSm,
    border: `1px solid ${c.border}`, background: `${c.surfaceSolid} ${selChevron} no-repeat right ${space[3]}px center / 12px 12px`,
    color: c.text, fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
    cursor: "pointer", appearance: "none", WebkitAppearance: "none",
    boxSizing: "border-box",
    transition: `border-color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}`,
    ...s,
  }}>{children}</select>
);

// ══════════════════════════════════════════════════════════════
// SearchSelect — filterable dropdown with keyboard nav
// ══════════════════════════════════════════════════════════════
export const SearchSelect = ({ value, onChange, options, placeholder = "Search..." }) => {
  const devRef = useDevLabel('Filterable dropdown with keyboard navigation and portal menu');
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [focusIdx, setFocusIdx] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const dropdownRef = React.useRef(null);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  React.useEffect(() => { setFocusIdx(0); }, [query]);
  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (val) => { onChange(val); setOpen(false); setQuery(""); };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && filtered[focusIdx]) { e.preventDefault(); select(filtered[focusIdx]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  // Scroll active item into view
  React.useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[focusIdx];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [focusIdx]);

  // Calculate dropdown position relative to viewport
  const [dropPos, setDropPos] = React.useState({ top: 0, left: 0, width: 0 });
  React.useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [open]);

  return (
    <div ref={(el) => { containerRef.current = el; if (devRef) devRef.current = el; }} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} className="flow-input" style={{
        width: "100%", height: 40, padding: `0 ${space[3]}px`,
        borderRadius: layout.radiusSm,
        border: `1px solid ${open ? c.accent : c.border}`, background: c.surfaceSolid,
        color: c.text, fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
        cursor: "pointer", textAlign: "left", boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: `border-color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}`,
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={c.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: space[2], transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: `transform ${motion.fast.duration} ${motion.fast.easing}` }}>
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>
      {open && ReactDOM.createPortal(
        <div ref={dropdownRef} style={{
          position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          background: c.surfaceSolid, border: `1px solid ${c.border}`,
          borderRadius: layout.radiusMd, boxShadow: c.shadowFloat,
          zIndex: 10000, maxHeight: 240, display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: `${space[2]}px ${space[2]}px 0` }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={{
                width: "100%", padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusTag + 2,
                border: `1px solid ${c.border}`, background: c.bg,
                color: c.text, fontFamily: typo.bodyMd.font, fontSize: typo.bodySm.size,
                outline: "none", boxSizing: "border-box",
              }} />
          </div>
          <div ref={listRef} style={{ overflowY: "auto", padding: `${space[1]}px 0`, flex: 1 }}>
            {filtered.length === 0 && (
              <div style={{ padding: `${space[3]}px ${space[4]}px`, fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textDim, textAlign: "center" }}>No matches</div>
            )}
            {filtered.map((opt, i) => (
              <div key={opt} onClick={() => select(opt)}
                onMouseEnter={() => setFocusIdx(i)}
                style={{
                  padding: `${space[2]}px ${space[4]}px`, cursor: "pointer",
                  background: i === focusIdx ? c.accentDim : opt === value ? `${c.accent}08` : "transparent",
                  fontFamily: typo.bodyMd.font, fontSize: typo.bodySm.size,
                  color: opt === value ? c.accent : c.text,
                  fontWeight: opt === value ? 600 : 400,
                  transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}`,
                }}>{opt}</div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// EmptyState — with explicit next-action
// ══════════════════════════════════════════════════════════════
export const EmptyState = ({ icon = "📭", title, message, action, onAction }) => {
  const devRef = useDevLabel('Empty state placeholder with icon, message, and action button');
  return (
    <div ref={devRef} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: `${space[8]}px ${space[5]}px`,
      borderRadius: layout.radiusLg, border: `1px dashed ${c.border}`,
      background: c.surface, textAlign: "center",
      maxWidth: 420, margin: "0 auto",
    }}>
      <span style={{ fontSize: 32, marginBottom: space[3], color: c.textGhost || c.textDim, opacity: 0.8 }}>{icon}</span>
      <div style={{
        fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size,
        fontWeight: typo.displaySm.weight, color: c.text, marginBottom: space[2],
      }}>{title}</div>
      <div style={{
        fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
        color: c.textDim, maxWidth: 320, lineHeight: 1.5,
        marginBottom: action ? space[4] : 0,
      }}>{message}</div>
      {action && onAction && (
        <Btn variant="command" size="sm" onClick={onAction}>{action}</Btn>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// KbdHint — inline keyboard shortcut hint
// ══════════════════════════════════════════════════════════════
export const KbdHint = ({ keys, label, style: s }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 3,
    fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size,
    letterSpacing: typo.monoMd.tracking,
    color: c.textMid, ...s,
  }}>
    {keys.map((k, i) => (
      <span key={i} style={{
        background: c.surfaceAlt, border: `1px solid ${c.border}`,
        padding: "1px 5px", borderRadius: layout.radiusTag,
        fontSize: typo.monoMd.size, fontWeight: 600, lineHeight: 1.4,
        boxShadow: `0 1px 0 ${c.border}`,
      }}>{k}</span>
    ))}
    {label && <span style={{ marginLeft: 2 }}>{label}</span>}
  </span>
);

// ══════════════════════════════════════════════════════════════
// FilterChip — active filter indicator (distinct from Badge)
// ══════════════════════════════════════════════════════════════
export const FilterChip = ({ label, active = true, onClick, style: s }) => (
  <span onClick={onClick} style={{
    fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size,
    fontWeight: typo.monoMd.weight, letterSpacing: typo.monoMd.tracking,
    color: active ? c.accent : c.textMid,
    background: active ? c.accentDim : c.surfaceAlt,
    padding: `2px ${space[2]}px`, borderRadius: layout.radiusTag + 1,
    border: active ? `1px solid ${c.accent}25` : `1px solid ${c.border}`,
    whiteSpace: "nowrap",
    cursor: onClick ? "pointer" : "default",
    transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
    ...s,
  }}>{label}</span>
);

// ══════════════════════════════════════════════════════════════
// MetricCompact — secondary inline metric (smaller than KPI tiles)
// Use for: supporting metrics in hero strips, summary rails
// Shared across Summary (prev-week diff) and Pulse (commits/blocked/health)
// ══════════════════════════════════════════════════════════════
export const MetricCompact = ({ value, label, color, prevValue, hero }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    padding: `${space[3] - 2}px ${space[2]}px`, minWidth: 48,
  }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{
        fontFamily: typo.displayMd.font, fontSize: typo.displayMd.size,
        fontWeight: typo.displayMd.weight, letterSpacing: typo.displayMd.tracking,
        color, lineHeight: typo.displayMd.lineHeight,
      }}>{value}</span>
      {prevValue !== undefined && <DeltaIndicator value={value - prevValue} />}
    </div>
    <span style={{
      fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
      fontWeight: hero ? 700 : 500, letterSpacing: "0",
      color: hero ? c.text : c.textMid, whiteSpace: "nowrap",
    }}>{label}</span>
  </div>
);

// ══════════════════════════════════════════════════════════════
// DeltaIndicator — directional change indicator (+N / -N)
// Use for: week-over-week deltas, KPI comparisons, scope changes
// Shared across Summary (prev-week diff) and Pulse (scope churn)
// ══════════════════════════════════════════════════════════════
export const DeltaIndicator = ({ value, style: s }) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  const up = n > 0;
  const clr = up ? c.green : c.red;
  return (
    <span style={{
      fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
      fontWeight: 700, color: clr, letterSpacing: typo.monoSm.tracking,
      display: "inline-flex", alignItems: "center", gap: 2,
      marginLeft: space[1], ...s,
    }}>
      <span style={{ fontSize: 11, lineHeight: 1 }} aria-hidden>{up ? "↑" : "↓"}</span>
      <span>{up ? "+" : "−"}{Math.abs(n)}</span>
    </span>
  );
};

// ══════════════════════════════════════════════════════════════
// VDivider — vertical separator for KPI strips and metric rails
// ══════════════════════════════════════════════════════════════
export const VDivider = ({ height = 36, style: s }) => (
  <div style={{
    width: 1, height, background: c.border,
    margin: `0 ${space[2] - 2}px`, flexShrink: 0, ...s,
  }} />
);

// ══════════════════════════════════════════════════════════════
// TelemetryLabel — mono uppercase label for section/field headers
// Use for: telemetry sections, field labels, system metadata headers
// ══════════════════════════════════════════════════════════════
export const TelemetryLabel = ({ children, color, style: s }) => (
  <span style={{
    fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size,
    fontWeight: typo.monoMd.weight, letterSpacing: "0.06em",
    color: color || c.textMid, textTransform: "uppercase", ...s,
  }}>{children}</span>
);

// ══════════════════════════════════════════════════════════════
// StatCell — compact metric cell for hero stat rails
// Use for: Projects command card metrics, People telemetry metrics
// Shared across both deep-dive hero panels
// ══════════════════════════════════════════════════════════════
export const StatCell = ({ value, label, color, highlight, highlightBg, style: s }) => (
  <div style={{
    textAlign: "center", padding: `${space[3]}px ${space[2]}px`,
    borderRadius: layout.radiusMd,
    background: highlight ? (highlightBg || "transparent") : "transparent",
    border: highlight ? `1px solid ${color}20` : "none",
    ...s,
  }}>
    <div style={{
      fontFamily: typo.displayLg.font, fontSize: typo.displayLg.size,
      fontWeight: typo.displayLg.weight, letterSpacing: typo.displayLg.tracking,
      color, lineHeight: typo.displayLg.lineHeight,
    }}>{value}</div>
    <div style={{
      fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
      fontWeight: 500, letterSpacing: "0",
      color: c.textMid, marginTop: space[1] + 2,
    }}>{label}</div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// SectionDivider — structural separator between current and history
// Use for: separating current-week content from historical content
// Shared across Projects (evidence/history) and People (timeline)
// ══════════════════════════════════════════════════════════════
export const SectionDivider = ({ label, count, color, style: s }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: space[2],
    padding: `${space[3]}px 0`, ...s,
  }}>
    <div style={{ flex: 1, height: 1, background: c.border }} />
    <span style={{
      fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
      fontWeight: 600, letterSpacing: "0",
      color: color || c.textMid,
    }}>{label}</span>
    {count !== undefined && (
      <span style={{
        fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size,
        color: c.textMid,
      }}>{count}</span>
    )}
    <div style={{ flex: 1, height: 1, background: c.border }} />
  </div>
);

// ══════════════════════════════════════════════════════════════
// KPIBar — standardized container for KPI summary strips
// Use for: all KPI/stat bars across views (Pulse, Summary, Projects, People)
// Props:
//   children: ReactNode — SummaryTile(s) or KPIBar.Section groups
//   style?: object — override container styles
// ══════════════════════════════════════════════════════════════
export const KPIBar = ({ children, style: s, className }) => {
  const devRef = useDevLabel('Standardized KPI summary bar container');
  // Detect if children include KPIBar.Section — if so, use sectioned layout
  const childArray = React.Children.toArray(children);
  const hasSections = childArray.some(ch => ch.type === KPIBarSection);

  return (
    <div className={`flow-mission-grid${className ? ` ${className}` : ''}`} style={{ padding: `${space[4]}px ${space[5]}px`, ...s }}>
      <div
        ref={devRef}
        style={{
          display: "flex",
          alignItems: "center",
          ...(hasSections
            ? { gap: 0 }
            : { gap: space[2], justifyContent: "center", flexWrap: "wrap" }),
          position: "relative",
          zIndex: 1,
        }}
      >
        {hasSections
          ? childArray.map((child, i) => {
              if (child.type !== KPIBarSection) return child;
              return (
                <React.Fragment key={child.key || i}>
                  {i > 0 && childArray[i - 1]?.type === KPIBarSection && (
                    <VDivider height={32} style={{ margin: `0 ${space[3]}px` }} />
                  )}
                  {child}
                </React.Fragment>
              );
            })
          : children}
      </div>
    </div>
  );
};

// KPIBar.Section — flex group within a sectioned KPI bar
const KPIBarSection = ({ children, flex = 1 }) => (
  <div style={{ flex, display: "flex", alignItems: "center", justifyContent: "center", gap: space[2] }}>
    {children}
  </div>
);
KPIBar.Section = KPIBarSection;

// ══════════════════════════════════════════════════════════════
// SummaryTile — compact inline tile for KPI/status summary strips
// Use for: phase counts, status counts, clickable filter tiles
// Shared across Pulse (phase/ship/no-action) and Commit (locked/ready/partial/empty)
// ══════════════════════════════════════════════════════════════
export const SummaryTile = ({ value, label, color, active, onClick, icon, prevValue, hero, suffix }) => {
  const devRef = useDevLabel('Clickable KPI tile for phase counts and status filters');
  return (
    <div
      ref={devRef}
      onClick={onClick}
      className="flow-glass-tile"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: hero ? space[2] : space[1],
        padding: hero ? `${space[6]}px` : `${space[4]}px ${space[5]}px`, minWidth: 56,
        borderRadius: layout.radiusMd, cursor: onClick ? "pointer" : "default",
        background: active ? `${color}12` : "transparent",
        border: `1px solid ${active ? color + "40" : "transparent"}`,
        transition: `background ${motion.interaction.duration} ${motion.interaction.easing}, border-color ${motion.interaction.duration} ${motion.interaction.easing}, color ${motion.interaction.duration} ${motion.interaction.easing}, box-shadow ${motion.interaction.duration} ${motion.interaction.easing}, transform ${motion.interaction.duration} ${motion.interaction.easing}, opacity ${motion.interaction.duration} ${motion.interaction.easing}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{
          fontFamily: hero ? typo.displayHero.font : typo.displayLg.font,
          fontSize: hero ? typo.displayHero.size : typo.displayLg.size,
          fontWeight: hero ? typo.displayHero.weight : typo.displayLg.weight,
          letterSpacing: hero ? typo.displayHero.tracking : typo.displayLg.tracking,
          color: active ? color : (Number(value) > 0 ? c.text : c.textDim),
          lineHeight: 1.1,
        }}>{value}{suffix || ""}</span>
        {prevValue !== undefined && <DeltaIndicator value={value - prevValue} />}
      </div>
      <span style={{
        fontFamily: hero ? typo.bodyMd.font : typo.bodySm.font,
        fontSize: hero ? typo.bodyMd.size : typo.bodySm.size,
        fontWeight: hero ? 700 : 500, letterSpacing: "0",
        color: hero ? c.text : (active ? color : c.textMid),
        whiteSpace: "nowrap",
      }}>{icon ? `${icon} ` : ""}{label}</span>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// TableShell — shared chrome for registry-style tables
// Wraps a <table> in the standard card (surface + border + radiusLg +
// shadowCard + overflow clip) and provides the inner horizontal-scroll
// container (.flow-hscroll). All three registry tables (Projects, Pulse,
// Commit) use this so sticky header + sticky-left first column behave
// identically everywhere.
// Props: minWidth (default 700), separate (default false → borderCollapse),
//        className (forwarded), style (forwarded to outer card)
// ══════════════════════════════════════════════════════════════
export const TableShell = ({ minWidth = 700, separate = false, className, style: s, children }) => (
  <div
    className={`flow-table-shell${className ? ` ${className}` : ""}`}
    style={{
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: layout.radiusLg,
      boxShadow: c.shadowCard,
      overflow: "clip",
      ...s,
    }}
  >
    {/* Inner wrapper keeps the .flow-hscroll class for the mobile fade hint
        but intentionally does NOT set overflowX — any overflow value would
        make this element the scroll ancestor for sticky headers, breaking
        viewport-sticky pinning. The outer card already clips horizontally. */}
    <div className="flow-hscroll" style={{ borderRadius: layout.radiusLg }}>
      <table style={{
        width: "100%",
        borderCollapse: separate ? "separate" : "collapse",
        borderSpacing: separate ? 0 : undefined,
        minWidth,
      }}>
        {children}
      </table>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// StickyLeftTd — first-column body cell with sticky-left pattern
// Used by all three registry tables to keep the Squad column pinned
// while the rest of the row scrolls horizontally. Caller controls
// the background (must match the row background to prevent bleed).
// Props: bg (required — row's current background), style (forwarded),
//        children, ...rest (forwarded to <td>)
// ══════════════════════════════════════════════════════════════
export const StickyLeftTd = ({ bg, style: s, children, ...rest }) => (
  <td
    {...rest}
    style={{
      position: "sticky", left: 0, background: bg, zIndex: 1,
      ...s,
    }}
  >{children}</td>
);

// ══════════════════════════════════════════════════════════════
// Th — shared sortable table header cell
// Use for: all sortable table headers across Registry, Analytics, Admin tables
// Props: col (sort key), sortKey, sortDir, onSort, children, style
// ══════════════════════════════════════════════════════════════
export const Th = ({ col, sortKey, sortDir, onSort, children, style: s }) => {
  const devRef = useDevLabel('Sortable table header cell shared across registry tables');
  return (
    <th
      ref={devRef}
      className={`flow-th-sticky${onSort ? " flow-sort-th" : ""}`}
      onClick={() => onSort && onSort(col)}
      style={{
        padding: `${space[3]}px ${space[4]}px`, textAlign: "left",
        fontFamily: typo.tableHeader?.font || typo.bodySm.font,
        fontSize: 12, fontWeight: 600,
        letterSpacing: "0.03em", textTransform: "uppercase",
        cursor: onSort ? "pointer" : "default", userSelect: "none",
        borderBottom: `1px solid ${c.borderMedium || c.border}`,
        background: "rgba(232, 232, 232, 0.72)",
        backdropFilter: "blur(16px) saturate(1.3)",
        WebkitBackdropFilter: "blur(16px) saturate(1.3)",
        color: sortKey === col ? c.accent : c.textDim,
        transition: `color ${motion.fast.duration} ${motion.fast.easing}, background ${motion.fast.duration} ${motion.fast.easing}`,
        position: "sticky", top: "var(--flow-sticky-top, 0px)", zIndex: 10,
        whiteSpace: "nowrap", ...s,
      }}
    >{children}{sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</th>
  );
};

// ══════════════════════════════════════════════════════════════
// EntityLink — clickable cross-reference for project or person entities
// Use for: project IDs/names and person names that navigate on click
// type: "project" | "person"
// ══════════════════════════════════════════════════════════════
export const EntityLink = ({ children, type = "project", onClick, underline = false, style: s }) => {
  const ec = entityColors();
  const color = type === "person" ? ec.person : ec.project;
  return (
    <span onClick={onClick} style={{
      color,
      cursor: onClick ? "pointer" : "default",
      textDecoration: underline ? "underline" : "none",
      textDecorationColor: underline ? color + "40" : undefined,
      textUnderlineOffset: underline ? 2 : undefined,
      ...s,
    }}>{children}</span>
  );
};
