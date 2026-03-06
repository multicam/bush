/**
 * Icon mapping module: Lucide React → Heroicons
 *
 * This is the single source of truth for all icons in Bush.
 * All feature components import icons from here — never directly from heroicons or lucide-react.
 *
 * Size conventions:
 *   - 20/solid: sidebar nav items, major UI icons
 *   - 16/solid: buttons, dropdowns, inline usage
 *   - 24/outline: large icons, empty states
 */

// ============================================================
// 20px Solid — Sidebar navigation, major UI icons
// ============================================================
export {
  HomeIcon, // replaces: LayoutDashboard
  BriefcaseIcon, // replaces: Briefcase
  FolderOpenIcon, // replaces: FolderOpen (large/nav context)
  DocumentTextIcon, // replaces: FileText
  Square2StackIcon, // replaces: Layers
  ShareIcon, // replaces: Share2
  Cog6ToothIcon, // replaces: Settings
  SunIcon, // replaces: Sun
  MoonIcon, // replaces: Moon
  BellIcon, // replaces: Bell
  UserCircleIcon, // replaces: User (profile context)
} from "@heroicons/react/20/solid";

// ============================================================
// 16px Solid — Buttons, dropdowns, inline usage
// ============================================================
import { HomeIcon as HomeSmallIcon, PhotoIcon } from "@heroicons/react/16/solid";

export {
  XMarkIcon, // replaces: X
  CheckIcon, // replaces: Check
  PlusIcon, // replaces: Plus
  TrashIcon, // replaces: Trash2
  PencilIcon, // replaces: Pencil, Edit
  ArrowDownTrayIcon, // replaces: Download
  MagnifyingGlassIcon, // replaces: Search
  EllipsisHorizontalIcon, // replaces: MoreHorizontal
  EllipsisVerticalIcon, // replaces: MoreVertical
  InformationCircleIcon, // replaces: Info
  ExclamationTriangleIcon, // replaces: AlertTriangle
  ExclamationCircleIcon, // replaces: AlertCircle
  CheckCircleIcon, // replaces: CheckCircle2
  XCircleIcon, // replaces: XCircle
  FilmIcon, // replaces: Film, Video
  MusicalNoteIcon, // replaces: Music, AudioLines
  FolderIcon, // replaces: Folder (small/inline context)
  ChevronDownIcon, // replaces: ChevronDown
  ChevronUpIcon, // replaces: ChevronUp
  ChevronRightIcon, // replaces: ChevronRight
  ChevronLeftIcon, // replaces: ChevronLeft
  ArrowRightStartOnRectangleIcon, // replaces: LogOut
  PlayIcon, // replaces: Play
  PauseIcon, // replaces: Pause
  SpeakerWaveIcon, // replaces: Volume2
  SpeakerXMarkIcon, // replaces: VolumeX
  ArrowsPointingOutIcon, // replaces: Maximize, Maximize2
  PaperAirplaneIcon, // replaces: Send
  ArrowUturnLeftIcon, // replaces: Reply
  ArrowUpTrayIcon, // replaces: Upload, UploadCloud
  ClockIcon, // replaces: Clock
  EyeIcon, // replaces: Eye
  EyeSlashIcon, // replaces: EyeOff
  ClipboardDocumentIcon, // replaces: Copy
  ArrowTopRightOnSquareIcon, // replaces: ExternalLink
  LinkIcon, // replaces: Link
  Bars3Icon, // replaces: GripVertical, GripHorizontal (drag handles)
  Bars2Icon, // alternative drag handle
  ArrowsRightLeftIcon, // replaces: ArrowLeftRight
  ArrowLeftIcon, // replaces: ArrowLeft
  DocumentDuplicateIcon, // replaces: Files
  StarIcon, // replaces: Star
  LockClosedIcon, // replaces: Lock
  MinusIcon, // replaces: Minus
  ArrowPathIcon, // replaces: RotateCcw
  BackwardIcon, // replaces: SkipBack
  ForwardIcon, // replaces: SkipForward
  ComputerDesktopIcon, // replaces: PictureInPicture2
  TagIcon, // replaces: Tag
  UserGroupIcon, // replaces: Users
  FolderPlusIcon, // replaces: FolderPlus
  DocumentIcon, // replaces: FileText (generic)
  ShieldCheckIcon, // replaces: Shield
  BoltIcon, // replaces: Zap
  ChatBubbleLeftIcon, // replaces: MessageCircle, MessageSquare
  VideoCameraIcon, // replaces: Video (camera context)
  ViewColumnsIcon, // replaces: LayoutPanelTop
  Squares2X2Icon, // replaces: Grid3X3
  ListBulletIcon, // replaces: List
  SquaresPlusIcon, // replaces: Square (grid square)
  PaintBrushIcon, // replaces: Pencil (drawing tool context)
  RectangleGroupIcon, // for annotation shapes
} from "@heroicons/react/16/solid";

// Re-export with aliases
export { HomeSmallIcon };
export { PhotoIcon as ImagePlusIcon };

// ============================================================
// 24px Outline — Large icons, empty states
// ============================================================
export {
  FolderOpenIcon as FolderOpenLargeIcon, // replaces: FolderOpen (empty state)
  UserGroupIcon as UserGroupLargeIcon, // replaces: Users (landing page)
  LinkIcon as LinkLargeIcon, // replaces: Link2 (landing page)
} from "@heroicons/react/24/outline";

// ============================================================
// Custom Components — No Heroicons equivalent
// ============================================================

import React from "react";

/**
 * SpinnerIcon — replaces Lucide's Loader2
 * Custom inline SVG with animate-spin. Compatible with Catalyst's data-slot="icon" pattern.
 * Usage: <SpinnerIcon className="size-4" /> or <SpinnerIcon data-slot="icon" />
 */
export function SpinnerIcon({ className = "size-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-hidden="true"
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * GripIcon — Custom drag handle (2x3 dots pattern)
 * Closer to Lucide's GripVertical than Heroicons' Bars3Icon
 */
export function GripIcon({ className = "size-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="9" cy="18" r="2" />
      <circle cx="15" cy="18" r="2" />
    </svg>
  );
}
