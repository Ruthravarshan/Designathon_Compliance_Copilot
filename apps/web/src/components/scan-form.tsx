"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { SeverityBadge } from "@/components/severity-badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { Severity } from "@/lib/compliance/types";

interface ScanResult {
  datasetName: string;
  fieldName: string;
  riskLevel: Severity;
  finding: string;
  citation: string;
}

interface ApiErrorBody {
  error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
}

export function ScanForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    const data = new FormData(event.currentTarget);
    const body = {
      datasetName: String(data.get("datasetName") ?? ""),
      fieldName: String(data.get("fieldName") ?? ""),
      dataCategory: String(data.get("dataCategory") ?? "identifier"),
      ...(String(data.get("sensitiveType") ?? "")
        ? { sensitiveType: String(data.get("sensitiveType")) }
        : {}),
      sampleMasked: String(data.get("sampleMasked") ?? ""),
      encrypted: data.get("encrypted") === "on",
      consented: data.get("consented") === "on",
    };

    try {
      const response = await fetch("/api/data-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const parsed = (await response.json().catch(() => ({}))) as ApiErrorBody;
        const detail = parsed.error?.details
          ?.slice(0, 2)
          .map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
          .join(" ");
        setError(detail || parsed.error?.message || "The field could not be scanned.");
        return;
      }

      const parsed = (await response.json()) as { data?: { result?: ScanResult } };
      if (parsed.data?.result) {
        setResult(parsed.data.result);
      }
      router.refresh();
    } catch {
      setError("The server did not respond. Check the connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Scan a catalog field</h2>
          <p className="mt-1 text-xs text-muted">
            Metadata only. Never paste raw personal data; samples must stay masked.
          </p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-brand">
          DPDP rules
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Dataset" htmlFor="datasetName">
          <Input
            id="datasetName"
            name="datasetName"
            required
            pattern="[a-z][a-z0-9_]*"
            placeholder="claims"
            minLength={2}
            maxLength={64}
          />
        </Field>
        <Field label="Field" htmlFor="fieldName">
          <Input
            id="fieldName"
            name="fieldName"
            required
            pattern="[a-z][a-z0-9_]*"
            placeholder="diagnosis_code"
            minLength={2}
            maxLength={64}
          />
        </Field>
        <Field label="Category" htmlFor="dataCategory">
          <Select id="dataCategory" name="dataCategory" defaultValue="health">
            <option value="identifier">Identifier</option>
            <option value="contact">Contact</option>
            <option value="financial">Financial</option>
            <option value="health">Health</option>
            <option value="biometric">Biometric</option>
            <option value="metadata">Metadata</option>
          </Select>
        </Field>
        <Field label="Sensitive type" htmlFor="sensitiveType" hint="Optional override.">
          <Select id="sensitiveType" name="sensitiveType" defaultValue="">
            <option value="">None</option>
            <option value="financial">Financial</option>
            <option value="identity">Identity</option>
            <option value="health">Health</option>
            <option value="biometric">Biometric</option>
          </Select>
        </Field>
        <Field label="Masked sample" htmlFor="sampleMasked" className="sm:col-span-2">
          <Input
            id="sampleMasked"
            name="sampleMasked"
            required
            maxLength={64}
            placeholder="ICD ***"
          />
        </Field>
        <div className="flex items-end gap-4 pb-1 sm:col-span-2 lg:col-span-1">
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="encrypted" className="size-4 accent-brand" />
            Encrypted at rest
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="consented"
              defaultChecked
              className="size-4 accent-brand"
            />
            Consent recorded
          </label>
        </div>
        <div className="flex items-end lg:col-span-1">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <SpinnerGap size={15} weight="bold" className="animate-spin" aria-hidden="true" />
                Scanning
              </>
            ) : (
              <>
                Scan field
                <ArrowRight size={15} weight="bold" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-xs leading-relaxed text-danger"
        >
          <WarningCircle size={15} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={result.riskLevel} />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {result.datasetName}.{result.fieldName}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-fg">{result.finding}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {result.citation}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
