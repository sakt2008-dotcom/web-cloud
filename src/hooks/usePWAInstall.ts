import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface ApkInfoState {
  checked: boolean;
  /** true only when the Node/Express backend answered (false on static hosting such as CyberPanel/cPanel) */
  serverOnline: boolean;
  available: boolean;
  fileName: string | null;
  size: number;
  downloadUrl: string | null;
}

type Listener = () => void;

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled = false;
let globalApkInfo: ApkInfoState = {
  checked: false,
  serverOnline: false,
  available: false,
  fileName: null,
  size: 0,
  downloadUrl: null,
};
let listenersInitialized = false;
const subscribers = new Set<Listener>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function initPWAInstallListeners() {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  globalIsInstalled = detectStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    notifySubscribers();
  });

  const media = window.matchMedia('(display-mode: standalone)');
  if (media?.addEventListener) {
    media.addEventListener('change', (ev) => {
      if (ev.matches) {
        globalIsInstalled = true;
        globalDeferredPrompt = null;
        notifySubscribers();
      }
    });
  }

  fetch('/api/apk-info', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) {
        globalApkInfo = { ...globalApkInfo, checked: true, serverOnline: false, available: false };
      } else {
        globalApkInfo = {
          checked: true,
          serverOnline: true,
          available: Boolean(data.available),
          fileName: data.fileName || null,
          size: Number(data.size) || 0,
          downloadUrl: data.downloadUrl || null,
        };
      }
      notifySubscribers();
    })
    .catch(() => {
      // static hosting returns index.html for unknown routes → JSON parse fails → treated as "no backend"
      globalApkInfo = { ...globalApkInfo, checked: true, serverOnline: false, available: false };
      notifySubscribers();
    });
}

// Initialize immediately on module evaluation so early beforeinstallprompt events are never missed
if (typeof window !== 'undefined') {
  initPWAInstallListeners();
}

export function triggerDirectApkDownload(downloadUrl: string, fileName?: string | null) {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', fileName || 'amasa-resort.apk');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    initPWAInstallListeners();

    const onUpdate = () => setTick((n) => n + 1);
    subscribers.add(onUpdate);

    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(!isIOSDevice && !isAndroidDevice);

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    return () => {
      subscribers.delete(onUpdate);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false;
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        globalIsInstalled = true;
        globalDeferredPrompt = null;
        notifySubscribers();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('PWA install prompt failed:', err);
      return false;
    }
  }, []);

  return {
    isInstallable: !!globalDeferredPrompt,
    isInstalled: globalIsInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    isInIframe,
    apkInfo: globalApkInfo,
    install,
    deferredPrompt: globalDeferredPrompt,
  };
}
