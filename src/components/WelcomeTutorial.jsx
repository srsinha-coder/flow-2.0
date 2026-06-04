// Flow — Post-login Welcome + Profile Setup + Guided Tutorial
// Welcome → Profile setup → 8-step spotlight tutorial

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { c, body, mono, typo, layout, motion, space } from "../styles/theme";
import FlowLogo from "./FlowLogo";

const STEPS = [
  {
    target: "[data-tour='my-lens']",
    title: "My Lens",
    desc: "Toggle My Lens to filter everything to your squad and followed projects. Your personalized view of what matters.",
    position: "bottom",
    context: "list",
    spotlightPadding: 8,
    spotlightRadius: 22,
    spotlightStroke: "#fff",
  },
  {
    target: "[data-tour='add-project']",
    title: "Add a Project",
    desc: "Tap the + button to create a project. Give it a name, description, complexity, and target dates.",
    position: "top",
    context: "list",
  },
  {
    target: "[data-tour='project-row']",
    title: "View Project",
    desc: "Tap any project row to open its full detail — shown next. Track status, owner, and timeline at a glance.",
    position: "bottom",
    context: "list",
    spotlightPadding: 4,
    cursorTap: true,
  },
  {
    target: "[data-tour='project-hero']",
    title: "Edit Project",
    desc: "Update status, dates, links, and team members. Everything about a project lives here, in one place.",
    position: "bottom",
    context: "detail",
  },
  {
    target: "[data-tour='follow-project']",
    title: "Follow Project",
    desc: "Follow a project to stay updated with its latest activity in My Lens.",
    position: "bottom",
    context: "detail",
    spotlightPadding: 14,
  },
  {
    target: "[data-tour='track-gantt']",
    title: "Manage Tracks",
    desc: "Manage parallel tracks like PRD, Design, Dev, and QA. Start, complete, or reopen tracks anytime.",
    position: "bottom",
    context: "detail",
  },
  {
    target: "[data-tour='activity']",
    title: "Post Updates",
    desc: "Post weekly updates, comments, and tag teammates. Keep everyone in the loop without switching tools.",
    position: "top",
    context: "detail",
  },
  {
    target: "[data-tour='guide-tab']",
    title: "Learn More",
    desc: "View more on how Flow keeps your projects up to date and your teams informed.",
    position: "bottom",
    context: "list",
    spotlightPadding: 8,
    spotlightRadius: 22,
    spotlightStroke: "#fff",
    spotlightMaxHeight: 20,
  },
];

