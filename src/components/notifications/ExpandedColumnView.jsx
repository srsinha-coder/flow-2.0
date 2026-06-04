// Flow — ExpandedColumnView
// Full-width modal showing the complete list for one In-the-Loop column.
// Smooth fade + Escape + scroll-lock come from the shared Modal primitive.
import React, { useRef } from "react";
import { c, mono, typo, space, layout } from "../../styles/theme";
import { Modal, Btn } from "../shared";
import { NotificationItem } from "./NotificationColumn";

export default function ExpandedColumnView({ open, column, onClose, goProject, onMarkAll, isUnread = () => false }) {
  // Retain the last column so content stays put through the close animation.
  const lastCol = useRef(column);
  if (column) lastCol.current = column;
  const col = column || lastCol.current;
  if (!col) return null;

  return (
    <Modal open={open} onClose={onClose} title={col.title} accent={col.color} width="min(860px, 92vw)">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[3] }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: c.textDim }}>
          {col.items.length} {col.items.length === 1 ? "item" : "items"}
        </span>
        {col.items.length > 0 && (
          <Btn variant="ghost" size="sm" onClick={onMarkAll}>Mark all read</Btn>
        )}
      </div>

      <div style={{
        maxHeight: "60vh", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: space[2],
        paddingRight: space[1],
      }}>
        {col.items.length === 0 ? (
          <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.textDim, fontStyle: "italic", padding: space[4], textAlign: "center" }}>
            Nothing here right now.
          </div>
        ) : (
          col.items.map((it) => (
            <NotificationItem key={it.id} kind={col.kind} item={it} goProject={goProject} unread={isUnread(it)} />
          ))
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: space[4], paddingTop: space[3], borderTop: `1px solid ${c.border}` }}>
        <Btn variant="secondary" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}
