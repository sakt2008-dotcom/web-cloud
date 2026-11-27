/**
 * لبنات بطاقات لوحة التحكم — كلها بقياسات متساوية ونصوص قصيرة بسطر واحد.
 * (عرض فقط: لا منطق أعمال هنا، كل الإجراءات تُمرَّر من DashboardTab)
 */
import React from 'react';
import { Building2, Check, Copy, Home, MessageCircle, Phone, Send, ShieldCheck, UploadCloud, Users, X } from 'lucide-react';
import type { Booking } from '../../types';
import { Act, Acts, Field, Info, Infos, Tag, Tile, type Ico, type Tone } from '../ui/kit';

export { fmtN, nightsText } from '../../lib/format';
import { fmtN } from '../../lib/format';

/** رأس بطاقة الحجز: اسم العميل + رقم الحجز + بلاطات (الجوال/المسوق/الدخول/الخروج) */
export const BkTop: React.FC<{ bk: Booking; todayStr: string }> = ({ bk, todayStr }) => {
  const inToday = bk.checkInDate === todayStr;
  const outToday = bk.checkOutDate === todayStr;
  return (
    <>
      <div className="kt-bk-h">
        <Tile icon={Home} tone="amy" size={40} />
        <span className="kt-row-t">
          <span className="kt-row-n">{bk.customerName}</span>
          <span className="kt-row-s">
            {bk.propertyName}
            {bk.sectionName ? ` · ${bk.sectionName}` : ''}
          </span>
        </span>
        <Tag tone="amy" mono>
          {bk.bookingNumber}
        </Tag>
      </div>
      <Infos cols={2}>
        <Info label="الجوال" ltr wide={!bk.marketerName} value={bk.customerPhone} />
        {bk.marketerName ? <Info label="المسوق" value={bk.marketerName} /> : null}
        <Info label="الدخول" hi={inToday} ltr={!inToday} value={inToday ? 'اليوم' : bk.checkInDate} />
        <Info label="الخروج" hi={outToday} ltr={!outToday} value={outToday ? 'اليوم' : bk.checkOutDate} />
      </Infos>
    </>
  );
};

/** حالة الفطور/التنسيق (بلاطتان متساويتان) + سطر تفصيل عند وجوده */
export const ServicesStrip: React.FC<{
  hasBreakfast: boolean;
  breakfastText?: string;
  hasCoordinator: boolean;
  coordinatorText?: string;
}> = ({ hasBreakfast, breakfastText, hasCoordinator, coordinatorText }) => (
  <>
    <Infos cols={2}>
      <Info label="الفطور" hi={hasBreakfast} value={hasBreakfast ? 'بفطور' : 'بدون فطور'} />
      <Info label="التنسيق" hi={hasCoordinator} value={hasCoordinator ? 'يوجد تنسيق' : 'بدون تنسيق'} />
    </Infos>
    {hasBreakfast && breakfastText ? <p className="kt-note">الفطور: {breakfastText}</p> : null}
    {hasCoordinator && coordinatorText ? <p className="kt-note">التنسيق: {coordinatorText}</p> : null}
  </>
);

/** زر أيقونة (رابط) بحجم لمس موحّد */
export const LinkBtn: React.FC<{ href: string; label: string; icon: Ico; jade?: boolean; external?: boolean }> = ({
  href,
  label,
  icon: Icon,
  jade,
  external,
}) => (
  <a
    href={href}
    aria-label={label}
    title={label}
    className={`kt-ib lx-press${jade ? ' kt-ib-j' : ''}`}
    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
  >
    <Icon size={18} strokeWidth={1.8} />
  </a>
);

