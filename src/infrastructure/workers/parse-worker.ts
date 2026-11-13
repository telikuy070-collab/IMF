/* Web Worker для парсинга Excel-файла.
   Запускается в отдельном потоке, не блокируя основной поток UI.
   Основной поток отправляет ArrayBuffer → получает распарсенные уроки. */

import { ParserEngine } from '../../parser/engine.ts';
import type { ParsedLesson } from '../../parser/engine.ts';
import * as XLSX from 'xlsx';

interface ParseRequest {
  id: string;
  buffer: ArrayBuffer;
}

interface ParseResponse {
  id: string;
  lessons: ParsedLesson[];
  sheetNames: string[];
  error?: string;
}

self.onmessage = async (event: MessageEvent<ParseRequest>): Promise<void> => {
  const { id, buffer } = event.data;

  try {
    const input = new Uint8Array(buffer);
    const workbook = XLSX.read(input, { type: 'array', cellDates: true });

    const engine = new ParserEngine();
    const result = engine.parseWorkbookDetailed(
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

    const response: ParseResponse = {
      id,
      lessons,
      sheetNames: workbook.SheetNames,
    };

    self.postMessage(response);
  } catch (err) {
    const response: ParseResponse = {
      id,
      lessons: [],
      sheetNames: [],
      error: err instanceof Error ? err.message : 'Unknown parse error',
    };
    self.postMessage(response);
  }
};
