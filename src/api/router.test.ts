/**
 * Bush Platform - Router Utilities Tests
 */
import { describe, it, expect, vi } from "vitest";
import { generateId, parseLimit, parseInclude, parseFields, createRouter, errorHandler, notFoundHandler } from "./router.js";
import { NotFoundError, RateLimitError } from "../errors/index.js";

describe("generateId", () => {
  it("should generate an ID with the given prefix", () => {
    const id = generateId("file");
    expect(id).toMatch(/^file_[a-f0-9]{24}$/);
  });

  it("should generate unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });

  it("should generate IDs with different prefixes", () => {
    const fileId = generateId("file");
    const projectId = generateId("project");
    const workspaceId = generateId("workspace");

    expect(fileId).toMatch(/^file_/);
    expect(projectId).toMatch(/^project_/);
    expect(workspaceId).toMatch(/^workspace_/);
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

  it("should handle limit of 1", () => {
    expect(parseLimit("1")).toBe(1);
  });

  it("should handle limit at max boundary", () => {
    expect(parseLimit("100")).toBe(100);
  });

  it("should use custom max limit", () => {
    expect(parseLimit("150", 50, 200)).toBe(150);
    expect(parseLimit("250", 50, 200)).toBe(200);
  });

  it("should handle float strings", () => {
    expect(parseLimit("10.5")).toBe(10);
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

  it("should filter empty strings", () => {
    expect(parseInclude("workspace,,project,")).toEqual(["workspace", "project"]);
  });

  it("should handle single include", () => {
    expect(parseInclude("workspace")).toEqual(["workspace"]);
  });

  it("should handle multiple includes", () => {
    expect(parseInclude("a,b,c,d,e")).toEqual(["a", "b", "c", "d", "e"]);
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

  it("should trim whitespace", () => {
    expect(parseFields(" name , email ")).toEqual(["name", "email"]);
  });

  it("should filter empty strings", () => {
    expect(parseFields("name,,email,")).toEqual(["name", "email"]);
  });

  it("should handle single field", () => {
    expect(parseFields("name")).toEqual(["name"]);
  });
});

describe("createRouter", () => {
  it("should create a new Hono router", () => {
    const router = createRouter();
    expect(router).toBeDefined();
    expect(typeof router.get).toBe("function");
    expect(typeof router.post).toBe("function");
    expect(typeof router.put).toBe("function");
    expect(typeof router.delete).toBe("function");
  });
});

describe("errorHandler", () => {
  it("should handle AppError correctly", async () => {
    const error = new NotFoundError("Project", "proj_123");
    const mockContext = {
      get: vi.fn().mockReturnValue({ requestId: "req_test" }),
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
    } as any;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(error, mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            title: "Not Found",
            status: 404,
          }),
        ]),
      }),
      404
    );

    consoleSpy.mockRestore();
  });

  it("should handle RateLimitError with Retry-After header", async () => {
    const error = new RateLimitError(30);
    const mockContext = {
      get: vi.fn().mockReturnValue({ requestId: "req_test" }),
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
    } as any;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(error, mockContext);

    expect(mockContext.header).toHaveBeenCalledWith("Retry-After", "30");

    consoleSpy.mockRestore();
  });

  it("should handle generic Error", async () => {
    const error = new Error("Something went wrong");
    const mockContext = {
      get: vi.fn().mockReturnValue(undefined),
      header: vi.fn(),
      json: vi.fn().mockReturnValue(new Response()),
    } as any;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(error, mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            status: 500,
          }),
        ]),
      }),
      500
    );

    consoleSpy.mockRestore();
  });
});

describe("notFoundHandler", () => {
  it("should return 404 with route not found message", () => {
    const mockContext = {
      req: { path: "/v4/unknown" },
      json: vi.fn().mockReturnValue(new Response()),
    } as any;

    notFoundHandler(mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      {
        errors: [{
          title: "Not Found",
          detail: "Route /v4/unknown not found",
          status: 404,
          code: "not_found",
        }],
      },
      404
    );
  });
});
