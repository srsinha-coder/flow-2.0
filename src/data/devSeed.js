// ═══════════════════════════════════════════════════════════════════
// devSeed.js — localhost-only mock data + in-memory mutable store.
//
// When the app runs on localhost without a real Supabase session, RLS
// would return zero rows for every table. That makes the new UI
// unclickable. This module short-circuits the data layer so the
// dashboard works without auth.
//
// What's in here:
//   - isDevSeedMode()           — gate predicate (localhost + anon)
//   - seedSquads/Roles/People/Projects — initial state used by
//                                  useSupabaseData when in seed mode
//   - devStore                  — in-memory comments/members/events
//                                  with subscribe() for "realtime"
//
// Mutations.js, useProjectActivity.js, and useSupabaseData.js all check
// isDevSeedMode() and route through this store instead of Supabase.
// Nothing here ever hits the network.
// ═══════════════════════════════════════════════════════════════════

/** Localhost + no real Supabase session = dev seed mode. We treat the
 *  presence of a session as a signal that the developer wants live data,
 *  even on localhost, so the seed is a fallback rather than a takeover. */
let _hasSession = false;
export function setDevSeedSessionFlag(hasSession) { _hasSession = !!hasSession; }
export function isDevSeedMode() {
  if (typeof window === "undefined") return false;
  const host = window.location?.hostname || "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!isLocal) return false;
  return !_hasSession;
}

// ── Helper: build an ISO offset from "now" so seed timestamps stay relative ──
const now = () => new Date();
const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
const DAY  = 86_400_000;

// ── IDs (kept stable so refresh doesn't shuffle order) ──────────────
const SQUAD_UGC        = "00000000-0000-0000-0000-000000000001";
const SQUAD_TS         = "00000000-0000-0000-0000-000000000002";
const SQUAD_AFS        = "00000000-0000-0000-0000-000000000003";
const SQUAD_O2D        = "00000000-0000-0000-0000-000000000004";
const SQUAD_CUSTOMER   = "00000000-0000-0000-0000-000000000005";
const SQUAD_GAMING     = "00000000-0000-0000-0000-000000000006";
const SQUAD_SPECIAL    = "00000000-0000-0000-0000-000000000007";
const SQUAD_PLATFORM   = "00000000-0000-0000-0000-000000000008";
const SQUAD_NSO        = "00000000-0000-0000-0000-000000000009";
const SQUAD_STOREFRONT = "00000000-0000-0000-0000-00000000000a";
const SQUAD_SALES      = "00000000-0000-0000-0000-00000000000b";
const SQUAD_FINSERV    = "00000000-0000-0000-0000-00000000000c";

const ROLE_ENG         = "00000000-0000-0000-0000-000000000101";
const ROLE_PM          = "00000000-0000-0000-0000-000000000102";
const ROLE_DESIGN      = "00000000-0000-0000-0000-000000000103";
const ROLE_ANALYST     = "00000000-0000-0000-0000-000000000104";

const PERSON_AJ        = "00000000-0000-0000-0000-000000000201";
const PERSON_MARIAM    = "00000000-0000-0000-0000-000000000202";
const PERSON_RANIA     = "00000000-0000-0000-0000-000000000203";
const PERSON_KHALID    = "00000000-0000-0000-0000-000000000204";
const PERSON_AYUSH     = "00000000-0000-0000-0000-000000000205";
const PERSON_IBRAHIM   = "00000000-0000-0000-0000-000000000206";
const PERSON_FATIMA    = "00000000-0000-0000-0000-000000000207";
const PERSON_OMAR      = "00000000-0000-0000-0000-000000000208";
const PERSON_SARA      = "00000000-0000-0000-0000-000000000209";
const PERSON_TARIQ     = "00000000-0000-0000-0000-000000000210";
const PERSON_LINA      = "00000000-0000-0000-0000-000000000211";
const PERSON_HASSAN    = "00000000-0000-0000-0000-000000000212";

// ── New people: Customer squad ──
const PERSON_HESHAM      = "00000000-0000-0000-0000-000000000213";
const PERSON_MSAFFIDIENE = "00000000-0000-0000-0000-000000000214";
const PERSON_YSAEED      = "00000000-0000-0000-0000-000000000215";
// ── New people: Gaming squad ──
const PERSON_PAVNEET     = "00000000-0000-0000-0000-000000000216";
const PERSON_ARCHIN      = "00000000-0000-0000-0000-000000000217";
const PERSON_SHUBHAM     = "00000000-0000-0000-0000-000000000218";
const PERSON_YNAGY       = "00000000-0000-0000-0000-000000000219";
// ── New people: Storefront squad ──
const PERSON_VAIBHAV     = "00000000-0000-0000-0000-000000000220";
const PERSON_ZEYAD       = "00000000-0000-0000-0000-000000000221";
const PERSON_MELBANNA    = "00000000-0000-0000-0000-000000000222";
const PERSON_SARAELKADY  = "00000000-0000-0000-0000-000000000223";

export const seedSquads = [
  { id: SQUAD_UGC,        name: "UGC" },
  { id: SQUAD_TS,         name: "T&S" },
  { id: SQUAD_AFS,        name: "AFS" },
  { id: SQUAD_O2D,        name: "O2D" },
  { id: SQUAD_CUSTOMER,   name: "Customer" },
  { id: SQUAD_GAMING,     name: "Gaming" },
  { id: SQUAD_SPECIAL,    name: "Special Projects" },
  { id: SQUAD_PLATFORM,   name: "Platform" },
  { id: SQUAD_NSO,        name: "NSO" },
  { id: SQUAD_STOREFRONT, name: "Storefront" },
  { id: SQUAD_SALES,      name: "Sales" },
  { id: SQUAD_FINSERV,    name: "Financial Service" },
];

export const seedRoles = [
  { id: ROLE_ENG,     name: "Engineer"         },
  { id: ROLE_PM,      name: "Product Manager"  },
  { id: ROLE_DESIGN,  name: "Designer"         },
  { id: ROLE_ANALYST, name: "Product Analyst"  },
];

export const seedPeople = [
  { id: PERSON_AJ,      name: "AJ",      squad: "Storefront", role: "Product Manager", squad_id: SQUAD_STOREFRONT, role_id: ROLE_PM, isAdmin: true },
  { id: PERSON_MARIAM,  name: "Mariam",  squad: "Platform",   role: "Engineer",        squad_id: SQUAD_PLATFORM,   role_id: ROLE_ENG },
  { id: PERSON_RANIA,   name: "Rania",   squad: "UGC",        role: "Engineer",        squad_id: SQUAD_UGC,        role_id: ROLE_ENG },
  { id: PERSON_KHALID,  name: "Khalid Anwer",  squad: "Customer",   role: "Product Manager",  squad_id: SQUAD_CUSTOMER,   role_id: ROLE_PM },
  { id: PERSON_AYUSH,   name: "Ayush",   squad: "Platform",   role: "Engineer",        squad_id: SQUAD_PLATFORM,   role_id: ROLE_ENG },
  { id: PERSON_IBRAHIM, name: "Ibrahim", squad: "O2D",        role: "Product Manager", squad_id: SQUAD_O2D,        role_id: ROLE_PM },
  { id: PERSON_FATIMA,  name: "Fatima",  squad: "Financial Service", role: "Product Manager", squad_id: SQUAD_FINSERV, role_id: ROLE_PM },
  { id: PERSON_OMAR,    name: "Omar",    squad: "T&S",        role: "Engineer",        squad_id: SQUAD_TS,         role_id: ROLE_ENG },
  { id: PERSON_SARA,    name: "Sara",    squad: "NSO",        role: "Designer",        squad_id: SQUAD_NSO,        role_id: ROLE_DESIGN },
  { id: PERSON_TARIQ,   name: "Tariq",   squad: "Gaming",     role: "Engineer",        squad_id: SQUAD_GAMING,     role_id: ROLE_ENG },
  { id: PERSON_LINA,    name: "Lina",    squad: "AFS",        role: "Engineer",        squad_id: SQUAD_AFS,        role_id: ROLE_ENG },
  { id: PERSON_HASSAN,  name: "Hassan",  squad: "Sales",      role: "Product Manager", squad_id: SQUAD_SALES,      role_id: ROLE_PM },
  // ── Customer squad ──
  { id: PERSON_HESHAM,      name: "Hesham Elalamy",      squad: "Customer",   role: "Product Manager", squad_id: SQUAD_CUSTOMER,   role_id: ROLE_PM },
  { id: PERSON_MSAFFIDIENE, name: "Mohammad Saffidiene", squad: "Customer",   role: "Engineer",        squad_id: SQUAD_CUSTOMER,   role_id: ROLE_ENG },
  { id: PERSON_YSAEED,      name: "Youssef Saeed",       squad: "Customer",   role: "Engineer",        squad_id: SQUAD_CUSTOMER,   role_id: ROLE_ENG },
  // ── Gaming squad ──
  { id: PERSON_PAVNEET,     name: "Pavneet Kaur",        squad: "Gaming",     role: "Product Manager", squad_id: SQUAD_GAMING,     role_id: ROLE_PM },
  { id: PERSON_ARCHIN,      name: "Archin Jain",         squad: "Gaming",     role: "Product Analyst", squad_id: SQUAD_GAMING,     role_id: ROLE_ANALYST },
  { id: PERSON_SHUBHAM,     name: "Shubham Bansal",      squad: "Gaming",     role: "Engineer",        squad_id: SQUAD_GAMING,     role_id: ROLE_ENG },
  { id: PERSON_YNAGY,       name: "Youssef Nagy",        squad: "Gaming",     role: "Engineer",        squad_id: SQUAD_GAMING,     role_id: ROLE_ENG },
  // ── Storefront squad ──
  { id: PERSON_VAIBHAV,     name: "Vaibhav Singh",       squad: "Storefront", role: "Product Manager", squad_id: SQUAD_STOREFRONT, role_id: ROLE_PM },
  { id: PERSON_ZEYAD,       name: "Zeyad Tolba",         squad: "Storefront", role: "Product Manager", squad_id: SQUAD_STOREFRONT, role_id: ROLE_PM },
  { id: PERSON_MELBANNA,    name: "Mohammad Elbanna",    squad: "Storefront", role: "Engineer",        squad_id: SQUAD_STOREFRONT, role_id: ROLE_ENG },
  { id: PERSON_SARAELKADY,  name: "Sara Elkady",         squad: "Storefront", role: "Engineer",        squad_id: SQUAD_STOREFRONT, role_id: ROLE_ENG },
];

