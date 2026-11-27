import React, { useEffect, useState } from 'react';
import type { Booking } from '../../types';
import {
  Avatar,
  C,
  DiamondGauge,
  Gem,
  type IconName,
  LuxIcon,
  PrimaryPill,
  RoundAction,
  SlideToConfirm,
  StatusChip,
} from '../ui/lux';
import { BellRing, Send, X, Shield, Users } from 'lucide-react';
import { Sheet, Field, Row, Acts, Act } from '../ui/kit';

type Role = 'admin' | 'guard' | 'marketer';
type Tab = 'in' | 'out' | 'track';
type Kind = 'in' | 'out';

interface Template {
  key: string;
  /** الاسم الكامل (يظهر في شريط النماذج داخل نافذة الإرسال) */
  label: string;
  /** اسم قصير تحت الزر الدائري */
  short: string;
  icon: IconName;
  to: 'guard' | 'marketer';
  title: string;
  text: (b: Booking) => string;
  show?: (b: Booking) => boolean;
}

interface Stages {
  isEntered: boolean;
  isRemainingPaid: boolean;
  isInsurancePaid: boolean;
  isCheckedOut: boolean;
  isInsuranceRefunded: boolean;
  completedCount: number;
}

interface Props {
  role: Role;
  todayStr: string;
  arrivals: Booking[];
  departures: Booking[];
  inStay: Booking[];
  getStages: (b: Booking) => Stages;
  /** فتح نافذة التأكيد (الإدارة) */
  onGuardAction: (kind: 'arrive' | 'exit', b: Booking) => void;
  /** تنفيذ مباشر بعد السحب (الحارس) */
  onGuardConfirm?: (kind: 'arrive' | 'exit', b: Booking) => void;
  sendAlert: (p: { bookingId: string; to: 'guard' | 'marketer'; title: string; text: string }) => void;
  notify: (msg: string) => void;
}

