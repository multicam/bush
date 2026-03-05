/**
 * Bush Platform - Select Component
 *
 * Accessible select dropdown component.
 * Reference: specs/21-design-components.md
 */
import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/web/lib/utils";

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

const sizeClasses: Record<SelectSize, string> = {
  sm: "h-8 pr-8 pl-3 text-body-sm", // 32px
  md: "h-9 pr-8 pl-3 text-body", // 36px
  lg: "h-10 pr-10 pl-4 text-body", // 40px
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    error,
    selectSize = "md",
    options,
    placeholder,
    fullWidth = false,
    containerClassName,
    id,
    required,
    className,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
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
          htmlFor={selectId}
          className={cn(
            "text-body-sm font-medium text-text-primary",
            required && "after:content-['*'] after:text-error after:ml-0.5"
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full bg-surface-1 text-text-primary",
            "border rounded-sm font-inherit leading-normal cursor-pointer",
            "appearance-none",
            "transition-[border-color,box-shadow] duration-fast",
            "focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15",
            "disabled:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60",
            hasError && "border-error focus:border-error focus:ring-error/15",
            !hasError && "border-border-default",
            sizeClasses[selectSize],
            className
          )}
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
        <ChevronDown
          className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
      </div>
      {error && (
        <span id={`${selectId}-error`} className="text-caption text-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${selectId}-helper`} className="text-caption text-text-secondary">
          {helperText}
        </span>
      )}
    </div>
  );
});

export default Select;
