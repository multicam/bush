/**
 * Bush Platform - Collections Page
 *
 * Shows all collections for a project.
 * Reference: IMPLEMENTATION_PLAN.md 3.2 Collections
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/web/components/layout";
import { Button, Input, Badge } from "@/web/components/ui";
import { useAuth } from "@/web/context";
import {
  collectionsApi,
  extractCollectionList,
  getErrorMessage,
  type CollectionAttributes,
  type CollectionType,
} from "@/web/lib/api";

interface Collection extends CollectionAttributes {
  id: string;
}

type LoadingState = "loading" | "error" | "loaded";

export default function CollectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string>("");
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();

  // Unwrap the params Promise
  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Create collection modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionType, setNewCollectionType] = useState<CollectionType>("team");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    if (!projectId) return;

    setLoadingState("loading");
    setErrorMessage("");

    try {
      const response = await collectionsApi.list(projectId, { limit: 100 });
      const collectionList = extractCollectionList(response);
      setCollections(collectionList as Collection[]);
      setLoadingState("loaded");
    } catch (error) {
      console.error("Failed to fetch collections:", error);
      setErrorMessage(getErrorMessage(error));
      setLoadingState("error");
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && isAuthenticated) {
      fetchCollections();
    }
  }, [projectId, isAuthenticated, fetchCollections]);

  // Auth loading
  useEffect(() => {
    if (!authLoading && !isAuthenticated && projectId) {
      login(window.location.pathname);
    }
  }, [authLoading, isAuthenticated, projectId, login]);

  // Handle create collection
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newCollectionName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      const response = await collectionsApi.create(projectId, {
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim() || undefined,
        type: newCollectionType,
      });
      const newCollection = extractCollectionList({ data: [response.data], links: {}, meta: { total_count: 1, page_size: 1, has_more: false } })[0];
      setCollections((prev) => [newCollection as Collection, ...prev]);
      setShowCreateModal(false);
      setNewCollectionName("");
      setNewCollectionDescription("");
      setNewCollectionType("team");
    } catch (error) {
      console.error("Failed to create collection:", error);
      setCreateError(getErrorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle delete collection
  const handleDeleteCollection = async (collectionId: string, collectionName: string) => {
    if (!confirm(`Are you sure you want to delete "${collectionName}"?`)) {
      return;
    }

    try {
      await collectionsApi.delete(collectionId);
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
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

  // Loading state
  if (!projectId || authLoading || loadingState === "loading") {
    return (
      <AppLayout>
        <div className="p-8 max-w-[80rem] mx-auto sm:p-4">
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
            <p className="text-secondary">Loading collections...</p>
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
            <h2 className="text-lg text-primary m-0 mb-2">Failed to load collections</h2>
            <p className="text-secondary mb-4">{errorMessage}</p>
            <Button variant="primary" onClick={fetchCollections}>
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
        <div className="flex justify-between items-start mb-8 sm:flex-col sm:gap-4">
          <div>
            <h1 className="text-[1.875rem] font-bold text-primary m-0 mb-1">Collections</h1>
            <p className="text-sm text-secondary m-0">
              Organize assets into saved collections for easy access
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)} className="sm:w-full">
            New Collection
          </Button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-100"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-surface-2 rounded-lg p-6 w-full max-w-md shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-primary m-0 mb-5">Create New Collection</h2>
              <form onSubmit={handleCreateCollection}>
                <div className="mb-4">
                  <Input
                    label="Name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-border-default rounded bg-surface-1 text-primary resize-y font-inherit focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent/10"
                    value={newCollectionDescription}
                    onChange={(e) => setNewCollectionDescription(e.target.value)}
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
                        checked={newCollectionType === "team"}
                        onChange={() => setNewCollectionType("team")}
                        className="mt-0.5"
                      />
                      <span className="font-medium text-primary">Team</span>
                      <span className="block text-xs text-secondary ml-5">Visible to all project members</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-3 bg-surface-1 border border-border-default rounded hover:border-accent transition-colors">
                      <input
                        type="radio"
                        name="collectionType"
                        value="private"
                        checked={newCollectionType === "private"}
                        onChange={() => setNewCollectionType("private")}
                        className="mt-0.5"
                      />
                      <span className="font-medium text-primary">Private</span>
                      <span className="block text-xs text-secondary ml-5">Only visible to you</span>
                    </label>
                  </div>
                </div>
                {createError && (
                  <p className="text-sm text-red-500 mb-4">{createError}</p>
                )}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-default">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={createLoading || !newCollectionName.trim()}
                  >
                    {createLoading ? "Creating..." : "Create Collection"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Collections Grid */}
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center text-secondary">
            <p className="text-lg text-primary mb-2">No collections yet.</p>
            <p className="max-w-96 mb-6">
              Create your first collection to organize and save assets for quick access.
            </p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              Create Collection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="bg-surface-2 border border-border-default rounded-lg p-5 transition-shadow hover:shadow-md hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-primary m-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {collection.name}
                  </h3>
                  <Badge variant={collection.type === "team" ? "primary" : "default"}>
                    {collection.type}
                  </Badge>
                </div>
                {collection.description && (
                  <p className="text-sm text-secondary m-0 mb-3 line-clamp-2">
                    {collection.description}
                  </p>
                )}
                <div className="flex flex-col gap-0.5 mb-4">
                  <span className="text-sm font-medium text-primary">
                    {collection.assetCount} asset{collection.assetCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-tertiary">
                    by {getCreatorName(collection.creator)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = `/projects/${projectId}/collections/${collection.id}`;
                    }}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCollection(collection.id, collection.name)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
