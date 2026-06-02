import React from "react";
import { c, motion, mono, body, layout } from "../styles/theme";

const AnimStyles = () => (
  <style>{`
    /* ═══════════════════════════════════════════════════════════════
       MOTION TIERS
       ambient:     slow, continuous, background feel
       interaction: snappy user feedback
       critical:    attention-grabbing
       ═══════════════════════════════════════════════════════════════ */

    /* ── Utility keyframes ── */
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ── Ambient keyframes ── */
    @keyframes rowSlideIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes breathe {
      0%, 100% { opacity: 0.03; }
      50% { opacity: 0.07; }
    }
    @keyframes blobDrift1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -20px) scale(1.05); }
      66% { transform: translate(-20px, 15px) scale(0.95); }
    }
    @keyframes blobDrift2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(-25px, 25px) scale(0.97); }
      66% { transform: translate(15px, -30px) scale(1.03); }
    }
    @keyframes gridPulse {
      0%, 100% { opacity: 0.025; }
      50% { opacity: 0.045; }
    }
    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes savingPulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 1; }
    }

    /* ── Interaction keyframes ── */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeScaleIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes fadeScaleOut {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(-4px) scale(0.97); }
    }
    @keyframes slideDownOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(24px); }
    }
    @keyframes slotSlideInRight {
      from { opacity: 0; transform: translateX(16px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slotSlideInLeft {
      from { opacity: 0; transform: translateX(-16px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .flow-gantt-bar:focus-visible {
      outline: 2px solid ${c.accent};
      outline-offset: 2px;
    }

    /* ── Critical keyframes ── */
    @keyframes criticalPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,107,0); }
      50% { box-shadow: 0 0 12px 2px rgba(255,107,107,0.25); }
    }
    @keyframes lockFlash {
      0% { background: rgba(132,255,149,0.15); }
      100% { background: transparent; }
    }
    @keyframes shakeX {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }

    /* ═══════════════════════════════════════════════════════════════
       PULSE PAGE — Phase 2 animations
       ═══════════════════════════════════════════════════════════════ */

    /* ── Glass tile gradient sweep — ambient shimmer ── */
    @keyframes gradientSweep {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* ── Neon edge glow for mission grid ── */
    @keyframes neonEdge {
      0%, 100% { box-shadow: inset 0 0 0 1px rgba(0,0,0,0.07), inset 0 0 8px rgba(59,130,246,0.08); }
      50% { box-shadow: inset 0 0 0 1px rgba(0,0,0,0.07), inset 0 0 14px rgba(59,130,246,0.12); }
    }

    /* ── Risk level bar pulse — severity-driven ── */
    @keyframes riskPulseGreen {
      0%, 100% { box-shadow: 0 0 4px rgba(132,255,149,0.2); }
      50% { box-shadow: 0 0 10px rgba(132,255,149,0.35); }
    }
    @keyframes riskPulseAmber {
      0%, 100% { box-shadow: 0 0 6px rgba(251,191,36,0.25); }
      50% { box-shadow: 0 0 14px rgba(251,191,36,0.45); }
    }
    @keyframes riskPulseRed {
      0%, 100% { box-shadow: 0 0 8px rgba(255,107,107,0.3); }
      50% { box-shadow: 0 0 18px rgba(255,107,107,0.55); }
    }

    /* ── Risk radar rotation ── */
    @keyframes radarSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ── View morph — scale/fade spring ── */
    @keyframes viewMorphIn {
      from { opacity: 0; transform: scale(0.97) translateY(4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes viewMorphOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.97); }
    }

    /* ── Side panel slide ── */
    @keyframes slidePanelIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slidePanelOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(20px); }
    }

    /* ── Delta token directional motion ── */
    @keyframes deltaUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes deltaDown {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── KPI counter number roll ── */
    @keyframes countRoll {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Stagger children entrance ── */
    @keyframes staggerIn {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .flow-stagger > * {
      animation: staggerIn 0.25s ${motion.interaction.easing} both;
    }
    .flow-stagger > *:nth-child(1) { animation-delay: 0s; }
    .flow-stagger > *:nth-child(2) { animation-delay: 0.04s; }
    .flow-stagger > *:nth-child(3) { animation-delay: 0.08s; }
    .flow-stagger > *:nth-child(4) { animation-delay: 0.12s; }
    .flow-stagger > *:nth-child(5) { animation-delay: 0.16s; }
    .flow-stagger > *:nth-child(6) { animation-delay: 0.20s; }

    /* ── Mission Grid — Steel & Orange (styled in global.css; no overlays) ── */

    /* ── Glass phase tiles ── */
    .flow-glass-tile {
      position: relative;
      overflow: hidden;
      border-radius: 12px;
      cursor: pointer;
      transition: transform ${motion.fast.duration} ${motion.fast.easing},
                  box-shadow ${motion.fast.duration} ${motion.fast.easing},
                  border-color ${motion.fast.duration} ${motion.fast.easing};
      box-shadow: 0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
    }
    .flow-glass-tile::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 30%, rgba(0,0,0,0.02) 50%, transparent 70%);
      background-size: 200% 100%;
      animation: gradientSweep 6s ${motion.ambient.easing} infinite;
      pointer-events: none;
    }
    .flow-glass-tile:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
    }
    .flow-glass-tile:active {
      transform: translateY(0);
    }

    /* ── Risk radar ring (static; infinite spin removed for motion hygiene) ── */
    .flow-risk-radar {
      position: relative;
      display: inline-flex;
    }

    /* ── View morph wrapper ── */
    .flow-view-morph {
      animation: viewMorphIn ${motion.normal.duration} ${motion.normal.easing} both;
    }

    /* ── Telemetry side panel backdrop ── */
    .flow-side-panel-backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      animation: sidePanelBackdropIn ${motion.normal.duration} ${motion.normal.easing} both;
    }
    .flow-side-panel-backdrop-exit {
      animation: sidePanelBackdropOut ${motion.fast.duration} ${motion.fast.easing} both;
    }
    @keyframes sidePanelBackdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes sidePanelBackdropOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    /* ── Telemetry side panel ── */
    .flow-side-panel {
      position: fixed;
      right: 0;
      top: 104px;
      bottom: 0;
      width: 440px;
      background: ${c.surface};
      border-left: 1px solid ${c.border};
      box-shadow: -12px 0 40px rgba(0,0,0,0.4);
      z-index: 91;
      overflow-y: auto;
      animation: slidePanelIn ${motion.normal.duration} ${motion.normal.easing} both;
    }
    .flow-side-panel-exit {
      animation: slidePanelOut ${motion.fast.duration} ${motion.fast.easing} both;
    }

    /* ── Delta tokens ── */
    .flow-delta-up {
      animation: deltaUp 0.3s ${motion.interaction.easing} both;
    }
    .flow-delta-down {
      animation: deltaDown 0.3s ${motion.interaction.easing} both;
    }

    /* ── KPI counter ── */
    .flow-kpi-num {
      animation: countRoll 0.4s ${motion.interaction.easing} both;
    }

    /* ═══════════════════════════════════════════════════════════════
       COMMIT PAGE — Phase 3 animations
       ═══════════════════════════════════════════════════════════════ */

    /* ── Neon card scanline texture ── */
    @keyframes cardScanline {
      0% { background-position: 0 0; }
      100% { background-position: 0 40px; }
    }

    /* ── Card fade to archived ── */
    @keyframes fadeToArchived {
      from { opacity: 1; transform: translateX(0) scale(1); }
      to { opacity: 0.35; transform: translateX(-4px) scale(0.98); }
    }
    @keyframes slideUpBuffer {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Week complete celebration ── */
    @keyframes weekCompletePop {
      0% { transform: scale(0.9); opacity: 0; }
      60% { transform: scale(1.03); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }

    /* ── Focus ring active pulse ── */
    @keyframes focusRingPulse {
      0%, 100% { box-shadow: 0 0 0 2px ${c.accent}20; }
      50% { box-shadow: 0 0 0 4px ${c.accent}30, 0 0 12px ${c.accent}15; }
    }

    /* ── Neon commit card ── */
    .flow-neon-card {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s ${motion.interaction.easing},
                  box-shadow 0.2s ${motion.interaction.easing},
                  border-color 0.2s ${motion.interaction.easing};
    }
    .flow-neon-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${c.accent}15, transparent);
      pointer-events: none;
      z-index: 1;
    }
    .flow-neon-card.flow-neon-active {
      animation: focusRingPulse 2s ${motion.ambient.easing} infinite;
    }

    /* ── Archived card ── */
    .flow-card-archived {
      animation: fadeToArchived 0.35s ${motion.interaction.easing} both;
    }
    .flow-card-buffer-slide {
      animation: slideUpBuffer 0.3s ${motion.interaction.easing} both;
    }

    /* ── Task card hover elevation ── */
    .flow-task-card {
      transition: transform 0.15s ${motion.interaction.easing},
                  box-shadow 0.15s ${motion.interaction.easing},
                  border-color 0.2s ${motion.interaction.easing};
    }
    .flow-task-card:hover {
      box-shadow: 0 2px 12px ${c.shadow};
    }

    /* ── Outcome buttons ── */
    .flow-outcome-btn {
      transition: background 0.15s ${motion.interaction.easing}, color 0.15s ${motion.interaction.easing}, border-color 0.15s ${motion.interaction.easing}, transform 0.15s ${motion.interaction.easing}, box-shadow 0.15s ${motion.interaction.easing};
    }
    .flow-outcome-btn:hover {
      transform: scale(1.02);
    }
    .flow-outcome-btn:active {
      transform: scale(0.97);
    }

    /* ── Validation message ── */
    @keyframes validationFadeIn {
      from { opacity: 0; transform: translateY(-2px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .flow-validation-msg {
      animation: validationFadeIn 0.2s ${motion.interaction.easing} both;
    }

    /* ── Week complete bar ── */
    .flow-week-complete {
      animation: weekCompletePop 0.5s ${motion.critical.easing} both;
    }

    /* ── Commit frozen control bar ── */
    .flow-commit-sticky {
      position: relative;
    }
    .flow-commit-sticky::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: -8px;
      right: -8px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${c.border}, transparent);
    }

    /* ── Summary scroll area — hidden scrollbar ── */
    .flow-summary-scroll::-webkit-scrollbar { display: none; }
    .flow-summary-scroll { scrollbar-width: none; }

    /* ── Summary: KPI card entrance + hover lift ── */
    @keyframes kpiEnter {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .flow-kpi-card {
      animation: kpiEnter ${motion.normal.duration} ${motion.normal.easing} both;
      transition: border-color ${motion.fast.duration} ${motion.fast.easing},
                  box-shadow ${motion.fast.duration} ${motion.fast.easing},
                  transform ${motion.fast.duration} ${motion.fast.easing};
    }
    .flow-kpi-card.clickable:hover {
      border-color: rgba(0,0,0,0.12);
      box-shadow: ${c.shadowElevated};
      transform: translateY(-1px);
    }
    .flow-kpi-card.clickable:active { transform: scale(0.99); transition-duration: ${motion.instant.duration}; }

    /* ── Summary: sparkline bar entrance (scaleY from baseline) ── */
    @keyframes sparkBarGrow {
      from { transform: scaleY(0.05); opacity: 0.4; }
      to { transform: scaleY(1); opacity: var(--spark-opacity, 1); }
    }
    .flow-spark-bar {
      transform-origin: bottom;
      animation: sparkBarGrow ${motion.normal.duration} ${motion.normal.easing} both;
      transition: opacity ${motion.fast.duration} ${motion.fast.easing},
                  background ${motion.fast.duration} ${motion.fast.easing};
    }

    /* ── Summary: clickable chip button (uncommitted people, blocked) ── */
    .flow-chip-btn {
      transition: background ${motion.fast.duration} ${motion.fast.easing},
                  border-color ${motion.fast.duration} ${motion.fast.easing},
                  color ${motion.fast.duration} ${motion.fast.easing},
                  transform ${motion.fast.duration} ${motion.fast.easing};
    }
    .flow-chip-btn:hover {
      background: ${c.surface};
      border-color: rgba(0,0,0,0.18);
    }
    .flow-chip-btn:active { transform: scale(0.97); }
    .flow-chip-btn-danger { transition: background ${motion.fast.duration} ${motion.fast.easing}, border-color ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}; }
    .flow-chip-btn-danger:hover { border-color: ${c.red}60; }
    .flow-chip-btn-danger:active { transform: scale(0.98); }

    /* ── Summary: sortable table headers ── */
    .flow-sort-th {
      transition: color ${motion.fast.duration} ${motion.fast.easing},
                  background ${motion.fast.duration} ${motion.fast.easing};
    }
    .flow-sort-th:hover { color: ${c.text}; background: ${c.surfaceAlt}; }
    .flow-sort-th:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px ${c.accent};
    }

    /* ── Summary banner entrance ── */
    .flow-banner-enter {
      animation: slideDown ${motion.normal.duration} ${motion.normal.easing} both;
    }
    .flow-fade-enter {
      animation: fadeIn ${motion.fast.duration} ${motion.fast.easing} both;
    }
    .flow-fade-exit {
      animation: fadeOut ${motion.fast.duration} ${motion.fast.easing} both;
    }

    /* ── Summary: KpiCard focus ring (keyboard a11y) ── */
    .flow-kpi-card.clickable:focus-visible {
      outline: none;
      box-shadow: ${c.shadowElevated}, 0 0 0 2px ${c.accent};
    }

    /* ── Summary: chart entrance (fade + lift) ── */
    @keyframes chartEnter {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .flow-chart-enter {
      animation: chartEnter ${motion.normal.duration} ${motion.normal.easing} both;
    }

    /* ── Summary: chart bar entrance (scaleY from baseline) ── */
    @keyframes chartBarGrow {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }
    .flow-chart-bar-enter {
      transform-origin: bottom;
      animation: chartBarGrow ${motion.normal.duration} ${motion.normal.easing} both;
    }

    /* ── Pill hover (clickable chips inside KpiCards) ── */
    .flow-pill-clickable:hover { filter: brightness(0.96); }
    .flow-pill-clickable:active { transform: scale(0.97); }

    /* ── SegmentedToggle inactive hover + press ── */
    .flow-seg-btn:not(.active):hover { color: ${c.text}; }
    .flow-seg-btn:active { transform: scale(0.98); transition-duration: ${motion.instant.duration}; }

    /* ── Commit scroll area — thin custom scrollbar ── */
    .flow-commit-scroll::-webkit-scrollbar { width: 4px; }
    .flow-commit-scroll::-webkit-scrollbar-track { background: transparent; }
    .flow-commit-scroll::-webkit-scrollbar-thumb { background: ${c.border}; border-radius: 4px; }
    .flow-commit-scroll::-webkit-scrollbar-thumb:hover { background: ${c.textDim}; }
    .flow-commit-scroll { scrollbar-width: thin; scrollbar-color: ${c.border} transparent; }

    /* ── Commit hero KPI entrance ── */
    @keyframes commitCountUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .flow-commit-kpi {
      animation: commitCountUp 0.4s ${motion.interaction.easing} both;
    }

    /* ── Commit person row hover ── */
    .flow-commit-person-row {
      transition: background 0.15s ${motion.interaction.easing}, border-color 0.15s ${motion.interaction.easing}, transform 0.15s ${motion.interaction.easing};
      cursor: pointer;
    }
    .flow-commit-person-row:hover {
      background: ${c.glass} !important;
      transform: translateX(2px);
      box-shadow: 0 2px 8px ${c.shadow};
    }
    .flow-commit-person-row:active {
      transform: scale(0.997) translateX(1px);
    }

    /* ── Commit lock pulse ── */
    @keyframes commitLockPulse {
      0%, 100% { box-shadow: 0 0 8px ${c.green}40; }
      50% { box-shadow: 0 0 16px ${c.green}60, 0 0 4px ${c.green}30; }
    }
    .flow-commit-lock-glow {
      animation: commitLockPulse 2s ${motion.ambient.easing} infinite;
    }

    /* ── Card entrance stagger ── */
    .flow-commit-card-enter {
      animation: slideUp 0.35s ${motion.interaction.easing} both;
    }

    /* ── Commit progress bar glow ── */
    .flow-commit-progress {
      position: relative;
      overflow: hidden;
      border-radius: 4px;
    }
    .flow-commit-progress::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: 0 0 8px ${c.green}15;
      pointer-events: none;
    }

    /* ── Commit hero card ── */
    .flow-commit-hero {
      position: relative;
      overflow: hidden;
    }
    .flow-commit-hero::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, ${c.green}80, ${c.accent}60, ${c.cyan}40);
      border-radius: 3px 3px 0 0;
      opacity: 0.6;
    }

    /* ═══════════════════════════════════════════════════════════════
       PROJECTS PAGE — Phase 4 animations
       ═══════════════════════════════════════════════════════════════ */

    /* ── Phase pipeline glow node ── */
    @keyframes phaseNodeGlow {
      0%, 100% { box-shadow: 0 0 6px currentColor; filter: brightness(1); }
      50% { box-shadow: 0 0 16px currentColor, 0 0 30px currentColor; filter: brightness(1.3); }
    }

    /* ── Timeline marker animated movement ── */
    @keyframes timelineMarkerBob {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-2px); }
    }

    /* ── Overdue red scan pulse ── */
    @keyframes overdueScanPulse {
      0% { background-position: 0% 0%; }
      100% { background-position: 200% 0%; }
    }

    /* ── Sparkline bar grow ── */
    @keyframes sparkBarGrow {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }

    /* ── Evidence card chronological entrance ── */
    @keyframes evidenceSlideIn {
      from { opacity: 0; transform: translateX(-12px) scale(0.97); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    /* ── Evidence card update pulse ── */
    @keyframes evidenceUpdatePulse {
      0% { box-shadow: 0 0 0 0 ${c.accent}40; }
      70% { box-shadow: 0 0 0 6px ${c.accent}00; }
      100% { box-shadow: 0 0 0 0 ${c.accent}00; }
    }

    /* ── Overdue blink border ── */
    @keyframes overdueBlinkBorder {
      0%, 100% { border-color: ${c.red}50; }
      50% { border-color: ${c.red}; }
    }

    /* ── Escalation chip bounce ── */
    @keyframes escalationBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }

    /* ── Command card shimmer ── */
    @keyframes commandCardShimmer {
      0% { background-position: -300% 0; }
      100% { background-position: 300% 0; }
    }

    /* ── Project Command Card ── */
    .flow-command-card {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      background: transparent;
      border: 1px solid ${c.border};
    }
    .flow-command-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 30%, rgba(0,0,0,0.015) 50%, transparent 70%);
      background-size: 300% 100%;
      animation: commandCardShimmer 8s ${motion.ambient.easing} infinite;
      pointer-events: none;
    }

    /* ── Phase pipeline ── */
    .flow-phase-pipeline {
      display: flex;
      align-items: center;
      gap: 0;
      position: relative;
    }
    .flow-phase-node {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      transition: background 0.3s ${motion.interaction.easing}, color 0.3s ${motion.interaction.easing}, border-color 0.3s ${motion.interaction.easing}, box-shadow 0.3s ${motion.interaction.easing}, transform 0.3s ${motion.interaction.easing};
      position: relative;
      z-index: 2;
      flex-shrink: 0;
    }
    .flow-phase-node-active {
      animation: phaseNodeGlow 2.5s ${motion.ambient.easing} infinite;
    }
    .flow-phase-connector {
      flex: 1;
      height: 2px;
      min-width: 16px;
      position: relative;
      z-index: 1;
    }

    /* ── Timeline progress bar ── */
    .flow-timeline-bar {
      position: relative;
      height: 6px;
      border-radius: 3px;
      background: ${c.surfaceAlt};
      overflow: visible;
    }
    .flow-timeline-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.6s ${motion.interaction.easing};
      position: relative;
    }
    .flow-timeline-marker {
      position: absolute;
      top: -5px;
      width: 10px;
      height: 16px;
      border-radius: 3px;
      animation: timelineMarkerBob 2s ${motion.ambient.easing} infinite;
      z-index: 3;
    }
    .flow-timeline-overdue .flow-timeline-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, ${c.red}30, transparent);
      background-size: 200% 100%;
      animation: overdueScanPulse 2s linear infinite;
    }

    /* ── Sparkline strip ── */
    .flow-sparkline-strip {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      position: relative;
    }
    .flow-spark-bar {
      border-radius: 2px 2px 0 0;
      transform-origin: bottom center;
      animation: sparkBarGrow 0.4s ${motion.interaction.easing} both;
      cursor: default;
      position: relative;
    }
    .flow-spark-tooltip {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      border-radius: 6px;
      background: ${c.surfaceSolid};
      border: 1px solid ${c.border};
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: ${c.text};
      white-space: nowrap;
      pointer-events: none;
      z-index: 20;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .flow-spark-bar:hover .flow-spark-tooltip {
      opacity: 1;
    }

    /* ── Evidence feed cards ── */
    .flow-evidence-card {
      position: relative;
      border-radius: 10px;
      background: ${c.surface};
      border: 1px solid ${c.border};
      padding: 12px 14px;
      transition: background 0.2s ${motion.interaction.easing}, border-color 0.2s ${motion.interaction.easing}, box-shadow 0.2s ${motion.interaction.easing};
      animation: evidenceSlideIn 0.3s ${motion.interaction.easing} both;
    }
    .flow-evidence-card:hover {
      border-color: ${c.accent}30;
      background: ${c.surfaceAlt};
    }
    .flow-evidence-card-pulse {
      animation: evidenceSlideIn 0.3s ${motion.interaction.easing} both,
                 evidenceUpdatePulse 0.8s ${motion.critical.easing} 0.3s both;
    }

    /* ── Overdue emergency block ── */
    .flow-overdue-emergency {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      border: 2px solid ${c.red}50;
      animation: overdueBlinkBorder 2s ${motion.ambient.easing} infinite;
    }
    .flow-overdue-emergency::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, ${c.red}12, ${c.red}06);
      pointer-events: none;
    }
    .flow-escalation-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      background: ${c.red}20;
      border: 1px solid ${c.red}40;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: ${c.red};
      animation: escalationBounce 2s ${motion.ambient.easing} infinite;
    }

    /* ═══════════════════════════════════════════════════════════════
       PEOPLE PAGE — Phase 5 animations
       ═══════════════════════════════════════════════════════════════ */

    /* ── Momentum arrow pulse ── */
    @keyframes momentumPulseUp {
      0%, 100% { transform: translateY(0); opacity: 0.8; }
      50% { transform: translateY(-3px); opacity: 1; }
    }
    @keyframes momentumPulseDown {
      0%, 100% { transform: translateY(0); opacity: 0.8; }
      50% { transform: translateY(3px); opacity: 1; }
    }

    /* ── Energy bar glow fill ── */
    @keyframes energyBarGlow {
      0%, 100% { filter: brightness(1) drop-shadow(0 0 2px currentColor); }
      50% { filter: brightness(1.25) drop-shadow(0 0 6px currentColor); }
    }
    @keyframes energyBarGrow {
      from { width: 0%; }
      to { width: var(--bar-width); }
    }

    /* ── Signal card severity waveform ── */
    @keyframes severityWaveInfo {
      0%, 100% { border-left-color: ${c.blue}40; }
      50% { border-left-color: ${c.blue}; }
    }
    @keyframes severityWaveWarning {
      0%, 100% { border-left-color: ${c.orange}40; }
      50% { border-left-color: ${c.orange}; }
    }
    @keyframes severityWaveCritical {
      0%, 100% { border-left-color: ${c.red}40; box-shadow: inset 0 0 0 0 ${c.red}00; }
      50% { border-left-color: ${c.red}; box-shadow: inset 0 0 12px ${c.red}08; }
    }

    /* ── Terminal log line entry ── */
    @keyframes terminalLineIn {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes terminalCursorBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* ── Coaching console prompt typewriter ── */
    @keyframes coachPromptIn {
      from { opacity: 0; transform: translateY(6px); max-height: 0; }
      to { opacity: 1; transform: translateY(0); max-height: 200px; }
    }
    @keyframes consoleScanline {
      0% { top: 0; }
      100% { top: 100%; }
    }

    /* ── Profile telemetry panel ── */
    .flow-telemetry-panel {
      position: relative;
      border-radius: ${layout.radius}px;
      overflow: hidden;
      background: transparent;
      border: 1px solid ${c.border};
    }
    .flow-telemetry-panel::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, ${c.accent}04 0%, transparent 50%, ${c.purple}04 100%);
      pointer-events: none;
    }

    /* ── Momentum arrow ── */
    .flow-momentum-up {
      animation: momentumPulseUp 2s ${motion.ambient.easing} infinite;
      color: ${c.green};
    }
    .flow-momentum-down {
      animation: momentumPulseDown 2s ${motion.ambient.easing} infinite;
      color: ${c.red};
    }
    .flow-momentum-flat {
      color: ${c.textDim};
    }

    /* ── Energy bars ── */
    .flow-energy-bar-track {
      position: relative;
      height: 28px;
      border-radius: 6px;
      background: ${c.surfaceAlt};
      overflow: hidden;
      cursor: default;
    }
    .flow-energy-bar-fill {
      height: 100%;
      border-radius: 6px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      animation: energyBarGrow 0.6s ${motion.interaction.easing} both;
      transition: filter 0.2s;
    }
    .flow-energy-bar-track:hover .flow-energy-bar-fill {
      animation: energyBarGlow 1.5s ${motion.ambient.easing} infinite;
    }
    .flow-energy-bar-pct {
      opacity: 0;
      transition: opacity 0.15s;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: ${c.bg};
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    .flow-energy-bar-track:hover .flow-energy-bar-pct {
      opacity: 1;
    }

    /* ── Signal cards ── */
    .flow-signal-card {
      position: relative;
      border-radius: 10px;
      background: ${c.surface};
      border: 1px solid ${c.border};
      border-left: 3px solid ${c.textDim};
      overflow: hidden;
      transition: background 0.2s ${motion.interaction.easing}, border-color 0.2s ${motion.interaction.easing}, box-shadow 0.2s ${motion.interaction.easing};
      cursor: pointer;
    }
    .flow-signal-card:hover {
      background: ${c.surfaceAlt};
    }
    .flow-signal-info {
      animation: severityWaveInfo 3s ${motion.ambient.easing} infinite;
    }
    .flow-signal-warning {
      animation: severityWaveWarning 2.5s ${motion.ambient.easing} infinite;
    }
    .flow-signal-critical {
      animation: severityWaveCritical 1.8s ${motion.ambient.easing} infinite;
    }
    .flow-signal-expand {
      animation: slideDown 0.2s ${motion.interaction.easing} both;
    }

    /* ── Terminal log ── */
    .flow-terminal-log {
      position: relative;
      border-radius: 12px;
      background: ${c.bg};
      border: 1px solid ${c.border};
      overflow: hidden;
      font-family: 'JetBrains Mono', monospace;
    }
    .flow-terminal-log::before {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 1px;
      background: ${c.accent}20;
      animation: consoleScanline 6s linear infinite;
      pointer-events: none;
      z-index: 1;
    }
    .flow-terminal-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid ${c.border};
      background: ${c.surface};
    }
    .flow-terminal-dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .flow-terminal-line {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 6px 16px;
      border-bottom: 1px solid ${c.border}40;
      animation: terminalLineIn 0.25s ${motion.interaction.easing} both;
      transition: background 0.15s;
    }
    .flow-terminal-line:hover {
      background: ${c.surface};
    }
    .flow-terminal-cursor {
      display: inline-block;
      width: 6px;
      height: 14px;
      background: ${c.accent};
      animation: terminalCursorBlink 1s step-end infinite;
      margin-left: 4px;
      vertical-align: text-bottom;
    }

    /* ── Coaching console ── */
    .flow-coaching-console {
      position: relative;
      border-radius: 12px;
      background: linear-gradient(135deg, ${c.surface}, ${c.surfaceSolid});
      border: 1px solid ${c.accent}20;
      overflow: hidden;
    }
    .flow-coaching-console::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        ${c.accent}02 3px,
        ${c.accent}02 4px
      );
      pointer-events: none;
    }
    .flow-coach-prompt {
      animation: coachPromptIn 0.35s ${motion.interaction.easing} both;
      position: relative;
      z-index: 1;
    }

    /* ═══════════════════════════════════════════════════════════════
       SETTINGS PAGE — Phase 6 animations
       ═══════════════════════════════════════════════════════════════ */

    /* ── Keyframes ── */
    @keyframes gridBeamSweep {
      0% { background-position: -100% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes slideOverEnter {
      from { transform: translateX(100%); opacity: 0.5; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOverOverlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes stepIndicatorPulse {
      0%, 100% { box-shadow: 0 0 0 0 ${c.accent}40; }
      50% { box-shadow: 0 0 0 6px ${c.accent}00; }
    }
    @keyframes diffLineSlideIn {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes auditEventIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes severityDot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes commandBtnShine {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* ── Data Grid ── */
    .flow-data-grid {
      border-radius: 12px;
      border: 1px solid ${c.border};
      background: ${c.surface};
      overflow: hidden;
    }
    .flow-data-grid-header {
      display: grid;
      align-items: center;
      padding: 10px 16px;
      background: ${c.surfaceAlt};
      border-bottom: 1.5px solid ${c.border};
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .flow-data-grid-header span {
      font-family: ${body};
      font-size: 13px;
      font-weight: 600;
      color: ${c.textMid};
      text-transform: none;
      letter-spacing: 0;
    }
    .flow-data-grid-row {
      display: grid;
      align-items: center;
      padding: 11px 16px;
      border-bottom: 1px solid ${c.border}60;
      position: relative;
      transition: background 0.15s;
    }
    .flow-data-grid-row:nth-child(even) {
      background: ${c.surfaceAlt}40;
    }
    .flow-data-grid-row:hover {
      background: ${c.accent}08;
    }
    .flow-data-grid-row:hover::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, ${c.accent}06 40%, ${c.accent}06 60%, transparent 100%);
      background-size: 200% 100%;
      animation: gridBeamSweep 1.2s ease-in-out;
      pointer-events: none;
    }

    /* ── Slide-over Panel ── */
    .flow-slide-over-overlay {
      animation: slideOverOverlayIn 0.2s ease both;
    }
    .flow-slide-over {
      animation: slideOverEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    /* ── Step Indicators ── */
    .flow-step-indicator {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 0 24px;
    }
    .flow-step-node {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ${mono};
      font-size: 11px;
      font-weight: 700;
      border: 2px solid ${c.border};
      background: ${c.surface};
      color: ${c.textMid};
      transition: background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
      cursor: pointer;
    }
    .flow-step-node-active {
      border-color: ${c.accent};
      background: ${c.accentDim};
      color: ${c.accent};
      animation: stepIndicatorPulse 2s ease-in-out infinite;
    }
    .flow-step-node-done {
      border-color: ${c.green};
      background: ${c.greenDim};
      color: ${c.green};
    }
    .flow-step-connector {
      flex: 1;
      height: 2px;
      background: ${c.border};
      min-width: 20px;
      transition: background 0.2s;
    }
    .flow-step-connector-done {
      background: ${c.green};
    }

    /* ── Simulation / Diff Viewer ── */
    .flow-diff-viewer {
      border-radius: 10px;
      border: 1px solid ${c.border};
      overflow: hidden;
      font-family: ${mono};
      font-size: 11px;
      background: ${c.surface};
    }
    .flow-diff-header {
      padding: 8px 14px;
      background: ${c.surfaceAlt};
      border-bottom: 1px solid ${c.border};
      color: ${c.textMid};
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .flow-diff-hunk {
      padding: 2px 14px;
      color: ${c.blue};
      font-size: 11px;
      background: ${c.blueDim || `${c.blue}10`};
      border-bottom: 1px solid ${c.border}40;
    }
    .flow-diff-line {
      padding: 3px 14px;
      animation: diffLineSlideIn 0.25s ease both;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .flow-diff-line-add {
      background: ${c.greenDim};
      color: ${c.green};
    }
    .flow-diff-line-del {
      background: ${c.redDim || `${c.red}10`};
      color: ${c.red};
      text-decoration: line-through;
    }
    .flow-diff-line-ctx {
      color: ${c.textDim};
    }

    /* ── Audit Event Stream ── */
    .flow-audit-stream {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 320px;
      overflow-y: auto;
    }
    .flow-audit-event {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      background: ${c.surfaceAlt};
      border: 1px solid ${c.border};
      animation: auditEventIn 0.3s ease both;
    }
    .flow-audit-timestamp {
      font-family: ${mono};
      font-size: 11px;
      color: ${c.bg};
      background: ${c.textMid};
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
      font-weight: 600;
    }
    .flow-audit-severity-info {
      color: ${c.blue};
    }
    .flow-audit-severity-warn {
      color: ${c.orange};
    }
    .flow-audit-severity-danger {
      color: ${c.red};
    }
    .flow-audit-severity-success {
      color: ${c.green};
    }
    .flow-audit-severity-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 6px;
    }
    .flow-audit-severity-dot-danger {
      background: ${c.red};
      animation: severityDot 1.5s ease infinite;
    }
    .flow-audit-severity-dot-warn {
      background: ${c.orange};
    }
    .flow-audit-severity-dot-success {
      background: ${c.green};
    }
    .flow-audit-severity-dot-info {
      background: ${c.blue};
    }

    /* ── Command Buttons ── */
    .flow-cmd-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid ${c.border};
      background: transparent;
      cursor: pointer;
      font-family: ${mono};
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: none;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .flow-cmd-btn:hover {
      border-color: ${c.borderHover};
      background: ${c.surfaceAlt};
    }
    .flow-cmd-btn:focus-visible {
      outline: 2px solid ${c.accent}80;
      outline-offset: 2px;
    }
    .flow-cmd-btn-edit {
      color: ${c.blue};
    }
    .flow-cmd-btn-edit:hover {
      border-color: ${c.blue}60;
      background: ${c.blue}10;
    }
    .flow-cmd-btn-archive {
      color: ${c.green};
    }
    .flow-cmd-btn-archive:hover {
      border-color: ${c.green}60;
      background: ${c.greenDim};
    }
    .flow-cmd-btn-delete {
      color: ${c.red};
    }
    .flow-cmd-btn-delete:hover {
      border-color: ${c.red}60;
      background: ${c.redDim || `${c.red}10`};
    }
    .flow-cmd-btn-reopen {
      color: ${c.orange};
    }
    .flow-cmd-btn-reopen:hover {
      border-color: ${c.orange}60;
      background: ${c.orangeDim || `${c.orange}10`};
    }

    /* ═══════════════════════════════════════════════════════════════
       TEXTURE LAYERS — applied to body/root
       ═══════════════════════════════════════════════════════════════ */

    /* Subtle dot grid — low-opacity background texture */
    .flow-texture-grid {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background-image: radial-gradient(circle, ${c.textDim}12 1px, transparent 1px);
      background-size: 24px 24px;
      animation: gridPulse ${motion.ambient.duration} ${motion.ambient.easing} infinite;
    }

    /* Volumetric glow blobs — ambient floating gradients */
    .flow-texture-blob {
      position: fixed;
      pointer-events: none;
      z-index: 0;
      border-radius: 50%;
      filter: blur(100px);
    }
    .flow-blob-1 {
      width: 500px; height: 500px;
      top: -15%; left: -10%;
      background: ${c.glow1 || "rgba(59,130,246,0.08)"};
      animation: blobDrift1 20s ${motion.ambient.easing} infinite;
    }
    .flow-blob-2 {
      width: 400px; height: 400px;
      bottom: -10%; right: -5%;
      background: ${c.glow2 || "rgba(34,211,238,0.05)"};
      animation: blobDrift2 25s ${motion.ambient.easing} infinite;
    }
    .flow-blob-3 {
      width: 350px; height: 350px;
      top: 40%; right: 20%;
      background: ${c.glow3 || "rgba(167,139,250,0.04)"};
      animation: blobDrift1 30s ${motion.ambient.easing} infinite reverse;
    }

    /* Noise film — subtle grain overlay */
    .flow-texture-noise {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      opacity: 0.025;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
      background-repeat: repeat;
      background-size: 256px 256px;
    }

    /* ═══════════════════════════════════════════════════════════════
       PAGE + ROW TRANSITIONS
       ═══════════════════════════════════════════════════════════════ */

    .flow-page {
      animation: fadeIn ${motion.interaction.duration} ${motion.interaction.easing} both;
      position: relative;
      z-index: 2;
    }

    .flow-row {
      transition: background ${motion.fast.duration} ${motion.fast.easing},
                  border-color ${motion.fast.duration} ${motion.fast.easing};
    }
    .flow-row:hover {
      background: ${c.surfaceAlt} !important;
      --row-bg: ${c.surfaceAlt};
    }
    .flow-row:active {
      transition-duration: ${motion.instant.duration};
    }
    .flow-row:focus-visible {
      outline: 2px solid ${c.accent};
      outline-offset: 2px;
      transition: outline-color ${motion.fast.duration} ${motion.fast.easing},
                  border-color ${motion.fast.duration} ${motion.fast.easing},
                  box-shadow ${motion.fast.duration} ${motion.fast.easing};
    }

    /* Subtle color transition for numeric/threshold displays and clickable IDs */
    .flow-color-tween {
      transition: color ${motion.fast.duration} ${motion.fast.easing};
    }
    .flow-proj-link {
      transition: color ${motion.fast.duration} ${motion.fast.easing},
                  filter ${motion.fast.duration} ${motion.fast.easing};
      border-radius: 2px;
    }
    .flow-proj-link:hover {
      filter: brightness(1.15);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .flow-proj-link:active {
      filter: brightness(0.9);
    }
    .flow-proj-link:focus-visible {
      outline: 2px solid ${c.accent};
      outline-offset: 2px;
    }

    /* Tag / outcome pill color + bg crossfade for threshold changes */
    .flow-pill-tween {
      transition: color ${motion.fast.duration} ${motion.fast.easing},
                  background ${motion.fast.duration} ${motion.fast.easing},
                  border-color ${motion.fast.duration} ${motion.fast.easing};
    }

    /* Activity/timeline row hover affordance */
    .flow-timeline-row {
      transition: background ${motion.fast.duration} ${motion.fast.easing};
    }
    .flow-timeline-row:hover {
      background: ${c.surfaceAlt};
    }

    /* Fade-in for detail-view swaps and section content */
    .flow-enter-fade {
      animation: fadeIn ${motion.normal.duration} ${motion.normal.easing} both;
    }
    .flow-enter-slide {
      animation: slideUp ${motion.normal.duration} ${motion.normal.easing} both;
    }

    /* Delayed loading placeholder — avoids flash on fast loads */
    @keyframes flowLoadingReveal {
      0%, 40% { opacity: 0; }
      100% { opacity: 1; }
    }
    .flow-loading-delayed {
      animation: flowLoadingReveal 500ms ${motion.normal.easing} both;
    }

    /* Custom dropdown items */
    .flow-dropdown-item:hover {
      background: ${c.accentDim} !important;
      color: ${c.accent} !important;
    }

    /* Week badge hover */
    .flow-week-badge:hover {
      border-color: ${c.accent}40 !important;
      background: ${c.accentDim} !important;
    }

    /* ═══════════════════════════════════════════════════════════════
       BUTTONS — interaction tier
       ═══════════════════════════════════════════════════════════════ */
    .flow-btn {
      transition: background ${motion.interaction.duration} ${motion.interaction.easing},
                  color ${motion.interaction.duration} ${motion.interaction.easing},
                  border-color ${motion.interaction.duration} ${motion.interaction.easing},
                  box-shadow ${motion.interaction.duration} ${motion.interaction.easing},
                  transform ${motion.interaction.duration} ${motion.interaction.easing};
    }
    .flow-btn:hover {
      filter: brightness(1.12);
    }
    .flow-btn:active {
      transform: scale(0.97);
      opacity: 0.9;
    }

    /* Critical button variant */
    .flow-btn-critical {
      animation: criticalPulse 2s ease-in-out infinite;
    }

    /* Lock flash — plays once on lock action */
    .flow-lock-flash {
      animation: lockFlash 0.6s ${motion.critical.easing} both;
    }

    /* Shake — error feedback */
    .flow-shake {
      animation: shakeX 0.3s ${motion.critical.easing};
    }

    /* ═══════════════════════════════════════════════════════════════
       INPUTS — interaction tier
       ═══════════════════════════════════════════════════════════════ */
    .flow-input {
      transition: border-color ${motion.interaction.duration} ${motion.interaction.easing},
                  box-shadow ${motion.interaction.duration} ${motion.interaction.easing};
    }
    .flow-input:focus {
      border-color: ${c.accent} !important;
      box-shadow: 0 0 0 3px ${c.accentDim};
    }

    /* ═══════════════════════════════════════════════════════════════
       EXPAND ANIMATION
       ═══════════════════════════════════════════════════════════════ */
    .flow-expand {
      animation: slideDown 0.2s ${motion.interaction.easing} both;
    }

    /* ═══════════════════════════════════════════════════════════════
       KEYBOARD FOCUS — terminal-like bracket highlight
       [ ] brackets on focused element with scanline feel
       ═══════════════════════════════════════════════════════════════ */
    .flow-kb-focus {
      position: relative;
      outline: none !important;
      border-color: ${c.accent}50 !important;
      box-shadow: 0 0 0 1px ${c.accent}20, inset 0 0 0 1px ${c.accent}10 !important;
    }
    .flow-kb-focus::before,
    .flow-kb-focus::after {
      content: '';
      position: absolute;
      width: 10px; height: 10px;
      border: 1.5px solid ${c.accent};
      pointer-events: none;
      z-index: 5;
      opacity: 0.6;
    }
    .flow-kb-focus::before {
      top: -2px; left: -2px;
      border-right: none; border-bottom: none;
      border-radius: 3px 0 0 0;
    }
    .flow-kb-focus::after {
      bottom: -2px; right: -2px;
      border-left: none; border-top: none;
      border-radius: 0 0 3px 0;
    }

    /* ═══════════════════════════════════════════════════════════════
       HEADER — sharp futuristic bar
       ═══════════════════════════════════════════════════════════════ */
    .flow-header {
      box-shadow: 0 1px 12px rgba(0,0,0,0.15), 0 1px 0 ${c.border};
    }
    .flow-logo-group:hover {
      opacity: 0.85;
    }
    .flow-header-tab {
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
    }
    .flow-header-tab:hover {
      background: ${c.surface} !important;
      color: ${c.text} !important;
    }
    .flow-header-cta {
      transition: background 0.15s ease, color 0.15s ease, filter 0.15s ease, transform 0.15s ease !important;
    }
    .flow-header-cta:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }
    .flow-search-trigger:hover {
      border-color: ${c.borderHover} !important;
      background: ${c.surface} !important;
    }
    .flow-theme-toggle:hover {
      border-color: ${c.borderHover} !important;
    }

    /* ═══════════════════════════════════════════════════════════════
       BREADCRUMB + NAV
       ═══════════════════════════════════════════════════════════════ */
    .flow-breadcrumb:hover {
      color: #FFFFFF !important;
      text-decoration: none;
    }
    .flow-nav-item:hover {
      background: ${c.surfaceAlt} !important;
    }

    /* ═══════════════════════════════════════════════════════════════
       SEARCH HINT
       ═══════════════════════════════════════════════════════════════ */
    .flow-search-hint {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      color: ${c.textMid};
      background: ${c.surfaceAlt};
      border: 1px solid ${c.border};
      padding: 1px 6px;
      border-radius: 3px;
      pointer-events: none;
      opacity: 0.7;
    }

    /* ═══════════════════════════════════════════════════════════════
       SCROLLBAR + SELECTION
       ═══════════════════════════════════════════════════════════════ */
    * { scrollbar-width: thin; scrollbar-color: ${c.border} transparent; }
    *::-webkit-scrollbar { width: 5px; height: 5px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: ${c.border}; border-radius: 3px; }
    *::-webkit-scrollbar-thumb:hover { background: ${c.borderHover}; }
    ::selection { background: ${c.accentMid}; color: ${c.text}; }
    input::placeholder, textarea::placeholder { color: ${c.textDim}; opacity: 0.6; }

    /* ═══════════════════════════════════════════════════════════════
       COMMAND PALETTE — FUTURISTIC SEARCH OVERLAY
       ═══════════════════════════════════════════════════════════════ */

    @keyframes cmdBorderGlow {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    @keyframes cmdSearchPulse {
      0%, 100% { box-shadow: 0 0 6px ${c.accent}20; }
      50% { box-shadow: 0 0 14px ${c.accent}40; }
    }
    @keyframes cmdSlideUp {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .flow-cmd-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      z-index: 200;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 13vh;
      animation: fadeIn 0.12s ${motion.interaction.easing} both;
    }

    .flow-cmd-box {
      width: 600px;
      max-height: 540px;
      background: linear-gradient(180deg, ${c.surfaceSolid} 0%, ${c.bg} 100%);
      border: 1px solid ${c.borderHover};
      border-radius: 18px;
      box-shadow:
        0 30px 100px rgba(0,0,0,0.7),
        0 0 80px ${c.accentDim},
        0 0 1px rgba(0,0,0,0.08),
        inset 0 1px 0 rgba(0,0,0,0.04);
      overflow: hidden;
      animation: scaleIn 0.15s ${motion.interaction.easing} both;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    /* ── Top accent bar (Steel & Orange — flat, not pulsing) ── */
    .flow-cmd-topbar {
      height: 2px;
      background: ${c.accent};
      flex-shrink: 0;
    }

    /* ── Search input ── */
    .flow-cmd-input {
      border: none;
      background: transparent;
      color: ${c.text};
      outline: none;
      caret-color: ${c.accent};
    }
    .flow-cmd-input::placeholder { color: ${c.textDim}; opacity: 0.45; }

    /* ── Search glow indicator ── */
    .flow-cmd-search-glow {
      animation: cmdSearchPulse 2.5s ease-in-out infinite;
      transition: background 0.2s ease, opacity 0.2s ease;
    }

    /* ── Results list ── */
    .flow-cmd-results {
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: ${c.border} transparent;
    }
    .flow-cmd-results::-webkit-scrollbar { width: 4px; }
    .flow-cmd-results::-webkit-scrollbar-track { background: transparent; }
    .flow-cmd-results::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, ${c.accent}40, ${c.purple}40);
      border-radius: 2px;
    }

    /* ── Result items ── */
    .flow-cmd-item {
      transition: background 0.1s ease, color 0.1s ease, border-color 0.1s ease;
      animation: cmdSlideUp 0.12s ${motion.interaction.easing} both;
    }
    .flow-cmd-active {
      z-index: 1;
    }

    /* ── Category pills ── */
    .flow-cmd-category-pill {
      transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
      position: relative;
      overflow: hidden;
    }
    .flow-cmd-category-pill:hover {
      background: ${c.surface} !important;
      color: ${c.textMid} !important;
      transform: translateY(-1px);
    }

    /* ── Section headers ── */
    .flow-cmd-section-header {
      user-select: none;
      animation: cmdSlideUp 0.15s ${motion.interaction.easing} both;
    }

    /* ═══════════════════════════════════════════════════════════════
       DENSITY
       ═══════════════════════════════════════════════════════════════ */
    .flow-compact .flow-row { padding: 6px 10px !important; }
    .flow-compact td, .flow-compact th { padding: 5px 8px !important; font-size: 12px !important; }

    /* ═══════════════════════════════════════════════════════════════
       CONTEXT HINTS
       ═══════════════════════════════════════════════════════════════ */
    .flow-context-hint {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: ${c.textMid};
      opacity: 0;
      transition: opacity ${motion.interaction.duration};
      pointer-events: none;
    }
    *:hover > .flow-context-hint,
    *:focus-within > .flow-context-hint,
    .flow-kb-focus .flow-context-hint {
      opacity: 0.7;
    }

    /* ═══════════════════════════════════════════════════════════════
       MOBILE
       ═══════════════════════════════════════════════════════════════ */
    @media (max-width: 640px) {
      .flow-page { padding: 12px 16px 80px !important; }
      .flow-hide-mobile { display: none !important; }
      .flow-texture-grid, .flow-texture-blob, .flow-texture-noise { display: none; }
      .flow-cmd-box { width: 95vw; }
    }

    /* ── No decorative motion in header ── */
    header .flow-glass,
    header .flow-card {
      animation: none !important;
      transform: none !important;
    }

    /* ═══════════════════════════════════════════════════════════════
       STEEL & ORANGE OVERRIDES — neutralize the dark-era decorative
       effects. The structural keyframes above (fadeInUp, rowSlideIn,
       entrance/exit) are kept; glow/blob/grid/neon layers are killed
       since Steel & Orange relies on shadows, not glow.
       ═══════════════════════════════════════════════════════════════ */
    .flow-texture-blob,
    .flow-texture-grid,
    .flow-texture-noise {
      display: none !important;
      animation: none !important;
    }
    .flow-neon-card::before,
    .flow-neon-card.flow-neon-active { box-shadow: none !important; animation: none !important; }
    .flow-neon-card { box-shadow: var(--flow-shadow-card) !important; }

    /* Kill neon-edge border animations on mission grid — shadow-card does the lifting now */
    .flow-mission-grid {
      animation: none !important;
    }

    /* Side panel gets light-mode treatment overriding any dark artifacts */
    .flow-side-panel {
      background: var(--flow-card) !important;
      border-left: 1px solid var(--flow-border-subtle) !important;
      box-shadow: var(--flow-shadow-elevated) !important;
    }

    /* Kill infinite decorative loops on functional UI. Each of these was
       flagged by motion review as attention-grabbing forever with no user
       trigger — incompatible with the Steel & Orange "shadows not glows"
       rule, and a perf tax on list-heavy views (Pulse/Projects/People). */
    .flow-command-card::before,
    .flow-phase-node-active,
    .flow-timeline-marker,
    .flow-timeline-overdue .flow-timeline-fill::after,
    .flow-overdue-emergency,
    .flow-escalation-chip,
    .flow-momentum-up,
    .flow-momentum-down,
    .flow-signal-info,
    .flow-signal-warning,
    .flow-signal-critical,
    .flow-cmd-search-glow,
    .flow-neon-card.flow-neon-active,
    .flow-energy-bar-glow,
    .flow-step-indicator-pulse,
    .flow-severity-dot {
      animation: none !important;
    }
    /* Turn the removed glow states into flat borders / solid fills so the
       visual intent (highlight) survives without the pulse. */
    .flow-phase-node-active { box-shadow: 0 0 0 2px currentColor !important; }
    .flow-overdue-emergency { border-color: var(--flow-accent) !important; }

    /* CRT scanline + blinking block cursor belong only inside TerminalView.
       Any callers that applied these outside Terminal (PeopleDeepDive /
       ProjectsView detail panes) are neutered here; TerminalView renders
       inside its own component tree with these classes intact. */
    :not(.flow-terminal-root) .flow-terminal-log::before,
    :not(.flow-terminal-root) .flow-terminal-cursor {
      animation: none !important;
    }

    /* ═══════════════════════════════════════════════════════════════
       REDUCED MOTION — respect OS preference
       ═══════════════════════════════════════════════════════════════ */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      .flow-texture-blob { display: none; }
    }
  `}</style>
);

export default AnimStyles;
