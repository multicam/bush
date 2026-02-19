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

    it("should handle case-insensitive MIME types", () => {
      expect(getFileCategory("VIDEO/MP4")).toBe("video");
      expect(getFileCategory("Audio/MPEG")).toBe("audio");
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

    it("should return image for image files", () => {
      expect(getViewerType("image/jpeg")).toBe("image");
      expect(getViewerType("image/png")).toBe("image");
    });

    it("should return pdf for PDF files", () => {
      expect(getViewerType("application/pdf")).toBe("pdf");
    });
  });

  describe("getProcessingPipeline", () => {
    it("should return video for video files", () => {
      expect(getProcessingPipeline("video/mp4")).toBe("video");
    });

    it("should return none for unknown types", () => {
      expect(getProcessingPipeline("application/unknown")).toBe("none");
    });

    it("should return image for image files", () => {
      expect(getProcessingPipeline("image/jpeg")).toBe("image");
    });

    it("should return audio for audio files", () => {
      expect(getProcessingPipeline("audio/mpeg")).toBe("audio");
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

    it("should handle case-insensitive MIME types", () => {
      expect(isSupportedMimeType("VIDEO/MP4")).toBe(true);
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

    it("should handle uppercase extensions", () => {
      expect(isSupportedExtension(".MP4")).toBe(true);
      expect(isSupportedExtension("JPG")).toBe(true);
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

    it("should handle uppercase extensions", () => {
      expect(detectMimeType("video.MP4")).toBe("video/mp4");
      expect(detectMimeType("image.JPG")).toBe("image/jpeg");
    });

    it("should handle paths with directories", () => {
      expect(detectMimeType("/path/to/video.mp4")).toBe("video/mp4");
      expect(detectMimeType("C:\\Users\\test\\file.mov")).toBe("video/quicktime");
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

    it("should format fractional sizes correctly", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(2560000)).toBe("2.4 MB");
    });

    it("should handle very large files", () => {
      const tb = 1024 * 1024 * 1024 * 1024;
      const result = formatFileSize(tb);
      // Implementation supports TB
      expect(result).toBe("1.0 TB");
    });
  });
});
