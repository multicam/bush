import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button (Catalyst)", () => {
  describe("Rendering", () => {
    it("renders children", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("renders as a button element", () => {
      render(<Button>Submit</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("color prop", () => {
    it("renders with color='bush' (primary)", () => {
      render(<Button color="bush">Save</Button>);
      const button = screen.getByRole("button", { name: "Save" });
      expect(button).toBeInTheDocument();
    });

    it("renders with color='red'", () => {
      render(<Button color="red">Delete</Button>);
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    it("renders with default color (dark/zinc)", () => {
      render(<Button>Default</Button>);
      expect(screen.getByRole("button", { name: "Default" })).toBeInTheDocument();
    });
  });

  describe("outline prop", () => {
    it("renders with outline prop", () => {
      render(<Button outline>Outline</Button>);
      expect(screen.getByRole("button", { name: "Outline" })).toBeInTheDocument();
    });
  });

  describe("plain prop", () => {
    it("renders with plain prop", () => {
      render(<Button plain>Cancel</Button>);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows SpinnerIcon SVG when loading", () => {
      const { container } = render(<Button loading>Submit</Button>);
      expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
    });

    it("is disabled when loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("has aria-busy='true' when loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });

    it("still renders children text when loading", () => {
      render(<Button loading>Processing</Button>);
      expect(screen.getByRole("button")).toHaveTextContent("Processing");
    });
  });

  describe("disabled state", () => {
    it("is disabled when disabled prop is set", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("accepts aria-label", () => {
      render(<Button aria-label="Close dialog">×</Button>);
      expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
    });

    it("accepts type='submit'", () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });
  });
});
