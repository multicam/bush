/**
 * Bush Platform - Share Types
 *
 * Type definitions for share components.
 */

import type {
  ShareAttributes,
  ShareBranding,
  ShareLayout,
  FileAttributes,
  ShareActivityAttributes,
} from "@/web/lib/api";

/**
 * Share with computed fields
 */
export interface Share extends ShareAttributes {
  id: string;
}

/**
 * Share with included relationships
 */
export interface ShareWithRelationships extends Share {
  created_by?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
  project?: {
    id: string;
    name: string;
  };
}

/**
 * Asset in a share
 */
export interface ShareAsset {
  id: string;
  fileId: string;
  sortOrder: number;
  file?: FileAttributes;
}

/**
 * Activity entry for display
 */
export interface ShareActivityEntry extends ShareActivityAttributes {
  id: string;
}

/**
 * Share form state for create/edit
 */
export interface ShareFormData {
  name: string;
  project_id: string | null;
  file_ids: string[];
  passphrase: string | null;
  expires_at: string | null;
  layout: ShareLayout;
  allow_comments: boolean;
  allow_downloads: boolean;
  show_all_versions: boolean;
  show_transcription: boolean;
  featured_field: string | null;
  branding: ShareBranding;
}

/**
 * Default share form data
 */
export const DEFAULT_SHARE_FORM: ShareFormData = {
  name: "",
  project_id: null,
  file_ids: [],
  passphrase: null,
  expires_at: null,
  layout: "grid",
  allow_comments: true,
  allow_downloads: false,
  show_all_versions: false,
  show_transcription: false,
  featured_field: null,
  branding: {},
};

/**
 * Share list item props
 */
export interface ShareListItemProps {
  share: ShareWithRelationships;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Share builder props
 */
export interface ShareBuilderProps {
  shareId?: string;
  accountId: string;
  projectId?: string;
  initialFileIds?: string[];
  onSave?: (share: Share) => void;
  onCancel?: () => void;
}

/**
 * Share preview props
 */
export interface SharePreviewProps {
  share: Share;
  assets: ShareAsset[];
}

/**
 * Branding editor props
 */
export interface BrandingEditorProps {
  branding: ShareBranding;
  onChange: (branding: ShareBranding) => void;
}

/**
 * Asset picker props
 */
export interface ShareAssetPickerProps {
  accountId: string;
  projectId?: string;
  selectedFileIds: string[];
  onSelectionChange: (fileIds: string[]) => void;
}

/**
 * Activity feed props
 */
export interface ShareActivityFeedProps {
  shareId: string;
  limit?: number;
}

/**
 * Layout option
 */
export interface LayoutOption {
  value: ShareLayout;
  label: string;
  description: string;
  icon: string;
}

/**
 * Available layout options
 */
export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    value: "grid",
    label: "Grid",
    description: "Display assets in a thumbnail grid",
    icon: "▦",
  },
  {
    value: "reel",
    label: "Reel",
    description: "Scroll through assets sequentially",
    icon: "▤",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Full viewer with sidebar navigation",
    icon: "▣",
  },
];
