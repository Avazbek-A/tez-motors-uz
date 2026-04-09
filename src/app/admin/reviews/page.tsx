"use client";

import { useState, useEffect } from "react";

import { Plus, Star, Edit, Trash2, Eye, EyeOff, Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Review } from "@/types/car";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchReviews = () => {
    setLoading(true);
    fetch("/api/reviews?all=true")
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const togglePublish = async (review: Review) => {
    const res = await fetch(`/api/reviews/${review.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !review.is_published }),
    });
    if (res.ok) {
      setReviews(reviews.map((r) =>
        r.id === review.id ? { ...r, is_published: !r.is_published } : r
      ));
      showFeedback("success", review.is_published ? "Review unpublished" : "Review published");
    } else {
      showFeedback("error", "Failed to update review");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (res.ok) {
      setReviews(reviews.filter((r) => r.id !== id));
      showFeedback("success", "Review deleted");
    } else {
      showFeedback("error", "Failed to delete review");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">{reviews.length} reviews total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReviews}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add Review
          </Button>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold">{review.client_name}</p>
                      <p className="text-xs text-muted-foreground">{review.car_description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {review.is_published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {review.review_text_ru}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditingReview(review)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => togglePublish(review)}>
                        {review.is_published ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(review.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingReview) && (
        <ReviewFormModal
          review={editingReview}
          onClose={() => { setShowAddModal(false); setEditingReview(null); }}
          onSaved={fetchReviews}
        />
      )}
    </div>
  );
}

function ReviewFormModal({ review, onClose, onSaved }: { review: Review | null; onClose: () => void; onSaved: () => void }) {
  const isEditing = !!review;
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState(review?.client_name || "");
  const [carDescription, setCarDescription] = useState(review?.car_description || "");
  const [reviewTextRu, setReviewTextRu] = useState(review?.review_text_ru || "");
  const [rating, setRating] = useState(review?.rating || 5);
  const [isPublished, setIsPublished] = useState(review?.is_published ?? false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      client_name: clientName,
      car_description: carDescription,
      review_text_ru: reviewTextRu,
      rating,
      is_published: isPublished,
    };

    try {
      const url = isEditing ? `/api/reviews/${review.id}` : "/api/reviews";
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
      <div className="animate-fade-in relative bg-[#0d0d15] border border-white/10 rounded-2xl w-full max-w-lg p-8 shadow-2xl">
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? "Edit Review" : "Add Review"}
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium mb-1 block">Client Name</label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Car Description</label>
            <Input value={carDescription} onChange={(e) => setCarDescription(e.target.value)} placeholder="e.g., BYD Song Plus 2024" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Review Text (RU)</label>
            <textarea
              className="w-full min-h-[100px] rounded-xl border border-border px-4 py-3 text-sm resize-none"
              value={reviewTextRu}
              onChange={(e) => setReviewTextRu(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Rating</label>
            <select
              className="w-full h-11 rounded-xl border border-border px-3 text-sm"
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} stars</option>
              ))}
            </select>
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
