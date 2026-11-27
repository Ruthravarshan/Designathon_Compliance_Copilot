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
  pageCount: number;
  clauses: SourceClause[];
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
    name: "RBI IT Governance Master Direction",
    regulator: "RBI",
    kind: "DIRECT",
    listingUrl: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12562",
    allowedDomains: ["rbi.org.in"],
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

const irdaiClauses: SourceClause[] = [
  {
    sectionLabel: "Section 4.2, Page 12",
    heading: "Incident reporting to the Authority",
    pageNumber: 12,
    text: "Critical and cyber security incidents shall be reported to the IRDAI within six hours of detection, along with the root cause and containment actions.",
  },
  {
    sectionLabel: "Section 5.1, Page 15",
    heading: "Board oversight",
    pageNumber: 15,
    text: "The Chief Information Security Officer shall report directly to the Board or its Risk Management Committee at least once a quarter.",
  },
];

const rbiClauses: SourceClause[] = [
  {
    sectionLabel: "Section 3.2, Page 8",
    heading: "Security testing cadence",
    pageNumber: 8,
    text: "Critical systems shall undergo a vulnerability assessment at least once every six months and penetration testing at least once every twelve months.",
  },
  {
    sectionLabel: "Section 4.1, Page 21",
    heading: "Storage of payment system data",
    pageNumber: 21,
    text: "All regulated entities shall ensure that payment system data is stored only on servers located within India and shall not be replicated outside India.",
  },
  {
    sectionLabel: "Section 5.4, Page 23",
    heading: "Cloud outsourcing",
    pageNumber: 23,
    text: "Contracts with cloud service providers shall include a right to audit the provider's security controls.",
  },
];

const certInClauses: SourceClause[] = [
  {
    sectionLabel: "Section 6, Page 4",
    heading: "Incident reporting to CERT-In",
    pageNumber: 4,
    text: "Cyber security incidents shall be reported to CERT-In within six hours of noticing such incidents.",
  },
  {
    sectionLabel: "Section 7, Page 5",
    heading: "Log retention",
    pageNumber: 5,
    text: "All service providers shall retain logs of their ICT systems for a rolling period of one hundred eighty days.",
  },
];

const sebiClauses: SourceClause[] = [
  {
    sectionLabel: "Section 5.3, Page 9",
    heading: "Cyber resilience drills",
    pageNumber: 9,
    text: "Regulated entities shall conduct disaster recovery drills at least once every six months and submit the results to the Board.",
  },
  {
    sectionLabel: "Section 6.1, Page 11",
    heading: "Governance",
    pageNumber: 11,
    text: "The Board of every regulated entity shall constitute a Risk Management Committee and review its charter annually.",
  },
];

const dpdpClauses: SourceClause[] = [
  {
    sectionLabel: "Section 6(4), Page 5",
    heading: "Withdrawal of consent",
    pageNumber: 5,
    text: "The Data Principal shall have the right to withdraw her consent at any time, and the ease of doing so shall be comparable to the ease with which such consent was given.",
  },
  {
    sectionLabel: "Section 8(7), Page 9",
    heading: "Erasure of personal data",
    pageNumber: 9,
    text: "The Data Fiduciary shall erase personal data upon withdrawal of consent, unless retention is required by law.",
  },
  {
    sectionLabel: "Section 16, Page 14",
    heading: "Grievance redressal",
    pageNumber: 14,
    text: "The Data Fiduciary shall publish the contact details of a Data Protection Officer and a grievance officer on its website.",
  },
];

export const DEMO_DOCUMENTS: DocumentSeed[] = [
  {
    key: "irdai-cyber-2023",
    regulator: "IRDAI",
    title: "Information and Cyber Security Guidelines, 2023",
    reference: "IRDAI/IT/CYBER/2023",
    summary:
      "IRDAI's cyber security guidelines set a six-hour incident reporting window and Board-level oversight for insurers.",
    sourceUrl: "https://irdai.gov.in/",
    publishedAt: "2023-04-24T00:00:00.000Z",
    effectiveAt: "2023-06-01T00:00:00.000Z",
    pageCount: 42,
    clauses: irdaiClauses,
  },
  {
    key: "rbi-it-2023",
    regulator: "RBI",
    title: "Guidelines on Information Security and Data Localisation",
    reference: "RBI/IT/2023/07",
    summary:
      "RBI requires half-yearly VAPT, payment data storage within India, and audit rights over cloud providers.",
    sourceUrl: "https://www.rbi.org.in/",
    publishedAt: "2023-01-10T00:00:00.000Z",
    effectiveAt: "2023-04-01T00:00:00.000Z",
    pageCount: 36,
    clauses: rbiClauses,
  },
  {
    key: "cert-in-2022",
    regulator: "MEITY",
    title: "CERT-In Directions on Cyber Incident Reporting and Logs",
    reference: "CERT-IN/2022/01",
    summary:
      "CERT-In directions require six-hour incident reporting and 180-day log retention for service providers.",
    sourceUrl: "https://www.cert-in.org.in/",
    publishedAt: "2022-04-28T00:00:00.000Z",
    effectiveAt: "2022-06-27T00:00:00.000Z",
    pageCount: 9,
    clauses: certInClauses,
  },
  {
    key: "sebi-cscr-2023",
    regulator: "SEBI",
    title: "Cyber Security and Cyber Resilience Framework",
    reference: "SEBI/HO/ITD/CSCR/2023",
    summary:
      "SEBI's framework sets half-yearly cyber resilience drills and a Board-level Risk Management Committee.",
    sourceUrl: "https://www.sebi.gov.in/",
    publishedAt: "2023-06-01T00:00:00.000Z",
    effectiveAt: "2023-07-01T00:00:00.000Z",
    pageCount: 28,
    clauses: sebiClauses,
  },
  {
    key: "dpdp-2023",
    regulator: "MEITY",
    title: "Digital Personal Data Protection Act, 2023",
    reference: "DPDP/2023/ACT",
    summary:
      "The DPDP Act governs consent withdrawal, erasure, and grievance redressal for Data Fiduciaries.",
    sourceUrl: "https://www.meity.gov.in/",
    publishedAt: "2023-08-11T00:00:00.000Z",
    effectiveAt: "2023-08-11T00:00:00.000Z",
    pageCount: 22,
    clauses: dpdpClauses,
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
