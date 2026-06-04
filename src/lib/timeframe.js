// Flow — Time Period helpers for the global date filter.
//
// A timeframe = { mode, offset, label, sublabel, start, end, year } where
// start/end are ISO YYYY-MM-DD strings (what every tab filters on).
//   rolling14 → rolling 14-day window ending today (offset in 14-day steps; 0 = last 14 days)
//   week     → Monday → Sunday window (offset in weeks; 0 = current week)
//   month    → a full calendar month (offset in months; 0 = current month)
//   quarter  → a full calendar quarter (offset in quarters; 0 = current quarter)
//   custom   → a user-picked range (no offset / arrows)
// offset is negative for the past; right-arrow navigation is disabled at >= 0
// so the user can never select a future period.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const DEFAULT_TIMEFRAME_MODE = "rolling14";

const iso = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const fmtMD = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const startOfDay = (ref) => { const d = new Date(ref); d.setHours(0, 0, 0, 0); return d; };

export function todayISO(ref = new Date()) {
  return iso(startOfDay(ref));
}

// Build a preset timeframe (week | month | quarter) at `offset` periods from now.
export function timeframeForMode(mode, offset = 0, ref = new Date()) {
  const today = startOfDay(ref);

  if (mode === "rolling14") {
    // Rolling 14-day window ending today (inclusive). offset steps the window
    // back in 14-day blocks; at offset 0 the label reads "Last 14 days", and
    // navigating back swaps in the explicit date range.
    const end = new Date(today);
    end.setDate(today.getDate() + offset * 14);
    const start = new Date(end);
    start.setDate(end.getDate() - 13);
    const range = `${fmtMD(start)} — ${fmtMD(end)}`;
    return {
      mode: "rolling14", offset,
      label: offset === 0 ? "Last 14 days" : range,
      sublabel: range,
      start: iso(start), end: iso(end), year: end.getFullYear(),
    };
  }

  if (mode === "month") {
    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      mode: "month", offset,
      label: `${MONTHS_FULL[base.getMonth()]} ${base.getFullYear()}`,
      sublabel: `${MONTHS[base.getMonth()]} ${base.getFullYear()}`,
      start: iso(start), end: iso(end), year: base.getFullYear(),
    };
  }

  if (mode === "quarter") {
    const curQ = Math.floor(today.getMonth() / 3); // 0-3
    const absQ = today.getFullYear() * 4 + curQ + offset; // absolute quarter index
    const qy = Math.floor(absQ / 4);
    const qi = ((absQ % 4) + 4) % 4;
    const start = new Date(qy, qi * 3, 1);
    const end = new Date(qy, qi * 3 + 3, 0);
    return {
      mode: "quarter", offset,
      label: `Q${qi + 1} ${qy}`,
      sublabel: `${MONTHS[qi * 3]} — ${MONTHS[qi * 3 + 2]}`,
      start: iso(start), end: iso(end), year: qy,
    };
  }

  // week — Monday → Sunday. getDay(): 0=Sun … 6=Sat.
  // The Monday on/before today, shifted by `offset` weeks; Sunday = Monday + 6.
  // (dow+6)%7 = days since Monday — Sunday(0)→6 back, Monday(1)→0, … Saturday(6)→5.
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    mode: "week", offset,
    label: `${fmtMD(monday)} — ${fmtMD(sunday)}`,
    sublabel: "Mon – Sun",
    start: iso(monday), end: iso(sunday), year: monday.getFullYear(),
  };
}

// Build a custom timeframe from two ISO date strings.
export function customTimeframe(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return {
    mode: "custom", offset: 0,
    label: `${fmtMD(s)} — ${fmtMD(e)}`,
    sublabel: "Custom range",
    start, end,
    year: s.getFullYear() === e.getFullYear() ? s.getFullYear() : `${s.getFullYear()}–${e.getFullYear()}`,
  };
}

// Can the user move forward a period? No future periods allowed (offset >= 0 caps it).
export function canGoForward(offset) {
  return (offset || 0) < 0;
}

// Compact label for a preset mode at offset 0 (used for the dropdown rows).
export function presetSummary(mode, ref = new Date()) {
  const tf = timeframeForMode(mode, 0, ref);
  // month/rolling14 show their date range (sublabel) on the right rather than
  // the friendly label, which is redundant next to the preset's name.
  const showSublabel = tf.mode === "month" || tf.mode === "rolling14";
  return { label: showSublabel ? tf.sublabel : tf.label, sublabel: tf.sublabel };
}
