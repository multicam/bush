/**
 * Bush Platform - Collection Detail Page
 *
 * Shows a single collection with its assets.
 * Reference: IMPLEMENTATION_PLAN.md 3.2 Collections
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Input, Badge } from "@/web/components/ui";
import { AssetBrowser, type AssetFile } from "@/web/components/asset-browser";
import { useAuth } from "@/web/context";
import {
  collectionsApi,
  getErrorMessage,
  type CollectionAttributes,
  type CollectionAssetAttributes,
  type CollectionType,
} from "@/web/lib/api";
import styles from "./collection.module.css";

interface Collection extends CollectionAttributes {
  id: string;
}

interface Asset extends CollectionAssetAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string; collectionId: string }>;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [collectionId, setCollectionId] = useState<string>("");
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();

  // Unwrap the params Promise
  useEffect(() => {
    params.then((p) => {
      setProjectId(p.id);
      setCollectionId(p.collectionId);
    });
  }, [params]);

  const [collection, setCollection] = useState<Collection | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<CollectionType>("team");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Selection state
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // Fetch collection
  const fetchCollection = useCallback(async () => {
    if (!collectionId) return;

    setLoadingState("loading");
    setErrorMessage("");

    try {
      const response = await collectionsApi.get(collectionId, { limit: 200 });
      const collectionData = response.data.attributes;
      setCollection({
        id: response.data.id,
        ...collectionData,
      });
      setEditName(collectionData.name);
      setEditDescription(collectionData.description || "");
      setEditType(collectionData.type);

      // Extract assets from included
      const assetList = (response.included || []).map((item) => ({
        id: item.id,
        ...item.attributes,
      }));
      setAssets(assetList as Asset[]);
      setLoadingState("loaded");
    } catch (error) {
      console.error("Failed to fetch collection:", error);
      setErrorMessage(getErrorMessage(error));
      setLoadingState("error");
    }
  }, [collectionId]);

  useEffect(() => {
    if (collectionId && isAuthenticated) {
      fetchCollection();
    }
  }, [collectionId, isAuthenticated, fetchCollection]);

  // Auth loading
  useEffect(() => {
    if (!authLoading && !isAuthenticated && projectId) {
      login(window.location.pathname);
    }
  }, [authLoading, isAuthenticated, projectId, login]);

  // Handle update collection
  const handleUpdateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionId || !editName.trim()) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const response = await collectionsApi.update(collectionId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        type: editType,
      });
      setCollection((prev) =>
        prev ? { ...prev, name: response.data.attributes.name, description: response.data.attributes.description, type: response.data.attributes.type } : null
      );
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update collection:", error);
      setEditError(getErrorMessage(error));
    } finally {
      setEditLoading(false);
    }
  };

  // Handle remove assets
  const handleRemoveSelected = async () => {
    if (!collectionId || selectedAssetIds.length === 0) return;

    if (!confirm(`Remove ${selectedAssetIds.length} asset(s) from this collection?`)) {
      return;
    }

    try {
      // Remove each selected asset
      for (const assetId of selectedAssetIds) {
        await collectionsApi.removeItem(collectionId, assetId);
      }
      setAssets((prev) => prev.filter((a) => !selectedAssetIds.includes(a.id)));
      setSelectedAssetIds([]);
    } catch (error) {
      console.error("Failed to remove assets:", error);
      alert(getErrorMessage(error));
    }
  };

  // Handle delete collection
  const handleDeleteCollection = async () => {
    if (!collectionId || !collection) return;

    if (!confirm(`Are you sure you want to delete "${collection.name}"?`)) {
      return;
    }

    try {
      await collectionsApi.delete(collectionId);
      window.location.href = `/projects/${projectId}/collections`;
    } catch (error) {
      console.error("Failed to delete collection:", error);
      alert(getErrorMessage(error));
    }
  };

  // Get creator display name
  const getCreatorName = (creator: CollectionAttributes["creator"]) => {
    if (creator.firstName && creator.lastName) {
      return `${creator.firstName} ${creator.lastName}`;
    }
    return creator.email;
  };

  // Convert assets to AssetFile format
  const assetFiles: AssetFile[] = assets.map((a) => ({
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    fileSizeBytes: a.fileSizeBytes,
    status: a.status as AssetFile["status"],
    thumbnailUrl: null,
    createdAt: a.createdAt,
    updatedAt: a.createdAt,
  }));

  // Loading state
  if (!projectId || !collectionId || authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading collection...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.error}>
            <h2>Failed to load collection</h2>
            <p>{errorMessage}</p>
            <Button variant="primary" onClick={fetchCollection}>
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.breadcrumb}>
              <a href={`/projects/${projectId}/collections`}>Collections</a>
              <span>/</span>
              <span>{collection?.name}</span>
            </div>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{collection?.name}</h1>
              <Badge variant={collection?.type === "team" ? "primary" : "default"}>
                {collection?.type}
              </Badge>
            </div>
            {collection?.description && (
              <p className={styles.description}>{collection.description}</p>
            )}
            <div className={styles.meta}>
              <span>{collection?.assetCount} asset{collection?.assetCount !== 1 ? "s" : ""}</span>
              <span>Created by {collection && getCreatorName(collection.creator)}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setShowEditModal(true)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={handleDeleteCollection}>
              Delete
            </Button>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Edit Collection</h2>
              <form onSubmit={handleUpdateCollection}>
                <div className={styles.formGroup}>
                  <Input
                    label="Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Collection name"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Description (optional)</label>
                  <textarea
                    className={styles.textarea}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Describe this collection"
                    rows={3}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Visibility</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="collectionType"
                        value="team"
                        checked={editType === "team"}
                        onChange={() => setEditType("team")}
                      />
                      <span>Team</span>
                      <span className={styles.radioDescription}>Visible to all project members</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="collectionType"
                        value="private"
                        checked={editType === "private"}
                        onChange={() => setEditType("private")}
                      />
                      <span>Private</span>
                      <span className={styles.radioDescription}>Only visible to you</span>
                    </label>
                  </div>
                </div>
                {editError && <p className={styles.error}>{editError}</p>}
                <div className={styles.modalActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={editLoading || !editName.trim()}
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedAssetIds.length > 0 && (
          <div className={styles.bulkActions}>
            <span>{selectedAssetIds.length} selected</span>
            <Button variant="secondary" size="sm" onClick={handleRemoveSelected}>
              Remove from Collection
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAssetIds([])}>
              Clear Selection
            </Button>
          </div>
        )}

        {/* Asset Browser */}
        {assets.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No assets in this collection.</p>
            <p className={styles.emptyDescription}>
              Add assets to this collection from the project file browser.
            </p>
          </div>
        ) : (
          <section className={styles.browserSection}>
            <AssetBrowser
              projectId={projectId}
              files={assetFiles}
              selectedIds={selectedAssetIds}
              onSelectionChange={setSelectedAssetIds}
              onFileClick={(file) => {
                // TODO: Open file viewer
                console.log("File clicked:", file);
              }}
              defaultViewMode="grid"
              defaultCardSize="medium"
            />
          </section>
        )}
      </div>
    </AppLayout>
  );
}
