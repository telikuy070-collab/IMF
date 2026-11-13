/* DI контейнер: создаёт все сервисы, репозитории и инфраструктурные зависимости.
   Единственное место, где решается, использовать Supabase или локальный режим. */

import type { PresenceSnapshot } from './admin/presence.ts';
import type { VisitStats } from './admin/visits.ts';
import { ScheduleService } from '@core/application/services';
import { PreferencesService } from '@core/application/services';
import { AuthService } from '@core/application/services';
import { AdminService } from '@core/application/services';
import { SupabaseScheduleRepository } from '@infrastructure/supabase/repository';
import { SupabaseAuthProvider } from '@infrastructure/supabase/auth';
import { LocalScheduleRepository } from '@infrastructure/local/repository';
import { LocalAuthProvider } from '@infrastructure/local/auth';
import { HybridStorage } from '@infrastructure/storage/hybrid';
import { ExcelFileParser } from '@infrastructure/github/parser';
import { getSupabaseClient } from '@infrastructure/supabase/client.js';
import { getDeviceId } from './admin/deviceId.ts';
import { createSupabasePresenceService } from './admin/presence.ts';
import { createSupabaseVisitStore } from './admin/visits.ts';

interface SupabasePresence {
  start(): void;
  stop(): void;
  subscribe(cb: (snapshot: PresenceSnapshot) => void): () => void;
  getSnapshot(): PresenceSnapshot;
  isRunning(): boolean;
}

interface SupabaseVisits {
  load(): Promise<VisitStats>;
  recordVisit(deviceId: string): void;
}

export interface Container {
  repository: SupabaseScheduleRepository | LocalScheduleRepository;
  auth: SupabaseAuthProvider | LocalAuthProvider;
  storage: HybridStorage;
  parser: ExcelFileParser;
  deviceId: string;
  presence: SupabasePresence | null;
  visits: SupabaseVisits | null;
  scheduleService: ScheduleService;
  prefsService: PreferencesService;
  authService: AuthService;
  adminService: AdminService;
}

export function createContainer(): Container {
  const hasSupabase = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  if (hasSupabase) {
    // Force Supabase client initialization for bundle inclusion
    getSupabaseClient();
  }

  // Infrastructure
  const repository = hasSupabase ? new SupabaseScheduleRepository() : new LocalScheduleRepository();
  const auth = hasSupabase ? new SupabaseAuthProvider() : new LocalAuthProvider();
  const storage = new HybridStorage();
  const parser = new ExcelFileParser();

  // Anonymous device identity, shared by the admin's presence counter and the
  // optional `app_visits` table. No personal data, no accounts, no login.
  // In local mode (no Supabase) these are inert no-ops.
  const deviceId = getDeviceId();
  const presence: SupabasePresence | null = hasSupabase
    ? createSupabasePresenceService(deviceId)
    : null;
  const visits: SupabaseVisits | null = hasSupabase ? createSupabaseVisitStore() : null;

  // Application Services
  const scheduleService = new ScheduleService(repository, storage);
  const prefsService = new PreferencesService(storage);
  const authService = new AuthService(auth);
  const adminService = new AdminService(repository, parser);

  return {
    repository,
    auth,
    storage,
    parser,
    deviceId,
    presence,
    visits,
    scheduleService,
    prefsService,
    authService,
    adminService,
  };
}
