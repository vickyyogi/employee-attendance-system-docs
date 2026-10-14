import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import type { DepartmentDto, DepartmentStatus } from '@attendance/api-contracts';

interface DepartmentModalProps {
  isOpen: boolean;
  department: DepartmentDto | null;
  onClose: () => void;
  onSubmit: (data: { name: string; code?: string | null; status?: DepartmentStatus }) => Promise<void>;
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  department,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(department?.name || '');
  const [code, setCode] = useState(department?.code || '');
  const [status, setStatus] = useState<DepartmentStatus>(department?.status || 'ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(department?.name || '');
    setCode(department?.code || '');
    setStatus(department?.status || 'ACTIVE');
    setError(null);
  }, [department, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        status: department ? status : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={department ? 'Edit Department' : 'Add Department'}
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
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
            Department Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Engineering"
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

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
            Department Code (Optional)
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. ENG"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {department && (
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DepartmentStatus)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
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
            {loading ? 'Saving...' : department ? 'Update Department' : 'Create Department'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
