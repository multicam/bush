/**
 * Vitest Web (Frontend) Setup
 *
 * Sets up jsdom environment for React component testing.
 * Reference: specs/15-frontend-testing.md
 */
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

// Set up React globals for testing
vi.stubGlobal("React", React);

// Mock next/navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Inter: () => ({
    style: { fontFamily: "Inter" },
    className: "font-inter",
  }),
  JetBrains_Mono: () => ({
    style: { fontFamily: "JetBrains Mono" },
    className: "font-mono",
  }),
}));

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock crypto.randomUUID for tests
Object.defineProperty(crypto, "randomUUID", {
  value: () => "test-uuid-1234-5678-9abc",
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});
