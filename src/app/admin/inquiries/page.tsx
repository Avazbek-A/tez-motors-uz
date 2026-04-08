"use client";

import { useEffect, useState } from "react";

import {
  Search, Phone, Mail, MessageSquare, Clock,
  CheckCircle, XCircle, ArrowRight, Eye, RefreshCw, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  type: string;
  status: string;
  source_page?: string;
  car_id?: string;
  created_at: string;
}

const statusConfig = {
  new: { label: "New", variant: "warning" as const, icon: Clock },
  contacted: { label: "Contacted", variant: "info" as const, icon: Phone },
  in_progress: { label: "In Progress", variant: "default" as const, icon: ArrowRight },
  closed: { label: "Closed", variant: "success" as const, icon: CheckCircle },
};

const typeLabels: Record<string, string> = {
  general: "General",
  car_inquiry: "Car Inquiry",
  callback: "Callback",
  calculator: "Calculator",
};

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInquiries = () => {
    setLoading(true);
    fetch("/api/inquiry")
      .then((r) => r.json())
      .then((data) => {
        setInquiries(data.inquiries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const filtered = inquiries.filter((inq) => {
    if (statusFilter !== "all" && inq.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inq.name.toLowerCase().includes(q) ||
        inq.phone.includes(q) ||
        (inq.message || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts = {
    all: inquiries.length,
    new: inquiries.filter((i) => i.status === "new").length,
    contacted: inquiries.filter((i) => i.status === "contacted").length,
    in_progress: inquiries.filter((i) => i.status === "in_progress").length,
    closed: inquiries.filter((i) => i.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inquiries</h1>
          <p className="text-muted-foreground">{inquiries.length} total inquiries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInquiries}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/admin/export" download>
              <Download className="w-4 h-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["all", "new", "contacted", "in_progress", "closed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
              statusFilter === status
                ? "bg-navy text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {status === "all" ? "All" : statusConfig[status]?.label || status}
            <span className="ml-2 text-xs opacity-70">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inquiries list */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading...
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No inquiries found.</p>
              <p className="text-sm mt-1">Inquiries will appear here when customers submit forms on your website.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((inquiry, index) => {
            const config = statusConfig[inquiry.status as keyof typeof statusConfig] || statusConfig.new;
            return (
              <div
                key={inquiry.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setSelectedInquiry(inquiry)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center shrink-0 mt-1">
                          <span className="text-sm font-bold text-navy">
                            {inquiry.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{inquiry.name}</p>
                            <Badge variant={config.variant}>{config.label}</Badge>
                            <Badge variant="secondary">{typeLabels[inquiry.type] || inquiry.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{inquiry.phone}</p>
                          {inquiry.message && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{inquiry.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {new Date(inquiry.created_at).toLocaleString()}
                        </p>
                        {inquiry.source_page && (
                          <p className="text-xs text-muted-foreground mt-1">{inquiry.source_page}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })
        )}
      </div>

      {/* Detail modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInquiry(null)} />
          <div
            className="animate-fade-in relative bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl"
          >
            <h2 className="text-xl font-bold mb-4">Inquiry Details</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-navy">
                    {selectedInquiry.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{selectedInquiry.name}</p>
                  <p className="text-muted-foreground">{selectedInquiry.phone}</p>
                </div>
              </div>
              {selectedInquiry.message && (
                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-sm">{selectedInquiry.message}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Type</p>
                  <p className="font-medium">{typeLabels[selectedInquiry.type] || selectedInquiry.type}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Status</p>
                  <p className="font-medium">{selectedInquiry.status}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Source</p>
                  <p className="font-medium">{selectedInquiry.source_page || "N/A"}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p className="font-medium">{new Date(selectedInquiry.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedInquiry(null)}>Close</Button>
                <Button asChild>
                  <a href={`tel:${selectedInquiry.phone}`}>
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
