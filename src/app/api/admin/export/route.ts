import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const escape = (val: string | number | boolean | null | undefined) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// GET - Export data as CSV
export async function GET(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "inquiries";

  try {
    const supabase = await createClient();
    const date = new Date().toISOString().split("T")[0];

    if (type === "cars") {
      const { data: cars, error } = await supabase
        .from("cars")
        .select("id, brand, model, year, price_usd, body_type, fuel_type, transmission, is_available, is_hot_offer, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!cars || cars.length === 0) {
        return new NextResponse("No data to export", { status: 404 });
      }

      const headers = ["ID", "Brand", "Model", "Year", "Price USD", "Body", "Fuel", "Transmission", "Available", "Hot", "Created At"];
      const rows = cars.map((c) => [
        escape(c.id),
        escape(c.brand),
        escape(c.model),
        escape(c.year),
        escape(c.price_usd),
        escape(c.body_type),
        escape(c.fuel_type),
        escape(c.transmission),
        escape(c.is_available),
        escape(c.is_hot_offer),
        escape(c.created_at),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=cars-${date}.csv`,
        },
      });
    }

    // Default: inquiries
    const { data: inquiries, error } = await supabase
      .from("inquiries")
      .select("id, name, phone, type, status, message, source_page, car_id, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!inquiries || inquiries.length === 0) {
      return new NextResponse("No data to export", { status: 404 });
    }

    const headers = ["ID", "Name", "Phone", "Type", "Status", "Message", "Source", "Car ID", "Created At"];
    const rows = inquiries.map((inq) => [
      escape(inq.id),
      escape(inq.name),
      escape(inq.phone),
      escape(inq.type),
      escape(inq.status),
      escape(inq.message),
      escape(inq.source_page),
      escape(inq.car_id),
      escape(inq.created_at),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=inquiries-${date}.csv`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
