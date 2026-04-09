"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-white/60 mb-6">
      <Link href="/" className="hover:text-neon-blue transition-colors flex items-center gap-1">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5" />
          {item.href ? (
            <Link href={item.href} className="hover:text-neon-blue transition-colors">
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
