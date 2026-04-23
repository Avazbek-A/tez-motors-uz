"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { NAV_LINKS } from "@/lib/constants";
import { useSiteSettings } from "@/lib/site-settings-context";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { SocialLinks } from "@/components/shared/social-links";
import { SearchAutocomplete } from "@/components/shared/search-autocomplete";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { locale, dictionary } = useLocale();
  const settings = useSiteSettings();

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
            ? "bg-[#0a0a0f]/90 backdrop-blur-xl shadow-[0_1px_20px_rgba(0,212,255,0.08)] border-b border-neon-blue/10"
            : "bg-transparent"
        )}
      >
        {/* Neon bottom line */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-[1px] transition-opacity duration-300",
            isScrolled ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), rgba(139,92,246,0.5), transparent)",
          }}
        />

        <div className="container-custom">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-shadow">
                <span className="text-[#0a0a0f] font-black text-lg">TM</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-xl tracking-tight text-white group-hover:text-neon-blue transition-colors">
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
                    "relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    pathname === link.href
                      ? "text-neon-blue bg-neon-blue/10"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  {link.label[locale]}
                  {pathname === link.href && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-neon-blue rounded-full" />
                  )}
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
                href={`tel:${settings.phoneRaw}`}
                className="hidden md:flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-neon-blue transition-colors"
              >
                <Phone className="w-4 h-4" />
                {settings.phone}
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
                className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-16 left-0 right-0 bg-[#0d0d15] border-b border-neon-blue/10 shadow-[0_10px_40px_rgba(0,212,255,0.05)] animate-fade-in">
            <nav className="container-custom py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-3 rounded-xl text-base font-medium transition-all",
                    pathname === link.href
                      ? "bg-neon-blue/10 text-neon-blue"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  {link.label[locale]}
                </Link>
              ))}
              <div className="border-t border-white/10 mt-2 pt-3 flex flex-col gap-3">
                <a
                  href={`tel:${settings.phoneRaw}`}
                  className="flex items-center gap-2 px-4 py-2 text-white font-semibold"
                >
                  <Phone className="w-5 h-5 text-neon-blue" />
                  {settings.phone}
                </a>
                <div className="px-4">
                  <SocialLinks isScrolled={false} />
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
