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
      <div className="flex flex-col items-center justify-center p-16">
        <div className="w-10 h-10 border-3 border-border-default border-t-accent rounded-full animate-spin"></div>
        <p className="mt-4 text-secondary">Loading share...</p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {error && (
        <div className="flex flex-col items-center p-16 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary">Basic Information</h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-primary">Share Name *</label>
          <input
            type="text"
            className="px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter a name for this share"
            required
          />
        </div>
      </div>

      {/* Layout Selection */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary">Layout</h3>
        <p className="text-[13px] text-secondary">
          Choose how assets will be displayed to viewers
        </p>

        <div className="grid grid-cols-3 gap-3">
          {LAYOUT_OPTIONS.map((option: LayoutOption) => (
            <button
              key={option.value}
              type="button"
              className={`flex flex-col items-center gap-2 p-4 bg-surface-1 border-2 rounded-md cursor-pointer transition-colors ${
                formData.layout === option.value
                  ? "border-accent bg-accent/10"
                  : "border-border-default hover:border-accent/70"
              }`}
              onClick={() => handleChange("layout", option.value)}
            >
              <span className="text-3xl">{option.icon}</span>
              <span className="text-sm font-semibold text-primary">{option.label}</span>
              <span className="text-[11px] text-secondary text-center">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Access Settings */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary">Access Settings</h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-primary">Passphrase (optional)</label>
          <input
            type="password"
            className="px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60"
            value={formData.passphrase || ""}
            onChange={(e) => handleChange("passphrase", e.target.value || null)}
            placeholder="Leave empty for public access"
          />
          <span className="text-xs text-secondary/80">
            Viewers will need to enter this passphrase to access the share
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-primary">Expiration Date (optional)</label>
          <input
            type="date"
            className="px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60"
            value={formData.expires_at || ""}
            onChange={(e) => handleChange("expires_at", e.target.value || null)}
            min={new Date().toISOString().split("T")[0]}
          />
          <span className="text-xs text-secondary/80">
            The share will no longer be accessible after this date
          </span>
        </div>
      </div>

      {/* Permissions */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary">Permissions</h3>

        <div className="flex justify-between items-center p-3 bg-surface-1 rounded-md">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-primary">Allow Comments</span>
            <span className="text-xs text-secondary">Viewers can leave feedback on assets</span>
          </div>
          <button
            type="button"
            className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
              formData.allow_comments ? "bg-accent" : "bg-border-default"
            }`}
            onClick={() => handleToggle("allow_comments")}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              formData.allow_comments ? "translate-x-5" : ""
            }`}></span>
          </button>
        </div>

        <div className="flex justify-between items-center p-3 bg-surface-1 rounded-md">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-primary">Allow Downloads</span>
            <span className="text-xs text-secondary">Viewers can download original files</span>
          </div>
          <button
            type="button"
            className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
              formData.allow_downloads ? "bg-accent" : "bg-border-default"
            }`}
            onClick={() => handleToggle("allow_downloads")}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              formData.allow_downloads ? "translate-x-5" : ""
            }`}></span>
          </button>
        </div>

        <div className="flex justify-between items-center p-3 bg-surface-1 rounded-md">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-primary">Show All Versions</span>
            <span className="text-xs text-secondary">Display all versions in version stacks</span>
          </div>
          <button
            type="button"
            className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
              formData.show_all_versions ? "bg-accent" : "bg-border-default"
            }`}
            onClick={() => handleToggle("show_all_versions")}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              formData.show_all_versions ? "translate-x-5" : ""
            }`}></span>
          </button>
        </div>

        <div className="flex justify-between items-center p-3 bg-surface-1 rounded-md">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-primary">Show Transcription</span>
            <span className="text-xs text-secondary">Display transcriptions for audio/video</span>
          </div>
          <button
            type="button"
            className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
              formData.show_transcription ? "bg-accent" : "bg-border-default"
            }`}
            onClick={() => handleToggle("show_transcription")}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              formData.show_transcription ? "translate-x-5" : ""
            }`}></span>
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary">Branding</h3>
        <p className="text-[13px] text-secondary">
          Customize the appearance of your share page
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-primary">Description</label>
            <textarea
              className="px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60 min-h-20 resize-y"
              value={formData.branding.description || ""}
              onChange={(e) => handleBrandingChange("description", e.target.value || undefined)}
              placeholder="Add a description to display on the share page"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-primary">Background Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded-md border border-border-default cursor-pointer"
                  value={formData.branding.background_color || "#111111"}
                  onChange={(e) => handleBrandingChange("background_color", e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60"
                  value={formData.branding.background_color || "#111111"}
                  onChange={(e) => handleBrandingChange("background_color", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-primary">Accent Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded-md border border-border-default cursor-pointer"
                  value={formData.branding.accent_color || "#4f46e5"}
                  onChange={(e) => handleBrandingChange("accent_color", e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60"
                  value={formData.branding.accent_color || "#4f46e5"}
                  onChange={(e) => handleBrandingChange("accent_color", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-primary">Logo URL</label>
            <input
              type="url"
              className="px-3 py-2.5 text-sm bg-surface-1 border border-border-default rounded-md text-primary transition-colors focus:outline-none focus:border-accent placeholder:text-secondary/60"
              value={formData.branding.logo_url || ""}
              onChange={(e) => handleBrandingChange("logo_url", e.target.value || undefined)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="flex justify-between items-center p-3 bg-surface-1 rounded-md">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-primary">Dark Mode</span>
              <span className="text-xs text-secondary">Use dark theme for share page</span>
            </div>
            <button
              type="button"
              className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
                formData.branding.dark_mode !== false ? "bg-accent" : "bg-border-default"
              }`}
              onClick={() => handleBrandingChange("dark_mode", formData.branding.dark_mode === false ? true : false)}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                formData.branding.dark_mode !== false ? "translate-x-5" : ""
              }`}></span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 justify-end">
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
