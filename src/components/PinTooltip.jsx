// Flow — PinTooltip
// Hover popover shown when pinning a project the viewer doesn't follow and
// isn't a member of. Offers "Follow" (pin + follow) or "Pin anyway" (pin only).
import React from "react";
import { c, typo, space, layout } from "../styles/theme";
import { Btn } from "./shared";

export default function PinTooltip({ onFollow, onPinAnyway, onMouseEnter, onMouseLeave, style }) {
  return (
    <div
      role="dialog"
      aria-label="Follow this project?"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => { e.stopPropagation(); }}
      style={{
        zIndex: 1000,
        width: 224, padding: space[3], boxSizing: "border-box",
        borderRadius: layout.radiusMd,
        background: "#FFFFFF", border: "1px solid #e8e8e8",
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column", gap: space[2],
        cursor: "default", textAlign: "left",
        animation: "flow-load-fade-in 0.12s ease-out",
        ...style,
      }}
    >
      <div style={{ fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 400, color: c.textMid, lineHeight: 1.5 }}>
        You don’t follow this project yet. Follow it to get updates?
      </div>
      <div style={{ display: "flex", gap: space[2] }}>
        <Btn variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onFollow(); }}>Follow</Btn>
        <Btn variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onPinAnyway(); }}>Pin anyway</Btn>
      </div>
    </div>
  );
}
