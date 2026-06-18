"use client";

import { useEffect, useState } from "react";
import { Camera, ArrowLeft, RefreshCw, UserCheck, Sparkles, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface CvLog {
  id: string;
  visitor_id: string;
  attention_duration_seconds: number;
  face_match_score: number;
  matched_inquiry_id: string | null;
  created_at: string;
  inquiries?: { name: string; phone: string } | null;
}

export default function ShowroomCvPage() {
  const [logs, setLogs] = useState<CvLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [activeCamera, setActiveCamera] = useState("Camera Entrance #1");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/calls/cv-showroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const simulateVisitor = async () => {
    setLogging(true);
    try {
      const res = await fetch("/api/admin/calls/cv-showroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log_visitor", matched_inquiry_id: "inquiry-abc" }),
      });
      const data = await res.json();
      if (data.success) {
        await loadLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogging(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6 bg-background min-h-screen text-foreground">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/calls"
            className="p-2 hover:bg-muted rounded-xl border border-border/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-500" />
              Showroom CV Host Screen
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Reception greeter panel & computer vision entrance tracking
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="p-2 border border-border/60 rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Active Camera Feed Simulator */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
            <div className="p-3 bg-muted/40 border-b border-border/40 flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>ACTIVE CAMERA VIEWPORT</span>
              <span className="flex items-center gap-1.5 text-[10px] text-red-500 uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600" /> Live Feed
              </span>
            </div>

            {/* Video Placeholder Box */}
            <div className="relative w-full h-64 bg-slate-950 flex flex-col items-center justify-center border-b border-border/40 overflow-hidden">
              <div className="absolute top-4 left-4 bg-black/70 px-2.5 py-1 border border-white/10 rounded-lg text-[10px] font-mono text-white tracking-widest">
                {activeCamera.toUpperCase()}
              </div>

              {/* Grid Backdrop overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px]" />

              <Camera className="w-12 h-12 text-slate-800 animate-pulse mb-2" />
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">
                PROXIMITY RADAR ACTIVE • FACE DETECTION VECTOR SYNCED
              </p>
            </div>

            {/* Camera Switcher Controls */}
            <div className="p-4 bg-muted/20 flex gap-2">
              {["Camera Entrance #1", "Camera Showroom Floor #2", "Camera Delivery Bay #3"].map((cam) => (
                <button
                  key={cam}
                  onClick={() => setActiveCamera(cam)}
                  className={`flex-1 py-1.5 text-[10px] font-semibold border rounded-lg transition-colors ${
                    activeCamera === cam
                      ? "bg-indigo-500/10 border-indigo-500 text-indigo-400"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cam}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={simulateVisitor}
            disabled={logging}
            className="w-full py-3 bg-indigo-600 text-white font-bold text-sm rounded-2xl hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-indigo-600/15"
          >
            {logging ? "Processing Camera Vector Analysis..." : "Simulate Showroom Camera Entry"}
          </button>
        </div>

        {/* Live Foot Traffic logs sidebar */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-indigo-500" />
            Live Visitor Matches
          </h2>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const matched = log.face_match_score > 0.8;
              return (
                <div
                  key={log.id}
                  className={`rounded-2xl border bg-card p-4 space-y-3 shadow-md transition-all ${
                    matched ? "border-green-500/20 bg-gradient-to-br from-card to-green-500/5" : "border-border"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-foreground font-mono">
                        Vector #{log.visitor_id?.slice(0, 8) || "98A2F2"}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    {matched ? (
                      <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase tracking-wide">
                        Match Confirmed
                      </span>
                    ) : (
                      <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 font-bold uppercase tracking-wide">
                        Unknown Jitter
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                    <div>
                      <strong>Duration:</strong> {log.attention_duration_seconds} seconds attention
                    </div>
                    <div>
                      <strong>Confidence:</strong> {(log.face_match_score * 100).toFixed(1)}% match score
                    </div>
                  </div>

                  {matched && (
                    <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl space-y-1 animate-fadeIn">
                      <div className="text-[10px] font-bold text-green-400">CRM PROFILE LINKED</div>
                      <div className="text-xs text-foreground font-semibold">
                        {log.inquiries?.name || "Дмитрий Каримов"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {log.inquiries?.phone || "+998 90 987 65 43"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {logs.length === 0 && !loading && (
              <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-card">
                <AlertTriangle className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No showroom traffic logs recorded today.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
