/**
 * Tests for storage types and utilities
 */
import { describe, it, expect } from "vitest";
import {
  buildStorageKey,
  parseStorageKey,
} from "./types.js";
import type {
  StorageKey,
  DerivativeType,
  StorageProviderType,
  PresignedUrlOperation,
  StorageObject,
  ListObjectsResult,
  MultipartPart,
  MultipartUploadInit,
  MultipartPartUrl,
  PresignedUrlResult,
  StorageConfig,
} from "./types.js";

describe("storage types", () => {
  describe("buildStorageKey", () => {
    it("builds a storage key from components", () => {
      const parts: StorageKey = {
        accountId: "acc-123",
        projectId: "proj-456",
        assetId: "asset-789",
        type: "original",
        filename: "video.mp4",
      };

      const result = buildStorageKey(parts);

      expect(result).toBe("acc-123/proj-456/asset-789/original/video.mp4");
    });

    it("builds keys for different derivative types", () => {
      const types: DerivativeType[] = [
        "original",
        "proxy",
        "thumbnail",
        "filmstrip",
        "waveform",
        "hls",
      ];

      for (const type of types) {
        const parts: StorageKey = {
          accountId: "acc",
          projectId: "proj",
          assetId: "asset",
          type,
          filename: "file",
        };
        const result = buildStorageKey(parts);
        expect(result).toContain(type);
      }
    });
  });

  describe("parseStorageKey", () => {
    it("parses a valid storage key", () => {
      const result = parseStorageKey("acc-123/proj-456/asset-789/original/video.mp4");

      expect(result).toEqual({
        accountId: "acc-123",
        projectId: "proj-456",
        assetId: "asset-789",
        type: "original",
        filename: "video.mp4",
      });
    });

    it("parses proxy derivative type", () => {
      const result = parseStorageKey("acc/proj/asset/proxy/720p.mp4");

      expect(result?.type).toBe("proxy");
    });

    it("parses thumbnail derivative type", () => {
      const result = parseStorageKey("acc/proj/asset/thumbnail/thumb.jpg");

      expect(result?.type).toBe("thumbnail");
    });

    it("parses filmstrip derivative type", () => {
      const result = parseStorageKey("acc/proj/asset/filmstrip/film.jpg");

      expect(result?.type).toBe("filmstrip");
    });

    it("parses waveform derivative type", () => {
      const result = parseStorageKey("acc/proj/asset/waveform/wave.json");

      expect(result?.type).toBe("waveform");
    });

    it("parses hls derivative type", () => {
      const result = parseStorageKey("acc/proj/asset/hls/playlist.m3u8");

      expect(result?.type).toBe("hls");
    });

    it("returns null for invalid key with too few parts", () => {
      const result = parseStorageKey("acc/proj/asset");

      expect(result).toBeNull();
    });

    it("returns null for invalid key with too many parts", () => {
      const result = parseStorageKey("acc/proj/asset/original/file/extra");

      expect(result).toBeNull();
    });

    it("returns null for invalid derivative type", () => {
      const result = parseStorageKey("acc/proj/asset/invalid/file.mp4");

      expect(result).toBeNull();
    });

    it("returns null for empty parts", () => {
      const result = parseStorageKey("///original/file.mp4");

      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = parseStorageKey("");

      expect(result).toBeNull();
    });
  });

  describe("type definitions compile correctly", () => {
    it("StorageProviderType allows valid types", () => {
      const types: StorageProviderType[] = ["s3", "r2", "minio", "b2"];
      expect(types).toHaveLength(4);
    });

    it("DerivativeType allows valid types", () => {
      const types: DerivativeType[] = [
        "original",
        "proxy",
        "thumbnail",
        "filmstrip",
        "waveform",
        "hls",
      ];
      expect(types).toHaveLength(6);
    });

    it("PresignedUrlOperation allows valid operations", () => {
      const ops: PresignedUrlOperation[] = ["get", "put"];
      expect(ops).toHaveLength(2);
    });

    it("StorageObject interface is valid", () => {
      const obj: StorageObject = {
        key: "path/to/file.mp4",
        size: 1024,
        etag: "abc123",
        lastModified: new Date(),
        contentType: "video/mp4",
      };
      expect(obj.key).toBe("path/to/file.mp4");
    });

    it("ListObjectsResult interface is valid", () => {
      const result: ListObjectsResult = {
        objects: [],
        isTruncated: false,
        nextCursor: undefined,
      };
      expect(result.isTruncated).toBe(false);
    });

    it("MultipartPart interface is valid", () => {
      const part: MultipartPart = {
        partNumber: 1,
        etag: "etag123",
      };
      expect(part.partNumber).toBe(1);
    });

    it("MultipartUploadInit interface is valid", () => {
      const init: MultipartUploadInit = {
        uploadId: "upload-123",
        key: "path/to/file.mp4",
      };
      expect(init.uploadId).toBe("upload-123");
    });

    it("MultipartPartUrl interface is valid", () => {
      const url: MultipartPartUrl = {
        partNumber: 1,
        url: "https://example.com/upload",
      };
      expect(url.url).toBe("https://example.com/upload");
    });

    it("PresignedUrlResult interface is valid", () => {
      const result: PresignedUrlResult = {
        url: "https://example.com/presigned",
        expiresAt: new Date(),
        key: "path/to/file.mp4",
      };
      expect(result.key).toBe("path/to/file.mp4");
    });

    it("StorageConfig interface is valid", () => {
      const config: StorageConfig = {
        provider: "s3",
        region: "us-east-1",
        accessKey: "key",
        secretKey: "secret",
        bucket: "my-bucket",
      };
      expect(config.provider).toBe("s3");
    });
  });
});
