/**
 * Local (offline) schedule repository.
 *
 * Used when no Supabase credentials are configured (local dev / preview).
 * Reads the tracked canonical snapshot from /data/ + version.json
 * and parses it with the same engine the admin uses to publish.
 */
import type {
  IScheduleRepository,
  PublishFileMeta,
  PublishOptions,
  PublishResult,
} from '@core/domain/repositories/ports';
import type {
  ScheduleData,
  Lesson,
  Sheet,
  Group,
  UserPreferences,
} from '@core/domain/entities/types';
import { ExcelFileParser } from '../github/parser';
import { toPublishableLessons } from '../../parser/draft';

interface VersionData {
  version?: string;
  updated?: string;
  updated_at?: string;
}

export class LocalScheduleRepository implements IScheduleRepository {
  private parser = new ExcelFileParser();
  private cached: ScheduleData | null = null;

  async loadFull(): Promise<ScheduleData> {
    const versionData: VersionData = await this.loadVersion();
    const response = await fetch('/data/6 СЖ_МК_26-27_1пг_7_нед_по новому сем ММФ КУМУ (1).xls');
    if (!response.ok) throw new Error('Не удалось загрузить локальное расписание');
    const buffer = await response.arrayBuffer();
    const draft = await this.parser.parseSchedule(buffer);
    const lessons = toPublishableLessons(draft.lessons as any);
    const data = this.transform(lessons, versionData);
    this.cached = data;
    return data;
  }

  subscribe(callback: (data: ScheduleData) => void): () => void {
    if (this.cached) callback(this.cached);
    return () => {};
  }

  async getVersion(): Promise<{ version: string; updatedAt: string }> {
    const versionData = await this.loadVersion();
    return {
      version: versionData.version || 'local',
      updatedAt: versionData.updated || versionData.updated_at || new Date().toISOString(),
    };
  }

  async getChangesSince(_version: string): Promise<{ lessons: Lesson[]; version: string }> {
    return { lessons: [], version: (await this.getVersion()).version };
  }

  async publish(
    _lessons: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>[],
    _meta?: PublishFileMeta,
    _options?: PublishOptions
  ): Promise<PublishResult> {
    throw new Error('Публикация недоступна в локальном режиме');
  }

  async publishFromWorkbook(
    _workbook: { SheetNames: string[]; Sheets: Record<string, any> },
    _xlsx?: any,
    _meta?: PublishFileMeta
  ): Promise<PublishResult> {
    throw new Error('Публикация недоступна в локальном режиме');
  }

  private async loadVersion(): Promise<VersionData> {
    try {
      const response = await fetch('/data/version.json');
      if (!response.ok) return {};
      return (await response.json()) as VersionData;
    } catch {
      return {};
    }
  }

  private transform(
    lessons: ReturnType<typeof toPublishableLessons>,
    versionData: VersionData
  ): ScheduleData {
    const sheets = new Map<string, Lesson[]>();
    const sheetsMetaMap = new Map<
      string,
      { id: string; name: string; lessonCount: number; order: number }
    >();
    const groupsMap = new Map<
      string,
      { code: string; sheetId: string; subgroups: Set<string>; count: number }
    >();

    let counter = 0;
    for (const l of lessons) {
      const lesson: Lesson = {
        id: `local-${counter++}`,
        sheetId: l.sheetId,
        day: l.day,
        dayOrder: l.dayOrder,
        time: l.time,
        para: l.para,
        group: l.group,
        subgroup: l.subgroup,
        subject: l.subject,
        type: l.type,
        teacher: l.teacher,
        room: l.room,
        isExam: l.isExam,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!sheets.has(l.sheetId)) {
        sheets.set(l.sheetId, []);
        sheetsMetaMap.set(l.sheetId, {
          id: l.sheetId,
          name: l.sheetId,
          lessonCount: 0,
          order: l.dayOrder,
        });
      }
      sheets.get(l.sheetId)!.push(lesson);
      sheetsMetaMap.get(l.sheetId)!.lessonCount++;

      const groupKey = `${l.sheetId}:${l.group}`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          code: l.group,
          sheetId: l.sheetId,
          subgroups: new Set(),
          count: 0,
        });
      }
      groupsMap.get(groupKey)!.count++;
      if (l.subgroup) groupsMap.get(groupKey)!.subgroups.add(l.subgroup);
    }

    const sheetsMeta: Sheet[] = Array.from(sheetsMetaMap.values()).sort(
      (a, b) => a.order - b.order
    );

    const groupsByCode = new Map<string, Group>();
    for (const [, meta] of groupsMap) {
      groupsByCode.set(meta.code, {
        code: meta.code,
        sheetId: meta.sheetId,
        lessonCount: meta.count,
        subgroups: Array.from(meta.subgroups).sort(),
      });
    }

    const preferences: UserPreferences = {
      currentSheetId: sheetsMeta[0]?.id || '',
      currentGroup: '',
      activeSubgroup: '',
      hiddenSheets: [],
    };

    return {
      sheets,
      sheetsMeta,
      groups: groupsByCode,
      preferences,
      version: versionData.version || 'local',
      updatedAt: versionData.updated || versionData.updated_at || new Date().toISOString(),
    };
  }
}
