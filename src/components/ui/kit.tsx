/**
 * AMASA RESORT — عناصر الصفحات الداخلية الموحّدة
 *
 * القاعدة التي تقوم عليها كل المكوّنات هنا:
 *   1) الإخوة المتجاورون بنفس العرض والارتفاع تماماً (شبكات بأعمدة متساوية).
 *   2) النص سطر واحد يُقصّ بنقاط، والعنوان قصير؛ التفاصيل تُوضع في سطر ثانٍ صغير.
 *   3) حدّ رفيع + ظلّ ناعم، بلا ثلاثي أبعاد.
 * الأنماط في src/index.css تحت الصنف kt-*.
 */
import React, { useState } from 'react';
import { Search as SearchIcon, X as XIcon, ChevronDown as ChevronDownIcon, Copy as CopyIcon } from 'lucide-react';

export type Ico = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
export type Tone = 'amy' | 'ink' | 'ch' | 'jade' | 'sand' | 'garn' | 'saph' | 'gray';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
const vars = (o: Record<string, string | number>) => o as unknown as React.CSSProperties;

/* ───────────── بلاطة أيقونة صغيرة ───────────── */
export const Tile: React.FC<{ icon: Ico; tone?: Tone; size?: number; dark?: boolean; className?: string }> = ({
  icon: Icon,
  tone = 'amy',
  size = 34,
  dark,
  className,
}) => (
  <span
    className={cx('lx-tile', `lx-tone-${tone}`, dark && 'lx-dark', className)}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
    aria-hidden="true"
  >
    <Icon size={Math.round(size * 0.52)} strokeWidth={1.8} />
  </span>
);

/* ───────────── صورة شخص (مع حرف بديل إذا تعذّر تحميلها) ───────────── */
export const Face: React.FC<{ src?: string; name: string; size?: number; square?: boolean; className?: string }> = ({
  src,
  name,
  size = 56,
  square,
  className,
}) => {
  const [bad, setBad] = useState(false);
  const radius = square ? Math.round(size * 0.3) : size;
  const style: React.CSSProperties = { width: size, height: size, borderRadius: radius, boxShadow: '0 0 0 2px rgba(201,164,92,.6)' };
  return src && !bad ? (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBad(true)}
      className={cx('shrink-0 object-cover', className)}
      style={style}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cx('shrink-0 flex items-center justify-center font-extrabold', className)}
      style={{ ...style, background: '#EDE6F8', color: '#46217F', fontSize: Math.round(size * 0.4) }}
    >
      {(name || '؟').trim().charAt(0)}
    </span>
  );
};

/* ───────────── وسم صغير (حالة/كود) بعرض المحتوى ───────────── */
export const Tag: React.FC<{ children: React.ReactNode; tone?: Tone | 'dark' | 'gold'; mono?: boolean }> = ({
  children,
  tone = 'amy',
  mono,
}) => (
  <span
    className={cx(
      'inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-extrabold whitespace-nowrap',
      tone === 'dark' ? 'lx-tone-ink lx-tile lx-dark' : tone === 'gold' ? '' : `lx-tone-${tone} lx-tile`,
      mono && 'font-mono',
    )}
    style={
      tone === 'gold'
        ? { background: '#E8D4A2', color: '#2B1A00' }
        : { width: 'auto', height: 24, borderRadius: 999 }
    }
  >
    {children}
  </span>
);

/* ───────────── حبة حالة بعرض الخانة (للشبكات المتساوية) ───────────── */
export const Pill: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'amy', children }) => (
  <span className={cx('kt-pill', `lx-tone-${tone}`)}>
    <span>{children}</span>
  </span>
);

/* ───────────── مؤشّر تشغيلي: نقطة لون + عنوان + قيمة ───────────── */
export const Check: React.FC<{ label: string; value: string; state?: 'ok' | 'wait' | 'done' | 'idle' | 'err' }> = ({
  label,
  value,
  state = 'idle',
}) => (
  <div className="kt-chk">
    <i style={{ background: state === 'ok' ? '#2E9E86' : state === 'wait' ? '#D9932B' : state === 'done' ? '#3F6FD6' : state === 'err' ? '#B8435E' : '#C4BDD3' }} />
    <span className="kt-chk-t">
      <span className="kt-chk-l">{label}</span>
      <span className="kt-chk-v">{value}</span>
    </span>
  </div>
);

