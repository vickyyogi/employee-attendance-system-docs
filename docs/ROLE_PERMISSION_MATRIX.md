# Role and Permission Matrix

## Roles
- **Platform Super Admin**: platform-level tenant lifecycle and platform configuration. Not automatically allowed to browse tenant attendance/selfies.
- **Company Admin**: tenant configuration and user/membership administration.
- **HR Admin**: employee, attendance, approval, and reporting operations.
- **Supervisor**: team visibility only where explicitly permitted; not an approver by default.
- **Employee**: self-service attendance and requests.
- **Auditor**: read-only access to approved tenant reports/audit data.

## Legend
- `Y`: allowed by default.
- `Own`: own records only.
- `Team`: assigned team only and only if team scope is implemented.
- `Limited`: permission-gated, audited, and tenant-scoped.
- `—`: denied by default.

| Capability | Platform Super Admin | Company Admin | HR Admin | Supervisor | Employee | Auditor |
|---|---:|---:|---:|---:|---:|---:|
| Manage companies/tenant status | Y | — | — | — | — | — |
| Read tenant attendance content | Limited | Limited | Y | Team | Own | Limited |
| Manage tenant membership/roles | Limited | Y | Limited | — | — | — |
| Manage employees | — | Y | Y | — | Own profile limited | — |
| Manage departments/positions | — | Y | Y | — | — | — |
| Manage work locations/geofence | — | Y | Y | — | — | — |
| Manage shifts/holiday calendar | — | Y | Y | — | — | — |
| Check in/check out | — | Own if employee | Own if employee | Own if employee | Own | — |
| Submit leave request | — | Own if employee | Own if employee | Own if employee | Own | — |
| Approve leave request | — | Limited | Y | — | — | — |
| Submit attendance correction | — | Own if employee | Own if employee | Own if employee | Own | — |
| Approve attendance correction | — | Limited | Y | — | — | — |
| Read attendance reports | Limited | Y | Y | Team/limited | Own summary | Limited |
| Export reports | — | Y | Y | — by default | — | Limited |
| Read audit logs | Platform events only | Limited | Limited | — | — | Limited |
| Change company settings | — | Y | Limited | — | — | — |

## Permission keys
Implement explicit permission keys; roles map to permissions. Suggested keys:
- `company.read`, `company.update`
- `membership.read`, `membership.create`, `membership.update`, `membership.disable`
- `employee.read`, `employee.create`, `employee.update`, `employee.manage_status`
- `department.read`, `department.create`, `department.update`
- `position.read`, `position.create`, `position.update`
- `location.read`, `location.create`, `location.update`
- `shift.read`, `shift.create`, `shift.update`, `shift.assign`
- `holiday.read`, `holiday.create`, `holiday.update`
- `attendance.read_own`, `attendance.read_all`, `attendance.check_in`, `attendance.check_out`, `attendance.flag`
- `leave.read_own`, `leave.create`, `leave.cancel_own`, `leave.read_all`, `leave.approve`
- `attendance_correction.create_own`, `attendance_correction.read_all`, `attendance_correction.approve`
- `approval.read_pending`
- `report.attendance.read`, `report.attendance.export`
- `audit.read`
- `settings.read`, `settings.update`

## Mandatory authorization rules
1. Role alone is not enough: enforce active tenant membership and resource ownership.
2. Employee self-service endpoints derive employee identity from authenticated membership, not body input.
3. HR/admin approval requires explicit permission and same tenant.
4. Requester cannot approve their own request.
5. Platform-level privileges do not automatically grant access to selfie or detailed attendance content.
6. Supervisor team scope must not be implemented until team relationship and rules are explicit.
7. Deny by default; record privileged changes in audit logs.
