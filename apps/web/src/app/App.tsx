import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, ActiveTab } from '../components/Navbar';
import { Toast, ToastMessage } from '../components/Toast';
import { EmployeeList } from '../features/employees/EmployeeList';
import { DepartmentList } from '../features/departments/DepartmentList';
import { PositionList } from '../features/positions/PositionList';
import { AttendanceDashboard } from '../features/dashboard/AttendanceDashboard';
import { ApprovalQueue } from '../features/approvals/ApprovalQueue';
import { ReportsView } from '../features/reports/ReportsView';
import { LoginModal, LoginSuccessData } from '../features/auth/LoginModal';
import { apiClient } from '../api/client';

const getStorageItem = (key: string): string | null => {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
};

const removeStorageItem = (key: string): void => {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(getStorageItem('auth_access_token'));
  });
  const [companyName, setCompanyName] = useState<string>(() => {
    return getStorageItem('auth_company_name') || 'Acme Corporation';
  });
  const [role, setRole] = useState<string>(() => {
    return getStorageItem('auth_role') || 'HR_ADMIN';
  });
  const [userEmail, setUserEmail] = useState<string | undefined>(() => {
    return getStorageItem('auth_user_email') || undefined;
  });
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return getStorageItem('auth_user_id') || '00000000-0000-0000-0000-000000000001';
  });

  // Sync token to apiClient on mount
  useEffect(() => {
    const token = getStorageItem('auth_access_token');
    const companyId = getStorageItem('auth_company_id');
    if (token) {
      apiClient.setToken(token);
    }
    if (companyId) {
      apiClient.setCompanyId(companyId);
    }
  }, []);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleLoginSuccess = (data: LoginSuccessData) => {
    setStorageItem('auth_access_token', data.token);
    setStorageItem('auth_company_id', data.companyId);
    setStorageItem('auth_company_name', data.companyName);
    setStorageItem('auth_role', data.role);
    setStorageItem('auth_user_email', data.userEmail);
    setStorageItem('auth_user_id', data.userId);

    apiClient.setToken(data.token);
    apiClient.setCompanyId(data.companyId);

    setIsLoggedIn(true);
    setCompanyName(data.companyName);
    setRole(data.role);
    setUserEmail(data.userEmail);
    setCurrentUserId(data.userId);
  };

  const handleLogout = () => {
    removeStorageItem('auth_access_token');
    removeStorageItem('auth_company_id');
    removeStorageItem('auth_company_name');
    removeStorageItem('auth_role');
    removeStorageItem('auth_user_email');
    removeStorageItem('auth_user_id');

    apiClient.setToken(null);
    apiClient.setCompanyId(null);

    setIsLoggedIn(false);
    setUserEmail(undefined);
    setCompanyName('Acme Corporation');
    setRole('GUEST');

    notify('info', 'You have been signed out.');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0b10',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#ffffff',
      }}
    >
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        companyName={companyName}
        role={role}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
      />

      <main style={{ maxWidth: '1320px', margin: '0 auto', padding: '1.75rem 1.5rem' }}>
        {!isLoggedIn && (
          <div
            style={{
              backgroundColor: '#151926',
              border: '1px solid #232d42',
              borderRadius: '16px',
              padding: '1.15rem 1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: '#b8f635', fontSize: '0.9375rem' }}>
                You are currently in guest mode
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Sign in with an HR Admin or demo account to view live attendance records, review approvals, and manage company data.
              </div>
            </div>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                backgroundColor: '#b8f635',
                color: '#0a0b10',
                border: 'none',
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(184, 246, 53, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In with Demo Account
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <AttendanceDashboard
            key={`${currentUserId}-${isLoggedIn}`}
            onNotify={notify}
            onNavigateToApprovals={() => setActiveTab('approvals')}
          />
        )}
        {activeTab === 'approvals' && (
          <ApprovalQueue
            key={`${currentUserId}-${isLoggedIn}`}
            currentUserId={currentUserId}
            onNotify={notify}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsView
            key={`${currentUserId}-${isLoggedIn}`}
            onNotify={notify}
          />
        )}
        {activeTab === 'employees' && (
          <EmployeeList
            key={`${currentUserId}-${isLoggedIn}`}
            onNotify={notify}
          />
        )}
        {activeTab === 'departments' && (
          <DepartmentList
            key={`${currentUserId}-${isLoggedIn}`}
            onNotify={notify}
          />
        )}
        {activeTab === 'positions' && (
          <PositionList
            key={`${currentUserId}-${isLoggedIn}`}
            onNotify={notify}
          />
        )}
      </main>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
        onNotify={notify}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
