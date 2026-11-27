import { describe, expect, it } from "vitest";
import { isGapStatus, isSeverity, SEVERITY_ORDER } from "./types";

describe("severity helpers", () => {
  it("orders severities from most to least urgent", () => {
    expect(SEVERITY_ORDER.CRITICAL).toBeLessThan(SEVERITY_ORDER.HIGH);
    expect(SEVERITY_ORDER.HIGH).toBeLessThan(SEVERITY_ORDER.MEDIUM);
    expect(SEVERITY_ORDER.MEDIUM).toBeLessThan(SEVERITY_ORDER.LOW);
  });

  it("recognises every severity", () => {
    for (const severity of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
      expect(isSeverity(severity)).toBe(true);
    }
    expect(isSeverity("URGENT")).toBe(false);
  });

  it("recognises every gap status", () => {
    for (const status of ["COMPLIANT", "PARTIAL_GAP", "CRITICAL_GAP", "MISSING_CONTROL"]) {
      expect(isGapStatus(status)).toBe(true);
    }
    expect(isGapStatus("OPEN")).toBe(false);
  });
});
