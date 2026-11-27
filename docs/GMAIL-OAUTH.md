# Gmail OAuth 2.0 sending — exact setup

This is the click-by-click path to send PolicyPulse email from
**policypulse.hexa@gmail.com** through the Gmail API. The app never asks for the Gmail
password or an App Password. It stores an OAuth access token and refresh token, encrypted
with AES-256-GCM, and refreshes the access token automatically.

> Keep the Google account password and the OAuth client secret out of git, chat, docs, and
> screenshots. `apps/web/.env` is gitignored. Production values belong only in Vercel.

## 0. What you need

| Item | Where |
| --- | --- |
| Google account | `policypulse.hexa@gmail.com` |
| Google OAuth client ID + secret | Google Cloud Console (step 1) |
| `TOKEN_ENCRYPTION_KEY` | Generated locally (step 2) |
| Supabase database URLs | Supabase dashboard (step 4) |
| Vercel project | Import the GitHub repo (step 5) |

The Supabase **publishable** and **secret** API keys are not database credentials and are not
used by this app. Prisma needs the Postgres connection strings from step 4.

## 1. Google Cloud Console

1. Open <https://console.cloud.google.com/> and sign in as `policypulse.hexa@gmail.com`.
2. Create a project, for example **PolicyPulse Mail**.
3. **APIs & Services → Library** → search **Gmail API** → **Enable**.
4. **APIs & Services → OAuth consent screen**:
   - User type: **External** (a personal `@gmail.com` account cannot use Internal).
   - App name: `PolicyPulse`; support email and developer email: your address.
   - **Scopes**: add `openid`, `.../auth/userinfo.email`, and
     `https://www.googleapis.com/auth/gmail.send`. `gmail.send` can send but cannot read
     the mailbox.
   - **Test users**: add `policypulse.hexa@gmail.com`.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `PolicyPulse Web`.
   - **Authorized redirect URIs** — add both, exactly (no trailing slash, no `www`):
     ```text
     http://localhost:3000/api/integrations/gmail/callback
     https://<your-vercel-domain>/api/integrations/gmail/callback
     ```
   - Create, then copy the **Client ID** and **Client secret**.

Notes:

- While the consent screen is in **Testing**, Google expires refresh tokens after 7 days. That
  is enough for the designathon. For durable production sending, publish the app and complete
  Google verification for the `gmail.send` scope.
- If you change the Vercel domain, add the new callback URI before connecting again.

## 2. Generate the token encryption key

Run once; keep the output private:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The key must decode to 32 bytes. Rotating it invalidates stored tokens, so reconnect the
mailbox after a rotation.

## 3. Configure the app locally

Edit `apps/web/.env`:

```dotenv
EMAIL_PROVIDER=gmail
GOOGLE_CLIENT_ID=<client id from step 1>
GOOGLE_CLIENT_SECRET=<client secret from step 1>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/gmail/callback
TOKEN_ENCRYPTION_KEY=<value from step 2>
GMAIL_FROM_NAME=PolicyPulse
AUTH_SECRET=<a 32-byte random value>
```

Apply the Gmail table and start the app:

```bash
cd apps/web
node scripts/prisma-generate.mjs
node --env-file=.env scripts/db-init.mjs   # adds the GmailAccount table, idempotent
npm run dev
```

Sign in as the owner persona (demo mode) and open **Settings → Email**.

## 4. Supabase (hosted database)

1. Supabase dashboard → **Project Settings → Database → Connection string**:
   - **Transaction pooler** (`:6543`) → `DATABASE_URL`, keep `?sslmode=require`.
   - **Session pooler / direct** (`:5432`) → `DIRECT_URL`, keep `?sslmode=require`.
2. Apply the schema once through the **session/direct** URL:

   ```bash
   cd apps/web
   DATABASE_URL="<session 5432 url>" node scripts/db-init.mjs
   DATABASE_URL="<session 5432 url>" npm run db:seed
   ```

   Or use `npm run db:push` (Prisma uses `DIRECT_URL`) on a network that can download engines.
