"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Car, MessageSquare, Star, HelpCircle,
  Settings, ChevronLeft, Menu, LogOut, BarChart3, ExternalLink, Users, FileText, Wrench, Package, ScrollText, Boxes, Columns3, Calculator, TrendingUp, Wallet, Truck, Activity, LineChart, Megaphone, AlertTriangle, Ship, Banknote, Bot, Contact, ListChecks, Send, Target, Container, Receipt, Gauge, Tag, ShieldCheck, FileSpreadsheet, Hourglass, Sparkles, Cable, Share2, Bike, Factory, Phone, Landmark, Building2, Workflow
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    section: "Overview",
    items: [
      { href: "/admin/command", label: "Command", icon: Gauge },
      { href: "/admin/copilot", label: "Copilot", icon: Bot },
      { href: "/admin/operator", label: "AI Operator", icon: Sparkles },
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/autopilot", label: "Autopilot", icon: Activity },
      { href: "/admin/autopilot/settings", label: "Autopilot Rules", icon: Bot },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Sell",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Contact },
      { href: "/admin/conversations", label: "AI Sales", icon: Bot },
      { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
      { href: "/admin/calls", label: "Calls", icon: Phone },
      { href: "/admin/pipeline", label: "Pipeline", icon: Columns3 },
      { href: "/admin/tasks", label: "Tasks", icon: ListChecks },
      { href: "/admin/orders", label: "Orders", icon: Package },
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/after-sales", label: "After-sales", icon: ShieldCheck },
    ],
  },
  {
    section: "Buy & import",
    items: [
      { href: "/admin/buying", label: "Buying Brain", icon: Target },
      { href: "/admin/demand", label: "Demand", icon: TrendingUp },
      { href: "/admin/market", label: "Market Intel", icon: LineChart },
      { href: "/admin/procurement", label: "Procurement", icon: Truck },
      { href: "/admin/suppliers", label: "Suppliers", icon: Factory },
      { href: "/admin/supplier-intel", label: "Supplier Intel", icon: LineChart },
      { href: "/admin/shipments", label: "Shipments", icon: Container },
      { href: "/admin/import-calculator", label: "Import Calc", icon: Ship },
      { href: "/admin/pricing", label: "Pricing", icon: Calculator },
      { href: "/admin/aging", label: "Aged Stock", icon: Hourglass },
    ],
  },
  {
    section: "Catalog",
    items: [
      { href: "/admin/cars", label: "Cars", icon: Car },
      { href: "/admin/models", label: "Pre-order Models", icon: Boxes },
      { href: "/admin/parts", label: "Parts", icon: Wrench },
      { href: "/admin/scooters", label: "Scooters", icon: Bike },
    ],
  },
  {
    section: "Money",
    items: [
      { href: "/admin/money", label: "Money", icon: Banknote },
      { href: "/admin/forecast", label: "Forecast", icon: TrendingUp },
      { href: "/admin/finance", label: "Finance", icon: Receipt },
      { href: "/admin/financing", label: "Financing & Insurance", icon: Landmark },
      { href: "/admin/ledger", label: "Ledger", icon: Wallet },
    ],
  },
  {
    section: "Marketing",
    items: [
      { href: "/admin/marketing", label: "Content Studio", icon: Megaphone },
      { href: "/admin/automation", label: "Automation", icon: Workflow },
      { href: "/admin/distribution", label: "Distribution", icon: Share2 },
      { href: "/admin/promotions", label: "Promotions", icon: Tag },
      { href: "/admin/segments", label: "Campaigns", icon: Send },
      { href: "/admin/broadcast", label: "Broadcast", icon: Megaphone },
      { href: "/admin/posts", label: "Blog", icon: FileText },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/admin/setup", label: "Setup", icon: Cable },
      { href: "/admin/tenants", label: "Tenants", icon: Building2 },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/export", label: "Export", icon: FileSpreadsheet },
      { href: "/admin/audit", label: "Audit", icon: ScrollText },
      { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
              <span className="font-bold text-white">Admin</span>
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
            <div key={group.section} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-white/30">{group.section}</p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-[var(--accent-tint)] text-[var(--accent)] shadow-[inset_2px_0_0_0_var(--accent)]"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
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
            {!collapsed && <span>Back to Site</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Log out</span>}
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