/* ───────────── عنوان قسم: أيقونة + عنوان قصير + عدّاد + إجراء ───────────── */
export const Head: React.FC<{
  title: string;
  icon?: Ico;
  tone?: Tone;
  count?: number | string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, icon, tone = 'amy', count, action, className }) => (
  <div className={cx('kt-head', className)}>
    <h3 className="kt-head-t">
      {icon && <Tile icon={icon} tone={tone} size={34} />}
      <span>{title}</span>
    </h3>
    {count !== undefined && count !== '' && <span className="kt-count">{count}</span>}
    {action}
  </div>
);

/* ───────────── تبويبات بأعمدة متساوية تماماً ───────────── */
export interface SegItem<T extends string> {
  id: T;
  /** نص قصير (≤ 10 أحرف) */
  label: string;
  icon?: Ico;
  badge?: number | string;
}

export function Seg<T extends string>({
  items,
  value,
  onChange,
  label,
  dark,
  compact,
  disabled,
  className,
}: {
  items: SegItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
  dark?: boolean;
  disabled?: boolean;
  /** نسخة أقصر: نص فقط بارتفاع 46px */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx('kt-seg', dark && 'kt-dark', compact && 'kt-compact', className)}
      style={vars({ '--n': items.length })}
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button key={it.id} type="button" aria-pressed={it.id === value} disabled={disabled} onClick={() => onChange(it.id)}>
            {Icon && <Icon size={20} strokeWidth={1.8} />}
            <span className="kt-lbl">{it.label}</span>
            {it.badge !== undefined && it.badge !== '' && <span className="kt-bdg">{it.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── بطاقات إحصاء متساوية ───────────── */
export const Stats: React.FC<{ cols?: 2 | 3 | 4; children: React.ReactNode; className?: string; compact?: boolean }> = ({
  cols = 2,
  children,
  className,
  compact,
}) => (
  <div className={cx('kt-stats', compact && 'kt-stats-s', className)} style={vars({ '--c': cols })}>
    {children}
  </div>
);

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  icon?: Ico;
  tone?: Tone;
}> = ({ label, value, unit, hint, icon, tone = 'amy' }) => (
  <div className="kt-stat">
    <div className="kt-stat-h">
      {icon && <Tile icon={icon} tone={tone} size={32} />}
      <span className="kt-stat-l">{label}</span>
    </div>
    <div className="kt-stat-v">
      <span>{value}</span>
      {unit && <small>{unit}</small>}
    </div>
    {hint !== undefined && <div className="kt-stat-n">{hint}</div>}
  </div>
);

/* ───────────── بلاطات معلومات (عنوان صغير + قيمة) ───────────── */
export const Infos: React.FC<{ cols?: 1 | 2 | 3 | 4; children: React.ReactNode; className?: string }> = ({
  cols = 2,
  children,
  className,
}) => (
  <div className={cx('kt-infos', className)} style={vars({ '--c': cols })}>
    {children}
  </div>
);

export const Info: React.FC<{
  label: string;
  value: React.ReactNode;
  /** أرقام/رموز لاتينية تُعرض يسار-يمين */
  ltr?: boolean;
  dark?: boolean;
  /** يمتد على كل الأعمدة (للقيم الطويلة مثل الآيبان) */
  wide?: boolean;
  /** تمييز القيمة الأهم (أخضر هادئ) */
  hi?: boolean;
  /** يجعل البلاطة زراً ينسخ قيمتها عند اللمس */
  onCopy?: () => void;
}> = ({ label, value, ltr, dark, wide, hi, onCopy }) => {
  const cls = cx('kt-info', dark && 'kt-dark', hi && 'kt-hi', onCopy && 'kt-info-btn');
  const style = wide ? { gridColumn: '1 / -1' } : undefined;
  const body = (
    <>
      <span className="kt-info-l">{label}</span>
      <span className="kt-info-v" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>
        {value}
      </span>
      {onCopy && <CopyIcon size={16} strokeWidth={1.8} className="kt-info-cp" aria-hidden="true" />}
    </>
  );
  return onCopy ? (
    <button type="button" onClick={onCopy} className={cls} style={style} aria-label={`نسخ ${label}`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
};

/* ───────────── شريط اختيار: بطاقات بعرض ثابت ───────────── */
export const Rail: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('kt-rail', className)}>{children}</div>
);

export const Pick: React.FC<{
  name: string;
  sub?: string;
  avatar?: string;
  selected?: boolean;
  onClick?: () => void;
}> = ({ name, sub, avatar, selected, onClick }) => {
  const [bad, setBad] = useState(false);
  return (
    <button type="button" aria-pressed={!!selected} onClick={onClick} className="kt-pick">
      {avatar && !bad ? (
        <img src={avatar} alt="" referrerPolicy="no-referrer" className="kt-pick-av" onError={() => setBad(true)} />
      ) : (
        <span className="kt-pick-av" aria-hidden="true">
          {(name || '؟').trim().charAt(0)}
        </span>
      )}
      <span className="kt-pick-t">
        <span className="kt-pick-n">{name}</span>
        {sub && <span className="kt-pick-s">{sub}</span>}
      </span>
    </button>
  );
};

/* ───────────── أزرار متساوية ───────────── */
export type ActTone = 'ink' | 'gold' | 'jade' | 'garnet' | 'white' | 'soft' | 'line' | 'sand' | 'dark' | 'dgarn' | 'garnS' | 'jadeS';

const TONE_CLASS: Record<ActTone, string> = {
  ink: 'lx-ink',
  gold: 'lx-gold',
  jade: 'lx-jade',
  garnet: 'lx-garnet',
  white: 'lx-white',
  soft: 'kt-t-soft',
  line: 'kt-t-line',
  sand: 'kt-t-sand',
  dark: 'kt-t-dark',
  dgarn: 'kt-t-dgarn',
  garnS: 'kt-t-garn',
  jadeS: 'kt-t-jade',
};

export const Acts: React.FC<{ cols?: 1 | 2 | 3 | 4; children: React.ReactNode; className?: string }> = ({
  cols = 2,
  children,
  className,
}) => (
  <div className={cx('kt-acts', cols === 2 && 'kt-odd', className)} style={vars({ '--c': cols })}>
    {children}
  </div>
);

export const Act: React.FC<{
  /** نص قصير (≤ 14 حرفاً) */
  label: string;
  icon?: Ico;
  tone?: ActTone;
  /** أيقونة فوق النص (لشبكة 3–4 أعمدة) */
  stack?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  href?: string;
  title?: string;
  /** نسخة أقصر (44px) للترويسات */
  small?: boolean;
  /** زر إرسال داخل نموذج */
  submit?: boolean;
  /** معرّف نموذج خارجي (لزر الإرسال في تذييل النافذة) */
  form?: string;
  /** اسم الملف عند تنزيل رابط (href) بدل فتحه */
  download?: string;
  className?: string;
}> = ({ label, icon: Icon, tone = 'line', stack, disabled, onClick, href, title, small, submit, form, download, className }) => {
  const cls = cx('kt-act lx-press', TONE_CLASS[tone], stack && 'kt-stack', small && 'kt-sm', className);
  const inner = (
    <>
      {Icon && <Icon size={stack ? 20 : 18} strokeWidth={1.8} />}
      <span>{label}</span>
    </>
  );
  if (href) {
    const external = /^https?:/i.test(href);
    return (
      <a
        href={href}
        {...(external && !download ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        download={download}
        className={cls}
        title={title}
        aria-label={title}
        onClick={onClick}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type={submit ? 'submit' : 'button'}
      form={submit ? form : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cls}
      title={title}
      aria-label={title}
    >
      {inner}
    </button>
  );
};

/* ───────────── صف إجراءات أفقي (بنفس شكل مسار الحجز) ───────────── */
export type ActStepTone = 'violet' | 'sand' | 'jade' | 'ink' | 'line';
export const ActSteps: React.FC<{
  items: { key: string; label: string; value: string; icon: Ico; tone?: ActStepTone; done?: boolean; onClick: () => void; title?: string }[];
}> = ({ items }) => (
  <div className="kt-ax" role="list" style={vars({ '--n': items.length })}>
    {items.map(({ key, label, value, icon: Icon, tone = 'violet', done, onClick, title }) => (
      <button
        key={key}
        type="button"
        role="listitem"
        className="kt-ax-s lx-press"
        onClick={onClick}
        aria-label={title || `${label} ${value}`}
        title={title}
      >
        <span className="kt-ax-c" data-tone={tone} data-on={!!done}>
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <span className="kt-ax-n">{label}</span>
        <span className="kt-ax-v" dir="auto">
          {value}
        </span>
      </button>
    ))}
  </div>
);

/* ───────────── شرائح تصفية ───────────── */
export const Chips: React.FC<{
  children: React.ReactNode;
  /** يوزّع الشرائح على العرض كله بالتساوي (للمجموعات القصيرة 2–4) */
  fill?: number;
  className?: string;
}> = ({ children, fill, className }) => (
  <div className={cx('kt-chips', !!fill && 'kt-fill', className)} data-n={fill || undefined} style={fill ? vars({ '--n': fill }) : undefined}>
    {children}
  </div>
);

export const Chip: React.FC<{
  label: string;
  on?: boolean;
  onClick?: () => void;
  /** لون نقطة الحالة */
  dot?: string;
  count?: number | string;
}> = ({ label, on, onClick, dot, count }) => (
  <button type="button" aria-pressed={!!on} onClick={onClick} className="kt-chip">
    {dot && <i style={vars({ '--d': dot })} />}
    <span>{label}</span>
    {count !== undefined && count !== '' && <span className="opacity-70">{count}</span>}
  </button>
);

/* ───────────── زر أيقونة مربع (44px) لنهاية الصفوف: تعديل / حذف ───────────── */
export const IconBtn: React.FC<{
  icon: Ico;
  /** وصف للقارئ الصوتي وللتلميح */
  label: string;
  tone?: 'soft' | 'garn';
  onClick?: () => void;
}> = ({ icon: Icon, label, tone = 'soft', onClick }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} className={cx('kt-ib lx-press', tone === 'garn' && 'kt-ib-g')}>
    <Icon size={18} strokeWidth={1.8} />
  </button>
);

/* ───────────── صفّ سجل ───────────── */
export const Row: React.FC<{
  icon?: Ico;
  tone?: Tone;
  title: string;
  sub?: string;
  end?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ icon, tone = 'amy', title, sub, end, onClick, className }) => {
  const body = (
    <>
      {icon && <Tile icon={icon} tone={tone} size={40} />}
      <span className="kt-row-t">
        <span className="kt-row-n">{title}</span>
        {sub && <span className="kt-row-s">{sub}</span>}
      </span>
      {end}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cx('kt-row w-full text-start cursor-pointer lx-press', className)}>
      {body}
    </button>
  ) : (
    <div className={cx('kt-row', className)}>{body}</div>
  );
};

/* ───────────── مفتاح تبديل ───────────── */
export const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({
  on,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className="kt-switch disabled:opacity-50"
  />
);

/* ───────────── حقل بحث ───────────── */
export const SearchBox: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'بحث', className }) => (
  <label className={cx('kt-search', className)}>
    <SearchIcon size={20} strokeWidth={1.8} aria-hidden="true" />
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    {value && (
      <button
        type="button"
        aria-label="مسح البحث"
        onClick={(e) => {
          e.preventDefault();
          onChange('');
        }}
        className="kt-search-x"
      >
        <XIcon size={18} strokeWidth={1.8} />
      </button>
    )}
  </label>
);


/* ───────────── خيار قابل للاختيار (صف بارتفاع ثابت) ───────────── */
export const Choice: React.FC<{
  title: string;
  sub?: string;
  tag?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ title, sub, tag, selected, onClick, disabled }) => (
  <button type="button" aria-pressed={!!selected} onClick={onClick} disabled={disabled} className="kt-choice">
    <span className="kt-choice-t">
      <span className="kt-choice-n">{title}</span>
      {sub && <span className="kt-choice-s">{sub}</span>}
    </span>
    {tag && <span className="kt-choice-g">{tag}</span>}
  </button>
);

