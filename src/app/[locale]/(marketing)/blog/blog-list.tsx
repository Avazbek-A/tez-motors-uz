"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Calendar, Clock, BookOpen, ChevronRight } from "lucide-react";
import type { BlogPost } from "@/types/car";
import { formatDate } from "@/lib/utils";
import { localizedPath } from "@/lib/locale-path";
import { Newsletter } from "@/components/shared/newsletter";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const escapedQuery = escapeRegExp(query.trim());
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground font-medium rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface BlogListProps {
  posts: BlogPost[];
  locale: "ru" | "uz" | "en";
  dictionary: any;
  initialCategory?: string;
}

const CATEGORIES = {
  ru: [
    { id: "all", name: "Все статьи" },
    { id: "ai", name: "ИИ и технологии" },
    { id: "guides", name: "Руководства по импорту" },
    { id: "analytics", name: "Аналитика рынка" },
  ],
  uz: [
    { id: "all", name: "Barcha maqolalar" },
    { id: "ai", name: "AI va Texnologiyalar" },
    { id: "guides", name: "Import yo'riqnomalari" },
    { id: "analytics", name: "Bozor tahlili" },
  ],
  en: [
    { id: "all", name: "All Articles" },
    { id: "ai", name: "AI & Technology" },
    { id: "guides", name: "Import Guides" },
    { id: "analytics", name: "Market Analytics" },
  ],
};

const TEXT = {
  ru: {
    searchPlaceholder: "Поиск экспертных статей...",
    featured: "Главный материал",
    readTime: "мин. чтения",
    noResults: "По вашему запросу ничего не найдено.",
    learnMore: "Читать далее",
    writtenBy: "Автор",
  },
  uz: {
    searchPlaceholder: "Ekspert maqolalarini qidirish...",
    featured: "Asosiy maqola",
    readTime: "daq. mutolaa",
    noResults: "Sizning so'rovingiz bo'yicha hech narsa topilmadi.",
    learnMore: "Batafsil",
    writtenBy: "Muallif",
  },
  en: {
    searchPlaceholder: "Search expert articles...",
    featured: "Featured Material",
    readTime: "min read",
    noResults: "No articles found matching your query.",
    learnMore: "Read more",
    writtenBy: "Written by",
  },
};

