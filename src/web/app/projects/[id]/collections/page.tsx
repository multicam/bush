/**
 * Bush Platform - Collections Page
 *
 * Shows all collections for a project.
 * Reference: IMPLEMENTATION_PLAN.md 3.2 Collections
 */
"use client";

import { useState, useEffect, useCallback } from "react";
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
import styles from "./collections.module.css";

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
        <div className={styles.page}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading collections...</p>
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
            <h2>Failed to load collections</h2>
            <p>{errorMessage}</p>
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
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Collections</h1>
            <p className={styles.subtitle}>
              Organize assets into saved collections for easy access
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            New Collection
          </Button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Create New Collection</h2>
              <form onSubmit={handleCreateCollection}>
                <div className={styles.formGroup}>
                  <Input
                    label="Name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Description (optional)</label>
                  <textarea
                    className={styles.textarea}
                    value={newCollectionDescription}
                    onChange={(e) => setNewCollectionDescription(e.target.value)}
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
                        checked={newCollectionType === "team"}
                        onChange={() => setNewCollectionType("team")}
                      />
                      <span>Team</span>
                      <span className={styles.radioDescription}>Visible to all project members</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="collectionType"
                        value="private"
                        checked={newCollectionType === "private"}
                        onChange={() => setNewCollectionType("private")}
                      />
                      <span>Private</span>
                      <span className={styles.radioDescription}>Only visible to you</span>
                    </label>
                  </div>
                </div>
                {createError && <p className={styles.error}>{createError}</p>}
                <div className={styles.modalActions}>
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
          <div className={styles.emptyState}>
            <p>No collections yet.</p>
            <p className={styles.emptyDescription}>
              Create your first collection to organize and save assets for quick access.
            </p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              Create Collection
            </Button>
          </div>
        ) : (
          <div className={styles.grid}>
            {collections.map((collection) => (
              <div key={collection.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{collection.name}</h3>
                  <Badge variant={collection.type === "team" ? "primary" : "default"}>
                    {collection.type}
                  </Badge>
                </div>
                {collection.description && (
                  <p className={styles.cardDescription}>{collection.description}</p>
                )}
                <div className={styles.cardMeta}>
                  <span className={styles.assetCount}>
                    {collection.assetCount} asset{collection.assetCount !== 1 ? "s" : ""}
                  </span>
                  <span className={styles.creator}>
                    by {getCreatorName(collection.creator)}
                  </span>
                </div>
                <div className={styles.cardActions}>
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