/* ───────────── حقل: عنوان صغير فوق عنصر الإدخال ───────────── */
export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  hint,
  children,
  className,
}) => (
  <label className={cx('kt-field', className)}>
    <span className="kt-field-h">
      <span>{label}</span>
      {hint && <em>{hint}</em>}
    </span>
    {children}
  </label>
);

/* ───────────── بلاطة أداة: أيقونة + عنوان + زر ثانوي (شبكة 2×2) ───────────── */
export const Tool: React.FC<{
  icon: Ico;
  title: string;
  onOpen?: () => void;
  actionLabel: string;
  actionIcon?: Ico;
  onAction?: () => void;
  tone?: Tone;
}> = ({ icon, title, onOpen, actionLabel, actionIcon, onAction, tone = 'amy' }) => (
  <div className="kt-tool">
    <button type="button" onClick={onOpen} className="kt-tool-open">
      <Tile icon={icon} tone={tone} size={44} />
      <span>{title}</span>
    </button>
    <Act small tone="jadeS" icon={actionIcon} label={actionLabel} onClick={onAction} className="kt-blk" />
  </div>
);


/* ───────────── نافذة منبثقة موحّدة (ترويسة داكنة + محتوى + تذييل) ───────────── */
export const Sheet: React.FC<{
  title: string;
  icon?: Ico;
  tone?: Tone;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** عرض أكبر (لوحات النصوص الطويلة) */
  wide?: boolean;
  /** لا تُغلق النافذة باللمس خارجها (للنماذج الطويلة كي لا تضيع البيانات) */
  lockBackdrop?: boolean;
}> = ({ title, icon, tone = 'ink', onClose, children, footer, wide, lockBackdrop }) => (
  <div className="kt-ov" onClick={lockBackdrop ? undefined : onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cx('kt-sheet', wide && 'kt-wide')}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="kt-sheet-h">
        {icon && <Tile icon={icon} tone={tone} dark size={40} />}
        <h4>{title}</h4>
        <button type="button" onClick={onClose} aria-label="إغلاق" className="kt-sheet-x">
          <XIcon size={20} strokeWidth={1.8} />
        </button>
      </header>
      <div className="kt-sheet-b">{children}</div>
      {footer && <footer className="kt-sheet-f">{footer}</footer>}
    </div>
  </div>
);


