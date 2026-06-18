import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Acoustic Voice Micro-Tremor Stress and Lie Detector (Leap 13).
 * Admin-gated.
 * Simulates analyzing real-time speech jitter and shimmer to determine client stress states and counter-objection hints.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { stream_duration_seconds } = body;
    
    // Simulate voice frequency stability checks
    const jitter = Number((Math.random() * 0.08 + 0.01).toFixed(4));
    const shimmer = Number((Math.random() * 0.15 + 0.05).toFixed(4));
    
    let stressScore = Math.floor(Math.random() * 40) + 10;
    if (jitter > 0.05 || shimmer > 0.12) {
      stressScore += 30;
    }

    const psychologicalState = stressScore > 70 
      ? "high_friction_bluffing"
      : stressScore > 40
      ? "impatient_hesitant"
      : "interested_calm";

    return NextResponse.json({
      success: true,
      jitter_ratio: jitter,
      shimmer_ratio: shimmer,
      stress_score: stressScore,
      psychological_state: psychologicalState,
      guidance_tip: psychologicalState === "high_friction_bluffing"
        ? "Клиент колеблется из-за бюджета. Предложите рассрочку 0% или скидку."
        : psychologicalState === "impatient_hesitant"
        ? "Клиент сомневается. Подчеркните официальную гарантию 5 лет в Ташкенте."
        : "Клиент спокоен и заинтересован. Предложите забронировать цвет прямо сейчас."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to analyze vocal tremor" }, { status: 500 });
  }
}
