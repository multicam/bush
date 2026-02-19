/**
 * Bush Platform - Response Utilities Tests
 */
import { describe, it, expect, vi } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  singleResponse,
  collectionResponse,
  formatDates,
  RESOURCE_TYPES,
  sendSingle,
  sendCollection,
  sendNoContent,
  sendAccepted,
} from "./response.js";

describe("encodeCursor / decodeCursor", () => {
  it("should round-trip a cursor", () => {
    const cursor = { id: "abc", createdAt: "2024-01-01" };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("should return null for invalid cursor", () => {
    expect(decodeCursor("not-valid-base64!!!")).toBeNull();
  });
});

describe("singleResponse", () => {
  it("should format a single resource", () => {
    const result = singleResponse({ id: "1", name: "Test" }, "file");
    expect(result.data.id).toBe("1");
    expect(result.data.type).toBe("file");
    expect(result.data.attributes).toEqual({ name: "Test" });
  });

  it("should include relationships when provided", () => {
    const result = singleResponse(
      { id: "1", name: "Test" },
      "file",
      { relationships: { project: { data: { id: "p1", type: "project" } } } }
    );
    expect(result.data.relationships?.project.data).toEqual({ id: "p1", type: "project" });
  });

  it("should include self link when provided", () => {
    const result = singleResponse(
      { id: "1", name: "Test" },
      "file",
      { selfLink: "/v4/files/1" }
    );
    expect(result.data.links?.self).toBe("/v4/files/1");
  });
});

describe("collectionResponse", () => {
  it("should format a collection of resources", () => {
    const items = [
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ];
    const result = collectionResponse(items, "file", {
      basePath: "/v4/files",
      limit: 50,
      totalCount: 2,
    });
    expect(result.data).toHaveLength(2);
    expect(result.meta?.total_count).toBe(2);
    expect(result.meta?.has_more).toBe(false);
  });

  it("should add next link when there are more items", () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      createdAt: "2024-01-01",
    }));
    const result = collectionResponse(items, "file", {
      basePath: "/v4/files",
      limit: 2,
      totalCount: 10,
    });
    expect(result.data).toHaveLength(2);
    expect(result.meta?.has_more).toBe(true);
    expect(result.links?.next).toContain("cursor=");
  });

  it("should cap limit at 100", () => {
    const items = [{ id: "1", name: "A" }];
    const result = collectionResponse(items, "file", {
      basePath: "/v4/files",
      limit: 200,
    });
    expect(result.meta?.page_size).toBe(100);
  });

  it("should preserve query params in links", () => {
    const items = [{ id: "1", name: "A" }];
    const result = collectionResponse(items, "file", {
      basePath: "/v4/files",
      queryParams: { status: "ready" },
    });
    expect(result.links?.self).toBe("/v4/files?status=ready");
  });
});

describe("formatDates", () => {
  it("should convert Date objects to ISO strings", () => {
    const record = {
      id: "1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };
    const result = formatDates(record);
    expect(result.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(result.updatedAt).toBe("2024-01-02T00:00:00.000Z");
  });

  it("should convert numeric timestamps to ISO strings", () => {
    const ts = new Date("2024-01-01T00:00:00Z").getTime();
    const record = { id: "1", createdAt: ts };
    const result = formatDates(record);
    expect(result.createdAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("should leave non-date fields unchanged", () => {
    const record = { id: "1", name: "Test", createdAt: null };
    const result = formatDates(record);
    expect(result.name).toBe("Test");
    expect(result.createdAt).toBeNull();
  });
});

describe("RESOURCE_TYPES", () => {
  it("should contain expected types", () => {
    expect(RESOURCE_TYPES.FILE).toBe("file");
    expect(RESOURCE_TYPES.FOLDER).toBe("folder");
    expect(RESOURCE_TYPES.PROJECT).toBe("project");
    expect(RESOURCE_TYPES.WORKSPACE).toBe("workspace");
    expect(RESOURCE_TYPES.ACCOUNT).toBe("account");
    expect(RESOURCE_TYPES.USER).toBe("user");
    expect(RESOURCE_TYPES.VERSION_STACK).toBe("version_stack");
    expect(RESOURCE_TYPES.COMMENT).toBe("comment");
    expect(RESOURCE_TYPES.SHARE).toBe("share");
    expect(RESOURCE_TYPES.NOTIFICATION).toBe("notification");
    expect(RESOURCE_TYPES.CUSTOM_FIELD).toBe("custom_field");
    expect(RESOURCE_TYPES.COLLECTION).toBe("collection");
    expect(RESOURCE_TYPES.WEBHOOK).toBe("webhook");
    expect(RESOURCE_TYPES.TRANSCRIPT).toBe("transcript");
    expect(RESOURCE_TYPES.CAPTION).toBe("caption");
  });
});

describe("sendSingle", () => {
  it("should send JSON response for single resource", () => {
    const mockJson = vi.fn();
    const c = { json: mockJson } as any;

    sendSingle(c, { id: "1", name: "Test" }, "file");

    expect(mockJson).toHaveBeenCalledWith({
      data: {
        id: "1",
        type: "file",
        attributes: { name: "Test" },
      },
    });
  });

  it("should pass options to singleResponse", () => {
    const mockJson = vi.fn();
    const c = { json: mockJson } as any;

    sendSingle(c, { id: "1", name: "Test" }, "file", {
      selfLink: "/v4/files/1",
    });

    expect(mockJson).toHaveBeenCalledWith({
      data: {
        id: "1",
        type: "file",
        attributes: { name: "Test" },
        links: { self: "/v4/files/1" },
      },
    });
  });
});

describe("sendCollection", () => {
  it("should send JSON response for collection", () => {
    const mockJson = vi.fn();
    const c = { json: mockJson } as any;

    sendCollection(
      c,
      [
        { id: "1", name: "A" },
        { id: "2", name: "B" },
      ],
      "file",
      { basePath: "/v4/files" }
    );

    expect(mockJson).toHaveBeenCalled();
    const call = mockJson.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.data[0].type).toBe("file");
  });
});

describe("sendNoContent", () => {
  it("should send 204 response with null body", () => {
    const mockBody = vi.fn();
    const c = { body: mockBody } as any;

    sendNoContent(c);

    expect(mockBody).toHaveBeenCalledWith(null, 204);
  });
});

describe("sendAccepted", () => {
  it("should send 202 response with default message", () => {
    const mockJson = vi.fn();
    const c = { json: mockJson } as any;

    sendAccepted(c);

    expect(mockJson).toHaveBeenCalledWith(
      { message: "Request accepted for processing" },
      202
    );
  });

  it("should send 202 response with custom message", () => {
    const mockJson = vi.fn();
    const c = { json: mockJson } as any;

    sendAccepted(c, "File deletion in progress");

    expect(mockJson).toHaveBeenCalledWith(
      { message: "File deletion in progress" },
      202
    );
  });
});
