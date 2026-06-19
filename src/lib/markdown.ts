import { escapeHtml } from "@/lib/escape-html";
import { slugify } from "@/lib/utils";

function formatInline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // external links → new tab. Text capture excludes `]` so it can't span a
    // following link on the same line (e.g. an earlier internal `[x](/y)`).
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // internal / relative links (/ru/calculator, #anchor) → same tab
    .replace(/\[([^\]]+)\]\((\/[^\s)]+|#[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

// GFM-table separator row, e.g. `| :-- | :-: | --: |`
function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes("-") || !t.includes("|")) return false;
  const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((c) => /^\s*:?-{1,}:?\s*$/.test(c));
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const CALLOUT_ICON: Record<string, string> = {
  tip: "💡", important: "❗", warning: "⚠️", caution: "⚠️", note: "ℹ️", info: "ℹ️",
};

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let blockquoteLines: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    parts.push(`<p>${paragraph.map((line) => formatInline(line)).join(" ")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    parts.push(`<ul>${listItems.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };
  const flushOrdered = () => {
    if (!orderedItems.length) return;
    parts.push(`<ol>${orderedItems.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ol>`);
    orderedItems = [];
  };
  const flushBlockquote = () => {
    if (!blockquoteLines.length) return;
    // Admonition / callout: first line is `[!TYPE]`
    const m = blockquoteLines[0].match(/^\[!(\w+)\]\s*$/i);
    if (m) {
      const type = m[1].toLowerCase();
      const icon = CALLOUT_ICON[type] || CALLOUT_ICON.note;
      const bodyLines = blockquoteLines.slice(1);
      const body = bodyLines.length
        ? `<p>${bodyLines.map((line) => formatInline(line)).join("<br />")}</p>`
        : "";
      parts.push(
        `<div class="md-callout md-callout-${type}"><span class="md-callout-icon" aria-hidden="true">${icon}</span><div class="md-callout-body">${body}</div></div>`,
      );
    } else {
      parts.push(`<blockquote><p>${blockquoteLines.map((line) => formatInline(line)).join("<br />")}</p></blockquote>`);
    }
    blockquoteLines = [];
  };
  const flushCode = () => {
    if (!codeLines.length) return;
    parts.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushOrdered();
    flushBlockquote();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCode) flushCode();
      else flushAll();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    // GFM table: a header row followed by a separator row.
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushAll();
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const s = c.trim();
        const l = s.startsWith(":"), r = s.endsWith(":");
        return l && r ? "center" : r ? "right" : "left";
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|") && !isTableSeparator(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--; // the for-loop will increment past the last consumed row
      const al = (idx: number) => aligns[idx] || "left";
      const thead = `<thead><tr>${header.map((c, idx) => `<th style="text-align:${al(idx)}">${formatInline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${header.map((_, idx) => `<td style="text-align:${al(idx)}">${formatInline(r[idx] || "")}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      parts.push(`<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>`);
      continue;
    }

    // Blockquotes / callouts
    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      flushOrdered();
      blockquoteLines.push(line.replace(/^>\s?/, ""));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2];
      const id = slugify(text.replace(/[*`_]/g, ""));
      parts.push(`<h${level} id="${id}">${formatInline(text)}</h${level}>`);
      continue;
    }

    // Ordered list (1. 2. ...)
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      orderedItems.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    // Unordered list (- *)
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      flushOrdered();
      flushBlockquote();
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }

    paragraph.push(line);
  }

  flushAll();
  flushCode();

  return parts.join("\n");
}
