import { NextRequest, NextResponse } from "next/server";
import { MOCK_REVIEWS } from "@/lib/mock-data";

export async function GET() {
  const reviews = MOCK_REVIEWS.filter((r) => r.is_published);
  return NextResponse.json({ reviews, total: reviews.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const review = {
      id: crypto.randomUUID(),
      ...body,
      is_published: false,
      order_position: 0,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to create review" }, { status: 500 });
  }
}
