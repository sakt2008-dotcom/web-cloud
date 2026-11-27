import { useEffect, useState } from 'react';
import { isGoogleSignInPending } from '../services/googleAuth';

declare const __APP_BUILD_ID__: string | undefined;
declare const __APP_BUILD_TIME__: string | undefined;

export interface PwaUpdateState {
  buildId: string;
  builtAt: string;
  updateAvailable: boolean;
  isChecking: boolean;
  isApplying: boolean;
  lastCheckedAt: number | null;
  statusMessage: string | null;
}

export function isNewerBuildAvailable(
  currentBuildId: string | undefined,
  remoteBuildId: string | undefined
): boolean {
  if (!currentBuildId || !remoteBuildId) return false;
  if (currentBuildId === 'dev-live' || remoteBuildId === 'dev-live') return false;
  return currentBuildId.trim() !== remoteBuildId.trim();
}

const INITIAL_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__ ? __APP_BUILD_ID__ : 'dev-live';
const INITIAL_BUILT_AT =
  typeof __APP_BUILD_TIME__ !== 'undefined' && __APP_BUILD_TIME__ ? __APP_BUILD_TIME__ : '';

let state: PwaUpdateState = {
  buildId: INITIAL_BUILD_ID,
  builtAt: INITIAL_BUILT_AT,
  updateAvailable: false,
  isChecking: false,
  isApplying: false,
  lastCheckedAt: null,
  statusMessage: null,
};

let swRegistrationRef: ServiceWorkerRegistration | null = null;
let updateSwFnRef: ((reloadPage?: boolean) => Promise<void>) | null = null;
let controllerChangeBound = false;
let autoListenersBound = false;
let isReloading = false;
let lastVersionCheckMs = 0;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function setState(patch: Partial<PwaUpdateState>) {
  state = { ...state, ...patch };
  notify();
}

export function getPwaUpdateState(): PwaUpdateState {
  return state;
}

export function bindServiceWorkerControllerReload(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || controllerChangeBound) {
    return;
  }
  controllerChangeBound = true;
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !isReloading) {
      isReloading = true;
      window.location.reload();
    }
  });
}

export function registerPwaUpdateController(
  registration: ServiceWorkerRegistration | undefined,
  updateSwFn: (reloadPage?: boolean) => Promise<void>
): void {
  if (registration) {
    swRegistrationRef = registration;
  }
  updateSwFnRef = updateSwFn;
  bindServiceWorkerControllerReload();
  attachAutoUpdateListeners();
  // Immediate non-blocking check right after boot
  void checkForAppUpdate({ autoApply: true, force: true });
}

export function markPwaUpdateAvailable(): void {
  setState({
    updateAvailable: true,
    statusMessage: 'يتوفر تحديث جديد للتطبيق جاهز للتطبيق الفوري.',
  });
}

async function fetchRemoteBuildVersion(): Promise<{ buildId?: string; builtAt?: string } | null> {
  const candidates = [`/version.json?t=${Date.now()}`, `/api/version?t=${Date.now()}`];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { buildId?: string; builtAt?: string };
        if (json?.buildId) return json;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function applyAppUpdateNow(): Promise<void> {
  if (typeof window === 'undefined' || state.isApplying) return;
  setState({
    isApplying: true,
    statusMessage: 'جاري تنزيل وتفعيل أحدث إصدار الآن...',
  });

  try {
    if (swRegistrationRef) {
      await swRegistrationRef.update().catch(() => {});
      if (swRegistrationRef.waiting) {
        try {
          swRegistrationRef.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {}
      }
    }

    if (updateSwFnRef) {
      void updateSwFnRef(true).catch(() => {});
    }

    // Clear stale Workbox / asset HTTP caches while keeping user login & IndexedDB intact
    if ('caches' in window) {
      const cacheNames = await caches.keys().catch(() => [] as string[]);
      await Promise.all(
        cacheNames
          .filter((name) => !name.includes('google-fonts') && !name.includes('gstatic-fonts'))
          .map((name) => caches.delete(name).catch(() => false))
      );
    }
  } finally {
    setTimeout(() => {
      if (!isReloading) {
        isReloading = true;
        window.location.reload();
      }
    }, 650);
  }
}

export async function checkForAppUpdate(options?: {
  autoApply?: boolean;
  force?: boolean;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  if (!options?.force && now - lastVersionCheckMs < 15000) {
    return state.updateAvailable;
  }
  lastVersionCheckMs = now;

  setState({ isChecking: true });
  try {
    if (swRegistrationRef) {
      await swRegistrationRef.update().catch(() => {});
      if (swRegistrationRef.waiting) {
        setState({
          updateAvailable: true,
          isChecking: false,
          lastCheckedAt: now,
          statusMessage: 'يتوفر تحديث جديد للتطبيق جاهز للتشغيل.',
        });
        if (options?.autoApply) {
          await applyAppUpdateNow();
        }
        return true;
      }
    }

    const remote = await fetchRemoteBuildVersion();
    const hasNewer = isNewerBuildAvailable(state.buildId, remote?.buildId);

    setState({
      updateAvailable: hasNewer || state.updateAvailable,
      isChecking: false,
      lastCheckedAt: now,
      statusMessage:
        hasNewer || state.updateAvailable
          ? 'تم اكتشاف إصدار جديد — جاهز للتحديث الفوري بدون حذف التطبيق.'
          : options?.force
          ? 'أنت تستخدم أحدث إصدار من التطبيق بالفعل.'
          : state.statusMessage,
    });

    if (hasNewer && options?.autoApply) {
      await applyAppUpdateNow();
    }

    return hasNewer || state.updateAvailable;
  } catch {
    setState({ isChecking: false, lastCheckedAt: now });
    return state.updateAvailable;
  }
}

export function attachAutoUpdateListeners(): void {
  if (typeof window === 'undefined' || autoListenersBound) return;
  autoListenersBound = true;

  // When a marketer reopens the installed Home Screen app from background, check & apply updates immediately (unless Google login popup is active)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForAppUpdate({ autoApply: !isGoogleSignInPending() });
    }
  });

  window.addEventListener('online', () => {
    void checkForAppUpdate({ autoApply: false });
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void checkForAppUpdate({ autoApply: false });
    }
  }, 3 * 60 * 1000);
}

export function usePwaUpdate() {
  const [snapshot, setSnapshot] = useState<PwaUpdateState>(() => state);

  useEffect(() => {
    const onChange = () => setSnapshot(state);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return {
    ...snapshot,
    checkForUpdate: () => checkForAppUpdate({ autoApply: false, force: true }),
    applyUpdateNow: applyAppUpdateNow,
  };
}
