# Testing Strategy

## Layers
1. Unit tests: services, validators, geofence distance calculation, status derivation, policy rules.
2. API integration tests: Express routes, auth, tenant context, Prisma/database interactions.
3. Database tests: constraints, migrations, unique keys, tenant reference integrity.
4. Web tests: components, forms, permission-aware navigation, error/loading states.
5. Flutter tests: widgets, state management, API error handling, permission denial flows.
6. End-to-end tests: login, tenant selection, check-in/out, leave request, HR decision, reports.
7. Security tests: cross-tenant access, IDOR, role escalation, upload abuse, replay/duplicate requests.
8. Operational tests: backup restore, migration on staging, log redaction, rate limiting.

## Required backend tests
- Unauthenticated request cannot access protected endpoint.
- User without active membership cannot select/access tenant.
- Company A user cannot read/update/delete Company B resources by ID.
- Cross-tenant department/shift/location references are rejected.
- Employee cannot submit attendance for another employee.
- Client-supplied timestamp/status/employee ID cannot override server truth.
- Duplicate check-in/out is deterministic and idempotent/conflict-safe.
- Invalid GPS coordinates and poor accuracy follow policy.
- Geofence boundary and outside-radius cases are tested.
- Upload from another tenant/user is rejected.
- Selfie read URL requires correct permission and expires.
- Employee cannot approve own request.
- Non-HR user cannot approve leave/correction.
- Only pending request can be decided.
- Approved correction creates traceable event/audit record.
- Export is tenant-scoped and permission-gated.
- Logs redact tokens and sensitive payloads.

## Required web tests
- Company switcher shows only memberships available to user.
- Unauthorized controls/routes are hidden for usability, while backend remains authoritative.
- Validation, API error, loading, empty, and success states work.
- HR approval queue filters tenant and request status.
- Report filters and export permissions are enforced.

## Required Flutter tests
- Camera/location denied, unavailable, and low-accuracy scenarios.
- Upload failure and retry behavior.
- Duplicate submission prevention.
- Token/session expiry behavior.
- Check-in/out success and server conflict responses.
- Company switching clears or refreshes tenant-scoped client state.
- Sensitive credentials use secure storage.

## Definition of Done for a feature
- Acceptance criteria satisfied.
- Unit/integration tests added.
- Lint and typecheck pass.
- API contract/docs updated.
- No secret or sensitive test fixture committed.
- Manual test steps documented where automation is not practical.
- Tenant isolation and permission behavior reviewed.
