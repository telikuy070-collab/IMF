import type { LessonType } from '@core/domain/entities/types';
import { TYPE_IDS } from './constants.ts';
import { norm } from './text.ts';
import { fieldExtractor, type ExtractedAllFields } from './parser/fieldExtractor.ts';

const GROUP_RE = /^([А-ЯA-ZӨҮҢ]{1,6})[-\s]?(\d{1,2})[-\s]?(\d{2})(?:\s*\(?(\d)\)?)?$/;

export interface ParsedCell {
  subject: string;
  type: string;
  room: string;
  teacher: string;
  isExam: boolean;
}

function convertExtractedFields(result: ExtractedAllFields, rawText: string): ParsedCell {
  let type: string | undefined = result.type?.value;
  const room = result.room?.value || '';
  const hasRoom = Boolean(room);

  const hasExplicitTypeKeyword =
    /(?:^|[\s.,;:])(?:пр|практ|практика|семинар|сем|лаб|лабораторн|лек|лекц|лекция)(?=$|[\s.,;:])/i.test(
      rawText
    );

  if ((!type || (type === TYPE_IDS.OTHER && !hasExplicitTypeKeyword)) && hasRoom) {
    type = TYPE_IDS.PRACTICE;
  }

  return {
    subject: result.subject.value,
    type: type || TYPE_IDS.OTHER,
    room,
    teacher: result.teacher?.value || '',
    isExam: false,
  };
}

export function parseGroupCode(
  name: unknown
): { code: string; subgroup: string; raw: string } | null {
  if (name == null) return null;
  const original = norm(name);
  let m = original.match(GROUP_RE);
  if (!m) {
    const upper = original.toUpperCase();
    m = upper.match(GROUP_RE);
    if (!m) return null;
    return { code: `${m[1]}-${m[2]}-${m[3]}`, subgroup: m[4] || '1', raw: original };
  }
  return { code: `${m[1]}-${m[2]}-${m[3]}`, subgroup: m[4] || '1', raw: original };
}

export function parseCell(raw: unknown): ParsedCell | null {
  if (raw == null) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  if (typeof raw === 'number' && !isFinite(raw)) return null;
  const s = norm(raw);
  if (!s) return null;

  const extracted = fieldExtractor.extractAll(s);
  return convertExtractedFields(extracted, s);
}

export function splitSubs(raw: unknown): string[] {
  if (!raw) return [];
  return String(raw)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}
