import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type RegulatorySource, type WatchTrigger } from "@prisma/client";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { RegulatorKey } from "@/lib/compliance/types";
import { computePosture, type PostureSummary } from "@/lib/watch/posture";
import { deriveReference } from "@/lib/watch/reference";
import { summarizeRevision } from "@/lib/watch/revision";
import { directCandidate, extractCandidateLinks } from "@/lib/watch/discover";
import { deriveSummary, deriveTitle } from "@/lib/watch/html";
import { hostAllowed, parseHttpUrl } from "@/lib/watch/urls";
import { db } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { enqueueEmail } from "@/server/email/service";
import { ingestDocument } from "@/server/compliance/service";
import type { Actor } from "@/server/auth/actor";
import { decodeHtml, extractDocument, safeFetchBytes } from "./fetch";

const MAX_DISCOVERED = 80;
const RUNNING_STALE_MS = 15 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60_000;

export type WatchStatus = "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED";

export interface WatchSourceView {
  id: string;
  name: string;
  regulator: string;
  kind: string;
  listingUrl: string;
  allowedDomains: string[];
  schedule: string;
  enabled: boolean;
  lastCheckedAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastItemCount: number;
  lastErrorCode: string | null;
}

export interface WatchRunView {
  id: string;
  trigger: string;
  status: string;
  sourceName: string | null;
  triggeredByName: string | null;
  discovered: number;
  ingested: number;
  skipped: number;
  failed: number;
  revisions: number;
  newFindings: number;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface WatchOverview {
  sources: WatchSourceView[];
  runs: WatchRunView[];
  posture: PostureSummary;
  weeklyDigestEnabled: boolean;
}

export interface WatchRunResult {
  runId: string;
  status: WatchStatus;
  sources: number;
  discovered: number;
  ingested: number;
  skipped: number;
  failed: number;
  revisions: number;
  newFindings: number;
  overdueCritical: number;
  overdueHigh: number;
  postureScore: number;
  message: string;
}

interface SourceOutcome {
  sourceId: string;
  name: string;
  status: WatchStatus;
  discovered: number;
  ingested: number;
  skipped: number;
  failed: number;
  revisions: number;
  newFindings: number;
  errorCode: string | null;
}

interface ProcessContext {
  source: { id: string; workspaceId: string; name: string; regulator: RegulatorKey; allowedDomains: string[] };
  actor: Actor;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function errorCodeOf(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }
  return "WATCH_FETCH_FAILED";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function checksumOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function intervalMs(schedule: string): number {
  if (schedule === "daily") {
    return 24 * 60 * 60_000;
  }
  if (schedule === "monthly") {
    return 28 * 24 * 60 * 60_000;
  }
  return WEEK_MS;
}

function isDue(source: RegulatorySource, now: Date): boolean {
  if (!source.enabled) {
    return false;
  }
  if (!source.lastCheckedAt) {
    return true;
  }
  return now.getTime() - source.lastCheckedAt.getTime() >= intervalMs(source.schedule);
}

export function inferRegulator(hostname: string): RegulatorKey {
  const host = hostname.toLowerCase();
  if (host.includes("rbi.org.in")) {
    return "RBI";
  }
  if (host.includes("sebi.gov.in")) {
    return "SEBI";
  }
  if (host.includes("irdai.gov.in")) {
    return "IRDAI";
  }
  return "MEITY";
}

async function resolveOwnerActor(workspaceId: string): Promise<Actor | null> {
  const membership = await db.membership.findFirst({
    where: { workspaceId, role: "OWNER" },
    include: { user: true, workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return null;
  }

  return {
    userId: membership.userId,
    name: membership.user.name ?? membership.user.email,
    email: membership.user.email,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    membershipId: membership.id,
    role: membership.role,
  };
}

async function workspacePosture(workspaceId: string, now: Date): Promise<PostureSummary> {
  const findings = await db.finding.findMany({
    where: { workspaceId },
    select: { severity: true, reviewStatus: true, dueDate: true },
  });
  return computePosture(findings, now);
}

async function processCandidate(
  context: ProcessContext,
  candidate: string,
  trigger: WatchTrigger,
): Promise<{ kind: "ingested" | "revision" | "unchanged"; findings: number }> {
  const { source, actor } = context;
  const reference = deriveReference(source.regulator, candidate);

  const existing =
    (await db.regulatoryDocument.findFirst({
      where: { workspaceId: source.workspaceId, sourceUrl: candidate },
      select: { id: true, checksum: true, content: true },
    })) ??
    (await db.regulatoryDocument.findFirst({
      where: { workspaceId: source.workspaceId, reference },
      select: { id: true, checksum: true, content: true },
    }));

  const fetched = await safeFetchBytes(candidate, { allowedDomains: source.allowedDomains });
  const extracted = await extractDocument(fetched);

  if (extracted.clauses.length === 0 || extracted.text.trim().length < 40) {
    return { kind: "unchanged", findings: 0 };
  }

  const checksum = checksumOf(extracted.text);

  if (existing) {
    if (existing.checksum === checksum) {
      return { kind: "unchanged", findings: 0 };
    }

    const duplicate = await db.regulatoryRevision.findFirst({
      where: { documentId: existing.id, newChecksum: checksum },
      select: { id: true },
    });
    if (duplicate) {
      return { kind: "unchanged", findings: 0 };
    }

    const revision = summarizeRevision(existing.content, extracted.text);
    await db.$transaction([
      db.regulatoryRevision.create({
        data: {
          workspaceId: source.workspaceId,
          documentId: existing.id,
          previousChecksum: existing.checksum,
          newChecksum: checksum,
          previousContent: existing.content,
          newContent: extracted.text,
          summary: revision.summary,
          diff: revision.diff as unknown as Prisma.InputJsonValue,
        },
      }),
      db.regulatoryDocument.update({
        where: { id: existing.id },
        data: { content: extracted.text, checksum, pageCount: extracted.pageCount },
      }),
    ]);

    await recordAudit({
      workspaceId: source.workspaceId,
      actorId: actor.userId,
      action: "document.revision_detected",
      entity: "RegulatoryDocument",
      entityId: existing.id,
      metadata: {
        source: source.name,
        trigger,
        added: revision.added,
        removed: revision.removed,
      },
    });

    return { kind: "revision", findings: 0 };
  }

  const rawHtml = extracted.kind === "html" ? decodeHtml(fetched) : null;
  const heading = extracted.clauses[0]?.heading?.trim();
  const title =
    (rawHtml ? deriveTitle(rawHtml, heading ?? source.name) : heading) ??
    `${source.name} · ${reference}`;
  const summary =
    deriveSummary(extracted.text) ||
    `Retrieved from ${new URL(fetched.finalUrl).hostname} on ${todayIso()} by the regulatory watchdog.`;

  let result: Awaited<ReturnType<typeof ingestDocument>>;
  try {
    result = await ingestDocument(actor, {
      regulator: source.regulator,
      title,
      reference,
      summary,
      sourceUrl: fetched.finalUrl,
      publishedAt: todayIso(),
      pageCount: extracted.pageCount,
      content: extracted.text,
      clauses: extracted.clauses,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODES.CONFLICT) {
      return { kind: "unchanged", findings: 0 };
    }
    throw error;
  }

  await db.regulatoryDocument.update({
    where: { id: result.id },
    data: { sourceId: source.id },
  });

  await recordAudit({
    workspaceId: source.workspaceId,
    actorId: actor.userId,
    action: "watch.document_ingested",
    entity: "RegulatoryDocument",
    entityId: result.id,
    metadata: {
      source: source.name,
      trigger,
      reference: result.reference,
      clauses: result.clauses,
      obligations: result.obligations,
      findings: result.findings,
    },
  });

  return { kind: "ingested", findings: result.findings };
}

async function runSource(
  source: RegulatorySource,
  actor: Actor,
  trigger: WatchTrigger,
): Promise<SourceOutcome> {
  const maxFetch = intEnv("WATCH_MAX_DOCS_PER_RUN", 4);
  const base = {
    sourceId: source.id,
    name: source.name,
    discovered: 0,
    ingested: 0,
    skipped: 0,
    failed: 0,
    revisions: 0,
    newFindings: 0,
  };

  let candidates: string[];
  try {
    if (source.kind === "DIRECT") {
      candidates = directCandidate(source.listingUrl, source.allowedDomains);
    } else {
      const listing = await safeFetchBytes(source.listingUrl, {
        allowedDomains: source.allowedDomains,
      });
      candidates = extractCandidateLinks(decodeHtml(listing), listing.finalUrl, {
        allowedDomains: source.allowedDomains,
        linkPattern: source.linkPattern ?? undefined,
        max: MAX_DISCOVERED,
      });
    }
  } catch (error) {
    logger.warn(
      { sourceId: source.id, code: errorCodeOf(error) },
      "watch source listing failed",
    );
    return { ...base, status: "FAILED", failed: 1, errorCode: errorCodeOf(error) };
  }

  if (candidates.length === 0) {
    return { ...base, status: "SUCCEEDED", errorCode: null };
  }

  const known = await db.regulatoryDocument.findMany({
    where: { workspaceId: source.workspaceId, sourceUrl: { in: candidates } },
    select: { sourceUrl: true },
  });
  const knownUrls = new Set(known.map((row) => row.sourceUrl));
  const ordered = [
    ...candidates.filter((url) => !knownUrls.has(url)),
    ...candidates.filter((url) => knownUrls.has(url)),
  ].slice(0, maxFetch);

  const outcome = { ...base, discovered: candidates.length };
  const context: ProcessContext = { source, actor };

  for (const candidate of ordered) {
    try {
      const processed = await processCandidate(context, candidate, trigger);
      if (processed.kind === "ingested") {
        outcome.ingested += 1;
        outcome.newFindings += processed.findings;
      } else if (processed.kind === "revision") {
        outcome.revisions += 1;
      } else {
        outcome.skipped += 1;
      }
    } catch (error) {
      outcome.failed += 1;
      logger.warn(
        { sourceId: source.id, code: errorCodeOf(error) },
        "watch candidate failed",
      );
    }
  }

  const succeeded = outcome.ingested + outcome.revisions + outcome.skipped;
  const status: WatchStatus =
    outcome.failed === 0 ? "SUCCEEDED" : succeeded === 0 ? "FAILED" : "PARTIAL";

  return { ...outcome, status, errorCode: outcome.failed > 0 ? "WATCH_PARTIAL" : null };
}

async function queueDigest(input: {
  workspaceId: string;
  runId: string;
  result: Omit<WatchRunResult, "runId" | "status" | "message">;
  posture: PostureSummary;
}): Promise<void> {
  const owner = await db.membership.findFirst({
    where: { workspaceId: input.workspaceId, role: "OWNER" },
    include: { user: true, workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) {
    return;
  }

  try {
    await enqueueEmail({
      event: "watch.digest",
      to: owner.user.email,
      userId: owner.user.id,
      workspaceId: input.workspaceId,
      idempotencyKey: `watch-digest-${input.runId}`,
      payload: {
        name: owner.user.name ?? "there",
        workspaceName: owner.workspace.name,
        newCirculars: input.result.ingested,
        revisions: input.result.revisions,
        newFindings: input.result.newFindings,
        criticalOverdue: input.posture.criticalOverdue,
        highOverdue: input.posture.highOverdue,
        postureScore: input.posture.score,
        postureBand: input.posture.band.replace("_", " "),
        watchUrl: `${env.APP_URL}/app/watch`,
        preferencesUrl: `${env.APP_URL}/app/settings/email`,
      },
    });
  } catch (error) {
    logger.warn(
      { workspaceId: input.workspaceId, code: errorCodeOf(error) },
      "watch digest enqueue failed",
    );
  }
}

export async function runWatch(input: {
  workspaceId: string;
  trigger: WatchTrigger;
  actor?: Actor | null;
  sourceId?: string;
  includeDigest?: boolean;
}): Promise<WatchRunResult> {
  const now = new Date();

  const running = await db.watchRun.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: "RUNNING",
      startedAt: { gte: new Date(now.getTime() - RUNNING_STALE_MS) },
    },
    select: { id: true },
  });

  if (running) {
    if (input.trigger === "SCHEDULED") {
      return {
        runId: running.id,
        status: "SKIPPED",
        sources: 0,
        discovered: 0,
        ingested: 0,
        skipped: 0,
        failed: 0,
        revisions: 0,
        newFindings: 0,
        overdueCritical: 0,
        overdueHigh: 0,
        postureScore: 0,
        message: "Another watchdog run is already in progress.",
      };
    }
    throw new AppError(ERROR_CODES.CONFLICT, "A regulatory watch run is already in progress.");
  }

  const actor = input.actor ?? (await resolveOwnerActor(input.workspaceId));
  if (!actor) {
    throw new AppError(ERROR_CODES.INTERNAL, "No workspace owner to run the watchdog as.");
  }

  const sources = await db.regulatorySource.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.sourceId ? { id: input.sourceId } : { enabled: true }),
    },
    orderBy: [{ regulator: "asc" }, { name: "asc" }],
  });

