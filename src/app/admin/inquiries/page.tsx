"use client";

import { useEffect, useState } from "react";

import {
  Search, Phone, Mail, MessageSquare, Clock,
  CheckCircle, XCircle, ArrowRight, Eye, RefreshCw, Download, Trash2, AlertCircle, Sparkles, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { scoreLead, leadTier, type LeadTier } from "@/lib/lead-score";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  type: string;
  status: string;
  source_page?: string;
  car_id?: string;
  created_at: string;
  notes?: string | null;
  follow_up_date?: string | null;
}

const statusConfig = {
  new: { variant: "warning" as const, icon: Clock },
  contacted: { variant: "info" as const, icon: Phone },
  in_progress: { variant: "default" as const, icon: ArrowRight },
  closed: { variant: "success" as const, icon: CheckCircle },
};

const STATUS_OPTIONS = ["new", "contacted", "in_progress", "closed"] as const;

type StatusKey = (typeof STATUS_OPTIONS)[number];

const COPY: Record<Locale, {
  statusLabels: Record<StatusKey, string>;
  typeLabels: Record<string, string>;
  statusUpdated: string;
  statusUpdateFailed: string;
  inquiryDeleted: string;
  inquiryDeleteFailed: string;
  confirmDelete: string;
  title: string;
  totalSuffix: string;
  refresh: string;
  exportCsv: string;
  all: string;
  searchPlaceholder: string;
  loading: string;
  noInquiriesTitle: string;
  noInquiriesHint: string;
  detailsTitle: string;
  notes: string;
  notesPlaceholder: string;
  followUpDate: string;
  changeStatus: string;
  fieldType: string;
  fieldStatus: string;
  fieldSource: string;
  fieldDate: string;
  na: string;
  draftAiReply: string;
  suggestedReply: string;
  templateSuffix: string;
  regenerate: string;
  copy: string;
  sendWhatsApp: string;
  toUsedListing: string;
  delete: string;
  save: string;
  close: string;
  call: string;
  promptSellPrice: string;
  invalidPrice: string;
  usedListingCreated: string;
  convertFailed: string;
  connectionError: string;
}> = {
  ru: {
    statusLabels: { new: "Новый", contacted: "Связались", in_progress: "В работе", closed: "Закрыт" },
    typeLabels: {
      general: "Общий",
      car_inquiry: "Запрос по авто",
      callback: "Обратный звонок",
      calculator: "Калькулятор",
      reservation: "Бронирование",
      test_drive: "Тест-драйв",
      trade_in: "Трейд-ин",
      newsletter: "Рассылка",
      service: "Сервис",
    },
    statusUpdated: "Статус обновлён",
    statusUpdateFailed: "Не удалось обновить статус",
    inquiryDeleted: "Запрос удалён",
    inquiryDeleteFailed: "Не удалось удалить запрос",
    confirmDelete: "Удалить этот запрос?",
    title: "Запросы",
    totalSuffix: "всего запросов",
    refresh: "Обновить",
    exportCsv: "Экспорт CSV",
    all: "Все",
    searchPlaceholder: "Поиск по имени, телефону или сообщению...",
    loading: "Загрузка...",
    noInquiriesTitle: "Запросы не найдены.",
    noInquiriesHint: "Запросы появятся здесь, когда клиенты отправят формы на вашем сайте.",
    detailsTitle: "Детали запроса",
    notes: "Заметки",
    notesPlaceholder: "Внутренние заметки для команды",
    followUpDate: "Дата напоминания",
    changeStatus: "Изменить статус",
    fieldType: "Тип",
    fieldStatus: "Статус",
    fieldSource: "Источник",
    fieldDate: "Дата",
    na: "Н/Д",
    draftAiReply: "Черновик AI-ответа",
    suggestedReply: "Предлагаемый ответ",
    templateSuffix: " (шаблон)",
    regenerate: "Перегенерировать",
    copy: "Копировать",
    sendWhatsApp: "Отправить в WhatsApp",
    toUsedListing: "🚗 В объявление с пробегом",
    delete: "Удалить",
    save: "Сохранить",
    close: "Закрыть",
    call: "Позвонить",
    promptSellPrice: "Цена продажи (USD) для объявления с пробегом:",
    invalidPrice: "Введите корректную цену",
    usedListingCreated: "Создано объявление с пробегом",
    convertFailed: "Не удалось конвертировать",
    connectionError: "Ошибка связи",
  },
  uz: {
    statusLabels: { new: "Yangi", contacted: "Bog‘lanildi", in_progress: "Jarayonda", closed: "Yopildi" },
    typeLabels: {
      general: "Umumiy",
      car_inquiry: "Avto so‘rovi",
      callback: "Qayta qo‘ng‘iroq",
      calculator: "Kalkulyator",
      reservation: "Bron qilish",
      test_drive: "Sinov haydovi",
      trade_in: "Treyd-in",
      newsletter: "Axborotnoma",
      service: "Servis",
    },
    statusUpdated: "Holat yangilandi",
    statusUpdateFailed: "Holatni yangilab bo‘lmadi",
    inquiryDeleted: "So‘rov o‘chirildi",
    inquiryDeleteFailed: "So‘rovni o‘chirib bo‘lmadi",
    confirmDelete: "Ushbu so‘rov o‘chirilsinmi?",
    title: "So‘rovlar",
    totalSuffix: "ta jami so‘rov",
    refresh: "Yangilash",
    exportCsv: "CSV eksport",
    all: "Hammasi",
    searchPlaceholder: "Ism, telefon yoki xabar bo‘yicha qidirish...",
    loading: "Yuklanmoqda...",
    noInquiriesTitle: "So‘rovlar topilmadi.",
    noInquiriesHint: "Mijozlar saytingizda shakllarni yuborganda so‘rovlar shu yerda paydo bo‘ladi.",
    detailsTitle: "So‘rov tafsilotlari",
    notes: "Eslatmalar",
    notesPlaceholder: "Jamoa uchun ichki eslatmalar",
    followUpDate: "Qayta aloqa sanasi",
    changeStatus: "Holatni o‘zgartirish",
    fieldType: "Turi",
    fieldStatus: "Holat",
    fieldSource: "Manba",
    fieldDate: "Sana",
    na: "Yo‘q",
    draftAiReply: "AI javob qoralamasi",
    suggestedReply: "Tavsiya etilgan javob",
    templateSuffix: " (shablon)",
    regenerate: "Qayta yaratish",
    copy: "Nusxalash",
    sendWhatsApp: "WhatsApp orqali yuborish",
    toUsedListing: "🚗 Probegli e’longa",
    delete: "O‘chirish",
    save: "Saqlash",
    close: "Yopish",
    call: "Qo‘ng‘iroq",
    promptSellPrice: "Probegli e’lon uchun sotuv narxi (USD):",
    invalidPrice: "To‘g‘ri narx kiriting",
    usedListingCreated: "Probegli e’lon yaratildi",
    convertFailed: "Konvertatsiya qilib bo‘lmadi",
    connectionError: "Aloqa xatosi",
  },
  en: {
    statusLabels: { new: "New", contacted: "Contacted", in_progress: "In Progress", closed: "Closed" },
    typeLabels: {
      general: "General",
      car_inquiry: "Car Inquiry",
      callback: "Callback",
      calculator: "Calculator",
      reservation: "Reservation",
      test_drive: "Test Drive",
      trade_in: "Trade-in",
      newsletter: "Newsletter",
      service: "Service",
    },
    statusUpdated: "Status updated",
    statusUpdateFailed: "Failed to update status",
    inquiryDeleted: "Inquiry deleted",
    inquiryDeleteFailed: "Failed to delete inquiry",
    confirmDelete: "Delete this inquiry?",
    title: "Inquiries",
    totalSuffix: "total inquiries",
    refresh: "Refresh",
    exportCsv: "Export CSV",
    all: "All",
    searchPlaceholder: "Search by name, phone, or message...",
    loading: "Loading...",
    noInquiriesTitle: "No inquiries found.",
    noInquiriesHint: "Inquiries will appear here when customers submit forms on your website.",
    detailsTitle: "Inquiry Details",
    notes: "Notes",
    notesPlaceholder: "Internal notes for the team",
    followUpDate: "Follow-up Date",
    changeStatus: "Change Status",
    fieldType: "Type",
    fieldStatus: "Status",
    fieldSource: "Source",
    fieldDate: "Date",
    na: "N/A",
    draftAiReply: "Draft AI reply",
    suggestedReply: "Suggested reply",
    templateSuffix: " (template)",
    regenerate: "Regenerate",
    copy: "Copy",
    sendWhatsApp: "Send on WhatsApp",
    toUsedListing: "🚗 To used listing",
    delete: "Delete",
    save: "Save",
    close: "Close",
    call: "Call",
    promptSellPrice: "Sell price (USD) for the used listing:",
    invalidPrice: "Enter a valid price",
    usedListingCreated: "Used listing created",
    convertFailed: "Failed to convert",
    connectionError: "Connection error",
  },
};

