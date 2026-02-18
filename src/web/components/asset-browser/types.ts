/**
 * Bush Platform - Asset Browser Types
 *
 * Shared types for asset browser components.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 Asset Browser and Navigation
 */

export type ViewMode = "grid" | "list";

export type CardSize = "small" | "medium" | "large";

export interface AssetFile {
  id: string;
  name: string;
  mimeType: string;
  fileSizeBytes: number;
  status: "uploading" | "processing" | "ready" | "processing_failed" | "deleted";
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  // Optional metadata fields for badge display
  duration?: number | null; // in seconds
  width?: number | null;
  height?: number | null;
  rating?: number | null; // 1-5
  assetStatus?: string | null; // Custom status label
  keywords?: string[];
}

export interface AssetFolder {
  id: string;
  name: string;
  parentId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetItem = AssetFile | AssetFolder;

export function isFile(item: AssetItem): item is AssetFile {
  return "mimeType" in item;
}

export function isFolder(item: AssetItem): item is AssetFolder {
  return "parentId" in item;
}

export interface AssetBrowserProps {
  /** Project ID for the asset browser */
  projectId: string;
  /** Optional folder ID to browse (null for root) */
  folderId?: string | null;
  /** Files to display */
  files: AssetFile[];
  /** Folders to display */
  folders?: AssetFolder[];
  /** Currently selected file IDs */
  selectedIds?: string[];
  /** Called when selection changes */
  onSelectionChange?: (ids: string[]) => void;
  /** Called when a file is clicked (open/view) */
  onFileClick?: (file: AssetFile) => void;
  /** Called when a folder is clicked (navigate) */
  onFolderClick?: (folder: AssetFolder) => void;
  /** Called when files are dropped */
  onFilesDropped?: (files: File[]) => void;
  /** Initial view mode */
  defaultViewMode?: ViewMode;
  /** Initial card size */
  defaultCardSize?: CardSize;
  /** Loading state */
  isLoading?: boolean;
}

export interface AssetGridProps {
  files: AssetFile[];
  folders?: AssetFolder[];
  cardSize: CardSize;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onFileClick?: (file: AssetFile) => void;
  onFolderClick?: (folder: AssetFolder) => void;
  /** Callback to load more items (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether more items are available */
  hasMore?: boolean;
  /** Whether currently loading more items */
  isLoadingMore?: boolean;
}

export interface AssetListProps {
  files: AssetFile[];
  folders?: AssetFolder[];
  selectedIds?: string[];
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSelectionChange?: (ids: string[]) => void;
  onSort?: (field: string) => void;
  onFileClick?: (file: AssetFile) => void;
  onFolderClick?: (folder: AssetFolder) => void;
  /** Callback to load more items (infinite scroll) */
  onLoadMore?: () => void;
  /** Whether more items are available */
  hasMore?: boolean;
  /** Whether currently loading more items */
  isLoadingMore?: boolean;
}

export interface ViewControlsProps {
  viewMode: ViewMode;
  cardSize: CardSize;
  onViewModeChange: (mode: ViewMode) => void;
  onCardSizeChange: (size: CardSize) => void;
}

export const CARD_SIZE_DIMENSIONS: Record<CardSize, { width: number; height: number; thumbnailHeight: number }> = {
  small: { width: 160, height: 160, thumbnailHeight: 100 },
  medium: { width: 220, height: 200, thumbnailHeight: 140 },
  large: { width: 300, height: 260, thumbnailHeight: 180 },
};
