/**
 * Bush Platform - Button Component Tests
 *
 * Tests for the Button UI component.
 * Reference: specs/15-frontend-testing.md - Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  describe("Rendering", () => {
    it("renders with children", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("renders as a button element", () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("applies primary variant classes by default", () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/bg-accent/);
    });

    it("applies secondary variant classes", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/bg-transparent/);
    });

    it("applies ghost variant classes", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/bg-transparent/);
    });

    it("applies danger variant classes", () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/text-error/);
    });
  });

  describe("Sizes", () => {
    it("applies medium size by default", () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/h-9/);
    });

    it("applies small size classes", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/h-8/);
    });

    it("applies large size classes", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/h-10/);
    });
  });

  describe("Full Width", () => {
    it("applies full width class when fullWidth is true", () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/w-full/);
    });

    it("does not apply full width class by default", () => {
      render(<Button>Normal Width</Button>);
      const button = screen.getByRole("button");
      expect(button.className).not.toMatch(/w-full/);
    });
  });

  describe("Loading State", () => {
    it("shows loading spinner when loading is true", () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("is disabled when loading", () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Disabled State", () => {
    it("is disabled when disabled prop is true", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("applies disabled styles", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button.className).toMatch(/disabled:cursor-not-allowed/);
    });
  });

  describe("Icons", () => {
    it("renders start icon", () => {
      render(<Button startIcon={<span data-testid="start-icon">icon</span>}>With Icon</Button>);
      expect(screen.getByTestId("start-icon")).toBeInTheDocument();
    });

    it("renders end icon", () => {
      render(<Button endIcon={<span data-testid="end-icon">icon</span>}>With Icon</Button>);
      expect(screen.getByTestId("end-icon")).toBeInTheDocument();
    });
  });

  describe("Events", () => {
    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click me</Button>);

      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button disabled onClick={onClick}>Disabled</Button>);

      await user.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when loading", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button loading onClick={onClick}>Loading</Button>);

      await user.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("can have custom type", () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
    });

    it("can have type='button'", () => {
      render(<Button type="button">Button</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
    });

    it("accepts aria attributes", () => {
      render(<Button aria-label="Custom label">Button</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Custom label");
    });
  });
});
