# Database Schema Specification

Dokumen ini adalah spesifikasi konseptual untuk diterjemahkan menjadi `schema.prisma`. Tipe/constraint final harus diperiksa terhadap versi Prisma yang dipilih.

## Conventions
- Primary key: UUID (`String @id @default(uuid()) @db.Uuid`) atau UUID native yang konsisten.
- Timestamps: `created_at`, `updated_at` menggunakan `timestamptz`.
- Tenant tables memiliki `company_id` dan index tenant-first.
- Gunakan enum untuk status yang stabil; jangan gunakan enum untuk nilai yang perlu dikonfigurasi tenant.
- Gunakan soft delete hanya bila ada kebutuhan audit yang jelas; status nonaktif lebih disukai untuk user/karyawan.
- Semua foreign key harus memiliki kebijakan on-delete yang ditentukan eksplisit.
- Gunakan unique constraints untuk invariant penting.

## Tables

### users
- `id` UUID PK
- `email` unique, normalized lowercase
- `password_hash` nullable jika kelak menggunakan SSO
- `full_name`
- `phone` nullable
- `status`: ACTIVE, INVITED, SUSPENDED
- `created_at`, `updated_at`, `last_login_at` nullable
- Tidak menyimpan password plaintext.

### companies
- `id` UUID PK
- `name`
- `slug` unique
- `timezone` IANA, misalnya `Asia/Jakarta`
- `status`: ACTIVE, SUSPENDED
- `created_at`, `updated_at`

### company_memberships
- `id` UUID PK
- `company_id` FK companies
- `user_id` FK users
- `role`: COMPANY_ADMIN, HR_ADMIN, SUPERVISOR, EMPLOYEE, AUDITOR
- `status`: ACTIVE, INVITED, DISABLED
- `created_at`, `updated_at`
- Unique `(company_id, user_id)`; index `(user_id, status)` dan `(company_id, status)`.

### platform_admins
- `id` UUID PK
- `user_id` unique FK users
- `status`
- Akses platform dipisahkan dari role tenant; semua tindakan platform diaudit.

### departments
- `id` UUID PK
- `company_id` FK
- `name`, `code` nullable, `status`
- Unique `(company_id, name)`; index `(company_id, status)`.

### positions
- `id` UUID PK
- `company_id` FK
- `name`, `status`
- Unique `(company_id, name)`.

### employees
- `id` UUID PK
- `company_id` FK
- `user_id` nullable FK users
- `employee_number`
- `full_name`
- `email` nullable
- `phone` nullable
- `department_id` nullable FK
- `position_id` nullable FK
- `manager_employee_id` nullable self-FK within same tenant
- `employment_status`: ACTIVE, INACTIVE, TERMINATED
- `hire_date` nullable, `termination_date` nullable
- `created_at`, `updated_at`
- Unique `(company_id, employee_number)`; unique `(company_id, user_id)` when user_id not null.
- Validate that department/position/manager all belong to the same company.

### work_locations
- `id` UUID PK
- `company_id` FK
- `name`, `address` nullable
- `latitude`, `longitude` decimal
- `geofence_radius_m` integer
- `max_gps_accuracy_m` integer
- `is_active`
- `created_at`, `updated_at`
- Validate latitude [-90,90], longitude [-180,180], radius > 0, accuracy > 0.
- Index `(company_id, is_active)`.

### shifts
- `id` UUID PK
- `company_id` FK
- `name`
- `start_time_local`, `end_time_local` as time
- `crosses_midnight` boolean
- `grace_period_minutes` integer
- `is_active`
- `created_at`, `updated_at`
- Rules for overnight shifts and DST/timezone are open until product policy is decided.

### employee_shifts
- `id` UUID PK
- `company_id` FK
- `employee_id` FK
- `shift_id` FK
- `effective_from`, `effective_to` nullable date
- `created_at`, `updated_at`
- Validate all referenced records share company_id.

### holidays
- `id` UUID PK
- `company_id` FK
- `date` date
- `name`
- `created_at`
- Unique `(company_id, date)`.

