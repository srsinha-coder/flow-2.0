// Flow — ProjectLaunchTile
// Broad tile for a launched project (GA). Project name routes to the detail
// page; shows owner, description, scrollable release notes, version, launch
// date, and a "View Project" CTA.
import React from "react";
import { c, mono, typo, space, layout } from "../../styles/theme";
import { Surface, Tag, Btn, EntityLink } from "../shared";

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectLaunchTile({ item, goProject }) {
  const open = () => goProject?.(item.projectId);
  return (
    <Surface variant="panel" accent={c.green} className="nc-launch-tile" style={{ padding: space[5], display: "flex", flexDirection: "column", gap: space[3] }}>
      {/* Header: name + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <Tag color={c.green} bg={`${c.green}18`}>Launched</Tag>
        <EntityLink type="project" underline onClick={open}
          style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: 700 }}>
          {item.projectName}
        </EntityLink>
        {item.version && <span style={{ fontFamily: mono, fontSize: 12, color: c.textDim }}>{item.version}</span>}
      </div>

      {/* Meta: owner · squad · date */}
      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap", fontFamily: typo.bodySm.font, fontSize: 12, color: c.textMid }}>
        {item.owner && <span>Owner: <strong style={{ color: c.text, fontWeight: 600 }}>{item.owner}</strong></span>}
        {item.squad && <span>· {item.squad}</span>}
        <span style={{ fontFamily: mono, color: c.textDim }}>· {fmtDate(item.date)}</span>
      </div>

      {/* Description */}
      {item.description && (
        <p style={{ margin: 0, fontFamily: typo.bodyMd.font, fontSize: 14, color: c.textMid, lineHeight: 1.55 }}>
          {item.description}
        </p>
      )}

      {/* Release notes — scrollable when long */}
      {item.releaseNotes && (
        <div style={{ display: "flex", flexDirection: "column", gap: space[1] }}>
          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.textDim }}>
            Release notes
          </span>
          <div style={{
            maxHeight: 140, overflowY: "auto",
            padding: `${space[2]}px ${space[3]}px`, borderRadius: layout.radiusSm,
            background: c.surfaceAlt, border: `1px solid ${c.border}`,
            fontFamily: typo.bodySm.font, fontSize: 13, color: c.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap",
          }}>
            {item.releaseNotes}
          </div>
        </div>
      )}

      {/* CTA */}
      <div>
        <Btn variant="secondary" size="sm" onClick={open}>View Project →</Btn>
      </div>
    </Surface>
  );
}
