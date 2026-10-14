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
}

export const apiClient = new ApiClient();
