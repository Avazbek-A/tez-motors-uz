import { NextRequest, NextResponse } from "next/server";
import { MOCK_CARS } from "@/lib/mock-data";

// GET single car by ID or slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const car = MOCK_CARS.find((c) => c.id === id || c.slug === id);

  if (!car) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  return NextResponse.json({ car });
}

// PUT - update a car (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // TODO: validate and update in Supabase
  return NextResponse.json({
    success: true,
    car: { id, ...body, updated_at: new Date().toISOString() },
  });
}

// DELETE - remove a car (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // TODO: delete from Supabase
  return NextResponse.json({ success: true, deleted: id });
}
