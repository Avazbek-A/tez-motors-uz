"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt, Loader2, Plus, X, Trash2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { computeInvoiceTotals, EXPENSE_CATEGORIES, type LineItem } from "@/lib/finance-docs";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Report {
  period: { from: string; to: string };
  fx: { usd_uzs: number };
  revenueUsd: number;
  vatCollectedUsd: number;
  outstandingUsd: number;
  expensesUsd: number;
  supplierPaymentsUsd: number;
  grossProfitUsd: number;
  expensesByCategory: Record<string, number>;
}
interface Invoice { id: string; number: string; customer_name: string; total_usd: number; status: string; issued_at: string }
interface Expense { id: string; category: string; description: string | null; amount: number; currency: string; amount_usd: number; supplier: string | null; spent_on: string }

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const STATUS_NEXT: Record<string, string> = { draft: "sent", sent: "paid", paid: "paid", void: "void" };
const STATUS_TONE: Record<string, string> = { draft: "text-muted-foreground", sent: "text-[var(--info)]", paid: "text-[var(--success)]", void: "text-[var(--danger)]" };

const COPY: Record<Locale, {
  title: string;
  intro: string;
  period: string;
  revenuePaid: string;
  expenses: string;
  grossProfit: string;
  vatCollected: string;
  outstandingSent: string;
  supplierPayments: string;
  invoices: string;
  newInvoice: string;
  colNumber: string;
  colCustomer: string;
  colTotal: string;
  colStatus: string;
  colIssued: string;
  print: string;
  advanceStatus: string;
  noInvoices: string;
  deleteInvoiceConfirm: string;
  expensesHeading: string;
  phDescription: string;
  phAmount: string;
  add: string;
  phSupplier: string;
  colCategory: string;
  colDescription: string;
  colAmount: string;
  colDate: string;
  noExpenses: string;
  newInvoiceModal: string;
  phCustomerReq: string;
  phPhone: string;
  lineItems: string;
  phQty: string;
  phUnit: string;
  addLine: string;
  vatPct: string;
  subtotal: string;
  vat: string;
  total: string;
  cancel: string;
  create: string;
  expenseCategory: Record<string, string>;
}> = {
  ru: {
    title: "Финансы",
    intro: "Счета (с НДС/QQS), мультивалютные расходы вкл. платежи поставщикам в CNY, и P&L за период.",
    period: "Период",
    revenuePaid: "Выручка (оплачено)",
    expenses: "Расходы",
    grossProfit: "Валовая прибыль",
    vatCollected: "Собран НДС (QQS)",
    outstandingSent: "К получению (выставлено)",
    supplierPayments: "Платежи поставщикам",
    invoices: "Счета",
    newInvoice: "Новый счёт",
    colNumber: "Номер",
    colCustomer: "Клиент",
    colTotal: "Итого",
    colStatus: "Статус",
    colIssued: "Выставлен",
    print: "Печать",
    advanceStatus: "Нажмите, чтобы изменить статус",
    noInvoices: "Счетов пока нет.",
    deleteInvoiceConfirm: "Удалить счёт?",
    expensesHeading: "Расходы",
    phDescription: "Описание",
    phAmount: "Сумма",
    add: "Добавить",
    phSupplier: "Поставщик (необязательно)",
    colCategory: "Категория",
    colDescription: "Описание",
    colAmount: "Сумма",
    colDate: "Дата",
    noExpenses: "Расходов пока нет.",
    newInvoiceModal: "Новый счёт",
    phCustomerReq: "Клиент *",
    phPhone: "Телефон",
    lineItems: "Позиции (USD)",
    phQty: "Кол-во",
    phUnit: "Цена $",
    addLine: "+ добавить позицию",
    vatPct: "НДС %",
    subtotal: "Подытог",
    vat: "НДС",
    total: "Итого",
    cancel: "Отмена",
    create: "Создать",
    expenseCategory: {
      supplier_payment: "платёж поставщику",
      freight: "фрахт",
      customs: "таможня",
      logistics: "логистика",
      certification: "сертификация",
      marketing: "маркетинг",
      salary: "зарплата",
      office: "офис",
      other: "прочее",
    },
  },
  uz: {
    title: "Moliya",
    intro: "Hisob-fakturalar (QQS/NDS bilan), ko'p valyutali xarajatlar, jumladan CNY da ta'minotchilarga to'lovlar va davr bo'yicha P&L.",
    period: "Davr",
    revenuePaid: "Tushum (to'langan)",
    expenses: "Xarajatlar",
    grossProfit: "Yalpi foyda",
    vatCollected: "Yig'ilgan QQS",
    outstandingSent: "Olinishi kerak (yuborilgan)",
    supplierPayments: "Ta'minotchilarga to'lovlar",
    invoices: "Hisob-fakturalar",
    newInvoice: "Yangi hisob-faktura",
    colNumber: "Raqam",
    colCustomer: "Mijoz",
    colTotal: "Jami",
    colStatus: "Holat",
    colIssued: "Berilgan",
    print: "Chop etish",
    advanceStatus: "Holatni o'zgartirish uchun bosing",
    noInvoices: "Hozircha hisob-fakturalar yo'q.",
    deleteInvoiceConfirm: "Hisob-fakturani o'chirilsinmi?",
    expensesHeading: "Xarajatlar",
    phDescription: "Tavsif",
    phAmount: "Summa",
    add: "Qo'shish",
    phSupplier: "Ta'minotchi (ixtiyoriy)",
    colCategory: "Kategoriya",
    colDescription: "Tavsif",
    colAmount: "Summa",
    colDate: "Sana",
    noExpenses: "Hozircha xarajatlar yo'q.",
    newInvoiceModal: "Yangi hisob-faktura",
    phCustomerReq: "Mijoz *",
    phPhone: "Telefon",
    lineItems: "Pozitsiyalar (USD)",
    phQty: "Soni",
    phUnit: "Narx $",
    addLine: "+ pozitsiya qo'shish",
    vatPct: "QQS %",
    subtotal: "Oraliq jami",
    vat: "QQS",
    total: "Jami",
    cancel: "Bekor qilish",
    create: "Yaratish",
    expenseCategory: {
      supplier_payment: "ta'minotchiga to'lov",
      freight: "fraxt",
      customs: "bojxona",
      logistics: "logistika",
      certification: "sertifikatlash",
      marketing: "marketing",
      salary: "ish haqi",
      office: "ofis",
      other: "boshqa",
    },
  },
  en: {
    title: "Finance",
    intro: "Invoices (with VAT/QQS), multi-currency expenses incl. CNY supplier payments, and a period P&L.",
    period: "Period",
    revenuePaid: "Revenue (paid)",
    expenses: "Expenses",
    grossProfit: "Gross profit",
    vatCollected: "VAT collected (QQS)",
    outstandingSent: "Outstanding (sent)",
    supplierPayments: "Supplier payments",
    invoices: "Invoices",
    newInvoice: "New invoice",
    colNumber: "Number",
    colCustomer: "Customer",
    colTotal: "Total",
    colStatus: "Status",
    colIssued: "Issued",
    print: "Print",
    advanceStatus: "Click to advance status",
    noInvoices: "No invoices yet.",
    deleteInvoiceConfirm: "Delete invoice?",
    expensesHeading: "Expenses",
    phDescription: "Description",
    phAmount: "Amount",
    add: "Add",
    phSupplier: "Supplier (optional)",
    colCategory: "Category",
    colDescription: "Description",
    colAmount: "Amount",
    colDate: "Date",
    noExpenses: "No expenses yet.",
    newInvoiceModal: "New invoice",
    phCustomerReq: "Customer *",
    phPhone: "Phone",
    lineItems: "Line items (USD)",
    phQty: "Qty",
    phUnit: "Unit $",
    addLine: "+ add line",
    vatPct: "VAT %",
    subtotal: "Subtotal",
    vat: "VAT",
    total: "Total",
    cancel: "Cancel",
    create: "Create",
    expenseCategory: {
      supplier_payment: "supplier payment",
      freight: "freight",
      customs: "customs",
      logistics: "logistics",
      certification: "certification",
      marketing: "marketing",
      salary: "salary",
      office: "office",
      other: "other",
    },
  },
};

