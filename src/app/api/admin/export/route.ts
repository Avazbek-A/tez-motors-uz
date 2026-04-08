import { NextRequest, NextResponse } from "next/server";

// GET - Export inquiries as CSV
export async function GET(request: NextRequest) {
  // Fetch inquiries from the in-memory store via internal API
  const baseUrl = request.nextUrl.origin;
  const res = await fetch(`${baseUrl}/api/inquiry`);
  const data = await res.json();

  const inquiries = data.inquiries || [];

  if (inquiries.length === 0) {
    return new NextResponse("No inquiries to export", { status: 404 });
  }

  // Build CSV
  const headers = ["ID", "Name", "Phone", "Email", "Type", "Status", "Message", "Source", "Created At"];
  const rows = inquiries.map((inq: Record<string, string>) => [
    inq.id,
    `"${(inq.name || "").replace(/"/g, '""')}"`,
    inq.phone,
    inq.email || "",
    inq.type,
    inq.status,
    `"${(inq.message || "").replace(/"/g, '""')}"`,
    inq.source_page || "",
    inq.created_at,
  ]);

  const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=inquiries-${new Date().toISOString().split("T")[0]}.csv`,
    },
  });
}
