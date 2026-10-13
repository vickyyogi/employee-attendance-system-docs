# Implementation Plan — One Stage Per Session

## Mandatory execution rule
The AI Coding Agent must implement **one stage only per session**. It must not start the next stage automatically. After the active stage is complete, produce the required session report and stop until the user gives a new instruction.

If no stage is explicitly requested, execute Stage 0 only. Stage 0 is an audit/planning stage and must not change application code or database schema.

## Stage 0 — Repository audit and implementation plan
**Goal:** Understand the current repository and identify gaps without changing app code.
- Inspect repository tree, Git branch/status, existing docs, package managers, and tool versions.
- Read all project documents in the order in `AGENTS.md`.
- Compare current state with the planned architecture.
- Identify conflicts, missing business rules, secrets accidentally present (report location only; never print secret values), and blockers.
- Create/update only planning notes if explicitly permitted; do not implement features, run migrations, reset databases, or overwrite user files.
**Acceptance:** A concise gap analysis, risks, unresolved decisions, and recommendation for Stage 1.
**Stop:** End session and wait.

## Stage 1 — Monorepo foundation
- Create root workspace scripts and configuration.
- Scaffold `apps/api`, `apps/web`, Flutter app metadata, shared config packages, docs, and Git ignore rules.
- Add `.env.example` without secrets.
- Add Docker Compose for local PostgreSQL only.
- Add health-check endpoint skeleton if within scope.
**Acceptance:** clean install and basic lint/typecheck/build commands documented; no business features.
**Stop:** End session and wait.

## Stage 2 — Backend foundation
- Configure Express, TypeScript strict mode, config validation, logging, request ID, centralized errors, security headers, CORS, and rate limiting.
- Add `/api/v1/health`.
- Add API test harness.
**Acceptance:** health endpoint and middleware tests pass.
**Stop:** End session and wait.

## Stage 3 — Prisma and tenancy schema
- Implement company, user, membership, platform admin, and core organization schema.
- Add migration and safe development seed.
- Add tenant context and membership validation primitives.
**Acceptance:** migrations work on a clean development database; tenant isolation tests pass.
**Stop:** End session and wait.

## Stage 4 — Authentication and authorization
- Implement selected session/token strategy.
- Implement membership/company selection.
- Implement permission middleware and audit for privileged changes.
**Acceptance:** auth lifecycle tests, tenant membership tests, and permission tests pass.
**Stop:** End session and wait.

## Stage 5 — Employee and organization management
- Implement employee, department, and position APIs.
- Implement corresponding web screens.
**Acceptance:** CRUD and validation work within tenant scope; tests pass.
**Stop:** End session and wait.

## Stage 6 — Work locations and shifts
- Implement geofence locations, shift definitions, employee shift assignments, and holidays.
- Resolve overnight shifts/grace period decisions before attendance implementation.
**Acceptance:** tenant-scoped CRUD, schedule assignment tests, and documented policy.
**Stop:** End session and wait.

## Stage 7 — Private selfie storage foundation
- Select object storage provider and configure private bucket/container.
- Implement short-lived upload intent, completion verification, signed reads, upload constraints, and cleanup policy.
**Acceptance:** unauthorized/cross-tenant upload and read tests fail safely; no public object access.
**Stop:** End session and wait.

## Stage 8 — Attendance engine
- Implement check-in/out, server timestamps, geofence validation, GPS accuracy policy, idempotency, events, and state transitions.
- Apply the agreed one-record or multi-session-per-work-date model.
**Acceptance:** workflow, duplicate, poor GPS, outside geofence, and tenant isolation tests pass.
**Stop:** End session and wait.

## Stage 9 — Flutter attendance experience
- Implement login, tenant selection, location/camera permissions, selfie upload, check-in/out, and history.
**Acceptance:** tests cover permission denial, network failures, retries, and success path.
**Stop:** End session and wait.

## Stage 10 — Leave and correction workflows
- Implement leave types/requests and attendance correction requests.
- Implement HR/admin approval with self-approval prevention, transactionality, audit trail.
**Acceptance:** request/decision state tests and permission tests pass.
**Stop:** End session and wait.

## Stage 11 — HR web dashboard and reports
- Implement attendance dashboard, filters, approval queue, employee/attendance details, and reports.
- Implement exports only with permission and audit.
**Acceptance:** tenant-scoped reports, export controls, and web tests pass.
**Stop:** End session and wait.

## Stage 12 — Hardening and production readiness
- Run security review, dependency scans, tenant-isolation tests, load smoke tests, migration review, backup/restore drill, logging redaction check, and deployment documentation.
- Resolve retention/privacy/legal operational requirements.
**Acceptance:** release checklist signed off; known risks documented.
**Stop:** End session and wait.

## Stage report template
- Stage:
- Summary:
- Files created/changed:
- Commands/tests run and results:
- Decisions made:
- Open questions/blockers:
- Security/privacy concerns:
- Suggested next stage (not executed):

## Never do these
- Do not implement more than one stage per session.
- Do not automatically proceed to the next stage.
- Do not perform destructive database operations without explicit approval.
- Do not invent unresolved attendance policy.
- Do not weaken security/tests to force a pass.