export default function AdminFinancePage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // invoice modal
  const [showInv, setShowInv] = useState(false);
  const [inv, setInv] = useState<{ customer: string; phone: string; vat: number; due: string; items: LineItem[] }>({ customer: "", phone: "", vat: 12, due: "", items: [{ description: "", qty: 1, unitUsd: 0 }] });
  const [savingInv, setSavingInv] = useState(false);

  // expense form
  const [exp, setExp] = useState({ category: "supplier_payment", description: "", amount: "", currency: "CNY", supplier: "", spent_on: today });
  const [savingExp, setSavingExp] = useState(false);

  const loadAll = useCallback((f: string, t: string) => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/finance/report?from=${f}&to=${t}`).then((r) => r.json()),
      fetch(`/api/admin/invoices`).then((r) => r.json()),
      fetch(`/api/admin/expenses`).then((r) => r.json()),
    ]).then(([rep, in_, ex]) => {
      if (rep?.ok) setReport(rep);
      setInvoices(in_.invoices || []);
      setExpenses(ex.expenses || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(from, to); }, [from, to, loadAll]);

  // Prefill the expense form from a procurement "log supplier payment" link.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.get("exp_amount") && !p.get("exp_supplier")) return;
    setExp((e) => ({
      ...e,
      category: p.get("exp_category") || e.category,
      currency: p.get("exp_currency") || e.currency,
      amount: p.get("exp_amount") || e.amount,
      supplier: p.get("exp_supplier") || e.supplier,
      description: p.get("exp_desc") || e.description,
    }));
  }, []);

  const invTotals = computeInvoiceTotals(inv.items, inv.vat);

  const createInvoice = async () => {
    if (!inv.customer.trim() || inv.items.every((i) => !i.description.trim())) return;
    setSavingInv(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: inv.customer.trim(), customer_phone: inv.phone || null,
          line_items: inv.items.filter((i) => i.description.trim()), vat_pct: inv.vat, due_at: inv.due || null,
        }),
      });
      if (res.ok) { setShowInv(false); setInv({ customer: "", phone: "", vat: 12, due: "", items: [{ description: "", qty: 1, unitUsd: 0 }] }); loadAll(from, to); }
    } finally { setSavingInv(false); }
  };

  const cycleStatus = async (i: Invoice) => {
    const next = STATUS_NEXT[i.status];
    if (next === i.status) return;
    await fetch(`/api/admin/invoices/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    loadAll(from, to);
  };
  const delInvoice = async (id: string) => { if (!confirm(t.deleteInvoiceConfirm)) return; await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" }); loadAll(from, to); };

  const addExpense = async () => {
    if (!exp.amount || Number(exp.amount) <= 0) return;
    setSavingExp(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: exp.category, description: exp.description || null, amount: Number(exp.amount), currency: exp.currency, supplier: exp.supplier || null, spent_on: exp.spent_on || null }),
      });
      if (res.ok) { setExp({ ...exp, description: "", amount: "", supplier: "" }); loadAll(from, to); }
    } finally { setSavingExp(false); }
  };
  const delExpense = async (id: string) => { await fetch(`/api/admin/expenses?id=${id}`, { method: "DELETE" }); loadAll(from, to); };

  const setItem = (idx: number, patch: Partial<LineItem>) => setInv((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Receipt className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.intro}
      </p>

      <div className="flex items-center gap-2 mb-5 text-sm">
        <span className="text-muted-foreground">{t.period}</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto text-sm" />
        <span className="text-muted-foreground">→</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto text-sm" />
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <>
          {/* Summary */}
          {report && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {[
                { label: t.revenuePaid, value: usd(report.revenueUsd), accent: true },
                { label: t.expenses, value: usd(report.expensesUsd) },
                { label: t.grossProfit, value: usd(report.grossProfitUsd), accent: true },
                { label: t.vatCollected, value: usd(report.vatCollectedUsd) },
                { label: t.outstandingSent, value: usd(report.outstandingUsd) },
                { label: t.supplierPayments, value: usd(report.supplierPaymentsUsd) },
              ].map((c) => (
                <div key={c.label} className="bg-card border border-border p-4">
                  <p className={`font-mono text-xl font-semibold ${c.accent ? "text-primary" : "text-foreground"}`}>{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Invoices */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><FileText className="w-4 h-4" /> {t.invoices}</h2>
            <Button size="sm" onClick={() => setShowInv(true)}><Plus className="w-4 h-4" /> {t.newInvoice}</Button>
          </div>
          <div className="bg-card border border-border overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">{t.colNumber}</th><th className="px-4 py-2 font-medium">{t.colCustomer}</th>
                <th className="px-4 py-2 font-medium text-right">{t.colTotal}</th><th className="px-4 py-2 font-medium">{t.colStatus}</th>
                <th className="px-4 py-2 font-medium">{t.colIssued}</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{i.number}</td>
                    <td className="px-4 py-2 text-foreground">{i.customer_name}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{usd(i.total_usd)}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => cycleStatus(i)} className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_TONE[i.status]}`} title={t.advanceStatus}>{i.status}</button>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{i.issued_at}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <a href={`/api/admin/invoices/${i.id}/print`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs mr-3">{t.print}</a>
                      <button onClick={() => delInvoice(i.id)} className="text-muted-foreground hover:text-[var(--danger)] align-middle"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">{t.noInvoices}</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Expenses */}
          <h2 className="text-sm font-semibold text-foreground mb-2">{t.expensesHeading}</h2>
          <div className="bg-card border border-border p-3 mb-3">
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
              <select value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} className="h-10 rounded-[2px] border border-border bg-[var(--bg-3)] px-1.5 text-xs text-foreground">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t.expenseCategory[c] ?? c.replace("_", " ")}</option>)}
              </select>
              <Input placeholder={t.phDescription} value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} className="text-xs col-span-2" />
              <Input type="number" placeholder={t.phAmount} value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} className="text-xs" />
              <select value={exp.currency} onChange={(e) => setExp({ ...exp, currency: e.target.value })} className="h-10 rounded-[2px] border border-border bg-[var(--bg-3)] px-1.5 text-xs text-foreground">
                {["CNY", "USD", "UZS"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input type="date" value={exp.spent_on} onChange={(e) => setExp({ ...exp, spent_on: e.target.value })} className="text-xs" />
              <Button size="sm" onClick={addExpense} disabled={savingExp || !exp.amount}>{savingExp ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {t.add}</>}</Button>
            </div>
            <Input placeholder={t.phSupplier} value={exp.supplier} onChange={(e) => setExp({ ...exp, supplier: e.target.value })} className="text-xs mt-2 max-w-xs" />
          </div>
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">{t.colCategory}</th><th className="px-4 py-2 font-medium">{t.colDescription}</th>
                <th className="px-4 py-2 font-medium text-right">{t.colAmount}</th><th className="px-4 py-2 font-medium text-right">USD</th>
                <th className="px-4 py-2 font-medium">{t.colDate}</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground">{t.expenseCategory[e.category] ?? e.category.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-foreground">{e.description || "—"}{e.supplier ? <span className="text-muted-foreground text-xs"> · {e.supplier}</span> : null}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{Math.round(e.amount).toLocaleString()} {e.currency}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{usd(e.amount_usd)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.spent_on}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => delExpense(e.id)} className="text-muted-foreground hover:text-[var(--danger)]"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">{t.noExpenses}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Invoice modal */}
      {showInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInv(false)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-foreground">{t.newInvoiceModal}</h2><button onClick={() => setShowInv(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button></div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t.phCustomerReq} value={inv.customer} onChange={(e) => setInv({ ...inv, customer: e.target.value })} className="text-sm" />
                <Input placeholder={t.phPhone} value={inv.phone} onChange={(e) => setInv({ ...inv, phone: e.target.value })} className="text-sm" />
              </div>
              <p className="text-xs text-muted-foreground pt-1">{t.lineItems}</p>
              {inv.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <Input placeholder={t.phDescription} value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} className="text-sm" />
                  <Input type="number" placeholder={t.phQty} value={it.qty} onChange={(e) => setItem(idx, { qty: Number(e.target.value) || 0 })} className="text-sm w-16" />
                  <Input type="number" placeholder={t.phUnit} value={it.unitUsd || ""} onChange={(e) => setItem(idx, { unitUsd: Number(e.target.value) || 0 })} className="text-sm w-24" />
                  <button onClick={() => setInv((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }))} className="text-muted-foreground hover:text-[var(--danger)]"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setInv((s) => ({ ...s, items: [...s.items, { description: "", qty: 1, unitUsd: 0 }] }))} className="text-xs text-primary hover:underline">{t.addLine}</button>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="text-xs text-muted-foreground flex items-center gap-2">{t.vatPct} <Input type="number" value={inv.vat} onChange={(e) => setInv({ ...inv, vat: Number(e.target.value) || 0 })} className="text-sm w-20" /></label>
                <Input type="date" value={inv.due} onChange={(e) => setInv({ ...inv, due: e.target.value })} className="text-sm" />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">{t.subtotal} {usd(invTotals.subtotalUsd)} · {t.vat} {usd(invTotals.vatUsd)}</span>
                <span className="font-semibold text-foreground">{t.total} {usd(invTotals.totalUsd)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowInv(false)}>{t.cancel}</Button>
              <Button size="sm" onClick={createInvoice} disabled={savingInv || !inv.customer.trim()}>{savingInv ? <Loader2 className="w-4 h-4 animate-spin" /> : t.create}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
