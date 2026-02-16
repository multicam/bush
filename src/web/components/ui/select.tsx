/**
 * Bush Platform - Select Component
 *
 * Accessible select dropdown component.
 * Reference: QW3 Component Library Foundation
 */
import React, { forwardRef, useId } from "react";

export type SelectSize = "sm" | "md" | "lg";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Select label */
  label?: string;
  /** Helper text below select */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Size variant */
  selectSize?: SelectSize;
  /** Options to display */
  options: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Full width */
  fullWidth?: boolean;
  /** Additional container class */
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    error,
    selectSize = "md",
    options,
    placeholder,
    fullWidth = false,
    containerClassName = "",
    id,
    required,
    className = "",
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const hasError = Boolean(error);

  const selectClasses = [
    "select",
    `select--${selectSize}`,
    hasError ? "select--error" : "",
    className,
  ].filter(Boolean).join(" ");

  const wrapperClasses = [
    "select-wrapper",
    fullWidth ? "w-full" : "",
    containerClassName,
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={selectId} className={`input-label ${required ? "input-label--required" : ""}`}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={selectClasses}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        required={required}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${selectId}-error`} className="input-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${selectId}-helper`} className="input-helper">
          {helperText}
        </span>
      )}
    </div>
  );
});

export default Select;
