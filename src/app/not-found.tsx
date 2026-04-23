import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Home, Search, Car } from "lucide-react";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedPath } from "@/lib/locale-path";

export default async function NotFound() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-lg mx-auto">
        {/* Big 404 */}
        <div className="relative mb-8">
          <p className="text-[120px] font-black leading-none text-white/[0.04] select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <Car className="w-10 h-10 text-white/30" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          Страница не найдена
        </h1>
        <p className="text-white/50 text-sm mb-10 leading-relaxed">
          Возможно, автомобиль уже продан или ссылка устарела.
          <br />
          Посмотрите актуальный каталог — там много интересного.
        </p>

        {/* Quick links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link
            href={localizedPath(locale, "/")}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm font-medium transition-colors border border-white/[0.08]"
          >
            <Home className="w-4 h-4" />
            На главную
          </Link>
          <Link
            href={localizedPath(locale, "/catalog")}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm font-medium transition-colors border border-cyan-500/20"
          >
            <Search className="w-4 h-4" />
            Смотреть каталог
          </Link>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/40">
          {[
            { href: "/catalog", label: "Каталог" },
            { href: "/compare", label: "Сравнение" },
            { href: "/reviews", label: "Отзывы" },
            { href: "/contacts", label: "Контакты" },
          ].map((link) => (
            <Link
              key={link.href}
              href={localizedPath(locale, link.href)}
              className="py-2 px-3 rounded-lg hover:bg-white/[0.04] hover:text-white/60 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
