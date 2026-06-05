// Flow — Guide View
// Comprehensive onboarding guide for squad members
import React from "react";
import { c, typo, space, layout, motion, entityColors, phaseColors, typeConfig, trackNames } from "../styles/theme";
import { Surface, Btn } from "../components/shared";
import FlowLogo from "../components/FlowLogo";
import useDevLabel from "../hooks/useDevLabel";

/* ══════════════════════════════════════════════════════════════════
   VISUAL HELPERS
   ══════════════════════════════════════════════════════════════════ */
const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: space[3], margin: `${space[3]}px 0` }}>
    <div style={{ flex: 1, height: 1, background: c.border }} />
    <span style={{
      fontFamily: typo.monoMd.font, fontSize: typo.monoMd.size,
      fontWeight: typo.monoMd.weight, letterSpacing: typo.monoMd.tracking,
      color: c.textDim, textTransform: "uppercase",
    }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: c.border }} />
  </div>
);

const Kbd = ({ children }) => (
  <span style={{
    fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
    letterSpacing: "0.04em",
    color: c.textDim, background: c.surfaceAlt,
    padding: "1px 6px", borderRadius: layout.radiusXs,
    border: `1px solid ${c.border}`, marginLeft: 2, marginRight: 2,
  }}>{children}</span>
);

const ProjectId = ({ id }) => (
  <span style={{
    fontFamily: typo.monoMd.font, fontSize: typo.monoSm.size, fontWeight: 700,
    letterSpacing: typo.monoMd.tracking, color: entityColors().project,
  }}>{id}</span>
);

const ExampleCard = ({ children, style: s }) => (
  <div style={{
    background: c.surfaceAlt, border: `1px solid ${c.border}`,
    borderRadius: layout.radiusSm, padding: `${space[3]}px ${space[4]}px`,
    ...s,
  }}>{children}</div>
);

// Callout box for tips
const Callout = ({ icon, title, children, color = c.accent }) => (
  <div style={{
    display: "flex", gap: space[3], padding: `${space[3]}px ${space[4]}px`,
    background: `${color}06`, border: `1px solid ${color}20`,
    borderRadius: layout.radiusSm,
  }}>
    <span style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
    <div>
      {title && <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: c.text, marginBottom: 4 }}>{title}</div>}
      <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid, lineHeight: 1.6 }}>{children}</div>
    </div>
  </div>
);

// Section heading with accent bar
const SectionTitle = ({ title, subtitle, color = c.accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
    <div style={{ width: 4, height: 28, borderRadius: 2, background: color }} />
    <div>
      <div style={{ fontFamily: typo.displayMd.font, fontSize: typo.displayMd.size, fontWeight: typo.displayMd.weight, letterSpacing: typo.displayMd.tracking, color: c.text, lineHeight: 1 }}>{title}</div>
      {subtitle && <div style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: typo.monoSm.weight, letterSpacing: typo.monoSm.tracking, color, textTransform: "uppercase", marginTop: 4 }}>{subtitle}</div>}
    </div>
  </div>
);

// Body text helper
const Body = ({ children, style: s }) => (
  <p style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, lineHeight: 1.7, color: c.textMid, margin: 0, ...s }}>{children}</p>
);

const B = ({ children, color: cl }) => <strong style={{ color: cl || c.text, fontWeight: 600 }}>{children}</strong>;

// Track pill
const TrackPill = ({ name, color }) => (
  <span style={{
    fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, fontWeight: 600,
    letterSpacing: typo.monoSm.tracking, textTransform: "uppercase",
    color, background: `${color}15`,
    padding: `2px ${space[2]}px`, borderRadius: layout.radiusTag,
    minWidth: 48, textAlign: "center", display: "inline-block",
  }}>{name}</span>
);

// Visual step with number
const Step = ({ num, children }) => (
  <div style={{ display: "flex", gap: space[3], alignItems: "flex-start" }}>
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      background: c.accent, color: c.textCrit,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700, flexShrink: 0,
      marginTop: 1,
    }}>{num}</div>
    <div style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, lineHeight: 1.7, color: c.textMid, flex: 1 }}>{children}</div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   GUIDE VIEW
   ══════════════════════════════════════════════════════════════════ */
