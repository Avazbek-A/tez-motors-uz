"use client";

import { useState } from "react";

import { Plus, Star, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MOCK_REVIEWS } from "@/lib/mock-data";
import type { Review } from "@/types/car";

export default function AdminReviewsPage() {
  const [reviews] = useState(MOCK_REVIEWS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">{reviews.length} reviews total</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          Add Review
        </Button>
      </div>

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
                    <Button size="icon" variant="ghost">
                      {review.is_published ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingReview) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingReview(null); }} />
          <div
            className="animate-fade-in relative bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl"
          >
            <h2 className="text-xl font-bold mb-6">
              {editingReview ? "Edit Review" : "Add Review"}
            </h2>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowAddModal(false); setEditingReview(null); }}>
              <div>
                <label className="text-sm font-medium mb-1 block">Client Name</label>
                <Input defaultValue={editingReview?.client_name} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Car Description</label>
                <Input defaultValue={editingReview?.car_description || ""} placeholder="e.g., BYD Song Plus 2024" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Review Text (RU)</label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border border-border px-4 py-3 text-sm resize-none"
                  defaultValue={editingReview?.review_text_ru || ""}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Rating</label>
                <select className="w-full h-11 rounded-xl border border-border px-3 text-sm" defaultValue={editingReview?.rating || 5}>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>{r} stars</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingReview(null); }}>Cancel</Button>
                <Button type="submit">{editingReview ? "Update" : "Add"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
