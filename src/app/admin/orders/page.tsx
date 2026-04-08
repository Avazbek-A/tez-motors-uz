"use client";

import { useState } from "react";
import { Plus, Search, Eye, Edit, Truck, Package, Ship, CheckCircle, Clock, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  orderId: string;
  clientName: string;
  clientPhone: string;
  car: string;
  price: number;
  status: number;
  statusLabel: string;
  createdAt: string;
  eta: string;
}

const statusLabels = ["Confirmed", "Purchasing", "Shipping", "Customs", "Delivery", "Delivered"];
const statusIcons = [FileCheck, Package, Ship, Clock, Truck, CheckCircle];
const statusColors = ["bg-blue-100 text-blue-700", "bg-yellow-100 text-yellow-700", "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700", "bg-cyan-100 text-cyan-700", "bg-green-100 text-green-700"];

const mockOrders: Order[] = [
  { id: "1", orderId: "TM-2024-001", clientName: "Alisher M.", clientPhone: "+998 90 123 45 67", car: "BYD Song Plus DM-i 2024", price: 22500, status: 3, statusLabel: "Customs", createdAt: "2024-10-15", eta: "2024-11-20" },
  { id: "2", orderId: "TM-2024-002", clientName: "Dmitriy K.", clientPhone: "+998 91 234 56 78", car: "Chery Tiggo 8 Pro Max 2024", price: 28000, status: 5, statusLabel: "Delivered", createdAt: "2024-09-01", eta: "2024-10-15" },
  { id: "3", orderId: "TM-2024-003", clientName: "Nodira R.", clientPhone: "+998 93 345 67 89", car: "Tank 300 2024", price: 38000, status: 1, statusLabel: "Purchasing", createdAt: "2024-11-01", eta: "2024-12-15" },
  { id: "4", orderId: "TM-2024-004", clientName: "Bakhtiyor S.", clientPhone: "+998 94 456 78 90", car: "Geely Monjaro 2024", price: 32000, status: 2, statusLabel: "Shipping", createdAt: "2024-10-20", eta: "2024-11-30" },
];

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | null>(null);

  const filtered = mockOrders.filter((order) => {
    if (statusFilter !== null && order.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return order.orderId.toLowerCase().includes(q) || order.clientName.toLowerCase().includes(q) || order.car.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">{mockOrders.length} total orders</p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          New Order
        </Button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors", statusFilter === null ? "bg-navy text-white" : "bg-muted text-muted-foreground")}
        >
          All ({mockOrders.length})
        </button>
        {statusLabels.map((label, i) => {
          const count = mockOrders.filter((o) => o.status === i).length;
          return (
            <button
              key={i}
              onClick={() => setStatusFilter(statusFilter === i ? null : i)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors", statusFilter === i ? "bg-navy text-white" : "bg-muted text-muted-foreground")}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order ID, client, or car..." className="pl-10" />
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {filtered.map((order, index) => {
          const StatusIcon = statusIcons[order.status] || Clock;
          return (
            <Card key={order.id} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", statusColors[order.status])}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{order.orderId}</p>
                        <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{order.car}</p>
                      <p className="text-xs text-muted-foreground">{order.clientName} &middot; {order.clientPhone}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-navy">${order.price.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">ETA: {new Date(order.eta).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost"><Eye className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost"><Edit className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 flex gap-1">
                  {statusLabels.map((_, i) => (
                    <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= order.status ? "bg-lime" : "bg-muted")} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
