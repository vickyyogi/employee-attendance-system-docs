/**
 * Standard API metadata envelope
 */
export interface ApiMeta {
  requestId: string;
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * Standard API success response envelope
 */
export interface ApiResponse<T = unknown> {
  data: T;
  meta?: ApiMeta;
}

/**
 * Standard API validation / detail error item
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/**
 * Standard API error payload
 */
export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  requestId?: string;
}

/**
 * Standard API error response envelope
 */
export interface ApiErrorResponse {
  error: ApiError;
}

/**
 * Health check response data
 */
export interface HealthCheckData {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
}

/**
 * Core domain enums defined in specification
 */
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';
export type CompanyStatus = 'ACTIVE' | 'SUSPENDED';
export type MembershipRole = 'COMPANY_ADMIN' | 'HR_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE' | 'AUDITOR';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';
export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';
export type PositionStatus = 'ACTIVE' | 'INACTIVE';
export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type AttendanceStatus = 'IN_PROGRESS' | 'PRESENT' | 'LATE' | 'FLAGGED' | 'CORRECTED';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AttendanceCorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type SelfieUploadStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'ATTACHED' | 'EXPIRED';

/**
 * Standard Permission Keys defined in ROLE_PERMISSION_MATRIX.md
 */
export type PermissionKey =
  | 'company.read'
  | 'company.update'
  | 'membership.read'
  | 'membership.create'
  | 'membership.update'
  | 'membership.disable'
  | 'employee.read'
  | 'employee.create'
  | 'employee.update'
  | 'employee.manage_status'
  | 'department.read'
  | 'department.create'
  | 'department.update'
  | 'position.read'
  | 'position.create'
  | 'position.update'
  | 'location.read'
  | 'location.create'
  | 'location.update'
  | 'shift.read'
  | 'shift.create'
  | 'shift.update'
  | 'shift.assign'
  | 'holiday.read'
  | 'holiday.create'
  | 'holiday.update'
  | 'attendance.read_own'
  | 'attendance.read_all'
  | 'attendance.check_in'
  | 'attendance.check_out'
  | 'attendance.flag'
  | 'leave.read_own'
  | 'leave.create'
  | 'leave.cancel_own'
  | 'leave.read_all'
  | 'leave.approve'
  | 'attendance_correction.create_own'
  | 'attendance_correction.read_all'
  | 'attendance_correction.approve'
  | 'approval.read_pending'
  | 'report.attendance.read'
  | 'report.attendance.export'
  | 'audit.read'
  | 'settings.read'
  | 'settings.update';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status: UserStatus;
}

export interface UserCompanyMembership {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  role: MembershipRole;
  status: MembershipStatus;
}

export interface AuthMeResponseData {
  user: AuthenticatedUser;
  memberships: UserCompanyMembership[];
  activeCompany?: {
    id: string;
    name: string;
    slug: string;
    role: MembershipRole;
    permissions: PermissionKey[];
  } | null;
}

/**
 * Department types
 */
