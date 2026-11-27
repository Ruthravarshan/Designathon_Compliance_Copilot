# ADR 0005: SharePoint storage behind a provider abstraction

- Status: Accepted
- Date: 2026-11-27
- Deciders: Owner, OpenCode ingestion, Qoder backend

## Context

The owner wants circular PDFs stored in SharePoint and the owner must be able to change the storage
location/provider from the app. Azure/Graph credentials and the target site/drive have not been
supplied yet. The app also needs a storage path that works for local development and a Vercel-hosted
demo without pretending an upload succeeded.

## Decision

1. **Define a `StorageProvider` interface** with `upload`, `download`, `metadata`, and `testConnection`.
   The app stores only metadata (provider, item id, web URL, path, checksum, MIME, bytes).
2. **SharePoint via Microsoft Graph is the primary provider.** Use an app-only Entra ID registration,
   client-credentials token, and the configured site/drive/folder. Small files use a direct `PUT`;
   larger files use an upload session. Credentials (tenant/client/secret) are env/Vercel secrets;
   site/drive/folder are database settings editable by the owner.
3. **Supabase Storage is the real fallback provider** for local/dev and for a demo where Graph is not
   configured. It is a real private bucket, not a mock; the owner chooses the default connection and
   the UI shows which provider served each file.
4. **Google Drive is an optional adapter behind the same interface.** Do not ship a fake Drive
   integration; if credentials/time are missing, leave it not configured and say so.
5. **No silent fallback.** If the selected provider fails, the job fails with a safe
   `STORAGE_UNAVAILABLE`/`INTEGRATION_NOT_CONFIGURED` code and the owner sees the run error. The app
   must not claim a SharePoint URL that does not exist.
6. **Citations use both links:** the authorized app file proxy (source of truth in storage) and the
   original public source URL. The reader chooses. The proxy checks workspace/RBAC before streaming.
7. **Secrets never enter the database or UI.** The owner sees configured/not configured and can run a
   real test connection; the secret values stay in env/Vercel.

## Consequences

Positive:

- Owner can switch storage without code changes; SharePoint is first-class.
- Demo works before Azure credentials arrive; failure is honest and visible.
- File citations are stable and authorization-aware.

Negative:

- Two or three adapter implementations add test surface.
- Graph app permissions/consent and site/drive discovery are setup friction.
- Streaming large PDFs through a serverless function has limits; Range support and bounded size are
  required.
- Supabase Storage is not SharePoint; the owner must switch the default for the final requirement.

Mitigations:

- Implement SharePoint first, Supabase fallback second; Drive only if time and credentials exist.
- Test connection with real calls and record evidence; never fabricate a result.
- Keep the proxy range-capable and cap PDF size; link out to the source for huge files if needed.

## Alternatives considered

- **SharePoint only:** blocks the demo until Azure credentials arrive.
- **Supabase Storage only:** contradicts the owner's SharePoint requirement.
- **Local filesystem:** not deploy-ready on Vercel.
- **Store files in Postgres:** poor fit for large PDFs and citations.

## Follow-up

- Owner supplies the Azure app registration, consent, site/drive, and folder.
- Add Google Drive only if the owner confirms it is required now.
- Revisit Graph throttling and large-file limits after the first real ingestion.