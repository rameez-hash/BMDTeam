interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', dot = false, className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    primary: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const dotColors = {
    default: 'bg-gray-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    primary: 'bg-green-500',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-medium border whitespace-nowrap
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
