/**
 * Bush Platform - Dropdown Component
 *
 * Accessible dropdown menu component with keyboard navigation.
 * Reference: specs/21-design-components.md
 */
"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext, type ReactNode, type RefObject } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/web/lib/utils";

export interface DropdownItem {
  type?: "item";
  label: string;
  value: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface DropdownSeparator {
  type: "separator";
}

export type DropdownOption = DropdownItem | DropdownSeparator;

interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  triggerRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("useDropdown must be used within a DropdownProvider");
  }
  return context;
}

export interface DropdownProps {
  /** Dropdown options */
  options: DropdownOption[];
  /** Currently selected value */
  value?: string | null;
  /** Callback when selection changes */
  onChange?: (value: string) => void;
  /** Trigger button content */
  trigger: ReactNode;
  /** Additional trigger button class */
  triggerClassName?: string;
  /** Menu alignment */
  align?: "left" | "right";
  /** Disabled state */
  disabled?: boolean;
  /** Additional container class */
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  trigger,
  triggerClassName,
  align = "left",
  disabled = false,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedValue = value ?? null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const onSelect = useCallback(
    (newValue: string) => {
      setIsOpen(false);
      onChange?.(newValue);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const contextValue: DropdownContextValue = {
    isOpen,
    setIsOpen,
    selectedValue,
    onSelect,
    triggerRef,
    menuRef,
  };

  return (
    <DropdownContext.Provider value={contextValue}>
      <div className={cn("relative inline-block", className)}>
        <DropdownTrigger disabled={disabled} className={triggerClassName}>
          {trigger}
        </DropdownTrigger>
        {isOpen && (
          <DropdownMenu
            options={options}
            align={align}
            menuRef={menuRef}
          />
        )}
      </div>
    </DropdownContext.Provider>
  );
}

interface DropdownTriggerProps {
  disabled: boolean;
  className?: string;
  children: ReactNode;
}

function DropdownTrigger({ disabled, className, children }: DropdownTriggerProps) {
  const { isOpen, setIsOpen, triggerRef } = useDropdown();

  return (
    <button
      ref={triggerRef}
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 px-3 py-2",
        "text-body-sm font-medium text-text-primary",
        "bg-surface-2 border border-border-default rounded-sm",
        "cursor-pointer transition-colors duration-fast",
        "hover:bg-surface-3",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
      disabled={disabled}
      onClick={() => setIsOpen(!isOpen)}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      {children}
      <ChevronDown
        className="size-4 transition-transform duration-fast"
        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
      />
    </button>
  );
}

interface DropdownMenuProps {
  options: DropdownOption[];
  align: "left" | "right";
  menuRef: RefObject<HTMLDivElement>;
}

function DropdownMenu({
  options,
  align,
  menuRef,
}: DropdownMenuProps & { menuRef: React.RefObject<HTMLDivElement> }) {
  const { setIsOpen } = useDropdown();
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Get focusable items
  const focusableItems = options.filter(
    (opt): opt is DropdownItem => opt.type !== "separator" && !opt.disabled
  );

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) =>
          prev < focusableItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : focusableItems.length - 1
        );
        break;
      case "Home":
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusedIndex(focusableItems.length - 1);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute top-full mt-1 min-w-40",
        "bg-surface-1 border border-border-default rounded-md",
        "shadow-lg z-dropdown",
        "animate-fade-in",
        align === "left" ? "left-0" : "right-0"
      )}
      role="listbox"
      onKeyDown={handleKeyDown}
    >
      <ul className="list-none m-0 p-1">
        {options.map((option, index) => {
          if (option.type === "separator") {
            return <DropdownMenuSeparator key={`sep-${index}`} />;
          }
          return (
            <DropdownMenuItem
              key={option.value}
              option={option}
              isFocused={focusableItems[focusedIndex]?.value === option.value}
            />
          );
        })}
      </ul>
    </div>
  );
}

interface DropdownMenuItemProps {
  option: DropdownItem;
  isFocused: boolean;
}

function DropdownMenuItem({ option, isFocused }: DropdownMenuItemProps) {
  const { selectedValue, onSelect } = useDropdown();
  const isSelected = selectedValue === option.value;

  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2",
          "text-body-sm text-text-primary",
          "bg-transparent border-none rounded-sm cursor-pointer",
          "transition-colors duration-fast",
          "text-left",
          "hover:bg-surface-2",
          isFocused && "bg-surface-2",
          isSelected && "font-medium",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
        disabled={option.disabled}
        onClick={() => !option.disabled && onSelect(option.value)}
        role="option"
        aria-selected={isSelected}
      >
        {option.icon && <span className="shrink-0">{option.icon}</span>}
        <span className="flex-1 text-left">{option.label}</span>
        {isSelected && <Check className="size-4" />}
      </button>
    </li>
  );
}

function DropdownMenuSeparator() {
  return <li className="my-1 border-t border-border-default" role="separator" />;
}

export default Dropdown;
