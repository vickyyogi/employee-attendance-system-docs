import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { DepartmentModal } from './DepartmentModal';
import type { DepartmentDto, DepartmentStatus } from '@attendance/api-contracts';

interface DepartmentListProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const DepartmentList: React.FC<DepartmentListProps> = ({ onNotify }) => {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartmentDto | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const filter = statusFilter === 'ALL' ? undefined : (statusFilter as DepartmentStatus);
      const res = await apiClient.getDepartments(filter);
      setDepartments(res.data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onNotify]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreateOrUpdate = async (data: { name: string; code?: string | null; status?: DepartmentStatus }) => {
    if (selectedDept) {
      await apiClient.updateDepartment(selectedDept.id, data);
      onNotify('success', `Department '${data.name}' updated successfully`);
    } else {
      await apiClient.createDepartment({ name: data.name, code: data.code || undefined });
      onNotify('success', `Department '${data.name}' created successfully`);
    }
    await fetchDepartments();
  };

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
            Departments
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage organizational departments within your company
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <button
            onClick={() => {
              setSelectedDept(null);
              setModalOpen(true);
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
            + Add Department
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading departments...</div>
      ) : departments.length === 0 ? (
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
          No departments found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Code</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Created</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#111827' }}>{dept.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{dept.code || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: dept.status === 'ACTIVE' ? '#d1fae5' : '#f3f4f6',
                        color: dept.status === 'ACTIVE' ? '#065f46' : '#6b7280',
                      }}
                    >
                      {dept.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                    {new Date(dept.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedDept(dept);
                        setModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DepartmentModal
        isOpen={modalOpen}
        department={selectedDept}
        onClose={() => {
          setModalOpen(false);
          setSelectedDept(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />
    </div>
  );
};
