import type { ParsedLesson, ParseSheetResult, ParseWorkbookResult } from './parser/engine.ts';
import { parserEngine } from './parser/engine.ts';

/**
 * Legacy compatibility facade. All extraction and validation semantics live in
 * ParserEngine; this module only selects the detailed or array-shaped API.
 */
export function parseSheetRows(rows: unknown[][] | null | undefined): ParsedLesson[] {
  if (!Array.isArray(rows) || !rows.length) return [];
  return parserEngine.parseSheetRows(rows);
}

/**
 * Canonical detailed API. Every candidate is accepted, rejected, or ignored.
 */
export function parseWorkbook(
  workbook: { SheetNames?: string[]; Sheets?: Record<string, unknown> } | null | undefined,
  xlsx?: unknown
): Record<string, ParsedLesson[]> {
  return parserEngine.parseWorkbook(workbook, xlsx);
}

/**
 * Canonical detailed API. Every candidate is accepted, rejected, or ignored.
 */
export function parseWorkbookDetailed(
  workbook: { SheetNames?: string[]; Sheets?: Record<string, unknown> } | null | undefined,
  xlsx?: unknown
): ParseWorkbookResult {
  return parserEngine.parseWorkbookDetailed(workbook, xlsx);
}

export function parseSheetRowsDetailed(rows: unknown[][], sheetName?: string): ParseSheetResult {
  return parserEngine.parseSheetRowsDetailed(rows, sheetName);
}

export { ParserEngine, parserEngine } from './parser/engine.ts';
