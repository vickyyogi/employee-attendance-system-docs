import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { apiClient } from '../../api/client';

export interface LoginSuccessData {
  token: string;
  companyId: string;
  companyName: string;
  role: string;
  userEmail: string;
  userId: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: LoginSuccessData) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onNotify,
}) => {
  const [email, setEmail] = useState('hr.acme@example.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent, overrideEmail?: string, overridePassword?: string) => {
    if (e) e.preventDefault();
    const loginEmail = (overrideEmail || email).trim();
    const loginPassword = overridePassword || password;

    if (!loginEmail || !loginPassword) {
      setErrorMessage('Please provide both email and password');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const loginRes = await apiClient.login(loginEmail, loginPassword);
      const token = loginRes.data.tokens.accessToken;
      const user = loginRes.data.user;

      // Fetch user profile and memberships
      const meRes = await apiClient.getMe();
      const memberships = meRes.data.memberships || [];

      let companyId = '';
      let companyName = 'Acme Corporation';
      let role = 'HR_ADMIN';

      if (memberships.length > 0) {
        const primary = memberships[0];
        companyId = primary.companyId;
        companyName = primary.companyName;
        role = primary.role;

        // Activate company tenant scope
        const selRes = await apiClient.selectActiveCompany(primary.companyId);
        if (selRes.data.activeCompany) {
          role = selRes.data.activeCompany.role;
          companyName = selRes.data.activeCompany.name;
        }
      }

      onNotify('success', `Signed in as ${user.fullName} (${role})`);
      onSuccess({
        token,
        companyId,
        companyName,
        role,
        userEmail: user.email,
        userId: user.id,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check credentials.';
      setErrorMessage(msg);
      onNotify('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('Password123!');
    handleSubmit(undefined, quickEmail, 'Password123!');
  };

  return (
    <Modal isOpen={isOpen} title="Sign In to Attendance Portal" onClose={onClose}>
      <form onSubmit={(e) => handleSubmit(e)}>
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #f87171',
              borderRadius: '6px',
              color: '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}
          >
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}
          >
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1.25rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#1d4ed8',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Quick Demo Accounts (Password: Password123!)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('hr.acme@example.com')}
              disabled={loading}
              style={{
                padding: '0.35rem 0.65rem',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#1d4ed8',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              HR Admin (Acme)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin.acme@example.com')}
              disabled={loading}
              style={{
                padding: '0.35rem 0.65rem',
                backgroundColor: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#6d28d9',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Company Admin (Acme)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('employee.acme@example.com')}
              disabled={loading}
              style={{
                padding: '0.35rem 0.65rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#15803d',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Employee (Acme)
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
