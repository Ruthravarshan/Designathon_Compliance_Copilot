"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface AssistantCitation {
  id: string;
  label: string;
  quote: string;
  kind?: "policy" | "control" | "clause";
  documentId?: string;
  pageNumber?: number;
  webUrl?: string;
  pdfUrl?: string;
  workspaceUrl?: string;
}

interface AssistantCopyProps {
  answer: string;
  citations: AssistantCitation[];
}

type Format = "text" | "markdown" | "rich";

function absolute(url: string | undefined, origin: string): string | undefined {
  if (!url) {
    return undefined;
  }
  return /^https?:\/\//i.test(url) ? url : `${origin}${url}`;
}

function linkFor(citation: AssistantCitation, origin: string): string | undefined {
  return (
    absolute(citation.webUrl, origin) ??
    absolute(citation.workspaceUrl, origin) ??
    absolute(citation.pdfUrl, origin)
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPlain(answer: string, citations: AssistantCitation[], origin: string): string {
  if (citations.length === 0) {
    return answer;
  }
  const lines = citations.map((citation, index) => {
    const url = linkFor(citation, origin);
    const where = url ? ` ${url}` : "";
    return `${index + 1}. ${citation.label}${where}\n   "${citation.quote}"`;
  });
  return `${answer}\n\nSources:\n${lines.join("\n")}`;
}

function buildMarkdown(answer: string, citations: AssistantCitation[], origin: string): string {
  if (citations.length === 0) {
    return answer;
  }
  const lines = citations.map((citation, index) => {
    const url = linkFor(citation, origin);
    const label = url ? `[${citation.label}](${url})` : citation.label;
    return `${index + 1}. ${label} — "${citation.quote}"`;
  });
  return `${answer}\n\n**Sources**\n\n${lines.join("\n")}`;
}

function buildHtml(answer: string, citations: AssistantCitation[], origin: string): string {
  const body = `<p>${escapeHtml(answer).replace(/\n/g, "<br>")}</p>`;
  if (citations.length === 0) {
    return body;
  }
  const items = citations.map((citation) => {
    const url = linkFor(citation, origin);
    const label = url
      ? `<a href="${escapeHtml(url)}">${escapeHtml(citation.label)}</a>`
      : escapeHtml(citation.label);
    return `<li>${label} — <q>${escapeHtml(citation.quote)}</q></li>`;
  });
  return `${body}<p><strong>Sources</strong></p><ol>${items.join("")}</ol>`;
}

export function AssistantCopy({ answer, citations }: AssistantCopyProps) {
  const [copied, setCopied] = useState<Format | null>(null);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(format: Format) {
    const origin = window.location.origin;
    try {
      if (format === "rich" && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        const html = buildHtml(answer, citations, origin);
        const text = buildPlain(answer, citations, origin);
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        const value =
          format === "markdown"
            ? buildMarkdown(answer, citations, origin)
            : buildPlain(answer, citations, origin);
        await navigator.clipboard.writeText(value);
      }
      setCopied(format);
    } catch {
      setCopied(null);
    }
  }

  const options: Array<{ format: Format; label: string; copiedLabel: string }> = [
    { format: "text", label: "Copy", copiedLabel: "Copied" },
    { format: "markdown", label: "Markdown", copiedLabel: "Markdown copied" },
    { format: "rich", label: "Rich text", copiedLabel: "Rich text copied" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const done = copied === option.format;
        return (
          <button
            key={option.format}
            type="button"
            onClick={() => void copy(option.format)}
            aria-label={done ? option.copiedLabel : `Copy answer as ${option.label.toLowerCase()}`}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-muted/60 hover:text-fg",
            )}
          >
            {done ? (
              <>
                <Check size={12} weight="bold" aria-hidden="true" className="text-brand" />
                <span className="text-fg">{option.copiedLabel}</span>
              </>
            ) : (
              <>
                <Copy size={12} weight="bold" aria-hidden="true" />
                <span>{option.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
