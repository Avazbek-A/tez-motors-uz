"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { Car, MessageSquare, Star, HelpCircle, ArrowUpRight, Clock, ChevronLeft, ChevronRight, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  dashboard: string;
  overview: string;
  totalCars: string;
  available: string;
  totalInquiries: string;
  fromAllSources: string;
  newInquiries: string;
  awaitingResponse: string;
  reviews: string;
  pending: string;
  dueTodayOverdue: string;
  lowStock: string;
  manageParts: string;
  outOfStock: string;
  left: string;
  recentInquiries: string;
  viewAll: string;
  noInquiries: string;
  of: string;
  prev: string;
  next: string;
}> = {
  ru: {
    dashboard: "Панель управления",
    overview: "Обзор админ-панели Tez Motors",
    totalCars: "Всего авто",
    available: "в наличии",
    totalInquiries: "Всего заявок",
    fromAllSources: "из всех источников",
    newInquiries: "Новые заявки",
    awaitingResponse: "ожидают ответа",
    reviews: "Отзывы",
    pending: "на модерации",
    dueTodayOverdue: "Срок сегодня / просрочено",
    lowStock: "Заканчивается (≤ 5)",
    manageParts: "Управление запчастями",
    outOfStock: "Нет в наличии",
    left: "осталось",
    recentInquiries: "Последние заявки",
    viewAll: "Все",
    noInquiries: "Заявок пока нет. Они появятся здесь, когда клиенты заполнят формы.",
    of: "из",
    prev: "Назад",
    next: "Далее",
  },
  uz: {
    dashboard: "Boshqaruv paneli",
    overview: "Tez Motors admin panelining umumiy ko'rinishi",
    totalCars: "Jami avtomobillar",
    available: "mavjud",
    totalInquiries: "Jami so'rovlar",
    fromAllSources: "barcha manbalardan",
    newInquiries: "Yangi so'rovlar",
    awaitingResponse: "javob kutmoqda",
    reviews: "Sharhlar",
    pending: "moderatsiyada",
    dueTodayOverdue: "Bugun / muddati o'tgan",
    lowStock: "Tugayapti (≤ 5)",
    manageParts: "Ehtiyot qismlarni boshqarish",
    outOfStock: "Mavjud emas",
    left: "qoldi",
    recentInquiries: "So'nggi so'rovlar",
    viewAll: "Barchasi",
    noInquiries: "Hozircha so'rovlar yo'q. Mijozlar shakllarni to'ldirganda ular shu yerda paydo bo'ladi.",
    of: "/",
    prev: "Orqaga",
    next: "Keyingi",
  },
  en: {
    dashboard: "Dashboard",
    overview: "Overview of your Tez Motors admin panel",
    totalCars: "Total Cars",
    available: "available",
    totalInquiries: "Total Inquiries",
    fromAllSources: "from all sources",
    newInquiries: "New Inquiries",
    awaitingResponse: "awaiting response",
    reviews: "Reviews",
    pending: "pending",
    dueTodayOverdue: "Due Today / Overdue",
    lowStock: "Low stock (≤ 5)",
    manageParts: "Manage parts",
    outOfStock: "Out of stock",
    left: "left",
    recentInquiries: "Recent Inquiries",
    viewAll: "View all",
    noInquiries: "No inquiries yet. They will appear here when customers submit forms.",
    of: "of",
    prev: "Prev",
    next: "Next",
  },
};

interface Stats {
  cars: { total: number; available: number; hotOffers: number };
  reviews: { total: number; pending: number };
  faqs: { total: number };
  inquiries: { total: number; new: number; contacted: number; in_progress: number; closed: number };
}

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  type: string;
  status: string;
  created_at: string;
  source_page?: string;
  follow_up_date?: string | null;
}

const PAGE_SIZE = 10;

interface LowStockPart {
  id: string;
  slug: string;
  name_ru: string;
  oem_number: string | null;
  category: string;
  stock_qty: number;
}

export default function AdminDashboard() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [stats, setStats] = useState<Stats | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [page, setPage] = useState(0);
  const [lowStock, setLowStock] = useState<LowStockPart[]>([]);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

    fetch("/api/inquiry")
      .then((r) => r.json())
      .then((data) => setInquiries(data.inquiries || []))
      .catch(() => {});

    fetch("/api/admin/parts/low-stock?threshold=5&limit=10")
      .then((r) => r.json())
      .then((d) => setLowStock(d.parts || []))
      .catch(() => {});
  }, []);

  const statCards = [
    {
      title: t.totalCars,
      value: stats?.cars.total ?? "...",
      change: `${stats?.cars.available ?? 0} ${t.available}`,
      icon: Car,
      color: "text-primary bg-primary/15",
    },
    {
      title: t.totalInquiries,
      value: stats?.inquiries.total ?? "...",
      change: t.fromAllSources,
      icon: MessageSquare,
      color: "text-green-400 bg-green-500/15",
    },
    {
      title: t.newInquiries,
      value: stats?.inquiries.new ?? "...",
      change: t.awaitingResponse,
      icon: Clock,
      color: "text-amber-400 bg-amber-500/15",
    },
    {
      title: t.reviews,
      value: stats?.reviews.total ?? "...",
      change: `${stats?.reviews.pending ?? 0} ${t.pending}`,
      icon: Star,
      color: "text-muted-foreground bg-white/[0.06]",
    },
  ];
  // Date.now() drives a read-only "follow-up due by end of today" filter for
  // display; a per-render evaluation is intentional and side-effect-free.
  // eslint-disable-next-line react-hooks/purity
  const dueInquiries = inquiries.filter((inq) => inq.follow_up_date && new Date(inq.follow_up_date).setHours(23, 59, 59, 999) >= Date.now()).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t.dashboard}</h1>
        <p className="text-muted-foreground">{t.overview}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold font-mono">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.change}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {dueInquiries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.dueTodayOverdue}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dueInquiries.map((inq) => (
              <div key={inq.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="font-medium">{inq.name}</p>
                  <p className="text-sm text-muted-foreground">{inq.phone}</p>
                </div>
                <Badge variant={inq.status === "new" ? "warning" : "secondary"}>
                  {inq.follow_up_date}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <PackageOpen className="w-5 h-5 text-amber-500" /> {t.lowStock}
            </CardTitle>
            <Link
              href="/admin/parts"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {t.manageParts} <ArrowUpRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name_ru}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.oem_number ? `OEM ${p.oem_number} · ` : ""}
                    {p.category}
                  </p>
                </div>
                <Badge variant={p.stock_qty === 0 ? "destructive" : "warning"}>
                  {p.stock_qty === 0 ? t.outOfStock : `${p.stock_qty} ${t.left}`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent inquiries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t.recentInquiries}</CardTitle>
          <Link href="/admin/inquiries" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            {t.viewAll} <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t.noInquiries}
            </p>
          ) : (
            <div className="space-y-3">
              {inquiries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
                      <span className="text-sm font-bold text-foreground">
                        {inquiry.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{inquiry.name}</p>
                      <p className="text-sm text-muted-foreground">{inquiry.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={inquiry.status === "new" ? "warning" : "success"}>
                      {inquiry.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {inquiries.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-3 border-t border-border text-sm">
                  <span className="text-muted-foreground font-mono">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, inquiries.length)} {t.of} {inquiries.length}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                      <ChevronLeft className="w-4 h-4" /> {t.prev}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE >= inquiries.length ? p : p + 1))} disabled={(page + 1) * PAGE_SIZE >= inquiries.length}>
                      {t.next} <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
