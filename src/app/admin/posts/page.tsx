"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlogPost, BlogFAQ } from "@/types/car";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const getWordCount = (text: string) => {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
};

const COPY: Record<Locale, {
  title: string;
  subtitle: string;
  refresh: string;
  newPost: string;
  editPost: string;
  createPost: string;
  draftWithAI: string;
  drafting: string;
  blogTopicPrompt: string;
  slug: string;
  titleRu: string;
  titleUz: string;
  titleEn: string;
  coverImage: string;
  bodyRu: string;
  bodyUz: string;
  bodyEn: string;
  published: string;
  save: string;
  cancel: string;
  failedToSave: string;
  networkError: string;
  existingPosts: string;
  loading: string;
  noPosts: string;
  copyUuidTitle: string;
  draft: string;
  edit: string;
  deleteConfirm: string;
}> = {
  ru: {
    title: "Статьи",
    subtitle: "Публикуйте контент блога для SEO и низкочастотного трафика.",
    refresh: "Обновить",
    newPost: "Новая статья",
    editPost: "Редактировать статью",
    createPost: "Создать статью",
    draftWithAI: "✨ Черновик с ИИ",
    drafting: "Создание черновика…",
    blogTopicPrompt: "Тема статьи? (ИИ подготовит черновик на русском)",
    slug: "Slug",
    titleRu: "Заголовок RU",
    titleUz: "Заголовок UZ",
    titleEn: "Заголовок EN",
    coverImage: "URL обложки",
    bodyRu: "Текст RU (markdown)",
    bodyUz: "Текст UZ (markdown)",
    bodyEn: "Текст EN (markdown)",
    published: "Опубликовано",
    save: "Сохранить",
    cancel: "Отмена",
    failedToSave: "Не удалось сохранить статью",
    networkError: "Ошибка сети",
    existingPosts: "Существующие статьи",
    loading: "Загрузка...",
    noPosts: "Статей пока нет.",
    copyUuidTitle: "Нажмите, чтобы скопировать UUID",
    draft: "Черновик",
    edit: "Редактировать",
    deleteConfirm: "Удалить эту статью?",
  },
  uz: {
    title: "Maqolalar",
    subtitle: "SEO va past chastotali trafik uchun blog kontentini chop eting.",
    refresh: "Yangilash",
    newPost: "Yangi maqola",
    editPost: "Maqolani tahrirlash",
    createPost: "Maqola yaratish",
    draftWithAI: "✨ AI bilan qoralama",
    drafting: "Qoralama tayyorlanmoqda…",
    blogTopicPrompt: "Maqola mavzusi? (AI rus tilida qoralama tayyorlaydi)",
    slug: "Slug",
    titleRu: "Sarlavha RU",
    titleUz: "Sarlavha UZ",
    titleEn: "Sarlavha EN",
    coverImage: "Muqova rasm URL",
    bodyRu: "Matn RU (markdown)",
    bodyUz: "Matn UZ (markdown)",
    bodyEn: "Matn EN (markdown)",
    published: "Chop etilgan",
    save: "Saqlash",
    cancel: "Bekor qilish",
    failedToSave: "Maqolani saqlab bo'lmadi",
    networkError: "Tarmoq xatosi",
    existingPosts: "Mavjud maqolalar",
    loading: "Yuklanmoqda...",
    noPosts: "Hozircha maqolalar yo'q.",
    copyUuidTitle: "UUID nusxalash uchun bosing",
    draft: "Qoralama",
    edit: "Tahrirlash",
    deleteConfirm: "Ushbu maqola o'chirilsinmi?",
  },
  en: {
    title: "Posts",
    subtitle: "Publish blog content for SEO and long-tail traffic.",
    refresh: "Refresh",
    newPost: "New Post",
    editPost: "Edit Post",
    createPost: "Create Post",
    draftWithAI: "✨ Draft with AI",
    drafting: "Drafting…",
    blogTopicPrompt: "Blog topic? (the AI will draft a Russian post)",
    slug: "Slug",
    titleRu: "Title RU",
    titleUz: "Title UZ",
    titleEn: "Title EN",
    coverImage: "Cover image URL",
    bodyRu: "Body RU (markdown)",
    bodyUz: "Body UZ (markdown)",
    bodyEn: "Body EN (markdown)",
    published: "Published",
    save: "Save",
    cancel: "Cancel",
    failedToSave: "Failed to save post",
    networkError: "Network error",
    existingPosts: "Existing Posts",
    loading: "Loading...",
    noPosts: "No posts yet.",
    copyUuidTitle: "Click to copy UUID",
    draft: "Draft",
    edit: "Edit",
    deleteConfirm: "Delete this post?",
  },
};

