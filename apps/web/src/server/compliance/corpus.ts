import type { ComplianceRecord, RegulatorKey, SourceClause } from "../../lib/compliance/types";

export interface DocumentSeed {
  key: string;
  regulator: RegulatorKey;
  title: string;
  reference: string;
  summary: string;
  sourceUrl: string;
  publishedAt: string;
  effectiveAt: string;
  /** Real regulator file checked into prisma/fixtures; parsed at seed time. */
  fixture: string;
  contentType: string;
}

export interface PersonaSeed {
  key: string;
  name: string;
  email: string;
  title: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  workspaceSlug: string;
  blurb: string;
}

export interface DataFieldSeed {
  datasetName: string;
  fieldName: string;
  dataCategory: "identifier" | "contact" | "financial" | "health" | "biometric" | "metadata";
  sensitiveType?: string;
  sampleMasked: string;
  encrypted: boolean;
  consented: boolean;
}

/** Fixed clock so seeded due dates and the pre-reviewed history are reproducible. */
export const DEMO_NOW = new Date("2026-11-10T09:00:00.000Z");

export const DEMO_WORKSPACES = [
  { slug: "hexa-demo", name: "PolicyPulse Workspace", role: "primary" as const },
  { slug: "northwind-assurance", name: "Northwind Assurance", role: "isolation" as const },
];

export interface SourceSeed {
  name: string;
  regulator: RegulatorKey;
  kind: "LISTING" | "DIRECT";
  listingUrl: string;
  allowedDomains: string[];
  linkPattern?: string;
  schedule: string;
  enabled: boolean;
}

export const DEMO_SOURCES: SourceSeed[] = [
  {
    name: "RBI Master Directions",
    regulator: "RBI",
    kind: "LISTING",
    listingUrl: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx",
    allowedDomains: ["rbi.org.in"],
    linkPattern: "BS_ViewMasDirections\\.aspx\\?id=",
    schedule: "weekly",
    enabled: true,
  },
  {
    // Seeded paused: the listing mixes scanned and regional-language PDFs.
    name: "IRDAI circulars",
    regulator: "IRDAI",
    kind: "LISTING",
    listingUrl: "https://irdai.gov.in/circulars",
    allowedDomains: ["irdai.gov.in"],
    schedule: "weekly",
    enabled: false,
  },
];

export const DEMO_PERSONAS: PersonaSeed[] = [
  {
    key: "owner",
    name: "Rajeshwari",
    email: "rajeshwaridev871@gmail.com",
    title: "Head of Compliance",
    role: "OWNER",
    workspaceSlug: "hexa-demo",
    blurb: "Owns sign-off, the policy register, and the final review decision.",
  },
  {
    key: "admin",
    name: "Ruthravarshan",
    email: "ruthravarshan.ksrct@gmail.com",
    title: "Chief Information Security Officer",
    role: "ADMIN",
    workspaceSlug: "hexa-demo",
    blurb: "Reviews security findings and owns the control remediation tasks.",
  },
  {
    key: "analyst",
    name: "Sana Iqbal",
    email: "sana.iqbal@hexa.example",
    title: "Compliance Analyst",
    role: "MEMBER",
    workspaceSlug: "hexa-demo",
    blurb: "Reads circulars, asks policy questions, and prepares the evidence pack.",
  },
  {
    key: "hr",
    name: "Ananya Rao",
    email: "ananya.rao@hexa.example",
    title: "HR Policy Owner",
    role: "MEMBER",
    workspaceSlug: "hexa-demo",
    blurb: "Owns POL-HR-01 and can run a manual compliance check on it.",
  },
  {
    key: "auditor",
    name: "Nikhil Rao",
    email: "nikhil.rao@hexa.example",
    title: "Board Audit Committee",
    role: "VIEWER",
    workspaceSlug: "hexa-demo",
    blurb: "Read-only oversight. Cannot approve, edit, or ingest anything.",
  },
  {
    key: "tenant",
    name: "Tara Singh",
    email: "tara.singh@northwind.example",
    title: "Compliance Lead, Northwind",
    role: "OWNER",
    workspaceSlug: "northwind-assurance",
    blurb: "A second tenant used to prove workspace isolation.",
  },
];

/**
 * Real regulator publications, checked in under prisma/fixtures and parsed at
 * seed time with the same extractor the ingestion pipeline uses. No clause text
 * here is hand-written.
 */