// Project shape mirrors what toSeedProjects() in useSupabaseData returns.
// `owner_id` is essential — PersonProjects ("Owns" section on the People
// deep-dive) filters on it strictly, matching the prod schema.
export const seedProjects = [
  {
    id: "X01", name: "Checkout speedup",
    owner: "AJ", owner_id: PERSON_AJ, squad: "Storefront",
    phase: "Dev", status: "active",
    priority: "P0", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-01", endDate: "2026-06-15",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(80 * DAY),
    lastActivityAt: isoAgo(3 * HOUR),
  },
  {
    id: "X02", name: "Onboarding redesign",
    owner: "Khalid Anwer", owner_id: PERSON_KHALID, squad: "Customer",
    phase: "Design", status: "active",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: { Design: 28 },
    startDate: "2026-04-12", endDate: "2026-07-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(38 * DAY),
    lastActivityAt: isoAgo(10 * DAY),
  },
  {
    id: "X03", name: "Notifications platform",
    owner: "Mariam", owner_id: PERSON_MARIAM, squad: "Platform",
    phase: "QA", status: "active",
    priority: "P1", complexity: "XL",
    isBlocked: true, blockedReason: "Waiting on push notification cert from iOS team", blockedAt: isoAgo(5 * DAY),
    phaseDurationOverrides: null,
    startDate: "2026-02-02", endDate: "2026-05-10",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(107 * DAY),
    lastActivityAt: isoAgo(20 * DAY),
  },
  {
    id: "X04", name: "Search relevance v3",
    owner: "Ayush", owner_id: PERSON_AYUSH, squad: "Platform",
    phase: "PRD", status: "active",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-05-01", endDate: "2026-08-10",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(19 * DAY),
    lastActivityAt: isoAgo(18 * DAY),
  },
  {
    id: "X05", name: "Returns flow",
    owner: "Ibrahim", owner_id: PERSON_IBRAHIM, squad: "O2D",
    phase: "GA", status: "active",
    priority: "P0", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-11-15", endDate: "2026-03-30",
    actualStartDate: "2025-11-20", actualEndDate: "2026-04-02",
    gaEnteredAt: "2026-04-02", shippedAt: "2026-04-02", depriReason: null,
    gaReleaseNote: "Full self-service returns with auto-refund for eligible items. Supports 12 return reasons with photo upload.",
    gaFeatureType: "New",
    createdAt: isoAgo(186 * DAY),
    lastActivityAt: isoAgo(11 * DAY),
  },
  {
    id: "X06", name: "Promo engine v2",
    owner: "Rania", owner_id: PERSON_RANIA, squad: "UGC",
    phase: "Dev", status: "deprioritized",
    priority: "P3", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-02-20", endDate: "2026-06-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: "Pushed to Q3 — focus shifted to checkout speed.",
    createdAt: isoAgo(89 * DAY),
    lastActivityAt: isoAgo(33 * DAY),
  },
  {
    id: "X07", name: "Payment gateway migration",
    owner: "Fatima", owner_id: PERSON_FATIMA, squad: "Financial Service",
    phase: "Dev", status: "active",
    priority: "P0", complexity: "XL",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: { Dev: 42 },
    startDate: "2026-02-01", endDate: "2026-05-15",
    actualStartDate: "2026-02-05", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(108 * DAY),
    lastActivityAt: isoAgo(1 * HOUR),
  },
  {
    id: "X08", name: "Warehouse routing optimizer",
    owner: "Hassan", owner_id: PERSON_HASSAN, squad: "Sales",
    phase: "QA", status: "active",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-10", endDate: "2026-06-20",
    actualStartDate: "2026-03-12", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(71 * DAY),
    lastActivityAt: isoAgo(4 * HOUR),
  },
  {
    id: "X09", name: "Fraud detection v2",
    owner: "Omar", owner_id: PERSON_OMAR, squad: "T&S",
    phase: "GA", status: "shipped",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-01-15", endDate: "2026-05-25",
    actualStartDate: "2026-01-20", actualEndDate: "2026-05-20",
    gaEnteredAt: "2026-05-20", shippedAt: "2026-05-20", depriReason: null,
    shipNote: "Testing new ML scoring model with 10% of payment transactions.",
    shipPct: 10,
    createdAt: isoAgo(125 * DAY),
    lastActivityAt: isoAgo(9 * DAY),
  },
  {
    id: "X10", name: "Last-mile tracking dashboard",
    owner: "Sara", owner_id: PERSON_SARA, squad: "NSO",
    phase: "Design", status: "active",
    priority: "P2", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-20", endDate: "2026-08-15",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(30 * DAY),
    lastActivityAt: isoAgo(25 * DAY),
  },
  {
    id: "X11", name: "Subscription billing engine",
    owner: "Lina", owner_id: PERSON_LINA, squad: "AFS",
    phase: "PRD", status: "active",
    priority: "P2", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-05-10", endDate: "2026-09-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(10 * DAY),
    lastActivityAt: isoAgo(12 * HOUR),
  },
  {
    id: "X12", name: "Driver allocation ML",
    owner: "Tariq", owner_id: PERSON_TARIQ, squad: "Gaming",
    phase: "Dev", status: "active",
    priority: "P1", complexity: "XL",
    isBlocked: true, blockedReason: "ML model training pipeline broken — waiting on infra fix", blockedAt: isoAgo(3 * DAY),
    phaseDurationOverrides: null,
    startDate: "2026-03-01", endDate: "2026-05-01",
    actualStartDate: "2026-03-05", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(80 * DAY),
    lastActivityAt: isoAgo(3 * DAY),
  },
  {
    id: "X13", name: "Refund automation",
    owner: "Fatima", owner_id: PERSON_FATIMA, squad: "Financial Service",
    phase: "GA", status: "shipped",
    priority: "P0", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-12-01", endDate: "2026-05-30",
    actualStartDate: "2025-12-10", actualEndDate: "2026-05-28",
    gaEnteredAt: "2026-05-28", shippedAt: "2026-05-28", depriReason: null,
    createdAt: isoAgo(170 * DAY),
    lastActivityAt: isoAgo(5 * HOUR),
  },
  {
    id: "X14", name: "Customer address validation",
    owner: "Hassan", owner_id: PERSON_HASSAN, squad: "Sales",
    phase: "GA", status: "active",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-10-01", endDate: "2026-02-28",
    actualStartDate: "2025-10-05", actualEndDate: "2026-03-10",
    gaEnteredAt: "2026-03-10", shippedAt: "2026-03-10", depriReason: null,
    gaReleaseNote: "Google Maps autocomplete + UAE-specific address formatting. Reduced delivery failures by 23%.",
    gaFeatureType: "Enhancement",
    createdAt: isoAgo(231 * DAY),
    lastActivityAt: isoAgo(7 * DAY),
  },
  {
    id: "X15", name: "Vendor portal redesign",
    owner: "Sara", owner_id: PERSON_SARA, squad: "NSO",
    phase: "Design", status: "deprioritized",
    priority: "P3", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-01", endDate: "2026-08-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: "Waiting on vendor API contract finalization.",
    createdAt: isoAgo(49 * DAY),
    lastActivityAt: isoAgo(15 * DAY),
  },
  {
    id: "X16", name: "Dynamic pricing engine",
    owner: "Omar", owner_id: PERSON_OMAR, squad: "T&S",
    phase: "PRD", status: "active",
    priority: "P1", complexity: "XL",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-05-15", endDate: "2026-10-31",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(5 * DAY),
    lastActivityAt: isoAgo(2 * HOUR),
  },
  {
    id: "X17", name: "Loyalty program v2",
    owner: "Khalid Anwer", owner_id: PERSON_KHALID, squad: "Customer",
    phase: null, status: "upcoming",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-05-10",
    createdAt: isoAgo(14 * DAY),
    lastActivityAt: isoAgo(1 * DAY),
    dependencies: ["X02"],
  },
  {
    id: "X18", name: "Voice search integration",
    owner: "Fatima", owner_id: PERSON_FATIMA, squad: "Platform",
    phase: null, status: "upcoming",
    priority: "P2", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-06-15",
    createdAt: isoAgo(10 * DAY),
    lastActivityAt: isoAgo(2 * DAY),
  },
  {
    id: "X19", name: "Seller analytics dashboard",
    owner: "Hassan", owner_id: PERSON_HASSAN, squad: "Sales",
    phase: null, status: "upcoming",
    priority: "P2", complexity: null,
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: null,
    createdAt: isoAgo(7 * DAY),
    lastActivityAt: isoAgo(3 * DAY),
  },
  {
    id: "X20", name: "Live chat support widget",
    owner: "Mariam", owner_id: PERSON_MARIAM, squad: "Customer",
    phase: null, status: "upcoming",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-05-01",
    createdAt: isoAgo(21 * DAY),
    lastActivityAt: isoAgo(5 * DAY),
  },

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER SQUAD PROJECTS
  // ═══════════════════════════════════════════════════════════
  {
    id: "X21", name: "Onboarding Flow Revamp",
    owner: "Khalid Anwer", owner_id: PERSON_KHALID, squad: "Customer",
    phase: "Dev", status: "active",
    priority: "P0", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-10", endDate: "2026-06-20",
    actualStartDate: "2026-03-12", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(71 * DAY),
    lastActivityAt: isoAgo(2 * HOUR),
  },
  {
    id: "X22", name: "Address Caching | Building & Polygons",
    owner: "Hesham Elalamy", owner_id: PERSON_HESHAM, squad: "Customer",
    phase: "Design", status: "active",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-01", endDate: "2026-07-15",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(49 * DAY),
    lastActivityAt: isoAgo(1 * DAY),
  },
  {
    id: "X23", name: "Current Location based browsing",
    owner: "Khalid Anwer", owner_id: PERSON_KHALID, squad: "Customer",
    phase: "PRD", status: "active",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-05-05", endDate: "2026-08-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(15 * DAY),
    lastActivityAt: isoAgo(3 * DAY),
  },
  {
    id: "X24", name: "Handling Primary Phone (Linking/Delinking)",
    owner: "Mohammad Saffidiene", owner_id: PERSON_MSAFFIDIENE, squad: "Customer",
    phase: "QA", status: "active",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-02-15", endDate: "2026-05-30",
    actualStartDate: "2026-02-18", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(94 * DAY),
    lastActivityAt: isoAgo(6 * HOUR),
  },
  {
    id: "X25", name: "Account Page Revamp",
    owner: "Hesham Elalamy", owner_id: PERSON_HESHAM, squad: "Customer",
    phase: null, status: "upcoming",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-06-01",
    createdAt: isoAgo(5 * DAY),
    lastActivityAt: isoAgo(5 * DAY),
  },
  {
    id: "X26", name: "Passkeys",
    owner: "Youssef Saeed", owner_id: PERSON_YSAEED, squad: "Customer",
    phase: "Dev", status: "active",
    priority: "P0", complexity: "XL",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: { Dev: 42 },
    startDate: "2026-02-01", endDate: "2026-06-30",
    actualStartDate: "2026-02-05", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(108 * DAY),
    lastActivityAt: isoAgo(5 * HOUR),
  },
  {
    id: "X27", name: "Address Nickname Suggestion",
    owner: "Mohammad Saffidiene", owner_id: PERSON_MSAFFIDIENE, squad: "Customer",
    phase: null, status: "upcoming",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-07-01",
    createdAt: isoAgo(3 * DAY),
    lastActivityAt: isoAgo(3 * DAY),
  },
  {
    id: "X28", name: "Address Migration",
    owner: "Youssef Saeed", owner_id: PERSON_YSAEED, squad: "Customer",
    phase: "GA", status: "shipped",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-12-01", endDate: "2026-05-20",
    actualStartDate: "2025-12-08", actualEndDate: "2026-05-18",
    gaEnteredAt: "2026-05-18", shippedAt: "2026-05-18", depriReason: null,
    createdAt: isoAgo(170 * DAY),
    lastActivityAt: isoAgo(2 * DAY),
  },

  // ═══════════════════════════════════════════════════════════
  // GAMING SQUAD PROJECTS
  // ═══════════════════════════════════════════════════════════
  {
    id: "X29", name: "Yalla Goal - Football Game",
    owner: "Pavneet Kaur", owner_id: PERSON_PAVNEET, squad: "Gaming",
    phase: "Dev", status: "active",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-15", endDate: "2026-06-30",
    actualStartDate: "2026-03-18", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(66 * DAY),
    lastActivityAt: isoAgo(8 * HOUR),
  },
  {
    id: "X30", name: "Golazo 2026 FIFA",
    owner: "Pavneet Kaur", owner_id: PERSON_PAVNEET, squad: "Gaming",
    phase: null, status: "upcoming",
    priority: "P0", complexity: "XL",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-06-15",
    createdAt: isoAgo(8 * DAY),
    lastActivityAt: isoAgo(2 * DAY),
  },
  {
    id: "X31", name: "Hisense Quiz Sponsored",
    owner: "Archin Jain", owner_id: PERSON_ARCHIN, squad: "Gaming",
    phase: "QA", status: "active",
    priority: "P2", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-01", endDate: "2026-06-15",
    actualStartDate: "2026-04-03", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(49 * DAY),
    lastActivityAt: isoAgo(1 * DAY),
  },

  // ═══════════════════════════════════════════════════════════
  // STOREFRONT SQUAD PROJECTS
  // ═══════════════════════════════════════════════════════════
  {
    id: "X32", name: "Limited time deals (Improved Logic and UI revamp)",
    owner: "Vaibhav Singh", owner_id: PERSON_VAIBHAV, squad: "Storefront",
    phase: "Dev", status: "active",
    priority: "P0", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-01", endDate: "2026-06-15",
    actualStartDate: "2026-03-05", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(80 * DAY),
    lastActivityAt: isoAgo(4 * HOUR),
  },
  {
    id: "X33", name: "Cross pollination logic improvements",
    owner: "Zeyad Tolba", owner_id: PERSON_ZEYAD, squad: "Storefront",
    phase: "Design", status: "active",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-10", endDate: "2026-07-20",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(40 * DAY),
    lastActivityAt: isoAgo(2 * DAY),
  },
  {
    id: "X34", name: "Webp images support for chinese sellers",
    owner: "Mohammad Elbanna", owner_id: PERSON_MELBANNA, squad: "Storefront",
    phase: "QA", status: "active",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-20", endDate: "2026-05-25",
    actualStartDate: "2026-03-22", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(60 * DAY),
    lastActivityAt: isoAgo(12 * HOUR),
  },
  {
    id: "X35", name: "Quara Monet Campaign PDP",
    owner: "Vaibhav Singh", owner_id: PERSON_VAIBHAV, squad: "Storefront",
    phase: "GA", status: "shipped",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-11-01", endDate: "2026-05-30",
    actualStartDate: "2025-11-05", actualEndDate: "2026-05-25",
    gaEnteredAt: "2026-05-25", shippedAt: "2026-05-25", depriReason: null,
    createdAt: isoAgo(200 * DAY),
    lastActivityAt: isoAgo(1 * DAY),
  },
  {
    id: "X36", name: "App optimization",
    owner: "Sara Elkady", owner_id: PERSON_SARAELKADY, squad: "Storefront",
    phase: "Dev", status: "active",
    priority: "P0", complexity: "XL",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: { Dev: 56 },
    startDate: "2026-02-10", endDate: "2026-07-15",
    actualStartDate: "2026-02-12", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(99 * DAY),
    lastActivityAt: isoAgo(3 * HOUR),
  },
  {
    id: "X37", name: "Previously Bought tag on PLP - Consumables category",
    owner: "Zeyad Tolba", owner_id: PERSON_ZEYAD, squad: "Storefront",
    phase: "PRD", status: "active",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-05-10", endDate: "2026-07-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(10 * DAY),
    lastActivityAt: isoAgo(4 * DAY),
  },
  {
    id: "X38", name: "Discount tag personalization basis coupon targetting",
    owner: "Vaibhav Singh", owner_id: PERSON_VAIBHAV, squad: "Storefront",
    phase: "Design", status: "active",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-15", endDate: "2026-08-10",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(35 * DAY),
    lastActivityAt: isoAgo(1 * DAY),
  },
  {
    id: "X39", name: "Gifting Registry for category",
    owner: "Zeyad Tolba", owner_id: PERSON_ZEYAD, squad: "Storefront",
    phase: null, status: "upcoming",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-07-01",
    createdAt: isoAgo(6 * DAY),
    lastActivityAt: isoAgo(6 * DAY),
  },
  {
    id: "X40", name: "Legacy to New models Callout - PDP",
    owner: "Mohammad Elbanna", owner_id: PERSON_MELBANNA, squad: "Storefront",
    phase: "GA", status: "shipped",
    priority: "P2", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-12-15", endDate: "2026-05-31",
    actualStartDate: "2025-12-18", actualEndDate: "2026-05-29",
    gaEnteredAt: "2026-05-29", shippedAt: "2026-05-29", depriReason: null,
    createdAt: isoAgo(156 * DAY),
    lastActivityAt: isoAgo(3 * DAY),
  },
  {
    id: "X41", name: "Virtual bundle optimization",
    owner: "Sara Elkady", owner_id: PERSON_SARAELKADY, squad: "Storefront",
    phase: "Dev", status: "active",
    priority: "P1", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-03-15", endDate: "2026-06-30",
    actualStartDate: "2026-03-18", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(66 * DAY),
    lastActivityAt: isoAgo(6 * HOUR),
  },
  {
    id: "X42", name: "Variants on PDP",
    owner: "Vaibhav Singh", owner_id: PERSON_VAIBHAV, squad: "Storefront",
    phase: "GA", status: "active",
    priority: "P0", complexity: "L",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2025-09-01", endDate: "2026-03-15",
    actualStartDate: "2025-09-05", actualEndDate: "2026-03-20",
    gaEnteredAt: "2026-03-20", shippedAt: "2026-03-20", depriReason: null,
    gaReleaseNote: "Full variant selection on PDP with color/size swatches, image switching, and stock-per-variant display.",
    gaFeatureType: "Enhancement",
    createdAt: isoAgo(260 * DAY),
    lastActivityAt: isoAgo(10 * DAY),
  },
  {
    id: "X43", name: "Hiding Carousels with less than X (4) products",
    owner: "Mohammad Elbanna", owner_id: PERSON_MELBANNA, squad: "Storefront",
    phase: "QA", status: "active",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-05", endDate: "2026-06-10",
    actualStartDate: "2026-04-07", actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(45 * DAY),
    lastActivityAt: isoAgo(2 * DAY),
  },
  {
    id: "X44", name: "Video Reel Carousel widget (Noon finds)",
    owner: "Zeyad Tolba", owner_id: PERSON_ZEYAD, squad: "Storefront",
    phase: "PRD", status: "active",
    priority: "P1", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-05-15", endDate: "2026-09-30",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(5 * DAY),
    lastActivityAt: isoAgo(1 * DAY),
  },
  {
    id: "X45", name: "Enabling Frenzy deals widget on SM",
    owner: "Sara Elkady", owner_id: PERSON_SARAELKADY, squad: "Storefront",
    phase: null, status: "upcoming",
    priority: "P2", complexity: "S",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: null, endDate: null,
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    tentativeStartDate: "2026-06-15",
    createdAt: isoAgo(4 * DAY),
    lastActivityAt: isoAgo(4 * DAY),
  },
  {
    id: "X46", name: "2X2 Grid personalized widget",
    owner: "Vaibhav Singh", owner_id: PERSON_VAIBHAV, squad: "Storefront",
    phase: "Design", status: "active",
    priority: "P2", complexity: "M",
    isBlocked: false, blockedReason: null, blockedAt: null,
    phaseDurationOverrides: null,
    startDate: "2026-04-20", endDate: "2026-08-01",
    actualStartDate: null, actualEndDate: null,
    gaEnteredAt: null, depriReason: null,
    createdAt: isoAgo(30 * DAY),
    lastActivityAt: isoAgo(3 * DAY),
  },
];

