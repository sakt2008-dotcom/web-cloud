import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall, triggerDirectApkDownload } from '../hooks/usePWAInstall';
import { InstallAppModal } from './modals/InstallAppModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'primary' | 'compact' | 'header' | 'outline' | 'row' | 'act';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'primary',
}) => {
  const { isInstalled, isInstallable, isIOS, apkInfo, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = async () => {
    // 1. If an APK installer file is hosted on this server and device is not iOS, download it directly
    if (apkInfo.available && apkInfo.downloadUrl && !isIOS) {
      triggerDirectApkDownload(apkInfo.downloadUrl, apkInfo.fileName);
      return;
    }

    // 2. If native browser install prompt is ready (Android / Desktop), trigger immediate 1-tap install
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }

    // 3. Fallback (iOS Safari / unsupported context / prompt not yet triggered)
    setModalOpen(true);
  };

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-950 text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[36px] ${className}`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">التطبيق مُثبت</span>
              <span className="sm:hidden">مُثبت</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-purple-700 shrink-0 animate-bounce" />
              <span className="hidden sm:inline">تحميل التطبيق</span>
              <span className="sm:hidden">تحميل</span>
            </>
          )}
        </button>
      )}

      {variant === 'row' && (
        <button
          type="button"
          onClick={handleClick}
          className={`kt-act kt-sm lx-press ${isInstalled ? 'kt-t-jade' : 'lx-ink'} ${className}`}
        >
          {isInstalled ? <CheckCircle2 size={18} strokeWidth={1.8} /> : <Download size={18} strokeWidth={1.8} />}
          <span>{isInstalled ? 'مُثبّت' : 'تثبيت'}</span>
        </button>
      )}

      {variant === 'act' && (
        <button
          type="button"
          onClick={handleClick}
          className={`kt-act lx-press ${isInstalled ? 'kt-t-jade' : 'kt-t-soft'} ${className}`}
        >
          {isInstalled ? <CheckCircle2 size={20} strokeWidth={1.8} /> : <Download size={20} strokeWidth={1.8} />}
          <span>{isInstalled ? 'مُثبّت' : 'تثبيت التطبيق'}</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>تثبيت التطبيق</span>
        </button>
      )}

      {variant === 'outline' && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`flex items-center gap-1.5 rounded-xl border border-purple-300 bg-white hover:bg-purple-50 px-3 py-2 text-xs font-bold text-purple-950 shadow-2xs transition-all active:scale-95 cursor-pointer ${className}`}
        >
          <Smartphone className="w-4 h-4 text-purple-700" />
          <span>طريقة تحميل التطبيق</span>
        </button>
      )}

      {variant === 'primary' && (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer ${className}`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>التطبيق مُثبت على الجهاز</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-amber-300" />
              <span>تثبيت التطبيق على الجوال</span>
            </>
          )}
        </button>
      )}

      {/* Modal fallback when native prompt isn't available */}
      <InstallAppModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
