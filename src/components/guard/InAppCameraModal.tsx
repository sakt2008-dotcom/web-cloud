import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RotateCcw, Check, SwitchCamera, AlertCircle, Upload } from 'lucide-react';
import { Sheet, Row, Acts, Act, Field, Tag } from '../ui/kit';

interface InAppCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string, note?: string) => void;
  taskTitle: string;
  propertyName: string;
  guardName: string;
}

export const InAppCameraModal: React.FC<InAppCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  taskTitle,
  propertyName,
  guardName,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCapturing, setIsCapturing] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopActiveStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const barHeight = Math.max(64, Math.floor(height * 0.1));
    ctx.fillStyle = 'rgba(15, 7, 30, 0.8)';
    ctx.fillRect(0, height - barHeight, width, barHeight);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, height - barHeight, width, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(15, Math.floor(height * 0.024))}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-SA');
    const timeStr = now.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    ctx.fillText(
      `⭐ AMASA RESORT — توثيق: ${taskTitle}`,
      width - 18,
      height - barHeight + Math.max(24, Math.floor(barHeight * 0.42))
    );

    ctx.font = `normal ${Math.max(12, Math.floor(height * 0.018))}px sans-serif`;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(
      `العقار: ${propertyName} | الحارس: ${guardName} | ${dateStr} - ${timeStr}`,
      width - 18,
      height - Math.max(12, Math.floor(barHeight * 0.2))
    );
  };

  // Start live camera stream
  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      setCameraError(null);
      stopActiveStream();
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('المتصفح لا يدعم الكاميرا المباشرة');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Camera access issue:', err);
        setCameraError('تعذّر تشغيل الكاميرا — استخدم كاميرا الجوال');
      }
    },
    [stopActiveStream]
  );

  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setPhotoNote('');
      startCamera(facingMode);
    } else {
      stopActiveStream();
    }
    return () => {
      stopActiveStream();
    };
  }, [isOpen, facingMode, startCamera, stopActiveStream]);

  if (!isOpen) return null;

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Capture frame from video stream with authentic watermark
  const handleSnap = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const scale = rawW > 1280 ? 1280 / rawW : 1;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = Math.round(rawW * scale);
    canvas.height = Math.round(rawH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawWatermark(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setCapturedPhoto(dataUrl);
    setIsCapturing(false);
    stopActiveStream();
  };

  // Fallback: Native mobile file input capture / gallery pick
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > 1280 ? 1280 / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          drawWatermark(ctx, canvas.width, canvas.height);
          const finalData = canvas.toDataURL('image/jpeg', 0.82);
          setCapturedPhoto(finalData);
          stopActiveStream();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirm = () => {
    if (!capturedPhoto) return;
    onCapture(capturedPhoto, photoNote.trim() || undefined);
    stopActiveStream();
    onClose();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setPhotoNote('');
    startCamera(facingMode);
  };

  const handleCloseModal = () => {
    stopActiveStream();
    onClose();
  };

  return (
    <Sheet
      lockBackdrop
      title="تصوير إثبات المهمة"
      icon={Camera}
      tone="amy"
      onClose={handleCloseModal}
      footer={
        capturedPhoto ? (
          <Acts cols={2}>
            <Act tone="line" icon={RotateCcw} label="إعادة التصوير" onClick={handleRetake} />
            <Act tone="jade" icon={Check} label="اعتماد الصورة" title="اعتماد الصورة وإكمال المهمة" onClick={handleConfirm} />
          </Acts>
        ) : (
          <Acts cols={3}>
            <Act stack small tone="soft" icon={Upload} label="كاميرا الجوال" title="فتح كاميرا الجوال" onClick={() => fileInputRef.current?.click()} />
            <Act stack small tone="ink" icon={Camera} label="التقاط" title="التقاط الصورة" disabled={isCapturing} onClick={handleSnap} />
            <Act stack small tone="soft" icon={SwitchCamera} label="تبديل" title="تبديل الكاميرا" onClick={toggleCameraFacing} />
          </Acts>
        )
      }
    >
      <Row icon={Camera} tone="amy" title={taskTitle} sub={propertyName} />

      {capturedPhoto ? (
        <>
          <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center" style={{ boxShadow: '0 0 0 1px rgba(201,164,92,.6)' }}>
            <img src={capturedPhoto} alt="الصورة الملتقطة" className="block w-full max-h-[48vh] object-contain" />
            <div className="absolute top-2.5 right-2.5">
              <Tag tone="jade">موثّقة بالختم</Tag>
            </div>
          </div>
          <Field label="ملاحظة الحارس" hint="اختياري">
            <input
              type="text"
              value={photoNote}
              onChange={(e) => setPhotoNote(e.target.value)}
              placeholder="مثال: تم تنظيف السطح بالكامل"
              className="kt-input"
            />
          </Field>
        </>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '3 / 4', maxHeight: '52vh', width: '100%', boxShadow: '0 0 0 1px rgba(201,164,92,.6)' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute top-2.5 right-2.5">
            <Tag tone="dark">مباشر</Tag>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3 text-center text-[13px] font-bold text-white" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,.65), transparent)' }}>
            وجّه الكاميرا نحو مكان المهمة
          </div>
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white" style={{ background: 'rgba(15,8,32,.88)' }}>
              <AlertCircle className="w-8 h-8 text-[#E8D4A2]" />
              <p className="text-[13.5px] leading-6">{cameraError}</p>
              <Act small tone="gold" icon={Camera} label="فتح كاميرا الجوال" onClick={() => fileInputRef.current?.click()} className="!w-auto px-5" />
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />
    </Sheet>
  );
};
