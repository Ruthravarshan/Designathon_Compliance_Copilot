# ADR 0003: Supabase Auth for SSO, demo, and guest access

- Status: Accepted
- Date: 2026-11-27
- Deciders: Owner, backend lane
- Supersedes: ADR 0002, decision 5 (identity stays demo-cookie auth only)

## Context

The v1 app uses a flag-gated HMAC persona cookie and has no SSO, guest lifecycle, or production
identity. The owner now requires Google SSO (and Microsoft Entra when configured), a labelled demo
login for the judged walkthrough, and guest access that the owner or an admin can enable, inspect, and
revoke. The app already has workspace membership, server-side RBAC, and an audit trail; identity must
feed those, not bypass them. The deployment target is already Supabase + Vercel.

## Decision

1. **Supabase Auth is the production identity provider.** Google is the default OAuth provider;
   Microsoft Entra ID is enabled when its client credentials are configured in Supabase.
2. **Anonymous Supabase sessions provide guest access**, gated by
   `WorkspaceSettings.guestAccessEnabled`. A guest gets a `GUEST` membership, sample-scoped access,
   optional expiry, and no compliance visibility. Disabling the setting or revoking the member blocks
   the next request, not just the next sign-in.
3. **The v1 HMAC demo session remains a gated fallback.** It is allowed only when `DEMO_MODE=true` and
   `WorkspaceSettings.demoLoginEnabled`; it signs in only seeded users marked `isDemo`, is rate-limited,
   audited, and visibly labelled. It is never a production identity.
4. **App authorization stays in the app.** Supabase authenticates; `User`, `Membership`,
   `RolePermission`, and `UserPermissionOverride` authorize. Workspace scope comes from the session,
   never the request body.
5. **Unknown SSO users do not get automatic compliance access.** Check the email domain against
   `allowedEmailDomains`, apply `autoProvisionRole` or create a pending membership for owner approval.
6. **The browser never queries app tables directly.** Supabase PostgREST privileges for
   `anon/authenticated` are revoked/denied on app tables; the Next.js server uses Prisma with a
   server-only database URL. RLS/privilege lockdown is defense in depth, not the authorization layer.

## Consequences

Positive:

- Real SSO, guest lifecycle, and owner-controlled access without a second identity vendor.
- One membership/RBAC path for SSO, demo, and guests; audit and revocation remain server-side.
- Demo remains zero-friction for judges while production SSO is visibly available.

Negative:

- Adds `@supabase/ssr`/`@supabase/supabase-js`, middleware session refresh, OAuth callback routes, and
  provider configuration steps.
- Two session mechanisms (Supabase and demo HMAC) must be resolved carefully and cleared on sign-out.
- Supabase free-tier auth limits and provider configuration are external dependencies.
- Guest abuse remains possible if the setting is left on; expiry, rate limits, sample scoping, and
  owner revocation are required.

Mitigations:

- Resolve Supabase first, demo second; clear both on sign-out; check demo/guest gates per request.
- Cache settings and role rows per request; verify JWTs locally where supported to avoid an Auth
  round-trip on every page.
- Add an owner-facing guest list with revoke, expiry, and audit.

## Alternatives considered

- **Auth.js / Better Auth:** mature, but adds a second identity stack and provider configuration while
  the deployment already standardizes on Supabase.
- **Custom OIDC only:** more control, more security surface, and slower to ship.
- **Demo-only auth:** rejected by the owner; SSO and guest control are explicit requirements.
- **Supabase Auth only, drop demo:** rejected; the judged demo needs a reliable, labelled fallback.

## Follow-up

- Configure Google (and optionally Microsoft) redirect URLs in Supabase.
- Decide the demo guest policy (expiry, sample content) with the owner.
- Replace demo auth with a seeded password/magic-link flow if the product moves beyond the hackathon.
- Revisit if Supabase Auth pricing or provider limits change.