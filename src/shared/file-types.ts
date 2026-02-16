/**
 * Bush Platform - File Type Registry
 *
 * Central registry mapping MIME types to file categories, viewer types,
 * processing rules, and icons. Used by upload validation, processing pipeline,
 * asset browser icons, and viewer component selection.
 *
 * Reference: specs/00-atomic-features.md Section 4.3
 */

/**
 * File categories for grouping and filtering
 */
export type FileCategory = "video" | "audio" | "image" | "document" | "other";

/**
 * Viewer types for routing to the correct viewer component
 */
export type ViewerType =
  | "video"
  | "image"
  | "audio"
  | "pdf"
  | "document"
  | "interactive"
  | "unsupported";

/**
 * Processing pipeline type
 */
export type ProcessingPipeline =
  | "video"      // FFmpeg: thumbnail, filmstrip, proxy, waveform
  | "image"      // ImageMagick/FFmpeg: thumbnail, proxy
  | "audio"      // FFmpeg: waveform, thumbnail
  | "document"   // LibreOffice: PDF conversion, thumbnail
  | "pdf"        // pdf.js: page rendering
  | "none";      // No processing needed

/**
 * File type definition
 */
export interface FileTypeDefinition {
  /** MIME type */
  mime: string;
  /** File category */
  category: FileCategory;
  /** Viewer component to use */
  viewer: ViewerType;
  /** Processing pipeline */
  processing: ProcessingPipeline;
  /** File extension(s) with dot prefix */
  extensions: string[];
  /** Icon name for UI (lucide-react or custom) */
  icon: string;
  /** Whether this is a RAW camera format */
  isRaw?: boolean;
  /** Whether this is an HDR format */
  isHdr?: boolean;
  /** Whether this is an Adobe format */
  isAdobe?: boolean;
  /** Container format (for video validation) */
  container?: string;
  /** Supported codecs for this container */
  supportedCodecs?: string[];
}

/**
 * Complete file type registry
 *
 * Supported formats from spec:
 * - Video: 3GPP, AVI, FLV, MKV, MOV, MP4, MXF, WebM, WMV (9 containers)
 * - Audio: AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA (8 formats)
 * - Image: RAW (15+ formats), BMP, EXR, GIF, HEIC, JPG, PNG, TIFF, WebP (25+ formats)
 * - Document: PDF, DOCX, PPTX, XLSX, Interactive ZIP (5 formats)
 */
export const FILE_TYPE_REGISTRY: FileTypeDefinition[] = [
  // ==================== VIDEO ====================
  {
    mime: "video/mp4",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".mp4", ".m4v"],
    icon: "video",
    container: "mp4",
    supportedCodecs: ["h264", "h265", "hevc", "prores", "dnxhd", "av1"],
  },
  {
    mime: "video/quicktime",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".mov"],
    icon: "video",
    container: "mov",
    supportedCodecs: ["h264", "h265", "hevc", "prores", "dnxhd", "av1", "dv"],
  },
  {
    mime: "video/x-msvideo",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".avi"],
    icon: "video",
    container: "avi",
    supportedCodecs: ["h264", "mjpeg", "dv", "divx", "xvid"],
  },
  {
    mime: "video/x-matroska",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".mkv"],
    icon: "video",
    container: "mkv",
    supportedCodecs: ["h264", "h265", "hevc", "vp9", "av1"],
  },
  {
    mime: "video/webm",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".webm"],
    icon: "video",
    container: "webm",
    supportedCodecs: ["vp8", "vp9", "av1"],
  },
  {
    mime: "video/x-flv",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".flv"],
    icon: "video",
    container: "flv",
    supportedCodecs: ["h264", "vp6", "sorenson"],
  },
  {
    mime: "video/3gpp",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".3gp", ".3g2"],
    icon: "video",
    container: "3gp",
    supportedCodecs: ["h264", "h263", "mpeg4"],
  },
  {
    mime: "application/mxf",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".mxf"],
    icon: "video",
    container: "mxf",
    supportedCodecs: ["prores", "dnxhd", "xdcam", "imx"],
  },
  {
    mime: "video/x-ms-wmv",
    category: "video",
    viewer: "video",
    processing: "video",
    extensions: [".wmv", ".asf"],
    icon: "video",
    container: "wmv",
    supportedCodecs: ["wmv3", "vc1", "wmv2"],
  },

  // ==================== AUDIO ====================
  {
    mime: "audio/mpeg",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".mp3"],
    icon: "music",
  },
  {
    mime: "audio/mp4",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".m4a"],
    icon: "music",
  },
  {
    mime: "audio/aac",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".aac"],
    icon: "music",
  },
  {
    mime: "audio/wav",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".wav", ".wave"],
    icon: "music",
  },
  {
    mime: "audio/x-aiff",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".aif", ".aiff", ".aifc"],
    icon: "music",
  },
  {
    mime: "audio/flac",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".flac"],
    icon: "music",
  },
  {
    mime: "audio/ogg",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".ogg", ".oga"],
    icon: "music",
  },
  {
    mime: "audio/x-ms-wma",
    category: "audio",
    viewer: "audio",
    processing: "audio",
    extensions: [".wma"],
    icon: "music",
  },

  // ==================== IMAGE - Standard ====================
  {
    mime: "image/jpeg",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".jpg", ".jpeg", ".jpe", ".jfif"],
    icon: "image",
  },
  {
    mime: "image/png",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".png"],
    icon: "image",
  },
  {
    mime: "image/gif",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".gif"],
    icon: "image",
  },
  {
    mime: "image/webp",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".webp"],
    icon: "image",
  },
  {
    mime: "image/bmp",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".bmp", ".dib"],
    icon: "image",
  },
  {
    mime: "image/tiff",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".tiff", ".tif"],
    icon: "image",
  },
  {
    mime: "image/heic",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".heic", ".heif"],
    icon: "image",
  },
  {
    mime: "image/x-exr",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".exr"],
    icon: "image",
    isHdr: true,
  },

  // ==================== IMAGE - RAW (15+ formats) ====================
  {
    mime: "image/x-canon-cr2",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".cr2", ".crw"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-canon-cr3",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".cr3"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-nikon-nef",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".nef", ".nrw"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-sony-arw",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".arw", ".sr2"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-fuji-raf",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".raf"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-panasonic-rw2",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".rw2", ".raw"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-olympus-orf",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".orf"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-adobe-dng",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".dng"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-pentax-pef",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".pef"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-leaf-mos",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".mos"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-sony-sr2",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".sr2", ".srf"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-phaseone-iiq",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".iiq"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-hasselblad-3fr",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".3fr"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-leica-rwl",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".rwl", ".dng"],
    icon: "camera",
    isRaw: true,
  },
  {
    mime: "image/x-minolta-mrw",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".mrw"],
    icon: "camera",
    isRaw: true,
  },

  // ==================== IMAGE - Adobe ====================
  {
    mime: "image/vnd.adobe.photoshop",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".psd"],
    icon: "file-image",
    isAdobe: true,
  },
  {
    mime: "application/illustrator",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".ai", ".ait"],
    icon: "file-image",
    isAdobe: true,
  },
  {
    mime: "application/postscript",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".eps", ".epsf"],
    icon: "file-image",
    isAdobe: true,
  },
  {
    mime: "application/x-indesign",
    category: "image",
    viewer: "image",
    processing: "image",
    extensions: [".indd", ".indt"],
    icon: "file-image",
    isAdobe: true,
  },

  // ==================== DOCUMENT ====================
  {
    mime: "application/pdf",
    category: "document",
    viewer: "pdf",
    processing: "pdf",
    extensions: [".pdf"],
    icon: "file-text",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
    viewer: "document",
    processing: "document",
    extensions: [".docx"],
    icon: "file-text",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    category: "document",
    viewer: "document",
    processing: "document",
    extensions: [".pptx"],
    icon: "presentation",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    category: "document",
    viewer: "document",
    processing: "document",
    extensions: [".xlsx"],
    icon: "table",
  },
  {
    mime: "application/zip",
    category: "document",
    viewer: "interactive",
    processing: "none",
    extensions: [".zip"],
    icon: "folder-archive",
  },
];

