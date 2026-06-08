"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Shield, User, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  refresh: string;
  masterTitle: string;
  masterBody1: string;
  masterBody2: string;
  ownerWord: string;
  createUser: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  roleOwner: string;
  roleManager: string;
  roleRep: string;
  addUser: string;
  createFailed: string;
  networkError: string;
  existingUsers: string;
  loading: string;
  noUsers: string;
  disabled: string;
}> = {
  ru: {
    title: "Администраторы",
    subtitle: "Управление доступом к панели администратора.",
    refresh: "Обновить",
    masterTitle: "Вы вошли с мастер-паролем.",
    masterBody1:
      "В целях безопасности мастер-пароль не может управлять учётными записями администраторов, когда существуют реальные пользователи. Войдите с учётной записью",
    masterBody2:
      "(email + пароль), чтобы добавлять, просматривать или изменять пользователей здесь.",
    ownerWord: "Владелец",
    createUser: "Создать пользователя",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Пароль",
    roleOwner: "Владелец",
    roleManager: "Менеджер",
    roleRep: "Представитель",
    addUser: "Добавить пользователя",
    createFailed: "Не удалось создать пользователя",
    networkError: "Ошибка сети",
    existingUsers: "Существующие пользователи",
    loading: "Загрузка...",
    noUsers: "Пока нет администраторов.",
    disabled: "Отключён",
  },
  uz: {
    title: "Administratorlar",
    subtitle: "Administrator paneliga kirish huquqini boshqarish.",
    refresh: "Yangilash",
    masterTitle: "Siz master parol bilan kirgansiz.",
    masterBody1:
      "Xavfsizlik uchun haqiqiy foydalanuvchilar mavjud bo'lganda master parol administrator hisoblarini boshqara olmaydi. Quyidagi",
    masterBody2:
      "hisobi (email + parol) bilan kiring va bu yerda foydalanuvchilarni qo'shing, ko'ring yoki o'zgartiring.",
    ownerWord: "Egasi",
    createUser: "Foydalanuvchi yaratish",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Parol",
    roleOwner: "Egasi",
    roleManager: "Menejer",
    roleRep: "Vakil",
    addUser: "Foydalanuvchi qo'shish",
    createFailed: "Foydalanuvchini yaratib bo'lmadi",
    networkError: "Tarmoq xatosi",
    existingUsers: "Mavjud foydalanuvchilar",
    loading: "Yuklanmoqda...",
    noUsers: "Hozircha administratorlar yo'q.",
    disabled: "O'chirilgan",
  },
  en: {
    title: "Admin Users",
    subtitle: "Manage login access for the admin panel.",
    refresh: "Refresh",
    masterTitle: "You're signed in with the master password.",
    masterBody1:
      "For security, the master password can't manage admin accounts once real users exist. Sign in with an",
    masterBody2:
      "account (email + password) to add, view, or change users here.",
    ownerWord: "Owner",
    createUser: "Create User",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    roleOwner: "Owner",
    roleManager: "Manager",
    roleRep: "Rep",
    addUser: "Add User",
    createFailed: "Failed to create user",
    networkError: "Network error",
    existingUsers: "Existing Users",
    loading: "Loading...",
    noUsers: "No admin users yet.",
    disabled: "Disabled",
  },
};

type AdminUser = {
  id: string;
  email: string;
  role: "owner" | "manager" | "rep";
  disabled: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("rep");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    setForbidden(false);
    fetch("/api/admin/users")
      .then(async (r) => {
        if (r.status === 403) { setForbidden(true); return { users: [] }; }
        return r.json();
      })
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const createUser = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t.createFailed);
        return;
      }
      setEmail("");
      setPassword("");
      setRole("rep");
      fetchUsers();
    } catch {
      setError(t.networkError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" onClick={fetchUsers}>
          <RefreshCw className="w-4 h-4" />
          {t.refresh}
        </Button>
      </div>

      {forbidden && !loading && (
        <Card className="border-[var(--warning)]/40">
          <CardContent className="flex items-start gap-3 py-4">
            <KeyRound className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">{t.masterTitle}</p>
              <p className="text-muted-foreground mt-1">
                {t.masterBody1}{" "}
                <span className="font-mono">{t.ownerWord}</span> {t.masterBody2}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!forbidden && (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t.createUser}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Input placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder={t.passwordPlaceholder} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminUser["role"])}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="owner">{t.roleOwner}</option>
            <option value="manager">{t.roleManager}</option>
            <option value="rep">{t.roleRep}</option>
          </select>
          <Button onClick={createUser} disabled={saving || !email || !password}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
            {t.addUser}
          </Button>
          {error && <p className="md:col-span-4 text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t.existingUsers}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">{t.loading}</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t.noUsers}</div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-sm text-muted-foreground font-mono">{new Date(user.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{user.role === "owner" ? t.roleOwner : user.role === "manager" ? t.roleManager : t.roleRep}</Badge>
                    {user.disabled && <Badge variant="destructive">{t.disabled}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