// Assign a deterministic project type to any seed project missing one,
// so the Type filter has data to work with in dev-seed mode.
const PROJECT_TYPES = ["New Feature", "Bug Fix", "Enhancement", "Tech"];
seedProjects.forEach((p, i) => {
  if (!p.type) p.type = PROJECT_TYPES[i % PROJECT_TYPES.length];
});

// ── In-memory mutable store for comments / members / events ────────
// Subscribers receive `{ type: 'comments'|'members'|'events', projectId, change }`
// after every mutation so hooks can refresh.
const _state = {
  comments: [
    // X01 has a small conversation
    {
      id: "cmt-1", project_id: "X01", author_id: PERSON_AJ,
      body: "Demo today went well — pushing the new flow to QA tomorrow.",
      created_at: isoAgo(3 * HOUR), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-2", project_id: "X01", author_id: PERSON_MARIAM,
      body: "Nice. I'll pick up the metrics dashboard piece this week. @Ayush, want to pair on the perf budget?",
      created_at: isoAgo(2 * HOUR), edited_at: null, deleted_at: null,
    },
    // X02 has a conversation
    {
      id: "cmt-3", project_id: "X02", author_id: PERSON_KHALID,
      body: "First-round designs are up. Going to share with @AJ for review tomorrow.",
      created_at: isoAgo(10 * DAY), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-4", project_id: "X03", author_id: PERSON_MARIAM,
      body: "QA found 3 regressions in the notification queue. @AJ can you check the priority on these before standup?",
      created_at: isoAgo(4 * HOUR), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-5", project_id: "X03", author_id: PERSON_RANIA,
      body: "The blocked status is due to a downstream dependency. @AJ we need your sign-off to unblock.",
      created_at: isoAgo(1 * DAY), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-6", project_id: "X04", author_id: PERSON_AYUSH,
      body: "Search latency is down to 120ms after the index rebuild. @AJ ready for your review when you get a chance.",
      created_at: isoAgo(18 * DAY), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-7", project_id: "X02", author_id: PERSON_KHALID,
      body: "Updated the Figma with mobile breakpoints. @AJ take a look at the nav drawer variant.",
      created_at: isoAgo(10 * DAY), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-8", project_id: "X05", author_id: PERSON_IBRAHIM,
      body: "Returns API integration is done. @AJ shipping estimate — should we target this sprint or next?",
      created_at: isoAgo(3 * DAY), edited_at: null, deleted_at: null,
    },
    // X07 — Payment gateway migration
    {
      id: "cmt-9", project_id: "X07", author_id: PERSON_FATIMA,
      body: "Stripe integration passed sandbox testing. Moving to production validation next week.",
      created_at: isoAgo(1 * HOUR), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-10", project_id: "X07", author_id: PERSON_OMAR,
      body: "Found an edge case with multi-currency refunds. @Fatima can we sync tomorrow morning?",
      created_at: isoAgo(3 * HOUR), edited_at: null, deleted_at: null,
    },
    // X08 — Warehouse routing
    {
      id: "cmt-11", project_id: "X08", author_id: PERSON_HASSAN,
      body: "QA results look solid — 98% route accuracy on test dataset. Scheduling load test for Thursday.",
      created_at: isoAgo(4 * HOUR), edited_at: null, deleted_at: null,
    },
    // X09 — Fraud detection
    {
      id: "cmt-12", project_id: "X09", author_id: PERSON_OMAR,
      body: "Alpha rollout to 5% of transactions. False positive rate is at 0.3% — within target. @Lina monitor the dashboard this week.",
      created_at: isoAgo(8 * HOUR), edited_at: null, deleted_at: null,
    },
    // X10 — Last-mile tracking
    {
      id: "cmt-13", project_id: "X10", author_id: PERSON_SARA,
      body: "Wireframes shared in Figma. Need feedback on the real-time map component — performance is a concern on mobile.",
      created_at: isoAgo(25 * DAY), edited_at: null, deleted_at: null,
    },
    // X11 — Subscription billing
    {
      id: "cmt-14", project_id: "X11", author_id: PERSON_LINA,
      body: "PRD draft is ready for review. Key open question: do we support mid-cycle plan upgrades from day one?",
      created_at: isoAgo(12 * HOUR), edited_at: null, deleted_at: null,
    },
    // X12 — Driver allocation
    {
      id: "cmt-15", project_id: "X12", author_id: PERSON_TARIQ,
      body: "Pipeline still down. Infra team says ETA is 2 more days. We're blocked until the training cluster is back.",
      created_at: isoAgo(3 * DAY), edited_at: null, deleted_at: null,
    },
    // X13 — Refund automation
    {
      id: "cmt-16", project_id: "X13", author_id: PERSON_FATIMA,
      body: "Beta cohort processed 1,200 refunds this week with zero manual overrides. Ready for GA discussion.",
      created_at: isoAgo(5 * HOUR), edited_at: null, deleted_at: null,
    },
    {
      id: "cmt-17", project_id: "X13", author_id: PERSON_LINA,
      body: "One merchant flagged a timing issue with partial refunds. Investigating now — doesn't block GA.",
      created_at: isoAgo(2 * HOUR), edited_at: null, deleted_at: null,
    },
    // X14 — Address validation
    {
      id: "cmt-18", project_id: "X14", author_id: PERSON_HASSAN,
      body: "GA metrics looking healthy — 99.2% validation accuracy. Closing the project this sprint.",
      created_at: isoAgo(7 * DAY), edited_at: null, deleted_at: null,
    },
    // X16 — Dynamic pricing
    {
      id: "cmt-19", project_id: "X16", author_id: PERSON_OMAR,
      body: "Initial competitive analysis done. @Fatima let's align on pricing model constraints before the PRD review.",
      created_at: isoAgo(2 * HOUR), edited_at: null, deleted_at: null,
    },
  ],
  members: [
    // X01: owner is AJ; members are Mariam, Ayush, Khalid, Rania
    { id: "mem-1",  project_id: "X01", person_id: PERSON_MARIAM,  added_by: PERSON_AJ,      added_at: isoAgo(10 * DAY) },
    { id: "mem-2",  project_id: "X01", person_id: PERSON_AYUSH,   added_by: PERSON_AJ,      added_at: isoAgo(8 * DAY) },
    { id: "mem-4",  project_id: "X01", person_id: PERSON_KHALID,  added_by: PERSON_AJ,      added_at: isoAgo(6 * DAY) },
    { id: "mem-5",  project_id: "X01", person_id: PERSON_RANIA,   added_by: PERSON_AJ,      added_at: isoAgo(4 * DAY) },
    // X02: owner is Khalid; members are AJ, Mariam, Ibrahim
    { id: "mem-3",  project_id: "X02", person_id: PERSON_AJ,      added_by: PERSON_KHALID,  added_at: isoAgo(15 * DAY) },
    { id: "mem-6",  project_id: "X02", person_id: PERSON_MARIAM,  added_by: PERSON_KHALID,  added_at: isoAgo(12 * DAY) },
    { id: "mem-7",  project_id: "X02", person_id: PERSON_IBRAHIM, added_by: PERSON_KHALID,  added_at: isoAgo(9 * DAY) },
    // X03: owner is Mariam; members are AJ, Khalid, Ayush
    { id: "mem-8",  project_id: "X03", person_id: PERSON_AJ,      added_by: PERSON_MARIAM,  added_at: isoAgo(20 * DAY) },
    { id: "mem-9",  project_id: "X03", person_id: PERSON_KHALID,  added_by: PERSON_MARIAM,  added_at: isoAgo(18 * DAY) },
    { id: "mem-10", project_id: "X03", person_id: PERSON_AYUSH,   added_by: PERSON_MARIAM,  added_at: isoAgo(14 * DAY) },
    // X04: owner is Ayush; members are Mariam, Rania, Ibrahim
    { id: "mem-11", project_id: "X04", person_id: PERSON_MARIAM,  added_by: PERSON_AYUSH,   added_at: isoAgo(22 * DAY) },
    { id: "mem-12", project_id: "X04", person_id: PERSON_RANIA,   added_by: PERSON_AYUSH,   added_at: isoAgo(17 * DAY) },
    { id: "mem-13", project_id: "X04", person_id: PERSON_IBRAHIM, added_by: PERSON_AYUSH,   added_at: isoAgo(13 * DAY) },
    // X05: owner is Ibrahim; members are AJ, Rania, Khalid
    { id: "mem-14", project_id: "X05", person_id: PERSON_AJ,      added_by: PERSON_IBRAHIM, added_at: isoAgo(11 * DAY) },
    { id: "mem-15", project_id: "X05", person_id: PERSON_RANIA,   added_by: PERSON_IBRAHIM, added_at: isoAgo(7 * DAY) },
    { id: "mem-16", project_id: "X05", person_id: PERSON_KHALID,  added_by: PERSON_IBRAHIM, added_at: isoAgo(5 * DAY) },
    // X06: owner is Rania; members are Ayush, Ibrahim, AJ
    { id: "mem-17", project_id: "X06", person_id: PERSON_AYUSH,   added_by: PERSON_RANIA,   added_at: isoAgo(16 * DAY) },
    { id: "mem-18", project_id: "X06", person_id: PERSON_IBRAHIM, added_by: PERSON_RANIA,   added_at: isoAgo(10 * DAY) },
    { id: "mem-19", project_id: "X06", person_id: PERSON_AJ,      added_by: PERSON_RANIA,   added_at: isoAgo(3 * DAY) },
    // X07: owner is Fatima; members are Omar, Lina, AJ
    { id: "mem-20", project_id: "X07", person_id: PERSON_OMAR,    added_by: PERSON_FATIMA,  added_at: isoAgo(90 * DAY) },
    { id: "mem-21", project_id: "X07", person_id: PERSON_LINA,    added_by: PERSON_FATIMA,  added_at: isoAgo(60 * DAY) },
    { id: "mem-22", project_id: "X07", person_id: PERSON_AJ,      added_by: PERSON_FATIMA,  added_at: isoAgo(30 * DAY) },
    // X08: owner is Hassan; members are Tariq, Sara
    { id: "mem-23", project_id: "X08", person_id: PERSON_TARIQ,   added_by: PERSON_HASSAN,  added_at: isoAgo(50 * DAY) },
    { id: "mem-24", project_id: "X08", person_id: PERSON_SARA,    added_by: PERSON_HASSAN,  added_at: isoAgo(40 * DAY) },
    // X09: owner is Omar; members are Fatima, Lina, Mariam
    { id: "mem-25", project_id: "X09", person_id: PERSON_FATIMA,  added_by: PERSON_OMAR,    added_at: isoAgo(80 * DAY) },
    { id: "mem-26", project_id: "X09", person_id: PERSON_LINA,    added_by: PERSON_OMAR,    added_at: isoAgo(60 * DAY) },
    { id: "mem-27", project_id: "X09", person_id: PERSON_MARIAM,  added_by: PERSON_OMAR,    added_at: isoAgo(30 * DAY) },
    // X10: owner is Sara; members are Hassan, Tariq
    { id: "mem-28", project_id: "X10", person_id: PERSON_HASSAN,  added_by: PERSON_SARA,    added_at: isoAgo(20 * DAY) },
    { id: "mem-29", project_id: "X10", person_id: PERSON_TARIQ,   added_by: PERSON_SARA,    added_at: isoAgo(15 * DAY) },
    // X11: owner is Lina; members are Fatima, Omar
    { id: "mem-30", project_id: "X11", person_id: PERSON_FATIMA,  added_by: PERSON_LINA,    added_at: isoAgo(8 * DAY) },
    { id: "mem-31", project_id: "X11", person_id: PERSON_OMAR,    added_by: PERSON_LINA,    added_at: isoAgo(5 * DAY) },
    // X12: owner is Tariq; members are Hassan, Sara, AJ
    { id: "mem-32", project_id: "X12", person_id: PERSON_HASSAN,  added_by: PERSON_TARIQ,   added_at: isoAgo(45 * DAY) },
    { id: "mem-33", project_id: "X12", person_id: PERSON_SARA,    added_by: PERSON_TARIQ,   added_at: isoAgo(30 * DAY) },
    { id: "mem-34", project_id: "X12", person_id: PERSON_AJ,      added_by: PERSON_TARIQ,   added_at: isoAgo(20 * DAY) },
    // X13: owner is Fatima; members are Lina, Omar, Khalid
    { id: "mem-35", project_id: "X13", person_id: PERSON_LINA,    added_by: PERSON_FATIMA,  added_at: isoAgo(100 * DAY) },
    { id: "mem-36", project_id: "X13", person_id: PERSON_OMAR,    added_by: PERSON_FATIMA,  added_at: isoAgo(70 * DAY) },
    { id: "mem-37", project_id: "X13", person_id: PERSON_KHALID,  added_by: PERSON_FATIMA,  added_at: isoAgo(40 * DAY) },
    // X14: owner is Hassan; members are Tariq, Sara
    { id: "mem-38", project_id: "X14", person_id: PERSON_TARIQ,   added_by: PERSON_HASSAN,  added_at: isoAgo(120 * DAY) },
    { id: "mem-39", project_id: "X14", person_id: PERSON_SARA,    added_by: PERSON_HASSAN,  added_at: isoAgo(90 * DAY) },
    // X15: owner is Sara; members are Hassan
    { id: "mem-40", project_id: "X15", person_id: PERSON_HASSAN,  added_by: PERSON_SARA,    added_at: isoAgo(25 * DAY) },
    // X16: owner is Omar; members are Fatima, Lina
    { id: "mem-41", project_id: "X16", person_id: PERSON_FATIMA,  added_by: PERSON_OMAR,    added_at: isoAgo(4 * DAY) },
    { id: "mem-42", project_id: "X16", person_id: PERSON_LINA,    added_by: PERSON_OMAR,    added_at: isoAgo(2 * DAY) },
    // ── Customer squad projects ──
    // X21: owner Khalid; members Hesham, Mohammad S, Youssef S
    { id: "mem-50", project_id: "X21", person_id: PERSON_HESHAM,      added_by: PERSON_KHALID,    added_at: isoAgo(60 * DAY) },
    { id: "mem-51", project_id: "X21", person_id: PERSON_MSAFFIDIENE, added_by: PERSON_KHALID,    added_at: isoAgo(50 * DAY) },
    { id: "mem-52", project_id: "X21", person_id: PERSON_YSAEED,      added_by: PERSON_KHALID,    added_at: isoAgo(40 * DAY) },
    // X22: owner Hesham; members Khalid, Mohammad S
    { id: "mem-53", project_id: "X22", person_id: PERSON_KHALID,      added_by: PERSON_HESHAM,    added_at: isoAgo(40 * DAY) },
    { id: "mem-54", project_id: "X22", person_id: PERSON_MSAFFIDIENE, added_by: PERSON_HESHAM,    added_at: isoAgo(30 * DAY) },
    // X23: owner Khalid; members Hesham
    { id: "mem-55", project_id: "X23", person_id: PERSON_HESHAM,      added_by: PERSON_KHALID,    added_at: isoAgo(10 * DAY) },
    // X24: owner Mohammad S; members Youssef S, Khalid
    { id: "mem-56", project_id: "X24", person_id: PERSON_YSAEED,      added_by: PERSON_MSAFFIDIENE, added_at: isoAgo(80 * DAY) },
    { id: "mem-57", project_id: "X24", person_id: PERSON_KHALID,      added_by: PERSON_MSAFFIDIENE, added_at: isoAgo(70 * DAY) },
    // X26: owner Youssef S; members Khalid, Mohammad S, Hesham
    { id: "mem-58", project_id: "X26", person_id: PERSON_KHALID,      added_by: PERSON_YSAEED,    added_at: isoAgo(90 * DAY) },
    { id: "mem-59", project_id: "X26", person_id: PERSON_MSAFFIDIENE, added_by: PERSON_YSAEED,    added_at: isoAgo(70 * DAY) },
    { id: "mem-60", project_id: "X26", person_id: PERSON_HESHAM,      added_by: PERSON_YSAEED,    added_at: isoAgo(50 * DAY) },
    // X28: owner Youssef S; members Mohammad S, Hesham
    { id: "mem-61", project_id: "X28", person_id: PERSON_MSAFFIDIENE, added_by: PERSON_YSAEED,    added_at: isoAgo(140 * DAY) },
    { id: "mem-62", project_id: "X28", person_id: PERSON_HESHAM,      added_by: PERSON_YSAEED,    added_at: isoAgo(100 * DAY) },
    // ── Gaming squad projects ──
    // X29: owner Pavneet; members Shubham, Youssef N, Archin
    { id: "mem-63", project_id: "X29", person_id: PERSON_SHUBHAM,     added_by: PERSON_PAVNEET,   added_at: isoAgo(55 * DAY) },
    { id: "mem-64", project_id: "X29", person_id: PERSON_YNAGY,       added_by: PERSON_PAVNEET,   added_at: isoAgo(45 * DAY) },
    { id: "mem-65", project_id: "X29", person_id: PERSON_ARCHIN,      added_by: PERSON_PAVNEET,   added_at: isoAgo(35 * DAY) },
    // X31: owner Archin; members Shubham, Youssef N
    { id: "mem-66", project_id: "X31", person_id: PERSON_SHUBHAM,     added_by: PERSON_ARCHIN,    added_at: isoAgo(40 * DAY) },
    { id: "mem-67", project_id: "X31", person_id: PERSON_YNAGY,       added_by: PERSON_ARCHIN,    added_at: isoAgo(30 * DAY) },
    // ── Storefront squad projects ──
    // X32: owner Vaibhav; members Zeyad, Elbanna, Sara E
    { id: "mem-70", project_id: "X32", person_id: PERSON_ZEYAD,       added_by: PERSON_VAIBHAV,   added_at: isoAgo(70 * DAY) },
    { id: "mem-71", project_id: "X32", person_id: PERSON_MELBANNA,    added_by: PERSON_VAIBHAV,   added_at: isoAgo(50 * DAY) },
    { id: "mem-72", project_id: "X32", person_id: PERSON_SARAELKADY,  added_by: PERSON_VAIBHAV,   added_at: isoAgo(30 * DAY) },
    // X33: owner Zeyad; members Vaibhav, Elbanna
    { id: "mem-73", project_id: "X33", person_id: PERSON_VAIBHAV,     added_by: PERSON_ZEYAD,     added_at: isoAgo(30 * DAY) },
    { id: "mem-74", project_id: "X33", person_id: PERSON_MELBANNA,    added_by: PERSON_ZEYAD,     added_at: isoAgo(20 * DAY) },
    // X34: owner Elbanna; members Sara E
    { id: "mem-75", project_id: "X34", person_id: PERSON_SARAELKADY,  added_by: PERSON_MELBANNA,  added_at: isoAgo(40 * DAY) },
    // X35: owner Vaibhav; members Zeyad, Sara E, Elbanna
    { id: "mem-76", project_id: "X35", person_id: PERSON_ZEYAD,       added_by: PERSON_VAIBHAV,   added_at: isoAgo(180 * DAY) },
    { id: "mem-77", project_id: "X35", person_id: PERSON_SARAELKADY,  added_by: PERSON_VAIBHAV,   added_at: isoAgo(130 * DAY) },
    { id: "mem-78", project_id: "X35", person_id: PERSON_MELBANNA,    added_by: PERSON_VAIBHAV,   added_at: isoAgo(90 * DAY) },
    // X36: owner Sara E; members Vaibhav, Elbanna
    { id: "mem-79", project_id: "X36", person_id: PERSON_VAIBHAV,     added_by: PERSON_SARAELKADY, added_at: isoAgo(80 * DAY) },
    { id: "mem-80", project_id: "X36", person_id: PERSON_MELBANNA,    added_by: PERSON_SARAELKADY, added_at: isoAgo(60 * DAY) },
    // X38: owner Vaibhav; members Zeyad
    { id: "mem-81", project_id: "X38", person_id: PERSON_ZEYAD,       added_by: PERSON_VAIBHAV,   added_at: isoAgo(25 * DAY) },
    // X40: owner Elbanna; members Sara E, Vaibhav
    { id: "mem-82", project_id: "X40", person_id: PERSON_SARAELKADY,  added_by: PERSON_MELBANNA,  added_at: isoAgo(120 * DAY) },
    { id: "mem-83", project_id: "X40", person_id: PERSON_VAIBHAV,     added_by: PERSON_MELBANNA,  added_at: isoAgo(100 * DAY) },
    // X41: owner Sara E; members Elbanna, Zeyad
    { id: "mem-84", project_id: "X41", person_id: PERSON_MELBANNA,    added_by: PERSON_SARAELKADY, added_at: isoAgo(50 * DAY) },
    { id: "mem-85", project_id: "X41", person_id: PERSON_ZEYAD,       added_by: PERSON_SARAELKADY, added_at: isoAgo(30 * DAY) },
    // X42: owner Vaibhav; members Zeyad, Elbanna, Sara E
    { id: "mem-86", project_id: "X42", person_id: PERSON_ZEYAD,       added_by: PERSON_VAIBHAV,   added_at: isoAgo(240 * DAY) },
    { id: "mem-87", project_id: "X42", person_id: PERSON_MELBANNA,    added_by: PERSON_VAIBHAV,   added_at: isoAgo(200 * DAY) },
    { id: "mem-88", project_id: "X42", person_id: PERSON_SARAELKADY,  added_by: PERSON_VAIBHAV,   added_at: isoAgo(150 * DAY) },
    // X43: owner Elbanna; members Sara E
    { id: "mem-89", project_id: "X43", person_id: PERSON_SARAELKADY,  added_by: PERSON_MELBANNA,  added_at: isoAgo(35 * DAY) },
    // X44: owner Zeyad; members Vaibhav
    { id: "mem-90", project_id: "X44", person_id: PERSON_VAIBHAV,     added_by: PERSON_ZEYAD,     added_at: isoAgo(3 * DAY) },
    // X46: owner Vaibhav; members Zeyad, Elbanna
    { id: "mem-91", project_id: "X46", person_id: PERSON_ZEYAD,       added_by: PERSON_VAIBHAV,   added_at: isoAgo(20 * DAY) },
    { id: "mem-92", project_id: "X46", person_id: PERSON_MELBANNA,    added_by: PERSON_VAIBHAV,   added_at: isoAgo(15 * DAY) },
  ],
  links: [
    { id: "link-1", project_id: "X01", type: "prd", label: null, url: "https://docs.google.com/document/d/checkout-speedup-prd", created_at: isoAgo(30 * DAY) },
    { id: "link-2", project_id: "X01", type: "figma", label: null, url: "https://figma.com/file/checkout-speedup", created_at: isoAgo(25 * DAY) },
    { id: "link-3", project_id: "X02", type: "figma", label: null, url: "https://figma.com/file/onboarding-redesign", created_at: isoAgo(10 * DAY) },
    { id: "link-4", project_id: "X01", type: "custom", label: "Tech Doc", url: "https://docs.google.com/document/d/checkout-tech-spec", created_at: isoAgo(20 * DAY) },
    { id: "link-5", project_id: "X07", type: "prd", label: null, url: "https://docs.google.com/document/d/payment-gateway-prd", created_at: isoAgo(100 * DAY) },
    { id: "link-6", project_id: "X07", type: "jira", label: null, url: "https://jira.noon.com/board/PAY-GATEWAY", created_at: isoAgo(90 * DAY) },
    { id: "link-7", project_id: "X08", type: "prd", label: null, url: "https://docs.google.com/document/d/warehouse-routing", created_at: isoAgo(60 * DAY) },
    { id: "link-8", project_id: "X10", type: "figma", label: null, url: "https://figma.com/file/last-mile-tracking", created_at: isoAgo(15 * DAY) },
    { id: "link-9", project_id: "X13", type: "prd", label: null, url: "https://docs.google.com/document/d/refund-automation", created_at: isoAgo(150 * DAY) },
    { id: "link-10", project_id: "X13", type: "qa_testcases", label: null, url: "https://docs.google.com/spreadsheets/d/refund-qa", created_at: isoAgo(40 * DAY) },
    { id: "link-11", project_id: "X12", type: "gchat", label: null, url: "https://chat.google.com/room/driver-allocation", created_at: isoAgo(50 * DAY) },
    { id: "link-12", project_id: "X16", type: "prd", label: null, url: "https://docs.google.com/document/d/dynamic-pricing-prd", created_at: isoAgo(3 * DAY) },
  ],
  events: [
    // ── X01 — Checkout speedup (start 80d ago, currently Dev) ──
    { id: "ev-t001", entity_type: "project", entity_id: "X01", action: "project_created", user_name: "AJ", user_email: "ajain@noon.com", details: {}, created_at: isoAgo(80 * DAY) },
    { id: "ev-t002", entity_type: "project", entity_id: "X01", action: "track_started", user_name: "AJ", user_email: "ajain@noon.com", details: { track: "PRD" }, created_at: isoAgo(79 * DAY) },
    { id: "ev-t003", entity_type: "project", entity_id: "X01", action: "member_added", user_name: "AJ", user_email: "ajain@noon.com", details: { person_name: "Mariam" }, created_at: isoAgo(10 * DAY) },
    { id: "ev-t004", entity_type: "project", entity_id: "X01", action: "track_completed", user_name: "AJ", user_email: "ajain@noon.com", details: { track: "PRD" }, created_at: isoAgo(56 * DAY) },
    { id: "ev-t005", entity_type: "project", entity_id: "X01", action: "track_started", user_name: "AJ", user_email: "ajain@noon.com", details: { track: "Design" }, created_at: isoAgo(56 * DAY) },
    { id: "ev-t006", entity_type: "project", entity_id: "X01", action: "track_completed", user_name: "AJ", user_email: "ajain@noon.com", details: { track: "Design" }, created_at: isoAgo(8 * DAY) },
    { id: "ev-t007", entity_type: "project", entity_id: "X01", action: "track_started", user_name: "AJ", user_email: "ajain@noon.com", details: { track: "Dev" }, created_at: isoAgo(8 * DAY) },

    // ── X02 — Onboarding redesign (start 38d ago, currently Design) ──
    { id: "ev-t008", entity_type: "project", entity_id: "X02", action: "project_created", user_name: "Khalid", user_email: "khalid@noon.com", details: {}, created_at: isoAgo(38 * DAY) },
    { id: "ev-t009", entity_type: "project", entity_id: "X02", action: "track_started", user_name: "Khalid", user_email: "khalid@noon.com", details: { track: "PRD" }, created_at: isoAgo(37 * DAY) },
    { id: "ev-t010", entity_type: "project", entity_id: "X02", action: "track_completed", user_name: "Khalid", user_email: "khalid@noon.com", details: { track: "PRD" }, created_at: isoAgo(10 * DAY) },
    { id: "ev-t011", entity_type: "project", entity_id: "X02", action: "track_started", user_name: "Khalid", user_email: "khalid@noon.com", details: { track: "Design" }, created_at: isoAgo(10 * DAY) },

    // ── X03 — Notifications platform (start 107d ago, currently QA, blocked, OVERDUE) ──
    { id: "ev-t012", entity_type: "project", entity_id: "X03", action: "project_created", user_name: "Mariam", user_email: "mariam@noon.com", details: {}, created_at: isoAgo(107 * DAY) },
    { id: "ev-t013", entity_type: "project", entity_id: "X03", action: "track_started", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "PRD" }, created_at: isoAgo(106 * DAY) },
    { id: "ev-t014", entity_type: "project", entity_id: "X03", action: "track_completed", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "PRD" }, created_at: isoAgo(92 * DAY) },
    { id: "ev-t015", entity_type: "project", entity_id: "X03", action: "track_started", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "Design" }, created_at: isoAgo(92 * DAY) },
    { id: "ev-t016", entity_type: "project", entity_id: "X03", action: "track_completed", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "Design" }, created_at: isoAgo(72 * DAY) },
    { id: "ev-t017", entity_type: "project", entity_id: "X03", action: "track_started", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "Dev" }, created_at: isoAgo(72 * DAY) },
    { id: "ev-t018", entity_type: "project", entity_id: "X03", action: "track_completed", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "Dev" }, created_at: isoAgo(16 * DAY) },
    { id: "ev-t019", entity_type: "project", entity_id: "X03", action: "track_started", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "QA" }, created_at: isoAgo(16 * DAY) },
    { id: "ev-t020", entity_type: "project", entity_id: "X03", action: "project_status_changed", user_name: "Mariam", user_email: "mariam@noon.com", details: { from: "active", to: "active" }, created_at: isoAgo(20 * DAY) },
    { id: "ev-t021", entity_type: "project", entity_id: "X03", action: "track_reopened", user_name: "Mariam", user_email: "mariam@noon.com", details: { track: "QA", reason: "Found regression in push notification delivery" }, created_at: isoAgo(8 * DAY) },

    // ── X04 — Search relevance v3 (start 19d ago, currently PRD) ──
    { id: "ev-t022", entity_type: "project", entity_id: "X04", action: "project_created", user_name: "Ayush", user_email: "ayush@noon.com", details: {}, created_at: isoAgo(19 * DAY) },
    { id: "ev-t023", entity_type: "project", entity_id: "X04", action: "track_started", user_name: "Ayush", user_email: "ayush@noon.com", details: { track: "PRD" }, created_at: isoAgo(18 * DAY) },

    // ── X05 — Returns flow (start 186d ago, shipped GA) ──
    { id: "ev-t024", entity_type: "project", entity_id: "X05", action: "project_created", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: {}, created_at: isoAgo(186 * DAY) },
    { id: "ev-t025", entity_type: "project", entity_id: "X05", action: "track_started", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "PRD" }, created_at: isoAgo(185 * DAY) },
    { id: "ev-t026", entity_type: "project", entity_id: "X05", action: "track_completed", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "PRD" }, created_at: isoAgo(166 * DAY) },
    { id: "ev-t027", entity_type: "project", entity_id: "X05", action: "track_started", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Design" }, created_at: isoAgo(166 * DAY) },
    { id: "ev-t028", entity_type: "project", entity_id: "X05", action: "track_completed", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Design" }, created_at: isoAgo(130 * DAY) },
    { id: "ev-t029", entity_type: "project", entity_id: "X05", action: "track_started", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Dev" }, created_at: isoAgo(130 * DAY) },
    { id: "ev-t030", entity_type: "project", entity_id: "X05", action: "track_completed", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Dev" }, created_at: isoAgo(89 * DAY) },
    { id: "ev-t031", entity_type: "project", entity_id: "X05", action: "track_started", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "QA" }, created_at: isoAgo(89 * DAY) },
    { id: "ev-t032", entity_type: "project", entity_id: "X05", action: "track_completed", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "QA" }, created_at: isoAgo(71 * DAY) },
    { id: "ev-t033", entity_type: "project", entity_id: "X05", action: "track_started", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Alpha" }, created_at: isoAgo(71 * DAY) },
    { id: "ev-t034", entity_type: "project", entity_id: "X05", action: "track_completed", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Alpha" }, created_at: isoAgo(61 * DAY) },
    { id: "ev-t035", entity_type: "project", entity_id: "X05", action: "track_started", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Beta" }, created_at: isoAgo(61 * DAY) },
    { id: "ev-t036", entity_type: "project", entity_id: "X05", action: "track_completed", user_name: "Ibrahim", user_email: "ibrahim@noon.com", details: { track: "Beta" }, created_at: isoAgo(48 * DAY) },

    // ── X06 — Promo engine v2 (start 89d ago, currently Dev, deprioritized) ──
    { id: "ev-t037", entity_type: "project", entity_id: "X06", action: "project_created", user_name: "Rania", user_email: "rania@noon.com", details: {}, created_at: isoAgo(89 * DAY) },
    { id: "ev-t038", entity_type: "project", entity_id: "X06", action: "track_started", user_name: "Rania", user_email: "rania@noon.com", details: { track: "PRD" }, created_at: isoAgo(88 * DAY) },
    { id: "ev-t039", entity_type: "project", entity_id: "X06", action: "track_completed", user_name: "Rania", user_email: "rania@noon.com", details: { track: "PRD" }, created_at: isoAgo(71 * DAY) },
    { id: "ev-t040", entity_type: "project", entity_id: "X06", action: "track_started", user_name: "Rania", user_email: "rania@noon.com", details: { track: "Design" }, created_at: isoAgo(71 * DAY) },
    { id: "ev-t041", entity_type: "project", entity_id: "X06", action: "track_completed", user_name: "Rania", user_email: "rania@noon.com", details: { track: "Design" }, created_at: isoAgo(51 * DAY) },
    { id: "ev-t042", entity_type: "project", entity_id: "X06", action: "track_started", user_name: "Rania", user_email: "rania@noon.com", details: { track: "Dev" }, created_at: isoAgo(51 * DAY) },

    // ── X07 — Payment gateway migration (start 108d ago, currently Dev, OVERDUE) ──
    { id: "ev-t043", entity_type: "project", entity_id: "X07", action: "project_created", user_name: "Fatima", user_email: "fatima@noon.com", details: {}, created_at: isoAgo(108 * DAY) },
    { id: "ev-t044", entity_type: "project", entity_id: "X07", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "PRD" }, created_at: isoAgo(107 * DAY) },
    { id: "ev-t045", entity_type: "project", entity_id: "X07", action: "track_completed", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "PRD" }, created_at: isoAgo(80 * DAY) },
    { id: "ev-t046", entity_type: "project", entity_id: "X07", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "Design" }, created_at: isoAgo(80 * DAY) },
    { id: "ev-t047", entity_type: "project", entity_id: "X07", action: "track_completed", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Design" }, created_at: isoAgo(45 * DAY) },
    { id: "ev-t048", entity_type: "project", entity_id: "X07", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Dev" }, created_at: isoAgo(45 * DAY) },

    // ── X08 — Warehouse routing optimizer (start 71d ago, currently QA) ──
    { id: "ev-t049", entity_type: "project", entity_id: "X08", action: "project_created", user_name: "Hassan", user_email: "hassan@noon.com", details: {}, created_at: isoAgo(71 * DAY) },
    { id: "ev-t050", entity_type: "project", entity_id: "X08", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "PRD" }, created_at: isoAgo(70 * DAY) },
    { id: "ev-t051", entity_type: "project", entity_id: "X08", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "PRD" }, created_at: isoAgo(56 * DAY) },
    { id: "ev-t052", entity_type: "project", entity_id: "X08", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Design" }, created_at: isoAgo(56 * DAY) },
    { id: "ev-t053", entity_type: "project", entity_id: "X08", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Design" }, created_at: isoAgo(36 * DAY) },
    { id: "ev-t054", entity_type: "project", entity_id: "X08", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Dev" }, created_at: isoAgo(36 * DAY) },
    { id: "ev-t055", entity_type: "project", entity_id: "X08", action: "track_completed", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "Dev" }, created_at: isoAgo(11 * DAY) },
    { id: "ev-t056", entity_type: "project", entity_id: "X08", action: "track_started", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "QA" }, created_at: isoAgo(11 * DAY) },
    { id: "ev-t057", entity_type: "project", entity_id: "X08", action: "track_reopened", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Dev", reason: "Edge case in multi-depot routing" }, created_at: isoAgo(5 * DAY) },

    // ── X09 — Fraud detection v2 (start 125d ago, currently Alpha) ──
    { id: "ev-t058", entity_type: "project", entity_id: "X09", action: "project_created", user_name: "Omar", user_email: "omar@noon.com", details: {}, created_at: isoAgo(125 * DAY) },
    { id: "ev-t059", entity_type: "project", entity_id: "X09", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "PRD" }, created_at: isoAgo(124 * DAY) },
    { id: "ev-t060", entity_type: "project", entity_id: "X09", action: "track_completed", user_name: "Omar", user_email: "omar@noon.com", details: { track: "PRD" }, created_at: isoAgo(108 * DAY) },
    { id: "ev-t061", entity_type: "project", entity_id: "X09", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Design" }, created_at: isoAgo(108 * DAY) },
    { id: "ev-t062", entity_type: "project", entity_id: "X09", action: "track_completed", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Design" }, created_at: isoAgo(84 * DAY) },
    { id: "ev-t063", entity_type: "project", entity_id: "X09", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Dev" }, created_at: isoAgo(84 * DAY) },
    { id: "ev-t064", entity_type: "project", entity_id: "X09", action: "track_completed", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Dev" }, created_at: isoAgo(40 * DAY) },
    { id: "ev-t065", entity_type: "project", entity_id: "X09", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "QA" }, created_at: isoAgo(40 * DAY) },
    { id: "ev-t066", entity_type: "project", entity_id: "X09", action: "track_completed", user_name: "Omar", user_email: "omar@noon.com", details: { track: "QA" }, created_at: isoAgo(19 * DAY) },
    { id: "ev-t067", entity_type: "project", entity_id: "X09", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "Alpha", note: "Internal testing with 5 teams", rolloutPct: 10 }, created_at: isoAgo(19 * DAY) },

    // ── X10 — Last-mile tracking dashboard (start 30d ago, currently Design) ──
    { id: "ev-t068", entity_type: "project", entity_id: "X10", action: "project_created", user_name: "Sara", user_email: "sara@noon.com", details: {}, created_at: isoAgo(30 * DAY) },
    { id: "ev-t069", entity_type: "project", entity_id: "X10", action: "track_started", user_name: "Sara", user_email: "sara@noon.com", details: { track: "PRD" }, created_at: isoAgo(29 * DAY) },
    { id: "ev-t070", entity_type: "project", entity_id: "X10", action: "track_completed", user_name: "Sara", user_email: "sara@noon.com", details: { track: "PRD" }, created_at: isoAgo(25 * DAY) },
    { id: "ev-t071", entity_type: "project", entity_id: "X10", action: "track_started", user_name: "Sara", user_email: "sara@noon.com", details: { track: "Design" }, created_at: isoAgo(25 * DAY) },

    // ── X11 — Subscription billing engine (start 10d ago, currently PRD) ──
    { id: "ev-t072", entity_type: "project", entity_id: "X11", action: "project_created", user_name: "Lina", user_email: "lina@noon.com", details: {}, created_at: isoAgo(10 * DAY) },
    { id: "ev-t073", entity_type: "project", entity_id: "X11", action: "track_started", user_name: "Lina", user_email: "lina@noon.com", details: { track: "PRD" }, created_at: isoAgo(9 * DAY) },

    // ── X12 — Driver allocation ML (start 80d ago, currently Dev, blocked, OVERDUE) ──
    { id: "ev-t074", entity_type: "project", entity_id: "X12", action: "project_created", user_name: "Tariq", user_email: "tariq@noon.com", details: {}, created_at: isoAgo(80 * DAY) },
    { id: "ev-t075", entity_type: "project", entity_id: "X12", action: "track_started", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "PRD" }, created_at: isoAgo(79 * DAY) },
    { id: "ev-t076", entity_type: "project", entity_id: "X12", action: "track_completed", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "PRD" }, created_at: isoAgo(61 * DAY) },
    { id: "ev-t077", entity_type: "project", entity_id: "X12", action: "track_started", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "Design" }, created_at: isoAgo(61 * DAY) },
    { id: "ev-t078", entity_type: "project", entity_id: "X12", action: "track_completed", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "Design" }, created_at: isoAgo(30 * DAY) },
    { id: "ev-t079", entity_type: "project", entity_id: "X12", action: "track_started", user_name: "Tariq", user_email: "tariq@noon.com", details: { track: "Dev" }, created_at: isoAgo(30 * DAY) },
    { id: "ev-t080", entity_type: "project", entity_id: "X12", action: "project_blocked", user_name: "Tariq", user_email: "tariq@noon.com", details: { reason: "ML model training pipeline broken" }, created_at: isoAgo(3 * DAY) },

    // ── X13 — Refund automation (start 170d ago, currently Beta) ──
    { id: "ev-t081", entity_type: "project", entity_id: "X13", action: "project_created", user_name: "Fatima", user_email: "fatima@noon.com", details: {}, created_at: isoAgo(170 * DAY) },
    { id: "ev-t082", entity_type: "project", entity_id: "X13", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "PRD" }, created_at: isoAgo(169 * DAY) },
    { id: "ev-t083", entity_type: "project", entity_id: "X13", action: "track_completed", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "PRD" }, created_at: isoAgo(151 * DAY) },
    { id: "ev-t084", entity_type: "project", entity_id: "X13", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "Design" }, created_at: isoAgo(151 * DAY) },
    { id: "ev-t085", entity_type: "project", entity_id: "X13", action: "track_completed", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "Design" }, created_at: isoAgo(120 * DAY) },
    { id: "ev-t086", entity_type: "project", entity_id: "X13", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "Dev" }, created_at: isoAgo(120 * DAY) },
    { id: "ev-t087", entity_type: "project", entity_id: "X13", action: "track_completed", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "Dev" }, created_at: isoAgo(66 * DAY) },
    { id: "ev-t088", entity_type: "project", entity_id: "X13", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "QA" }, created_at: isoAgo(66 * DAY) },
    { id: "ev-t089", entity_type: "project", entity_id: "X13", action: "track_completed", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "QA" }, created_at: isoAgo(35 * DAY) },
    { id: "ev-t090", entity_type: "project", entity_id: "X13", action: "track_started", user_name: "Fatima", user_email: "fatima@noon.com", details: { track: "Alpha" }, created_at: isoAgo(35 * DAY) },
    { id: "ev-t091", entity_type: "project", entity_id: "X13", action: "track_completed", user_name: "Lina", user_email: "lina@noon.com", details: { track: "Alpha" }, created_at: isoAgo(20 * DAY) },
    { id: "ev-t092", entity_type: "project", entity_id: "X13", action: "track_started", user_name: "Lina", user_email: "lina@noon.com", details: { track: "Beta", note: "Rolling out to UAE first", rolloutPct: 25 }, created_at: isoAgo(20 * DAY) },

    // ── X14 — Customer address validation (start 231d ago, shipped GA) ──
    { id: "ev-t093", entity_type: "project", entity_id: "X14", action: "project_created", user_name: "Hassan", user_email: "hassan@noon.com", details: {}, created_at: isoAgo(231 * DAY) },
    { id: "ev-t094", entity_type: "project", entity_id: "X14", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "PRD" }, created_at: isoAgo(230 * DAY) },
    { id: "ev-t095", entity_type: "project", entity_id: "X14", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "PRD" }, created_at: isoAgo(217 * DAY) },
    { id: "ev-t096", entity_type: "project", entity_id: "X14", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Design" }, created_at: isoAgo(217 * DAY) },
    { id: "ev-t097", entity_type: "project", entity_id: "X14", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Design" }, created_at: isoAgo(196 * DAY) },
    { id: "ev-t098", entity_type: "project", entity_id: "X14", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Dev" }, created_at: isoAgo(196 * DAY) },
    { id: "ev-t099", entity_type: "project", entity_id: "X14", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Dev" }, created_at: isoAgo(161 * DAY) },
    { id: "ev-t100", entity_type: "project", entity_id: "X14", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "QA" }, created_at: isoAgo(161 * DAY) },
    { id: "ev-t101", entity_type: "project", entity_id: "X14", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "QA" }, created_at: isoAgo(140 * DAY) },
    { id: "ev-t102", entity_type: "project", entity_id: "X14", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Alpha" }, created_at: isoAgo(140 * DAY) },
    { id: "ev-t103", entity_type: "project", entity_id: "X14", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Alpha" }, created_at: isoAgo(119 * DAY) },
    { id: "ev-t104", entity_type: "project", entity_id: "X14", action: "track_started", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Beta" }, created_at: isoAgo(119 * DAY) },
    { id: "ev-t105", entity_type: "project", entity_id: "X14", action: "track_completed", user_name: "Hassan", user_email: "hassan@noon.com", details: { track: "Beta" }, created_at: isoAgo(71 * DAY) },

    // ── X15 — Vendor portal redesign (start 49d ago, currently Design, deprioritized) ──
    { id: "ev-t106", entity_type: "project", entity_id: "X15", action: "project_created", user_name: "Sara", user_email: "sara@noon.com", details: {}, created_at: isoAgo(49 * DAY) },
    { id: "ev-t107", entity_type: "project", entity_id: "X15", action: "track_started", user_name: "Sara", user_email: "sara@noon.com", details: { track: "PRD" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t108", entity_type: "project", entity_id: "X15", action: "track_completed", user_name: "Sara", user_email: "sara@noon.com", details: { track: "PRD" }, created_at: isoAgo(30 * DAY) },
    { id: "ev-t109", entity_type: "project", entity_id: "X15", action: "track_started", user_name: "Sara", user_email: "sara@noon.com", details: { track: "Design" }, created_at: isoAgo(30 * DAY) },
    { id: "ev-t110", entity_type: "project", entity_id: "X15", action: "project_status_changed", user_name: "Sara", user_email: "sara@noon.com", details: { from: "active", to: "deprioritized" }, created_at: isoAgo(15 * DAY) },

    // ── X16 — Dynamic pricing engine (start 5d ago, currently PRD) ──
    { id: "ev-t111", entity_type: "project", entity_id: "X16", action: "project_created", user_name: "Omar", user_email: "omar@noon.com", details: {}, created_at: isoAgo(5 * DAY) },
    { id: "ev-t112", entity_type: "project", entity_id: "X16", action: "track_started", user_name: "Omar", user_email: "omar@noon.com", details: { track: "PRD" }, created_at: isoAgo(4 * DAY) },

    // ── X17–X20 — Upcoming projects (no track_started for upcoming) ──
    { id: "ev-t113", entity_type: "project", entity_id: "X17", action: "project_created", user_name: "Khalid", user_email: "khalid@noon.com", details: {}, created_at: isoAgo(14 * DAY) },
    { id: "ev-t114", entity_type: "project", entity_id: "X18", action: "project_created", user_name: "Fatima", user_email: "fatima@noon.com", details: {}, created_at: isoAgo(10 * DAY) },
    { id: "ev-t115", entity_type: "project", entity_id: "X19", action: "project_created", user_name: "Hassan", user_email: "hassan@noon.com", details: {}, created_at: isoAgo(7 * DAY) },
    { id: "ev-t116", entity_type: "project", entity_id: "X20", action: "project_created", user_name: "Mariam", user_email: "mariam@noon.com", details: {}, created_at: isoAgo(21 * DAY) },

    // ── X21 — Onboarding Flow Revamp (Customer, Dev) ──
    { id: "ev-t117", entity_type: "project", entity_id: "X21", action: "project_created", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: {}, created_at: isoAgo(71 * DAY) },
    { id: "ev-t118", entity_type: "project", entity_id: "X21", action: "track_started", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: { track: "PRD" }, created_at: isoAgo(70 * DAY) },
    { id: "ev-t119", entity_type: "project", entity_id: "X21", action: "track_completed", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: { track: "PRD" }, created_at: isoAgo(50 * DAY) },
    { id: "ev-t120", entity_type: "project", entity_id: "X21", action: "track_started", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: { track: "Design" }, created_at: isoAgo(50 * DAY) },
    { id: "ev-t121", entity_type: "project", entity_id: "X21", action: "track_completed", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: { track: "Design" }, created_at: isoAgo(20 * DAY) },
    { id: "ev-t122", entity_type: "project", entity_id: "X21", action: "track_started", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: { track: "Dev" }, created_at: isoAgo(20 * DAY) },

    // ── X22 — Address Caching (Customer, Design) ──
    { id: "ev-t123", entity_type: "project", entity_id: "X22", action: "project_created", user_name: "Hesham Elalamy", user_email: "hesham@noon.com", details: {}, created_at: isoAgo(49 * DAY) },
    { id: "ev-t124", entity_type: "project", entity_id: "X22", action: "track_started", user_name: "Hesham Elalamy", user_email: "hesham@noon.com", details: { track: "PRD" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t125", entity_type: "project", entity_id: "X22", action: "track_completed", user_name: "Hesham Elalamy", user_email: "hesham@noon.com", details: { track: "PRD" }, created_at: isoAgo(30 * DAY) },
    { id: "ev-t126", entity_type: "project", entity_id: "X22", action: "track_started", user_name: "Hesham Elalamy", user_email: "hesham@noon.com", details: { track: "Design" }, created_at: isoAgo(30 * DAY) },

    // ── X23 — Current Location browsing (Customer, PRD) ──
    { id: "ev-t127", entity_type: "project", entity_id: "X23", action: "project_created", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: {}, created_at: isoAgo(15 * DAY) },
    { id: "ev-t128", entity_type: "project", entity_id: "X23", action: "track_started", user_name: "Khalid Anwer", user_email: "khalid@noon.com", details: { track: "PRD" }, created_at: isoAgo(14 * DAY) },

    // ── X24 — Primary Phone (Customer, QA) ──
    { id: "ev-t129", entity_type: "project", entity_id: "X24", action: "project_created", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: {}, created_at: isoAgo(94 * DAY) },
    { id: "ev-t130", entity_type: "project", entity_id: "X24", action: "track_started", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "PRD" }, created_at: isoAgo(93 * DAY) },
    { id: "ev-t131", entity_type: "project", entity_id: "X24", action: "track_completed", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "PRD" }, created_at: isoAgo(75 * DAY) },
    { id: "ev-t132", entity_type: "project", entity_id: "X24", action: "track_started", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "Design" }, created_at: isoAgo(75 * DAY) },
    { id: "ev-t133", entity_type: "project", entity_id: "X24", action: "track_completed", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "Design" }, created_at: isoAgo(50 * DAY) },
    { id: "ev-t134", entity_type: "project", entity_id: "X24", action: "track_started", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "Dev" }, created_at: isoAgo(50 * DAY) },
    { id: "ev-t135", entity_type: "project", entity_id: "X24", action: "track_completed", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "Dev" }, created_at: isoAgo(10 * DAY) },
    { id: "ev-t136", entity_type: "project", entity_id: "X24", action: "track_started", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: { track: "QA" }, created_at: isoAgo(10 * DAY) },

    // ── X25 — Account Page Revamp (Customer, upcoming) ──
    { id: "ev-t137", entity_type: "project", entity_id: "X25", action: "project_created", user_name: "Hesham Elalamy", user_email: "hesham@noon.com", details: {}, created_at: isoAgo(5 * DAY) },

    // ── X26 — Passkeys (Customer, Dev) ──
    { id: "ev-t138", entity_type: "project", entity_id: "X26", action: "project_created", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: {}, created_at: isoAgo(108 * DAY) },
    { id: "ev-t139", entity_type: "project", entity_id: "X26", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "PRD" }, created_at: isoAgo(107 * DAY) },
    { id: "ev-t140", entity_type: "project", entity_id: "X26", action: "track_completed", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "PRD" }, created_at: isoAgo(85 * DAY) },
    { id: "ev-t141", entity_type: "project", entity_id: "X26", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Design" }, created_at: isoAgo(85 * DAY) },
    { id: "ev-t142", entity_type: "project", entity_id: "X26", action: "track_completed", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Design" }, created_at: isoAgo(50 * DAY) },
    { id: "ev-t143", entity_type: "project", entity_id: "X26", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Dev" }, created_at: isoAgo(50 * DAY) },

    // ── X27 — Address Nickname (Customer, upcoming) ──
    { id: "ev-t144", entity_type: "project", entity_id: "X27", action: "project_created", user_name: "Mohammad Saffidiene", user_email: "msaffidiene@noon.com", details: {}, created_at: isoAgo(3 * DAY) },

    // ── X28 — Address Migration (Customer, Alpha) ──
    { id: "ev-t145", entity_type: "project", entity_id: "X28", action: "project_created", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: {}, created_at: isoAgo(170 * DAY) },
    { id: "ev-t146", entity_type: "project", entity_id: "X28", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "PRD" }, created_at: isoAgo(169 * DAY) },
    { id: "ev-t147", entity_type: "project", entity_id: "X28", action: "track_completed", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "PRD" }, created_at: isoAgo(145 * DAY) },
    { id: "ev-t148", entity_type: "project", entity_id: "X28", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Design" }, created_at: isoAgo(145 * DAY) },
    { id: "ev-t149", entity_type: "project", entity_id: "X28", action: "track_completed", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Design" }, created_at: isoAgo(110 * DAY) },
    { id: "ev-t150", entity_type: "project", entity_id: "X28", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Dev" }, created_at: isoAgo(110 * DAY) },
    { id: "ev-t151", entity_type: "project", entity_id: "X28", action: "track_completed", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Dev" }, created_at: isoAgo(55 * DAY) },
    { id: "ev-t152", entity_type: "project", entity_id: "X28", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "QA" }, created_at: isoAgo(55 * DAY) },
    { id: "ev-t153", entity_type: "project", entity_id: "X28", action: "track_completed", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "QA" }, created_at: isoAgo(20 * DAY) },
    { id: "ev-t154", entity_type: "project", entity_id: "X28", action: "track_started", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Alpha", note: "Testing with Customer squad", rolloutPct: 15 }, created_at: isoAgo(20 * DAY) },
    { id: "ev-t155", entity_type: "project", entity_id: "X28", action: "track_reopened", user_name: "Youssef Saeed", user_email: "ysaeed@noon.com", details: { track: "Dev", reason: "API contract changed by upstream team" }, created_at: isoAgo(15 * DAY) },

    // ── X29 — Yalla Goal (Gaming, Dev) ──
    { id: "ev-t156", entity_type: "project", entity_id: "X29", action: "project_created", user_name: "Pavneet Kaur", user_email: "pavneet@noon.com", details: {}, created_at: isoAgo(66 * DAY) },
    { id: "ev-t157", entity_type: "project", entity_id: "X29", action: "track_started", user_name: "Pavneet Kaur", user_email: "pavneet@noon.com", details: { track: "PRD" }, created_at: isoAgo(65 * DAY) },
    { id: "ev-t158", entity_type: "project", entity_id: "X29", action: "track_completed", user_name: "Pavneet Kaur", user_email: "pavneet@noon.com", details: { track: "PRD" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t159", entity_type: "project", entity_id: "X29", action: "track_started", user_name: "Pavneet Kaur", user_email: "pavneet@noon.com", details: { track: "Design" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t160", entity_type: "project", entity_id: "X29", action: "track_completed", user_name: "Shubham Bansal", user_email: "shubham@noon.com", details: { track: "Design" }, created_at: isoAgo(25 * DAY) },
    { id: "ev-t161", entity_type: "project", entity_id: "X29", action: "track_started", user_name: "Shubham Bansal", user_email: "shubham@noon.com", details: { track: "Dev" }, created_at: isoAgo(25 * DAY) },

    // ── X30 — Golazo 2026 FIFA (Gaming, upcoming) ──
    { id: "ev-t162", entity_type: "project", entity_id: "X30", action: "project_created", user_name: "Pavneet Kaur", user_email: "pavneet@noon.com", details: {}, created_at: isoAgo(8 * DAY) },

    // ── X31 — Hisense Quiz (Gaming, QA) ──
    { id: "ev-t163", entity_type: "project", entity_id: "X31", action: "project_created", user_name: "Archin Jain", user_email: "archin@noon.com", details: {}, created_at: isoAgo(49 * DAY) },
    { id: "ev-t164", entity_type: "project", entity_id: "X31", action: "track_started", user_name: "Archin Jain", user_email: "archin@noon.com", details: { track: "PRD" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t165", entity_type: "project", entity_id: "X31", action: "track_completed", user_name: "Archin Jain", user_email: "archin@noon.com", details: { track: "PRD" }, created_at: isoAgo(35 * DAY) },
    { id: "ev-t166", entity_type: "project", entity_id: "X31", action: "track_started", user_name: "Archin Jain", user_email: "archin@noon.com", details: { track: "Design" }, created_at: isoAgo(35 * DAY) },
    { id: "ev-t167", entity_type: "project", entity_id: "X31", action: "track_completed", user_name: "Shubham Bansal", user_email: "shubham@noon.com", details: { track: "Design" }, created_at: isoAgo(18 * DAY) },
    { id: "ev-t168", entity_type: "project", entity_id: "X31", action: "track_started", user_name: "Shubham Bansal", user_email: "shubham@noon.com", details: { track: "Dev" }, created_at: isoAgo(18 * DAY) },
    { id: "ev-t169", entity_type: "project", entity_id: "X31", action: "track_completed", user_name: "Youssef Nagy", user_email: "ynagy@noon.com", details: { track: "Dev" }, created_at: isoAgo(5 * DAY) },
    { id: "ev-t170", entity_type: "project", entity_id: "X31", action: "track_started", user_name: "Youssef Nagy", user_email: "ynagy@noon.com", details: { track: "QA" }, created_at: isoAgo(5 * DAY) },

    // ── X32 — Limited time deals (Storefront, Dev) ──
    { id: "ev-t171", entity_type: "project", entity_id: "X32", action: "project_created", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: {}, created_at: isoAgo(80 * DAY) },
    { id: "ev-t172", entity_type: "project", entity_id: "X32", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(79 * DAY) },
    { id: "ev-t173", entity_type: "project", entity_id: "X32", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(60 * DAY) },
    { id: "ev-t174", entity_type: "project", entity_id: "X32", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Design" }, created_at: isoAgo(60 * DAY) },
    { id: "ev-t175", entity_type: "project", entity_id: "X32", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Design" }, created_at: isoAgo(30 * DAY) },
    { id: "ev-t176", entity_type: "project", entity_id: "X32", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Dev" }, created_at: isoAgo(30 * DAY) },

    // ── X33 — Cross pollination (Storefront, Design) ──
    { id: "ev-t177", entity_type: "project", entity_id: "X33", action: "project_created", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: {}, created_at: isoAgo(40 * DAY) },
    { id: "ev-t178", entity_type: "project", entity_id: "X33", action: "track_started", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: { track: "PRD" }, created_at: isoAgo(39 * DAY) },
    { id: "ev-t179", entity_type: "project", entity_id: "X33", action: "track_completed", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: { track: "PRD" }, created_at: isoAgo(20 * DAY) },
    { id: "ev-t180", entity_type: "project", entity_id: "X33", action: "track_started", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: { track: "Design" }, created_at: isoAgo(20 * DAY) },

    // ── X34 — Webp images (Storefront, QA) ──
    { id: "ev-t181", entity_type: "project", entity_id: "X34", action: "project_created", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: {}, created_at: isoAgo(60 * DAY) },
    { id: "ev-t182", entity_type: "project", entity_id: "X34", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "PRD" }, created_at: isoAgo(59 * DAY) },
    { id: "ev-t183", entity_type: "project", entity_id: "X34", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "PRD" }, created_at: isoAgo(45 * DAY) },
    { id: "ev-t184", entity_type: "project", entity_id: "X34", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Design" }, created_at: isoAgo(45 * DAY) },
    { id: "ev-t185", entity_type: "project", entity_id: "X34", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Design" }, created_at: isoAgo(28 * DAY) },
    { id: "ev-t186", entity_type: "project", entity_id: "X34", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Dev" }, created_at: isoAgo(28 * DAY) },
    { id: "ev-t187", entity_type: "project", entity_id: "X34", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Dev" }, created_at: isoAgo(8 * DAY) },
    { id: "ev-t188", entity_type: "project", entity_id: "X34", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "QA" }, created_at: isoAgo(8 * DAY) },

    // ── X35 — Quara Monet (Storefront, Beta) ──
    { id: "ev-t189", entity_type: "project", entity_id: "X35", action: "project_created", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: {}, created_at: isoAgo(200 * DAY) },
    { id: "ev-t190", entity_type: "project", entity_id: "X35", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(199 * DAY) },
    { id: "ev-t191", entity_type: "project", entity_id: "X35", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(180 * DAY) },
    { id: "ev-t192", entity_type: "project", entity_id: "X35", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Design" }, created_at: isoAgo(180 * DAY) },
    { id: "ev-t193", entity_type: "project", entity_id: "X35", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Design" }, created_at: isoAgo(145 * DAY) },
    { id: "ev-t194", entity_type: "project", entity_id: "X35", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Dev" }, created_at: isoAgo(145 * DAY) },
    { id: "ev-t195", entity_type: "project", entity_id: "X35", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Dev" }, created_at: isoAgo(70 * DAY) },
    { id: "ev-t196", entity_type: "project", entity_id: "X35", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "QA" }, created_at: isoAgo(70 * DAY) },
    { id: "ev-t197", entity_type: "project", entity_id: "X35", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "QA" }, created_at: isoAgo(40 * DAY) },
    { id: "ev-t198", entity_type: "project", entity_id: "X35", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Alpha" }, created_at: isoAgo(40 * DAY) },
    { id: "ev-t199", entity_type: "project", entity_id: "X35", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Alpha" }, created_at: isoAgo(15 * DAY) },
    { id: "ev-t200", entity_type: "project", entity_id: "X35", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Beta", note: "Gradual rollout starting UAE+KSA", rolloutPct: 30 }, created_at: isoAgo(15 * DAY) },

    // ── X36 — App optimization (Storefront, Dev) ──
    { id: "ev-t201", entity_type: "project", entity_id: "X36", action: "project_created", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: {}, created_at: isoAgo(99 * DAY) },
    { id: "ev-t202", entity_type: "project", entity_id: "X36", action: "track_started", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "PRD" }, created_at: isoAgo(98 * DAY) },
    { id: "ev-t203", entity_type: "project", entity_id: "X36", action: "track_completed", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "PRD" }, created_at: isoAgo(75 * DAY) },
    { id: "ev-t204", entity_type: "project", entity_id: "X36", action: "track_started", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "Design" }, created_at: isoAgo(75 * DAY) },
    { id: "ev-t205", entity_type: "project", entity_id: "X36", action: "track_completed", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "Design" }, created_at: isoAgo(40 * DAY) },
    { id: "ev-t206", entity_type: "project", entity_id: "X36", action: "track_started", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "Dev" }, created_at: isoAgo(40 * DAY) },

    // ── X37 — Previously Bought tag (Storefront, PRD) ──
    { id: "ev-t207", entity_type: "project", entity_id: "X37", action: "project_created", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: {}, created_at: isoAgo(10 * DAY) },
    { id: "ev-t208", entity_type: "project", entity_id: "X37", action: "track_started", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: { track: "PRD" }, created_at: isoAgo(9 * DAY) },

    // ── X38 — Discount tag personalization (Storefront, Design) ──
    { id: "ev-t209", entity_type: "project", entity_id: "X38", action: "project_created", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: {}, created_at: isoAgo(35 * DAY) },
    { id: "ev-t210", entity_type: "project", entity_id: "X38", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(34 * DAY) },
    { id: "ev-t211", entity_type: "project", entity_id: "X38", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(18 * DAY) },
    { id: "ev-t212", entity_type: "project", entity_id: "X38", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Design" }, created_at: isoAgo(18 * DAY) },

    // ── X39 — Gifting Registry (Storefront, upcoming) ──
    { id: "ev-t213", entity_type: "project", entity_id: "X39", action: "project_created", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: {}, created_at: isoAgo(6 * DAY) },

    // ── X40 — Legacy to New models (Storefront, Alpha) ──
    { id: "ev-t214", entity_type: "project", entity_id: "X40", action: "project_created", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: {}, created_at: isoAgo(156 * DAY) },
    { id: "ev-t215", entity_type: "project", entity_id: "X40", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "PRD" }, created_at: isoAgo(155 * DAY) },
    { id: "ev-t216", entity_type: "project", entity_id: "X40", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "PRD" }, created_at: isoAgo(135 * DAY) },
    { id: "ev-t217", entity_type: "project", entity_id: "X40", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Design" }, created_at: isoAgo(135 * DAY) },
    { id: "ev-t218", entity_type: "project", entity_id: "X40", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Design" }, created_at: isoAgo(100 * DAY) },
    { id: "ev-t219", entity_type: "project", entity_id: "X40", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Dev" }, created_at: isoAgo(100 * DAY) },
    { id: "ev-t220", entity_type: "project", entity_id: "X40", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Dev" }, created_at: isoAgo(45 * DAY) },
    { id: "ev-t221", entity_type: "project", entity_id: "X40", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "QA" }, created_at: isoAgo(45 * DAY) },
    { id: "ev-t222", entity_type: "project", entity_id: "X40", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "QA" }, created_at: isoAgo(15 * DAY) },
    { id: "ev-t223", entity_type: "project", entity_id: "X40", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Alpha", note: "Migrating top 100 sellers first", rolloutPct: 5 }, created_at: isoAgo(15 * DAY) },

    // ── X41 — Virtual bundle (Storefront, Dev) ──
    { id: "ev-t224", entity_type: "project", entity_id: "X41", action: "project_created", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: {}, created_at: isoAgo(66 * DAY) },
    { id: "ev-t225", entity_type: "project", entity_id: "X41", action: "track_started", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "PRD" }, created_at: isoAgo(65 * DAY) },
    { id: "ev-t226", entity_type: "project", entity_id: "X41", action: "track_completed", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "PRD" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t227", entity_type: "project", entity_id: "X41", action: "track_started", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "Design" }, created_at: isoAgo(48 * DAY) },
    { id: "ev-t228", entity_type: "project", entity_id: "X41", action: "track_completed", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "Design" }, created_at: isoAgo(22 * DAY) },
    { id: "ev-t229", entity_type: "project", entity_id: "X41", action: "track_started", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: { track: "Dev" }, created_at: isoAgo(22 * DAY) },

    // ── X42 — Variants on PDP (Storefront, GA) ──
    { id: "ev-t230", entity_type: "project", entity_id: "X42", action: "project_created", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: {}, created_at: isoAgo(260 * DAY) },
    { id: "ev-t231", entity_type: "project", entity_id: "X42", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(259 * DAY) },
    { id: "ev-t232", entity_type: "project", entity_id: "X42", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Beta" }, created_at: isoAgo(61 * DAY) },

    // ── X43 — Hiding Carousels (Storefront, QA) ──
    { id: "ev-t233", entity_type: "project", entity_id: "X43", action: "project_created", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: {}, created_at: isoAgo(45 * DAY) },
    { id: "ev-t234", entity_type: "project", entity_id: "X43", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "PRD" }, created_at: isoAgo(44 * DAY) },
    { id: "ev-t235", entity_type: "project", entity_id: "X43", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "PRD" }, created_at: isoAgo(33 * DAY) },
    { id: "ev-t236", entity_type: "project", entity_id: "X43", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Design" }, created_at: isoAgo(33 * DAY) },
    { id: "ev-t237", entity_type: "project", entity_id: "X43", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Design" }, created_at: isoAgo(18 * DAY) },
    { id: "ev-t238", entity_type: "project", entity_id: "X43", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Dev" }, created_at: isoAgo(18 * DAY) },
    { id: "ev-t239", entity_type: "project", entity_id: "X43", action: "track_completed", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "Dev" }, created_at: isoAgo(5 * DAY) },
    { id: "ev-t240", entity_type: "project", entity_id: "X43", action: "track_started", user_name: "Mohammad Elbanna", user_email: "melbanna@noon.com", details: { track: "QA" }, created_at: isoAgo(5 * DAY) },

    // ── X44 — Video Reel Carousel (Storefront, PRD) ──
    { id: "ev-t241", entity_type: "project", entity_id: "X44", action: "project_created", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: {}, created_at: isoAgo(5 * DAY) },
    { id: "ev-t242", entity_type: "project", entity_id: "X44", action: "track_started", user_name: "Zeyad Tolba", user_email: "zeyad@noon.com", details: { track: "PRD" }, created_at: isoAgo(4 * DAY) },

    // ── X45 — Frenzy deals widget (Storefront, upcoming) ──
    { id: "ev-t243", entity_type: "project", entity_id: "X45", action: "project_created", user_name: "Sara Elkady", user_email: "saraelkady@noon.com", details: {}, created_at: isoAgo(4 * DAY) },

    // ── X46 — 2X2 Grid (Storefront, Design) ──
    { id: "ev-t244", entity_type: "project", entity_id: "X46", action: "project_created", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: {}, created_at: isoAgo(30 * DAY) },
    { id: "ev-t245", entity_type: "project", entity_id: "X46", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(29 * DAY) },
    { id: "ev-t246", entity_type: "project", entity_id: "X46", action: "track_completed", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "PRD" }, created_at: isoAgo(14 * DAY) },
    { id: "ev-t247", entity_type: "project", entity_id: "X46", action: "track_started", user_name: "Vaibhav Singh", user_email: "vaibhav@noon.com", details: { track: "Design" }, created_at: isoAgo(14 * DAY) },

    // ── Shoutouts & Feedback for shipped GA projects ──
    { id: "ev-t248", entity_type: "project", entity_id: "X05", action: "shoutout", user_name: "AJ", user_email: "ajain@noon.com", details: { from: "AJ", projectName: "Returns flow optimization" }, created_at: isoAgo(45 * DAY) },
    { id: "ev-t249", entity_type: "project", entity_id: "X05", action: "shoutout", user_name: "Khalid", user_email: "khalid@noon.com", details: { from: "Khalid", projectName: "Returns flow optimization" }, created_at: isoAgo(40 * DAY) },
    { id: "ev-t250", entity_type: "project", entity_id: "X05", action: "feedback", user_name: "Mariam", user_email: "mariam@noon.com", details: { from: "Mariam", projectName: "Returns flow optimization", comment: "Great improvement on the return processing speed. Customer complaints dropped significantly." }, created_at: isoAgo(43 * DAY) },
    { id: "ev-t251", entity_type: "project", entity_id: "X14", action: "shoutout", user_name: "Sara", user_email: "sara@noon.com", details: { from: "Sara", projectName: "Customer address validation" }, created_at: isoAgo(65 * DAY) },
    { id: "ev-t252", entity_type: "project", entity_id: "X14", action: "feedback", user_name: "Omar", user_email: "omar@noon.com", details: { from: "Omar", projectName: "Customer address validation", comment: "Address validation is catching edge cases well. Delivery failures in KSA are down 30%." }, created_at: isoAgo(60 * DAY) },
    { id: "ev-t253", entity_type: "project", entity_id: "X14", action: "shoutout", user_name: "Fatima", user_email: "fatima@noon.com", details: { from: "Fatima", projectName: "Customer address validation" }, created_at: isoAgo(55 * DAY) },
  ],
};

// ── Migrate all projects to tracks model ─────────────────────────
// Runs once at module load to add `tracks` and update `status` on every seed project.
import { migrateProjectToTracks, derivePrimaryPhase } from '../lib/tracks';

(() => {
  for (const p of seedProjects) {
    if (!p.tracks) {
      const { tracks, status } = migrateProjectToTracks(p, _state.events);
      p.tracks = tracks;
      p.status = status;
      p.phase = derivePrimaryPhase(p);
    }
  }
})();

// Add showcase projects with parallel tracks (multiple tracks active simultaneously)
(() => {
  const byId = (id) => seedProjects.find(p => p.id === id);

  // X01 Checkout speedup: PRD (done), Design (done), Dev + QA active (2 tracks)
  const x01 = byId("X01");
  if (x01?.tracks) {
    x01.tracks.QA = { periods: [{ started_at: isoAgo(2 * DAY), completed_at: null }], owner: null };
  }

  // X21 Onboarding Flow Revamp: PRD (done), Design + Dev + QA active (3 tracks)
  const x21 = byId("X21");
  if (x21?.tracks) {
    x21.tracks.QA = { periods: [{ started_at: isoAgo(1 * DAY), completed_at: null }], owner: null };
    if (!x21.tracks.Design || x21.tracks.Design.periods.every(p => p.completed_at)) {
      if (!x21.tracks.Design) x21.tracks.Design = { periods: [], owner: null };
      x21.tracks.Design.periods.push({ started_at: isoAgo(3 * DAY), completed_at: null });
    }
  }

  // X32 Limited time deals: Design reopened + Dev + QA active (3 tracks, Design has 2 periods)
  const x32 = byId("X32");
  if (x32?.tracks) {
    x32.tracks.Design = {
      periods: [
        { started_at: isoAgo(60 * DAY), completed_at: isoAgo(30 * DAY) },
        { started_at: isoAgo(5 * DAY), completed_at: null },
      ],
      owner: null,
    };
    x32.tracks.QA = { periods: [{ started_at: isoAgo(3 * DAY), completed_at: null }], owner: null };
  }

  // X02 Onboarding redesign: PRD (done,reopened,done), Design + Dev active (2 tracks, PRD has 3 periods)
  const x02 = byId("X02");
  if (x02) {
    if (!x02.tracks) x02.tracks = {};
    x02.tracks.PRD = { periods: [
      { started_at: isoAgo(90 * DAY), completed_at: isoAgo(70 * DAY) },
      { started_at: isoAgo(40 * DAY), completed_at: isoAgo(35 * DAY) },
      { started_at: isoAgo(15 * DAY), completed_at: isoAgo(10 * DAY) },
    ], owner: null };
    if (!x02.tracks.Dev) x02.tracks.Dev = { periods: [{ started_at: isoAgo(10 * DAY), completed_at: null }], owner: null };
  }

  // X04 Search relevance: PRD + Design + Dev active (3 tracks simultaneously)
  const x04 = byId("X04");
  if (x04?.tracks) {
    if (!x04.tracks.Design) x04.tracks.Design = { periods: [{ started_at: isoAgo(5 * DAY), completed_at: null }], owner: null };
    if (!x04.tracks.Dev) x04.tracks.Dev = { periods: [{ started_at: isoAgo(2 * DAY), completed_at: null }], owner: null };
  }

  // X07 Payment gateway migration: Dev (done, reopened) + QA active (2 tracks, Dev has 2 periods)
  const x07 = byId("X07");
  if (x07?.tracks) {
    if (x07.tracks.Dev) {
      x07.tracks.Dev.periods = [
        { started_at: isoAgo(45 * DAY), completed_at: isoAgo(20 * DAY) },
        { started_at: isoAgo(8 * DAY), completed_at: null },
      ];
    }
    if (!x07.tracks.QA) x07.tracks.QA = { periods: [{ started_at: isoAgo(5 * DAY), completed_at: null }], owner: null };
  }

  // X11 Subscription billing: PRD + Design active (2 tracks)
  const x11 = byId("X11");
  if (x11?.tracks) {
    if (!x11.tracks.Design) x11.tracks.Design = { periods: [{ started_at: isoAgo(3 * DAY), completed_at: null }], owner: null };
  }

  // X22 Address Caching: Design (done, reopened, done, reopened) + Dev active (Design has 4 periods)
  const x22 = byId("X22");
  if (x22?.tracks) {
    x22.tracks.Design = {
      periods: [
        { started_at: isoAgo(80 * DAY), completed_at: isoAgo(60 * DAY) },
        { started_at: isoAgo(50 * DAY), completed_at: isoAgo(40 * DAY) },
        { started_at: isoAgo(25 * DAY), completed_at: isoAgo(15 * DAY) },
        { started_at: isoAgo(5 * DAY), completed_at: null },
      ],
      owner: null,
    };
  }

  // X26 Passkeys: PRD + Design + Dev + QA active (4 tracks!)
  const x26 = byId("X26");
  if (x26?.tracks) {
    if (!x26.tracks.Design) x26.tracks.Design = { periods: [{ started_at: isoAgo(7 * DAY), completed_at: null }], owner: null };
    if (!x26.tracks.Dev) x26.tracks.Dev = { periods: [{ started_at: isoAgo(4 * DAY), completed_at: null }], owner: null };
    if (!x26.tracks.QA) x26.tracks.QA = { periods: [{ started_at: isoAgo(1 * DAY), completed_at: null }], owner: null };
  }

  // X10 Last-mile tracking: QA (done, reopened) + Dev active (QA has 2 periods)
  const x10 = byId("X10");
  if (x10?.tracks) {
    x10.tracks.QA = {
      periods: [
        { started_at: isoAgo(30 * DAY), completed_at: isoAgo(15 * DAY) },
        { started_at: isoAgo(4 * DAY), completed_at: null },
      ],
      owner: null,
    };
  }

  // ── Demo block / deprioritize history so timeline lines are visible ──
  // Each blocked/depri project gets a resolved past period (red line + resume
  // line) plus the current open period (red/grey line at the latest date).
  const x03b = byId("X03");
  if (x03b) {
    x03b.blockedTracks = ["QA"];
    x03b.statusHistory = [
      { type: "blocked", from: isoAgo(70 * DAY), to: isoAgo(40 * DAY) },
      { type: "blocked", from: x03b.blockedAt || isoAgo(5 * DAY), to: null },
    ];
  }
  const x12b = byId("X12");
  if (x12b) {
    x12b.blockedTracks = ["Dev"];
    x12b.statusHistory = [
      { type: "blocked", from: isoAgo(55 * DAY), to: isoAgo(28 * DAY) },
      { type: "blocked", from: x12b.blockedAt || isoAgo(3 * DAY), to: null },
    ];
  }
  const x06d = byId("X06");
  if (x06d) {
    x06d.deprioritizedAt = isoAgo(18 * DAY);
    x06d.blockedTracks = ["Dev"];
    x06d.statusHistory = [
      { type: "deprioritized", from: isoAgo(75 * DAY), to: isoAgo(45 * DAY) },
      { type: "deprioritized", from: isoAgo(18 * DAY), to: null },
    ];
  }
  const x15d = byId("X15");
  if (x15d) {
    x15d.deprioritizedAt = isoAgo(20 * DAY);
    x15d.blockedTracks = ["Design"];
    x15d.statusHistory = [
      { type: "deprioritized", from: isoAgo(80 * DAY), to: isoAgo(48 * DAY) },
      { type: "deprioritized", from: isoAgo(20 * DAY), to: null },
    ];
  }

  // Recompute derived phase for all modified projects
  for (const p of seedProjects) {
    p.phase = derivePrimaryPhase(p);
  }
})();

// Bump every project's last_activity_at to its actual most-recent event.
(() => {
  for (const p of seedProjects) {
    const allTs = [
      ..._state.comments.filter(c => c.project_id === p.id && !c.deleted_at).map(c => c.created_at),
      ..._state.events.filter(e => e.entity_id === p.id).map(e => e.created_at),
    ].map(s => new Date(s).getTime()).filter(t => Number.isFinite(t));
    if (allTs.length) p.lastActivityAt = new Date(Math.max(...allTs)).toISOString();
  }
})();

// ── Persistence layer: localStorage + cross-tab sync ──────────────
const STORAGE_KEY_STATE = "flow_devstore_state";
const STORAGE_KEY_PROJECTS = "flow_devstore_projects";
const STORAGE_KEY_PEOPLE = "flow_devstore_people";
const STORAGE_KEY_ROLES = "flow_devstore_roles";
const STORAGE_KEY_SQUADS = "flow_devstore_squads";

function _persistState() {
  try { localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(_state)); } catch { /* quota */ }
}
function _persistProjects() {
  try { localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(seedProjects)); } catch { /* quota */ }
}
function _persistPeople() {
  try { localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(seedPeople)); } catch { /* quota */ }
}
function _persistRoles() {
  try { localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(seedRoles)); } catch { /* quota */ }
}
function _persistSquads() {
  try { localStorage.setItem(STORAGE_KEY_SQUADS, JSON.stringify(seedSquads)); } catch { /* quota */ }
}

// Hydrate seedPeople from localStorage so role/squad/admin edits survive reload
(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PEOPLE);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length) {
        seedPeople.length = 0;
        arr.forEach(p => seedPeople.push(p));
      }
    }
  } catch { /* ignore */ }
})();

// Hydrate seedRoles / seedSquads from localStorage so Settings edits survive reload
(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ROLES);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length) {
        seedRoles.length = 0;
        arr.forEach(r => seedRoles.push(r));
      }
    }
  } catch { /* ignore */ }
})();
(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SQUADS);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length) {
        seedSquads.length = 0;
        arr.forEach(s => seedSquads.push(s));
      }
    }
  } catch { /* ignore */ }
})();

