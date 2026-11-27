/** pgvector text literal. Values are finite-checked before formatting. */
export function toVectorLiteral(values: readonly number[]): string {
  return `[${values.map((value) => (Number.isFinite(value) ? value.toFixed(6) : "0")).join(",")}]`;
}
