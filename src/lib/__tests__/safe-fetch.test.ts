import { describe, it, expect, beforeEach, vi } from "vitest";
import { safeFetch } from "../safe-fetch";

type FetchInput = string | URL | Request;
type FetchInit = RequestInit | undefined;
type FetchFn = (input: FetchInput, init?: FetchInit) => Promise<Response>;

describe("safeFetch — manual-redirect, SSRF-guarded", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an entry URL that points to a private host", async () => {
    await expect(safeFetch("http://127.0.0.1/admin")).rejects.toThrow(/unsafe target/i);
  });

  it("follows a redirect to a public host", async () => {
    const calls: string[] = [];
    const mock: FetchFn = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://example.com/a") {
        return new Response(null, { status: 302, headers: { location: "https://example.org/b" } });
      }
      return new Response("ok", { status: 200 });
    };
    vi.stubGlobal("fetch", mock);

    const res = await safeFetch("https://example.com/a");
    expect(res.status).toBe(200);
    expect(calls).toEqual(["https://example.com/a", "https://example.org/b"]);
  });

  it("BLOCKS a redirect that targets a private host", async () => {
    const mock: FetchFn = async (input) => {
      const url = String(input);
      if (url === "https://example.com/redirector") {
        // Classic SSRF-via-redirect: public entry, private destination.
        return new Response(null, { status: 301, headers: { location: "http://169.254.169.254/latest/" } });
      }
      // Should never be called.
      return new Response("LEAKED", { status: 200 });
    };
    vi.stubGlobal("fetch", mock);

    await expect(safeFetch("https://example.com/redirector")).rejects.toThrow(/unsafe target/i);
  });

  it("caps the redirect chain", async () => {
    const mock: FetchFn = async () =>
      new Response(null, { status: 302, headers: { location: "https://example.com/next" } });
    vi.stubGlobal("fetch", mock);

    await expect(safeFetch("https://example.com/start", { maxRedirects: 2 })).rejects.toThrow(/too many redirects/i);
  });

  it("recomputes per-hop headers via getHeaders", async () => {
    const seen: Array<{ url: string; referer: string | null }> = [];
    const mock: FetchFn = async (input, init) => {
      const url = String(input);
      const referer = (() => {
        if (!init?.headers) return null;
        const h = new Headers(init.headers);
        return h.get("referer");
      })();
      seen.push({ url, referer });
      if (url === "https://a.example/x") {
        return new Response(null, { status: 301, headers: { location: "https://b.example/y" } });
      }
      return new Response("ok", { status: 200 });
    };
    vi.stubGlobal("fetch", mock);

    await safeFetch("https://a.example/x", {
      getHeaders: (u) => ({ referer: new URL(u).origin + "/" }),
    });

    expect(seen[0]).toEqual({ url: "https://a.example/x", referer: "https://a.example/" });
    expect(seen[1]).toEqual({ url: "https://b.example/y", referer: "https://b.example/" });
  });
});
