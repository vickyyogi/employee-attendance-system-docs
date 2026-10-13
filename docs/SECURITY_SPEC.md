# Security and Privacy Specification

## Threat model priorities
- Cross-tenant data leakage.
- Unauthorized attendance edits or approvals.
- Stolen session/token.
- Malicious or oversized selfie upload.
- Spoofed/replayed attendance requests.
- Exposure of GPS, selfie, employee personal data, or audit data.
- Abuse of export/report endpoints.

## Authentication
- Select one documented strategy before implementation: short-lived bearer access token with rotating refresh tokens, or secure server-managed session cookies.
- Store mobile credentials in OS-protected secure storage, not plain preferences.
- For browser sessions/cookies, configure `HttpOnly`, `Secure`, and appropriate `SameSite`; address CSRF if cookie-authenticated.
- Hash passwords using a modern password hashing algorithm such as Argon2id or bcrypt with appropriate cost.
- Rate-limit login, password reset, token refresh, and sensitive endpoints.
- Revoke sessions on logout, account suspension, and credential compromise where supported.
- Do not log credentials, authorization headers, refresh tokens, or reset tokens.

## Multi-tenant isolation
- Validate active membership on every request.
- Enforce tenant scoping in services/repositories for every tenant-owned query.
- Never rely on a client-provided company ID as authorization.
- Check tenant ownership of every referenced resource, including employee, shift, location, attendance, upload, leave request, and correction request.
- Return a non-revealing 404 where appropriate for cross-tenant resources.
- Use tenant-first indexes and tenant-aware constraints.
- Add integration tests that attempt cross-tenant reads/writes using known foreign UUIDs.
- Consider PostgreSQL Row-Level Security as defense in depth only after transaction/session context and connection pooling are designed correctly.

## Authorization
- Deny by default.
- Check permission and object scope, not only route-level role.
- Employee endpoints derive employee identity from auth context.
- HR approval checks permission, tenant, request state, and self-approval prohibition.
- Platform admin powers are separate from tenant content permissions.
- Log role/membership and sensitive configuration changes.

## GPS and geofence
- Validate numeric ranges and GPS accuracy.
- Compute distance server-side.
- Use server timestamp for authoritative attendance time.
- Add idempotency/replay protection for write requests.
- Treat device GPS as an input signal, not a guaranteed truth. Define escalation/manual review for suspicious attempts.
- Request location permission only when needed and explain purpose to users.

## Selfie/file security
- Private object storage only.
- Signed upload/read URLs with short expiry and limited object scope.
- Enforce upload size, accepted image formats, actual file signature, and ownership/tenant checks.
- Consider image re-encoding and malware scanning where appropriate.
- Prevent path traversal and arbitrary object-key access.
- Avoid storing image binary in PostgreSQL.
- Restrict viewing and exporting selfies; audit access when appropriate.
- Define retention, deletion, legal basis, notice, and user-access procedures before production.

## API and infrastructure
- TLS/HTTPS in production.
- Secure CORS allowlist; do not use wildcard origins with credentials.
- Validate all input and bound payloads, pagination, dates, and exports.
- Use parameterized ORM queries; avoid raw SQL unless parameterized and reviewed.
- Set security headers, request IDs, and structured redacted logs.
- Keep PostgreSQL private and use least-privilege database roles.
- Keep secrets in secret manager/environment, never commit `.env`.
- Separate development, staging, and production credentials.
- Run dependency and container vulnerability scans.
- Backups must be encrypted and restore-tested.
- Define incident response and credential rotation procedures.

## Audit
Audit at least: login/security events where appropriate, tenant membership/role changes, employee changes, geofence/shift/policy changes, attendance corrections, approvals/rejections, exports, and privileged selfie access.
Audit metadata must be allowlisted and must not include passwords, tokens, raw selfie data, or unrestricted request bodies.

## Privacy and compliance
Before production, organization must define purpose, lawful basis/notice/consent where applicable, retention/deletion periods, access rights, data subject request handling, and applicable Indonesian employment/privacy obligations with qualified counsel. Do not infer legal compliance merely because these technical controls exist.