  const due =
    input.trigger === "SCHEDULED" && !input.sourceId
      ? sources.filter((source) => isDue(source, now))
      : sources;

  const run = await db.watchRun.create({
    data: {
      workspaceId: input.workspaceId,
      sourceId: input.sourceId ?? null,
      trigger: input.trigger,
      status: "RUNNING",
      triggeredById: actor.userId,
      triggeredByName: input.trigger === "SCHEDULED" ? "Scheduled watchdog" : actor.name,
    },
  });

  if (due.length === 0) {
    const posture = await workspacePosture(input.workspaceId, now);
    await db.watchRun.update({
      where: { id: run.id },
      data: {
        status: "SKIPPED",
        finishedAt: new Date(),
        overdueCritical: posture.criticalOverdue,
        overdueHigh: posture.highOverdue,
        summary: { message: "No sources were due for a check." } as Prisma.InputJsonValue,
      },
    });
    return {
      runId: run.id,
      status: "SKIPPED",
      sources: 0,
      discovered: 0,
      ingested: 0,
      skipped: 0,
      failed: 0,
      revisions: 0,
      newFindings: 0,
      overdueCritical: posture.criticalOverdue,
      overdueHigh: posture.highOverdue,
      postureScore: posture.score,
      message: "No sources were due for a check.",
    };
  }

