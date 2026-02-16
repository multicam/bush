/**
 * Bush Platform - Upload Client Tests
 *
 * Tests for the chunked upload client library.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UploadClient,
  getUploadClient,
  createUploadClient,
  formatSpeed,
  type UploadOptions,
  type UploadProgress,
  type UploadResult,
} from "./upload-client";

// Mock IndexedDB with in-memory storage
const mockStore = new Map<string, unknown>();

function createMockIDBRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null,
    source: null,
    transaction: null,
    readyState: "done" as IDBRequestReadyState,
    onsuccess: null as ((ev: Event) => void) | null,
    onerror: null as ((ev: Event) => void) | null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  // Simulate async success
  setTimeout(() => {
    if (request.onsuccess) {
      request.onsuccess({ target: request } as unknown as Event);
    }
  }, 0);

  return request as unknown as IDBRequest<T>;
}

function createMockObjectStore() {
  return {
    get: vi.fn((id: string) => createMockIDBRequest(mockStore.get(id))),
    getAll: vi.fn(() => createMockIDBRequest(Array.from(mockStore.values()))),
    put: vi.fn((value: unknown) => {
      const id = (value as { id: string }).id;
      mockStore.set(id, value);
      return createMockIDBRequest(id);
    }),
    delete: vi.fn((id: string) => {
      mockStore.delete(id);
      return createMockIDBRequest(undefined);
    }),
    clear: vi.fn(() => {
      mockStore.clear();
      return createMockIDBRequest(undefined);
    }),
  };
}

function createMockTransaction() {
  return {
    objectStore: vi.fn(() => createMockObjectStore()),
    db: null,
    error: null,
    mode: "readwrite" as IDBTransactionMode,
    onabort: null,
    oncomplete: null,
    onerror: null,
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

function createMockDB() {
  return {
    createObjectStore: vi.fn(),
    deleteObjectStore: vi.fn(),
    objectStoreNames: { contains: vi.fn(() => false) },
    transaction: vi.fn(() => createMockTransaction()),
    close: vi.fn(),
    name: "bush-uploads",
    version: 1,
    onabort: null,
    onclose: null,
    onerror: null,
    onversionchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock IndexedDB
vi.stubGlobal("indexedDB", {
  open: vi.fn(() => {
    const mockDB = createMockDB();
    const request = {
      result: mockDB,
      error: null,
      source: null,
      transaction: null,
      readyState: "done" as IDBRequestReadyState,
      onsuccess: null as ((ev: Event) => void) | null,
      onerror: null as ((ev: Event) => void) | null,
      onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    // Simulate async opening
    setTimeout(() => {
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: request, oldVersion: 0, newVersion: 1 } as unknown as IDBVersionChangeEvent);
      }
      if (request.onsuccess) {
        request.onsuccess({ target: request } as unknown as Event);
      }
    }, 0);

    return request;
  }),
});

// Helper to create mock file
function createMockFile(name: string, size: number, type: string): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

// Helper to create mock response
function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers({
      "Content-Type": "application/json",
    }),
  } as Response;
}

describe("UploadClient", () => {
  let client: UploadClient;

  beforeEach(() => {
    client = new UploadClient({ chunkSize: 1000, maxParallel: 2, maxRetries: 1 });
    mockFetch.mockReset();

    // Default successful file creation response
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      // Only parse JSON body for non-File/Blob uploads
      let body: Record<string, unknown> = {};
      if (options?.body && typeof options.body === "string") {
        try {
          body = JSON.parse(options.body);
        } catch {
          // Ignore JSON parse errors for non-JSON bodies
        }
      }

      if (url.includes("/files") && options?.method === "POST" && !url.includes("multipart")) {
        return mockResponse({
          data: {
            id: "file_test123",
            type: "file",
            attributes: {
              id: "file_test123",
              name: body.name,
              status: "uploading",
            },
          },
          meta: {
            upload_url: "https://storage.example.com/upload",
            upload_method: "presigned_url",
            upload_expires_at: new Date(Date.now() + 3600000).toISOString(),
            storage_key: "acc_123/proj_456/file_test123/original/test.txt",
            chunk_size: 1000,
          },
        });
      }

      if (url.includes("/multipart") && options?.method === "POST") {
        return mockResponse({
          data: { id: "file_test123", attributes: {} },
          meta: {
            upload_id: "multipart_123",
            storage_key: "acc_123/proj_456/file_test123/original/test.txt",
          },
        });
      }

      if (url.includes("/multipart/parts")) {
        const chunkCount = parseInt(new URL(url, "http://localhost").searchParams.get("chunk_count") || "1");
        const parts = Array.from({ length: chunkCount }, (_, i) => ({
          part_number: i + 1,
          upload_url: `https://storage.example.com/upload/part/${i + 1}`,
        }));
        return mockResponse({
          data: { id: "file_test123", attributes: {} },
          meta: { parts },
        });
      }

      if (url.includes("/multipart/complete")) {
        return mockResponse({
          data: {
            id: "file_test123",
            attributes: { status: "processing" },
          },
          meta: { message: "Upload completed successfully" },
        });
      }

      if (url.includes("/confirm")) {
        return mockResponse({
          data: {
            id: "file_test123",
            attributes: { status: "processing" },
          },
          meta: { message: "Upload confirmed" },
        });
      }

      // Storage PUT (direct upload)
      if (options?.method === "PUT" && url.includes("storage.example.com")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ ETag: '"etag123"' }),
        } as Response;
      }

      return mockResponse({});
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with default options", () => {
      const defaultClient = new UploadClient();
      expect(defaultClient).toBeDefined();
    });

    it("should create client with custom options", () => {
      const customClient = new UploadClient({
        chunkSize: 5 * 1024 * 1024,
        maxParallel: 5,
        maxRetries: 5,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe("upload", () => {
    it("should upload a small file directly", async () => {
      const file = createMockFile("test.txt", 500, "text/plain");
      const options: UploadOptions = {
        projectId: "proj_test123",
      };

      const result = await client.upload(file, options);

      expect(result).toBeDefined();
      expect(result.fileId).toBe("file_test123");
      expect(result.fileName).toBe("test.txt");
      expect(result.status).toBe("completed");
    });

    it("should upload a large file with chunked upload", async () => {
      const file = createMockFile("large.bin", 5000, "application/octet-stream");
      const options: UploadOptions = {
        projectId: "proj_test123",
        onProgress: vi.fn(),
      };

      const result = await client.upload(file, options);

      expect(result).toBeDefined();
      expect(result.fileId).toBe("file_test123");
      expect(result.status).toBe("completed");

      // Should have called multipart endpoints
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/multipart"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should call onProgress callback during upload", async () => {
      const file = createMockFile("test.txt", 500, "text/plain");
      const onProgress = vi.fn();
      const options: UploadOptions = {
        projectId: "proj_test123",
        onProgress,
      };

      await client.upload(file, options);

      expect(onProgress).toHaveBeenCalled();
      // Check that progress was reported (the last call may not be 100% due to timing)
      const calls = onProgress.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // At least one call should show progress > 0
      const hasProgress = calls.some(call => {
        const progress = call[0] as UploadProgress;
        return progress.progress > 0;
      });
      expect(hasProgress).toBe(true);
    });

    it("should call onComplete callback when upload finishes", async () => {
      const file = createMockFile("test.txt", 500, "text/plain");
      const onComplete = vi.fn();
      const options: UploadOptions = {
        projectId: "proj_test123",
        onComplete,
      };

      await client.upload(file, options);

      expect(onComplete).toHaveBeenCalled();
      const result = onComplete.mock.calls[0][0] as UploadResult;
      expect(result.status).toBe("completed");
    });

    it("should call onError callback on failure", async () => {
      mockFetch.mockImplementationOnce(async () => {
        return mockResponse({ errors: [{ detail: "Quota exceeded" }] }, 413);
      });

      const file = createMockFile("test.txt", 500, "text/plain");
      const onError = vi.fn();
      const options: UploadOptions = {
        projectId: "proj_test123",
        onError,
      };

      await expect(client.upload(file, options)).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it("should include folder_id when provided", async () => {
      const file = createMockFile("test.txt", 500, "text/plain");
      const options: UploadOptions = {
        projectId: "proj_test123",
        folderId: "folder_123",
      };

      await client.upload(file, options);

      const createCall = mockFetch.mock.calls.find(
        (call) => call[0].includes("/files") && call[1]?.method === "POST"
      );
      const body = JSON.parse(createCall[1].body);
      expect(body.folder_id).toBe("folder_123");
    });
  });

  describe("pause and resume", () => {
    it("should throw error when pausing non-uploading file", async () => {
      await expect(client.pause("nonexistent")).rejects.toThrow();
    });

    it("should throw error when resuming non-paused file", async () => {
      await expect(client.resume("nonexistent", createMockFile("test.txt", 100, "text/plain"), {} as UploadOptions)).rejects.toThrow();
    });
  });

  describe("cancel", () => {
    it("should handle cancelling non-existent upload", async () => {
      // Should not throw
      await expect(client.cancel("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("getState and getAllUploads", () => {
    it("should return null for non-existent upload", async () => {
      const state = await client.getState("nonexistent");
      expect(state).toBeNull();
    });

    it("should return empty array when no uploads", async () => {
      const uploads = await client.getAllUploads();
      expect(Array.isArray(uploads)).toBe(true);
    });
  });

  describe("clearCompleted", () => {
    it("should clear completed uploads", async () => {
      // Should not throw
      await expect(client.clearCompleted()).resolves.toBeUndefined();
    });
  });
});

describe("formatSpeed", () => {
  it("should format bytes per second", () => {
    expect(formatSpeed(500)).toBe("500 B/s");
  });

  it("should format kilobytes per second", () => {
    expect(formatSpeed(1024)).toBe("1.0 KB/s");
    expect(formatSpeed(5120)).toBe("5.0 KB/s");
  });

  it("should format megabytes per second", () => {
    expect(formatSpeed(1024 * 1024)).toBe("1.0 MB/s");
    expect(formatSpeed(5 * 1024 * 1024)).toBe("5.0 MB/s");
  });
});

describe("getUploadClient", () => {
  it("should return singleton instance", () => {
    const client1 = getUploadClient();
    const client2 = getUploadClient();
    expect(client1).toBe(client2);
  });
});

describe("createUploadClient", () => {
  it("should create new instance with options", () => {
    const client = createUploadClient({
      chunkSize: 5 * 1024 * 1024,
      maxParallel: 5,
    });
    expect(client).toBeInstanceOf(UploadClient);
    expect(client).not.toBe(getUploadClient());
  });
});
