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
import { localizedPath } from "@/lib/locale-path";
import { ThemeToggle } from "@/components/theme-toggle";

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
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          isScrolled
            ? "bg-background/80 backdrop-blur-lg border-b border-border shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="container-custom">
          <div className="flex items-center justify-between h-16 lg:h-24">
            {/* Logo */}
            <Link href={localizedPath(locale, "/")} className="flex items-center gap-3 shrink-0 group">
              <div className="w-10 h-10 border border-[var(--accent)] text-[var(--accent)] flex items-center justify-center rounded-none transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]">
                <span className="font-bold text-base tracking-tight">TM</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-semibold text-xl tracking-[0.16em] uppercase transition-colors">
                  Tez Motors
                </span>
              </div>
            </Link>

            {/* Desktop Nav — only when there's room (xl+); 10 links overflow on a
                normal laptop at lg, so below xl we fall back to the hamburger. */}
            <nav className="hidden xl:flex items-center gap-4 2xl:gap-6 min-w-0">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={localizedPath(locale, link.href)}
                  className={cn(
                    "relative py-1 text-xs font-semibold tracking-[0.1em] uppercase whitespace-nowrap transition-colors duration-300 after:absolute after:left-0 after:-bottom-0.5 after:h-px after:bg-[var(--accent)] after:transition-all after:duration-300",
                    pathname === link.href
                      ? "text-foreground after:w-4"
                      : "text-muted-foreground hover:text-foreground after:w-0 hover:after:w-4"
                  )}
                >
                  {link.label[locale]}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Inline search needs ~200px — only show it once the full nav has
                  comfortable room (2xl). Below that it lives in the mobile menu. */}
              <div className="hidden 2xl:block w-44">
                <SearchAutocomplete
                  placeholder={locale === "ru" ? "Поиск..." : "Search..."}
                />
              </div>

              <LanguageSwitcher isScrolled={isScrolled} />
              <ThemeToggle />

              <a
                href={`tel:${settings.phoneRaw}`}
                className="hidden 2xl:flex items-center gap-2 text-sm font-medium tracking-wide hover:opacity-70 transition-opacity"
              >
                <Phone className="w-4 h-4" />
                {settings.phone}
              </a>

              <Button
                variant="default"
                size="sm"
                className="hidden lg:inline-flex tracking-wide uppercase text-xs"
                asChild
              >
                <Link href={localizedPath(locale, "/contacts")}>
                  {dictionary.common.getConsultation}
                </Link>
              </Button>

              {/* Mobile / mid-width menu button (below xl, where the 10-item nav
                  doesn't fit) */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="xl:hidden p-2 -mr-2"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile / mid-width Menu Overlay (shown below xl) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 xl:hidden pt-20 bg-background/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
          <nav className="container-custom py-8 flex flex-col gap-6">
            {/* Search — inline search is deferred to 2xl, so surface it here too */}
            <div className="mb-2">
              <SearchAutocomplete placeholder={locale === "ru" ? "Поиск..." : "Search..."} />
            </div>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={localizedPath(locale, link.href)}
                className={cn(
                  "text-2xl font-medium tracking-wide uppercase",
                  pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label[locale]}
              </Link>
            ))}
            
            <div className="h-px bg-border my-4" />
            
            <a
              href={`tel:${settings.phoneRaw}`}
              className="flex items-center gap-3 text-xl font-medium"
            >
              <Phone className="w-5 h-5" />
              {settings.phone}
            </a>
            
            <div className="pt-4">
              <Button variant="default" size="lg" className="w-full tracking-wide uppercase" asChild>
                <Link href={localizedPath(locale, "/contacts")}>{dictionary.common.getConsultation}</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
