'use client';

interface AccessDeniedProps {
  module?: string;
  message?: string;
}

export default function AccessDenied({ module, message }: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm">
          {message || `You don't have permission to access ${module ? `the ${module} section` : 'this page'}. Contact your administrator to request access.`}
        </p>
      </div>
    </div>
  );
}
