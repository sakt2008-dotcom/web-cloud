import React, { useMemo, useState } from 'react';
import { Wallet, Send, AlertCircle, CheckCircle2, Clock, XCircle, Percent, ShieldCheck, Receipt } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Head, Infos, Info, Act, Field, Row, Tag } from '../ui/kit';
import { fmtN, localTodayStr } from '../../lib/format';
import { sumSupervisorPayout, getSupervisorPayoutParts, isBookingCheckedOut } from '../../lib/financials';

/** حساب المشرف: الرسوم الإدارية + رسوم المشرف + النسبة المئوية = الإجمالي، وطلب الصرف لفترة محددة */
export const SupervisorPayoutPanel: React.FC = () => {
  const {
    currentMarketer,
    currentMarketerId,
    bookings,
    properties,
    specialAdminFeeBoxes,
    commissionRequests,
    getEligibleCommissionBookings,
    createCommissionRequest,
  } = useApp();

  const today = localTodayStr();
  const [fromDate, setFromDate] = useState(today.slice(0, 8) + '01');
  const [toDate, setToDate] = useState(today);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const eligible = useMemo(
    () => getEligibleCommissionBookings(currentMarketerId, fromDate, toDate),
    [getEligibleCommissionBookings, currentMarketerId, fromDate, toDate]
  );
  const parts = useMemo(() => sumSupervisorPayout(eligible, properties, specialAdminFeeBoxes), [eligible, properties, specialAdminFeeBoxes]);

  const counts = useMemo(() => {
    let percent = 0;
    let supervisorFee = 0;
    let adminFee = 0;
    eligible.forEach((b) => {
      const p = getSupervisorPayoutParts(b, properties, specialAdminFeeBoxes);
      if (p.percent > 0) percent += 1;
      if (p.supervisorFee > 0) supervisorFee += 1;
      if (p.adminFee > 0) adminFee += 1;
    });
    return { percent, supervisorFee, adminFee };
  }, [eligible, properties, specialAdminFeeBoxes]);

  // حجوزات في الفترة لم يخرج عميلها بعد (لا تدخل في المبلغ مؤقتاً)
  const notOutCount = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (b.marketerId === currentMarketerId || b.supervisorId === currentMarketerId) &&
          b.status !== 'cancelled' &&
          b.commissionStatus !== 'paid' &&
          !isBookingCheckedOut(b) &&
          b.checkInDate >= fromDate &&
          b.checkInDate <= toDate
      ).length,
    [bookings, currentMarketerId, fromDate, toDate]
  );

  const mine = useMemo(() => commissionRequests.filter((r) => r.marketerId === currentMarketerId), [commissionRequests, currentMarketerId]);
  const overlap = useMemo(
    () => mine.find((r) => (r.status === 'pending' || r.status === 'transferred') && fromDate <= r.toDate && toDate >= r.fromDate),
    [mine, fromDate, toDate]
  );

  if (!currentMarketer?.isSupervisor) return null;

  const submit = () => {
    const res = createCommissionRequest({ fromDate, toDate });
    setMsg({ ok: res.ok, text: res.message });
  };
  const money = (n: number) => `${fmtN(n)} ر.س`;
  const dr = (a: string, b: string) => (
    <>
      من <bdi dir="ltr">{a}</bdi> إلى <bdi dir="ltr">{b}</bdi>
    </>
  );

  return (
    <section className="lux-card p-4 space-y-3.5">
      <Head title="طلب صرف المستحقات" icon={Wallet} tone="jade" />
      <p className="kt-note">المجموع = النسبة المئوية + رسوم المشرف + الرسوم العادية. تُحتسب بعد خروج العميل فقط.</p>

      <div className="kt-fields">
        <Field label="من تاريخ">
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setMsg(null); }} className="kt-input" />
        </Field>
        <Field label="إلى تاريخ">
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setMsg(null); }} className="kt-input" />
        </Field>
      </div>

      <div className="space-y-2">
        <Row
          icon={Percent}
          tone="amy"
          title="النسبة المئوية"
          sub={`من الحجوزات التي قمت بها · ${fmtN(counts.percent)} حجز`}
          end={<Tag tone="amy">{money(parts.percent)}</Tag>}
        />
        <Row
          icon={ShieldCheck}
          tone="sand"
          title="رسوم المشرف"
          sub={`من حجوزاتك في صفحة المشرف · ${fmtN(counts.supervisorFee)} حجز`}
          end={<Tag tone="sand">{money(parts.supervisorFee)}</Tag>}
        />
        <Row
          icon={Receipt}
          tone="jade"
          title="الرسوم العادية"
          sub={`من حجوزاتك في صفحة الحجوزات · ${fmtN(counts.adminFee)} حجز`}
          end={<Tag tone="jade">{money(parts.adminFee)}</Tag>}
        />
      </div>
      <Infos cols={2}>
        <Info label="عدد الحجوزات" value={fmtN(eligible.length)} />
        <Info hi label="المجموع المستحق" value={money(parts.total)} />
      </Infos>
      {notOutCount > 0 && <p className="kt-note">{fmtN(notOutCount)} حجز لم يخرج عميله بعد — مستبعد مؤقتاً.</p>}

      {overlap && (
        <div className="kt-err" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            هذه الفترة ({dr(overlap.fromDate, overlap.toDate)}) {overlap.status === 'transferred' ? 'تم صرفها سابقاً' : 'قيد المراجعة'}. اختر فترة أخرى.
          </span>
        </div>
      )}
      {msg &&
        (msg.ok ? (
          <div className="kt-ok" role="status">
            <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{msg.text}</span>
          </div>
        ) : (
          <div className="kt-err" role="alert">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{msg.text}</span>
          </div>
        ))}

      <Act
        tone="ink"
        icon={Send}
        label={`طلب صرف · ${money(parts.total)}`}
        title="إرسال طلب الصرف للإدارة"
        disabled={Boolean(overlap) || eligible.length === 0 || parts.total <= 0}
        onClick={submit}
      />

      {mine.length > 0 && (
        <div className="space-y-2">
          <Head title="طلباتي" icon={Clock} count={mine.length} />
          {mine.slice(0, 5).map((r) => (
            <Row
              key={r.id}
              icon={r.status === 'transferred' ? CheckCircle2 : r.status === 'pending' ? Clock : XCircle}
              tone={r.status === 'transferred' ? 'jade' : r.status === 'pending' ? 'sand' : 'garn'}
              title={money(r.amount)}
              sub={`من ${r.fromDate} إلى ${r.toDate}`}
              end={<Tag tone={r.status === 'transferred' ? 'jade' : r.status === 'pending' ? 'sand' : 'garn'}>{r.status === 'transferred' ? 'تم الصرف' : r.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}</Tag>}
            />
          ))}
        </div>
      )}
    </section>
  );
};
