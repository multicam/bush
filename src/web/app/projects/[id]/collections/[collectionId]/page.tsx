/**
 * Bush Platform - Collection Detail Page
 *
 * Shows a single collection with its assets.
 * Reference: IMPLEMENTATION_PLAN.md 3.2 Collections
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/web/components/layout";
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
  Field,
  Label,
} from "@/web/components/ui";
import { SpinnerIcon } from "@/web/lib/icons";
import { AssetBrowser, type AssetFile } from "@/web/components/asset-browser";
import { useAuth } from "@/web/context";
import {
  collectionsApi,
  getErrorMessage,
  type CollectionAttributes,
  type CollectionAssetAttributes,
  type CollectionType,
} from "@/web/lib/api";

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
        prev
          ? {
              ...prev,
              name: response.data.attributes.name,
              description: response.data.attributes.description,
              type: response.data.attributes.type,
            }
          : null
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
        <div className="p-8 max-w-[80rem] mx-auto sm:p-4">
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <SpinnerIcon className="w-8 h-8 text-accent mb-4" />
            <p className="text-secondary">Loading collection...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (loadingState === "error") {
    return (
      <AppLayout>
        <div className="p-8 max-w-[80rem] mx-auto sm:p-4">
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <h2 className="text-lg text-primary m-0 mb-2">Failed to load collection</h2>
            <p className="text-secondary mb-4">{errorMessage}</p>
            <Button color="bush" onClick={fetchCollection}>
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-[80rem] mx-auto sm:p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 sm:flex-col sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-secondary mb-2">
              <a
                href={`/projects/${projectId}/collections`}
                className="text-accent hover:underline no-underline"
              >
                Collections
              </a>
              <span>/</span>
              <span>{collection?.name}</span>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-primary m-0">{collection?.name}</h1>
              <Badge color={collection?.type === "team" ? "blue" : "zinc"}>
                {collection?.type}
              </Badge>
            </div>
            {collection?.description && (
              <p className="text-sm text-secondary m-0 mb-2">{collection.description}</p>
            )}
            <div className="flex gap-4 text-xs text-secondary sm:flex-col sm:gap-1">
              <span>
                {collection?.assetCount} asset{collection?.assetCount !== 1 ? "s" : ""}
              </span>
              <span>Created by {collection && getCreatorName(collection.creator)}</span>
            </div>
          </div>
          <div className="flex gap-2 ml-4 sm:ml-0">
            <Button outline onClick={() => setShowEditModal(true)}>
              Edit
            </Button>
            <Button plain onClick={handleDeleteCollection}>
              Delete
            </Button>
          </div>
        </div>

        {/* Edit Modal */}
        <Dialog open={showEditModal} onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleUpdateCollection}>
            <DialogTitle>Edit Collection</DialogTitle>
            <DialogBody>
              <div className="mb-4">
                <Field>
                  <Label>Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Collection name"
                    required
                  />
                </Field>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-primary mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-border-default rounded bg-surface-1 text-primary resize-y font-inherit focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent/10"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe this collection"
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-primary mb-1.5">Visibility</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-2 cursor-pointer p-3 bg-surface-1 border border-border-default rounded hover:border-accent transition-colors">
                    <input
                      type="radio"
                      name="collectionType"
                      value="team"
                      checked={editType === "team"}
                      onChange={() => setEditType("team")}
                      className="mt-0.5"
                    />
                    <span className="font-medium text-primary">Team</span>
                    <span className="block text-xs text-secondary ml-5">
                      Visible to all project members
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer p-3 bg-surface-1 border border-border-default rounded hover:border-accent transition-colors">
                    <input
                      type="radio"
                      name="collectionType"
                      value="private"
                      checked={editType === "private"}
                      onChange={() => setEditType("private")}
                      className="mt-0.5"
                    />
                    <span className="font-medium text-primary">Private</span>
                    <span className="block text-xs text-secondary ml-5">Only visible to you</span>
                  </label>
                </div>
              </div>
              {editError && <p className="text-sm text-red-600 mt-4">{editError}</p>}
            </DialogBody>
            <DialogActions>
              <Button type="button" outline onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" color="bush" disabled={editLoading || !editName.trim()}>
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Bulk Actions */}
        {selectedAssetIds.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-surface-3 border border-border-default rounded mb-4 text-sm text-secondary">
            <span>{selectedAssetIds.length} selected</span>
            <Button outline onClick={handleRemoveSelected}>
              Remove from Collection
            </Button>
            <Button plain onClick={() => setSelectedAssetIds([])}>
              Clear Selection
            </Button>
          </div>
        )}

        {/* Asset Browser */}
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center text-secondary bg-surface-2 border border-dashed border-border-default rounded-lg">
            <p className="text-base text-primary mb-2">No assets in this collection.</p>
            <p className="max-w-96">Add assets to this collection from the project file browser.</p>
          </div>
        ) : (
          <section className="mt-4">
            <AssetBrowser
              projectId={projectId}
              files={assetFiles}
              selectedIds={selectedAssetIds}
              onSelectionChange={setSelectedAssetIds}
              onFileClick={(file) => {
                // Navigate to file viewer page
                window.location.href = `/projects/${projectId}/files/${file.id}`;
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
