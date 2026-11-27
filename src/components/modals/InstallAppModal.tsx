import React, { useState, useEffect } from 'react';
import { X, Smartphone, Download, Share2, PlusSquare, Sparkles, CheckCircle2, Copy, Check, PackageCheck, ArrowUpRight, MoreVertical } from 'lucide-react';
import { usePWAInstall, triggerDirectApkDownload } from '../../hooks/usePWAInstall';
import { Sheet, Seg, Head, Row, Acts, Act, Infos, Info, Tag } from '../ui/kit';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, apkInfo, install } =
    usePWAInstall();

  const [selectedPlatform, setSelectedPlatform] = useState<'android' | 'ios'>('android');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (isIOS) {
      setSelectedPlatform('ios');
    } else if (isAndroid) {
      setSelectedPlatform('android');
    }
  }, [isOpen, isIOS, isAndroid]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = () => {
    if (navigator.clipboard && typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleDirectInstall = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  };

  const isAndroidSel = selectedPlatform === 'android';

  return (
    <Sheet
      title="تثبيت التطبيق"
      icon={Download}
      tone="amy"
      onClose={onClose}
      footer={<Act tone="line" icon={X} label="إغلاق" onClick={onClose} />}
    >
      <Seg
        label="نظام الجهاز"
        value={selectedPlatform}
        onChange={setSelectedPlatform}
        items={[
          { id: 'android', label: 'أندرويد', icon: Smartphone },
          { id: 'ios', label: 'آيفون', icon: Smartphone },
        ]}
      />

      {isInstalled && (
        <div className="kt-ok" role="status">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">التطبيق مُثبت ويعمل على جهازك</span>
          </div>
        </div>
      )}

      {/* تثبيت مباشر بلمسة واحدة عندما يدعمه المتصفح */}
      {isInstallable && (
        <>
          <Row icon={Sparkles} tone="ch" title="جاهز للتثبيت المباشر" sub="بلمسة واحدة على جهازك" />
          <Act tone="gold" icon={Download} label="تثبيت التطبيق الآن" onClick={handleDirectInstall} />
        </>
      )}

      {/* التطبيق داخل إطار: افتحه في نافذة المتصفح الرئيسية لظهور نافذة التثبيت */}
      {isInIframe && !isInstallable && !isInstalled && currentUrl && (
        <>
          <p className="kt-note">للتثبيت بلمسة واحدة افتح التطبيق في نافذة المتصفح الرئيسية.</p>
          <a href={currentUrl} target="_top" className="kt-act lx-press kt-t-soft">
            <ArrowUpRight size={18} strokeWidth={1.8} />
            <span>فتح للتثبيت المباشر</span>
          </a>
        </>
      )}

      {/* أندرويد */}
      {isAndroidSel && apkInfo.available && apkInfo.downloadUrl && (
        <>
          <Row icon={PackageCheck} tone="jade" title="ملف التثبيت جاهز" sub={apkInfo.size > 0 ? formatFileSize(apkInfo.size) : 'ملف أندرويد مباشر'} />
          <Act tone="jade" icon={Download} label="تنزيل الملف" onClick={() => triggerDirectApkDownload(apkInfo.downloadUrl!, apkInfo.fileName)} />
        </>
      )}

      <Head title="الخطوات" icon={isAndroidSel ? Smartphone : Share2} count="2" />
      <p className="kt-note">{isAndroidSel ? 'من متصفح Chrome على جوال أندرويد.' : 'من متصفح Safari على آيفون وآيباد.'}</p>
      {isAndroidSel ? (
        <>
          <Row icon={MoreVertical} tone="amy" title="افتح القائمة" sub="الثلاث نقاط أعلى المتصفح" end={<Tag tone="gray" mono>1</Tag>} />
          <Row icon={Download} tone="jade" title="ثبّت التطبيق" sub="«تثبيت التطبيق» ثم «تثبيت»" end={<Tag tone="gray" mono>2</Tag>} />
        </>
      ) : (
        <>
          <Row icon={Share2} tone="amy" title="زر المشاركة" sub="في الشريط السفلي لـ Safari" end={<Tag tone="gray" mono>1</Tag>} />
          <Row icon={PlusSquare} tone="jade" title="الصفحة الرئيسية" sub="«إضافة إلى الصفحة الرئيسية» ثم «إضافة»" end={<Tag tone="gray" mono>2</Tag>} />
        </>
      )}
      <p className="kt-note">يعمل بعد التثبيت كتطبيق مستقل بكامل الشاشة.</p>

      {/* رابط المشاركة */}
      <Head title="رابط التطبيق" icon={Copy} tone="sand" />
      <Infos cols={1}>
        <Info label="للمشاركة مع الفريق" value={currentUrl} ltr />
      </Infos>
      <Act tone={copiedLink ? 'jade' : 'soft'} icon={copiedLink ? Check : Copy} label={copiedLink ? 'تم النسخ ✓' : 'نسخ الرابط'} onClick={handleCopyLink} />
    </Sheet>
  );
};