export default function AdminInquiriesPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftIsAi, setAiDraftIsAi] = useState(false);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Reset any drafted reply when a different lead is opened.
  useEffect(() => {
    setAiDraft(null);
    setAiDraftIsAi(false);
  }, [selectedInquiry?.id]);

  const generateAiDraft = async () => {
    if (!selectedInquiry) return;
    setAiDraftLoading(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${selectedInquiry.id}/draft-reply`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.reply === "string") {
        setAiDraft(data.reply);
        setAiDraftIsAi(!!data.ai);
      }
    } finally {
      setAiDraftLoading(false);
    }
  };

  // wa.me-ready international digits (Uzbek 9-digit locals get the 998 prefix).
  const waDigits = (phone: string) => {
    let d = (phone || "").replace(/\D/g, "");
    if (d.length === 9) d = "998" + d;
    return d;
  };

  const fetchInquiries = () => {
    setLoading(true);
    fetch("/api/inquiry")
      .then((r) => r.json())
      .then((data) => {
        setInquiries(data.inquiries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const saveInquiry = async (id: string, patch?: Partial<Pick<Inquiry, "status" | "notes" | "follow_up_date">>) => {
    const res = await fetch(`/api/inquiry/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: patch?.status ?? selectedInquiry?.status ?? "new",
        notes: patch?.notes ?? selectedInquiry?.notes ?? null,
        follow_up_date: patch?.follow_up_date ?? selectedInquiry?.follow_up_date ?? null,
      }),
    });
    if (res.ok) {
      setInquiries(inquiries.map((i) =>
        i.id === id
          ? {
              ...i,
              status: patch?.status ?? i.status,
              notes: patch?.notes ?? i.notes,
              follow_up_date: patch?.follow_up_date ?? i.follow_up_date,
            }
          : i
      ));
      if (selectedInquiry?.id === id) {
        setSelectedInquiry({
          ...selectedInquiry,
          status: patch?.status ?? selectedInquiry.status,
          notes: patch?.notes ?? selectedInquiry.notes,
          follow_up_date: patch?.follow_up_date ?? selectedInquiry.follow_up_date,
        });
      }
      showFeedback("success", t.statusUpdated);
    } else {
      showFeedback("error", t.statusUpdateFailed);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    const res = await fetch(`/api/inquiry/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInquiries(inquiries.filter((i) => i.id !== id));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
      showFeedback("success", t.inquiryDeleted);
    } else {
      showFeedback("error", t.inquiryDeleteFailed);
    }
  };

  const filtered = inquiries.filter((inq) => {
    if (statusFilter !== "all" && inq.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inq.name.toLowerCase().includes(q) ||
        inq.phone.includes(q) ||
        (inq.message || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Heuristic lead score → auto-prioritize: hottest leads float to the top.
  const inquiryScore = (inq: Inquiry) =>
    scoreLead({
      type: inq.type,
      hasEmail: !!inq.email,
      hasCarId: !!inq.car_id,
      messageLength: inq.message?.length ?? 0,
    });
  const sorted = [...filtered].sort((a, b) => inquiryScore(b) - inquiryScore(a));
  const TIER_BADGE: Record<LeadTier, string> = {
    hot: "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent-line)]",
    warm: "bg-[var(--bg-3)] text-[var(--fg-2)] border border-[var(--line-2)]",
    cold: "bg-transparent text-[var(--fg-4)] border border-[var(--line-1)]",
  };

  const statusCounts = {
    all: inquiries.length,
    new: inquiries.filter((i) => i.status === "new").length,
    contacted: inquiries.filter((i) => i.status === "contacted").length,
    in_progress: inquiries.filter((i) => i.status === "in_progress").length,
    closed: inquiries.filter((i) => i.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{inquiries.length} {t.totalSuffix}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInquiries}>
            <RefreshCw className="w-4 h-4" />
            {t.refresh}
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/admin/export" download>
              <Download className="w-4 h-4" />
              {t.exportCsv}
            </a>
          </Button>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${
          feedback.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["all", ...STATUS_OPTIONS] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
              statusFilter === status
                ? "bg-navy text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {status === "all" ? t.all : t.statusLabels[status] || status}
            <span className="ml-2 text-xs opacity-70">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inquiries list */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              {t.loading}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t.noInquiriesTitle}</p>
              <p className="text-sm mt-1">{t.noInquiriesHint}</p>
            </CardContent>
          </Card>
        ) : (
          sorted.map((inquiry, index) => {
            const config = statusConfig[inquiry.status as keyof typeof statusConfig] || statusConfig.new;
            const statusLabel = t.statusLabels[inquiry.status as StatusKey] || inquiry.status;
            return (
              <div
                key={inquiry.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setSelectedInquiry(inquiry)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 mt-1">
                          <span className="text-sm font-bold text-foreground">
                            {inquiry.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{inquiry.name}</p>
                            <Badge variant={config.variant}>{statusLabel}</Badge>
                            <Badge variant="secondary">{t.typeLabels[inquiry.type] || inquiry.type}</Badge>
                            {(() => { const t = leadTier(inquiryScore(inquiry)); return (
                              <span className={cn("text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-[2px]", TIER_BADGE[t])}>{t}</span>
                            ); })()}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{inquiry.phone}</p>
                          {inquiry.message && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{inquiry.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground font-mono">
                          {new Date(inquiry.created_at).toLocaleString()}
                        </p>
                        {inquiry.source_page && (
                          <p className="text-xs text-muted-foreground mt-1">{inquiry.source_page}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </div>

      {/* Detail modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInquiry(null)} />
          <div
            className="animate-fade-in relative bg-card border border-white/10 rounded-2xl w-full max-w-lg p-8 shadow-2xl"
          >
            <h2 className="text-xl font-bold mb-4">{t.detailsTitle}</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {selectedInquiry.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{selectedInquiry.name}</p>
                  <p className="text-muted-foreground">{selectedInquiry.phone}</p>
                </div>
              </div>
              {selectedInquiry.message && (
                <div className="bg-white/[0.04] rounded-xl p-4">
                  <p className="text-sm text-white/80">{selectedInquiry.message}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">{t.notes}</p>
                  <textarea
                    value={selectedInquiry.notes ?? ""}
                    onChange={(e) => setSelectedInquiry({ ...selectedInquiry, notes: e.target.value })}
                    className="w-full min-h-[96px] rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-sm text-white"
                    placeholder={t.notesPlaceholder}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">{t.followUpDate}</p>
                  <Input
                    type="date"
                    value={selectedInquiry.follow_up_date ?? ""}
                    onChange={(e) => setSelectedInquiry({ ...selectedInquiry, follow_up_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Status changer */}
              <div>
                <p className="text-sm font-medium mb-2">{t.changeStatus}</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map((status) => {
                    return (
                      <button
                        key={status}
                        onClick={() => saveInquiry(selectedInquiry.id, { status })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          selectedInquiry.status === status
                            ? "bg-navy text-white border-navy"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {t.statusLabels[status]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.fieldType}</p>
                  <p className="font-medium text-white">{t.typeLabels[selectedInquiry.type] || selectedInquiry.type}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.fieldStatus}</p>
                  <p className="font-medium text-white">{t.statusLabels[selectedInquiry.status as StatusKey] || selectedInquiry.status}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.fieldSource}</p>
                  <p className="font-medium text-white">{selectedInquiry.source_page || t.na}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.fieldDate}</p>
                  <p className="font-medium text-white">{new Date(selectedInquiry.created_at).toLocaleString()}</p>
                </div>
              </div>
              {/* Proactive AI sales: draft a reply, edit if needed, send in one tap. */}
              <div className="pt-4 border-t border-white/10">
                {!aiDraft ? (
                  <Button variant="outline" size="sm" onClick={generateAiDraft} disabled={aiDraftLoading} className="w-full">
                    {aiDraftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t.draftAiReply}</>}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" /> {t.suggestedReply}{aiDraftIsAi ? "" : t.templateSuffix}
                      </p>
                      <button onClick={generateAiDraft} disabled={aiDraftLoading} className="text-xs text-muted-foreground hover:text-primary">
                        {aiDraftLoading ? "…" : t.regenerate}
                      </button>
                    </div>
                    <textarea
                      value={aiDraft}
                      onChange={(e) => setAiDraft(e.target.value)}
                      className="w-full min-h-[100px] rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-sm text-white"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(aiDraft)} className="flex-1">{t.copy}</Button>
                      <Button size="sm" asChild className="flex-1">
                        <a href={`https://wa.me/${waDigits(selectedInquiry.phone)}?text=${encodeURIComponent(aiDraft)}`} target="_blank" rel="noopener noreferrer">
                          {t.sendWhatsApp}
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Acquisition → inventory: turn a trade-in into a used listing. */}
              {selectedInquiry.type === "trade_in" && !(selectedInquiry as { metadata?: Record<string, unknown> }).metadata?.converted_car_id && (
                <div className="pt-4 border-t border-white/10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      const priceStr = window.prompt(t.promptSellPrice);
                      if (!priceStr) return;
                      const price_usd = parseInt(priceStr, 10);
                      if (!Number.isFinite(price_usd) || price_usd <= 0) { showFeedback("error", t.invalidPrice); return; }
                      try {
                        const res = await fetch(`/api/admin/inquiries/${selectedInquiry.id}/convert-to-car`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ price_usd }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) {
                          showFeedback("success", t.usedListingCreated);
                          window.open(`/ru/catalog/${data.slug}`, "_blank");
                          setSelectedInquiry(null);
                          fetchInquiries();
                        } else {
                          showFeedback("error", data.error || t.convertFailed);
                        }
                      } catch {
                        showFeedback("error", t.connectionError);
                      }
                    }}
                  >
                    {t.toUsedListing}
                  </Button>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-white/10">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedInquiry.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  {t.delete}
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => saveInquiry(selectedInquiry.id, { notes: selectedInquiry.notes ?? null, follow_up_date: selectedInquiry.follow_up_date ?? null })}>
                    {t.save}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedInquiry(null)}>{t.close}</Button>
                  <Button asChild>
                    <a href={`tel:${selectedInquiry.phone}`}>
                      <Phone className="w-4 h-4" />
                      {t.call}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
