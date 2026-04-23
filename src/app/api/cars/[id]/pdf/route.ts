import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";

const encoder = new TextEncoder();

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrapLines(text: string, maxChars = 86): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      for (let i = 0; i < word.length; i += maxChars) {
        const chunk = word.slice(i, i + maxChars);
        if (chunk.length === maxChars) lines.push(chunk);
        else current = chunk;
      }
      continue;
    }
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function buildPdf(lines: string[]): Uint8Array {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const lineHeight = 18;
  let y = pageHeight - margin;

  const content: string[] = [];
  for (const line of lines) {
    if (!line) {
      y -= 10;
      continue;
    }
    const fontSize = line.startsWith("# ") ? 18 : line.startsWith("## ") ? 14 : 11;
    const text = line.replace(/^#+\s*/, "");
    content.push(`BT /F1 ${fontSize} Tf ${margin} ${y} Td (${escapePdfText(text)}) Tj ET`);
    y -= fontSize >= 18 ? 24 : lineHeight;
    if (y < margin) break;
  }

  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return encoder.encode(pdf);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: car, error } = await supabase
    .from("cars")
    .select("id, slug, brand, model, year, price_usd, original_price_usd, price_uzs, body_type, fuel_type, engine_volume, engine_power, transmission, drivetrain, mileage, color, description_ru, description_uz, description_en, images, thumbnail, video_url, inventory_status, specs, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !car) {
    return Response.json({ error: "Car not found" }, { status: 404 });
  }

  const status = car.inventory_status === "reserved" ? "Reserved" : car.inventory_status === "sold" ? "Sold" : "Available";
  const discount =
    car.original_price_usd && car.original_price_usd > car.price_usd
      ? Math.round((1 - car.price_usd / car.original_price_usd) * 100)
      : null;
  const description = car.description_en || car.description_ru || car.description_uz || "";
  const specsEntries = Object.entries((car.specs || {}) as Record<string, unknown>)
    .slice(0, 10)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`);

  const lines = [
    "# Tez Motors Spec Sheet",
    "",
    `Vehicle: ${car.brand} ${car.model} ${car.year}`,
    `Slug: ${car.slug}`,
    `Status: ${status}`,
    `Price: $${car.price_usd.toLocaleString("en-US")}`,
    ...(car.original_price_usd ? [`Original price: $${car.original_price_usd.toLocaleString("en-US")}`] : []),
    ...(discount ? [`Discount: ${discount}%`] : []),
    ...(car.price_uzs ? [`Approx. UZS: ${car.price_uzs.toLocaleString("en-US")}`] : []),
    `Body type: ${car.body_type}`,
    `Fuel type: ${car.fuel_type}`,
    `Transmission: ${car.transmission}`,
    ...(car.engine_volume ? [`Engine volume: ${car.engine_volume} L`] : []),
    ...(car.engine_power ? [`Engine power: ${car.engine_power} hp`] : []),
    ...(car.drivetrain ? [`Drivetrain: ${car.drivetrain}`] : []),
    ...(car.mileage ? [`Mileage: ${car.mileage} km`] : ["Mileage: 0 km"]),
    ...(car.color ? [`Color: ${car.color}`] : []),
    "",
    "Description:",
    ...wrapLines(description, 82).map((line) => `  ${line}`),
    "",
    "Specs:",
    ...(specsEntries.length ? specsEntries.flatMap((entry) => wrapLines(entry, 82).map((line) => `  ${line}`)) : ["  No extra specs listed"]),
    "",
    `Images: ${Array.isArray(car.images) && car.images.length ? car.images.length : 0}`,
    `Video: ${car.video_url ? car.video_url : "none"}`,
    "",
    `Tez Motors: ${SITE_CONFIG.phone} | ${SITE_CONFIG.email}`,
    SITE_CONFIG.address,
    SITE_CONFIG.telegram,
    SITE_CONFIG.whatsapp,
    "",
    `Updated: ${new Date(car.updated_at).toISOString()}`,
  ];

  const pdf = buildPdf(lines);
  const body = new Blob([new Uint8Array(Array.from(pdf))], { type: "application/pdf" });
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tez-motors-${car.slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
