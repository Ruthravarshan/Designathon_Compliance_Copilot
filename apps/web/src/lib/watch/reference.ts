import type { RegulatorKey } from "../compliance/types";

const MAX_REFERENCE_LENGTH = 60;

/** Deterministic 32-bit FNV-1a hash, rendered as uppercase base36. */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(6, "0");
}

function slugFromUrl(value: string): string {
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }

  let raw = "";
  if (url) {
    const id = url.searchParams.get("id") ?? url.searchParams.get("Id");
    if (id && id.trim() !== "") {
      raw = id.trim();
    } else {
      const segments = url.pathname.split("/").filter(Boolean);
      raw = segments[segments.length - 1] ?? "document";
      raw = raw.replace(/\.[a-z0-9]{1,6}$/i, "");
    }
  } else {
    raw = value;
  }

  const slug = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return slug === "" ? "DOC" : slug;
}

/**
 * Stable reference for a fetched document. Same URL always yields the same value
 * so the weekly run can tell "new" apart from "already ingested".
 */
export function deriveReference(regulator: RegulatorKey, url: string): string {
  const slug = slugFromUrl(url);
  const hash = shortHash(url.trim().toLowerCase());
  const reference = `${regulator}-${slug}-${hash}`;
  return reference.slice(0, MAX_REFERENCE_LENGTH);
}

export function documentKeyFor(reference: string): string {
  return reference.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
