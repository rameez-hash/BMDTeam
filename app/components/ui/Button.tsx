interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  fullWidth = false, 
  children, 
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const variants = {
    primary: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-sm hover:shadow-md',
    secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm hover:shadow-md',
    success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm hover:shadow-md',
    ghost: 'hover:bg-slate-100 active:bg-slate-200 text-slate-600',
    outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50 active:bg-green-100',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-lg 
        transition-all duration-150 ease-out
        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        ${variants[variant]} ${sizes[size]} 
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}
