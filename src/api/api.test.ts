/**
 * Bush Platform - API Response Utilities Tests
 */
import { describe, it, expect } from "vitest";
import {
  singleResponse,
  collectionResponse,
  encodeCursor,
  decodeCursor,
  formatDates,
  RESOURCE_TYPES,
} from "./response.js";

describe("API Response Utilities", () => {
  describe("singleResponse", () => {
    it("should format a single resource correctly", () => {
      const data = { id: "file_123", name: "test.mp4", size: 1000 };
      const response = singleResponse(data, "file");

      expect(response.data.id).toBe("file_123");
      expect(response.data.type).toBe("file");
      expect(response.data.attributes.name).toBe("test.mp4");
      expect(response.data.attributes.size).toBe(1000);
    });

    it("should include self link when provided", () => {
      const data = { id: "file_123", name: "test.mp4" };
      const response = singleResponse(data, "file", { selfLink: "/v4/files/file_123" });

      expect(response.data.links?.self).toBe("/v4/files/file_123");
    });

    it("should include relationships when provided", () => {
      const data = { id: "file_123", name: "test.mp4" };
      const response = singleResponse(data, "file", {
        relationships: {
          project: { data: { id: "prj_1", type: "project" } },
        },
      });

      expect(response.data.relationships?.project).toEqual({
        data: { id: "prj_1", type: "project" },
      });
    });
  });

  describe("collectionResponse", () => {
    it("should format a collection correctly", () => {
      const items = [
        { id: "file_1", name: "a.mp4" },
        { id: "file_2", name: "b.mp4" },
      ];
      const response = collectionResponse(items, "file", {
        basePath: "/v4/files",
        limit: 50,
        totalCount: 2,
      });

      expect(response.data).toHaveLength(2);
      expect(response.data[0].id).toBe("file_1");
      expect(response.data[1].id).toBe("file_2");
      expect(response.links?.self).toBe("/v4/files");
      expect(response.meta?.total_count).toBe(2);
      expect(response.meta?.has_more).toBe(false);
    });

    it("should respect limit parameter", () => {
      const items = [
        { id: "file_1", name: "a.mp4" },
        { id: "file_2", name: "b.mp4" },
        { id: "file_3", name: "c.mp4" },
      ];
      const response = collectionResponse(items, "file", {
        basePath: "/v4/files",
        limit: 2,
        totalCount: 3,
      });

      expect(response.data).toHaveLength(2);
      expect(response.meta?.has_more).toBe(true);
    });

    it("should cap limit at 100", () => {
      const items = Array.from({ length: 150 }, (_, i) => ({
        id: `file_${i}`,
        name: `file_${i}.mp4`,
      }));
      const response = collectionResponse(items, "file", {
        basePath: "/v4/files",
        limit: 150, // Should be capped to 100
        totalCount: 150,
      });

      expect(response.data).toHaveLength(100);
      expect(response.meta?.page_size).toBe(100);
    });

    it("should include next cursor when hasMore", () => {
      const items = [
        { id: "file_1", name: "a.mp4" },
        { id: "file_2", name: "b.mp4" },
        { id: "file_3", name: "c.mp4" },
      ];
      const response = collectionResponse(items, "file", {
        basePath: "/v4/files",
        limit: 2,
        totalCount: 3,
      });

      expect(response.links?.next).toBeDefined();
      expect(response.links?.next).toContain("cursor=");
    });
  });

  describe("encodeCursor / decodeCursor", () => {
    it("should encode and decode cursor correctly", () => {
      const cursor = { id: "file_123", createdAt: 1234567890 };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("should return null for invalid cursor", () => {
      expect(decodeCursor("invalid-base64!!!")).toBeNull();
    });
  });

  describe("formatDates", () => {
    it("should convert Date objects to ISO strings", () => {
      const record = {
        id: "file_1",
        createdAt: new Date("2026-01-15T10:30:00Z"),
        updatedAt: new Date("2026-01-15T11:00:00Z"),
      };
      const formatted = formatDates(record);

      expect(formatted.createdAt).toBe("2026-01-15T10:30:00.000Z");
      expect(formatted.updatedAt).toBe("2026-01-15T11:00:00.000Z");
    });

    it("should convert numeric timestamps to ISO strings", () => {
      const timestamp = new Date("2026-01-15T10:30:00Z").getTime();
      const record = {
        id: "file_1",
        createdAt: timestamp,
      };
      const formatted = formatDates(record);

      expect(typeof formatted.createdAt).toBe("string");
    });

    it("should preserve non-date fields", () => {
      const record = {
        id: "file_1",
        name: "test.mp4",
        size: 1000,
      };
      const formatted = formatDates(record);

      expect(formatted.id).toBe("file_1");
      expect(formatted.name).toBe("test.mp4");
      expect(formatted.size).toBe(1000);
    });
  });

  describe("RESOURCE_TYPES", () => {
    it("should have all required resource types", () => {
      expect(RESOURCE_TYPES.ACCOUNT).toBe("account");
      expect(RESOURCE_TYPES.USER).toBe("user");
      expect(RESOURCE_TYPES.WORKSPACE).toBe("workspace");
      expect(RESOURCE_TYPES.PROJECT).toBe("project");
      expect(RESOURCE_TYPES.FOLDER).toBe("folder");
      expect(RESOURCE_TYPES.FILE).toBe("file");
      expect(RESOURCE_TYPES.VERSION_STACK).toBe("version_stack");
      expect(RESOURCE_TYPES.COMMENT).toBe("comment");
      expect(RESOURCE_TYPES.SHARE).toBe("share");
      expect(RESOURCE_TYPES.NOTIFICATION).toBe("notification");
    });
  });
});
