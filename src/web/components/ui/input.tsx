/**
 * Bush Platform - Input Component
 *
 * Accessible text input component with label and error states.
 * Reference: specs/21-design-components.md
 */
import React, { forwardRef, useId } from "react";
import { cn } from "@/web/lib/utils";

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

const sizeClasses: Record<InputSize, string> = {
  sm: "h-8 px-3 text-body-sm", // 32px
  md: "h-9 px-3 text-body", // 36px
  lg: "h-10 px-4 text-body", // 40px
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    inputSize = "md",
    startIcon,
    endIcon,
    fullWidth = false,
    className,
    containerClassName,
    id,
    required,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = Boolean(error);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        fullWidth && "w-full",
        containerClassName
      )}
    >
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-body-sm font-medium text-text-primary",
            required && "after:content-['*'] after:text-error after:ml-0.5"
          )}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {startIcon && (
          <span className="absolute left-3 flex items-center justify-center text-text-secondary pointer-events-none">
            {startIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-surface-1 text-text-primary",
            "border rounded-sm font-inherit leading-normal",
            "transition-[border-color,box-shadow] duration-fast",
            "placeholder:text-text-muted",
            "focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15",
            "disabled:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60",
            hasError && "border-error focus:border-error focus:ring-error/15",
            !hasError && "border-border-default",
            sizeClasses[inputSize],
            startIcon && "pl-10",
            endIcon && "pr-10",
            className
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          required={required}
          {...props}
        />
        {endIcon && (
          <span className="absolute right-3 flex items-center justify-center text-text-secondary pointer-events-none">
            {endIcon}
          </span>
        )}
      </div>
      {error && (
        <span id={`${inputId}-error`} className="text-caption text-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${inputId}-helper`} className="text-caption text-text-secondary">
          {helperText}
        </span>
      )}
    </div>
  );
});

export default Input;
