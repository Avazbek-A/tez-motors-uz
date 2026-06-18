"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { NAV_LINKS } from "@/lib/constants";
import { useSiteSettings } from "@/lib/site-settings-context";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { TezLogo } from "./tez-logo";
import { SocialLinks } from "@/components/shared/social-links";
import { SearchAutocomplete } from "@/components/shared/search-autocomplete";
import { localizedPath } from "@/lib/locale-path";
import { ThemeToggle } from "@/components/theme-toggle";

// The desktop bar only has room for ~6 inline links. The logo already links home,
// and the secondary pages collapse into an "Ещё" dropdown so the 10-item nav never
// overflows / overlaps the logo and right-side controls.
const DESKTOP_HIDE = new Set(["/"]); // home → handled by the logo
const DESKTOP_MORE = new Set(["/about", "/blog", "/contacts"]);
const MORE_LABEL: Record<string, string> = { ru: "Ещё", uz: "Yana", en: "More" };

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { locale, dictionary } = useLocale();
  const settings = useSiteSettings();

  // Split the nav for the desktop bar (mobile menu still shows everything).
  const primaryLinks = NAV_LINKS.filter((l) => !DESKTOP_HIDE.has(l.href) && !DESKTOP_MORE.has(l.href));
  const moreLinks = NAV_LINKS.filter((l) => DESKTOP_MORE.has(l.href));
  const moreActive = moreLinks.some((l) => l.href === pathname);

  // The homepage hero is an always-dark band. While the header is transparent over
  // it (top of the homepage, not scrolled), scope the header to `dark` so its
  // text/controls stay light on the dark hero — in BOTH themes. Once scrolled (the
  // header gets a solid bg) or on any other page, it follows the active theme.
  const isHome = pathname === `/${locale}` || pathname === "/";
  const overHero = isHome && !isScrolled;

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
          overHero && "dark",
          isScrolled
            ? "bg-background/80 backdrop-blur-lg border-b border-border shadow-sm"
            : "bg-transparent"
        )}
      >
        {/* Header gets its own wider container (the site's container-custom caps at
            1280px, which is too narrow for a full nav + controls). */}
        <div className="mx-auto w-full max-w-[1600px] px-6 lg:px-10">
          <div className="flex items-center justify-between gap-6 h-16 lg:h-24">
            {/* Logo — the "Vanguard" chevron + wordmark (smaller on phones so it fits) */}
            <TezLogo href={localizedPath(locale, "/")} />

            {/* Desktop Nav — shown at xl+ (below that → hamburger). Primary links
                inline; secondary pages live in the "Ещё" dropdown so nothing wraps. */}
            <nav className="hidden xl:flex items-center gap-5 2xl:gap-7 min-w-0">
              {primaryLinks.map((link) => (
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

              {/* "Ещё" overflow dropdown (hover / keyboard focus) */}
              {moreLinks.length > 0 && (
                <div className="relative group">
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 py-1 text-xs font-semibold tracking-[0.1em] uppercase whitespace-nowrap transition-colors duration-300",
                      moreActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-haspopup="true"
                  >
                    {MORE_LABEL[locale] ?? MORE_LABEL.en}
                    <ChevronDown className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-180" />
                  </button>
                  <div className="invisible absolute right-0 top-full pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div className="min-w-[190px] rounded-md border border-border bg-background/95 backdrop-blur-lg shadow-lg py-2">
                      {moreLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={localizedPath(locale, link.href)}
                          className={cn(
                            "block px-4 py-2.5 text-xs font-semibold tracking-[0.1em] uppercase transition-colors",
                            pathname === link.href ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                          )}
                        >
                          {link.label[locale]}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Inline search needs ~200px — only show it once the full nav has
                  comfortable room (2xl). Below that it lives in the mobile menu. */}
              <div className="hidden 2xl:block w-40">
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
                className="xl:hidden p-2 -mr-2 text-foreground hover:opacity-70 transition-opacity"
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
