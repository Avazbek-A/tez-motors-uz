"use client";

import { useState } from "react";
import {
  Sparkles,
  Upload,
  Mic,
  Camera,
  Car,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Sliders,
  Play,
  RotateCcw
} from "lucide-react";

export default function CustomerXrPortal() {
  // 3D Car Showroom Sync States
  const [showroomRot, setShowroomRot] = useState(180);
  const [showroomColor, setShowroomColor] = useState("Space Black");
  const [arDoorStatus, setArDoorStatus] = useState(false);
  const [arHoodStatus, setArHoodStatus] = useState(false);
  const [arTrunkStatus, setArTrunkStatus] = useState(false);
  const [arSyncStatus, setArSyncStatus] = useState("Ready");

  // AI Trade-In Scan States
  const [tradeInCustName, setTradeInCustName] = useState("");
  const [tradeInCarDetails, setTradeInCarDetails] = useState("");
  const [engineAudioFile, setEngineAudioFile] = useState<File | null>(null);
  const [bodyPhotoFile, setBodyPhotoFile] = useState<File | null>(null);
  const [tradeInResult, setTradeInResult] = useState<any>(null);
  const [tradeInScanning, setTradeInScanning] = useState(false);

  // Sync state change helper
  const handleArSyncAction = async (action: string, value: any) => {
    setArSyncStatus(`Syncing ${action}...`);
    try {
      const res = await fetch("/api/admin/calls/ar-showroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value })
      });
      const data = await res.json();
      if (data.success) {
        setArSyncStatus(`Synced: ${action} = ${value}`);
      }
    } catch (err) {
      console.error(err);
      setArSyncStatus("Sync error");
    }
  };

  // Run the AI Trade-in valuation
  const handleTradeInScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeInCustName.trim() || !tradeInCarDetails.trim()) return;

    setTradeInScanning(true);
    try {
      const formData = new FormData();
      formData.append("customer_name", tradeInCustName);
      formData.append("car_details", tradeInCarDetails);

      // Append dummy files if not selected, to keep the backend happy
      formData.append("engine_audio", engineAudioFile || new Blob(["mock-wav"], { type: "audio/wav" }));
      formData.append("body_photo", bodyPhotoFile || new Blob(["mock-jpeg"], { type: "image/jpeg" }));

      const res = await fetch("/api/admin/calls/tradein-valuation", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setTradeInResult(data.valuation);
      }
    } catch (err) {
      console.error("Valuation failed", err);
    } finally {
      setTradeInScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy text-foreground flex flex-col items-center justify-start p-4 md:p-6 font-sans">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/40 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl font-bold tracking-tight">Tez Motors Customer XR Portal</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Experience immersive 3D showrooms & get immediate AI trade-in diagnostic valuations
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl self-start md:self-auto uppercase tracking-wider animate-pulse">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            Viewport Sync Active
          </div>
        </div>

        {/* Core Layout Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Left Panel: WebXR 3D Showroom Simulator */}
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 space-y-5 shadow-xl flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Car className="w-4 h-4 text-blue-400" />
                WebXR 3D Car Inspector
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Interact with the model below; changes will sync to the showroom host
              </p>
            </div>

            {/* Simulated 3D CSS Canvas */}
            <div className="w-full h-52 rounded-xl bg-gradient-to-b from-slate-900 to-black border border-border/50 relative flex flex-col items-center justify-center overflow-hidden my-4">
              <div className="absolute top-3 left-3 bg-black/60 px-2 py-0.5 border border-white/10 rounded-lg text-[8px] font-mono tracking-widest text-slate-300">
                XR VIEWPORT
              </div>

              {/* Grid background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:18px_18px] pointer-events-none" />

              {/* CSS 3D Box Representing the Car */}
              <div
                className="w-36 h-16 transition-all duration-300 relative"
                style={{
                  transform: `rotateY(${showroomRot}deg) rotateX(12deg)`,
                  transformStyle: "preserve-3d",
                  perspective: "600px"
                }}
              >
                <div
                  className="absolute inset-0 rounded-xl border-2 transition-colors duration-500 shadow-2xl"
                  style={{
                    backgroundColor:
                      showroomColor === "Space Black"
                        ? "#111827"
                        : showroomColor === "Matte Grey"
                        ? "#4b5563"
                        : showroomColor === "Glacier White"
                        ? "#f9fafb"
                        : "#1d4ed8",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 0 25px rgba(59, 130, 246, 0.3)"
                  }}
                >
                  {/* Car top cabin */}
                  <div
                    className="absolute top-[-16px] left-[25px] right-[25px] h-[22px] rounded-t-lg transition-colors duration-500"
                    style={{
                      backgroundColor:
                        showroomColor === "Space Black"
                          ? "#1f2937"
                          : showroomColor === "Matte Grey"
                          ? "#6b7280"
                          : showroomColor === "Glacier White"
                          ? "#e5e7eb"
                          : "#3b82f6",
                      border: "1px solid rgba(255, 255, 255, 0.15)"
                    }}
                  />
                  {/* Wheels */}
                  <div className="absolute bottom-[-8px] left-[12px] w-[20px] h-[20px] rounded-full bg-black border border-slate-700" />
                  <div className="absolute bottom-[-8px] right-[12px] w-[20px] h-[20px] rounded-full bg-black border border-slate-700" />
                </div>
              </div>

              {/* Status details */}
              <div className="absolute bottom-3 text-[8px] text-muted-foreground font-mono text-center">
                Sync Status: <span className="text-blue-400">{arSyncStatus}</span>
              </div>
            </div>

            {/* Slider controls */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Rotate Perspective</span>
                  <span className="font-mono text-blue-400">{showroomRot}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={showroomRot}
                  onChange={(e) => {
                    const rot = Number(e.target.value);
                    setShowroomRot(rot);
                    handleArSyncAction("rotate", rot);
                  }}
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Preset buttons */}
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Select Visual Preset Color
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {["Space Black", "Matte Grey", "Glacier White", "Imperial Blue"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setShowroomColor(color);
                        handleArSyncAction("color", color);
                      }}
                      className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                        showroomColor === color
                          ? "bg-blue-500/20 border-blue-500 text-blue-400"
                          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {color.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
                <button
                  onClick={() => {
                    const next = !arDoorStatus;
                    setArDoorStatus(next);
                    handleArSyncAction("toggle_doors", next);
                  }}
                  className={`py-2 text-[10px] font-semibold rounded-lg border ${
                    arDoorStatus ? "bg-blue-500/10 border-blue-500 text-blue-400" : "bg-muted/30 border-border text-foreground"
                  }`}
                >
                  {arDoorStatus ? "Close Doors" : "Open Doors"}
                </button>
                <button
                  onClick={() => {
                    const next = !arHoodStatus;
                    setArHoodStatus(next);
                    handleArSyncAction("toggle_hood", next);
                  }}
                  className={`py-2 text-[10px] font-semibold rounded-lg border ${
                    arHoodStatus ? "bg-blue-500/10 border-blue-500 text-blue-400" : "bg-muted/30 border-border text-foreground"
                  }`}
                >
                  {arHoodStatus ? "Close Hood" : "Open Hood"}
                </button>
                <button
                  onClick={() => {
                    const next = !arTrunkStatus;
                    setArTrunkStatus(next);
                    handleArSyncAction("toggle_trunk", next);
                  }}
                  className={`py-2 text-[10px] font-semibold rounded-lg border ${
                    arTrunkStatus ? "bg-blue-500/10 border-blue-500 text-blue-400" : "bg-muted/30 border-border text-foreground"
                  }`}
                >
                  {arTrunkStatus ? "Close Trunk" : "Open Trunk"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: AI Trade-in Diagnostic Scanner */}
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 space-y-4 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                AI Trade-In Scanner
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Submit details and files to run deep machine learning vehicle health audits
              </p>
            </div>

            <form onSubmit={handleTradeInScan} className="space-y-3">
              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase block mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Шерзод"
                  value={tradeInCustName}
                  onChange={(e) => setTradeInCustName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:border-blue-500 text-foreground"
                />
              </div>

              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase block mb-1">
                  Vehicle Specs & Details
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chevrolet Cobalt 2022, 45,000 km"
                  value={tradeInCarDetails}
                  onChange={(e) => setTradeInCarDetails(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:border-blue-500 text-foreground"
                />
              </div>

              {/* Upload boxes grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Engine Sound Upload box */}
                <div className="border border-dashed border-border/80 rounded-2xl p-3 bg-muted/10 flex flex-col items-center justify-center text-center space-y-1 hover:bg-muted/20 transition-all relative">
                  <Mic className="w-5 h-5 text-blue-400 animate-pulse" />
                  <span className="text-[8px] font-bold text-foreground">Engine Audio (idle)</span>
                  <span className="text-[7px] text-muted-foreground font-mono">
                    {engineAudioFile ? engineAudioFile.name : "Select WAV/MP3"}
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setEngineAudioFile(e.target.files[0]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                {/* Body Photo Upload box */}
                <div className="border border-dashed border-border/80 rounded-2xl p-3 bg-muted/10 flex flex-col items-center justify-center text-center space-y-1 hover:bg-muted/20 transition-all relative">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <span className="text-[8px] font-bold text-foreground">Body Photo (scan)</span>
                  <span className="text-[7px] text-muted-foreground font-mono">
                    {bodyPhotoFile ? bodyPhotoFile.name : "Select JPEG/PNG"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setBodyPhotoFile(e.target.files[0]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={tradeInScanning || !tradeInCustName.trim() || !tradeInCarDetails.trim()}
                className="w-full py-2.5 bg-blue-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
              >
                {tradeInScanning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Scanning Engine Acoustics & Chassis...
                  </>
                ) : (
                  <>
                    <Sliders className="w-3.5 h-3.5" />
                    Execute AI Diagnostics Scanner
                  </>
                )}
              </button>
            </form>

            {/* Diagnostic results display */}
            {tradeInResult && (
              <div className="p-4 bg-muted/30 border border-border/80 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    Diagnostic Report
                  </span>
                  <span className="text-[8px] bg-green-500/10 text-green-400 px-1.5 py-0.5 border border-green-500/20 rounded font-semibold uppercase tracking-wider">
                    Successful
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div className="bg-card border border-border/50 p-2 rounded-xl">
                    <span className="text-muted-foreground block text-[8px] uppercase font-mono">Engine Acoustics</span>
                    <strong className="text-foreground">{tradeInResult.engine_health_status}</strong>
                  </div>
                  <div className="bg-card border border-border/50 p-2 rounded-xl">
                    <span className="text-muted-foreground block text-[8px] uppercase font-mono">Chassis Check</span>
                    <strong className="text-foreground">{tradeInResult.body_damage_details}</strong>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-[9px] text-blue-400 uppercase tracking-widest font-bold font-mono">
                    Estimated Trade-In Valuation
                  </span>
                  <span className="text-lg font-extrabold text-blue-400 font-mono">
                    ${tradeInResult.computed_value_usd?.toLocaleString()} USD
                  </span>
                  <p className="text-[8px] text-muted-foreground">
                    Valuation computed via acoustic fingerprint match
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
