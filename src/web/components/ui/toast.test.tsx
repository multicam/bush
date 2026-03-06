import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./toast";

function ToastTrigger({ onMount }: { onMount?: (ctx: ReturnType<typeof useToast>) => void }) {
  const ctx = useToast();
  if (onMount) onMount(ctx);
  return null;
}

describe("Toast (Heroicons)", () => {
  describe("Icon rendering by type", () => {
    it("renders an SVG icon for success toast", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "success", title: "File uploaded" });
      });
      const alert = screen.getByRole("alert");
      expect(alert.querySelector("svg.size-5")).toBeInTheDocument();
    });

    it("renders an SVG icon for error toast", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "error", title: "Upload failed" });
      });
      const alert = screen.getByRole("alert");
      expect(alert.querySelector("svg.size-5")).toBeInTheDocument();
    });

    it("renders an SVG icon for warning toast", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "warning", title: "Storage almost full" });
      });
      const alert = screen.getByRole("alert");
      expect(alert.querySelector("svg.size-5")).toBeInTheDocument();
    });

    it("renders an SVG icon for info toast", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "info", title: "New version available" });
      });
      const alert = screen.getByRole("alert");
      expect(alert.querySelector("svg.size-5")).toBeInTheDocument();
    });
  });

  describe("Toast content", () => {
    it("renders the toast title", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "success", title: "Changes saved" });
      });
      expect(screen.getByText("Changes saved")).toBeInTheDocument();
    });

    it("renders description when provided", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({
          type: "success",
          title: "Upload complete",
          description: "3 files were uploaded successfully",
        });
      });
      expect(screen.getByText("3 files were uploaded successfully")).toBeInTheDocument();
    });

    it("has role='alert' for screen readers", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "info", title: "Notification" });
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("Provider", () => {
    it("provides addToast and removeToast context", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      expect(ctx?.addToast).toBeInstanceOf(Function);
      expect(ctx?.removeToast).toBeInstanceOf(Function);
    });

    it("removes toast by id", () => {
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      let id: string | undefined;
      act(() => {
        id = ctx?.addToast({ type: "success", title: "Saved!" });
      });
      expect(screen.getByText("Saved!")).toBeInTheDocument();
      act(() => {
        ctx?.removeToast(id!);
      });
      expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    });

    it("dismiss button removes toast", async () => {
      const user = userEvent.setup();
      let ctx: ReturnType<typeof useToast> | null = null;
      render(
        <ToastProvider>
          <ToastTrigger onMount={(c) => (ctx = c)} />
        </ToastProvider>
      );
      act(() => {
        ctx?.addToast({ type: "success", title: "Dismiss me" });
      });
      await user.click(screen.getByRole("button", { name: /dismiss/i }));
      await waitFor(() => {
        expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
      });
    });
  });
});
