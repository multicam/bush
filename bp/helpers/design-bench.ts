/**
 * Design Benchmarking Utilities
 *
 * Measures CSS properties from rendered components and compares
 * against Bush design tokens (src/web/styles/tokens.css).
 * Used by bp/specs/3x-design-*.spec.ts tests.
 */
import type { Page, Locator } from "@playwright/test";

// ─── Design Token Reference ───────────────────────────────────────────

export const TOKENS = {
  /** 4px base unit spacing scale */
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80],

  fontSize: {
    display: 48,
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 16,
    body: 14,
    bodySm: 13,
    caption: 12,
    label: 11,
    code: 13,
  },

  lineHeight: {
    display: 1.1,
    h1: 1.2,
    h2: 1.3,
    h3: 1.4,
    h4: 1.5,
    body: 1.6,
    bodySm: 1.5,
    caption: 1.4,
    label: 1.3,
  },

  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  radius: { xs: 4, sm: 6, md: 8, lg: 12, full: 9999 },

  sidebar: { width: 256, mobileMax: 320 },

  height: {
    buttonSm: 32,
    buttonMd: 36,
    buttonLg: 40,
    inputSm: 32,
    inputMd: 36,
    inputLg: 40,
  },
};

// ─── Measurement Types ────────────────────────────────────────────────

export interface BoxModel {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  gap: number;
  rowGap: number;
  columnGap: number;
  width: number;
  height: number;
}

export interface TypographyMetrics {
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
  letterSpacing: string;
  fontFamily: string;
}

// ─── Spacing Validation ───────────────────────────────────────────────

/** Check if a pixel value is on the 4px spacing scale (0.5px tolerance) */
export function isOnSpacingScale(px: number): boolean {
  return TOKENS.spacing.some((v) => Math.abs(v - px) < 0.5);
}

/** Find the nearest value on the spacing scale */
export function nearestToken(px: number): number {
  return TOKENS.spacing.reduce((prev, curr) =>
    Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev
  );
}

/** Format a spacing deviation for reporting */
export function spacingReport(label: string, actual: number): string {
  if (isOnSpacingScale(actual)) return `${label}: ${actual}px [ON SCALE]`;
  return `${label}: ${actual}px [OFF SCALE - nearest: ${nearestToken(actual)}px]`;
}

// ─── Balance Checks ───────────────────────────────────────────────────

export interface BalanceResult {
  balanced: boolean;
  ratio: number;
  left: number;
  right: number;
}

/** Check horizontal balance (symmetrical padding). Ratio >= 0.9 = balanced. */
export function checkHBalance(left: number, right: number): BalanceResult {
  if (left === 0 && right === 0) return { balanced: true, ratio: 1, left, right };
  if (left === 0 || right === 0) return { balanced: false, ratio: 0, left, right };
  const ratio = Math.min(left, right) / Math.max(left, right);
  return { balanced: ratio >= 0.9, ratio, left, right };
}

/** Check vertical balance */
export function checkVBalance(top: number, bottom: number): BalanceResult {
  return checkHBalance(top, bottom);
}

// ─── Measurement Functions ────────────────────────────────────────────

/** Measure box model of the first element matching a CSS selector */
export async function measureBox(page: Page, selector: string): Promise<BoxModel | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      paddingTop: parseFloat(cs.paddingTop),
      paddingRight: parseFloat(cs.paddingRight),
      paddingBottom: parseFloat(cs.paddingBottom),
      paddingLeft: parseFloat(cs.paddingLeft),
      marginTop: parseFloat(cs.marginTop),
      marginRight: parseFloat(cs.marginRight),
      marginBottom: parseFloat(cs.marginBottom),
      marginLeft: parseFloat(cs.marginLeft),
      gap: parseFloat(cs.gap) || 0,
      rowGap: parseFloat(cs.rowGap) || 0,
      columnGap: parseFloat(cs.columnGap) || 0,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    };
  }, selector);
}

/** Measure box model from a Playwright locator */
export async function measureLocator(locator: Locator): Promise<BoxModel | null> {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      paddingTop: parseFloat(cs.paddingTop),
      paddingRight: parseFloat(cs.paddingRight),
      paddingBottom: parseFloat(cs.paddingBottom),
      paddingLeft: parseFloat(cs.paddingLeft),
      marginTop: parseFloat(cs.marginTop),
      marginRight: parseFloat(cs.marginRight),
      marginBottom: parseFloat(cs.marginBottom),
      marginLeft: parseFloat(cs.marginLeft),
      gap: parseFloat(cs.gap) || 0,
      rowGap: parseFloat(cs.rowGap) || 0,
      columnGap: parseFloat(cs.columnGap) || 0,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    };
  });
}

/** Measure typography of the first element matching a CSS selector */
export async function measureTypography(
  page: Page,
  selector: string
): Promise<TypographyMetrics | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const lineHeightPx = parseFloat(cs.lineHeight);
    return {
      fontSize,
      lineHeight: isNaN(lineHeightPx) ? 0 : lineHeightPx / fontSize,
      fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing,
      fontFamily: cs.fontFamily.split(",")[0].trim().replace(/['"]/g, ""),
    };
  }, selector);
}

/** Measure typography from a Playwright locator */
export async function measureLocatorTypography(
  locator: Locator
): Promise<TypographyMetrics | null> {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const lineHeightPx = parseFloat(cs.lineHeight);
    return {
      fontSize,
      lineHeight: isNaN(lineHeightPx) ? 0 : lineHeightPx / fontSize,
      fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing,
      fontFamily: cs.fontFamily.split(",")[0].trim().replace(/['"]/g, ""),
    };
  });
}

/** Measure a single CSS property value */
export async function measureProp(
  page: Page,
  selector: string,
  property: string
): Promise<string | null> {
  return page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el).getPropertyValue(prop);
    },
    [selector, property]
  );
}

/** Measure vertical gaps between child elements in a container */
export async function measureChildGaps(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const parent = document.querySelector(sel);
    if (!parent) return [];
    const children = Array.from(parent.children).filter(
      (c) => getComputedStyle(c).display !== "none"
    );
    const gaps: number[] = [];
    for (let i = 1; i < children.length; i++) {
      const prev = children[i - 1].getBoundingClientRect();
      const curr = children[i].getBoundingClientRect();
      gaps.push(Math.round(curr.top - prev.bottom));
    }
    return gaps;
  }, selector);
}

/** Measure border-radius of an element */
export async function measureRadius(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return parseFloat(getComputedStyle(el).borderRadius);
  }, selector);
}

/** Get computed background color */
export async function measureBgColor(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el).backgroundColor;
  }, selector);
}

/** Get computed color (text color) */
export async function measureColor(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el).color;
  }, selector);
}

/** Count visible children of a container */
export async function countVisibleChildren(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const parent = document.querySelector(sel);
    if (!parent) return 0;
    return Array.from(parent.children).filter((c) => getComputedStyle(c).display !== "none").length;
  }, selector);
}
