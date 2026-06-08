"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Car, MessageSquare, Star, HelpCircle,
  Settings, ChevronLeft, Menu, LogOut, BarChart3, ExternalLink, Users, FileText, Wrench, Package, ScrollText, Boxes, Columns3, Calculator, TrendingUp, Wallet, Truck, Activity, LineChart, Megaphone, AlertTriangle, Ship, Banknote, Bot, Contact, ListChecks, Send, Target, Container, Receipt, Gauge, Tag, ShieldCheck, FileSpreadsheet, Hourglass, Sparkles, Cable, Share2, Bike, Factory, Phone, Landmark, Building2, Workflow, Gift, Users2
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import { locales, type Locale } from "@/i18n/config";

type Tri = Record<Locale, string>;
interface NavItem { href: string; label: Tri; icon: React.ComponentType<{ className?: string }> }
interface NavGroup { section: Tri; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    section: { ru: "Обзор", uz: "Umumiy", en: "Overview" },
    items: [
      { href: "/admin/command", label: { ru: "Командный центр", uz: "Boshqaruv markazi", en: "Command" }, icon: Gauge },
      { href: "/admin/copilot", label: { ru: "Копилот", uz: "Kopilot", en: "Copilot" }, icon: Bot },
      { href: "/admin/operator", label: { ru: "AI-оператор", uz: "AI-operator", en: "AI Operator" }, icon: Sparkles },
      { href: "/admin", label: { ru: "Панель", uz: "Boshqaruv paneli", en: "Dashboard" }, icon: LayoutDashboard },
      { href: "/admin/autopilot", label: { ru: "Автопилот", uz: "Avtopilot", en: "Autopilot" }, icon: Activity },
      { href: "/admin/autopilot/settings", label: { ru: "Правила автопилота", uz: "Avtopilot qoidalari", en: "Autopilot Rules" }, icon: Bot },
      { href: "/admin/analytics", label: { ru: "Аналитика", uz: "Analitika", en: "Analytics" }, icon: BarChart3 },
    ],
  },
  {
    section: { ru: "Продажи", uz: "Sotuv", en: "Sell" },
    items: [
      { href: "/admin/customers", label: { ru: "Клиенты", uz: "Mijozlar", en: "Customers" }, icon: Contact },
      { href: "/admin/conversations", label: { ru: "AI-продажи", uz: "AI-sotuv", en: "AI Sales" }, icon: Bot },
      { href: "/admin/inquiries", label: { ru: "Заявки", uz: "So'rovlar", en: "Inquiries" }, icon: MessageSquare },
      { href: "/admin/calls", label: { ru: "Звонки", uz: "Qo'ng'iroqlar", en: "Calls" }, icon: Phone },
      { href: "/admin/pipeline", label: { ru: "Воронка", uz: "Voronka", en: "Pipeline" }, icon: Columns3 },
      { href: "/admin/tasks", label: { ru: "Задачи", uz: "Vazifalar", en: "Tasks" }, icon: ListChecks },
      { href: "/admin/orders", label: { ru: "Заказы", uz: "Buyurtmalar", en: "Orders" }, icon: Package },
      { href: "/admin/team", label: { ru: "Команда", uz: "Jamoa", en: "Team" }, icon: Users },
      { href: "/admin/after-sales", label: { ru: "Постпродажа", uz: "Sotuvdan keyin", en: "After-sales" }, icon: ShieldCheck },
    ],
  },
  {
    section: { ru: "Закупка и импорт", uz: "Xarid va import", en: "Buy & import" },
    items: [
      { href: "/admin/buying", label: { ru: "Закупочный ИИ", uz: "Xarid AI", en: "Buying Brain" }, icon: Target },
      { href: "/admin/demand", label: { ru: "Спрос", uz: "Talab", en: "Demand" }, icon: TrendingUp },
      { href: "/admin/market", label: { ru: "Рынок", uz: "Bozor tahlili", en: "Market Intel" }, icon: LineChart },
      { href: "/admin/procurement", label: { ru: "Снабжение", uz: "Ta'minot", en: "Procurement" }, icon: Truck },
      { href: "/admin/suppliers", label: { ru: "Поставщики", uz: "Yetkazib beruvchilar", en: "Suppliers" }, icon: Factory },
      { href: "/admin/supplier-intel", label: { ru: "Аналитика поставщиков", uz: "Yetkazuvchi tahlili", en: "Supplier Intel" }, icon: LineChart },
      { href: "/admin/shipments", label: { ru: "Поставки", uz: "Yetkazib berishlar", en: "Shipments" }, icon: Container },
      { href: "/admin/import-calculator", label: { ru: "Калькулятор импорта", uz: "Import kalkulyatori", en: "Import Calc" }, icon: Ship },
      { href: "/admin/pricing", label: { ru: "Ценообразование", uz: "Narxlash", en: "Pricing" }, icon: Calculator },
      { href: "/admin/aging", label: { ru: "Залежавшиеся", uz: "Eskirgan zaxira", en: "Aged Stock" }, icon: Hourglass },
    ],
  },
  {
    section: { ru: "Каталог", uz: "Katalog", en: "Catalog" },
    items: [
      { href: "/admin/cars", label: { ru: "Автомобили", uz: "Avtomobillar", en: "Cars" }, icon: Car },
      { href: "/admin/models", label: { ru: "Модели под заказ", uz: "Buyurtma modellari", en: "Pre-order Models" }, icon: Boxes },
      { href: "/admin/parts", label: { ru: "Запчасти", uz: "Ehtiyot qismlar", en: "Parts" }, icon: Wrench },
      { href: "/admin/scooters", label: { ru: "Самокаты", uz: "Skuterlar", en: "Scooters" }, icon: Bike },
    ],
  },
  {
    section: { ru: "Финансы", uz: "Moliya", en: "Money" },
    items: [
      { href: "/admin/money", label: { ru: "Деньги", uz: "Pul", en: "Money" }, icon: Banknote },
      { href: "/admin/forecast", label: { ru: "Прогноз", uz: "Prognoz", en: "Forecast" }, icon: TrendingUp },
      { href: "/admin/finance", label: { ru: "Бухгалтерия", uz: "Buxgalteriya", en: "Finance" }, icon: Receipt },
      { href: "/admin/financing", label: { ru: "Рассрочка и страховка", uz: "Bo'lib to'lash va sug'urta", en: "Financing & Insurance" }, icon: Landmark },
      { href: "/admin/ledger", label: { ru: "Книга учёта", uz: "Hisob kitobi", en: "Ledger" }, icon: Wallet },
    ],
  },
  {
    section: { ru: "Маркетинг", uz: "Marketing", en: "Marketing" },
    items: [
      { href: "/admin/marketing", label: { ru: "Контент-студия", uz: "Kontent studiya", en: "Content Studio" }, icon: Megaphone },
      { href: "/admin/automation", label: { ru: "Автоматизация", uz: "Avtomatlashtirish", en: "Automation" }, icon: Workflow },
      { href: "/admin/referrals", label: { ru: "Рефералы", uz: "Tavsiyalar", en: "Referrals" }, icon: Gift },
      { href: "/admin/audiences", label: { ru: "Аудитории", uz: "Auditoriyalar", en: "Audiences" }, icon: Users2 },
      { href: "/admin/distribution", label: { ru: "Дистрибуция", uz: "Tarqatish", en: "Distribution" }, icon: Share2 },
      { href: "/admin/promotions", label: { ru: "Акции", uz: "Aksiyalar", en: "Promotions" }, icon: Tag },
      { href: "/admin/segments", label: { ru: "Кампании", uz: "Kampaniyalar", en: "Campaigns" }, icon: Send },
      { href: "/admin/broadcast", label: { ru: "Рассылка", uz: "Tarqatma", en: "Broadcast" }, icon: Megaphone },
      { href: "/admin/posts", label: { ru: "Блог", uz: "Blog", en: "Blog" }, icon: FileText },
      { href: "/admin/reviews", label: { ru: "Отзывы", uz: "Sharhlar", en: "Reviews" }, icon: Star },
      { href: "/admin/faqs", label: { ru: "FAQ", uz: "FAQ", en: "FAQ" }, icon: HelpCircle },
    ],
  },
  {
    section: { ru: "Система", uz: "Tizim", en: "System" },
    items: [
      { href: "/admin/setup", label: { ru: "Настройка", uz: "Sozlash", en: "Setup" }, icon: Cable },
      { href: "/admin/tenants", label: { ru: "Арендаторы", uz: "Ijarachilar", en: "Tenants" }, icon: Building2 },
      { href: "/admin/users", label: { ru: "Пользователи", uz: "Foydalanuvchilar", en: "Users" }, icon: Users },
      { href: "/admin/export", label: { ru: "Экспорт", uz: "Eksport", en: "Export" }, icon: FileSpreadsheet },
      { href: "/admin/audit", label: { ru: "Аудит", uz: "Audit", en: "Audit" }, icon: ScrollText },
      { href: "/admin/errors", label: { ru: "Ошибки", uz: "Xatolar", en: "Errors" }, icon: AlertTriangle },
      { href: "/admin/settings", label: { ru: "Настройки", uz: "Sozlamalar", en: "Settings" }, icon: Settings },
    ],
  },
];

const CHROME: Record<Locale, { admin: string; backToSite: string; logout: string }> = {
  ru: { admin: "Админ", backToSite: "На сайт", logout: "Выйти" },
  uz: { admin: "Admin", backToSite: "Saytga", logout: "Chiqish" },
  en: { admin: "Admin", backToSite: "Back to Site", logout: "Log out" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const c = CHROME[locale];

  useEffect(() => {
    // Close the mobile drawer on navigation — a legitimate effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-navy text-white transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          {!collapsed && (
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-lime flex items-center justify-center">
                <span className="text-navy font-black text-sm">TM</span>
              </div>
              <span className="font-bold text-white">{c.admin}</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.section.en} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-white/30">{group.section[locale]}</p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label[locale] : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-[var(--accent-tint)] text-[var(--accent)] shadow-[inset_2px_0_0_0_var(--accent)]"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{item.label[locale]}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Back to site + Logout */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <ExternalLink className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{c.backToSite}</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{c.logout}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            {/* Language switcher (RU / UZ / EN) — shared NEXT_LOCALE cookie */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs font-medium">
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "px-2.5 py-1 uppercase transition-colors",
                    locale === l ? "bg-navy text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-pressed={locale === l}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
