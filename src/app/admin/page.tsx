"use client";

import { useEffect, useState } from "react";

import { Car, MessageSquare, Star, TrendingUp, ArrowUpRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MOCK_CARS, MOCK_REVIEWS } from "@/lib/mock-data";

interface InquiryData {
  inquiries: Array<{
    id: string;
    name: string;
    phone: string;
    type: string;
    status: string;
    created_at: string;
    source_page?: string;
  }>;
  total: number;
}

export default function AdminDashboard() {
  const [inquiryData, setInquiryData] = useState<InquiryData>({ inquiries: [], total: 0 });

  useEffect(() => {
    fetch("/api/inquiry")
      .then((r) => r.json())
      .then(setInquiryData)
      .catch(() => {});
  }, []);

  const stats = [
    {
      title: "Total Cars",
      value: MOCK_CARS.length,
      change: "+3 this week",
      icon: Car,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Total Inquiries",
      value: inquiryData.total,
      change: "from all sources",
      icon: MessageSquare,
      color: "text-green-600 bg-green-100",
    },
    {
      title: "New Inquiries",
      value: inquiryData.inquiries.filter((i) => i.status === "new").length,
      change: "awaiting response",
      icon: Clock,
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: "Reviews",
      value: MOCK_REVIEWS.length,
      change: "published",
      icon: Star,
      color: "text-purple-600 bg-purple-100",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Tez Motors admin panel</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
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

      {/* Recent inquiries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inquiries</CardTitle>
        </CardHeader>
        <CardContent>
          {inquiryData.inquiries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No inquiries yet. They will appear here when customers submit forms.
            </p>
          ) : (
            <div className="space-y-3">
              {inquiryData.inquiries.slice(0, 10).map((inquiry) => (
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick stats: popular cars */}
      <Card>
        <CardHeader>
          <CardTitle>Car Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_CARS.slice(0, 5).map((car) => (
              <div
                key={car.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Car className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{car.brand} {car.model}</p>
                    <p className="text-xs text-muted-foreground">{car.year} &middot; {car.fuel_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-navy">${car.price_usd.toLocaleString()}</p>
                  <div className="flex gap-1">
                    {car.is_hot_offer && <Badge variant="default">Hot</Badge>}
                    {car.is_available && <Badge variant="success">Available</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
