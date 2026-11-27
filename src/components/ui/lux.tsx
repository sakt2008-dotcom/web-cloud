import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   AMASA RESORT — عناصر الواجهة الفاخرة المشتركة
   أيقونات خطّية مزدوجة الدرجة، جواهر الحالة، أزرار ومحدّد السحب.
   ═══════════════════════════════════════════════════════════════════ */

export const C = {
  ink: '#1B0E33',
  amy: '#2D1664',
  am: '#5B2EA6',
  pearl: '#F7F3EC',
  txt: '#1A0F2E',
  mut: '#5E5575',
  ch: '#C9A45C',
  chl: '#E8D4A2',
  lav: '#EAE3F4',
  jade: '#2E9E86',
  sand: '#D9932B',
  garn: '#B8435E',
  saph: '#3F6FD6',
  dim: '#BFB2DC',
  snow: '#F5F0FC',
  night: '#130A24',
  card: '#1F1140',
};

const T = ' fill="currentColor" fill-opacity=".16"';

const PATHS = {
  gem: `<path d="M7 4h10l4 5.5-9 11-9-11z"${T}/><path d="M3 9.5h18M9.5 9.5 12 4l2.5 5.5M9.5 9.5 12 20.5l2.5-11"/>`,
  bell: `<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"${T}/><path d="M12 3.5V5M10 20.5a2 2 0 0 0 4 0"/>`,
  in: `<path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2z"${T}/><path d="M20 12h-9M14.5 8.5 11 12l3.5 3.5"/>`,
  out: `<path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2z"${T}/><path d="M11 12h9M16.5 8.5 20 12l-3.5 3.5"/>`,
  route: `<circle cx="5.5" cy="6" r="2"${T}/><circle cx="17.5" cy="18" r="2"${T}/><path d="M7.5 6h8a3 3 0 0 1 0 6h-7a3 3 0 0 0 0 6h7"/>`,
  cash: `<rect x="3" y="6" width="18" height="12" rx="2.5"${T}/><circle cx="12" cy="12" r="2.8"/><path d="M6.5 12h.01M17.5 12h.01"/>`,
  shield: `<path d="M12 3l7 2.8v5.4c0 4.4-2.9 7.6-7 9.8-4.1-2.2-7-5.4-7-9.8V5.8z"${T}/><path d="M12 8.8l2.6 3.2-2.6 3.4-2.6-3.4z"/>`,
  spark: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"${T}/><path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"${T}/><path d="M12 7.5V12l3 2"/>`,
  chat: `<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4V16A2.5 2.5 0 0 1 4 13.5z"${T}/><path d="M8.5 9h7M8.5 12h4"/>`,
  alert: `<path d="M12 4 21 19.5H3z"${T}/><path d="M12 10v4.2M12 17h.01"/>`,
  cal: `<rect x="4" y="5.5" width="16" height="14.5" rx="3"${T}/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/><path d="M12 13l1.8 2-1.8 2-1.8-2z"/>`,
  building: `<path d="M5 20V8.5l7-4.5 7 4.5V20"${T}/><path d="M3.5 20h17M10 20v-5h4v5"/>`,
  marketer: `<circle cx="10" cy="8.5" r="3.2"${T}/><path d="M4 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M18 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>`,
  guard: `<path d="M12 3l7 2.8v5.4c0 4.4-2.9 7.6-7 9.8-4.1-2.2-7-5.4-7-9.8V5.8z"${T}/><circle cx="12" cy="10" r="2"/><path d="M8.5 16c.5-2 1.8-3 3.5-3s3 1 3.5 3"/>`,
  moon: `<path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.6 6.6 0 0 0 10.7 10.7z"${T}/>`,
  check: `<circle cx="12" cy="12" r="9"${T}/><path d="M8 12.3l2.7 2.7 5.5-5.5"/>`,
  chevL: '<path d="M14.5 6 8.5 12l6 6"/>',
  chevR: '<path d="M9.5 6l6 6-6 6"/>',
  dots: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="2.6"/>',
  phone: `<rect x="7" y="3" width="10" height="18" rx="2.5"${T}/><path d="M10.5 17.5h3"/>`,
  key: `<circle cx="8" cy="12" r="4.2"${T}/><path d="M12.2 12H21M17.5 12v3.2M20.8 12v2.2"/><path d="M8 10.2l1.2 1.8L8 13.8 6.8 12z"/>`,
  search: `<circle cx="10.5" cy="10.5" r="6.5"${T}/><path d="M15.4 15.4 20.5 20.5M8 10.5h5"/>`,
  send: `<path d="M20.5 3.5 3.5 10.2l6.6 3 3 6.6z"${T}/><path d="M10.1 13.2l10.4-9.7"/>`,
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  spin: '<circle cx="12" cy="12" r="8.5" opacity=".28"/><g class="animate-spin" style="transform-origin:12px 12px"><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/></g>',
  menu: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  logout: `<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"${T}/><path d="M11 12h9M16.5 8.5 20 12l-3.5 3.5"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"${T}/><circle cx="12" cy="12" r="2.6"/>`,
  settings: `<circle cx="12" cy="12" r="3"${T}/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>`,
  tasks: `<rect x="5" y="4" width="14" height="16.5" rx="3"${T}/><path d="M8.5 9.5l1.6 1.6 2.9-3M8.5 15.5h7"/>`,
  box: `<path d="M4 8l8-4 8 4v8.5l-8 4-8-4z"${T}/><path d="M4 8l8 4 8-4M12 12v8.5"/>`,
  download: `<path d="M12 4v10M7.8 10.2 12 14.4l4.2-4.2"/><path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"${T}/>`,
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4M19.5 4.5v4.2h-4.2"/>',
  megaphone: `<path d="M4 10v4h3l7 4V6L7 10z"${T}/><path d="M17.5 9.5a4 4 0 0 1 0 5"/>`,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/** أيقونة خطّية مزدوجة الدرجة — شبكة 24، حدّ 1.6، أطراف مستديرة، تعبئة 16% */
export const LuxIcon: React.FC<IconProps> = ({ name, size = 24, className = '', strokeWidth = 1.6, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 block ${className}`}
    style={{ width: size, height: size, ...style }}
    dangerouslySetInnerHTML={{ __html: PATHS[name] }}
  />
);

/** جوهرة الحالة — معيّن صغير ملوّن (ينبض عند الانتظار) */
export const Gem: React.FC<{ color: string; size?: number; pulse?: boolean; className?: string }> = ({
  color,
  size = 12,
  pulse,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    aria-hidden="true"
    className={`shrink-0 block ${pulse ? 'lux-gem-pulse' : ''} ${className}`}
    style={{ width: size, height: size }}
  >
    <path d="M6 .6 11.4 6 6 11.4.6 6z" fill={color} />
    <path d="M6 .6 11.4 6H.6z" fill="#fff" fillOpacity=".26" />
    <path d="M.6 6h10.8L6 11.4z" fill="#000" fillOpacity=".12" />
  </svg>
);

/* ─────────────────────────── شارات الحالة ─────────────────────────── */

export type ChipKind = 'sand' | 'jade' | 'garnet' | 'sapphire' | 'neutral';

const CHIP_LIGHT: Record<ChipKind, [string, string]> = {
  sand: ['#FBEFD9', '#7A4A06'],
  jade: ['#E1F3EE', '#0E5A49'],
  garnet: ['#F9E3E9', '#86203B'],
  sapphire: ['#E3EBFB', '#1E3E8C'],
  neutral: ['#EAE3F4', '#2D1664'],
};
const CHIP_DARK: Record<ChipKind, [string, string]> = {
  sand: ['rgba(217,147,43,.16)', '#F2C27A'],
  jade: ['rgba(46,158,134,.16)', '#8FE0CB'],
  garnet: ['rgba(184,67,94,.2)', '#F0A3B6'],
  sapphire: ['rgba(63,111,214,.2)', '#A9C0F5'],
  neutral: ['rgba(255,255,255,.08)', '#E8D4A2'],
};

export const chipColors = (kind: ChipKind, dark?: boolean) => (dark ? CHIP_DARK : CHIP_LIGHT)[kind];

export const StatusChip: React.FC<{
  kind: ChipKind;
  dark?: boolean;
  lead?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ kind, dark, lead, children, className = '' }) => {
  const [bg, fg] = chipColors(kind, dark);
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap ${className}`}
      style={{
        background: bg,
        color: fg,
        boxShadow: `inset 0 0 0 1px ${fg}33`,
      }}
    >
      {lead}
      {children}
    </span>
  );
};