  const outcomes: SourceOutcome[] = [];
  for (const source of due) {
    const outcome = await runSource(source, actor, input.trigger);
    outcomes.push(outcome);
    await db.regulatorySource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastStatus: outcome.status,
        lastItemCount: outcome.discovered,
        lastErrorCode: outcome.errorCode,
      },
    });
  }

  const totals = outcomes.reduce(
    (acc, item) => ({
      discovered: acc.discovered + item.discovered,
      ingested: acc.ingested + item.ingested,
      skipped: acc.skipped + item.skipped,
      failed: acc.failed + item.failed,
      revisions: acc.revisions + item.revisions,
      newFindings: acc.newFindings + item.newFindings,
    }),
    { discovered: 0, ingested: 0, skipped: 0, failed: 0, revisions: 0, newFindings: 0 },
  );

  const status: WatchStatus =
    totals.failed === 0
      ? "SUCCEEDED"
      : totals.ingested + totals.revisions + totals.skipped === 0
        ? "FAILED"
        : "PARTIAL";

  const posture = await workspacePosture(input.workspaceId, now);
  const message =
    totals.discovered === 0
      ? "No published documents were found on the tracked pages."
      : `${totals.ingested} new document(s), ${totals.revisions} revision(s), ${totals.newFindings} finding(s).`;

  await db.watchRun.update({
    where: { id: run.id },
    data: {
      status,
      discovered: totals.discovered,
      ingested: totals.ingested,
      skipped: totals.skipped,
      failed: totals.failed,
      revisions: totals.revisions,
      newFindings: totals.newFindings,
      overdueCritical: posture.criticalOverdue,
      overdueHigh: posture.highOverdue,
      finishedAt: new Date(),
      errorCode: outcomes.find((item) => item.errorCode)?.errorCode ?? null,
      summary: { message, sources: outcomes } as unknown as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    workspaceId: input.workspaceId,
    actorId: actor.userId,
    action: "watch.run",
    entity: "WatchRun",
    entityId: run.id,
    metadata: {
      trigger: input.trigger,
      status,
      ...totals,
      posture: posture.score,
    },
  });

  if (input.trigger === "SCHEDULED" && input.includeDigest !== false) {
    await queueDigest({
      workspaceId: input.workspaceId,
      runId: run.id,
      result: {
        sources: due.length,
        ...totals,
        overdueCritical: posture.criticalOverdue,
        overdueHigh: posture.highOverdue,
        postureScore: posture.score,
      },
      posture,
    });
  }

  return {
    runId: run.id,
    status,
    sources: due.length,
    ...totals,
    overdueCritical: posture.criticalOverdue,
    overdueHigh: posture.highOverdue,
    postureScore: posture.score,
    message,
  };
}

