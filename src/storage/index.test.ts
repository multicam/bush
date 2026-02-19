/**
 * Bush Platform - Storage Service Tests
 *
 * Tests for storage service operations with mocked provider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStorageProvider,
  disposeStorageProvider,
  storage,
  storageKeys,
  buildStorageKey,
  parseStorageKey,
} from "./index.js";
import type {
  IStorageProvider,
  PresignedUrlResult,
  MultipartUploadInit,
  MultipartPartUrl,
  MultipartPart,
  StorageObject,
  ListObjectsResult,
} from "./types.js";

// Mock the config module
vi.mock("../config/index.js", () => ({
  config: {
    STORAGE_PROVIDER: "minio",
    STORAGE_ENDPOINT: "http://localhost:9000",
    STORAGE_REGION: "us-east-1",
    STORAGE_ACCESS_KEY: "test-access-key",
    STORAGE_SECRET_KEY: "test-secret-key",
    STORAGE_BUCKET: "test-bucket",
    STORAGE_BUCKET_DERIVATIVES: "test-derivatives-bucket",
    UPLOAD_PRESIGNED_URL_EXPIRY: 3600,
  },
}));

// Mock the S3 provider
const mockProvider: IStorageProvider = {
  providerType: "s3",
  healthCheck: vi.fn().mockResolvedValue(true),
  getPresignedUrl: vi.fn().mockResolvedValue({
    url: "https://example.com/presigned",
    expiresAt: new Date(Date.now() + 3600000),
    key: "test-key",
  } as PresignedUrlResult),
  initMultipartUpload: vi.fn().mockResolvedValue({
    key: "test-key",
    uploadId: "test-upload-id",
  } as MultipartUploadInit),
  getMultipartPartUrls: vi.fn().mockResolvedValue([
    { partNumber: 1, url: "https://example.com/part1" },
  ] as MultipartPartUrl[]),
  completeMultipartUpload: vi.fn().mockResolvedValue(undefined),
  abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
  headObject: vi.fn().mockResolvedValue(null),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  deleteObjects: vi.fn().mockResolvedValue(undefined),
  copyObject: vi.fn().mockResolvedValue(undefined),
  listObjects: vi.fn().mockResolvedValue({
    objects: [],
    isTruncated: false,
  } as ListObjectsResult),
  getObject: vi.fn().mockResolvedValue(Buffer.from("test")),
  putObject: vi.fn().mockResolvedValue(undefined),
};

vi.mock("./s3-provider.js", () => ({
  S3StorageProvider: vi.fn().mockImplementation(() => mockProvider),
}));

describe("getStorageProvider", () => {
  beforeEach(async () => {
    // Reset singleton state
    await disposeStorageProvider();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await disposeStorageProvider();
  });

  it("should return a storage provider instance", () => {
    const provider = getStorageProvider();
    expect(provider).toBeDefined();
  });

  it("should return the same instance on multiple calls", () => {
    const provider1 = getStorageProvider();
    const provider2 = getStorageProvider();
    expect(provider1).toBe(provider2);
  });
});

describe("disposeStorageProvider", () => {
  it("should dispose the provider", async () => {
    getStorageProvider();
    await disposeStorageProvider();

    // Getting a new provider should create a new instance
    const newProvider = getStorageProvider();
    expect(newProvider).toBeDefined();
  });
});

describe("storage", () => {
  beforeEach(async () => {
    await disposeStorageProvider();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await disposeStorageProvider();
  });

  describe("healthCheck", () => {
    it("should call provider healthCheck", async () => {
      const result = await storage.healthCheck();
      expect(mockProvider.healthCheck).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("getUploadUrl", () => {
    it("should generate upload URL", async () => {
      const key = {
        accountId: "acc_1",
        projectId: "prj_1",
        assetId: "asset_1",
        type: "original" as const,
        filename: "video.mp4",
      };

      const result = await storage.getUploadUrl(key);

      expect(mockProvider.getPresignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        "put",
        3600
      );
      expect(result.url).toBe("https://example.com/presigned");
    });

    it("should use custom expiry", async () => {
      const key = {
        accountId: "acc_1",
        projectId: "prj_1",
        assetId: "asset_1",
        type: "original" as const,
        filename: "video.mp4",
      };

      await storage.getUploadUrl(key, 7200);

      expect(mockProvider.getPresignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        "put",
        7200
      );
    });
  });

  describe("getDownloadUrl", () => {
    it("should generate download URL", async () => {
      const result = await storage.getDownloadUrl("test-key");

      expect(mockProvider.getPresignedUrl).toHaveBeenCalledWith(
        "test-key",
        "get",
        3600
      );
      expect(result.url).toBe("https://example.com/presigned");
    });

    it("should use custom expiry", async () => {
      await storage.getDownloadUrl("test-key", 7200);

      expect(mockProvider.getPresignedUrl).toHaveBeenCalledWith(
        "test-key",
        "get",
        7200
      );
    });
  });

  describe("initChunkedUpload", () => {
    it("should initialize chunked upload", async () => {
      const key = {
        accountId: "acc_1",
        projectId: "prj_1",
        assetId: "asset_1",
        type: "original" as const,
        filename: "video.mp4",
      };

      const result = await storage.initChunkedUpload(key);

      expect(mockProvider.initMultipartUpload).toHaveBeenCalled();
      expect(result.uploadId).toBe("test-upload-id");
    });
  });

  describe("getChunkUrls", () => {
    it("should get chunk URLs", async () => {
      const result = await storage.getChunkUrls("test-key", "upload-1", 3);

      expect(mockProvider.getMultipartPartUrls).toHaveBeenCalledWith(
        "test-key",
        "upload-1",
        3
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("completeChunkedUpload", () => {
    it("should complete chunked upload", async () => {
      const parts: MultipartPart[] = [
        { partNumber: 1, etag: "etag1" },
      ];

      await storage.completeChunkedUpload("test-key", "upload-1", parts);

      expect(mockProvider.completeMultipartUpload).toHaveBeenCalledWith(
        "test-key",
        "upload-1",
        parts
      );
    });
  });

  describe("abortChunkedUpload", () => {
    it("should abort chunked upload", async () => {
      await storage.abortChunkedUpload("test-key", "upload-1");

      expect(mockProvider.abortMultipartUpload).toHaveBeenCalledWith(
        "test-key",
        "upload-1"
      );
    });
  });

  describe("headObject", () => {
    it("should get object metadata", async () => {
      const result = await storage.headObject("test-key");

      expect(mockProvider.headObject).toHaveBeenCalledWith("test-key");
      expect(result).toBeNull();
    });

    it("should return object metadata when available", async () => {
      const mockObject: StorageObject = {
        key: "test-key",
        size: 1024,
        lastModified: new Date(),
        etag: "etag123",
        contentType: "video/mp4",
      };

      vi.mocked(mockProvider.headObject).mockResolvedValueOnce(mockObject);

      const result = await storage.headObject("test-key");

      expect(result).toEqual(mockObject);
    });
  });

  describe("deleteObject", () => {
    it("should delete object", async () => {
      await storage.deleteObject("test-key");

      expect(mockProvider.deleteObject).toHaveBeenCalledWith("test-key");
    });
  });

  describe("deleteObjects", () => {
    it("should delete multiple objects", async () => {
      const keys = ["key1", "key2", "key3"];

      await storage.deleteObjects(keys);

      expect(mockProvider.deleteObjects).toHaveBeenCalledWith(keys);
    });
  });

  describe("copyObject", () => {
    it("should copy object", async () => {
      await storage.copyObject("source-key", "dest-key");

      expect(mockProvider.copyObject).toHaveBeenCalledWith(
        "source-key",
        "dest-key"
      );
    });
  });

  describe("listObjects", () => {
    it("should list objects", async () => {
      const result = await storage.listObjects("prefix/");

      expect(mockProvider.listObjects).toHaveBeenCalledWith("prefix/", undefined);
      expect(result.objects).toEqual([]);
    });

    it("should list objects with max keys", async () => {
      await storage.listObjects("prefix/", 100);

      expect(mockProvider.listObjects).toHaveBeenCalledWith("prefix/", 100);
    });
  });

  describe("getObject", () => {
    it("should get object content", async () => {
      const result = await storage.getObject("test-key");

      expect(mockProvider.getObject).toHaveBeenCalledWith("test-key");
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe("putObject", () => {
    it("should put object content", async () => {
      const buffer = Buffer.from("test content");

      await storage.putObject("test-key", buffer, "text/plain");

      expect(mockProvider.putObject).toHaveBeenCalledWith(
        "test-key",
        buffer,
        "text/plain"
      );
    });

    it("should put object without content type", async () => {
      const buffer = Buffer.from("test content");

      await storage.putObject("test-key", buffer);

      expect(mockProvider.putObject).toHaveBeenCalledWith(
        "test-key",
        buffer,
        undefined
      );
    });
  });
});

describe("storageKeys", () => {
  const baseParts = {
    accountId: "acc_123",
    projectId: "prj_456",
    assetId: "asset_789",
  };

  describe("original", () => {
    it("should build original file key", () => {
      const key = storageKeys.original(baseParts, "video.mp4");
      expect(key).toContain("acc_123");
      expect(key).toContain("prj_456");
      expect(key).toContain("asset_789");
      expect(key).toContain("original");
      expect(key).toContain("video.mp4");
    });
  });

  describe("proxy", () => {
    it("should build proxy video key", () => {
      const key = storageKeys.proxy(baseParts, "1080p");
      expect(key).toContain("proxy");
      expect(key).toContain("1080p.mp4");
    });
  });

  describe("thumbnail", () => {
    it("should build thumbnail key with default size", () => {
      const key = storageKeys.thumbnail(baseParts);
      expect(key).toContain("thumbnail");
      expect(key).toContain("thumb_320.jpg");
    });

    it("should build thumbnail key with custom size", () => {
      const key = storageKeys.thumbnail(baseParts, "640");
      expect(key).toContain("thumb_640.jpg");
    });
  });

  describe("customThumbnail", () => {
    it("should build custom thumbnail key", () => {
      const key = storageKeys.customThumbnail(baseParts);
      expect(key).toContain("thumbnail");
      expect(key).toContain("custom_320.jpg");
    });
  });

  describe("filmstrip", () => {
    it("should build filmstrip key", () => {
      const key = storageKeys.filmstrip(baseParts);
      expect(key).toContain("filmstrip");
      expect(key).toContain("strip.jpg");
    });
  });

  describe("waveform", () => {
    it("should build JSON waveform key", () => {
      const key = storageKeys.waveform(baseParts, "json");
      expect(key).toContain("waveform");
      expect(key).toContain("waveform.json");
    });

    it("should build PNG waveform key", () => {
      const key = storageKeys.waveform(baseParts, "png");
      expect(key).toContain("waveform.png");
    });
  });

  describe("hlsMaster", () => {
    it("should build HLS master playlist key", () => {
      const key = storageKeys.hlsMaster(baseParts);
      expect(key).toContain("hls");
      expect(key).toContain("master.m3u8");
    });
  });

  describe("hlsVariant", () => {
    it("should build HLS variant playlist key", () => {
      const key = storageKeys.hlsVariant(baseParts, "1080p");
      expect(key).toContain("hls");
      expect(key).toContain("1080p/playlist.m3u8");
    });
  });

  describe("hlsSegment", () => {
    it("should build HLS segment key", () => {
      const key = storageKeys.hlsSegment(baseParts, "1080p", 1);
      expect(key).toContain("hls");
      expect(key).toContain("1080p/segment_0001.ts");
    });

    it("should pad segment numbers", () => {
      const key = storageKeys.hlsSegment(baseParts, "720p", 42);
      expect(key).toContain("segment_0042.ts");
    });
  });
});

describe("buildStorageKey and parseStorageKey", () => {
  it("should build and parse key correctly", () => {
    const key = buildStorageKey({
      accountId: "acc_123",
      projectId: "prj_456",
      assetId: "asset_789",
      type: "original",
      filename: "video.mp4",
    });

    const parsed = parseStorageKey(key);

    expect(parsed).not.toBeNull();
    expect(parsed!.accountId).toBe("acc_123");
    expect(parsed!.projectId).toBe("prj_456");
    expect(parsed!.assetId).toBe("asset_789");
    expect(parsed!.type).toBe("original");
    expect(parsed!.filename).toBe("video.mp4");
  });
});
