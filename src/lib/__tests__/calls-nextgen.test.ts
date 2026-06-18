import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// 1. Mock auth guard
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAdmin: (req: any) => mockRequireAdmin(req),
}));

// 2. Mock supabase client
let mockDbResult: any = { data: null, error: null };

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(() => Promise.resolve(mockDbResult)),
  maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(mockDbResult)),
  then: vi.fn().mockImplementation((resolve) => Promise.resolve(mockDbResult).then(resolve)),
};

const mockSupabase = {
  from: vi.fn(() => mockBuilder),
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockSupabase,
}));

// 3. Mock LLM Text helper
const mockLlmText = vi.fn();
vi.mock("@/lib/llm", () => ({
  llmText: (args: any) => mockLlmText(args),
}));

import { POST as postVoiceNotes } from "@/app/api/admin/calls/agent/voice-notes/route";
import { POST as postP2pBlockchain } from "@/app/api/admin/calls/p2p-blockchain/route";
import { POST as postArShowroom } from "@/app/api/admin/calls/ar-showroom/route";
import { POST as postVocalTremor } from "@/app/api/admin/calls/vocal-tremor/route";
import { POST as postDialerHandover } from "@/app/api/admin/calls/dialer-handover/route";
import { POST as postCvShowroom } from "@/app/api/admin/calls/cv-showroom/route";
import { POST as postDialectAdapt } from "@/app/api/admin/calls/dialect-adapt/route";
import { POST as postVideoAvatar } from "@/app/api/admin/calls/video-avatar/route";
import { POST as postLogisticsDispatch } from "@/app/api/admin/calls/logistics-dispatch/route";
import { POST as postTradeIn } from "@/app/api/admin/calls/tradein-valuation/route";

