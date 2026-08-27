"use client";

import { useEffect, useState } from "react";
import {
  Search, Phone, Package, RefreshCw, CheckCircle, AlertCircle, Clock, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  ordersCount: (n: number) => string;
  refresh: string;
  statusUpdated: string;
  noteAdded: string;
  updateFailed: string;
  all: string;
  searchPlaceholder: string;
  loading: string;
  noOrdersFound: string;
  noOrdersHint: string;
  deposit: string;
  orderHeading: (ref: string) => string;
  customer: string;
  phone: string;
  car: string;
  email: string;
  advanceStatus: string;
  addNoteToStatus: string;
  notePlaceholder: string;
  addNote: string;
  documents: string;
  docContract: string;
  docProforma: string;
  docReceipt: string;
  docHandover: string;
  docWarranty: string;
  documentsHint: string;
  history: string;
  noEvents: string;
  close: string;
  call: string;
  status: Record<string, string>;
}> = {
  ru: {
    title: "Заказы",
    ordersCount: (n) => `${n} импортных заказов`,
    refresh: "Обновить",
    statusUpdated: "Статус обновлён — клиент уведомлён",
    noteAdded: "Заметка добавлена",
    updateFailed: "Не удалось обновить заказ",
    all: "Все",
    searchPlaceholder: "Поиск по номеру, имени или телефону...",
    loading: "Загрузка...",
    noOrdersFound: "Заказы не найдены.",
    noOrdersHint: "Заказы создаются автоматически, когда клиент бронирует автомобиль.",
    deposit: "Депозит",
    orderHeading: (ref) => `Заказ ${ref}`,
    customer: "Клиент",
    phone: "Телефон",
    car: "Автомобиль",
    email: "Эл. почта",
    advanceStatus: "Изменить статус (клиенту уйдёт письмо)",
    addNoteToStatus: "Добавить заметку к текущему статусу",
    notePlaceholder: "напр. Авто прошло таможню, прибытие через 3 дня",
    addNote: "Добавить заметку",
    documents: "Документы",
    docContract: "Договор",
    docProforma: "Проформа",
    docReceipt: "Квитанция",
    docHandover: "Акт п/п",
    docWarranty: "Гарантия",
    documentsHint: "Открывается для печати / сохранения в PDF. Черновик — проверьте перед подписанием.",
    history: "История",
    noEvents: "Событий пока нет.",
    close: "Закрыть",
    call: "Позвонить",
    status: {
      ordered: "Заказан",
      deposit_paid: "Депозит оплачен",
      sourcing: "Поиск",
      in_transit: "В пути",
      at_customs: "На таможне",
      ready_for_pickup: "Готов к выдаче",
      delivered: "Доставлен",
    },
  },
  uz: {
    title: "Buyurtmalar",
    ordersCount: (n) => `${n} ta import buyurtma`,
    refresh: "Yangilash",
    statusUpdated: "Holat yangilandi — mijoz xabardor qilindi",
    noteAdded: "Izoh qoʻshildi",
    updateFailed: "Buyurtmani yangilab boʻlmadi",
    all: "Hammasi",
    searchPlaceholder: "Raqam, ism yoki telefon boʻyicha qidirish...",
    loading: "Yuklanmoqda...",
    noOrdersFound: "Buyurtmalar topilmadi.",
    noOrdersHint: "Buyurtmalar mijoz avtomobilni band qilganda avtomatik yaratiladi.",
    deposit: "Depozit",
    orderHeading: (ref) => `Buyurtma ${ref}`,
    customer: "Mijoz",
    phone: "Telefon",
    car: "Avtomobil",
    email: "Email",
    advanceStatus: "Holatni oʻzgartirish (mijozga xat yuboriladi)",
    addNoteToStatus: "Joriy holatga izoh qoʻshish",
    notePlaceholder: "masalan: Avto bojxonadan oʻtdi, yetib kelishi 3 kun",
    addNote: "Izoh qoʻshish",
    documents: "Hujjatlar",
    docContract: "Shartnoma",
    docProforma: "Proforma",
    docReceipt: "Kvitansiya",
    docHandover: "Topshirish dalolatnomasi",
    docWarranty: "Kafolat",
    documentsHint: "Chop etish / PDFga saqlash uchun ochiladi. Qoralama — imzolashdan oldin tekshiring.",
    history: "Tarix",
    noEvents: "Hozircha hodisalar yoʻq.",
    close: "Yopish",
    call: "Qoʻngʻiroq",
    status: {
      ordered: "Buyurtma qilindi",
      deposit_paid: "Depozit toʻlandi",
      sourcing: "Qidirilmoqda",
      in_transit: "Yoʻlda",
      at_customs: "Bojxonada",
      ready_for_pickup: "Olib ketishga tayyor",
      delivered: "Yetkazildi",
    },
  },
  en: {
    title: "Orders",
    ordersCount: (n) => `${n} import orders`,
    refresh: "Refresh",
    statusUpdated: "Status updated — customer notified",
    noteAdded: "Note added",
    updateFailed: "Failed to update order",
    all: "All",
    searchPlaceholder: "Search by reference, name, or phone...",
    loading: "Loading...",
    noOrdersFound: "No orders found.",
    noOrdersHint: "Orders are created automatically when a customer reserves a car.",
    deposit: "Deposit",
    orderHeading: (ref) => `Order ${ref}`,
    customer: "Customer",
    phone: "Phone",
    car: "Car",
    email: "Email",
    advanceStatus: "Advance status (emails the customer)",
    addNoteToStatus: "Add a note to the current status",
    notePlaceholder: "e.g. Vehicle cleared customs, ETA 3 days",
    addNote: "Add note",
    documents: "Documents",
    docContract: "Contract",
    docProforma: "Proforma",
    docReceipt: "Receipt",
    docHandover: "Handover act",
    docWarranty: "Warranty",
    documentsHint: "Opens for printing / saving as PDF. Draft — check before signing.",
    history: "History",
    noEvents: "No events yet.",
    close: "Close",
    call: "Call",
    status: {
      ordered: "Ordered",
      deposit_paid: "Deposit paid",
      sourcing: "Sourcing",
      in_transit: "In transit",
      at_customs: "At customs",
      ready_for_pickup: "Ready for pickup",
      delivered: "Delivered",
    },
  },
};

