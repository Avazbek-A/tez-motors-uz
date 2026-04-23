"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Car, MessageSquare, Star, HelpCircle,
  Settings, ChevronLeft, Menu, LogOut, BarChart3, Package, ExternalLink
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/cars", label: "Cars", icon: Car },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-lime/20 text-lime"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
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
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
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