/** سطر تواصل: (العميل/الحارس/الإدارة) + اتصال + واتساب */
export const ContactRow: React.FC<{
  icon: Ico;
  tone: Tone;
  label: string;
  name: string;
  tel: string;
  wa: string;
}> = ({ icon, tone, label, name, tel, wa }) => (
  <div className="kt-row">
    <Tile icon={icon} tone={tone} size={40} />
    <span className="kt-row-t">
      <span className="kt-row-n">{label}</span>
      <span className="kt-row-s">{name}</span>
    </span>
    <LinkBtn href={tel} label={`اتصال بـ${label}`} icon={Phone} />
    <LinkBtn href={wa} label={`واتساب ${label}`} icon={MessageCircle} jade external />
  </div>
);

/** ثلاثة أسطر تواصل: العميل + الحارس + الإدارة */
export const ContactList: React.FC<{
  customerName: string;
  customerTel: string;
  customerWa: string;
  guardName: string;
  guardTel: string;
  guardWa: string;
  adminTel: string;
  adminWa: string;
}> = (p) => (
  <div className="space-y-2">
    <ContactRow icon={Users} tone="jade" label="العميل" name={p.customerName} tel={p.customerTel} wa={p.customerWa} />
    <ContactRow icon={ShieldCheck} tone="saph" label="الحارس" name={p.guardName} tel={p.guardTel} wa={p.guardWa} />
    <ContactRow icon={Building2} tone="amy" label="الإدارة" name="الإدارة العامة" tel={p.adminTel} wa={p.adminWa} />
  </div>
);