// ==================== LOOKUP MAPS ====================

/**
 * MIME type to definition lookup
 */
const mimeLookup = new Map<string, FileTypeDefinition>();
for (const def of FILE_TYPE_REGISTRY) {
  mimeLookup.set(def.mime.toLowerCase(), def);
}

/**
 * Extension to definition lookup
 */
const extensionLookup = new Map<string, FileTypeDefinition>();
for (const def of FILE_TYPE_REGISTRY) {
  for (const ext of def.extensions) {
    extensionLookup.set(ext.toLowerCase(), def);
  }
}

// ==================== PUBLIC API ====================

/**
 * Get file type definition by MIME type
 */
export function getFileTypeByMime(mime: string): FileTypeDefinition | undefined {
  return mimeLookup.get(mime.toLowerCase());
}

/**
 * Get file type definition by file extension
 */
export function getFileTypeByExtension(extension: string): FileTypeDefinition | undefined {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return extensionLookup.get(ext.toLowerCase());
}

/**
 * Get file category from MIME type
 * Returns "other" if MIME type is not recognized
 */
export function getFileCategory(mime: string): FileCategory {
  return getFileTypeByMime(mime)?.category ?? "other";
}

/**
 * Get viewer type from MIME type
 * Returns "unsupported" if MIME type is not recognized
 */
export function getViewerType(mime: string): ViewerType {
  return getFileTypeByMime(mime)?.viewer ?? "unsupported";
}

/**
 * Get processing pipeline from MIME type
 * Returns "none" if MIME type is not recognized
 */
export function getProcessingPipeline(mime: string): ProcessingPipeline {
  return getFileTypeByMime(mime)?.processing ?? "none";
}

/**
 * Get icon name from MIME type
 * Returns "file" as default
 */
export function getFileIcon(mime: string): string {
  return getFileTypeByMime(mime)?.icon ?? "file";
}

/**
 * Check if a MIME type is a supported format
 */
export function isSupportedMimeType(mime: string): boolean {
  return mimeLookup.has(mime.toLowerCase());
}

/**
 * Check if a file extension is supported
 */
export function isSupportedExtension(extension: string): boolean {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return extensionLookup.has(ext.toLowerCase());
}

/**
 * Validate codec against container
 * Returns true if codec is supported for the container, false otherwise
 */
export function isValidCodec(containerMime: string, codec: string): boolean {
  const def = getFileTypeByMime(containerMime);
  if (!def?.supportedCodecs) {
    return true; // No codec restrictions defined
  }
  return def.supportedCodecs.includes(codec.toLowerCase());
}

/**
 * Get all supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return Array.from(mimeLookup.keys());
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Array.from(extensionLookup.keys());
}

/**
 * Get all file type definitions for a category
 */
export function getFileTypesByCategory(category: FileCategory): FileTypeDefinition[] {
  return FILE_TYPE_REGISTRY.filter((def) => def.category === category);
}

/**
 * Detect MIME type from filename
 * Uses extension to look up MIME type
 */
export function detectMimeType(filename: string): string | undefined {
  const ext = filename.substring(filename.lastIndexOf("."));
  return getFileTypeByExtension(ext)?.mime;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
