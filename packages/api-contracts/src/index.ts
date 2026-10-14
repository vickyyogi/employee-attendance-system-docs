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