export interface DepartmentDto {
  id: string;
  companyId: string;
  name: string;
  code?: string | null;
  status: DepartmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentRequest {
  name: string;
  code?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  code?: string | null;
  status?: DepartmentStatus;
}

/**
 * Position types
 */
export interface PositionDto {
  id: string;
  companyId: string;
  name: string;
  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePositionRequest {
  name: string;
}

export interface UpdatePositionRequest {
  name?: string;
  status?: PositionStatus;
}

/**
 * Employee types
 */
export interface EmployeeDto {
  id: string;
  companyId: string;
  userId?: string | null;
  employeeNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  positionId?: string | null;
  position?: {
    id: string;
    name: string;
  } | null;
  managerEmployeeId?: string | null;
  manager?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  employmentStatus: EmploymentStatus;
  hireDate?: string | null;
  terminationDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeRequest {
  employeeNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  managerEmployeeId?: string;
  userId?: string;
  hireDate?: string;
}

export interface UpdateEmployeeRequest {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerEmployeeId?: string | null;
  hireDate?: string | null;
}

export interface UpdateEmployeeStatusRequest {
  status: EmploymentStatus;
  terminationDate?: string | null;
}

export interface EmployeeListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: EmploymentStatus;
}

/**
 * Work Location types
 */
export interface WorkLocationDto {
  id: string;
  companyId: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  geofenceRadiusM: number;
  maxGpsAccuracyM: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkLocationRequest {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  geofenceRadiusM?: number;
  maxGpsAccuracyM?: number;
  isActive?: boolean;
}

export interface UpdateWorkLocationRequest {
  name?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  geofenceRadiusM?: number;
  maxGpsAccuracyM?: number;
  isActive?: boolean;
}

/**
 * Shift types
 */
export interface ShiftDto {
  id: string;
  companyId: string;
  name: string;
  startTimeLocal: string;
  endTimeLocal: string;
  crossesMidnight: boolean;
  gracePeriodMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftRequest {
  name: string;
  startTimeLocal: string;
  endTimeLocal: string;
  crossesMidnight?: boolean;
  gracePeriodMinutes?: number;
  isActive?: boolean;
}

export interface UpdateShiftRequest {
  name?: string;
  startTimeLocal?: string;
  endTimeLocal?: string;
  crossesMidnight?: boolean;
  gracePeriodMinutes?: number;
  isActive?: boolean;
}

/**
 * Employee Shift Assignment types
 */
export interface EmployeeShiftDto {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  shiftId: string;
  shift?: {
    id: string;
    name: string;
    startTimeLocal: string;
    endTimeLocal: string;
    crossesMidnight: boolean;
    gracePeriodMinutes: number;
  } | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeShiftRequest {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

/**
 * Holiday types
 */
export interface HolidayDto {
  id: string;
  companyId: string;
  date: string;
  name: string;
  createdAt: string;
}

export interface CreateHolidayRequest {
  date: string;
  name: string;
}

export interface UpdateHolidayRequest {
  date?: string;
  name?: string;
}

/**
 * Selfie Upload types (Stage 7)
 */
export interface SelfieUploadDto {
  id: string;
  companyId: string;
  userId: string;
  employeeId?: string | null;
  objectKey: string;
  originalName?: string | null;
  mimeType: string;
  fileSizeBytes?: number | null;
  fileHashSha256?: string | null;
  status: SelfieUploadStatus;
  uploadUrlExpiresAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSelfieUploadIntentRequest {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  originalName?: string;
  fileSizeBytes?: number;
}

export interface CreateSelfieUploadIntentResponse {
  uploadId: string;
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  maxFileSizeBytes: number;
  requiredHeaders?: Record<string, string>;
}

export interface CompleteSelfieUploadResponse {
  upload: SelfieUploadDto;
  verified: boolean;
}

export interface SignedReadUrlResponse {
  readUrl: string;
  expiresInSeconds: number;
  objectKey: string;
}

/**
 * Attendance engine types (Stage 8)
 */
export type AttendanceEventType = 'CHECK_IN' | 'CHECK_OUT' | 'CORRECTION' | 'FLAG';

export interface AttendanceRecordDto {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  workDate: string;
  shiftId?: string | null;
  shift?: {
    id: string;
    name: string;
    startTimeLocal: string;
    endTimeLocal: string;
  } | null;
  workLocationId?: string | null;
  workLocation?: {
    id: string;
    name: string;
  } | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkInAccuracyM?: number | null;
  checkInDistanceM?: number | null;
  checkInGeofenceValid?: boolean | null;
  checkInSelfieObjectKey?: string | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutAccuracyM?: number | null;
  checkOutDistanceM?: number | null;
  checkOutGeofenceValid?: boolean | null;
  checkOutSelfieObjectKey?: string | null;
  status: AttendanceStatus;
  idempotencyKey?: string | null;
  flagReason?: string | null;
  events?: AttendanceEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceEventDto {
  id: string;
  companyId: string;
  attendanceRecordId: string;
  eventType: AttendanceEventType;
  occurredAt: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CheckInRequest {
  workLocationId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  selfieUploadId: string;
  idempotencyKey: string;
}

export interface CheckOutRequest {
  latitude: number;
  longitude: number;
  accuracyM: number;
  selfieUploadId?: string;
  workLocationId?: string;
  idempotencyKey: string;
}

export interface FlagAttendanceRequest {
  reason: string;
}

export interface ListAttendanceQuery {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
  workLocationId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Leave & Attendance Correction workflows (Stage 10)
 */
export type LeaveUnit = 'DAYS' | 'HOURS';
export type ApprovalRequestType = 'LEAVE' | 'ATTENDANCE_CORRECTION';
export type ApprovalActionType = 'APPROVED' | 'REJECTED';

export interface LeaveTypeDto {
  id: string;
  companyId: string;
  name: string;
  unit: LeaveUnit;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveTypeRequest {
  name: string;
  unit?: LeaveUnit;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface UpdateLeaveTypeRequest {
  name?: string;
  unit?: LeaveUnit;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface LeaveRequestDto {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  leaveTypeId: string;
  leaveType?: {
    id: string;
    name: string;
    unit: LeaveUnit;
  } | null;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: string;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  decidedByUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  decisionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveRequest {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface AttendanceCorrectionRequestDto {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  attendanceRecordId?: string | null;
  attendanceRecord?: {
    id: string;
    workDate: string;
    checkInAt?: string | null;
    checkOutAt?: string | null;
    status: AttendanceStatus;
  } | null;
  requestedCheckInAt?: string | null;
  requestedCheckOutAt?: string | null;
  reason: string;
  status: AttendanceCorrectionStatus;
  submittedAt: string;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  decidedByUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  decisionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttendanceCorrectionRequest {
  attendanceRecordId?: string;
  requestedCheckInAt?: string;
  requestedCheckOutAt?: string;
  reason: string;
}

export interface ApprovalDecisionRequest {
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
}

export interface ApprovalActionDto {
  id: string;
  companyId: string;
  requestType: ApprovalRequestType;
  requestId: string;
  action: ApprovalActionType;
  actorUserId: string;
  actorUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  note?: string | null;
  createdAt: string;
}

export interface PendingApprovalsResponse {
  leaveRequests: LeaveRequestDto[];
  attendanceCorrections: AttendanceCorrectionRequestDto[];
  total: number;
}

/**
 * Reports and Audit types
 */
export interface DailyBreakdownItem {
  date: string;
  total: number;
  present: number;
  late: number;
  inProgress: number;
  corrected: number;
  flagged: number;
}

export interface AttendanceSummaryReportDto {
  period: {
    startDate: string;
    endDate: string;
  };
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  inProgressCount: number;
  correctedCount: number;
  flaggedCount: number;
  dailyBreakdown: DailyBreakdownItem[];
}

export interface LateArrivalItemDto {
  attendanceId: string;
  workDate: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName?: string | null;
  shiftName?: string | null;
  shiftStartTime?: string | null;
  checkInAt: string;
  lateMinutes: number;
}

export interface LateArrivalReportDto {
  period: {
    startDate: string;
    endDate: string;
  };
  totalLate: number;
  items: LateArrivalItemDto[];
}

export interface AttendanceExportRequest {
  startDate: string;
  endDate: string;
  format: 'csv' | 'json';
  departmentId?: string;
}

export interface AttendanceExportResponse {
  format: 'csv' | 'json';
  filename: string;
  recordCount: number;
  data: string;
}

export interface AuditLogDto {
  id: string;
  companyId?: string | null;
  actorUserId?: string | null;
  actorUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListQuery {
  action?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}




