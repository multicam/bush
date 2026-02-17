/**
 * Bush Platform - Annotation Toolbar Component
 *
 * Toolbar for selecting annotation tools and colors.
 * Reference: specs/04-review-and-approval.md
 */
"use client";

import { useState, useCallback } from "react";
import type { AnnotationToolbarProps, AnnotationTool } from "./types";
import { DEFAULT_COLORS, STROKE_WIDTHS, TOOL_CONFIG } from "./types";
import { Button } from "../ui/button";
import styles from "./annotations.module.css";

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
  const config = TOOL_CONFIG[tool];
  const isActive = tool === currentTool;

  return (
    <button
      type="button"
      className={`${styles.toolButton} ${isActive ? styles.active : ""}`}
      onClick={() => onSelect(tool)}
      disabled={disabled}
      title={config.label}
      aria-label={config.label}
      aria-pressed={isActive}
    >
      <span className={styles.toolIcon}>{config.icon}</span>
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
    <div className={styles.colorPicker}>
      <button
        type="button"
        className={styles.colorButton}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title="Select color"
        aria-label="Select color"
        aria-expanded={isOpen}
      >
        <span className={styles.colorSwatch} style={{ backgroundColor: currentColor }} />
      </button>
      {isOpen && (
        <div className={styles.colorDropdown}>
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles.colorOption} ${color === currentColor ? styles.selected : ""}`}
              style={{ backgroundColor: color }}
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
    <div className={styles.strokePicker}>
      <button
        type="button"
        className={styles.strokeButton}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={`Stroke width: ${currentWidth}px`}
        aria-label="Select stroke width"
        aria-expanded={isOpen}
      >
        <span className={styles.strokePreview} style={{ height: currentWidth }} />
      </button>
      {isOpen && (
        <div className={styles.strokeDropdown}>
          {widths.map((width) => (
            <button
              key={width}
              type="button"
              className={`${styles.strokeOption} ${width === currentWidth ? styles.selected : ""}`}
              onClick={() => {
                onSelect(width);
                setIsOpen(false);
              }}
              title={`${width}px`}
              aria-label={`Stroke width ${width}px`}
            >
              <span className={styles.strokeOptionPreview} style={{ height: width }} />
              <span className={styles.strokeOptionLabel}>{width}px</span>
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
      className={`${styles.toolbar} ${className ?? ""}`}
      onKeyDown={handleKeyDown}
      role="toolbar"
      aria-label="Annotation tools"
    >
      <div className={styles.toolGroup}>
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

      <div className={styles.divider} />

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

      <div className={styles.divider} />

      <div className={styles.toolGroup}>
        <button
          type="button"
          className={styles.toolButton}
          onClick={onUndo}
          disabled={disabled || !canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <span className={styles.toolIcon}>↶</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          onClick={onRedo}
          disabled={disabled || !canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <span className={styles.toolIcon}>↷</span>
        </button>
      </div>

      {onDelete && (
        <>
          <div className={styles.divider} />
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={disabled}
            className={styles.deleteButton}
          >
            Delete
          </Button>
        </>
      )}
    </div>
  );
}
