/* Базовая кнопка IMF. Семантические варианты: primary, ghost, danger. Все интерактивные элементы ≥ 44px touch-цель. */

import { h, type HTMLAttributes } from 'preact';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'role'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-height: 36px; padding: 6px 12px; font-size: 0.875rem;',
  md: 'min-height: 44px; padding: 8px 16px; font-size: 0.9375rem;',
  lg: 'min-height: 48px; padding: 10px 20px; font-size: 1rem;',
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'background: var(--color-accent); color: var(--color-accent-ink); border-color: transparent;',
  ghost: 'background: transparent; border-color: var(--color-line-divider); color: var(--color-ink);',
  danger: 'background: var(--color-error-soft); color: var(--color-error); border-color: transparent;',
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  children,
  ...rest
}: ButtonProps): import('preact').JSX.Element {
  const style = `${variantStyles[variant]} ${sizeStyles[size]}`;
  return (
    <button
      type={rest.type ?? 'button'}
      class={`btn btn-${size} btn-${variant}`}
      style={style}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;