/**
 * Bush Platform - Share Builder Component
 *
 * Full-featured form for creating and editing shares.
 */
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/web/components/ui";
import {
  sharesApi,
  getErrorMessage,
  type ShareBranding,
} from "@/web/lib/api";
import type { Share, ShareFormData, LayoutOption } from "./types";
import { DEFAULT_SHARE_FORM, LAYOUT_OPTIONS } from "./types";
import styles from "./shares.module.css";

interface ShareBuilderProps {
  shareId?: string;
  accountId: string;
  projectId?: string;
  initialFileIds?: string[];
  onSave?: (share: Share) => void;
  onCancel?: () => void;
}

/**
 * Share builder component for creating/editing shares
 */
export function ShareBuilder({
  shareId,
  accountId,
  projectId,
  initialFileIds = [],
  onSave,
  onCancel,
}: ShareBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShareFormData>({
    ...DEFAULT_SHARE_FORM,
    project_id: projectId || null,
    file_ids: initialFileIds,
  });

  // Load existing share data if editing
  useEffect(() => {
    async function loadShare() {
      if (!shareId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await sharesApi.get(shareId);
        const share = response.data.attributes;

        setFormData({
          name: share.name,
          project_id: share.projectId,
          file_ids: [],
          passphrase: share.passphrase,
          expires_at: share.expiresAt ? share.expiresAt.split("T")[0] : null,
          layout: share.layout,
          allow_comments: share.allowComments,
          allow_downloads: share.allowDownloads,
          show_all_versions: share.showAllVersions,
          show_transcription: share.showTranscription,
          featured_field: share.featuredField,
          branding: share.branding || {},
        });

        // Load assets
        const assetsResponse = await sharesApi.listAssets(shareId);
        const fileIds = assetsResponse.data.map((a) => a.attributes.fileId);
        setFormData((prev) => ({ ...prev, file_ids: fileIds }));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    loadShare();
  }, [shareId]);

  /**
   * Handle form field changes
   */
  const handleChange = (field: keyof ShareFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Handle branding changes
   */
  const handleBrandingChange = (field: keyof ShareBranding, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      branding: { ...prev.branding, [field]: value },
    }));
  };

  /**
   * Handle toggle changes
   */
  const handleToggle = (field: keyof ShareFormData) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (shareId) {
        // Update existing share
        await sharesApi.update(shareId, {
          name: formData.name,
          passphrase: formData.passphrase || null,
          expires_at: formData.expires_at || null,
          layout: formData.layout,
          allow_comments: formData.allow_comments,
          allow_downloads: formData.allow_downloads,
          show_all_versions: formData.show_all_versions,
          show_transcription: formData.show_transcription,
          featured_field: formData.featured_field || null,
          branding: formData.branding,
        });

        // Update assets
        const existingAssets = await sharesApi.listAssets(shareId);
        const existingFileIds = existingAssets.data.map((a) => a.attributes.fileId);

        // Remove assets no longer in the list
        for (const asset of existingAssets.data) {
          if (!formData.file_ids.includes(asset.attributes.fileId)) {
            await sharesApi.removeAsset(shareId, asset.id);
          }
        }

        // Add new assets
        const newFileIds = formData.file_ids.filter((id) => !existingFileIds.includes(id));
        if (newFileIds.length > 0) {
          await sharesApi.addAssets(shareId, newFileIds);
        }

        // Fetch updated share
        const response = await sharesApi.get(shareId);
        onSave?.({ id: shareId, ...response.data.attributes } as Share);
      } else {
        // Create new share
        const response = await sharesApi.create(accountId, {
          name: formData.name,
          project_id: formData.project_id || undefined,
          file_ids: formData.file_ids,
          passphrase: formData.passphrase || undefined,
          expires_at: formData.expires_at || undefined,
          layout: formData.layout,
          allow_comments: formData.allow_comments,
          allow_downloads: formData.allow_downloads,
          show_all_versions: formData.show_all_versions,
          show_transcription: formData.show_transcription,
          featured_field: formData.featured_field || undefined,
          branding: formData.branding,
        });

        onSave?.({ id: response.data.id, ...response.data.attributes } as Share);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading share...</p>
      </div>
    );
  }

  return (
    <form className={styles.shareBuilder} onSubmit={handleSubmit}>
      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <div className={styles.builderSection}>
        <h3 className={styles.sectionTitle}>Basic Information</h3>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Share Name *</label>
          <input
            type="text"
            className={styles.formInput}
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter a name for this share"
            required
          />
        </div>
      </div>

      {/* Layout Selection */}
      <div className={styles.builderSection}>
        <h3 className={styles.sectionTitle}>Layout</h3>
        <p className={styles.sectionDescription}>
          Choose how assets will be displayed to viewers
        </p>

        <div className={styles.layoutOptions}>
          {LAYOUT_OPTIONS.map((option: LayoutOption) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.layoutOption} ${formData.layout === option.value ? styles.active : ""}`}
              onClick={() => handleChange("layout", option.value)}
            >
              <span className={styles.layoutOptionIcon}>{option.icon}</span>
              <span className={styles.layoutOptionLabel}>{option.label}</span>
              <span className={styles.layoutOptionDescription}>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Access Settings */}
      <div className={styles.builderSection}>
        <h3 className={styles.sectionTitle}>Access Settings</h3>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Passphrase (optional)</label>
          <input
            type="password"
            className={styles.formInput}
            value={formData.passphrase || ""}
            onChange={(e) => handleChange("passphrase", e.target.value || null)}
            placeholder="Leave empty for public access"
          />
          <span className={styles.formHint}>
            Viewers will need to enter this passphrase to access the share
          </span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Expiration Date (optional)</label>
          <input
            type="date"
            className={styles.formInput}
            value={formData.expires_at || ""}
            onChange={(e) => handleChange("expires_at", e.target.value || null)}
            min={new Date().toISOString().split("T")[0]}
          />
          <span className={styles.formHint}>
            The share will no longer be accessible after this date
          </span>
        </div>
      </div>

      {/* Permissions */}
      <div className={styles.builderSection}>
        <h3 className={styles.sectionTitle}>Permissions</h3>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>Allow Comments</span>
            <span className={styles.toggleHint}>Viewers can leave feedback on assets</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${formData.allow_comments ? styles.active : ""}`}
            onClick={() => handleToggle("allow_comments")}
          >
            <span className={styles.toggleKnob}></span>
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>Allow Downloads</span>
            <span className={styles.toggleHint}>Viewers can download original files</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${formData.allow_downloads ? styles.active : ""}`}
            onClick={() => handleToggle("allow_downloads")}
          >
            <span className={styles.toggleKnob}></span>
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>Show All Versions</span>
            <span className={styles.toggleHint}>Display all versions in version stacks</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${formData.show_all_versions ? styles.active : ""}`}
            onClick={() => handleToggle("show_all_versions")}
          >
            <span className={styles.toggleKnob}></span>
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <span className={styles.toggleLabel}>Show Transcription</span>
            <span className={styles.toggleHint}>Display transcriptions for audio/video</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${formData.show_transcription ? styles.active : ""}`}
            onClick={() => handleToggle("show_transcription")}
          >
            <span className={styles.toggleKnob}></span>
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className={styles.builderSection}>
        <h3 className={styles.sectionTitle}>Branding</h3>
        <p className={styles.sectionDescription}>
          Customize the appearance of your share page
        </p>

        <div className={styles.brandingEditor}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <textarea
              className={`${styles.formInput} ${styles.formTextarea}`}
              value={formData.branding.description || ""}
              onChange={(e) => handleBrandingChange("description", e.target.value || undefined)}
              placeholder="Add a description to display on the share page"
            />
          </div>

          <div className={styles.colorRow}>
            <div className={styles.colorField}>
              <label className={styles.formLabel}>Background Color</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={formData.branding.background_color || "#111111"}
                  onChange={(e) => handleBrandingChange("background_color", e.target.value)}
                />
                <input
                  type="text"
                  className={`${styles.formInput} ${styles.colorText}`}
                  value={formData.branding.background_color || "#111111"}
                  onChange={(e) => handleBrandingChange("background_color", e.target.value)}
                />
              </div>
            </div>

            <div className={styles.colorField}>
              <label className={styles.formLabel}>Accent Color</label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={formData.branding.accent_color || "#4f46e5"}
                  onChange={(e) => handleBrandingChange("accent_color", e.target.value)}
                />
                <input
                  type="text"
                  className={`${styles.formInput} ${styles.colorText}`}
                  value={formData.branding.accent_color || "#4f46e5"}
                  onChange={(e) => handleBrandingChange("accent_color", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Logo URL</label>
            <input
              type="url"
              className={styles.formInput}
              value={formData.branding.logo_url || ""}
              onChange={(e) => handleBrandingChange("logo_url", e.target.value || undefined)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>Dark Mode</span>
              <span className={styles.toggleHint}>Use dark theme for share page</span>
            </div>
            <button
              type="button"
              className={`${styles.toggle} ${formData.branding.dark_mode !== false ? styles.active : ""}`}
              onClick={() => handleBrandingChange("dark_mode", formData.branding.dark_mode === false ? true : false)}
            >
              <span className={styles.toggleKnob}></span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.builderSection}>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button variant="primary" type="submit" disabled={saving || !formData.name.trim()}>
            {saving ? "Saving..." : shareId ? "Update Share" : "Create Share"}
          </Button>
        </div>
      </div>
    </form>
  );
}
