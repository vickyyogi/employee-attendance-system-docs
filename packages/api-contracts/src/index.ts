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
export type AttendanceStatus = 'IN_PROGRESS' | 'PRESENT' | 'LATE' | 'FLAGGED' | 'CORRECTED';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AttendanceCorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
