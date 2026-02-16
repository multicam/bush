/**
 * Bush Platform - Dropdown Component
 *
 * Accessible dropdown menu component with keyboard navigation.
 * Reference: QW3 Component Library Foundation
 */
"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext, type ReactNode, type RefObject } from "react";

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
  triggerClassName = "",
  align = "left",
  disabled = false,
  className = "",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Use the value prop directly as the source of truth, defaulting to null
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

  const containerClasses = ["dropdown", className].filter(Boolean).join(" ");

  return (
    <DropdownContext.Provider value={contextValue}>
      <div className={containerClasses}>
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
  className: string;
  children: ReactNode;
}

function DropdownTrigger({ disabled, className, children }: DropdownTriggerProps) {
  const { isOpen, setIsOpen, triggerRef } = useDropdown();

  const triggerClasses = [
    "dropdown-trigger",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      ref={triggerRef}
      type="button"
      className={triggerClasses}
      disabled={disabled}
      onClick={() => setIsOpen(!isOpen)}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{
          transition: "transform 0.15s ease",
          transform: `rotate(${isOpen ? 180 : 0}deg)`,
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
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

  const menuClasses = [
    "dropdown-menu",
    `dropdown-menu--${align}`,
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={menuRef}
      className={menuClasses}
      role="listbox"
      onKeyDown={handleKeyDown}
    >
      <ul style={{ listStyle: "none", margin: 0, padding: "0.25rem" }}>
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

  const itemClasses = [
    "dropdown-item",
    isFocused ? "dropdown-item--focused" : "",
    isSelected ? "dropdown-item--selected" : "",
  ].filter(Boolean).join(" ");

  return (
    <li>
      <button
        type="button"
        className={itemClasses}
        disabled={option.disabled}
        onClick={() => !option.disabled && onSelect(option.value)}
        role="option"
        aria-selected={isSelected}
      >
        {option.icon && <span style={{ flexShrink: 0 }}>{option.icon}</span>}
        <span style={{ flex: 1, textAlign: "left" }}>{option.label}</span>
        {isSelected && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    </li>
  );
}

function DropdownMenuSeparator() {
  return <li className="dropdown-separator" role="separator" />;
}

export default Dropdown;
