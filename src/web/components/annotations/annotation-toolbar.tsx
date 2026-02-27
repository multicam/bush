/**
 * Bush Platform - Annotation Toolbar Component
 *
 * Toolbar for selecting annotation tools and colors.
 * Reference: specs/04-api-reference.md
 */
"use client";

import { useState, useCallback } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Pencil,
  Undo2,
  Redo2,
} from "lucide-react";
import type { AnnotationToolbarProps, AnnotationTool } from "./types";
import { DEFAULT_COLORS, STROKE_WIDTHS } from "./types";
import { Button } from "../ui/button";

/**
 * Tool configuration for UI display with Lucide icons
 */
const TOOL_CONFIG_LUCIDE: Record<AnnotationTool, { label: string; icon: React.ReactNode }> = {
  select: { label: "Select", icon: <MousePointer2 className="w-4 h-4" /> },
  rectangle: { label: "Rectangle", icon: <Square className="w-4 h-4" /> },
  ellipse: { label: "Circle", icon: <Circle className="w-4 h-4" /> },
  arrow: { label: "Arrow", icon: <ArrowRight className="w-4 h-4" /> },
  line: { label: "Line", icon: <Minus className="w-4 h-4" /> },
  freehand: { label: "Draw", icon: <Pencil className="w-4 h-4" /> },
  text: { label: "Text", icon: <span className="text-sm font-bold">T</span> },
};

/**
 * Tool button component
 */
