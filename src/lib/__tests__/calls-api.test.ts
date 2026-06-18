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
  ilike: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
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

import { POST as postLedger } from "@/app/api/admin/calls/ledger/route";
import { POST as postP2p } from "@/app/api/admin/calls/agent/p2p/route";
import { POST as postVoiceCrm } from "@/app/api/admin/calls/agent/voice-crm/route";

describe("CRM Call Center API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default authorized
    mockRequireAdmin.mockResolvedValue(null);
    mockDbResult = { data: null, error: null };
  });

  describe("POST /api/admin/calls/ledger", () => {
    it("fails with 401 if unauthorized", async () => {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
      const req = new NextRequest("http://localhost/api/admin/calls/ledger", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await postLedger(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("fails with 400 if parameters are missing", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/ledger", {
        method: "POST",
        body: JSON.stringify({ phone: "+998901234567" }), // missing amount & voice_signature_token
      });
      const res = await postLedger(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Missing required deal parameters");
    });

    it("creates a cryptographic signature and logs the ledger transaction", async () => {
      mockBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "inquiry-123" }, error: null });
      mockBuilder.single.mockResolvedValueOnce({
        data: {
          id: "ledger-abc",
          inquiry_id: "inquiry-123",
          caller_phone: "+998901234567",
          amount_usd: 1500,
          cryptographic_signature: "hash123",
          verified_at: "2026-06-18T00:00:00Z",
          status: "signed",
        },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/admin/calls/ledger", {
        method: "POST",
        body: JSON.stringify({
          phone: "+998901234567",
          amount: 1500,
          voice_signature_token: "voice-token-999",
        }),
      });

      const res = await postLedger(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.ledger_id).toBe("ledger-abc");
      expect(body.cryptographic_signature).toHaveLength(64); // SHA-256 hex string length
      expect(body.status).toBe("signed");
    });
  });

  describe("POST /api/admin/calls/agent/p2p", () => {
    it("fails with 401 if unauthorized", async () => {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
      const req = new NextRequest("http://localhost/api/admin/calls/agent/p2p", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await postP2p(req);
      expect(res.status).toBe(401);
    });

    it("fails with 400 if vehicle is missing", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/agent/p2p", {
        method: "POST",
        body: JSON.stringify({ color: "Black" }),
      });
      const res = await postP2p(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Missing vehicle parameter");
    });

    it("looks up p2p inventory database table and returns negotiation simulation logs", async () => {
      mockBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          dealer_name: "Yunusabad Autos P2P",
          wholesale_price: 23500,
          commission_usd: 600,
          eta_days: 2,
        },
        error: null,
      });

      const req = new NextRequest("http://localhost/api/admin/calls/agent/p2p", {
        method: "POST",
        body: JSON.stringify({ vehicle: "BYD Han", color: "Matte Black" }),
      });

      const res = await postP2p(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.dealer_name).toBe("Yunusabad Autos P2P");
      expect(body.wholesale_price).toBe(23500);
      expect(body.commission_usd).toBe(600);
      expect(body.eta_days).toBe(2);
      expect(body.logs).toHaveLength(5);
    });
  });

  describe("POST /api/admin/calls/agent/voice-crm", () => {
    it("fails with 401 if unauthorized", async () => {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
      const req = new NextRequest("http://localhost/api/admin/calls/agent/voice-crm", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await postVoiceCrm(req);
      expect(res.status).toBe(401);
    });

    it("fails with 400 if voice_command is missing", async () => {
      const req = new NextRequest("http://localhost/api/admin/calls/agent/voice-crm", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await postVoiceCrm(req);
      expect(res.status).toBe(400);
    });

    it("translates voice command to read-only SQL and executes it", async () => {
      mockLlmText.mockResolvedValue(JSON.stringify({
        sql: "SELECT * FROM public.cars WHERE model ILIKE '%Song%' AND available = true;",
        explanation: "Querying active BYD Song vehicles",
      }));

      // Mock DB records response for Thenable
      mockDbResult = {
        data: [{ brand: "BYD", model: "Song Plus EV", price_usd: 25000, color: "Grey", year: 2026 }],
        error: null,
      };

      const req = new NextRequest("http://localhost/api/admin/calls/agent/voice-crm", {
        method: "POST",
        body: JSON.stringify({ voice_command: "Show me available BYD Songs" }),
      });

      const res = await postVoiceCrm(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.sql).toContain("SELECT");
      expect(body.results).toHaveLength(1);
      expect(body.results[0].model).toBe("Song Plus EV");
    });
  });
});
