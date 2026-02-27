/**
 * Bush Platform - Toast Component Tests
 *
 * Tests for the Toast UI component and provider.
 * Reference: specs/15-frontend-testing.md - Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./toast";

// Test wrapper component to access toast context
function TestComponent({ onMount }: { onMount?: (toast: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  if (onMount) {
    onMount(toast);
  }
  return null;
}

describe("ToastProvider", () => {
  describe("useToast Hook", () => {
    it("provides toast context", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      expect(toastContext).not.toBeNull();
      expect(toastContext?.addToast).toBeInstanceOf(Function);
      expect(toastContext?.removeToast).toBeInstanceOf(Function);
      expect(toastContext?.removeAllToasts).toBeInstanceOf(Function);
    });

    it("throws error when used outside provider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow("useToast must be used within a ToastProvider");

      consoleError.mockRestore();
    });
  });

  describe("addToast", () => {
    it("adds a toast to the list", async () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Success!" });
      });

      expect(screen.getByText("Success!")).toBeInTheDocument();
    });

    it("returns a toast id", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      let id: string | undefined;

      act(() => {
        id = toastContext?.addToast({ type: "success", title: "Toast 1" });
      });

      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });
  });

  describe("removeToast", () => {
    it("removes a toast by id", async () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      let toastId: string | undefined;

      act(() => {
        toastId = toastContext?.addToast({ type: "success", title: "Success!" });
      });

      expect(screen.getByText("Success!")).toBeInTheDocument();

      act(() => {
        toastContext?.removeToast(toastId!);
      });

      expect(screen.queryByText("Success!")).not.toBeInTheDocument();
    });
  });

  describe("removeAllToasts", () => {
    it("removes all toasts", async () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Toast 1" });
        toastContext?.addToast({ type: "error", title: "Toast 2" });
      });

      expect(screen.getByText("Toast 1")).toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();

      act(() => {
        toastContext?.removeAllToasts();
      });

      expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Toast 2")).not.toBeInTheDocument();
    });
  });

  describe("maxToasts", () => {
    it("limits the number of toasts shown", async () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider maxToasts={2}>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Toast 1" });
        toastContext?.addToast({ type: "success", title: "Toast 2" });
        toastContext?.addToast({ type: "success", title: "Toast 3" });
      });

      // Should only show the last 2 toasts
      expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
      expect(screen.getByText("Toast 3")).toBeInTheDocument();
    });
  });

  describe("Auto-dismiss", () => {
    it("auto-dismisses toast after duration", async () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider defaultDuration={100}>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Auto dismiss" });
      });

      expect(screen.getByText("Auto dismiss")).toBeInTheDocument();

      // Wait for auto-dismiss
      await waitFor(
        () => {
          expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it("does not auto-dismiss when duration is 0", async () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "No auto-dismiss", duration: 0 });
      });

      expect(screen.getByText("No auto-dismiss")).toBeInTheDocument();

      // Wait a bit and check it's still there
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be visible
      expect(screen.getByText("No auto-dismiss")).toBeInTheDocument();

      // Clean up
      act(() => {
        toastContext?.removeAllToasts();
      });
    });
  });
});

describe("Toast Item", () => {
  describe("Types", () => {
    it("renders success toast with icon", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Success!" });
      });

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Success!")).toBeInTheDocument();
    });

    it("renders error toast", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "error", title: "Error!" });
      });

      expect(screen.getByText("Error!")).toBeInTheDocument();
    });

    it("renders warning toast", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "warning", title: "Warning!" });
      });

      expect(screen.getByText("Warning!")).toBeInTheDocument();
    });

    it("renders info toast", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "info", title: "Info!" });
      });

      expect(screen.getByText("Info!")).toBeInTheDocument();
    });
  });

  describe("Description", () => {
    it("renders description when provided", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({
          type: "success",
          title: "Success",
          description: "Operation completed successfully",
        });
      });

      expect(screen.getByText("Operation completed successfully")).toBeInTheDocument();
    });
  });

  describe("Action", () => {
    it("renders action button when provided", async () => {
      const user = userEvent.setup();
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      const onActionClick = vi.fn();

      act(() => {
        toastContext?.addToast({
          type: "info",
          title: "Update available",
          action: { label: "Update now", onClick: onActionClick },
        });
      });

      const actionButton = screen.getByRole("button", { name: "Update now" });
      expect(actionButton).toBeInTheDocument();

      await user.click(actionButton);
      expect(onActionClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dismiss Button", () => {
    it("has dismiss button", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Dismiss me" });
      });

      expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    });

    it("removes toast when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Dismiss me" });
      });

      await user.click(screen.getByRole("button", { name: /dismiss/i }));

      await waitFor(() => {
        expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has role='alert'", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Alert!" });
      });

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("has aria-live='polite'", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Polite alert" });
      });

      expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");
    });

    it("toast container has region role", () => {
      let toastContext: ReturnType<typeof useToast> | null = null;

      render(
        <ToastProvider>
          <TestComponent onMount={(t) => (toastContext = t)} />
        </ToastProvider>
      );

      act(() => {
        toastContext?.addToast({ type: "success", title: "Notification" });
      });

      expect(screen.getByRole("region", { name: /notifications/i })).toBeInTheDocument();
    });
  });
});
