import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import type {
  EmployeeDto,
  DepartmentDto,
  PositionDto,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from '@attendance/api-contracts';

interface EmployeeModalProps {
  isOpen: boolean;
  employee: EmployeeDto | null;
  departments: DepartmentDto[];
  positions: PositionDto[];
  managers: EmployeeDto[];
  onClose: () => void;
  onSubmit: (data: CreateEmployeeRequest | UpdateEmployeeRequest) => Promise<void>;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  employee,
  departments,
  positions,
  managers,
  onClose,
  onSubmit,
}) => {
  const [employeeNumber, setEmployeeNumber] = useState(employee?.employeeNumber || '');
  const [fullName, setFullName] = useState(employee?.fullName || '');
  const [email, setEmail] = useState(employee?.email || '');
  const [phone, setPhone] = useState(employee?.phone || '');
  const [departmentId, setDepartmentId] = useState(employee?.departmentId || '');
  const [positionId, setPositionId] = useState(employee?.positionId || '');
  const [managerEmployeeId, setManagerEmployeeId] = useState(employee?.managerEmployeeId || '');
  const [hireDate, setHireDate] = useState(employee?.hireDate ? employee.hireDate.split('T')[0] : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmployeeNumber(employee?.employeeNumber || '');
    setFullName(employee?.fullName || '');
    setEmail(employee?.email || '');
    setPhone(employee?.phone || '');
    setDepartmentId(employee?.departmentId || '');
    setPositionId(employee?.positionId || '');
    setManagerEmployeeId(employee?.managerEmployeeId || '');
    setHireDate(employee?.hireDate ? employee.hireDate.split('T')[0] : '');
    setError(null);
  }, [employee, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee && !employeeNumber.trim()) {
      setError('Employee number is required');
      return;
    }
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (employee) {
        const updateData: UpdateEmployeeRequest = {
          fullName: fullName.trim(),
          email: email.trim() ? email.trim() : null,
          phone: phone.trim() ? phone.trim() : null,
          departmentId: departmentId ? departmentId : null,
          positionId: positionId ? positionId : null,
          managerEmployeeId: managerEmployeeId ? managerEmployeeId : null,
          hireDate: hireDate ? hireDate : null,
        };
        await onSubmit(updateData);
      } else {
        const createData: CreateEmployeeRequest = {
          employeeNumber: employeeNumber.trim(),
          fullName: fullName.trim(),
          email: email.trim() ? email.trim() : undefined,
          phone: phone.trim() ? phone.trim() : undefined,
          departmentId: departmentId ? departmentId : undefined,
          positionId: positionId ? positionId : undefined,
          managerEmployeeId: managerEmployeeId ? managerEmployeeId : undefined,
          hireDate: hireDate ? hireDate : undefined,
        };
        await onSubmit(createData);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  // Filter out self from manager candidates
  const availableManagers = managers.filter((m) => !employee || m.id !== employee.id);

  return (
    <Modal
      isOpen={isOpen}
      title={employee ? `Edit Employee (${employee.employeeNumber})` : 'Add New Employee'}
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
            Employee Number *
          </label>
          <input
            type="text"
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            disabled={!!employee}
            placeholder="e.g. EMP-001"
            required
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: employee ? '#f3f4f6' : '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
            Full Name *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. John Doe"
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@example.com"
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
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +62812345678"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.code ? `(${d.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Position
            </label>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Select Position</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Manager (Reporting To)
            </label>
            <select
              value={managerEmployeeId}
              onChange={(e) => setManagerEmployeeId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            >
              <option value="">None (Top Level)</option>
              {availableManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.employeeNumber})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Hire Date
            </label>
            <input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

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
            {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
