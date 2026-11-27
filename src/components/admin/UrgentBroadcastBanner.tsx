import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { C, Gem, IconTile, LuxIcon } from '../ui/lux';

/** شريط التعميم الإداري العاجل — كبسولة داكنة بدرجة عنّابي وحدّ شمبانيا؛ القراءة ثم الموافقة داخل التفاصيل */
export const UrgentBroadcastBanner: React.FC = () => {
  const { activeUrgentBroadcast, acknowledgeBroadcast } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeUrgentBroadcast) return null;

  const handleAcknowledge = () => {
    acknowledgeBroadcast(activeUrgentBroadcast.id);
  };

  return (
    <div dir="rtl" className="shrink-0 sticky top-0 z-40 px-2.5 pb-2" role="alert">
      <div
        className="lx-drop relative overflow-hidden text-white"
        style={{
          borderRadius: 24,
          background: 'linear-gradient(120deg,#7A1D38 0%,#2D1664 52%,#1B0E33 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.45), 0 16px 30px -16px rgba(184,67,94,.55)',
        }}
      >
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative px-3 py-2.5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="w-full flex items-center gap-3 text-right cursor-pointer min-h-14"
          >
            <IconTile name="alert" tone="garn" size={46} dark />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold whitespace-nowrap" style={{ color: '#F6B4C5' }}>
                <Gem color={C.garn} size={10} pulse />
                <span>تعميم إداري عاجل</span>
              </span>
              <span className="block text-[15.5px] font-bold truncate mt-0.5">{activeUrgentBroadcast.title}</span>
            </span>
            <span
              className="lx-dome-dark w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ color: C.chl }}
              aria-hidden="true"
            >
              <LuxIcon
                name="chevL"
                size={22}
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform .2s' }}
              />
            </span>
          </button>

          {isExpanded && (
            <div className="pt-2.5 pb-1 space-y-3 animate-in fade-in duration-150">
              <p
                className="leading-7 p-3.5 rounded-[20px] whitespace-pre-line text-[14.5px] font-medium max-h-[38dvh] overflow-y-auto"
                style={{ background: 'rgba(0,0,0,.28)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }}
              >
                {activeUrgentBroadcast.content}
              </p>
              <div className="flex items-center justify-between gap-3 text-[12.5px]" style={{ color: C.dim }}>
                <span className="min-w-0 truncate">
                  {activeUrgentBroadcast.senderName} · ساري من <bdi dir="ltr">{activeUrgentBroadcast.effectiveDate}</bdi>
                </span>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `*📢 تعميم إداري عاجل: ${activeUrgentBroadcast.title}*\n\n${activeUrgentBroadcast.content}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 min-h-11 flex items-center gap-1.5 font-semibold text-white"
                >
                  <span>مشاركة عبر واتساب</span>
                  <Share2 className="w-4 h-4" />
                </a>
              </div>
              <button
                type="button"
                onClick={handleAcknowledge}
                className="lx-gold w-full h-14 rounded-full flex items-center justify-center gap-2.5 text-[15px] font-bold cursor-pointer"
              >
                <LuxIcon name="check" size={24} />
                <span>تم الاطلاع والموافقة</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
