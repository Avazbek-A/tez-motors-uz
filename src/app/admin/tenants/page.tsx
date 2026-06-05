"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  primary_host: string | null;
  status: string;
  created_at: string;
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [defaultId, setDefaultId] = useState("");
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants");
      const data = await res.json();
      setTenants(data.tenants || []);
      setEnabled(!!data.enabled);
      setDefaultId(data.defaultId || "");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug.trim().toLowerCase(), name: name.trim(), primary_host: host.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to create tenant");
        return;
      }
      setSlug("");
      setName("");
      setHost("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setTenants((t) => t.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">Tenants</h1>
      </div>

      <div className={`rounded-lg border p-3 text-sm ${enabled ? "border-lime/40 bg-lime/10" : "border-white/10 bg-white/5 text-white/60"}`}>
        Multi-tenant mode is <strong>{enabled ? "ON" : "OFF"}</strong>.{" "}
        {enabled
          ? "Requests resolve to a tenant by subdomain; storefront reads are scoped."
          : "Single-dealer mode — every request resolves to the default tenant and storefront scoping is a no-op. Provision tenants here; turn the flag on only after the data plane is fully scoped (see docs/MULTI_TENANT.md)."}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (subdomain)" className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dealer name" className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="primary host (optional)" className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <button onClick={create} disabled={saving || slug.trim().length < 2 || name.trim().length < 1} className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy disabled:opacity-50">
          <Plus className="h-4 w-4" /> Add tenant
        </button>
        {err && <span className="text-sm text-red-400">{err}</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr><th className="px-3 py-2">Slug</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Host</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const isDefault = t.id === defaultId;
                return (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono">{t.slug}{isDefault && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">default</span>}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2 text-white/60">{t.primary_host || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={t.status === "active" ? "text-lime" : "text-red-400"}>{t.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isDefault && (
                        <button onClick={() => setStatus(t.id, t.status === "active" ? "suspended" : "active")} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">
                          {t.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
