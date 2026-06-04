// Flow — TimelineView
// Chronological timeline, newest first, grouped by Month → Date. A subtle
// vertical line (CSS ::before on .nc-timeline) connects a dot at each date.
//   launched  → broad ProjectLaunchTile
//   shipped   → compact "shipped feature" card (linked project)
//   announce  → compact announcement card
import React, { useMemo } from "react";
import { c, mono, typo, space, layout } from "../../styles/theme";
import { Surface, Tag, Btn, EntityLink, EmptyState } from "../shared";
import ProjectLaunchTile from "./ProjectLaunchTile";

function fmtMonth(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
}
function fmtDay(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ANN_TAG = {
  new: { label: "New", color: c.green },
  fix: { label: "Fix", color: c.red },
  update: { label: "Update", color: c.blue },
  soon: { label: "Soon", color: c.purple },
};

function ShippedCard({ item, goProject }) {
  const open = () => goProject?.(item.projectId);
  return (
    <Surface variant="panel" compact accent={c.cyan} style={{ padding: `${space[3]}px ${space[4]}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
        <Tag color={c.cyan} bg={`${c.cyan}18`}>Shipped · {item.stage}</Tag>
        <EntityLink type="project" underline onClick={open}
          style={{ fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 600 }}>
          {item.projectName}
        </EntityLink>
        {item.squad && <span style={{ fontFamily: typo.bodySm.font, fontSize: 12, color: c.textDim }}>· {item.squad}</span>}
      </div>
      {item.description && (
        <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.textMid, marginTop: space[1], lineHeight: 1.5 }}>
          {item.description}
        </div>
      )}
    </Surface>
  );
}

function AnnounceCard({ item }) {
  const badge = ANN_TAG[item.tag] || ANN_TAG.update;
  return (
    <Surface variant="panel" compact accent={badge.color} style={{ padding: `${space[3]}px ${space[4]}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
        <Tag color={badge.color} bg={`${badge.color}18`}>{badge.label}</Tag>
        <span style={{ fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 600, color: c.text }}>{item.title}</span>
      </div>
      {item.body && (
        <div style={{ fontFamily: typo.bodySm.font, fontSize: 13, color: c.textMid, marginTop: space[1], lineHeight: 1.5 }}>
          {item.body}
        </div>
      )}
      {item.link?.href && (
        <a href={item.link.href} target="_blank" rel="noreferrer"
          style={{ display: "inline-block", marginTop: space[2], fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 600, color: c.accent, textDecoration: "none" }}>
          {item.link.label || "Learn more"} →
        </a>
      )}
    </Surface>
  );
}

export default function TimelineView({ items = [], goProject }) {
  const grouped = useMemo(() => {
    const months = [];
    let curMonth = null, curDay = null;
    items.forEach((item) => {
      const mLabel = fmtMonth(item.date);
      const dLabel = fmtDay(item.date);
      if (!curMonth || curMonth.label !== mLabel) { curMonth = { label: mLabel, days: [] }; months.push(curMonth); curDay = null; }
      if (!curDay || curDay.label !== dLabel) { curDay = { label: dLabel, items: [] }; curMonth.days.push(curDay); }
      curDay.items.push(item);
    });
    return months;
  }, [items]);

  if (!items.length) {
    return <EmptyState icon="📣" title="Nothing new yet" message="Launches, shipped features, and product announcements will appear here." />;
  }

  return (
    <div className="nc-timeline">
      {grouped.map((month) => (
        <section key={month.label} style={{ marginBottom: space[5] }}>
          <div className="nc-timeline-month" style={{
            fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
            color: c.textMid, marginBottom: space[4],
          }}>{month.label}</div>

          {month.days.map((day) => (
            <div className="nc-timeline-row" key={day.label}>
              <span className="nc-timeline-dot" />
              <div className="nc-timeline-date" style={{
                fontFamily: mono, fontSize: 12, fontWeight: 700, color: c.textDim,
                fontVariantNumeric: "tabular-nums", paddingTop: 6,
              }}>{day.label}</div>
              <div className="nc-timeline-items" style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
                {day.items.map((it) =>
                  it.kind === "launched"
                    ? <ProjectLaunchTile key={it.id} item={it} goProject={goProject} />
                    : it.kind === "shipped"
                      ? <ShippedCard key={it.id} item={it} goProject={goProject} />
                      : <AnnounceCard key={it.id} item={it} />
                )}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
