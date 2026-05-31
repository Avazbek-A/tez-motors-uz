"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  RefreshCw, FileDown, Loader2, ArrowLeft, PackagePlus, AlertCircle, CheckCircle, Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Parts reorder workflow (Phase Y3).
 *
 * Lists published parts at/below a stock threshold, lets the dealer export the
 * list to CSV (for sending to a supplier), and record a restock inline — which
 * bumps stock_qty server-side and writes an audit row.
 */

interface LowStockPart {
  id: string;
  slug: string;
  name_ru: string;
  oem_number: string | null;
  category: string;
  stock_qty: number;
  min_order_qty: number | null;
}

export default function PartsReorderPage() {
  const [parts, setParts] = useState<LowStockPart[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [restocking, setRestocking] = useState<string | null>(null);
  const [addQty, setAddQty] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchLowStock = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/parts/low-stock?threshold=${threshold}&limit=100`)
      .then((r) => r.json())
      .then((d) => setParts(d.parts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [threshold]);

  useEffect(() => {
    fetchLowStock();
  }, [fetchLowStock]);

  const exportCsv = () => {
    const header = ["OEM", "Name", "Category", "In Stock", "Min Order Qty", "Suggested Reorder"];
    const rows = parts.map((p) => {
      const minOrder = p.min_order_qty ?? 1;
      const suggested = Math.max(minOrder, minOrder - p.stock_qty);
      return [
        p.oem_number ?? "",
        p.name_ru,
        p.category,
        String(p.stock_qty),
        String(minOrder),
        String(suggested),
      ];
    });
    const csv = [header, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reorder-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restock = async (part: LowStockPart) => {
    const raw = addQty[part.id];
    const add = Number.parseInt(raw ?? "", 10);
    if (!Number.isFinite(add) || add < 1) {
      showFeedback("error", "Enter a quantity to add");
      return;
    }
    setRestocking(part.id);
    try {
      const res = await fetch("/api/admin/parts/low-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: part.id, add }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback("error", data.error || "Restock failed");
        return;
      }
      showFeedback("success", `Restocked ${part.name_ru} → ${data.stock_qty}`);
      setAddQty((m) => ({ ...m, [part.id]: "" }));
      // Refresh so anything now above threshold drops off the list.
      fetchLowStock();
    } catch {
      showFeedback("error", "Restock failed");
    } finally {
      setRestocking(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/parts" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">Reorder List</h1>
          </div>
          <p className="text-muted-foreground text-sm">Parts at or below the stock threshold.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Threshold ≤</span>
            <Input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
              className="w-20"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchLowStock} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={parts.length === 0}>
            <FileDown className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {feedback && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
          feedback.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400",
        )}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </CardContent>
        </Card>
      ) : parts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Everything is well stocked.</p>
            <p className="text-sm mt-1">No published parts at or below {threshold} in stock.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground bg-muted/30">
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Part</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">OEM</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">Stock</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">Min Order</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">Restock</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/admin/parts`} className="font-medium hover:underline">{p.name_ru}</Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{p.oem_number || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize">{p.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-bold font-mono",
                          p.stock_qty === 0 ? "text-red-400" : p.stock_qty <= 2 ? "text-orange-400" : "text-yellow-400",
                        )}>{p.stock_qty}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground font-mono">{p.min_order_qty ?? 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min={1}
                            placeholder="+ qty"
                            value={addQty[p.id] ?? ""}
                            onChange={(e) => setAddQty((m) => ({ ...m, [p.id]: e.target.value }))}
                            className="w-24"
                          />
                          <Button
                            size="sm"
                            onClick={() => restock(p)}
                            disabled={restocking === p.id}
                          >
                            {restocking === p.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PackagePlus className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
