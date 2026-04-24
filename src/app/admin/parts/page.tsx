"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, Loader2, RefreshCw, Wrench, X, Upload, FileDown, FileUp, CloudDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PART_CATEGORIES } from "@/lib/schemas/part";
import type { Part, PartCategory } from "@/types/part";

const emptyPart = (): Partial<Part> => ({
  slug: "",
  name_ru: "",
  name_uz: "",
  name_en: "",
  oem_number: "",
  category: "other",
  brand: "",
  price_usd: 0,
  wholesale_price_usd: null,
  min_order_qty: 1,
  stock_qty: 0,
  images: [],
  is_published: false,
  fits_brands: [],
  fits_models: [],
  fits_year_from: null,
  fits_year_to: null,
  order_position: 0,
});

export default function AdminPartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editing, setEditing] = useState<Partial<Part> | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; slug?: string; message: string }>;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchParts = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/parts")
      .then((r) => r.json())
      .then((d) => {
        setParts(d.parts || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const handleMirror = async () => {
    if (!confirm("Download all external image URLs and rehost on this site? This may take a minute.")) {
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/parts/mirror-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback("error", data.error || "Mirror failed");
        return;
      }
      const { scanned = 0, mirrored = 0, unchanged = 0, errors = [] } = data;
      showFeedback(
        errors.length > 0 ? "error" : "success",
        `Scanned ${scanned} images — mirrored ${mirrored}, already hosted ${unchanged}, failed ${errors.length}`,
      );
      fetchParts();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Mirror failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async (file: File, dry = false) => {
    setImporting(true);
    setImportReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/admin/parts/import${dry ? "?dry=true" : ""}`,
        { method: "POST", body: form },
      );
      const data = await res.json();
      if (!res.ok) {
        showFeedback("error", data.error || "Import failed");
        return;
      }
      setImportReport(data);
      const { inserted = 0, updated = 0, skipped = 0 } = data;
      const prefix = dry ? "Preview: would" : "Imported";
      showFeedback(
        skipped > 0 ? "error" : "success",
        `${prefix} insert ${inserted}, update ${updated}, skip ${skipped}`,
      );
      if (!dry) fetchParts();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const filtered = parts.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name_ru.toLowerCase().includes(q) ||
      (p.oem_number?.toLowerCase().includes(q) ?? false) ||
      (p.brand?.toLowerCase().includes(q) ?? false)
    );
  });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const url = isNew ? "/api/admin/parts" : `/api/admin/parts/${editing.id}`;
    const method = isNew ? "POST" : "PUT";
    const { id: _ignored, created_at: _c, updated_at: _u, ...payload } = editing as Part;
    void _ignored; void _c; void _u;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      showFeedback("error", body.error || "Save failed");
      return;
    }
    showFeedback("success", isNew ? "Part created" : "Part updated");
    setEditing(null);
    fetchParts();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this part?")) return;
    const res = await fetch(`/api/admin/parts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setParts((prev) => prev.filter((p) => p.id !== id));
      showFeedback("success", "Part deleted");
    } else {
      showFeedback("error", "Delete failed");
    }
  };

  const togglePublish = async (part: Part) => {
    const res = await fetch(`/api/admin/parts/${part.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !part.is_published }),
    });
    if (res.ok) {
      setParts((prev) => prev.map((p) => (p.id === part.id ? { ...p, is_published: !p.is_published } : p)));
    } else {
      showFeedback("error", "Failed to toggle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Parts Catalog</h1>
          <p className="text-muted-foreground text-sm">Manage spare parts inventory.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchParts} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/api/admin/parts/template";
            }}
            title="Download CSV template"
          >
            <FileDown className="w-4 h-4 mr-1" /> Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/api/admin/parts/export";
            }}
            title="Download the full catalog as CSV (round-trip for editing)"
          >
            <FileDown className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMirror}
            disabled={importing}
            title="Download external image URLs and rehost on this site"
          >
            <CloudDownload className="w-4 h-4 mr-1" /> Mirror Images
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file, true);
                e.target.value = "";
              }}
            />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium cursor-pointer hover:bg-accent",
                importing && "opacity-60 cursor-not-allowed",
              )}
              title="Validate CSV without writing to DB"
            >
              <FileUp className="w-4 h-4" /> Preview CSV
            </span>
          </label>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file, false);
                e.target.value = "";
              }}
            />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 h-8 text-sm font-medium cursor-pointer hover:opacity-90",
                importing && "opacity-60 cursor-not-allowed",
              )}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileUp className="w-4 h-4" />
              )}
              Import CSV
            </span>
          </label>
          <Button size="sm" onClick={() => setEditing(emptyPart())}>
            <Plus className="w-4 h-4 mr-1" /> Add Part
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            "px-4 py-3 rounded-lg text-sm",
            feedback.type === "success"
              ? "bg-green-500/10 text-green-500 border border-green-500/30"
              : "bg-red-500/10 text-red-500 border border-red-500/30",
          )}
        >
          {feedback.message}
        </div>
      )}

      {importReport && importReport.errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-amber-500">
              {importReport.errors.length} row{importReport.errors.length === 1 ? "" : "s"} skipped
            </p>
            <button
              type="button"
              onClick={() => setImportReport(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="max-h-48 overflow-auto space-y-1 text-xs text-muted-foreground">
            {importReport.errors.slice(0, 50).map((err, idx) => (
              <li key={idx}>
                <span className="font-mono text-amber-500/80">row {err.row}</span>
                {err.slug ? <span className="text-muted-foreground"> ({err.slug})</span> : null}
                : {err.message}
              </li>
            ))}
            {importReport.errors.length > 50 && (
              <li className="italic">…and {importReport.errors.length - 50} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, OEM, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
        >
          <option value="">All categories</option>
          {PART_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading parts...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No parts yet. Click “Add Part” to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name_ru} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Wrench className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={p.is_published ? "success" : "secondary"}>
                    {p.is_published ? "Live" : "Draft"}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.name_ru}</p>
                    {p.oem_number && (
                      <p className="text-xs text-muted-foreground font-mono truncate">OEM: {p.oem_number}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {p.price_usd ? `$${p.price_usd}` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{p.category}</Badge>
                  {p.brand && <span className="truncate">{p.brand}</span>}
                  <span className="ml-auto">Stock: {p.stock_qty}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(p)}>
                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => togglePublish(p)}>
                    {p.is_published ? "Unpub" : "Publish"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <PartFormModal
          part={editing}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

function PartFormModal({
  part,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  part: Partial<Part>;
  onChange: (p: Partial<Part>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const setField = <K extends keyof Part>(key: K, value: Part[K] | null) => {
    onChange({ ...part, [key]: value });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "part-images");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const body = await res.json();
      if (res.ok && body.url) {
        onChange({ ...part, images: [...(part.images || []), body.url] });
      } else {
        alert(body.error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    onChange({ ...part, images: (part.images || []).filter((u) => u !== url) });
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
          <h2 className="text-lg font-bold">{part.id ? "Edit Part" : "New Part"}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium block mb-1">Name (RU) *</span>
              <Input
                value={part.name_ru || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({ ...part, name_ru: v, slug: part.slug || slugify(v) });
                }}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Slug *</span>
              <Input
                value={part.slug || ""}
                onChange={(e) => setField("slug", slugify(e.target.value))}
                placeholder="kebab-case"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Name (UZ)</span>
              <Input value={part.name_uz || ""} onChange={(e) => setField("name_uz", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Name (EN)</span>
              <Input value={part.name_en || ""} onChange={(e) => setField("name_en", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">OEM Number</span>
              <Input
                value={part.oem_number || ""}
                onChange={(e) => setField("oem_number", e.target.value)}
                placeholder="e.g. 1234-ABC"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Part Brand</span>
              <Input
                value={part.brand || ""}
                onChange={(e) => setField("brand", e.target.value)}
                placeholder="Bosch, Denso, OEM..."
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Category *</span>
              <select
                value={part.category || "other"}
                onChange={(e) => setField("category", e.target.value as PartCategory)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm capitalize"
              >
                {PART_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Stock Qty</span>
              <Input
                type="number"
                min={0}
                value={part.stock_qty ?? 0}
                onChange={(e) => setField("stock_qty", Math.max(0, parseInt(e.target.value) || 0))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Price (USD)</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={part.price_usd ?? 0}
                onChange={(e) => setField("price_usd", parseFloat(e.target.value) || 0)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Original Price (USD)</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={part.original_price_usd ?? ""}
                onChange={(e) => setField("original_price_usd", e.target.value ? parseFloat(e.target.value) : null)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Wholesale Price (USD)</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={part.wholesale_price_usd ?? ""}
                onChange={(e) => setField("wholesale_price_usd", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Shown to bulk buyers"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Min Order Qty (wholesale)</span>
              <Input
                type="number"
                min={1}
                value={part.min_order_qty ?? 1}
                onChange={(e) => setField("min_order_qty", Math.max(1, parseInt(e.target.value) || 1))}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium block mb-1">Description (RU)</span>
            <textarea
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm min-h-[80px]"
              value={part.description_ru || ""}
              onChange={(e) => setField("description_ru", e.target.value)}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block sm:col-span-3">
              <span className="text-xs font-medium block mb-1">Fits Brands (comma-separated)</span>
              <Input
                value={(part.fits_brands || []).join(", ")}
                onChange={(e) =>
                  setField(
                    "fits_brands",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="BYD, Chery, Haval"
              />
            </label>
            <label className="block sm:col-span-3">
              <span className="text-xs font-medium block mb-1">Fits Models (comma-separated)</span>
              <Input
                value={(part.fits_models || []).join(", ")}
                onChange={(e) =>
                  setField(
                    "fits_models",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="Song Plus, Tiggo 8 Pro"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Year from</span>
              <Input
                type="number"
                min={1990}
                max={2050}
                value={part.fits_year_from ?? ""}
                onChange={(e) => setField("fits_year_from", e.target.value ? parseInt(e.target.value) : null)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Year to</span>
              <Input
                type="number"
                min={1990}
                max={2050}
                value={part.fits_year_to ?? ""}
                onChange={(e) => setField("fits_year_to", e.target.value ? parseInt(e.target.value) : null)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Order Pos</span>
              <Input
                type="number"
                min={0}
                value={part.order_position ?? 0}
                onChange={(e) => setField("order_position", parseInt(e.target.value) || 0)}
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-medium block mb-2">Images</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(part.images || []).map((url) => (
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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!part.is_published}
              onChange={(e) => setField("is_published", e.target.checked)}
            />
            <span className="text-sm">Published</span>
          </label>
        </div>
        <div className="p-5 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !part.name_ru || !part.slug}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
