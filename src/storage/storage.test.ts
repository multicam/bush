/**
 * Bush Platform - Storage Module Tests
 *
 * Tests the storage key utilities without requiring env vars.
 */
import { describe, it, expect } from "vitest";
import { buildStorageKey, parseStorageKey } from "./types.js";

/**
 * Storage key builder helpers (duplicated here to avoid importing index.ts which loads config)
 */
const storageKeys = {
  original: (parts: { accountId: string; projectId: string; assetId: string }, filename: string): string =>
    buildStorageKey({ ...parts, type: "original", filename }),

  proxy: (parts: { accountId: string; projectId: string; assetId: string }, resolution: string): string =>
    buildStorageKey({ ...parts, type: "proxy", filename: `${resolution}.mp4` }),

  thumbnail: (parts: { accountId: string; projectId: string; assetId: string }, size = "320"): string =>
    buildStorageKey({ ...parts, type: "thumbnail", filename: `thumb_${size}.jpg` }),

  filmstrip: (parts: { accountId: string; projectId: string; assetId: string }): string =>
    buildStorageKey({ ...parts, type: "filmstrip", filename: "strip.jpg" }),

  waveform: (parts: { accountId: string; projectId: string; assetId: string }, format: "json" | "png"): string =>
    buildStorageKey({ ...parts, type: "waveform", filename: `waveform.${format}` }),

  hlsMaster: (parts: { accountId: string; projectId: string; assetId: string }): string =>
    buildStorageKey({ ...parts, type: "hls", filename: "master.m3u8" }),

  hlsVariant: (parts: { accountId: string; projectId: string; assetId: string }, resolution: string): string =>
    buildStorageKey({ ...parts, type: "hls", filename: `${resolution}/playlist.m3u8` }),

  hlsSegment: (parts: { accountId: string; projectId: string; assetId: string }, resolution: string, segment: number): string =>
    buildStorageKey({
      ...parts,
      type: "hls",
      filename: `${resolution}/segment_${String(segment).padStart(4, "0")}.ts`,
    }),
};

describe("Storage Key Utilities", () => {
  describe("buildStorageKey", () => {
    it("should build a valid storage key", () => {
      const key = buildStorageKey({
        accountId: "acc_123",
        projectId: "proj_456",
        assetId: "asset_789",
        type: "original",
        filename: "video.mp4",
      });

      expect(key).toBe("acc_123/proj_456/asset_789/original/video.mp4");
    });

    it("should handle nested filenames", () => {
      const key = buildStorageKey({
        accountId: "acc_123",
        projectId: "proj_456",
        assetId: "asset_789",
        type: "hls",
        filename: "720p/playlist.m3u8",
      });

      expect(key).toBe("acc_123/proj_456/asset_789/hls/720p/playlist.m3u8");
    });
  });

  describe("parseStorageKey", () => {
    it("should parse a valid storage key", () => {
      const result = parseStorageKey("acc_123/proj_456/asset_789/original/video.mp4");

      expect(result).toEqual({
        accountId: "acc_123",
        projectId: "proj_456",
        assetId: "asset_789",
        type: "original",
        filename: "video.mp4",
      });
    });

    it("should return null for invalid key format", () => {
      expect(parseStorageKey("invalid/key")).toBeNull();
      expect(parseStorageKey("a/b/c/d")).toBeNull(); // Only 4 parts
    });

    it("should return null for invalid derivative type", () => {
      expect(parseStorageKey("acc/proj/asset/invalid/file.mp4")).toBeNull();
    });

    it("should parse all derivative types", () => {
      const types = ["original", "proxy", "thumbnail", "filmstrip", "waveform", "hls"];

      for (const type of types) {
        const result = parseStorageKey(`acc/proj/asset/${type}/file.ext`);
        expect(result?.type).toBe(type);
      }
    });
  });

  describe("storageKeys helpers", () => {
    const base = {
      accountId: "acc_123",
      projectId: "proj_456",
      assetId: "asset_789",
    };

    it("should build original key", () => {
      const key = storageKeys.original(base, "video.mov");
      expect(key).toBe("acc_123/proj_456/asset_789/original/video.mov");
    });

    it("should build proxy key with resolution", () => {
      const key = storageKeys.proxy(base, "720p");
      expect(key).toBe("acc_123/proj_456/asset_789/proxy/720p.mp4");
    });

    it("should build thumbnail key", () => {
      const key = storageKeys.thumbnail(base, "320");
      expect(key).toBe("acc_123/proj_456/asset_789/thumbnail/thumb_320.jpg");
    });

    it("should build thumbnail key with default size", () => {
      const key = storageKeys.thumbnail(base);
      expect(key).toBe("acc_123/proj_456/asset_789/thumbnail/thumb_320.jpg");
    });

    it("should build filmstrip key", () => {
      const key = storageKeys.filmstrip(base);
      expect(key).toBe("acc_123/proj_456/asset_789/filmstrip/strip.jpg");
    });

    it("should build waveform keys", () => {
      const jsonKey = storageKeys.waveform(base, "json");
      expect(jsonKey).toBe("acc_123/proj_456/asset_789/waveform/waveform.json");

      const pngKey = storageKeys.waveform(base, "png");
      expect(pngKey).toBe("acc_123/proj_456/asset_789/waveform/waveform.png");
    });

    it("should build HLS keys", () => {
      const masterKey = storageKeys.hlsMaster(base);
      expect(masterKey).toBe("acc_123/proj_456/asset_789/hls/master.m3u8");

      const variantKey = storageKeys.hlsVariant(base, "720p");
      expect(variantKey).toBe("acc_123/proj_456/asset_789/hls/720p/playlist.m3u8");

      const segmentKey = storageKeys.hlsSegment(base, "720p", 1);
      expect(segmentKey).toBe("acc_123/proj_456/asset_789/hls/720p/segment_0001.ts");

      const segmentKey2 = storageKeys.hlsSegment(base, "720p", 42);
      expect(segmentKey2).toBe("acc_123/proj_456/asset_789/hls/720p/segment_0042.ts");
    });
  });
});
