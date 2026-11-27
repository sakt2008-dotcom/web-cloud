import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type webpushType from 'web-push';
import { doesPushSubscriberMatchTarget, PushSubscriberMeta } from './src/lib/pushMatching';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof webpushType;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PACKAGES_DIR = path.join(__dirname, 'public');
const APK_DIR = path.join(__dirname, 'apk');
if (!fs.existsSync(APK_DIR)) {
  fs.mkdirSync(APK_DIR, { recursive: true });
}

const isZipFileValid = (filePath: string, minBytes = 50 * 1024): boolean => {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < minBytes) return false;
    const fd = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(4);
      const bytesRead = fs.readSync(fd, header, 0, 4, 0);
      return bytesRead === 4 && header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
};

const ensurePackagesBuilt = (force = false) => {
  const reqFiles: Array<[string, number]> = [
    ['amasa-dist.zip', 50 * 1024],
    ['amasa-source.zip', 50 * 1024],
    ['amasa-claude-starter.zip', 1024],
    ['amasa-android-studio.zip', 50 * 1024],
  ];
  const allValid = !force && reqFiles.every(([f, minSz]) => isZipFileValid(path.join(PACKAGES_DIR, f), minSz));
  if (!allValid) {
    try {
      execSync('python3 scripts/make_zips.py', { cwd: __dirname, stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to generate packages:', e);
    }
  }
};

const sendZipFile = (res: express.Response, zipFileName: string, notFoundMsg: string, minBytes = 50 * 1024) => {
  ensurePackagesBuilt();
  const filePath = path.join(PACKAGES_DIR, zipFileName);
  if (!isZipFileValid(filePath, minBytes)) {
    ensurePackagesBuilt(true);
  }
  if (fs.existsSync(filePath) && isZipFileValid(filePath, minBytes)) {
    const buffer = fs.readFileSync(filePath);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.status(200).send(buffer);
  }
  return res.status(404).send(notFoundMsg);
};

app.get(['/download/dist', '/amasa-dist.zip'], (_req, res) => {
  return sendZipFile(res, 'amasa-dist.zip', 'Distribution package not found.');
});

app.get(['/download/source', '/download/clean-source', '/download/unconstrained', '/download/base44', '/amasa-source.zip'], (_req, res) => {
  return sendZipFile(res, 'amasa-source.zip', 'Source package not found.');
});

app.get(['/download/claude-starter', '/amasa-claude-starter.zip'], (_req, res) => {
  return sendZipFile(res, 'amasa-claude-starter.zip', 'Starter blueprint package not found.', 1024);
});

app.get(['/download/android-studio', '/amasa-android-studio.zip'], (_req, res) => {
  return sendZipFile(res, 'amasa-android-studio.zip', 'Android Studio package not found.', 50 * 1024);
});

app.get('/api/raw-file', (req, res) => {
  const fileRel = req.query.file as string;
  if (!fileRel || fileRel.includes('..')) {
    return res.status(400).send('Invalid file path');
  }
  const filePath = path.join(__dirname, fileRel);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    return res.sendFile(filePath);
  }
  return res.status(404).send('File not found');
});

app.get('/api/health', (_req, res) => {
  return res.json({ ok: true, uploadSupported: true, webPushSupported: true });
});

const DEV_SERVER_STARTED_AT = new Date().toISOString();
app.get(['/version.json', '/api/version'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (process.env.NODE_ENV !== 'production') {
    return res.json({ buildId: 'dev-live', builtAt: DEV_SERVER_STARTED_AT });
  }

  const distVersionFile = path.join(__dirname, 'dist', 'version.json');
  try {
    if (fs.existsSync(distVersionFile)) {
      const data = JSON.parse(fs.readFileSync(distVersionFile, 'utf8'));
      return res.json(data);
    }
  } catch {}
  return res.json({ buildId: 'prod-live', builtAt: DEV_SERVER_STARTED_AT });
});

// =========================================================================
// Web Push (VAPID) Setup for Background & Home Screen PWA Mobile Alerts
// =========================================================================
const RUNTIME_DIR = path.join(__dirname, '.runtime');
const VAPID_KEYS_FILE = path.join(RUNTIME_DIR, 'vapid-keys.json');
const PUSH_SUBS_FILE = path.join(RUNTIME_DIR, 'push-subscriptions.json');

interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  user: PushSubscriberMeta;
  updatedAt: number;
}

