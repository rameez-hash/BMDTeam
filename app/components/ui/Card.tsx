interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, className = '', padding = true, hover = false }: CardProps) {
  return (
    <div 
      className={`
        bg-white rounded-xl shadow-sm border border-slate-200
        ${padding ? 'p-4 sm:p-5 lg:p-6' : ''} 
        ${hover ? 'hover:shadow-md hover:border-slate-300 transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/40 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-base sm:text-lg font-semibold text-slate-800 ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 sm:p-5 lg:p-6 ${className}`}>{children}</div>;
}
