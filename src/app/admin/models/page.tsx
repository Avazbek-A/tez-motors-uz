"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, Loader2, RefreshCw, Boxes, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CAR_BRANDS, BODY_TYPES, FUEL_TYPES } from "@/lib/constants";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";
import type { ModelCatalog } from "@/types/model";

const COPY: Record<Locale, {
  saveFailed: string;
  modelCreated: string;
  modelUpdated: string;
  deleteConfirm: string;
  modelDeleted: string;
  deleteFailed: string;
  toggleFailed: string;
  heading: string;
  subtitle: string;
  addModel: string;
  searchPlaceholder: string;
  loading: string;
  emptyState: string;
  orderable: string;
  draft: string;
  eta: string;
  weeks: string;
  hide: string;
  publish: string;
  edit: string;
  editModel: string;
  newModel: string;
  brand: string;
  selectBrand: string;
  model: string;
  slug: string;
  year: string;
  bodyType: string;
  fuelType: string;
  basePrice: string;
  orderPos: string;
  leadTimeMin: string;
  leadTimeMax: string;
  trims: string;
  trimsPlaceholder: string;
  colors: string;
  colorsPlaceholder: string;
  descriptionRu: string;
  descriptionUz: string;
  descriptionEn: string;
  images: string;
  thumbnail: string;
  thumbnailPlaceholder: string;
  orderableCheckbox: string;
  uploadFailed: string;
  cancel: string;
  save: string;
}> = {
  ru: {
    saveFailed: "Не удалось сохранить",
    modelCreated: "Модель создана",
    modelUpdated: "Модель обновлена",
    deleteConfirm: "Удалить эту модель?",
    modelDeleted: "Модель удалена",
    deleteFailed: "Не удалось удалить",
    toggleFailed: "Не удалось переключить",
    heading: "Модели для предзаказа",
    subtitle: "Перечень конфигураций, которые клиенты могут заказать для импорта (не физический склад).",
    addModel: "Добавить модель",
    searchPlaceholder: "Поиск по бренду, модели, slug...",
    loading: "Загрузка моделей...",
    emptyState: "Пока нет моделей. Нажмите «Добавить модель», чтобы создать.",
    orderable: "Доступна для заказа",
    draft: "Черновик",
    eta: "Срок",
    weeks: "нед",
    hide: "Скрыть",
    publish: "Опубликовать",
    edit: "Редактировать",
    editModel: "Редактировать модель",
    newModel: "Новая модель",
    brand: "Бренд *",
    selectBrand: "Выберите бренд",
    model: "Модель *",
    slug: "Slug *",
    year: "Год",
    bodyType: "Тип кузова",
    fuelType: "Тип топлива",
    basePrice: "Базовая цена (USD)",
    orderPos: "Позиция",
    leadTimeMin: "Срок поставки мин. (недели)",
    leadTimeMax: "Срок поставки макс. (недели)",
    trims: "Комплектации (через запятую)",
    trimsPlaceholder: "Standard, Premium, Flagship",
    colors: "Доступные цвета (через запятую)",
    colorsPlaceholder: "Белый, Чёрный, Синий",
    descriptionRu: "Описание (RU)",
    descriptionUz: "Описание (UZ)",
    descriptionEn: "Описание (EN)",
    images: "Изображения",
    thumbnail: "URL миниатюры (необязательная замена)",
    thumbnailPlaceholder: "По умолчанию — первое изображение",
    orderableCheckbox: "Доступна для заказа (видна на /order)",
    uploadFailed: "Не удалось загрузить",
    cancel: "Отмена",
    save: "Сохранить",
  },
  uz: {
    saveFailed: "Saqlab boʻlmadi",
    modelCreated: "Model yaratildi",
    modelUpdated: "Model yangilandi",
    deleteConfirm: "Ushbu model oʻchirilsinmi?",
    modelDeleted: "Model oʻchirildi",
    deleteFailed: "Oʻchirib boʻlmadi",
    toggleFailed: "Almashtirib boʻlmadi",
    heading: "Oldindan buyurtma uchun modellar",
    subtitle: "Mijozlar import uchun buyurtma qila oladigan konfiguratsiyalar roʻyxati (jismoniy ombor emas).",
    addModel: "Model qoʻshish",
    searchPlaceholder: "Brend, model, slug boʻyicha qidirish...",
    loading: "Modellar yuklanmoqda...",
    emptyState: "Hozircha modellar yoʻq. Yaratish uchun «Model qoʻshish» tugmasini bosing.",
    orderable: "Buyurtma uchun mavjud",
    draft: "Qoralama",
    eta: "Muddat",
    weeks: "hafta",
    hide: "Yashirish",
    publish: "Eʼlon qilish",
    edit: "Tahrirlash",
    editModel: "Modelni tahrirlash",
    newModel: "Yangi model",
    brand: "Brend *",
    selectBrand: "Brendni tanlang",
    model: "Model *",
    slug: "Slug *",
    year: "Yil",
    bodyType: "Kuzov turi",
    fuelType: "Yoqilgʻi turi",
    basePrice: "Bazaviy narx (USD)",
    orderPos: "Pozitsiya",
    leadTimeMin: "Yetkazib berish muddati min. (hafta)",
    leadTimeMax: "Yetkazib berish muddati maks. (hafta)",
    trims: "Komplektatsiyalar (vergul bilan)",
    trimsPlaceholder: "Standard, Premium, Flagship",
    colors: "Mavjud ranglar (vergul bilan)",
    colorsPlaceholder: "Oq, Qora, Koʻk",
    descriptionRu: "Tavsif (RU)",
    descriptionUz: "Tavsif (UZ)",
    descriptionEn: "Tavsif (EN)",
    images: "Rasmlar",
    thumbnail: "Miniatyura URL (ixtiyoriy almashtirish)",
    thumbnailPlaceholder: "Standart — birinchi rasm",
    orderableCheckbox: "Buyurtma uchun mavjud (/order sahifasida koʻrinadi)",
    uploadFailed: "Yuklab boʻlmadi",
    cancel: "Bekor qilish",
    save: "Saqlash",
  },
  en: {
    saveFailed: "Save failed",
    modelCreated: "Model created",
    modelUpdated: "Model updated",
    deleteConfirm: "Delete this model?",
    modelDeleted: "Model deleted",
    deleteFailed: "Delete failed",
    toggleFailed: "Failed to toggle",
    heading: "Pre-order Models",
    subtitle: "The menu of configurations customers can order to import (not physical stock).",
    addModel: "Add Model",
    searchPlaceholder: "Search by brand, model, slug...",
    loading: "Loading models...",
    emptyState: "No models yet. Click “Add Model” to create one.",
    orderable: "Orderable",
    draft: "Draft",
    eta: "ETA",
    weeks: "wks",
    hide: "Hide",
    publish: "Publish",
    edit: "Edit",
    editModel: "Edit Model",
    newModel: "New Model",
    brand: "Brand *",
    selectBrand: "Select brand",
    model: "Model *",
    slug: "Slug *",
    year: "Year",
    bodyType: "Body Type",
    fuelType: "Fuel Type",
    basePrice: "Base Price (USD)",
    orderPos: "Order Pos",
    leadTimeMin: "Lead time min (weeks)",
    leadTimeMax: "Lead time max (weeks)",
    trims: "Trims (comma-separated)",
    trimsPlaceholder: "Standard, Premium, Flagship",
    colors: "Available colors (comma-separated)",
    colorsPlaceholder: "White, Black, Blue",
    descriptionRu: "Description (RU)",
    descriptionUz: "Description (UZ)",
    descriptionEn: "Description (EN)",
    images: "Images",
    thumbnail: "Thumbnail URL (optional override)",
    thumbnailPlaceholder: "Defaults to first image",
    orderableCheckbox: "Orderable (visible on /order)",
    uploadFailed: "Upload failed",
    cancel: "Cancel",
    save: "Save",
  },
};