type Draft = {
  slug: string;
  title_ru: string;
  title_uz: string;
  title_en: string;
  body_ru: string;
  body_uz: string;
  body_en: string;
  cover_image: string;
  is_published: boolean;
  category: string;
  tags_input: string;
  read_time_minutes: string;
  meta_title_ru: string;
  meta_title_uz: string;
  meta_title_en: string;
  meta_description_ru: string;
  meta_description_uz: string;
  meta_description_en: string;
  faqs: BlogFAQ[];
};

const EMPTY: Draft = {
  slug: "",
  title_ru: "",
  title_uz: "",
  title_en: "",
  body_ru: "",
  body_uz: "",
  body_en: "",
  cover_image: "",
  is_published: false,
  category: "",
  tags_input: "",
  read_time_minutes: "",
  meta_title_ru: "",
  meta_title_uz: "",
  meta_title_en: "",
  meta_description_ru: "",
  meta_description_uz: "",
  meta_description_en: "",
  faqs: [],
};

export default function AdminPostsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [genPost, setGenPost] = useState(false);
  const [translating, setTranslating] = useState<Record<string, boolean>>({});

  const handleBodyRuChange = (val: string) => {
    const wordCount = getWordCount(val);
    const suggestedReadTime = Math.max(1, Math.ceil(wordCount / 200));

    setDraft((prev) => {
      const prevWordCount = getWordCount(prev.body_ru);
      const prevSuggested = prevWordCount > 0 ? Math.max(1, Math.ceil(prevWordCount / 200)) : 0;
      const isAutoCalculated = !prev.read_time_minutes || String(prevSuggested) === prev.read_time_minutes;

      return {
        ...prev,
        body_ru: val,
        read_time_minutes: isAutoCalculated && val ? String(suggestedReadTime) : prev.read_time_minutes,
      };
    });
  };

  const fetchPosts = () => {
    setLoading(true);
    fetch("/api/posts?all=true")
      .then((r) => r.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    if (editing) {
      setShowEditor(true);
      setDraft({
        slug: editing.slug,
        title_ru: editing.title_ru,
        title_uz: editing.title_uz || "",
        title_en: editing.title_en || "",
        body_ru: editing.body_ru,
        body_uz: editing.body_uz || "",
        body_en: editing.body_en || "",
        cover_image: editing.cover_image || "",
        is_published: editing.is_published,
        category: editing.category || "",
        tags_input: editing.tags ? editing.tags.join(", ") : "",
        read_time_minutes: editing.read_time_minutes ? String(editing.read_time_minutes) : "",
        meta_title_ru: editing.meta_title_ru || "",
        meta_title_uz: editing.meta_title_uz || "",
        meta_title_en: editing.meta_title_en || "",
        meta_description_ru: editing.meta_description_ru || "",
        meta_description_uz: editing.meta_description_uz || "",
        meta_description_en: editing.meta_description_en || "",
        faqs: editing.faqs || [],
      });
    } else {
      setDraft(EMPTY);
    }
  }, [editing]);

  const savePost = async () => {
    setSaving(true);
    setError(null);
    const tags = draft.tags_input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const readTimeNum = draft.read_time_minutes ? parseInt(draft.read_time_minutes, 10) : null;

    const payload = {
      ...draft,
      title_uz: draft.title_uz || null,
      title_en: draft.title_en || null,
      body_uz: draft.body_uz || null,
      body_en: draft.body_en || null,
      cover_image: draft.cover_image || null,
      category: draft.category || null,
      tags: tags.length > 0 ? tags : null,
      read_time_minutes: isNaN(readTimeNum as number) ? null : readTimeNum,
      meta_title_ru: draft.meta_title_ru || null,
      meta_title_uz: draft.meta_title_uz || null,
      meta_title_en: draft.meta_title_en || null,
      meta_description_ru: draft.meta_description_ru || null,
      meta_description_uz: draft.meta_description_uz || null,
      meta_description_en: draft.meta_description_en || null,
      faqs: draft.faqs || [],
    };
    try {
      const res = await fetch(editing ? `/api/posts/${editing.id}` : "/api/posts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t.failedToSave);
        return;
      }
      setEditing(null);
      setShowEditor(false);
      fetchPosts();
    } catch {
      setError(t.networkError);
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) fetchPosts();
  };

  const [translatingAll, setTranslatingAll] = useState(false);

  const translateField = async (field: "title_uz" | "title_en" | "body_uz" | "body_en", sourceText: string, targetLocale: "uz" | "en") => {
    if (!sourceText) return;
    setTranslating((prev) => ({ ...prev, [field]: true }));
    try {
      const res = await fetch("/api/admin/posts/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, targetLocale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.translated) {
        setDraft((d) => ({ ...d, [field]: data.translated }));
      }
    } catch {
      // silent
    } finally {
      setTranslating((prev) => ({ ...prev, [field]: false }));
    }
  };

  const translateFaqField = async (index: number, field: "question" | "answer", targetLocale: "uz" | "en", sourceText: string) => {
    if (!sourceText) return;
    const translateKey = `faq-${index}-${field}-${targetLocale}`;
    setTranslating((prev) => ({ ...prev, [translateKey]: true }));
    try {
      const res = await fetch("/api/admin/posts/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, targetLocale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.translated) {
        setDraft((d) => {
          const updatedFaqs = [...d.faqs];
          if (updatedFaqs[index]) {
            const destKey = field === "question"
              ? (targetLocale === "uz" ? "question_uz" : "question_en")
              : (targetLocale === "uz" ? "answer_uz" : "answer_en");
            updatedFaqs[index] = {
              ...updatedFaqs[index],
              [destKey]: data.translated,
            };
          }
          return { ...d, faqs: updatedFaqs };
        });
      }
    } catch {
      // silent
    } finally {
      setTranslating((prev) => ({ ...prev, [translateKey]: false }));
    }
  };

  const translateAllFields = async () => {
    if (!draft.title_ru && !draft.body_ru && (!draft.faqs || draft.faqs.length === 0)) return;
    setTranslatingAll(true);
    try {
      const promises = [];
      if (draft.title_ru) {
        promises.push(
          translateField("title_uz", draft.title_ru, "uz"),
          translateField("title_en", draft.title_ru, "en")
        );
      }
      if (draft.body_ru) {
        promises.push(
          translateField("body_uz", draft.body_ru, "uz"),
          translateField("body_en", draft.body_ru, "en")
        );
      }
      if (draft.faqs && draft.faqs.length > 0) {
        draft.faqs.forEach((faq, index) => {
          if (faq.question_ru) {
            promises.push(
              translateFaqField(index, "question", "uz", faq.question_ru),
              translateFaqField(index, "question", "en", faq.question_ru)
            );
          }
          if (faq.answer_ru) {
            promises.push(
              translateFaqField(index, "answer", "uz", faq.answer_ru),
              translateFaqField(index, "answer", "en", faq.answer_ru)
            );
          }
        });
      }
      await Promise.all(promises);
    } catch {
      // silent
    } finally {
      setTranslatingAll(false);
    }
  };

  // Locale translation for translate buttons
  const trLabel = {
    ru: { translate: "✨ Перевести с RU", translating: "Перевод...", translateAll: "✨ Перевести все на UZ и EN", translatingAll: "Перевод всех полей..." },
    uz: { translate: "✨ RUdan tarjima qilish", translating: "Tarjima...", translateAll: "✨ Hammasini UZ va ENga tarjima qilish", translatingAll: "Tarjima..." },
    en: { translate: "✨ Translate from RU", translating: "Translating...", translateAll: "✨ Translate All to UZ & EN", translatingAll: "Translating all..." },
  }[locale] || { translate: "✨ Translate from RU", translating: "Translating...", translateAll: "✨ Translate All to UZ & EN", translatingAll: "Translating all..." };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPosts}>
            <RefreshCw className="w-4 h-4" />
            {t.refresh}
          </Button>
          <Button onClick={() => { setEditing(null); setDraft(EMPTY); setShowEditor(true); }}>
            <Plus className="w-4 h-4" />
            {t.newPost}
          </Button>
        </div>
      </div>

      {showEditor && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? t.editPost : t.createPost}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-center">
              <button
                type="button"
                disabled={genPost}
                onClick={async () => {
                  const topic = window.prompt(t.blogTopicPrompt);
                  if (!topic) return;
                  setGenPost(true);
                  try {
                    const res = await fetch("/api/admin/posts/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ topic }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.title) {
                      const bodyVal = data.content || "";
                      const wordCount = getWordCount(bodyVal);
                      const suggested = Math.max(1, Math.ceil(wordCount / 200));
                      setDraft((d) => {
                        const prevWords = getWordCount(d.body_ru);
                        const prevSuggested = prevWords > 0 ? Math.max(1, Math.ceil(prevWords / 200)) : 0;
                        const isAutoCalculated = !d.read_time_minutes || String(prevSuggested) === d.read_time_minutes;
                        return {
                          ...d,
                          title_ru: data.title,
                          body_ru: bodyVal,
                          read_time_minutes: isAutoCalculated && bodyVal ? String(suggested) : d.read_time_minutes,
                        };
                      });
                    }
                  } finally {
                    setGenPost(false);
                  }
                }}
                className="text-xs text-primary font-mono hover:underline disabled:opacity-50"
              >
                {genPost ? t.drafting : t.draftWithAI}
              </button>

              <button
                type="button"
                disabled={translatingAll || (!draft.title_ru && !draft.body_ru)}
                onClick={translateAllFields}
                className="text-xs text-primary font-mono hover:underline disabled:opacity-50"
              >
                {translatingAll ? trLabel.translatingAll : trLabel.translateAll}
              </button>
            </div>

            {/* Post Settings Section */}
            <div className="bg-foreground/5 p-4 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-foreground/80 border-b border-border pb-2">
                {locale === "ru" ? "Настройки и категоризация" : locale === "uz" ? "Sozlamalar va toifalar" : "Settings & Categorization"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t.slug}</span>
                  <Input placeholder="my-expert-article" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t.coverImage}</span>
                  <Input placeholder="https://image-url.com/cover.jpg" value={draft.cover_image} onChange={(e) => setDraft({ ...draft, cover_image: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{locale === "ru" ? "Категория" : locale === "uz" ? "Toifa" : "Category"}</span>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">{locale === "ru" ? "Без категории" : locale === "uz" ? "Toifasiz" : "No Category"}</option>
                    <option value="ai">{locale === "ru" ? "ИИ и технологии" : locale === "uz" ? "AI va Texnologiyalar" : "AI & Technology"}</option>
                    <option value="guides">{locale === "ru" ? "Руководства по импорту" : locale === "uz" ? "Import yo'riqnomalari" : "Import Guides"}</option>
                    <option value="analytics">{locale === "ru" ? "Аналитика рынка" : locale === "uz" ? "Bozor tahlili" : "Market Analytics"}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{locale === "ru" ? "Теги (через запятую)" : locale === "uz" ? "Teglar (vergul bilan)" : "Tags (comma separated)"}</span>
                    <Input placeholder="byd, import, ai" value={draft.tags_input} onChange={(e) => setDraft({ ...draft, tags_input: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{locale === "ru" ? "Время чтения (мин)" : locale === "uz" ? "O'qish vaqti (daq)" : "Read time (min)"}</span>
                      {draft.body_ru && (
                        <button
                          type="button"
                          onClick={() => {
                            const suggested = Math.max(1, Math.ceil(getWordCount(draft.body_ru) / 200));
                            setDraft((d) => ({ ...d, read_time_minutes: String(suggested) }));
                          }}
                          className="text-[10px] text-primary hover:underline font-mono"
                        >
                          {locale === "ru" ? "Авто" : locale === "uz" ? "Avto" : "Auto"}
                        </button>
                      )}
                    </div>
                    <Input type="number" placeholder="5" value={draft.read_time_minutes} onChange={(e) => setDraft({ ...draft, read_time_minutes: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Russian Content */}
            <div className="space-y-3 border-l-2 border-red-500/30 pl-4 py-1">
              <h4 className="text-xs font-mono uppercase text-muted-foreground">Russian (Primary)</h4>
              <Input placeholder={t.titleRu} value={draft.title_ru} onChange={(e) => setDraft({ ...draft, title_ru: e.target.value })} />
              <Textarea placeholder={t.bodyRu} value={draft.body_ru} onChange={(e) => handleBodyRuChange(e.target.value)} rows={10} />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono mt-1">
                <span>
                  {locale === "ru" ? `Слов: ${getWordCount(draft.body_ru)}` : locale === "uz" ? `So'zlar: ${getWordCount(draft.body_ru)}` : `Words: ${getWordCount(draft.body_ru)}`}
                </span>
                {draft.body_ru && (
                  <span>
                    {locale === "ru" ? `Рекомендуемое время: ${Math.max(1, Math.ceil(getWordCount(draft.body_ru) / 200))} мин.` : locale === "uz" ? `Tavsiya etilgan vaqt: ${Math.max(1, Math.ceil(getWordCount(draft.body_ru) / 200))} daq.` : `Recommended time: ${Math.max(1, Math.ceil(getWordCount(draft.body_ru) / 200))} min`}
                  </span>
                )}
              </div>
            </div>

            {/* Uzbek Content */}
            <div className="space-y-3 border-l-2 border-blue-500/30 pl-4 py-1">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-mono uppercase text-muted-foreground">Uzbek (Latin)</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={translating.title_uz || !draft.title_ru}
                    onClick={() => translateField("title_uz", draft.title_ru, "uz")}
                    className="text-[11px] font-mono text-primary hover:underline disabled:opacity-50"
                  >
                    {translating.title_uz ? trLabel.translating : trLabel.translate + " (Заголовок)"}
                  </button>
                  <button
                    type="button"
                    disabled={translating.body_uz || !draft.body_ru}
                    onClick={() => translateField("body_uz", draft.body_ru, "uz")}
                    className="text-[11px] font-mono text-primary hover:underline disabled:opacity-50"
                  >
                    {translating.body_uz ? trLabel.translating : trLabel.translate + " (Текст)"}
                  </button>
                </div>
              </div>
              <Input placeholder={t.titleUz} value={draft.title_uz} onChange={(e) => setDraft({ ...draft, title_uz: e.target.value })} />
              <Textarea placeholder={t.bodyUz} value={draft.body_uz} onChange={(e) => setDraft({ ...draft, body_uz: e.target.value })} rows={6} />
              <div className="text-[10px] text-muted-foreground font-mono mt-1">
                {locale === "ru" ? `Слов: ${getWordCount(draft.body_uz)}` : locale === "uz" ? `So'zlar: ${getWordCount(draft.body_uz)}` : `Words: ${getWordCount(draft.body_uz)}`}
              </div>
            </div>

            {/* English Content */}
            <div className="space-y-3 border-l-2 border-emerald-500/30 pl-4 py-1">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-mono uppercase text-muted-foreground">English</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={translating.title_en || !draft.title_ru}
                    onClick={() => translateField("title_en", draft.title_ru, "en")}
                    className="text-[11px] font-mono text-primary hover:underline disabled:opacity-50"
                  >
                    {translating.title_en ? trLabel.translating : trLabel.translate + " (Заголовок)"}
                  </button>
                  <button
                    type="button"
                    disabled={translating.body_en || !draft.body_ru}
                    onClick={() => translateField("body_en", draft.body_ru, "en")}
                    className="text-[11px] font-mono text-primary hover:underline disabled:opacity-50"
                  >
                    {translating.body_en ? trLabel.translating : trLabel.translate + " (Текст)"}
                  </button>
                </div>
              </div>
              <Input placeholder={t.titleEn} value={draft.title_en} onChange={(e) => setDraft({ ...draft, title_en: e.target.value })} />
              <Textarea placeholder={t.bodyEn} value={draft.body_en} onChange={(e) => setDraft({ ...draft, body_en: e.target.value })} rows={6} />
              <div className="text-[10px] text-muted-foreground font-mono mt-1">
                {locale === "ru" ? `Слов: ${getWordCount(draft.body_en)}` : locale === "uz" ? `So'zlar: ${getWordCount(draft.body_en)}` : `Words: ${getWordCount(draft.body_en)}`}
              </div>
            </div>

            {/* FAQ Manager */}
            <div className="bg-foreground/5 p-4 rounded-xl space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground/80">
                  {locale === "ru" ? "Часто задаваемые вопросы (FAQ)" : locale === "uz" ? "Ko'p beriladigan savollar (FAQ)" : "Frequently Asked Questions (FAQ)"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      faqs: [
                        ...(d.faqs || []),
                        {
                          question_ru: "",
                          question_uz: "",
                          question_en: "",
                          answer_ru: "",
                          answer_uz: "",
                          answer_en: "",
                        },
                      ],
                    }));
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/95 hover:shadow-sm transition-all"
                >
                  + {locale === "ru" ? "Добавить вопрос" : locale === "uz" ? "Savol qo'shish" : "Add FAQ Item"}
                </button>
              </div>

              {(!draft.faqs || draft.faqs.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {locale === "ru" ? "FAQ еще не добавлены" : locale === "uz" ? "FAQ hali qo'shilmagan" : "No FAQs added yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {draft.faqs.map((faq, index) => (
                    <div key={index} className="bg-background border border-border p-4 rounded-lg relative space-y-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft((d) => {
                            const updated = [...(d.faqs || [])];
                            updated.splice(index, 1);
                            return { ...d, faqs: updated };
                          });
                        }}
                        className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-600 font-mono"
                      >
                        {locale === "ru" ? "Удалить" : locale === "uz" ? "O'chirish" : "Delete"}
                      </button>

                      <div className="text-xs font-bold text-muted-foreground">
                        FAQ #{index + 1}
                      </div>

                      {/* Question RU */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-mono text-muted-foreground">Вопрос (RU)</span>
                          <Input
                            placeholder="Например: Какова дальность хода автомобиля?"
                            value={faq.question_ru}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((d) => {
                                const updated = [...(d.faqs || [])];
                                if (updated[index]) updated[index].question_ru = val;
                                return { ...d, faqs: updated };
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-mono text-muted-foreground">Ответ (RU)</span>
                          <Textarea
                            placeholder="Ответ на русском языке..."
                            value={faq.answer_ru}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((d) => {
                                const updated = [...(d.faqs || [])];
                                if (updated[index]) updated[index].answer_ru = val;
                                return { ...d, faqs: updated };
                              });
                            }}
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Question & Answer UZ */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border/50 pt-2 mt-2">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-mono text-muted-foreground">Savol (UZ)</span>
                            <button
                              type="button"
                              disabled={translating[`faq-${index}-question-uz`] || !faq.question_ru}
                              onClick={() => translateFaqField(index, "question", "uz", faq.question_ru)}
                              className="text-[9px] font-mono text-primary hover:underline disabled:opacity-50"
                            >
                              {translating[`faq-${index}-question-uz`] ? "..." : "✨ tarjima"}
                            </button>
                          </div>
                          <Input
                            placeholder="Savol o'zbek tilida..."
                            value={faq.question_uz || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((d) => {
                                const updated = [...(d.faqs || [])];
                                if (updated[index]) updated[index].question_uz = val;
                                return { ...d, faqs: updated };
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-mono text-muted-foreground">Javob (UZ)</span>
                            <button
                              type="button"
                              disabled={translating[`faq-${index}-answer-uz`] || !faq.answer_ru}
                              onClick={() => translateFaqField(index, "answer", "uz", faq.answer_ru)}
                              className="text-[9px] font-mono text-primary hover:underline disabled:opacity-50"
                            >
                              {translating[`faq-${index}-answer-uz`] ? "..." : "✨ tarjima"}
                            </button>
                          </div>
                          <Textarea
                            placeholder="Javob o'zbek tilida..."
                            value={faq.answer_uz || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((d) => {
                                const updated = [...(d.faqs || [])];
                                if (updated[index]) updated[index].answer_uz = val;
                                return { ...d, faqs: updated };
                              });
                            }}
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Question & Answer EN */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border/50 pt-2 mt-2">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-mono text-muted-foreground">Question (EN)</span>
                            <button
                              type="button"
                              disabled={translating[`faq-${index}-question-en`] || !faq.question_ru}
                              onClick={() => translateFaqField(index, "question", "en", faq.question_ru)}
                              className="text-[9px] font-mono text-primary hover:underline disabled:opacity-50"
                            >
                              {translating[`faq-${index}-question-en`] ? "..." : "✨ translate"}
                            </button>
                          </div>
                          <Input
                            placeholder="Question in English..."
                            value={faq.question_en || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((d) => {
                                const updated = [...(d.faqs || [])];
                                if (updated[index]) updated[index].question_en = val;
                                return { ...d, faqs: updated };
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-mono text-muted-foreground">Answer (EN)</span>
                            <button
                              type="button"
                              disabled={translating[`faq-${index}-answer-en`] || !faq.answer_ru}
                              onClick={() => translateFaqField(index, "answer", "en", faq.answer_ru)}
                              className="text-[9px] font-mono text-primary hover:underline disabled:opacity-50"
                            >
                              {translating[`faq-${index}-answer-en`] ? "..." : "✨ translate"}
                            </button>
                          </div>
                          <Textarea
                            placeholder="Answer in English..."
                            value={faq.answer_en || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((d) => {
                                const updated = [...(d.faqs || [])];
                                if (updated[index]) updated[index].answer_en = val;
                                return { ...d, faqs: updated };
                              });
                            }}
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SEO overrides */}
            <div className="bg-foreground/5 p-4 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-foreground/80 border-b border-border pb-2">
                {locale === "ru" ? "SEO мета-данные (переопределение)" : locale === "uz" ? "SEO meta-ma'lumotlar" : "SEO Meta Overrides"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-muted-foreground">RU Meta</span>
                  <Input placeholder="SEO Title Override RU" value={draft.meta_title_ru} onChange={(e) => setDraft({ ...draft, meta_title_ru: e.target.value })} />
                  <Textarea placeholder="SEO Description Override RU" value={draft.meta_description_ru} onChange={(e) => setDraft({ ...draft, meta_description_ru: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-mono text-muted-foreground">UZ Meta</span>
                  <Input placeholder="SEO Title Override UZ" value={draft.meta_title_uz} onChange={(e) => setDraft({ ...draft, meta_title_uz: e.target.value })} />
                  <Textarea placeholder="SEO Description Override UZ" value={draft.meta_description_uz} onChange={(e) => setDraft({ ...draft, meta_description_uz: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-mono text-muted-foreground">EN Meta</span>
                  <Input placeholder="SEO Title Override EN" value={draft.meta_title_en} onChange={(e) => setDraft({ ...draft, meta_title_en: e.target.value })} />
                  <Textarea placeholder="SEO Description Override EN" value={draft.meta_description_en} onChange={(e) => setDraft({ ...draft, meta_description_en: e.target.value })} rows={3} />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              {t.published}
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={savePost} disabled={saving || !draft.title_ru || !draft.body_ru}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t.save}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(null); setShowEditor(false); }}>
                {t.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.existingPosts}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">{t.loading}</div>
          ) : posts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t.noPosts}</div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{post.title_ru}</p>
                    <p className="text-sm text-muted-foreground">/{post.slug}</p>
                    <button
                      type="button"
                      className="mt-1 text-xs font-mono text-muted-foreground/60 hover:text-foreground transition-colors truncate block max-w-full"
                      title={t.copyUuidTitle}
                      onClick={() => {
                        navigator.clipboard?.writeText(post.id);
                      }}
                    >
                      id: {post.id}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={post.is_published ? "success" : "secondary"}>{post.is_published ? t.published : t.draft}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setEditing(post)}>{t.edit}</Button>
                    <Button size="sm" variant="destructive" onClick={() => deletePost(post.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
