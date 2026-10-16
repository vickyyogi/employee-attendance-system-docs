import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('/api/v1');
    vi.restoreAllMocks();
  });

  it('manages authorization token and company tenant context', () => {
    expect(client.getToken()).toBeNull();
    expect(client.getCompanyId()).toBeNull();

    client.setToken('test-jwt-token');
    client.setCompanyId('company-123');

    expect(client.getToken()).toBe('test-jwt-token');
    expect(client.getCompanyId()).toBe('company-123');
  });

  it('includes Authorization and X-Company-Id headers in requests', async () => {
    client.setToken('jwt-abc');
    client.setCompanyId('comp-xyz');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { requestId: 'req-1' } }),
    });
    globalThis.fetch = mockFetch;

    await client.getDepartments();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/departments');
    expect(init.headers['Authorization']).toBe('Bearer jwt-abc');
    expect(init.headers['X-Company-Id']).toBe('comp-xyz');
  });

  it('constructs correct query parameters for employee listing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { requestId: 'req-2' } }),
    });
    globalThis.fetch = mockFetch;

    await client.getEmployees({
      page: 2,
      pageSize: 25,
      search: 'Alice',
      departmentId: 'dept-1',
      status: 'ACTIVE',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/employees?');
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=25');
    expect(url).toContain('search=Alice');
    expect(url).toContain('departmentId=dept-1');
    expect(url).toContain('status=ACTIVE');
  });

  it('throws ApiError with message and details on non-ok responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'CONFLICT',
          message: 'Department already exists',
          details: [{ field: 'name', message: 'Name in use' }],
        },
      }),
    });
    globalThis.fetch = mockFetch;

    await expect(client.createDepartment({ name: 'Engineering' })).rejects.toThrow(ApiError);
    await expect(client.createDepartment({ name: 'Engineering' })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Department already exists',
    });
  });

  it('constructs correct parameters for attendance search and flagging', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { requestId: 'req-3' } }),
    });
    globalThis.fetch = mockFetch;

    await client.getAttendance({
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      status: 'LATE',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/attendance?');
    expect(url).toContain('startDate=2026-10-01');
    expect(url).toContain('endDate=2026-10-05');
    expect(url).toContain('status=LATE');

    await client.flagAttendance('att-1', 'Irregular hours');
    const [flagUrl, flagInit] = mockFetch.mock.calls[1];
    expect(flagUrl).toBe('/api/v1/attendance/att-1/flag');
    expect(flagInit.method).toBe('POST');
    expect(JSON.parse(flagInit.body)).toEqual({ reason: 'Irregular hours' });
  });

  it('handles approvals queue and decision requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { leaveRequests: [], attendanceCorrections: [], total: 0 },
        meta: { requestId: 'req-4' },
      }),
    });
    globalThis.fetch = mockFetch;

    await client.getPendingApprovals(1, 20);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/approvals/pending?page=1&pageSize=20');

    await client.decideLeaveRequest('leave-1', { decision: 'APPROVED', note: 'Enjoy' });
    const [decUrl, decInit] = mockFetch.mock.calls[1];
    expect(decUrl).toBe('/api/v1/leave-requests/leave-1/decision');
    expect(JSON.parse(decInit.body)).toEqual({ decision: 'APPROVED', note: 'Enjoy' });
  });

  it('handles reports and audit logs endpoints', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { format: 'csv', filename: 'report.csv', recordCount: 1, data: 'csv-content' },
        meta: { requestId: 'req-5' },
      }),
    });
    globalThis.fetch = mockFetch;

    await client.getAttendanceSummary('2026-10-01', '2026-10-05');
    expect(mockFetch.mock.calls[0][0]).toContain(
      '/api/v1/reports/attendance-summary?startDate=2026-10-01&endDate=2026-10-05'
    );

    await client.exportAttendance({
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      format: 'csv',
    });
    const [expUrl, expInit] = mockFetch.mock.calls[1];
    expect(expUrl).toBe('/api/v1/reports/attendance-export');
    expect(JSON.parse(expInit.body)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      format: 'csv',
    });

    await client.getAuditLogs({ action: 'REPORT_EXPORTED' });
    expect(mockFetch.mock.calls[2][0]).toContain('/api/v1/audit-logs?action=REPORT_EXPORTED');
  });
});
