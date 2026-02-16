/**
 * Bush Platform - Router Utilities Tests
 */
import { describe, it, expect } from "vitest";
import { generateId, parseLimit, parseInclude, parseFields } from "./router.js";

describe("generateId", () => {
  it("should generate an ID with the given prefix", () => {
    const id = generateId("file");
    expect(id).toMatch(/^file_[a-f0-9]{24}$/);
  });

  it("should generate unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });
});

describe("parseLimit", () => {
  it("should return default limit when no value provided", () => {
    expect(parseLimit()).toBe(50);
  });

  it("should parse valid limit", () => {
    expect(parseLimit("25")).toBe(25);
  });

  it("should cap at max limit", () => {
    expect(parseLimit("200")).toBe(100);
  });

  it("should return default for invalid input", () => {
    expect(parseLimit("abc")).toBe(50);
    expect(parseLimit("0")).toBe(50);
    expect(parseLimit("-1")).toBe(50);
  });

  it("should use custom defaults", () => {
    expect(parseLimit(undefined, 20, 50)).toBe(20);
    expect(parseLimit("100", 20, 50)).toBe(50);
  });
});

describe("parseInclude", () => {
  it("should return empty array for no input", () => {
    expect(parseInclude()).toEqual([]);
    expect(parseInclude("")).toEqual([]);
  });

  it("should parse comma-separated includes", () => {
    expect(parseInclude("workspace,project")).toEqual(["workspace", "project"]);
  });

  it("should trim whitespace", () => {
    expect(parseInclude(" workspace , project ")).toEqual(["workspace", "project"]);
  });
});

describe("parseFields", () => {
  it("should return empty array for no input", () => {
    expect(parseFields()).toEqual([]);
    expect(parseFields("")).toEqual([]);
  });

  it("should parse comma-separated fields", () => {
    expect(parseFields("name,email")).toEqual(["name", "email"]);
  });
});
