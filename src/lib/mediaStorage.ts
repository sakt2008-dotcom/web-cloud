// Utility for high-quality media uploads (videos & images), Firebase Storage, persistent IndexedDB caching, and server upload storage.
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';

const DB_NAME = 'amasa_media_cache_v2';
const STORE_NAME = 'media_files';
const resolvedUrlMemoryCache = new Map<string, string>();

export function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMediaToIndexedDB(id: string, dataUrlOrBlob: string | Blob): Promise<boolean> {
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrlOrBlob, id);
      req.onerror = () => reject(req.error);
    });
    const verified = await getMediaFromIndexedDB(id);
    return verified !== null;
  } catch (err) {
    console.warn('Failed to save to IndexedDB:', err);
    return false;
  }
}

export async function deleteMediaFromIndexedDB(id: string): Promise<void> {
  if (!id || !id.startsWith('idb://')) return;
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
    });
    const existing = resolvedUrlMemoryCache.get(id);
    if (existing && existing.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existing);
      } catch {
        // ignore
      }
    }
    resolvedUrlMemoryCache.delete(id);
  } catch {
    // ignore cleanup errors
  }
}

export async function getMediaFromIndexedDB(id: string): Promise<string | Blob | null> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to read from IndexedDB:', err);
    return null;
  }
}

/**
 * Resolves `idb://...` keys stored in IndexedDB into playable browser Blob URLs.
 * Passes regular HTTP(S) / data: / relative URLs straight through.
 */
export async function resolveMediaUrl(url: string): Promise<string> {
  if (!url) return '';
  if (!url.startsWith('idb://')) return url;
  const cached = resolvedUrlMemoryCache.get(url);
  if (cached) return cached;

  const stored = await getMediaFromIndexedDB(url);
  if (!stored) return '';
  if (typeof stored === 'string') {
    resolvedUrlMemoryCache.set(url, stored);
    return stored;
  }
  const blobUrl = URL.createObjectURL(stored);
  resolvedUrlMemoryCache.set(url, blobUrl);
  return blobUrl;
}

let cachedNodeServerAvailable: boolean | null = null;

async function isNodeUploadServerAvailable(): Promise<boolean> {
  if (cachedNodeServerAvailable !== null) return cachedNodeServerAvailable;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1500);
    const res = await fetch('/api/health', { method: 'GET', signal: controller.signal });
    window.clearTimeout(timer);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const json = await res.json();
      cachedNodeServerAvailable = Boolean(json?.uploadSupported);
      return cachedNodeServerAvailable;
    }
  } catch {
    // Static hosts (e.g. Cloudflare Pages) do not run Express /api/*
  }
  cachedNodeServerAvailable = false;
  return false;
}

/**
 * Attempts direct upload to Firebase Storage (ideal for static Cloudflare Pages deployment).
 * Rejects cleanly on missing auth/storage or stall timeout so fallbacks run smoothly.
 */
async function uploadToFirebaseStorage(
  file: File,
  folder: 'videos' | 'images',
  onProgress?: (percent: number, text: string) => void
): Promise<string | null> {
  if (!storage || !auth.currentUser) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `amasa_media/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeName}`;
  const fileRef = storageRef(storage, path);

  return new Promise<string | null>((resolve) => {
    let settled = false;
    let lastBytes = -1;
    const task = uploadBytesResumable(fileRef, file, {
      contentType: file.type || (folder === 'videos' ? 'video/mp4' : 'image/jpeg'),
    });

    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      clearInterval(stallTimer);
      resolve(url);
    };

    // Fail fast (4s) if bucket isn't provisioned yet, but allow 15s between chunks once transfer starts
    let stallTicks = 0;
    const stallTimer = window.setInterval(() => {
      stallTicks += 1;
      const limit = lastBytes <= 0 ? 4 : 15;
      if (stallTicks >= limit) {
        try {
          task.cancel();
        } catch {
          // ignore
        }
        finish(null);
      }
    }, 1000);

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.bytesTransferred > lastBytes) {
          lastBytes = snapshot.bytesTransferred;
          stallTicks = 0;
        }
        if (snapshot.totalBytes > 0 && onProgress) {
          const pct = Math.min(95, Math.max(15, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 80) + 15));
          onProgress(pct, `جاري الرفع على Firebase Storage (${pct}%)...`);
        }
      },
      (err) => {
        console.warn('Firebase Storage upload note:', err?.code || err?.message);
        finish(null);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          finish(downloadUrl);
        } catch {
          finish(null);
        }
      }
    );
  });
}

