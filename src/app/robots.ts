import type { MetadataRoute } from "next";

/**
 * robots.txt
 *
 * Defaults: allow all of /, block /admin and /api. Then explicitly
 * welcome named AI crawlers — many sites accidentally block these
 * with a sweeping rule. We want to be cited by ChatGPT, Claude,
 * Gemini, Perplexity, Apple Intelligence, etc., so we name each.
 *
 * Yandex / Bing / Google standard crawlers are also explicit so a
 * future tightening of the catch-all rule doesn't lock them out.
 */
export default function robots(): MetadataRoute.Robots {
  const sitemap = "https://tezmotors.uz/sitemap.xml";

  // AI search + research crawlers we want indexing us.
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "Google-Extended",
    "PerplexityBot",
    "Applebot-Extended",
    "Applebot",
    "MistralAI-User",
    "Cohere-AI",
    "DiffbotMagi",
    "Bytespider",
    "YouBot",
    "Amazonbot",
    "MetaExternalAgent",
  ];

  // Standard search engines — explicit allow keeps them safe from any
  // future restrictive catch-all rule.
  const searchCrawlers = [
    "Googlebot",
    "Googlebot-Image",
    "Bingbot",
    "YandexBot",
    "YandexImages",
    "DuckDuckBot",
    "Slurp",
    "Baiduspider",
    "Sogou",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/_next/"],
      },
      ...aiCrawlers.map((agent) => ({
        userAgent: agent,
        allow: "/",
        disallow: ["/admin", "/api/"],
      })),
      ...searchCrawlers.map((agent) => ({
        userAgent: agent,
        allow: "/",
        disallow: ["/admin", "/api/"],
      })),
    ],
    sitemap,
    host: "https://tezmotors.uz",
  };
}
