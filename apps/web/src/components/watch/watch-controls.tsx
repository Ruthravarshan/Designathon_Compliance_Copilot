"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowsClockwise, CloudArrowDown, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

interface ApiErrorBody {
  error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
}

interface RunResult {
  status: string;
  ingested: number;
  revisions: number;
  newFindings: number;
  skipped: number;
  failed: number;
  message: string;
}

interface IngestResult {
  id: string;
  reference: string;
  clauses: number;
  findings: number;
}

function errorMessage(parsed: ApiErrorBody, fallback: string): string {
  const detail = parsed.error?.details
    ?.slice(0, 2)
    .map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
    .join(" ");
  return detail || parsed.error?.message || fallback;
}

export function RunWatchButton({
  sourceId,
  label = "Run check now",
}: {
  sourceId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/watch/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });

      if (!response.ok) {
        const parsed = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setError(errorMessage(parsed, "The watch run could not start."));
        return;
      }

      const parsed = (await response.json()) as { data?: RunResult };
      if (parsed.data) {
        setResult(parsed.data);
      }
      router.refresh();
    } catch {
      setError("The server did not respond. Check the connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={run} pending={pending} pendingLabel="Checking sources…">
        <ArrowsClockwise size={15} weight="bold" aria-hidden="true" />
        {label}
      </Button>
      <span aria-live="polite" className="max-w-[34ch] text-right text-xs leading-relaxed">
        {error ? (
          <span className="inline-flex items-start gap-1.5 text-fg">
            <WarningCircle
              size={13}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 text-danger"
            />
            {error}
          </span>
        ) : result ? (
          <span className="text-muted">
            {result.message}{" "}
            {result.ingested > 0 || result.revisions > 0 ? "Documents updated." : ""}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function DirectIngestForm({
  sources,
}: {
  sources: Array<{ id: string; name: string; allowedDomains: string[] }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setResult(null);

    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();

    try {
      const response = await fetch("/api/watch/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId: String(data.get("sourceId") ?? ""),
          url: String(data.get("url") ?? "").trim(),
          regulator: String(data.get("regulator") ?? "RBI"),
          ...(title ? { title } : {}),
        }),
      });

      if (!response.ok) {
        const parsed = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setError(errorMessage(parsed, "The document could not be ingested."));
        return;
      }

      const parsed = (await response.json()) as { data?: IngestResult };
      if (parsed.data) {
        setResult(parsed.data);
        form.reset();
      }
      router.refresh();
    } catch {
      setError("The server did not respond. Check the connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 lg:grid-cols-[12rem_1fr_10rem_1fr_auto] lg:items-end"
    >
      <Field label="Tracked source" htmlFor="watch-source">
        <Select id="watch-source" name="sourceId" required defaultValue="">
          <option value="" disabled>
            Choose a source
          </option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Document URL" htmlFor="watch-url">
        <Input
          id="watch-url"
          name="url"
          type="url"
          required
          maxLength={500}
          placeholder="https://www.rbi.org.in/…"
        />
      </Field>
      <Field label="Regulator" htmlFor="watch-regulator">
        <Select id="watch-regulator" name="regulator" defaultValue="RBI">
          <option value="RBI">RBI</option>
          <option value="SEBI">SEBI</option>
          <option value="IRDAI">IRDAI</option>
          <option value="MEITY">MeitY</option>
        </Select>
      </Field>
      <Field label="Title override" htmlFor="watch-title" hint="Optional.">
        <Input
          id="watch-title"
          name="title"
          minLength={4}
          maxLength={160}
          placeholder="Leave empty to detect"
        />
      </Field>
      <Button type="submit" pending={pending} pendingLabel="Fetching…" className="lg:mb-0">
        <CloudArrowDown size={15} weight="bold" aria-hidden="true" />
        Fetch &amp; ingest
      </Button>
      <div aria-live="polite" className="lg:col-span-5">
        {error ? (
          <p className="flex items-start gap-1.5 text-xs text-fg" role="alert">
            <WarningCircle
              size={14}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 text-danger"
            />
            {error}
          </p>
        ) : result ? (
          <p className="text-xs text-muted">
            Ingested <span className="font-mono text-fg">{result.reference}</span> ·{" "}
            {result.clauses} clauses · {result.findings} findings.{" "}
            <Link
              href={`/app/circulars/${result.id}`}
              className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
            >
              Open document
              <ArrowRight size={12} weight="bold" aria-hidden="true" />
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function SourceToggle({ sourceId, enabled }: { sourceId: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/watch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, enabled: !enabled }),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        pending={pending}
        pendingLabel="Saving…"
        aria-label={enabled ? "Pause this source" : "Resume this source"}
      >
        {enabled ? "Pause" : "Resume"}
      </Button>
      {error ? <span className="text-[10px] text-danger">Failed</span> : null}
    </div>
  );
}
