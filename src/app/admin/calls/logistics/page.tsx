"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ship,
  TrendingUp,
  Globe,
  Plus,
  RefreshCw,
  Terminal,
  Cpu,
  Layers,
  DollarSign,
  AlertTriangle,
  Play,
  Check
} from "lucide-react";

interface BlockchainBlock {
  index: number;
  previous_hash: string;
  block_hash: string;
  vehicle: string;
  dealer: string;
  commission: number;
  status: string;
  timestamp: string;
}

interface LogisticsOrder {
  id: string;
  cargo_qty: number;
  vehicle_model: string;
  source_city: string;
  destination_city: string;
  carrier_company: string;
  quote_usd: number;
  status: string;
  created_at: string;
}

export default function LogisticsCommandHub() {
  // Navigation & loading states
  const [loading, setLoading] = useState(false);

  // Cash-flow forecasting states
  const [projectionModel, setProjectionModel] = useState<"baseline" | "optimistic" | "conservative">("baseline");
  const [activeMonthIdx, setActiveMonthIdx] = useState<number | null>(null);

  // P2P Blockchain states
  const [blockchainBlocks, setBlockchainBlocks] = useState<BlockchainBlock[]>([
    {
      index: 1210,
      previous_hash: "00000000000000000007890abcdef1234567890abcdef1234567890abcdef",
      block_hash: "0000000000000000000123456789abcdef123456789abcdef123456789abcde",
      vehicle: "BYD Song Plus DM-i",
      dealer: "Tashkent Premium Cars",
      commission: 500,
      status: "verified",
      timestamp: new Date(Date.now() - 3600000 * 2).toLocaleTimeString()
    },
    {
      index: 1209,
      previous_hash: "00000000000000000003456789abcdef0123456789abcdef0123456789abcdef",
      block_hash: "00000000000000000007890abcdef1234567890abcdef1234567890abcdef",
      vehicle: "BYD Han EV",
      dealer: "Samarkand Autos P2P",
      commission: 800,
      status: "verified",
      timestamp: new Date(Date.now() - 3600000 * 5).toLocaleTimeString()
    }
  ]);
  const [p2pSwapVehicle, setP2pSwapVehicle] = useState("BYD Han EV");
  const [p2pSwapDealer, setP2pSwapDealer] = useState("Yunusabad Autos P2P");
  const [p2pSwapCommission, setP2pSwapCommission] = useState(600);
  const [blockchainLoading, setBlockchainLoading] = useState(false);

  // Logistics Voice terminal states
  const [logisticsVoiceCmd, setLogisticsVoiceCmd] = useState("");
  const [logisticsDispatchLogs, setLogisticsDispatchLogs] = useState<string[]>([
    "[System Initialization]: B2B Logistics Command Node Online.",
    "[Ready]: Awaiting voice or text container dispatch command..."
  ]);
  const [dispatchedOrders, setDispatchedOrders] = useState<LogisticsOrder[]>([]);
  const [logisticsLoading, setLogisticsLoading] = useState(false);

  // Cash-flow data configuration
  const forecastData = {
    baseline: [
      { month: "Jul", cash: 120000, units: 5 },
      { month: "Aug", cash: 145000, units: 7 },
      { month: "Sep", cash: 180000, units: 9 },
      { month: "Oct", cash: 210000, units: 10 },
      { month: "Nov", cash: 240000, units: 12 },
      { month: "Dec", cash: 310000, units: 15 }
    ],
    optimistic: [
      { month: "Jul", cash: 140000, units: 6 },
      { month: "Aug", cash: 185000, units: 9 },
      { month: "Sep", cash: 230000, units: 12 },
      { month: "Oct", cash: 290000, units: 14 },
      { month: "Nov", cash: 350000, units: 18 },
      { month: "Dec", cash: 450000, units: 22 }
    ],
    conservative: [
      { month: "Jul", cash: 100000, units: 4 },
      { month: "Aug", cash: 110000, units: 5 },
      { month: "Sep", cash: 130000, units: 6 },
      { month: "Oct", cash: 140000, units: 7 },
      { month: "Nov", cash: 160000, units: 8 },
      { month: "Dec", cash: 190000, units: 10 }
    ]
  };

  const activeDataPoints = forecastData[projectionModel];

  // SVG Chart Dimensions & Helpers
  const width = 500;
  const height = 200;
  const paddingX = 40;
  const paddingY = 20;

  const maxCash = Math.max(...activeDataPoints.map((d) => d.cash));
  const minCash = Math.min(...activeDataPoints.map((d) => d.cash));

  const getSvgX = (index: number) => {
    return paddingX + (index / (activeDataPoints.length - 1)) * (width - paddingX * 2);
  };

  const getSvgY = (cash: number) => {
    // Map cash values to SVG height
    const ratio = (cash - minCash * 0.8) / (maxCash - minCash * 0.8);
    return height - paddingY - ratio * (height - paddingY * 2);
  };

  // Generate SVG Path
  const pointsStr = activeDataPoints
    .map((d, idx) => `${getSvgX(idx)},${getSvgY(d.cash)}`)
    .join(" ");

  const areaPointsStr = `${getSvgX(0)},${height - paddingY} ${pointsStr} ${getSvgX(
    activeDataPoints.length - 1
  )},${height - paddingY}`;

  // API Actions
  const handleP2pBlockchainSwap = async () => {
    setBlockchainLoading(true);
    try {
      const res = await fetch("/api/admin/calls/p2p-blockchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle: p2pSwapVehicle,
          dealer: p2pSwapDealer,
          commission: p2pSwapCommission
        })
      });
      const data = await res.json();
      if (data.success) {
        setBlockchainBlocks((prev) => [
          {
            index: data.block_index,
            previous_hash: data.previous_hash,
            block_hash: data.block_hash,
            vehicle: data.vehicle_swapped,
            dealer: data.target_dealer,
            commission: data.commission_usd,
            status: data.consensus_status,
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev
        ]);
      }
    } catch (err) {
      console.error("P2P Swap block consensus failed", err);
    } finally {
      setBlockchainLoading(false);
    }
  };

  const handleDispatchLogisticsCommand = async () => {
    if (!logisticsVoiceCmd.trim()) return;
    setLogisticsLoading(true);
    setLogisticsDispatchLogs((prev) => [
      ...prev,
      `[Voice Dispatcher]: Processing instruction...`,
      `[Command]: "${logisticsVoiceCmd}"`
    ]);

    try {
      const res = await fetch("/api/admin/calls/logistics-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_command: logisticsVoiceCmd })
      });
      const data = await res.json();
      if (data.success) {
        const order: LogisticsOrder = data.logistics_order;
        setDispatchedOrders((prev) => [order, ...prev]);
        setLogisticsDispatchLogs((prev) => [
          ...prev,
          `[Parsed Success]: ${order.cargo_qty}x ${order.vehicle_model} from ${order.source_city}`,
          `[Carrier Contract]: ${order.carrier_company}`,
          `[Estimated Quote]: $${order.quote_usd.toLocaleString()} USD`,
          `[Consensus Status]: ORDER DISPATCHED VIA RAIL CONTAINER #${order.id.slice(0, 6)}`
        ]);
        setLogisticsVoiceCmd("");
      }
    } catch (err) {
      console.error(err);
      setLogisticsDispatchLogs((prev) => [
        ...prev,
        `[Error]: Sourcing / routing evaluation failed.`
      ]);
    } finally {
      setLogisticsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 bg-background min-h-screen text-foreground font-sans">
      {/* Header section */}
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
              <Ship className="w-5 h-5 text-lime" />
              Logistics & Forecast Command Hub
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Freight container voice dispatch, P2P network consensus & cash-flow forecasts
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Side: Forecasting & Visual Chart */}
        <div className="md:col-span-2 space-y-6">
          {/* Cash Flow Forecast Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <TrendingUp className="w-24 h-24 text-lime" />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-lime" />
                  Predictive Cash-Flow Projections
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Expected importing revenues (USD) based on BYD shipment quotas
                </p>
              </div>

              {/* Model Switcher */}
              <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border/50 text-[10px] self-start sm:self-auto">
                {(["baseline", "optimistic", "conservative"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setProjectionModel(m);
                      setActiveMonthIdx(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all ${
                      projectionModel === m
                        ? "bg-lime text-navy shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Rendered Chart */}
            <div className="bg-muted/10 border border-border/60 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[220px]">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#84cc16" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines */}
                {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => (
                  <line
                    key={idx}
                    x1={paddingX}
                    y1={paddingY + ratio * (height - paddingY * 2)}
                    x2={width - paddingX}
                    y2={paddingY + ratio * (height - paddingY * 2)}
                    stroke="currentColor"
                    className="text-border/20"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Shaded Area */}
                <polygon points={areaPointsStr} fill="url(#chartGrad)" />

                {/* Trend line */}
                <polyline
                  fill="none"
                  stroke="#84cc16"
                  strokeWidth="3"
                  points={pointsStr}
                  className="transition-all duration-300"
                />

                {/* Dots / Interactions */}
                {activeDataPoints.map((d, idx) => {
                  const cx = getSvgX(idx);
                  const cy = getSvgY(d.cash);
                  const isHovered = activeMonthIdx === idx;

                  return (
                    <g key={idx} className="cursor-pointer">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 7 : 4}
                        fill={isHovered ? "#84cc16" : "#0d0d10"}
                        stroke="#84cc16"
                        strokeWidth="2"
                        onMouseEnter={() => setActiveMonthIdx(idx)}
                        onMouseLeave={() => setActiveMonthIdx(null)}
                      />
                      {/* Month Text labels */}
                      <text
                        x={cx}
                        y={height - 2}
                        textAnchor="middle"
                        className="text-[9px] fill-muted-foreground font-mono"
                      >
                        {d.month}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Detail display box */}
              <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 text-[10px] space-y-0.5 shadow-lg min-w-[140px] pointer-events-none">
                {activeMonthIdx !== null ? (
                  <>
                    <div className="font-bold text-foreground font-mono">
                      Month: {activeDataPoints[activeMonthIdx].month}
                    </div>
                    <div className="text-lime font-bold font-mono">
                      Forecast: ${activeDataPoints[activeMonthIdx].cash.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">
                      Import Units: {activeDataPoints[activeMonthIdx].units}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-muted-foreground font-mono text-[9px]">
                      Hover chart nodes to view cash-flow details
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Voice cargo freight dispatcher terminal */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-lime" />
                B2B Cargo Dispatch Console
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Synthesize cargo shipping runs using language instruction prompts
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={logisticsVoiceCmd}
                onChange={(e) => setLogisticsVoiceCmd(e.target.value)}
                placeholder="e.g. 'Отправь 8 BYD Han из Ченду'..."
                className="flex-1 bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-lime text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDispatchLogisticsCommand();
                }}
              />
              <button
                type="button"
                onClick={handleDispatchLogisticsCommand}
                disabled={logisticsLoading || !logisticsVoiceCmd.trim()}
                className="px-4 bg-lime hover:opacity-90 disabled:opacity-50 text-navy font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
              >
                {logisticsLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                Dispatch
              </button>
            </div>

            {/* Terminal output window */}
            <div className="space-y-1 bg-black border border-border/80 p-3 rounded-2xl shadow-inner font-mono text-[10px] text-green-400 space-y-1 h-44 overflow-y-auto">
              {logisticsDispatchLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: P2P Blockchain Ledger Sourcing */}
        <div className="space-y-6">
          {/* P2P network configuration */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-lime" />
              P2P Inventory Swap Configurator
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Commit inventory sharing smart-contracts directly with local importer networks
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase block mb-1">
                  Swap Model
                </label>
                <select
                  value={p2pSwapVehicle}
                  onChange={(e) => setP2pSwapVehicle(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none focus:border-lime"
                >
                  <option value="BYD Han EV">BYD Han EV</option>
                  <option value="BYD Song Plus">BYD Song Plus</option>
                  <option value="BYD Seagull">BYD Seagull</option>
                  <option value="Chery Tiggo 8 Pro">Chery Tiggo 8 Pro</option>
                  <option value="Geely Monjaro">Geely Monjaro</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase block mb-1">
                  Target Importer
                </label>
                <select
                  value={p2pSwapDealer}
                  onChange={(e) => setP2pSwapDealer(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none"
                >
                  <option value="Yunusabad Autos P2P">Yunusabad Autos P2P</option>
                  <option value="Mirzo-Ulugbek Cars">Mirzo-Ulugbek Cars</option>
                  <option value="Chilanzar Importers">Chilanzar Importers</option>
                  <option value="Sergeli Auto Network">Sergeli Auto Network</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase block mb-1">
                  Commission ($ USD)
                </label>
                <input
                  type="number"
                  value={p2pSwapCommission}
                  onChange={(e) => setP2pSwapCommission(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none focus:border-lime font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleP2pBlockchainSwap}
                disabled={blockchainLoading}
                className="w-full py-2.5 bg-lime text-navy font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
              >
                {blockchainLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                Commit P2P Swap Consensus
              </button>
            </div>
          </div>

          {/* Blockchain consensus blocks */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-lime" />
              Consensus Block Explorer
            </h4>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {blockchainBlocks.map((block) => (
                <div
                  key={block.index}
                  className="rounded-2xl border border-border bg-card p-4 space-y-2.5 font-mono text-[9px] text-muted-foreground hover:border-lime/30 transition-colors"
                >
                  <div className="flex justify-between items-center text-foreground font-sans">
                    <span className="font-bold text-lime font-mono">Block #{block.index}</span>
                    <span className="text-[8px] bg-green-500/10 text-green-400 px-1.5 py-0.5 border border-green-500/20 rounded uppercase tracking-wider font-semibold flex items-center gap-1 animate-pulse">
                      <Check className="w-2.5 h-2.5" /> verified
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="break-all font-mono">
                      <strong className="text-foreground">Prev:</strong> {block.previous_hash.slice(0, 16)}...{block.previous_hash.slice(-16)}
                    </div>
                    <div className="break-all font-mono">
                      <strong className="text-foreground">Hash:</strong> {block.block_hash.slice(0, 16)}...{block.block_hash.slice(-16)}
                    </div>
                    <div className="text-foreground font-sans text-xs mt-1.5 font-semibold leading-relaxed">
                      Swap: {block.vehicle} ⇄ {block.dealer}
                    </div>
                    <div className="flex justify-between text-[10px] text-foreground font-sans mt-1">
                      <span>Fee Commission</span>
                      <span className="font-mono text-lime font-bold">${block.commission} USD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