function ensureRuntimeDir() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
}

function loadOrCreateVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@amasa.sa';
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject,
    };
  }
  ensureRuntimeDir();
  try {
    if (fs.existsSync(VAPID_KEYS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf8'));
      if (parsed?.publicKey && parsed?.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey, subject };
      }
    }
  } catch {
    // regenerate if unreadable
  }
  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(generated, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist VAPID keys to disk:', err);
  }
  return { publicKey: generated.publicKey, privateKey: generated.privateKey, subject };
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

function loadPushSubscriptions(): Map<string, StoredPushSubscription> {
  ensureRuntimeDir();
  const map = new Map<string, StoredPushSubscription>();
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      const list = JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.endpoint && item?.keys?.p256dh && item?.keys?.auth) {
            map.set(item.endpoint, item);
          }
        }
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return map;
}

const pushSubscriptionsMap = loadPushSubscriptions();

function savePushSubscriptions() {
  ensureRuntimeDir();
  try {
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(Array.from(pushSubscriptionsMap.values()), null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed saving push subscriptions:', err);
  }
}

app.get('/api/push/public-key', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    supported: true,
    publicKey: vapidKeys.publicKey,
    subscriberCount: pushSubscriptionsMap.size,
  });
});

app.post('/api/push/subscribe', (req, res) => {
  const { subscription, user } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ ok: false, error: 'Invalid push subscription payload' });
  }
  pushSubscriptionsMap.set(subscription.endpoint, {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: String(subscription.keys.p256dh),
      auth: String(subscription.keys.auth),
    },
    user: user && typeof user === 'object' ? user : {},
    updatedAt: Date.now(),
  });
  savePushSubscriptions();
  return res.json({ ok: true, subscriberCount: pushSubscriptionsMap.size });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint === 'string' && pushSubscriptionsMap.has(endpoint)) {
    pushSubscriptionsMap.delete(endpoint);
    savePushSubscriptions();
  }
  return res.json({ ok: true });
});

app.post('/api/push/send', async (req, res) => {
  const payload = req.body || {};
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'AMASA RESORT';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const senderEndpoint = typeof payload.senderEndpoint === 'string' ? payload.senderEndpoint : null;
  const includeSelf = Boolean(payload.includeSelf);

  const targets = Array.from(pushSubscriptionsMap.values()).filter((sub) => {
    if (!includeSelf && senderEndpoint && sub.endpoint === senderEndpoint) {
      return false;
    }
    return doesPushSubscriberMatchTarget(sub.user, payload);
  });

  if (targets.length === 0) {
    return res.json({ ok: true, sent: 0, failed: 0 });
  }

  const wirePayload = JSON.stringify({
    title,
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.id ? `amasa-${payload.id}` : `amasa-push-${Date.now()}`,
    url: payload.url || '/',
    type: payload.type || 'system',
    notifId: payload.id || '',
    silent: Boolean(payload.silent),
    vibrate: [240, 100, 240, 100, 300],
  });

  let sent = 0;
  let failed = 0;
  let pruned = false;

  await Promise.all(
    targets.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? null,
            keys: sub.keys,
          },
          wirePayload,
          { TTL: 86400, urgency: 'high' }
        );
        sent += 1;
      } catch (err: any) {
        failed += 1;
        const statusCode = Number(err?.statusCode || err?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          pushSubscriptionsMap.delete(sub.endpoint);
          pruned = true;
        }
      }
    })
  );

  if (pruned) savePushSubscriptions();
  return res.json({ ok: true, sent, failed });
});

