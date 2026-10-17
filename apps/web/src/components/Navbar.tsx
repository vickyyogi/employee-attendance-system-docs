import React from 'react';

export type ActiveTab =
  | 'dashboard'
  | 'approvals'
  | 'reports'
  | 'employees'
  | 'departments'
  | 'positions';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  companyName: string;
  role: string;
  isLoggedIn?: boolean;
  userEmail?: string;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  companyName,
  role,
  isLoggedIn = false,
  userEmail,
  onLoginClick,
  onLogoutClick,
}) => {
  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'reports', label: 'Reports' },
    { id: 'employees', label: 'Employees' },
    { id: 'departments', label: 'Departments' },
    { id: 'positions', label: 'Positions' },
  ];

  return (
    <header
      style={{
        backgroundColor: '#0a0b10',
        borderBottom: '1px solid #1a1e2b',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1320px',
          margin: '0 auto',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#151924',
              border: '1px solid #232a3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b8f635',
              fontSize: '1.1rem',
              fontWeight: 800,
            }}
          >
            ✦
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Attendance System
            </h1>
            <span style={{ fontSize: '0.7rem', color: '#8e95a5', letterSpacing: '0.02em' }}>
              HR & Organization Portal
            </span>
          </div>
        </div>

        {/* Center Navigation - Floating White Capsule (matching reference) */}
        <nav
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '9999px',
            padding: '4px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: '9999px',
                  backgroundColor: isActive ? '#b8f635' : 'transparent',
                  color: isActive ? '#0a0b10' : '#4b5563',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {isActive && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#0a0b10',
                    }}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Side: User Profile & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff' }}>
              {companyName}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#8e95a5' }}>
              {userEmail || 'Tenant Scope'}
            </div>
          </div>

          <span
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              backgroundColor: '#151926',
              border: '1px solid #232c42',
              color: '#b8f635',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {role}
          </span>

          {/* User Avatar Circle */}
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: '#1f2536',
              border: '2px solid #b8f635',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {(userEmail ? userEmail[0].toUpperCase() : 'A')}
          </div>

          {isLoggedIn ? (
            <button
              onClick={onLogoutClick}
              style={{
                padding: '0.35rem 0.85rem',
                border: '1px solid #3d2328',
                borderRadius: '9999px',
                backgroundColor: '#1d1215',
                color: '#f87171',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              style={{
                padding: '0.4rem 1rem',
                border: 'none',
                borderRadius: '9999px',
                backgroundColor: '#b8f635',
                color: '#0a0b10',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(184, 246, 53, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