### attendance_records
- `id` UUID PK
- `company_id` FK
- `employee_id` FK
- `work_date` date in company timezone
- `shift_id` nullable FK
- `work_location_id` nullable FK
- `check_in_at`, `check_out_at` nullable timestamptz (server time)
- `check_in_latitude`, `check_in_longitude` nullable decimal
- `check_in_accuracy_m` nullable integer
- `check_in_distance_m` nullable integer
- `check_in_geofence_valid` nullable boolean
- `check_in_selfie_object_key` nullable string
- `check_out_latitude`, `check_out_longitude` nullable decimal
- `check_out_accuracy_m` nullable integer
- `check_out_distance_m` nullable integer
- `check_out_geofence_valid` nullable boolean
- `check_out_selfie_object_key` nullable string
- `status`: IN_PROGRESS, PRESENT, LATE, FLAGGED, CORRECTED
- `idempotency_key` nullable string
- `created_at`, `updated_at`
- Unique `(company_id, employee_id, work_date)` for MVP one-record-per-work-date.
- Add unique idempotency constraint scoped to company/user when implemented.
- Avoid storing location more precisely/longer than policy requires.
- Do not accept status from client.

### attendance_events
- `id` UUID PK
- `company_id` FK
- `attendance_record_id` FK
- `event_type`: CHECK_IN, CHECK_OUT, CORRECTION, FLAG
- `occurred_at` server timestamp
- `actor_user_id` nullable FK users
- `metadata` JSONB restricted to approved non-secret fields
- `created_at`
- Append-only by application policy; corrections add events rather than silently rewriting history.

### leave_types
- `id` UUID PK
- `company_id` FK
- `name`
- `unit`: DAYS, HOURS
- `requires_approval` boolean
- `is_active`
- Unique `(company_id, name)`.

### leave_requests
- `id` UUID PK
- `company_id` FK
- `employee_id` FK
- `leave_type_id` FK
- `start_date`, `end_date`
- `reason` (limit length)
- `status`: PENDING, APPROVED, REJECTED, CANCELLED
- `submitted_at`, `decided_at` nullable
- `decided_by_user_id` nullable FK users
- `decision_note` nullable
- `created_at`, `updated_at`
- Validate dates and same-tenant references; reject self-approval.

### attendance_correction_requests
- `id` UUID PK
- `company_id` FK
- `employee_id` FK
- `attendance_record_id` nullable FK
- `requested_check_in_at`, `requested_check_out_at` nullable timestamptz
- `reason`
- `status`: PENDING, APPROVED, REJECTED, CANCELLED
- `submitted_at`, `decided_at` nullable
- `decided_by_user_id` nullable FK users
- `decision_note` nullable
- `created_at`, `updated_at`
- Approval writes an audit/event and applies correction transactionally.

### approval_actions
- `id` UUID PK
- `company_id` FK
- `request_type`: LEAVE, ATTENDANCE_CORRECTION
- `request_id` UUID (application-level polymorphic reference; consider separate typed tables if strict FK integrity is required)
- `action`: APPROVED, REJECTED
- `actor_user_id` FK users
- `note` nullable
- `created_at`
- Index `(company_id, request_type, request_id)`.

### audit_logs
- `id` UUID PK
- `company_id` nullable for platform-level events
- `actor_user_id` nullable FK users
- `action`
- `entity_type`
- `entity_id` nullable UUID
- `request_id` nullable
- `ip_address` nullable; retention and access policy required
- `user_agent` nullable, truncated
- `metadata` JSONB allowlist only; never tokens, passwords, selfie bytes, or unrestricted sensitive payloads
- `created_at`
- Append-only application role; restrict direct modification.

## Constraints and indexes
- Add tenant-aware unique constraints for employee number, department name, position name, holiday date, membership, and attendance work date.
- Index attendance `(company_id, work_date)`, `(company_id, employee_id, work_date)`, and relevant status/date filters.
- Index pending requests `(company_id, status, submitted_at)`.
- Ensure references cannot cross tenants. Where possible, use composite unique keys `(company_id, id)` and composite foreign keys; otherwise enforce in service and test rigorously.
- Consider PostgreSQL Row-Level Security only as defense in depth after connection-pool/session-context behavior is designed and tested.
- Migration must be reviewed; do not run destructive migrations against production without explicit approval.
