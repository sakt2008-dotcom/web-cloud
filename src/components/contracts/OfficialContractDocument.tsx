import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Booking, Guard, Marketer, Property } from '../../types';
import { buildOfficialContractData, OfficialContractData } from '../../lib/contractPdf';
import { generateQRCodeSvg } from '../../lib/qrCode';

export interface OfficialContractDocumentProps {
  booking: Partial<Booking>;
  property?: Property;
  guards?: Guard[];
  marketers?: Marketer[];
  dataOverride?: Partial<OfficialContractData>;
  compact?: boolean;
}

/** عرض الصفحة A4 بالبكسل (96dpi) — يُرسم العقد دائماً بهذا المقاس ثم يُصغَّر للمعاينة */
export const CONTRACT_PAGE_W = 794;
export const CONTRACT_PAGE_H = 1123;

const C = {
  deep: '#130A24',
  emerald: '#1F1140',
  emeraldSoft: '#2D1664',
  gold: '#C9A45C',
  goldLight: '#E8D4A2',
  goldPale: '#F5ECD3',
  cream: '#FBF8F2',
  paper: '#FFFEFB',
  ink: '#1A0F2E',
  muted: '#5E5575',
  line: '#E8DEC4',
};

const FONT = "'Tajawal', system-ui, -apple-system, sans-serif";

/** نقش هندسي إسلامي خفيف (نجمة ثمانية) للترويسة */
const Ornament: React.FC<{ id: string }> = ({ id }) => (
  <svg
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
    style={{ position: 'absolute', inset: 0, opacity: 0.2 }}
    preserveAspectRatio="none"
  >
    <defs>
      <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
        <g fill="none" stroke={C.gold} strokeWidth="0.8">
          <rect x="14" y="14" width="28" height="28" />
          <rect x="14" y="14" width="28" height="28" transform="rotate(45 28 28)" />
          <circle cx="28" cy="28" r="4" />
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

const Diamond: React.FC<{ size?: number; color?: string }> = ({ size = 8, color = C.gold }) => (
  <span
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      backgroundColor: color,
      borderRadius: '50%',
      flexShrink: 0,
    }}
  />
);

const SectionTitle: React.FC<{ no: string; title: string; aside?: React.ReactNode }> = ({
  no,
  title,
  aside,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
    <span
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        backgroundColor: C.emerald,
        color: C.goldLight,
        fontSize: 14,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {no}
    </span>
    <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.emerald, lineHeight: 1.3 }}>
      {title}
    </h2>
    <span
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(to left, ${C.gold}, ${C.line})`,
      }}
    />
    {aside}
  </div>
);

const Pair: React.FC<{ label: string; value: React.ReactNode; ltr?: boolean }> = ({
  label,
  value,
  ltr,
}) => (
  <div style={{ padding: '4px 2px 5px', borderBottom: `1px solid ${C.line}` }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 3 }}>{label}</div>
    <div
      dir={ltr ? 'ltr' : undefined}
      style={{
        fontSize: 16,
        fontWeight: 800,
        color: C.ink,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.45,
      }}
    >
      {value}
    </div>
  </div>
);

const Money: React.FC<{ n: number; size?: number; color?: string; unitColor?: string }> = ({
  n,
  size = 18,
  color = C.ink,
  unitColor = C.muted,
}) => (
  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
    <span
      dir="ltr"
      style={{ fontSize: size, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}
    >
      {Math.round(Number(n || 0)).toLocaleString('en-US')}
    </span>
    <span style={{ fontSize: Math.max(11, size * 0.6), fontWeight: 700, color: unitColor }}>
      ريال
    </span>
  </span>
);

const PageFrame: React.FC<{ children: React.ReactNode; code: string }> = ({ children, code }) => (
  <div
    data-pdf-page="true"
    style={{
      position: 'relative',
      width: CONTRACT_PAGE_W,
      height: CONTRACT_PAGE_H,
      backgroundColor: C.paper,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: FONT,
      color: C.ink,
      lineHeight: 1.55,
    }}
  >
    <div data-fit-area="true" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div
        data-fit-content="true"
        style={{ position: 'absolute', top: 0, left: 0, width: CONTRACT_PAGE_W, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
    <div
      style={{
        margin: '0 40px',
        padding: '9px 0 14px',
        borderTop: `1px solid ${C.gold}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 10.5,
        color: C.muted,
        fontWeight: 600,
      }}
    >
      <span dir="ltr" style={{ letterSpacing: 2, color: C.emerald, fontWeight: 800 }}>
        AMASA RESORT
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {code ? `عقد رقم ${code} • ` : ''}وثيقة معتمدة إلكترونياً
      </span>
    </div>
  </div>
);

