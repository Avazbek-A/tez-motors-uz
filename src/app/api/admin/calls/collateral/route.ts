import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { contactKey } from "@/lib/crm";

/**
 * Automated Sales Brochure Compiler and Viewer.
 * - POST: Complies the brochure metadata and updates the client's CRM inquiry.
 * - GET: Renders a premium, interactive HTML brochure client-facing web page.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { inquiry_id, name, phone, vehicle, price, details, discount } = body;

    if (!phone) {
      return NextResponse.json({ error: "Client phone is required" }, { status: 400 });
    }

    const phoneCore = contactKey(phone);
    const supabase = createServiceClient();

    // Find active inquiry if not provided
    let inqId = inquiry_id;
    if (!inqId) {
      const { data: inq } = await supabase
        .from("inquiries")
        .select("id")
        .ilike("phone", `%${phoneCore}%`)
        .limit(1)
        .maybeSingle();
      inqId = inq?.id;
    }

    // Compile dynamic query parameters for the customer-facing brochure URL
    const queryParams = new URLSearchParams({
      name: name || "Уважаемый клиент",
      phone: phone,
      vehicle: vehicle || "BYD Song Plus",
      price: String(price || 26500),
      discount: String(discount || 0),
      details: typeof details === "string" ? details : JSON.stringify(details || {}),
    });

    const collateralUrl = `/api/admin/calls/collateral?${queryParams.toString()}`;

    // Link this to the CRM inquiry
    if (inqId) {
      await supabase
        .from("inquiries")
        .update({
          collateral_url: collateralUrl,
          voice_auth_status: "approved"
        })
        .eq("id", inqId);
    }

    return NextResponse.json({
      success: true,
      collateral_url: collateralUrl,
      title: `Official Sales Offer: ${vehicle}`,
      client_name: name || "Client",
      price_quoted: price,
      discount_applied: discount || 0,
      message: "Dynamic sales brochure successfully compiled and logged under CRM inquiry!"
    });
  } catch (err: any) {
    console.error("Collateral compile error:", err);
    return NextResponse.json({ error: err.message || "Collateral compile failed" }, { status: 500 });
  }
}

/**
 * GET: Renders a gorgeous, premium HTML sales brochure for the customer.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // This GET is intentionally public (the POST hands out a shareable collateral
    // link) and emits text/html, so reflected query params MUST be HTML-escaped —
    // otherwise ?name=<script>… is reflected XSS. Numeric params below are Number()'d.
    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const name = esc(searchParams.get("name") || "Уважаемый клиент");
    const vehicle = esc(searchParams.get("vehicle") || "BYD Song Plus");
    const rawPrice = Number(searchParams.get("price") || 26500);
    const rawDiscount = Number(searchParams.get("discount") || 0);
    const finalPrice = Math.max(0, rawPrice - rawDiscount);

    const formattedPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rawPrice);
    const formattedDiscount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(rawDiscount);
    const formattedFinal = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(finalPrice);

    // Gorgeous, high-fidelity premium HTML layout with dynamic style variables, glassmorphism and animations
    const html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tez Motors - Персональное предложение</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@300;400;500;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-color: #030712;
            --primary-glow: conic-gradient(from 180deg at 50% 50%, #10b981 0deg, #3b82f6 90deg, #10b981 180deg, #3b82f6 270deg, #10b981 360deg);
            --card-bg: rgba(17, 24, 39, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            background-color: var(--bg-color);
            color: #f3f4f6;
            font-family: 'Inter', sans-serif;
            overflow-x: hidden;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
          }
          .glow-bg {
            position: absolute;
            top: -20%;
            left: -20%;
            width: 140%;
            height: 140%;
            background: var(--primary-glow);
            filter: blur(120px);
            opacity: 0.15;
            z-index: -1;
            pointer-events: none;
          }
          .brochure-container {
            max-width: 680px;
            width: 100%;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 3rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.8s ease-out;
            position: relative;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .header {
            text-align: center;
            margin-bottom: 2.5rem;
          }
          .brand-logo {
            font-family: 'Outfit', sans-serif;
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #10b981, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.05em;
            margin-bottom: 0.5rem;
          }
          .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #34d399;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1rem;
          }
          h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.25rem;
            font-weight: 800;
            margin-bottom: 0.5rem;
            letter-spacing: -0.02em;
          }
          .greeting {
            color: #9ca3af;
            font-size: 1.1rem;
            margin-bottom: 2.5rem;
            text-align: center;
          }
          .offer-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2.5rem;
          }
          .vehicle-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #3b82f6;
          }
          .price-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .price-row:last-child {
            border-bottom: none;
            padding-top: 1.25rem;
          }
          .price-label {
            color: #9ca3af;
            font-size: 0.95rem;
          }
          .price-value {
            font-weight: 600;
            font-size: 1.1rem;
          }
          .original-price {
            text-decoration: line-through;
            color: #6b7280;
          }
          .discount-value {
            color: #ef4444;
          }
          .final-price {
            font-size: 1.75rem;
            font-weight: 800;
            color: #10b981;
            font-family: 'Outfit', sans-serif;
          }
          .warranty-box {
            display: flex;
            align-items: center;
            gap: 1rem;
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.15);
            border-radius: 12px;
            padding: 1rem;
            margin-top: 1.5rem;
          }
          .warranty-icon {
            font-size: 1.5rem;
          }
          .warranty-text {
            font-size: 0.875rem;
            color: #9ca3af;
            line-height: 1.4;
          }
          .actions {
            display: flex;
            gap: 1rem;
          }
          .btn {
            flex: 1;
            padding: 1rem;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            text-decoration: none;
          }
          .btn-primary {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
          }
          .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: #f3f4f6;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.08);
          }
          @media (max-width: 600px) {
            .brochure-container {
              padding: 1.5rem;
            }
            .actions {
              flex-direction: column;
            }
          }
        </style>
      </head>
      <body>
        <div class="glow-bg"></div>
        <div class="brochure-container">
          <div class="header">
            <span class="badge">Эксклюзивное предложение</span>
            <div class="brand-logo">TEZ MOTORS</div>
            <h1>Персональное коммерческое предложение</h1>
          </div>
          
          <div class="greeting">
            Здравствуйте, <strong>${name}</strong>! Благодарим вас за обращение в автосалон Tez Motors. Мы подготовили для вас специальное ценовое предложение на автомобиль вашей мечты.
          </div>

          <div class="offer-card">
            <div class="vehicle-title">${vehicle}</div>
            
            <div class="price-row">
              <span class="price-label">Стандартная стоимость</span>
              <span class="price-value ${rawDiscount > 0 ? 'original-price' : ''}">${formattedPrice}</span>
            </div>

            ${rawDiscount > 0 ? `
            <div class="price-row">
              <span class="price-label">Специальная персональная скидка</span>
              <span class="price-value discount-value">-${formattedDiscount}</span>
            </div>
            ` : ''}

            <div class="price-row">
              <span class="price-label">Итоговая стоимость со всеми скидками</span>
              <span class="price-value final-price">${formattedFinal}</span>
            </div>

            <div class="warranty-box">
              <span class="warranty-icon">🛡️</span>
              <div class="warranty-text">
                <strong>Официальная гарантия Tez Motors:</strong> 5 лет или 150,000 км пробега. Полное техническое обслуживание и поддержка в нашем сервисном центре в Ташкенте.
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="btn btn-primary" onclick="alert('Спасибо! Ваш менеджер свяжется с вами в течение 5 минут для подтверждения бронирования.')">Принять предложение</button>
            <a href="tel:+998901234567" class="btn btn-secondary">Связаться с менеджером</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch {
    // Don't reflect internal error text on a public endpoint.
    return new Response(`<h1>Failed to load brochure</h1>`, { status: 500 });
  }
}