const who = (b: Booking) => `${b.customerName} (${b.bookingNumber})`;
const fmt = (n?: number) => Number(n || 0).toLocaleString('en-US');
/** الأرقام الهندية → لاتينية (اتساقاً مع بقية التطبيق) */
const latin = (s?: string) => (s || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

// نصوص جاهزة: الحارس ← المسوق
const GUARD_TO_MARKETER: Record<Kind, Template[]> = {
  in: [
    {
      key: 'g-late',
      label: 'لم يصل بعد',
      short: 'لم يصل بعد',
      icon: 'clock',
      to: 'marketer',
      title: 'العميل لم يصل بعد',
      text: (b) => `العميل ${who(b)} موعد دخوله اليوم ولم يصل بعد. المطلوب: التواصل معه لمعرفة وقت وصوله.`,
    },
    {
      key: 'g-pay',
      label: 'وصل وعليه متبقي',
      short: 'وصل وعليه متبقي',
      icon: 'cash',
      to: 'marketer',
      title: 'العميل وصل وعليه متبقي',
      show: (b) => (b.remainingAmount || 0) > 0,
      text: (b) => `العميل ${who(b)} وصل وعليه متبقي ${b.remainingAmount} ر.س. المطلوب: إكمال المتبقي والتأمين عبر النظام.`,
    },
    {
      key: 'g-ins',
      label: 'التأمين لم يُسدَّد',
      short: 'التأمين لم يُسدَّد',
      icon: 'shield',
      to: 'marketer',
      title: 'التأمين لم يُسدَّد',
      text: (b) => `العميل ${who(b)} لم يسدّد التأمين (${b.insuranceAmount} ر.س). المطلوب: تأكيد طريقة السداد (تحويل أو كاش عند الحارس).`,
    },
  ],
  out: [
    {
      key: 'g-leaving',
      label: 'بدأ المغادرة',
      short: 'بدأ المغادرة',
      icon: 'out',
      to: 'marketer',
      title: 'بدأ العميل المغادرة',
      text: (b) => `العميل ${who(b)} بدأ المغادرة وجارٍ فحص الاستراحة. سيصلك تأكيد النظافة والخروج بعد الفحص.`,
    },
    {
      key: 'g-issue',
      label: 'ملاحظة على الاستراحة',
      short: 'ملاحظة فحص',
      icon: 'alert',
      to: 'marketer',
      title: 'ملاحظة أثناء فحص الخروج',
      text: (b) => `أثناء فحص خروج العميل ${who(b)} وُجدت ملاحظة: ........ المطلوب: توجيه الحارس بما يلزم وإبلاغ العميل.`,
    },
  ],
};

// نصوص جاهزة: المسوق/الإدارة ← الحارس
const MARKETER_TO_GUARD: Record<Kind, Template[]> = {
  in: [
    {
      key: 'm-prep',
      label: 'جهّز الاستراحة',
      short: 'جهّز الاستراحة',
      icon: 'spark',
      to: 'guard',
      title: 'تجهيز الاستراحة للوصول',
      text: (b) => `جهّز ${b.propertyName} لاستقبال العميل ${who(b)} اليوم. المطلوب: النظافة وتشغيل التكييف وفتح الاستراحة عند وصوله.`,
    },
    {
      key: 'm-cash',
      label: 'استلم المتبقي كاش',
      short: 'استلم المتبقي',
      icon: 'cash',
      to: 'guard',
      title: 'استلام المتبقي كاش',
      show: (b) => (b.remainingAmount || 0) > 0,
      text: (b) => `استلم من العميل ${who(b)} المتبقي كاش وقدره ${b.remainingAmount} ر.س وأكّد الاستلام في النظام.`,
    },
    {
      key: 'm-ins',
      label: 'استلم التأمين كاش',
      short: 'استلم التأمين',
      icon: 'shield',
      to: 'guard',
      title: 'استلام التأمين كاش',
      text: (b) => `استلم من العميل ${who(b)} مبلغ التأمين كاش وقدره ${b.insuranceAmount} ر.س وأكّد الاستلام في النظام.`,
    },
  ],
  out: [
    {
      key: 'm-remind',
      label: 'تذكير الخروج',
      short: 'تذكير الخروج',
      icon: 'clock',
      to: 'guard',
      title: 'تذكير خروج اليوم',
      text: (b) => `اليوم خروج العميل ${who(b)}. المطلوب: متابعة خروجه ومعاينة الاستراحة مباشرة بعد المغادرة.`,
    },
    {
      key: 'm-inspect',
      label: 'افحص وأكّد النظافة',
      short: 'افحص وأكّد',
      icon: 'search',
      to: 'guard',
      title: 'فحص الاستراحة بعد الخروج',
      text: (b) => `بعد خروج ${who(b)} افحص الاستراحة وأكّد النظافة في النظام، وأبلغنا فوراً بأي أضرار لتوثيقها بالصور.`,
    },
  ],
};

const STAGE_NAMES = ['الدخول', 'المتبقي', 'التأمين', 'الخروج', 'الاسترجاع'];
const STAGE_ICONS: IconName[] = ['in', 'cash', 'shield', 'out', 'check'];

const todayLabel = () => {
  try {
    return new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
};

const isArrived = (b: Booking) => Boolean(b.guestArrived || b.arrivalConfirmedAt);

/* ═════════════════════════ مسار الإقامة (5 جواهر) ═════════════════════════ */

const StayTracker: React.FC<{ flags: boolean[]; dark: boolean }> = ({ flags, dark }) => {
  const firstPending = flags.findIndex((f) => !f);
  return (
    <div className="flex items-start" aria-label="مراحل الحجز">
      {flags.map((on, i) => {
        const state: 'done' | 'now' | 'next' = on ? 'done' : i === firstPending ? 'now' : 'next';
        const face =
          state === 'done'
            ? { background: dark ? 'rgba(46,158,134,.18)' : '#E1F3EE', boxShadow: `inset 0 0 0 2px ${C.jade}`, color: dark ? '#8FE0CB' : '#1F8A72' }
            : state === 'now'
            ? { background: dark ? 'rgba(217,147,43,.16)' : '#FBEFD9', boxShadow: `inset 0 0 0 2px ${C.sand}`, color: dark ? '#F2C27A' : '#B97A12' }
            : { background: dark ? 'rgba(255,255,255,.04)' : '#fff', border: `2px dashed ${dark ? 'rgba(191,178,220,.35)' : '#D9CFEA'}`, color: dark ? '#8E82AE' : '#A89BC4' };
        return (
          <React.Fragment key={i}>
            <div className="w-[56px] shrink-0 flex flex-col items-center gap-2">
              <div className="relative w-11 h-11">
                {state === 'now' && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-1.5 rounded-full lux-halo"
                    style={{ boxShadow: '0 0 0 2px rgba(217,147,43,.4)' }}
                  />
                )}
                <span className="absolute inset-0 rounded-full flex items-center justify-center box-border" style={face}>
                  <LuxIcon name={STAGE_ICONS[i]} size={22} />
                </span>
                {state === 'done' && (
                  <span
                    className="absolute -top-1 -left-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                    style={{ background: C.jade, boxShadow: `0 0 0 2px ${dark ? C.card : '#fff'}` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
              </div>
              <span
                className="text-[12px] font-semibold whitespace-nowrap"
                style={{ color: state === 'next' ? (dark ? C.dim : C.mut) : dark ? C.snow : C.txt }}
              >
                {STAGE_NAMES[i]}
              </span>
            </div>
            {i < flags.length - 1 && (
              <span
                aria-hidden="true"
                className="flex-1 h-[3px] mt-[20px] rounded-full min-w-1"
                style={{
                  background:
                    on && flags[i + 1]
                      ? 'linear-gradient(90deg,#F1E1B5,#C9A45C 55%,#8D6B2C)'
                      : on
                      ? 'linear-gradient(90deg,#E7E0EF,#C9A45C)'
                      : dark
                      ? 'rgba(255,255,255,.12)'
                      : '#E7E0EF',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ═════════════════════════ بطاقة حجز ═════════════════════════ */

interface CardProps {
  b: Booking;
  tab: Tab;
  role: Role;
  dark: boolean;
  todayStr: string;
  stages: Stages;
  templates: Template[];
  flash?: string;
  expanded: boolean;
  onToggle: () => void;
  onCompose: (t: Template) => void;
  onPill: (kind: 'arrive' | 'exit') => void;
  onSlide: (kind: 'arrive' | 'exit') => void;
}

const BookingCard: React.FC<CardProps> = ({
  b,
  tab,
  role,
  dark,
  todayStr,
  stages,
  templates,
  flash,
  expanded,
  onToggle,
  onCompose,
  onPill,
  onSlide,
}) => {
  const arrived = isArrived(b);
  const stageFlags = [stages.isEntered, stages.isRemainingPaid, stages.isInsurancePaid, stages.isCheckedOut, stages.isInsuranceRefunded];
  const settled = tab === 'out' ? Boolean(b.checkedOut) : tab === 'in' ? arrived : false;
  const compact = settled && !expanded && !flash;

  const canArrive = role !== 'marketer' && tab === 'in' && !arrived && todayStr >= b.checkInDate;
  const canExit = role !== 'marketer' && tab === 'out' && !b.checkedOut;
  const actionKind: 'arrive' | 'exit' | null = canArrive ? 'arrive' : canExit ? 'exit' : null;

  const remainingPaid = (b.remainingAmount || 0) <= 0;
  const insurancePaid = Boolean(stages.isInsurancePaid);

  const txt = dark ? C.snow : C.txt;
  const sub = dark ? C.dim : C.mut;
  const subLine = `${b.propertyName}${b.sectionName ? ` · ${b.sectionName}` : ''}`;

  const statusChip =
    tab === 'out' ? (
      b.checkedOut ? (
        <StatusChip kind="jade" dark={dark} lead={<LuxIcon name="check" size={16} />}>
          خرج {latin(b.checkedOutAt)}
        </StatusChip>
      ) : (
        <StatusChip kind="sand" dark={dark} lead={<Gem color={C.sand} size={12} pulse />}>
          لم يخرج بعد
        </StatusChip>
      )
    ) : arrived ? (
      <StatusChip kind="jade" dark={dark} lead={<LuxIcon name="check" size={16} />}>
        {tab === 'track' ? 'مقيم الآن' : `وصل ${latin(b.guestArrivedAt || b.arrivalConfirmedAt)}`}
      </StatusChip>
    ) : (
      <StatusChip kind="sand" dark={dark} lead={<Gem color={C.sand} size={12} pulse />}>
        {tab === 'track' ? 'لم يصل بعد' : 'بانتظار الوصول'}
      </StatusChip>
    );

  const surface: React.CSSProperties = dark
    ? { background: C.card, boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.28), 0 24px 40px -24px rgba(0,0,0,.7)' }
    : {};

  /* ── صف مضغوط (الذين وصلوا/خرجوا) ── */
  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        className={`w-full text-right px-4 py-3 flex items-center gap-3 cursor-pointer active:scale-[.99] transition-transform ${dark ? 'rounded-[24px]' : 'lux-card !rounded-[22px]'}`}
        style={surface}
      >
        <Avatar letter={(b.customerName || '?').trim().charAt(0)} size={40} />
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-bold truncate" style={{ color: txt }}>
            {b.customerName}
          </span>
          <span className="block text-[12.5px] truncate mt-0.5" style={{ color: sub }}>
            {subLine}
          </span>
        </span>
        {statusChip}
      </button>
    );
  }

  return (
    <article
      className={`p-4 flex flex-col gap-3.5 ${dark ? 'rounded-[28px]' : 'lux-card'}`}
      style={surface}
    >
      {/* الرأس */}
      <div className="flex items-center gap-3">
        <Avatar letter={(b.customerName || '?').trim().charAt(0)} size={48} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold leading-snug" style={{ color: txt }}>
            {b.customerName}
          </div>
          <div className="text-[12.5px] mt-0.5 leading-snug" style={{ color: sub }}>
            {subLine} · <bdi dir="ltr">{b.bookingNumber}</bdi>
          </div>
        </div>
        {settled && expanded && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="طيّ البطاقة"
            className="w-11 h-11 -m-1 rounded-full flex items-center justify-center cursor-pointer"
            style={{ color: sub }}
          >
            <LuxIcon name="chevL" size={20} style={{ transform: 'rotate(90deg)' }} />
          </button>
        )}
      </div>

      {/* الشارات */}
      <div className="flex flex-wrap gap-2">
        {statusChip}
        {remainingPaid ? (
          <StatusChip kind="jade" dark={dark} lead={<LuxIcon name="check" size={16} />}>
            المتبقي مسدد
          </StatusChip>
        ) : (
          <StatusChip kind="sand" dark={dark} lead={<LuxIcon name="cash" size={16} />}>
            متبقي {fmt(b.remainingAmount)}
          </StatusChip>
        )}
        {insurancePaid ? (
          <StatusChip kind="jade" dark={dark} lead={<LuxIcon name="check" size={16} />}>
            التأمين مسدد
          </StatusChip>
        ) : (
          <StatusChip kind="sapphire" dark={dark} lead={<LuxIcon name="shield" size={16} />}>
            تأمين {fmt(b.insuranceAmount)}
          </StatusChip>
        )}
      </div>

      {/* مسار الإقامة */}
      {tab === 'track' && <StayTracker flags={stageFlags} dark={dark} />}

      {/* آخر تنبيه */}
      {b.lastAlert && (
        <div
          className="flex items-center gap-3 rounded-[22px] px-3 py-2.5"
          style={
            dark
              ? { background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }
              : { background: C.pearl, boxShadow: 'inset 0 0 0 1px #E7E0EF' }
          }
        >
          <span
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: dark ? 'rgba(217,147,43,.16)' : '#FBEFD9', color: dark ? '#F2C27A' : '#B97A12' }}
          >
            <LuxIcon name="bell" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px]" style={{ color: sub }}>
              آخر تنبيه · {b.lastAlert.by} · {latin(b.lastAlert.at)}
            </div>
            <div className="text-[13.5px] font-semibold mt-0.5 leading-snug line-clamp-2" style={{ color: txt }}>
              {b.lastAlert.text}
            </div>
          </div>
        </div>
      )}

      {/* الإجراء الرئيسي */}
      {tab !== 'track' && actionKind && !flash && (
        <>
          {dark ? (
            <SlideToConfirm
              label={actionKind === 'arrive' ? 'اسحب لتأكيد الوصول' : 'اسحب لتأكيد الخروج'}
              icon={actionKind === 'arrive' ? 'in' : 'out'}
              onConfirm={() => onSlide(actionKind)}
            />
          ) : (
            <PrimaryPill
              label={actionKind === 'arrive' ? 'تأكيد وصول العميل' : 'تأكيد النظافة والخروج'}
              icon={actionKind === 'arrive' ? 'in' : 'out'}
              onClick={() => onPill(actionKind)}
            />
          )}
        </>
      )}
      {flash && (
        <div
          className="flex items-center gap-2.5 min-h-14 py-2 ps-2 pe-4 rounded-[28px]"
          style={
            dark
              ? { background: 'rgba(46,158,134,.16)', boxShadow: 'inset 0 0 0 1px rgba(46,158,134,.55)', color: '#8FE0CB' }
              : { background: '#E1F3EE', boxShadow: 'inset 0 0 0 1px rgba(46,158,134,.5)', color: '#0E5A49' }
          }
          role="status"
        >
          <LuxIcon name="check" size={30} />
          <div className="flex-1 text-[13.5px] font-semibold leading-snug">{flash}</div>
        </div>
      )}

      {/* الردود السريعة */}
      {tab !== 'track' && templates.length > 0 && (
        <div
          className="grid gap-x-1 gap-y-3"
          style={{
            gridTemplateColumns: `repeat(${
              templates.length <= 4 ? templates.length : templates.length % 3 === 0 || templates.length === 5 ? 3 : 4
            }, minmax(0, 1fr))`,
          }}
          role="group"
          aria-label="ردود وتنبيهات سريعة"
        >
          {templates.map((t) => (
            <div key={t.key} className="flex justify-center">
              <RoundAction label={t.short} icon={t.icon} dark={dark} onClick={() => onCompose(t)} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
};

/* ═════════════════════════ اللوحة ═════════════════════════ */

export const FollowUpBoard: React.FC<Props> = ({
  role,
  todayStr,
  arrivals,
  departures,
  inStay,
  getStages,
  onGuardAction,
  onGuardConfirm,
  sendAlert,
  notify,
}) => {
  const [tab, setTab] = useState<Tab>('in');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [compose, setCompose] = useState<{ b: Booking; kind: Kind; key: string; to: 'guard' | 'marketer'; title: string; text: string } | null>(null);

  const dark = role === 'guard';
  const arrivedCount = arrivals.filter(isArrived).length;
  const waitingCount = arrivals.length - arrivedCount;
  const outDone = departures.filter((b) => b.checkedOut).length;

  // أغلق نافذة الإرسال بزر Escape
  useEffect(() => {
    if (!compose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setCompose(null);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [compose]);

  const templatesFor = (kind: Kind, b: Booking): Template[] => {
    const g = GUARD_TO_MARKETER[kind];
    const m = MARKETER_TO_GUARD[kind];
    const list = role === 'guard' ? g : role === 'marketer' ? m : [...m, ...g];
    const arrivedNow = isArrived(b);
    return list.filter((t) => (!t.show || t.show(b)) && !(arrivedNow && (t.key === 'g-late' || t.key === 'm-prep')));
  };

  const list = tab === 'in' ? arrivals : tab === 'out' ? departures : inStay;
  const kindOf: Kind = tab === 'out' ? 'out' : 'in';

  const openCompose = (b: Booking, t: Template) =>
    setCompose({ b, kind: kindOf, key: t.key, to: t.to, title: t.title, text: t.text(b) });

  const freeTitle = role === 'admin' ? 'تنبيه من الإدارة' : role === 'guard' ? 'تنبيه من الحارس' : 'تنبيه من المسوق';

  const flashFor = (id: string, msg: string) => {
    setFlash((f) => ({ ...f, [id]: msg }));
    window.setTimeout(
      () =>
        setFlash((f) => {
          const n = { ...f };
          delete n[id];
          return n;
        }),
      4500
    );
  };

  const slide = (kind: 'arrive' | 'exit', b: Booking) => {
    (onGuardConfirm || onGuardAction)(kind, b);
    flashFor(
      b.id,
      kind === 'arrive'
        ? 'تم تأكيد الوصول — أُرسل التنبيه للمسوّق والإدارة'
        : 'تم تأكيد النظافة والخروج — أُغلقت دورة الحجز'
    );
  };

  /* ── الأقسام ── */
  const tabBtn = (k: Tab, icon: IconName, label: string, n: number) => {
    const on = tab === k;
    return (
      <button
        key={k}
        type="button"
        aria-pressed={on}
        onClick={() => setTab(k)}
        className="flex-1 h-16 rounded-[18px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-[12.5px] font-semibold"
        style={
          dark
            ? on
              ? { background: C.card, color: C.snow, boxShadow: 'inset 0 0 0 1px rgba(201,164,92,.45)' }
              : { background: 'transparent', color: C.dim }
            : on
            ? { background: '#fff', color: C.txt, boxShadow: '0 6px 14px -8px rgba(27,14,51,.45)' }
            : { background: 'transparent', color: C.mut }
        }
      >
        <span className="relative flex" style={{ color: on ? (dark ? C.chl : C.am) : dark ? C.dim : C.mut }}>
          <LuxIcon name={icon} size={22} />
          <span
            className="absolute -top-2 -left-4 min-w-[20px] h-[20px] px-[5px] rounded-full text-[12px] font-bold flex items-center justify-center"
            style={
              on
                ? { background: C.ink, color: C.chl }
                : { background: dark ? 'rgba(255,255,255,.1)' : 'rgba(27,14,51,.12)', color: dark ? C.dim : C.mut }
            }
          >
            {n}
          </span>
        </span>
        <span>{label}</span>
      </button>
    );
  };

  const heading =
    tab === 'in' ? 'الوصول المتوقع اليوم' : tab === 'out' ? 'المغادرة المتوقعة اليوم' : 'المقيمون الآن';

  const stat = (color: string, label: string, val: string, pulse?: boolean) => (
    <div className="flex items-center gap-2 text-[13px]" style={{ color: C.dim }}>
      <Gem color={color} size={11} pulse={pulse} />
      <span className="flex-1">{label}</span>
      <span className="text-[14.5px] font-bold" style={{ color: C.snow }} dir="ltr">
        {val}
      </span>
    </div>
  );

  const content = (
    <>
      {/* اللوحة العليا */}
      <div className={`lux-hero flex items-center gap-3 ${dark ? 'p-4' : 'p-5'}`}>
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <span
              className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
              style={{ background: 'rgba(46,158,134,.18)', color: '#8FE0CB' }}
            >
              <Gem color={C.jade} size={10} pulse />
              مباشر
            </span>
            <span className="text-[12.5px]" style={{ color: C.dim }}>
              {todayLabel()}
            </span>
          </div>
          <div className="text-[26px] font-bold leading-tight" style={{ color: C.snow }}>
            مركز المتابعة
          </div>
          <div className="flex flex-col gap-2">
            {stat(C.jade, 'خروج اليوم', `${outDone}/${departures.length}`)}
            {stat(C.sand, 'داخل الاستراحة', `${inStay.length}`, inStay.length > 0)}
            {stat(C.garn, 'بانتظار الوصول', `${waitingCount}`)}
          </div>
        </div>
        <div className="relative">
          <DiamondGauge
            value={arrivals.length ? arrivedCount / arrivals.length : 0}
            main={`${arrivedCount}/${arrivals.length}`}
            sub="وصلوا اليوم"
            size={dark ? 116 : 128}
          />
        </div>
      </div>

      {/* الأقسام */}
      <div
        role="group"
        aria-label="أقسام المتابعة"
        className="flex gap-1 p-1 rounded-[22px]"
        style={{ background: dark ? 'rgba(255,255,255,.06)' : C.lav }}
      >
        {tabBtn('in', 'in', 'دخول اليوم', arrivals.length)}
        {tabBtn('out', 'out', 'خروج اليوم', departures.length)}
        {tabBtn('track', 'route', 'تتبع المسار', inStay.length)}
      </div>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-[15px] font-bold" style={{ color: dark ? C.snow : C.txt }}>
          {heading}
        </h3>
        <span className="text-[12.5px]" style={{ color: dark ? C.dim : C.mut }}>
          {list.length} {list.length === 1 ? 'حجز' : 'حجوزات'}
        </span>
      </div>

      {/* القائمة */}
      {list.length === 0 ? (
        <div
          className={`flex flex-col items-center gap-3 py-10 ${dark ? 'rounded-[28px]' : 'lux-card'}`}
          style={dark ? { background: C.card, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' } : undefined}
        >
          <span style={{ color: dark ? C.chl : C.ch }}>
            <LuxIcon name="gem" size={36} />
          </span>
          <p className="text-[14px]" style={{ color: dark ? C.dim : C.mut }}>
            لا توجد حجوزات في هذه القائمة اليوم
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              tab={tab}
              role={role}
              dark={dark}
              todayStr={todayStr}
              stages={getStages(b)}
              templates={tab === 'track' ? [] : templatesFor(kindOf, b)}
              flash={flash[b.id]}
              expanded={tab === 'track' ? true : Boolean(open[b.id])}
              onToggle={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))}
              onCompose={(t) => openCompose(b, t)}
              onPill={(k) => onGuardAction(k, b)}
              onSlide={(k) => slide(k, b)}
            />
          ))}
        </div>
      )}
    </>
  );

  /* ── نافذة الإرسال ── */
  const sheet = compose && (
    <Sheet
      title="إرسال تنبيه"
      icon={BellRing}
      tone="amy"
      onClose={() => setCompose(null)}
      footer={
        <Acts cols={2}>
          <Act
            tone="ink"
            icon={Send}
            label="إرسال التنبيه"
            disabled={!compose.text.trim()}
            onClick={() => {
              sendAlert({ bookingId: compose.b.id, to: compose.to, title: compose.title, text: compose.text.trim() });
              notify('تم إرسال التنبيه بنجاح ✓');
              setCompose(null);
            }}
          />
          <Act tone="line" icon={X} label="إلغاء" onClick={() => setCompose(null)} />
        </Acts>
      }
    >
      <Row
        icon={compose.to === 'guard' ? Shield : Users}
        tone="amy"
        title="سيصل التنبيه إلى"
        sub={
          compose.to === 'guard'
            ? 'حارس العقار والإدارة'
            : `${(compose.b.marketerName || 'مسوق الحجز').replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim()} والإدارة`
        }
      />

      <Field label="النص الجاهز" hint={compose.title}>
        <select
          aria-label="نصوص جاهزة"
          value={compose.key}
          onChange={(e) => {
            const k = e.target.value;
            const t = templatesFor(compose.kind, compose.b).find((x) => x.key === k);
            setCompose(
              t
                ? { ...compose, key: t.key, to: t.to, title: t.title, text: t.text(compose.b) }
                : { ...compose, key: 'free', title: freeTitle, text: '' }
            );
          }}
          className="kt-input"
        >
          {templatesFor(compose.kind, compose.b).map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
          <option value="free">نص حرّ</option>
        </select>
      </Field>

      <Field label="الرسالة" hint={`${compose.text.length} حرف`}>
        <textarea
          id="followup-msg"
          value={compose.text}
          onChange={(e) => setCompose({ ...compose, text: e.target.value })}
          rows={5}
          placeholder="اكتب رسالتك هنا"
          className="kt-input kt-ta"
        />
      </Field>
    </Sheet>
  );

  return dark ? (
    <section
      dir="rtl"
      aria-label="مركز المتابعة"
      className="relative overflow-hidden rounded-[34px] p-3.5 flex flex-col gap-3.5"
      style={{ background: C.night, boxShadow: '0 24px 44px -24px rgba(19,10,36,.8), inset 0 0 0 1px rgba(201,164,92,.22)' }}
    >
      <div
        aria-hidden="true"
        className="absolute top-0 inset-x-0 h-[420px] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg,rgba(201,164,92,.08) 0 1px,transparent 1px 20px),repeating-linear-gradient(-45deg,rgba(201,164,92,.08) 0 1px,transparent 1px 20px)',
          WebkitMaskImage: 'linear-gradient(180deg,#000,transparent)',
          maskImage: 'linear-gradient(180deg,#000,transparent)',
        }}
      />
      <div className="relative flex flex-col gap-3.5">{content}</div>
      {sheet}
    </section>
  ) : (
    <section dir="rtl" aria-label="مركز المتابعة" className="flex flex-col gap-3.5">
      {content}
      {sheet}
    </section>
  );
};
