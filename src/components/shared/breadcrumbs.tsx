"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { locale } = useLocale();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-white/60 mb-6">
      <Link href={localizedPath(locale, "/")} className="hover:text-neon-blue transition-colors flex items-center gap-1">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5" />
          {item.href ? (
            <Link href={localizedPath(locale, item.href)} className="hover:text-neon-blue transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-neon-blue font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
