/**
 * AMASA Audio & Notification Dispatcher
 * - Generates an offline 16-bit PCM WAV chime in memory (no broken/remote audio files)
 * - Maintains a persistent AudioContext + pre-unlocked HTMLAudioElement for Android/iOS Chrome PWA
 * - Prefers ServiceWorkerRegistration.showNotification() so notifications work inside installed Home Screen PWAs
 */

export const isBrowserNotificationSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export const isStandalonePwaMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

export const getBrowserNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return Notification.permission;
  }
};

/**
 * Generates a valid 16-bit mono PCM WAV byte array for the AMASA 3-tone notification chime.
 * Works completely offline and inside standalone PWAs without external network requests.
 */
export function createChimeWavBytes(sampleRate = 22050): Uint8Array {
  const tones = [
    { freq: 739.99, start: 0.0, duration: 0.2, gain: 0.34 },
    { freq: 932.33, start: 0.09, duration: 0.24, gain: 0.38 },
    { freq: 1108.73, start: 0.18, duration: 0.38, gain: 0.44 },
  ];

  const totalDuration = 0.62;
  const numSamples = Math.floor(sampleRate * totalDuration);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const tone of tones) {
      const localT = t - tone.start;
      if (localT >= 0 && localT <= tone.duration) {
        const attack = Math.min(1, localT / 0.015);
        const decay = Math.exp(-localT * 8.5);
        // Fundamental + gentle octave overtone for clarity on tiny phone speakers
        const wave =
          Math.sin(2 * Math.PI * tone.freq * localT) * 0.82 +
          Math.sin(2 * Math.PI * tone.freq * 2 * localT) * 0.18;
        sample += wave * attack * decay * tone.gain;
      }
    }

    const clamped = Math.max(-0.98, Math.min(0.98, sample));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  return new Uint8Array(buffer);
}

let sharedAudioCtx: AudioContext | null = null;
let sharedChimeUrl: string | null = null;
let sharedChimeAudio: HTMLAudioElement | null = null;
let htmlAudioUnlocked = false;
let webAudioUnlocked = false;
let autoUnlockListenersBound = false;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioCtx) return sharedAudioCtx;
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    sharedAudioCtx = new AudioContextClass();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function getSharedChimeAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (sharedChimeAudio) return sharedChimeAudio;
  try {
    if (!sharedChimeUrl) {
      const wavBytes = createChimeWavBytes(22050);
      const copyBuffer = new ArrayBuffer(wavBytes.byteLength);
      new Uint8Array(copyBuffer).set(wavBytes);
      const blob = new Blob([copyBuffer], { type: 'audio/wav' });
      sharedChimeUrl = URL.createObjectURL(blob);
    }
    const audio = new Audio(sharedChimeUrl);
    audio.preload = 'auto';
    sharedChimeAudio = audio;
    return sharedChimeAudio;
  } catch {
    return null;
  }
}

function scheduleWebAudioChime(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const playTone = (freq: number, startOffset: number, duration: number, gainLevel: number) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.linearRampToValueAtTime(gainLevel, now + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    } catch {}
  };

  playTone(739.99, 0, 0.25, 0.28);
  playTone(932.33, 0.09, 0.35, 0.32);
  playTone(1108.73, 0.18, 0.5, 0.38);
}

function playFallbackHtmlAudio(): void {
  const audio = getSharedChimeAudio();
  if (!audio) return;
  try {
    audio.muted = false;
    audio.volume = 0.9;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {}
}

/**
 * Unlocks both Web Audio (persistent singleton AudioContext) and HTMLAudioElement on user touch/tap.
 * Must keep persistent context + audio element rather than creating throwaway instances.
 */
export const unlockMobileAudio = (): void => {
  if (typeof window === 'undefined') return;

  const ctx = getSharedAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().then(() => {
          webAudioUnlocked = ctx.state === 'running';
        }).catch(() => {});
      } else if (ctx.state === 'running') {
        webAudioUnlocked = true;
      }

      // 1-sample silent buffer unlock required by Android Chrome & iOS Safari
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {}
  }

  // Unlock the reusable HTMLAudio chime element silently inside the user gesture
  if (!htmlAudioUnlocked) {
    const audio = getSharedChimeAudio();
    if (audio) {
      try {
        audio.muted = true;
        audio.volume = 0;
        const p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = 0.9;
            htmlAudioUnlocked = true;
          }).catch(() => {
            audio.muted = false;
            audio.volume = 0.9;
          });
        }
      } catch {
        audio.muted = false;
        audio.volume = 0.9;
      }
    }
  }
};

