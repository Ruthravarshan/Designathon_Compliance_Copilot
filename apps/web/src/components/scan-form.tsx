"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
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

interface FieldPreset {
  label: string;
  datasetName: string;
  fieldName: string;
  dataCategory: string;
  sensitiveType: string;
  sampleMasked: string;
  encrypted: boolean;
  consented: boolean;
}

const PRESETS: readonly FieldPreset[] = [
  {
    label: "claims.diagnosis_code",
    datasetName: "claims",
    fieldName: "diagnosis_code",
    dataCategory: "health",
    sensitiveType: "health",
    sampleMasked: "ICD-***",
    encrypted: false,
    consented: true,
  },
  {
    label: "payments.upi_handle",
    datasetName: "payments",
    fieldName: "upi_handle",
    dataCategory: "financial",
    sensitiveType: "financial",
    sampleMasked: "usr***@okaxis",
    encrypted: true,
    consented: false,
  },
];

export function ScanForm() {
  const router = useRouter();
  const [datasetName, setDatasetName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [dataCategory, setDataCategory] = useState("health");
  const [sensitiveType, setSensitiveType] = useState("");
  const [sampleMasked, setSampleMasked] = useState("");
  const [encrypted, setEncrypted] = useState(false);
  const [consented, setConsented] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  function applyPreset(preset: FieldPreset) {
    const suffix = Math.floor(10 + Math.random() * 89);
    setDatasetName(preset.datasetName);
    setFieldName(`${preset.fieldName}_${suffix}`);
    setDataCategory(preset.dataCategory);
    setSensitiveType(preset.sensitiveType);
    setSampleMasked(preset.sampleMasked);
    setEncrypted(preset.encrypted);
    setConsented(preset.consented);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    const body = {
      datasetName: datasetName.trim(),
      fieldName: fieldName.trim(),
      dataCategory,
      ...(sensitiveType ? { sensitiveType } : {}),
      sampleMasked: sampleMasked.trim(),
      encrypted,
      consented,
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
      setDatasetName("");
      setFieldName("");
      setSampleMasked("");
      router.refresh();
    } catch {
      setError("The server did not respond. Check the connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Scan a catalog field</h2>
          <p className="mt-1 text-xs text-muted">
            Metadata only. Never paste raw personal data; samples must stay masked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-brand dark:text-support">
            <Sparkle size={11} weight="bold" aria-hidden="true" />
            Sample presets
          </span>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={pending}
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[10px] text-fg transition-colors hover:border-brand/40 hover:bg-surface disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Dataset" htmlFor="datasetName" hint="lowercase snake_case">
          <Input
            id="datasetName"
            name="datasetName"
            required
            disabled={pending}
            value={datasetName}
            onChange={(event) => setDatasetName(event.target.value)}
            pattern="[a-z][a-z0-9_]*"
            placeholder="claims"
            minLength={2}
            maxLength={64}
          />
        </Field>
        <Field label="Field" htmlFor="fieldName" hint="lowercase snake_case">
          <Input
            id="fieldName"
            name="fieldName"
            required
            disabled={pending}
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            pattern="[a-z][a-z0-9_]*"
            placeholder="diagnosis_code"
            minLength={2}
            maxLength={64}
          />
        </Field>
        <Field label="Category" htmlFor="dataCategory">
          <Select
            id="dataCategory"
            name="dataCategory"
            disabled={pending}
            value={dataCategory}
            onChange={(event) => setDataCategory(event.target.value)}
          >
            <option value="identifier">Identifier</option>
            <option value="contact">Contact</option>
            <option value="financial">Financial</option>
            <option value="health">Health</option>
            <option value="biometric">Biometric</option>
            <option value="metadata">Metadata</option>
          </Select>
        </Field>
        <Field label="Sensitive type" htmlFor="sensitiveType" hint="Optional override.">
          <Select
            id="sensitiveType"
            name="sensitiveType"
            disabled={pending}
            value={sensitiveType}
            onChange={(event) => setSensitiveType(event.target.value)}
          >
            <option value="">None</option>
            <option value="financial">Financial</option>
            <option value="identity">Identity</option>
            <option value="health">Health</option>
            <option value="biometric">Biometric</option>
          </Select>
        </Field>
        <Field label="Masked sample" htmlFor="sampleMasked" className="sm:col-span-2 lg:col-span-2">
          <Input
            id="sampleMasked"
            name="sampleMasked"
            required
            disabled={pending}
            value={sampleMasked}
            onChange={(event) => setSampleMasked(event.target.value)}
            maxLength={64}
            placeholder="ICD ***"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-1 lg:self-end lg:pb-1">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="encrypted"
              disabled={pending}
              checked={encrypted}
              onChange={(event) => setEncrypted(event.target.checked)}
              className="size-4 accent-brand"
            />
            Encrypted at rest
          </label>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="consented"
              disabled={pending}
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="size-4 accent-brand"
            />
            Consent recorded
          </label>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
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
          className="mt-3 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-3.5 py-3 text-xs leading-relaxed text-fg"
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

      {result ? (
        <div role="status" className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
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
