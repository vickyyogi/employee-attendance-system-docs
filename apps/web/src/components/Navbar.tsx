import React from 'react';

export type ActiveTab = 'employees' | 'departments' | 'positions';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  companyName: string;
  role: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  companyName,
  role,
}) => {
  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'employees', label: 'Employees' },
    { id: 'departments', label: 'Departments' },
    { id: 'positions', label: 'Positions' },
  ];

  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#1e3a8a',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Attendance System
            </h1>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              HR & Organization Portal
            </span>
          </div>

          <nav style={{ display: 'flex', gap: '0.5rem' }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#4b5563',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
              {companyName}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Tenant Scope</div>
          </div>
          <span
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              backgroundColor: '#e0e7ff',
              color: '#3730a3',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {role}
          </span>
        </div>
      </div>
    </header>
  );
};
