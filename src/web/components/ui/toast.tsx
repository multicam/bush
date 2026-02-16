/**
 * Bush Platform - Toast Component
 *
 * Toast notification system with auto-dismiss and stacking.
 * Reference: QW3 Component Library Foundation
 */
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export interface ToastProviderProps {
  /** Maximum number of toasts to show */
  maxToasts?: number;
  /** Default duration in ms */
  defaultDuration?: number;
  /** Portal target */
  portalContainer?: Element | null;
  /** Children */
  children: React.ReactNode;
}

export function ToastProvider({
  maxToasts = 5,
  defaultDuration = 5000,
  portalContainer,
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration ?? defaultDuration,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        return updated.slice(-maxToasts);
      });

      return id;
    },
    [maxToasts, defaultDuration]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    removeAllToasts,
  };

  const container = portalContainer ?? (typeof document !== "undefined" ? document.body : null);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {container && createPortal(
        <ToastContainer toasts={toasts} removeToast={removeToast} />,
        container
      )}
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  // Auto-dismiss
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  return (
    <div
      className={`toast toast--${toast.type}`}
      role="alert"
      aria-live="polite"
    >
      <ToastIcon type={toast.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="toast-title">{toast.title}</p>
        {toast.description && (
          <p className="toast-description">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            style={{
              marginTop: "0.5rem",
              padding: "0.25rem 0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              color: "inherit",
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="toast-close"
        aria-label="Dismiss notification"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  const iconStyle = {
    flexShrink: 0,
    width: "1.25rem",
    height: "1.25rem",
  };

  switch (type) {
    case "success":
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "error":
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "warning":
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

export default ToastProvider;
