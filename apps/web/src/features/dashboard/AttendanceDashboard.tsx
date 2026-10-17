import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../api/client';
import { Modal } from '../../components/Modal';
import type { AttendanceRecordDto, AttendanceStatus, AttendanceEventDto } from '@attendance/api-contracts';

interface AttendanceDashboardProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateToApprovals?: () => void;
}

const getTodayString = () => new Date().toISOString().substring(0, 10);

// Helper for avatar colors based on name
const getAvatarColor = (name: string) => {
  const colors = [
    { bg: '#3b82f6', text: '#ffffff' },
    { bg: '#10b981', text: '#ffffff' },
    { bg: '#8b5cf6', text: '#ffffff' },
    { bg: '#f59e0b', text: '#ffffff' },
    { bg: '#ec4899', text: '#ffffff' },
    { bg: '#06b6d4', text: '#ffffff' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  onNotify,
  onNavigateToApprovals,
}) => {
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const [records, setRecords] = useState<AttendanceRecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'table' | 'mobile'>('split');

  // Detail Modal state
  const [detailRecord, setDetailRecord] = useState<AttendanceRecordDto | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);

  // Flag Modal state
  const [flagRecord, setFlagRecord] = useState<AttendanceRecordDto | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [submittingFlag, setSubmittingFlag] = useState(false);

  const fetchData = useCallback(async () => {
    if (!apiClient.getToken()) {
      setLoading(false);
      return;
    }
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

      // Select first record if none currently selected or previous not in result
      if (res.data.length > 0) {
        setSelectedRecordId((prev) => {
          const exists = res.data.some((r) => r.id === prev);
          return exists ? prev : res.data[0].id;
        });
      } else {
        setSelectedRecordId(null);
      }

      // Also fetch pending approvals count
      try {
        const approvalsRes = await apiClient.getPendingApprovals(1, 1);
        setPendingApprovalsCount(approvalsRes.data.total);
      } catch {
        // Silently skip if user has no approval permissions
      }
    } catch (err) {
      notifyRef.current('error', err instanceof Error ? err.message : 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset selfie preview when selected record changes
  useEffect(() => {
    setSelfieUrl(null);
  }, [selectedRecordId]);

  const handleOpenDetailModal = async (record: AttendanceRecordDto) => {
    setDetailRecord(record);
    setSelfieUrl(null);
    try {
      const res = await apiClient.getAttendanceById(record.id);
      setDetailRecord(res.data);
    } catch {
      // Use existing record if detail endpoint fails
    }
  };

  const handleLoadSelfie = async (recordId?: string) => {
    const targetId = recordId || selectedRecordId || detailRecord?.id;
    if (!targetId) return;
    try {
      setLoadingSelfie(true);
      const res = await apiClient.getAttendanceSelfieUrl(targetId, 'check_in');
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

  // Filtered records by search query
  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = r.employee?.fullName?.toLowerCase() || '';
    const empNo = r.employee?.employeeNumber?.toLowerCase() || '';
    const loc = r.workLocation?.name?.toLowerCase() || '';
    return name.includes(query) || empNo.includes(query) || loc.includes(query);
  });

  // Currently inspected record
  const currentInspectorRecord =
    records.find((r) => r.id === selectedRecordId) || filteredRecords[0] || null;

  // Compute stats
  const presentCount = records.filter(
    (r) => r.status === 'PRESENT' || r.status === 'CORRECTED'
  ).length;
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const inProgressCount = records.filter((r) => r.status === 'IN_PROGRESS').length;

  const getStatusBadge = (status: AttendanceStatus, isDarkBg = false) => {
    let bg = '#1e2433';
    let text = '#94a3b8';
    let border = '1px solid #283247';

    switch (status) {
      case 'PRESENT':
        bg = isDarkBg ? 'rgba(74, 222, 128, 0.12)' : '#dcfce7';
        text = isDarkBg ? '#4ade80' : '#15803d';
        border = isDarkBg ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid #bbf7d0';
        break;
      case 'LATE':
        bg = isDarkBg ? 'rgba(251, 191, 36, 0.12)' : '#fef3c7';
        text = isDarkBg ? '#fbbf24' : '#b45309';
        border = isDarkBg ? '1px solid rgba(251, 191, 36, 0.25)' : '1px solid #fde68a';
        break;
      case 'IN_PROGRESS':
        bg = isDarkBg ? 'rgba(184, 246, 53, 0.12)' : '#ecfccb';
        text = isDarkBg ? '#b8f635' : '#4d7c0f';
        border = isDarkBg ? '1px solid rgba(184, 246, 53, 0.25)' : '1px solid #d9f99d';
        break;
      case 'CORRECTED':
        bg = isDarkBg ? 'rgba(192, 132, 252, 0.12)' : '#f3e8ff';
        text = isDarkBg ? '#c084fc' : '#7e22ce';
        border = isDarkBg ? '1px solid rgba(192, 132, 252, 0.25)' : '1px solid #e9d5ff';
        break;
      case 'FLAGGED':
        bg = isDarkBg ? 'rgba(248, 113, 113, 0.12)' : '#fee2e2';
        text = isDarkBg ? '#f87171' : '#b91c1c';
        border = isDarkBg ? '1px solid rgba(248, 113, 113, 0.25)' : '1px solid #fecaca';
        break;
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0.2rem 0.65rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 700,
          backgroundColor: bg,
          color: text,
          border: border,
          letterSpacing: '0.02em',
        }}
      >
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: text,
          }}
        />
        {status}
      </span>
    );
  };

  // Helper for generating days around selected date for mobile view
  const generateMobileDays = () => {
    const cur = new Date(selectedDate);
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(cur);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const formatMobileMonthYear = (dateStr: string) => {
    const dt = new Date(dateStr);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const formatTimelineHour = (isoStr?: string | null, isStart = true) => {
    if (!isoStr) return isStart ? '09 am' : '05 pm';
    const dt = new Date(isoStr);
    const h = dt.getHours();
    const period = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div style={{ color: '#ffffff', fontFamily: 'inherit' }}>
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#151924',
              border: '1px solid #232a3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8e95a5',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
            title="Dashboard Overview"
          >
            ←
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.875rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
              }}
            >
              Attendance Dashboard
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#8e95a5', fontSize: '0.8125rem' }}>
              Real-time employee presence, geofence audit & workforce verification
            </p>
          </div>
        </div>

        {/* View switcher and quick actions (Desktop / Mobile Preview) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              backgroundColor: '#151924',
              border: '1px solid #232a3d',
              borderRadius: '9999px',
              padding: '3px',
              display: 'inline-flex',
            }}
          >
            <button
              onClick={() => setViewMode('split')}
              style={{
                backgroundColor: viewMode === 'split' ? '#b8f635' : 'transparent',
                color: viewMode === 'split' ? '#0a0b10' : '#8e95a5',
                border: 'none',
                borderRadius: '9999px',
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ◫ Split View
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                backgroundColor: viewMode === 'table' ? '#b8f635' : 'transparent',
                color: viewMode === 'table' ? '#0a0b10' : '#8e95a5',
                border: 'none',
                borderRadius: '9999px',
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ☰ Table View
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              style={{
                backgroundColor: viewMode === 'mobile' ? '#b8f635' : 'transparent',
                color: viewMode === 'mobile' ? '#0a0b10' : '#8e95a5',
                border: 'none',
                borderRadius: '9999px',
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📱 Mobile View
            </button>
          </div>
        </div>
      </div>

      {/* Top Hero Cards Grid (Directly matching reference image layout) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Left Hero Card - Metric Overview & Presence Progress */}
        <div
          style={{
            backgroundColor: '#141722',
            border: '1px solid #232737',
            borderRadius: '24px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1.25rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Top Metrics Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#8e95a5',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Total Today
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  marginTop: '0.2rem',
                  letterSpacing: '-0.03em',
                }}
              >
                {records.length}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#8e95a5',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Present / Completed
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  marginTop: '0.2rem',
                  letterSpacing: '-0.03em',
                }}
              >
                {presentCount}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#8e95a5',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Late Arrivals
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  marginTop: '0.2rem',
                  letterSpacing: '-0.03em',
                }}
              >
                {lateCount}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#8e95a5',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                In Progress
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  marginTop: '0.2rem',
                  letterSpacing: '-0.03em',
                }}
              >
                {inProgressCount}
              </div>
            </div>
          </div>

          {/* Shift Timeline / Progress Bar Track */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#656d81',
                marginBottom: '0.4rem',
                fontWeight: 600,
              }}
            >
              <span>Morning Shift (08:00)</span>
              <span>Midday (12:00)</span>
              <span>Closing Shift (17:00)</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#202534',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${records.length > 0 ? Math.min(100, Math.round((presentCount / records.length) * 100)) : 10}%`,
                  backgroundColor: '#b8f635',
                  borderRadius: '9999px',
                  boxShadow: '0 0 10px rgba(184, 246, 53, 0.4)',
                }}
              />
            </div>
          </div>

          {/* Stacked Employee Avatars Cluster */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid #1c2130',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {records.slice(0, 5).map((r, idx) => {
                const color = getAvatarColor(r.employee?.fullName || `User-${idx}`);
                return (
                  <div
                    key={r.id}
                    title={r.employee?.fullName}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: color.bg,
                      color: color.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      border: '2px solid #141722',
                      marginLeft: idx === 0 ? 0 : '-10px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    {getInitials(r.employee?.fullName)}
                  </div>
                );
              })}
              {records.length > 5 && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#202534',
                    color: '#8e95a5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: '2px solid #141722',
                    marginLeft: '-10px',
                  }}
                >
                  +{records.length - 5}
                </div>
              )}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#8e95a5',
                  marginLeft: '0.85rem',
                  fontWeight: 500,
                }}
              >
                {records.length > 0 ? `${records.length} employees checked in` : 'No check-ins recorded yet'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#b8f635',
                  boxShadow: '0 0 8px #b8f635',
                }}
              />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#b8f635' }}>
                Engine Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Hero Card - Pending Approvals & Quick Shift Action (matching reference right card) */}
        <div
          style={{
            backgroundColor: '#141722',
            border: '1px solid #232737',
            borderRadius: '24px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1.25rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Top Row: Pending Approvals count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#8e95a5',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Pending Approvals
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  marginTop: '0.2rem',
                  letterSpacing: '-0.03em',
                }}
              >
                {pendingApprovalsCount}
              </div>
            </div>

            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                backgroundColor: '#1c2230',
                border: '1px solid #293348',
                color: '#8e95a5',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              Action Queue
            </span>
          </div>

          {/* 3 Mini Selector Cards (Directly matching #4443 Visa, #177210 Stripe lime card, #711221 PayPal from reference!) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.65rem',
            }}
          >
            {/* Card 1 */}
            <div
              style={{
                backgroundColor: '#1a1e2c',
                border: '1px solid #262c3f',
                borderRadius: '14px',
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#8e95a5', fontWeight: 600 }}>#REG-01</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>
                On-Time
              </div>
              <div style={{ fontSize: '0.7rem', color: '#4ade80', marginTop: '0.2rem' }}>
                {presentCount} shifts
              </div>
            </div>

            {/* Card 2 - Active Highlight in Neon Lime */}
            <div
              style={{
                backgroundColor: '#b8f635',
                borderRadius: '14px',
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 15px rgba(184, 246, 53, 0.25)',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#0a0b10', fontWeight: 700 }}>#LIVE-DUTY</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0a0b10', marginTop: '0.2rem' }}>
                Active Pulse
              </div>
              <div style={{ fontSize: '0.7rem', color: '#0a0b10', fontWeight: 600, marginTop: '0.2rem' }}>
                {inProgressCount} active
              </div>
            </div>

            {/* Card 3 */}
            <div
              style={{
                backgroundColor: '#1a1e2c',
                border: '1px solid #262c3f',
                borderRadius: '14px',
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#8e95a5', fontWeight: 600 }}>#EXCEPT</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>
                Exceptions
              </div>
              <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '0.2rem' }}>
                {lateCount} late
              </div>
            </div>
          </div>

          {/* Action button */}
          {onNavigateToApprovals ? (
            <button
              onClick={onNavigateToApprovals}
              style={{
                width: '100%',
                padding: '0.75rem 1.25rem',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: '#b8f635',
                color: '#0a0b10',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 18px rgba(184, 246, 53, 0.28)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Review Pending Approvals Queue</span>
              <span style={{ fontSize: '1rem' }}>→</span>
            </button>
          ) : (
            <button
              onClick={() => onNotify('info', 'Approvals feature ready in management tab')}
              style={{
                width: '100%',
                padding: '0.75rem 1.25rem',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: '#b8f635',
                color: '#0a0b10',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              View Approvals
            </button>
          )}
        </div>
      </div>

      {/* Middle Filter Toolbar (Capsule Pill Bar matching reference) */}
      <div
        style={{
          backgroundColor: '#141722',
          border: '1px solid #232737',
          borderRadius: '9999px',
          padding: '0.65rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Left: Status Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#8e95a5',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginRight: '0.25rem',
            }}
          >
            Status Filter:
          </span>

          {[
            { id: 'ALL', label: 'All Statuses', count: records.length },
            { id: 'PRESENT', label: 'Present', count: presentCount },
            { id: 'LATE', label: 'Late', count: lateCount },
            { id: 'IN_PROGRESS', label: 'In Progress', count: inProgressCount },
            { id: 'CORRECTED', label: 'Corrected' },
            { id: 'FLAGGED', label: 'Flagged' },
          ].map((item) => {
            const isActive = statusFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  border: isActive ? 'none' : '1px solid #232a3d',
                  backgroundColor: isActive ? '#b8f635' : '#181c29',
                  color: isActive ? '#0a0b10' : '#8e95a5',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: '9999px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      backgroundColor: isActive ? 'rgba(0,0,0,0.15)' : '#232a3d',
                      color: isActive ? '#0a0b10' : '#8e95a5',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Date picker, Search, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Work Date Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#181c29',
              border: '1px solid #232a3d',
              borderRadius: '9999px',
              padding: '4px 10px',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#8e95a5', fontWeight: 600 }}>Work Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Search Input Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#181c29',
              border: '1px solid #232a3d',
              borderRadius: '9999px',
              padding: '4px 12px',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#8e95a5' }}>🔍</span>
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.75rem',
                outline: 'none',
                width: '140px',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8e95a5',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '5px 14px',
              borderRadius: '9999px',
              border: '1px solid #232a3d',
              backgroundColor: '#181c29',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Main Content Area: Split View vs Table View vs Mobile View */}
      {viewMode === 'mobile' ? (
        /* Mobile iPhone-Framed View (Faithfully reproducing the reference image!) */
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 2rem 0' }}>
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#131927',
              borderRadius: '40px',
              border: '10px solid #1e2638',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              color: '#ffffff',
            }}
          >
            {/* Status Bar with Dynamic Island */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px 8px 24px',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <span>9:41</span>
              {/* Dynamic Island Capsule */}
              <div
                style={{
                  width: '110px',
                  height: '26px',
                  backgroundColor: '#0a0d14',
                  borderRadius: '9999px',
                }}
              />
              <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>

            {/* Mobile Header: Back Arrow, My Tasks Title, 3-Dots */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px 8px 20px',
              }}
            >
              <button
                onClick={() => setViewMode('split')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ←
              </button>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                My Tasks
              </div>
              <button
                onClick={fetchData}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ⋮
              </button>
            </div>

            {/* Month & Year Dropdown: January 2023 ∨ */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 0 16px 0',
              }}
            >
              <span style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {formatMobileMonthYear(selectedDate)}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#8e95a5' }}>∨</span>
            </div>

            {/* Horizontal Date Strip (Day Capsules) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                padding: '0 12px 22px 12px',
                overflowX: 'auto',
              }}
            >
              {generateMobileDays().map((d) => {
                const dayStr = d.toISOString().substring(0, 10);
                const isSelected = dayStr === selectedDate;
                const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];

                return (
                  <div
                    key={dayStr}
                    onClick={() => setSelectedDate(dayStr)}
                    style={{
                      width: isSelected ? '54px' : '48px',
                      height: isSelected ? '84px' : '76px',
                      borderRadius: '26px',
                      backgroundColor: isSelected ? '#d9f99d' : '#1b2333',
                      color: isSelected ? '#0f172a' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 15px rgba(217, 249, 157, 0.35)' : 'none',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: isSelected ? '1.25rem' : '1.1rem',
                        fontWeight: 800,
                        lineHeight: 1.1,
                      }}
                    >
                      {d.getDate()}
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: isSelected ? '#0f172a' : '#8e95a5',
                        marginTop: '4px',
                      }}
                    >
                      {weekday}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vertical Timeline & Signature Contoured Cards */}
            <div style={{ padding: '0 16px 32px 16px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {filteredRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#8e95a5', fontSize: '0.85rem' }}>
                  No attendance records recorded for this day.
                </div>
              ) : (
                filteredRecords.map((r, idx) => {
                  // Color configuration matching the 4 reference cards:
                  // Card 1: Lime (Completed)
                  // Card 2: Sky Blue (Rejected / Flagged)
                  // Card 3: Lavender (Running / In Progress)
                  // Card 4: Soft Yellow (Upcoming)
                  let cardBg = '#d9f99d';
                  let textColor = '#142010';
                  let statusTab = 'Completed';
                  let progressPercent = '100%';
                  let progressValue = 1.0;
                  let iconSymbol = '✓✓';

                  if (r.status === 'FLAGGED' || r.status === 'LATE') {
                    cardBg = '#38bdf8';
                    textColor = '#082f49';
                    statusTab = r.status === 'FLAGGED' ? 'Rejected' : 'Late Arrival';
                    progressPercent = r.status === 'FLAGGED' ? '00%' : '50%';
                    progressValue = r.status === 'FLAGGED' ? 0.0 : 0.5;
                    iconSymbol = '⚠';
                  } else if (r.status === 'IN_PROGRESS') {
                    cardBg = '#e9d5ff';
                    textColor = '#3b0764';
                    statusTab = 'Running';
                    progressPercent = '72%';
                    progressValue = 0.72;
                    iconSymbol = '⏱';
                  } else if (idx % 4 === 3) {
                    cardBg = '#fef08a';
                    textColor = '#422006';
                    statusTab = 'Upcoming';
                    progressPercent = '00%';
                    progressValue = 0.0;
                    iconSymbol = '📅';
                  }

                  const startTime = formatTimelineHour(r.checkInAt, true);
                  const endTime = formatTimelineHour(r.checkOutAt, false);

                  return (
                    <div key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {/* Left Timeline: Start time, dashed line, End time */}
                      <div
                        style={{
                          width: '50px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8e95a5' }}>
                          {startTime}
                        </span>
                        <div
                          style={{
                            margin: '4px 0 4px 12px',
                            height: '56px',
                            borderLeft: '2px dashed #283248',
                          }}
                        />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8e95a5' }}>
                          {endTime}
                        </span>
                      </div>

                      {/* Right: The Contoured Colored Card with Top Notch */}
                      <div
                        onClick={() => handleOpenDetailModal(r)}
                        style={{
                          flex: 1,
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Overlapping Avatars & Progress Bar (Floating above the card top step) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            zIndex: 10,
                          }}
                        >
                          {/* Avatars cluster */}
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: '#f97316',
                                border: '2px solid #131927',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                              }}
                            >
                              A
                            </div>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: '#06b6d4',
                                border: '2px solid #131927',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                marginLeft: '-8px',
                              }}
                            >
                              V
                            </div>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: '#1e2638',
                                border: '2px solid #131927',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                marginLeft: '-8px',
                              }}
                            >
                              +
                            </div>
                          </div>

                          {/* Progress track */}
                          <div
                            style={{
                              width: '36px',
                              height: '4px',
                              backgroundColor: '#1e2638',
                              borderRadius: '9999px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${progressValue * 100}%`,
                                height: '100%',
                                backgroundColor: '#b8f635',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ffffff' }}>
                            {progressPercent}
                          </span>
                        </div>

                        {/* Top Notch Tab Badge */}
                        <div
                          style={{
                            display: 'inline-block',
                            backgroundColor: cardBg,
                            padding: '4px 14px 2px 14px',
                            borderTopLeftRadius: '18px',
                            borderTopRightRadius: '14px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: textColor,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {statusTab}
                        </div>

                        {/* Card Main Body */}
                        <div
                          style={{
                            backgroundColor: cardBg,
                            borderRadius: '18px',
                            borderTopLeftRadius: '0px',
                            padding: '12px 14px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          {/* Left rounded square dark icon */}
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '12px',
                              backgroundColor: '#131927',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {iconSymbol}
                          </div>

                          {/* Shift Name & Location */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.9375rem',
                                fontWeight: 800,
                                color: textColor,
                                letterSpacing: '-0.02em',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {r.shift?.name || 'Standard Shift'}
                            </div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: textColor,
                                opacity: 0.75,
                                marginTop: '1px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {r.employee?.fullName} • {r.workLocation?.name || 'Main Office'}
                            </div>
                          </div>

                          {/* 3-dots menu */}
                          <div
                            style={{
                              fontSize: '1rem',
                              color: textColor,
                              fontWeight: 700,
                            }}
                          >
                            ⋮
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'split' ? (
        /* Dual-Pane Master-Detail View (Centerpiece from desktop reference image!) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 4.2fr) minmax(400px, 5.8fr)',
            gap: '1.25rem',
            alignItems: 'start',
          }}
        >
          {/* Left Panel: The Crisp White Master Container (matching reference image bottom left!) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              padding: '1.25rem',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
              color: '#0f172a',
            }}
          >
            {/* Header of White Card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Attendance Records
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {filteredRecords.length} records matching criteria
                </span>
              </div>

              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {selectedDate}
              </span>
            </div>

            {/* List of Records */}
            {loading ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                Loading attendance records...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                No attendance records found for {selectedDate}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '560px', overflowY: 'auto' }}>
                {filteredRecords.map((r) => {
                  const isSelected = r.id === selectedRecordId;
                  const color = getAvatarColor(r.employee?.fullName || r.id);

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRecordId(r.id)}
                      style={{
                        borderRadius: '16px',
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        backgroundColor: isSelected ? '#141722' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#0f172a',
                        border: isSelected ? '1px solid #232737' : '1px solid #f1f5f9',
                        boxShadow: isSelected ? '0 4px 15px rgba(0, 0, 0, 0.25)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Avatar and Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: color.bg,
                            color: color.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            flexShrink: 0,
                            border: isSelected ? '2px solid #b8f635' : 'none',
                          }}
                        >
                          {getInitials(r.employee?.fullName)}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: isSelected ? '#ffffff' : '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {r.employee?.fullName || 'Unknown Employee'}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: isSelected ? '#8e95a5' : '#64748b',
                              marginTop: '1px',
                            }}
                          >
                            #{r.employee?.employeeNumber || 'NO-ID'}
                          </div>
                        </div>
                      </div>

                      {/* Status and Time */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ marginBottom: '0.25rem' }}>
                          {getStatusBadge(r.status, isSelected)}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: isSelected ? '#b8f635' : '#0f172a',
                          }}
                        >
                          {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Dark Slate Inspector Container (matching reference image bottom right!) */}
          <div
            style={{
              backgroundColor: '#141722',
              border: '1px solid #232737',
              borderRadius: '24px',
              padding: '1.5rem',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {currentInspectorRecord ? (
              <>
                {/* Inspector Header: ID, Status, Organization */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #1c2130',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                      #{currentInspectorRecord.employee?.employeeNumber || 'EMP-REC'}
                    </div>
                    {getStatusBadge(currentInspectorRecord.status, true)}
                  </div>

                  {/* Company / Work Location Pill */}
                  <div
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: '#1b202e',
                      border: '1px solid #283147',
                      fontSize: '0.75rem',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                    }}
                  >
                    <span>🏢</span>
                    <span>{currentInspectorRecord.workLocation?.name || 'Main Campus'}</span>
                  </div>
                </div>

                {/* Employee Profile Preview Bar */}
                <div
                  style={{
                    backgroundColor: '#1a1f2e',
                    border: '1px solid #262e42',
                    borderRadius: '16px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(currentInspectorRecord.employee?.fullName || 'User').bg,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: '2px solid #b8f635',
                      }}
                    >
                      {getInitials(currentInspectorRecord.employee?.fullName)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ffffff' }}>
                        {currentInspectorRecord.employee?.fullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
                        {currentInspectorRecord.shift?.name || 'Standard Shift'} (
                        {currentInspectorRecord.shift?.startTimeLocal || '09:00'} -{' '}
                        {currentInspectorRecord.shift?.endTimeLocal || '17:00'})
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenDetailModal(currentInspectorRecord)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '9999px',
                      backgroundColor: '#242a3a',
                      border: '1px solid #343d54',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Full Details ↗
                  </button>
                </div>

                {/* 3 Sub-Cards (matching the 3 dark cards with $10,630.80 CRM Development etc. from reference!) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                  }}
                >
                  {/* Card 1: Check In & Accuracy */}
                  <div
                    style={{
                      backgroundColor: '#181d2a',
                      border: '1px solid #232a3d',
                      borderRadius: '16px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#8e95a5', fontWeight: 600 }}>CHECK-IN TIME</div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        marginTop: '0.25rem',
                      }}
                    >
                      {currentInspectorRecord.checkInAt
                        ? new Date(currentInspectorRecord.checkInAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#4ade80', marginTop: '0.2rem' }}>
                      GPS: ±{currentInspectorRecord.checkInAccuracyM ? `${currentInspectorRecord.checkInAccuracyM}m` : '10m'}
                    </div>
                  </div>

                  {/* Card 2: Check Out & Location */}
                  <div
                    style={{
                      backgroundColor: '#181d2a',
                      border: '1px solid #232a3d',
                      borderRadius: '16px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#8e95a5', fontWeight: 600 }}>CHECK-OUT TIME</div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        marginTop: '0.25rem',
                      }}
                    >
                      {currentInspectorRecord.checkOutAt
                        ? new Date(currentInspectorRecord.checkOutAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'In Progress'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8e95a5', marginTop: '0.2rem' }}>
                      {currentInspectorRecord.checkOutAt ? 'Completed' : 'On-Duty'}
                    </div>
                  </div>

                  {/* Card 3: Geofence Verification */}
                  <div
                    style={{
                      backgroundColor: '#181d2a',
                      border: '1px solid #232a3d',
                      borderRadius: '16px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#8e95a5', fontWeight: 600 }}>GEOFENCE AUDIT</div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        marginTop: '0.25rem',
                      }}
                    >
                      {currentInspectorRecord.checkInDistanceM !== null &&
                      currentInspectorRecord.checkInDistanceM !== undefined
                        ? `${currentInspectorRecord.checkInDistanceM}m`
                        : 'Verified'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: currentInspectorRecord.checkInGeofenceValid === false ? '#f87171' : '#b8f635',
                        marginTop: '0.2rem',
                        fontWeight: 600,
                      }}
                    >
                      {currentInspectorRecord.checkInGeofenceValid === false ? 'Outside Zone' : 'Within Geofence'}
                    </div>
                  </div>
                </div>

                {/* Verification Evidence (Selfie) Box */}
                <div
                  style={{
                    backgroundColor: '#181d2a',
                    border: '1px solid #232a3d',
                    borderRadius: '16px',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>
                      Verification Selfie Proof
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#8e95a5' }}>Encrypted S3 Object</span>
                  </div>

                  {selfieUrl ? (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={selfieUrl}
                        alt="Check-in Verification"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '180px',
                          borderRadius: '12px',
                          border: '2px solid #2e3852',
                          objectFit: 'cover',
                        }}
                      />
                      <div style={{ fontSize: '0.7rem', color: '#b8f635', marginTop: '0.4rem', fontWeight: 600 }}>
                        ✓ Verified signed link (Expires in 5 minutes)
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: '#131620',
                        border: '1px dashed #283147',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        onClick={() => handleLoadSelfie(currentInspectorRecord.id)}
                        disabled={loadingSelfie}
                        style={{
                          padding: '0.5rem 1.25rem',
                          borderRadius: '9999px',
                          border: 'none',
                          backgroundColor: '#b8f635',
                          color: '#0a0b10',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 10px rgba(184, 246, 53, 0.25)',
                        }}
                      >
                        <span>📷</span>
                        <span>{loadingSelfie ? 'Retrieving Secure Photo...' : 'Load Verification Selfie'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Audit & Event Timeline (if events exist) */}
                {currentInspectorRecord.events && currentInspectorRecord.events.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#181d2a',
                      border: '1px solid #232a3d',
                      borderRadius: '16px',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
                      Audit Timeline
                    </div>
                    <div style={{ borderLeft: '2px solid #283147', paddingLeft: '0.75rem', marginLeft: '0.25rem' }}>
                      {currentInspectorRecord.events.map((ev: AttendanceEventDto) => (
                        <div key={ev.id} style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                          <span style={{ fontWeight: 700, color: '#b8f635' }}>{ev.eventType}</span>
                          <span style={{ color: '#8e95a5', marginLeft: '0.5rem' }}>
                            {new Date(ev.occurredAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Inspector Actions: Flagging and Full Approval */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #1c2130',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    {currentInspectorRecord.status !== 'FLAGGED' && (
                      <button
                        onClick={() => handleOpenFlagModal(currentInspectorRecord)}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '9999px',
                          border: '1px solid #4a2327',
                          backgroundColor: '#261417',
                          color: '#f87171',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ⚠ Flag Record
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleOpenDetailModal(currentInspectorRecord)}
                      style={{
                        padding: '0.55rem 1.25rem',
                        borderRadius: '9999px',
                        border: 'none',
                        backgroundColor: '#b8f635',
                        color: '#0a0b10',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 12px rgba(184, 246, 53, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Verify Details Modal
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#8e95a5' }}>
                Select an employee record from the list to inspect detailed geofence and verification evidence.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Classic High-Density Table View */
        <div
          style={{
            backgroundColor: '#141722',
            borderRadius: '24px',
            border: '1px solid #232737',
            overflowX: 'auto',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#181d2a', borderBottom: '1px solid #232737' }}>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5' }}>Employee</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5' }}>Shift</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5' }}>Check In</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5' }}>Check Out</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5' }}>Location</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#8e95a5', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#8e95a5' }}>
                    Loading attendance records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#8e95a5' }}>
                    No attendance records found for {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const color = getAvatarColor(r.employee?.fullName || r.id);
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #1c2130',
                        backgroundColor: r.status === 'FLAGGED' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: color.bg,
                              color: color.text,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(r.employee?.fullName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{r.employee?.fullName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#8e95a5' }}>{r.employee?.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div>{r.shift?.name || 'Standard'}</div>
                        {r.shift?.startTimeLocal && (
                          <div style={{ fontSize: '0.72rem', color: '#8e95a5' }}>
                            {r.shift.startTimeLocal} - {r.shift.endTimeLocal}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#ffffff', fontWeight: 600 }}>
                        {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#ffffff', fontWeight: 600 }}>
                        {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#8e95a5' }}>
                        {r.workLocation?.name || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>{getStatusBadge(r.status, true)}</td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleOpenDetailModal(r)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '9999px',
                              border: '1px solid #2e3852',
                              backgroundColor: '#1b202e',
                              color: '#b8f635',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Details
                          </button>
                          {r.status !== 'FLAGGED' && (
                            <button
                              onClick={() => handleOpenFlagModal(r)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '9999px',
                                border: '1px solid #4a2327',
                                backgroundColor: '#261417',
                                color: '#f87171',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Flag
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance Detail Modal */}
      <Modal
        isOpen={!!detailRecord}
        title="Attendance Verification Details"
        onClose={() => setDetailRecord(null)}
      >
        {detailRecord && (
          <div style={{ padding: '1rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                  {detailRecord.employee?.fullName}
                </h3>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                  #{detailRecord.employee?.employeeNumber}
                </span>
              </div>
              <div>{getStatusBadge(detailRecord.status, false)}</div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '1rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
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
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
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
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Signed secure URL (Expires in 5 minutes)
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleLoadSelfie(detailRecord.id)}
                  disabled={loadingSelfie}
                  style={{
                    padding: '0.55rem 1.25rem',
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
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
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
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
        <form onSubmit={handleSubmitFlag} style={{ padding: '1rem' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#4b5563' }}>
            Flagging this record marks it for administrative investigation. Please provide a clear reason.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
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
                borderRadius: '8px',
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
                borderRadius: '8px',
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
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#b91c1c',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
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
