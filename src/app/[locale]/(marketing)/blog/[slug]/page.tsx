import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocaleFromCookie } from "@/i18n/config";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_CONFIG } from "@/lib/constants";
import { localizedPath } from "@/lib/locale-path";
import { formatDate } from "@/lib/utils";
import type { BlogPost } from "@/types/car";

async function fetchPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data as BlogPost | null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) {
    return { title: "Post not found" };
  }

  const title = post.title_ru;
  const description = post.body_ru.slice(0, 160);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: post.cover_image ? [{ url: post.cover_image }] : undefined,
    },
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/blog/${slug}`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/blog/${slug}`,
        uz: `${SITE_CONFIG.url}/uz/blog/${slug}`,
        en: `${SITE_CONFIG.url}/en/blog/${slug}`,
      },
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) notFound();

  const title =
    (locale === "uz" ? post.title_uz : locale === "en" ? post.title_en : post.title_ru) || post.title_ru;
  const body =
    (locale === "uz" ? post.body_uz : locale === "en" ? post.body_en : post.body_ru) || post.body_ru;

  return (
    <article className="pt-24 pb-16">
      <div className="container-custom max-w-4xl">
        <Link href={localizedPath(locale, "/blog")} className="text-sm text-neon-blue mb-6 inline-flex">
          ← {locale === "ru" ? "К блогу" : "Back to blog"}
        </Link>
        <header className="space-y-4 mb-10">
          <p className="text-xs uppercase tracking-wider text-neon-blue">
            {post.published_at ? formatDate(post.published_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU") : ""}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-white">{title}</h1>
          {post.cover_image && (
            <img src={post.cover_image} alt={title} className="w-full rounded-2xl border border-white/10 object-cover" />
          )}
        </header>

        <div
          className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/70 prose-li:text-white/70 prose-a:text-neon-blue"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      </div>
    </article>
  );
}
