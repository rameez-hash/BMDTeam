'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  // Only render toast container on client to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {mounted && (
        <div className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-[9999] flex items-start justify-center pt-20 p-4" suppressHydrationWarning>
          <div className="space-y-3 w-full max-w-md" suppressHydrationWarning>
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: (
      <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    warning: (
      <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    ),
    info: (
      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  };

  const colors = {
    success: 'bg-white border-emerald-200 shadow-emerald-100',
    error: 'bg-white border-red-200 shadow-red-100',
    warning: 'bg-white border-amber-200 shadow-amber-100',
    info: 'bg-white border-blue-200 shadow-blue-100',
  };

  return (
    <div
      className={`
        pointer-events-auto
        ${colors[toast.type]}
        border-2 rounded-2xl shadow-2xl
        p-4 flex items-center gap-4
        animate-in slide-in-from-top-5 fade-in duration-300
        backdrop-blur-sm
      `}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-relaxed">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
