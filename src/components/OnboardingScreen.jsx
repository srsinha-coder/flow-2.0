// Flow — Onboarding Screen (Steel & Orange)
// First-login flow: user fills in name, squad, role → creates their people record

import React, { useState, useEffect } from "react";
import { c, body, mono, typo, layout, motion, space } from "../styles/theme";
import { selChevron } from "./shared";
import { supabase } from "../lib/supabase";
import FlowLogo from "./FlowLogo";
import useDevLabel from "../hooks/useDevLabel";

export default function OnboardingScreen({ user, onComplete }) {
  const devRef = useDevLabel("OnboardingScreen", "src/components/OnboardingScreen.jsx", "First-login onboarding form for name, squad, and role selection");
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [squadId, setSquadId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [squads, setSquads] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sq, ro] = await Promise.all([
          supabase.from("squads").select("id, name").order("name"),
          supabase.from("roles").select("id, name").order("name"),
        ]);
        if (sq.data) setSquads(sq.data);
        if (ro.data) setRoles(ro.data);
        if (sq.error || ro.error) setError("Failed to load options. Please refresh.");
      } catch (err) {
        setError("Failed to load options. Please refresh.");
      } finally {
        setLoadingDropdowns(false);
      }
    })();
  }, []);

  const canSubmit = name.trim().length >= 2 && squadId && roleId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onComplete({ name: name.trim(), squadId, roleId });
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  // Input style — §7.7: 40px height, inset bg, radiusSm
  const inputTransition = `border-color ${motion.fast.duration} ${motion.fast.easing}, background-color ${motion.fast.duration} ${motion.fast.easing}`;
  const inputStyle = {
    width: "100%",
    height: 40,
    padding: "0 14px",
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: layout.radiusSm,
    color: c.text,
    fontFamily: body,
    fontSize: 14,
    fontWeight: 500,
    outline: "none",
    transition: inputTransition,
  };

  const labelStyle = {
    fontFamily: mono,
    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: c.textDim,
    marginBottom: space[2],
    display: "block",
  };

  const btnTransition = `background-color ${motion.fast.duration} ${motion.fast.easing}, box-shadow ${motion.fast.duration} ${motion.fast.easing}, transform ${motion.fast.duration} ${motion.fast.easing}, opacity ${motion.fast.duration} ${motion.fast.easing}`;

  return (
    <div ref={devRef} style={{
      minHeight: "100vh", background: c.bg, color: c.text, fontFamily: body,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", padding: space[5],
    }}>
      <style>{`
        @keyframes flow-onboard-fade-up {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .flow-onboard-input:focus {
          border-color: ${c.accent} !important;
          background: ${c.surface} !important;
        }
        .flow-onboard-input:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px ${c.accentDim};
        }
        .flow-onboard-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='4 6 8 10 12 6' stroke='%23999999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 12px 12px;
          padding-right: 36px !important;
        }
        .flow-onboard-primary:hover:not(:disabled) {
          background: ${c.accentHover} !important;
        }
        .flow-onboard-primary:active:not(:disabled) {
          transform: translateY(1px);
        }
        .flow-onboard-primary:focus-visible {
          outline: 2px solid ${c.accent};
          outline-offset: 2px;
        }
      `}</style>

      {/* Onboarding card */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: c.surface,
        borderRadius: layout.radiusLg,
        boxShadow: c.shadowElevated,
        border: `1px solid ${c.border}`,
        padding: space[8],
        display: "flex", flexDirection: "column", alignItems: "center",
        animation: "flow-onboard-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: space[5] }}>
          <FlowLogo size={56} />
        </div>

        {/* Welcome — displayLg */}
        <div style={{
          fontFamily: typo.displayLg.font,
          fontSize: typo.displayLg.size,
          fontWeight: typo.displayLg.weight,
          letterSpacing: typo.displayLg.tracking,
          lineHeight: typo.displayLg.lineHeight,
          color: c.text,
          marginBottom: space[2],
          textAlign: "center",
        }}>
          Welcome to Flow
        </div>

        {/* Subtitle */}
        <div style={{
          fontFamily: typo.bodySm.font,
          fontSize: typo.bodySm.size,
          fontWeight: typo.bodySm.weight,
          lineHeight: typo.bodySm.lineHeight,
          color: c.textDim,
          marginBottom: space[6],
          textAlign: "center",
        }}>
          Set up your profile to get started.
        </div>

        {/* Google avatar + email */}
        {user?.user_metadata?.avatar_url && (
          <div style={{
            display: "flex", alignItems: "center", gap: space[2],
            padding: "6px 12px 6px 6px",
            borderRadius: layout.radiusPill,
            background: c.surfaceAlt,
            border: `1px solid ${c.border}`,
            marginBottom: space[5],
            maxWidth: "100%",
          }}>
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }}
            />
            <span style={{
              fontFamily: body,
              fontSize: 12,
              fontWeight: 500,
              color: c.textMid,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}>{user.email}</span>
          </div>
        )}

        {/* Form */}
        <div style={{
          width: "100%",
          display: "flex", flexDirection: "column", gap: space[4],
        }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Display Name</label>
            <input
              className="flow-onboard-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Tariq A."
              style={inputStyle}
              autoFocus
              maxLength={100}
              minLength={2}
            />
          </div>

          {/* Squad */}
          <div>
            <label style={labelStyle}>Squad</label>
            <select
              className="flow-onboard-input flow-onboard-select"
              value={squadId}
              onChange={e => setSquadId(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", color: squadId ? c.text : c.textDim, appearance: "none", WebkitAppearance: "none", paddingRight: 32, background: `${c.surface} ${selChevron} no-repeat right 12px center / 12px 12px` }}
            >
              <option value="" disabled>{loadingDropdowns ? "Loading..." : squads.length === 0 ? "No squads available" : "Select your squad"}</option>
              {squads.map(s => (
                <option key={s.id} value={s.id} style={{ background: c.surface, color: c.text }}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div>
            <label style={labelStyle}>Role</label>
            <select
              className="flow-onboard-input flow-onboard-select"
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", color: roleId ? c.text : c.textDim, appearance: "none", WebkitAppearance: "none", paddingRight: 32, background: `${c.surface} ${selChevron} no-repeat right 12px center / 12px 12px` }}
            >
              <option value="" disabled>{loadingDropdowns ? "Loading..." : roles.length === 0 ? "No roles available" : "Select your role"}</option>
              {roles.map(r => (
                <option key={r.id} value={r.id} style={{ background: c.surface, color: c.text }}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontFamily: typo.bodySm.font,
              fontSize: typo.bodySm.size,
              color: c.red,
              padding: "4px 0",
            }}>{error}</div>
          )}

          {/* Submit — Btn primary (flat accent, shadowCard) */}
          <button
            className="flow-onboard-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              marginTop: space[2],
              height: 44,
              padding: "0 20px",
              background: canSubmit ? c.accent : c.surfaceAlt,
              border: canSubmit ? "none" : `1px solid ${c.border}`,
              borderRadius: layout.radiusSm,
              color: canSubmit ? c.textOnAccent : c.textDim,
              fontFamily: body,
              fontSize: 14,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? c.shadowCard : "none",
              transition: btnTransition,
            }}
          >
            {submitting ? "Setting up\u2026" : "Enter Flow \u2192"}
          </button>
        </div>
      </div>
    </div>
  );
}
