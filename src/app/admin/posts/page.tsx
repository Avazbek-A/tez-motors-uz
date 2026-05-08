"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlogPost } from "@/types/car";

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
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

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
        setError(data.error || "Failed to save post");
        return;
      }
      setEditing(null);
      setShowEditor(false);
      fetchPosts();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) fetchPosts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-muted-foreground">Publish blog content for SEO and long-tail traffic.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPosts}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => { setEditing(null); setDraft(EMPTY); setShowEditor(true); }}>
            <Plus className="w-4 h-4" />
            New Post
          </Button>
        </div>
      </div>

      {showEditor && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Post" : "Create Post"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            <Input placeholder="Title RU" value={draft.title_ru} onChange={(e) => setDraft({ ...draft, title_ru: e.target.value })} />
            <Input placeholder="Title UZ" value={draft.title_uz} onChange={(e) => setDraft({ ...draft, title_uz: e.target.value })} />
            <Input placeholder="Title EN" value={draft.title_en} onChange={(e) => setDraft({ ...draft, title_en: e.target.value })} />
            <Input placeholder="Cover image URL" value={draft.cover_image} onChange={(e) => setDraft({ ...draft, cover_image: e.target.value })} />
            <Textarea placeholder="Body RU (markdown)" value={draft.body_ru} onChange={(e) => setDraft({ ...draft, body_ru: e.target.value })} rows={8} />
            <Textarea placeholder="Body UZ (markdown)" value={draft.body_uz} onChange={(e) => setDraft({ ...draft, body_uz: e.target.value })} rows={5} />
            <Textarea placeholder="Body EN (markdown)" value={draft.body_en} onChange={(e) => setDraft({ ...draft, body_en: e.target.value })} rows={5} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
              />
              Published
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={savePost} disabled={saving || !draft.title_ru || !draft.body_ru}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
              <Button variant="outline" onClick={() => { setEditing(null); setShowEditor(false); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No posts yet.</div>
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
                      title="Click to copy UUID"
                      onClick={() => {
                        navigator.clipboard?.writeText(post.id);
                      }}
                    >
                      id: {post.id}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={post.is_published ? "success" : "secondary"}>{post.is_published ? "Published" : "Draft"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setEditing(post)}>Edit</Button>
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
