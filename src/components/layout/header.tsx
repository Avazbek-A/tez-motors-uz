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
    // Close the mobile menu on navigation — a legitimate effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={localizedPath(locale, link.href)}
                  className={cn(
                    "relative py-1 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-300 after:absolute after:left-0 after:-bottom-0.5 after:h-px after:bg-[var(--accent)] after:transition-all after:duration-300",
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
            <div className="flex items-center gap-4">
              <div className="hidden md:block w-48 xl:w-56">
                <SearchAutocomplete
                  placeholder={locale === "ru" ? "Поиск..." : "Search..."}
                />
              </div>
              
              <LanguageSwitcher isScrolled={isScrolled} />
              <ThemeToggle />

              <a
                href={`tel:${settings.phoneRaw}`}
                className="hidden md:flex items-center gap-2 text-sm font-medium tracking-wide hover:opacity-70 transition-opacity"
              >
                <Phone className="w-4 h-4" />
                {settings.phone}
              </a>

              <Button
                variant="default"
                size="sm"
                className="hidden md:inline-flex tracking-wide uppercase text-xs"
                asChild
              >
                <Link href={localizedPath(locale, "/contacts")}>
                  {dictionary.common.getConsultation}
                </Link>
              </Button>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 -mr-2"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden pt-20 bg-background/95 backdrop-blur-xl animate-in fade-in duration-300">
          <nav className="container-custom py-8 flex flex-col gap-6">
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
