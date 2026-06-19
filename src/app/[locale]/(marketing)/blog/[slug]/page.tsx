import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import { BlogPostingSchema, FAQSchema } from "@/components/shared/structured-data";
import { getLocaleFromCookie } from "@/i18n/config";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_CONFIG } from "@/lib/constants";
import { localizedPath } from "@/lib/locale-path";
import { formatDate, slugify } from "@/lib/utils";
import type { BlogPost, Car } from "@/types/car";
import { BlogDetailClient, BlogFeedbackWidget } from "./blog-detail-client";
import { Clock, Calendar, ChevronRight, User } from "lucide-react";

async function fetchPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("*, author:blog_authors(*)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data as BlogPost | null;
}

async function fetchRelatedPosts(category: string | null, excludeId: string) {
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select("*, author:blog_authors(*)")
    .eq("is_published", true)
    .neq("id", excludeId);

  if (category) {
    query = query.eq("category", category);
  }

  const { data } = await query.order("published_at", { ascending: false }).limit(3);
  return (data || []) as BlogPost[];
}

async function fetchAdjacentPosts(publishedAt: string | null) {
  if (!publishedAt) return { next: null, prev: null };
  const supabase = await createClient();

  const { data: nextData } = await supabase
    .from("posts")
    .select("slug, title_ru, title_uz, title_en")
    .eq("is_published", true)
    .gt("published_at", publishedAt)
    .order("published_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: prevData } = await supabase
    .from("posts")
    .select("slug, title_ru, title_uz, title_en")
    .eq("is_published", true)
    .lt("published_at", publishedAt)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    next: nextData as BlogPost | null,
    prev: prevData as BlogPost | null,
  };
}

async function fetchMatchingCars(tags: string[] | null, title: string) {
  const supabase = await createClient();
  const brands = ["byd", "chery", "haval", "geely", "changan", "tank", "omoda", "jaecoo", "zeekr", "li", "lixiang", "xiaomi"];
  let matchedBrand = "";

  if (tags) {
    for (const tag of tags) {
      if (brands.includes(tag.toLowerCase())) {
        matchedBrand = tag;
        break;
      }
    }
  }

  if (!matchedBrand) {
    const titleLower = title.toLowerCase();
    for (const b of brands) {
      if (titleLower.includes(b)) {
        matchedBrand = b;
        break;
      }
    }
  }

  if (!matchedBrand) return [];

  const { data } = await supabase
    .from("cars")
    .select("id, brand, model, year, price_usd, images, thumbnail, slug")
    .ilike("brand", matchedBrand)
    .eq("inventory_status", "available")
    .limit(2);

  return (data || []) as Car[];
}

