"use client";

import { useEffect, useState } from "react";
import { Send, Link2, Check, Menu, X } from "lucide-react";

interface HeadingItem {
  text: string;
  id: string;
  level: number;
}

interface BlogDetailClientProps {
  headings: HeadingItem[];
  shareUrl: string;
  shareTitle: string;
  locale: "ru" | "uz" | "en";
}

const TEXT = {
  ru: {
    toc: "Содержание",
    share: "Поделиться",
    copied: "Ссылка скопирована",
    copy: "Копировать ссылку",
  },
  uz: {
    toc: "Mundarija",
    share: "Ulashish",
    copied: "Havola nusxalandi",
    copy: "Havolani nusxalash",
  },
  en: {
    toc: "Table of Contents",
    share: "Share",
    copied: "Link copied",
    copy: "Copy link",
  },
};

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export function BlogDetailClient({ headings, shareUrl, shareTitle, locale }: BlogDetailClientProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const t = TEXT[locale] || TEXT.ru;

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Add copy buttons to code blocks
  useEffect(() => {
    const preBlocks = document.querySelectorAll("article pre");
    preBlocks.forEach((pre) => {
      if (pre.querySelector(".copy-code-btn")) return;
      pre.classList.add("relative", "group/pre");

      const button = document.createElement("button");
      button.className = "copy-code-btn absolute top-3 right-3 p-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground opacity-0 group-hover/pre:opacity-100 transition-all text-[11px] font-mono border border-border/50 backdrop-blur-sm shadow-sm";
      button.textContent = locale === "ru" ? "Копировать" : locale === "uz" ? "Nusxalash" : "Copy";

      button.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.textContent || "";
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = locale === "ru" ? "Скопировано!" : locale === "uz" ? "Nusxalandi!" : "Copied!";
          button.classList.add("text-emerald-500", "border-emerald-500/30", "bg-emerald-500/10");
          setTimeout(() => {
            button.textContent = locale === "ru" ? "Копировать" : locale === "uz" ? "Nusxalash" : "Copy";
            button.classList.remove("text-emerald-500", "border-emerald-500/30", "bg-emerald-500/10");
          }, 2000);
        } catch {
          // silent fallback
        }
      });

      pre.appendChild(button);
    });
  }, [locale]);

  // Track active heading on scroll
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          setActiveId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0.1,
      }
    );

    headings.forEach((heading) => {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    });

    return () => {
      headings.forEach((heading) => {
        const el = document.getElementById(heading.id);
        if (el) observer.unobserve(el);
      });
    };
  }, [headings]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
    }
  };

  const shareTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      "_blank"
    );
  };

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      "_blank"
    );
  };

  if (headings.length === 0) return null;

  return (
    <>
      {/* Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-primary z-50 transition-all duration-75"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Floating Share Bar (Sidebar Desktop) */}
      <div className="hidden xl:flex flex-col gap-3 items-center sticky top-32 left-0 w-0 h-0 -ml-16 z-20">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono writing-mode-vertical rotate-180 mb-2">
          {t.share}
        </span>
        <button
          onClick={shareTelegram}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
          title="Share to Telegram"
        >
          <Send className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
        </button>
        <button
          onClick={shareTwitter}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
          title="Share to Twitter / X"
        >
          <XIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleCopyLink}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
            copied
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-card border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5"
          }`}
          title={t.copy}
        >
          {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Sticky Table of Contents (Right Sidebar Desktop) */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-32 h-fit max-h-[calc(100vh-160px)] overflow-y-auto pr-4 scrollbar-thin">
        <div className="space-y-4">
          <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {t.toc}
          </h4>
          <nav className="flex flex-col gap-2.5 text-sm border-l border-border pl-0">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`block pl-4 -ml-[1px] border-l py-0.5 leading-relaxed transition-all transition-colors ${
                  activeId === heading.id
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                } ${heading.level === 3 ? "pl-7 text-xs" : ""}`}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Share and TOC Navigation Floating Bar */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <button
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          {isOpenMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {isOpenMobile && (
          <div className="absolute bottom-16 right-0 bg-card border border-border rounded-2xl p-4 shadow-xl w-64 max-h-80 overflow-y-auto flex flex-col gap-4 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{t.toc}</span>
              <div className="flex gap-2">
                <button onClick={shareTelegram} className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground hover:text-primary">
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button onClick={shareTwitter} className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground hover:text-primary">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleCopyLink} className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground hover:text-primary">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <nav className="flex flex-col gap-2.5 text-xs">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  onClick={() => setIsOpenMobile(false)}
                  className={`block py-0.5 leading-relaxed border-l pl-3 ${
                    activeId === heading.id
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground"
                  } ${heading.level === 3 ? "pl-6 text-[11px]" : ""}`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}

interface BlogFeedbackWidgetProps {
  postSlug: string;
  locale: "ru" | "uz" | "en";
}

const FEEDBACK_TEXT = {
  ru: {
    question: "Была ли эта статья полезна?",
    yes: "Да, спасибо!",
    no: "Нет",
    thanks: "Спасибо за ваш отзыв!",
  },
  uz: {
    question: "Ushbu maqola foydali bo'ldimi?",
    yes: "Ha, rahmat!",
    no: "Yo'q",
    thanks: "Fikr-mulohazangiz uchun rahmat!",
  },
  en: {
    question: "Was this article helpful?",
    yes: "Yes, thanks!",
    no: "No",
    thanks: "Thank you for your feedback!",
  },
};

export function BlogFeedbackWidget({ postSlug, locale }: BlogFeedbackWidgetProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean | null>(null);
  const ft = FEEDBACK_TEXT[locale] || FEEDBACK_TEXT.ru;

  useEffect(() => {
    const key = `blog-feedback-${postSlug}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setFeedbackSubmitted(true);
    }
  }, [postSlug]);

  const handleFeedback = (type: "yes" | "no") => {
    const key = `blog-feedback-${postSlug}`;
    localStorage.setItem(key, type);
    setFeedbackSubmitted(true);
  };

  if (feedbackSubmitted) {
    return (
      <div className="mt-8 border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
        {ft.thanks}
      </div>
    );
  }

  return (
    <div className="mt-8 border border-border bg-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
      <span className="text-xs font-semibold text-foreground">
        {ft.question}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => handleFeedback("yes")}
          className="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg border border-border bg-foreground/5 hover:bg-foreground/10 text-xs font-bold text-foreground transition-all hover:border-primary/30"
        >
          👍 {ft.yes}
        </button>
        <button
          onClick={() => handleFeedback("no")}
          className="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg border border-border bg-foreground/5 hover:bg-foreground/10 text-xs font-bold text-foreground transition-all hover:border-primary/30"
        >
          👎 {ft.no}
        </button>
      </div>
    </div>
  );
}
