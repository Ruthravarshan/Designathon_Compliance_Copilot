import { randomUUID } from "node:crypto";

export interface MimeAddress {
  name?: string;
  email: string;
}

export interface MimeInput {
  from: MimeAddress;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  date?: Date;
  boundary?: string;
  messageId?: string;
}

export class InvalidMimeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMimeInputError";
  }
}

const EMAIL_PATTERN = /^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/;
const BOUNDARY_PATTERN = /^[A-Za-z0-9'()+_,\-./:=? ]{1,70}$/;
const MAX_HEADER_LENGTH = 900;

/** Removes CR/LF and control characters so a value cannot inject a header. */
export function sanitizeHeader(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, MAX_HEADER_LENGTH);
}

export function sanitizeEmailAddress(value: string): string {
  const trimmed = value.trim();
  if (!EMAIL_PATTERN.test(trimmed)) {
    throw new InvalidMimeInputError("A recipient or sender address is not valid.");
  }
  return trimmed;
}

function encodeHeaderValue(value: string): string {
  const sanitized = sanitizeHeader(value);
  if (/^[\x20-\x7e]*$/.test(sanitized)) {
    return sanitized;
  }

  const words: string[] = [];
  let chunk = "";
  let chunkBytes = 0;

  for (const char of sanitized) {
    const size = Buffer.byteLength(char, "utf8");
    if (chunkBytes + size > 45 && chunk.length > 0) {
      words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += char;
    chunkBytes += size;
  }

  if (chunk.length > 0) {
    words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
  }

  return words.join("\r\n ");
}

function formatAddress(address: MimeAddress): string {
  const email = sanitizeEmailAddress(address.email);
  const name = address.name ? sanitizeHeader(address.name) : "";

  if (!name) {
    return email;
  }

  const formattedName = /^[\x20-\x7e]*$/.test(name)
    ? `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : encodeHeaderValue(name);

  return `${formattedName} <${email}>`;
}

export function wrapBase64(value: string, lineLength = 76): string {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += lineLength) {
    lines.push(value.slice(index, index + lineLength));
  }
  return lines.join("\r\n");
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

/**
 * Builds an RFC 2822 multipart message with both text and HTML parts. Every
 * header is stripped of CR/LF before it is written, so user-controlled names,
 * subjects, and addresses cannot add headers.
 */
export function buildMimeMessage(input: MimeInput): string {
  const to = sanitizeEmailAddress(input.to);
  const from = formatAddress(input.from);
  const domain = sanitizeEmailAddress(input.from.email).split("@")[1] ?? "localhost";
  const boundary = input.boundary ?? `=_PolicyPulse_${randomUUID()}`;

  if (!BOUNDARY_PATTERN.test(boundary)) {
    throw new InvalidMimeInputError("The MIME boundary contains invalid characters.");
  }

  const messageId = input.messageId
    ? sanitizeHeader(input.messageId)
    : `<${randomUUID()}@${domain}>`;
  const date = (input.date ?? new Date()).toUTCString();

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    ...(input.replyTo ? [`Reply-To: ${sanitizeEmailAddress(input.replyTo)}`] : []),
    `Subject: ${encodeHeaderValue(input.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "Auto-Submitted: auto-generated",
  ];

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.text, "utf8").toString("base64")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.html, "utf8").toString("base64")),
    `--${boundary}--`,
    "",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}
