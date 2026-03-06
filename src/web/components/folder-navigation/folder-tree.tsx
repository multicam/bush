/**
 * Bush Platform - Folder Tree Component
 *
 * Tree view for folder navigation sidebar.
 * Reference: IMPLEMENTATION_PLAN.md 2.3 [P1] Folder Navigation
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronRightIcon, FolderIcon, HomeSmallIcon } from "@/web/lib/icons";
import { foldersApi, extractCollectionAttributes, getErrorMessage } from "@/web/lib/api";
import type { FolderAttributes } from "@/web/lib/api";

export interface FolderTreeItem extends FolderAttributes {
  id: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface FolderTreeProps {
  /** Project ID to load folders from */
  projectId: string;
  /** Currently selected folder ID (null for root) */
  selectedFolderId?: string | null;
  /** Called when a folder is selected */
  onSelect?: (folderId: string | null) => void;
  /** Called when a folder is expanded/collapsed */
  onExpand?: (folderId: string, isExpanded: boolean) => void;
  /** Initial expanded folder IDs */
  expandedIds?: Set<string>;
  /** Whether to show the root (all files) option */
  showRoot?: boolean;
}

interface FolderNodeProps {
  folder: FolderTreeItem;
  level: number;
  selectedId?: string | null;
  expandedIds: Set<string>;
  onSelect?: (folderId: string) => void;
  onToggle: (folderId: string) => void;
  loadChildren: (parentId: string) => Promise<FolderTreeItem[]>;
  childrenByParent: Map<string, FolderTreeItem[]>;
}

function FolderNode({
  folder,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  loadChildren,
  childrenByParent,
}: FolderNodeProps) {
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedId === folder.id;
  const children = childrenByParent.get(folder.id) || [];
  const hasChildren = folder.hasChildren !== false;

  const handleClick = useCallback(() => {
    onSelect?.(folder.id);
  }, [folder.id, onSelect]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(folder.id);
    },
    [folder.id, onToggle]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      } else if (e.key === "ArrowRight" && !isExpanded && hasChildren) {
        onToggle(folder.id);
      } else if (e.key === "ArrowLeft" && isExpanded) {
        onToggle(folder.id);
      }
    },
    [handleClick, hasChildren, isExpanded, onToggle, folder.id]
  );

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-sm cursor-pointer transition-colors select-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 ${isSelected ? "bg-accent/10 text-accent" : ""}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {hasChildren ? (
          <button
            className={`flex items-center justify-center w-5 h-5 p-0 bg-none border-none rounded-sm text-muted cursor-pointer transition-transform hover:bg-surface-3 ${isExpanded ? "rotate-90" : ""}`}
            onClick={handleToggle}
            type="button"
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            <ChevronRightIcon className="size-3" />
          </button>
        ) : (
          <span className="w-5 h-5" />
        )}
        <span className="flex items-center justify-center text-[#f59e0b] flex-shrink-0">
          <FolderIcon className="size-4" />
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
          {folder.name}
        </span>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="flex flex-col" role="group">
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              loadChildren={loadChildren}
              childrenByParent={childrenByParent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  projectId,
  selectedFolderId,
  onSelect,
  showRoot = true,
}: FolderTreeProps) {
  const [rootFolders, setRootFolders] = useState<FolderTreeItem[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<Map<string, FolderTreeItem[]>>(
    new Map()
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load root folders
  const loadRootFolders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await foldersApi.listRoot(projectId, { limit: 100 });
      const folders = extractCollectionAttributes(response) as FolderTreeItem[];
      setRootFolders(folders);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load children for a folder
  const loadChildren = useCallback(async (parentId: string): Promise<FolderTreeItem[]> => {
    try {
      const response = await foldersApi.getChildren(parentId, { limit: 100 });
      const subfolders = response.data
        .filter((item) => item.type === "folder")
        .map((item) => ({
          id: item.id,
          ...item.attributes,
        })) as FolderTreeItem[];

      setChildrenByParent((prev) => {
        const next = new Map(prev);
        next.set(parentId, subfolders);
        return next;
      });

      return subfolders;
    } catch (err) {
      console.error("Failed to load folder children:", err);
      return [];
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadRootFolders();
  }, [loadRootFolders]);

  // Handle toggle expand/collapse
  const handleToggle = useCallback(
    async (folderId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
          // Load children if not loaded
          if (!childrenByParent.has(folderId)) {
            loadChildren(folderId);
          }
        }
        return next;
      });
    },
    [childrenByParent, loadChildren]
  );

  // Handle folder selection
  const handleSelect = useCallback(
    (folderId: string) => {
      onSelect?.(folderId);
    },
    [onSelect]
  );

  // Handle root selection
  const handleRootSelect = useCallback(() => {
    onSelect?.(null);
  }, [onSelect]);

  if (isLoading && rootFolders.length === 0) {
    return (
      <div className="flex flex-col min-h-0 overflow-y-auto text-sm">
        <div className="p-4 text-center text-muted">Loading folders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-0 overflow-y-auto text-sm">
        <div className="p-4 text-center text-[#ef4444]">{error}</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-0 overflow-y-auto text-sm"
      role="tree"
      aria-label="Folder navigation"
    >
      {showRoot && (
        <div
          className={`flex items-center gap-1 px-2 py-1.5 rounded-sm cursor-pointer transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 ${selectedFolderId === null ? "bg-accent/10 text-accent" : ""}`}
          onClick={handleRootSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRootSelect();
            }
          }}
          role="treeitem"
          tabIndex={0}
          aria-selected={selectedFolderId === null}
        >
          <span className="w-5 h-5" />
          <span className="flex items-center justify-center text-muted flex-shrink-0">
            <HomeSmallIcon className="size-4" />
          </span>
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">All Files</span>
        </div>
      )}

      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          level={0}
          selectedId={selectedFolderId}
          expandedIds={expandedIds}
          onSelect={handleSelect}
          onToggle={handleToggle}
          loadChildren={loadChildren}
          childrenByParent={childrenByParent}
        />
      ))}

      {rootFolders.length === 0 && !showRoot && (
        <div className="p-4 text-center text-muted">No folders</div>
      )}
    </div>
  );
}

export default FolderTree;
