import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../api/client';
import { Modal } from '../../components/Modal';
import type {
  LeaveRequestDto,
  AttendanceCorrectionRequestDto,
  PendingApprovalsResponse,
} from '@attendance/api-contracts';

interface ApprovalQueueProps {
  currentUserId?: string;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type TabType = 'ALL' | 'LEAVE' | 'CORRECTIONS';

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ currentUserId, onNotify }) => {
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [data, setData] = useState<PendingApprovalsResponse>({
    leaveRequests: [],
    attendanceCorrections: [],
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    type: 'LEAVE' | 'CORRECTION';
    action: 'APPROVED' | 'REJECTED';
    id: string;
    employeeName: string;
    note: string;
    submitting: boolean;
  }>({
    open: false,
    type: 'LEAVE',
    action: 'APPROVED',
    id: '',
    employeeName: '',
    note: '',
    submitting: false,
  });

  const fetchApprovals = useCallback(async () => {
    if (!apiClient.getToken()) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiClient.getPendingApprovals(1, 100);
      setData(res.data);
    } catch (err) {
      notifyRef.current('error', err instanceof Error ? err.message : 'Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleOpenDecision = (
    type: 'LEAVE' | 'CORRECTION',
    action: 'APPROVED' | 'REJECTED',
    id: string,
    employeeName: string
  ) => {
    setDecisionModal({
      open: true,
      type,
      action,
      id,
      employeeName,
      note: '',
      submitting: false,
    });
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    const { type, action, id, note } = decisionModal;

    try {
      setDecisionModal((prev) => ({ ...prev, submitting: true }));
      if (type === 'LEAVE') {
        await apiClient.decideLeaveRequest(id, { decision: action, note: note.trim() || undefined });
      } else {
        await apiClient.decideAttendanceCorrection(id, { decision: action, note: note.trim() || undefined });
      }
      notifyRef.current('success', `Request has been ${action.toLowerCase()} successfully`);
      setDecisionModal((prev) => ({ ...prev, open: false }));
      await fetchApprovals();
    } catch (err) {
      notifyRef.current('error', err instanceof Error ? err.message : `Failed to process decision`);
    } finally {
      setDecisionModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const isSelf = (employeeUserId?: string | null) => {
    if (!currentUserId || !employeeUserId) return false;
    return currentUserId === employeeUserId;
  };

  const leaveList = data.leaveRequests;
  const correctionList = data.attendanceCorrections;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
          Approval Queue
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
          Review and process employee leave requests and attendance corrections
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'ALL' ? '#1d4ed8' : '#e5e7eb',
            color: activeTab === 'ALL' ? '#ffffff' : '#374151',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          All Requests ({data.total})
        </button>
        <button
          onClick={() => setActiveTab('LEAVE')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'LEAVE' ? '#1d4ed8' : '#e5e7eb',
            color: activeTab === 'LEAVE' ? '#ffffff' : '#374151',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Leave Requests ({leaveList.length})
        </button>
        <button
          onClick={() => setActiveTab('CORRECTIONS')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'CORRECTIONS' ? '#1d4ed8' : '#e5e7eb',
            color: activeTab === 'CORRECTIONS' ? '#ffffff' : '#374151',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Attendance Corrections ({correctionList.length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
          Loading pending approval requests...
        </div>
      ) : data.total === 0 ? (
        <div
          style={{
            background: '#ffffff',
            padding: '3rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            No Pending Approvals
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            All employee leave requests and attendance corrections have been reviewed.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Leave Requests Section */}
          {(activeTab === 'ALL' || activeTab === 'LEAVE') &&
            leaveList.map((item: LeaveRequestDto) => {
              const selfApproval = isSelf((item as unknown as { employee?: { userId?: string } }).employee?.userId);
              return (
                <div
                  key={`leave-${item.id}`}
                  style={{
                    background: '#ffffff',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ maxWidth: '650px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        LEAVE REQUEST
                      </span>
                      <strong style={{ fontSize: '1rem', color: '#111827' }}>
                        {item.employee?.fullName} ({item.employee?.employeeNumber})
                      </strong>
                      {selfApproval && (
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          Self-Approval Prohibited
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                      <strong>{item.leaveType?.name || 'Leave'}:</strong>{' '}
                      {item.startDate.substring(0, 10)} to {item.endDate.substring(0, 10)}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', fontStyle: 'italic' }}>
                      &ldquo;{item.reason}&rdquo;
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Submitted: {new Date(item.submittedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleOpenDecision('LEAVE', 'REJECTED', item.id, item.employee?.fullName || 'Employee')}
                      disabled={selfApproval}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff',
                        color: selfApproval ? '#9ca3af' : '#b91c1c',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: selfApproval ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleOpenDecision('LEAVE', 'APPROVED', item.id, item.employee?.fullName || 'Employee')}
                      disabled={selfApproval}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selfApproval ? '#e5e7eb' : '#15803d',
                        color: selfApproval ? '#9ca3af' : '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: selfApproval ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              );
            })}

          {/* Attendance Correction Requests Section */}
          {(activeTab === 'ALL' || activeTab === 'CORRECTIONS') &&
            correctionList.map((item: AttendanceCorrectionRequestDto) => {
              const selfApproval = isSelf((item as unknown as { employee?: { userId?: string } }).employee?.userId);
              return (
                <div
                  key={`corr-${item.id}`}
                  style={{
                    background: '#ffffff',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ maxWidth: '650px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        ATTENDANCE CORRECTION
                      </span>
                      <strong style={{ fontSize: '1rem', color: '#111827' }}>
                        {item.employee?.fullName} ({item.employee?.employeeNumber})
                      </strong>
                      {selfApproval && (
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          Self-Approval Prohibited
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                      {item.attendanceRecord && (
                        <span>Original Date: {item.attendanceRecord.workDate.substring(0, 10)} | </span>
                      )}
                      <strong>Requested Check-in:</strong>{' '}
                      {item.requestedCheckInAt ? new Date(item.requestedCheckInAt).toLocaleTimeString() : 'N/A'}{' '}
                      | <strong>Requested Check-out:</strong>{' '}
                      {item.requestedCheckOutAt ? new Date(item.requestedCheckOutAt).toLocaleTimeString() : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', fontStyle: 'italic' }}>
                      &ldquo;{item.reason}&rdquo;
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Submitted: {new Date(item.submittedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleOpenDecision('CORRECTION', 'REJECTED', item.id, item.employee?.fullName || 'Employee')}
                      disabled={selfApproval}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff',
                        color: selfApproval ? '#9ca3af' : '#b91c1c',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: selfApproval ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleOpenDecision('CORRECTION', 'APPROVED', item.id, item.employee?.fullName || 'Employee')}
                      disabled={selfApproval}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selfApproval ? '#e5e7eb' : '#15803d',
                        color: selfApproval ? '#9ca3af' : '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: selfApproval ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Decision Note Modal */}
      <Modal
        isOpen={decisionModal.open}
        title={`${decisionModal.action === 'APPROVED' ? 'Approve' : 'Reject'} ${
          decisionModal.type === 'LEAVE' ? 'Leave Request' : 'Attendance Correction'
        }`}
        onClose={() => setDecisionModal((prev) => ({ ...prev, open: false }))}
      >
        <form onSubmit={handleSubmitDecision} style={{ padding: '1.25rem' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#374151' }}>
            You are about to <strong>{decisionModal.action.toLowerCase()}</strong> the request for{' '}
            <strong>{decisionModal.employeeName}</strong>.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Decision Note (Optional)
            </label>
            <textarea
              rows={3}
              value={decisionModal.note}
              onChange={(e) => setDecisionModal((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Add review feedback or decision rationale..."
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setDecisionModal((prev) => ({ ...prev, open: false }))}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={decisionModal.submitting}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: decisionModal.action === 'APPROVED' ? '#15803d' : '#b91c1c',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {decisionModal.submitting
                ? 'Processing...'
                : `Confirm ${decisionModal.action === 'APPROVED' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