export async function runWatchForAllWorkspaces(): Promise<
  Array<{ workspaceId: string; result: WatchRunResult }>
> {
  const workspaces = await db.workspace.findMany({
    where: { sources: { some: { enabled: true } } },
    select: { id: true },
  });

  const results: Array<{ workspaceId: string; result: WatchRunResult }> = [];
  for (const workspace of workspaces) {
    try {
      const result = await runWatch({ workspaceId: workspace.id, trigger: "SCHEDULED" });
      results.push({ workspaceId: workspace.id, result });
    } catch (error) {
      logger.error(
        { workspaceId: workspace.id, code: errorCodeOf(error) },
        "watch scheduled run failed",
      );
    }
  }
  return results;
}

export async function listWatchOverview(actor: Actor): Promise<WatchOverview> {
  const now = new Date();
  const [sources, runs, posture] = await Promise.all([
    db.regulatorySource.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    }),
    db.watchRun.findMany({
      where: { workspaceId: actor.workspaceId },
      include: { source: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    workspacePosture(actor.workspaceId, now),
  ]);

  return {
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      regulator: source.regulator,
      kind: source.kind,
      listingUrl: source.listingUrl,
      allowedDomains: source.allowedDomains,
      schedule: source.schedule,
      enabled: source.enabled,
      lastCheckedAt: source.lastCheckedAt?.toISOString() ?? null,
      nextRunAt: source.enabled
        ? new Date((source.lastCheckedAt ?? now).getTime() + intervalMs(source.schedule)).toISOString()
        : null,
      lastStatus: source.lastStatus,
      lastItemCount: source.lastItemCount,
      lastErrorCode: source.lastErrorCode,
    })),
    runs: runs.map((run) => ({
      id: run.id,
      trigger: run.trigger,
      status: run.status,
      sourceName: run.source?.name ?? null,
      triggeredByName: run.triggeredByName,
      discovered: run.discovered,
      ingested: run.ingested,
      skipped: run.skipped,
      failed: run.failed,
      revisions: run.revisions,
      newFindings: run.newFindings,
      errorCode: run.errorCode,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    posture,
    weeklyDigestEnabled: true,
  };
}

export async function toggleSource(actor: Actor, sourceId: string, enabled: boolean): Promise<void> {
  const source = await db.regulatorySource.findFirst({
    where: { id: sourceId, workspaceId: actor.workspaceId },
    select: { id: true, name: true },
  });
  if (!source) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Source not found.");
  }

  await db.regulatorySource.update({ where: { id: source.id }, data: { enabled } });
  await recordAudit({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    action: enabled ? "watch.source_enabled" : "watch.source_disabled",
    entity: "RegulatorySource",
    entityId: source.id,
    metadata: { name: source.name },
  });
}

