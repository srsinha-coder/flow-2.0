// Flow — PinButton
// Pin/unpin a project. When pinning a project the viewer neither follows nor is
// a member of, hovering reveals PinTooltip (Follow / Pin anyway). Otherwise it
// pins/unpins directly. The tooltip renders in a portal (fixed position) so it
// never gets clipped by the project table's scroll container.
import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { c, motion } from "../styles/theme";
import PinTooltip from "./PinTooltip";
import { shouldShowPinTooltip } from "../lib/projectSortUtils";

const TOOLTIP_W = 224;
const TOOLTIP_H = 110; // approx, for bottom-edge flip

export default function PinButton({
  isPinned, isTeamMember = false, isFollowing = false,
  rowHovered = false, onPin, onUnpin,
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const closeTimer = useRef(null);
  const eligible = !isPinned && shouldShowPinTooltip({ isTeamMember, isFollowing });

  const open = useCallback(() => {
    clearTimeout(closeTimer.current);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const flipUp = r.bottom + 6 + TOOLTIP_H > window.innerHeight;
      const left = Math.min(r.left, window.innerWidth - TOOLTIP_W - 12);
      setPos({ left, top: flipUp ? r.top - 6 - TOOLTIP_H : r.bottom + 6 });
    }
    setHover(true);
  }, []);
  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(false), 120);
  }, []);

  const handleClick = (e) => {
    e.stopPropagation(); e.preventDefault();
    if (isPinned) { onUnpin(); return; }
    // Member / already-following → pin silently. Eligible → pin anyway (the
    // tooltip offers Follow as the richer choice on hover).
    onPin(false);
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
      onMouseEnter={eligible ? open : undefined}
      onMouseLeave={eligible ? close : undefined}
    >
      <button
        ref={btnRef}
        type="button"
        title={isPinned ? "Unpin from watchlist" : "Pin to watchlist"}
        aria-pressed={isPinned}
        onClick={handleClick}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 12, lineHeight: 1,
          opacity: isPinned ? 1 : (rowHovered || hover) ? 0.55 : 0,
          color: isPinned ? c.accent : c.textDim,
          transition: `opacity ${motion.fast.duration} ${motion.fast.easing}`,
        }}
      >📌</button>

      {eligible && hover && pos && createPortal(
        <PinTooltip
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          onMouseEnter={open}
          onMouseLeave={close}
          onFollow={() => { onPin(true); setHover(false); }}
          onPinAnyway={() => { onPin(false); setHover(false); }}
        />,
        document.body
      )}
    </span>
  );
}
