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
- Shift, Overnight, Grace Period & Holidays (Resolved in Stage 6):
  - Overnight shifts (`crosses_midnight = true` or `endTimeLocal < startTimeLocal`) bind the attendance record's `work_date` to the calendar day on which the shift commences in the tenant's configured IANA timezone (`company.timezone`). Check-out timestamps occurring on the next calendar day within the allowable window remain attached to this same `work_date`.
  - Grace Period: Defined per shift in `grace_period_minutes` (non-negative integer, default 15m). Check-in occurring at or before `startTimeLocal + gracePeriodMinutes` is considered on-time (`PRESENT`), while check-in occurring after this grace window is classified as `LATE`.
  - Schedule Assignment: Stored in `employee_shifts` with `effective_from` and optional `effective_to`. Both employee and shift references must belong to the active company tenant.
  - Holidays: Configured per tenant in `holidays` with unique `(company_id, date)`. Attendance on holidays is permitted and flagged accordingly.
- Private Selfie Storage Foundation & Lifecycle (Resolved in Stage 7):
  - Storage Provider Strategy: Abstract `StorageService` interface allowing production S3-compatible cloud storage (AWS S3, MinIO, Cloudflare R2) and signed HMAC local disk storage for development and automated test environments. Direct public access is strictly prohibited; all read and write operations require short-lived cryptographic signatures.
  - Object Key Structure: Deterministic, server-generated path `tenants/{companyId}/selfies/{YYYY}/{MM}/{uploadId}.{ext}`. Path traversal patterns (`..`, `//`, etc.) are stripped and rejected.
  - Upload Constraints: Permitted MIME types are strictly limited to `image/jpeg`, `image/png`, and `image/webp`. File size is bounded to a maximum of 5MB (`5,242,880` bytes).
  - Upload Intent & Expiry: Pre-signed upload intents expire after 15 minutes (`900` seconds). If verification is not completed within this window, the intent status transitions to `EXPIRED`.
  - Completion & Tamper Verification: Upload completion checks the physical existence of the file, confirms byte size <= 5MB, verifies actual binary file signature (magic bytes: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`), and computes a SHA-256 hash stored on the upload record. Fake or disguised non-image files are rejected with 422 Unprocessable Entity.
  - Read Access & Auditing: Pre-signed read URLs expire after 5 minutes (`300` seconds). Regular employees may only obtain signed URLs for their own selfie uploads. Privileged views by `HR_ADMIN` and `COMPANY_ADMIN` are permitted strictly within the same tenant and generate immutable audit logs (`SELFIE_READ_ACCESSED`). Cross-tenant requests return 404 Not Found.
  - Lifecycle & Cleanup: Automated cleanup routine cleans unattached or uncompleted uploads older than 24 hours.
- Attendance Engine, Geofence, GPS, Selfie & Lifecycle Policy (Resolved in Stage 8):
  - Model: One attendance record per employee per calendar work date (`unique(company_id, employee_id, work_date)`).
  - Server Authoritative Timestamps & Timezones: Check-in/out timestamps and calendar work date are derived strictly on the server using the tenant's IANA timezone (`company.timezone`). Client-provided timestamps are rejected/ignored.
  - GPS Accuracy Policy: The server checks reported device accuracy against `workLocation.maxGpsAccuracyM` (default 50m). Readings with accuracy > threshold are rejected with 422 Unprocessable Entity ("GPS accuracy exceeds allowable threshold").
  - Geofence Policy (Haversine): The server calculates Haversine distance between employee coordinates and the designated `WorkLocation`. Attempts where distance exceeds `workLocation.geofenceRadiusM` are rejected with 422 Unprocessable Entity ("Outside geofence radius").
  - Selfie Evidence: Mandatory on check-in. The provided `selfieUploadId` must be `COMPLETED` and owned by the authenticated employee in the same tenant. The upload transitions to `ATTACHED` and its key is saved in `check_in_selfie_object_key`. Check-out supports optional selfie upload.
  - Lateness Evaluation: Check-in occurring after `shift.startTimeLocal + shift.gracePeriodMinutes` is classified as `LATE`. On-time check-in is `IN_PROGRESS` and transitions to `PRESENT` upon check-out.
  - Idempotency & Conflict Handling: Check-in and check-out require an `idempotencyKey`. Re-sent requests with the same key safely replay the existing record without creating duplicate events. A duplicate check-in with a different key returns 409 Conflict. Checking out without an open check-in or after already checking out returns 409 Conflict.
  - Immutable Event Log: Every state transition (`CHECK_IN`, `CHECK_OUT`, `FLAG`) appends an immutable `AttendanceEvent` record inside a single database transaction.
- AI Coding Agent: one stage per session, stop after active stage.

## Open decisions — resolve before related production stage
1. Breaks, overtime, and remote work policies.
2. Company timezone policy: one timezone per tenant or per location.
3. Attendance correction authority, evidence requirements, and edit history.
4. Leave balance/accrual policy and whether leave types require approval.
5. Retention period for selfie, GPS, attendance, and audit data.
6. Notifications (email/push) and provider.
7. Report/export formats and maximum date range.
8. Whether supervisors need team-scoped visibility and how teams are defined.
9. Production deployment target, backup objectives, monitoring, and restore process.
10. Applicable employment/privacy obligations and the organization's notices/consents.

## Decision process
- Do not silently decide an open question if it changes attendance results, employee rights, privacy, or tenant security.
- Record the chosen value, rationale, date, and affected docs here.
- Update API, schema, tests, and workflow documents together when a decision changes.
