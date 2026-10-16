import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';
import { Navbar } from '../components/Navbar';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { DepartmentModal } from '../features/departments/DepartmentModal';
import { PositionModal } from '../features/positions/PositionModal';
import { EmployeeModal } from '../features/employees/EmployeeModal';
import { EmployeeStatusModal } from '../features/employees/EmployeeStatusModal';
import { EmployeeDetailModal } from '../features/employees/EmployeeDetailModal';
import { AttendanceDashboard } from '../features/dashboard/AttendanceDashboard';
import { ApprovalQueue } from '../features/approvals/ApprovalQueue';
import { ReportsView } from '../features/reports/ReportsView';

describe('Web UI Components (Stage 5 & Stage 11)', () => {
  it('App renders brand title, navigation tabs, and initial layout', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Attendance System');
    expect(html).toContain('Employees');
    expect(html).toContain('Departments');
    expect(html).toContain('Positions');
    expect(html).toContain('Acme Corporation');
  });

  it('Navbar renders navigation tabs and highlights active tab', () => {
    const html = renderToStaticMarkup(
      <Navbar
        activeTab="departments"
        onSelectTab={vi.fn()}
        companyName="Test Corp"
        role="HR_ADMIN"
      />
    );
    expect(html).toContain('Test Corp');
    expect(html).toContain('HR_ADMIN');
    expect(html).toContain('Departments');
  });

  it('Modal renders title, content, and close button when open', () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={true} title="Test Modal" onClose={vi.fn()}>
        <p>Modal body content</p>
      </Modal>
    );
    expect(html).toContain('Test Modal');
    expect(html).toContain('Modal body content');
  });

  it('Modal renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={false} title="Hidden Modal" onClose={vi.fn()}>
        <p>Hidden content</p>
      </Modal>
    );
    expect(html).toBe('');
  });

  it('Toast renders messages and notification badges', () => {
    const html = renderToStaticMarkup(
      <Toast
        toasts={[
          { id: '1', type: 'success', message: 'Employee added successfully' },
          { id: '2', type: 'error', message: 'Failed to update department' },
        ]}
        onDismiss={vi.fn()}
      />
    );
    expect(html).toContain('Employee added successfully');
    expect(html).toContain('Failed to update department');
  });

  it('DepartmentModal renders create and edit form fields', () => {
    const createHtml = renderToStaticMarkup(
      <DepartmentModal
        isOpen={true}
        department={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(createHtml).toContain('Add Department');
    expect(createHtml).toContain('Department Name *');
    expect(createHtml).toContain('Department Code (Optional)');

    const editHtml = renderToStaticMarkup(
      <DepartmentModal
        isOpen={true}
        department={{
          id: 'dept-1',
          companyId: 'comp-1',
          name: 'Finance',
          code: 'FIN',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(editHtml).toContain('Edit Department');
    expect(editHtml).toContain('Finance');
    expect(editHtml).toContain('FIN');
  });

  it('PositionModal renders position name and status inputs', () => {
    const html = renderToStaticMarkup(
      <PositionModal
        isOpen={true}
        position={{
          id: 'pos-1',
          companyId: 'comp-1',
          name: 'Lead Designer',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Edit Position');
    expect(html).toContain('Position Title *');
    expect(html).toContain('Lead Designer');
  });

  it('EmployeeModal renders all input fields and selection options', () => {
    const html = renderToStaticMarkup(
      <EmployeeModal
        isOpen={true}
        employee={null}
        departments={[{ id: 'd1', companyId: 'c1', name: 'HR', code: 'HR', status: 'ACTIVE', createdAt: '', updatedAt: '' }]}
        positions={[{ id: 'p1', companyId: 'c1', name: 'Manager', status: 'ACTIVE', createdAt: '', updatedAt: '' }]}
        managers={[{
          id: 'm1',
          companyId: 'c1',
          employeeNumber: 'MGR-01',
          fullName: 'Boss Man',
          employmentStatus: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        }]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Add New Employee');
    expect(html).toContain('Employee Number *');
    expect(html).toContain('Full Name *');
    expect(html).toContain('HR (HR)');
    expect(html).toContain('Manager');
    expect(html).toContain('Boss Man (MGR-01)');
  });

  it('EmployeeStatusModal renders status selector and termination date', () => {
    const html = renderToStaticMarkup(
      <EmployeeStatusModal
        isOpen={true}
        employee={{
          id: 'e1',
          companyId: 'c1',
          employeeNumber: 'EMP-100',
          fullName: 'John Smith',
          employmentStatus: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Update Status: John Smith (EMP-100)');
    expect(html).toContain('Employment Status *');
    expect(html).toContain('ACTIVE');
    expect(html).toContain('INACTIVE');
    expect(html).toContain('TERMINATED');
  });

  it('EmployeeDetailModal renders full profile information', () => {
    const html = renderToStaticMarkup(
      <EmployeeDetailModal
        isOpen={true}
        employee={{
          id: 'e1',
          companyId: 'c1',
          employeeNumber: 'EMP-777',
          fullName: 'Sarah Connor',
          email: 'sarah@example.com',
          phone: '+628111222333',
          department: { id: 'd1', name: 'Security', code: 'SEC' },
          position: { id: 'p1', name: 'Operations Lead' },
          employmentStatus: 'ACTIVE',
          hireDate: '2023-04-01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        onClose={vi.fn()}
      />
    );
    expect(html).toContain('Employee: Sarah Connor');
    expect(html).toContain('EMP-777');
    expect(html).toContain('sarah@example.com');
    expect(html).toContain('Security (SEC)');
    expect(html).toContain('Operations Lead');
    expect(html).toContain('ACTIVE');
  });

  it('Navbar renders all Stage 11 tabs including Dashboard, Approvals, and Reports', () => {
    const html = renderToStaticMarkup(
      <Navbar
        activeTab="dashboard"
        onSelectTab={vi.fn()}
        companyName="Acme Corp"
        role="HR_ADMIN"
      />
    );
    expect(html).toContain('Dashboard');
    expect(html).toContain('Approvals');
    expect(html).toContain('Reports');
    expect(html).toContain('Employees');
    expect(html).toContain('Departments');
    expect(html).toContain('Positions');
  });

  it('AttendanceDashboard renders summary cards, date filter, and table layout', () => {
    const html = renderToStaticMarkup(
      <AttendanceDashboard onNotify={vi.fn()} onNavigateToApprovals={vi.fn()} />
    );
    expect(html).toContain('Attendance Dashboard');
    expect(html).toContain('Total Today');
    expect(html).toContain('Present / Completed');
    expect(html).toContain('Late Arrivals');
    expect(html).toContain('In Progress');
    expect(html).toContain('Pending Approvals');
    expect(html).toContain('Work Date');
    expect(html).toContain('Status Filter');
  });

  it('ApprovalQueue renders request categories and empty approval state', () => {
    const html = renderToStaticMarkup(
      <ApprovalQueue currentUserId="user-1" onNotify={vi.fn()} />
    );
    expect(html).toContain('Approval Queue');
    expect(html).toContain('All Requests');
    expect(html).toContain('Leave Requests');
    expect(html).toContain('Attendance Corrections');
  });

  it('ReportsView renders date range selectors, export controls, and analytics headers', () => {
    const html = renderToStaticMarkup(<ReportsView onNotify={vi.fn()} />);
    expect(html).toContain('Attendance Reports &amp; Analytics');
    expect(html).toContain('Start Date');
    expect(html).toContain('End Date');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Export JSON');
    expect(html).toContain('Daily Breakdown');
    expect(html).toContain('Late Arrivals');
  });
});
