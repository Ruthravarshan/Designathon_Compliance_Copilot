"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Sparkle,
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

interface CircularPreset {
  label: string;
  regulator: "RBI" | "SEBI" | "IRDAI" | "MEITY";
  reference: string;
  title: string;
  summary: string;
  sourceUrl: string;
  pageCount: number;
  content: string;
}

const PRESETS: readonly CircularPreset[] = [
  {
    label: "IRDAI Cyber SLA",
    regulator: "IRDAI",
    reference: "IRDAI/IT/CYBER/2026/04",
    title: "Information and Cyber Security Guidelines — Incident Reporting",
    summary:
      "Requires insurers to report critical cyber incidents within 6 hours and retain system audit logs for at least 180 days.",
    sourceUrl: "https://irdai.gov.in/document-detail?documentId=cyber-2026-04",
    pageCount: 4,
    content: `Section 4.2 — Incident reporting
Critical and cyber security incidents shall be reported to IRDAI and CERT-In within six hours of detection, along with initial containment actions.

Section 5.1 — Security log retention
System and network security logs for regulated insurance workloads shall be retained for at least 180 days in tamper-evident storage.`,
  },
  {
    label: "DPDP Breach & Erasure",
    regulator: "MEITY",
    reference: "MEITY/DPDP/RULES/2026/02",
    title: "Digital Personal Data Protection — Breach & Consent Withdrawal",
    summary:
      "Mandates prompt breach notification to the Data Protection Board and affected Data Principals, plus one-click consent withdrawal.",
    sourceUrl: "https://www.meity.gov.in/dpdp-rules-2026-02",
    pageCount: 3,
    content: `Section 7.1 — Breach notification
In the event of a personal data breach, the Data Fiduciary shall notify the Data Protection Board of India and each affected Data Principal without delay.

Section 8.3 — Erasure on withdrawal
Upon withdrawal of consent by a Data Principal, personal data shall be erased within thirty days unless retention is required by law.`,
  },
];

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

  function applyPreset(preset: CircularPreset) {
    const suffix = Math.floor(100 + Math.random() * 900);
    setRegulator(preset.regulator);
    setReference(`${preset.reference}-${suffix}`);
    setTitle(preset.title);
    setSummary(preset.summary);
    setSourceUrl(preset.sourceUrl);
    setPublishedAt(today);
    setEffectiveAt("");
    setPageCount(preset.pageCount);
    setContent(preset.content);
    setError(null);
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
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (summary.trim().length < 20) {
      setError("Summary must be at least 20 characters.");
      return;
    }
    if (content.trim().length < 80) {
      setError("Circular text must be at least 80 characters.");
      return;
    }

    setPending(true);
    const body = {
      regulator,
      title: title.trim(),
      reference: reference.trim(),
      summary: summary.trim(),
      sourceUrl: sourceUrl.trim(),
      publishedAt,
      ...(effectiveAt ? { effectiveAt } : {}),
      pageCount,
      content: content.trim(),
    };

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            <Sparkle
              size={12}
              weight="bold"
              aria-hidden="true"
              className="text-brand dark:text-support"
            />
            Sample templates
          </span>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={pending}
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-brand/40 hover:bg-surface disabled:opacity-50"
            >
              Load {preset.label}
            </button>
          ))}
        </div>
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

      <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
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
                placeholder="IRDAI/IT/CYBER/2026/04"
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
                placeholder="Information and Cyber Security Guidelines, 2026"
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
                placeholder="https://irdai.gov.in/..."
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

            <Field label="Page count" htmlFor="pageCount">
              <Input
                id="pageCount"
                name="pageCount"
                type="number"
                min={1}
                max={5000}
                disabled={pending}
                value={pageCount}
                onChange={(event) => setPageCount(Math.max(1, Number(event.target.value) || 1))}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col p-5 sm:p-6">
          <Field
            label="Circular text"
            htmlFor="content"
            hint={`${clauseStats.clauses} clause${clauseStats.clauses === 1 ? "" : "s"} detected · ${clauseStats.chars}/50,000 chars (min 80). Separate clauses with a blank line.`}
          >
            <Textarea
              id="content"
              name="content"
              required
              disabled={pending}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              minLength={80}
              maxLength={50_000}
              className="min-h-[320px] font-mono text-[12px] leading-6"
              placeholder={`Section 4.2 — Incident reporting\nCritical and cyber security incidents shall be reported to the Authority within six hours of detection.\n\nSection 5.1 — Board oversight\nThe Chief Information Security Officer shall report directly to the Board at least once a quarter.`}
            />
          </Field>

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
              Ingestion writes an audit row. Findings start as pending review; no policy is
              modified.
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
      </form>
    </div>
  );
}
