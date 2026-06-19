"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Softphone } from "@/components/admin/softphone";

export default function SoftphonePage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/calls" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" />
        Назад
      </Link>
      <h1 className="text-2xl font-semibold text-foreground mb-1">Софтфон</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Звонки через собственную АТС (Asterisk на VPS) прямо из браузера — набор, приём входящих,
        отключение микрофона. Исходящие проходят разрешённый список направлений (только Узбекистан),
        а каждый звонок записывается и анализируется в CRM. Работает после запуска АТС.
      </p>
      <Softphone />
    </div>
  );
}