function extractHeadings(markdown: string) {
  const lines = markdown.split("\n");
  const headings: { text: string; id: string; level: number }[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/[*`_]/g, ""); // strip bold/italic markup in heading text
      headings.push({ text, id: slugify(text), level });
    }
  }
  return headings;
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

  const title = (locale === "uz" ? post.meta_title_uz || post.title_uz : locale === "en" ? post.meta_title_en || post.title_en : post.meta_title_ru || post.title_ru) || post.title_ru;
  const body = (locale === "uz" ? post.body_uz : locale === "en" ? post.body_en : post.body_ru) || post.body_ru;
  const description = (locale === "uz" ? post.meta_description_uz : locale === "en" ? post.meta_description_en : post.meta_description_ru) || post.meta_description_ru || body.slice(0, 160).replace(/[#*`>_\-\[\]()]/g, "");

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

  const headings = extractHeadings(body);
  const relatedPosts = await fetchRelatedPosts(post.category || null, post.id);
  const { next, prev } = await fetchAdjacentPosts(post.published_at);
  const matchingCars = await fetchMatchingCars(post.tags || null, title);
  const shareUrl = `${SITE_CONFIG.url}/${locale}/blog/${slug}`;

  // Translated constants
  const labels = {
    ru: {
      back: "К списку статей",
      related: "Похожие статьи",
      readTime: "мин. чтения",
      author: "Автор",
      published: "Опубликовано",
      updated: "Обновлено",
    },
    uz: {
      back: "Maqolalar ro'yxatiga",
      related: "O'xshash maqolalar",
      readTime: "daq. mutolaa",
      author: "Muallif",
      published: "Chop etilgan",
      updated: "Yangilangan",
    },
    en: {
      back: "Back to blog list",
      related: "Related Articles",
      readTime: "min read",
      author: "Author",
      published: "Published",
      updated: "Updated",
    },
  };
  const l = labels[locale] || labels.ru;

  const getAuthorBio = () => {
    if (!post.author) return "";
    return (locale === "uz" ? post.author.bio_uz : locale === "en" ? post.author.bio_en : post.author.bio_ru) || post.author.bio_ru;
  };

  const getTitle = (p: BlogPost) =>
    (locale === "uz" ? p.title_uz : locale === "en" ? p.title_en : p.title_ru) || p.title_ru;

  return (
    <div className="pt-24 pb-20">
      <div className="container-custom">
        {/* Navigation Breadcrumb */}
        <Link
          href={localizedPath(locale, "/blog")}
          className="text-xs font-mono uppercase tracking-wider text-primary mb-8 inline-flex items-center gap-1.5 hover:underline"
        >
          ← {l.back}
        </Link>

        {/* Hero Header */}
        <header className="space-y-6 mb-10 max-w-4xl">
          {post.category && (
            <span className="px-3 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider">
              {post.category === "ai"
                ? locale === "ru"
                  ? "ИИ и технологии"
                  : locale === "uz"
                  ? "AI va Texnologiyalar"
                  : "AI & Technology"
                : post.category === "guides"
                ? locale === "ru"
                  ? "Руководства по импорту"
                  : locale === "uz"
                  ? "Import yo'riqnomalari"
                  : "Import Guides"
                : locale === "ru"
                ? "Аналитика рынка"
                : locale === "uz"
                ? "Bozor tahlili"
                : "Market Analytics"}
            </span>
          )}

          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
            {title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 border-y border-border py-4 text-xs text-muted-foreground font-mono">
            {post.author && (
              <div className="flex items-center gap-2">
                {post.author.avatar_url ? (
                  <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border">
                    <Image src={post.author.avatar_url} alt={post.author.name} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {post.author.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="font-semibold text-foreground">{post.author.name}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {l.published}:{" "}
                {post.published_at
                  ? formatDate(post.published_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU")
                  : ""}
              </span>
            </div>

            {post.updated_at && post.updated_at !== post.created_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {l.updated}: {formatDate(post.updated_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU")}
                </span>
              </div>
            )}

            {post.read_time_minutes ? (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {post.read_time_minutes} {l.readTime}
                </span>
              </div>
            ) : null}
          </div>

          {post.cover_image && (
            <div className="relative w-full aspect-[21/9] border border-border overflow-hidden rounded-2xl shadow-sm">
              <Image
                src={post.cover_image}
                alt={title}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
        </header>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Article and Share bar */}
          <div className="flex-1 flex gap-0 xl:gap-8 max-w-3xl">
            {/* TOC & Share Client handles desktop share bar sidebar */}
            <BlogDetailClient headings={headings} shareUrl={shareUrl} shareTitle={title} locale={locale} />

            <article className="w-full">
              {/* Rich Markdown Render */}
              <div
                className="prose max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-p:leading-relaxed prose-li:text-foreground/85 prose-a:text-primary hover:prose-a:underline prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-foreground/5 prose-blockquote:p-4 prose-blockquote:rounded-r-xl prose-table:border-collapse prose-th:bg-foreground/5 prose-th:border prose-th:border-border prose-th:p-2 prose-td:border prose-td:border-border prose-td:p-2"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
              />

              {/* FAQ Section */}
              {post.faqs && post.faqs.length > 0 && (
                <div className="mt-16 border-t border-border pt-12">
                  <h3 className="text-xl font-bold text-foreground mb-6">
                    {locale === "ru" ? "Часто задаваемые вопросы" : locale === "uz" ? "Ko'p beriladigan savollar" : "Frequently Asked Questions"}
                  </h3>
                  <div className="space-y-4">
                    {post.faqs.map((faq, index) => {
                      const question = (locale === "uz" ? faq.question_uz : locale === "en" ? faq.question_en : faq.question_ru) || faq.question_ru;
                      const answer = (locale === "uz" ? faq.answer_uz : locale === "en" ? faq.answer_en : faq.answer_ru) || faq.answer_ru;
                      if (!question || !answer) return null;
                      return (
                        <details
                          key={index}
                          className="group border border-border bg-card hover:border-primary/30 rounded-xl overflow-hidden transition-all duration-300 [&_summary::-webkit-details-marker]:hidden"
                        >
                          <summary className="flex justify-between items-center p-4 text-sm font-bold text-foreground cursor-pointer select-none outline-none group-open:bg-foreground/5 transition-colors">
                            <span>{question}</span>
                            <span className="shrink-0 transition-transform duration-300 group-open:rotate-180 text-muted-foreground group-hover:text-primary">
                              <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </span>
                          </summary>
                          <div className="p-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 bg-foreground/[0.01]">
                            {answer}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Was this article helpful widget */}
              <BlogFeedbackWidget postSlug={slug} locale={locale} />

              {/* Author Bio Box */}
              {post.author && (
                <div className="mt-16 bg-card border border-border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm">
                  {post.author.avatar_url ? (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-border shrink-0">
                      <Image src={post.author.avatar_url} alt={post.author.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xl shrink-0">
                      {post.author.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{l.author}</span>
                        <h3 className="text-lg font-bold text-foreground">{post.author.name}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {getAuthorBio()}
                    </p>
                    <div className="flex gap-3 pt-2">
                      {post.author.twitter && (
                        <a
                          href={post.author.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-mono"
                        >
                          Twitter/X
                        </a>
                      )}
                      {post.author.linkedin && (
                        <a
                          href={post.author.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-mono"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sourced Cars Conversion Widget */}
              {matchingCars.length > 0 && (
                <div className="mt-16 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold block mb-1">
                        {locale === "ru" ? "Интегрированный импорт" : locale === "uz" ? "Integratsiyalashgan import" : "Integrated Sourcing"}
                      </span>
                      <h3 className="text-lg md:text-xl font-bold text-foreground">
                        {locale === "ru"
                          ? `Хотите привезти автомобиль марки ${matchingCars[0].brand}?`
                          : locale === "uz"
                          ? `${matchingCars[0].brand} rusumli avtomobil import qilmoqchimisiz?`
                          : `Interested in importing a ${matchingCars[0].brand}?`}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {locale === "ru"
                          ? "Мы подберем, доставим и растаможим любой электромобиль или гибрид под ключ."
                          : locale === "uz"
                          ? "Biz istalgan elektromobil yoki gibridni kalit topshirish sharti bilan tanlab, yetkazib beramiz."
                          : "We source, ship, and clear customs for any EV or hybrid turn-key."}
                      </p>
                    </div>
                    <Link
                      href={localizedPath(locale, `/catalog?search=${matchingCars[0].brand}`)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 transition-all shadow-sm shadow-primary/20"
                    >
                      {locale === "ru" ? "Смотреть все" : locale === "uz" ? "Barchasini ko'rish" : "View all"}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {matchingCars.map((car) => (
                      <div
                        key={car.id}
                        className="group/car bg-card border border-border rounded-xl p-4 flex gap-4 items-center hover:border-primary/30 transition-all"
                      >
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0">
                          <Image
                            src={car.thumbnail || car.images?.[0] || "/images/placeholder.jpg"}
                            alt={`${car.brand} ${car.model}`}
                            fill
                            className="object-cover group-hover/car:scale-105 transition-transform"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {car.brand} {car.model}
                          </h4>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {car.year} · ${car.price_usd.toLocaleString()}
                          </p>
                          <Link
                            href={localizedPath(locale, `/catalog/${car.slug}`)}
                            className="text-[10px] font-bold text-primary hover:underline mt-1 inline-flex items-center gap-0.5"
                          >
                            {locale === "ru" ? "Подробнее" : locale === "uz" ? "Batafsil" : "Details"}
                            <ChevronRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next/Prev Navigation */}
              {(prev || next) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-12 mt-12">
                  {prev ? (
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                        ← {locale === "ru" ? "Предыдущая статья" : locale === "uz" ? "Oldingi maqola" : "Previous Post"}
                      </span>
                      <Link
                        href={localizedPath(locale, `/blog/${prev.slug}`)}
                        className="text-sm font-bold text-foreground hover:text-primary transition-colors block line-clamp-2"
                      >
                        {getTitle(prev)}
                      </Link>
                    </div>
                  ) : (
                    <div />
                  )}

                  {next ? (
                    <div className="space-y-2 text-right">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                        {locale === "ru" ? "Следующая статья" : locale === "uz" ? "Keyingi maqola" : "Next Post"} →
                      </span>
                      <Link
                        href={localizedPath(locale, `/blog/${next.slug}`)}
                        className="text-sm font-bold text-foreground hover:text-primary transition-colors block line-clamp-2"
                      >
                        {getTitle(next)}
                      </Link>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              )}
            </article>
          </div>
        </div>

        {/* Related Articles Section */}
        {relatedPosts.length > 0 && (
          <section className="mt-20 border-t border-border pt-16">
            <h3 className="text-xl font-bold text-foreground mb-8 font-mono uppercase tracking-wider">
              {l.related}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((rPost) => (
                <article
                  key={rPost.id}
                  className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300"
                >
                  {rPost.cover_image && (
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image
                        src={rPost.cover_image}
                        alt={getTitle(rPost)}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                      {rPost.published_at ? formatDate(rPost.published_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU") : ""}
                    </p>
                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-4 leading-snug">
                      <Link href={localizedPath(locale, `/blog/${rPost.slug}`)}>
                        {getTitle(rPost)}
                      </Link>
                    </h4>
                    <Link
                      href={localizedPath(locale, `/blog/${rPost.slug}`)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors mt-auto"
                    >
                      {locale === "ru" ? "Читать" : locale === "uz" ? "O'qish" : "Read"}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* JSON-LD Schemas */}
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: locale === "ru" ? "Блог" : "Blog", url: `${SITE_CONFIG.url}/${locale}/blog` },
          { name: title, url: `${SITE_CONFIG.url}/${locale}/blog/${slug}` },
        ]}
      />
      <BlogPostingSchema
        headline={title}
        image={post.cover_image || undefined}
        datePublished={post.published_at || post.created_at}
        dateModified={post.updated_at || post.published_at || post.created_at}
        url={shareUrl}
        description={body.slice(0, 160).replace(/[#*`>_\-\[\]()]/g, "")}
        authorName={post.author?.name}
        authorAvatar={post.author?.avatar_url || undefined}
        authorSocials={
          post.author
            ? [post.author.twitter, post.author.linkedin].filter(Boolean) as string[]
            : undefined
        }
      />
      {post.faqs && post.faqs.length > 0 && (
        <FAQSchema
          faqs={post.faqs.map((faq) => ({
            question: (locale === "uz" ? faq.question_uz : locale === "en" ? faq.question_en : faq.question_ru) || faq.question_ru,
            answer: (locale === "uz" ? faq.answer_uz : locale === "en" ? faq.answer_en : faq.answer_ru) || faq.answer_ru,
          }))}
        />
      )}
    </div>
  );
}
