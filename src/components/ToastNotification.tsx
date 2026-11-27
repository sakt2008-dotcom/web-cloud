import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { stripEmoji } from '../lib/stripEmoji';
import { C, Gem, IconTile, LuxIcon, type IconName, type TileTone } from './ui/lux';

/** تنبيه فوري منبثق — كبسولة داكنة بحدّ شمبانيا رفيع تنزل بهدوء من الأعلى */
export const ToastNotification: React.FC = () => {
  const { activeToast, dismissToast, isSoundEnabled, toggleSound, setActiveTab } = useApp();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!activeToast) {
      setProgress(100);
      return;
    }

    const duration = 6500;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        dismissToast();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [activeToast, dismissToast]);

  if (!activeToast) return null;

  let icon: IconName = 'bell';
  let tone: TileTone = 'amy';

  if (activeToast.type === 'deposit_confirmed') {
    icon = 'check';
    tone = 'jade';
  } else if (activeToast.type === 'deposit_request') {
    icon = 'cash';
    tone = 'sand';
  } else if (activeToast.type === 'booking') {
    icon = 'cal';
    tone = 'saph';
  } else if (activeToast.type === 'commission') {
    icon = 'cash';
    tone = 'ch';
  }

  const handleToastClick = () => {
    if (activeToast.type === 'commission') {
      setActiveTab('marketers');
    } else {
      setActiveTab('bookings');
    }
    dismissToast();
  };

  return (
    <div className="fixed top-2 sm:top-4 inset-x-2.5 sm:inset-x-auto sm:right-6 sm:w-[26rem] z-[60] pointer-events-auto">
      <div
        role="alert"
        className="lx-drop lux-hero relative select-none"
        style={{
          borderRadius: 26,
          boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.5), 0 24px 44px -22px rgba(0,0,0,.75)',
        }}
      >
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative flex items-center gap-3 p-3.5 pb-4">
          <IconTile name={icon} tone={tone} size={52} dark />

          <button type="button" className="flex-1 min-w-0 text-right cursor-pointer" onClick={handleToastClick}>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: C.chl }}>
              <Gem color={C.jade} size={9} pulse />
              إشعار فوري
            </span>
            <h4 className="font-bold text-[16px] leading-snug mt-0.5 line-clamp-1" style={{ color: C.snow }}>
              {stripEmoji(activeToast.title)}
            </h4>
            <p className="text-[13.5px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: C.dim }}>
              {stripEmoji(activeToast.body)}
            </p>
          </button>

          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={dismissToast}
              aria-label="إغلاق التنبيه"
              className="lx-dome-dark w-11 h-11 rounded-full flex items-center justify-center cursor-pointer"
              style={{ color: C.chl }}
            >
              <LuxIcon name="close" size={20} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={toggleSound}
              aria-label={isSoundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
              className="w-11 h-9 rounded-full flex items-center justify-center cursor-pointer"
              style={{ color: isSoundEnabled ? C.dim : C.chl }}
            >
              {isSoundEnabled ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>

        {/* خط شمبانيا رفيع ينكمش مع الوقت */}
        <div
          aria-hidden="true"
          className="absolute left-5 right-5 bottom-2 h-[3px] rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,.1)' }}
        >
          <div
            className="h-full rounded-full ms-auto"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #8D6B2C, #E8D4A2)',
              transition: 'width 50ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
};
