import React from 'react';
import './uiverse.css';

/* Components adapted from Uiverse.io (MIT). Credits: src/ui/CREDITS.md. */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export interface ShineButtonProps extends ButtonProps {
  /** Trailing icon; slides forward on hover. */
  icon?: React.ReactNode;
  /** Full-width variant, used inside cards and forms. */
  block?: boolean;
  /** Muted treatment for secondary placements. */
  quiet?: boolean;
}

/** Gradient button with a light sweep — after Uiverse.io/satyamchaudharydev. */
export function ShineButton({ icon, block, quiet, className = '', children, ...rest }: ShineButtonProps) {
  return (
    <button
      {...rest}
      className={`uv-shine ${block ? 'uv-shine--block' : ''} ${quiet ? 'uv-shine--quiet' : ''} ${className}`}
    >
      <span className="uv-shine__label">{children}</span>
      {icon && <span className="uv-shine__icon">{icon}</span>}
    </button>
  );
}

export interface LuxeButtonProps extends ButtonProps {
  icon?: React.ReactNode;
  block?: boolean;
  /** Compact height, for inline rows. */
  small?: boolean;
}

/** Dark bezelled button — after Uiverse.io/adamgiebl. */
export function LuxeButton({ icon, block, small, className = '', children, ...rest }: LuxeButtonProps) {
  return (
    <button
      {...rest}
      className={`uv-luxe ${block ? 'uv-luxe--block' : ''} ${small ? 'uv-luxe--sm' : ''} ${className}`}
    >
      <span className="uv-luxe__face">
        {icon}
        {children}
      </span>
      <span className="uv-luxe__noise" aria-hidden="true" />
    </button>
  );
}

export interface FloatFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Input whose label rides into the border — after Uiverse.io/alexruix. */
export const FloatField = React.forwardRef<HTMLInputElement, FloatFieldProps>(
  ({ label, className = '', id, ...rest }, ref) => {
    const fieldId = id ?? `uv-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return (
      <div className={`uv-field ${className}`}>
        {/* placeholder=" " is what :not(:placeholder-shown) keys off. */}
        <input ref={ref} id={fieldId} className="uv-field__input" placeholder=" " {...rest} />
        <label className="uv-field__label" htmlFor={fieldId}>
          {label}
        </label>
      </div>
    );
  }
);
FloatField.displayName = 'FloatField';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}

/** Oversized-knob switch — after Uiverse.io/Galahhad. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className="uv-switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="uv-switch__track">
        <span className="uv-switch__knob" />
      </span>
      {label && <span className="uv-switch__text">{label}</span>}
    </label>
  );
}

export interface TooltipProps {
  text: string;
  /** Place the bubble under the trigger instead of beside it. */
  below?: boolean;
  children: React.ReactNode;
}

/** Gradient-lit tooltip — after Uiverse.io/Javierrocadev. */
export function Tooltip({ text, below, children }: TooltipProps) {
  return (
    <span className={`uv-tip ${below ? 'uv-tip--below' : ''}`}>
      {children}
      <span className="uv-tip__bubble" role="tooltip">
        <span className="uv-tip__text">{text}</span>
      </span>
    </span>
  );
}

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  /** For use on a light (amber) surface. */
  onLight?: boolean;
  className?: string;
}

/** Four-arc ring spinner — after Uiverse.io/Alaner-xs. */
export function Loader({ size = 'md', onLight, className = '' }: LoaderProps) {
  const scale = size === 'lg' ? 'uv-loader--lg' : size === 'sm' ? 'uv-loader--sm' : '';
  return (
    <span
      className={`uv-loader ${scale} ${onLight ? 'uv-loader--dark' : ''} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export interface ToastProps {
  type: 'success' | 'error';
  message: string;
  icon: React.ReactNode;
}

/** Disc + sliding panel toast — after Uiverse.io/alexruix. */
export function Toast({ type, message, icon }: ToastProps) {
  return (
    <div className={`uv-toast ${type === 'error' ? 'uv-toast--error' : ''}`} role="status">
      <div className="uv-toast__disc">
        <span>{icon}</span>
      </div>
      <div className="uv-toast__panel">{message}</div>
    </div>
  );
}
