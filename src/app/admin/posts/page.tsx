"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlogPost } from "@/types/car";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

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
      });
    } else {
      setDraft(EMPTY);
    }
  }, [editing]);

  const savePost = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      ...draft,
      title_uz: draft.title_uz || null,
      title_en: draft.title_en || null,
      body_uz: draft.body_uz || null,
      body_en: draft.body_en || null,
      cover_image: draft.cover_image || null,
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
          <CardContent className="space-y-4">
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
                    setDraft((d) => ({ ...d, title_ru: data.title, body_ru: data.content || d.body_ru }));
                  }
                } finally {
                  setGenPost(false);
                }
              }}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {genPost ? t.drafting : t.draftWithAI}
            </button>
            <Input placeholder={t.slug} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            <Input placeholder={t.titleRu} value={draft.title_ru} onChange={(e) => setDraft({ ...draft, title_ru: e.target.value })} />
            <Input placeholder={t.titleUz} value={draft.title_uz} onChange={(e) => setDraft({ ...draft, title_uz: e.target.value })} />
            <Input placeholder={t.titleEn} value={draft.title_en} onChange={(e) => setDraft({ ...draft, title_en: e.target.value })} />
            <Input placeholder={t.coverImage} value={draft.cover_image} onChange={(e) => setDraft({ ...draft, cover_image: e.target.value })} />
            <Textarea placeholder={t.bodyRu} value={draft.body_ru} onChange={(e) => setDraft({ ...draft, body_ru: e.target.value })} rows={8} />
            <Textarea placeholder={t.bodyUz} value={draft.body_uz} onChange={(e) => setDraft({ ...draft, body_uz: e.target.value })} rows={5} />
            <Textarea placeholder={t.bodyEn} value={draft.body_en} onChange={(e) => setDraft({ ...draft, body_en: e.target.value })} rows={5} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
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
