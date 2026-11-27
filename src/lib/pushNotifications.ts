import { doesPushSubscriberMatchTarget, PushSubscriberMeta, PushTargetSpec } from './pushMatching';

export interface WebPushSyncResult {
  supported: boolean;
  subscribed: boolean;
  endpoint: string | null;
  reason?: string;
}

export interface RemotePushPayload extends PushTargetSpec {
  id?: string;
  title: string;
  body: string;
  type?: string;
  url?: string;
  silent?: boolean;
  senderEndpoint?: string | null;
  includeSelf?: boolean;
}

let cachedEndpoint: string | null = null;

export const getCachedPushEndpoint = (): string | null => cachedEndpoint;

export const isWebPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    const readyPromise = navigator.serviceWorker.ready.catch(() => null);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    return await Promise.race([readyPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

export async function syncWebPushSubscription(userMeta: PushSubscriberMeta): Promise<WebPushSyncResult> {
  if (!isWebPushSupported()) {
    return { supported: false, subscribed: false, endpoint: null, reason: 'unsupported' };
  }
  if (Notification.permission !== 'granted') {
    return { supported: true, subscribed: false, endpoint: null, reason: 'permission_not_granted' };
  }

  try {
    const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
    if (!keyRes.ok) {
      return { supported: true, subscribed: false, endpoint: null, reason: 'server_unavailable' };
    }
    const keyJson = (await keyRes.json()) as { supported?: boolean; publicKey?: string };
    if (!keyJson?.supported || !keyJson.publicKey) {
      return { supported: true, subscribed: false, endpoint: null, reason: 'no_vapid_key' };
    }

    const reg = await getSwRegistration();
    if (!reg || !reg.pushManager) {
      return { supported: true, subscribed: false, endpoint: null, reason: 'no_sw_registration' };
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
      });
    }

    const subJson = sub.toJSON();
    cachedEndpoint = subJson.endpoint || sub.endpoint || null;

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subJson,
        user: userMeta,
      }),
    });

    return {
      supported: true,
      subscribed: true,
      endpoint: cachedEndpoint,
    };
  } catch (err) {
    console.warn('Web Push subscription sync failed:', err);
    return {
      supported: true,
      subscribed: false,
      endpoint: cachedEndpoint,
      reason: err instanceof Error ? err.message : 'subscribe_error',
    };
  }
}

export async function unsubscribeFromWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const reg = await getSwRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    cachedEndpoint = null;
  } catch {}
}

export async function dispatchRemotePushNotification(payload: RemotePushPayload): Promise<void> {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        senderEndpoint: payload.senderEndpoint ?? cachedEndpoint,
      }),
    });
  } catch {
    // Non-blocking best-effort background push
  }
}

export async function sendSelfTestWebPush(meta?: PushSubscriberMeta): Promise<boolean> {
  try {
    if (!cachedEndpoint && meta) {
      const synced = await syncWebPushSubscription(meta);
      if (!synced.subscribed) return false;
    }
    if (!cachedEndpoint) return false;
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: cachedEndpoint }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { doesPushSubscriberMatchTarget };
