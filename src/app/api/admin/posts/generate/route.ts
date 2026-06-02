import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { generateBlogDraft } from "@/lib/content-ai";

/**
 * Draft a blog post from a topic. Returns title + content for the dealer to
 * review and publish (does not save). Admin-gated; fail-open.
 */
const schema = z.object({
  topic: z.string().min(3).max(300),
  locale: z.enum(["ru", "uz", "en"]).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A topic (3-300 chars) is required" }, { status: 400 });
  }

  const draft = await generateBlogDraft(parsed.data.topic, parsed.data.locale ?? "ru");
  return NextResponse.json({ success: true, ...draft });
}
