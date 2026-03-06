/**
 * Bush Platform - Share Card Component
 *
 * Displays a single share in a card format for the shares list page.
 */
"use client";

import { useState } from "react";
import { Badge } from "@/web/components/ui";
import {
  Squares2X2Icon,
  ViewColumnsIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ArrowDownTrayIcon,
  LockClosedIcon,
  ClockIcon,
  ClipboardDocumentIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  TrashIcon,
} from "@/web/lib/icons";
import type { ShareWithRelationships, ShareLayout } from "./types";

interface ShareCardProps {
  share: ShareWithRelationships;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get layout icon component
 */
function getLayoutIcon(layout: ShareLayout): React.ReactNode {
  const iconClass = "w-4 h-4";
  switch (layout) {
    case "grid":
      return <Squares2X2Icon className={iconClass} />;
    case "reel":
      return <ViewColumnsIcon className={iconClass} />;
    case "viewer":
      return <EyeIcon className={iconClass} />;
    default:
      return <Squares2X2Icon className={iconClass} />;
  }
}

function getStatusBadgeColor(share: ShareWithRelationships): "red" | "amber" | "green" {
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return "red";
  }
  if (share.passphrase) {
    return "amber";
  }
  return "green";
}

function getStatusLabel(share: ShareWithRelationships): string {
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return "expired";
  }
  if (share.passphrase) {
    return "protected";
  }
  return "active";
}

/**
 * Share card component
 */
export function ShareCard({ share, onEdit: _onEdit, onDuplicate, onDelete }: ShareCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/s/${share.slug}`;
    navigator.clipboard.writeText(url);
    // Could add a toast notification here
  };

  return (
    <div className="bg-surface-1 border border-border-default rounded-md p-4 transition-colors hover:border-accent hover:shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5 text-xs text-secondary">
          {getLayoutIcon(share.layout)}
          <span className="capitalize">{share.layout}</span>
        </div>
        <Badge color={getStatusBadgeColor(share)}>{getStatusLabel(share)}</Badge>
      </div>

      <h3 className="text-base font-semibold mb-2 text-primary overflow-hidden text-ellipsis whitespace-nowrap">
        {share.name}
      </h3>

      <div className="flex gap-3 text-xs text-secondary mb-2">
        {share.asset_count !== undefined && (
          <span className="text-accent">
            {share.asset_count} asset{share.asset_count !== 1 ? "s" : ""}
          </span>
        )}
        {share.created_by && (
          <span>by {share.created_by.firstName || share.created_by.email.split("@")[0]}</span>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {share.allowComments && (
          <span className="text-sm opacity-70" title="Comments enabled">
            <ChatBubbleLeftIcon className="w-4 h-4" />
          </span>
        )}
        {share.allowDownloads && (
          <span className="text-sm opacity-70" title="Downloads enabled">
            <ArrowDownTrayIcon className="w-4 h-4" />
          </span>
        )}
        {share.passphrase && (
          <span className="text-sm opacity-70" title="Password protected">
            <LockClosedIcon className="w-4 h-4" />
          </span>
        )}
        {share.expiresAt && (
          <span
            className="text-sm opacity-70"
            title={`Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
          >
            <ClockIcon className="w-4 h-4" />
          </span>
        )}
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-border-default text-[11px] text-secondary/80">
        <span className="font-mono bg-surface-2 px-1.5 py-0.5 rounded-sm">/{share.slug}</span>
        <span>Updated {formatRelativeTime(share.updatedAt)}</span>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          className="flex-1 py-2 px-3 text-xs font-medium bg-surface-2 border border-border-default rounded-md text-primary cursor-pointer text-center no-underline transition-colors hover:bg-surface-3 hover:border-accent flex items-center justify-center gap-1.5"
          onClick={handleCopyLink}
          title="Copy link"
        >
          <ClipboardDocumentIcon className="w-3.5 h-3.5" /> Copy Link
        </button>
        <a
          href={`/shares/${share.id}`}
          className="flex-1 py-2 px-3 text-xs font-medium bg-surface-2 border border-border-default rounded-md text-primary cursor-pointer text-center no-underline transition-colors hover:bg-surface-3 hover:border-accent flex items-center justify-center gap-1.5"
          title="Edit share"
        >
          <PencilIcon className="w-3.5 h-3.5" /> Edit
        </a>
        <div className="relative">
          <button
            className="w-8 p-2 text-base bg-surface-2 border border-border-default rounded-md text-primary cursor-pointer transition-colors hover:bg-surface-3"
            onClick={() => setShowMenu(!showMenu)}
            title="More options"
          >
            <EllipsisVerticalIcon className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 min-w-[140px] bg-surface-1 border border-border-default rounded-md shadow-lg z-[100] overflow-hidden">
              <button
                className="flex items-center gap-2 w-full py-2.5 px-3.5 text-[13px] bg-none border-none text-primary cursor-pointer text-left no-underline transition-colors hover:bg-surface-2"
                onClick={() => {
                  setShowMenu(false);
                  onDuplicate?.(share.id);
                }}
              >
                <DocumentDuplicateIcon className="w-4 h-4" /> Duplicate
              </button>
              <a
                href={`/s/${share.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full py-2.5 px-3.5 text-[13px] bg-none border-none text-primary cursor-pointer text-left no-underline transition-colors hover:bg-surface-2"
                onClick={() => setShowMenu(false)}
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" /> Preview
              </a>
              <button
                className="flex items-center gap-2 w-full py-2.5 px-3.5 text-[13px] bg-none border-none text-red-500 cursor-pointer text-left no-underline transition-colors hover:bg-red-500/10"
                onClick={() => {
                  setShowMenu(false);
                  onDelete?.(share.id);
                }}
              >
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
