"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Phone, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { NAV_LINKS, SITE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { SocialLinks } from "@/components/shared/social-links";
import { SearchAutocomplete } from "@/components/shared/search-autocomplete";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { locale, dictionary } = useLocale();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-border"
            : "bg-transparent"
        )}
      >
        <div className="container-custom">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-lime flex items-center justify-center">
                <span className="text-navy font-black text-lg">TM</span>
              </div>
              <div className="hidden sm:block">
                <span className={cn(
                  "font-bold text-xl tracking-tight transition-colors",
                  isScrolled ? "text-navy" : "text-white"
                )}>
                  Tez Motors
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    pathname === link.href
                      ? "bg-lime/20 text-lime-dark"
                      : isScrolled
                        ? "text-foreground/70 hover:text-foreground hover:bg-muted"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                >
                  {link.label[locale]}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <div className="hidden md:block w-48 xl:w-56">
                <SearchAutocomplete
                  placeholder={locale === "ru" ? "Поиск авто..." : "Search..."}
                />
              </div>
              <LanguageSwitcher isScrolled={isScrolled} />

              <a
                href={`tel:${SITE_CONFIG.phoneRaw}`}
                className={cn(
                  "hidden md:flex items-center gap-2 text-sm font-semibold transition-colors",
                  isScrolled ? "text-navy" : "text-white"
                )}
              >
                <Phone className="w-4 h-4" />
                {SITE_CONFIG.phone}
              </a>

              <div className="hidden xl:flex">
                <SocialLinks isScrolled={isScrolled} />
              </div>

              <Button
                variant="default"
                size="sm"
                className="hidden md:inline-flex"
                asChild
              >
                <Link href="/contacts">
                  {dictionary.common.getConsultation}
                </Link>
              </Button>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={cn(
                  "lg:hidden p-2 rounded-lg transition-colors",
                  isScrolled
                    ? "text-navy hover:bg-muted"
                    : "text-white hover:bg-white/10"
                )}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-16 left-0 right-0 bg-white border-b border-border shadow-xl animate-fade-in">
            <nav className="container-custom py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-3 rounded-xl text-base font-medium transition-all",
                    pathname === link.href
                      ? "bg-lime/20 text-lime-dark"
                      : "text-foreground/70 hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label[locale]}
                </Link>
              ))}
              <div className="border-t border-border mt-2 pt-3 flex flex-col gap-3">
                <a
                  href={`tel:${SITE_CONFIG.phoneRaw}`}
                  className="flex items-center gap-2 px-4 py-2 text-navy font-semibold"
                >
                  <Phone className="w-5 h-5" />
                  {SITE_CONFIG.phone}
                </a>
                <div className="px-4">
                  <SocialLinks isScrolled={true} />
                </div>
                <div className="px-4">
                  <Button variant="default" size="lg" className="w-full" asChild>
                    <Link href="/contacts">{dictionary.common.getConsultation}</Link>
                  </Button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
