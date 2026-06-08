"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string; subtitle: string; email: string; password: string;
  passwordPlaceholder: string; signIn: string; incorrect: string; network: string;
}> = {
  ru: { title: "Админ-панель", subtitle: "Администрирование Tez Motors", email: "Эл. почта", password: "Пароль", passwordPlaceholder: "Введите пароль администратора", signIn: "Войти", incorrect: "Неверный пароль", network: "Ошибка сети" },
  uz: { title: "Admin-panel", subtitle: "Tez Motors boshqaruvi", email: "Email", password: "Parol", passwordPlaceholder: "Administrator parolini kiriting", signIn: "Kirish", incorrect: "Parol noto'g'ri", network: "Tarmoq xatosi" },
  en: { title: "Admin Panel", subtitle: "Tez Motors Administration", email: "Email", password: "Password", passwordPlaceholder: "Enter admin password", signIn: "Sign In", incorrect: "Incorrect password", network: "Network error" },
};

/**
 * Restrict the post-login redirect to SAME-ORIGIN relative paths. A phishing
 * link like /admin/login?redirect=https://attacker.com/ would otherwise let an
 * attacker bounce a freshly-logged-in admin to a clone of the login page
 * ("session expired, please re-enter…") to capture creds. Accept only paths
 * that start with a single "/" and don't contain "://" (catches "//host/...",
 * "https:..." and similar). The fallback /admin is always safe.
 */
function safeRedirect(raw: string | null): string {
  const FALLBACK = "/admin";
  if (!raw) return FALLBACK;
  if (raw.length > 500) return FALLBACK;
  if (!raw.startsWith("/")) return FALLBACK; // not relative
  if (raw.startsWith("//")) return FALLBACK; // protocol-relative
  if (raw.startsWith("/\\")) return FALLBACK; // backslash trick
  if (/[:\\]/.test(raw)) return FALLBACK; // any scheme indicator
  if (!raw.startsWith("/admin")) return FALLBACK; // keep within admin tree
  return raw;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const { locale } = useLocale();
  const t = COPY[locale];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push(redirect);
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t.incorrect);
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-navy to-navy-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-lime flex items-center justify-center mx-auto mb-4">
            <span className="text-navy font-black text-2xl">TM</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-white/50 text-sm mt-1">{t.subtitle}</p>
        </div>

        <form onSubmit={handleLogin} className="glass rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-sm font-medium text-white/70 mb-2 block">
              {t.email}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@tezmotors.uz"
              autoComplete="username"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:ring-lime mb-4"
            />
            <label className="text-sm font-medium text-white/70 mb-2 block">
              {t.password}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                required
                autoComplete="current-password"
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:ring-lime"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t.signIn
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
