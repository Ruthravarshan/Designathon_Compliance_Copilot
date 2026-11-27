## Summary

Describe the change, why it is needed, and link the related ADR or discovery artifact.

## Engineering & Security Checklist

- [ ] Inputs validated with Zod at every boundary (body, query, params, external payloads)
- [ ] Server-side RBAC enforced (`assertCan` / `requireMembership`); no client-trusted `workspaceId` or role
- [ ] Every tenant-owned query filters by session-resolved `workspaceId`
- [ ] Mutations changing access, status, or ownership emit an `AuditLog` row with `requestId`
- [ ] No secrets, tokens, or PII in code, logs, or client bundles
- [ ] UI views cover loading, empty, error, and unauthorized states with Hexaware brand tokens
- [ ] `npm run check` and `npm run test:coverage` (>= 95%) pass locally

## Infrastructure Impact (if touching `infra/` or `Dockerfile`)

- [ ] Reference-only IaC updates remain free of hardcoded secrets
- [ ] Multi-cloud parity verified across Azure (Bicep/Terraform), AWS, GCP, and Kubernetes where applicable
