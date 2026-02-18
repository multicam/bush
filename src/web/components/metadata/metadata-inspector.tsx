/**
 * Bush Platform - Metadata Inspector Panel
 *
 * Sidebar panel for viewing and editing file metadata.
 * Displays technical metadata (read-only) and built-in/custom editable fields.
 * Reference: specs/00-atomic-features.md Section 6
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Spinner } from "../ui/spinner";
import { metadataApi, type TechnicalMetadata, type FileMetadataAttributes } from "../../lib/api";
import { BUILTIN_FIELDS, type BuiltInField } from "./types";
import styles from "./metadata.module.css";

/** Info icon */
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

/** Chevron icon */
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={collapsed ? styles.sectionChevronCollapsed : styles.sectionChevron}
      style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Star icon for rating */
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/** X icon for removing keywords */
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Format duration in seconds to HH:MM:SS */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Format bitrate to human readable */
function formatBitrate(bitrate: number | null): string {
  if (bitrate === null) return "—";
  if (bitrate >= 1_000_000) {
    return `${(bitrate / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bitrate >= 1_000) {
    return `${(bitrate / 1_000).toFixed(0)} kbps`;
  }
  return `${bitrate} bps`;
}

/** Format file size to human readable */
function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(2)} MB`;
  }
  if (bytes >= 1_024) {
    return `${(bytes / 1_024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

/** Format sample rate to human readable */
function formatSampleRate(rate: number | null): string {
  if (rate === null) return "—";
  if (rate >= 1000) {
    return `${(rate / 1000).toFixed(1)} kHz`;
  }
  return `${rate} Hz`;
}

/** Rating input component */
function RatingInput({ value, onChange, disabled }: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <div className={styles.ratingInput}>
      {[5, 4, 3, 2, 1].map((star) => (
        <span
          key={star}
          className={`${styles.ratingStar} ${disabled ? styles.disabled : ""} ${
            (hoverValue ?? value ?? 0) >= star ? styles.active : ""
          }`}
          onClick={() => !disabled && onChange(value === star ? null : star)}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(null)}
        >
          <StarIcon filled={(hoverValue ?? value ?? 0) >= star} />
        </span>
      ))}
    </div>
  );
}

/** Keywords input component */
function KeywordsInput({ value, onChange, disabled }: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleRemove = (keyword: string) => {
    onChange(value.filter((k) => k !== keyword));
  };

  return (
    <div className={styles.keywordsInput}>
      {value.map((keyword) => (
        <span key={keyword} className={styles.keywordTag}>
          {keyword}
          {!disabled && (
            <span className={styles.keywordRemove} onClick={() => handleRemove(keyword)}>
              <XIcon />
            </span>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          className={styles.keywordInput}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Add..." : ""}
        />
      )}
    </div>
  );
}

/** Metadata field row */
function MetadataFieldRow({
  field,
  value,
  editable,
  isCustom,
  onChange,
}: {
  field: BuiltInField | { id: string; name: string; type: string };
  value: unknown;
  editable: boolean;
  isCustom?: boolean;
  onChange?: (value: unknown) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const isEditableField = editable && (field as BuiltInField).editable !== false;
  const fieldType = (field as BuiltInField).type || "read-only";

  const handleSave = () => {
    if (onChange && editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  /** Format value for display */
  const formatValue = (): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") {
      // Check if this is a specific field type
      if (field.id === "duration") return formatDuration(value);
      if (field.id === "bitRate") return formatBitrate(value);
      if (field.id === "sampleRate") return formatSampleRate(value);
      if (field.id === "fileSizeBytes" || field.id === "fileSize") return formatBytes(value);
      if (field.id === "frameRate") return `${value.toFixed(2)} fps`;
      if (field.id === "width" || field.id === "height") return `${value}px`;
      return String(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return value.join(", ");
    }
    return String(value);
  };

  /** Render editable input based on field type */
  const renderEditableInput = () => {
    if (fieldType === "rating") {
      return (
        <RatingInput
          value={editValue as number | null}
          onChange={(v) => {
            setEditValue(v);
            if (onChange) onChange(v);
            setIsEditing(false);
          }}
        />
      );
    }

    if (fieldType === "keywords") {
      return (
        <KeywordsInput
          value={(editValue as string[]) || []}
          onChange={(v) => {
            setEditValue(v);
            if (onChange) onChange(v);
          }}
        />
      );
    }

    if (fieldType === "text") {
      return (
        <textarea
          className={styles.notesTextarea}
          value={(editValue as string) || ""}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          autoFocus
        />
      );
    }

    return (
      <input
        type="text"
        className={styles.fieldValueInput}
        value={(editValue as string) || ""}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
        autoFocus
      />
    );
  };

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldName}>
        {field.name}
        {isCustom && <span className={styles.customBadge}>Custom</span>}
      </div>
      <div
        className={`${styles.fieldValue} ${isEditableField ? styles.editable : ""}`}
        onClick={() => isEditableField && fieldType !== "rating" && fieldType !== "keywords" && setIsEditing(true)}
      >
        {isEditing ? renderEditableInput() : formatValue()}
      </div>
    </div>
  );
}

/** Section component */
function Section({
  title,
  collapsed: initialCollapsed = false,
  children,
}: {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader} onClick={() => setCollapsed(!collapsed)}>
        <ChevronIcon collapsed={collapsed} />
        {title}
      </div>
      <div className={`${styles.sectionContent} ${collapsed ? styles.collapsed : ""}`}>
        {children}
      </div>
    </div>
  );
}

/** Main metadata inspector component */
export function MetadataInspector({
  fileId,
  editable = true,
  onUpdate,
  showTechnical = true,
  showCustom = true,
  className,
}: {
  fileId: string;
  editable?: boolean;
  onUpdate?: (fieldId: string, value: unknown) => void;
  showTechnical?: boolean;
  showCustom?: boolean;
  className?: string;
}) {
  const [metadata, setMetadata] = useState<FileMetadataAttributes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metadata
  useEffect(() => {
    let mounted = true;

    const loadMetadata = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await metadataApi.get(fileId);
        if (mounted) {
          setMetadata(response.data.attributes);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load metadata");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      mounted = false;
    };
  }, [fileId]);

  // Handle field update
  const handleFieldUpdate = useCallback(async (fieldId: string, value: unknown) => {
    if (!metadata) return;

    try {
      await metadataApi.updateField(fileId, fieldId, value as string | number | boolean | string[] | null);

      // Update local state
      if (fieldId in metadata.builtin) {
        setMetadata({
          ...metadata,
          builtin: {
            ...metadata.builtin,
            [fieldId]: value,
          },
        });
      }

      // Notify parent
      onUpdate?.(fieldId, value);
    } catch (err) {
      console.error("Failed to update metadata:", err);
    }
  }, [metadata, onUpdate]);

  // Build technical fields from metadata
  const technicalFields = useMemo(() => {
    if (!metadata?.technical) return [];

    const tech: TechnicalMetadata = metadata.technical;
    const fields: Array<{ field: BuiltInField; value: unknown }> = [];

    // Add file info
    fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "originalName")!, value: metadata.file.original_name });
    fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "mimeType")!, value: metadata.file.mime_type });
    fields.push({ field: { id: "fileSize", name: "File Size", type: "read-only", editable: false, category: "technical" } as BuiltInField, value: metadata.file.file_size_bytes });

    // Add technical metadata
    if (tech.duration !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "duration")!, value: tech.duration });
    }
    if (tech.width !== null || tech.height !== null) {
      fields.push({ field: { id: "resolution", name: "Resolution", type: "read-only", editable: false, category: "technical" } as BuiltInField, value: tech.width && tech.height ? `${tech.width} × ${tech.height}` : null });
    }
    if (tech.frameRate !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "frameRate")!, value: tech.frameRate });
    }
    if (tech.videoCodec !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "videoCodec")!, value: tech.videoCodec });
    }
    if (tech.audioCodec !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "audioCodec")!, value: tech.audioCodec });
    }
    if (tech.bitRate !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "bitRate")!, value: tech.bitRate });
    }
    if (tech.sampleRate !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "sampleRate")!, value: tech.sampleRate });
    }
    if (tech.channels !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "channels")!, value: tech.channels });
    }
    if (tech.isHDR) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "hdrType")!, value: tech.hdrType || "HDR" });
    }
    if (tech.format !== null) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "format")!, value: tech.format });
    }
    if (tech.hasAlpha) {
      fields.push({ field: BUILTIN_FIELDS.find((f) => f.id === "hasAlpha")!, value: true });
    }

    return fields;
  }, [metadata]);

  // Build custom fields from metadata
  const customFields = useMemo(() => {
    if (!metadata?.custom) return [];

    return Object.entries(metadata.custom).map(([fieldId, { field, value }]) => ({
      field: { ...field, id: fieldId },
      value,
    }));
  }, [metadata]);

  if (isLoading) {
    return (
      <div className={`${styles.panel} ${className || ""}`}>
        <div className={styles.header}>
          <div className={styles.title}>
            <InfoIcon />
            Metadata
          </div>
        </div>
        <div className={styles.loading}>
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.panel} ${className || ""}`}>
        <div className={styles.header}>
          <div className={styles.title}>
            <InfoIcon />
            Metadata
          </div>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className={`${styles.panel} ${className || ""}`}>
        <div className={styles.header}>
          <div className={styles.title}>
            <InfoIcon />
            Metadata
          </div>
        </div>
        <div className={styles.empty}>No metadata available</div>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${className || ""}`}>
      <div className={styles.header}>
        <div className={styles.title}>
          <InfoIcon />
          Metadata
        </div>
      </div>

      <div className={styles.content}>
        {/* File info */}
        <div className={styles.fileInfo}>
          <div className={styles.fileName}>{metadata.file.name}</div>
          <div className={styles.fileMeta}>
            <div className={styles.fileMetaItem}>
              Uploaded {new Date(metadata.file.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Built-in editable fields */}
        <Section title="Properties">
          <MetadataFieldRow
            field={{ id: "rating", name: "Rating", type: "rating" }}
            value={metadata.builtin.rating}
            editable={editable}
            onChange={(value) => handleFieldUpdate("rating", value)}
          />
          <MetadataFieldRow
            field={{ id: "status", name: "Status", type: "select" }}
            value={metadata.builtin.status}
            editable={editable}
            onChange={(value) => handleFieldUpdate("status", value)}
          />
          <MetadataFieldRow
            field={{ id: "keywords", name: "Keywords", type: "keywords" }}
            value={metadata.builtin.keywords}
            editable={editable}
            onChange={(value) => handleFieldUpdate("keywords", value)}
          />
          <MetadataFieldRow
            field={{ id: "notes", name: "Notes", type: "text" }}
            value={metadata.builtin.notes}
            editable={editable}
            onChange={(value) => handleFieldUpdate("notes", value)}
          />
          <MetadataFieldRow
            field={{ id: "assignee_id", name: "Assignee", type: "user" }}
            value={metadata.builtin.assignee?.first_name ?? metadata.builtin.assignee?.email ?? null}
            editable={editable}
            onChange={(value) => handleFieldUpdate("assignee_id", value)}
          />
        </Section>

        {/* Technical metadata */}
        {showTechnical && technicalFields.length > 0 && (
          <Section title="Technical" collapsed>
            {technicalFields.map(({ field, value }) => (
              <MetadataFieldRow
                key={field.id}
                field={field}
                value={value}
                editable={false}
              />
            ))}
          </Section>
        )}

        {/* Custom fields */}
        {showCustom && customFields.length > 0 && (
          <Section title="Custom Fields">
            {customFields.map(({ field, value }) => (
              <MetadataFieldRow
                key={field.id}
                field={{ id: field.id, name: field.name, type: field.type }}
                value={value}
                editable={editable}
                isCustom
                onChange={(v) => handleFieldUpdate(field.id, v)}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

export default MetadataInspector;