export const REAL_DOCUMENTS: DocumentSeed[] = [
  {
    key: "irdai-cyber-2023",
    regulator: "IRDAI",
    title: "IRDAI Information and Cyber Security Guidelines, 2023",
    reference: "IRDAI/GA&HR/GDL/MISC/88/04/2023",
    summary:
      "IRDAI's guidelines on information and cyber security for insurers, issued 24 April 2023. The official site blocks scripted downloads, so the PDF fixture is mirrored from a legal-document archive; citations open IRDAI's document detail page.",
    sourceUrl: "https://irdai.gov.in/web/guest/document-detail?documentId=3314780",
    publishedAt: "2023-04-24T00:00:00.000Z",
    effectiveAt: "2023-04-24T00:00:00.000Z",
    fixture: "prisma/fixtures/irdai-cyber-2023.pdf",
    contentType: "application/pdf",
  },
  {
    key: "sebi-cscrf-2024",
    regulator: "SEBI",
    title: "Cybersecurity and Cyber Resilience Framework (CSCRF) for SEBI Regulated Entities (REs)",
    reference: "SEBI/HO/ITD-1/ITD_CSC_EXT/P/CIR/2024/113",
    summary:
      "SEBI's CSCRF circular dated 20 August 2024, setting cyber security and cyber resilience requirements for SEBI regulated entities.",
    sourceUrl:
      "https://www.sebi.gov.in/legal/circulars/aug-2024/cybersecurity-and-cyber-resilience-framework-cscrf-for-sebi-regulated-entities-res-_85964.html",
    publishedAt: "2024-08-20T00:00:00.000Z",
    effectiveAt: "2024-08-20T00:00:00.000Z",
    fixture: "prisma/fixtures/sebi-cscrf-2024.pdf",
    contentType: "application/pdf",
  },
  {
    key: "sebi-index-providers-2024",
    regulator: "SEBI",
    title: "SEBI (Index Providers) Regulations, 2024",
    reference: "SEBI/LAD-NRO/GN/2024/167",
    summary:
      "SEBI's framework for index providers, notified by SEBI/LAD-NRO/GN/2024/167 on 8 March 2024 and consolidated up to the 28 November 2024 amendment. Sets governance, transparency, and accountability requirements for administrators and benchmarks.",
    sourceUrl: "https://www.sebi.gov.in/sebi_data/attachdocs/aug-2026/1787044429049.pdf",
    publishedAt: "2024-03-08T00:00:00.000Z",
    effectiveAt: "2024-09-04T00:00:00.000Z",
    fixture: "prisma/fixtures/sebi-index-providers-2024.pdf",
    contentType: "application/pdf",
  },
  {
    key: "sebi-kyc-kra-circular-2026",
    regulator: "SEBI",
    title:
      "SEBI circular: Simplification of client on-boarding and rationalisation of risk management framework at KYC Registration Agencies",
    reference: "SEBI/HO/38/14/25/2026-MIRSD-POD3",
    summary:
      "SEBI circular HO/38/14/(25)2026-MIRSD-POD3 dated 25 November 2026 simplifying client on-boarding and rationalising the risk management framework at KYC Registration Agencies. Applies to SEBI-registered intermediaries, exchanges, clearing corporations, and depositories; effective 24 December 2026.",
    sourceUrl:
      "https://www.sebi.gov.in/legal/circulars/nov-2026/simplification-of-client-on-boarding-and-rationalisation-of-risk-management-framework-at-kyc-registration-agencies_105839.html",
    publishedAt: "2026-11-25T00:00:00.000Z",
    effectiveAt: "2026-12-24T00:00:00.000Z",
    fixture: "prisma/fixtures/sebi-kyc-kra-circular-2026.pdf",
    contentType: "application/pdf",
  },
  {
    key: "irdai-iac-regulations-2000",
    regulator: "IRDAI",
    title:
      "IRDAI (Insurance Advisory Committee) Regulations, 2000 (as amended up to 1 October 2025)",
    reference: "IRDAI/Reg/2/209/2025",
    summary:
      "The IRDAI (Insurance Advisory Committee) Regulations, 2000, consolidated as amended up to 1 October 2025 by IRDAI/Reg/2/209/2025. Governs the constitution, meetings, and procedures of the Authority's Insurance Advisory Committee.",
    sourceUrl: "https://irdai.gov.in/web/guest/regulations",
    publishedAt: "2025-10-01T00:00:00.000Z",
    effectiveAt: "2025-10-01T00:00:00.000Z",
    fixture: "prisma/fixtures/irdai-iac-regulations-2000.pdf",
    contentType: "application/pdf",
  },
  {
    key: "rbi-lab-supervisory-directions-2026",
    regulator: "RBI",
    title: "RBI (Local Area Banks – Miscellaneous) Supervisory Directions, 2026",
    reference: "RBI/DoS/2026-27/450",
    summary:
      "Reserve Bank of India (Local Area Banks – Miscellaneous) Supervisory Directions, 2026, issued under RBI/DoS/2026-27/450 on 31 July 2026 and updated to 1 October 2026. Covers fair practices, inoperative accounts, fraud prevention, the protected disclosure scheme, and vigilance for local area banks.",
    sourceUrl: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx",
    publishedAt: "2026-07-31T00:00:00.000Z",
    effectiveAt: "2026-07-31T00:00:00.000Z",
    fixture: "prisma/fixtures/rbi-lab-supervisory-directions-2026.pdf",
    contentType: "application/pdf",
  },
  {
    key: "rbi-kyc-amendment-directions-2025",
    regulator: "RBI",
    title: "RBI (Commercial Banks – Know Your Customer) Amendment Directions, 2025",
    reference: "RBI/2025-26/166",
    summary:
      "Reserve Bank of India (Commercial Banks – Know Your Customer) Amendment Directions, 2025, issued under RBI/2025-26/166 and DOR.AML.REC.370/14.01.002/2025-26 on 29 December 2025. Amends the KYC Directions, 2025 with immediate effect, including Central KYC Registry responsibilities.",
    sourceUrl: "https://www.rbi.org.in/Scripts/NotificationUser.aspx",
    publishedAt: "2025-12-29T00:00:00.000Z",
    effectiveAt: "2025-12-29T00:00:00.000Z",
    fixture: "prisma/fixtures/rbi-kyc-amendment-directions-2025.pdf",
    contentType: "application/pdf",
  },
];

