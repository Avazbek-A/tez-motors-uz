import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocaleFromCookie } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";
import { localizedPath } from "@/lib/locale-path";
import { SectionHeading } from "@/components/shared/section-heading";
import type { BlogPost } from "@/types/car";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const title = locale === "ru" ? "Блог" : "Blog";
  const description =
    locale === "ru"
      ? "Новости, советы и практичные заметки для клиентов."
      : "News, tips, and practical buying notes.";

  return {
    title,
    description,
    alternates: {
      canonical: `https://tezmotors.uz/${locale}/blog`,
      languages: {
        ru: "https://tezmotors.uz/ru/blog",
        uz: "https://tezmotors.uz/uz/blog",
        en: "https://tezmotors.uz/en/blog",
      },
    },
  };
}

export default async function BlogPage() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const dictionary = await getDictionary(locale);
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false });

  const items = (posts || []) as BlogPost[];

  const getTitle = (post: BlogPost) =>
    (locale === "uz" ? post.title_uz : locale === "en" ? post.title_en : post.title_ru) || post.title_ru;
  const getBody = (post: BlogPost) =>
    (locale === "uz" ? post.body_uz : locale === "en" ? post.body_en : post.body_ru) || post.body_ru;

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          as="h1"
          title={locale === "ru" ? "Блог" : locale === "uz" ? "Blog" : "Blog"}
          subtitle={locale === "ru" ? "Новости, советы и практичные заметки для клиентов." : "News, tips, and practical buying notes."}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map((post) => (
            <article key={post.id} className="rounded-2xl border border-white/10 bg-[#0d0d15] overflow-hidden">
              {post.cover_image && (
                <div className="relative h-52 w-full">
                  <Image
                    src={post.cover_image}
                    alt={getTitle(post)}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-6 space-y-3">
                <p className="text-xs uppercase tracking-wider text-neon-blue">
                  {post.published_at ? formatDate(post.published_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU") : ""}
                </p>
                <h2 className="text-xl font-semibold text-white">
                  <Link href={localizedPath(locale, `/blog/${post.slug}`)} className="hover:text-neon-blue transition-colors">
                    {getTitle(post)}
                  </Link>
                </h2>
                <div
                  className="prose prose-invert prose-sm max-w-none text-white/60 line-clamp-4"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(getBody(post).slice(0, 500)) }}
                />
                <Link href={localizedPath(locale, `/blog/${post.slug}`)} className="inline-flex text-sm font-medium text-neon-blue">
                  {dictionary.common.learnMore}
                </Link>
              </div>
            </article>
          ))}
        </div>

        {items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0d0d15] p-8 text-center text-white/60">
            {locale === "ru" ? "Пока нет опубликованных постов." : "No published posts yet."}
          </div>
        )}
      </div>
    </div>
  );
}