/** مسار المراحل الخمس بأعمدة متساوية (نص قصير تحت كل دائرة) */
export const StageTrack: React.FC<{
  bk: Booking;
  todayStr: string;
  stages: {
    isEntered: boolean;
    isRemainingPaid: boolean;
    isInsurancePaid: boolean;
    isCheckedOut: boolean;
    isInsuranceRefunded: boolean;
    completedCount: number;
  };
}> = ({ bk, todayStr, stages }) => {
  const insCash = bk.insurancePaymentMethod === 'cash' || bk.insuranceReceivedCash;
  const steps: { n: string; on: boolean; tone: 'amy' | 'sand' | 'jade'; v: string }[] = [
    { n: 'الدخول', on: stages.isEntered, tone: 'amy', v: stages.isEntered ? 'وصل ✓' : todayStr >= bk.checkInDate ? 'اليوم' : 'انتظار' },
    { n: 'المتبقي', on: stages.isRemainingPaid, tone: 'sand', v: bk.remainingAmount <= 0 ? 'مسدد' : fmtN(bk.remainingAmount) },
    { n: 'التأمين', on: stages.isInsurancePaid, tone: 'amy', v: stages.isInsurancePaid ? (insCash ? 'كاش' : 'بنكي') : fmtN(bk.insuranceAmount) },
    { n: 'الخروج', on: stages.isCheckedOut, tone: 'sand', v: stages.isCheckedOut ? 'مؤكد ✓' : String(bk.checkOutDate || '').slice(5) },
    { n: 'الإرجاع', on: stages.isInsuranceRefunded, tone: 'jade', v: stages.isInsuranceRefunded ? 'مسترد ✓' : 'انتظار' },
  ];
  return (
    <div className="kt-sub">
      <div className="kt-bk-h">
        <span className="kt-row-n">مسار الحجز</span>
        <Tag tone="amy" mono>
          {stages.completedCount}/5
        </Tag>
      </div>
      <div className="kt-trk" role="list" aria-label="مراحل الحجز">
        <div className="kt-trk-line" aria-hidden="true">
          <i style={{ width: `${Math.max(0, stages.completedCount - 1) * 25}%` }} />
        </div>
        {steps.map((s, i) => (
          <div key={s.n} className="kt-trk-s" role="listitem">
            <span className="kt-trk-c" data-on={s.on} data-tone={s.tone}>
              {s.on ? <Check size={18} strokeWidth={3} /> : i + 1}
            </span>
            <span className="kt-trk-n">{s.n}</span>
            <span className="kt-trk-v" dir="auto">
              {s.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** بلاطة إحصاء قابلة للضغط (تصفية الأقسام) */
export const KpiTile: React.FC<{
  label: string;
  value: number | string;
  hint: string;
  icon: Ico;
  tone: Tone;
  on: boolean;
  onClick: () => void;
}> = ({ label, value, hint, icon, tone, on, onClick }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className="kt-stat kt-kpi lx-press">
    <span className="kt-stat-h">
      <Tile icon={icon} tone={tone} size={32} />
      <span className="kt-stat-l">{label}</span>
    </span>
    <span className="kt-stat-v">
      <span>{value}</span>
    </span>
    <span className="kt-stat-n">{on ? '● معروض' : hint}</span>
  </button>
);

/** حالة فارغة موحّدة */
export const EmptyBox: React.FC<{ icon: Ico; text: string; children?: React.ReactNode }> = ({ icon: Icon, text, children }) => (
  <div className="kt-bk items-center text-center py-6">
    <Icon size={28} strokeWidth={1.8} className="text-[#5B2EA6]" />
    <p className="kt-row-n" style={{ whiteSpace: 'normal' }}>
      {text}
    </p>
    {children}
  </div>
);


/* ───────────── لبنات النوافذ المنبثقة ───────────── */

/** رأس موجز للحجز داخل النوافذ: اسم العميل + العقار + رقم الحجز */
export const BkHead: React.FC<{ bk: Booking; sub?: string }> = ({ bk, sub }) => (
  <div className="kt-bk-h">
    <Tile icon={Home} tone="amy" size={44} />
    <span className="kt-row-t">
      <span className="kt-row-n">{bk.customerName}</span>
      <span className="kt-row-s">{sub ?? bk.propertyName}</span>
    </span>
    <Tag tone="amy" mono>
      {bk.bookingNumber}
    </Tag>
  </div>
);

/** اختيار ملف بحجم ثابت + اسم الملف + إزالة + خطأ */
export const FilePick: React.FC<{
  name?: string | null;
  placeholder: string;
  onPick: (file?: File) => void;
  onClear?: () => void;
  error?: string | null;
  accept?: string;
}> = ({ name, placeholder, onPick, onClear, error, accept = 'image/*,application/pdf' }) => (
  <div className="flex flex-col gap-2.5">
    <label className="kt-file">
      <UploadCloud size={20} strokeWidth={1.8} aria-hidden="true" />
      <span>{name || placeholder}</span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
    {name && onClear ? <Act small tone="line" icon={X} label="إزالة الملف" onClick={onClear} className="kt-blk" /> : null}
    {error ? (
      <p className="kt-err" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);

/** معاينة نص موجَّه للحارس (قابلة للتمرير) */
export const MsgBox: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div className="kt-field">
    <span className="kt-field-h">
      <span>{label}</span>
    </span>
    <p className="kt-msg">{text}</p>
  </div>
);

/** أزرار «تسليم كاش للحارس»: إرسال للنظام + نسخ + واتساب (3 أعمدة متساوية) */
export const GuardCashActs: React.FC<{
  sendLabel: string;
  onSend: () => void;
  copied: boolean;
  onCopy: () => void;
  onWhatsapp: () => void;
}> = ({ sendLabel, onSend, copied, onCopy, onWhatsapp }) => (
  <Acts cols={3}>
    <Act stack tone="sand" icon={Send} label={sendLabel} onClick={onSend} />
    <Act stack tone="soft" icon={copied ? Check : Copy} label={copied ? 'تم النسخ ✓' : 'نسخ النص'} onClick={onCopy} />
    <Act stack tone="line" icon={MessageCircle} label="واتساب الحارس" onClick={onWhatsapp} />
  </Acts>
);

/** حقل نص قصير موحّد */
export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ltr?: boolean;
  hint?: string;
}> = ({ label, value, onChange, placeholder, ltr, hint }) => (
  <Field label={label} hint={hint}>
    <input
      type="text"
      className="kt-input"
      dir={ltr ? 'ltr' : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </Field>
);
