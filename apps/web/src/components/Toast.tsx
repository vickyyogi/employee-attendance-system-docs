import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '400px',
      }}
    >
      {toasts.map((toast) => {
        const bg =
          toast.type === 'success'
            ? '#10b981'
            : toast.type === 'error'
            ? '#ef4444'
            : '#3b82f6';

        return (
          <div
            key={toast.id}
            style={{
              backgroundColor: bg,
              color: '#ffffff',
              padding: '0.75rem 1.25rem',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                marginLeft: '1rem',
                fontSize: '1.125rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};
