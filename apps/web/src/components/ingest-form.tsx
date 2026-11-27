"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import { Field, Input, Select, Textarea, inputClass } from "@/components/ui/field";
import { Card } from "@/components/ui/card";

interface ApiErrorBody {
  error?: {
    message?: string;
    requestId?: string;
    details?: Array<{ path?: string; message?: string }>;
  };
}

const today = new Date().toISOString().slice(0, 10);

export function IngestForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const body = {
      regulator: String(data.get("regulator") ?? ""),
      title: String(data.get("title") ?? ""),
      reference: String(data.get("reference") ?? ""),
      summary: String(data.get("summary") ?? ""),
      sourceUrl: String(data.get("sourceUrl") ?? ""),
      publishedAt: String(data.get("publishedAt") ?? ""),
      ...(String(data.get("effectiveAt") ?? "")
        ? { effectiveAt: String(data.get("effectiveAt")) }
        : {}),
      pageCount: Number(data.get("pageCount") ?? 1),
      content: String(data.get("content") ?? ""),
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
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Regulator" htmlFor="regulator">
            <Select id="regulator" name="regulator" required defaultValue="IRDAI">
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
              placeholder="Information and Cyber Security Guidelines, 2026"
              minLength={4}
              maxLength={160}
            />
          </Field>

          <Field
            label="Summary"
            htmlFor="summary"
            hint="Plain-language description for the register."
            className="sm:col-span-2"
          >
            <Textarea
              id="summary"
              name="summary"
              required
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
              placeholder="https://irdai.gov.in/..."
            />
          </Field>

          <Field label="Published" htmlFor="publishedAt">
            <Input id="publishedAt" name="publishedAt" type="date" required defaultValue={today} />
          </Field>

          <Field label="Effective" htmlFor="effectiveAt" hint="Optional.">
            <Input id="effectiveAt" name="effectiveAt" type="date" />
          </Field>

          <Field label="Page count" htmlFor="pageCount">
            <Input
              id="pageCount"
              name="pageCount"
              type="number"
              min={1}
              max={5000}
              defaultValue={1}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col p-5 sm:p-6">
        <Field
          label="Circular text"
          htmlFor="content"
          hint="Separate clauses with a blank line. Minimum 80 characters, maximum 50,000. Pasted clauses cite page 1."
        >
          <Textarea
            id="content"
            name="content"
            required
            minLength={80}
            maxLength={50_000}
            className="min-h-[320px] font-mono text-[12px] leading-6"
            placeholder={`Section 4.2 — Incident reporting\nCritical and cyber security incidents shall be reported to the Authority within six hours of detection.\n\nSection 5.1 — Board oversight\nThe Chief Information Security Officer shall report directly to the Board at least once a quarter.`}
          />
        </Field>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-danger"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[38ch] text-xs leading-relaxed text-muted">
            Ingestion writes an audit row. Findings start as pending review; no policy is modified.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <SpinnerGap size={16} weight="bold" className="animate-spin" aria-hidden="true" />
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
      </Card>
    </form>
  );
}
