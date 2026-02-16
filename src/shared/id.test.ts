/**
 * Bush Platform - ID Generator Tests
 */
import { describe, it, expect } from "vitest";
import { generateId } from "./id.js";

describe("generateId", () => {
  it("should generate an ID with the given prefix", () => {
    const id = generateId("usr");
    expect(id).toMatch(/^usr_[a-f0-9]{24}$/);
  });

  it("should generate unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });

  it("should work with various prefixes", () => {
    expect(generateId("acc")).toMatch(/^acc_/);
    expect(generateId("file")).toMatch(/^file_/);
    expect(generateId("wp")).toMatch(/^wp_/);
  });
});
