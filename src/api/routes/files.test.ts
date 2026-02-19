/**
 * Bush Platform - File Routes Tests
 *
 * Comprehensive unit tests for all file API endpoints.
 * Tests use a parent Hono app to properly simulate projectId param inheritance.
 */

// Mock ALL dependencies BEFORE any imports (vitest hoists vi.mock calls)
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../../db/schema.js", () => ({
  files: {
    id: "id",
    projectId: "projectId",
    folderId: "folderId",
    versionStackId: "versionStackId",
    name: "name",
    originalName: "originalName",
    mimeType: "mimeType",
    fileSizeBytes: "fileSizeBytes",
    checksum: "checksum",
    status: "status",
    customThumbnailKey: "customThumbnailKey",
    technicalMetadata: "technicalMetadata",
    deletedAt: "deletedAt",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  folders: {
    id: "id",
    projectId: "projectId",
    name: "name",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  accounts: {
    id: "id",
    storageUsedBytes: "storageUsedBytes",
    storageQuotaBytes: "storageQuotaBytes",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyProjectAccess: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("fil_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  lt: vi.fn((col: unknown, val: unknown) => ({ type: "lt", col, val })),
  isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: "inArray", col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values })),
}));

vi.mock("../../config/index.js", () => ({
  config: {
    UPLOAD_MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
    UPLOAD_MULTIPART_CHUNK_SIZE: 5 * 1024 * 1024, // 5MB
  },
}));

vi.mock("../../storage/index.js", () => ({
  storage: {
    getUploadUrl: vi.fn(),
    getDownloadUrl: vi.fn(),
    headObject: vi.fn(),
    putObject: vi.fn(),
    deleteObject: vi.fn(),
    copyObject: vi.fn(),
    initChunkedUpload: vi.fn(),
    getChunkUrls: vi.fn(),
    completeChunkedUpload: vi.fn(),
    abortChunkedUpload: vi.fn(),
  },
  storageKeys: {
    original: vi.fn().mockReturnValue("storage/original/key"),
    thumbnail: vi.fn().mockReturnValue("storage/thumbnail/key"),
    customThumbnail: vi.fn().mockReturnValue("storage/custom-thumbnail/key"),
  },
}));

vi.mock("../../media/index.js", () => ({
  enqueueProcessingJobs: vi.fn().mockResolvedValue(undefined),
  enqueueFrameCapture: vi.fn().mockResolvedValue("job_abc123"),
}));

// Import after mocks
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import filesApp from "./files.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";
import { storage, storageKeys } from "../../storage/index.js";
import { enqueueProcessingJobs, enqueueFrameCapture } from "../../media/index.js";

// ---------------------------------------------------------------------------
// Test app setup: mount filesApp under a parent with :projectId param
// ---------------------------------------------------------------------------
const testApp = new Hono();
testApp.route("/projects/:projectId/files", filesApp);

const req = (path: string, init?: RequestInit) => {
  // Handle root path with optional query string (e.g., "/" or "/?key=val")
  const suffix = path === "/" ? "" : path.startsWith("/?") ? path.slice(1) : path;
  return testApp.request(`/projects/prj_123/files${suffix}`, init);
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner" as const,
};

const mockFile = {
  id: "fil_001",
  projectId: "prj_123",
  folderId: null,
  versionStackId: null,
  name: "document.pdf",
  originalName: "document.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 1024,
  checksum: null,
  status: "ready",
  customThumbnailKey: null,
  technicalMetadata: null,
  deletedAt: null,
  expiresAt: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const mockImageFile = {
  ...mockFile,
  id: "fil_img",
  name: "photo.jpg",
  originalName: "photo.jpg",
  mimeType: "image/jpeg",
};

const mockVideoFile = {
  ...mockFile,
  id: "fil_vid",
  name: "video.mp4",
  originalName: "video.mp4",
  mimeType: "video/mp4",
  technicalMetadata: { duration: 120 },
};

const mockFolder = {
  id: "fld_001",
  projectId: "prj_123",
  name: "My Folder",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const mockAccount = {
  id: "acc_123",
  storageUsedBytes: 1024,
  storageQuotaBytes: 10 * 1024 * 1024 * 1024,
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------
function mockSelectSingle(row: Record<string, unknown> | null) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
  } as never);
}

function mockSelectList(rows: Record<string, unknown>[]) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never);
}

