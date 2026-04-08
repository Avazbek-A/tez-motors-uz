import { NextRequest, NextResponse } from "next/server";
import { MOCK_FAQS } from "@/lib/mock-data";

export async function GET() {
  const faqs = MOCK_FAQS.filter((f) => f.is_published);
  return NextResponse.json({ faqs, total: faqs.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const faq = {
      id: crypto.randomUUID(),
      ...body,
      is_published: true,
      order_position: 0,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, faq }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to create FAQ" }, { status: 500 });
  }
}
