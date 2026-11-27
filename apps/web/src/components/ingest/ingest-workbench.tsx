"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/navigation-controls";
import { PageHeader } from "@/components/ui/page-header";
import { JobStepper, type IngestionRunView } from "./job-stepper";
import { UploadDropzone } from "./upload-dropzone";

export interface IngestSourceOption {
  id: string;
  name: string;
  issuer: string;
}

export function IngestWorkbench({
  maxSizeBytes,
  sources,
  onUploadPdf,
  onIngestUrl,
  onPollRun,
  onRetryRun,
}: {
  maxSizeBytes: number;
  sources: readonly IngestSourceOption[];
  onUploadPdf: (payload: {
    file: File;
    sourceId?: string;
  }) => Promise<
    { ok: true; run: IngestionRunView } | { ok: false; error: string; requestId?: string | null }
  >;
  onIngestUrl: (payload: {
    url: string;
    sourceId?: string;
  }) => Promise<
    { ok: true; run: IngestionRunView } | { ok: false; error: string; requestId?: string | null }
  >;
  onPollRun: (runId: string) => Promise<IngestionRunView | null>;
  onRetryRun?: (runId: string) => Promise<IngestionRunView | null>;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitRequestId, setSubmitRequestId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<IngestionRunView | null>(null);
  const [retrying, setRetrying] = useState(false);

  const isTerminal =
    activeRun !== null &&
    (activeRun.status === "DONE" ||
      activeRun.status === "READY" ||
      activeRun.status === "FAILED" ||
      activeRun.duplicate === true);

  useEffect(() => {
    if (!activeRun || isTerminal) {
      return;
    }

    let cancelled = false;
    let attempt = 0;
    let timeoutId: number | null = null;

    const tick = async () => {
      const updated = await onPollRun(activeRun.id);
      if (cancelled) {
        return;
      }
      if (updated) {
        setActiveRun(updated);
        if (
          updated.status === "DONE" ||
          updated.status === "READY" ||
          updated.status === "FAILED" ||
          updated.duplicate
        ) {
          return;
        }
      }
      attempt += 1;
      const delayMs = Math.min(1000 * Math.pow(1.4, attempt), 6000);
      timeoutId = window.setTimeout(() => void tick(), delayMs);
    };

    timeoutId = window.setTimeout(() => void tick(), 1000);
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeRun, isTerminal, onPollRun]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitRequestId(null);

    if (mode === "upload") {
      if (!file) {
        setFileError("Select a PDF file before queueing ingestion.");
        return;
      }
      setSubmitting(true);
      const res = await onUploadPdf({
        file,
        ...(sourceId ? { sourceId } : {}),
      });
      setSubmitting(false);
      if (res.ok) {
        setActiveRun(res.run);
      } else {
        setSubmitError(res.error);
        setSubmitRequestId(res.requestId ?? null);
      }
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith("https://") && !trimmedUrl.startsWith("http://")) {
      setUrlError("Enter a valid http:// or https:// URL.");
      return;
    }
    setUrlError(null);
    setSubmitting(true);
    const res = await onIngestUrl({
      url: trimmedUrl,
      ...(sourceId ? { sourceId } : {}),
    });
    setSubmitting(false);
    if (res.ok) {
      setActiveRun(res.run);
    } else {
      setSubmitError(res.error);
      setSubmitRequestId(res.requestId ?? null);
    }
  };

  const handleRetry = async () => {
    if (!activeRun || !onRetryRun) {
      return;
    }
    setRetrying(true);
    const updated = await onRetryRun(activeRun.id);
    setRetrying(false);
    if (updated) {
      setActiveRun(updated);
    }
  };

  return (
    <div className="mx-auto max-w-[780px] space-y-6">
      <PageHeader
        title="Add a circular"
        subtitle="Upload an official regulatory PDF or queue a URL from an allowlisted source."
        meta={
          <Link
            href="/app/circulars"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-fg"
          >
            <ArrowLeft size={13} weight="bold" aria-hidden="true" />
            Circulars
          </Link>
        }
      />

      {activeRun ? (
        <div className="space-y-4">
          <JobStepper
            run={activeRun}
            canRetry={Boolean(onRetryRun)}
            retrying={retrying}
            onRetry={() => void handleRetry()}
          />
          {isTerminal ? (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveRun(null);
                  setFile(null);
                  setUrl("");
                }}
              >
                Add another circular
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardBody className="space-y-6">
            <SegmentedControl
              label="Ingestion mode"
              value={mode}
              onChange={(next) => {
                setMode(next);
                setSubmitError(null);
                setFileError(null);
                setUrlError(null);
              }}
              options={[
                { value: "upload", label: "Upload PDF" },
                { value: "url", label: "From URL" },
              ]}
            />

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
              {mode === "upload" ? (
                <UploadDropzone
                  file={file}
                  maxSizeBytes={maxSizeBytes}
                  disabled={submitting}
                  error={fileError}
                  onFileSelect={(nextFile, validationError) => {
                    setFile(nextFile);
                    setFileError(validationError);
                  }}
                />
              ) : (
                <Field
                  label="Circular or listing URL"
                  htmlFor="ingest-url"
                  required
                  error={urlError ?? undefined}
                  hint="Direct PDF or a listing page; the ingestion source allowlist applies."
                >
                  <Input
                    id="ingest-url"
                    type="url"
                    value={url}
                    disabled={submitting}
                    placeholder="https://..."
                    onChange={(event) => {
                      setUrl(event.target.value);
                      if (urlError) {
                        setUrlError(null);
                      }
                    }}
                  />
                </Field>
              )}

              {sources.length > 0 ? (
                <Field
                  label="Source registry (optional)"
                  htmlFor="ingest-source"
                  hint="Associate this circular with a configured issuer source."
                >
                  <Select
                    id="ingest-source"
                    value={sourceId}
                    disabled={submitting}
                    onChange={(event) => setSourceId(event.target.value)}
                  >
                    <option value="">Auto / none</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name} ({src.issuer})
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {submitError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 p-3.5 text-xs text-fg"
                >
                  <WarningCircle
                    size={15}
                    weight="fill"
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-danger"
                  />
                  <div className="space-y-0.5">
                    <p>
                      <span className="font-semibold">Error:</span> {submitError}
                    </p>
                    {submitRequestId ? (
                      <p className="font-mono text-muted">Request ID: {submitRequestId}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" pending={submitting} pendingLabel="Queueing ingestion...">
                  Queue ingestion
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
