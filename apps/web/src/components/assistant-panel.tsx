"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowRight,
  Books,
  Quotes,
  ShieldCheck,
  SpinnerGap,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { CopyButton } from "@/components/ui/navigation-controls";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Citation {
  id: string;
  label: string;
  quote: string;
}

interface Answer {
  answer: string;
  citations: Citation[];
  confidence: number;
  matched: boolean;
  mode?: "grounded" | "retrieval";
  model?: string;
  latencyMs?: number;
}

interface Turn {
  id: string;
  question: string;
  status: "pending" | "done" | "error";
  answer?: Answer;
  error?: string;
}

interface ApiErrorBody {
  error?: { message?: string; requestId?: string };
}

interface AssistantPanelProps {
  grounded: boolean;
  model: string | null;
}

const samples = [
  "How fast must we report a cyber incident to IRDAI?",
  "How long do we retain security logs?",
  "What does our policy say about consent withdrawal?",
  "Where is regulated payment data allowed to be stored?",
];

const MIN_QUESTION_LENGTH = 8;
const MAX_QUESTION_LENGTH = 500;

export function AssistantPanel({ grounded, model }: AssistantPanelProps) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const pending = turns.some((turn) => turn.status === "pending");

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (turns.length > 0) {
      endRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [turns]);

  function patchTurn(id: string, patch: Partial<Turn>) {
    setTurns((previous) =>
      previous.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
    );
  }

  async function ask(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (question.length < MIN_QUESTION_LENGTH) {
      setFormError(`Ask a full question of at least ${MIN_QUESTION_LENGTH} characters.`);
      return;
    }
    if (pending) {
      return;
    }

    setFormError(null);
    setDraft("");

    const id = `${Date.now()}-${turns.length}`;
    setTurns((previous) => [...previous, { id, question, status: "pending" }]);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        patchTurn(id, {
          status: "error",
          error: body.error?.message ?? "The question could not be answered.",
        });
        return;
      }

      const body = (await response.json()) as { data: Answer };
      patchTurn(id, { status: "done", answer: body.data });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      patchTurn(id, {
        status: "error",
        error: "The server did not respond. Check that the app and database are running.",
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(draft);
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
                {turns.length === 0 ? "Ask the register" : "Ask a follow-up"}
              </label>
              <span className="hidden font-mono text-[10px] text-muted sm:inline">
                Enter to ask · Shift+Enter for a new line
              </span>
            </div>
            <Textarea
              id="question"
              value={draft}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_QUESTION_LENGTH}
              className="mt-2 min-h-[84px] text-[14px]"
              placeholder="e.g. How fast must we report a cyber incident to IRDAI?"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {draft.length}/{MAX_QUESTION_LENGTH}
              </span>
              <div className="flex items-center gap-2">
                {turns.length > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      controllerRef.current?.abort();
                      setTurns([]);
                      setFormError(null);
                      setDraft("");
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
                      Asking
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

          {turns.length === 0 ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {samples.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  disabled={pending}
                  onClick={() => void ask(sample)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-brand/35 hover:text-fg disabled:opacity-60"
                >
                  {sample}
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        {formError ? (
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
              <span className="font-semibold">Error:</span> {formError}
            </span>
          </div>
        ) : null}

        <div className="space-y-4" aria-live="polite">
          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="rounded-2xl border border-line bg-surface-2/70 px-5 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">You</p>
                <p className="mt-1 text-sm leading-relaxed text-fg">{turn.question}</p>
              </div>

              {turn.status === "pending" ? (
                <Card className="space-y-3 p-5" aria-busy="true">
                  <div className="pp-skeleton h-3 w-24 rounded-full" />
                  <div className="pp-skeleton h-4 w-full rounded-full" />
                  <div className="pp-skeleton h-4 w-5/6 rounded-full" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    Searching policies, controls, and clauses
                  </p>
                </Card>
              ) : null}

              {turn.status === "error" ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  <WarningCircle
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  <span>{turn.error}</span>
                </div>
              ) : null}

              {turn.status === "done" && turn.answer ? (
                <AnswerCard answer={turn.answer} />
              ) : null}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {turns.length === 0 ? (
          <Card className="px-6 py-10 text-center">
            <Books
              size={28}
              weight="bold"
              aria-hidden="true"
              className="mx-auto text-brand dark:text-support"
            />
            <p className="mt-3 text-sm font-medium">
              {grounded
                ? "Answers are written from your register, then checked."
                : "The answer comes from your register."}
            </p>
            <p className="mx-auto mt-1.5 max-w-[52ch] text-xs leading-relaxed text-muted">
              {grounded
                ? "The assistant drafts an answer from the retrieved passages. Every citation is checked against the exact clause text before it is shown; an answer without a verified citation is refused."
                : "This is retrieval, not generation. The response quotes the best-matching policy, control, or clause and lists its citations. If nothing matches, it says so."}
            </p>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Engine</p>
          <p className="mt-3 text-sm font-medium">
            {grounded ? "Verified generation" : "Retrieval only"}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {grounded
              ? `Answers are drafted by ${model ?? "Gemini"} over retrieved passages. A quote that is not a verbatim substring of its source rejects the answer.`
              : "No model is configured in this environment. Answers are extractive quotes from the register; nothing is generated."}
          </p>
        </Card>

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
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <ShieldCheck size={14} weight="bold" aria-hidden="true" className="text-brand" />
            Safety rails
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <li>Every citation is checked against the exact passage; unverified answers are refused.</li>
            <li>No answers without a matching passage.</li>
            <li>No legal conclusion, no approval, no policy edit.</li>
            <li>No cross-workspace retrieval; every query is scoped to your workspace.</li>
            <li>Questions are never stored or logged in raw form.</li>
          </ul>
        </Card>

        <p className="px-1 text-[11px] leading-relaxed text-muted">
          Not legal advice. Confirm material decisions with the compliance office.
        </p>
      </div>
    </div>
  );
}

function AnswerCard({ answer }: { answer: Answer }) {
  const groundedAnswer = answer.mode === "grounded";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          <Quotes
            size={14}
            weight="bold"
            aria-hidden="true"
            className="text-brand dark:text-support"
          />
          {answer.matched ? "Grounded answer" : "Refused"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={groundedAnswer ? "brand" : "outline"}>
            {groundedAnswer ? "Verified generation" : "Retrieval"}
          </Badge>
          {answer.matched ? (
            <>
              <Badge tone={answer.citations.length > 0 ? "brand" : "outline"}>
                {answer.citations.length} citations
              </Badge>
              <Badge tone="outline">Confidence {formatPercent(answer.confidence)}</Badge>
            </>
          ) : null}
          <CopyButton value={answer.answer} label="Copy" />
        </div>
      </div>

      <div className="p-5">
        <p
          className={cn(
            "text-[15px] leading-relaxed",
            answer.matched ? "text-fg" : "text-muted",
          )}
        >
          {answer.answer}
        </p>

        {answer.citations.length > 0 ? (
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Citations</p>
            {answer.citations.map((citation, index) => (
              <div key={`${citation.id}-${index}`} className="rounded-xl bg-surface-2 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand dark:text-support">
                  [{index + 1}] {citation.label}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">“{citation.quote}”</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-xs leading-relaxed text-muted">
            No verified passage supports an answer. The assistant escalates rather than invent one.
            Route the question to the compliance office before acting.
          </div>
        )}

        {answer.matched ? (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {groundedAnswer
              ? `Grounded by ${answer.model ?? "Gemini"} · citations verified`
              : "Extractive retrieval · deterministic"}
            {typeof answer.latencyMs === "number" ? ` · ${answer.latencyMs} ms` : ""}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
