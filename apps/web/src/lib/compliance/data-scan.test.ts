import { describe, expect, it } from "vitest";
import { scanCatalog, scanField, scanSummary, type DataFieldInput } from "./data-scan";

const base: DataFieldInput = {
  datasetName: "claims",
  fieldName: "diagnosis_code",
  dataCategory: "health",
  sensitiveType: "health",
  sampleMasked: "ICD ***",
  encrypted: true,
  consented: true,
};

describe("DPDP field scanning", () => {
  it("passes a sensitive field with encryption and consent", () => {
    const result = scanField(base);
    expect(result.riskLevel).toBe("LOW");
    expect(result.finding).toContain("No consent or encryption gap");
  });

  it("flags an unencrypted sensitive field as critical", () => {
    const result = scanField({ ...base, encrypted: false });
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.finding).toContain("without encryption");
    expect(result.citation).toContain("Section 8(4)");
  });

  it("flags an unconsented sensitive field as critical with both citations", () => {
    const result = scanField({ ...base, consented: false });
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.finding).toContain("consent basis");
    expect(result.citation).toContain("Section 6(1)");
    expect(result.citation).toContain("Section 8(4)");
  });

  it("flags an unconsented non-sensitive field as high", () => {
    const result = scanField({
      ...base,
      datasetName: "analytics",
      fieldName: "device_id",
      dataCategory: "identifier",
      sensitiveType: undefined,
      encrypted: true,
      consented: false,
    });
    expect(result.riskLevel).toBe("HIGH");
    expect(result.citation).toBe("DPDP Act 2023, Section 6(1)");
  });

  it("treats financial categories as sensitive even without a type", () => {
    const result = scanField({
      ...base,
      datasetName: "payments",
      fieldName: "upi_id",
      dataCategory: "financial",
      sensitiveType: undefined,
      encrypted: false,
      consented: true,
    });
    expect(result.riskLevel).toBe("CRITICAL");
  });

  it("rates unencrypted non-sensitive fields as medium", () => {
    const result = scanField({
      ...base,
      datasetName: "marketing",
      fieldName: "whatsapp_number",
      dataCategory: "contact",
      sensitiveType: undefined,
      encrypted: false,
      consented: true,
    });
    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.citation).toBe("DPDP Act 2023, Section 8(4)");
  });

  it("summarises the catalogue", () => {
    const results = scanCatalog([
      { ...base, encrypted: false, consented: false },
      { ...base, encrypted: true, consented: true },
      {
        ...base,
        datasetName: "analytics",
        fieldName: "device_id",
        dataCategory: "identifier",
        sensitiveType: undefined,
        encrypted: true,
        consented: false,
      },
      {
        ...base,
        datasetName: "marketing",
        fieldName: "whatsapp_number",
        dataCategory: "contact",
        sensitiveType: undefined,
        encrypted: false,
        consented: true,
      },
    ]);
    const summary = scanSummary(results);

    expect(summary.total).toBe(4);
    expect(summary.critical).toBe(1);
    expect(summary.high).toBe(1);
    expect(summary.medium).toBe(1);
    expect(summary.low).toBe(1);
    expect(summary.unconsented).toBe(2);
    expect(summary.unencrypted).toBe(2);
  });

  it("deduplicates repeated citations", () => {
    const result = scanField({ ...base, encrypted: false, consented: false });
    expect(result.citation.split("|")).toHaveLength(2);
  });
});