/* ─────────────────────────── الصورة الرمزية ─────────────────────────── */

export const Avatar: React.FC<{ letter: string; size?: number; dark?: boolean }> = ({ letter, size = 48 }) => (
  <span
    className="shrink-0 rounded-full p-[2.5px] lux-metal flex"
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <span
      className="w-full h-full rounded-full flex items-center justify-center font-bold"
      style={{
        background: '#2A1658',
        color: C.chl,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {letter}
    </span>
  </span>
);

/* ─────────────────────────── شعار AMASA RESORT ─────────────────────────── */

export const BrandMark: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <span
    className="lx-tile lx-tone-ink lx-rim"
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    aria-hidden="true"
  >
    <LuxIcon name="gem" size={Math.round(size * 0.56)} />
  </span>
);

/* ─────────────────────────── بلاطة أيقونة (خلفية ناعمة + خط رفيع) ─────────────────────────── */

export type TileTone = 'amy' | 'ink' | 'ch' | 'jade' | 'sand' | 'garn' | 'saph';

export const IconTile: React.FC<{
  name: IconName;
  tone?: TileTone;
  size?: number;
  /** حدّ شمبانيا بدل حدّ اللون */
  rim?: boolean;
  /** نسخة للأسطح الداكنة */
  dark?: boolean;
  className?: string;
}> = ({ name, tone = 'amy', size = 48, rim, dark, className = '' }) => (
  <span
    className={`lx-tile lx-tone-${tone} ${dark ? 'lx-dark' : ''} ${rim ? 'lx-rim' : ''} ${className}`}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    aria-hidden="true"
  >
    <LuxIcon name={name} size={Math.round(size * 0.5)} strokeWidth={1.6} />
  </span>
);

/** فقاعة عدّاد */
export const CountBadge: React.FC<{ value: number | string; className?: string }> = ({ value, className = '' }) => (
  <span
    className={`lx-count min-w-[24px] h-6 px-2 rounded-full text-[12px] font-bold inline-flex items-center justify-center ${className}`}
  >
    {value}
  </span>
);

/* ─────────────────────────── الأزرار ─────────────────────────── */

export const PrimaryPill: React.FC<{
  label: string;
  icon: IconName;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: boolean;
  /** ink: بنفسجي داكن بحدّ شمبانيا (الافتراضي) — gold: شمبانيا للأسطح الداكنة */
  variant?: 'ink' | 'gold';
  className?: string;
}> = ({ label, icon, onClick, disabled, trailing = true, variant = 'ink', className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`${variant === 'gold' ? 'lx-gold' : 'lx-ink'} w-full h-14 flex items-center gap-3 ps-[9px] pe-[18px] rounded-full text-[15px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    <span
      className="shrink-0 w-[38px] h-[38px] rounded-full flex items-center justify-center"
      style={
        variant === 'gold'
          ? { color: '#2B1A00', background: 'rgba(255,255,255,.4)', boxShadow: 'inset 0 0 0 1px rgba(43,26,0,.14)' }
          : { color: C.chl, background: 'rgba(255,255,255,.08)', boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.4)' }
      }
    >
      <LuxIcon name={icon} size={22} />
    </span>
    <span className="flex-1 text-right">{label}</span>
    {trailing && <LuxIcon name="chevL" size={20} />}
  </button>
);

/** زر دائري 52px مع تسمية — لصف الردود السريعة */
export const RoundAction: React.FC<{
  label: string;
  icon: IconName;
  onClick?: () => void;
  dark?: boolean;
}> = ({ label, icon, onClick, dark }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex flex-col items-center gap-2.5 bg-transparent border-0 p-0 pb-1 cursor-pointer text-center"
  >
    <span
      className={`${dark ? 'lx-dome-dark' : 'lx-dome'} w-[54px] h-[54px] rounded-full flex items-center justify-center`}
      style={{ color: dark ? C.chl : C.am }}
    >
      <LuxIcon name={icon} size={24} />
    </span>
    <span className="text-[12.5px] font-medium leading-snug" style={{ color: dark ? C.dim : C.mut }}>
      {label}
    </span>
  </button>
);

/* ─────────────────────────── مؤشر الماسة ─────────────────────────── */

export const DiamondGauge: React.FC<{ value: number; main: string; sub: string; size?: number }> = ({
  value,
  main,
  sub,
  size = 132,
}) => {
  const id = useId().replace(/:/g, '');
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140" fill="none" aria-hidden="true" className="absolute inset-0">
        <defs>
          <linearGradient id={`champ-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F1E1B5" />
            <stop offset=".55" stopColor="#C9A45C" />
            <stop offset="1" stopColor="#A98443" />
          </linearGradient>
        </defs>
        <path d="M70 10 130 70 70 130 10 70z" stroke="rgba(255,255,255,.14)" strokeWidth="6" strokeLinejoin="round" pathLength={100} />
        <path
          d="M70 10 130 70 70 130 10 70z"
          stroke={`url(#champ-${id})`}
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(v * 100, v > 0 ? 1 : 0)} 100`}
        />
        <path d="M70 30 110 70 70 110 30 70z" stroke="rgba(255,255,255,.10)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[30px] font-bold leading-none" style={{ color: C.snow }} dir="ltr">
          {main}
        </span>
        <span className="text-[12.5px]" style={{ color: C.dim }}>
          {sub}
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────────── محدّد السحب للتأكيد ─────────────────────────── */

const HANDLE = 56;
const PAD = 4;

/**
 * اسحب لليسار (اتجاه RTL) لتأكيد إجراء مهم دون نافذة تأكيد.
 * الضغط العادي لا يؤكّد؛ أمّا لوحة المفاتيح/قارئ الشاشة فيؤكّدان بزر Enter.
 */
export const SlideToConfirm: React.FC<{
  label: string;
  doneLabel?: string;
  onConfirm: () => void;
  icon?: IconName;
  disabled?: boolean;
}> = ({ label, doneLabel = 'جارٍ التأكيد…', onConfirm, icon = 'in', disabled }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const travelRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (!done) return;
    // إن لم تتغيّر الحالة من الخارج (فشل مثلاً) نعيد المحدّد لوضعه
    const t = window.setTimeout(() => {
      setDone(false);
      setDx(0);
    }, 2600);
    return () => window.clearTimeout(t);
  }, [done]);

  const measure = useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 280;
    travelRef.current = Math.max(80, w - HANDLE - PAD * 2);
    return travelRef.current;
  }, []);

  const finish = useCallback(() => {
    const travel = travelRef.current || measure();
    setDx(travel);
    setDone(true);
    onConfirm();
  }, [measure, onConfirm]);

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || done) return;
    measure();
    startX.current = e.clientX;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDx(Math.max(0, Math.min(travelRef.current, startX.current - e.clientX)));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dx > travelRef.current * 0.8) finish();
    else setDx(0);
  };
  const onClick = (e: React.MouseEvent) => {
    if (disabled || done) return;
    if (e.detail === 0) {
      measure();
      finish(); // لوحة مفاتيح / قارئ شاشة
    } else {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 500);
    }
  };

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={label}
      className="relative h-16 rounded-full overflow-hidden select-none"
      style={{
        background: 'rgba(255,255,255,.05)',
        boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.42)',
        opacity: disabled ? 0.5 : 1,
        touchAction: 'pan-y',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0"
        style={{
          width: dx + 64,
          background: 'rgba(201,164,92,.20)',
          transition: dragging ? 'none' : 'width .32s cubic-bezier(.2,.9,.3,1)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center gap-1.5 text-[15px] font-semibold pr-14"
        style={{ color: C.chl }}
      >
        {done ? (
          <>
            <LuxIcon name="spin" size={20} />
            <span>{doneLabel}</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            {[0, 0.15, 0.3].map((d) => (
              <svg
                key={d}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lux-chev block"
                style={{ animationDelay: `${d}s` }}
              >
                <path d="M14.5 6 8.5 12l6 6" />
              </svg>
            ))}
          </>
        )}
      </div>
      <button
        type="button"
        aria-label={`${label} — اسحب لليسار، أو اضغط Enter`}
        disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={onClick}
        className="absolute p-0 border-0 bg-transparent cursor-grab active:cursor-grabbing"
        style={{
          top: PAD,
          right: PAD,
          width: HANDLE,
          height: HANDLE,
          touchAction: 'none',
          transform: `translateX(${-dx - (nudge ? 14 : 0)}px)`,
          transition: dragging ? 'none' : 'transform .32s cubic-bezier(.2,.9,.3,1)',
        }}
      >
        <span className="flex items-center justify-center w-full h-full">
          <span
            className="lux-metal flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              transform: 'rotate(45deg)',
              boxShadow: '0 8px 18px -8px rgba(201,164,92,.7)',
            }}
          >
            <span className="flex" style={{ transform: 'rotate(-45deg)', color: C.ink }}>
              <LuxIcon name={icon} size={22} />
            </span>
          </span>
        </span>
      </button>
    </div>
  );
};
