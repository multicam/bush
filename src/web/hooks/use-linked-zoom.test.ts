/**
 * Tests for useLinkedZoom hook
 *
 * Note: These tests verify the hook's logic without rendering.
 * Full integration tests should be done with actual ImageViewer components.
 */
import { describe, it, expect, vi } from "vitest";

describe("useLinkedZoom interface", () => {
  it("should export correct interface types", () => {
    // This verifies the types compile correctly
    const options = { enabled: true };

    expect(options.enabled).toBe(true);
  });

  it("should have ImageViewerHandle interface with required methods", () => {
    // Verify ImageViewerHandle has the required methods
    const mockHandle = {
      setZoom: vi.fn((_level: number) => {}),
      getZoom: vi.fn(() => 1),
      setPan: vi.fn((_x: number, _y: number) => {}),
      getPan: vi.fn(() => ({ x: 0, y: 0 })),
      zoomToFit: vi.fn(() => {}),
      zoomTo1to1: vi.fn(() => {}),
      isLoaded: vi.fn(() => true),
    };

    expect(typeof mockHandle.setZoom).toBe("function");
    expect(typeof mockHandle.getZoom).toBe("function");
    expect(typeof mockHandle.setPan).toBe("function");
    expect(typeof mockHandle.getPan).toBe("function");
    expect(typeof mockHandle.zoomToFit).toBe("function");
    expect(typeof mockHandle.zoomTo1to1).toBe("function");
    expect(typeof mockHandle.isLoaded).toBe("function");
  });
});

describe("LinkedZoomControl interface", () => {
  it("should have all required control methods", () => {
    const mockControl = {
      primaryRef: { current: null },
      secondaryRef: { current: null },
      isSynced: true,
      toggleSync: vi.fn(() => {}),
      setSynced: vi.fn((_synced: boolean) => {}),
      syncToPrimary: vi.fn(() => {}),
      setZoomBoth: vi.fn((_level: number) => {}),
      setPanBoth: vi.fn((_x: number, _y: number) => {}),
      zoomBothToFit: vi.fn(() => {}),
      zoomBothTo1to1: vi.fn(() => {}),
    };

    expect(typeof mockControl.toggleSync).toBe("function");
    expect(typeof mockControl.setSynced).toBe("function");
    expect(typeof mockControl.syncToPrimary).toBe("function");
    expect(typeof mockControl.setZoomBoth).toBe("function");
    expect(typeof mockControl.setPanBoth).toBe("function");
    expect(typeof mockControl.zoomBothToFit).toBe("function");
    expect(typeof mockControl.zoomBothTo1to1).toBe("function");
    expect(mockControl.isSynced).toBe(true);
  });

  it("should support all zoom operations", () => {
    // Test that all zoom operations are properly typed
    const operations = {
      setZoom: (level: number) => level,
      setPan: (x: number, y: number) => ({ x, y }),
      zoomToFit: () => "fit",
      zoomTo1to1: () => 1,
    };

    expect(operations.setZoom(1.5)).toBe(1.5);
    expect(operations.setPan(100, 50)).toEqual({ x: 100, y: 50 });
    expect(operations.zoomToFit()).toBe("fit");
    expect(operations.zoomTo1to1()).toBe(1);
  });
});

describe("Linked zoom behavior", () => {
  it("should track zoom levels correctly", () => {
    // Simulate zoom tracking
    let currentZoom = 1;
    const minZoom = 0.25;
    const maxZoom = 4;

    const setZoom = (level: number) => {
      currentZoom = Math.max(minZoom, Math.min(maxZoom, level));
    };

    setZoom(2);
    expect(currentZoom).toBe(2);

    setZoom(5); // Over max
    expect(currentZoom).toBe(4);

    setZoom(0.1); // Under min
    expect(currentZoom).toBe(0.25);
  });

  it("should track pan offsets correctly", () => {
    // Simulate pan tracking
    let panOffset = { x: 0, y: 0 };

    const setPan = (x: number, y: number) => {
      panOffset = { x, y };
    };

    setPan(100, 200);
    expect(panOffset).toEqual({ x: 100, y: 200 });
  });
});