export const OfficialContractDocument = forwardRef<HTMLDivElement, OfficialContractDocumentProps>(
  ({ booking, property, guards = [], marketers = [], dataOverride }, ref) => {
    const baseData = buildOfficialContractData({ booking, property, guards, marketers });
    const data: OfficialContractData = { ...baseData, ...dataOverride };

    const innerRef = useRef<HTMLDivElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

    const [scale, setScale] = useState(1);
    const [innerH, setInnerH] = useState(CONTRACT_PAGE_H);

    useEffect(() => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      const update = () => {
        const w = wrap.clientWidth || CONTRACT_PAGE_W;
        setScale(Math.min(1, w / CONTRACT_PAGE_W));
        setInnerH(inner.offsetHeight);
      };
      update();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(update);
      ro.observe(wrap);
      ro.observe(inner);
      return () => ro.disconnect();
    }, []);

    useLayoutEffect(() => {
      const inner = innerRef.current;
      if (!inner) return;
      const area = inner.querySelector<HTMLElement>('[data-fit-area]');
      const content = inner.querySelector<HTMLElement>('[data-fit-content]');
      if (!area || !content) return;
      let f = 1;
      const apply = () => {
        content.style.width = `${CONTRACT_PAGE_W / f}px`;
        content.style.transform = f < 1 ? `scale(${f})` : 'none';
      };
      apply();
      while (f > 0.6 && content.offsetHeight * f > area.clientHeight) {
        f = Math.round((f - 0.02) * 100) / 100;
        apply();
      }
    });

    const qrUri = generateQRCodeSvg(
      `AMASA-${data.bookingNumber}-${data.propertyName}-${data.totalPrice}`,
      110
    );

    const hasNumber = !!data.bookingNumber && data.bookingNumber !== 'مسودة عقد';
    const code = hasNumber ? data.bookingNumber : '';
    const subtitle = data.sectionName
      ? `${data.propertyName} — ${data.sectionName}`
      : 'وثيقة حجز واتفاقية إقامة';

    const extras: { label: string; n: number }[] = [];
    if (data.breakfastPrice > 0)
      extras.push({
        label: `وجبة الإفطار${data.breakfastOption ? ` (${data.breakfastOption})` : ''}`,
        n: data.breakfastPrice,
      });
    if (data.coordinatorPrice > 0)
      extras.push({
        label: `خدمة التنسيق${data.coordinatorName ? ` (${data.coordinatorName})` : ''}`,
        n: data.coordinatorPrice,
      });

    return (
      <div ref={wrapRef} style={{ width: '100%', maxWidth: CONTRACT_PAGE_W, margin: '0 auto' }}>
        <div
          style={{
            width: '100%',
            height: innerH * scale,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            ref={innerRef}
            dir="rtl"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: CONTRACT_PAGE_W,
              transform: `scale(${scale})`,
              transformOrigin: 'top right',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              fontFamily: FONT,
            }}
          >
            <PageFrame code={code}>
              {/* الترويسة */}
              <div
                style={{
                  position: 'relative',
                  backgroundImage: `linear-gradient(160deg, ${C.deep} 0%, ${C.emerald} 55%, ${C.emeraldSoft} 150%)`,
                  padding: '26px 40px 38px',
                  textAlign: 'center',
                  overflow: 'hidden',
                }}
              >
                <Ornament id="amasa-star-1" />
                <div style={{ position: 'absolute', inset: 10, border: '1px solid rgba(201,164,92,0.7)' }} />
                <div style={{ position: 'relative' }}>
                  <div dir="ltr" style={{ color: C.goldLight, fontSize: 12, fontWeight: 700, letterSpacing: 7, paddingLeft: 7 }}>
                    AMASA RESORT
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '8px 0 9px' }}>
                    <span style={{ width: 60, height: 1, backgroundColor: C.gold }} />
                    <Diamond size={6} />
                    <span style={{ width: 60, height: 1, backgroundColor: C.gold }} />
                  </div>
                  <h1 style={{ margin: 0, color: '#FFFFFF', fontSize: 32, fontWeight: 800, lineHeight: 1.3 }}>
                    {data.mainTitle}
                  </h1>
                  <div style={{ marginTop: 4, color: C.goldLight, fontSize: 14, fontWeight: 500 }}>{subtitle}</div>
                </div>
              </div>

              {/* شريط بيانات الحجز */}
              <div
                style={{
                  margin: '-20px 40px 0',
                  position: 'relative',
                  backgroundColor: C.cream,
                  border: `1px solid ${C.gold}`,
                  display: 'flex',
                  textAlign: 'center',
                }}
              >
                {[
                  { k: 'رقم الحجز', v: hasNumber ? `#${data.bookingNumber}` : 'مسودة' },
                  { k: 'تاريخ الإصدار', v: data.issueDate },
                  { k: 'مدة الإقامة', v: data.nightsLabel },
                ].map((it, i) => (
                  <div key={it.k} style={{ flex: 1, padding: '7px 6px', borderRight: i > 0 ? `1px solid ${C.line}` : undefined }}>
                    <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>{it.k}</div>
                    <div style={{ fontSize: 14, color: C.emerald, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{it.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '14px 40px 6px' }}>
                {/* ١ المستأجر */}
                <div style={{ marginBottom: 11 }}>
                  <SectionTitle no="١" title="بيانات المستأجر والمركبة" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32 }}>
                    <Pair label="اسم الضيف" value={data.customerName} />
                    <Pair label="رقم الهوية" value={data.customerNationalId} ltr />
                    <Pair label="رقم جوال التواصل" value={data.customerPhone} ltr />
                    <Pair label="لوحة السيارة المصرح لها" value={data.vehiclePlate} />
                  </div>
                </div>

                {/* ٢ الإقامة */}
                <div style={{ marginBottom: 11 }}>
                  <SectionTitle
                    no="٢"
                    title="تفاصيل الإقامة"
                    aside={
                      data.guestsCount > 0 ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.emeraldSoft, backgroundColor: C.goldPale, padding: '2px 12px', borderRadius: 999 }}>
                          {data.guestsCount} أشخاص
                        </span>
                      ) : undefined
                    }
                  />
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    {[
                      { k: 'الدخول', d: data.checkInDateLabel, t: data.checkInTimeLabel },
                      null,
                      { k: 'الخروج', d: data.checkOutDateLabel, t: data.checkOutTimeLabel },
                    ].map((c, i) =>
                      c ? (
                        <div key={c.k} style={{ flex: 1, backgroundColor: C.cream, border: `1px solid ${C.line}`, borderTop: `3px solid ${C.emerald}`, padding: '8px 16px' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gold }}>{c.k}</div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{c.d}</div>
                          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{c.t}</div>
                        </div>
                      ) : (
                        <div key={`n${i}`} style={{ width: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 54, height: 54, borderRadius: 999, backgroundColor: C.emerald, border: `2px solid ${C.gold}`, color: C.goldLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{data.nightsCount}</span>
                            <span style={{ fontSize: 10, fontWeight: 700 }}>{data.nightsCount === 1 ? 'ليلة' : data.nightsCount === 2 ? 'ليلتان' : 'ليالٍ'}</span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* ٣ المالي */}
                <div style={{ marginBottom: 11 }}>
                  <SectionTitle no="٣" title="الملخص المالي" />
                  <div style={{ border: `1px solid ${C.line}`, backgroundColor: C.cream }}>
                    {[{ label: 'الإقامة الأساسية', n: data.baseNightlyTotal }, ...extras].map((r, i) => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', borderTop: i > 0 ? `1px dashed ${C.line}` : undefined, fontSize: 13, fontWeight: 600 }}>
                        <span>{r.label}</span>
                        <Money n={r.n} size={15} />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', backgroundColor: C.emerald, borderTop: `2px solid ${C.gold}` }}>
                      <span style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>الإجمالي المتفق عليه</span>
                      <Money n={data.totalPrice} size={24} color={C.goldLight} unitColor={C.goldLight} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {[
                      { k: 'العربون المدفوع', n: data.depositPaid },
                      { k: 'المتبقي عند الوصول', n: data.remainingAmount },
                      { k: 'تأمين مسترد', n: data.insuranceAmount },
                    ].map((c) => (
                      <div key={c.k} style={{ flex: 1, textAlign: 'center', padding: '6px', border: `1px solid ${C.line}`, borderBottom: `3px solid ${C.gold}`, backgroundColor: '#fff' }}>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{c.k}</div>
                        <Money n={c.n} size={16} color={C.emerald} />
                      </div>
                    ))}
                  </div>
                  {data.hasFinancialMismatch && (
                    <div style={{ marginTop: 6, fontSize: 10.5, color: C.muted, fontWeight: 600 }}>
                      تنبيه للمراجعة: العربون والمتبقي لا يطابقان الإجمالي حسابياً.
                    </div>
                  )}
                  {data.breakfastBanner.show && (
                    <div style={{ marginTop: 8, backgroundColor: data.breakfastBanner.included ? C.goldPale : '#F4F3EF', borderRight: `4px solid ${data.breakfastBanner.included ? C.gold : C.muted}`, padding: '6px 14px', fontSize: 12 }}>
                      <strong style={{ color: C.emerald, marginLeft: 6 }}>{data.breakfastBanner.included ? 'الإفطار مشمول:' : 'حالة الإفطار:'}</strong>
                      <span>{data.breakfastBanner.text}</span>
                    </div>
                  )}
                </div>

                {/* ٤ الشروط */}
                <div style={{ marginBottom: 11 }}>
                  <SectionTitle no="٤" title="شروط الإقامة والتعليمات" />
                  <div>
                    {data.contractTerms.map((term, idx) => (
                      <div key={`${idx}-${term.slice(0, 14)}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.line}` }}>
                        <span style={{ width: 20, height: 20, borderRadius: 999, border: `1.5px solid ${C.gold}`, color: C.emerald, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {idx + 1}
                        </span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, lineHeight: 1.6 }}>{term}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ٥ الوصول */}
                <div style={{ marginBottom: 11 }}>
                  <SectionTitle no="٥" title="الوصول والتواصل" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ backgroundColor: C.cream, border: `1px solid ${C.line}`, borderRight: `3px solid ${C.gold}`, padding: '6px 14px' }}>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>شبكة الواي فاي</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{data.wifiDisplay}</div>
                    </div>
                    <div style={{ backgroundColor: C.cream, border: `1px solid ${C.line}`, borderRight: `3px solid ${C.gold}`, padding: '6px 14px' }}>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>الحارس عند الوصول والحاجة</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {data.guardName}
                        {data.guardPhone && <span dir="ltr" style={{ marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>{data.guardPhone}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, backgroundColor: C.goldPale, padding: '7px 14px', fontSize: 12, lineHeight: 1.6 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: C.emerald, marginLeft: 6 }}>إرشادات الوصول:</strong>
                      <span>{data.arrivalInstructions}</span>
                    </div>
                    <a href={data.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: C.emerald, color: C.goldLight, fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      افتح الموقع على الخريطة
                    </a>
                  </div>
                </div>

                {/* التوقيع + الختام */}
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
                  {[
                    { role: 'المؤجر', who: 'إدارة AMASA RESORT', note: 'معتمد إلكترونياً' },
                    { role: 'المستأجر', who: data.customerName, note: 'التوقيع / الموافقة' },
                  ].map((s) => (
                    <div key={s.role} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{s.role}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.emerald }}>{s.who}</div>
                      <div style={{ height: 26, borderBottom: `1.5px solid ${C.emerald}` }} />
                      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{s.note}</div>
                    </div>
                  ))}
                  <img src={qrUri} alt="رمز التحقق الإلكتروني للعقد" style={{ width: 64, height: 64, padding: 3, backgroundColor: '#fff', border: `1px solid ${C.gold}`, flexShrink: 0 }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: C.emerald }}>
                  {data.closingMessage}
                </div>
              </div>
            </PageFrame>
          </div>
        </div>
      </div>
    );
  }
);

OfficialContractDocument.displayName = 'OfficialContractDocument';
