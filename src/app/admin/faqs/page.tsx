"use client";

import { useState, useEffect } from "react";

import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff, Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FAQ } from "@/types/car";

export default function AdminFAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(faqs.map((f) => f.id)));
  const clearSelection = () => setSelected(new Set());

  const bulkSetPublished = async (publish: boolean) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/faqs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_published: publish }),
        }),
      ),
    );
    const okIds = new Set<string>();
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.ok) okIds.add(ids[i]);
    });
    setFaqs((prev) => prev.map((f) => (okIds.has(f.id) ? { ...f, is_published: publish } : f)));
    clearSelection();
    setBulkBusy(false);
    showFeedback(
      okIds.size === ids.length ? "success" : "error",
      `${okIds.size}/${ids.length} ${publish ? "published" : "unpublished"}`,
    );
  };

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchFaqs = () => {
    setLoading(true);
    fetch("/api/faqs?all=true")
      .then((r) => r.json())
      .then((data) => {
        setFaqs(data.faqs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchFaqs();
  }, []);

  const togglePublish = async (faq: FAQ) => {
    const res = await fetch(`/api/faqs/${faq.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !faq.is_published }),
    });
    if (res.ok) {
      setFaqs(faqs.map((f) =>
        f.id === faq.id ? { ...f, is_published: !f.is_published } : f
      ));
      showFeedback("success", faq.is_published ? "FAQ unpublished" : "FAQ published");
    } else {
      showFeedback("error", "Failed to update FAQ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    const res = await fetch(`/api/faqs/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFaqs(faqs.filter((f) => f.id !== id));
      showFeedback("success", "FAQ deleted");
    } else {
      showFeedback("error", "Failed to delete FAQ");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FAQ Management</h1>
          <p className="text-muted-foreground">{faqs.length} questions total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchFaqs}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add Question
          </Button>
        </div>
      </div>

      {faqs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" size="sm" variant="outline" onClick={selected.size === faqs.length ? clearSelection : selectAll}>
            {selected.size === faqs.length ? "Clear selection" : "Select all"}
          </Button>
          <span className="text-muted-foreground">{selected.size} selected</span>
          <Button type="button" size="sm" variant="outline" disabled={selected.size === 0 || bulkBusy} onClick={() => bulkSetPublished(true)}>
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Publish selected
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selected.size === 0 || bulkBusy} onClick={() => bulkSetPublished(false)}>
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
            Unpublish selected
          </Button>
        </div>
      )}

      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${
          feedback.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(faq.id)}
                      onChange={() => toggleSelect(faq.id)}
                      className="mt-1 rounded"
                      aria-label="Select FAQ"
                    />
                    <div className="mt-1 text-muted-foreground cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{faq.question_ru}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer_ru}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary">{faq.category}</Badge>
                            {faq.is_published ? (
                              <Badge variant="success">Published</Badge>
                            ) : (
                              <Badge variant="secondary">Draft</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">Order: {faq.order_position}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => setEditingFaq(faq)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => togglePublish(faq)}>
                            {faq.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(faq.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingFaq) && (
        <FAQFormModal
          faq={editingFaq}
          onClose={() => { setShowAddModal(false); setEditingFaq(null); }}
          onSaved={fetchFaqs}
        />
      )}
    </div>
  );
}

function FAQFormModal({ faq, onClose, onSaved }: { faq: FAQ | null; onClose: () => void; onSaved: () => void }) {
  const isEditing = !!faq;
  const [saving, setSaving] = useState(false);
  const [questionRu, setQuestionRu] = useState(faq?.question_ru || "");
  const [questionUz, setQuestionUz] = useState(faq?.question_uz || "");
  const [questionEn, setQuestionEn] = useState(faq?.question_en || "");
  const [answerRu, setAnswerRu] = useState(faq?.answer_ru || "");
  const [answerUz, setAnswerUz] = useState(faq?.answer_uz || "");
  const [answerEn, setAnswerEn] = useState(faq?.answer_en || "");
  const [category, setCategory] = useState(faq?.category || "general");
  const [orderPosition, setOrderPosition] = useState(faq?.order_position?.toString() || "0");
  const [isPublished, setIsPublished] = useState(faq?.is_published ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      question_ru: questionRu,
      question_uz: questionUz,
      question_en: questionEn,
      answer_ru: answerRu,
      answer_uz: answerUz,
      answer_en: answerEn,
      category,
      order_position: parseInt(orderPosition),
      is_published: isPublished,
    };

    try {
      const url = isEditing ? `/api/faqs/${faq.id}` : "/api/faqs";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-in relative bg-[#0d0d15] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? "Edit Question" : "Add Question"}
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium mb-1 block">Question (RU)</label>
            <Input value={questionRu} onChange={(e) => setQuestionRu(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Question (UZ)</label>
            <Input value={questionUz} onChange={(e) => setQuestionUz(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Question (EN)</label>
            <Input value={questionEn} onChange={(e) => setQuestionEn(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Answer (RU)</label>
            <textarea className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none" value={answerRu} onChange={(e) => setAnswerRu(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Answer (UZ)</label>
            <textarea className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none" value={answerUz} onChange={(e) => setAnswerUz(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Answer (EN)</label>
            <textarea className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none" value={answerEn} onChange={(e) => setAnswerEn(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Order</label>
              <Input type="number" value={orderPosition} onChange={(e) => setOrderPosition(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Published</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
