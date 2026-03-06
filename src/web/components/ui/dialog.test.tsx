// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogTitle, DialogBody, DialogActions } from "./dialog";
import { Button } from "./button";

describe("Dialog (Catalyst)", () => {
  describe("Visibility", () => {
    it("does not render content when open={false}", () => {
      render(
        <Dialog open={false} onClose={() => {}}>
          <DialogTitle>Confirm Delete</DialogTitle>
        </Dialog>
      );
      expect(screen.queryByText("Confirm Delete")).not.toBeInTheDocument();
    });

    it("renders content when open={true}", () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogTitle>Confirm Delete</DialogTitle>
        </Dialog>
      );
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
    });
  });

  describe("DialogTitle", () => {
    it("renders title text", () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogTitle>Upload Complete</DialogTitle>
        </Dialog>
      );
      expect(screen.getByText("Upload Complete")).toBeInTheDocument();
    });
  });

  describe("DialogBody", () => {
    it("renders body content", () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogBody>
            <p>Are you sure you want to delete this project?</p>
          </DialogBody>
        </Dialog>
      );
      expect(screen.getByText("Are you sure you want to delete this project?")).toBeInTheDocument();
    });
  });

  describe("DialogActions", () => {
    it("renders action buttons", () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogActions>
            <Button plain>Cancel</Button>
            <Button color="red">Delete</Button>
          </DialogActions>
        </Dialog>
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });
  });

  describe("Composition", () => {
    it("renders full dialog with all parts", () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogBody>
            <p>This action cannot be undone.</p>
          </DialogBody>
          <DialogActions>
            <Button plain>Cancel</Button>
            <Button color="bush">Confirm</Button>
          </DialogActions>
        </Dialog>
      );
      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });
  });
});