describe("Next-Gen Call Center API Endpoints (Leaps 10-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(null);
    mockDbResult = { data: null, error: null };
  });

  describe("POST /api/admin/calls/agent/voice-notes", () => {
    it("processes speech transcripts and returns voice URLs", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/agent/voice-notes", {
        method: "POST",
        body: JSON.stringify({ message: "Хочу купить BYD", language: "ru" }),
      });
      const res = await postVoiceNotes(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.user_transcript).toBe("Хочу купить BYD");
      expect(body.ai_response).toContain("отличные варианты");
    });
  });

  describe("POST /api/admin/calls/p2p-blockchain", () => {
    it("simulates decentralized consensus and creates swap blocks", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/p2p-blockchain", {
        method: "POST",
        body: JSON.stringify({ vehicle: "BYD Han", dealer: "Yunusabad Autos", commission: 700 }),
      });
      const res = await postP2pBlockchain(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.block_index).toBeGreaterThan(0);
      expect(body.block_hash).toHaveLength(64);
      expect(body.consensus_status).toBe("verified");
    });
  });

  describe("POST /api/admin/calls/ar-showroom", () => {
    it("acknowledges WebXR synchronization actions", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/ar-showroom", {
        method: "POST",
        body: JSON.stringify({ action: "toggle_doors", value: true }),
      });
      const res = await postArShowroom(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.synced_action).toBe("toggle_doors");
      expect(body.synced_value).toBe(true);
    });
  });

  describe("POST /api/admin/calls/vocal-tremor", () => {
    it("returns micro-tremor stress assessment data", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/vocal-tremor", {
        method: "POST",
        body: JSON.stringify({ stream_duration_seconds: 10 }),
      });
      const res = await postVocalTremor(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.jitter_ratio).toBeGreaterThan(0);
      expect(body.stress_score).toBeGreaterThanOrEqual(10);
      expect(body.guidance_tip).toBeDefined();
    });
  });

  describe("POST /api/admin/calls/dialer-handover", () => {
    it("manages outbound dialing and triggers human hot-handover", async () => {
      const reqStart = new NextRequest("http://localhost/api/admin/calls/dialer-handover", {
        method: "POST",
        body: JSON.stringify({ action: "start" }),
      });
      const resStart = await postDialerHandover(reqStart);
      expect(resStart.status).toBe(200);
      const bodyStart = await resStart.json();
      expect(bodyStart.campaign_status).toBe("active");

      const reqHandover = new NextRequest("http://localhost/api/admin/calls/dialer-handover", {
        method: "POST",
        body: JSON.stringify({ action: "handover", rep_id: "rep-1" }),
      });
      const resHandover = await postDialerHandover(reqHandover);
      expect(resHandover.status).toBe(200);
      const bodyHandover = await resHandover.json();
      expect(bodyHandover.campaign_status).toBe("handover_initiated");
      expect(bodyHandover.client_profile.phone).toBeDefined();
    });
  });

  describe("POST /api/admin/calls/cv-showroom", () => {
    it("inserts visitor camera logs and fetches foot traffic logs", async () => {
      mockDbResult = {
        data: { id: "log-1", attention_duration_seconds: 120, face_match_score: 0.92, matched_inquiry_id: "inq-1" },
        error: null,
      };
      mockBuilder.single.mockResolvedValueOnce(mockDbResult);

      const reqLog = new NextRequest("http://localhost/api/admin/calls/cv-showroom", {
        method: "POST",
        body: JSON.stringify({ action: "log_visitor", matched_inquiry_id: "inq-1" }),
      });
      const resLog = await postCvShowroom(reqLog);
      expect(resLog.status).toBe(200);
      const bodyLog = await resLog.json();
      expect(bodyLog.success).toBe(true);

      const reqList = new NextRequest("http://localhost/api/admin/calls/cv-showroom", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const resList = await postCvShowroom(reqList);
      expect(resList.status).toBe(200);
      const bodyList = await resList.json();
      expect(bodyList.success).toBe(true);
      expect(bodyList.logs).toBeDefined();
    });
  });

  describe("POST /api/admin/calls/dialect-adapt", () => {
    it("converts target responses using dialect modifiers", async () => {
      mockLlmText.mockResolvedValue("Assalomu alaykum, yaxshimisiz? Mashina sotuvda bor bo'pti, ukam.");
      const req = new NextRequest("http://localhost/api/admin/calls/dialect-adapt", {
        method: "POST",
        body: JSON.stringify({ text: "Привет, машина в наличии", region: "Fergana" }),
      });
      const res = await postDialectAdapt(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.adapted_text).toContain("yaxshimisiz");
    });
  });

  describe("POST /api/admin/calls/video-avatar", () => {
    it("generates synthetic avatar video brochures", async () => {
      mockDbResult = {
        data: { id: "vid-1", video_url: "http://mock-video.mp4", avatar_name: "Timur", status: "completed" },
        error: null,
      };
      mockBuilder.single.mockResolvedValueOnce(mockDbResult);

      const req = new NextRequest("http://localhost/api/admin/calls/video-avatar", {
        method: "POST",
        body: JSON.stringify({ client_name: "Anvar", vehicle_model: "BYD Han", avatar_name: "Timur" }),
      });
      const res = await postVideoAvatar(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.video.avatar_name).toBe("Timur");
    });
  });

  describe("POST /api/admin/calls/logistics-dispatch", () => {
    it("parses logistics commands and saves transport runs", async () => {
      mockLlmText.mockResolvedValue(JSON.stringify({
        qty: 3,
        vehicle: "BYD Song Plus",
        source: "Urumqi",
        destination: "Tashkent",
      }));

      mockDbResult = {
        data: { id: "order-1", cargo_qty: 3, vehicle_model: "BYD Song Plus", source_city: "Urumqi", destination_city: "Tashkent", quote_usd: 5400, status: "dispatched" },
        error: null,
      };
      mockBuilder.single.mockResolvedValueOnce(mockDbResult);

      const req = new NextRequest("http://localhost/api/admin/calls/logistics-dispatch", {
        method: "POST",
        body: JSON.stringify({ voice_command: "Отправь 3 BYD Song из Урумчи" }),
      });
      const res = await postLogisticsDispatch(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.logistics_order.cargo_qty).toBe(3);
    });
  });

  describe("POST /api/admin/calls/tradein-valuation", () => {
    it("accepts audio files and calculates trade-in value", async () => {
      mockDbResult = {
        data: { id: "val-1", customer_name: "Anvar", vehicle_details: "Gentra 2022", engine_health_status: "healthy_idle", body_damage_details: "minor_scratches_left_fender", computed_value_usd: 12200, status: "approved" },
        error: null,
      };
      mockBuilder.single.mockResolvedValueOnce(mockDbResult);

      const fd = new FormData();
      fd.append("customer_name", "Anvar");
      fd.append("car_details", "Gentra 2022");
      fd.append("engine_audio", new Blob(["mock-wav"], { type: "audio/wav" }));
      fd.append("body_photo", new Blob(["mock-jpeg"], { type: "image/jpeg" }));

      const req = new NextRequest("http://localhost/api/admin/calls/tradein-valuation", {
        method: "POST",
        body: fd,
      });
      const res = await postTradeIn(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.valuation.computed_value_usd).toBe(12200);
    });
  });
});
export const runtime = "nodejs";