3. The runtime uses the transaction pooler with a small pool. Set `DATABASE_POOL_MAX=2` on
   Vercel.

## 5. Vercel

1. **Add New Project → Import** `Ruthravarshan/Designathon_Compliance_Copilot`.
2. **Root Directory:** `apps/web`. Framework: Next.js.
3. Enable **Include files outside the Root Directory in the Build Step**.
4. Add these for Production and Preview:

   ```text
   APP_URL=https://<your-vercel-domain>
   NODE_ENV=production            # Vercel sets this; do not override
   AUTH_SECRET=<32-byte random>
   DATABASE_URL=<transaction pooler 6543, sslmode=require>
   DIRECT_URL=<session pooler 5432, sslmode=require>
   DATABASE_POOL_MAX=2
   DEMO_MODE=true
   EMAIL_PROVIDER=gmail
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   TOKEN_ENCRYPTION_KEY=<32-byte base64>
   GMAIL_FROM_NAME=PolicyPulse
   CRON_SECRET=<openssl rand -hex 24>
   ```

   Optional: `GOOGLE_REDIRECT_URI=https://<your-vercel-domain>/api/integrations/gmail/callback`
   if you want the callback pinned instead of derived from `APP_URL`.
5. Deploy from the **main** branch. The first deploy produces the URL.
6. Go back to the Google OAuth client and confirm the production callback URI matches the
   deployed domain exactly, then redeploy if you changed `APP_URL` or `GOOGLE_REDIRECT_URI`.
7. Vercel Cron (`apps/web/vercel.json`) calls `/api/cron/email` daily on Hobby. It drains the
   Gmail outbox. For minute-level progress, raise the schedule on Pro or call the endpoint from
   an external scheduler with `Authorization: Bearer $CRON_SECRET`.

## 6. Send mail from here — the short path

1. Sign in as the workspace **OWNER**.
2. Open **Settings → Email** (`/app/settings/email`).
3. Click **Connect Gmail** (only the owner sees this). Approve the Google consent screen for
   `policypulse.hexa@gmail.com`. You return to Settings with “Gmail connected”.
4. Click **Send test email**. It is queued in the outbox, drained immediately, and sent through
   the Gmail API. Check the inbox.
5. Every product email now follows the same path: request → outbox row → cron/worker drain →
   Gmail API. Access tokens refresh 60 seconds before expiry; a revoked refresh token marks the
   connection and asks the owner to reconnect.

The Gmail password is only used to sign in to Google Cloud Console once. Do not type it into
the app, and do not send it to anyone.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `redirect_uri_mismatch` | The URI in Google Console must match the app exactly, including scheme, domain, path, and no trailing slash. |
| `access_denied` | The Google user cancelled, or is not in **Test users**. Add the account. |
| `invalid_grant` after ~7 days | Testing-mode refresh tokens expire. Reconnect, or publish/verify the OAuth app. |
| “Gmail sending is not configured” | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `TOKEN_ENCRYPTION_KEY` is missing or the key is not 32 bytes. Redeploy. |
| “The Gmail connection is not active” | Tokens were revoked or the refresh failed. Reconnect the mailbox. |
| Test email says 502 | Read the outbox row status. Common causes: `gmail.send` scope not granted, Gmail API not enabled, or the account is suspended. |
| Vercel cron returns 401 | `CRON_SECRET` is missing or differs between the cron config and the deployment. |
| Supabase `too many connections` | Use the `:6543` pooler URL and `DATABASE_POOL_MAX=2`. |
| Supabase paused | Restore the project, warm `/api/health`, reseed if needed. |

## 8. Security model

- Scope is `gmail.send` only; the app cannot read the mailbox.
- Access and refresh tokens are encrypted at rest; only ciphertext is stored.
- Tokens are never returned by an API, rendered in HTML, or written to logs.
- OAuth state is HMAC-signed, single-use, expires in 10 minutes, and must match the browser
  cookie and the signed-in owner.
- Disconnect revokes the refresh token at Google and deletes the local connection.
- Every connect, disconnect, and test send writes an `AuditLog` row with actor and request id.
