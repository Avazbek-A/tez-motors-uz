import { describe, it, expect, vi, afterEach } from "vitest";
import { isSafeRemoteUrl, sniffImageMime, parseMediaFromHtml, extractMediaFromPage } from "../media-ingest";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(Math.max(0, 12 - b.length)).fill(0)]);

describe("sniffImageMime (magic-byte validation)", () => {
  it("recognizes JPEG / PNG / WebP by signature", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    // RIFF....WEBP
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("rejects SVG (XSS vector), GIF, HTML, and short buffers", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>");
    expect(sniffImageMime(svg)).toBeNull();
    expect(sniffImageMime(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // GIF89a
    expect(sniffImageMime(new TextEncoder().encode("<html><body>x"))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull(); // too short
  });
  it("rejects a RIFF container that isn't WEBP (e.g. WAV)", () => {
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe("isSafeRemoteUrl (SSRF guard)", () => {
  it("allows normal public http(s) URLs", () => {
    expect(isSafeRemoteUrl("https://www.autohome.com.cn/photo.jpg")).toBe(true);
    expect(isSafeRemoteUrl("http://example.com/a.png")).toBe(true);
    expect(isSafeRemoteUrl("https://cdn.alicdn.com/img.webp")).toBe(true);
  });

  it("rejects non-http(s) schemes", () => {
    for (const u of ["ftp://example.com/x", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,x", "gopher://x"]) {
      expect(isSafeRemoteUrl(u)).toBe(false);
    }
  });

  it("rejects localhost and internal TLDs", () => {
    for (const u of ["http://localhost/x", "http://localhost:8080/x", "http://printer.local/x", "http://db.internal/x", "http://x.localhost/y"]) {
      expect(isSafeRemoteUrl(u)).toBe(false);
    }
  });

  it("rejects private / loopback / link-local IPv4", () => {
    for (const h of ["127.0.0.1", "127.1.2.3", "10.0.0.5", "192.168.1.1", "172.16.0.1", "172.31.255.255", "169.254.169.254", "0.0.0.0"]) {
      expect(isSafeRemoteUrl(`http://${h}/x`)).toBe(false);
    }
  });

  it("allows public IPv4 (e.g. a CDN) and 172.x outside the private range", () => {
    expect(isSafeRemoteUrl("http://8.8.8.8/x")).toBe(true);
    expect(isSafeRemoteUrl("http://172.32.0.1/x")).toBe(true); // just outside 172.16–31
  });

  it("blocks integer and hex IP encodings (loopback bypass)", () => {
    expect(isSafeRemoteUrl("http://2130706433/x")).toBe(false); // 127.0.0.1 as int
    expect(isSafeRemoteUrl("http://0x7f000001/x")).toBe(false); // 127.0.0.1 as hex
  });

  it("blocks IPv6 loopback and unique-local, with or without brackets", () => {
    expect(isSafeRemoteUrl("http://[::1]/x")).toBe(false);
    expect(isSafeRemoteUrl("http://[fc00::1]/x")).toBe(false);
    expect(isSafeRemoteUrl("http://[fd12:3456::1]/x")).toBe(false);
  });

  it("does NOT false-block domains that merely start with fc/fd", () => {
    expect(isSafeRemoteUrl("https://fcbarcelona.com/logo.png")).toBe(true);
    expect(isSafeRemoteUrl("https://fdgroup.example/x.jpg")).toBe(true);
  });

  it("rejects garbage input", () => {
    expect(isSafeRemoteUrl("not a url")).toBe(false);
    expect(isSafeRemoteUrl("")).toBe(false);
  });
});

describe("parseMediaFromHtml (AutoHome / lazy-load galleries)", () => {
  const html = `
    <html><head>
      <meta property="og:image" content="https://www.autohome.com.cn/share/cover.jpg" />
    </head><body>
      <div id="app"></div>
      <script>
        window.__INITIAL__ = {"gallery":[
          {"src":"https://car2.autoimg.cn/cardfs/product/g30/M00/front.jpg"},
          {"src":"//car3.autoimg.cn/cardfs/product/g30/M01/rear.jpg"}
        ],"logo":"https://x.autohome.com.cn/sprite-icons.png"};
      </script>
      <img data-src="https://car2.autoimg.cn/cardfs/product/g30/M02/side.jpg" />
    </body></html>`;
  const urls = () => parseMediaFromHtml(html, "https://www.autohome.com.cn/x").map((c) => c.url);

  it("extracts gallery images embedded in inline-script JSON (autoimg.cn)", () => {
    expect(urls()).toContain("https://car2.autoimg.cn/cardfs/product/g30/M00/front.jpg");
    expect(urls()).toContain("https://car2.autoimg.cn/cardfs/product/g30/M02/side.jpg");
  });
  it("resolves protocol-relative // URLs against the page", () => {
    expect(urls()).toContain("https://car3.autoimg.cn/cardfs/product/g30/M01/rear.jpg");
  });
  it("keeps og:image and ranks structured candidates first", () => {
    expect(urls()[0]).toBe("https://www.autohome.com.cn/share/cover.jpg");
  });
  it("filters out obvious icon/sprite junk", () => {
    expect(urls().some((u) => u.includes("sprite-icons"))).toBe(false);
  });
  it("returns [] for HTML with no images", () => {
    expect(parseMediaFromHtml("<html><body>nothing</body></html>", "https://x.com")).toEqual([]);
  });
});

describe("fetchWithTimeout via extractMediaFromPage (SSRF-via-redirect guard)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

  it("REFUSES to follow a redirect into the private network (127.0.0.1)", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      calls.push(u);
      // Public URL responds with a redirect to a private IP — the classic SSRF
      // bypass. With redirect:"follow" the runtime would chase this; we don't.
      if (u.startsWith("https://attacker.example.com")) {
        return new Response("", { status: 302, headers: { location: "http://127.0.0.1/admin" } });
      }
      throw new Error(`unexpected fetch to ${u}`);
    }) as unknown as typeof fetch;

    const out = await extractMediaFromPage("https://attacker.example.com/r");
    expect(out).toEqual([]); // fetch threw → fail-open empty
    expect(calls).toEqual(["https://attacker.example.com/r"]); // NEVER hit 127.0.0.1
  });

  it("DOES follow safe public-to-public redirects (e.g. CDN reshuffles)", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      calls.push(u);
      if (u === "https://cdn.example.com/x") {
        return new Response("", { status: 301, headers: { location: "https://cdn2.example.com/x.html" } });
      }
      return new Response('<meta property="og:image" content="https://cdn2.example.com/hero.jpg">', { status: 200 });
    }) as unknown as typeof fetch;

    const out = await extractMediaFromPage("https://cdn.example.com/x");
    expect(calls).toEqual(["https://cdn.example.com/x", "https://cdn2.example.com/x.html"]);
    expect(out.find((c) => c.url.endsWith("hero.jpg"))).toBeTruthy();
  });
});