// ── Blurred backdrop with a rectangular hole over the target ──
// Four backdrop-blur strips around the cutout keep the highlighted element
// sharp while blurring everything else. Falls back to a full-screen blur
// when there's no target (transitions).
function BlurBackdrop({ rect, padding = 10 }) {
  const blur = { backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", position: "fixed", zIndex: 9996, pointerEvents: "none" };
  if (!rect) {
    return <div style={{ ...blur, inset: 0 }} />;
  }
  const p = padding;
  const x = rect.left - p;
  const y = rect.top - p;
  const w = rect.width + p * 2;
  const h = rect.height + p * 2;
  return (
    <>
      <div style={{ ...blur, left: 0, top: 0, width: "100vw", height: Math.max(0, y) }} />
      <div style={{ ...blur, left: 0, top: y + h, width: "100vw", height: `calc(100vh - ${y + h}px)` }} />
      <div style={{ ...blur, left: 0, top: y, width: Math.max(0, x), height: h }} />
      <div style={{ ...blur, left: x + w, top: y, width: `calc(100vw - ${x + w}px)`, height: h }} />
    </>
  );
}

// ── Animated cursor that taps the highlighted element ──
function CursorTap({ rect }) {
  if (!rect) return null;
  const cx = rect.left + Math.min(rect.width * 0.5, 160);
  const cy = rect.top + rect.height / 2;
  return (
    <div style={{ position: "fixed", left: cx, top: cy, zIndex: 10000, pointerEvents: "none" }}>
      {/* Tap ripple */}
      <div style={{
        position: "absolute", left: -2, top: -2, width: 30, height: 30,
        borderRadius: "50%", border: `2px solid ${c.accent}`,
        transform: "translate(-50%, -50%)",
        animation: "tourTapRipple 1.4s ease-out infinite",
      }} />
      {/* Cursor pointer */}
      <div style={{ animation: "tourCursorTap 1.4s ease-in-out infinite" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}>
          <path d="M5 3l4.5 16 2.5-6.5L18.5 10z" />
        </svg>
      </div>
    </div>
  );
}

// ── Spotlight overlay with cutout ──
// A single positioned div uses an enormous box-shadow to darken everything
// outside its bounds, creating a "hole" effect over the target element.
function Spotlight({ rect, padding = 10, radius = 14, stroke = null }) {
  const p = padding;
  const r = radius;

  // If no rect, show full dark overlay without cutout
  if (!rect) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.55)",
        pointerEvents: "none",
      }} />
    );
  }

  const x = rect.left - p;
  const y = rect.top - p;
  const w = rect.width + p * 2;
  const h = rect.height + p * 2;
  const ringColor = stroke || c.accent;

  // Build box-shadow: accent ring + optional white stroke + dark overlay
  const shadows = [
    `0 0 0 2px ${ringColor}`,
    `0 0 0 9999px rgba(0,0,0,0.55)`,
  ];

  return (
    <>
      {/* Dark overlay with cutout */}
      <div style={{
        position: "fixed",
        left: x, top: y, width: w, height: h,
        zIndex: 9998,
        borderRadius: r,
        boxShadow: shadows.join(", "),
        pointerEvents: "none",
        animation: "spotlightFadeIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
        transition: "left 0.3s cubic-bezier(0.22,1,0.36,1), top 0.3s cubic-bezier(0.22,1,0.36,1), width 0.3s cubic-bezier(0.22,1,0.36,1), height 0.3s cubic-bezier(0.22,1,0.36,1)",
      }} />
    </>
  );
}

// ── Tooltip card ──
function TourTooltip({ step, stepIdx, totalSteps, rect, onNext, onBack, onSkip, onFinish }) {
  const isLast = stepIdx === totalSteps - 1;
  const isFirst = stepIdx === 0;
  const pos = step.position || "bottom";

  let style = {
    position: "fixed", zIndex: 9999,
    width: 340, maxWidth: "calc(100vw - 32px)",
    background: c.surfaceSolid,
    border: `1px solid ${c.border}`,
    borderRadius: layout.radiusLg,
    boxShadow: "0 16px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)",
    padding: space[5],
    animation: "tourReveal 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
  };

  const tooltipRef = useRef(null);
  const [tooltipH, setTooltipH] = useState(240);
  useEffect(() => {
    if (tooltipRef.current) {
      const h = tooltipRef.current.offsetHeight;
      if (h > 0) setTooltipH(h);
    }
  });

  if (rect) {
    const cx = rect.left + rect.width / 2;
    const tooltipW = 340;
    const vh = window.innerHeight;
    let left = cx - tooltipW / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipW - 16));

    if (pos === "bottom") {
      const proposedTop = rect.bottom + 16;
      if (proposedTop + tooltipH > vh - 16 && rect.top > tooltipH + 32) {
        // Flip above
        style.top = rect.top - 16 - tooltipH;
        style.left = left;
      } else if (proposedTop + tooltipH > vh - 16) {
        // Neither fits cleanly — clamp to bottom of viewport
        style.top = vh - tooltipH - 16;
        style.left = left;
      } else {
        style.top = proposedTop;
        style.left = left;
      }
    } else {
      const proposedBottom = rect.top - 16;
      const proposedTop = proposedBottom - tooltipH;
      if (proposedTop < 16 && rect.bottom + 16 + tooltipH <= vh - 16) {
        // Flip below
        style.top = rect.bottom + 16;
        style.left = left;
      } else if (proposedTop < 16) {
        // Neither fits — clamp to bottom of viewport
        style.top = vh - tooltipH - 16;
        style.left = left;
      } else {
        style.top = proposedTop;
        style.left = left;
      }
    }
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    style.top = Math.max(16, (vh - tooltipH) / 2);
    style.left = Math.max(16, (vw - 340) / 2);
  }

  return (
    <div ref={tooltipRef} data-tour-tooltip style={style}>
      {/* Step counter */}
      <div style={{
        display: "flex", alignItems: "center",
        marginBottom: space[3],
      }}>
        <span style={{
          fontFamily: mono, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.06em", color: c.accent,
        }}>
          STEP {stepIdx + 1} OF {totalSteps}
        </span>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 4, marginBottom: space[4] }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= stepIdx ? c.accent : c.surfaceAlt,
            transition: "background 0.3s ease",
          }} />
        ))}
      </div>

      {/* Title */}
      <div style={{
        fontFamily: typo.displaySm.font, fontSize: typo.displaySm.size,
        fontWeight: typo.displaySm.weight, color: c.text,
        marginBottom: space[2],
      }}>{step.title}</div>

      {/* Description */}
      <div style={{
        fontFamily: typo.bodyMd.font, fontSize: typo.bodyMd.size,
        color: c.textMid, lineHeight: 1.55, marginBottom: space[5],
      }}>{step.desc}</div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {!isFirst ? (
          <button
            onClick={onBack}
            style={{
              padding: `${space[2]}px ${space[4]}px`,
              borderRadius: layout.radiusSm,
              border: `1px solid ${c.border}`,
              background: "transparent",
              color: c.textMid,
              fontFamily: typo.bodyMd.font, fontSize: 13, fontWeight: 500,
              cursor: "pointer",
              transition: `border-color ${motion.fast.duration} ${motion.fast.easing}`,
            }}
          >Back</button>
        ) : <div />}
        <button
          onClick={isLast ? onFinish : onNext}
          style={{
            padding: `${space[2]}px ${space[5]}px`,
            borderRadius: layout.radiusSm,
            border: "none",
            background: c.accent,
            color: c.textOnAccent || "#fff",
            fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 600,
            cursor: "pointer",
            transition: `background ${motion.fast.duration} ${motion.fast.easing}`,
          }}
        >{isLast ? "Start using Flow" : "Next"}</button>
      </div>
    </div>
  );
}


