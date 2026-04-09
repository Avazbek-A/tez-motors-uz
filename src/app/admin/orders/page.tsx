"use client";

import { useState, useEffect } from "react";
import { Search, Eye, Trash2, PhoneCall, Package, Ship, CheckCircle, Clock, FileCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  type: string;
  status: string;
  message: string | null;
  source_page: string | null;
  created_at: string;
  car_id: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: FileCheck },
  contacted: { label: "Contacted", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: PhoneCall },
  in_progress: { label: "In Progress", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Ship },
  closed: { label: "Closed", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
};

const statusOrder = ["new", "contacted", "in_progress", "closed"];

const typeConfig: Record<string, { label: string; color: string }> = {
  inquiry: { label: "Inquiry", color: "bg-cyan-500/20 text-cyan-400" },
  callback: { label: "Callback", color: "bg-orange-500/20 text-orange-400" },
  test_drive: { label: "Test Drive", color: "bg-pink-500/20 text-pink-400" },
};

export default function AdminOrdersPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inquiry");
      const data = await res.json();
      setInquiries(data.inquiries || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/inquiry/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status } : inq))
      );
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this inquiry?")) return;
    try {
      await fetch(`/api/inquiry/${id}`, { method: "DELETE" });
      setInquiries((prev) => prev.filter((inq) => inq.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch {
      // ignore
    }
  };

  const filtered = inquiries.filter((inq) => {
    if (statusFilter && inq.status !== statusFilter) return false;
    if (typeFilter && inq.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inq.name.toLowerCase().includes(q) ||
        inq.phone.toLowerCase().includes(q) ||
        (inq.message || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selected = selectedId ? inquiries.find((i) => i.id === selectedId) : null;

  const statusCounts = statusOrder.reduce<Record<string, number>>((acc, s) => {
    acc[s] = inquiries.filter((i) => i.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inquiries & Orders</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${inquiries.length} total inquiries`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchInquiries} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/admin/export", "_blank")}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter(null)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            statusFilter === null
              ? "bg-white/10 text-white border-white/20"
              : "bg-transparent text-muted-foreground border-transparent hover:border-white/10"
          )}
        >
          All ({inquiries.length})
        </button>
        {statusOrder.map((s) => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5",
                statusFilter === s
                  ? cfg.color
                  : "bg-transparent text-muted-foreground border-transparent hover:border-white/10"
              )}
            >
              <Icon className="w-3 h-3" />
              {cfg.label} ({statusCounts[s] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap -mt-2">
        {Object.entries(typeConfig).map(([type, cfg]) => {
          const count = inquiries.filter((i) => i.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                typeFilter === type ? cfg.color : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or message..."
          className="pl-10"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading inquiries...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No inquiries found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* List */}
          <div className="space-y-2">
            {filtered.map((inquiry, index) => {
              const cfg = statusConfig[inquiry.status] ?? statusConfig.new;
              const StatusIcon = cfg.icon;
              const typeCfg = typeConfig[inquiry.type];
              const isSelected = selectedId === inquiry.id;

              return (
                <Card
                  key={inquiry.id}
                  className={cn(
                    "cursor-pointer transition-all animate-fade-in hover:border-white/20",
                    isSelected && "border-white/30 bg-white/[0.02]"
                  )}
                  style={{ animationDelay: `${index * 20}ms` }}
                  onClick={() => setSelectedId(isSelected ? null : inquiry.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", cfg.color)}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{inquiry.name}</p>
                          {typeCfg && (
                            <span className={cn("text-xs px-2 py-0.5 rounded-full", typeCfg.color)}>
                              {typeCfg.label}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn("text-xs border", cfg.color)}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{inquiry.phone}</p>
                        {inquiry.message && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{inquiry.message}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {new Date(inquiry.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inquiry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(inquiry.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 flex gap-1">
                      {statusOrder.map((s) => (
                        <div
                          key={s}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            statusOrder.indexOf(s) <= statusOrder.indexOf(inquiry.status)
                              ? "bg-cyan-500/60"
                              : "bg-white/[0.06]"
                          )}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="animate-fade-in">
              <Card className="sticky top-6">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Inquiry Details</h3>
                    <button
                      className="text-muted-foreground hover:text-white text-sm"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                      <p className="font-medium">{selected.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                      <a href={`tel:${selected.phone}`} className="font-medium hover:text-cyan-400 transition-colors">
                        {selected.phone}
                      </a>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                      <p className="font-medium capitalize">{selected.type.replace("_", " ")}</p>
                    </div>
                    {selected.message && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Message</p>
                        <p className="text-white/80 bg-white/[0.04] rounded-lg p-3">{selected.message}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Source</p>
                      <p className="font-medium">{selected.source_page || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Submitted</p>
                      <p className="font-medium">
                        {new Date(selected.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Update Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {statusOrder.map((s) => {
                        const cfg = statusConfig[s];
                        const Icon = cfg.icon;
                        const isActive = selected.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => updateStatus(selected.id, s)}
                            disabled={isActive || updatingId === selected.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                              isActive
                                ? cn(cfg.color, "border")
                                : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"
                            )}
                          >
                            {updatingId === selected.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Icon className="w-3 h-3" />
                            )}
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-white/10">
                    <a
                      href={`tel:${selected.phone}`}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      Call
                    </a>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
