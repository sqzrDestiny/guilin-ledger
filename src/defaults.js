export const APP_STORAGE_KEY = "travel-ledger-app-v2";
export const LEGACY_STORAGE_KEY = "guilin-trip-ledger-v1";

export const DEFAULT_CATEGORIES = ["餐饮", "交通", "住宿", "门票", "娱乐", "购物", "其他"];

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function createMember(name) {
  return {
    id: uid("member"),
    name: name.trim(),
  };
}

export function createLedger(name = "旅行账本", memberNames = ["我", "朋友A"]) {
  const members = memberNames.map((memberName) => createMember(memberName));
  const now = today();

  return {
    id: uid("ledger"),
    name: name.trim() || "旅行账本",
    createdAt: now,
    updatedAt: now,
    members,
    categories: DEFAULT_CATEGORIES,
    records: [],
    logs: [],
    adjustments: [],
  };
}

export function createInitialState() {
  const firstLedger = createLedger();

  return {
    version: 2,
    currentLedgerId: firstLedger.id,
    ledgers: [firstLedger],
  };
}