export function BlogList({ posts, locale, dictionary, initialCategory = "all" }: BlogListProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (catId === "all") {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", catId);
      }
      window.history.pushState({}, "", url.pathname + url.search);
    }
  };
  const t = TEXT[locale] || TEXT.ru;
  const categories = CATEGORIES[locale] || CATEGORIES.ru;

  const getTitle = (post: BlogPost) =>
    (locale === "uz" ? post.title_uz : locale === "en" ? post.title_en : post.title_ru) || post.title_ru;

  const getBodySnippet = (post: BlogPost) => {
    const body = (locale === "uz" ? post.body_uz : locale === "en" ? post.body_en : post.body_ru) || post.body_ru;
    // Strip markdown formatting for a clean summary snippet
    const cleanText = body
      .replace(/[#*`>_\-\[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleanText.slice(0, 160) + (cleanText.length > 160 ? "..." : "");
  };

  const getCategoryName = (catId?: string | null) => {
    if (!catId) return "";
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const title = getTitle(post).toLowerCase();
      const body = ((locale === "uz" ? post.body_uz : locale === "en" ? post.body_en : post.body_ru) || post.body_ru).toLowerCase();
      const matchesSearch = title.includes(search.toLowerCase()) || body.includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [posts, search, selectedCategory, locale]);

  // The first post of the filtered list is treated as the Featured Post if there's no active search
  const featuredPost = useMemo(() => {
    if (search || selectedCategory !== "all") return null;
    return filteredPosts[0] || null;
  }, [filteredPosts, search, selectedCategory]);

  const regularPosts = useMemo(() => {
    if (featuredPost) {
      return filteredPosts.slice(1);
    }
    return filteredPosts;
  }, [filteredPosts, featuredPost]);

  return (
    <div className="space-y-12">
      {/* Search & Category Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card border border-border p-4 rounded-2xl shadow-sm">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-foreground/5 border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Featured Post Card */}
      {featuredPost && (
        <article className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-md hover:border-primary/40 transition-all duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            {featuredPost.cover_image && (
              <div className="relative lg:col-span-7 h-64 md:h-96 w-full overflow-hidden">
                <Image
                  src={featuredPost.cover_image}
                  alt={getTitle(featuredPost)}
                  fill
                  priority
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent lg:hidden" />
              </div>
            )}
            <div className={`p-8 md:p-10 flex flex-col justify-center lg:col-span-5 ${featuredPost.cover_image ? "" : "lg:col-span-12"}`}>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground/80 mb-4">
                <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-bold tracking-wide uppercase">
                  {t.featured}
                </span>
                {featuredPost.category && (
                  <span className="text-foreground/80 font-semibold uppercase tracking-wider">
                    {getCategoryName(featuredPost.category)}
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors mb-4">
                <Link href={localizedPath(locale, `/blog/${featuredPost.slug}`)}>
                  <Highlight text={getTitle(featuredPost)} query={search} />
                </Link>
              </h2>

              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                <Highlight text={getBodySnippet(featuredPost)} query={search} />
              </p>

              <div className="flex items-center justify-between border-t border-border pt-6 mt-auto">
                <div className="flex items-center gap-3">
                  {featuredPost.author?.avatar_url ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border">
                      <Image src={featuredPost.author.avatar_url} alt={featuredPost.author.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {featuredPost.author?.name?.slice(0, 2).toUpperCase() || "TM"}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      {featuredPost.author?.name || "Tez Motors"}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                      {t.writtenBy}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {featuredPost.published_at
                        ? formatDate(featuredPost.published_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU")
                        : ""}
                    </span>
                  </div>
                  {featuredPost.read_time_minutes ? (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {featuredPost.read_time_minutes} {t.readTime}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </article>
      )}

      {/* Grid of Articles */}
      {filteredPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regularPosts.map((post, idx) => {
            const isNewsletterSlot = idx === 1; // Insert newsletter widget as the second card in the grid
            return (
              <div key={post.id} className="contents">
                <article className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300">
                  {post.cover_image && (
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={post.cover_image}
                        alt={getTitle(post)}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                      {post.category && (
                        <div className="absolute top-4 left-4">
                          <span className="px-2 py-1 rounded-md bg-background/90 backdrop-blur-sm border border-border text-[10px] font-bold text-foreground uppercase tracking-wider">
                            {getCategoryName(post.category)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {post.published_at
                            ? formatDate(post.published_at, locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU")
                            : ""}
                        </span>
                      </div>
                      {post.read_time_minutes ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {post.read_time_minutes} {t.readTime}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <h3 className="text-lg font-bold leading-snug text-foreground group-hover:text-primary transition-colors mb-3 line-clamp-2">
                      <Link href={localizedPath(locale, `/blog/${post.slug}`)}>
                        <Highlight text={getTitle(post)} query={search} />
                      </Link>
                    </h3>

                    <p className="text-muted-foreground text-xs leading-relaxed mb-6 line-clamp-3">
                      <Highlight text={getBodySnippet(post)} query={search} />
                    </p>

                    <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
                      <div className="flex items-center gap-2">
                        {post.author?.avatar_url ? (
                          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border">
                            <Image src={post.author.avatar_url} alt={post.author.name} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {post.author?.name?.slice(0, 2).toUpperCase() || "TM"}
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-foreground">
                          {post.author?.name || "Tez Motors"}
                        </span>
                      </div>

                      <Link
                        href={localizedPath(locale, `/blog/${post.slug}`)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        {t.learnMore}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </article>

                {/* Newsletter Box Insertion */}
                {isNewsletterSlot && (
                  <div className="md:col-span-2 lg:col-span-1 flex flex-col justify-center">
                    <Newsletter />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-border bg-card rounded-2xl p-12 text-center text-muted-foreground shadow-sm">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-base font-medium">{t.noResults}</p>
        </div>
      )}
    </div>
  );
}
