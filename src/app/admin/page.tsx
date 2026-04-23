"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { Car, MessageSquare, Star, HelpCircle, ArrowUpRight, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Stats {
  cars: { total: number; available: number; hotOffers: number };
  reviews: { total: number; pending: number };
  faqs: { total: number };
  inquiries: { total: number; new: number; contacted: number; in_progress: number; closed: number };
}

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  type: string;
  status: string;
  created_at: string;
  source_page?: string;
  follow_up_date?: string | null;
}

const PAGE_SIZE = 10;

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

    fetch("/api/inquiry")
      .then((r) => r.json())
      .then((data) => setInquiries(data.inquiries || []))
      .catch(() => {});
  }, []);

  const statCards = [
    {
      title: "Total Cars",
      value: stats?.cars.total ?? "...",
      change: `${stats?.cars.available ?? 0} available`,
      icon: Car,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Total Inquiries",
      value: stats?.inquiries.total ?? "...",
      change: "from all sources",
      icon: MessageSquare,
      color: "text-green-600 bg-green-100",
    },
    {
      title: "New Inquiries",
      value: stats?.inquiries.new ?? "...",
      change: "awaiting response",
      icon: Clock,
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: "Reviews",
      value: stats?.reviews.total ?? "...",
      change: `${stats?.reviews.pending ?? 0} pending`,
      icon: Star,
      color: "text-purple-600 bg-purple-100",
    },
  ];
  const dueInquiries = inquiries.filter((inq) => inq.follow_up_date && new Date(inq.follow_up_date).setHours(23, 59, 59, 999) >= Date.now()).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Tez Motors admin panel</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.change}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {dueInquiries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Due Today / Overdue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dueInquiries.map((inq) => (
              <div key={inq.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="font-medium">{inq.name}</p>
                  <p className="text-sm text-muted-foreground">{inq.phone}</p>
                </div>
                <Badge variant={inq.status === "new" ? "warning" : "secondary"}>
                  {inq.follow_up_date}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent inquiries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Recent Inquiries</CardTitle>
          <Link href="/admin/inquiries" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No inquiries yet. They will appear here when customers submit forms.
            </p>
          ) : (
            <div className="space-y-3">
              {inquiries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-navy">
                        {inquiry.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{inquiry.name}</p>
                      <p className="text-sm text-muted-foreground">{inquiry.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={inquiry.status === "new" ? "warning" : "success"}>
                      {inquiry.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {inquiries.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-3 border-t border-border text-sm">
                  <span className="text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, inquiries.length)} of {inquiries.length}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE >= inquiries.length ? p : p + 1))} disabled={(page + 1) * PAGE_SIZE >= inquiries.length}>
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