/**
 * Registers global touch/pointer/click listeners that keep unlocking audio until both engines are ready.
 */
export const initMobileAudioUnlock = (): (() => void) => {
  if (typeof window === 'undefined' || autoUnlockListenersBound) {
    return () => {};
  }
  autoUnlockListenersBound = true;

  const handler = () => {
    unlockMobileAudio();
    if (webAudioUnlocked && htmlAudioUnlocked) {
      cleanup();
    }
  };

  const cleanup = () => {
    autoUnlockListenersBound = false;
    window.removeEventListener('touchstart', handler);
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('click', handler);
    window.removeEventListener('keydown', handler);
  };

  window.addEventListener('touchstart', handler, { passive: true });
  window.addEventListener('pointerdown', handler, { passive: true });
  window.addEventListener('click', handler, { passive: true });
  window.addEventListener('keydown', handler, { passive: true });

  return cleanup;
};

export const playChimeSound = (enabled = true): void => {
  if (!enabled || typeof window === 'undefined') return;

  const ctx = getSharedAudioContext();
  if (ctx) {
    if (ctx.state === 'running') {
      scheduleWebAudioChime(ctx);
      return;
    }

    // Attempt async resume; if Chrome blocks resume outside a direct tap, fall back to unlocked HTMLAudio
    try {
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') {
            scheduleWebAudioChime(ctx);
          } else {
            playFallbackHtmlAudio();
          }
        })
        .catch(() => {
          playFallbackHtmlAudio();
        });
      return;
    } catch {
      playFallbackHtmlAudio();
      return;
    }
  }

  playFallbackHtmlAudio();
};

/**
 * Mobile Haptic Vibration Trigger
 */
export const triggerMobileVibration = (pattern: number | number[] = [180, 70, 180]): void => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
};

async function getActiveServiceWorkerRegistration(timeoutMs = 1500): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;

    const readyPromise = navigator.serviceWorker.ready.catch(() => null);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([readyPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

export interface SystemNotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  type?: string;
  url?: string;
  notifId?: string;
  playSound?: boolean;
  vibrate?: boolean;
  silent?: boolean;
  onClick?: () => void;
}

/**
 * Triggers a native OS/mobile notification.
 * Uses ServiceWorkerRegistration.showNotification() first because Android Chrome and installed Home Screen PWAs
 * block `new Notification()` and throw TypeError: Illegal constructor.
 */
export const triggerSystemNotification = async (
  title: string,
  options?: SystemNotificationOptions
): Promise<boolean> => {
  if (options?.playSound !== false) {
    playChimeSound(true);
  }

  if (options?.vibrate !== false) {
    triggerMobileVibration([180, 70, 180]);
  }

  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const iconUrl = options?.icon || '/pwa-192x192.png';
  const tag = options?.tag || `amasa-notif-${Date.now()}`;
  const notifOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
  } = {
    body: options?.body || '',
    icon: iconUrl,
    badge: '/pwa-192x192.png',
    tag,
    dir: 'rtl',
    lang: 'ar',
    renotify: true,
    silent: Boolean(options?.silent),
    vibrate: [220, 90, 220, 90, 260],
    data: {
      url: options?.url || '/',
      type: options?.type || 'system',
      notifId: options?.notifId || '',
    },
  };

  // 1. Preferred Android Chrome / PWA Home Screen path: ServiceWorkerRegistration.showNotification()
  try {
    const reg = await getActiveServiceWorkerRegistration();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, notifOptions);
      return true;
    }
  } catch (err) {
    console.warn('ServiceWorker showNotification failed, attempting fallback:', err);
  }

  // 2. Fallback for desktop browsers / environments without an active SW registration
  try {
    const notif = new Notification(title, notifOptions);

    notif.onclick = () => {
      try {
        window.focus();
        options?.onClick?.();
      } catch {}
      notif.close();
    };

    setTimeout(() => {
      try {
        notif.close();
      } catch {}
    }, 7000);

    return true;
  } catch (err) {
    console.warn('Failed to display browser notification:', err);
    return false;
  }
};
