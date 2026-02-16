'use client';

import { useState, useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
  /** If true, shows a text input field in the dialog */
  showInput?: boolean;
  /** Placeholder for the input field */
  inputPlaceholder?: string;
  /** Whether input is required before confirming */
  inputRequired?: boolean;
  /** Label for the input field */
  inputLabel?: string;
}

const variantStyles = {
  danger: {
    icon: (
      <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    iconBg: 'bg-rose-100',
    confirmBtn: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500',
  },
  warning: {
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    iconBg: 'bg-amber-100',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
  info: {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
    iconBg: 'bg-blue-100',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  },
  success: {
    icon: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-emerald-100',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
  showInput = false,
  inputPlaceholder = '',
  inputRequired = false,
  inputLabel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      return;
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    // Focus input if shown
    setTimeout(() => {
      if (showInput && inputRef.current) inputRef.current.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, loading, showInput]);

  if (!isOpen) return null;

  const style = variantStyles[variant];
  const canConfirm = !showInput || !inputRequired || inputValue.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
        onClick={() => !loading && onClose()}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
        {/* Content */}
        <div className="p-6">
          <div className="flex gap-4">
            {/* Icon */}
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center`}>
              {style.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{message}</p>

              {/* Optional Input */}
              {showInput && (
                <div className="mt-4">
                  {inputLabel && (
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{inputLabel}</label>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={inputPlaceholder}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirm && !loading) {
                        onConfirm(inputValue);
                      }
                    }}
                  />
                  {inputRequired && (
                    <p className="mt-1 text-xs text-slate-400">This field is required</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(showInput ? inputValue : undefined)}
            disabled={loading || !canConfirm}
            className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 ${style.confirmBtn} ${loading ? 'cursor-wait' : ''}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