function record(
  input: Omit<ComplianceRecord, "kind"> & { kind: ComplianceRecord["kind"] },
): ComplianceRecord {
  return input;
}

export const DEMO_POLICIES: ComplianceRecord[] = [
  record({
    kind: "policy",
    code: "POL-SEC-02",
    title: "Incident Response and Reporting Policy",
    section: "§4.2 Incident escalation",
    text: "Cyber security incidents are escalated to the CISO and reported to IRDAI and CERT-In within 72 hours of detection. Post-incident reviews are completed within five business days.",
    tags: ["incident-reporting", "security"],
    ownerName: "Ruthravarshan",
    ownerEmail: "ruthravarshan.ksrct@gmail.com",
    attributes: { incidentReportHours: 72 },
  }),
  record({
    kind: "policy",
    code: "POL-PRIV-01",
    title: "Customer Privacy and Consent Policy",
    section: "§7 Consent lifecycle",
    text: "Customers may withdraw consent by writing to the privacy desk, and requests are honoured within 14 days. Personal data is retained for 18 months after account closure before deletion.",
    tags: ["consent", "privacy", "retention"],
    ownerName: "Rajeshwari",
    ownerEmail: "rajeshwaridev871@gmail.com",
    attributes: {
      consentWithdrawal: "email_request_14_days",
      erasureOnWithdrawal: false,
      retentionMonths: 18,
      grievanceContact: true,
      thirdPartySharingConsent: false,
      notifyPrincipals: false,
    },
  }),
  record({
    kind: "policy",
    code: "POL-RET-03",
    title: "Records Retention Policy",
    section: "§3 Log retention",
    text: "Application and security logs are retained for 90 days in the central log archive.",
    tags: ["logging", "log-retention", "retention"],
    ownerName: "Rajeshwari",
    ownerEmail: "rajeshwaridev871@gmail.com",
    attributes: { logRetentionDays: 90, retentionMonths: 18 },
  }),
  record({
    kind: "policy",
    code: "POL-CLOUD-05",
    title: "Cloud Services and Data Residency Policy",
    section: "§2 Hosting regions",
    text: "Regulated production workloads run in the AWS ap-southeast-1 region, with backups stored in the same region.",
    tags: ["cloud", "localization", "data-residency"],
    ownerName: "Rajeshwari",
    ownerEmail: "rajeshwaridev871@gmail.com",
    attributes: { dataRegion: "AWS ap-southeast-1" },
  }),
  record({
    kind: "policy",
    code: "POL-HR-01",
    title: "Human Resources Data and Employee Privacy Policy",
    section: "§5 Employee data lifecycle",
    text: "Employee personal data is collected only for payroll, statutory, and wellbeing purposes. Grievances are acknowledged within seven days and resolved within 30 days. Personnel records are retained for 24 months after separation unless another law requires longer retention.",
    tags: ["human-resources", "employee-privacy", "grievance", "retention"],
    ownerName: "Ananya Rao",
    ownerEmail: "ananya.rao@hexa.example",
    attributes: {
      grievanceAckDays: 7,
      grievanceResolutionDays: 30,
      grievanceContact: true,
      employeeRetentionMonths: 24,
      noticePrincipals: true,
    },
  }),
];

