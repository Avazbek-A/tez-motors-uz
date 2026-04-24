"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Turnstile } from "@/components/shared/turnstile";
import { SectionHeading } from "@/components/shared/section-heading";

export default function SellYourCarPage() {
  const [form, setForm] = useState({ name: "", phone: "", make: "", model: "", year: "", mileage: "", condition: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("turnstile_token", turnstileToken ?? "");
      files.forEach((file) => fd.append("files", file));
      const uploadRes = await fetch("/api/trade-in/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        setError(uploadData.error || "Photo upload failed");
        return;
      }

      const inquiryRes = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          type: "trade_in",
          source_page: "sell-your-car",
          message: `${form.make} ${form.model} ${form.year}, mileage: ${form.mileage}, condition: ${form.condition}`,
          metadata: { photos: uploadData.urls || [], make: form.make, model: form.model, year: form.year, mileage: form.mileage, condition: form.condition },
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!inquiryRes.ok) {
        const data = await inquiryRes.json().catch(() => ({}));
        setError(data.error || "Failed to submit request");
        return;
      }
      setSuccess(true);
      setFiles([]);
      setForm({ name: "", phone: "", make: "", model: "", year: "", mileage: "", condition: "" });
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom max-w-3xl">
        <SectionHeading title="Sell your car" subtitle="Send us your car details and photos for a trade-in estimate." />
        {success ? (
          <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-10 text-center">
            <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-3" />
            <p className="font-semibold">Request sent successfully</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-[#0d0d15] rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" required />
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Make" required />
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model" required />
              <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Year" type="number" required />
              <Input value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder="Mileage" type="number" />
            </div>
            <Textarea value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="Condition" rows={4} />
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer text-sm text-muted-foreground">
              <Upload className="w-4 h-4" />
              {files.length ? `${files.length} photo(s) selected` : "Add up to 4 photos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))}
              />
            </label>
            <Turnstile onToken={setTurnstileToken} />
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />{error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit trade-in"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
