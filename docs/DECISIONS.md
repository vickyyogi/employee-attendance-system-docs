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
- Flutter Mobile Attendance Experience (Resolved in Stage 9):
  - Architecture: Layered structure under `apps/mobile/lib` (`core` for network/storage/location/camera, and `features` for `auth`, `company_selection`, `attendance`, `history`, `home`).
  - Secure Credentials & Token Lifecycle: Tokens are persisted securely via `FlutterSecureStorage` (`EncryptedSharedPreferences` on Android, `Keychain` on iOS). The `ApiClient` auto-refreshes expired access tokens on 401 via `/api/v1/auth/refresh` and wipes credentials on persistent failure.
  - Tenant Context & State Scoping: Selected company is persisted and passed via `X-Company-Id`. Switching active company explicitly clears tenant-scoped records, history, and cached locations.
  - Device Policies & Pre-flight Validation:
    - GPS: Validates service availability, runtime location permissions, and bounds device accuracy against `maxGpsAccuracyM` before initiating upload.
    - Camera & Selfie: Validates image magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`) and confirms size <= 5MB. Transient network failures during pre-signed binary upload automatically retry up to 2 times.
  - Duplicate Submission Guard: In-flight execution locks block double-tap submissions, paired with client-generated RFC4122 v4 UUID `idempotencyKey` preserved across retries.
- Leave and Attendance Correction Workflows (Resolved in Stage 10):
  - Model & Lifecycle: Configurable `leave_types` (quota, approval requirement, DAYS/HOURS unit), `leave_requests` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `attendance_correction_requests` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), and `approval_actions`.
  - Invariants & Scoping: Active employment required, `startDate <= endDate`, strict tenant isolation across all queries and operations.
  - Self-Approval Prohibition: HR/Company Admin cannot approve or reject their own requests (`employee.userId === actorUserId` returns 403 Forbidden).
  - Transactional Side Effects: Approving an attendance correction atomically updates the underlying `AttendanceRecord` timestamps, transitions status to `CORRECTED`, and appends an immutable `AttendanceEvent` of type `CORRECTION` with before/after metadata.
  - Audit Trail: Immutable `approval_actions` entries log every decision with reviewer ID, action type, optional note, and timestamp.
- HR Web Dashboard, Approvals, Reports & Export Controls (Resolved in Stage 11):
  - Dashboard: Daily operational view with KPI summary metrics (Total, Present, Late, In Progress, Pending Approvals), status filters, record flagging, and verification details (GPS coordinates, distance, accuracy, timeline, secure signed selfie loading).
  - Approvals UI: Unified queue for pending leave and attendance correction requests with visual indicator and button disablement for self-approval prevention (`currentUserId === employee.userId`).
  - Reports & Analytics: Tenant-scoped period summary with daily status breakdown and late arrivals duration analysis.
  - Export Controls & Auditing: Formats supported are CSV and structured JSON, permission-gated under `report.attendance.export`, with automatic audit logging (`REPORT_EXPORTED`) on every export invocation.
- Hardening, Retention, Disaster Recovery & Indonesian UU PDP Compliance (Resolved in Stage 12):
  - Concurrency & Race Condition Guards: All state-changing workflow operations (`leave_requests.decide`, `attendance_correction_requests.decide`) enforce atomic conditional updates (`updateMany` with `status: PENDING`) inside PostgreSQL transactions, guaranteeing optimistic concurrency control and returning 409 Conflict on race conditions.
  - Logging & Error Redaction: Centralized audit logging deep-sanitizes all credentials, tokens, bearer headers, API keys, private keys, and base64 selfie payloads across arbitrary object depths. Error handling envelopes omit raw SQL queries, stack traces, and tenant identifiers.
  - Data Retention & Purge Lifecycle (Resolves Open Decision 5):
    - Unattached / unverified selfie upload intents: 24 hours (automated garbage collection).
    - Unattached uploaded files without attendance association: 30 days.
    - Attendance evidence selfies: 1 year in hot private object storage. After 1 year, binary files may be archived to cold storage or pruned, leaving cryptographic SHA-256 hash and metadata intact.
    - Attendance records, GPS coordinates & event logs: 3 years to comply with statutory Indonesian labor compliance (PP 35/2021 and UU Ketenagakerjaan).
    - Audit logs: 1 year hot queryable in PostgreSQL, archived to cold storage for 3 years.
  - Production Deployment & Disaster Recovery SLA (Resolves Open Decision 9):
    - Deployment target: Containerized Express API (Node.js LTS), React SPA static build behind Nginx with TLS 1.3, Flutter Mobile on Android/iOS, managed PostgreSQL with connection pooling.
    - Backup & DR Objectives: Daily automated compressed dumps (`-Fc`) with companion SHA-256 checksums (`scripts/db-backup-restore.ps1`). RPO <= 24 hours (RPO <= 15 minutes with WAL archiving enabled), RTO <= 2 hours. Monthly automated restore drill verification.
    - Health & Observability: `/api/v1/health` probes database connectivity, structured JSON logging with correlation `requestId`, alerts on 5xx spikes and connection saturation.
  - Indonesian Privacy & Employment Obligations (UU No. 27 Tahun 2022 / UU PDP) (Resolves Open Decision 10):
    - Facial selfies and GPS coordinates are classified as Specific Personal Data (*Data Pribadi Spesifik*) under Art. 4 UU PDP.
    - Lawful Basis: Explicit written/digital employee consent at onboarding combined with contractual necessity for employment execution (Art. 20 UU PDP) strictly limited to attendance validation and fraud prevention.
    - Prohibitions: No third-party data broker sharing; no unauthorized biometric profiling.
    - Data Subject Rights: Employee rights to access records, rectify inaccurate records via attendance corrections, and request data deletion post-employment (subject to statutory labor record retention).
    - Data breach notification SLA: Formal notice to Lembaga PDP and affected employees within 3 x 24 hours (Art. 46 UU PDP).
- AI Coding Agent: one stage per session, stop after active stage.

## Open decisions — resolve before related production stage
1. Breaks, overtime, and remote work policies.
2. Company timezone policy: one timezone per tenant or per location.
3. Attendance correction authority, evidence requirements, and edit history (Basic flow resolved in Stage 10; supporting attachment files/evidence can be added if needed).
4. Leave balance/accrual policy and whether leave types require approval (Approval lifecycle resolved in Stage 10; complex periodic accrual engine deferred to future extension).
5. Retention period for selfie, GPS, attendance, and audit data (Resolved in Stage 12).
6. Notifications (email/push) and provider.
7. Report/export formats and maximum date range (Resolved in Stage 11: CSV and JSON formats supported with bounded date range and mandatory audit logging).
8. Whether supervisors need team-scoped visibility and how teams are defined.
9. Production deployment target, backup objectives, monitoring, and restore process (Resolved in Stage 12).
10. Applicable employment/privacy obligations and the organization's notices/consents (Resolved in Stage 12).

## Decision process
- Do not silently decide an open question if it changes attendance results, employee rights, privacy, or tenant security.
- Record the chosen value, rationale, date, and affected docs here.
- Update API, schema, tests, and workflow documents together when a decision changes.
