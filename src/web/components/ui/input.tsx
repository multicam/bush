/**
 * Bush Platform - Input Component
 *
 * Accessible text input component with label and error states.
 * Reference: QW3 Component Library Foundation
 */
import React, { forwardRef, useId } from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Input label */
  label?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Size variant */
  inputSize?: InputSize;
  /** Icon to display at start */
  startIcon?: React.ReactNode;
  /** Icon to display at end */
  endIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
  /** Additional container class */
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    inputSize = "md",
    startIcon,
    endIcon,
    fullWidth = false,
    className = "",
    containerClassName = "",
    id,
    required,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = Boolean(error);

  const inputClasses = [
    "input",
    `input--${inputSize}`,
    hasError ? "input--error" : "",
    startIcon ? "input--has-start-icon" : "",
    endIcon ? "input--has-end-icon" : "",
    className,
  ].filter(Boolean).join(" ");

  const wrapperClasses = [
    "input-wrapper",
    fullWidth ? "w-full" : "",
    containerClassName,
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={`input-label ${required ? "input-label--required" : ""}`}>
          {label}
        </label>
      )}
      <div className="input-field-wrapper">
        {startIcon && (
          <span className="input-icon input-icon--start">
            {startIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          required={required}
          {...props}
        />
        {endIcon && (
          <span className="input-icon input-icon--end">
            {endIcon}
          </span>
        )}
      </div>
      {error && (
        <span id={`${inputId}-error`} className="input-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${inputId}-helper`} className="input-helper">
          {helperText}
        </span>
      )}
    </div>
  );
});

export default Input;
