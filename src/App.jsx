import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  CalendarDays,
  Camera,
  Check,
  Download,
  FileDown,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Settings,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { APP_STORAGE_KEY, DEFAULT_CATEGORIES, LEGACY_STORAGE_KEY, createInitialState, createLedger, today, uid } from "./defaults";
import { calculateLedgerStats, money, safeAmount } from "./calculations";

function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getInitialState() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return createInitialState();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.ledgers)) return createInitialState();

    return {
      version: 2,
      currentLedgerId: parsed.currentLedgerId || parsed.ledgers[0]?.id,
      ledgers: parsed.ledgers.length ? parsed.ledgers : createInitialState().ledgers,
    };
  } catch {
    return createInitialState();
  }
}

function makeRecordForm(ledger) {
  const firstMemberId = ledger?.members?.[0]?.id || "";

  return {
    date: today(),
    title: "",
    amount: "",
    category: ledger?.categories?.[0] || DEFAULT_CATEGORIES[0],
    payerId: firstMemberId,
    splitType: "aa",
    participantIds: ledger?.members?.map((member) => member.id) || [],
    note: "",
  };
}

function makeAdjustmentForm(ledger) {
  return {
    date: today(),
    title: "",
    fromMemberId: ledger?.members?.[1]?.id || ledger?.members?.[0]?.id || "",
    toMemberId: ledger?.members?.[0]?.id || "",
    amount: "",
    note: "",
  };
}

