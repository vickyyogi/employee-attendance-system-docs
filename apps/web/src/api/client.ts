import type {
  ApiResponse,
  ApiErrorResponse,
  EmployeeDto,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  UpdateEmployeeStatusRequest,
  EmployeeListQuery,
  DepartmentDto,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentStatus,
  PositionDto,
  CreatePositionRequest,
  UpdatePositionRequest,
  PositionStatus,
  AttendanceRecordDto,
  AttendanceStatus,
  LeaveRequestDto,
  AttendanceCorrectionRequestDto,
  PendingApprovalsResponse,
  ApprovalDecisionRequest,
  AttendanceSummaryReportDto,
  LateArrivalReportDto,
  AttendanceExportRequest,
  AttendanceExportResponse,
  AuditLogDto,
  AuditLogListQuery,
} from '@attendance/api-contracts';

export class ApiError extends Error {
  public code: string;
  public details?: Array<{ field?: string; message: string }>;

  constructor(message: string, code = 'API_ERROR', details?: Array<{ field?: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private companyId: string | null = null;

  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setCompanyId(companyId: string | null) {
    this.companyId = companyId;
  }

  getToken(): string | null {
    return this.token;
  }

  getCompanyId(): string | null {
    return this.companyId;
  }

  // Auth methods
  async login(email: string, password: string): Promise<ApiResponse<{
    user: { id: string; email: string; fullName: string; status: string };
    tokens: { accessToken: string; refreshToken: string; expiresIn: string };
  }>> {
    const res = await this.request<{
      user: { id: string; email: string; fullName: string; status: string };
      tokens: { accessToken: string; refreshToken: string; expiresIn: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.tokens?.accessToken) {
      this.setToken(res.data.tokens.accessToken);
    }
    return res;
  }

  async getMe(): Promise<ApiResponse<{
    user: { id: string; email: string; fullName: string; phone?: string | null; status: string };
    memberships: Array<{
      id: string;
      companyId: string;
      companyName: string;
      companySlug: string;
      role: string;
      status: string;
    }>;
    activeCompany?: {
      id: string;
      name: string;
      slug: string;
      role: string;
      permissions: string[];
    } | null;
  }>> {
    return this.request('/auth/me', { method: 'GET' });
  }

  async selectActiveCompany(companyId: string): Promise<ApiResponse<{
    activeCompany: {
      id: string;
      name: string;
      slug: string;
      role: string;
      permissions: string[];
    };
    accessToken: string;
  }>> {
    const res = await this.request<{
      activeCompany: {
        id: string;
        name: string;
        slug: string;
        role: string;
        permissions: string[];
      };
      accessToken: string;
    }>('/auth/active-company', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
    if (res.data?.accessToken) {
      this.setToken(res.data.accessToken);
    }
    if (res.data?.activeCompany?.id) {
      this.setCompanyId(res.data.activeCompany.id);
    }
    return res;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    if (this.companyId) {
      headers['X-Company-Id'] = this.companyId;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      const errRes = json as ApiErrorResponse;
      throw new ApiError(
        errRes.error?.message || `Request failed with status ${response.status}`,
        errRes.error?.code || 'HTTP_ERROR',
        errRes.error?.details
      );
    }

    return json as ApiResponse<T>;
  }

  // Departments
  async getDepartments(status?: DepartmentStatus): Promise<ApiResponse<DepartmentDto[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<DepartmentDto[]>(`/departments${query}`, { method: 'GET' });
  }

  async getDepartmentById(id: string): Promise<ApiResponse<DepartmentDto>> {
    return this.request<DepartmentDto>(`/departments/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  async createDepartment(data: CreateDepartmentRequest): Promise<ApiResponse<DepartmentDto>> {
    return this.request<DepartmentDto>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDepartment(id: string, data: UpdateDepartmentRequest): Promise<ApiResponse<DepartmentDto>> {
    return this.request<DepartmentDto>(`/departments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Positions
  async getPositions(status?: PositionStatus): Promise<ApiResponse<PositionDto[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<PositionDto[]>(`/positions${query}`, { method: 'GET' });
  }

  async getPositionById(id: string): Promise<ApiResponse<PositionDto>> {
    return this.request<PositionDto>(`/positions/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  async createPosition(data: CreatePositionRequest): Promise<ApiResponse<PositionDto>> {
    return this.request<PositionDto>('/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePosition(id: string, data: UpdatePositionRequest): Promise<ApiResponse<PositionDto>> {
    return this.request<PositionDto>(`/positions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Employees
  async getEmployees(params?: EmployeeListQuery): Promise<ApiResponse<EmployeeDto[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.departmentId) searchParams.set('departmentId', params.departmentId);
    if (params?.positionId) searchParams.set('positionId', params.positionId);
    if (params?.status) searchParams.set('status', params.status);

    const queryString = searchParams.toString();
    const endpoint = `/employees${queryString ? `?${queryString}` : ''}`;
    return this.request<EmployeeDto[]>(endpoint, { method: 'GET' });
  }

  async getEmployeeById(id: string): Promise<ApiResponse<EmployeeDto>> {
    return this.request<EmployeeDto>(`/employees/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  async createEmployee(data: CreateEmployeeRequest): Promise<ApiResponse<EmployeeDto>> {
    return this.request<EmployeeDto>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<ApiResponse<EmployeeDto>> {
    return this.request<EmployeeDto>(`/employees/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateEmployeeStatus(
    id: string,
    data: UpdateEmployeeStatusRequest
  ): Promise<ApiResponse<EmployeeDto>> {
    return this.request<EmployeeDto>(`/employees/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Attendance
  async getAttendance(params?: {
    employeeId?: string;
    workLocationId?: string;
    status?: AttendanceStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<AttendanceRecordDto[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.employeeId) searchParams.set('employeeId', params.employeeId);
    if (params?.workLocationId) searchParams.set('workLocationId', params.workLocationId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const queryString = searchParams.toString();
    return this.request<AttendanceRecordDto[]>(`/attendance${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
  }

  async getAttendanceById(id: string): Promise<ApiResponse<AttendanceRecordDto>> {
    return this.request<AttendanceRecordDto>(`/attendance/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }

  async flagAttendance(id: string, reason: string): Promise<ApiResponse<AttendanceRecordDto>> {
    return this.request<AttendanceRecordDto>(`/attendance/${encodeURIComponent(id)}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getAttendanceSelfieUrl(
    recordId: string,
    kind: 'check_in' | 'check_out'
  ): Promise<ApiResponse<{ url: string; expiresAt: string }>> {
    return this.request<{ url: string; expiresAt: string }>(
      `/attendance/${encodeURIComponent(recordId)}/selfie/${kind}`,
      { method: 'GET' }
    );
  }

  // Approvals
  async getPendingApprovals(
    page?: number,
    pageSize?: number
  ): Promise<ApiResponse<PendingApprovalsResponse>> {
    const searchParams = new URLSearchParams();
    if (page) searchParams.set('page', String(page));
    if (pageSize) searchParams.set('pageSize', String(pageSize));
    const query = searchParams.toString();
    return this.request<PendingApprovalsResponse>(
      `/approvals/pending${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async decideLeaveRequest(
    id: string,
    data: ApprovalDecisionRequest
  ): Promise<ApiResponse<LeaveRequestDto>> {
    return this.request<LeaveRequestDto>(
      `/leave-requests/${encodeURIComponent(id)}/decision`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async decideAttendanceCorrection(
    id: string,
    data: ApprovalDecisionRequest
  ): Promise<ApiResponse<AttendanceCorrectionRequestDto>> {
    return this.request<AttendanceCorrectionRequestDto>(
      `/attendance-correction-requests/${encodeURIComponent(id)}/decision`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  // Reports
  async getAttendanceSummary(
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<AttendanceSummaryReportDto>> {
    const query = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    return this.request<AttendanceSummaryReportDto>(`/reports/attendance-summary${query}`, {
      method: 'GET',
    });
  }

  async getLateArrivals(
    startDate: string,
    endDate: string,
    limit?: number
  ): Promise<ApiResponse<LateArrivalReportDto>> {
    const searchParams = new URLSearchParams({ startDate, endDate });
    if (limit) searchParams.set('limit', String(limit));
    return this.request<LateArrivalReportDto>(`/reports/late-arrivals?${searchParams.toString()}`, {
      method: 'GET',
    });
  }

  async exportAttendance(
    data: AttendanceExportRequest
  ): Promise<ApiResponse<AttendanceExportResponse>> {
    return this.request<AttendanceExportResponse>('/reports/attendance-export', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Audit Logs
  async getAuditLogs(params?: AuditLogListQuery): Promise<ApiResponse<AuditLogDto[]>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.action) searchParams.set('action', params.action);
    if (params?.actorUserId) searchParams.set('actorUserId', params.actorUserId);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const query = searchParams.toString();
    return this.request<AuditLogDto[]>(`/audit-logs${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }
}

export const apiClient = new ApiClient(
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL) ||
    '/api/v1'
);
