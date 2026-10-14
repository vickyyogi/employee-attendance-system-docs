import React from 'react';
import { Modal } from '../../components/Modal';
import type { EmployeeDto } from '@attendance/api-contracts';

interface EmployeeDetailModalProps {
  isOpen: boolean;
  employee: EmployeeDto | null;
  onClose: () => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  isOpen,
  employee,
  onClose,
}) => {
  if (!employee) return null;

  const statusColor =
    employee.employmentStatus === 'ACTIVE'
      ? { bg: '#d1fae5', text: '#065f46' }
      : employee.employmentStatus === 'TERMINATED'
      ? { bg: '#fee2e2', text: '#b91c1c' }
      : { bg: '#f3f4f6', text: '#6b7280' };

  return (
    <Modal
      isOpen={isOpen}
      title={`Employee: ${employee.fullName}`}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Employee Number</span>
            <span style={{ fontWeight: 600, fontSize: '1.125rem', color: '#111827' }}>{employee.employeeNumber}</span>
          </div>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: statusColor.bg,
              color: statusColor.text,
            }}
          >
            {employee.employmentStatus}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Email</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>{employee.email || '—'}</span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Phone</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>{employee.phone || '—'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Department</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>
              {employee.department ? `${employee.department.name} ${employee.department.code ? `(${employee.department.code})` : ''}` : '—'}
            </span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Position</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>{employee.position?.name || '—'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Reporting Manager</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>
              {employee.manager ? `${employee.manager.fullName} (${employee.manager.employeeNumber})` : '— (None)'}
            </span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Hire Date</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : '—'}</span>
          </div>
        </div>

        {employee.terminationDate && (
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Termination Date</span>
            <span style={{ color: '#b91c1c', fontWeight: 500 }}>{new Date(employee.terminationDate).toLocaleDateString()}</span>
          </div>
        )}

        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.75rem' }}>
          <span>Created: {new Date(employee.createdAt).toLocaleDateString()}</span>
          <span>Last Updated: {new Date(employee.updatedAt).toLocaleDateString()}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
