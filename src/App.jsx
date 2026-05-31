import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  CalendarDays,
  Camera,
  Download,
  FileDown,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Trash2,
  X,
  Users,
  WalletCards,
} from "lucide-react";

const STORAGE_KEY = "guilin-trip-ledger-v1";
const categories = ["交通", "住宿", "吃饭", "门票/项目", "奶茶", "购物", "纪念品", "其他"];
const today = new Date().toISOString().slice(0, 10);

const initialData = {
  tripName: "桂林之行",
  people: ["小张", "小黄", "小段"],
  me: "小张",
  expenses: [],
  logs: [],
  adjustments: [],
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(n) {
  const value = Number(n || 0);
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function safeAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;

  const text = String(value ?? "")
    .trim()
    .replaceAll("，", ".")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("￥", "")
    .replaceAll("元", "");

  if (!text) return 0;

  const normalized = text.replaceAll(" ", "");
  const allowed = "0123456789+-*/().";
  const isSafeExpression = [...normalized].every((ch) => allowed.includes(ch));
  if (!isSafeExpression) return 0;

  try {
    const result = Function(`"use strict"; return (${normalized})`)();
    return Number.isFinite(result) && result > 0 ? result : 0;
  } catch {
    return 0;
  }
}

function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Card({ children, className = "" }) {
  return <section className={`rounded-3xl bg-white/85 p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</section>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-600">{label}</div>
      {children}
    </label>
  );
}

function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    soft: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function App() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialData;
      const parsed = JSON.parse(raw);
      return {
        ...initialData,
        ...parsed,
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
      };
    } catch {
      return initialData;
    }
  });

  const [expenseForm, setExpenseForm] = useState({
    date: today,
    title: "",
    amount: "",
    category: "吃饭",
    payer: data.me || "我",
    isAA: true,
    participants: data.people,
    note: "",
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    date: today,
    title: "",
    from: data.people[1] || "小黄",
    to: data.me || "我",
    amount: "",
    note: "",
  });

  const [logForm, setLogForm] = useState({ date: today, title: "", location: "", detail: "" });
  const [peopleDraft, setPeopleDraft] = useState(data.people.join("、"));
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editExpenseForm, setEditExpenseForm] = useState(null);
  const [expenseFilter, setExpenseFilter] = useState("全部");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);

  const people = data.people.length ? data.people : initialData.people;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!people.includes(expenseForm.payer)) {
      setExpenseForm((prev) => ({ ...prev, payer: people[0], participants: people }));
    }
    if (!people.includes(adjustmentForm.from) || !people.includes(adjustmentForm.to)) {
      setAdjustmentForm((prev) => ({
        ...prev,
        from: people.find((p) => p !== data.me) || people[0],
        to: people.includes(data.me) ? data.me : people[0],
      }));
    }
  }, [people.join("|")]);

  function shareFor(expense, person, onlyAA = false) {
    const amount = safeAmount(expense.amount);
    if (expense.isAA) {
      const participants = expense.participants?.length ? expense.participants : people;
      return participants.includes(person) ? amount / participants.length : 0;
    }
    if (onlyAA) return 0;
    return expense.payer === person ? amount : 0;
  }

  const sortedExpenses = useMemo(() => {
    return [...data.expenses].sort((a, b) => `${a.date}${a.title}`.localeCompare(`${b.date}${b.title}`));
  }, [data.expenses]);

  const filteredExpenses = useMemo(() => {
    let result = sortedExpenses;
    if (expenseFilter === "AA") result = result.filter((expense) => expense.isAA);
    if (expenseFilter === "不AA") result = result.filter((expense) => !expense.isAA);
    if (dateFilter.start) result = result.filter((expense) => expense.date >= dateFilter.start);
    if (dateFilter.end) result = result.filter((expense) => expense.date <= dateFilter.end);
    return result;
  }, [sortedExpenses, expenseFilter, dateFilter]);

  const sortedAdjustments = useMemo(() => {
    return [...(data.adjustments || [])].sort((a, b) => `${a.date}${a.title}`.localeCompare(`${b.date}${b.title}`));
  }, [data.adjustments]);

  const sortedLogs = useMemo(() => {
    return [...data.logs].sort((a, b) => `${a.date}${a.title}`.localeCompare(`${b.date}${b.title}`));
  }, [data.logs]);

  const stats = useMemo(() => {
    const total = data.expenses.reduce((s, e) => s + safeAmount(e.amount), 0);
    const aaTotal = data.expenses.filter((e) => e.isAA).reduce((s, e) => s + safeAmount(e.amount), 0);
    const personalTotal = total - aaTotal;
    const myShare = data.expenses.reduce((s, e) => s + shareFor(e, data.me), 0);

    const paidAA = Object.fromEntries(people.map((p) => [p, 0]));
    const shareAA = Object.fromEntries(people.map((p) => [p, 0]));
    const adjustmentGiven = Object.fromEntries(people.map((p) => [p, 0]));
    const adjustmentReceived = Object.fromEntries(people.map((p) => [p, 0]));

    for (const expense of data.expenses) {
      const amount = safeAmount(expense.amount);
      for (const p of people) shareAA[p] += shareFor(expense, p, true);
      if (expense.isAA && paidAA[expense.payer] !== undefined) paidAA[expense.payer] += amount;
    }

    for (const adjustment of data.adjustments || []) {
      const amount = safeAmount(adjustment.amount);
      if (adjustmentGiven[adjustment.from] !== undefined) adjustmentGiven[adjustment.from] += amount;
      if (adjustmentReceived[adjustment.to] !== undefined) adjustmentReceived[adjustment.to] += amount;
    }

    const nets = people.map((p) => ({
      name: p,
      net: (paidAA[p] || 0) - (shareAA[p] || 0) + (adjustmentGiven[p] || 0) - (adjustmentReceived[p] || 0),
    }));

    const debtors = nets.filter((x) => x.net < -0.005).map((x) => ({ ...x, amount: -x.net }));
    const creditors = nets.filter((x) => x.net > 0.005).map((x) => ({ ...x, amount: x.net }));
    const transfers = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amount, creditors[j].amount);
      if (pay > 0.005) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
      if (debtors[i].amount <= 0.005) i += 1;
      if (creditors[j].amount <= 0.005) j += 1;
    }

    const dailyMap = new Map();
    const categoryMap = new Map();
    for (const expense of data.expenses) {
      const amount = safeAmount(expense.amount);
      const day = dailyMap.get(expense.date) || { date: expense.date, total: 0, myShare: 0 };
      day.total += amount;
      day.myShare += shareFor(expense, data.me);
      dailyMap.set(expense.date, day);

      const cat = categoryMap.get(expense.category) || { category: expense.category, total: 0, myShare: 0 };
      cat.total += amount;
      cat.myShare += shareFor(expense, data.me);
      categoryMap.set(expense.category, cat);
    }

    const adjustmentTotal = (data.adjustments || []).reduce((s, item) => s + safeAmount(item.amount), 0);

    return {
      total,
      aaTotal,
      personalTotal,
      myShare,
      paidAA,
      shareAA,
      adjustmentGiven,
      adjustmentReceived,
      adjustmentTotal,
      nets,
      transfers,
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      categories: [...categoryMap.values()].sort((a, b) => b.total - a.total),
    };
  }, [data.expenses, data.adjustments, data.me, people.join("|")]);

  function applyPeople() {
    const nextPeople = peopleDraft
      .replaceAll("，", "、")
      .replaceAll(",", "、")
      .replaceAll(" ", "、")
      .split("、")
      .map((x) => x.trim())
      .filter(Boolean);
    if (nextPeople.length < 1) return alert("至少保留一个参与人");
    setData((prev) => ({ ...prev, people: nextPeople, me: nextPeople.includes(prev.me) ? prev.me : nextPeople[0] }));
    setExpenseForm((prev) => ({ ...prev, payer: nextPeople.includes(prev.payer) ? prev.payer : nextPeople[0], participants: nextPeople }));
    setAdjustmentForm((prev) => ({ ...prev, from: nextPeople.includes(prev.from) ? prev.from : nextPeople[0], to: nextPeople.includes(prev.to) ? prev.to : nextPeople[0] }));
  }

  function addExpense(e) {
    e.preventDefault();
    const amount = safeAmount(expenseForm.amount);
    if (!expenseForm.title.trim()) return alert("先写一下花了什么");
    if (!amount) return alert("金额要大于 0");
    const participants = expenseForm.isAA ? expenseForm.participants.filter((p) => people.includes(p)) : [];
    if (expenseForm.isAA && participants.length === 0) return alert("AA 项至少选择一个参与人");

    setData((prev) => ({
      ...prev,
      expenses: [...prev.expenses, { id: uid(), ...expenseForm, title: expenseForm.title.trim(), note: expenseForm.note.trim(), amount, participants: expenseForm.isAA ? participants : [] }],
    }));
    setExpenseForm((prev) => ({ ...prev, title: "", amount: "", note: "", participants: people }));
  }

  function addAdjustment(e) {
    e.preventDefault();
    const amount = safeAmount(adjustmentForm.amount);
    if (!adjustmentForm.title.trim()) return alert("先写一下调整原因");
    if (!amount) return alert("金额要大于 0");
    if (adjustmentForm.from === adjustmentForm.to) return alert("付款人和收款人不能是同一个人");

    setData((prev) => ({
      ...prev,
      adjustments: [...(prev.adjustments || []), { id: uid(), ...adjustmentForm, title: adjustmentForm.title.trim(), note: adjustmentForm.note.trim(), amount }],
    }));
    setAdjustmentForm((prev) => ({ ...prev, title: "", amount: "", note: "" }));
  }

  function addLog(e) {
    e.preventDefault();
    if (!logForm.title.trim()) return alert("先写一下当天干了什么");
    setData((prev) => ({ ...prev, logs: [...prev.logs, { id: uid(), ...logForm, title: logForm.title.trim(), location: logForm.location.trim(), detail: logForm.detail.trim() }] }));
    setLogForm((prev) => ({ ...prev, title: "", location: "", detail: "" }));
  }

  function removeExpense(id) {
    setData((prev) => ({ ...prev, expenses: prev.expenses.filter((x) => x.id !== id) }));
    if (editingExpenseId === id) cancelEditExpense();
  }

  function removeAdjustment(id) {
    setData((prev) => ({ ...prev, adjustments: (prev.adjustments || []).filter((x) => x.id !== id) }));
  }

  function removeLog(id) {
    setData((prev) => ({ ...prev, logs: prev.logs.filter((x) => x.id !== id) }));
  }

  function startEditExpense(expense) {
    setEditingExpenseId(expense.id);
    setEditExpenseForm({
      date: expense.date,
      title: expense.title,
      amount: String(expense.amount ?? ""),
      category: expense.category,
      payer: expense.payer,
      isAA: !!expense.isAA,
      participants: expense.isAA ? (expense.participants?.length ? expense.participants : people) : [],
      note: expense.note || "",
    });
  }

  function cancelEditExpense() {
    setEditingExpenseId(null);
    setEditExpenseForm(null);
  }

  function saveEditExpense(id) {
    if (!editExpenseForm) return;
    const amount = safeAmount(editExpenseForm.amount);
    if (!editExpenseForm.title.trim()) return alert("项目名称不能为空");
    if (!amount) return alert("金额要大于 0");
    const participants = editExpenseForm.isAA ? editExpenseForm.participants.filter((p) => people.includes(p)) : [];
    if (editExpenseForm.isAA && participants.length === 0) return alert("AA 项至少选择一个参与人");

    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.map((expense) =>
        expense.id === id
          ? { ...expense, ...editExpenseForm, title: editExpenseForm.title.trim(), note: editExpenseForm.note.trim(), amount, participants: editExpenseForm.isAA ? participants : [] }
          : expense
      ),
    }));
    cancelEditExpense();
  }

  function exportJson() {
    downloadText(`${data.tripName || "旅行账本"}-数据备份.json`, JSON.stringify(data, null, 2));
  }

  function exportCsv() {
    const rows = [];
    rows.push(["日期", "项目", "金额", "分类", "付款人", "是否AA", "参与人", "我承担", "备注"]);
    for (const expense of sortedExpenses) {
      rows.push([
        expense.date,
        expense.title,
        safeAmount(expense.amount),
        expense.category,
        expense.payer,
        expense.isAA ? "是" : "否",
        expense.isAA ? (expense.participants || []).join("/") : "不参与分账",
        shareFor(expense, data.me).toFixed(2),
        expense.note || "",
      ]);
    }
    rows.push([]);
    rows.push(["结算调整", "说明", "金额", "谁已经给出", "谁已经收到", "备注"]);
    for (const item of sortedAdjustments) rows.push([item.date, item.title, safeAmount(item.amount), item.from, item.to, item.note || ""]);
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join(String.fromCharCode(10));
    downloadText(`${data.tripName || "旅行账本"}-消费明细.csv`, String.fromCharCode(0xfeff) + csv, "text/csv;charset=utf-8");
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!Array.isArray(imported.expenses) || !Array.isArray(imported.logs)) throw new Error("bad data");
        setData({ ...initialData, ...imported, adjustments: Array.isArray(imported.adjustments) ? imported.adjustments : [] });
        setPeopleDraft((imported.people || initialData.people).join("、"));
      } catch {
        alert("导入失败：请选择之前导出的 JSON 备份文件");
      }
    };
    reader.readAsText(file);
  }

  async function exportImage() {
    if (!reportRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#f8fafc", scale: 2, useCORS: true });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.tripName || "旅行账本"}-纪念账单.png`;
      a.click();
    } catch {
      alert("导出图片失败。可以先用浏览器截图；或检查当前运行环境是否支持 html2canvas。");
    }
  }

  function resetAll() {
    const ok = confirm("确定清空当前账本吗？建议先导出 JSON 备份。");
    if (!ok) return;
    setData(initialData);
    setPeopleDraft(initialData.people.join("、"));
  }

  const maxDaily = Math.max(1, ...stats.daily.map((x) => x.total));
  const maxCategory = Math.max(1, ...stats.categories.map((x) => x.total));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-emerald-50 p-5 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-5">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-white/80 p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"><WalletCards className="h-4 w-4" />旅行账本 · 本地保存 · 可导出纪念图</div>
              <input className="w-full bg-transparent text-4xl font-bold tracking-tight outline-none lg:text-5xl" value={data.tripName} onChange={(e) => setData((prev) => ({ ...prev, tripName: e.target.value }))} />
              <p className="mt-2 text-slate-600">记录行程、消费、AA 结算，以及已经提前给过的钱。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="soft" onClick={exportJson}><FileDown className="h-4 w-4" />导出备份</Button>
              <Button variant="soft" onClick={exportCsv}><Download className="h-4 w-4" />导出明细</Button>
              <Button onClick={exportImage}><Camera className="h-4 w-4" />导出纪念图</Button>
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>导入</Button>
            </div>
          </div>
        </motion.header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_1.95fr]">
          <div className="space-y-5">
            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5" />基础设置</div>
              <div className="space-y-4">
                <Field label="参与人（用顿号/逗号/空格分隔）">
                  <div className="flex gap-2"><input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" value={peopleDraft} onChange={(e) => setPeopleDraft(e.target.value)} /><Button variant="soft" onClick={applyPeople}>应用</Button></div>
                </Field>
                <Field label="我是谁（用于计算“我承担多少”）">
                  <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" value={data.me} onChange={(e) => setData((prev) => ({ ...prev, me: e.target.value }))}>{people.map((p) => <option key={p}>{p}</option>)}</select>
                </Field>
                <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600"><b>规则：</b>消费记录负责计算总花费；结算调整只影响最后谁还要转给谁，不计入总消费。</div>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold"><Plus className="h-5 w-5" />添加消费</div>
              <form className="space-y-4" onSubmit={addExpense}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="日期"><input type="date" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></Field>
                  <Field label="金额"><input type="text" inputMode="decimal" placeholder="例如 300 或 8-1" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></Field>
                </div>
                <Field label="花了什么"><input placeholder="例如 竹筏 / 晚饭 / 打车" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="分类"><select className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="谁付的钱"><select className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={expenseForm.payer} onChange={(e) => setExpenseForm({ ...expenseForm, payer: e.target.value })}>{people.map((p) => <option key={p}>{p}</option>)}</select></Field>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-medium text-slate-700"><input type="checkbox" className="h-4 w-4" checked={expenseForm.isAA} onChange={(e) => setExpenseForm({ ...expenseForm, isAA: e.target.checked, participants: e.target.checked ? people : [] })} />这笔参与 AA / 分账</label>
                {expenseForm.isAA && <div><div className="mb-2 text-sm font-medium text-slate-600">参与 AA 的人</div><div className="flex flex-wrap gap-2">{people.map((p) => { const checked = expenseForm.participants.includes(p); return <label key={p} className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ring-1 ${checked ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}><input className="hidden" type="checkbox" checked={checked} onChange={() => setExpenseForm((prev) => ({ ...prev, participants: checked ? prev.participants.filter((x) => x !== p) : [...prev.participants, p] }))} />{p}</label>; })}</div><div className="mt-2 text-sm text-slate-500">当前每人承担：¥{money(safeAmount(expenseForm.amount) / Math.max(1, expenseForm.participants.length))}</div></div>}
                <Field label="备注（可选）"><input placeholder="例如 小黄先垫付 / 只买了两张票" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} /></Field>
                <Button className="w-full" type="submit"><Plus className="h-4 w-4" />加入账本</Button>
              </form>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold"><ArrowRightLeft className="h-5 w-5" />添加结算调整</div>
              <form className="space-y-4" onSubmit={addAdjustment}>
                <div className="rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">这里记录“谁已经给了谁多少钱”。例如第一次酒店小黄已经给我 100，就填：小黄 → 我，100。它会从最终要 A 的钱里自动抵扣。</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="日期"><input type="date" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.date} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, date: e.target.value })} /></Field>
                  <Field label="金额"><input type="text" inputMode="decimal" placeholder="例如 100 或 120-20" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.amount} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })} /></Field>
                </div>
                <Field label="调整原因"><input placeholder="例如 第一次酒店已转 / 退款抵扣" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.title} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, title: e.target.value })} /></Field>
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2"><Field label="谁已经给出"><select className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.from} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, from: e.target.value })}>{people.map((p) => <option key={p}>{p}</option>)}</select></Field><div className="pb-2 text-slate-400">→</div><Field label="谁已经收到"><select className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.to} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, to: e.target.value })}>{people.map((p) => <option key={p}>{p}</option>)}</select></Field></div>
                <Field label="备注（可选）"><input placeholder="例如 换酒店后不再单独结算这笔" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.note} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, note: e.target.value })} /></Field>
                <Button className="w-full" type="submit"><Plus className="h-4 w-4" />加入调整</Button>
              </form>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5" />添加行程记录</div>
              <form className="space-y-4" onSubmit={addLog}>
                <Field label="日期"><input type="date" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} /></Field>
                <Field label="当天干了什么"><input placeholder="例如 到桂林北、逛东西巷" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={logForm.title} onChange={(e) => setLogForm({ ...logForm, title: e.target.value })} /></Field>
                <Field label="地点（可选）"><input placeholder="例如 桂林 / 阳朔 / 遇龙河" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={logForm.location} onChange={(e) => setLogForm({ ...logForm, location: e.target.value })} /></Field>
                <Field label="补充描述（可选）"><textarea rows={3} placeholder="可以写发生的小事、照片点、当天感受" className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={logForm.detail} onChange={(e) => setLogForm({ ...logForm, detail: e.target.value })} /></Field>
                <Button className="w-full" type="submit"><Plus className="h-4 w-4" />加入行程</Button>
              </form>
            </Card>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-4"><div className="text-sm text-slate-500">总消费</div><div className="mt-2 text-2xl font-bold">¥{money(stats.total)}</div></Card>
              <Card className="p-4"><div className="text-sm text-slate-500">AA 总额</div><div className="mt-2 text-2xl font-bold">¥{money(stats.aaTotal)}</div></Card>
              <Card className="p-4"><div className="text-sm text-slate-500">非 AA 个人消费</div><div className="mt-2 text-2xl font-bold">¥{money(stats.personalTotal)}</div></Card>
              <Card className="p-4"><div className="text-sm text-slate-500">{data.me}承担</div><div className="mt-2 text-2xl font-bold">¥{money(stats.myShare)}</div></Card>
            </div>

            <Card>
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold"><ReceiptText className="h-5 w-5" />消费明细</div>
                <div className="flex flex-wrap items-center gap-2">
                  {["全部", "AA", "不AA"].map((filter) => <button key={filter} type="button" className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${expenseFilter === filter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} onClick={() => setExpenseFilter(filter)}>{filter}</button>)}
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span>日期</span><input type="date" className="rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={dateFilter.start} onChange={(event) => setDateFilter((prev) => ({ ...prev, start: event.target.value }))} /><span>至</span><input type="date" className="rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={dateFilter.end} onChange={(event) => setDateFilter((prev) => ({ ...prev, end: event.target.value }))} />{(dateFilter.start || dateFilter.end) && <button type="button" className="rounded-full bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => setDateFilter({ start: "", end: "" })}>清除日期</button>}</div>
                  <div className="rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-500">当前显示 {filteredExpenses.length} / {sortedExpenses.length} 条</div>
                  <Button variant="danger" onClick={resetAll}><RefreshCw className="h-4 w-4" />清空</Button>
                </div>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-left text-sm"><thead className="text-slate-500"><tr><th className="px-3">日期</th><th className="px-3">项目</th><th className="px-3">金额</th><th className="px-3">分类</th><th className="px-3">付款人</th><th className="px-3">分账</th><th className="px-3">{data.me}承担</th><th className="px-3">操作</th></tr></thead><tbody>{filteredExpenses.length === 0 ? <tr><td colSpan={8} className="rounded-2xl bg-slate-50 px-3 py-8 text-center text-slate-500">还没有消费记录。</td></tr> : filteredExpenses.map((expense) => { const isEditing = editingExpenseId === expense.id; const editingExpense = editExpenseForm ? { ...expense, ...editExpenseForm, amount: safeAmount(editExpenseForm.amount) } : expense; return <tr key={expense.id} className="bg-slate-50 align-top"><td className="rounded-l-2xl px-3 py-3 text-slate-600">{isEditing ? <input type="date" className="w-36 rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={editExpenseForm.date} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, date: event.target.value }))} /> : expense.date}</td><td className="px-3 py-3">{isEditing ? <div className="space-y-2"><input className="w-40 rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={editExpenseForm.title} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, title: event.target.value }))} /><input className="w-40 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400" placeholder="备注" value={editExpenseForm.note} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, note: event.target.value }))} /></div> : <><div className="font-medium">{expense.title}</div>{expense.note && <div className="mt-1 text-xs text-slate-500">{expense.note}</div>}</>}</td><td className="px-3 py-3 font-semibold">{isEditing ? <input type="text" inputMode="decimal" className="w-24 rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={editExpenseForm.amount} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} /> : `¥${money(expense.amount)}`}</td><td className="px-3 py-3 text-slate-600">{isEditing ? <select className="w-28 rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={editExpenseForm.category} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, category: event.target.value }))}>{categories.map((category) => <option key={category}>{category}</option>)}</select> : expense.category}</td><td className="px-3 py-3 text-slate-600">{isEditing ? <select className="w-24 rounded-xl border border-slate-200 bg-white px-2 py-1 outline-none focus:border-slate-400" value={editExpenseForm.payer} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, payer: event.target.value }))}>{people.map((person) => <option key={person}>{person}</option>)}</select> : expense.payer}</td><td className="px-3 py-3">{isEditing ? <div className="space-y-2"><label className="inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={editExpenseForm.isAA} onChange={(event) => setEditExpenseForm((prev) => ({ ...prev, isAA: event.target.checked, participants: event.target.checked ? (prev.participants.length ? prev.participants : people) : [] }))} />AA</label>{editExpenseForm.isAA && <div className="flex flex-wrap gap-1">{people.map((person) => { const checked = editExpenseForm.participants.includes(person); return <button key={person} type="button" className={`rounded-full px-2 py-1 text-xs ${checked ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"}`} onClick={() => setEditExpenseForm((prev) => ({ ...prev, participants: checked ? prev.participants.filter((x) => x !== person) : [...prev.participants, person] }))}>{person}</button>; })}</div>}</div> : expense.isAA ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">AA：{(expense.participants || []).join("、")}</span> : <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">不 AA</span>}</td><td className="px-3 py-3 font-semibold">¥{money(isEditing ? shareFor(editingExpense, data.me) : shareFor(expense, data.me))}</td><td className="rounded-r-2xl px-3 py-3">{isEditing ? <div className="flex gap-1"><Button variant="soft" onClick={() => saveEditExpense(expense.id)}><Save className="h-4 w-4" /></Button><Button variant="ghost" onClick={cancelEditExpense}><X className="h-4 w-4" /></Button></div> : <div className="flex gap-1"><Button variant="ghost" onClick={() => startEditExpense(expense)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" onClick={() => removeExpense(expense.id)}><Trash2 className="h-4 w-4" /></Button></div>}</td></tr>; })}</tbody></table></div>
            </Card>

            <Card><div className="mb-4 flex items-center gap-2 text-lg font-semibold"><ArrowRightLeft className="h-5 w-5" />结算调整记录</div>{sortedAdjustments.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无调整。比如“第一次酒店小黄已经给我 100”就可以在这里记录。</div> : <div className="space-y-3">{sortedAdjustments.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3"><div><div className="text-xs text-slate-500">{item.date}</div><div className="mt-1 font-semibold">{item.title}</div><div className="mt-1 text-sm text-slate-600">{item.from} 已给 {item.to}：<b>¥{money(item.amount)}</b></div>{item.note && <div className="mt-1 text-xs text-slate-500">{item.note}</div>}</div><Button variant="ghost" onClick={() => removeAdjustment(item.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}</Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card><div className="mb-4 text-lg font-semibold">AA 结算结果</div>{stats.transfers.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">目前没有需要互相转账的 AA 款项。</div> : <div className="space-y-3">{stats.transfers.map((t, idx) => <div key={idx} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><div className="font-medium"><span className="text-rose-600">{t.from}</span> 转给 <span className="text-emerald-700">{t.to}</span></div><div className="text-lg font-bold">¥{money(t.amount)}</div></div>)}</div>}<div className="mt-4 grid gap-2 text-sm">{people.map((p) => <div key={p} className="rounded-xl bg-white px-2 py-2 text-slate-600"><div className="flex justify-between"><span>{p}：AA垫付 ¥{money(stats.paidAA[p])} / AA应承担 ¥{money(stats.shareAA[p])}</span><span className="font-medium text-slate-800">净额 {stats.nets.find((x) => x.name === p)?.net >= 0 ? "+" : ""}{money(stats.nets.find((x) => x.name === p)?.net || 0)}</span></div><div className="mt-1 text-xs text-slate-400">已给出 ¥{money(stats.adjustmentGiven[p])} / 已收到 ¥{money(stats.adjustmentReceived[p])}</div></div>)}</div></Card>
              <Card><div className="mb-4 text-lg font-semibold">行程记录</div>{sortedLogs.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">还没有行程记录。可以写“到桂林北”“坐竹筏”“逛西街”等。</div> : <div className="space-y-3">{sortedLogs.map((log) => <div key={log.id} className="rounded-2xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-slate-500">{log.date}{log.location ? ` · ${log.location}` : ""}</div><div className="mt-1 font-semibold">{log.title}</div>{log.detail && <div className="mt-1 text-sm leading-6 text-slate-600">{log.detail}</div>}</div><Button variant="ghost" onClick={() => removeLog(log.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</Card>
            </div>

            <Card><div className="mb-4 text-lg font-semibold">统计图</div><div className="grid gap-5 lg:grid-cols-2"><div><div className="mb-3 text-sm font-medium text-slate-600">每天消费</div><div className="space-y-3">{stats.daily.length === 0 ? <div className="text-sm text-slate-500">暂无数据</div> : stats.daily.map((d) => <div key={d.date}><div className="mb-1 flex justify-between text-sm"><span>{d.date}</span><span>总 ¥{money(d.total)} / 我 ¥{money(d.myShare)}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-800" style={{ width: `${Math.max(4, (d.total / maxDaily) * 100)}%` }} /></div></div>)}</div></div><div><div className="mb-3 text-sm font-medium text-slate-600">分类消费</div><div className="space-y-3">{stats.categories.length === 0 ? <div className="text-sm text-slate-500">暂无数据</div> : stats.categories.map((c) => <div key={c.category}><div className="mb-1 flex justify-between text-sm"><span>{c.category}</span><span>总 ¥{money(c.total)} / 我 ¥{money(c.myShare)}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-800" style={{ width: `${Math.max(4, (c.total / maxCategory) * 100)}%` }} /></div></div>)}</div></div></div></Card>

            <Card className="overflow-hidden"><div className="mb-4 flex items-center justify-between gap-3"><div className="text-lg font-semibold">纪念账单预览</div><Button onClick={exportImage}><Camera className="h-4 w-4" />导出这张图</Button></div><div ref={reportRef} className="rounded-[2rem] bg-slate-50 p-8"><div className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200"><div className="mb-6 flex flex-col gap-2 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between"><div><div className="text-sm font-medium text-slate-500">旅行回顾账单</div><div className="mt-1 text-3xl font-bold">{data.tripName || "旅行账本"}</div><div className="mt-2 text-sm text-slate-500">参与人：{people.join("、")}</div></div><div className="text-right text-sm text-slate-500">生成于 {new Date().toLocaleDateString("zh-CN")}</div></div><div className="grid gap-3 md:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">总消费</div><div className="mt-1 text-2xl font-bold">¥{money(stats.total)}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">AA 总额</div><div className="mt-1 text-2xl font-bold">¥{money(stats.aaTotal)}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">已结算抵扣</div><div className="mt-1 text-2xl font-bold">¥{money(stats.adjustmentTotal)}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{data.me}承担</div><div className="mt-1 text-2xl font-bold">¥{money(stats.myShare)}</div></div></div><div className="mt-6 grid gap-6 md:grid-cols-2"><div><div className="mb-3 text-base font-semibold">每天做了什么</div><div className="space-y-3">{sortedLogs.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">还没有行程记录</div> : sortedLogs.slice(0, 8).map((log) => <div key={log.id} className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{log.date}{log.location ? ` · ${log.location}` : ""}</div><div className="mt-1 font-medium">{log.title}</div>{log.detail && <div className="mt-1 line-clamp-2 text-sm text-slate-600">{log.detail}</div>}</div>)}</div></div><div><div className="mb-3 text-base font-semibold">AA 转账</div><div className="space-y-3">{stats.transfers.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">暂无需要转账的 AA 款项</div> : stats.transfers.map((t, idx) => <div key={idx} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span>{t.from} → {t.to}</span><b>¥{money(t.amount)}</b></div>)}</div><div className="mt-6 mb-3 text-base font-semibold">分类概览</div><div className="space-y-2">{stats.categories.slice(0, 6).map((c) => <div key={c.category} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{c.category}</span><span>¥{money(c.total)}</span></div>)}</div></div></div><div className="mt-6 border-t border-slate-100 pt-4 text-center text-sm text-slate-400">一起走过的路，也算进了账本里。</div></div></div></Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
