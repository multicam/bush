/**
 * Bush Platform - Version Stack Components
 *
 * Export all version stack components and types.
 * Reference: IMPLEMENTATION_PLAN.md 2.5 Version Stacking
 */

// Components
export { VersionStackList } from "./version-stack-list";
export { VersionStackCard } from "./version-stack-card";
export { VersionStackCompare } from "./version-stack-compare";
export { CreateVersionStackModal } from "./create-version-stack-modal";
export { AddToStackModal } from "./add-to-stack-modal";

// Hooks
export { useVersionStackDnd } from "./use-version-stack-dnd";

// Types
export type {
  VersionStack,
  VersionStackWithFiles,
  VersionStackListProps,
  VersionStackCardProps,
  VersionStackCompareProps,
  CreateVersionStackModalProps,
  AddToStackModalProps,
} from "./types";

export type {
  DragState,
  UseVersionStackDndOptions,
  UseVersionStackDndReturn,
} from "./use-version-stack-dnd";
