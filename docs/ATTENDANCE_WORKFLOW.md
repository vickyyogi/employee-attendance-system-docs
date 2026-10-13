# Attendance Workflow

## Attendance states (initial proposal)
- `IN_PROGRESS`: check-in recorded, check-out not yet recorded.
- `PRESENT`: check-in and check-out complete and within attendance policy.
- `LATE`: final/derived state indicating late arrival; exact grace-period calculation must be confirmed.
- `FLAGGED`: record requires review due to anomaly/policy.
- `CORRECTED`: attendance changed through approved correction.

Keep event history so a correction does not silently erase original evidence. Final status derivation and whether `LATE` can coexist with `IN_PROGRESS` should be decided before implementation; an alternative is separate `status` and `late_minutes` fields.

## Check-in sequence
1. Client obtains OS permission for location and camera at the point of use.
2. Client captures GPS coordinates and reported accuracy, then captures selfie.
3. Client uploads selfie using a short-lived, tenant-bound upload flow.
4. Client sends work location, coordinates, accuracy, upload ID, and idempotency key.
5. Server authenticates user and validates active company membership.
6. Server resolves the employee from that membership; client cannot choose another employee.
7. Server validates active employment, assigned/allowed location, GPS accuracy threshold, geofence radius, and selfie upload ownership.
8. Server derives official timestamp and work date using company timezone and shift policy.
9. Server checks duplicate/idempotency state.
10. In one database transaction, server writes attendance record/event and audit event as appropriate.
11. API returns the saved record and validation outcome.

## Check-out sequence
Same tenant/identity/location/selfie validations as required by policy. Server verifies a valid open attendance record and assigns official server timestamp. Duplicate or out-of-order operations return a stable conflict response.

## Geofence
- Use a documented distance formula (e.g. Haversine) on the server.
- Compare server-calculated distance with `geofence_radius_m`.
- Reject or flag coordinates when reported accuracy exceeds the tenant policy threshold.
- Client-side geofence display is only a user aid, not authoritative.
- Handle permission denied, GPS unavailable, poor accuracy, location spoofing risk, and network failure.
- Policy must decide whether outside-geofence attempts are rejected or stored as flagged events.
- GPS coordinates are personal data; restrict access and retention.

## Selfie evidence
- Keep binary files in private object storage.
- Validate upload owner, tenant, size, MIME type, actual file signature, and object key.
- Do not use a public bucket or permanent public URL.
- Signed URLs must be short-lived and only issued after authorization.
- MVP stores a selfie as evidence only; it does not perform face recognition or claim liveness/identity certainty.
- Establish retention/deletion policy before production.

## Shift and date rules
Open decisions to resolve:
- Shift crossing midnight and the correct `work_date`.
- Grace period and late calculation.
- Multiple shifts or multiple sessions in one work date.
- Breaks, overtime, holidays, remote work, and exceptions.
- Timezone changes and daylight saving behavior if multiple regions are supported.

## Leave approval
1. Employee creates request with type, dates, reason.
2. Server checks date validity and employee/tenant scope.
3. Status becomes `PENDING`.
4. HR/admin with permission opens pending queue.
5. Approver approves or rejects with optional note.
6. Server prevents self-approval and verifies request is still pending.
7. Decision and audit action are recorded transactionally.
8. Employee can view decision; notifications can be added later.

## Attendance correction approval
1. Employee submits requested correction and mandatory reason.
2. Status becomes `PENDING`.
3. HR/admin checks original record and evidence.
4. Approve/reject only while pending; prevent self-approval.
5. On approval, apply change transactionally and append correction event/audit record.
6. Preserve traceability of original values and decision.
