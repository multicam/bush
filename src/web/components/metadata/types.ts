/**
 * Bush Platform - Metadata Inspector Types
 *
 * Type definitions for the metadata inspector component.
 * Reference: specs/00-atomic-features.md Section 6
 */

import type { TechnicalMetadata, CustomFieldAttributes, CustomFieldValue } from "../../lib/api";

/**
 * Built-in metadata field definition
 */
export interface BuiltInField {
  id: string;
  name: string;
  type: "read-only" | "text" | "number" | "rating" | "select" | "user" | "keywords";
  editable: boolean;
  category: "technical" | "organizational";
}

/**
 * All built-in metadata fields (33 fields per spec)
 */
export const BUILTIN_FIELDS: BuiltInField[] = [
  // Technical metadata (read-only)
  { id: "duration", name: "Duration", type: "read-only", editable: false, category: "technical" },
  { id: "width", name: "Width", type: "read-only", editable: false, category: "technical" },
  { id: "height", name: "Height", type: "read-only", editable: false, category: "technical" },
  { id: "frameRate", name: "Frame Rate", type: "read-only", editable: false, category: "technical" },
  { id: "videoCodec", name: "Video Codec", type: "read-only", editable: false, category: "technical" },
  { id: "audioCodec", name: "Audio Codec", type: "read-only", editable: false, category: "technical" },
  { id: "bitRate", name: "Bit Rate", type: "read-only", editable: false, category: "technical" },
  { id: "sampleRate", name: "Sample Rate", type: "read-only", editable: false, category: "technical" },
  { id: "channels", name: "Channels", type: "read-only", editable: false, category: "technical" },
  { id: "isHDR", name: "HDR", type: "read-only", editable: false, category: "technical" },
  { id: "hdrType", name: "HDR Type", type: "read-only", editable: false, category: "technical" },
  { id: "colorSpace", name: "Color Space", type: "read-only", editable: false, category: "technical" },
  { id: "audioBitDepth", name: "Audio Bit Depth", type: "read-only", editable: false, category: "technical" },
  { id: "format", name: "Format", type: "read-only", editable: false, category: "technical" },
  { id: "hasAlpha", name: "Alpha Channel", type: "read-only", editable: false, category: "technical" },
  { id: "fileSize", name: "File Size", type: "read-only", editable: false, category: "technical" },
  { id: "mimeType", name: "File Type", type: "read-only", editable: false, category: "technical" },
  { id: "originalName", name: "Source Filename", type: "read-only", editable: false, category: "technical" },

  // Organizational metadata (editable)
  { id: "rating", name: "Rating", type: "rating", editable: true, category: "organizational" },
  { id: "status", name: "Status", type: "select", editable: true, category: "organizational" },
  { id: "keywords", name: "Keywords", type: "keywords", editable: true, category: "organizational" },
  { id: "notes", name: "Notes", type: "text", editable: true, category: "organizational" },
  { id: "assignee", name: "Assignee", type: "user", editable: true, category: "organizational" },
];

/**
 * Metadata field value for display
 */
export interface MetadataFieldValue {
  field: BuiltInField | CustomFieldAttributes;
  value: unknown;
  isCustom: boolean;
}

/**
 * Metadata inspector props
 */
export interface MetadataInspectorProps {
  /** File ID to load metadata for */
  fileId: string;
  /** Whether to allow editing */
  editable?: boolean;
  /** Called when metadata is updated */
  onUpdate?: (fieldId: string, value: unknown) => void;
  /** Whether to show technical metadata section */
  showTechnical?: boolean;
  /** Whether to show custom metadata section */
  showCustom?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Metadata field row props
 */
export interface MetadataFieldRowProps {
  /** Field definition */
  field: BuiltInField | CustomFieldAttributes;
  /** Current value */
  value: unknown;
  /** Whether the field is editable */
  editable: boolean;
  /** Whether this is a custom field */
  isCustom?: boolean;
  /** Called when value changes */
  onChange?: (value: unknown) => void;
}

/**
 * Rating input props
 */
export interface RatingInputProps {
  /** Current rating (1-5) */
  value: number | null;
  /** Called when rating changes */
  onChange: (value: number | null) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Keywords input props
 */
export interface KeywordsInputProps {
  /** Current keywords */
  value: string[];
  /** Called when keywords change */
  onChange: (value: string[]) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}