// Hydrate _state from localStorage if available
(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STATE);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.comments) _state.comments = parsed.comments;
      if (parsed.members) _state.members = parsed.members;
      if (parsed.events) _state.events = parsed.events;
      if (parsed.links) _state.links = parsed.links;
    }
  } catch { /* corrupt data, use seed defaults */ }
})();

// Hydrate seedProjects from localStorage if available
(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        seedProjects.length = 0;
        parsed.forEach(p => seedProjects.push(p));
        // Backfill type for projects persisted before the type field existed
        seedProjects.forEach((p, i) => { if (!p.type) p.type = PROJECT_TYPES[i % PROJECT_TYPES.length]; });
      }
    }
  } catch { /* corrupt data, use seed defaults */ }
})();

const _subs = new Set();
function notify(change) {
  _subs.forEach(fn => { try { fn(change); } catch { /* ignore */ } });
}

// Cross-tab sync: reload state when another tab writes to localStorage
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY_STATE && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.comments) _state.comments = parsed.comments;
        if (parsed.members) _state.members = parsed.members;
        if (parsed.events) _state.events = parsed.events;
        if (parsed.links) _state.links = parsed.links;
        notify({ type: "cross-tab-sync" });
      } catch { /* ignore */ }
    }
    if (e.key === STORAGE_KEY_PROJECTS && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          seedProjects.length = 0;
          parsed.forEach(p => seedProjects.push(p));
          notify({ type: "cross-tab-projects" });
        }
      } catch { /* ignore */ }
    }
  });
}

