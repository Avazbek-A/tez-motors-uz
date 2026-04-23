"use client";

import Link from "next/link";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { NAV_LINKS } from "@/lib/constants";
import { useSiteSettings } from "@/lib/site-settings-context";
import { SocialLinks } from "@/components/shared/social-links";
import { Newsletter } from "@/components/shared/newsletter";

export function Footer() {
  const { locale, dictionary } = useLocale();
  const settings = useSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-[#050508] text-white overflow-hidden">
      {/* Top neon line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), rgba(139,92,246,0.4), transparent)",
        }}
      />

      {/* Grid bg */}
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />

      <div className="container-custom py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-shadow">
                <span className="text-[#0a0a0f] font-black text-lg">TM</span>
              </div>
              <span className="font-bold text-xl text-white group-hover:text-neon-blue transition-colors">Tez Motors</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed">
              {dictionary.footer.description}
            </p>
            <SocialLinks isScrolled={false} />
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neon-blue/60 mb-4">
              {dictionary.footer.navigation}
            </h3>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/50 hover:text-neon-blue transition-colors text-sm"
                  >
                    {link.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neon-blue/60 mb-4">
              {dictionary.footer.contacts}
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href={`tel:${settings.phoneRaw}`}
                  className="flex items-center gap-3 text-white/50 hover:text-neon-blue transition-colors text-sm"
                >
                  <Phone className="w-4 h-4 shrink-0 text-neon-blue/50" />
                  {settings.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${settings.email}`}
                  className="flex items-center gap-3 text-white/50 hover:text-neon-blue transition-colors text-sm"
                >
                  <Mail className="w-4 h-4 shrink-0 text-neon-purple/50" />
                  {settings.email}
                </a>
              </li>
              <li className="flex items-start gap-3 text-white/50 text-sm">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-neon-pink/50" />
                {settings.address}
              </li>
              <li className="flex items-center gap-3 text-white/50 text-sm">
                <Clock className="w-4 h-4 shrink-0 text-neon-green/50" />
                {dictionary.footer.workingHours}
              </li>
            </ul>
          </div>

          {/* Quick Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neon-blue/60 mb-4">
              {dictionary.common.writeUs}
            </h3>
            <div className="space-y-3">
              <a
                href={settings.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/20 rounded-xl px-4 py-3 transition-all text-sm font-medium hover:shadow-[0_0_15px_rgba(34,255,136,0.15)]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
              <a
                href={settings.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue border border-neon-blue/20 rounded-xl px-4 py-3 transition-all text-sm font-medium hover:shadow-[0_0_15px_rgba(0,212,255,0.15)]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Telegram
              </a>
            </div>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-12">
          <Newsletter />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 relative">
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)",
          }}
        />
        <div className="container-custom py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/30 text-xs">
          <p>&copy; {year} Tez Motors. {dictionary.footer.rights}.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-neon-blue/60 transition-colors">
              {locale === "ru" ? "Конфиденциальность" : "Privacy"}
            </Link>
            <Link href="/terms" className="hover:text-neon-blue/60 transition-colors">
              {locale === "ru" ? "Условия" : "Terms"}
            </Link>
            <Link href="/track" className="hover:text-neon-blue/60 transition-colors">
              {locale === "ru" ? "Отслеживание" : "Track Order"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