export const DEMO_CONTROLS: ComplianceRecord[] = [
  record({
    kind: "control",
    code: "CTRL-SEC-09",
    title: "Annual VAPT programme",
    section: "Control activity",
    text: "Vulnerability assessments and penetration tests are run annually by an external assessor, and reports are tracked to closure.",
    tags: ["security-testing", "vapt"],
    ownerName: "Ruthravarshan",
    ownerEmail: "ruthravarshan.ksrct@gmail.com",
    systemName: "Nessus / Burp Suite",
    attributes: { vaCadenceMonths: 12, ptCadenceMonths: 12 },
  }),
  record({
    kind: "control",
    code: "CTRL-CLOUD-07",
    title: "Cloud vendor audit control",
    section: "Control activity",
    text: "Cloud contracts include a right-to-audit clause and an annual audit calendar covering security controls.",
    tags: ["third-party", "audit", "cloud", "vendor"],
    ownerName: "Ruthravarshan",
    ownerEmail: "ruthravarshan.ksrct@gmail.com",
    systemName: "AWS",
    attributes: { auditRight: true, auditCadenceMonths: 12 },
  }),
  record({
    kind: "control",
    code: "CTRL-OPS-05",
    title: "Annual disaster recovery drill",
    section: "Control activity",
    text: "DR drills run annually and the report is tabled at the technology risk forum.",
    tags: ["resilience", "dr", "business-continuity"],
    ownerName: "Ruthravarshan",
    ownerEmail: "ruthravarshan.ksrct@gmail.com",
    systemName: "DR site, Mumbai",
    attributes: { drDrillMonths: 12 },
  }),
  record({
    kind: "control",
    code: "CTRL-GOV-02",
    title: "Board security reporting",
    section: "Control activity",
    text: "The CISO reports to the Board Risk Committee each quarter, and the Risk Management Committee charter is reviewed annually.",
    tags: ["governance", "board"],
    ownerName: "Rajeshwari",
    ownerEmail: "rajeshwaridev871@gmail.com",
    systemName: "Board Risk Committee",
    attributes: { cisoReportsToBoard: true, riskCommitteeConstituted: true },
  }),
];

export const DEMO_DATA_CATALOG: DataFieldSeed[] = [
  {
    datasetName: "customers",
    fieldName: "full_name",
    dataCategory: "identifier",
    sampleMasked: "A***a K***",
    encrypted: false,
    consented: true,
  },
  {
    datasetName: "customers",
    fieldName: "pan_number",
    dataCategory: "financial",
    sensitiveType: "financial",
    sampleMasked: "AB***F",
    encrypted: true,
    consented: true,
  },
  {
    datasetName: "customers",
    fieldName: "aadhaar_last4",
    dataCategory: "identifier",
    sensitiveType: "identity",
    sampleMasked: "**** 4821",
    encrypted: true,
    consented: true,
  },
  {
    datasetName: "payments",
    fieldName: "upi_id",
    dataCategory: "financial",
    sampleMasked: "m***@okbank",
    encrypted: false,
    consented: true,
  },
  {
    datasetName: "payments",
    fieldName: "bank_account",
    dataCategory: "financial",
    sensitiveType: "financial",
    sampleMasked: "**** 9930",
    encrypted: true,
    consented: true,
  },
  {
    datasetName: "claims",
    fieldName: "diagnosis_code",
    dataCategory: "health",
    sensitiveType: "health",
    sampleMasked: "ICD ***",
    encrypted: false,
    consented: false,
  },
  {
    datasetName: "claims",
    fieldName: "prescription_notes",
    dataCategory: "health",
    sensitiveType: "health",
    sampleMasked: "Metf***",
    encrypted: false,
    consented: true,
  },
  {
    datasetName: "marketing",
    fieldName: "whatsapp_number",
    dataCategory: "contact",
    sampleMasked: "+91 **** 2210",
    encrypted: false,
    consented: true,
  },
  {
    datasetName: "marketing",
    fieldName: "consent_source",
    dataCategory: "metadata",
    sampleMasked: "web_form",
    encrypted: true,
    consented: true,
  },
  {
    datasetName: "analytics",
    fieldName: "device_id",
    dataCategory: "identifier",
    sampleMasked: "dev_***",
    encrypted: false,
    consented: false,
  },
  {
    datasetName: "analytics",
    fieldName: "ip_address",
    dataCategory: "identifier",
    sampleMasked: "10.***.***.24",
    encrypted: false,
    consented: true,
  },
  {
    datasetName: "hr",
    fieldName: "biometric_template",
    dataCategory: "biometric",
    sensitiveType: "biometric",
    sampleMasked: "<template>",
    encrypted: true,
    consented: false,
  },
];

export function documentContent(clauses: readonly SourceClause[]): string {
  return clauses
    .map((clause) => `[Page ${clause.pageNumber}] ${clause.sectionLabel}\n${clause.text}`)
    .join("\n\n");
}

export function personaByKey(key: string): PersonaSeed | undefined {
  return DEMO_PERSONAS.find((persona) => persona.key === key);
}