const emptyModel = (): Partial<ModelCatalog> => ({
  slug: "",
  brand: "",
  model: "",
  trims: [],
  body_type: null,
  fuel_type: null,
  year: null,
  base_price_usd: null,
  lead_time_weeks_min: 6,
  lead_time_weeks_max: 8,
  available_colors: [],
  thumbnail: null,
  images: [],
  description_ru: "",
  description_uz: "",
  description_en: "",
  is_orderable: false,
  order_position: 0,
});

export default function AdminModelsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [models, setModels] = useState<ModelCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<ModelCatalog> | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchModels = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/models")
      .then((r) => r.json())
      .then((d) => setModels(d.models || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
    fetchModels();
  }, [fetchModels]);

  // Prefill from the demand board's "Source as pre-order" action
  // (/admin/models?brand=&model=&year=&base_price_usd=) — open the create modal
  // pre-populated so a hot car becomes an orderable model in one step.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const brand = params.get("brand");
    if (!brand) return;
    const year = params.get("year");
    const base = params.get("base_price_usd");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
    setEditing({
      ...emptyModel(),
      brand,
      model: params.get("model") || "",
      year: year ? Number(year) : null,
      base_price_usd: base ? Number(base) : null,
    });
  }, []);

  const filtered = models.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.brand.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q) ||
      m.slug.toLowerCase().includes(q)
    );
  });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const url = isNew ? "/api/admin/models" : `/api/admin/models/${editing.id}`;
    const method = isNew ? "POST" : "PUT";
    const { id: _ignored, created_at: _c, updated_at: _u, ...payload } = editing as ModelCatalog;
    void _ignored; void _c; void _u;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      showFeedback("error", body.error || t.saveFailed);
      return;
    }
    showFeedback("success", isNew ? t.modelCreated : t.modelUpdated);
    setEditing(null);
    fetchModels();
  };

  const remove = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    const res = await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
    if (res.ok) {
      setModels((prev) => prev.filter((m) => m.id !== id));
      showFeedback("success", t.modelDeleted);
    } else {
      showFeedback("error", t.deleteFailed);
    }
  };

  const toggleOrderable = async (model: ModelCatalog) => {
    const res = await fetch(`/api/admin/models/${model.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_orderable: !model.is_orderable }),
    });
    if (res.ok) {
      setModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, is_orderable: !m.is_orderable } : m)),
      );
    } else {
      showFeedback("error", t.toggleFailed);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.heading}</h1>
          <p className="text-muted-foreground text-sm">
            {t.subtitle}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchModels} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={() => setEditing(emptyModel())}>
            <Plus className="w-4 h-4 mr-1" /> {t.addModel}
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            "px-4 py-3 rounded-lg text-sm",
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20",
          )}
        >
          {feedback.message}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t.loading}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
            {t.emptyState}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {m.thumbnail || m.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnail || m.images[0]} alt={`${m.brand} ${m.model}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Boxes className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={m.is_orderable ? "success" : "secondary"}>
                    {m.is_orderable ? t.orderable : t.draft}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{m.brand} {m.model}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.year ? `${m.year} · ` : ""}{t.eta} {m.lead_time_weeks_min}–{m.lead_time_weeks_max} {t.weeks}
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-mono whitespace-nowrap">
                    {m.base_price_usd ? `$${m.base_price_usd.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {m.body_type && <Badge variant="outline" className="capitalize">{m.body_type}</Badge>}
                  {m.fuel_type && <Badge variant="outline" className="capitalize">{m.fuel_type}</Badge>}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(m)}>
                    <Edit className="w-3.5 h-3.5 mr-1" /> {t.edit}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleOrderable(m)}>
                    {m.is_orderable ? t.hide : t.publish}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(m.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ModelFormModal
          model={editing}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

function ModelFormModal({
  model,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  model: Partial<ModelCatalog>;
  onChange: (m: Partial<ModelCatalog>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [uploading, setUploading] = useState(false);

  const setField = <K extends keyof ModelCatalog>(key: K, value: ModelCatalog[K] | null) => {
    onChange({ ...model, [key]: value });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "car-images");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const body = await res.json();
      if (res.ok && body.url) {
        onChange({ ...model, images: [...(model.images || []), body.url] });
      } else {
        alert(body.error || t.uploadFailed);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    onChange({ ...model, images: (model.images || []).filter((u) => u !== url) });
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background rounded-2xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">{model.id ? t.editModel : t.newModel}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.brand}</span>
              <select
                value={model.brand || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const slug = model.slug || slugify(`${v}-${model.model || ""}`);
                  onChange({ ...model, brand: v, slug });
                }}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              >
                <option value="">{t.selectBrand}</option>
                {CAR_BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.model}</span>
              <Input
                value={model.model || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const slug = model.slug || slugify(`${model.brand || ""}-${v}`);
                  onChange({ ...model, model: v, slug });
                }}
                placeholder="Song Plus"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.slug}</span>
              <Input
                value={model.slug || ""}
                onChange={(e) => setField("slug", slugify(e.target.value))}
                placeholder="byd-song-plus"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.year}</span>
              <Input
                type="number"
                min={2000}
                max={2035}
                value={model.year ?? ""}
                onChange={(e) => setField("year", e.target.value ? parseInt(e.target.value) : null)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.bodyType}</span>
              <select
                value={model.body_type || ""}
                onChange={(e) => setField("body_type", e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm capitalize"
              >
                <option value="">—</option>
                {BODY_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label[locale]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.fuelType}</span>
              <select
                value={model.fuel_type || ""}
                onChange={(e) => setField("fuel_type", e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm capitalize"
              >
                <option value="">—</option>
                {FUEL_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label[locale]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.basePrice}</span>
              <Input
                type="number"
                min={0}
                step="100"
                value={model.base_price_usd ?? ""}
                onChange={(e) => setField("base_price_usd", e.target.value ? parseFloat(e.target.value) : null)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.orderPos}</span>
              <Input
                type="number"
                min={0}
                value={model.order_position ?? 0}
                onChange={(e) => setField("order_position", parseInt(e.target.value) || 0)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.leadTimeMin}</span>
              <Input
                type="number"
                min={1}
                max={104}
                value={model.lead_time_weeks_min ?? 6}
                onChange={(e) => setField("lead_time_weeks_min", Math.max(1, parseInt(e.target.value) || 6))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.leadTimeMax}</span>
              <Input
                type="number"
                min={1}
                max={104}
                value={model.lead_time_weeks_max ?? 8}
                onChange={(e) => setField("lead_time_weeks_max", Math.max(1, parseInt(e.target.value) || 8))}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium block mb-1">{t.trims}</span>
            <Input
              value={(model.trims || []).join(", ")}
              onChange={(e) =>
                setField("trims", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
              placeholder={t.trimsPlaceholder}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium block mb-1">{t.colors}</span>
            <Input
              value={(model.available_colors || []).join(", ")}
              onChange={(e) =>
                setField("available_colors", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
              placeholder={t.colorsPlaceholder}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium block mb-1">{t.descriptionRu}</span>
            <textarea
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm min-h-[70px]"
              value={model.description_ru || ""}
              onChange={(e) => setField("description_ru", e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.descriptionUz}</span>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm min-h-[60px]"
                value={model.description_uz || ""}
                onChange={(e) => setField("description_uz", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">{t.descriptionEn}</span>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm min-h-[60px]"
                value={model.description_en || ""}
                onChange={(e) => setField("description_en", e.target.value)}
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-medium block mb-2">{t.images}</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(model.images || []).map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <label className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50 transition">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium block mb-1">{t.thumbnail}</span>
            <Input
              value={model.thumbnail || ""}
              onChange={(e) => setField("thumbnail", e.target.value || null)}
              placeholder={t.thumbnailPlaceholder}
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!model.is_orderable}
              onChange={(e) => setField("is_orderable", e.target.checked)}
            />
            <span className="text-sm">{t.orderableCheckbox}</span>
          </label>
        </div>
        <div className="p-5 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button onClick={onSave} disabled={saving || !model.brand || !model.model || !model.slug}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
