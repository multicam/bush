/**
 * Tests for media processing service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the queue module
vi.mock("./queue.js", () => ({
  getQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
  })),
  addJob: vi.fn().mockResolvedValue(undefined),
  closeQueues: vi.fn().mockResolvedValue(undefined),
  QUEUE_NAMES: {
    METADATA: "media:metadata",
    THUMBNAIL: "media:thumbnail",
    FILMSTRIP: "media:filmstrip",
    PROXY: "media:proxy",
    WAVEFORM: "media:waveform",
  },
}));

// Mock the database
vi.mock("../db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

// Mock schema
vi.mock("../db/schema.js", () => ({
  files: { id: "files.id" },
}));

import {
  QUEUE_NAMES,
  JOB_PRIORITY,
  THUMBNAIL_DIMENSIONS,
  PROXY_CONFIGS,
} from "./types.js";
import { enqueueProcessingJobs } from "./index.js";
import { addJob } from "./queue.js";

describe("media processing service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("module exports", () => {
    it("exports QUEUE_NAMES from types", () => {
      expect(QUEUE_NAMES).toBeDefined();
      expect(QUEUE_NAMES.METADATA).toBe("media:metadata");
    });

    it("exports JOB_PRIORITY from types", () => {
      expect(JOB_PRIORITY).toBeDefined();
      expect(JOB_PRIORITY.STANDARD).toBe(5);
    });

    it("exports THUMBNAIL_DIMENSIONS from types", () => {
      expect(THUMBNAIL_DIMENSIONS).toBeDefined();
      expect(THUMBNAIL_DIMENSIONS.small).toEqual({ width: 320, height: 180 });
    });

    it("exports PROXY_CONFIGS from types", () => {
      expect(PROXY_CONFIGS).toBeDefined();
      expect(PROXY_CONFIGS["720p"]).toBeDefined();
    });
  });

  describe("enqueueProcessingJobs", () => {
    it("enqueues metadata job for video files", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/video.mp4",
        "video/mp4",
        "video.mp4"
      );

      // Should call addJob at least for metadata
      expect(addJob).toHaveBeenCalled();

      // First call should be metadata job
      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.type).toBe("metadata");
    });

    it("enqueues metadata job for audio files", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/audio.mp3",
        "audio/mp3",
        "audio.mp3"
      );

      expect(addJob).toHaveBeenCalled();
      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.type).toBe("metadata");
    });

    it("enqueues metadata job for image files", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/image.jpg",
        "image/jpeg",
        "image.jpg"
      );

      expect(addJob).toHaveBeenCalled();
      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.type).toBe("metadata");
    });

    it("enqueues metadata job for PDF documents", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/doc.pdf",
        "application/pdf",
        "doc.pdf"
      );

      expect(addJob).toHaveBeenCalled();
      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.type).toBe("metadata");
    });

    it("enqueues metadata job for unknown MIME types", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/file.xyz",
        "application/unknown",
        "file.xyz"
      );

      expect(addJob).toHaveBeenCalled();
      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.type).toBe("metadata");
    });

    it("uses bulk upload priority when isBulkUpload is true", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/video.mp4",
        "video/mp4",
        "video.mp4",
        { isBulkUpload: true }
      );

      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.priority).toBe(JOB_PRIORITY.BULK_UPLOAD);
    });

    it("uses custom priority when provided", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/video.mp4",
        "video/mp4",
        "video.mp4",
        { priority: 1 }
      );

      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.priority).toBe(1);
    });

    it("uses standard priority by default", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/video.mp4",
        "video/mp4",
        "video.mp4"
      );

      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.priority).toBe(JOB_PRIORITY.STANDARD);
    });

    it("includes correct asset data in jobs", async () => {
      await enqueueProcessingJobs(
        "asset-123",
        "account-123",
        "project-123",
        "path/to/video.mp4",
        "video/mp4",
        "video.mp4"
      );

      const firstCall = vi.mocked(addJob).mock.calls[0][0];
      expect(firstCall.assetId).toBe("asset-123");
      expect(firstCall.accountId).toBe("account-123");
      expect(firstCall.projectId).toBe("project-123");
      expect(firstCall.storageKey).toBe("path/to/video.mp4");
      expect(firstCall.mimeType).toBe("video/mp4");
      expect(firstCall.sourceFilename).toBe("video.mp4");
    });
  });

  describe("reprocessAsset", () => {
    it("throws error when asset not found", async () => {
      // Need to reset modules and reimport to get fresh mock state
      vi.resetModules();

      // Re-setup mocks
      vi.doMock("./queue.js", () => ({
        getQueue: vi.fn(() => ({
          add: vi.fn().mockResolvedValue({ id: "job-123" }),
        })),
        addJob: vi.fn().mockResolvedValue(undefined),
        closeQueues: vi.fn().mockResolvedValue(undefined),
        QUEUE_NAMES: {
          METADATA: "media:metadata",
          THUMBNAIL: "media:thumbnail",
          FILMSTRIP: "media:filmstrip",
          PROXY: "media:proxy",
          WAVEFORM: "media:waveform",
        },
      }));

      vi.doMock("../db/index.js", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          })),
        },
      }));

      vi.doMock("../db/schema.js", () => ({
        files: { id: "files.id" },
      }));

      const { reprocessAsset: freshReprocess } = await import("./index.js");

      await expect(freshReprocess("nonexistent")).rejects.toThrow("Asset not found: nonexistent");

      vi.doUnmock("./queue.js");
      vi.doUnmock("../db/index.js");
      vi.doUnmock("../db/schema.js");
    });

    it("successfully reprocesses an existing asset", async () => {
      vi.resetModules();

      const mockFile = {
        id: "asset-123",
        projectId: "project-123",
        name: "video.mp4",
        mimeType: "video/mp4",
        originalName: "original-video.mp4",
      };

      vi.doMock("./queue.js", () => ({
        getQueue: vi.fn(() => ({
          add: vi.fn().mockResolvedValue({ id: "job-123" }),
        })),
        addJob: vi.fn().mockResolvedValue(undefined),
        closeQueues: vi.fn().mockResolvedValue(undefined),
        QUEUE_NAMES: {
          METADATA: "media:metadata",
          THUMBNAIL: "media:thumbnail",
          FILMSTRIP: "media:filmstrip",
          PROXY: "media:proxy",
          WAVEFORM: "media:waveform",
        },
      }));

      vi.doMock("../db/index.js", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([mockFile]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          })),
        },
      }));

      vi.doMock("../db/schema.js", () => ({
        files: { id: "files.id" },
      }));

      const { reprocessAsset: freshReprocess } = await import("./index.js");
      const { addJob: freshAddJob } = await import("./queue.js");

      // Should not throw
      await freshReprocess("asset-123");

      // Should have called addJob
      expect(freshAddJob).toHaveBeenCalled();

      vi.doUnmock("./queue.js");
      vi.doUnmock("../db/index.js");
      vi.doUnmock("../db/schema.js");
    });
  });

  describe("enqueueFrameCapture", () => {
    it("enqueues frame capture job with correct parameters", async () => {
      vi.resetModules();

      const mockAdd = vi.fn().mockResolvedValue({ id: "frame-job-123" });

      vi.doMock("./queue.js", () => ({
        getQueue: vi.fn(() => ({
          add: mockAdd,
        })),
        addJob: vi.fn().mockResolvedValue(undefined),
        closeQueues: vi.fn().mockResolvedValue(undefined),
        QUEUE_NAMES: {
          METADATA: "media:metadata",
          THUMBNAIL: "media:thumbnail",
          FILMSTRIP: "media:filmstrip",
          PROXY: "media:proxy",
          WAVEFORM: "media:waveform",
        },
      }));

      vi.doMock("../db/index.js", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          })),
        },
      }));

      vi.doMock("../db/schema.js", () => ({
        files: { id: "files.id" },
      }));

      const { enqueueFrameCapture } = await import("./index.js");

      const jobId = await enqueueFrameCapture({
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/video.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        priority: 1,
        timestamp: 30,
      });

      expect(jobId).toBe("frame-job-123");
      expect(mockAdd).toHaveBeenCalledWith(
        "frame_capture",
        expect.objectContaining({
          type: "frame_capture",
          assetId: "asset-123",
          timestamp: 30,
        }),
        expect.objectContaining({
          priority: 1,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        })
      );

      vi.doUnmock("./queue.js");
      vi.doUnmock("../db/index.js");
      vi.doUnmock("../db/schema.js");
    });

    it("returns empty string when job id is null", async () => {
      vi.resetModules();

      const mockAdd = vi.fn().mockResolvedValue({ id: null });

      vi.doMock("./queue.js", () => ({
        getQueue: vi.fn(() => ({
          add: mockAdd,
        })),
        addJob: vi.fn().mockResolvedValue(undefined),
        closeQueues: vi.fn().mockResolvedValue(undefined),
        QUEUE_NAMES: {
          METADATA: "media:metadata",
          THUMBNAIL: "media:thumbnail",
          FILMSTRIP: "media:filmstrip",
          PROXY: "media:proxy",
          WAVEFORM: "media:waveform",
        },
      }));

      vi.doMock("../db/index.js", () => ({
        db: {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          })),
        },
      }));

      vi.doMock("../db/schema.js", () => ({
        files: { id: "files.id" },
      }));

      const { enqueueFrameCapture } = await import("./index.js");

      const jobId = await enqueueFrameCapture({
        assetId: "asset-123",
        accountId: "account-123",
        projectId: "project-123",
        storageKey: "path/to/video.mp4",
        mimeType: "video/mp4",
        sourceFilename: "video.mp4",
        priority: 1,
        timestamp: 30,
      });

      expect(jobId).toBe("");

      vi.doUnmock("./queue.js");
      vi.doUnmock("../db/index.js");
      vi.doUnmock("../db/schema.js");
    });
  });
});
