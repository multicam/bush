/**
 * Bush Platform - Input Component Tests
 *
 * Tests for the Input UI component.
 * Reference: specs/15-frontend-testing.md - Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  describe("Rendering", () => {
    it("renders an input element", () => {
      render(<Input />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders with a label when provided", () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    it("renders helper text when provided", () => {
      render(<Input helperText="Enter your email" />);
      expect(screen.getByText("Enter your email")).toBeInTheDocument();
    });

    it("renders error message when provided", () => {
      render(<Input error="Invalid email" />);
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
    });
  });

  describe("Label", () => {
    it("associates label with input via htmlFor", () => {
      render(<Input label="Username" id="username" />);
      const input = screen.getByLabelText("Username");
      expect(input).toHaveAttribute("id", "username");
    });

    it("generates an id if not provided", () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("id");
    });

    it("shows required indicator when required", () => {
      render(<Input label="Email" required />);
      // The asterisk is added via CSS after:content-['*']
      const label = screen.getByText("Email");
      // Check that the label has the required class that adds the asterisk
      expect(label.className).toMatch(/after:content/);
    });
  });

  describe("Error State", () => {
    it("shows error message instead of helper text when both are provided", () => {
      render(<Input helperText="Helper text" error="Error message" />);
      expect(screen.getByRole("alert")).toHaveTextContent("Error message");
      expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
    });

    it("sets aria-invalid when there is an error", () => {
      render(<Input error="Invalid" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("associates error message with input via aria-describedby", () => {
      render(<Input label="Email" id="email" error="Invalid email" />);
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-describedby", "email-error");
    });
  });

  describe("Helper Text", () => {
    it("associates helper text with input via aria-describedby", () => {
      render(<Input label="Email" id="email" helperText="We'll never share your email" />);
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-describedby", "email-helper");
    });
  });

  describe("Sizes", () => {
    it("applies medium size by default", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input.className).toMatch(/h-9/);
    });

    it("applies small size classes", () => {
      render(<Input inputSize="sm" />);
      const input = screen.getByRole("textbox");
      expect(input.className).toMatch(/h-8/);
    });

    it("applies large size classes", () => {
      render(<Input inputSize="lg" />);
      const input = screen.getByRole("textbox");
      expect(input.className).toMatch(/h-10/);
    });
  });

  describe("Icons", () => {
    it("renders start icon", () => {
      render(<Input startIcon={<span data-testid="start-icon">icon</span>} />);
      expect(screen.getByTestId("start-icon")).toBeInTheDocument();
    });

    it("renders end icon", () => {
      render(<Input endIcon={<span data-testid="end-icon">icon</span>} />);
      expect(screen.getByTestId("end-icon")).toBeInTheDocument();
    });
  });

  describe("Full Width", () => {
    it("applies full width class when fullWidth is true", () => {
      render(<Input fullWidth />);
      const container = screen.getByRole("textbox").closest("div")?.parentElement;
      expect(container?.className).toMatch(/w-full/);
    });
  });

  describe("Disabled State", () => {
    it("is disabled when disabled prop is true", () => {
      render(<Input disabled />);
      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });

    it("applies disabled styles", () => {
      render(<Input disabled />);
      const input = screen.getByRole("textbox");
      expect(input.className).toMatch(/disabled:cursor-not-allowed/);
    });
  });

  describe("Events", () => {
    it("calls onChange when value changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Input onChange={onChange} />);

      await user.type(screen.getByRole("textbox"), "test");
      expect(onChange).toHaveBeenCalled();
    });

    it("calls onFocus when focused", async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      render(<Input onFocus={onFocus} />);

      await user.click(screen.getByRole("textbox"));
      expect(onFocus).toHaveBeenCalled();
    });

    it("calls onBlur when blurred", async () => {
      const user = userEvent.setup();
      const onBlur = vi.fn();
      render(<Input onBlur={onBlur} />);

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has required attribute when required prop is true", () => {
      render(<Input required />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("required");
    });

    it("accepts placeholder text", () => {
      render(<Input placeholder="Enter your name" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("placeholder", "Enter your name");
    });

    it("accepts custom aria attributes", () => {
      render(<Input aria-label="Search" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-label", "Search");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to input element", () => {
      const ref = { current: null as HTMLInputElement | null };
      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});
