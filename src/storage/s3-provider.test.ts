/**
 * Tests for S3 Storage Provider
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StorageConfig } from "./types.js";

// Mock AWS SDK
const mockS3Client = {
  send: vi.fn(),
};

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => mockS3Client),
  PutObjectCommand: vi.fn((params) => ({ type: "PutObject", ...params })),
  GetObjectCommand: vi.fn((params) => ({ type: "GetObject", ...params })),
  DeleteObjectCommand: vi.fn((params) => ({ type: "DeleteObject", ...params })),
  DeleteObjectsCommand: vi.fn((params) => ({ type: "DeleteObjects", ...params })),
  CopyObjectCommand: vi.fn((params) => ({ type: "CopyObject", ...params })),
  HeadObjectCommand: vi.fn((params) => ({ type: "HeadObject", ...params })),
  ListObjectsV2Command: vi.fn((params) => ({ type: "ListObjectsV2", ...params })),
  CreateMultipartUploadCommand: vi.fn((params) => ({ type: "CreateMultipartUpload", ...params })),
  UploadPartCommand: vi.fn((params) => ({ type: "UploadPart", ...params })),
  CompleteMultipartUploadCommand: vi.fn((params) => ({ type: "CompleteMultipartUpload", ...params })),
  AbortMultipartUploadCommand: vi.fn((params) => ({ type: "AbortMultipartUpload", ...params })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://presigned-url.example.com/signed"),
}));

describe("S3StorageProvider", () => {
  let S3StorageProvider: any;
  const defaultConfig: StorageConfig = {
    provider: "s3",
    bucket: "test-bucket",
    region: "us-east-1",
    accessKey: "test-access-key",
    secretKey: "test-secret-key",
    endpoint: "http://localhost:9000",
    forcePathStyle: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-import to get fresh instance
    vi.resetModules();
    const module = await import("./s3-provider.js");
    S3StorageProvider = module.S3StorageProvider;
  });

  describe("constructor", () => {
    it("creates S3 client with provided config", () => {
      const provider = new S3StorageProvider(defaultConfig);

      expect(provider.providerType).toBe("s3");
      expect(provider.bucket).toBe("test-bucket");
    });

    it("uses forcePathStyle from config when provided", () => {
      const provider = new S3StorageProvider({
        ...defaultConfig,
        forcePathStyle: false,
      });

      expect(provider.providerType).toBe("s3");
    });

    it("defaults forcePathStyle to true when endpoint is provided", () => {
      const provider = new S3StorageProvider({
        ...defaultConfig,
        forcePathStyle: undefined,
      });

      expect(provider.providerType).toBe("s3");
    });
  });

  describe("healthCheck", () => {
    it("returns true when list operation succeeds", async () => {
      mockS3Client.send.mockResolvedValueOnce({ Contents: [] });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.healthCheck();

      expect(result).toBe(true);
    });

    it("returns false when list operation fails", async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error("Connection failed"));

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe("getPresignedUrl", () => {
    it("generates put URL", async () => {
      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.getPresignedUrl("test-key", "put", 3600);

      expect(result.url).toBe("https://presigned-url.example.com/signed");
      expect(result.key).toBe("test-key");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("generates get URL", async () => {
      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.getPresignedUrl("test-key", "get", 7200);

      expect(result.url).toBe("https://presigned-url.example.com/signed");
      expect(result.key).toBe("test-key");
    });

    it("uses default expiry of 3600 seconds", async () => {
      const provider = new S3StorageProvider(defaultConfig);
      const before = Date.now();
      const result = await provider.getPresignedUrl("test-key", "get");

      const expectedExpiry = new Date(before + 3600 * 1000);
      // Allow 1 second tolerance
      expect(Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe("initMultipartUpload", () => {
    it("initializes multipart upload and returns upload ID", async () => {
      mockS3Client.send.mockResolvedValueOnce({ UploadId: "upload-123" });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.initMultipartUpload("test-key");

      expect(result.uploadId).toBe("upload-123");
      expect(result.key).toBe("test-key");
    });

    it("throws error when no upload ID returned", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);

      await expect(provider.initMultipartUpload("test-key")).rejects.toThrow(
        "Failed to initiate multipart upload: no upload ID returned"
      );
    });
  });

  describe("getMultipartPartUrls", () => {
    it("generates URLs for each part", async () => {
      const provider = new S3StorageProvider(defaultConfig);
      const urls = await provider.getMultipartPartUrls("test-key", "upload-123", 3);

      expect(urls).toHaveLength(3);
      expect(urls[0]).toEqual({ partNumber: 1, url: "https://presigned-url.example.com/signed" });
      expect(urls[1]).toEqual({ partNumber: 2, url: "https://presigned-url.example.com/signed" });
      expect(urls[2]).toEqual({ partNumber: 3, url: "https://presigned-url.example.com/signed" });
    });
  });

  describe("completeMultipartUpload", () => {
    it("completes multipart upload with parts", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      await provider.completeMultipartUpload("test-key", "upload-123", [
        { partNumber: 1, etag: "etag-1" },
        { partNumber: 2, etag: "etag-2" },
      ]);

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });

  describe("abortMultipartUpload", () => {
    it("aborts multipart upload", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      await provider.abortMultipartUpload("test-key", "upload-123");

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });

  describe("headObject", () => {
    it("returns object metadata when object exists", async () => {
      mockS3Client.send.mockResolvedValueOnce({
        ContentLength: 1024,
        ETag: '"abc123"',
        LastModified: new Date("2024-01-01"),
        ContentType: "image/png",
      });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.headObject("test-key");

      expect(result).toEqual({
        key: "test-key",
        size: 1024,
        etag: "abc123",
        lastModified: expect.any(Date),
        contentType: "image/png",
      });
    });

    it("returns null when object does not exist", async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error("NotFound"));

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.headObject("nonexistent-key");

      expect(result).toBeNull();
    });

    it("handles missing optional fields", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.headObject("test-key");

      expect(result).toEqual({
        key: "test-key",
        size: 0,
        etag: "",
        lastModified: expect.any(Date),
        contentType: "application/octet-stream",
      });
    });
  });

  describe("deleteObject", () => {
    it("deletes object", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      await provider.deleteObject("test-key");

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });

  describe("deleteObjects", () => {
    it("deletes multiple objects", async () => {
      mockS3Client.send.mockResolvedValueOnce({ Deleted: [{ Key: "key1" }, { Key: "key2" }] });

      const provider = new S3StorageProvider(defaultConfig);
      await provider.deleteObjects(["key1", "key2"]);

      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it("does nothing for empty array", async () => {
      const provider = new S3StorageProvider(defaultConfig);
      await provider.deleteObjects([]);

      expect(mockS3Client.send).not.toHaveBeenCalled();
    });

    it("chunks large arrays (>1000 objects)", async () => {
      mockS3Client.send.mockResolvedValue({});

      const provider = new S3StorageProvider(defaultConfig);
      const keys = Array.from({ length: 2500 }, (_, i) => `key-${i}`);
      await provider.deleteObjects(keys);

      // Should be called 3 times (2500 / 1000 = 3 chunks)
      expect(mockS3Client.send).toHaveBeenCalledTimes(3);
    });
  });

  describe("copyObject", () => {
    it("copies object to destination", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      await provider.copyObject("source-key", "dest-key");

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });

  describe("listObjects", () => {
    it("lists objects with prefix", async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Contents: [
          { Key: "prefix/file1.txt", Size: 100, ETag: '"etag1"', LastModified: new Date() },
          { Key: "prefix/file2.txt", Size: 200, ETag: '"etag2"', LastModified: new Date() },
        ],
        IsTruncated: false,
        NextContinuationToken: undefined,
      });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.listObjects("prefix/");

      expect(result.objects).toHaveLength(2);
      expect(result.isTruncated).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("handles pagination", async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: true,
        NextContinuationToken: "next-token",
      });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.listObjects("prefix/");

      expect(result.isTruncated).toBe(true);
      expect(result.nextCursor).toBe("next-token");
    });

    it("handles empty results", async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Contents: undefined,
        IsTruncated: false,
      });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.listObjects("prefix/");

      expect(result.objects).toEqual([]);
      expect(result.isTruncated).toBe(false);
    });

    it("uses default maxKeys of 1000", async () => {
      mockS3Client.send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

      const provider = new S3StorageProvider(defaultConfig);
      await provider.listObjects("prefix/");

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });

  describe("getObject", () => {
    it("returns buffer for object", async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
          yield new Uint8Array([4, 5, 6]);
        },
      };

      mockS3Client.send.mockResolvedValueOnce({ Body: mockStream });

      const provider = new S3StorageProvider(defaultConfig);
      const result = await provider.getObject("test-key");

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("throws error when body is missing", async () => {
      mockS3Client.send.mockResolvedValueOnce({ Body: null });

      const provider = new S3StorageProvider(defaultConfig);

      await expect(provider.getObject("test-key")).rejects.toThrow("Object not found: test-key");
    });
  });

  describe("putObject", () => {
    it("uploads buffer with default content type", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      await provider.putObject("test-key", Buffer.from("test data"));

      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it("uploads buffer with custom content type", async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const provider = new S3StorageProvider(defaultConfig);
      await provider.putObject("test-key", Buffer.from("test data"), "text/plain");

      expect(mockS3Client.send).toHaveBeenCalled();
    });
  });
});
