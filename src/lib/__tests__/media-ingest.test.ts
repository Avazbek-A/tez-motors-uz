import { describe, it, expect } from "vitest";
import { isSafeRemoteUrl } from "../media-ingest";

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
