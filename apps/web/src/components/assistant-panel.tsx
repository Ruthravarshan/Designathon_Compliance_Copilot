"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, Books, Quotes, SpinnerGap, Trash, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { CopyButton } from "@/components/ui/navigation-controls";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Answer {
  answer: string;
  citations: Array<{ id: string; label: string; quote: string }>;
  confidence: number;
  matched: boolean;
}

interface Exchange {
  id: string;
  question: string;
  answer: Answer;
}

interface ApiErrorBody {
  error?: { message?: string; requestId?: string };
}

const samples = [
  "How fast must we report a cyber incident to IRDAI?",
  "How long do we retain security logs?",
  "What does our policy say about consent withdrawal?",
  "Where is regulated payment data allowed to be stored?",
];

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [asked, setAsked] = useState<string | null>(null);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 8) {
      setError("Ask a full question of at least 8 characters.");
      return;
    }

    setPending(true);
    setError(null);
    setAsked(trimmed);

    try {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setError(body.error?.message ?? "The question could not be answered.");
        return;
      }

      const body = (await response.json()) as { data: Answer };
      setHistory((prev) => [
        { id: `${Date.now()}-${prev.length}`, question: trimmed, answer: body.data },
        ...prev,
      ]);
      setQuestion("");
    } catch {
      setError("The server did not respond. Check that the app and database are running.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !pending) {
      event.preventDefault();
      void ask(question);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <form onSubmit={onSubmit}>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="question"
                className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
              >
                Ask the register
              </label>
              <span className="hidden font-mono text-[10px] text-muted sm:inline">
                Ctrl + Enter to submit
              </span>
            </div>
            <Textarea
              id="question"
              value={question}
              disabled={pending}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={500}
              className="mt-2 min-h-[96px] text-[14px]"
              placeholder="e.g. How fast must we report a cyber incident to IRDAI?"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {question.length}/500 · retrieval only
              </span>
              <div className="flex items-center gap-2">
                {history.length > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setHistory([]);
                      setAsked(null);
                      setError(null);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                  >
                    <Trash size={13} weight="bold" aria-hidden="true" />
                    Clear
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? (
                    <>
                      <SpinnerGap
                        size={15}
                        weight="bold"
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Retrieving
                    </>
                  ) : (
                    <>
                      Ask
                      <ArrowRight size={15} weight="bold" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {samples.map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={pending}
                onClick={() => {
                  setQuestion(sample);
                  void ask(sample);
                }}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-brand/35 hover:text-fg disabled:opacity-60"
              >
                {sample}
              </button>
            ))}
          </div>
        </Card>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-fg"
          >
            <WarningCircle
              size={16}
              weight="fill"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-danger"
            />
            <span>
              <span className="font-semibold">Error:</span> {error}
            </span>
          </div>
        ) : null}

        {pending ? (
          <Card className="space-y-3 p-5" aria-busy="true" aria-live="polite">
            <div className="pp-skeleton h-3 w-24 rounded-full" />
            <div className="pp-skeleton h-4 w-full rounded-full" />
            <div className="pp-skeleton h-4 w-5/6 rounded-full" />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Searching policies, controls, and clauses for &ldquo;{asked}&rdquo;
            </p>
          </Card>
        ) : null}

        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((entry) => (
              <Card key={entry.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
                  <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    <Quotes
                      size={14}
                      weight="bold"
                      aria-hidden="true"
                      className="text-brand dark:text-support"
                    />
                    Grounded answer
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={entry.answer.matched ? "brand" : "outline"}>
                      {entry.answer.citations.length} citations
                    </Badge>
                    <Badge tone="outline">
                      Confidence {formatPercent(entry.answer.confidence)}
                    </Badge>
                    <CopyButton value={entry.answer.answer} label="Copy" />
                  </div>
                </div>
                <div className="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    Q · {entry.question}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-[15px] leading-relaxed",
                      entry.answer.matched ? "text-fg" : "text-muted",
                    )}
                  >
                    {entry.answer.answer}
                  </p>

                  {entry.answer.citations.length > 0 ? (
                    <div className="mt-5 space-y-2 border-t border-line pt-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                        Citations
                      </p>
                      {entry.answer.citations.map((citation, index) => (
                        <div key={citation.id} className="rounded-xl bg-surface-2 px-4 py-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand dark:text-support">
                            [{index + 1}] {citation.label}
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-muted">
                            “{citation.quote}”
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-xs leading-relaxed text-muted">
                      No passage matched. The assistant escalates rather than invent an answer.
                      Route the question to the compliance office before acting.
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : !pending ? (
          <Card className="px-6 py-12 text-center">
            <Books
              size={28}
              weight="bold"
              aria-hidden="true"
              className="mx-auto text-brand dark:text-support"
            />
            <p className="mt-3 text-sm font-medium">The answer comes from your register.</p>
            <p className="mx-auto mt-1.5 max-w-[52ch] text-xs leading-relaxed text-muted">
              This is retrieval, not generation. The response quotes the best-matching policy,
              control, or clause and lists its citations. If nothing matches, it says so.
            </p>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            What it reads
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <li className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1 shrink-0 rounded-full bg-brand dark:bg-support"
              />
              Internal policies and controls in this workspace
            </li>
            <li className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1 shrink-0 rounded-full bg-brand dark:bg-support"
              />
              Every stored clause from the ingested circulars
            </li>
            <li className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1 shrink-0 rounded-full bg-brand dark:bg-support"
              />
              Labels and owners, so the citation is addressable
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            What it refuses
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <li>No answers without a matching passage.</li>
            <li>No legal conclusion, no approval, no policy edit.</li>
            <li>No cross-workspace retrieval.</li>
            <li>No personal data in the question log.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
