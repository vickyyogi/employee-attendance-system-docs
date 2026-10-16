import React, { useState } from 'react';
import { Navbar, ActiveTab } from '../components/Navbar';
import { Toast, ToastMessage } from '../components/Toast';
import { EmployeeList } from '../features/employees/EmployeeList';
import { DepartmentList } from '../features/departments/DepartmentList';
import { PositionList } from '../features/positions/PositionList';
import { AttendanceDashboard } from '../features/dashboard/AttendanceDashboard';
import { ApprovalQueue } from '../features/approvals/ApprovalQueue';
import { ReportsView } from '../features/reports/ReportsView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [companyName] = useState('Acme Corporation');
  const [role] = useState('HR_ADMIN');
  const [currentUserId] = useState<string>('00000000-0000-0000-0000-000000000001');

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#111827',
      }}
    >
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        companyName={companyName}
        role={role}
      />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {activeTab === 'dashboard' && (
          <AttendanceDashboard
            onNotify={notify}
            onNavigateToApprovals={() => setActiveTab('approvals')}
          />
        )}
        {activeTab === 'approvals' && (
          <ApprovalQueue currentUserId={currentUserId} onNotify={notify} />
        )}
        {activeTab === 'reports' && <ReportsView onNotify={notify} />}
        {activeTab === 'employees' && <EmployeeList onNotify={notify} />}
        {activeTab === 'departments' && <DepartmentList onNotify={notify} />}
        {activeTab === 'positions' && <PositionList onNotify={notify} />}
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
