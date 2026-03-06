/**
 * Bush Platform - Toast Component
 *
 * Toast notification system with auto-dismiss and stacking.
 * Reference: specs/21-design-components.md
 */
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@/web/lib/icons";
import { cn } from "@/web/lib/utils";

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
      const id = `toast-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
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
      {container &&
        createPortal(<ToastContainer toasts={toasts} removeToast={removeToast} />, container)}
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
    <div
      className={cn(
        "fixed bottom-4 right-4",
        "flex flex-col gap-3",
        "z-toast",
        "max-w-96 w-[calc(100vw-2rem)]"
      )}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

const toastVariantClasses: Record<ToastType, string> = {
  success: "bg-[rgba(34,197,94,0.1)] border-l-4 border-success text-success",
  error: "bg-[rgba(239,68,68,0.1)] border-l-4 border-error text-red-300",
  warning: "bg-[rgba(245,158,11,0.1)] border-l-4 border-warning text-warning",
  info: "bg-[rgba(59,130,246,0.1)] border-l-4 border-info text-info",
};

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

  const descriptionId = toast.description ? `${toast.id}-description` : undefined;

  return (
    <div
      className={cn(
        "p-4 rounded-sm shadow-lg",
        "flex items-start gap-3",
        "animate-slide-in-right",
        toastVariantClasses[toast.type]
      )}
      role="alert"
      aria-live="polite"
      aria-describedby={descriptionId}
    >
      <ToastIcon type={toast.type} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold m-0">{toast.title}</p>
        {toast.description && (
          <p id={descriptionId} className="text-body-sm mt-1 opacity-90 m-0">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className={cn(
              "mt-2 px-2 py-1",
              "text-body-sm font-medium",
              "bg-transparent border-none cursor-pointer",
              "underline",
              "text-inherit"
            )}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "p-1",
          "bg-transparent border-none cursor-pointer",
          "opacity-60 transition-opacity duration-fast",
          "hover:opacity-100"
        )}
        aria-label="Dismiss notification"
      >
        <XMarkIcon className="size-4" />
      </button>
    </div>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  const iconClass = "shrink-0 size-5";

  switch (type) {
    case "success":
      return <CheckCircle2 className={iconClass} />;
    case "error":
      return <XCircle className={iconClass} />;
    case "warning":
      return <AlertTriangle className={iconClass} />;
    case "info":
      return <Info className={iconClass} />;
  }
}

export default ToastProvider;
