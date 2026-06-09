export function safeAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;

  const normalized = String(value ?? "")
    .trim()
    .replaceAll("，", ".")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("￥", "")
    .replaceAll("¥", "")
    .replaceAll("元", "")
    .replaceAll(" ", "");

  if (!normalized) return 0;

  const allowed = "0123456789+-*/().";
  if ([...normalized].some((char) => !allowed.includes(char))) return 0;

  try {
    const result = Function(`"use strict"; return (${normalized})`)();
    return Number.isFinite(result) && result > 0 ? result : 0;
  } catch {
    return 0;
  }
}

export function money(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("zh-CN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function shareForRecord(record, memberId) {
  const amount = safeAmount(record.amount);

  if (record.splitType === "aa") {
    const participantIds = record.participantIds?.length ? record.participantIds : [];
    return participantIds.includes(memberId) ? amount / participantIds.length : 0;
  }

  return record.payerId === memberId ? amount : 0;
}

function createMemberAmountMap(members) {
  return Object.fromEntries(members.map((member) => [member.id, 0]));
}

export function calculateLedgerStats(ledger) {
  const members = ledger?.members || [];
  const records = ledger?.records || [];
  const adjustments = ledger?.adjustments || [];

  const total = records.reduce((sum, record) => sum + safeAmount(record.amount), 0);
  const aaTotal = records.filter((record) => record.splitType === "aa").reduce((sum, record) => sum + safeAmount(record.amount), 0);
  const personalTotal = total - aaTotal;
  const perMember = members.length ? total / members.length : 0;

  const paid = createMemberAmountMap(members);
  const paidAA = createMemberAmountMap(members);
  const share = createMemberAmountMap(members);
  const shareAA = createMemberAmountMap(members);
  const adjustmentGiven = createMemberAmountMap(members);
  const adjustmentReceived = createMemberAmountMap(members);
  const memberNames = Object.fromEntries(members.map((member) => [member.id, member.name]));

  for (const record of records) {
    const amount = safeAmount(record.amount);
    if (paid[record.payerId] !== undefined) paid[record.payerId] += amount;
    if (record.splitType === "aa" && paidAA[record.payerId] !== undefined) paidAA[record.payerId] += amount;

    for (const member of members) {
      const memberShare = shareForRecord(record, member.id);
      share[member.id] += memberShare;
      if (record.splitType === "aa") shareAA[member.id] += memberShare;
    }
  }

  for (const adjustment of adjustments) {
    const amount = safeAmount(adjustment.amount);
    if (adjustmentGiven[adjustment.fromMemberId] !== undefined) adjustmentGiven[adjustment.fromMemberId] += amount;
    if (adjustmentReceived[adjustment.toMemberId] !== undefined) adjustmentReceived[adjustment.toMemberId] += amount;
  }

  const membersSummary = members.map((member) => {
    const net = (paid[member.id] || 0) - (share[member.id] || 0) + (adjustmentGiven[member.id] || 0) - (adjustmentReceived[member.id] || 0);

    return {
      memberId: member.id,
      name: member.name,
      paid: paid[member.id] || 0,
      paidAA: paidAA[member.id] || 0,
      share: share[member.id] || 0,
      shareAA: shareAA[member.id] || 0,
      adjustmentGiven: adjustmentGiven[member.id] || 0,
      adjustmentReceived: adjustmentReceived[member.id] || 0,
      net,
    };
  });

  const debtors = membersSummary.filter((item) => item.net < -0.005).map((item) => ({ ...item, amount: -item.net }));
  const creditors = membersSummary.filter((item) => item.net > 0.005).map((item) => ({ ...item, amount: item.net }));
  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    if (amount > 0.005) {
      transfers.push({
        fromMemberId: debtors[debtorIndex].memberId,
        from: debtors[debtorIndex].name,
        toMemberId: creditors[creditorIndex].memberId,
        to: creditors[creditorIndex].name,
        amount,
      });
    }

    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount <= 0.005) debtorIndex += 1;
    if (creditors[creditorIndex].amount <= 0.005) creditorIndex += 1;
  }

  const dailyMap = new Map();
  const categoryMap = new Map();

  for (const record of records) {
    const amount = safeAmount(record.amount);
    const day = dailyMap.get(record.date) || { date: record.date, total: 0, aaTotal: 0, personalTotal: 0 };
    day.total += amount;
    if (record.splitType === "aa") day.aaTotal += amount;
    if (record.splitType !== "aa") day.personalTotal += amount;
    dailyMap.set(record.date, day);

    const category = categoryMap.get(record.category) || { category: record.category, total: 0, count: 0 };
    category.total += amount;
    category.count += 1;
    categoryMap.set(record.category, category);
  }

  return {
    total,
    aaTotal,
    personalTotal,
    perMember,
    paid,
    share,
    paidAA,
    shareAA,
    adjustmentGiven,
    adjustmentReceived,
    adjustmentTotal: adjustments.reduce((sum, adjustment) => sum + safeAmount(adjustment.amount), 0),
    membersSummary,
    transfers,
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    categories: [...categoryMap.values()].sort((a, b) => b.total - a.total),
    memberNames,
  };
}
