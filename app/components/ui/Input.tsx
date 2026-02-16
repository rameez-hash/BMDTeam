import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, rightIcon, onRightIconClick, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-3 py-2.5 bg-white border-b-2 border-slate-200 rounded-none
              text-sm text-slate-900 placeholder-slate-400
              focus:outline-none focus:border-emerald-500
              hover:border-slate-300
              transition-all duration-200
              ${icon ? 'pl-10' : ''} 
              ${rightIcon ? 'pr-10' : ''}
              ${error ? 'border-red-400 focus:border-red-500' : ''}
              ${props.disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none"
              tabIndex={-1}
            >
              {rightIcon}
            </button>
          )}
        </div>
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        {error && <p className="mt-1 text-xs sm:text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className = '', ...props }, ref) => {
    return (
      <div className={label ? 'w-full' : 'inline-block'}>
        {label && (
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`
              w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl
              text-sm text-slate-900
              focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
              hover:border-slate-300
              transition-all duration-200
              appearance-none cursor-pointer
              ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}
              ${props.disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}
              ${className}
            `}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1.5em 1.5em',
              backgroundRepeat: 'no-repeat',
              paddingRight: '2.5rem'
            }}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        {error && <p className="mt-1 text-xs sm:text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
