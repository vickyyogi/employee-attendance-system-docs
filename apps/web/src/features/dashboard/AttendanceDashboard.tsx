import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { Modal } from '../../components/Modal';
import type { AttendanceRecordDto, AttendanceStatus, AttendanceEventDto } from '@attendance/api-contracts';

interface AttendanceDashboardProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateToApprovals?: () => void;
}

const getTodayString = () => new Date().toISOString().substring(0, 10);

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  onNotify,
  onNavigateToApprovals,
}) => {
  const [records, setRecords] = useState<AttendanceRecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  // Detail Modal state
  const [detailRecord, setDetailRecord] = useState<AttendanceRecordDto | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);

  // Flag Modal state
  const [flagRecord, setFlagRecord] = useState<AttendanceRecordDto | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [submittingFlag, setSubmittingFlag] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const filterStatus = statusFilter === 'ALL' ? undefined : (statusFilter as AttendanceStatus);
      const res = await apiClient.getAttendance({
        startDate: selectedDate,
        endDate: selectedDate,
        status: filterStatus,
        pageSize: 100,
      });
      setRecords(res.data);

      // Also fetch pending approvals count
      try {
        const approvalsRes = await apiClient.getPendingApprovals(1, 1);
        setPendingApprovalsCount(approvalsRes.data.total);
      } catch {
        // Silently skip if user has no approval permissions
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, onNotify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDetail = async (record: AttendanceRecordDto) => {
    setDetailRecord(record);
    setSelfieUrl(null);
    try {
      // Fetch full details with events
      const res = await apiClient.getAttendanceById(record.id);
      setDetailRecord(res.data);
    } catch {
      // Use existing record if detail endpoint fails
    }
  };

  const handleLoadSelfie = async () => {
    if (!detailRecord) return;
    try {
      setLoadingSelfie(true);
      const res = await apiClient.getAttendanceSelfieUrl(detailRecord.id, 'check_in');
      setSelfieUrl(res.data.url);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to retrieve selfie photo');
    } finally {
      setLoadingSelfie(false);
    }
  };

  const handleOpenFlagModal = (record: AttendanceRecordDto) => {
    setFlagRecord(record);
    setFlagReason('');
  };

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagRecord || !flagReason.trim()) return;

    try {
      setSubmittingFlag(true);
      await apiClient.flagAttendance(flagRecord.id, flagReason.trim());
      onNotify('success', `Attendance record for ${flagRecord.employee?.fullName} has been flagged`);
      setFlagRecord(null);
      await fetchData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to flag attendance');
    } finally {
      setSubmittingFlag(false);
    }
  };

  // Compute stat counts
  const presentCount = records.filter(
    (r) => r.status === 'PRESENT' || r.status === 'CORRECTED'
  ).length;
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const inProgressCount = records.filter((r) => r.status === 'IN_PROGRESS').length;

  const getStatusBadge = (status: AttendanceStatus) => {
    let bg = '#f3f4f6';
    let text = '#374151';
    switch (status) {
      case 'PRESENT':
        bg = '#dcfce7';
        text = '#15803d';
        break;
      case 'LATE':
        bg = '#fef3c7';
        text = '#b45309';
        break;
      case 'IN_PROGRESS':
        bg = '#dbeafe';
        text = '#1d4ed8';
        break;
      case 'CORRECTED':
        bg = '#f3e8ff';
        text = '#7e22ce';
        break;
      case 'FLAGGED':
        bg = '#fee2e2';
        text = '#b91c1c';
        break;
    }
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: bg,
          color: text,
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div>
      {/* Header and Stat Summary Cards */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
          Attendance Dashboard
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
          Daily overview and attendance verification
        </p>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
            Total Today
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>
            {records.length}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' }}>
            Present / Completed
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
            {presentCount}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>
            Late Arrivals
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#b45309', marginTop: '0.25rem' }}>
            {lateCount}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase' }}>
            In Progress
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1d4ed8', marginTop: '0.25rem' }}>
            {inProgressCount}
          </div>
        </div>

        {onNavigateToApprovals && (
          <div
            onClick={onNavigateToApprovals}
            style={{
              background: '#f8fafc',
              padding: '1.25rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
              Pending Approvals
            </div>
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
              {pendingApprovalsCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '0.25rem' }}>
              View Queue &rarr;
            </div>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>
              Work Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="CORRECTED">Corrected</option>
              <option value="FLAGGED">Flagged</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Attendance Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          overflowX: 'auto',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Employee</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Shift</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Check In</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Check Out</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Location</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#374151', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  Loading attendance records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  No attendance records found for {selectedDate}.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: r.status === 'FLAGGED' ? '#fff1f2' : 'transparent',
                  }}
                >
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{r.employee?.fullName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.employee?.employeeNumber}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div>{r.shift?.name || 'Standard'}</div>
                    {r.shift?.startTimeLocal && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {r.shift.startTimeLocal} - {r.shift.endTimeLocal}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#4b5563' }}>
                    {r.workLocation?.name || '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{getStatusBadge(r.status)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleOpenDetail(r)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#ffffff',
                          color: '#1d4ed8',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Details
                      </button>
                      {r.status !== 'FLAGGED' && (
                        <button
                          onClick={() => handleOpenFlagModal(r)}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid #fca5a5',
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Flag
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Attendance Detail Modal */}
      <Modal
        isOpen={!!detailRecord}
        title="Attendance Verification Details"
        onClose={() => setDetailRecord(null)}
      >
        {detailRecord && (
          <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                  {detailRecord.employee?.fullName}
                </h3>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {detailRecord.employee?.employeeNumber}
                </span>
              </div>
              <div>{getStatusBadge(detailRecord.status)}</div>
            </div>

            <div
              style={{
                background: '#f9fafb',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <strong>Work Date:</strong> {detailRecord.workDate.substring(0, 10)}
                </div>
                <div>
                  <strong>Location:</strong> {detailRecord.workLocation?.name || 'N/A'}
                </div>
                <div>
                  <strong>Check In:</strong>{' '}
                  {detailRecord.checkInAt ? new Date(detailRecord.checkInAt).toLocaleString() : 'N/A'}
                </div>
                <div>
                  <strong>Check Out:</strong>{' '}
                  {detailRecord.checkOutAt ? new Date(detailRecord.checkOutAt).toLocaleString() : 'N/A'}
                </div>
                <div>
                  <strong>GPS Accuracy:</strong>{' '}
                  {detailRecord.checkInAccuracyM ? `${detailRecord.checkInAccuracyM}m` : 'N/A'}
                </div>
                <div>
                  <strong>Distance to Geofence:</strong>{' '}
                  {detailRecord.checkInDistanceM ? `${detailRecord.checkInDistanceM}m` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Verification Selfie Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>
                Verification Selfie
              </h4>
              {selfieUrl ? (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={selfieUrl}
                    alt="Check-in Verification"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '260px',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Signed secure URL (Expires in 5 minutes)
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleLoadSelfie}
                  disabled={loadingSelfie}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  {loadingSelfie ? 'Loading Secured Photo...' : 'Load Verification Selfie'}
                </button>
              )}
            </div>

            {/* Events Timeline */}
            {detailRecord.events && detailRecord.events.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>
                  Audit & Event Timeline
                </h4>
                <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem', marginLeft: '0.5rem' }}>
                  {detailRecord.events.map((ev: AttendanceEventDto) => (
                    <div key={ev.id} style={{ marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
                      <div style={{ fontWeight: 600, color: '#374151' }}>{ev.eventType}</div>
                      <div style={{ color: '#6b7280' }}>
                        {new Date(ev.occurredAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Flag Modal */}
      <Modal
        isOpen={!!flagRecord}
        title="Flag Attendance Record for Review"
        onClose={() => setFlagRecord(null)}
      >
        <form onSubmit={handleSubmitFlag} style={{ padding: '1.25rem' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#4b5563' }}>
            Flagging this record marks it for administrative investigation. Please provide a clear reason.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Reason for Flagging *
            </label>
            <textarea
              required
              rows={3}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="e.g. Unverified location, outside normal schedule, discrepancy in hours..."
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
              onClick={() => setFlagRecord(null)}
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
              disabled={submittingFlag || !flagReason.trim()}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#b91c1c',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {submittingFlag ? 'Flagging...' : 'Confirm Flag'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
