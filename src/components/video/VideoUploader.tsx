import React, { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, Video, Link, Check, AlertCircle, Sparkles, CheckCircle2, Film } from 'lucide-react';
import { processVideoFile, resolveMediaUrl } from '../../lib/mediaStorage';
import { Acts, Act, Tile, Tag } from '../ui/kit';
import type { Ico } from '../ui/kit';

/** أيقونة تحميل دوّارة (لأزرار kt-act) */
const SpinIcon: Ico = (props) => <Loader2 {...props} className="animate-spin" />;

function extractYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const trimmed = rawUrl.trim();
    const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,15})/);
    if (watchMatch && watchMatch[1]) {
      return `https://www.youtube.com/embed/${watchMatch[1]}?rel=0`;
    }
  } catch {
    // ignore
  }
  return null;
}

function extractDriveEmbedUrl(rawUrl: string): string | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed.includes('drive.google.com')) return null;
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
  } catch {
    // ignore
  }
  return null;
}

export const SmartVideoPlayer: React.FC<{
  url: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  preload?: 'metadata' | 'auto' | 'none';
}> = ({ url, className = 'w-full h-full object-contain', autoPlay = false, controls = true, preload = 'metadata' }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => (url.startsWith('idb://') ? '' : url));
  const [missingLocal, setMissingLocal] = useState(false);

  const ytEmbed = extractYouTubeEmbedUrl(url);
  const driveEmbed = extractDriveEmbedUrl(url);

  useEffect(() => {
    let active = true;
    if (ytEmbed || driveEmbed) {
      setResolvedUrl(url);
      setMissingLocal(false);
      return;
    }
    if (!url.startsWith('idb://')) {
      setResolvedUrl(url);
      setMissingLocal(false);
      return;
    }
    resolveMediaUrl(url)
      .then((res) => {
        if (!active) return;
        if (res) {
          setResolvedUrl(res);
          setMissingLocal(false);
        } else {
          setResolvedUrl('');
          setMissingLocal(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setResolvedUrl('');
        setMissingLocal(true);
      });
    return () => {
      active = false;
    };
  }, [url, ytEmbed, driveEmbed]);

  if (ytEmbed) {
    return (
      <iframe
        src={ytEmbed}
        title="YouTube video player"
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (driveEmbed) {
    return (
      <iframe
        src={driveEmbed}
        title="Google Drive video player"
        className="w-full h-full border-0"
        allow="autoplay"
        allowFullScreen
      />
    );
  }

  if (missingLocal) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-white/80 bg-slate-900 space-y-1.5">
        <Film className="w-7 h-7 text-amber-400" />
        <p className="text-[13px] font-bold">الفيديو محفوظ على جهاز الرفع فقط</p>
        <p className="text-[12px] text-slate-300">للمشاركة بين الأجهزة أضف رابط يوتيوب أو درايف.</p>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-purple-200">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <video
      key={resolvedUrl}
      src={resolvedUrl}
      controls={controls}
      autoPlay={autoPlay}
      preload={preload}
      playsInline
      className={className}
    />
  );
};

interface VideoUploaderProps {
  propertyId: string;
  onUploadSuccess: (url: string) => void;
  onSaveAndFinish?: () => void | Promise<void>;
  className?: string;
  autoSavePrompt?: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  propertyId: _propertyId,
  onUploadSuccess,
  onSaveAndFinish,
  className = '',
  autoSavePrompt = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadedFileSizeMB, setUploadedFileSizeMB] = useState<number | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [isLocalOnlyVideo, setIsLocalOnlyVideo] = useState(false);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  const [isFinalizedSaved, setIsFinalizedSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processSelectedFile = async (file: File) => {
    setErrorMessage(null);
    setIsFinalizedSaved(false);

    // Limit check (120MB for high-definition 1080p video)
    const maxSizeBytes = 120 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMessage('حجم الفيديو يتجاوز 120 ميجابايت، يرجى اختيار ملف أصغر حجماً.');
      return;
    }

    setUploadedFileSizeMB(Math.round((file.size / (1024 * 1024)) * 10) / 10);
    setVideoTitle(file.name);
    setUploading(true);
    setUploadProgress(10);
    setUploadProgressText('بدء فحص وتجهيز الفيديو بالجودة العالية...');

    try {
      const finalUrl = await processVideoFile(file, (percent, text) => {
        setUploadProgress(percent);
        setUploadProgressText(text);
      });

      if (!finalUrl) {
        throw new Error('تعذر إنشاء رابط حفظ الفيديو.');
      }

      setIsLocalOnlyVideo(finalUrl.startsWith('idb://'));
      setUploadedPreviewUrl(finalUrl);
      onUploadSuccess(finalUrl);
    } catch (error: any) {
      console.error('Error uploading high quality video:', error);
      setErrorMessage(error?.message || 'حدث خطأ أثناء رفع الفيديو، يرجى التأكد من اتصالك والمحاولة مرة أخرى.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const handleAddUrl = (): boolean => {
    if (!urlInput.trim()) return false;
    const trimmed = urlInput.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMessage('يرجى إدخال رابط يبدأ بـ https://');
      return false;
    }
    setErrorMessage(null);
    setIsFinalizedSaved(false);
    setIsLocalOnlyVideo(false);
    setUploadedPreviewUrl(trimmed);
    setVideoTitle('فيديو عبر رابط خارجي');
    onUploadSuccess(trimmed);
    setUrlInput('');
    setShowUrlInput(false);
    return true;
  };

  const handleFinishAndSave = async () => {
    if (isSavingFinal) return;
    setIsSavingFinal(true);
    try {
      if (showUrlInput && urlInput.trim()) {
        const added = handleAddUrl();
        if (!added) {
          setIsSavingFinal(false);
          return;
        }
      }
      if (onSaveAndFinish) {
        await onSaveAndFinish();
      }
      setIsFinalizedSaved(true);
    } finally {
      setIsSavingFinal(false);
    }
  };

  const handleResetUploader = () => {
    setUploadedPreviewUrl(null);
    setUploadedFileSizeMB(null);
    setVideoTitle('');
    setIsLocalOnlyVideo(false);
    setIsFinalizedSaved(false);
    setErrorMessage(null);
  };

  return (
    <div className={`kt-vu ${className}`}>
      {/* العنوان + تبديل (ملف / رابط) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Tile icon={Video} tone="amy" size={38} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-extrabold text-[15px] text-[#1A0F2E] truncate">إضافة فيديو</span>
            <Tag tone="jade">HD</Tag>
          </div>
          <p className="kt-note truncate">ملف حتى 120MB أو رابط خارجي</p>
        </div>
        <Act
          small
          tone="line"
          icon={showUrlInput ? Upload : Link}
          label={showUrlInput ? 'ملف' : 'رابط'}
          title={showUrlInput ? 'رفع ملف من الجهاز' : 'إضافة عبر رابط (URL)'}
          onClick={() => {
            setErrorMessage(null);
            setShowUrlInput(!showUrlInput);
          }}
        />
      </div>

      {/* منطقة الرفع */}
      {!showUrlInput ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!uploading) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          data-drag={isDragging}
          className={`kt-drop ${uploading ? 'opacity-85 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <div className="w-full max-w-sm flex flex-col items-center gap-2.5">
              <Loader2 className="w-6 h-6 text-[#5B2EA6] animate-spin" />
              <div className="w-full bg-[#EAE3F4] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#5B2EA6] h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(uploadProgress, 15)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 w-full text-[13px] text-[#1A0F2E] font-bold">
                <span className="truncate">{uploadProgressText}</span>
                <span className="font-mono shrink-0">{uploadProgress}%</span>
              </div>
              {uploadedFileSizeMB && <span className="kt-note">حجم الفيديو: {uploadedFileSizeMB} MB</span>}
            </div>
          ) : (
            <>
              <Tile icon={Upload} tone="amy" size={44} />
              <span className="text-[14.5px] font-extrabold text-[#1A0F2E]">
                {isDragging ? 'أفلت الفيديو هنا' : 'اضغط لاختيار فيديو'}
              </span>
              <span className="kt-note">MP4 · MOV · WebM · يُحفظ تلقائياً بالنظام</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/mov,video/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      ) : (
        <div className="space-y-2.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="رابط مباشر (MP4 / YouTube / Drive)"
            dir="ltr"
            className="kt-input font-mono text-left"
          />
          <Act tone="ink" icon={Check} label="إضافة وتثبيت" onClick={handleAddUrl} />
        </div>
      )}

      {/* نجاح الرفع + تأكيد الحفظ */}
      {uploadedPreviewUrl && (
        <div className="kt-ok animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[14px] font-extrabold text-[#0E5A49]">تمت إضافة الفيديو</span>
            {uploadedFileSizeMB && <Tag tone="jade" mono>{uploadedFileSizeMB} MB</Tag>}
          </div>
          {videoTitle && (
            <span className="kt-note truncate block" dir="ltr" title={videoTitle}>
              {videoTitle}
            </span>
          )}

          {isLocalOnlyVideo && (
            <p className="kt-note" style={{ color: '#7A4A00' }}>
              ⚠️ محفوظ على هذا الجهاز فقط. لعرضه على أجهزة أخرى أضِفه برابط (YouTube / Drive).
            </p>
          )}

          {/* Quick Player */}
          <div className="relative aspect-video max-h-48 rounded-2xl overflow-hidden bg-black">
            <SmartVideoPlayer url={uploadedPreviewUrl} />
          </div>

          {autoSavePrompt && (
            <div className="space-y-2.5">
              <p className="kt-note">
                {isFinalizedSaved ? '✓ تم تثبيت الفيديو نهائياً في العقار.' : 'الفيديو جاهز — اضغط «حفظ وإنهاء» للتثبيت النهائي.'}
              </p>
              <Acts cols={isFinalizedSaved ? 2 : 1}>
                {isFinalizedSaved && <Act tone="line" label="فيديو آخر" title="إضافة فيديو آخر" onClick={handleResetUploader} />}
                <Act
                  tone="jade"
                  icon={isSavingFinal ? SpinIcon : Check}
                  label={isSavingFinal ? 'جاري الحفظ…' : isFinalizedSaved ? 'تم الحفظ ✓' : 'حفظ وإنهاء'}
                  disabled={isSavingFinal}
                  onClick={handleFinishAndSave}
                />
              </Acts>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="kt-err">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
