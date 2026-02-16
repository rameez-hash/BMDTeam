'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className={`
          relative bg-white shadow-2xl w-full ${sizes[size]} 
          min-h-screen sm:min-h-0 sm:rounded-2xl sm:my-8
          max-h-screen sm:max-h-[90vh] overflow-hidden
          animate-fadeIn
        `}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-white">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(100vh-80px)] sm:max-h-[calc(90vh-80px)] p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
