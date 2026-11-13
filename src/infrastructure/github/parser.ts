/**
 * Excel File Parser - Wraps the canonical SheetJS parser.
 * Implements the IFileParser port.
 *
 * `parseSchedule` returns a typed draft plus the full parser report, including
 * rejected-record diagnostics. The draft is a candidate, not an authority: the
 * Edge Function re-validates it and refuses to publish while rejects exist.
 *
 * `previewWorkbook` runs the very same parse once and returns both the draft
 * and the report, so the admin can inspect a file before publishing and then
 * publish exactly what was inspected.
 */
import type {
  IFileParser,
  ScheduleDraft,
  SchedulePreview,
  ParseDiagnostic,
  ParseSheetPreview,
} from '@core/domain/repositories/ports';
import { ParserEngine, type ParseWorkbookResult, type ParsedLesson } from '../../parser/engine.ts';
import { MAX_REPORTED_DIAGNOSTICS, DAY_ORDER_LOOKUP, toPublishDraft } from '../../parser/draft.ts';

export const PARSER_VERSION = '1.0.0';

interface WorkbookLike {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

export class ExcelFileParser implements IFileParser {
  private xlsxPromise: Promise<Record<string, unknown>> | null = null;
  private engine = new ParserEngine();
  private worker: Worker | null = null;

  async parseExcel(file: ArrayBuffer | File): Promise<WorkbookLike> {
    const XLSX = (await this.loadXLSX()) as { read: (input: unknown, opts?: unknown) => unknown };
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const input = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    const workbook = XLSX.read(input, { type: 'array', cellDates: true }) as {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    return { SheetNames: workbook.SheetNames, Sheets: workbook.Sheets };
  }

  /**
   * Parse in a Web Worker to keep the main thread free.
   * Falls back to main-thread parsing if workers are unavailable.
   */
  async parseScheduleInWorker(file: ArrayBuffer | File): Promise<ParsedLesson[]> {
    const buffer = file instanceof File ? await file.arrayBuffer() : file;

    if (typeof Worker === 'undefined') {
      return this.parseScheduleFallback(buffer);
    }

    if (!this.worker) {
      this.worker = new Worker(
        new URL('../../infrastructure/workers/parse-worker.ts', import.meta.url)
      );
    }

    return new Promise<ParsedLesson[]>((resolve, reject) => {
      const id = crypto.randomUUID();
      const handler = (event: MessageEvent) => {
        const data = event.data as { id: string; lessons: ParsedLesson[]; error?: string };
        if (data.id !== id) return;
        this.worker?.removeEventListener('message', handler);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.lessons);
        }
      };
      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({ id, buffer }, [buffer]);
    });
  }

  private async parseScheduleFallback(buffer: ArrayBuffer): Promise<ParsedLesson[]> {
    const XLSX = (await this.loadXLSX()) as { read: (input: unknown, opts?: unknown) => unknown };
    const input = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    const workbook = XLSX.read(input, { type: 'array', cellDates: true }) as {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };

    const result = this.engine.parseWorkbookDetailed(
      { SheetNames: workbook.SheetNames, Sheets: workbook.Sheets as Record<string, unknown> },
      XLSX
    );

    const lessons: ParsedLesson[] = [];
    for (const sheet of Object.values(result.sheets)) {
      for (const outcome of sheet.outcomes) {
        if (outcome.status === 'accepted') {
          lessons.push(outcome.lesson);
        }
      }
    }
    return lessons;
  }

  async parseSchedule(file: ArrayBuffer | File): Promise<ScheduleDraft> {
    const { draft, diagnostics } = await this.#parseOnce(file);
    return { ...draft, diagnostics };
  }

  async previewWorkbook(file: ArrayBuffer | File): Promise<SchedulePreview> {
    const { parsed, draft, diagnostics } = await this.#parseOnce(file);
    const sheets = describeSheets(parsed);
    return {
      draft: { ...draft, diagnostics },
      sheets,
      days: orderedDays(new Set(sheets.flatMap((sheet) => sheet.days))),
      report: parsed.report,
    };
  }

  async #parseOnce(file: ArrayBuffer | File): Promise<{
    parsed: ParseWorkbookResult;
    draft: Omit<ScheduleDraft, 'diagnostics'>;
    diagnostics: ParseDiagnostic[];
  }> {
    const XLSX = await this.loadXLSX();
    const workbook = await this.parseExcel(file);
    const parsed = this.engine.parseWorkbookDetailed(workbook, XLSX);

    const diagnostics: ParseDiagnostic[] = [];
    for (const sheet of Object.values(parsed.sheets)) {
      for (const outcome of sheet.outcomes) {
        if (outcome.status !== 'rejected') continue;
        if (diagnostics.length >= MAX_REPORTED_DIAGNOSTICS) continue;
        diagnostics.push({
          sheet: outcome.provenance.sheetName,
          row: outcome.provenance.sourceRow,
          code: outcome.code,
          message: outcome.message,
        });
      }
    }

    const { lessons, report } = toPublishDraft(parsed);

    return { parsed, draft: { lessons, report }, diagnostics };
  }

  private async loadXLSX(): Promise<Record<string, unknown>> {
    if (this.xlsxPromise) return this.xlsxPromise;

    this.xlsxPromise = new Promise((resolve, reject) => {
      const xlsx = (window as { XLSX?: Record<string, unknown> }).XLSX;
      if (xlsx) return resolve(xlsx);

      const script = document.createElement('script');
      script.src = 'xlsx.full.min.js';
      script.async = true;
      script.onload = () =>
        (window as { XLSX?: Record<string, unknown> }).XLSX
          ? resolve((window as { XLSX?: Record<string, unknown> }).XLSX as Record<string, unknown>)
          : reject(new Error('XLSX not loaded'));
      script.onerror = () => reject(new Error('Failed to load xlsx.full.min.js'));
      document.head.appendChild(script);
    });

    return this.xlsxPromise;
  }
}

/** Weekdays holding at least one accepted lesson, in week order. */
function orderedDays(days: Set<string>): string[] {
  return Array.from(days).sort(
    (left, right) => (DAY_ORDER_LOOKUP[left] ?? 99) - (DAY_ORDER_LOOKUP[right] ?? 99)
  );
}

function describeSheets(parsed: ParseWorkbookResult): ParseSheetPreview[] {
  return Object.values(parsed.sheets).map((sheet) => ({
    sheetName: sheet.sheetName,
    lessonCount: sheet.stats.acceptedCount,
    days: orderedDays(new Set(sheet.accepted.map((outcome) => outcome.lesson.day))),
    stats: sheet.stats,
  }));
}
