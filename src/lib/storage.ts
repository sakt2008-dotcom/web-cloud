import { isPersonalDemoMode } from './demoMode';

export const STORAGE_KEYS = {
  USER_ROLE: 'gathern_user_role_v3',
  MARKETER_ID: 'gathern_marketer_id_v3',
  GUARD: 'gathern_guard_v3',
  PROPERTIES: 'gathern_properties_v3',
  SELECTED_PROPERTY: 'gathern_selected_property_v3',
  MARKETERS: 'gathern_marketers_v3',
  BOOKINGS: 'gathern_bookings_v3',
  OVERRIDES: 'gathern_overrides_v3',
  LOGS: 'gathern_logs_v3',
  NOTIFICATIONS: 'gathern_notifications_v3',
  TEMPLATES: 'gathern_message_templates_v3',
  USER_ACCOUNTS: 'amasa_user_accounts_v1',
  COMMISSION_REQUESTS: 'amasa_commission_requests_v1',
  AUTH: 'amasa_auth_v1',
  SOUND_ENABLED: 'gathern_sound_enabled_v3',
  RESET_TOKENS: 'amasa_reset_tokens_v1',
  CALENDAR_SYNC_STATUS: 'property_calendar_sync_status',
  CALENDAR_SYNC_URLS: 'property_calendar_sync_urls',
  GUARDS_LIST: 'amasa_guards_list_v1',
  ADMIN_BROADCASTS: 'amasa_admin_broadcasts_v1',
  ACKNOWLEDGED_BROADCASTS: 'amasa_acknowledged_broadcasts_v1',
  COORDINATOR_SERVICES: 'amasa_coordinator_services_v1',
  COORDINATORS: 'amasa_coordinators_v1',
  COORDINATOR_ID: 'amasa_coordinator_id_v1',
  EXPENSES: 'amasa_expenses_v1',
  GUARD_TASKS: 'amasa_guard_tasks_v1',
  GUARD_TASK_TEMPLATES: 'amasa_guard_task_templates_v1',
  SPECIAL_ADMIN_FEE_BOXES: 'amasa_special_admin_fee_boxes_v1',
  SUPERVISOR_OVERRIDES: 'amasa_supervisor_overrides_v1',
  SUPERVISOR_CUSTOM_RATES: 'amasa_supervisor_custom_rates_v1',
  KAYAN_ITEMS: 'amasa_kayan_items_v1',
  KAYAN_SETTINGS: 'amasa_kayan_settings_v1',
  KAYAN_ORDERS: 'amasa_kayan_orders_v1',
  KAYAN_DRAFT: 'amasa_kayan_draft_v1',
} as const;

const demoMemoryStorage = new Map<string, string>();

export class StorageService {
  static get<T>(key: string, fallback: T): T {
    try {
      if (isPersonalDemoMode()) {
        const demoVal = demoMemoryStorage.get(key);
        if (demoVal === undefined) return fallback;
        return JSON.parse(demoVal) as T;
      }
      const val = localStorage.getItem(key);
      if (val === null || val === undefined) return fallback;
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }

  static getString(key: string, fallback: string): string {
    try {
      if (isPersonalDemoMode()) {
        const demoVal = demoMemoryStorage.get(key);
        return demoVal !== undefined ? demoVal : fallback;
      }
      const val = localStorage.getItem(key);
      return val !== null && val !== undefined ? val : fallback;
    } catch {
      return fallback;
    }
  }

  static set<T>(key: string, value: T): void {
    try {
      if (isPersonalDemoMode()) {
        demoMemoryStorage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        return;
      }
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e: any) {
      console.warn(`Storage save error for key ${key}:`, e);
      // Quota exceeded fallback: Clean up non-essential caches and retry
      if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.number === -2147024882) {
        try {
          // Remove old volatile logs or temporary items if quota is filled
          const nonCriticalKeys = [
            'gathern_logs_v3',
            'gathern_notifications_v3',
            'property_calendar_sync_status',
            'amasa_media_cache_v1',
          ];
          for (const k of nonCriticalKeys) {
            if (k !== key) {
              try { localStorage.removeItem(k); } catch {}
            }
          }
          // Retry setting the key
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          } else {
            localStorage.setItem(key, JSON.stringify(value));
          }
        } catch (retryErr) {
          console.error(`Persistent quota exceeded for key ${key}:`, retryErr);
        }
      }
    }
  }

  static remove(key: string): void {
    try {
      if (isPersonalDemoMode()) {
        demoMemoryStorage.delete(key);
        return;
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Storage remove error for key ${key}:`, e);
    }
  }

  static clear(): void {
    try {
      if (isPersonalDemoMode()) {
        demoMemoryStorage.clear();
        return;
      }
      localStorage.clear();
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
  }
}
