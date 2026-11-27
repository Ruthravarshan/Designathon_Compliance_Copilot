"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FilePdf,
  FolderSimple,
  HardDrives,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export interface StorageBrowserConnection {
  id: string;
  provider: string;
  status?: string | null;
  isDefault: boolean;
  isFallback?: boolean;
}

interface Entry {
  id: string;
  name: string;
  kind: "file" | "folder";
  size?: number;
  contentType?: string;
  modifiedAt?: string;
  webUrl?: string;
}

interface BrowseResponse {
  data?: {
    connection: { id: string; provider: string };
    entries: Entry[];
    nextPageToken?: string;
  };
  error?: { message?: string; requestId?: string };
}

interface ImportForm {
  entry: Entry;
  regulator: "RBI" | "SEBI" | "IRDAI" | "MEITY";
  reference: string;
  title: string;
  summary: string;
  publishedAt: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  SHAREPOINT: "SharePoint",
  GOOGLE_DRIVE: "Google Drive",
  SUPABASE_STORAGE: "Supabase Storage",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function prettyName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function inferRegulator(name: string): ImportForm["regulator"] {
  const lower = name.toLowerCase();
  if (lower.includes("irdai")) {
    return "IRDAI";
  }
  if (lower.includes("sebi")) {
    return "SEBI";
  }
  if (lower.includes("rbi") || lower.includes("reserve bank")) {
    return "RBI";
  }
  return "MEITY";
}

function buildForm(entry: Entry): ImportForm {
  return {
    entry,
    regulator: inferRegulator(entry.name),
    reference: `STORAGE/${entry.id.replace(/[^A-Za-z0-9]/g, "").slice(-16)}`,
    title: prettyName(entry.name) || "Imported circular",
    summary: `Imported from storage on ${today()}; verified by the web page or archived PDF.`,
    publishedAt: today(),
  };
}

export function StorageBrowser({
  connections,
  canManage,
}: {
  connections: StorageBrowserConnection[];
  canManage: boolean;
}) {
  const [connectionId, setConnectionId] = useState(
    () => connections.find((connection) => connection.isDefault)?.id ?? connections[0]?.id ?? "",
  );
  const [trail, setTrail] = useState<Array<{ id?: string; name: string }>>([{ name: "Root" }]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ImportForm | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null);

  const currentFolderId = trail[trail.length - 1]?.id;

  const load = useCallback(
    async (folderId: string | undefined, pageToken?: string) => {
      if (!connectionId) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ connectionId });
        if (folderId) {
          params.set("folderId", folderId);
        }
        if (pageToken) {
          params.set("pageToken", pageToken);
        }
        const response = await fetch(`/api/storage/browse?${params.toString()}`, {
          headers: { accept: "application/json" },
        });
        const body = (await response.json().catch(() => ({}))) as BrowseResponse;
        if (!response.ok || !body.data) {
          setEntries([]);
          setError(body.error?.message ?? "That folder could not be listed.");
          return;
        }
        setEntries(pageToken ? (current) => [...current, ...body.data!.entries] : body.data.entries);
        setNextPageToken(body.data.nextPageToken);
      } catch {
        setEntries([]);
        setError("The storage provider did not respond.");
      } finally {
        setLoading(false);
      }
    },
    [connectionId],
  );

  useEffect(() => {
    setTrail([{ name: "Root" }]);
    setEntries([]);
    setForm(null);
    void load(undefined);
  }, [load]);

  function openFolder(entry: Entry) {
    setTrail((current) => [...current, { id: entry.id, name: entry.name }]);
    setForm(null);
    void load(entry.id);
  }

  function goTo(index: number) {
    const next = trail.slice(0, index + 1);
    setTrail(next);
    setForm(null);
    void load(next[next.length - 1]?.id);
  }

  async function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const response = await fetch("/api/storage/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId,
          itemId: form.entry.id,
          regulator: form.regulator,
          reference: form.reference.trim(),
          title: form.title.trim(),
          summary: form.summary.trim(),
          publishedAt: form.publishedAt,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { id?: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.id) {
        setImportError(body.error?.message ?? "That file could not be imported.");
        return;
      }
      setImportedId(body.data.id);
      setForm(null);
    } catch {
      setImportError("The server did not respond.");
    } finally {
      setImporting(false);
    }
  }

  const pdfEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.kind === "folder" ||
          entry.name.toLowerCase().endsWith(".pdf") ||
          entry.contentType === "application/pdf",
      ),
    [entries],
  );

  if (connections.length === 0) {
    return null;
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <HardDrives size={14} weight="bold" aria-hidden="true" className="text-brand" />
            Browse and import
          </p>
          <p className="mt-1.5 max-w-[64ch] text-xs leading-relaxed text-muted">
            Pick the official PDF already stored in {PROVIDER_LABEL[connections[0]?.provider ?? ""] ?? "your storage"}.
            Importing extracts its text, embeds the clauses, and links the archived copy.
          </p>
        </div>
        <Select
          aria-label="Storage connection"
          value={connectionId}
          onChange={(event) => setConnectionId(event.target.value)}
          className="w-auto min-w-[180px]"
        >
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {PROVIDER_LABEL[connection.provider] ?? connection.provider}
              {connection.isDefault ? " · primary" : connection.isFallback ? " · fallback" : ""}
            </option>
          ))}
        </Select>
      </div>

      <nav aria-label="Folder path" className="mt-4 flex flex-wrap items-center gap-1 text-xs text-muted">
        {trail.map((crumb, index) => (
          <span key={`${crumb.id ?? "root"}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <button
              type="button"
              onClick={() => goTo(index)}
              className={
                index === trail.length - 1
                  ? "font-medium text-fg"
                  : "hover:text-fg hover:underline"
              }
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-xs text-fg"
        >
          <WarningCircle size={15} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
          <span>{error}</span>
        </div>
      ) : null}

      {importedId ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-xs text-fg"
        >
          <span>The file was imported, archived, and embedded.</span>
          <Link
            href={`/app/circulars/${importedId}`}
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            Open circular
            <ArrowRight size={12} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        {loading && entries.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted">
            <SpinnerGap size={14} weight="bold" className="animate-spin" aria-hidden="true" />
            Listing folder
          </div>
        ) : pdfEntries.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted">
            No PDFs in this folder. Open a subfolder or upload the PDF in the circular ingest form.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {pdfEntries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                  {entry.kind === "folder" ? (
                    <FolderSimple size={16} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
                  ) : (
                    <FilePdf size={16} weight="bold" aria-hidden="true" className="shrink-0 text-brand" />
                  )}
                  <span className="truncate">{entry.name}</span>
                  {entry.modifiedAt ? (
                    <span className="hidden shrink-0 font-mono text-[10px] text-muted sm:inline">
                      {entry.modifiedAt.slice(0, 10)}
                    </span>
                  ) : null}
                </span>
                {entry.kind === "folder" ? (
                  <button
                    type="button"
                    onClick={() => openFolder(entry)}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-muted hover:border-brand/40 hover:text-fg"
                  >
                    Open
                    <ArrowRight size={11} weight="bold" aria-hidden="true" />
                  </button>
                ) : canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setImportedId(null);
                      setImportError(null);
                      setForm(buildForm(entry));
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-brand-ink hover:bg-brand-hover"
                  >
                    Import
                  </button>
                ) : (
                  <Badge tone="outline">Read only</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {nextPageToken ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(currentFolderId, nextPageToken)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          Load more
        </button>
      ) : null}

      {form ? (
        <form onSubmit={submitImport} className="mt-5 space-y-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-fg">{form.entry.name}</p>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            >
              <ArrowLeft size={12} weight="bold" aria-hidden="true" />
              Cancel
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Regulator" htmlFor="import-regulator">
              <Select
                id="import-regulator"
                value={form.regulator}
                disabled={importing}
                onChange={(event) =>
                  setForm({ ...form, regulator: event.target.value as ImportForm["regulator"] })
                }
              >
                <option value="RBI">RBI</option>
                <option value="SEBI">SEBI</option>
                <option value="IRDAI">IRDAI</option>
                <option value="MEITY">MeitY / CERT-In / DPDP</option>
              </Select>
            </Field>
            <Field label="Reference" htmlFor="import-reference" hint="Unique per workspace.">
              <Input
                id="import-reference"
                required
                value={form.reference}
                disabled={importing}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                pattern="[A-Za-z0-9/._\-]+"
                maxLength={60}
              />
            </Field>
            <Field label="Title" htmlFor="import-title" className="sm:col-span-2">
              <Input
                id="import-title"
                required
                value={form.title}
                disabled={importing}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                minLength={4}
                maxLength={160}
              />
            </Field>
            <Field label="Published" htmlFor="import-published">
              <Input
                id="import-published"
                type="date"
                required
                value={form.publishedAt}
                disabled={importing}
                onChange={(event) => setForm({ ...form, publishedAt: event.target.value })}
              />
            </Field>
            <Field
              label="Summary"
              htmlFor="import-summary"
              className="sm:col-span-2"
              hint={`${form.summary.trim().length}/600 chars (min 20).`}
            >
              <Textarea
                id="import-summary"
                required
                className="min-h-[72px]"
                value={form.summary}
                disabled={importing}
                onChange={(event) => setForm({ ...form, summary: event.target.value })}
                minLength={20}
                maxLength={600}
              />
            </Field>
          </div>

          {importError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-xs text-fg"
            >
              <WarningCircle size={15} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
              <span>{importError}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={importing}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-60"
          >
            {importing ? (
              <>
                <SpinnerGap size={14} weight="bold" className="animate-spin" aria-hidden="true" />
                Importing and embedding
              </>
            ) : (
              "Import and analyze"
            )}
          </button>
        </form>
      ) : null}
    </Card>
  );
}
