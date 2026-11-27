"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Paperclip,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea, inputClass } from "@/components/ui/field";

interface ApiErrorBody {
  error?: {
    message?: string;
    requestId?: string;
    details?: Array<{ path?: string; message?: string }>;
  };
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IngestForm() {
  const router = useRouter();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [regulator, setRegulator] = useState<"RBI" | "SEBI" | "IRDAI" | "MEITY">("IRDAI");
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState(today);
  const [effectiveAt, setEffectiveAt] = useState("");
  const [pageCount, setPageCount] = useState(1);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clauseStats = useMemo(() => {
    const blocks = content
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter((b) => b.length >= 24);
    return {
      chars: content.trim().length,
      clauses: blocks.length,
    };
  }, [content]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setError("The PDF is larger than the 20 MB limit.");
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setError("Select a PDF file.");
      setFile(null);
      return;
    }
    setFile(selected);
  }

  function resetForm() {
    setRegulator("IRDAI");
    setReference("");
    setTitle("");
    setSummary("");
    setSourceUrl("");
    setPublishedAt(today);
    setEffectiveAt("");
    setPageCount(1);
    setContent("");
    setFile(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (summary.trim().length < 20) {
      setError("Summary must be at least 20 characters.");
      return;
    }
    if (!file && content.trim().length < 80) {
      setError("Attach the official PDF or paste at least 80 characters of circular text.");
      return;
    }

    setPending(true);

    let response: Response;
    try {
      if (file) {
        const form = new FormData();
        form.set("regulator", regulator);
        form.set("title", title.trim());
        form.set("reference", reference.trim());
        form.set("summary", summary.trim());
        form.set("sourceUrl", sourceUrl.trim());
        form.set("publishedAt", publishedAt);
        if (effectiveAt) {
          form.set("effectiveAt", effectiveAt);
        }
        if (pageCount > 1) {
          form.set("pageCount", String(pageCount));
        }
        form.set("file", file, file.name);
        response = await fetch("/api/documents", { method: "POST", body: form });
      } else {
        response = await fetch("/api/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            regulator,
            title: title.trim(),
            reference: reference.trim(),
            summary: summary.trim(),
            sourceUrl: sourceUrl.trim(),
            publishedAt,
            ...(effectiveAt ? { effectiveAt } : {}),
            pageCount,
            content: content.trim(),
          }),
        });
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiErrorBody;
        const detail = result.error?.details
          ?.slice(0, 3)
          .map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
          .join(" ");
        setError(detail || result.error?.message || "The circular could not be ingested.");
        return;
      }

