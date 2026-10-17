import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../api/client';
import { EmployeeModal } from './EmployeeModal';
import { EmployeeStatusModal } from './EmployeeStatusModal';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import type {
  EmployeeDto,
  DepartmentDto,
  PositionDto,
  EmploymentStatus,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from '@attendance/api-contracts';

interface EmployeeListProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({ onNotify }) => {
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedPosId, setSelectedPosId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Modals state
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDto | null>(null);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusEmployee, setStatusEmployee] = useState<EmployeeDto | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState<EmployeeDto | null>(null);

  // Load auxiliary data (departments and positions for dropdowns)
  const fetchAuxiliaryData = useCallback(async () => {
    if (!apiClient.getToken()) return;
    try {
      const [deptRes, posRes] = await Promise.all([
        apiClient.getDepartments(),
        apiClient.getPositions(),
      ]);
      setDepartments(deptRes.data);
      setPositions(posRes.data);
    } catch {
      // Ignore initial aux errors if not yet configured
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (!apiClient.getToken()) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.getEmployees({
        page,
        pageSize,
        search: search.trim() || undefined,
        departmentId: selectedDeptId || undefined,
        positionId: selectedPosId || undefined,
        status: selectedStatus === 'ALL' ? undefined : (selectedStatus as EmploymentStatus),
      });

      setEmployees(res.data);
      if (res.meta?.total !== undefined) {
        setTotal(res.meta.total);
      }
    } catch (err) {
      notifyRef.current('error', err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, selectedDeptId, selectedPosId, selectedStatus]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleCreateOrUpdate = async (data: CreateEmployeeRequest | UpdateEmployeeRequest) => {
    if (selectedEmployee) {
      await apiClient.updateEmployee(selectedEmployee.id, data as UpdateEmployeeRequest);
      notifyRef.current('success', `Employee '${selectedEmployee.fullName}' updated successfully`);
    } else {
      await apiClient.createEmployee(data as CreateEmployeeRequest);
      notifyRef.current('success', `Employee '${(data as CreateEmployeeRequest).fullName}' created successfully`);
    }
    await fetchEmployees();
  };

  const handleStatusChange = async (data: { status: EmploymentStatus; terminationDate?: string | null }) => {
    if (!statusEmployee) return;
    await apiClient.updateEmployeeStatus(statusEmployee.id, data);
    notifyRef.current('success', `Status for '${statusEmployee.fullName}' updated to ${data.status}`);
    await fetchEmployees();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
            Employees
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage staff profiles, departmental assignments, and employment status
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedEmployee(null);
            setCreateEditModalOpen(true);
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          + Add Employee
        </button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          backgroundColor: '#ffffff',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.25rem' }}>
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, ID, email..."
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.25rem' }}>
            Department
          </label>
          <select
            value={selectedDeptId}
            onChange={(e) => {
              setSelectedDeptId(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.25rem' }}>
            Position
          </label>
          <select
            value={selectedPosId}
            onChange={(e) => {
              setSelectedPosId(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          >
            <option value="">All Positions</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.25rem' }}>
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading employees...</div>
      ) : employees.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px dashed #d1d5db',
            color: '#6b7280',
          }}
        >
          No employees found matching the filters.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>ID #</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Department</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Position</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const statusBg =
                  emp.employmentStatus === 'ACTIVE'
                    ? '#d1fae5'
                    : emp.employmentStatus === 'TERMINATED'
                    ? '#fee2e2'
                    : '#f3f4f6';
                const statusText =
                  emp.employmentStatus === 'ACTIVE'
                    ? '#065f46'
                    : emp.employmentStatus === 'TERMINATED'
                    ? '#b91c1c'
                    : '#6b7280';

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#111827' }}>
                      {emp.employeeNumber}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{emp.fullName}</div>
                      {emp.email && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{emp.email}</div>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>
                      {emp.department?.name || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>
                      {emp.position?.name || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: statusBg,
                          color: statusText,
                        }}
                      >
                        {emp.employmentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => {
                          setDetailEmployee(emp);
                          setDetailModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4b5563',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.8125rem',
                          marginRight: '0.75rem',
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setCreateEditModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.8125rem',
                          marginRight: '0.75rem',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setStatusEmployee(emp);
                          setStatusModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#d97706',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.8125rem',
                        }}
                      >
                        Status
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination bar */}
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e5e7eb',
              fontSize: '0.875rem',
              color: '#6b7280',
            }}
          >
            <span>
              Showing {employees.length} of {total} employees (Page {page} of {totalPages})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: page <= 1 ? '#f3f4f6' : '#ffffff',
                  color: page <= 1 ? '#9ca3af' : '#111827',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: page >= totalPages ? '#f3f4f6' : '#ffffff',
                  color: page >= totalPages ? '#9ca3af' : '#111827',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EmployeeModal
        isOpen={createEditModalOpen}
        employee={selectedEmployee}
        departments={departments}
        positions={positions}
        managers={employees}
        onClose={() => {
          setCreateEditModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <EmployeeStatusModal
        isOpen={statusModalOpen}
        employee={statusEmployee}
        onClose={() => {
          setStatusModalOpen(false);
          setStatusEmployee(null);
        }}
        onSubmit={handleStatusChange}
      />

      <EmployeeDetailModal
        isOpen={detailModalOpen}
        employee={detailEmployee}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailEmployee(null);
        }}
      />
    </div>
  );
};
