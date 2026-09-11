import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    confirm: (options: ConfirmDialogOptions) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global dispatcher
let globalToastDispatcher: ToastContextType['toast'] | null = null;

export const toast = {
  success: (message: string, title?: string, duration?: number) => {
    if (globalToastDispatcher) globalToastDispatcher.success(message, title, duration);
  },
  error: (message: string, title?: string, duration?: number) => {
    if (globalToastDispatcher) globalToastDispatcher.error(message, title, duration);
  },
  warning: (message: string, title?: string, duration?: number) => {
    if (globalToastDispatcher) globalToastDispatcher.warning(message, title, duration);
  },
  info: (message: string, title?: string, duration?: number) => {
    if (globalToastDispatcher) globalToastDispatcher.info(message, title, duration);
  },
  confirm: (options: ConfirmDialogOptions) => {
    if (globalToastDispatcher) globalToastDispatcher.confirm(options);
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeConfirm, setActiveConfirm] = useState<(ConfirmDialogOptions & { id: string }) | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration = 4500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 at a time

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const confirmAction = useCallback((options: ConfirmDialogOptions) => {
    const id = `confirm_${Date.now()}`;
    setActiveConfirm({ ...options, id });
  }, []);

  const handleConfirmYes = () => {
    if (activeConfirm) {
      activeConfirm.onConfirm();
      setActiveConfirm(null);
    }
  };

  const handleConfirmNo = () => {
    if (activeConfirm) {
      if (activeConfirm.onCancel) activeConfirm.onCancel();
      setActiveConfirm(null);
    }
  };

  const toastMethods = {
    success: (msg: string, t?: string, d?: number) => addToast('success', msg, t, d),
    error: (msg: string, t?: string, d?: number) => addToast('error', msg, t, d),
    warning: (msg: string, t?: string, d?: number) => addToast('warning', msg, t, d),
    info: (msg: string, t?: string, d?: number) => addToast('info', msg, t, d),
    confirm: confirmAction,
  };

  globalToastDispatcher = toastMethods;

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}

      {/* Bottom-Right Feedback Cards Container */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100vw - 48px)',
          pointerEvents: 'none',
        }}
        aria-live="polite"
      >
        {/* Interactive Confirmation Card */}
        {activeConfirm && (
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderLeft: `4px solid ${
                activeConfirm.type === 'danger'
                  ? 'rgb(220, 38, 38)'
                  : activeConfirm.type === 'warning'
                  ? 'rgb(217, 119, 6)'
                  : 'var(--color-accent)'
              }`,
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
              pointerEvents: 'auto',
              animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {activeConfirm.type === 'danger' ? (
                  <AlertCircle size={20} color="rgb(220, 38, 38)" />
                ) : activeConfirm.type === 'warning' ? (
                  <AlertTriangle size={20} color="rgb(217, 119, 6)" />
                ) : (
                  <Info size={20} color="var(--color-accent)" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h4
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--color-ink-primary)',
                  }}
                >
                  {activeConfirm.title || 'Confirmation Required'}
                </h4>
                <p
                  style={{
                    margin: '0 0 14px 0',
                    fontSize: '13px',
                    lineHeight: 1.45,
                    color: 'var(--color-ink-secondary)',
                  }}
                >
                  {activeConfirm.message}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleConfirmNo}
                    className="btn btn--secondary"
                    style={{
                      height: '32px',
                      fontSize: '12px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {activeConfirm.cancelText || activeConfirm.cancelLabel || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmYes}
                    className={`btn ${activeConfirm.type === 'danger' ? 'btn--accent' : 'btn--primary'}`}
                    style={{
                      height: '32px',
                      fontSize: '12px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      backgroundColor:
                        activeConfirm.type === 'danger' ? 'rgb(220, 38, 38)' : undefined,
                      borderColor:
                        activeConfirm.type === 'danger' ? 'rgb(220, 38, 38)' : undefined,
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {activeConfirm.confirmText || activeConfirm.confirmLabel || 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Regular Toast Feedback Cards */}
        {toasts.map((t) => {
          const typeColor =
            t.type === 'success'
              ? 'rgb(22, 163, 74)'
              : t.type === 'error'
              ? 'rgb(220, 38, 38)'
              : t.type === 'warning'
              ? 'rgb(217, 119, 6)'
              : 'var(--color-accent)';

          const IconComponent =
            t.type === 'success'
              ? CheckCircle2
              : t.type === 'error'
              ? AlertCircle
              : t.type === 'warning'
              ? AlertTriangle
              : Info;

          return (
            <div
              key={t.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderLeft: `4px solid ${typeColor}`,
                borderRadius: '12px',
                padding: '12px 14px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                pointerEvents: 'auto',
                animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                <IconComponent size={18} color={typeColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <h5
                    style={{
                      margin: '0 0 2px 0',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--color-ink-primary)',
                    }}
                  >
                    {t.title}
                  </h5>
                )}
                <div
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--color-ink-secondary)',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}
                >
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'var(--color-ink-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { toast };
  }
  return ctx;
}
