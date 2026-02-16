import { describe, it, expect } from "vitest";
import {
  getFileCategory,
  getViewerType,
  getProcessingPipeline,
  isSupportedMimeType,
  isSupportedExtension,
  detectMimeType,
  formatFileSize,
} from "./file-types.js";

describe("File Type Registry", () => {
  describe("getFileCategory", () => {
    it("should return video for video MIME types", () => {
      expect(getFileCategory("video/mp4")).toBe("video");
      expect(getFileCategory("video/quicktime")).toBe("video");
      expect(getFileCategory("video/x-matroska")).toBe("video");
    });

    it("should return audio for audio MIME types", () => {
      expect(getFileCategory("audio/mpeg")).toBe("audio");
      expect(getFileCategory("audio/wav")).toBe("audio");
      expect(getFileCategory("audio/flac")).toBe("audio");
    });

    it("should return image for image MIME types", () => {
      expect(getFileCategory("image/jpeg")).toBe("image");
      expect(getFileCategory("image/png")).toBe("image");
      expect(getFileCategory("image/gif")).toBe("image");
    });

    it("should return document for PDF MIME type", () => {
      expect(getFileCategory("application/pdf")).toBe("document");
    });

    it("should return other for unknown MIME types", () => {
      expect(getFileCategory("application/unknown")).toBe("other");
    });
  });

  describe("getViewerType", () => {
    it("should return video for video files", () => {
      expect(getViewerType("video/mp4")).toBe("video");
    });

    it("should return audio for audio files", () => {
      expect(getViewerType("audio/mp3")).toBe("unsupported");
      expect(getViewerType("audio/mpeg")).toBe("audio");
    });

    it("should return unsupported for unknown types", () => {
      expect(getViewerType("application/unknown")).toBe("unsupported");
    });
  });

  describe("getProcessingPipeline", () => {
    it("should return video for video files", () => {
      expect(getProcessingPipeline("video/mp4")).toBe("video");
    });

    it("should return none for unknown types", () => {
      expect(getProcessingPipeline("application/unknown")).toBe("none");
    });
  });

  describe("isSupportedMimeType", () => {
    it("should return true for supported MIME types", () => {
      expect(isSupportedMimeType("video/mp4")).toBe(true);
      expect(isSupportedMimeType("image/jpeg")).toBe(true);
      expect(isSupportedMimeType("application/pdf")).toBe(true);
    });

    it("should return false for unsupported MIME types", () => {
      expect(isSupportedMimeType("application/unknown")).toBe(false);
    });
  });

  describe("isSupportedExtension", () => {
    it("should return true for supported extensions", () => {
      expect(isSupportedExtension(".mp4")).toBe(true);
      expect(isSupportedExtension("mp4")).toBe(true);
      expect(isSupportedExtension(".jpg")).toBe(true);
      expect(isSupportedExtension(".pdf")).toBe(true);
    });

    it("should return false for unsupported extensions", () => {
      expect(isSupportedExtension(".xyz")).toBe(false);
    });
  });

  describe("detectMimeType", () => {
    it("should detect MIME type from filename", () => {
      expect(detectMimeType("video.mp4")).toBe("video/mp4");
      expect(detectMimeType("image.jpg")).toBe("image/jpeg");
      expect(detectMimeType("document.pdf")).toBe("application/pdf");
    });

    it("should return undefined for unknown extensions", () => {
      expect(detectMimeType("file.xyz")).toBeUndefined();
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
    });
  });
});