interface CarRel {
  brand: string;
  model: string;
  year: number;
  slug: string;
}

interface Order {
  id: string;
  reference_code: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  locale: string;
  amount_usd: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  car_id: string | null;
  cars: CarRel | CarRel[] | null;
}

interface OrderEvent {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

// Matches the 7-status CHECK on public.orders (migration 017), in order.
const STATUS_OPTIONS = [
  "ordered",
  "deposit_paid",
  "sourcing",
  "in_transit",
  "at_customs",
  "ready_for_pickup",
  "delivered",
] as const;

const statusVariant: Record<string, "warning" | "info" | "default" | "success"> = {
  ordered: "warning",
  deposit_paid: "info",
  sourcing: "info",
  in_transit: "default",
  at_customs: "default",
  ready_for_pickup: "info",
  delivered: "success",
};

function carOf(order: Order): CarRel | null {
  const c = order.cars;
  if (!c) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

export default function AdminOrdersPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchOrders = () => {
    setLoading(true);
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
    fetchOrders();
  }, []);

  const openOrder = async (order: Order) => {
    setSelected(order);
    setNote("");
    setEvents([]);
    const res = await fetch(`/api/admin/orders/${order.id}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events || []);
    }
  };

  const patchOrder = async (id: string, patch: { status?: string; note?: string | null }) => {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (res.ok) {
      const newStatus = patch.status;
      if (newStatus) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status: newStatus } : prev));
      }
      // Refresh the event log for the open order.
      const detail = await fetch(`/api/admin/orders/${id}`);
      if (detail.ok) {
        const data = await detail.json();
        setEvents(data.events || []);
      }
      setNote("");
      showFeedback("success", newStatus ? t.statusUpdated : t.noteAdded);
    } else {
      showFeedback("error", t.updateFailed);
    }
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.reference_code.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q)
      );
    }
    return true;
  });

  const counts: Record<string, number> = { all: orders.length };
  for (const s of STATUS_OPTIONS) counts[s] = orders.filter((o) => o.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.ordersCount(orders.length)}</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="w-4 h-4" />
          {t.refresh}
        </Button>
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
              statusFilter === status ? "bg-navy text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {status === "all" ? t.all : t.status[status]}
            <span className="ml-2 text-xs opacity-70">({counts[status]})</span>
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

      {/* Orders list */}
      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">{t.loading}</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t.noOrdersFound}</p>
              <p className="text-sm mt-1">{t.noOrdersHint}</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((order, index) => {
            const car = carOf(order);
            return (
              <div key={order.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => openOrder(order)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 mt-1">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-sm">{order.reference_code}</span>
                            <Badge variant={statusVariant[order.status] || "default"}>
                              {t.status[order.status] || order.status}
                            </Badge>
                          </div>
                          <p className="font-semibold mt-1">
                            {car ? `${car.brand} ${car.model} ${car.year}` : order.customer_name}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {order.customer_name} · {order.customer_phone}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground font-mono">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                        {order.amount_usd != null && (
                          <p className="text-xs text-muted-foreground mt-1">{t.deposit}: <span className="font-mono">${order.amount_usd}</span></p>
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
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="animate-fade-in relative bg-card border border-white/10 rounded-2xl w-full max-w-lg p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{t.orderHeading(selected.reference_code)}</h2>
              <Badge variant={statusVariant[selected.status] || "default"}>
                {t.status[selected.status] || selected.status}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.customer}</p>
                  <p className="font-medium text-white">{selected.customer_name}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.phone}</p>
                  <p className="font-medium text-white">{selected.customer_phone}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.car}</p>
                  <p className="font-medium text-white">
                    {carOf(selected) ? `${carOf(selected)!.brand} ${carOf(selected)!.model} ${carOf(selected)!.year}` : "—"}
                  </p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <p className="text-white/40 text-xs">{t.email}</p>
                  <p className="font-medium text-white break-all">{selected.customer_email || "—"}</p>
                </div>
              </div>

              {/* Status changer */}
              <div>
                <p className="text-sm font-medium mb-2">{t.advanceStatus}</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      disabled={saving || selected.status === status}
                      onClick={() => patchOrder(selected.id, { status })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50",
                        selected.status === status
                          ? "bg-navy text-white border-navy"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {t.status[status]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add a note */}
              <div>
                <p className="text-sm font-medium mb-2">{t.addNoteToStatus}</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full min-h-[72px] rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-sm text-white"
                  placeholder={t.notePlaceholder}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || !note.trim()}
                    onClick={() => patchOrder(selected.id, { note: note.trim() })}
                  >
                    {t.addNote}
                  </Button>
                </div>
              </div>

              {/* Documents (Phase AF) — branded RU/UZ paperwork from this order. */}
              <div>
                <p className="text-sm font-medium mb-2">{t.documents}</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ["sales_contract", t.docContract],
                    ["proforma_invoice", t.docProforma],
                    ["deposit_receipt", t.docReceipt],
                    ["handover_act", t.docHandover],
                    ["warranty_certificate", t.docWarranty],
                  ] as const).map(([type, label]) => (
                    <a
                      key={type}
                      href={`/api/admin/orders/${selected.id}/documents/${type}?locale=ru`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                    >
                      {label}
                    </a>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-white/40">{t.documentsHint}</p>
              </div>

              {/* Event history */}
              <div>
                <p className="text-sm font-medium mb-2">{t.history}</p>
                {events.length === 0 ? (
                  <p className="text-xs text-white/40">{t.noEvents}</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-2 text-sm bg-white/[0.03] rounded-lg p-3">
                        <Clock className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-white/80">{t.status[ev.status] || ev.status}</p>
                          {ev.note && (
                            <p className="text-xs text-white/50 mt-0.5 flex items-start gap-1">
                              <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                              {ev.note}
                            </p>
                          )}
                          <p className="text-xs text-white/30 mt-0.5">{new Date(ev.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-white/10">
                <Button variant="outline" onClick={() => setSelected(null)}>{t.close}</Button>
                <Button asChild>
                  <a href={`tel:${selected.customer_phone}`}>
                    <Phone className="w-4 h-4" />
                    {t.call}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