function Card({ children, className = "" }) {
  return <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 ${className}`}>{children}</section>;
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-600">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs leading-5 text-slate-400">{hint}</div>}
    </label>
  );
}

function Button({ children, variant = "primary", className = "", type = "button", ...props }) {
  const styles = {
    primary: "bg-slate-950 text-white hover:bg-slate-800",
    soft: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    outline: "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Pill({ children, tone = "slate" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
  };

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

function StatCard({ label, value, sublabel }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-400">{sublabel}</div>}
    </Card>
  );
}

function App() {
  const [appState, setAppState] = useState(getInitialState);
  const [view, setView] = useState("home");
  const [ledgerDraft, setLedgerDraft] = useState("旅行账本");
  const [ledgerMembersDraft, setLedgerMembersDraft] = useState("我、朋友A");
  const [recordForm, setRecordForm] = useState(() => makeRecordForm(appState.ledgers[0]));
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [isRecordFormOpen, setIsRecordFormOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState(() => makeAdjustmentForm(appState.ledgers[0]));
  const [logForm, setLogForm] = useState({ date: today(), title: "", location: "", detail: "" });
  const [memberDraft, setMemberDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [recordFilter, setRecordFilter] = useState("全部");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [legacyBackupAvailable] = useState(() => Boolean(localStorage.getItem(LEGACY_STORAGE_KEY)));
  const reportRef = useRef(null);
  const importInputRef = useRef(null);

  const currentLedger = useMemo(() => {
    return appState.ledgers.find((ledger) => ledger.id === appState.currentLedgerId) || appState.ledgers[0];
  }, [appState.currentLedgerId, appState.ledgers]);

  const stats = useMemo(() => calculateLedgerStats(currentLedger), [currentLedger]);

  const sortedRecords = useMemo(() => {
    return [...currentLedger.records].sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`));
  }, [currentLedger.records]);

  const filteredRecords = useMemo(() => {
    let result = sortedRecords;
    if (recordFilter === "AA") result = result.filter((record) => record.splitType === "aa");
    if (recordFilter === "个人") result = result.filter((record) => record.splitType !== "aa");
    if (dateFilter.start) result = result.filter((record) => record.date >= dateFilter.start);
    if (dateFilter.end) result = result.filter((record) => record.date <= dateFilter.end);
    return result;
  }, [sortedRecords, recordFilter, dateFilter]);

  const maxDaily = Math.max(1, ...stats.daily.map((item) => item.total));
  const maxCategory = Math.max(1, ...stats.categories.map((item) => item.total));

  useEffect(() => {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(appState));
  }, [appState]);

  function updateCurrentLedger(updater) {
    setAppState((prev) => ({
      ...prev,
      ledgers: prev.ledgers.map((ledger) => {
        if (ledger.id !== prev.currentLedgerId) return ledger;
        const nextLedger = typeof updater === "function" ? updater(ledger) : { ...ledger, ...updater };
        return { ...nextLedger, updatedAt: today() };
      }),
    }));
  }

  function getMemberName(memberId) {
    return currentLedger?.members.find((member) => member.id === memberId)?.name || "未知成员";
  }

  function parseMemberNames(text) {
    return text
      .replaceAll("，", "、")
      .replaceAll(",", "、")
      .replaceAll(" ", "、")
      .split("、")
      .map((name) => name.trim())
      .filter(Boolean);
  }

  function createNewLedger(event) {
    event.preventDefault();
    const memberNames = [...new Set(parseMemberNames(ledgerMembersDraft))];
    if (!ledgerDraft.trim()) return alert("请先填写账本名称");
    if (memberNames.length < 1) return alert("请至少添加 1 位成员");

    const ledger = createLedger(ledgerDraft, memberNames);
    setAppState((prev) => ({
      ...prev,
      currentLedgerId: ledger.id,
      ledgers: [ledger, ...prev.ledgers],
    }));
    setLedgerDraft("旅行账本");
    setLedgerMembersDraft("我、朋友A");
    setRecordForm(makeRecordForm(ledger));
    setAdjustmentForm(makeAdjustmentForm(ledger));
    setIsRecordFormOpen(false);
    setView("detail");
  }

  function openLedger(ledgerId) {
    const ledger = appState.ledgers.find((item) => item.id === ledgerId);
    if (!ledger) return;
    setAppState((prev) => ({ ...prev, currentLedgerId: ledgerId }));
    setRecordForm(makeRecordForm(ledger));
    setAdjustmentForm(makeAdjustmentForm(ledger));
    setEditingRecordId(null);
    setIsRecordFormOpen(false);
    setView("detail");
  }

  function renameLedger(ledgerId) {
    const ledger = appState.ledgers.find((item) => item.id === ledgerId);
    if (!ledger) return;
    const nextName = prompt("新的账本名称", ledger.name);
    if (!nextName?.trim()) return;

    setAppState((prev) => ({
      ...prev,
      ledgers: prev.ledgers.map((item) => (item.id === ledgerId ? { ...item, name: nextName.trim(), updatedAt: today() } : item)),
    }));
  }

  function removeLedger(ledgerId) {
    if (appState.ledgers.length <= 1) return alert("至少保留一个账本");
    const ledger = appState.ledgers.find((item) => item.id === ledgerId);
    if (!ledger) return;
    if (!confirm(`确定删除「${ledger.name}」吗？这个操作不会影响其他账本。`)) return;

    setAppState((prev) => {
      const ledgers = prev.ledgers.filter((item) => item.id !== ledgerId);
      return {
        ...prev,
        ledgers,
        currentLedgerId: prev.currentLedgerId === ledgerId ? ledgers[0]?.id : prev.currentLedgerId,
      };
    });
  }

  function addMember(event) {
    event.preventDefault();
    const name = memberDraft.trim();
    if (!name) return;
    if (currentLedger.members.some((member) => member.name === name)) return alert("成员名称已经存在");

    updateCurrentLedger((ledger) => ({
      ...ledger,
      members: [...ledger.members, { id: uid("member"), name }],
    }));
    setMemberDraft("");
  }

  function renameMember(memberId) {
    const member = currentLedger.members.find((item) => item.id === memberId);
    if (!member) return;
    const nextName = prompt("修改成员名称", member.name);
    if (!nextName?.trim()) return;

    updateCurrentLedger((ledger) => ({
      ...ledger,
      members: ledger.members.map((item) => (item.id === memberId ? { ...item, name: nextName.trim() } : item)),
    }));
  }

  function memberIsReferenced(memberId) {
    return (
      currentLedger.records.some((record) => record.payerId === memberId || record.participantIds?.includes(memberId)) ||
      currentLedger.adjustments.some((adjustment) => adjustment.fromMemberId === memberId || adjustment.toMemberId === memberId)
    );
  }

  function removeMember(memberId) {
    if (currentLedger.members.length <= 1) return alert("至少保留一位成员");
    if (memberIsReferenced(memberId)) return alert("这个成员已经被账单或结算记录引用，不能直接删除。可以先修改相关账单，或只改成员名称。");

    const nextMembers = currentLedger.members.filter((member) => member.id !== memberId);
    const nextMemberIds = nextMembers.map((member) => member.id);
    updateCurrentLedger((ledger) => ({
      ...ledger,
      members: nextMembers,
    }));
    setRecordForm((prev) => ({
      ...prev,
      payerId: nextMemberIds.includes(prev.payerId) ? prev.payerId : nextMemberIds[0],
      participantIds: prev.participantIds.filter((id) => nextMemberIds.includes(id)),
    }));
    setAdjustmentForm((prev) => ({
      ...prev,
      fromMemberId: nextMemberIds.includes(prev.fromMemberId) ? prev.fromMemberId : nextMemberIds[1] || nextMemberIds[0],
      toMemberId: nextMemberIds.includes(prev.toMemberId) ? prev.toMemberId : nextMemberIds[0],
    }));
  }

  function addCategory(event) {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (!name) return;
    if (currentLedger.categories.includes(name)) return alert("分类已经存在");

    updateCurrentLedger((ledger) => ({
      ...ledger,
      categories: [...ledger.categories, name],
    }));
    setCategoryDraft("");
  }

  function removeCategory(category) {
    if (currentLedger.categories.length <= 1) return alert("至少保留一个分类");
    if (currentLedger.records.some((record) => record.category === category)) return alert("这个分类已有账单使用，不能直接删除");

    const nextCategories = currentLedger.categories.filter((item) => item !== category);
    updateCurrentLedger((ledger) => ({
      ...ledger,
      categories: nextCategories,
    }));
    setRecordForm((prev) => ({
      ...prev,
      category: prev.category === category ? nextCategories[0] : prev.category,
    }));
  }

  function validateRecord(form) {
    const amount = safeAmount(form.amount);
    if (!form.title.trim()) return { error: "请填写消费名称" };
    if (!amount) return { error: "金额需要大于 0" };
    if (!form.payerId) return { error: "请选择付款人" };
    if (form.splitType === "aa" && form.participantIds.length === 0) return { error: "AA 账单至少选择一位参与成员" };
    return { amount };
  }

  function saveRecord(event) {
    event.preventDefault();
    const validation = validateRecord(recordForm);
    if (validation.error) return alert(validation.error);

    const now = new Date().toISOString();
    const record = {
      id: editingRecordId || uid("record"),
      date: recordForm.date,
      title: recordForm.title.trim(),
      amount: validation.amount,
      category: recordForm.category,
      payerId: recordForm.payerId,
      splitType: recordForm.splitType,
      participantIds: recordForm.splitType === "aa" ? recordForm.participantIds : [],
      note: recordForm.note.trim(),
      createdAt: editingRecordId ? currentLedger.records.find((item) => item.id === editingRecordId)?.createdAt || now : now,
      updatedAt: now,
    };

    updateCurrentLedger((ledger) => ({
      ...ledger,
      records: editingRecordId ? ledger.records.map((item) => (item.id === editingRecordId ? record : item)) : [record, ...ledger.records],
    }));
    setEditingRecordId(null);
    setRecordForm(makeRecordForm(currentLedger));
    setIsRecordFormOpen(false);
  }

  function startAddRecord() {
    setEditingRecordId(null);
    setRecordForm(makeRecordForm(currentLedger));
    setIsRecordFormOpen(true);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditRecord(record) {
    setEditingRecordId(record.id);
    setRecordForm({
      date: record.date,
      title: record.title,
      amount: String(record.amount ?? ""),
      category: record.category,
      payerId: record.payerId,
      splitType: record.splitType || "aa",
      participantIds: record.participantIds?.length ? record.participantIds : currentLedger.members.map((member) => member.id),
      note: record.note || "",
    });
    setIsRecordFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelRecordEdit() {
    setEditingRecordId(null);
    setRecordForm(makeRecordForm(currentLedger));
    setIsRecordFormOpen(false);
  }

  function removeRecord(recordId) {
    if (!confirm("确定删除这笔账单吗？")) return;
    updateCurrentLedger((ledger) => ({
      ...ledger,
      records: ledger.records.filter((record) => record.id !== recordId),
    }));
    if (editingRecordId === recordId) cancelRecordEdit();
  }

  function saveAdjustment(event) {
    event.preventDefault();
    const amount = safeAmount(adjustmentForm.amount);
    if (!adjustmentForm.title.trim()) return alert("请填写结算说明");
    if (!amount) return alert("金额需要大于 0");
    if (adjustmentForm.fromMemberId === adjustmentForm.toMemberId) return alert("付款人和收款人不能是同一位成员");

    updateCurrentLedger((ledger) => ({
      ...ledger,
      adjustments: [
        {
          id: uid("adjustment"),
          ...adjustmentForm,
          title: adjustmentForm.title.trim(),
          amount,
          note: adjustmentForm.note.trim(),
        },
        ...ledger.adjustments,
      ],
    }));
    setAdjustmentForm((prev) => ({ ...prev, title: "", amount: "", note: "" }));
  }

  function removeAdjustment(adjustmentId) {
    updateCurrentLedger((ledger) => ({
      ...ledger,
      adjustments: ledger.adjustments.filter((adjustment) => adjustment.id !== adjustmentId),
    }));
  }

  function saveLog(event) {
    event.preventDefault();
    if (!logForm.title.trim()) return alert("请填写行程内容");

    updateCurrentLedger((ledger) => ({
      ...ledger,
      logs: [
        {
          id: uid("log"),
          ...logForm,
          title: logForm.title.trim(),
          location: logForm.location.trim(),
          detail: logForm.detail.trim(),
        },
        ...ledger.logs,
      ],
    }));
    setLogForm({ date: today(), title: "", location: "", detail: "" });
  }

  function removeLog(logId) {
    updateCurrentLedger((ledger) => ({
      ...ledger,
      logs: ledger.logs.filter((log) => log.id !== logId),
    }));
  }

  function exportCurrentLedgerJson() {
    downloadText(`${currentLedger.name || "旅行账本"}-账本备份.json`, JSON.stringify(currentLedger, null, 2));
  }

  function exportAllJson() {
    downloadText("旅行账本-全部数据备份.json", JSON.stringify(appState, null, 2));
  }

  function exportLegacyJson() {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return alert("没有检测到旧版本地数据");
    downloadText("旧版账本-数据备份.json", raw);
  }

  function exportCsv() {
    const rows = [];
    rows.push(["账本", currentLedger.name]);
    rows.push(["成员", currentLedger.members.map((member) => member.name).join(" / ")]);
    rows.push([]);
    rows.push(["日期", "消费", "金额", "分类", "付款人", "分摊方式", "参与人", "备注"]);

    for (const record of sortedRecords) {
      rows.push([
        record.date,
        record.title,
        safeAmount(record.amount),
        record.category,
        stats.memberNames[record.payerId] || "",
        record.splitType === "aa" ? "AA" : "个人消费",
        record.splitType === "aa" ? record.participantIds.map((memberId) => stats.memberNames[memberId]).filter(Boolean).join(" / ") : "",
        record.note || "",
      ]);
    }

    rows.push([]);
    rows.push(["成员", "实际支付", "应承担", "应收/应付"]);
    for (const item of stats.membersSummary) {
      rows.push([item.name, item.paid.toFixed(2), item.share.toFixed(2), item.net.toFixed(2)]);
    }

    rows.push([]);
    rows.push(["结算建议"]);
    for (const transfer of stats.transfers) {
      rows.push([`${transfer.from} 给 ${transfer.to}`, transfer.amount.toFixed(2)]);
    }

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join(String.fromCharCode(10));
    downloadText(`${currentLedger.name || "旅行账本"}-消费明细.csv`, String.fromCharCode(0xfeff) + csv, "text/csv;charset=utf-8");
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (Array.isArray(imported.ledgers)) {
          setAppState({
            version: 2,
            currentLedgerId: imported.currentLedgerId || imported.ledgers[0]?.id,
            ledgers: imported.ledgers,
          });
          setView("home");
          return;
        }

        if (imported.id && Array.isArray(imported.members) && Array.isArray(imported.records)) {
          setAppState((prev) => ({
            ...prev,
            currentLedgerId: imported.id,
            ledgers: [imported, ...prev.ledgers.filter((ledger) => ledger.id !== imported.id)],
          }));
          setView("detail");
          return;
        }

        alert("导入失败：请选择新版账本或全部数据备份 JSON");
      } catch {
        alert("导入失败：JSON 文件格式不正确");
      }
    };

    reader.readAsText(file);
  }

  async function exportImage() {
    if (!reportRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#f8fafc", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${currentLedger.name || "旅行账本"}-分享账单.png`;
      link.click();
    } catch {
      alert("导出图片失败，可以先尝试浏览器截图，或检查当前运行环境是否支持 html2canvas。");
    }
  }

  function renderHome() {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
                <WalletCards className="h-4 w-4" />
                多人旅行 AA 记账
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">旅行账本</h1>
              <p className="mt-3 max-w-2xl text-slate-600">为每一次出行创建独立账本，记录谁付款、谁参与分摊，最后自动生成清楚的结算建议。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {legacyBackupAvailable && (
                <Button variant="outline" onClick={exportLegacyJson}>
                  <FileDown className="h-4 w-4" />
                  导出旧版数据
                </Button>
              )}
              <Button variant="outline" onClick={() => importInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                导入
              </Button>
              <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={(event) => importJson(event.target.files?.[0])} />
            </div>
          </div>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.5fr]">
          <Card>
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Plus className="h-5 w-5" />
              创建新账本
            </div>
            <form className="space-y-4" onSubmit={createNewLedger}>
              <Field label="账本名称">
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={ledgerDraft} onChange={(event) => setLedgerDraft(event.target.value)} placeholder="例如 长沙周末账本" />
              </Field>
              <Field label="初始成员" hint="用顿号、逗号或空格分隔，后续仍可继续添加成员。">
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={ledgerMembersDraft} onChange={(event) => setLedgerMembersDraft(event.target.value)} placeholder="我、朋友A、朋友B" />
              </Field>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                创建账本
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950">已有账本</h2>
              <Button variant="ghost" onClick={exportAllJson}>
                <FileDown className="h-4 w-4" />
                导出全部
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {appState.ledgers.map((ledger) => {
                const ledgerStats = calculateLedgerStats(ledger);

                return (
                  <Card key={ledger.id} className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-slate-950">{ledger.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{ledger.members.length} 位成员 · {ledger.records.length} 笔账单</div>
                      </div>
                      <Pill tone={ledger.id === appState.currentLedgerId ? "green" : "slate"}>{ledger.id === appState.currentLedgerId ? "当前" : "账本"}</Pill>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
                      <div>
                        <div className="text-slate-500">总消费</div>
                        <div className="mt-1 font-bold text-slate-950">¥{money(ledgerStats.total)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">待结算</div>
                        <div className="mt-1 font-bold text-slate-950">{ledgerStats.transfers.length} 条</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => openLedger(ledger.id)}>进入账本</Button>
                      <Button variant="outline" onClick={() => renameLedger(ledger.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="danger" onClick={() => removeLedger(ledger.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderRecordForm({ inDrawer = false } = {}) {
    return (
      <Card className={inDrawer ? "max-h-[82vh] overflow-y-auto rounded-b-none rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl ring-0" : ""}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <ReceiptText className="h-5 w-5" />
            {editingRecordId ? "编辑账单" : "添加账单"}
          </div>
          {(editingRecordId || inDrawer) && (
            <Button variant={inDrawer ? "soft" : "ghost"} onClick={cancelRecordEdit}>
              <X className="h-4 w-4" />
              取消
            </Button>
          )}
        </div>
        <form className="space-y-4" onSubmit={saveRecord}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="消费名称">
              <input className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-400 md:py-2" value={recordForm.title} onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })} placeholder="例如 午饭、打车、酒店" />
            </Field>
            <Field label="金额">
              <input className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-400 md:py-2" inputMode="decimal" value={recordForm.amount} onChange={(event) => setRecordForm({ ...recordForm, amount: event.target.value })} placeholder="支持 120-20 或 80/2" />
            </Field>
            <Field label="日期">
              <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-400 md:py-2" value={recordForm.date} onChange={(event) => setRecordForm({ ...recordForm, date: event.target.value })} />
            </Field>
            <Field label="分类">
              <select className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-400 md:py-2" value={recordForm.category} onChange={(event) => setRecordForm({ ...recordForm, category: event.target.value })}>
                {currentLedger.categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="付款人">
              <select className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-400 md:py-2" value={recordForm.payerId} onChange={(event) => setRecordForm({ ...recordForm, payerId: event.target.value })}>
                {currentLedger.members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </Field>
            <Field label="分摊方式">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                {[
                  ["aa", "AA 分摊"],
                  ["personal", "个人消费"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${recordForm.splitType === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => setRecordForm({ ...recordForm, splitType: value, participantIds: value === "aa" ? currentLedger.members.map((member) => member.id) : [] })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {recordForm.splitType === "aa" && (
            <div>
              <div className="mb-2 text-sm font-medium text-slate-600">参与 AA 的成员</div>
              <div className="flex flex-wrap gap-2">
                {currentLedger.members.map((member) => {
                  const checked = recordForm.participantIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${checked ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
                      onClick={() => setRecordForm((prev) => ({ ...prev, participantIds: checked ? prev.participantIds.filter((id) => id !== member.id) : [...prev.participantIds, member.id] }))}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                      {member.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-sm text-slate-500">当前每人承担：¥{money(safeAmount(recordForm.amount) / Math.max(1, recordForm.participantIds.length))}</div>
            </div>
          )}

          <Field label="备注">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={recordForm.note} onChange={(event) => setRecordForm({ ...recordForm, note: event.target.value })} placeholder="可选，例如只买了两张票" />
          </Field>

          <div className={inDrawer ? "grid grid-cols-[0.8fr_1.2fr] gap-2" : ""}>
            {inDrawer && (
              <Button variant="outline" className="w-full" onClick={cancelRecordEdit}>
                取消
              </Button>
            )}
            <Button type="submit" className="w-full">
            <Save className="h-4 w-4" />
            {editingRecordId ? "保存修改" : "记一笔"}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  function renderDetail() {
    if (!currentLedger) return null;

    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => setView("home")}>
                  <ArrowLeft className="h-4 w-4" />
                  账本首页
                </Button>
                <Pill tone="blue">本地保存</Pill>
                <Pill tone="green">{currentLedger.members.length} 位成员</Pill>
              </div>
              <input className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none md:text-5xl" value={currentLedger.name} onChange={(event) => updateCurrentLedger({ ...currentLedger, name: event.target.value })} />
              <p className="mt-2 text-slate-600">记录共同消费、个人消费和已经发生的转账，旅行结束后一键导出分享。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCurrentLedgerJson}>
                <FileDown className="h-4 w-4" />
                备份账本
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                导出明细
              </Button>
              <Button onClick={exportImage}>
                <Camera className="h-4 w-4" />
                导出分享图
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="总消费" value={`¥${money(stats.total)}`} sublabel={`${currentLedger.records.length} 笔账单`} />
          <StatCard label="人均参考" value={`¥${money(stats.perMember)}`} sublabel="按账本成员数均分总额" />
          <StatCard label="AA 总额" value={`¥${money(stats.aaTotal)}`} sublabel="参与结算的共同消费" />
          <StatCard label="待结算" value={`${stats.transfers.length} 条`} sublabel={stats.transfers.length ? "查看下方结算建议" : "目前无需转账"} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.6fr]">
          <div className="space-y-5">
            <div className="hidden lg:block">
              {renderRecordForm()}
            </div>

            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5" />
                成员管理
              </div>
              <form className="mb-4 flex gap-2" onSubmit={addMember}>
                <input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={memberDraft} onChange={(event) => setMemberDraft(event.target.value)} placeholder="添加成员" />
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
              <div className="space-y-2">
                {currentLedger.members.map((member) => {
                  const summary = stats.membersSummary.find((item) => item.memberId === member.id);
                  return (
                    <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                      <div>
                        <div className="font-medium text-slate-950">{member.name}</div>
                        <div className="mt-1 text-xs text-slate-500">支付 ¥{money(summary?.paid)} · 应承担 ¥{money(summary?.share)}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" onClick={() => renameMember(member.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => removeMember(member.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-5 w-5" />
                分类
              </div>
              <form className="mb-4 flex gap-2" onSubmit={addCategory}>
                <input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} placeholder="自定义分类" />
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {currentLedger.categories.map((category) => (
                  <button key={category} type="button" className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200" onClick={() => removeCategory(category)}>
                    {category}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <ReceiptText className="h-5 w-5" />
                  账单列表
                </div>
                <div className="flex flex-wrap gap-2">
                  {["全部", "AA", "个人"].map((filter) => (
                    <button key={filter} type="button" className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${recordFilter === filter ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} onClick={() => setRecordFilter(filter)}>
                      {filter}
                    </button>
                  ))}
                  <input type="date" className="rounded-xl border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400" value={dateFilter.start} onChange={(event) => setDateFilter((prev) => ({ ...prev, start: event.target.value }))} />
                  <input type="date" className="rounded-xl border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400" value={dateFilter.end} onChange={(event) => setDateFilter((prev) => ({ ...prev, end: event.target.value }))} />
                  {(dateFilter.start || dateFilter.end) && <Button variant="ghost" onClick={() => setDateFilter({ start: "", end: "" })}>清除</Button>}
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">还没有账单，先记一笔吧。</div>
              ) : (
                <div className="space-y-3">
                  {filteredRecords.map((record) => (
                    <div key={record.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-slate-950">{record.title}</div>
                            <Pill tone={record.splitType === "aa" ? "green" : "slate"}>{record.splitType === "aa" ? "AA" : "个人消费"}</Pill>
                            <Pill>{record.category}</Pill>
                          </div>
                          <div className="mt-2 text-sm text-slate-500">{record.date} · {getMemberName(record.payerId)} 付款</div>
                          {record.splitType === "aa" && <div className="mt-1 text-sm text-slate-500">参与人：{record.participantIds.map(getMemberName).join("、")}</div>}
                          {record.note && <div className="mt-1 text-sm text-slate-500">{record.note}</div>}
                        </div>
                        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                          <div className="text-xl font-bold text-slate-950">¥{money(record.amount)}</div>
                          <div className="flex gap-1">
                            <Button variant="ghost" onClick={() => startEditRecord(record)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" onClick={() => removeRecord(record.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ArrowRightLeft className="h-5 w-5" />
                  结算建议
                </div>
                {stats.transfers.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">目前没有需要互相转账的款项。</div>
                ) : (
                  <div className="space-y-3">
                    {stats.transfers.map((transfer) => (
                      <div key={`${transfer.fromMemberId}-${transfer.toMemberId}-${transfer.amount}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <div className="font-medium">
                          <span className="text-rose-600">{transfer.from}</span> 给 <span className="text-emerald-700">{transfer.to}</span>
                        </div>
                        <div className="text-lg font-bold">¥{money(transfer.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {stats.membersSummary.map((item) => (
                    <div key={item.memberId} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-100">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{item.name}</span>
                        <span className={item.net >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>{item.net >= 0 ? "应收" : "应付"} ¥{money(Math.abs(item.net))}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">支付 ¥{money(item.paid)} / 应承担 ¥{money(item.share)}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="mb-4 text-lg font-semibold">结算调整</div>
                <form className="space-y-3" onSubmit={saveAdjustment}>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.date} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, date: event.target.value })} />
                    <input className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" inputMode="decimal" placeholder="金额" value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })} />
                  </div>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" placeholder="说明，例如 已转账" value={adjustmentForm.title} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, title: event.target.value })} />
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <select className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.fromMemberId} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, fromMemberId: event.target.value })}>
                      {currentLedger.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                    <span className="text-slate-400">给</span>
                    <select className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={adjustmentForm.toMemberId} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, toMemberId: event.target.value })}>
                      {currentLedger.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="h-4 w-4" />
                    记录调整
                  </Button>
                </form>
                <div className="mt-4 space-y-2">
                  {currentLedger.adjustments.map((adjustment) => (
                    <div key={adjustment.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                      <div>
                        <div className="font-medium">{adjustment.title}</div>
                        <div className="mt-1 text-slate-500">{adjustment.date} · {getMemberName(adjustment.fromMemberId)} 给 {getMemberName(adjustment.toMemberId)} ¥{money(adjustment.amount)}</div>
                      </div>
                      <Button variant="ghost" onClick={() => removeAdjustment(adjustment.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card>
              <div className="mb-4 text-lg font-semibold">统计</div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-medium text-slate-600">每日消费</div>
                  <div className="space-y-3">
                    {stats.daily.length === 0 ? <div className="text-sm text-slate-500">暂无数据</div> : stats.daily.map((day) => (
                      <div key={day.date}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span>{day.date}</span>
                          <span>¥{money(day.total)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(4, (day.total / maxDaily) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-3 text-sm font-medium text-slate-600">分类消费</div>
                  <div className="space-y-3">
                    {stats.categories.length === 0 ? <div className="text-sm text-slate-500">暂无数据</div> : stats.categories.map((category) => (
                      <div key={category.category}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span>{category.category}</span>
                          <span>¥{money(category.total)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, (category.total / maxCategory) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="h-5 w-5" />
                行程记录
              </div>
              <form className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_auto]" onSubmit={saveLog}>
                <input type="date" className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" value={logForm.date} onChange={(event) => setLogForm({ ...logForm, date: event.target.value })} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" placeholder="当天做了什么" value={logForm.title} onChange={(event) => setLogForm({ ...logForm, title: event.target.value })} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" placeholder="地点，可选" value={logForm.location} onChange={(event) => setLogForm({ ...logForm, location: event.target.value })} />
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
              <div className="mt-4 space-y-2">
                {currentLedger.logs.length === 0 ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">行程记录不是核心功能，可以按需记录旅行回顾。</div> : currentLedger.logs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <div className="text-xs text-slate-500">{log.date}{log.location ? ` · ${log.location}` : ""}</div>
                      <div className="mt-1 font-medium">{log.title}</div>
                      {log.detail && <div className="mt-1 text-sm text-slate-500">{log.detail}</div>}
                    </div>
                    <Button variant="ghost" onClick={() => removeLog(log.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">分享账单预览</div>
                <Button onClick={exportImage}>
                  <Camera className="h-4 w-4" />
                  导出图片
                </Button>
              </div>
              <div ref={reportRef} className="rounded-3xl bg-slate-50 p-5 md:p-8">
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-6 border-b border-slate-100 pb-5">
                    <div className="text-sm font-medium text-slate-500">旅行 AA 账单</div>
                    <div className="mt-1 text-3xl font-bold text-slate-950">{currentLedger.name}</div>
                    <div className="mt-2 text-sm text-slate-500">成员：{currentLedger.members.map((member) => member.name).join("、")} · 生成于 {new Date().toLocaleDateString("zh-CN")}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">总消费</div>
                      <div className="mt-1 text-2xl font-bold">¥{money(stats.total)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">AA 总额</div>
                      <div className="mt-1 text-2xl font-bold">¥{money(stats.aaTotal)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">账单数</div>
                      <div className="mt-1 text-2xl font-bold">{currentLedger.records.length}</div>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    <div>
                      <div className="mb-3 font-semibold">成员统计</div>
                      <div className="space-y-2">
                        {stats.membersSummary.map((item) => (
                          <div key={item.memberId} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <div className="flex justify-between">
                              <span>{item.name}</span>
                              <b>{item.net >= 0 ? "应收" : "应付"} ¥{money(Math.abs(item.net))}</b>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">支付 ¥{money(item.paid)} / 应承担 ¥{money(item.share)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 font-semibold">结算建议</div>
                      <div className="space-y-2">
                        {stats.transfers.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">暂无需要转账的款项</div> : stats.transfers.map((transfer) => (
                          <div key={`${transfer.fromMemberId}-${transfer.toMemberId}`} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <span>{transfer.from} 给 {transfer.to}</span>
                            <b>¥{money(transfer.amount)}</b>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 mb-3 font-semibold">分类概览</div>
                      <div className="space-y-2">
                        {stats.categories.slice(0, 6).map((category) => (
                          <div key={category.category} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <span>{category.category}</span>
                            <span>¥{money(category.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {isRecordFormOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 px-0 pt-10 lg:hidden">
            <button type="button" className="absolute inset-0 cursor-default" onClick={cancelRecordEdit} aria-label="关闭添加账单表单" />
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative w-full">
              {renderRecordForm({ inDrawer: true })}
            </motion.div>
          </div>
        )}

        <button type="button" className="fixed bottom-5 left-1/2 z-40 inline-flex h-14 -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 lg:hidden" onClick={startAddRecord} aria-label="添加账单">
          <Plus className="h-6 w-6" />
          记一笔
        </button>
        <button type="button" className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg shadow-slate-900/15 ring-1 ring-slate-200 transition hover:bg-slate-50 lg:hidden" onClick={scrollToTop} aria-label="回到顶部">
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 md:px-6 md:py-8">{view === "home" ? renderHome() : renderDetail()}</main>;
}

export default App;
