"use client";

import { useState } from "react";
import { ArrowSquareOut, FilePdf, Globe, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/navigation-controls";

export function SourceLink({
  sourceUrl,
  label = "View source",
  missingReason = "No original source URL recorded for this circular.",
  className,
}: {
  sourceUrl?: string | null;
  label?: string;
  missingReason?: string;
  className?: string;
}) {
  const isHttp =
    Boolean(sourceUrl) && (sourceUrl!.startsWith("https://") || sourceUrl!.startsWith("http://"));

  if (!isHttp) {
    return (
      <span
        title={missingReason}
        aria-disabled="true"
        className={cn(
          "inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 text-xs font-medium text-muted opacity-70",
          className,
        )}
      >
        <Globe size={14} weight="bold" aria-hidden="true" />
        <span>{label} unavailable</span>
      </span>
    );
  }

  return (
    <a
      href={sourceUrl!}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-xs font-medium text-fg transition-colors duration-150 hover:border-muted/60 hover:bg-surface-2 sm:min-h-10",
        className,
      )}
    >
      <Globe size={14} weight="bold" aria-hidden="true" className="text-brand" />
      <span>{label}</span>
      <ArrowSquareOut size={13} weight="bold" aria-hidden="true" className="text-muted" />
    </a>
  );
}

export function PdfPanel({
  title,
  fileUrl,
  sourceUrl,
  filename,
  className,
}: {
  title: string;
  fileUrl?: string | null;
  sourceUrl?: string | null;
  filename?: string | null;
  className?: string;
}) {
  const hasPdf = Boolean(fileUrl);
  const hasSource = Boolean(
    sourceUrl && (sourceUrl.startsWith("https://") || sourceUrl.startsWith("http://")),
  );

  const [mode, setMode] = useState<"pdf" | "source">(hasPdf ? "pdf" : "source");
  const [iframeState, setIframeState] = useState<"loading" | "ready" | "error">("loading");

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            Third-party regulatory document
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-fg">{filename ?? title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedControl
            label="Document view mode"
            value={mode}
            onChange={(next) => setMode(next)}
            options={[
              {
                value: "pdf",
                label: "PDF",
                disabled: !hasPdf,
                title: hasPdf ? "View stored PDF" : "No stored PDF available",
              },
              {
                value: "source",
                label: "Source",
                disabled: !hasSource,
                title: hasSource ? "View original source metadata" : "No source URL recorded",
              },
            ]}
          />
          {hasPdf && fileUrl ? (
            <LinkButton
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              <FilePdf size={14} weight="bold" aria-hidden="true" className="text-brand" />
              Open PDF
            </LinkButton>
          ) : null}
        </div>
      </CardHeader>

      <CardBody className="p-0">
        {mode === "pdf" ? (
          hasPdf && fileUrl ? (
            <>
              {/* Mobile (< 768px): explicit document card link instead of cramped iframe */}
              <div className="space-y-4 p-5 md:hidden">
                <p className="text-sm leading-relaxed text-muted">
                  Open the stored regulatory PDF in a dedicated viewer tab for full zoom and page
                  navigation.
                </p>
                <LinkButton href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <FilePdf size={16} weight="bold" aria-hidden="true" />
                  Open PDF
                </LinkButton>
              </div>

              {/* Tablet / Desktop (>= 768px): lazy labelled iframe with loading & error fallback */}
              <div className="relative hidden min-h-[540px] bg-surface-2 md:block">
                {iframeState === "loading" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="pp-skeleton h-5 w-48 rounded-full" />
                    <p className="text-xs text-muted">Loading stored PDF preview...</p>
                  </div>
                ) : null}

                {iframeState === "error" ? (
                  <div className="flex min-h-[540px] flex-col items-center justify-center gap-3 p-6 text-center">
                    <WarningCircle
                      size={22}
                      weight="fill"
                      aria-hidden="true"
                      className="text-danger"
                    />
                    <p className="text-sm font-medium text-fg">
                      Inline PDF preview could not render in this browser.
                    </p>
                    <LinkButton href={fileUrl} target="_blank" rel="noopener noreferrer">
                      Open PDF
                    </LinkButton>
                  </div>
                ) : (
                  <iframe
                    src={fileUrl}
                    title={`Regulatory PDF: ${title}`}
                    loading="lazy"
                    onLoad={() => setIframeState("ready")}
                    onError={() => setIframeState("error")}
                    className="h-[640px] w-full border-0"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-sm text-muted">
              No stored PDF file is attached to this circular.{" "}
              {hasSource ? "Switch to Source to inspect the original link." : ""}
            </div>
          )
        ) : (
          <div className="space-y-4 p-6">
            <p className="text-sm leading-relaxed text-muted">
              Original publication recorded at ingestion. Opening the source link leaves PolicyPulse
              in a new browser tab.
            </p>
            <SourceLink sourceUrl={sourceUrl} label="View source" />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
