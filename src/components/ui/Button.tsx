import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:   'bg-brand hover:bg-brand-dark text-white shadow-sm',
  secondary: 'bg-charcoal hover:bg-gray-800 text-white shadow-sm',
  outline:   'border border-border bg-white hover:bg-surface text-charcoal',
  ghost:     'hover:bg-surface text-charcoal',
  danger:    'bg-danger hover:bg-red-700 text-white',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  },
);