// ── Welcome screen (before tutorial) ──
function WelcomeScreen({ onStart, onSkip }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <div style={{
        width: 440, maxWidth: "calc(100vw - 48px)",
        background: c.surfaceSolid,
        borderRadius: layout.radiusXl || layout.radiusLg,
        boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.1)",
        padding: `${space[8]}px ${space[7]}px`,
        textAlign: "center",
        animation: "fadeScaleIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: space[5], display: "flex", justifyContent: "center" }}>
          <FlowLogo size={64} />
        </div>

        {/* Title */}
        <div style={{
          fontFamily: typo.displayLg.font, fontSize: 26, fontWeight: 700,
          letterSpacing: "-0.02em", color: c.text, lineHeight: 1.2,
          marginBottom: space[3],
        }}>
          Welcome to Flow
        </div>

        {/* Subtitle */}
        <div style={{
          fontFamily: typo.bodyMd.font, fontSize: 15,
          color: c.textMid, lineHeight: 1.6,
          marginBottom: space[6], maxWidth: 340, margin: `0 auto ${space[6]}px`,
        }}>
          Easily manage your projects and keep every update in one place. Track progress, collaborate with your team, and ship with confidence.
        </div>

        {/* Feature pills */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: space[2],
          justifyContent: "center", marginBottom: space[7],
        }}>
          {["Track Projects", "Manage Tracks", "Add Resources", "Post Updates", "Announce Releases"].map(f => (
            <span key={f} style={{
              padding: `${space[1] + 1}px ${space[3]}px`,
              borderRadius: 999,
              background: "rgba(0,0,0,0.04)",
              border: "none",
              fontFamily: typo.bodySm.font, fontSize: 12, fontWeight: 500,
              color: c.textMid,
            }}>{f}</span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          style={{
            width: "100%", height: 48,
            borderRadius: layout.radiusSm,
            border: "none",
            background: c.accent,
            color: c.textOnAccent || "#fff",
            fontFamily: typo.bodyMd.font, fontSize: 16, fontWeight: 700,
            cursor: "pointer",
            boxShadow: c.shadowCard,
            transition: `background ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}`,
            marginBottom: space[3],
          }}
        >
          Yalla!
        </button>

        {/* Skip link removed — onboarding is the only path */}
      </div>
    </div>
  );
}


// ── Profile setup screen (after welcome, before tour) ──
function ProfileSetup({ userName, squads, roles, onConfirm }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedSquad, setSelectedSquad] = useState("");

  const initials = (userName || "?")
    .split(" ")
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const firstName = (userName || "there").split(" ")[0];

  const selectStyle = {
    width: "100%",
    boxSizing: "border-box",
    height: 44,
    borderRadius: layout.radiusSm,
    border: `1px solid ${c.border}`,
    background: "#FFFFFF",
    fontFamily: typo.bodyMd.font,
    fontSize: 14,
    color: c.text,
    padding: `0 ${space[3]}px`,
    paddingRight: 32,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    colorScheme: "light",
    textOverflow: "ellipsis",
  };

  const labelStyle = {
    fontFamily: typo.bodySm.font,
    fontSize: 12,
    fontWeight: 600,
    color: c.textMid,
    letterSpacing: "0.03em",
    marginBottom: 6,
    display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <div style={{
        width: 400, maxWidth: "calc(100vw - 48px)",
        background: c.surfaceSolid,
        borderRadius: layout.radiusXl || layout.radiusLg,
        boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.1)",
        padding: `${space[7]}px ${space[7]}px ${space[6]}px`,
        textAlign: "center",
        animation: "fadeScaleIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}>
        {/* Avatar circle */}
        <div style={{
          width: 72, height: 72,
          borderRadius: "50%",
          background: c.accent,
          color: c.textOnAccent || "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: typo.displaySm.font,
          fontSize: 26, fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: `0 auto ${space[4]}px`,
        }}>
          {initials}
        </div>

        {/* Greeting */}
        <div style={{
          fontFamily: typo.displayLg.font, fontSize: 22, fontWeight: 700,
          letterSpacing: "-0.02em", color: c.text, lineHeight: 1.2,
          marginBottom: space[2],
        }}>
          Hi, {firstName}!
        </div>

        <div style={{
          fontFamily: typo.bodyMd.font, fontSize: 14,
          color: c.textMid, lineHeight: 1.5,
          marginBottom: space[6],
        }}>
          Quick setup so we can personalize your experience.
        </div>

        {/* Form */}
        <div style={{ textAlign: "left", marginBottom: space[5], width: "100%" }}>
          {/* Role */}
          <div style={{ marginBottom: space[4] }}>
            <label style={labelStyle}>YOUR ROLE</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                ...selectStyle,
                color: selectedRole ? c.text : c.textDim,
              }}
            >
              <option value="" disabled>Select your role</option>
              {(roles || []).map(r => {
                const label = typeof r === "string" ? r : r.name;
                const val = typeof r === "string" ? r : (r.id || r.name);
                return <option key={val} value={val}>{label}</option>;
              })}
            </select>
          </div>

          {/* Squad */}
          <div>
            <label style={labelStyle}>YOUR SQUAD <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></label>
            <select
              value={selectedSquad}
              onChange={(e) => setSelectedSquad(e.target.value)}
              style={{
                ...selectStyle,
                color: selectedSquad ? c.text : c.textDim,
              }}
            >
              <option value="">No squad</option>
              {(squads || []).map(s => {
                const label = typeof s === "string" ? s : s.name;
                const val = typeof s === "string" ? s : (s.id || s.name);
                return <option key={val} value={val}>{label}</option>;
              })}
            </select>
          </div>
        </div>

        {/* Confirm — disabled until role is selected */}
        <button
          disabled={!selectedRole}
          onClick={() => onConfirm({ role: selectedRole, squad: selectedSquad })}
          style={{
            width: "100%", height: 48,
            borderRadius: layout.radiusSm,
            border: "none",
            background: selectedRole ? c.accent : c.surfaceAlt,
            color: selectedRole ? (c.textOnAccent || "#fff") : c.textDim,
            fontFamily: typo.bodyMd.font, fontSize: 15, fontWeight: 700,
            cursor: selectedRole ? "pointer" : "not-allowed",
            boxShadow: selectedRole ? c.shadowCard : "none",
            transition: `background ${motion.fast.duration} ${motion.fast.easing}, color ${motion.fast.duration} ${motion.fast.easing}`,
            opacity: selectedRole ? 1 : 0.7,
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}


// ── Main Tutorial Controller ──
export default function WelcomeTutorial({ onComplete, onStartTour, onOpenProject, onBackToList, squads, roles, userName, projects }) {
  const [phase, setPhase] = useState("welcome"); // "welcome" | "profile" | "touring" | "done"
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const pollRef = useRef(null);
  const transitionTimer = useRef(null);

  // Find, scroll into view, and measure target element.
  // When `scrollOnly` is true we scroll but don't reveal the spotlight yet.
  const measureTarget = useCallback((selector, scrollOnly = false) => {
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;

      // Skip scroll for fixed/sticky elements — scrolling won't move them
      const pos = window.getComputedStyle(el).position;
      const isFixed = pos === "fixed" || pos === "sticky";

      if (scrollOnly) {
        if (!isFixed) {
          const tooltipRoom = 280;
          const topPad = 140; // generous padding above element for sticky headers
          const visibleBottom = Math.min(rect.bottom, rect.top + vh - topPad - tooltipRoom);
          const needsScroll = rect.top < topPad || visibleBottom + tooltipRoom > vh || rect.top > vh - 100;
          if (needsScroll) {
            const scrollTarget = window.scrollY + rect.top - topPad;
            window.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
          }
        }
        return true;
      }

      // Phase 2: measure final position and reveal
      const finalRect = el.getBoundingClientRect();
      setTargetRect(finalRect);
      return true;
    }
    return false;
  }, []);

  // Navigate between list and detail views as steps require
  const currentContextRef = useRef(null);
  useEffect(() => {
    if (phase !== "touring") return;
    const step = STEPS[stepIdx];
    if (!step) return;

    if (step.context === "detail" && currentContextRef.current !== "detail" && onOpenProject) {
      // Prefer the project shown in the highlighted list row so the detail
      // page name matches the row the user just saw.
      const rowEl = document.querySelector("[data-tour='project-row']");
      const rowId = rowEl?.__projId;
      const target = (rowId && (projects || []).find(p => p.id === rowId))
        || (projects || []).find(p => p.status === "in_flight" || p.status === "active");
      if (target) {
        currentContextRef.current = "detail";
        onOpenProject(target.id);
      }
    } else if (step.context === "list" && currentContextRef.current === "detail" && onBackToList) {
      // Return to list view for list-context steps
      currentContextRef.current = "list";
      onBackToList();
    }
  }, [phase, stepIdx, onOpenProject, onBackToList, projects]);

  // Poll for target when step changes — two-phase: scroll first, then reveal
  useEffect(() => {
    if (phase !== "touring") return;
    const step = STEPS[stepIdx];
    if (!step) return;

    // Start transition: hide tooltip, show only dark overlay
    setTargetRect(null);
    setTransitioning(true);
    if (transitionTimer.current) clearTimeout(transitionTimer.current);

    // Phase 1: find element and scroll to it (without showing spotlight)
    const tryScrollAndReveal = () => {
      const found = measureTarget(step.target, /* scrollOnly */ true);
      if (!found) return false;

      // Phase 2: after scroll settles, measure final position and reveal
      transitionTimer.current = setTimeout(() => {
        measureTarget(step.target, /* scrollOnly */ false);
        setTransitioning(false);
      }, 300); // wait for smooth scroll to finish
      return true;
    };

    // Try immediately, then poll if element not in DOM yet
    if (tryScrollAndReveal()) return;

    let tries = 0;
    pollRef.current = setInterval(() => {
      tries++;
      if (tryScrollAndReveal() || tries > 30) {
        clearInterval(pollRef.current);
        if (tries > 30) setTransitioning(false);
      }
    }, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [phase, stepIdx, measureTarget]);

  // Re-measure on scroll/resize (rect position only, no scrolling)
  const transitioningRef = useRef(false);
  transitioningRef.current = transitioning;
  useEffect(() => {
    if (phase !== "touring") return;
    const step = STEPS[stepIdx];
    if (!step) return;

    const handler = () => {
      // Don't re-measure during transitions — scroll is still settling
      if (transitioningRef.current) return;
      const el = document.querySelector(step.target);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [phase, stepIdx]);

  // Lock background scroll for entire tutorial duration (all phases except done)
  useEffect(() => {
    if (phase !== "done") {
      document.body.style.overflow = "hidden";
      // Also block wheel/touch events from reaching the page
      const blockScroll = (e) => {
        // Allow scrolling inside tooltip cards (if any)
        if (e.target.closest?.('[data-tour-tooltip]')) return;
        e.preventDefault();
      };
      document.addEventListener("wheel", blockScroll, { passive: false });
      document.addEventListener("touchmove", blockScroll, { passive: false });
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("wheel", blockScroll);
        document.removeEventListener("touchmove", blockScroll);
      };
    }
  }, [phase]);

  const finish = useCallback(() => {
    // Show loader → call onComplete (resets view) → reveal page
    setPhase("finishing");
    try { localStorage.setItem("flow_tutorial_seen", "1"); } catch {}

    // After loader shows for a beat, reset app state and start reveal
    setTimeout(() => {
      onComplete();
      // Small delay to let the DOM settle after onComplete resets the view
      setTimeout(() => {
        setPhase("reveal");
        // Clean up after fade-out animation completes
        setTimeout(() => {
          setPhase("done");
        }, 600);
      }, 100);
    }, 1200);
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(i => i + 1);
    } else {
      finish();
    }
  }, [stepIdx, finish]);

  const handleBack = useCallback(() => {
    if (stepIdx > 0) {
      setStepIdx(i => i - 1);
    }
  }, [stepIdx]);

  if (phase === "done") return null;

  // Full-screen loader with logo
  if (phase === "finishing") {
    return ReactDOM.createPortal(
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: c.surfaceSolid,
        animation: "fadeIn 0.3s ease both",
      }}>
        <div style={{ animation: "logoBreath 1.2s ease-in-out infinite" }}>
          <FlowLogo size={56} />
        </div>
        <div style={{
          marginTop: 20,
          fontFamily: typo.bodyMd.font, fontSize: 14, fontWeight: 500,
          color: c.textDim, letterSpacing: "0.02em",
        }}>
          Setting up your workspace...
        </div>
      </div>,
      document.body
    );
  }

  // Reveal phase — loader fades out to show the page beneath
  if (phase === "reveal") {
    return ReactDOM.createPortal(
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: c.surfaceSolid,
        pointerEvents: "none",
        animation: "loaderFadeOut 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both",
      }} />,
      document.body
    );
  }

  if (phase === "welcome") {
    return ReactDOM.createPortal(
      <WelcomeScreen
        onStart={() => setPhase("profile")}
        onSkip={finish}
      />,
      document.body
    );
  }

  if (phase === "profile") {
    return ReactDOM.createPortal(
      <ProfileSetup
        userName={userName}
        squads={squads}
        roles={roles}
        onConfirm={() => {
          if (onStartTour) onStartTour();
          setPhase("touring");
        }}
      />,
      document.body
    );
  }

  // Touring phase
  const step = STEPS[stepIdx];

  // Effective cutout rect (accounts for spotlightMaxHeight clamping)
  const cutoutRect = transitioning ? null : (step.spotlightMaxHeight && targetRect && targetRect.height > step.spotlightMaxHeight
    ? { left: targetRect.left, top: targetRect.top + (targetRect.height - step.spotlightMaxHeight) / 2, width: targetRect.width, height: step.spotlightMaxHeight }
    : targetRect);

  return ReactDOM.createPortal(
    <>
      {/* Blurred backdrop with a sharp hole over the target */}
      <BlurBackdrop rect={cutoutRect} padding={step.spotlightPadding ?? 10} />
      {/* Click blocker behind spotlight */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9997 }}
        onClick={(e) => e.stopPropagation()}
      />
      <Spotlight
        rect={cutoutRect}
        padding={step.spotlightPadding}
        radius={step.spotlightRadius}
        stroke={step.spotlightStroke}
      />
      {/* Animated cursor tap (e.g. "tap a row to open detail") */}
      {!transitioning && step.cursorTap && <CursorTap rect={cutoutRect} />}
      {!transitioning && (
        <TourTooltip
          step={step}
          stepIdx={stepIdx}
          totalSteps={STEPS.length}
          rect={targetRect}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={finish}
          onFinish={finish}
        />
      )}
    </>,
    document.body
  );
}