app.post('/api/push/test', async (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== 'string' || !pushSubscriptionsMap.has(endpoint)) {
    return res.status(404).json({ ok: false, error: 'Push subscription not found' });
  }
  const sub = pushSubscriptionsMap.get(endpoint)!;
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: sub.keys,
      },
      JSON.stringify({
        title: '🔔 تجربة إشعار الخلفية — AMASA RESORT',
        body: 'تم تفعيل إشعارات وصوت الجوال بنجاح حتى عند تصغير التطبيق أو إغلاقه.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `amasa-push-test-${Date.now()}`,
        url: '/',
        type: 'deposit_confirmed',
        silent: false,
        vibrate: [240, 100, 240, 100, 300],
      }),
      { TTL: 300, urgency: 'high' }
    );
    return res.json({ ok: true });
  } catch (err: any) {
    const statusCode = Number(err?.statusCode || err?.status || 0);
    if (statusCode === 404 || statusCode === 410) {
      pushSubscriptionsMap.delete(endpoint);
      savePushSubscriptions();
    }
    return res.status(500).json({ ok: false, error: err?.message || 'Push test failed' });
  }
});

const findAvailableApkFile = (): { fileName: string; filePath: string; size: number } | null => {
  const candidates = ['amasa-resort.apk', 'amasa.apk', 'app-release.apk', 'app-debug.apk'];
  const searchDirs = [APK_DIR, PACKAGES_DIR];
  for (const dir of searchDirs) {
    try {
      const dirFiles = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      const allCandidates = [...candidates, ...dirFiles.filter((f) => f.toLowerCase().endsWith('.apk'))];
      for (const fileName of allCandidates) {
        const filePath = path.join(dir, fileName);
        if (isZipFileValid(filePath, 1024)) {
          const stat = fs.statSync(filePath);
          return { fileName, filePath, size: stat.size };
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
};

app.get('/api/apk-info', (_req, res) => {
  const apk = findAvailableApkFile();
  if (!apk) {
    return res.json({ available: false, fileName: null, size: 0, downloadUrl: null, folder: 'apk' });
  }
  return res.json({
    available: true,
    fileName: apk.fileName,
    size: apk.size,
    downloadUrl: `/download/apk`,
    folder: 'apk',
  });
});

app.get(['/download/apk', '/amasa-resort.apk'], (_req, res) => {
  const apk = findAvailableApkFile();
  if (!apk) {
    return res.status(404).send('APK package is not uploaded yet. Place your .apk file inside the apk/ folder.');
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${apk.fileName}"`);
  return res.sendFile(apk.filePath);
});

// High-definition media upload endpoint (supports 1080p/4K videos and crisp photos)
app.post('/api/upload-media', (req, res) => {
  try {
    const { name, data, type } = req.body;
    if (!data) {
      return res.status(400).json({ ok: false, error: 'No media data provided' });
    }

    let ext = 'mp4';
    let base64Content = data;

    if (typeof data === 'string' && data.includes(';base64,')) {
      const parts = data.split(';base64,');
      const mime = parts[0].replace('data:', '');
      base64Content = parts[1];
      if (mime.includes('mp4')) ext = 'mp4';
      else if (mime.includes('webm')) ext = 'webm';
      else if (mime.includes('quicktime') || mime.includes('mov')) ext = 'mov';
      else if (mime.includes('avi')) ext = 'avi';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
    } else if (name && typeof name === 'string' && name.includes('.')) {
      ext = name.split('.').pop() || 'mp4';
    }

    const safeFilename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeFilename}`;
    console.log(`[Media Upload] Successfully saved ${safeFilename} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

    return res.json({
      ok: true,
      url: publicUrl,
      filename: safeFilename,
      size: buffer.length,
      mimeType: type || (ext === 'mp4' ? 'video/mp4' : 'image/jpeg'),
    });
  } catch (err: any) {
    console.error('Upload media error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Media upload failed' });
  }
});

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, tone = 'marketing', contextType = 'general' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'يرجى كتابة نص أو فكرة الرسالة المطلوبة.' });
    }

    if (!ai && process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }

    const systemInstruction = `أنت مساعد ذكي مخصص لAMASA RESORT الفاخرة بالمملكة العربية السعودية (الترف، كوخ البيلسان، رانس، حمران - الما ونايا).
مهمتك: مساعدة الإدارة والمسوقين والحراس في صياغة رسائل واتساب احترافية ولبقة جداً، مثل:
- عروض ترويجية وأسعار وتخفيضات للشاليهات.
- رسائل تأكيد الحجز وإرسال بوليصة العربون وعقد الإيجار.
- رسائل ترحيبية وتوديعية من الحارس للنزلاء ومواعيد الدخول والخروج والتأمين.
- الردود الراقية على استفسارات العملاء.
الأسلوب: سعودي مهذب، مشرق، فخم، مع إيموجي منسقة، وتنسيق سطور ملائم للواتساب.
نوع النبرة المطلوبة: ${tone}. نوع المحتوى: ${contextType}.`;

    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });
      return res.json({ text: response.text, model: 'gemini-3.8-flash', live: true });
    }

    const fallbackMessage = generateSmartFallback(prompt, tone, contextType);
    return res.json({ text: fallbackMessage, model: 'smart-template-engine', live: false });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const fallbackMessage = generateSmartFallback(req.body?.prompt || '', req.body?.tone, req.body?.contextType);
    return res.json({
      text: fallbackMessage,
      note: 'تم التوليد باستخدام المحرك الذكي الداخلي لAMASA RESORT.',
      live: false,
    });
  }
});

