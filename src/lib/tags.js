// ═══════════════════════════════════════════════════════════════
// Tag canonicalization — case-insensitive + singular/plural merging.
//
// Tags collapse so that case and plural variants become ONE tag:
//   Nexus / nexus            → NEXUS
//   CMS / cms / Cms          → CMS
//   Return / Returns / RETURN → RETURN
//
// Rule: the match KEY upper-cases and strips a single trailing plural "S".
// The DISPLAY form is the SHORTEST upper-cased variant seen for that key, so
// the singular ("RETURN") wins over the plural ("RETURNS"), while words that
// only ever appear with an S ("NEXUS", "CMS") keep it (no shorter form exists).
// ═══════════════════════════════════════════════════════════════

// Match key for a tag — upper, trimmed, trailing plural "S" removed.
export function tagKey(tag) {
  const up = String(tag || "").trim().toUpperCase();
  if (up.length >= 3 && up.endsWith("S")) return up.slice(0, -1);
  return up;
}

// Build a Map of key → canonical display (shortest upper-cased variant).
export function buildTagCanon(projects) {
  const byKey = new Map();
  (projects || []).forEach(p => (p.tags || []).forEach(t => {
    const up = String(t || "").trim().toUpperCase();
    if (!up) return;
    const k = tagKey(up);
    const cur = byKey.get(k);
    if (!cur || up.length < cur.length) byKey.set(k, up);
  }));
  return byKey;
}

// Canonical display for one input given a canon map (input itself may be shorter
// than anything in the pool — e.g. typing the singular for the first time).
export function canonTag(input, canonMap) {
  const up = String(input || "").trim().toUpperCase();
  if (!up) return "";
  const existing = canonMap?.get(tagKey(up));
  if (existing) return up.length < existing.length ? up : existing;
  return up;
}

// Canonicalize + dedupe a project's tag list.
export function canonTags(tags, canonMap) {
  const out = [];
  const seen = new Set();
  (tags || []).forEach(t => {
    const ct = canonTag(t, canonMap);
    if (!ct) return;
    const k = tagKey(ct);
    if (!seen.has(k)) { seen.add(k); out.push(ct); }
  });
  return out;
}

// All distinct canonical tags across projects with usage counts, sorted by
// count desc then alphabetically.
export function allTagsWithCounts(projects) {
  const canon = buildTagCanon(projects);
  const counts = new Map();
  (projects || []).forEach(p => {
    canonTags(p.tags, canon).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  });
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// True when `projectTags` (canonicalized) include `tag` (already canonical).
export function projectHasTag(projectTags, tag, canonMap) {
  const k = tagKey(tag);
  return canonTags(projectTags, canonMap).some(t => tagKey(t) === k);
}
