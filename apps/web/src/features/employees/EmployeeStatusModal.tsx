import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import type { EmployeeDto, EmploymentStatus } from '@attendance/api-contracts';

interface EmployeeStatusModalProps {
  isOpen: boolean;
  employee: EmployeeDto | null;
  onClose: () => void;
  onSubmit: (data: { status: EmploymentStatus; terminationDate?: string | null }) => Promise<void>;
}

export const EmployeeStatusModal: React.FC<EmployeeStatusModalProps> = ({
  isOpen,
  employee,
  onClose,
  onSubmit,
}) => {
  const [status, setStatus] = useState<EmploymentStatus>(employee?.employmentStatus || 'ACTIVE');
  const [terminationDate, setTerminationDate] = useState(
    employee?.terminationDate ? employee.terminationDate.split('T')[0] : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(employee?.employmentStatus || 'ACTIVE');
    setTerminationDate(employee?.terminationDate ? employee.terminationDate.split('T')[0] : '');
    setError(null);
  }, [employee, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'TERMINATED' && !terminationDate) {
      setError('Termination date is required when status is TERMINATED');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        status,
        terminationDate: status === 'TERMINATED' ? terminationDate : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={`Update Status: ${employee.fullName} (${employee.employeeNumber})`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            Employment Status *
          </label>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {(['ACTIVE', 'INACTIVE', 'TERMINATED'] as EmploymentStatus[]).map((s) => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                />
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: status === s ? 600 : 400,
                  }}
                >
                  {s}
                </span>
              </label>
            ))}
          </div>
        </div>

        {status === 'TERMINATED' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Termination Date *
            </label>
            <input
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving...' : 'Update Status'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
