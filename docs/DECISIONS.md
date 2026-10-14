# Architecture Decisions and Open Questions

## Accepted decisions
- Backend: Express.js + TypeScript.
- Database: PostgreSQL with Prisma.
- Web: React + Vite + TypeScript.
- Mobile: Flutter.
- Architecture: monorepo with modular-monolith API.
- API: REST/JSON under `/api/v1`.
- Attendance evidence: GPS, geofence validation, selfie metadata; selfie binary in private object storage.
- Tenant model: shared global user identity with per-company membership and company-scoped employee record.
- Approval: HR/admin with explicit permission approves leave and attendance correction requests.
- Authentication: short-lived Bearer access tokens (JWT, 15m) with rotating SHA-256 hashed refresh tokens stored in database, revoking on logout or token reuse (selected in Stage 4 for uniform React Web and Flutter Mobile support).
- AI Coding Agent: one stage per session, stop after active stage.

## Open decisions — resolve before related production stage
1. Object storage provider, region, upload limits, and lifecycle rules.
2. Geofence behavior when outside radius: reject vs record flagged attempt.
3. Maximum allowed GPS accuracy and location permission fallback.
4. Whether a selfie is required for both check-in and check-out.
5. Whether one attendance record per work date is sufficient or multiple sessions are required.
6. Shift crossing midnight, grace period, late calculation, breaks, overtime, holidays, and remote work.
7. Company timezone policy: one timezone per tenant or per location.
8. Attendance correction authority, evidence requirements, and edit history.
9. Leave balance/accrual policy and whether leave types require approval.
10. Retention period for selfie, GPS, attendance, and audit data.
11. Notifications (email/push) and provider.
12. Report/export formats and maximum date range.
13. Whether supervisors need team-scoped visibility and how teams are defined.
14. Production deployment target, backup objectives, monitoring, and restore process.
15. Applicable employment/privacy obligations and the organization's notices/consents.

## Decision process
- Do not silently decide an open question if it changes attendance results, employee rights, privacy, or tenant security.
- Record the chosen value, rationale, date, and affected docs here.
- Update API, schema, tests, and workflow documents together when a decision changes.
