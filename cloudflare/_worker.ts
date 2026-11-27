/**
 * AMASA RESORT — Cloudflare Pages (Advanced Mode) worker.
 * يخدم الملفات الثابتة كما هي، ويضيف واجهة /api/push/* لإشعارات الخلفية (شاشة القفل + نغمة النظام).
 * يحتاج ربط KV باسم PUSH_KV (انظر README-CLOUDFLARE-PUSH.txt). مفاتيح VAPID تُنشأ تلقائياً وتُحفظ في KV.
 */
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { doesPushSubscriberMatchTarget } from '../src/lib/pushMatching';

interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
interface Env {
  PUSH_KV?: KVLike;
  ASSETS: { fetch(req: Request): Promise<Response> };
  VAPID_SUBJECT?: string;
}
interface Sub {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
  user: Record<string, unknown>;
  updatedAt: number;
}
interface Vapid {
  publicKey: string;
  privateKey: string;
}

const MAX_TARGETS = 40; // حد الطلبات الفرعية في الخطة المجانية = 50 لكل طلب
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function loadVapid(kv: KVLike): Promise<Vapid> {
  const saved = await kv.get('vapid');
  if (saved) {
    try {
      const p = JSON.parse(saved);
      if (p?.publicKey && p?.privateKey) return p;
    } catch {
      /* يُعاد التوليد */
    }
  }
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const pub = new Uint8Array(65);
  pub[0] = 4;
  pub.set(fromB64u(jwk.x as string), 1);
  pub.set(fromB64u(jwk.y as string), 33);
  const vapid = { publicKey: b64u(pub), privateKey: jwk.d as string };
  await kv.put('vapid', JSON.stringify(vapid));
  return vapid;
}
async function loadSubs(kv: KVLike): Promise<Sub[]> {
  try {
    const list = JSON.parse((await kv.get('subs')) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function deliver(sub: Sub, data: Record<string, unknown>, vapid: Vapid, subject: string, ttl: number) {
  const init = await buildPushPayload(
    { data: data as never, options: { ttl, urgency: 'high' } },
    { endpoint: sub.endpoint, expirationTime: sub.expirationTime, keys: sub.keys },
    { subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }
  );
  const res = await fetch(sub.endpoint, init as RequestInit);
  return res.status;
}

async function handlePush(request: Request, env: Env, path: string): Promise<Response> {
  const kv = env.PUSH_KV;
  if (!kv) return json({ supported: false, ok: false, error: 'PUSH_KV binding missing' }, 503);
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin && origin !== url.origin) return json({ ok: false, error: 'forbidden' }, 403);
  const subject = env.VAPID_SUBJECT || `mailto:admin@${url.hostname}`;
  const vapid = await loadVapid(kv);

  if (path === '/api/push/public-key' && request.method === 'GET') {
    const subs = await loadSubs(kv);
    return json({ supported: true, publicKey: vapid.publicKey, subscriberCount: subs.length });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, any>;

  if (path === '/api/push/subscribe') {
    const s = body.subscription;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return json({ ok: false, error: 'Invalid push subscription payload' }, 400);
    const subs = await loadSubs(kv);
    const user = body.user && typeof body.user === 'object' ? body.user : {};
    const entry: Sub = {
      endpoint: s.endpoint,
      expirationTime: s.expirationTime ?? null,
      keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) },
      user,
      updatedAt: Date.now(),
    };
    const i = subs.findIndex((x) => x.endpoint === entry.endpoint);
    // نكتب فقط عند التغيّر (حد الكتابة المجاني في KV = 1000/يوم)
    if (i === -1 || JSON.stringify(subs[i].user) !== JSON.stringify(user) || Date.now() - subs[i].updatedAt > 86400000) {
      if (i === -1) subs.push(entry);
      else subs[i] = entry;
      await kv.put('subs', JSON.stringify(subs));
    }
    return json({ ok: true, subscriberCount: subs.length });
  }

  if (path === '/api/push/unsubscribe') {
    const subs = await loadSubs(kv);
    const next = subs.filter((x) => x.endpoint !== body.endpoint);
    if (next.length !== subs.length) await kv.put('subs', JSON.stringify(next));
    return json({ ok: true });
  }

  if (path === '/api/push/send') {
    const subs = await loadSubs(kv);
    const senderEndpoint = typeof body.senderEndpoint === 'string' ? body.senderEndpoint : null;
    const includeSelf = Boolean(body.includeSelf);
    const targets = subs
      .filter((s) => (includeSelf || !senderEndpoint || s.endpoint !== senderEndpoint) && doesPushSubscriberMatchTarget(s.user as never, body))
      .slice(0, MAX_TARGETS);
    if (!targets.length) return json({ ok: true, sent: 0, failed: 0 });
    const wire = {
      title: typeof body.title === 'string' && body.title ? body.title : 'AMASA RESORT',
      body: typeof body.body === 'string' ? body.body : '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: body.id ? `amasa-${body.id}` : `amasa-push-${Date.now()}`,
      url: body.url || '/',
      type: body.type || 'system',
      notifId: body.id || '',
      silent: Boolean(body.silent),
      vibrate: [240, 100, 240, 100, 300],
    };
    let sent = 0;
    let failed = 0;
    const dead = new Set<string>();
    await Promise.all(
      targets.map(async (t) => {
        try {
          const st = await deliver(t, wire, vapid, subject, 86400);
          if (st >= 200 && st < 300) sent++;
          else {
            failed++;
            if (st === 404 || st === 410) dead.add(t.endpoint);
          }
        } catch {
          failed++;
        }
      })
    );
    if (dead.size) await kv.put('subs', JSON.stringify(subs.filter((x) => !dead.has(x.endpoint))));
    return json({ ok: true, sent, failed });
  }

  if (path === '/api/push/test') {
    const subs = await loadSubs(kv);
    const sub = subs.find((x) => x.endpoint === body.endpoint);
    if (!sub) return json({ ok: false, error: 'Push subscription not found' }, 404);
    try {
      const st = await deliver(
        sub,
        {
          title: 'تجربة إشعار الخلفية — AMASA RESORT',
          body: 'تم تفعيل إشعارات وصوت الجوال بنجاح حتى عند تصغير التطبيق أو إغلاقه.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `amasa-push-test-${Date.now()}`,
          url: '/',
          type: 'deposit_confirmed',
          silent: false,
          vibrate: [240, 100, 240, 100, 300],
        },
        vapid,
        subject,
        300
      );
      if (st >= 200 && st < 300) return json({ ok: true });
      if (st === 404 || st === 410) await kv.put('subs', JSON.stringify(subs.filter((x) => x.endpoint !== sub.endpoint)));
      return json({ ok: false, error: `push service status ${st}` }, 500);
    } catch (e) {
      return json({ ok: false, error: (e as Error)?.message || 'Push test failed' }, 500);
    }
  }

  return json({ ok: false, error: 'not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/push/')) {
      try {
        return await handlePush(request, env, pathname);
      } catch (e) {
        return json({ ok: false, error: (e as Error)?.message || 'error' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
