"use client";

import { useEffect, useState } from "react";
import { Bike, Plus, Pencil, Trash2, Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Scooter } from "@/types/scooter";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110);

type Form = Partial<Scooter> & { brand: string; model: string };
const EMPTY: Form = { kind: "escooter", brand: "", model: "", price_usd: null, images: [], stock_qty: 0, is_published: false };

export default function AdminScootersPage() {
  const [list, setList] = useState<Scooter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/scooters");
    const data = await res.json();
    setList(data.scooters || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

  const save = async () => {
    if (!editing) return;
    setSaving(true); setErr(null);
    const isEdit = !!editing.id;
    const slug = editing.slug || slugify(`${editing.brand}-${editing.model}`);
    const payload = {
      slug, kind: editing.kind || "escooter", brand: editing.brand, model: editing.model,
      description_ru: editing.description_ru || null,
      price_usd: num(editing.price_usd), original_price_usd: num(editing.original_price_usd), price_uzs: num(editing.price_uzs),
      motor_power_w: num(editing.motor_power_w), battery_wh: num(editing.battery_wh), range_km: num(editing.range_km),
      top_speed_kmh: num(editing.top_speed_kmh), max_load_kg: num(editing.max_load_kg), weight_kg: num(editing.weight_kg),
      wheel_size_inch: num(editing.wheel_size_inch), foldable: editing.foldable ?? null, color: editing.color || null,
      images: editing.images || [], stock_qty: num(editing.stock_qty) ?? 0, is_published: editing.is_published ?? false,
    };
    const res = await fetch(isEdit ? `/api/admin/scooters/${editing.id}` : "/api/admin/scooters", {
      method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { setEditing(null); load(); } else setErr(data.error || "Save failed");
  };

  const del = async (id: string) => {
    if (!confirm("Delete this scooter?")) return;
    await fetch(`/api/admin/scooters/${id}`, { method: "DELETE" });
    load();
  };

  const upload = async (files: FileList | null) => {
    if (!files || !editing) return;
    setUploading((c) => c + files.length);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      try {
        const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (d.url) urls.push(d.url);
      } finally { setUploading((c) => c - 1); }
    }
    if (urls.length) setEditing((e) => (e ? { ...e, images: [...(e.images || []), ...urls] } : e));
  };

  const field = (label: string, key: keyof Form, type = "text") => (
    <div>
      <label className="text-xs font-medium mb-1 block text-muted-foreground">{label}</label>
      <Input type={type} value={(editing?.[key] as string | number) ?? ""} onChange={(e) => setEditing((s) => (s ? { ...s, [key]: e.target.value } : s))} />
    </div>
  );

  return (
    <div className="p-1">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><Bike className="w-5 h-5 text-[var(--accent)]" /><h1 className="text-lg font-semibold">Самокаты и e-bike</h1></div>
        <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="w-4 h-4" /> Добавить</Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="w-16 h-12 bg-[var(--bg-0)] rounded overflow-hidden flex items-center justify-center shrink-0">
                {s.images?.[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.images[0]} alt="" className="w-full h-full object-cover" /> : <Bike className="w-5 h-5 text-muted-foreground/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.brand} {s.model}</p>
                <p className="text-xs text-muted-foreground">{s.kind === "ebike" ? "E-bike" : "Самокат"} · {s.price_usd ? `$${s.price_usd}` : "—"} · {s.motor_power_w ? `${s.motor_power_w}W` : ""} {s.range_km ? `· ${s.range_km}km` : ""}</p>
              </div>
              <Badge variant={s.is_published ? "default" : "secondary"}>{s.is_published ? "Опубликован" : "Черновик"}</Badge>
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...s })}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="destructive" onClick={() => del(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          {!list.length && <p className="text-muted-foreground text-sm">Пока нет позиций. Нажмите «Добавить».</p>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditing(null)} />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-semibold">{editing.id ? "Редактировать" : "Новый"} самокат / e-bike</h2><button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Тип</label>
                <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as Scooter["kind"] })} className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="escooter">Самокат</option>
                  <option value="ebike">Электровелосипед</option>
                </select>
              </div>
              {field("Бренд", "brand")}
              {field("Модель", "model")}
              {field("Цена USD", "price_usd", "number")}
              {field("Старая цена USD", "original_price_usd", "number")}
              {field("Мотор (W)", "motor_power_w", "number")}
              {field("Батарея (Wh)", "battery_wh", "number")}
              {field("Запас хода (km)", "range_km", "number")}
              {field("Скорость (km/h)", "top_speed_kmh", "number")}
              {field("Нагрузка (kg)", "max_load_kg", "number")}
              {field("Вес (kg)", "weight_kg", "number")}
              {field("Колёса (\")", "wheel_size_inch", "number")}
              {field("Цвет", "color")}
              {field("На складе (шт)", "stock_qty", "number")}
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">Описание (RU)</label>
              <textarea value={editing.description_ru ?? ""} onChange={(e) => setEditing({ ...editing, description_ru: e.target.value })} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.foldable} onChange={(e) => setEditing({ ...editing, foldable: e.target.checked })} /> Складной</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> Опубликован</label>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">Фото</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(editing.images || []).map((u, i) => (
                  <div key={u} className="relative w-16 h-12 rounded overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setEditing({ ...editing, images: (editing.images || []).filter((_, j) => j !== i) })} className="absolute top-0 right-0 bg-black/70 p-0.5"><X className="w-3 h-3 text-white" /></button>
                  </div>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded border border-border px-3 py-1.5 hover:bg-muted">
                <Upload className="w-4 h-4" /> {uploading > 0 ? `Загрузка… (${uploading})` : "Добавить фото"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
              </label>
            </div>
            {err && <p className="text-sm text-[var(--danger,#e11)]">{err}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setEditing(null)}>Отмена</Button>
              <Button onClick={save} disabled={saving || !editing.brand || !editing.model}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