async function tryUploadToNodeServer(
  file: File,
  dataUrl: string
): Promise<{ url: string; filename?: string } | null> {
  try {
    const res = await fetch('/api/upload-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        type: file.type || 'video/mp4',
        data: dataUrl,
      }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return null;
    }
    const data = await res.json();
    if (data?.ok && data?.url) {
      return { url: String(data.url), filename: data.filename };
    }
    return null;
  } catch {
    return null;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف من الجهاز'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

const DEFAULT_CLOUDINARY_CLOUD_NAME = 'c6ylbe7o';
const DEFAULT_CLOUDINARY_UPLOAD_PRESET = 'amasa-resort';
const FALLBACK_CLOUDINARY_UPLOAD_PRESET = 'amasa resort';

function uploadSingleCloudinaryPreset(
  file: File,
  cloudName: string,
  preset: string,
  resourceType: 'image' | 'video',
  onProgress?: (percent: number, text: string) => void
): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    try {
      if (onProgress) onProgress(15, 'جاري الرفع على سحابة Cloudinary المجانية...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', preset);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`, true);
      xhr.timeout = 180000;

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0 && onProgress) {
          const pct = Math.min(96, Math.max(18, Math.round((evt.loaded / evt.total) * 78) + 18));
          onProgress(pct, `جاري الرفع السحابي على Cloudinary (${pct}%)...`);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data?.secure_url ? String(data.secure_url) : null);
            return;
          } catch {
            resolve(null);
            return;
          }
        }
        console.warn('Cloudinary upload note:', preset, xhr.status, xhr.responseText);
        resolve(null);
      };

      xhr.onerror = () => resolve(null);
      xhr.ontimeout = () => resolve(null);
      xhr.send(formData);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Free Cloudinary unsigned upload (25 credits/month free tier, no credit card required).
 * Uses VITE_CLOUDINARY_* env vars when present, preferring `amasa-resort` (unique auto IDs) with fallback to `amasa resort`.
 */
async function tryUploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video',
  onProgress?: (percent: number, text: string) => void
): Promise<string | null> {
  const cloudName =
    ((import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined) || '').trim() ||
    DEFAULT_CLOUDINARY_CLOUD_NAME;
  const primaryPreset =
    ((import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined) || '').trim() ||
    DEFAULT_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !primaryPreset) return null;

  const url = await uploadSingleCloudinaryPreset(file, cloudName, primaryPreset, resourceType, onProgress);
  if (url) return url;

  if (primaryPreset !== FALLBACK_CLOUDINARY_UPLOAD_PRESET) {
    return await uploadSingleCloudinaryPreset(
      file,
      cloudName,
      FALLBACK_CLOUDINARY_UPLOAD_PRESET,
      resourceType,
      onProgress
    );
  }
  return null;
}

/**
 * Uploads any media file (high-definition video or image).
 * Order of priority:
 * 1. Firebase Storage (real HTTPS URL, syncs across Cloudflare Pages & all devices)
 * 2. Cloudinary Free Unsigned Upload (backup cloud storage, returns HTTPS URL)
 * 3. Express server `/api/upload-media` (only when Express backend is reachable)
 * 4. Verified client fallback (compressed <95KB image dataUrl, or `idb://` local video ref backed & verified in IndexedDB)
 */
export async function uploadMediaFile(
  file: File,
  onProgress?: (percent: number, text: string) => void
): Promise<{ url: string; size: number; filename: string; isLocalOnly?: boolean }> {
  const maxBytes = 120 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 120 ميجابايت.');
  }

  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|3gp|mkv|hevc)$/i.test(file.name);
  if (onProgress) onProgress(12, 'جاري تجهيز الملف للرفع على Firebase Storage...');

  // 1. Try Firebase Storage first
  const cloudUrl = await uploadToFirebaseStorage(file, isVideo ? 'videos' : 'images', onProgress);
  if (cloudUrl) {
    if (onProgress) onProgress(100, 'تم الرفع والحفظ على Firebase Storage بنجاح!');
    return {
      url: cloudUrl,
      size: file.size,
      filename: file.name,
      isLocalOnly: false,
    };
  }

  // 2. Fallback to Cloudinary Free Tier if Storage bucket is unavailable/unprovisioned
  const cloudinaryUrl = await tryUploadToCloudinary(file, isVideo ? 'video' : 'image', onProgress);
  if (cloudinaryUrl) {
    if (onProgress) onProgress(100, 'تم الرفع على سحابة Cloudinary بنجاح!');
    return {
      url: cloudinaryUrl,
      size: file.size,
      filename: file.name,
      isLocalOnly: false,
    };
  }

  // 3. Try Node server endpoint (`/api/upload-media`) ONLY when backend is actually running (avoids 30MB Base64 crash on Cloudflare Pages)
  if (file.size <= 30 * 1024 * 1024) {
    const serverReady = await isNodeUploadServerAvailable();
    if (serverReady) {
      if (onProgress) onProgress(45, 'جاري الرفع عبر السيرفر...');
      const dataUrl = await fileToDataUrl(file);
      const serverRes = await tryUploadToNodeServer(file, dataUrl);
      if (serverRes?.url) {
        await saveMediaToIndexedDB(serverRes.url, file);
        if (onProgress) onProgress(100, 'تم حفظ الفيديو بالسيرفر بنجاح!');
        return {
          url: serverRes.url,
          size: file.size,
          filename: serverRes.filename || file.name,
          isLocalOnly: false,
        };
      }
    }

    // Small image compression fallback
    if (!isVideo) {
      const compactImg = await compressImageForSync(file);
      if (onProgress) onProgress(100, 'تم تجهيز الصورة');
      return {
        url: compactImg,
        size: file.size,
        filename: file.name,
        isLocalOnly: false,
      };
    }
  }

  // 4. Verified Offline / Static host fallback: save original Blob in IndexedDB under `idb://...` and verify persistence
  if (onProgress) onProgress(75, 'جاري حفظ الفيديو وتثبيته في ذاكرة المتصفح الدائمة...');
  const idbKey = `idb://video_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const savedOk = await saveMediaToIndexedDB(idbKey, file);
  if (!savedOk) {
    throw new Error('تعذر حفظ الفيديو في ذاكرة المتصفح (قد تكون المساحة ممتلئة). يرجى إضافة الفيديو عبر رابط YouTube أو Google Drive.');
  }
  const blobUrl = URL.createObjectURL(file);
  resolvedUrlMemoryCache.set(idbKey, blobUrl);

  if (onProgress) onProgress(100, 'تم حفظ وتثبيت الفيديو بنجاح!');
  return {
    url: idbKey,
    size: file.size,
    filename: file.name,
    isLocalOnly: true,
  };
}

/**
 * Dedicated helper to process video file and ensure high quality preservation.
 * Returns the permanent playable URL (HTTPS Storage URL, /uploads/... URL, or `idb://` local ref).
 */
export async function processVideoFile(
  file: File,
  onProgress?: (percent: number, text: string) => void
): Promise<string> {
  const result = await uploadMediaFile(file, onProgress);
  return result.url;
}

/**
 * Progressively compresses an image so the DataURL stays under ~95KB (safe for both localStorage & Firestore sync).
 */
async function compressImageForSync(file: File): Promise<string> {
  const attempts: [number, number][] = [
    [1400, 0.82],
    [1000, 0.72],
    [760, 0.6],
    [560, 0.5],
  ];
  let best = '';
  for (const [dim, q] of attempts) {
    best = await compressImageFile(file, dim, q);
    if (best.length <= 95000) return best;
  }
  return best;
}

/**
 * Uploads a photo file (JPG, PNG, WebP, HEIC, GIF).
 * Priority: Firebase Storage -> Cloudinary -> `/api/upload-media` -> Sync-safe progressive JPEG compression.
 */
export async function uploadPhotoFile(
  file: File,
  onProgress?: (text: string) => void
): Promise<string> {
  if (onProgress) onProgress('جاري رفع الصورة إلى Firebase Storage...');

  try {
    const cloudUrl = await uploadToFirebaseStorage(file, 'images', (_pct, msg) => {
      if (onProgress) onProgress(msg);
    });
    if (cloudUrl) return cloudUrl;

    const cloudinaryUrl = await tryUploadToCloudinary(file, 'image', (_pct, msg) => {
      if (onProgress) onProgress(msg);
    });
    if (cloudinaryUrl) return cloudinaryUrl;

    if (file.size <= 15 * 1024 * 1024) {
      const serverReady = await isNodeUploadServerAvailable();
      if (serverReady) {
        const dataUrl = await fileToDataUrl(file);
        const serverRes = await tryUploadToNodeServer(file, dataUrl);
        if (serverRes?.url) return serverRes.url;
      }
    }
  } catch (err) {
    console.warn('Cloud/server photo upload failed, using compressed fallback:', err);
  }

  return await compressImageForSync(file);
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Supports all image formats and fallback if canvas is unsupported.
 */
export async function compressImageFile(
  file: File,
  maxDimension: number = 1920,
  quality: number = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|heic|bmp)$/i.test(file.name);
    if (!isImage && file.type) {
      reject(new Error('الملف المختار ليس صورة صالحة'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.onload = () => {
      const rawResult = reader.result as string;

      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(rawResult);
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve(rawResult);
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawResult);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let compressed = canvas.toDataURL('image/jpeg', quality);
          if (!compressed || compressed === 'data:,') {
            compressed = rawResult;
          }
          resolve(compressed);
        } catch (e) {
          console.warn('Canvas compression error, using raw image:', e);
          resolve(rawResult);
        }
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  });
}

export function isExternalVideoLink(url: string): boolean {
  const lower = (url || '').trim().toLowerCase();
  return (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('drive.google.com') ||
    lower.includes('vimeo.com') ||
    lower.includes('tiktok.com') ||
    lower.includes('instagram.com')
  );
}

function inferVideoExtAndMime(url: string, blobType?: string, originalName?: string): { ext: string; mime: string } {
  const cleanType = (blobType || '').split(';')[0].trim().toLowerCase();
  if (cleanType === 'video/quicktime') return { ext: 'mov', mime: 'video/quicktime' };
  if (cleanType === 'video/webm') return { ext: 'webm', mime: 'video/webm' };
  if (cleanType === 'video/x-m4v') return { ext: 'm4v', mime: 'video/x-m4v' };
  if (cleanType === 'video/3gpp') return { ext: '3gp', mime: 'video/3gpp' };
  if (cleanType === 'video/x-msvideo') return { ext: 'avi', mime: 'video/x-msvideo' };
  if (cleanType.startsWith('video/')) return { ext: 'mp4', mime: cleanType };

  const source = `${originalName || ''} ${url || ''}`.toLowerCase();
  if (/\.mov(\?|#|$)/i.test(source)) return { ext: 'mov', mime: 'video/quicktime' };
  if (/\.webm(\?|#|$)/i.test(source)) return { ext: 'webm', mime: 'video/webm' };
  if (/\.m4v(\?|#|$)/i.test(source)) return { ext: 'm4v', mime: 'video/x-m4v' };
  if (/\.3gp(\?|#|$)/i.test(source)) return { ext: '3gp', mime: 'video/3gpp' };
  if (/\.avi(\?|#|$)/i.test(source)) return { ext: 'avi', mime: 'video/x-msvideo' };
  return { ext: 'mp4', mime: 'video/mp4' };
}

function sanitizeShareFileName(rawTitle: string | undefined, ext: string): string {
  const base = (rawTitle || 'amasa-video')
    .replace(/\.[^/.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  const safeBase = base || 'amasa-video';
  return `${safeBase}.${ext}`;
}

export async function resolveVideoFileBlob(
  videoUrl: string,
  suggestedTitle?: string
): Promise<{ file: File; fileName: string }> {
  const trimmed = (videoUrl || '').trim();
  if (!trimmed) {
    throw new Error('رابط الفيديو غير متوفر.');
  }

  let blob: Blob;
  let storedName: string | undefined;

  if (trimmed.startsWith('idb://')) {
    const stored = await getMediaFromIndexedDB(trimmed);
    if (!stored) {
      throw new Error('ملف الفيديو غير موجود في ذاكرة هذا الجهاز.');
    }
    if (typeof stored === 'string') {
      const res = await fetch(stored);
      blob = await res.blob();
    } else {
      blob = stored;
      if (stored instanceof File && stored.name) {
        storedName = stored.name;
      }
    }
  } else {
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error('تعذر تحميل ملف الفيديو من الخادم.');
    }
    blob = await res.blob();
  }

  const { ext, mime } = inferVideoExtAndMime(trimmed, blob.type, storedName);
  const fileName = storedName && /\.[a-z0-9]{2,5}$/i.test(storedName)
    ? storedName
    : sanitizeShareFileName(suggestedTitle, ext);

  const normalizedBlob = blob.type === mime ? blob : new Blob([blob], { type: mime });
  const file = new File([normalizedBlob], fileName, { type: mime });
  return { file, fileName };
}

export interface VideoFileShareResult {
  status: 'shared' | 'downloaded' | 'cancelled' | 'external_link';
  fileName?: string;
  message: string;
}

/**
 * Shares an uploaded/cached video directly in its original file format (MP4/MOV/WebM)
 * via the device's native Web Share API (`navigator.share({ files })`).
 * Falls back cleanly to direct file download when `navigator.share({ files })` is unavailable (e.g., desktop or iframe).
 */
export async function shareOrDownloadVideoFile(
  videoUrl: string,
  suggestedTitle?: string
): Promise<VideoFileShareResult> {
  if (isExternalVideoLink(videoUrl)) {
    return {
      status: 'external_link',
      message: 'هذا الفيديو رابط خارجي (YouTube/Drive) ولا يمكن إرساله كملف مباشرة؛ ارفع ملف MP4/MOV لإرساله كفيديو.',
    };
  }

  const { file, fileName } = await resolveVideoFileBlob(videoUrl, suggestedTitle);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: suggestedTitle || fileName,
        });
        return {
          status: 'shared',
          fileName,
          message: `تمت مشاركة ملف الفيديو (${fileName}) بنفس الصيغة بنجاح`,
        };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return {
            status: 'cancelled',
            fileName,
            message: 'تم إلغاء المشاركة',
          };
        }
        // Fallback to direct download if iframe / desktop blocks navigator.share({ files })
      }
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    }
  }, 15000);

  return {
    status: 'downloaded',
    fileName,
    message: `تم تنزيل ملف الفيديو (${fileName}) بنفس الصيغة — يمكنك إرفاقه مباشرة في محادثة العميل`,
  };
}