export const devStore = {
  // ── READ ──────────────────────────────────────────────────────
  listComments(projectId) {
    return _state.comments
      .filter(c => c.project_id === projectId)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  listMembers(projectId) {
    return _state.members.filter(m => m.project_id === projectId).slice();
  },
  listEvents(projectId) {
    return _state.events
      .filter(e => e.entity_type === "project" && e.entity_id === projectId)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  listLinks(projectId) {
    return _state.links.filter(l => l.project_id === projectId).slice();
  },
  listAllLinks() {
    return _state.links.slice();
  },
  listAllEvents() {
    return _state.events.slice();
  },

  // Cross-person reads (used by the People deep-dive).
  listMembershipsByPerson(personId) {
    return _state.members.filter(m => m.person_id === personId).slice();
  },
  listCommentsByAuthor(authorId, limit = 20) {
    return _state.comments
      .filter(c => c.author_id === authorId && !c.deleted_at)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },

  // ── COMMENTS ─────────────────────────────────────────────────
  addComment(projectId, authorId, body) {
    const row = {
      id: `cmt-${Math.random().toString(36).slice(2, 9)}`,
      project_id: projectId, author_id: authorId,
      body: body.trim(),
      created_at: new Date().toISOString(),
      edited_at: null, deleted_at: null,
    };
    _state.comments.unshift(row);
    _persistState();
    notify({ type: "comments", projectId, change: { op: "insert", row } });
    return row;
  },
  editComment(commentId, body) {
    const c = _state.comments.find(x => x.id === commentId);
    if (!c) return null;
    c.body = body.trim();
    c.edited_at = new Date().toISOString();
    _persistState();
    notify({ type: "comments", projectId: c.project_id, change: { op: "update", row: c } });
    return c;
  },
  softDeleteComment(commentId) {
    const c = _state.comments.find(x => x.id === commentId);
    if (!c) return null;
    c.deleted_at = new Date().toISOString();
    _persistState();
    notify({ type: "comments", projectId: c.project_id, change: { op: "update", row: c } });
    return c;
  },

  // ── MEMBERS ──────────────────────────────────────────────────
  addMember(projectId, personId, addedBy) {
    const existing = _state.members.find(m => m.project_id === projectId && m.person_id === personId);
    if (existing) return existing;
    const row = {
      id: `mem-${Math.random().toString(36).slice(2, 9)}`,
      project_id: projectId, person_id: personId,
      added_by: addedBy || null, added_at: new Date().toISOString(),
    };
    _state.members.push(row);
    _persistState();
    notify({ type: "members", projectId, change: { op: "insert", row } });
    return row;
  },
  removeMember(projectId, personId) {
    const idx = _state.members.findIndex(m => m.project_id === projectId && m.person_id === personId);
    if (idx === -1) return null;
    const [row] = _state.members.splice(idx, 1);
    _persistState();
    notify({ type: "members", projectId, change: { op: "delete", row } });
    return row;
  },

  // ── EVENTS (activity_log) ────────────────────────────────────
  logEvent({ projectId, action, userName, userEmail, details }) {
    const row = {
      id: `ev-${Math.random().toString(36).slice(2, 9)}`,
      entity_type: "project", entity_id: projectId,
      action,
      user_name: userName || "AJ",
      user_email: userEmail || "ajain@noon.com",
      details: details || null,
      created_at: new Date().toISOString(),
    };
    _state.events.unshift(row);
    _persistState();
    notify({ type: "events", projectId, change: { op: "insert", row } });
    return row;
  },

  // ── LINKS ────────────────────────────────────────────────────
  _addLink(row) {
    _state.links.push(row);
    _persistState();
    notify({ type: "links", projectId: row.project_id, change: { op: "insert", row } });
    return row;
  },
  _removeLink(linkId) {
    const idx = _state.links.findIndex(l => l.id === linkId);
    if (idx === -1) return null;
    const [row] = _state.links.splice(idx, 1);
    _persistState();
    notify({ type: "links", projectId: row.project_id, change: { op: "delete", row } });
    return row;
  },

  // ── PEOPLE ───────────────────────────────────────────────────
  addPerson({ name, squad, role }) {
    const id = `person-${Math.random().toString(36).slice(2, 9)}`;
    const squadObj = seedSquads.find(s => s.name === squad);
    const roleObj = seedRoles.find(r => r.name === role);
    const row = {
      id, name: name.trim(), squad: squad || null, role: role || null,
      squad_id: squadObj?.id || null, role_id: roleObj?.id || null,
    };
    seedPeople.push(row);
    notify({ type: "people", change: { op: "insert", row } });
    return row;
  },

  // ── Project persistence ──────────────────────────────────────
  persistProjects(projectsArray) {
    seedProjects.length = 0;
    projectsArray.forEach(p => seedProjects.push(p));
    _persistProjects();
  },

  // ── People persistence (role / squad / admin edits survive reload) ──
  persistPeople(peopleArray) {
    seedPeople.length = 0;
    peopleArray.forEach(p => seedPeople.push(p));
    _persistPeople();
  },

  // ── Roles / Squads persistence (Settings edits survive reload) ──
  // Accepts an array of name strings; rebuilds {id, name} objects, reusing the
  // existing id when the name is unchanged so identity is preserved.
  persistRoles(roleNames) {
    const byName = new Map(seedRoles.map(r => [r.name, r]));
    const next = roleNames.map(name => byName.get(name) || { id: `role-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name });
    seedRoles.length = 0;
    next.forEach(r => seedRoles.push(r));
    _persistRoles();
  },
  persistSquads(squadNames) {
    const byName = new Map(seedSquads.map(s => [s.name, s]));
    const next = squadNames.map(name => byName.get(name) || { id: `squad-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name });
    seedSquads.length = 0;
    next.forEach(s => seedSquads.push(s));
    _persistSquads();
  },

  // ── Realtime-ish subscription ────────────────────────────────
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); },
};

// Persist initial seed state so it survives reload even before any mutations
if (typeof window !== "undefined" && isDevSeedMode()) {
  if (!localStorage.getItem(STORAGE_KEY_STATE)) _persistState();
  if (!localStorage.getItem(STORAGE_KEY_PROJECTS)) _persistProjects();
  if (!localStorage.getItem(STORAGE_KEY_PEOPLE)) _persistPeople();
}

// Convenience: pre-populated project list with current lastActivityAt
export function getSeedProjects() {
  // Recompute lastActivityAt on read so post-mount mutations are reflected.
  return seedProjects.map(p => {
    const ts = [
      ..._state.comments.filter(c => c.project_id === p.id && !c.deleted_at).map(c => c.created_at),
      ..._state.events.filter(e => e.entity_id === p.id).map(e => e.created_at),
    ].map(s => new Date(s).getTime()).filter(Number.isFinite);
    return { ...p, lastActivityAt: ts.length ? new Date(Math.max(...ts)).toISOString() : p.lastActivityAt };
  });
}
