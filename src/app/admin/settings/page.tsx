"use client";

import { useEffect, useState } from "react";
import { Save, Globe, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Settings = {
  siteName: string;
  phone: string;
  phoneRaw: string;
  email: string;
  address: string;
  workingHours: string;
  telegram: string;
  instagram: string;
  whatsapp: string;
};

const EMPTY: Settings = {
  siteName: "", phone: "", phoneRaw: "", email: "", address: "",
  workingHours: "", telegram: "", instagram: "", whatsapp: "",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.values) setSettings({ ...EMPTY, ...data.values });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(err?.error ?? "Save failed");
      } else {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Editable site settings. Changes apply immediately after save.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Site Name" value={settings.siteName} onChange={(v) => update({ siteName: v })} />
          <Field label="Working Hours" value={settings.workingHours} onChange={(v) => update({ workingHours: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Phone (display)" value={settings.phone} onChange={(v) => update({ phone: v })} placeholder="+998 90 123 45 67" />
          <Field label="Phone (raw, for tel: links)" value={settings.phoneRaw} onChange={(v) => update({ phoneRaw: v })} placeholder="+998901234567" />
          <Field label="Email" value={settings.email} onChange={(v) => update({ email: v })} />
          <Field label="Address" value={settings.address} onChange={(v) => update({ address: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Social
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Telegram URL" value={settings.telegram} onChange={(v) => update({ telegram: v })} placeholder="https://t.me/..." />
          <Field label="Instagram URL" value={settings.instagram} onChange={(v) => update({ instagram: v })} placeholder="https://instagram.com/..." />
          <Field label="WhatsApp URL" value={settings.whatsapp} onChange={(v) => update({ whatsapp: v })} placeholder="https://wa.me/..." />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground max-w-sm">
          Telegram notification bot credentials are configured via Cloudflare Worker secrets, not here.
        </p>
        <div className="flex items-center gap-3">
          {status === "saved" && <span className="text-sm text-green-600">Saved</span>}
          {status === "error" && <span className="text-sm text-red-600">{errorMsg ?? "Error"}</span>}
          <Button size="lg" onClick={handleSave} disabled={saving}>
            <Save className="w-5 h-5" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{props.label}</label>
      <Input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
