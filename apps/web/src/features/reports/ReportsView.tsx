import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../api/client';
import type {
  AttendanceSummaryReportDto,
  LateArrivalReportDto,
} from '@attendance/api-contracts';

interface ReportsViewProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const getTodayString = () => new Date().toISOString().substring(0, 10);

export const ReportsView: React.FC<ReportsViewProps> = ({ onNotify }) => {
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<string>(getTodayString());

  const [summary, setSummary] = useState<AttendanceSummaryReportDto | null>(null);
  const [lateArrivals, setLateArrivals] = useState<LateArrivalReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!apiClient.getToken()) {
      setLoading(false);
      return;
    }

    if (startDate > endDate) {
      notifyRef.current('error', 'Start date must be less than or equal to End date');
      return;
    }

    try {
      setLoading(true);
      const [summaryRes, lateRes] = await Promise.all([
        apiClient.getAttendanceSummary(startDate, endDate),
        apiClient.getLateArrivals(startDate, endDate),
      ]);
      setSummary(summaryRes.data);
      setLateArrivals(lateRes.data);
    } catch (err) {
      notifyRef.current('error', err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExport = async (format: 'csv' | 'json') => {
    if (startDate > endDate) {
      notifyRef.current('error', 'Start date must be less than or equal to End date');
      return;
    }

    const setExporting = format === 'csv' ? setExportingCsv : setExportingJson;

    try {
      setExporting(true);
      const res = await apiClient.exportAttendance({
        startDate,
        endDate,
        format,
      });

      const { filename, data, recordCount } = res.data;

      // Trigger browser download
      const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notifyRef.current('success', `Exported ${recordCount} records to ${filename}. Audit log recorded.`);
    } catch (err) {
      notifyRef.current('error', err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
          Attendance Reports & Analytics
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
          Period totals, late arrivals analysis, and permission-controlled data exports
        </p>
      </div>

      {/* Control and Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <button
            onClick={fetchReports}
            disabled={loading}
            style={{
              marginTop: '1.25rem',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Apply Filter'}
          </button>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => handleExport('csv')}
            disabled={exportingCsv || loading}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #16a34a',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {exportingCsv ? 'Exporting...' : 'Export CSV'}
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={exportingJson || loading}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #4b5563',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {exportingJson ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
              Total Records
            </div>
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>
              {summary.totalRecords}
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
              On-Time Present
            </div>
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
              {summary.presentCount}
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
              {summary.lateCount}
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
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7e22ce', textTransform: 'uppercase' }}>
              Corrected Sessions
            </div>
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#7e22ce', marginTop: '0.25rem' }}>
              {summary.correctedCount}
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
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' }}>
              Flagged
            </div>
            <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#b91c1c', marginTop: '0.25rem' }}>
              {summary.flaggedCount}
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout: Daily Breakdown & Late Arrivals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Daily Breakdown */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
            Daily Breakdown
          </h3>
          {summary && summary.dailyBreakdown.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Total</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#15803d' }}>Present</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#b45309' }}>Late</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#7e22ce' }}>Corrected</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.dailyBreakdown.map((row) => (
                    <tr key={row.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{row.date}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{row.total}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#15803d' }}>
                        {row.present}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#b45309' }}>
                        {row.late}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#7e22ce' }}>
                        {row.corrected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
              No breakdown data available for this period.
            </div>
          )}
        </div>

        {/* Late Arrivals List */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
            Late Arrivals ({lateArrivals?.totalLate || 0})
          </h3>
          {lateArrivals && lateArrivals.items.length > 0 ? (
            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Employee</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Check In</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#b45309' }}>
                      Late (min)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lateArrivals.items.map((item) => (
                    <tr key={item.attendanceId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontWeight: 500 }}>{item.employeeName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {item.employeeNumber} {item.departmentName ? `• ${item.departmentName}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#4b5563' }}>{item.workDate}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {new Date(item.checkInAt).toLocaleTimeString()}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#b45309',
                        }}
                      >
                        +{item.lateMinutes}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
              No late arrivals recorded for this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