const GuideView = ({ onNavigate }) => {
  const devRef = useDevLabel('Comprehensive guide for Flow');
  const pc = phaseColors();

  const indented = { paddingLeft: space[4] + 4 };

  return (
    <div ref={devRef} style={{
      maxWidth: 800, margin: "0 auto",
      display: "flex", flexDirection: "column", gap: space[6],
      paddingBottom: space[8],
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", paddingTop: space[7], paddingBottom: space[2],
      }}>
        <FlowLogo size={80} />
        <h1 style={{
          fontFamily: typo.displayHero.font, fontSize: typo.displayHero.size,
          fontWeight: typo.displayHero.weight, letterSpacing: typo.displayHero.tracking,
          lineHeight: typo.displayHero.lineHeight, color: c.text,
          marginTop: space[5], marginBottom: space[2],
        }}>Flow</h1>
        <p style={{
          fontFamily: typo.displayMd.font, fontSize: typo.displayMd.size,
          fontWeight: typo.displayMd.weight, letterSpacing: typo.displayMd.tracking,
          color: c.accent, marginTop: 0, marginBottom: space[4],
        }}>The live record of every project, by the people running it.</p>
        <Body style={{ maxWidth: 560, textAlign: "center" }}>
          Every project has an owner, members, and an activity feed. Updates happen in Flow, not in DMs or slides. Anyone can open any project and see what's happening, who's on it, and whether it needs help.
        </Body>
      </div>

      <Divider label="How Flow is organized" />

      {/* ═══ THREE SURFACES ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: space[4] }}>
        <Body style={{ textAlign: "center" }}>
          Flow has three surfaces. Navigate with <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd>, or press <Kbd>⌘K</Kbd> to search anything.
        </Body>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: space[3] }}>
          {[
            { num: "1", label: "Summary", desc: "Executive dashboard. KPIs, trends, and attention flags.", color: c.green },
            { num: "2", label: "Projects", desc: "Every project: registry, deep-dive, tracks, and timeline.", color: c.accent },
            { num: "3", label: "People", desc: "Team roster. Workload, active projects, and per-person view.", color: c.cyan },
          ].map(s => (
            <div key={s.num} style={{
              padding: space[4], borderRadius: layout.radiusMd,
              background: `${s.color}06`, border: `1px solid ${s.color}20`,
              display: "flex", flexDirection: "column", gap: space[2],
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 700,
                  color: s.color, background: `${s.color}15`,
                  width: 22, height: 22, borderRadius: layout.radiusXs,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{s.num}</span>
                <span style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════════════
          PROJECTS & TRACKS
          ══════════════════════════════════════════════════════════════ */}
      <Divider label="Projects & Tracks" />

      <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
        <SectionTitle title="Projects" subtitle="The work" color={c.accent} />

        <Body style={indented}>
          The Projects tab is where all work lives. Every project has an owner, a squad, members, and a living activity feed. Three view modes let you see work the way you need it:
        </Body>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: space[3], ...indented }}>
          {[
            { label: "Table", desc: "Dense, sortable rows. Best for scanning status across many projects.", icon: "═" },
            { label: "Board", desc: "Kanban columns by track. Projects appear in every active track column. Drag-and-drop to transition.", icon: "▦" },
            { label: "Gantt", desc: "Timeline view. See all projects on a horizontal timeline.", icon: "▬" },
          ].map(v => (
            <ExampleCard key={v.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: space[2], color: c.textDim }}>{v.icon}</div>
              <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: c.text }}>{v.label}</div>
              <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textMid, lineHeight: 1.5, marginTop: 4 }}>{v.desc}</div>
            </ExampleCard>
          ))}
        </div>

        <Body style={indented}>
          Scope chips filter by <B>In Flight</B>, <B>Shipped</B>, <B>Blocked</B>, <B>Deprioritized</B>, or <B>All</B>. KPI cards at the top show <B color={c.red}>At Risk</B> counts (blocked + overdue projects) so problems are visible at a glance.
        </Body>

        {/* ── What are Tracks? ── */}
        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[4], ...indented }}>
          <div>
            <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text, marginBottom: space[2] }}>What are Tracks?</div>
            <Body>
              Real projects don't move through phases one at a time. PRD can overlap with Dev, QA can run alongside Beta. Flow uses <B color={c.accent}>parallel tracks</B> instead of a single linear phase. Each project can have multiple tracks active simultaneously.
            </Body>
          </div>

          {/* Track definitions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2] }}>
            {[
              { name: "PRD", color: pc.PRD, desc: "Requirements and scope" },
              { name: "Design", color: pc.Design, desc: "UX/UI and architecture" },
              { name: "Dev", color: pc.Dev, desc: "Implementation and coding" },
              { name: "QA", color: pc.QA, desc: "Testing and validation" },
              { name: "Alpha", color: pc.Alpha, desc: "Internal team testing" },
              { name: "Beta", color: pc.Beta, desc: "Real-user testing and A/B" },
            ].map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: space[2], padding: `${space[1]}px 0` }}>
                <TrackPill name={t.name} color={t.color} />
                <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid }}>{t.desc}</span>
              </div>
            ))}
          </div>

          {/* Visual: parallel tracks example */}
          <ExampleCard>
            <div style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: space[2] }}>Example: Parallel Tracks</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { name: "PRD", color: pc.PRD, start: 0, end: 30, done: true },
                { name: "Design", color: pc.Design, start: 10, end: 50, done: true },
                { name: "Dev", color: pc.Dev, start: 20, end: 80, done: false },
                { name: "QA", color: pc.QA, start: 60, end: 90, done: false },
              ].map(t => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: space[2], height: 22 }}>
                  <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: t.color, width: 48, textAlign: "right" }}>{t.name}</span>
                  <div style={{ flex: 1, position: "relative", height: 14, background: `${c.border}40`, borderRadius: 3 }}>
                    <div style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${t.start}%`, width: `${t.end - t.start}%`,
                      background: t.done ? `${t.color}40` : t.color,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim, marginTop: space[2], textAlign: "center" }}>
              PRD and Design overlap. Dev starts before Design finishes. QA begins while Dev is still running.
            </div>
          </ExampleCard>

          {/* Track actions */}
          <div>
            <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: c.text, marginBottom: space[2] }}>Track Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {[
                { action: "Start", desc: "Begin a new track. Multiple tracks can be active at once.", btn: "Start", btnStyle: { background: "transparent", border: `1px dashed ${c.accent}40`, color: c.accent } },
                { action: "Done", desc: "Mark a track complete. It stays on the timeline as history.", btn: "Done", btnStyle: { background: `${c.green}12`, border: `1px solid ${c.green}40`, color: c.green } },
                { action: "Reopen", desc: "Need another pass? Reopen adds a new period to the track.", btn: "Reopen", btnStyle: { background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.textMid } },
              ].map(a => (
                <div key={a.action} style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                  <span style={{
                    fontFamily: typo.bodySm.font, fontSize: 10, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 4, cursor: "default", ...a.btnStyle,
                    minWidth: 56, textAlign: "center",
                  }}>{a.btn}</span>
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid }}>{a.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <Callout icon="⏱" title="Track Timeline (Mini-Gantt)" color={c.cyan}>
            Every project deep-dive has a track timeline showing all tracks as horizontal bars. It scrolls horizontally for long projects and shows a <B color={c.accent}>Today</B> marker, <B color={c.textDim}>Ship Date</B> line, and <B color={c.green}>Shipped</B> line. Hover track rows to start, complete, or reopen tracks.
          </Callout>
        </Surface>

        {/* ── Project Statuses ── */}
        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[3], ...indented }}>
          <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text }}>Project Statuses</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2] }}>
            {[
              { status: "In Flight", color: c.accent, desc: "Actively being worked on" },
              { status: "Upcoming", color: c.textMid, desc: "Registered but not started" },
              { status: "Shipped", color: c.green, desc: "Delivered and complete" },
              { status: "Blocked", color: c.red, desc: "Stuck, needs intervention" },
              { status: "Deprioritized", color: c.textDim, desc: "On hold, not active" },
              { status: "Overdue", color: c.red, desc: "Past its ship date" },
            ].map(s => (
              <div key={s.status} style={{ display: "flex", alignItems: "center", gap: space[2], padding: `${space[1]}px 0` }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0,
                }} />
                <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: s.color }}>{s.status}</span>
                <span style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </Surface>

        {/* ── Creating a Project ── */}
        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[3], ...indented }}>
          <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text }}>Creating a Project</div>
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            <Step num="1">Click the <B>+ Add Project</B> button. Your squad and name are pre-filled as defaults.</Step>
            <Step num="2">Give it a name, set complexity, and add an optional ship date.</Step>
            <Step num="3">Toggle <B color={c.accent}>Start Now</B> to select which tracks to begin immediately. Pick multiple tracks to run them in parallel from day one.</Step>
            <Step num="4">Projects without Start Now are saved as <B>Upcoming</B> and can be started later.</Step>
          </div>
        </Surface>
      </div>


      {/* ══════════════════════════════════════════════════════════════
          PEOPLE
          ══════════════════════════════════════════════════════════════ */}
      <Divider label="People" />

      <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
        <SectionTitle title="People" subtitle="The team" color={c.cyan} />

        <Body style={indented}>
          The People tab is your team roster. Every person shows the number of <B>active projects</B> they're on (as owner or member). This is the primary workload indicator.
        </Body>

        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[4], ...indented }}>
          {/* Workload indicator */}
          <div>
            <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text, marginBottom: space[2] }}>Workload Indicator</div>
            <Body>
              Each person's card shows their active project count. When someone is on more than <B color={c.red}>5 active projects</B>, the count turns red and shows <B color={c.red}>Overloaded</B>, a signal for managers to re-balance work.
            </Body>
          </div>

          {/* Visual: normal vs overloaded */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
            <ExampleCard style={{ display: "flex", alignItems: "center", gap: space[3] }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: c.surfaceAlt, border: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: typo.monoSm.font, fontSize: 13, fontWeight: 700, color: c.textMid,
              }}>A</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: c.text }}>Ahmed K.</div>
                <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim }}>Engineer</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: typo.monoLg.font, fontSize: 20, fontWeight: 700, color: c.text }}>3</div>
                <div style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: c.textMid, textTransform: "uppercase" }}>Projects</div>
              </div>
            </ExampleCard>
            <ExampleCard style={{ display: "flex", alignItems: "center", gap: space[3], borderColor: `${c.red}30` }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: c.surfaceAlt, border: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: typo.monoSm.font, fontSize: 13, fontWeight: 700, color: c.textMid,
              }}>S</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: c.text }}>Sara M.</div>
                <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim }}>Sr. Engineer</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: typo.monoLg.font, fontSize: 20, fontWeight: 700, color: c.red }}>7</div>
                <div style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: c.red, textTransform: "uppercase" }}>Overloaded</div>
              </div>
            </ExampleCard>
          </div>

          <Callout icon="👤" title="Person Deep-Dive" color={c.cyan}>
            Click any person to see their full project list, activity timeline, and role details. Great for 1:1 prep, workload reviews, and understanding who touches which projects.
          </Callout>
        </Surface>
      </div>


      {/* ══════════════════════════════════════════════════════════════
          SUMMARY
          ══════════════════════════════════════════════════════════════ */}
      <Divider label="Summary" />

      <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
        <SectionTitle title="Summary" subtitle="The big picture" color={c.green} />

        <Body style={indented}>
          Your executive dashboard, designed to answer "How is the team doing?" in under 10 seconds.
        </Body>

        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[4], ...indented }}>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: space[3] }}>
            {[
              { label: "In Flight", value: "42", sub: "Active projects", color: c.accent },
              { label: "Shipped", value: "12", sub: "Delivered this quarter", color: c.green },
              { label: "At Risk", value: "6", sub: "Blocked + Overdue", color: c.red },
            ].map(k => (
              <ExampleCard key={k.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: space[1] }}>{k.label}</div>
                <div style={{ fontFamily: typo.displayHero.font, fontSize: 28, fontWeight: 700, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textMid, marginTop: 2 }}>{k.sub}</div>
              </ExampleCard>
            ))}
          </div>

          <div>
            <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text, marginBottom: space[2] }}>What's in Summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {[
                { icon: "📊", title: "Project KPIs", desc: "In-flight, shipped, at-risk counts with week-over-week deltas." },
                { icon: "🔥", title: "Needs Attention", desc: "Projects that are overdue, blocked, or frozen (no updates). Sorted by urgency." },
                { icon: "📰", title: "Weekly Digest", desc: "Auto-generated summary: phase transitions, new projects, blockers, and squad activity." },
                { icon: "🚀", title: "Recently Shipped", desc: "Quick-access chips for all recently shipped projects." },
                { icon: "📋", title: "Squad Breakdown", desc: "Per-squad metrics table. See which squads are shipping and which are stuck." },
              ].map(s => (
                <div key={s.title} style={{ display: "flex", gap: space[2], alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14, lineHeight: 1.6 }}>{s.icon}</span>
                  <div>
                    <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: c.text }}>{s.title}: </span>
                    <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid }}>{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Surface>
      </div>


      {/* ══════════════════════════════════════════════════════════════
          POWER FEATURES
          ══════════════════════════════════════════════════════════════ */}
      <Divider label="Power features" />

      {/* PIN PROJECTS */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Pin Projects" subtitle="Quick access to top priorities" color={c.orange} />

        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[3], ...indented }}>
          <Body>
            Pin your most important projects to keep them at the top of the project list. Pinned projects always appear first, regardless of sort order or filters.
          </Body>

          <ExampleCard style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
              <span style={{ color: c.accent, fontSize: 14 }}>📌</span>
              <ProjectId id="X07" />
              <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: c.text }}>Payment Gateway Migration</span>
              <span style={{ marginLeft: "auto", fontFamily: typo.monoSm.font, fontSize: 10, color: c.accent, fontWeight: 600 }}>PINNED</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
              <span style={{ color: c.accent, fontSize: 14 }}>📌</span>
              <ProjectId id="X12" />
              <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: c.text }}>Driver Allocation ML</span>
              <span style={{ marginLeft: "auto", fontFamily: typo.monoSm.font, fontSize: 10, color: c.accent, fontWeight: 600 }}>PINNED</span>
            </div>
            <div style={{ height: 1, background: c.border, margin: `${space[1]}px 0` }} />
            <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim, textAlign: "center" }}>Other projects follow below</div>
          </ExampleCard>

          <Callout icon="⭐" color={c.orange}>
            Pin and unpin from the project deep-dive page. Use pins for the 2-3 projects you check daily.
          </Callout>
        </Surface>
      </div>

      {/* PROJECT TIMELINE */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Project Timeline" subtitle="Central activity feed" color={c.cyan} />

        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[3], ...indented }}>
          <Body>
            Every project has a timeline: the single source of truth for what's happening. Track changes, status flips, member additions, and team updates all land here.
          </Body>

          <ExampleCard style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {[
              { time: "2d ago", author: "Tariq A.", text: "Started Dev track. Backend API scaffolding complete.", color: c.accent },
              { time: "4d ago", author: "Sara M.", text: "Design review done. Moving to implementation.", color: c.blue },
              { time: "1w ago", author: "System", text: "Track started: PRD", color: c.textDim },
            ].map((e, i) => (
              <div key={i} style={{ display: "flex", gap: space[3], padding: `${space[1]}px 0`, borderBottom: i < 2 ? `1px solid ${c.border}40` : "none" }}>
                <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, color: c.textDim, width: 44, flexShrink: 0, textAlign: "right" }}>{e.time}</span>
                <div>
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: e.color }}>{e.author}</span>
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, color: c.textMid }}> {e.text}</span>
                </div>
              </div>
            ))}
          </ExampleCard>

          <Callout icon="✏️" title="Post Updates" color={c.cyan}>
            Click into any project and use the update box to post what you're working on. Mention blockers, share wins, or flag risks. Everyone on the project gets visibility.
          </Callout>
        </Surface>
      </div>

      {/* BOARD VIEW */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Board View" subtitle="Kanban for parallel tracks" color={c.amber} />

        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[4], ...indented }}>
          <Body>
            The board shows six track columns. A project with multiple active tracks appears in every matching column simultaneously. Upcoming projects sit in a horizontal strip at the bottom, ready to be dragged into action.
          </Body>

          {/* Visual: mini board mockup */}
          <ExampleCard style={{ padding: space[4] }}>
            <div style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: space[3] }}>Board Layout</div>
            <div style={{ display: "flex", gap: space[2], marginBottom: space[3] }}>
              {[
                { track: "PRD", cards: ["X03"] },
                { track: "Design", cards: ["X03", "X12"] },
                { track: "Dev", cards: ["X07", "X15"] },
                { track: "QA", cards: ["X07"] },
                { track: "Alpha", cards: [] },
                { track: "Beta", cards: [] },
              ].map(col => (
                <div key={col.track} style={{ flex: 1, display: "flex", flexDirection: "column", gap: space[1] }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[1] }}>
                    <span style={{ fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700, color: pc[col.track] || c.textDim, textTransform: "uppercase" }}>{col.track}</span>
                    <span style={{ fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 700, color: c.textDim, background: c.surfaceAlt, padding: "1px 4px", borderRadius: 4 }}>{col.cards.length}</span>
                  </div>
                  {col.cards.length === 0 ? (
                    <div style={{ height: 32, border: `1px dashed ${c.border}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: typo.bodySm.font, fontSize: 9, color: c.textGhost }}>empty</span>
                    </div>
                  ) : col.cards.map(id => (
                    <div key={id} style={{
                      padding: "4px 6px", borderRadius: 4,
                      background: c.surface, border: `1px solid ${c.border}`,
                      fontFamily: typo.monoSm.font, fontSize: 9, fontWeight: 600, color: c.text,
                    }}>{id}</div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim, textAlign: "center" }}>
              X03 appears in both PRD and Design because both tracks are active. X07 appears in Dev and QA.
            </div>
          </ExampleCard>

          {/* Drag-and-drop actions */}
          <div>
            <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text, marginBottom: space[3] }}>Drag-and-drop</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
              {[
                { icon: "↔", title: "Track to track", desc: "Drag a card between columns. The source track completes and the target track starts.", color: c.accent },
                { icon: "🚀", title: "Upcoming to track", desc: "Drag an upcoming project onto any column. It moves to In Flight and the track starts.", color: c.green },
                { icon: "🔄", title: "Reopen a track", desc: "Drop onto a previously completed track. A modal asks for an optional reason.", color: c.amber },
                { icon: "⚠", title: "Already active", desc: "Drop onto a track the project already has open. Shows a warning toast.", color: c.red },
              ].map(a => (
                <ExampleCard key={a.title} style={{ display: "flex", gap: space[2], alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: a.color, marginBottom: 2 }}>{a.title}</div>
                    <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textMid, lineHeight: 1.5 }}>{a.desc}</div>
                  </div>
                </ExampleCard>
              ))}
            </div>
          </div>

          {/* Hover actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
            <Callout icon="✓" title="Hover Done" color={c.green}>
              Hover any card to reveal a green <B color={c.green}>Done</B> button in the top-right corner. Click it to complete that track instantly.
            </Callout>
            <Callout icon="🔗" title="Also active" color={c.cyan}>
              Each card shows an "also:" row listing the project's other active tracks, so you always know what else is running in parallel.
            </Callout>
          </div>
        </Surface>
      </div>

      {/* PROJECT ANNOUNCEMENTS */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Project Announcements" subtitle="Ship it, announce it" color={c.green} />

        <Surface variant="panel" style={{ padding: `${space[5]}px`, display: "flex", flexDirection: "column", gap: space[3], ...indented }}>
          <Body>
            When you ship a project, it appears in the <B color={c.green}>Announcements</B> feed (the bell icon in the header). Announcements are visible to everyone, regardless of squad or lens, so shipped work gets the visibility it deserves.
          </Body>

          <ExampleCard style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
            <div style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>May 2026</div>
            <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: space[2] }}>
              <span style={{ fontFamily: typo.monoSm.font, fontSize: 12, fontWeight: 700, color: c.text }}>28 May</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                  <span style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 600, color: c.text }}>Checkout V3</span>
                  <span style={{ fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 600, color: c.green, background: `${c.green}15`, padding: "1px 6px", borderRadius: layout.radiusTag }}>NEW</span>
                </div>
                <div style={{ fontFamily: typo.bodySm.font, fontSize: 11, color: c.textDim, marginTop: 2 }}>Storefront · Omar K.</div>
              </div>
            </div>
          </ExampleCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
            <Callout icon="🎉" title="Shoutouts" color={c.green}>
              Celebrate teammates who made it happen. Give shoutouts from the shipped project banner or the announcement feed.
            </Callout>
            <Callout icon="💬" title="Feedback" color={c.purple}>
              Share constructive feedback on shipped projects. Both shoutouts and feedback are visible on the project's timeline.
            </Callout>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            <div style={{ fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size, fontWeight: 700, color: c.text }}>How to ship a project</div>
            <Step num="1">Open the project deep-dive.</Step>
            <Step num="2">Click <B color={c.green}>Ship Project</B>. All active tracks are marked complete.</Step>
            <Step num="3">The project moves to the Shipped tab and appears in Announcements.</Step>
          </div>
        </Surface>
      </div>

      {/* COMMAND PALETTE */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Command Palette & Search" subtitle="Universal navigation" color={c.purple} />

        <Body style={indented}>
          Press <Kbd>⌘K</Kbd> (or <Kbd>Ctrl+K</Kbd>) to open the command palette. Search across projects (by name or ID), people, tabs, and actions, all from one place.
        </Body>

        <Surface variant="panel" style={{ padding: `${space[4]}px ${space[5]}px`, ...indented }}>
          <ExampleCard style={{ display: "flex", alignItems: "center", gap: space[2] }}>
            <span style={{ fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size, color: c.textDim }}>{'>'}</span>
            <span style={{ fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size, color: c.text, fontWeight: 500 }}>checkout</span>
            <span style={{ marginLeft: "auto", fontFamily: typo.monoSm.font, fontSize: 11, color: c.textDim, letterSpacing: "0.05em" }}>ESC TO CLOSE</span>
          </ExampleCard>
        </Surface>
      </div>

      {/* WEEK NAVIGATION */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Week Navigation & Filters" subtitle="Time travel & focus" color={c.orange} />

        <Body style={indented}>
          Use the <B>week selector</B> in the header to browse historical weeks. All views update to show that week's data. Past weeks are read-only.
        </Body>
        <Body style={indented}>
          The <B>global filter</B> bar lets you filter by owner, squad, or person across all views. Filters support multi-select and persist as you navigate between tabs.
        </Body>
      </div>

      {/* TERMINAL */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Terminal" subtitle="Behind the gate" color={c.green} />

        <Body style={indented}>
          Press <Kbd>T</Kbd> to enter the terminal. It's the gateway to four tools: <B>Settings</B> (squads, roles, and people), <B>Logs</B> (a live activity ledger), <B>Rant</B> (submit feature requests and feedback), and <B>Admin</B> (app-wide admin controls).
        </Body>
      </div>


      <Divider label="Weekly rhythm" />

      {/* ══════════════════════════════════════════════════════════════
          WEEKLY RHYTHM
          ══════════════════════════════════════════════════════════════ */}
      <div id="weekly-rhythm" style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <SectionTitle title="Weekly Rhythm" subtitle="Structured cadence for the week" color={c.orange} />

        <Body style={indented}>
          Each day of the week has a purpose. The rhythm pill in the context bar shows today's mode.
        </Body>

        <Surface variant="panel" style={{ padding: `${space[4] + 2}px ${space[5]}px`, display: "flex", flexDirection: "column", gap: space[2], ...indented }}>
          {[
            { day: "Sunday",    icon: "◎",  label: "Focus day",   desc: "Deep work and planning. Prepare for the week.", color: c.purple },
            { day: "Monday",    icon: "◎",  label: "Focus day",   desc: "Kick off the week with focused execution.", color: c.purple },
            { day: "Tuesday",   icon: "⚡", label: "Sprint day",  desc: "Heads-down building. Maximize output.", color: c.green },
            { day: "Wednesday", icon: "⚡", label: "Sprint day",  desc: "Continue the sprint momentum. Unblock and push.", color: c.green },
            { day: "Thursday",  icon: "🚀", label: "Release day", desc: "Ship what's ready. Move work to Done.", color: c.orange },
            { day: "Friday",    icon: "✓",  label: "Review day",  desc: "Close the week. Update feeds and flag stale work.", color: c.cyan },
            { day: "Saturday",  icon: "💤", label: "Rest day",    desc: "Recharge. Come back stronger.", color: c.textDim },
          ].map((r, i) => {
            const isToday = new Date().getDay() === i;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: space[3],
                padding: `${space[2]}px ${space[3]}px`,
                borderRadius: layout.radiusSm,
                background: isToday ? `${r.color}10` : "transparent",
                border: isToday ? `1px solid ${r.color}25` : "1px solid transparent",
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: layout.radiusTag,
                  background: `${r.color}15`, border: `1px solid ${r.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, flexShrink: 0, lineHeight: 1,
                }}>{r.icon}</div>
                <span style={{
                  fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                  fontWeight: 600, color: isToday ? r.color : c.text, width: 80, flexShrink: 0,
                }}>{r.day}</span>
                <span style={{
                  fontFamily: typo.monoSm.font, fontSize: typo.monoSm.size,
                  fontWeight: typo.monoSm.weight, letterSpacing: typo.monoSm.tracking,
                  color: r.color, textTransform: "uppercase", width: 80, flexShrink: 0,
                }}>{r.label}</span>
                <span style={{
                  fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size,
                  color: c.textMid, flex: 1,
                }}>{r.desc}</span>
                {isToday && (
                  <span style={{
                    fontFamily: typo.monoSm.font, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: r.color, background: `${r.color}18`,
                    padding: "1px 5px", borderRadius: layout.radiusTag, flexShrink: 0,
                  }}>today</span>
                )}
              </div>
            );
          })}
        </Surface>
      </div>

      <Divider label="Keyboard shortcuts" />

      {/* ═══ KEYBOARD SHORTCUTS ═══ */}
      <Surface variant="panel" style={{ padding: `${space[4] + 2}px ${space[5]}px`, display: "flex", flexDirection: "column", gap: space[3] }}>
        <div style={{ fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size, fontWeight: typo.displaySm.weight, color: c.text }}>Quick Reference</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: `${space[2]}px ${space[4]}px`, fontFamily: typo.bodySm.font, fontSize: typo.bodySm.size }}>
          {[
            ["1 - 3", "Navigate tabs: Summary, Projects, People"],
            ["4", "Open this Guide"],
            ["T", "Open Terminal (Settings, Logs, Rant, Admin)"],
            ["⌘K / Ctrl+K", "Open command palette / universal search"],
            ["/", "Focus in-tab search bar"],
            ["↑ ↓", "Move focus up / down through rows; Enter to open"],
            ["?", "Toggle keyboard shortcut hints"],
            ["Esc", "Go back / close palette / exit detail"],
          ].map(([key, desc], i) => (
            <React.Fragment key={i}>
              <div style={{ textAlign: "right" }}><Kbd>{key}</Kbd></div>
              <div style={{ color: c.textMid, lineHeight: 1.6 }}>{desc}</div>
            </React.Fragment>
          ))}
        </div>
      </Surface>

      <Divider label="Getting started" />

      {/* ═══ GETTING STARTED ═══ */}
      <div style={{ textAlign: "center" }}>
        <Body style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          Open <B color={c.accent}>Projects</B> to see every active workstream, who owns it, and whether it needs help.
          Click in to read the timeline or post your own update.
          Use <Kbd>⌘K</Kbd> to search anything, anywhere.
        </Body>
        <div style={{ marginTop: space[5], display: "flex", gap: space[3], justifyContent: "center" }}>
          <Btn variant="secondary" onClick={() => onNavigate("summary")}>Start with Summary</Btn>
          <Btn variant="primary" onClick={() => onNavigate("projects")}>Jump to Projects</Btn>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        marginTop: space[8], paddingTop: space[7], paddingBottom: space[4],
        borderTop: `1px solid ${c.border}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: space[4], textAlign: "center",
      }}>
        <div style={{
          fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
          lineHeight: 1.8, letterSpacing: "0.06em",
          color: c.textDim, textTransform: "uppercase",
        }}>
          vibe coded by{" "}
          <span style={{ color: c.accent }}>AJ</span>,{" "}
          <span style={{ color: c.cyan }}>Opus</span>,{" "}
          <span style={{ color: c.green }}>Codex</span>,{" "}
          <span style={{ color: c.purple }}>Wispr</span>,{" "}
          <span style={{ color: c.orange }}>Vosk</span>{" "}
          and{" "}
          <span style={{ color: c.red }}>Red Bull</span>
        </div>
        <div style={{
          fontFamily: typo.monoSm.font, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.06em", lineHeight: 1.6, color: c.textDim,
          textTransform: "uppercase",
        }}>
          thoughts? feedback?{" "}
          <span
            onClick={() => onNavigate && onNavigate("rant")}
            style={{ color: c.textMid, cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
          >Rant</span>
        </div>
      </div>
    </div>
  );
};

export default GuideView;
