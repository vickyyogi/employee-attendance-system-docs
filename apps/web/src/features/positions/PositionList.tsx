import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { PositionModal } from './PositionModal';
import type { PositionDto, PositionStatus } from '@attendance/api-contracts';

interface PositionListProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const PositionList: React.FC<PositionListProps> = ({ onNotify }) => {
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState<PositionDto | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      const filter = statusFilter === 'ALL' ? undefined : (statusFilter as PositionStatus);
      const res = await apiClient.getPositions(filter);
      setPositions(res.data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onNotify]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleCreateOrUpdate = async (data: { name: string; status?: PositionStatus }) => {
    if (selectedPos) {
      await apiClient.updatePosition(selectedPos.id, data);
      onNotify('success', `Position '${data.name}' updated successfully`);
    } else {
      await apiClient.createPosition({ name: data.name });
      onNotify('success', `Position '${data.name}' created successfully`);
    }
    await fetchPositions();
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
            Positions
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            Manage job positions and titles in your company
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
              setSelectedPos(null);
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
            + Add Position
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading positions...</div>
      ) : positions.length === 0 ? (
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
          No positions found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Created</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#111827' }}>{pos.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: pos.status === 'ACTIVE' ? '#d1fae5' : '#f3f4f6',
                        color: pos.status === 'ACTIVE' ? '#065f46' : '#6b7280',
                      }}
                    >
                      {pos.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                    {new Date(pos.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedPos(pos);
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

      <PositionModal
        isOpen={modalOpen}
        position={selectedPos}
        onClose={() => {
          setModalOpen(false);
          setSelectedPos(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />
    </div>
  );
};