      const result = (await response.json()) as { data?: { id?: string } };
      const id = result.data?.id;
      router.push(id ? `/app/circulars/${id}` : "/app/circulars");
      router.refresh();
    } catch {
      setError("The server did not respond. Check that the app and database are running.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
        <p className="max-w-[70ch] text-xs leading-relaxed text-muted">
          Upload the official PDF: its text is extracted server-side, the file is mirrored to your
          primary storage connection, and clauses are embedded for retrieval. Or paste the text on
          the right.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={resetForm}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          <ArrowCounterClockwise size={13} weight="bold" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Regulator" htmlFor="regulator">
              <Select
                id="regulator"
                name="regulator"
                required
                value={regulator}
                disabled={pending}
                onChange={(event) =>
                  setRegulator(event.target.value as "RBI" | "SEBI" | "IRDAI" | "MEITY")
                }
              >
                <option value="RBI">RBI</option>
                <option value="SEBI">SEBI</option>
                <option value="IRDAI">IRDAI</option>
                <option value="MEITY">MeitY / CERT-In / DPDP</option>
              </Select>
            </Field>

            <Field label="Reference" htmlFor="reference" hint="Stored unique per workspace.">
              <Input
                id="reference"
                name="reference"
                required
                disabled={pending}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="SEBI/HO/ITD-1/ITD_CSC_EXT/P/CIR/2024/113"
                pattern="[A-Za-z0-9/._\-]+"
                maxLength={60}
              />
            </Field>

            <Field label="Title" htmlFor="title" className="sm:col-span-2">
              <Input
                id="title"
                name="title"
                required
                disabled={pending}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Cybersecurity and Cyber Resilience Framework (CSCRF)"
                minLength={4}
                maxLength={160}
              />
            </Field>

            <Field
              label="Summary"
              htmlFor="summary"
              hint={`${summary.trim().length}/600 chars (min 20).`}
              className="sm:col-span-2"
            >
              <Textarea
                id="summary"
                name="summary"
                required
                disabled={pending}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                minLength={20}
                maxLength={600}
                className="min-h-[80px]"
                placeholder="What changed, who it applies to, and the deadline or threshold that matters."
              />
            </Field>

            <Field label="Source URL" htmlFor="sourceUrl" className="sm:col-span-2">
              <Input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                required
                disabled={pending}
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://www.sebi.gov.in/..."
              />
            </Field>

            <Field label="Published" htmlFor="publishedAt">
              <Input
                id="publishedAt"
                name="publishedAt"
                type="date"
                required
                disabled={pending}
                value={publishedAt}
                onChange={(event) => setPublishedAt(event.target.value)}
              />
            </Field>

            <Field label="Effective" htmlFor="effectiveAt" hint="Optional.">
              <Input
                id="effectiveAt"
                name="effectiveAt"
                type="date"
                disabled={pending}
                value={effectiveAt}
                onChange={(event) => setEffectiveAt(event.target.value)}
              />
            </Field>

            <Field
              label="Page count"
              htmlFor="pageCount"
              hint={file ? "Detected from the PDF." : "From the source document."}
              className="sm:col-span-2"
            >
              <Input
                id="pageCount"
                name="pageCount"
                type="number"
                min={1}
                max={5000}
                disabled={pending || Boolean(file)}
                value={pageCount}
                onChange={(event) => setPageCount(Math.max(1, Number(event.target.value) || 1))}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col p-5 sm:p-6">
          <div className="border-b border-line pb-4">
            <label
              htmlFor="file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-brand/40 hover:bg-surface"
            >
              <Paperclip size={15} weight="bold" aria-hidden="true" />
              {file ? "Replace PDF" : "Attach official PDF"}
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={pending}
              onChange={onFileChange}
              className="sr-only"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {file
                ? `${file.name} · ${humanSize(file.size)} — text is extracted and indexed.`
                : "PDF up to 20 MB. Text must be selectable, not a scan."}
            </p>
          </div>

          <div className="mt-4 flex-1">
            <Field
              label={file ? "Circular text (optional)" : "Circular text"}
              htmlFor="content"
              hint={
                file
                  ? "Leave empty to use the text extracted from the PDF."
                  : `${clauseStats.clauses} clause${clauseStats.clauses === 1 ? "" : "s"} detected · ${clauseStats.chars}/50,000 chars (min 80). Separate clauses with a blank line.`
              }
            >
              <Textarea
                id="content"
                name="content"
                disabled={pending}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={50_000}
                className="min-h-[240px] font-mono text-[12px] leading-6"
                placeholder={`Section 4.2 — Incident reporting\nCritical and cyber security incidents shall be reported to the Authority within six hours of detection.\n\nSection 5.1 — Board oversight\nThe Chief Information Security Officer shall report directly to the Board at least once a quarter.`}
              />
            </Field>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-fg"
            >
              <WarningCircle
                size={15}
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
              />
              <span>
                <span className="font-semibold">Error:</span> {error}
              </span>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[38ch] text-xs leading-relaxed text-muted">
              Ingestion writes an audit row and embeds clauses for the assistant. Findings start as
              pending review; no policy is modified.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/app/circulars"
                className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <SpinnerGap
                      size={16}
                      weight="bold"
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Analyzing
                  </>
                ) : (
                  <>
                    Analyze circular
                    <ArrowRight size={16} weight="bold" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
