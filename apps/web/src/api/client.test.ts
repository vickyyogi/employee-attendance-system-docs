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
});
