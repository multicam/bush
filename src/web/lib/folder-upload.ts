/**
 * Bush Platform - Folder Upload Utilities
 *
 * Utilities for preserving folder structure during uploads.
 * Parses webkitRelativePath to create folder hierarchy.
 *
 * Reference: IMPLEMENTATION_PLAN.md 2.1 [P2] Folder Structure Preservation
 */

import { foldersApi, type FolderAttributes } from "./api";
import type { JsonApiSingleResponse } from "./api";

/**
 * Represents a file with its relative path for folder-preserving uploads
 */
export interface FileWithPath {
  file: File;
  relativePath?: string;
}

/**
 * Folder cache entry
 */
interface CachedFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string; // Full path from root
}

/**
 * Manages folder creation during folder uploads
 *
 * Caches created folders to avoid redundant API calls and
 * creates the folder hierarchy on-demand as files are uploaded.
 */
export class FolderUploadManager {
  private projectId: string;
  private rootFolderId: string | null;
  private folderCache: Map<string, CachedFolder> = new Map();
  private pendingCreations: Map<string, Promise<CachedFolder>> = new Map();

  constructor(projectId: string, rootFolderId?: string) {
    this.projectId = projectId;
    this.rootFolderId = rootFolderId || null;
  }

  /**
   * Get or create a folder at the specified path
   *
   * @param relativePath - Path like "folder/subfolder/filename.ext" or just "filename.ext"
   * @returns The folder ID to upload the file to, or rootFolderId/root
   */
  async getFolderForPath(relativePath: string): Promise<string | null> {
    // If no path or just a filename, return root
    if (!relativePath || !relativePath.includes("/")) {
      return this.rootFolderId;
    }

    // Extract folder path (everything except filename)
    const pathParts = relativePath.split("/");
    const folderPath = pathParts.slice(0, -1).join("/");

    // Check cache first
    const cached = this.folderCache.get(folderPath);
    if (cached) {
      return cached.id;
    }

    // Check if creation is already in progress
    const pending = this.pendingCreations.get(folderPath);
    if (pending) {
      const folder = await pending;
      return folder.id;
    }

    // Create the folder hierarchy
    const creationPromise = this.createFolderHierarchy(folderPath);
    this.pendingCreations.set(folderPath, creationPromise);

    try {
      const folder = await creationPromise;
      return folder.id;
    } finally {
      this.pendingCreations.delete(folderPath);
    }
  }

  /**
   * Create the full folder hierarchy for a path
   */
  private async createFolderHierarchy(folderPath: string): Promise<CachedFolder> {
    const parts = folderPath.split("/");
    let currentPath = "";
    let currentParentId: string | null = this.rootFolderId;
    let currentFolder: CachedFolder | null = null;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Check cache
      const cached = this.folderCache.get(currentPath);
      if (cached) {
        currentFolder = cached;
        currentParentId = cached.id;
        continue;
      }

      // Create folder
      const folder = await this.createFolder(part, currentParentId);
      this.folderCache.set(currentPath, folder);
      currentFolder = folder;
      currentParentId = folder.id;
    }

    if (!currentFolder) {
      throw new Error(`Failed to create folder hierarchy for ${folderPath}`);
    }

    return currentFolder;
  }

  /**
   * Create a single folder
   */
  private async createFolder(name: string, parentId: string | null): Promise<CachedFolder> {
    let response: JsonApiSingleResponse<FolderAttributes>;

    if (parentId) {
      // Create subfolder
      response = await foldersApi.createSubfolder(parentId, { name });
    } else {
      // Create root-level folder
      response = await foldersApi.create(this.projectId, { name });
    }

    const folder: CachedFolder = {
      id: response.data.id,
      name: response.data.attributes.name,
      parentId,
      path: parentId
        ? `${(await this.getFolderPath(parentId)) || ""}/${name}`
        : name,
    };

    return folder;
  }

  /**
   * Get the path of a cached folder by ID
   */
  private async getFolderPath(folderId: string): Promise<string | null> {
    for (const folder of this.folderCache.values()) {
      if (folder.id === folderId) {
        return folder.path;
      }
    }
    return null;
  }

  /**
   * Clear the folder cache
   */
  clearCache(): void {
    this.folderCache.clear();
    this.pendingCreations.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { cachedFolders: number; pendingCreations: number } {
    return {
      cachedFolders: this.folderCache.size,
      pendingCreations: this.pendingCreations.size,
    };
  }
}

/**
 * Parse files with relative paths and group by folder
 *
 * @param files - Files with optional relative paths
 * @returns Map of folder paths to files
 */
export function groupFilesByFolder(
  files: FileWithPath[]
): Map<string, FileWithPath[]> {
  const groups = new Map<string, FileWithPath[]>();

  for (const fileWithPath of files) {
    const { relativePath } = fileWithPath;

    if (!relativePath || !relativePath.includes("/")) {
      // Root level file
      const root = groups.get("") || [];
      root.push(fileWithPath);
      groups.set("", root);
    } else {
      // File in a folder
      const parts = relativePath.split("/");
      const folderPath = parts.slice(0, -1).join("/");

      const folder = groups.get(folderPath) || [];
      folder.push(fileWithPath);
      groups.set(folderPath, folder);
    }
  }

  return groups;
}

/**
 * Extract unique folder paths from files
 *
 * @param files - Files with optional relative paths
 * @returns Array of unique folder paths, sorted by depth (shallow first)
 */
export function extractFolderPaths(files: FileWithPath[]): string[] {
  const folderPaths = new Set<string>();

  for (const file of files) {
    const { relativePath } = file;
    if (relativePath && relativePath.includes("/")) {
      const parts = relativePath.split("/");
      // Add all parent folders
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        folderPaths.add(currentPath);
      }
    }
  }

  // Sort by depth (shallowest first)
  return Array.from(folderPaths).sort((a, b) => {
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    return depthA - depthB;
  });
}

/**
 * Check if any files have folder structure
 */
export function hasFolderStructure(files: FileWithPath[]): boolean {
  return files.some((f) => f.relativePath && f.relativePath.includes("/"));
}

/**
 * Get a summary of the folder structure for display
 */
export function getFolderStructureSummary(files: FileWithPath[]): {
  totalFiles: number;
  filesInFolders: number;
  folderCount: number;
  topLevelFolders: string[];
} {
  const folderPaths = new Set<string>();
  const topLevelFolders = new Set<string>();
  let filesInFolders = 0;

  for (const file of files) {
    const { relativePath } = file;
    if (relativePath && relativePath.includes("/")) {
      filesInFolders++;
      const parts = relativePath.split("/");
      topLevelFolders.add(parts[0]);

      // Add all parent folders
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        folderPaths.add(currentPath);
      }
    }
  }

  return {
    totalFiles: files.length,
    filesInFolders,
    folderCount: folderPaths.size,
    topLevelFolders: Array.from(topLevelFolders).sort(),
  };
}