/* ───────────── أكورديون: صفّ بارتفاع ثابت يفتح محتواه ───────────── */
export const Acc: React.FC<{
  icon?: React.ReactNode;
  title: string;
  tag?: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ icon, title, tag, open, onToggle, children }) => (
  <div className="kt-acc" data-open={open}>
    <button type="button" onClick={onToggle} className="kt-acc-h" aria-expanded={open}>
      {icon && <span className="kt-acc-i">{icon}</span>}
      <span className="kt-acc-n">{title}</span>
      {tag && <Tag tone="amy">{tag}</Tag>}
      <ChevronDownIcon size={20} strokeWidth={1.8} className="kt-acc-c" aria-hidden="true" />
    </button>
    {open && <div className="kt-acc-b animate-in fade-in duration-200">{children}</div>}
  </div>
);


/* ───────────── مربع سعر: عنوان قصير + حقل رقمي + وحدة (شبكة متساوية) ───────────── */
export const Rate: React.FC<{
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
  selected?: boolean;
  onSelect?: () => void;
  /** يقفل الإدخال (مثلاً عند قفل البوكس) */
  disabled?: boolean;
}> = ({ label, value, onChange, unit = 'ر.س / ليلة', step = 25, selected, onSelect, disabled }) => (
  <div
    role={onSelect ? 'button' : undefined}
    tabIndex={onSelect ? 0 : undefined}
    aria-pressed={onSelect ? !!selected : undefined}
    data-on={selected ? 'true' : 'false'}
    data-dis={disabled ? 'true' : 'false'}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (onSelect && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        onSelect();
      }
    }}
    className="kt-rate"
  >
    <span className="kt-rate-h">
      <span>{label}</span>
      <i aria-hidden="true" />
    </span>
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={step}
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      disabled={disabled}
      className="kt-input"
    />
    <span className="kt-rate-u">{unit}</span>
  </div>
);
