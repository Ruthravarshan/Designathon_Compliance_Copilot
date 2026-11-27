/**
 * Test-only generator for a small, structurally valid PDF with a real text layer.
 * It is never imported by product code and never seeded into the demo workspace.
 */
export function makeTestPdf(pageTexts: readonly string[]): Uint8Array {
  const objects: string[] = [];
  const escapes = (value: string): string =>
    value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const pageObjectIds = pageTexts.map((_text, index) => 4 + index * 2);
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pageTexts.forEach((text, index) => {
    const pageId = pageObjectIds[index];
    const fontId = 3;
    const contentId = (pageId ?? 0) + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const stream = `BT /F1 12 Tf 72 720 Td (${escapes(text)}) Tj ET\n`;
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    );
  });

  const header = Buffer.from("%PDF-1.4\n", "latin1");
  const parts: Buffer[] = [header];
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(parts).length);
    parts.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "latin1"));
  });

  const xrefOffset = Buffer.concat(parts).length;
  const xref = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `];
  for (let index = 1; index <= objects.length; index += 1) {
    xref.push(`${String(offsets[index] ?? 0).padStart(10, "0")} 00000 n `);
  }
  parts.push(
    Buffer.from(
      `${xref.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      "latin1",
    ),
  );

  return new Uint8Array(Buffer.concat(parts));
}
