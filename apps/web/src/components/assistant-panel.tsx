"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Books, Quotes, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Answer {
  answer: string;
  citations: Array<{ id: string; label: string; quote: string }>;
  confidence: number;
  matched: boolean;
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
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  async function ask(value: string) {
    if (value.trim().length < 8) {
      setError("Ask a full question of at least 8 characters.");
      return;
    }

    setPending(true);
    setError(null);
    setAsked(value.trim());
    setAnswer(null);

    try {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: value.trim() }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setError(body.error?.message ?? "The question could not be answered.");
        return;
      }

      const body = (await response.json()) as { data: Answer };
      setAnswer(body.data);
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

  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <form onSubmit={onSubmit}>
            <label
              htmlFor="question"
              className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
            >
              Ask the register
            </label>
            <Textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              className="mt-2 min-h-[96px] text-[14px]"
              placeholder="e.g. How fast must we report a cyber incident to IRDAI?"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {question.length}/500 · retrieval only
              </span>
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
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <WarningCircle size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {pending && !answer ? (
          <Card className="space-y-3 p-5" aria-busy="true" aria-live="polite">
            <div className="h-3 w-24 rounded-full bg-surface-2" />
            <div className="h-4 w-full rounded-full bg-surface-2" />
            <div className="h-4 w-5/6 rounded-full bg-surface-2" />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Searching policies, controls, and clauses
            </p>
          </Card>
        ) : null}

        {answer ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <Quotes size={14} weight="bold" aria-hidden="true" className="text-brand" />
                Grounded answer
              </span>
              <div className="flex items-center gap-2">
                <Badge tone={answer.matched ? "brand" : "outline"}>
                  {answer.citations.length} citations
                </Badge>
                <Badge tone="outline">Confidence {formatPercent(answer.confidence)}</Badge>
              </div>
            </div>
            <div className="p-5">
              {asked ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Q · {asked}
                </p>
              ) : null}
              <p
                className={cn(
                  "mt-2 text-[15px] leading-relaxed",
                  answer.matched ? "text-fg" : "text-muted",
                )}
              >
                {answer.answer}
              </p>

              {answer.citations.length > 0 ? (
                <div className="mt-5 space-y-2 border-t border-line pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    Citations
                  </p>
                  {answer.citations.map((citation, index) => (
                    <div key={citation.id} className="rounded-xl bg-surface-2 px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand">
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
                  No passage matched. The assistant escalates rather than invent an answer. Route
                  the question to the compliance office before acting.
                </div>
              )}
            </div>
          </Card>
        ) : !pending ? (
          <Card className="px-6 py-12 text-center">
            <Books size={28} weight="bold" aria-hidden="true" className="mx-auto text-brand" />
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
              <span aria-hidden="true" className="mt-1.5 size-1 rounded-full bg-brand" />
              Internal policies and controls in this workspace
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 size-1 rounded-full bg-brand" />
              Every stored clause from the ingested circulars
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 size-1 rounded-full bg-brand" />
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
