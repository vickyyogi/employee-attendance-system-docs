import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import type { PositionDto, PositionStatus } from '@attendance/api-contracts';

interface PositionModalProps {
  isOpen: boolean;
  position: PositionDto | null;
  onClose: () => void;
  onSubmit: (data: { name: string; status?: PositionStatus }) => Promise<void>;
}

export const PositionModal: React.FC<PositionModalProps> = ({
  isOpen,
  position,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(position?.name || '');
  const [status, setStatus] = useState<PositionStatus>(position?.status || 'ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(position?.name || '');
    setStatus(position?.status || 'ACTIVE');
    setError(null);
  }, [position, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Position name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        status: position ? status : undefined,
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
      title={position ? 'Edit Position' : 'Add Position'}
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
            Position Title *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Senior Software Engineer"
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

        {position && (
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PositionStatus)}
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
            {loading ? 'Saving...' : position ? 'Update Position' : 'Create Position'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
