"use client";

import { useState } from "react";
import { Search, Package, Truck, CheckCircle, Clock, Ship, FileCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

const orderStatuses = [
  { key: "confirmed", icon: FileCheck, label: { ru: "Заказ подтверждён", uz: "Buyurtma tasdiqlandi", en: "Order Confirmed" } },
  { key: "purchasing", icon: Package, label: { ru: "Выкуп авто", uz: "Avto sotib olinmoqda", en: "Purchasing" } },
  { key: "shipping", icon: Ship, label: { ru: "В пути", uz: "Yo'lda", en: "Shipping" } },
  { key: "customs", icon: Clock, label: { ru: "Таможня", uz: "Bojxona", en: "Customs" } },
  { key: "delivery", icon: Truck, label: { ru: "Доставка", uz: "Yetkazish", en: "Delivery" } },
  { key: "completed", icon: CheckCircle, label: { ru: "Доставлено", uz: "Yetkazildi", en: "Delivered" } },
];

// Mock order data
const mockOrders: Record<string, { car: string; status: number; date: string; eta: string }> = {
  "TM-2024-001": { car: "BYD Song Plus DM-i 2024", status: 3, date: "2024-10-15", eta: "2024-11-20" },
  "TM-2024-002": { car: "Chery Tiggo 8 Pro Max 2024", status: 5, date: "2024-09-01", eta: "2024-10-15" },
};

export default function TrackOrderPage() {
  const { locale } = useLocale();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<typeof mockOrders[string] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = locale === "ru" ? "Отслеживание заказа" : locale === "uz" ? "Buyurtmani kuzatish" : "Track Order";
  const subtitle = locale === "ru"
    ? "Введите номер заказа для отслеживания статуса доставки"
    : locale === "uz" ? "Yetkazish holatini kuzatish uchun buyurtma raqamini kiriting"
    : "Enter your order number to track delivery status";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotFound(false);
    setOrder(null);

    // Simulate API call
    setTimeout(() => {
      const found = mockOrders[orderId.toUpperCase()];
      if (found) {
        setOrder(found);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading title={title} subtitle={subtitle} />

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="flex gap-3 mb-12">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder={locale === "ru" ? "Номер заказа (напр. TM-2024-001)" : "Order number (e.g. TM-2024-001)"}
                className="pl-12 h-14 text-base rounded-2xl"
                required
              />
            </div>
            <Button type="submit" size="lg" className="rounded-2xl px-8" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (locale === "ru" ? "Найти" : "Search")}
            </Button>
          </form>

          {notFound && (
            <div className="text-center py-12 bg-muted/50 rounded-2xl border border-border">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {locale === "ru" ? "Заказ не найден. Проверьте номер заказа." : "Order not found. Please check the order number."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {locale === "ru" ? "Попробуйте: TM-2024-001" : "Try: TM-2024-001"}
              </p>
            </div>
          )}

          {order && (
            <div className="animate-fade-in-up">
              {/* Order info */}
              <div className="bg-white rounded-2xl border border-border p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{locale === "ru" ? "Заказ" : "Order"}</p>
                    <p className="text-lg font-bold">{orderId.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{locale === "ru" ? "Автомобиль" : "Car"}</p>
                    <p className="font-semibold">{order.car}</p>
                  </div>
                </div>
                <div className="flex gap-6 mt-4 pt-4 border-t border-border text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{locale === "ru" ? "Дата заказа" : "Order date"}</p>
                    <p className="font-medium">{new Date(order.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{locale === "ru" ? "Ожидаемая доставка" : "Expected delivery"}</p>
                    <p className="font-medium">{new Date(order.eta).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Status timeline */}
              <div className="bg-white rounded-2xl border border-border p-6">
                <h3 className="font-bold mb-6">{locale === "ru" ? "Статус доставки" : "Delivery Status"}</h3>
                <div className="space-y-0">
                  {orderStatuses.map((status, index) => {
                    const isComplete = index < order.status;
                    const isCurrent = index === order.status;
                    const Icon = status.icon;
                    return (
                      <div key={status.key} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                            isComplete ? "bg-lime text-navy" : isCurrent ? "bg-navy text-white animate-pulse" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="w-5 h-5" />
                          </div>
                          {index < orderStatuses.length - 1 && (
                            <div className={cn(
                              "w-0.5 h-12",
                              isComplete ? "bg-lime" : "bg-border"
                            )} />
                          )}
                        </div>
                        <div className="pt-2">
                          <p className={cn(
                            "font-semibold text-sm",
                            isComplete || isCurrent ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {status.label[locale as keyof typeof status.label]}
                          </p>
                          {isCurrent && (
                            <p className="text-xs text-lime-dark mt-0.5">
                              {locale === "ru" ? "Текущий статус" : "Current status"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
