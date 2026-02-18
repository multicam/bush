/**
 * Bush Platform - Metadata Badges Tests
 *
 * Tests for the metadata badges component.
 * Reference: IMPLEMENTATION_PLAN.md [P2] Metadata Badges
 */
import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MetadataBadges } from "./metadata-badges";
import type { AssetFile } from "./types";

function createMockFile(overrides: Partial<AssetFile> = {}): AssetFile {
  return {
    id: "file-1",
    name: "test-file.mp4",
    mimeType: "video/mp4",
    fileSizeBytes: 1024 * 1024 * 100, // 100MB
    status: "ready",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("MetadataBadges", () => {
  it("renders nothing when no metadata is available", () => {
    const file = createMockFile();
    const { container } = render(<MetadataBadges file={file} cardSize="medium" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders duration badge for video files", () => {
    const file = createMockFile({ duration: 125 }); // 2:05
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("2:05")).toBeTruthy();
  });

  it("formats long durations with hours", () => {
    const file = createMockFile({ duration: 3661 }); // 1:01:01
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("1:01:01")).toBeTruthy();
  });

  it("renders resolution badge", () => {
    const file = createMockFile({ width: 1920, height: 1080 });
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("1080p")).toBeTruthy();
  });

  it("renders 4K resolution label", () => {
    const file = createMockFile({ width: 3840, height: 2160 });
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("4K")).toBeTruthy();
  });

  it("renders rating badge", () => {
    const file = createMockFile({ rating: 4 });
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("4")).toBeTruthy();
  });

  it("renders status badge", () => {
    const file = createMockFile({ assetStatus: "Approved" });
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("Approved")).toBeTruthy();
  });

  it("renders first keyword", () => {
    const file = createMockFile({ keywords: ["action", "outdoor", "sunset"] });
    render(<MetadataBadges file={file} cardSize="medium" />);

    expect(screen.getByText("action")).toBeTruthy();
    // Only first keyword should show
    expect(screen.queryByText("outdoor")).toBeNull();
  });

  it("respects maxBadges limit", () => {
    const file = createMockFile({
      duration: 60,
      width: 1920,
      height: 1080,
      rating: 5,
      assetStatus: "Approved",
      keywords: ["featured"],
    });
    render(<MetadataBadges file={file} cardSize="medium" maxBadges={2} />);

    // Should show only 2 badges (duration and resolution have highest priority)
    const badges = screen.getAllByRole("generic").filter((el) =>
      el.className.includes("badge")
    );
    expect(badges.length).toBeLessThanOrEqual(2);
  });

  it("shows more badges on larger card sizes", () => {
    const file = createMockFile({
      duration: 60,
      width: 1920,
      height: 1080,
      rating: 5,
      assetStatus: "Approved",
    });

    // Large cards can show up to 4 badges by default
    render(<MetadataBadges file={file} cardSize="large" />);

    expect(screen.getByText("1:00")).toBeTruthy(); // duration
    expect(screen.getByText("1080p")).toBeTruthy(); // resolution
    expect(screen.getByText("5")).toBeTruthy(); // rating
    expect(screen.getByText("Approved")).toBeTruthy(); // status
  });

  it("shows fewer badges on small card sizes", () => {
    const file = createMockFile({
      duration: 60,
      width: 1920,
      height: 1080,
      rating: 5,
    });

    // Small cards show up to 2 badges by default
    render(<MetadataBadges file={file} cardSize="small" />);

    // Duration and resolution should show
    expect(screen.getByText("1:00")).toBeTruthy();
    expect(screen.getByText("1080p")).toBeTruthy();

    // Rating might not show due to limit
    expect(screen.queryByText("5")).toBeNull();
  });

  it("does not render duration badge for zero duration", () => {
    const file = createMockFile({ duration: 0 });
    const { container } = render(<MetadataBadges file={file} cardSize="medium" />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render resolution badge without both dimensions", () => {
    const file = createMockFile({ width: 1920, height: null });
    const { container } = render(<MetadataBadges file={file} cardSize="medium" />);
    expect(container.firstChild).toBeNull();
  });
});