export async function ingestFromUrl(
  actor: Actor,
  input: { url: string; regulator?: RegulatorKey; title?: string },
): Promise<{ id: string; reference: string; findings: number; clauses: number }> {
  const parsed = parseHttpUrl(input.url);
  if (!parsed || !hostAllowed(parsed, [parsed.hostname])) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "That URL is not allowed.");
  }

  const regulator = input.regulator ?? inferRegulator(parsed.hostname);
  const fetched = await safeFetchBytes(parsed.toString(), {
    allowedDomains: [parsed.hostname],
  });
  const extracted = await extractDocument(fetched);

  if (extracted.clauses.length === 0) {
    throw new AppError(
      ERROR_CODES.BAD_REQUEST,
      "No citable text was found at that URL. Try the document's HTML or PDF page.",
    );
  }

  const reference = deriveReference(regulator, fetched.finalUrl);
  const rawHtml = extracted.kind === "html" ? decodeHtml(fetched) : null;
  const heading = extracted.clauses[0]?.heading?.trim();
  const title =
    input.title?.trim() ||
    (rawHtml ? deriveTitle(rawHtml, heading ?? reference) : heading) ||
    `${regulator} document ${reference}`;
  const summary =
    deriveSummary(extracted.text) ||
    `Retrieved from ${parsed.hostname} on ${todayIso()} by the regulatory watchdog.`;

  const result = await ingestDocument(actor, {
    regulator,
    title,
    reference,
    summary,
    sourceUrl: fetched.finalUrl,
    publishedAt: todayIso(),
    pageCount: extracted.pageCount,
    content: extracted.text,
    clauses: extracted.clauses,
  });

  await recordAudit({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    action: "watch.direct_ingest",
    entity: "RegulatoryDocument",
    entityId: result.id,
    metadata: { url: fetched.finalUrl, reference: result.reference, regulator },
  });

  return { id: result.id, reference: result.reference, findings: result.findings, clauses: result.clauses };
}

export async function listDocumentRevisions(actor: Actor, documentId: string) {
  const document = await db.regulatoryDocument.findFirst({
    where: { id: documentId, workspaceId: actor.workspaceId },
    select: { id: true, title: true, reference: true },
  });
  if (!document) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Document not found.");
  }

  const revisions = await db.regulatoryRevision.findMany({
    where: { documentId: document.id, workspaceId: actor.workspaceId },
    orderBy: { detectedAt: "desc" },
    select: {
      id: true,
      summary: true,
      detectedAt: true,
      diff: true,
      previousChecksum: true,
      newChecksum: true,
    },
  });

  return { document, revisions };
}