function mockTransaction() {
  vi.mocked(db.transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockAccount]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    return callback(tx);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("File Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish defaults after reset
    vi.mocked(requireAuth).mockReturnValue(mockSession);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("fil_test123");
    vi.mocked(verifyProjectAccess).mockResolvedValue({ project: { id: "prj_123" } } as never);

    // Default storage mocks
    vi.mocked(storage.getDownloadUrl).mockResolvedValue({
      url: "https://example.com/download",
      expiresAt: new Date("2024-12-31T00:00:00Z"),
    } as never);
    vi.mocked(storage.getUploadUrl).mockResolvedValue({
      url: "https://example.com/upload",
      expiresAt: new Date("2024-12-31T00:00:00Z"),
      key: "storage/upload/key",
    } as never);
    vi.mocked(storage.headObject).mockResolvedValue({ size: 1024 } as never);
    vi.mocked(storage.putObject).mockResolvedValue(undefined as never);
    vi.mocked(storage.deleteObject).mockResolvedValue(undefined as never);
    vi.mocked(storage.copyObject).mockResolvedValue(undefined as never);
    vi.mocked(storage.initChunkedUpload).mockResolvedValue({
      uploadId: "upload_abc",
      key: "storage/multipart/key",
    } as never);
    vi.mocked(storage.getChunkUrls).mockResolvedValue([
      { partNumber: 1, url: "https://example.com/part/1" },
      { partNumber: 2, url: "https://example.com/part/2" },
    ] as never);
    vi.mocked(storage.completeChunkedUpload).mockResolvedValue(undefined as never);
    vi.mocked(storage.abortChunkedUpload).mockResolvedValue(undefined as never);
    vi.mocked(storageKeys.original).mockReturnValue("storage/original/key");
    vi.mocked(storageKeys.thumbnail).mockReturnValue("storage/thumbnail/key");
    vi.mocked(storageKeys.customThumbnail).mockReturnValue("storage/custom-thumbnail/key");
    vi.mocked(enqueueProcessingJobs).mockResolvedValue(undefined);
    vi.mocked(enqueueFrameCapture).mockResolvedValue("job_abc123" as never);
  });

  // =========================================================================
  // GET / - List files
  // =========================================================================
  describe("GET / - list files", () => {
    it("returns 200 with JSON:API collection on success", async () => {
      mockSelectList([mockFile]);

      const res = await req("/");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].id).toBe("fil_001");
      expect(body.data[0].type).toBe("file");
    });

    it("returns empty data array when no files exist", async () => {
      mockSelectList([]);

      const res = await req("/");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(0);
      expect(body.meta.total_count).toBe(0);
    });

    it("returns pagination meta with total_count, page_size, has_more", async () => {
      mockSelectList([mockFile]);

      const res = await req("/");
      const body = await res.json();

      expect(body.meta).toBeDefined();
      expect(body.meta.total_count).toBe(1);
      expect(body.meta.page_size).toBe(50);
      expect(body.meta.has_more).toBe(false);
    });

    it("includes links.self in response", async () => {
      mockSelectList([mockFile]);

      const res = await req("/");
      const body = await res.json();

      expect(body.links).toBeDefined();
      expect(body.links.self).toContain("files");
    });

    it("calls verifyProjectAccess with projectId and accountId", async () => {
      mockSelectList([]);

      await req("/");

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/");

      expect(res.status).toBe(500);
    });

    it("filters by folder_id when provided", async () => {
      mockSelectList([{ ...mockFile, folderId: "fld_001" }]);

      const res = await req("/?folder_id=fld_001");

      expect(res.status).toBe(200);
    });

    it("filters by status when provided", async () => {
      mockSelectList([mockFile]);

      const res = await req("/?status=ready");

      expect(res.status).toBe(200);
    });

    it("applies cursor pagination when cursor query param is provided", async () => {
      mockSelectList([mockFile]);

      const cursor = Buffer.from(
        JSON.stringify({ createdAt: "2024-01-10T00:00:00.000Z" })
      ).toString("base64url");

      const res = await req(`/?cursor=${cursor}`);

      expect(res.status).toBe(200);
    });

    it("handles cursor with invalid format gracefully", async () => {
      mockSelectList([mockFile]);

      const res = await req("/?cursor=not-valid-base64-cursor");

      expect(res.status).toBe(200);
    });

    it("returns thumbnailUrl=null for non-image/video files in list", async () => {
      // PDF file - no thumbnail expected
      mockSelectList([mockFile]);

      const res = await req("/");
      const body = await res.json();

      expect(body.data[0].attributes.thumbnailUrl).toBeNull();
    });

    it("generates thumbnailUrl for ready image files", async () => {
      mockSelectList([mockImageFile]);

      const res = await req("/");
      const body = await res.json();

      expect(body.data[0].attributes.thumbnailUrl).toBe("https://example.com/download");
    });

    it("returns thumbnailUrl=null when file is not in ready status", async () => {
      mockSelectList([{ ...mockImageFile, status: "uploading" }]);

      const res = await req("/");
      const body = await res.json();

      expect(body.data[0].attributes.thumbnailUrl).toBeNull();
    });

    it("uses custom thumbnail key when file has customThumbnailKey", async () => {
      const fileWithCustomThumb = {
        ...mockImageFile,
        customThumbnailKey: "custom/thumb/key",
      };
      mockSelectList([fileWithCustomThumb]);

      const res = await req("/");
      const body = await res.json();

      expect(storage.getDownloadUrl).toHaveBeenCalledWith("custom/thumb/key", 3600);
      expect(body.data[0].attributes.thumbnailUrl).toBe("https://example.com/download");
    });

    it("returns thumbnailUrl=null when storage.getDownloadUrl throws", async () => {
      mockSelectList([mockImageFile]);
      vi.mocked(storage.getDownloadUrl).mockRejectedValue(new Error("Not found"));

      const res = await req("/");
      const body = await res.json();

      expect(body.data[0].attributes.thumbnailUrl).toBeNull();
    });
  });

  // =========================================================================
  // GET /:id - Get single file
  // =========================================================================
  describe("GET /:id - get file by ID", () => {
    it("returns 200 with single file on success", async () => {
      mockSelectSingle(mockFile);

      const res = await req("/fil_001");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe("fil_001");
      expect(body.data.type).toBe("file");
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing");

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001");

      expect(res.status).toBe(500);
    });

    it("calls verifyProjectAccess with correct projectId and accountId", async () => {
      mockSelectSingle(mockFile);

      await req("/fil_001");

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("includes thumbnailUrl in response attributes", async () => {
      mockSelectSingle(mockImageFile);

      const res = await req("/fil_img");
      const body = await res.json();

      expect(body.data.attributes).toHaveProperty("thumbnailUrl");
    });

    it("returns thumbnailUrl as null for non-media files", async () => {
      mockSelectSingle(mockFile); // PDF

      const res = await req("/fil_001");
      const body = await res.json();

      expect(body.data.attributes.thumbnailUrl).toBeNull();
    });

    it("formats date fields as ISO strings", async () => {
      mockSelectSingle(mockFile);

      const res = await req("/fil_001");
      const body = await res.json();

      expect(typeof body.data.attributes.createdAt).toBe("string");
      expect(typeof body.data.attributes.updatedAt).toBe("string");
    });
  });

  // =========================================================================
  // POST / - Create file (initiate upload)
  // =========================================================================
  describe("POST / - create file (initiate upload)", () => {
    beforeEach(() => {
      mockTransaction();
      // After transaction, fetch the created file
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockFile]),
          }),
        }),
      } as never);
    });

    it("returns 200 with file data and upload URL on success", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "document.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.type).toBe("file");
      expect(body.meta).toBeDefined();
      expect(body.meta.upload_url).toBe("https://example.com/upload");
      expect(body.meta.upload_method).toBe("presigned_url");
    });

    it("includes storage_key and chunk_size in meta", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "document.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      const body = await res.json();
      expect(body.meta.storage_key).toBeDefined();
      expect(body.meta.chunk_size).toBeDefined();
    });

    it("returns 500 when name is missing", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when name is not a string", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: 42,
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when mime_type is missing", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_size_bytes is missing", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file_size_bytes is not a number", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: "large",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file size exceeds maximum", async () => {
      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 100 * 1024 * 1024 * 1024, // 100GB - exceeds 10GB limit
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(res.status).toBe(500);
    });

    it("verifies folder exists when folder_id is provided", async () => {
      // First db.select call is for folder verification; then post-transaction file fetch
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, folderId: "fld_001" }]),
            }),
          }),
        } as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
          folder_id: "fld_001",
        }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when folder_id references a non-existent folder", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
          folder_id: "fld_nonexistent",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when storage quota is exceeded", async () => {
      vi.mocked(db.transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{
                  ...mockAccount,
                  storageUsedBytes: 9 * 1024 * 1024 * 1024,
                  storageQuotaBytes: 10 * 1024 * 1024 * 1024,
                }]),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        };
        return callback(tx);
      });

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 2 * 1024 * 1024 * 1024, // 2GB - exceeds remaining quota
        }),
      });

      expect(res.status).toBe(500);
    });

    it("calls generateId with 'file' prefix", async () => {
      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(generateId).toHaveBeenCalledWith("file");
    });

    it("calls storage.getUploadUrl after successful DB insert", async () => {
      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "file.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      });

      expect(storage.getUploadUrl).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // PATCH /:id - Update file metadata
  // =========================================================================
  describe("PATCH /:id - update file metadata", () => {
    // Helper: set up the standard two-select chain for PATCH (get file + refetch)
    function setupPatchSelects(fileRow = mockFile, updatedRow = { ...mockFile, name: "updated.pdf" }) {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([fileRow]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([updatedRow]),
            }),
          }),
        } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    }

    it("returns 200 with updated file on success", async () => {
      setupPatchSelects();

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "updated.pdf" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("file");
    });

    it("updates file name when provided", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "newname.pdf" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ name: "newname.pdf" })
      );
    });

    it("includes updatedAt in the update payload", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "updated.pdf" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: expect.any(Date) })
      );
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "updated.pdf" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "updated.pdf" }),
      });

      expect(res.status).toBe(500);
    });

    it("allows valid status transition from uploading to ready", async () => {
      setupPatchSelects(
        { ...mockFile, status: "uploading" },
        { ...mockFile, status: "ready" }
      );

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });

      expect(res.status).toBe(200);
    });

    it("allows valid status transition from uploading to processing", async () => {
      setupPatchSelects(
        { ...mockFile, status: "uploading" },
        { ...mockFile, status: "processing" }
      );

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 for invalid status value", async () => {
      setupPatchSelects();

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid_status" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 for disallowed status transition (deleted to ready)", async () => {
      setupPatchSelects({ ...mockFile, status: "deleted" }, mockFile);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 for disallowed status transition (ready to uploading)", async () => {
      setupPatchSelects(mockFile, mockFile); // mockFile.status = "ready"

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "uploading" }),
      });

      expect(res.status).toBe(500);
    });

    it("moves file to folder when folder_id is provided", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFolder]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...mockFile, folderId: "fld_001" }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: "fld_001" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when moving to non-existent folder", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) } as never);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: "fld_nonexistent" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when moving to folder from different project", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...mockFolder, projectId: "prj_other" }]) }) }) } as never);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: "fld_001" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // DELETE /:id - Soft delete file
  // =========================================================================
  describe("DELETE /:id - soft delete file", () => {
    beforeEach(() => {
      mockSelectSingle(mockFile);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 204 No Content on successful soft delete", async () => {
      const res = await req("/fil_001", { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("calls db.update to set deletedAt", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await req("/fil_001", { method: "DELETE" });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("calls verifyProjectAccess before checking file existence", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      await req("/fil_001", { method: "DELETE" });

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });
  });

  // =========================================================================
  // POST /:id/confirm - Confirm upload completion
  // =========================================================================
  describe("POST /:id/confirm - confirm upload", () => {
    const uploadingFile = { ...mockFile, status: "uploading" };

    function setupConfirmSelects(fileRow = uploadingFile) {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([fileRow]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...fileRow, status: "processing" }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);
    }

    it("returns 200 with processing status after successful confirm", async () => {
      setupConfirmSelects();

      const res = await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.meta.message).toBe("Upload confirmed, processing started");
    });

    it("calls storage.headObject to verify file exists in storage", async () => {
      setupConfirmSelects();

      await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(storage.headObject).toHaveBeenCalledTimes(1);
    });

    it("calls enqueueProcessingJobs after confirming upload", async () => {
      setupConfirmSelects();

      await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(enqueueProcessingJobs).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when file is not in uploading status", async () => {
      mockSelectSingle({ ...mockFile, status: "ready" });

      const res = await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file has not been uploaded to storage yet", async () => {
      setupConfirmSelects();
      vi.mocked(storage.headObject).mockResolvedValue(null as never);

      const res = await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("succeeds even when enqueueProcessingJobs throws", async () => {
      setupConfirmSelects();
      vi.mocked(enqueueProcessingJobs).mockRejectedValue(new Error("Queue error"));

      const res = await req("/fil_001/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // The route catches errors from enqueueProcessingJobs and continues
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // GET /:id/download - Get download URL
  // =========================================================================
  describe("GET /:id/download - generate download URL", () => {
    it("returns 200 with download URL for ready file", async () => {
      mockSelectSingle(mockFile);

      const res = await req("/fil_001/download");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.meta.download_url).toBe("https://example.com/download");
      expect(body.meta.download_expires_at).toBeDefined();
    });

    it("returns 500 when file is not in ready status", async () => {
      mockSelectSingle({ ...mockFile, status: "uploading" });

      const res = await req("/fil_001/download");

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/download");

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/download");

      expect(res.status).toBe(500);
    });

    it("calls storageKeys.original with correct params", async () => {
      mockSelectSingle(mockFile);

      await req("/fil_001/download");

      expect(storageKeys.original).toHaveBeenCalledWith(
        { accountId: mockSession.currentAccountId, projectId: "prj_123", assetId: "fil_001" },
        mockFile.name
      );
    });

    it("calls storage.getDownloadUrl with 1-hour expiry", async () => {
      mockSelectSingle(mockFile);

      await req("/fil_001/download");

      expect(storage.getDownloadUrl).toHaveBeenCalledWith(
        "storage/original/key",
        3600
      );
    });

    it("returns 500 for file in processing status", async () => {
      mockSelectSingle({ ...mockFile, status: "processing" });

      const res = await req("/fil_001/download");

      expect(res.status).toBe(500);
    });

    it("returns 500 for file in processing_failed status", async () => {
      mockSelectSingle({ ...mockFile, status: "processing_failed" });

      const res = await req("/fil_001/download");

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/thumbnail - Upload custom thumbnail
  // =========================================================================
  describe("POST /:id/thumbnail - upload custom thumbnail", () => {
    const validBase64Jpeg = `data:image/jpeg;base64,${Buffer.from("fake-jpeg-data").toString("base64")}`;

    function setupThumbnailSelects() {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...mockFile, customThumbnailKey: "storage/custom-thumbnail/key" }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);
    }

    it("returns 200 with updated file after base64 upload", async () => {
      setupThumbnailSelects();

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          image_data: validBase64Jpeg,
        }),
      });

      expect(res.status).toBe(200);
    });

    it("stores the image in storage via putObject", async () => {
      setupThumbnailSelects();

      await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          image_data: validBase64Jpeg,
        }),
      });

      expect(storage.putObject).toHaveBeenCalledTimes(1);
    });

    it("updates customThumbnailKey in database", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...mockFile, customThumbnailKey: "key" }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          image_data: validBase64Jpeg,
        }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ customThumbnailKey: expect.any(String) })
      );
    });

    it("returns pre-signed URL when mode is 'url'", async () => {
      mockSelectSingle(mockFile);

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.upload_url).toBeDefined();
      expect(body.meta.upload_expires_at).toBeDefined();
    });

    it("calls storage.getUploadUrl when mode is 'url'", async () => {
      mockSelectSingle(mockFile);

      await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url" }),
      });

      expect(storage.getUploadUrl).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when image_data is missing in upload mode", async () => {
      mockSelectSingle(mockFile);

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upload" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when image_data has invalid data URL format", async () => {
      mockSelectSingle(mockFile);

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          image_data: "not-a-valid-data-url",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url" }),
      });

      expect(res.status).toBe(500);
    });

    it("handles PNG image format correctly", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, customThumbnailKey: "key" }]),
            }),
          }),
        } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);

      const validBase64Png = `data:image/png;base64,${Buffer.from("fake-png-data").toString("base64")}`;

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          image_data: validBase64Png,
        }),
      });

      expect(res.status).toBe(200);
      expect(storage.putObject).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Buffer),
        "image/png"
      );
    });

    it("handles WebP image format correctly", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, customThumbnailKey: "key" }]),
            }),
          }),
        } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);

      const validBase64Webp = `data:image/webp;base64,${Buffer.from("fake-webp-data").toString("base64")}`;

      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upload",
          image_data: validBase64Webp,
        }),
      });

      expect(res.status).toBe(200);
      expect(storage.putObject).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Buffer),
        "image/webp"
      );
    });

    it("defaults to upload mode when mode is not specified", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockFile]),
          }),
        }),
      } as never);

      // Without mode - defaults to "upload" - should require image_data
      const res = await req("/fil_001/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // No image_data = ValidationError
      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/copy - Copy file
  // =========================================================================
  describe("POST /:id/copy - copy file", () => {
    function setupCopySelects() {
      mockTransaction();
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...mockFile, id: "fil_test123", name: "Copy of document.pdf" }]) }) }) } as never);
    }

    it("returns 200 with copied file on success", async () => {
      setupCopySelects();

      const res = await req("/fil_001/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("file");
    });

    it("returns 500 when source file is not found", async () => {
      mockTransaction();
      mockSelectSingle(null);

      const res = await req("/fil_missing/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("copies to different project when project_id is provided", async () => {
      setupCopySelects();
      vi.mocked(verifyProjectAccess)
        .mockResolvedValueOnce({ project: { id: "prj_123" } } as never)
        .mockResolvedValueOnce({ project: { id: "prj_456" } } as never);

      const res = await req("/fil_001/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "prj_456" }),
      });

      expect(res.status).toBe(200);
      expect(verifyProjectAccess).toHaveBeenCalledTimes(2);
    });

    it("returns 500 when storage quota is exceeded during copy", async () => {
      vi.mocked(db.transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: () => ({
              where: () => ({
                limit: vi.fn().mockResolvedValue([{
                  ...mockAccount,
                  storageUsedBytes: 10 * 1024 * 1024 * 1024 - 100,
                  storageQuotaBytes: 10 * 1024 * 1024 * 1024,
                }]),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        };
        return callback(tx);
      });

      // source file has large size
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockFile, fileSizeBytes: 1024 * 1024 * 1024 }]),
          }),
        }),
      } as never);

      const res = await req("/fil_001/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/restore - Restore soft-deleted file
  // =========================================================================
  describe("POST /:id/restore - restore deleted file", () => {
    const deletedFile = {
      ...mockFile,
      deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // deleted 5 days ago
    };

    function setupRestoreSelects(fileRow = deletedFile) {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([fileRow]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...fileRow, deletedAt: null }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);
    }

    it("returns 200 with restored file on success", async () => {
      setupRestoreSelects();

      const res = await req("/fil_001/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.type).toBe("file");
    });

    it("clears deletedAt when restoring", async () => {
      const setCalled = vi.fn();
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([deletedFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...deletedFile, deletedAt: null }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await req("/fil_001/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null })
      );
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not deleted (no deletedAt)", async () => {
      mockSelectSingle(mockFile); // not deleted

      const res = await req("/fil_001/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when 30-day recovery period has expired", async () => {
      const expiredDeletedFile = {
        ...mockFile,
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
      };

      mockSelectSingle(expiredDeletedFile);

      const res = await req("/fil_001/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/move - Move file to folder
  // =========================================================================
  describe("POST /:id/move - move file to folder", () => {
    it("moves file to root when folder_id is omitted", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, folderId: null }]),
            }),
          }),
        } as never);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      const res = await req("/fil_001/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: null })
      );
    });

    it("returns 200 on successful move with folder_id", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, folderId: "fld_001" }]),
            }),
          }),
        } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await req("/fil_001/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: "fld_001" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when file is not found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await req("/fil_missing/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when target folder is not found", async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]), // folder not found
            }),
          }),
        } as never);

      const res = await req("/fil_001/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: "fld_nonexistent" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/multipart - Initialize multipart upload
  // =========================================================================
  describe("POST /:id/multipart - initialize multipart upload", () => {
    beforeEach(() => {
      mockSelectSingle(mockFile);
    });

    it("returns 200 with upload_id on success", async () => {
      const res = await req("/fil_001/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: 3 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.upload_id).toBe("upload_abc");
    });

    it("calls storage.initChunkedUpload", async () => {
      await req("/fil_001/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: 3 }),
      });

      expect(storage.initChunkedUpload).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when chunk_count is missing", async () => {
      const res = await req("/fil_001/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when chunk_count is less than 1", async () => {
      const res = await req("/fil_001/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: 0 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when chunk_count exceeds 10000", async () => {
      const res = await req("/fil_001/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: 10001 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: 3 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunk_count: 3 }),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // GET /:id/multipart/parts - Get upload part URLs
  // =========================================================================
  describe("GET /:id/multipart/parts - get upload part URLs", () => {
    beforeEach(() => {
      mockSelectSingle(mockFile);
    });

    it("returns 200 with part URLs on success", async () => {
      const res = await req("/fil_001/multipart/parts?upload_id=upload_abc&chunk_count=2");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.parts).toHaveLength(2);
      expect(body.meta.parts[0].part_number).toBe(1);
      expect(body.meta.parts[0].upload_url).toBe("https://example.com/part/1");
    });

    it("returns 500 when upload_id is missing", async () => {
      const res = await req("/fil_001/multipart/parts?chunk_count=2");

      expect(res.status).toBe(500);
    });

    it("returns 500 when chunk_count is missing", async () => {
      const res = await req("/fil_001/multipart/parts?upload_id=upload_abc");

      expect(res.status).toBe(500);
    });

    it("returns 500 when chunk_count is 0", async () => {
      const res = await req("/fil_001/multipart/parts?upload_id=upload_abc&chunk_count=0");

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/multipart/parts?upload_id=upload_abc&chunk_count=2");

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/multipart/parts?upload_id=upload_abc&chunk_count=2");

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/multipart/complete - Complete multipart upload
  // =========================================================================
  describe("POST /:id/multipart/complete - complete multipart upload", () => {
    const validParts = [
      { part_number: 1, etag: "etag1" },
      { part_number: 2, etag: "etag2" },
    ];

    function setupCompleteSelects() {
      vi.mocked(db.select)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([mockFile]) }) }) } as never)
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ ...mockFile, status: "processing" }]) }) }) } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);
    }

    it("returns 200 with success message on completion", async () => {
      setupCompleteSelects();

      const res = await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc", parts: validParts }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.message).toBe("Upload completed successfully");
    });

    it("calls storage.completeChunkedUpload with correct params", async () => {
      setupCompleteSelects();

      await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc", parts: validParts }),
      });

      expect(storage.completeChunkedUpload).toHaveBeenCalledTimes(1);
    });

    it("calls enqueueProcessingJobs after completing upload", async () => {
      setupCompleteSelects();

      await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc", parts: validParts }),
      });

      expect(enqueueProcessingJobs).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when upload_id is missing", async () => {
      setupCompleteSelects();

      const res = await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts: validParts }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when parts is missing", async () => {
      setupCompleteSelects();

      const res = await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when parts is empty array", async () => {
      setupCompleteSelects();

      const res = await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc", parts: [] }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when a part is missing etag", async () => {
      setupCompleteSelects();

      const res = await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: "upload_abc",
          parts: [{ part_number: 1 }], // missing etag
        }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc", parts: validParts }),
      });

      expect(res.status).toBe(500);
    });

    it("succeeds even when enqueueProcessingJobs throws", async () => {
      setupCompleteSelects();
      vi.mocked(enqueueProcessingJobs).mockRejectedValue(new Error("Queue error"));

      const res = await req("/fil_001/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: "upload_abc", parts: validParts }),
      });

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // DELETE /:id/multipart - Abort multipart upload
  // =========================================================================
  describe("DELETE /:id/multipart - abort multipart upload", () => {
    beforeEach(() => {
      mockSelectSingle(mockFile);
    });

    it("returns 204 No Content on successful abort", async () => {
      const res = await req("/fil_001/multipart?upload_id=upload_abc", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("calls storage.abortChunkedUpload with upload ID", async () => {
      await req("/fil_001/multipart?upload_id=upload_abc", {
        method: "DELETE",
      });

      expect(storage.abortChunkedUpload).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when upload_id is missing", async () => {
      const res = await req("/fil_001/multipart", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/multipart?upload_id=upload_abc", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/multipart?upload_id=upload_abc", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // DELETE /:id/thumbnail - Remove custom thumbnail
  // =========================================================================
  describe("DELETE /:id/thumbnail - remove custom thumbnail", () => {
    it("returns 204 No Content when file has no custom thumbnail", async () => {
      mockSelectSingle(mockFile); // no customThumbnailKey

      const res = await req("/fil_001/thumbnail", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("deletes custom thumbnail from storage and clears DB key", async () => {
      const fileWithThumb = { ...mockFile, customThumbnailKey: "custom/thumb/key" };
      mockSelectSingle(fileWithThumb);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await req("/fil_001/thumbnail", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(storage.deleteObject).toHaveBeenCalledWith("custom/thumb/key");
    });

    it("clears customThumbnailKey in database", async () => {
      const fileWithThumb = { ...mockFile, customThumbnailKey: "custom/thumb/key" };
      mockSelectSingle(fileWithThumb);

      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);

      await req("/fil_001/thumbnail", { method: "DELETE" });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ customThumbnailKey: null })
      );
    });

    it("still clears DB key even if storage.deleteObject throws", async () => {
      const fileWithThumb = { ...mockFile, customThumbnailKey: "custom/thumb/key" };
      mockSelectSingle(fileWithThumb);

      vi.mocked(storage.deleteObject).mockRejectedValue(new Error("Storage error"));
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await req("/fil_001/thumbnail", { method: "DELETE" });

      expect(res.status).toBe(204);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/thumbnail", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_001/thumbnail", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST /:id/thumbnail/frame - Capture video frame as thumbnail
  // =========================================================================
  describe("POST /:id/thumbnail/frame - capture video frame", () => {
    const readyVideoFile = { ...mockVideoFile, status: "ready" };

    beforeEach(() => {
      mockSelectSingle(readyVideoFile);
    });

    it("returns 200 with job_id on success", async () => {
      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 30 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.job_id).toBe("job_abc123");
      expect(body.meta.timestamp).toBe(30);
      expect(body.meta.message).toBe("Frame capture job enqueued");
    });

    it("calls enqueueFrameCapture with correct params", async () => {
      await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 30 }),
      });

      expect(enqueueFrameCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: "fil_vid",
          accountId: mockSession.currentAccountId,
          projectId: "prj_123",
          timestamp: 30,
          mimeType: "video/mp4",
        })
      );
    });

    it("returns 500 when file is not a video", async () => {
      mockSelectSingle(mockImageFile); // image, not video

      const res = await req("/fil_img/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 30 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file status is not ready", async () => {
      mockSelectSingle({ ...mockVideoFile, status: "uploading" });

      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 30 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when timestamp is not provided", async () => {
      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when timestamp is negative", async () => {
      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: -5 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when timestamp exceeds video duration", async () => {
      // mockVideoFile has duration 120 seconds
      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 200 }),
      });

      expect(res.status).toBe(500);
    });

    it("allows timestamp of 0 (start of video)", async () => {
      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 0 }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSingle(null);

      const res = await req("/fil_missing/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 30 }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/fil_vid/thumbnail/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: 30 }),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // getThumbnailUrl helper (tested indirectly via GET /:id)
  // =========================================================================
  describe("getThumbnailUrl helper (tested indirectly)", () => {
    it("returns null for files with status other than ready", async () => {
      mockSelectSingle({ ...mockImageFile, status: "processing" });

      const res = await req("/fil_img");
      const body = await res.json();

      expect(body.data.attributes.thumbnailUrl).toBeNull();
    });

    it("returns null for non-image, non-video MIME types", async () => {
      mockSelectSingle({ ...mockFile, mimeType: "application/pdf", status: "ready" });

      const res = await req("/fil_001");
      const body = await res.json();

      expect(body.data.attributes.thumbnailUrl).toBeNull();
    });

    it("returns thumbnailUrl for ready video files", async () => {
      mockSelectSingle({ ...mockVideoFile, status: "ready" });

      const res = await req("/fil_vid");
      const body = await res.json();

      expect(body.data.attributes.thumbnailUrl).toBe("https://example.com/download");
    });

    it("returns thumbnailUrl for ready image files", async () => {
      mockSelectSingle({ ...mockImageFile, status: "ready" });

      const res = await req("/fil_img");
      const body = await res.json();

      expect(body.data.attributes.thumbnailUrl).toBe("https://example.com/download");
    });

    it("uses custom thumbnail key when set on file", async () => {
      const fileWithCustomThumb = {
        ...mockImageFile,
        status: "ready",
        customThumbnailKey: "custom/path/thumb.jpg",
      };
      mockSelectSingle(fileWithCustomThumb);

      await req("/fil_img");

      expect(storage.getDownloadUrl).toHaveBeenCalledWith("custom/path/thumb.jpg", 3600);
    });

    it("falls back to generated thumbnail key when no custom thumbnail", async () => {
      mockSelectSingle({ ...mockImageFile, status: "ready", customThumbnailKey: null });

      await req("/fil_img");

      expect(storageKeys.thumbnail).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: mockSession.currentAccountId }),
        "640"
      );
      expect(storage.getDownloadUrl).toHaveBeenCalledWith("storage/thumbnail/key", 3600);
    });

    it("returns null when storage.getDownloadUrl throws (thumbnail not yet generated)", async () => {
      mockSelectSingle({ ...mockImageFile, status: "ready" });
      vi.mocked(storage.getDownloadUrl).mockRejectedValue(new Error("NoSuchKey"));

      const res = await req("/fil_img");
      const body = await res.json();

      expect(body.data.attributes.thumbnailUrl).toBeNull();
    });
  });

  // =========================================================================
  // Status transition matrix tests
  // =========================================================================
  describe("PATCH /:id status transition matrix", () => {
    const testTransition = async (fromStatus: string, toStatus: string) => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, status: fromStatus }]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFile, status: toStatus }]),
            }),
          }),
        } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      return req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
    };

    it("uploading to processing: allowed", async () => {
      const res = await testTransition("uploading", "processing");
      expect(res.status).toBe(200);
    });

    it("uploading to ready: allowed", async () => {
      const res = await testTransition("uploading", "ready");
      expect(res.status).toBe(200);
    });

    it("uploading to deleted: allowed", async () => {
      const res = await testTransition("uploading", "deleted");
      expect(res.status).toBe(200);
    });

    it("processing to ready: allowed", async () => {
      const res = await testTransition("processing", "ready");
      expect(res.status).toBe(200);
    });

    it("processing to processing_failed: allowed", async () => {
      const res = await testTransition("processing", "processing_failed");
      expect(res.status).toBe(200);
    });

    it("processing to deleted: allowed", async () => {
      const res = await testTransition("processing", "deleted");
      expect(res.status).toBe(200);
    });

    it("ready to processing: allowed", async () => {
      const res = await testTransition("ready", "processing");
      expect(res.status).toBe(200);
    });

    it("ready to deleted: allowed", async () => {
      const res = await testTransition("ready", "deleted");
      expect(res.status).toBe(200);
    });

    it("processing_failed to processing: allowed", async () => {
      const res = await testTransition("processing_failed", "processing");
      expect(res.status).toBe(200);
    });

    it("processing_failed to deleted: allowed", async () => {
      const res = await testTransition("processing_failed", "deleted");
      expect(res.status).toBe(200);
    });

    it("ready to uploading: NOT allowed", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockFile, status: "ready" }]),
          }),
        }),
      } as never);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "uploading" }),
      });

      expect(res.status).toBe(500);
    });

    it("deleted to ready: NOT allowed", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockFile, status: "deleted" }]),
          }),
        }),
      } as never);

      const res = await req("/fil_001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // requireAuth integration
  // =========================================================================
  describe("requireAuth integration", () => {
    it("calls requireAuth on GET /", async () => {
      mockSelectList([]);

      await req("/");

      expect(requireAuth).toHaveBeenCalledTimes(1);
    });

    it("calls requireAuth on GET /:id", async () => {
      mockSelectSingle(mockFile);

      await req("/fil_001");

      expect(requireAuth).toHaveBeenCalledTimes(1);
    });

    it("calls requireAuth on DELETE /:id", async () => {
      mockSelectSingle(mockFile);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
      } as never);

      await req("/fil_001", { method: "DELETE" });

      expect(requireAuth).toHaveBeenCalledTimes(1);
    });
  });
});
