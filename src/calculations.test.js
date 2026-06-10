import { describe, expect, it } from "vitest";
import { calculateLedgerStats, safeAmount, shareForRecord } from "./calculations";

const members = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
];

function aaRecord(overrides = {}) {
  return {
    id: "record",
    date: "2026-06-10",
    title: "Shared expense",
    amount: 100,
    category: "餐饮",
    payerId: "a",
    splitType: "aa",
    participantIds: ["a", "b"],
    note: "",
    ...overrides,
  };
}

function personalRecord(overrides = {}) {
  return {
    id: "personal",
    date: "2026-06-10",
    title: "Personal expense",
    amount: 42,
    category: "购物",
    payerId: "b",
    splitType: "personal",
    participantIds: [],
    note: "",
    ...overrides,
  };
}

function ledger(overrides = {}) {
  return {
    id: "ledger",
    name: "Test ledger",
    members: members.slice(0, 3),
    categories: ["餐饮", "交通", "购物"],
    records: [],
    logs: [],
    adjustments: [],
    ...overrides,
  };
}

describe("safeAmount", () => {
  it("keeps positive numeric amounts", () => {
    expect(safeAmount(86)).toBe(86);
  });

  it("parses string numbers and decimal amounts", () => {
    expect(safeAmount("128")).toBe(128);
    expect(safeAmount("19.75")).toBe(19.75);
  });

  it("returns 0 for empty, null, non-positive, or illegal input", () => {
    expect(safeAmount("")).toBe(0);
    expect(safeAmount(null)).toBe(0);
    expect(safeAmount(-3)).toBe(0);
    expect(safeAmount("not money")).toBe(0);
  });

  it("supports simple arithmetic expressions", () => {
    expect(safeAmount("100-25")).toBe(75);
    expect(safeAmount("80/2")).toBe(40);
    expect(safeAmount("10+5*2")).toBe(20);
  });

  it("strips common currency characters", () => {
    expect(safeAmount("¥12.5元")).toBe(12.5);
  });
});

describe("shareForRecord", () => {
  it("splits a two-person AA record evenly", () => {
    const record = aaRecord({ amount: 100, participantIds: ["a", "b"] });

    expect(shareForRecord(record, "a")).toBe(50);
    expect(shareForRecord(record, "b")).toBe(50);
    expect(shareForRecord(record, "c")).toBe(0);
  });

  it("splits a three-person AA record evenly", () => {
    const record = aaRecord({ amount: 90, participantIds: ["a", "b", "c"] });

    expect(shareForRecord(record, "a")).toBe(30);
    expect(shareForRecord(record, "b")).toBe(30);
    expect(shareForRecord(record, "c")).toBe(30);
  });

  it("splits a multi-person AA record evenly", () => {
    const record = aaRecord({ amount: 80, participantIds: ["a", "b", "c", "d"] });

    for (const member of members) {
      expect(shareForRecord(record, member.id)).toBe(20);
    }
  });

  it("only charges members selected for partial AA", () => {
    const record = aaRecord({ amount: 60, payerId: "a", participantIds: ["b", "c"] });

    expect(shareForRecord(record, "a")).toBe(0);
    expect(shareForRecord(record, "b")).toBe(30);
    expect(shareForRecord(record, "c")).toBe(30);
  });

  it("charges only the payer for personal expenses", () => {
    const record = personalRecord({ amount: 42, payerId: "b" });

    expect(shareForRecord(record, "a")).toBe(0);
    expect(shareForRecord(record, "b")).toBe(42);
  });

  it("keeps fractional shares when the amount cannot be divided evenly", () => {
    const record = aaRecord({ amount: 100, participantIds: ["a", "b", "c"] });

    expect(shareForRecord(record, "a")).toBeCloseTo(33.333333, 5);
  });
});

describe("calculateLedgerStats", () => {
  it("calculates a single AA expense and settlement suggestions", () => {
    const stats = calculateLedgerStats(
      ledger({
        records: [aaRecord({ amount: 90, payerId: "a", participantIds: ["a", "b", "c"] })],
      }),
    );

    expect(stats.total).toBe(90);
    expect(stats.aaTotal).toBe(90);
    expect(stats.personalTotal).toBe(0);
    expect(stats.membersSummary).toEqual([
      expect.objectContaining({ memberId: "a", paid: 90, share: 30, net: 60 }),
      expect.objectContaining({ memberId: "b", paid: 0, share: 30, net: -30 }),
      expect.objectContaining({ memberId: "c", paid: 0, share: 30, net: -30 }),
    ]);
    expect(stats.transfers).toEqual([
      expect.objectContaining({ fromMemberId: "b", toMemberId: "a", amount: 30 }),
      expect.objectContaining({ fromMemberId: "c", toMemberId: "a", amount: 30 }),
    ]);
  });

  it("handles multiple records, different payers, partial AA, personal expenses, and adjustments", () => {
    const stats = calculateLedgerStats(
      ledger({
        records: [
          aaRecord({ id: "r1", date: "2026-06-10", amount: 120, payerId: "a", participantIds: ["a", "b", "c"] }),
          aaRecord({ id: "r2", date: "2026-06-10", amount: 60, payerId: "b", participantIds: ["a", "b"] }),
          personalRecord({ id: "r3", date: "2026-06-11", amount: 45, payerId: "c" }),
          aaRecord({ id: "r4", date: "2026-06-11", amount: 100, payerId: "c", participantIds: ["b", "c"], category: "交通" }),
        ],
        adjustments: [
          {
            id: "adj1",
            date: "2026-06-11",
            title: "B already paid A",
            fromMemberId: "b",
            toMemberId: "a",
            amount: 20,
            note: "",
          },
        ],
      }),
    );

    expect(stats.total).toBe(325);
    expect(stats.aaTotal).toBe(280);
    expect(stats.personalTotal).toBe(45);
    expect(stats.adjustmentTotal).toBe(20);
    expect(stats.perMember).toBeCloseTo(108.333333, 5);

    expect(stats.membersSummary).toEqual([
      expect.objectContaining({ memberId: "a", paid: 120, share: 70, net: 30 }),
      expect.objectContaining({ memberId: "b", paid: 60, share: 120, net: -40 }),
      expect.objectContaining({ memberId: "c", paid: 145, share: 135, net: 10 }),
    ]);

    expect(stats.transfers).toEqual([
      expect.objectContaining({ fromMemberId: "b", toMemberId: "a", amount: 30 }),
      expect.objectContaining({ fromMemberId: "b", toMemberId: "c", amount: 10 }),
    ]);

    expect(stats.daily).toEqual([
      expect.objectContaining({ date: "2026-06-10", total: 180, aaTotal: 180, personalTotal: 0 }),
      expect.objectContaining({ date: "2026-06-11", total: 145, aaTotal: 100, personalTotal: 45 }),
    ]);
    expect(stats.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "餐饮", total: 180, count: 2 }),
        expect.objectContaining({ category: "交通", total: 100, count: 1 }),
        expect.objectContaining({ category: "购物", total: 45, count: 1 }),
      ]),
    );
  });
});