function generateSmartFallback(prompt: string, tone?: string, contextType?: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('عربون') || p.includes('تأكيد') || p.includes('دفع') || contextType === 'booking') {
    return `أهلاً وسهلاً بك في AMASA RESORT الفاخرة ✨🌿\n\nنود إفادتكم بأنه تم تسجيل حجزكم المبدئي بنجاح 🎉\n\n🏡 *تفاصيل الحجز والضيافة:*\n• الشاليه: AMASA RESORT\n• لتأكيد وتثبيت الحجز نهائياً، نرجو التكرم بسداد العربون المعتمد.\n• رابط إتمام الدفع والعقد الموثق يتم إرساله فور التأكيد.\n\nنتشرف بخدمتكم ونتمنى لكم إقامة سعيدة ومميزة دائماً! 🤍🌸\n*إدارة AMASA RESORT (AMASA)*`;
  }
  if (p.includes('حارس') || p.includes('دخول') || p.includes('ترحيب') || p.includes('خروج') || contextType === 'welcome') {
    return `مرحباً بكم ضيوفنا الكرام في AMASA RESORT 🌟\nمعكم الحارس والمشرف الميداني (أبو راشد).\n\nيسعدنا استقبالكم اليوم، الشاليه جاهز ومُعقم ومكيف بالكامل لراحتكم 🏊‍♂️✨\n• موعد الدخول المعتمد: الساعة 3:00 عصراً\n• موعد الخروج: الساعة 12:00 ظهراً\n• في حال احتجتم لأي مساعدة أو فتح البوابة، أنا بالخدمة على مدار الساعة.\n\nإقامة ممتعة وهانئة بإذن الله! 🍃🌷`;
  }
  if (p.includes('عرض') || p.includes('تخفيض') || p.includes('ويكند') || p.includes('صيف') || p.includes('عيد')) {
    return `عزيزنا العميل، مرحباً بك في AMASA RESORT RESORT الفاخرة 💎✨\n\nعروض استثنائية بانتظارك لقضاء أروع الأوقات العائلية في أرقى شاليهاتنا:\n🌴 شاليه الترف · كوخ البيلسان · رانس · حمران (الما ونايا)\n\n🏊‍♂️ مسابح خاصة ونظيفة، مسطحات خضراء، مجالس فسيحة ومكيفة بالكامل.\nخصومات خاصة تبدأ من 15% للحجوزات المبكرة مع تأكيد فوري وعقد إلكتروني موثق.\n\nاحجز إقامتك الآن واستمتع بالخصوصية والراحة المطلقة! 📲🤍\n*AMASA RESORT - ضيافة تليق بكم*`;
  }
  return `مرحباً بك في AMASA RESORT RESORT الفاخرة ✨\n\nبناءً على طلبكم: ${prompt}\n\nنسعد دوماً بتقديم أرقى خدمات الضيافة في شاليهاتنا بالرياض. جميع مرافقنا مجهزة بأعلى معايير النظافة والخصوصية والراحة، مع إمكانية تعديل الحجوزات وإصدار العقود الرسمية المعتمدة فورياً.\n\nيسعدنا الرد على أي استفسار آخر وتلبية طلباتكم! 🌿🌸\n*AMASA RESORT*`;
}

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('sw-push.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.json') ||
            filePath.endsWith('manifest.webmanifest') ||
            filePath.endsWith('version.json')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