function ToolButton({
  tool,
  currentTool,
  onSelect,
  disabled,
}: {
  tool: AnnotationTool;
  currentTool: AnnotationTool;
  onSelect: (tool: AnnotationTool) => void;
  disabled?: boolean;
}) {
  const config = TOOL_CONFIG_LUCIDE[tool];
  const isActive = tool === currentTool;

  return (
    <button
      type="button"
      className={`
        flex items-center justify-center w-8 h-8 border-none rounded-sm
        bg-transparent cursor-pointer transition-colors
        ${isActive ? "bg-accent/30 text-accent" : "text-primary"}
        ${!disabled ? "hover:bg-white/10 active:bg-white/15" : ""}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
      onClick={() => onSelect(tool)}
      disabled={disabled}
      title={config.label}
      aria-label={config.label}
      aria-pressed={isActive}
    >
      {config.icon}
    </button>
  );
}

/**
 * Color picker component
 */
function ColorPicker({
  colors,
  currentColor,
  onSelect,
  disabled,
}: {
  colors: string[];
  currentColor: string;
  onSelect: (color: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className={`
          flex items-center justify-center w-8 h-8 border-none rounded-sm
          bg-transparent cursor-pointer transition-colors
          ${!disabled ? "hover:bg-white/10" : ""}
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title="Select color"
        aria-label="Select color"
        aria-expanded={isOpen}
      >
        <span
          className="w-5 h-5 rounded-sm border-2 border-white/30"
          style={{
            backgroundColor: currentColor,
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.2)",
          }}
        />
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 grid grid-cols-3 gap-1 p-2 bg-surface-2/98 rounded-md shadow-lg border border-border-default z-[100]">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              className={`
                w-7 h-7 border-none rounded-sm cursor-pointer transition-all
                ${color === currentColor ? "ring-2 ring-accent" : ""}
                hover:scale-110
              `}
              style={{
                backgroundColor: color,
                boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.2)",
              }}
              onClick={() => {
                onSelect(color);
                setIsOpen(false);
              }}
              title={color}
              aria-label={`Color ${color}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Stroke width picker component
 */
function StrokeWidthPicker({
  widths,
  currentWidth,
  onSelect,
  disabled,
}: {
  widths: number[];
  currentWidth: number;
  onSelect: (width: number) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className={`
          flex items-center justify-center w-8 h-8 border-none rounded-sm
          bg-transparent cursor-pointer transition-colors
          ${!disabled ? "hover:bg-white/10" : ""}
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={`Stroke width: ${currentWidth}px`}
        aria-label="Select stroke width"
        aria-expanded={isOpen}
      >
        <span
          className="w-5 bg-primary rounded-[2px]"
          style={{ height: currentWidth }}
        />
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex flex-col gap-0.5 p-2 bg-surface-2/98 rounded-md shadow-lg border border-border-default z-[100]">
          {widths.map((width) => (
            <button
              key={width}
              type="button"
              className={`
                flex items-center gap-2 px-2.5 py-1.5 border-none rounded-sm
                bg-transparent text-primary cursor-pointer transition-colors whitespace-nowrap
                ${width === currentWidth ? "bg-accent/20 text-accent" : "hover:bg-white/10"}
              `}
              onClick={() => {
                onSelect(width);
                setIsOpen(false);
              }}
              title={`${width}px`}
              aria-label={`Stroke width ${width}px`}
            >
              <span
                className="w-4 rounded-[1px]"
                style={{
                  height: width,
                  backgroundColor: "currentColor",
                }}
              />
              <span className="text-xs">{width}px</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnnotationToolbar({
  tool,
  color,
  strokeWidth,
  disabled = false,
  canUndo = false,
  canRedo = false,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onDelete,
  className,
}: AnnotationToolbarProps) {
  const tools: AnnotationTool[] = ["select", "rectangle", "ellipse", "arrow", "line", "freehand"];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Keyboard shortcuts
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" && !e.shiftKey && onUndo) {
          e.preventDefault();
          onUndo();
        } else if ((e.key === "z" && e.shiftKey) || (e.key === "y" && onRedo)) {
          e.preventDefault();
          onRedo();
        }
      }

      // Tool shortcuts
      const toolShortcuts: Record<string, AnnotationTool> = {
        v: "select",
        r: "rectangle",
        e: "ellipse",
        a: "arrow",
        l: "line",
        d: "freehand",
      };
      if (toolShortcuts[e.key.toLowerCase()] && !e.metaKey && !e.ctrlKey) {
        onToolChange(toolShortcuts[e.key.toLowerCase()]);
      }
    },
    [onToolChange, onUndo, onRedo]
  );

  return (
    <div
      className={`
        flex items-center gap-1 px-3 py-2
        bg-surface-1/95 rounded-md shadow-lg
        border border-border-default
        ${className ?? ""}
      `}
      onKeyDown={handleKeyDown}
      role="toolbar"
      aria-label="Annotation tools"
    >
      <div className="flex items-center gap-0.5">
        {tools.map((t) => (
          <ToolButton
            key={t}
            tool={t}
            currentTool={tool}
            onSelect={onToolChange}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-white/20 mx-2" />

      <ColorPicker
        colors={DEFAULT_COLORS}
        currentColor={color}
        onSelect={onColorChange}
        disabled={disabled}
      />

      <StrokeWidthPicker
        widths={STROKE_WIDTHS}
        currentWidth={strokeWidth}
        onSelect={onStrokeWidthChange}
        disabled={disabled}
      />

      <div className="w-px h-6 bg-white/20 mx-2" />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={`
            flex items-center justify-center w-8 h-8 border-none rounded-sm
            bg-transparent text-primary cursor-pointer transition-colors
            ${!disabled && canUndo ? "hover:bg-white/10" : ""}
            ${disabled || !canUndo ? "opacity-40 cursor-not-allowed" : ""}
          `}
          onClick={onUndo}
          disabled={disabled || !canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`
            flex items-center justify-center w-8 h-8 border-none rounded-sm
            bg-transparent text-primary cursor-pointer transition-colors
            ${!disabled && canRedo ? "hover:bg-white/10" : ""}
            ${disabled || !canRedo ? "opacity-40 cursor-not-allowed" : ""}
          `}
          onClick={onRedo}
          disabled={disabled || !canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {onDelete && (
        <>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={disabled}
            className="text-xs px-2.5 py-1"
          >
            Delete
          </Button>
        </>
      )}
    </div>
  );
}
