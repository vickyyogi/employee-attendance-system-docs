# API Specification

## General
- Base path: `/api/v1`
- Transport: HTTPS in production.
- Content type: `application/json`, except upload endpoints.
- Authentication: bearer access token or secure cookie-based session; choose and document one strategy before implementation.
- Tenant context: selected company must match an active membership. Prefer explicit `X-Company-Id` or company-scoped URL only as a selector, never as proof of authorization.
- Timestamps: ISO 8601 UTC from server.
- Pagination: cursor or page-based pagination with bounded page size.
- All request bodies validated server-side.

## Standard success envelope
```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

## Standard error envelope
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [],
    "requestId": "uuid"
  }
}
```
Do not leak stack traces, SQL, secret values, or cross-tenant resource existence.

## Authentication and tenant
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/auth/login` | Login | Public + rate limit |
| POST | `/auth/refresh` | Refresh session/token, if selected | Valid refresh credential |
| POST | `/auth/logout` | Logout/revoke session | Authenticated |
| GET | `/auth/me` | Current identity and memberships | Authenticated |
| POST | `/auth/active-company` | Select active tenant | Active membership |
| GET | `/companies` | List user's accessible companies | Authenticated |
| GET | `/companies/:companyId` | Company detail | `company.read` |

## Employees and organization
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/employees` | List/filter employees | `employee.read` |
| POST | `/employees` | Create employee | `employee.create` |
| GET | `/employees/:id` | Employee detail | `employee.read` or own profile |
| PATCH | `/employees/:id` | Update employee | `employee.update` |
| PATCH | `/employees/:id/status` | Activate/deactivate | `employee.manage_status` |
| GET/POST | `/departments` | List/create departments | `department.read` / `department.create` |
| PATCH | `/departments/:id` | Update department | `department.update` |
| GET/POST | `/positions` | List/create positions | `position.read` / `position.create` |

## Work locations and shifts
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/work-locations` | List/create work locations | `location.read` / `location.create` |
| PATCH | `/work-locations/:id` | Update geofence | `location.update` |
| GET/POST | `/shifts` | List/create shifts | `shift.read` / `shift.create` |
| PATCH | `/shifts/:id` | Update shift | `shift.update` |
| GET/POST | `/employee-shifts` | List/assign shifts | `shift.read` / `shift.assign` |
| GET/POST | `/holidays` | List/create holidays | `holiday.read` / `holiday.create` |

## Attendance
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/attendance/today` | Current user's attendance today | Own attendance |
| POST | `/attendance/check-in` | Submit check-in evidence | Own attendance |
| POST | `/attendance/check-out` | Submit check-out evidence | Own attendance |
| GET | `/attendance/mine` | Own attendance history | Own attendance |
| GET | `/attendance` | Tenant attendance search | `attendance.read_all` |
| GET | `/attendance/:id` | Attendance detail | Own record or `attendance.read_all` |
| POST | `/attendance/:id/flag` | Flag for review, if enabled | `attendance.flag` |

### Check-in request example
```json
{
  "workLocationId": "uuid",
  "latitude": -7.9,
  "longitude": 112.6,
  "accuracyM": 12,
  "selfieUploadId": "uuid",
  "idempotencyKey": "client-generated-unique-value"
}
```
Server derives employee from authenticated identity and active tenant. It verifies membership, employee status, allowed work location, GPS accuracy policy, geofence distance, upload ownership/type/size, and whether a record already exists. Server assigns `check_in_at` and status. Do not accept a client-supplied timestamp or status.

## Selfie upload
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/attendance/selfie-uploads` | Create short-lived upload intent or upload session | Own attendance |
| POST | `/attendance/selfie-uploads/:id/complete` | Verify upload and finalize metadata | Upload owner |
| GET | `/attendance/:id/selfie/:kind` | Obtain short-lived signed read URL, if authorized | Own record or explicit HR permission |

The exact upload flow depends on the selected object storage provider. Never expose public permanent URLs. Verify actual file type, size, upload owner, tenant, and object key.

## Leave and correction requests
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/leave-requests` | List own requests / create request | Own request |
| GET | `/leave-requests/:id` | Request detail | Own request or HR permission |
| POST | `/leave-requests/:id/cancel` | Cancel pending request | Request owner |
| GET | `/approvals/pending` | List pending requests | `approval.read_pending` |
| POST | `/leave-requests/:id/decision` | Approve/reject | `leave.approve` |
| GET/POST | `/attendance-correction-requests` | List own / create correction | Own request |
| POST | `/attendance-correction-requests/:id/decision` | Approve/reject correction | `attendance_correction.approve` |

Decision body:
```json
{
  "decision": "APPROVED",
  "note": "Optional decision note"
}
```
Server checks permission, tenant, pending status, and self-approval prohibition; update request, apply approved correction, create approval action, and write audit/event inside a transaction.

## Reports and audit
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/reports/attendance-summary` | Attendance totals by period | `report.attendance.read` |
| GET | `/reports/late-arrivals` | Late arrivals | `report.attendance.read` |
| POST | `/reports/attendance-export` | Create export job/file | `report.attendance.export` |
| GET | `/audit-logs` | Search audit events | `audit.read` |

## HTTP status guidance
- `200`: successful read/update.
- `201`: resource created.
- `202`: asynchronous export/upload processing accepted.
- `400`: malformed request.
- `401`: unauthenticated.
- `403`: authenticated but not authorized.
- `404`: missing resource or resource intentionally hidden due to tenant isolation.
- `409`: conflict, duplicate check-in, or invalid state transition.
- `422`: semantically invalid input.
- `429`: rate limit.
- `500`: generic internal error with request ID only.

## API implementation rules
- Update OpenAPI contract and tests for every endpoint.
- Enforce object-level authorization, not just route-level roles.
- Avoid returning data for a different tenant even if the caller knows a UUID.
- Add idempotency for retry-prone write endpoints.
- Bound date ranges, page sizes, upload sizes, and export sizes.
