import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { requireActor } from "@/server/auth/actor";
import { recordAudit, requestMeta } from "@/server/audit";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const actor = await requireActor("audit:read");

    const findings = await db.finding.findMany({
      where: { workspaceId: actor.workspaceId },
      include: {
        document: { select: { reference: true, title: true, regulator: true } },
        policy: { select: { code: true, title: true } },
        obligation: { select: { reference: true, plainLanguage: true } },
      },
      orderBy: [{ dueDate: "asc" }, { severity: "asc" }],
      take: MAX_ROWS,
    });

    const header = [
      "finding_id",
      "document_reference",
      "regulator",
      "document_title",
      "obligation_reference",
      "obligation",
      "policy_code",
      "policy_title",
      "gap_status",
      "severity",
      "review_status",
      "due_date",
      "citation_verified",
      "confidence",
      "approved_wording",
    ];

    const lines = [header.join(",")];
    for (const finding of findings) {
      lines.push(
        [
          cell(finding.id),
          cell(finding.document.reference),
          cell(finding.document.regulator),
          cell(finding.document.title),
          cell(finding.obligation.reference),
          cell(finding.obligation.plainLanguage),
          cell(finding.policy?.code ?? ""),
          cell(finding.policy?.title ?? ""),
          cell(finding.status),
          cell(finding.severity),
          cell(finding.reviewStatus),
          cell(finding.dueDate.toISOString().slice(0, 10)),
          cell(finding.citationVerified ? "yes" : "no"),
          cell(finding.confidence.toFixed(2)),
          cell(finding.approvedWording ?? ""),
        ].join(","),
      );
    }

    await recordAudit({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: "export.findings_csv",
      entity: "Finding",
      metadata: { rows: findings.length },
      ...requestMeta(request),
    });

    const filename = `compliance-evidence-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
