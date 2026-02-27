/**
 * Bush Platform - Metadata Inspector Panel
 *
 * Sidebar panel for viewing and editing file metadata.
 * Displays technical metadata (read-only) and built-in/custom editable fields.
 * Reference: specs/00-product-reference.md Section 6
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Info, ChevronDown, Star, X } from "lucide-react";
import { Spinner } from "../ui/spinner";
import { metadataApi, type TechnicalMetadata, type FileMetadataAttributes } from "../../lib/api";
import { BUILTIN_FIELDS, type BuiltInField } from "./types";

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
    <div className="flex flex-row-reverse gap-0.5 justify-end">
      {[5, 4, 3, 2, 1].map((star) => (
        <span
          key={star}
          className={`cursor-pointer text-muted transition-colors ${
            disabled ? "cursor-default opacity-50" : ""
          } ${
            (hoverValue ?? value ?? 0) >= star ? "text-amber-500" : ""
          }`}
          onClick={() => !disabled && onChange(value === star ? null : star)}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => setHoverValue(null)}
        >
          <Star
            size={16}
            fill={(hoverValue ?? value ?? 0) >= star ? "currentColor" : "none"}
          />
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
    <div className="flex flex-wrap gap-1 max-w-[180px]">
      {value.map((keyword) => (
        <span
          key={keyword}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-3 rounded-full text-[11px] text-primary"
        >
          {keyword}
          {!disabled && (
            <span
              className="cursor-pointer opacity-60 hover:opacity-100 flex items-center justify-center"
              onClick={() => handleRemove(keyword)}
            >
              <X size={12} />
            </span>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          className="border-none bg-transparent text-xs text-primary outline-none w-[60px] min-w-[60px] placeholder:text-muted"
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
          className="text-xs text-primary bg-surface-3 border border-accent rounded-sm p-2 w-[180px] min-h-[60px] resize-y outline-none font-inherit focus:border-accent"
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
        className="text-xs text-primary bg-surface-3 border border-accent rounded-sm px-2 py-1 w-[180px] text-right outline-none focus:border-accent"
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
    <div className="flex items-start justify-between px-4 py-2.5 border-b border-border-default hover:bg-surface-3 last:border-b-0">
      <div className="text-xs text-secondary shrink-0 w-[100px]">
        {field.name}
        {isCustom && (
          <span className="inline-flex items-center px-1.5 py-0.5 bg-accent/10 text-accent rounded-sm text-[9px] font-semibold uppercase ml-2">
            Custom
          </span>
        )}
      </div>
      <div
        className={`text-xs text-primary text-right break-words max-w-[180px] ${
          isEditableField ? "cursor-pointer px-2 py-1 -m-1 rounded-sm transition-colors hover:bg-surface-3" : ""
        }`}
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
    <div className="border-b border-border-default">
      <div
        className="px-4 py-3 bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-secondary flex items-center gap-2 cursor-pointer select-none hover:bg-surface-3"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
        />
        {title}
      </div>
      <div className={collapsed ? "hidden" : ""}>
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
      fields.push({ field: { id: "resolution", name: "Resolution", type: "read-only", editable: false, category: "technical" } as BuiltInField, value: tech.width && tech.height ? `${tech.width} x ${tech.height}` : null });
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
      <div className={`w-80 bg-surface-1 border-l border-border-default flex flex-col h-full ${className || ""}`}>
        <div className="px-4 py-4 border-b border-border-default flex items-center justify-between">
          <div className="text-sm font-semibold text-primary flex items-center gap-2">
            <Info size={16} />
            Metadata
          </div>
        </div>
        <div className="flex items-center justify-center p-8">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-80 bg-surface-1 border-l border-border-default flex flex-col h-full ${className || ""}`}>
        <div className="px-4 py-4 border-b border-border-default flex items-center justify-between">
          <div className="text-sm font-semibold text-primary flex items-center gap-2">
            <Info size={16} />
            Metadata
          </div>
        </div>
        <div className="px-4 py-4 text-red-500 text-xs text-center">{error}</div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className={`w-80 bg-surface-1 border-l border-border-default flex flex-col h-full ${className || ""}`}>
        <div className="px-4 py-4 border-b border-border-default flex items-center justify-between">
          <div className="text-sm font-semibold text-primary flex items-center gap-2">
            <Info size={16} />
            Metadata
          </div>
        </div>
        <div className="px-4 py-6 text-center text-muted text-xs">No metadata available</div>
      </div>
    );
  }

  return (
    <div className={`w-80 bg-surface-1 border-l border-border-default flex flex-col h-full ${className || ""}`}>
      <div className="px-4 py-4 border-b border-border-default flex items-center justify-between">
        <div className="text-sm font-semibold text-primary flex items-center gap-2">
          <Info size={16} />
          Metadata
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* File info */}
        <div className="px-4 py-4 border-b border-border-default">
          <div className="text-sm font-medium text-primary mb-2 break-words">{metadata.file.name}</div>
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-secondary">
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
