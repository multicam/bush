/**
 * Bush Platform - Modal Component Tests
 *
 * Tests for the Modal UI component.
 * Reference: specs/15-frontend-testing.md - Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

describe("Modal", () => {
  describe("Visibility", () => {
    it("does not render when open is false", () => {
      render(
        <Modal open={false} onClose={() => {}}>
          Content
        </Modal>
      );
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("renders when open is true", () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("Title", () => {
    it("renders title when provided", () => {
      render(
        <Modal open={true} onClose={() => {}} title="Modal Title">
          Content
        </Modal>
      );
      expect(screen.getByRole("heading", { name: "Modal Title" })).toBeInTheDocument();
    });

    it("does not render title header when not provided", () => {
      render(
        <Modal open={true} onClose={() => {}} showCloseButton={false}>
          Content
        </Modal>
      );
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
  });

  describe("Close Button", () => {
    it("renders close button by default", () => {
      render(
        <Modal open={true} onClose={() => {}} title="Title">
          Content
        </Modal>
      );
      expect(screen.getByRole("button", { name: /close modal/i })).toBeInTheDocument();
    });

    it("does not render close button when showCloseButton is false", () => {
      render(
        <Modal open={true} onClose={() => {}} title="Title" showCloseButton={false}>
          Content
        </Modal>
      );
      expect(screen.queryByRole("button", { name: /close modal/i })).not.toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Title">
          Content
        </Modal>
      );

      await user.click(screen.getByRole("button", { name: /close modal/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Escape Key", () => {
    it("calls onClose when Escape key is pressed", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          Content
        </Modal>
      );

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose on Escape when closeOnEscape is false", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} closeOnEscape={false}>
          Content
        </Modal>
      );

      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Overlay Click", () => {
    it("calls onClose when overlay is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          Content
        </Modal>
      );

      // Click on the overlay (the parent div with role="dialog")
      const overlay = screen.getByRole("dialog");
      await user.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when content is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div data-testid="content">Content</div>
        </Modal>
      );

      await user.click(screen.getByTestId("content"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not call onClose on overlay click when closeOnOverlayClick is false", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} closeOnOverlayClick={false}>
          Content
        </Modal>
      );

      const overlay = screen.getByRole("dialog");
      await user.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Sizes", () => {
    it("applies medium size by default", () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );
      const dialog = screen.getByRole("dialog").querySelector('[tabindex="-1"]');
      expect(dialog?.className).toMatch(/max-w-\[520px\]/);
    });

    it("applies small size classes", () => {
      render(
        <Modal open={true} onClose={() => {}} size="sm">
          Content
        </Modal>
      );
      const dialog = screen.getByRole("dialog").querySelector('[tabindex="-1"]');
      expect(dialog?.className).toMatch(/max-w-md/);
    });

    it("applies large size classes", () => {
      render(
        <Modal open={true} onClose={() => {}} size="lg">
          Content
        </Modal>
      );
      const dialog = screen.getByRole("dialog").querySelector('[tabindex="-1"]');
      expect(dialog?.className).toMatch(/max-w-\[680px\]/);
    });
  });

  describe("Footer", () => {
    it("renders footer when provided", () => {
      render(
        <Modal open={true} onClose={() => {}} footer={<button>Save</button>}>
          Content
        </Modal>
      );
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("does not render footer when not provided", () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );
      // Footer has border-t class, check it doesn't exist
      const dialog = screen.getByRole("dialog").querySelector('[tabindex="-1"]');
      expect(dialog?.querySelector("footer")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has role='dialog'", () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal='true'", () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-labelledby when title is provided", () => {
      render(
        <Modal open={true} onClose={() => {}} title="Modal Title">
          Content
        </Modal>
      );
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", "modal-title");
    });

    it("has aria-describedby when description is provided", () => {
      render(
        <Modal open={true} onClose={() => {}} description="Modal description">
          Content
        </Modal>
      );
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby", "modal-description");
    });
  });

  describe("Focus Management", () => {
    it("has tabIndex on modal content", () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );
      const dialog = screen.getByRole("dialog").querySelector('[tabindex="-1"]');
      expect(dialog).toBeInTheDocument();
    });
  });

  describe("Description", () => {
    it("renders description for screen readers", () => {
      render(
        <Modal open={true} onClose={() => {}} description="This is a description">
          Content
        </Modal>
      );
      expect(screen.getByText("This is a description")).toBeInTheDocument();
    });
  });
});
