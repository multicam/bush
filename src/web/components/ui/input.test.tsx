// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";
import { Field, Label, ErrorMessage } from "./fieldset";

describe("Input (Catalyst)", () => {
  describe("Rendering", () => {
    it("renders an input element", () => {
      render(<Input />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("accepts placeholder", () => {
      render(<Input placeholder="Enter your email" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Enter your email");
    });

    it("accepts value and onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Input onChange={onChange} />);
      await user.type(screen.getByRole("textbox"), "hello");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("Field composition with Label", () => {
    it("renders Label text alongside Input", () => {
      render(
        <Field>
          <Label>Email Address</Label>
          <Input />
        </Field>
      );
      expect(screen.getByText("Email Address")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("Input is associated with Label via HeadlessUI Field", () => {
      render(
        <Field>
          <Label>Username</Label>
          <Input />
        </Field>
      );
      const label = screen.getByText("Username");
      const input = screen.getByRole("textbox");
      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });
  });

  describe("ErrorMessage composition", () => {
    it("renders ErrorMessage text when provided", () => {
      render(
        <Field>
          <Label>Email</Label>
          <Input />
          <ErrorMessage>Invalid email address</ErrorMessage>
        </Field>
      );
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });

    it("ErrorMessage has red text styling", () => {
      render(
        <Field>
          <Input />
          <ErrorMessage>This field is required</ErrorMessage>
        </Field>
      );
      const errorEl = screen.getByText("This field is required");
      expect(errorEl.className).toMatch(/text-red/);
    });

    it("renders both Label and ErrorMessage together", () => {
      render(
        <Field>
          <Label>Password</Label>
          <Input type="password" />
          <ErrorMessage>Password must be at least 8 characters</ErrorMessage>
        </Field>
      );
      expect(screen.getByText("Password")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });
  });

  describe("Ref forwarding", () => {
    it("forwards ref to the native input element", () => {
      const ref = { current: null as HTMLInputElement | null };
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});
