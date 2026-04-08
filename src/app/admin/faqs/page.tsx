"use client";

import { useState } from "react";

import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MOCK_FAQS } from "@/lib/mock-data";
import type { FAQ } from "@/types/car";

export default function AdminFAQsPage() {
  const [faqs] = useState(MOCK_FAQS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FAQ Management</h1>
          <p className="text-muted-foreground">{faqs.length} questions total</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          Add Question
        </Button>
      </div>

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
                        <Button size="icon" variant="ghost">
                          {faq.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
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

      {/* Add/Edit Modal */}
      {(showAddModal || editingFaq) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingFaq(null); }} />
          <div
            className="animate-fade-in relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl"
          >
            <h2 className="text-xl font-bold mb-6">
              {editingFaq ? "Edit Question" : "Add Question"}
            </h2>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowAddModal(false); setEditingFaq(null); }}>
              <div>
                <label className="text-sm font-medium mb-1 block">Question (RU)</label>
                <Input defaultValue={editingFaq?.question_ru} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Question (UZ)</label>
                <Input defaultValue={editingFaq?.question_uz} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Question (EN)</label>
                <Input defaultValue={editingFaq?.question_en} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Answer (RU)</label>
                <textarea className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none" defaultValue={editingFaq?.answer_ru} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Answer (UZ)</label>
                <textarea className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none" defaultValue={editingFaq?.answer_uz} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Answer (EN)</label>
                <textarea className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none" defaultValue={editingFaq?.answer_en} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Input defaultValue={editingFaq?.category || "general"} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Order</label>
                  <Input type="number" defaultValue={editingFaq?.order_position || 0} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingFaq(null); }}>Cancel</Button>
                <Button type="submit">{editingFaq ? "Update" : "Add"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
