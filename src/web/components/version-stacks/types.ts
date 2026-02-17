/**
 * Bush Platform - Version Stack Types
 *
 * Types for version stack components.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 Version Stacking
 */

import type { AssetFile } from "@/web/components/asset-browser";

/**
 * Version Stack attributes from API
 */
export interface VersionStack {
  id: string;
  name: string;
  projectId: string;
  currentFileId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Version Stack with files loaded
 */
export interface VersionStackWithFiles extends VersionStack {
  files: AssetFile[];
  currentFile: AssetFile | null;
}

/**
 * Props for VersionStackList component
 */
export interface VersionStackListProps {
  /** Stack ID to load/display */
  stackId: string;
  /** Current file ID (the active version) */
  currentFileId?: string | null;
  /** Callback when a version is selected */
  onVersionSelect?: (fileId: string) => void;
  /** Callback when a version is removed from stack */
  onVersionRemove?: (fileId: string) => void;
  /** Callback to set this version as current */
  onSetCurrent?: (fileId: string) => void;
  /** Whether to show actions */
  showActions?: boolean;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Props for VersionStackCard component
 */
export interface VersionStackCardProps {
  /** Stack data */
  stack: VersionStackWithFiles;
  /** Card size (matches asset card sizes) */
  cardSize?: "small" | "medium" | "large";
  /** Whether the card is selected */
  isSelected?: boolean;
  /** Callback when card is clicked */
  onClick?: (stack: VersionStackWithFiles) => void;
  /** Callback when card is selected */
  onSelect?: (id: string, selected: boolean) => void;
}

/**
 * Props for VersionStackCompare component
 */
export interface VersionStackCompareProps {
  /** Project ID (for API calls) */
  projectId: string;
  /** File IDs to compare (exactly 2) */
  fileIds: [string, string];
  /** Callback to close comparison */
  onClose?: () => void;
  /** Callback to swap sides */
  onSwap?: () => void;
}

/**
 * Props for CreateVersionStackModal component
 */
export interface CreateVersionStackModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Files to create stack from */
  files: AssetFile[];
  /** Project ID */
  projectId: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when stack is created successfully */
  onSuccess?: (stackId: string) => void;
}

/**
 * Props for AddToStackModal component
 */
export interface AddToStackModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** File to add */
  file: AssetFile | null;
  /** Available stacks to add to */
  stacks: VersionStack[];
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when file is added to a stack */
  onAddToStack?: (stackId: string) => void;
  /** Callback when a new stack is created with this file */
  onCreateNewStack?: (name: string) => void;
}
