# Storage setup

Circular PDFs are written through a provider abstraction and stored in the primary connection the
owner picks. Owners and admins manage this at **/app/settings/storage**; secrets stay in the
environment and are never saved in the database or shown in the UI.

Roles:

- **Primary** — the only store used for new uploads.
- **Fallback** — used only when the primary fails with `INTEGRATION_NOT_CONFIGURED` or
  `STORAGE_UNAVAILABLE` (for example, expired Graph consent). Duplicates and validation errors never
  fall back. The upload result records which connection served the file.

One primary and one fallback per workspace, toggled with a radio in the UI. Removing a primary
promotes the oldest remaining connection.

## 1. Apply the table

`StorageConnection` needs to exist before the page renders.

```bash
npm run db:init           # applies init.sql + prisma/sql/003-storage-connections.sql
```

Or run `apps/web/prisma/sql/003-storage-connections.sql` against the target database once.

## 2. SharePoint / OneDrive primary (Microsoft Graph)

The owner's folder is a personal OneDrive folder shared by link. Two supported configurations:

| Option | Settings | Graph permission |
| --- | --- | --- |
| Paste the folder link | `folderUrl` (+ optional subfolder in `folder`) | `Sites.Selected` (most limited), `Sites.ReadWrite.All`, or `Files.ReadWrite.All` |
| Resolve by owner | `driveOwner` = UPN, e.g. `owner@contoso.com` | `User.Read.All` (+ `Files.ReadWrite.All` for writes) |
| Direct ids | `driveId` or `siteId`, plus `folderItemId` | Any of the above |

Steps:

1. Entra ID app registration → **Certificates & secrets** → create a client secret.
2. **API permissions** → Microsoft Graph → application permission from the table → grant admin
   consent. With `Sites.Selected`, also grant the app write access to the specific site via Graph.
3. Set `MSFT_GRAPH_TENANT_ID`, `MSFT_GRAPH_CLIENT_ID`, `MSFT_GRAPH_CLIENT_SECRET` in `.env.local` or
   Vercel.
4. Open the shared folder, copy its URL from the address bar (a sharing link also works), and paste
   it into **Shared folder link**. Leave **Folder path** empty to write at the root, or name a
   subfolder.
5. Save, then **Test**. The probe resolves the target drive through `/shares/{id}/driveItem` and
   reads the drive; success means the token, consent, and folder resolution all work.

Uploads use a direct `PUT` under 4 MiB and an upload session above it. A file that already exists is
reported as `DUPLICATE_DOCUMENT` and is never overwritten.

## 3. Google Drive fallback

The owner creates the folder (e.g. one folder per workspace) and shares it with the service account.

1. Google Cloud console → enable the **Google Drive API** → create a **service account** → create a
   JSON key.
2. Base64-encode the key file (single line) and set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`:
   `base64 -w0 service-account.json` (macOS: `base64 -i service-account.json`).
3. In Google Drive, share the target folder with the service account address
   (`...@....iam.gserviceaccount.com`) as **Editor**.
4. Paste the folder link (`https://drive.google.com/drive/folders/...`) in the UI; the folder id is
   derived. Or enter the id directly.
5. Save, choose **Fallback**, then **Test**.

Files under 5 MiB use a multipart upload; larger files use a resumable session. If the variable is
missing or the folder is not shared, the probe fails with `INTEGRATION_NOT_CONFIGURED` /
`STORAGE_UNAVAILABLE` — never a fabricated success.

## 4. Supabase Storage fallback

Uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Create a **private**
bucket (e.g. `circulars`) and enter its name. Files are streamed only through the authorized app
proxy.

## 5. Verify

- The card shows **Verified** with a timestamp only after a live provider call.
- The honest failure code is shown on the card and saved on the row.
- Ingestion run evidence: `usedFallback` and `storageConnectionId` on the stored document, visible in
  audit metadata.