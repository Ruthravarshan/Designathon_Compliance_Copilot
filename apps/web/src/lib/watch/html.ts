const BLOCK_TAGS = /<\/?(?:p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|blockquote|pre)\b[^>]*>/gi;
const DROP_ELEMENTS = /<(script|style|noscript|svg|form|button|nav|aside)\b[^>]*>[\s\S]*?<\/\1>/gi;
const GENERIC_TITLES = new Set([
  "master directions",
  "circulars",
  "notifications",
  "press releases",
  "reserve bank of india",
  "securities and exchange board of india",
  "home",
]);

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    });
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Convert an HTML document into paragraph-separated plain text. */
export function htmlToText(html: string): string {
  const withoutDrop = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(DROP_ELEMENTS, " ")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ");

  const mainStart = withoutDrop.search(/id\s*=\s*["'](?:mainsection|divArchiveMain|main-content)["']/i);
  const scoped = mainStart >= 0 ? withoutDrop.slice(mainStart) : withoutDrop;

  const withBreaks = scoped.replace(BLOCK_TAGS, "\n\n");
  const text = decodeEntities(withBreaks.replace(/<[^>]*>/g, " "));

  return text
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/[ \t\f\v]+/g, " ").replace(/\s+$/g, "").trim())
    .filter((block) => block.length > 0)
    .join("\n\n")
    .trim();
}

/** Best-effort title: heading, then bold line with a document keyword, then <title>. */
export function deriveTitle(html: string, fallback: string): string {
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const headingText = heading ? stripTags(heading[1] ?? "") : "";
  if (headingText.length >= 8 && headingText.length <= 160 && !GENERIC_TITLES.has(headingText.toLowerCase())) {
    return headingText;
  }

  const bold = /<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi;
  let boldMatch: RegExpExecArray | null;
  while ((boldMatch = bold.exec(html)) !== null) {
    const text = stripTags(boldMatch[1] ?? "");
    if (
      text.length >= 16 &&
      text.length <= 180 &&
      /(direction|guideline|circular|framework|policy|\bact\b|regulation|notification)/i.test(text)
    ) {
      return text;
    }
  }

  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title) {
    const first = stripTags(title[1] ?? "").split(/\s[|–-]\s/)[0]?.trim() ?? "";
    if (first.length >= 8 && !GENERIC_TITLES.has(first.toLowerCase())) {
      return first;
    }
  }

  return fallback;
}

/** First couple of sentences, bounded, used for the register summary. */
export function deriveSummary(text: string, maxLength = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean === "") {
    return "";
  }

  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let summary = "";
  for (const sentence of sentences) {
    const candidate = `${summary} ${sentence}`.trim();
    if (candidate.length > maxLength) {
      break;
    }
    summary = candidate;
    if (summary.length >= 120) {
      break;
    }
  }

  if (summary === "") {
    return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}…` : clean;
  }

  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trim()}…` : summary;
}
