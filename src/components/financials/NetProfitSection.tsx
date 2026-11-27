import React, { useState, useMemo } from 'react';
import { Calendar, DollarSign, TrendingUp, Percent, Plus, Trash2, AlertCircle, Building, CheckCircle2, FileText, ShieldCheck, X, Tag as TagIcon, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PropertyExpense } from '../../types';
import {
  isBookingCheckedOut,
  getBookingAdminFeeBreakdown,
  getBookingCommissionAmount,
} from '../../lib/financials';
import { Head, Seg, Stats, Stat, Infos, Info, Acts, Act, Tag, Tile, Field, Sheet } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';
import { fmtN, localTodayStr } from '../../lib/format';

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface NetProfitSectionProps {
  fromDate: string;
  toDate: string;
  setFromDate: (d: string) => void;
  setToDate: (d: string) => void;
  selectedPropertyFilter: string;
  setSelectedPropertyFilter: (id: string) => void;
}

export const NetProfitSection: React.FC<NetProfitSectionProps> = ({
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  selectedPropertyFilter,
  setSelectedPropertyFilter,
}) => {
  const {
    properties,
    bookings,
    expenses,
    specialAdminFeeBoxes,
    addExpense,
    deleteExpense,
    isAdmin,
    canViewMore,
    canViewMarketers,
  } = useApp();
  const canManageExpenses = isAdmin || canViewMore || canViewMarketers;

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expensePropId, setExpensePropId] = useState(properties[0]?.id || 'hamran');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<PropertyExpense['category']>('maintenance');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState(() => localTodayStr());
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Quick period presets (محلّي: بدون إزاحة UTC)
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rangeFor = (preset: Exclude<Preset, 'custom'>) => {
    const today = new Date();
    const to = ymd(today);
    let from = to;
    if (preset === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      from = ymd(d);
    } else if (preset === 'month') {
      from = to.slice(0, 8) + '01';
    } else if (preset === 'quarter') {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 3);
      from = ymd(d);
    } else if (preset === 'year') {
      from = `${today.getFullYear()}-01-01`;
    }
    return { from, to };
  };
  const handleSetPreset = (preset: Exclude<Preset, 'custom'>) => {
    const r = rangeFor(preset);
    setFromDate(r.from);
    setToDate(r.to);
  };

  // Filter non-cancelled bookings in range
  const bookingsInRange = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false;
      const inDate = b.checkInDate;
      const inRange = inDate >= fromDate && inDate <= toDate;
      if (!inRange) return false;
      if (selectedPropertyFilter !== 'all' && b.propertyId !== selectedPropertyFilter) {
        return false;
      }
      return true;
    });
  }, [bookings, fromDate, toDate, selectedPropertyFilter]);

  // القاعدة المالية: لا تُضاف مبالغ الإيجارات أو العمولات أو الرسوم إلا بعد خروج العميل
  const filteredBookings = useMemo(() => {
    return bookingsInRange.filter((b) => isBookingCheckedOut(b));
  }, [bookingsInRange]);

  const pendingCheckoutBookings = useMemo(() => {
    return bookingsInRange.filter((b) => !isBookingCheckedOut(b));
  }, [bookingsInRange]);

  const pendingCheckoutSummary = useMemo(() => {
    const rentalTotal = pendingCheckoutBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const commissionTotal = pendingCheckoutBookings.reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);
    return {
      count: pendingCheckoutBookings.length,
      rentalTotal,
      commissionTotal,
    };
  }, [pendingCheckoutBookings]);

  // Filter expenses in range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const inRange = e.date >= fromDate && e.date <= toDate;
      if (!inRange) return false;
      if (selectedPropertyFilter !== 'all' && e.propertyId !== selectedPropertyFilter) {
        return false;
      }
      return true;
    });
  }, [expenses, fromDate, toDate, selectedPropertyFilter]);

  // Aggregated financials (ONLY checked-out bookings)
  const totals = useMemo(() => {
    let grossRental = 0;
    let normalAdminFees = 0;
    let specialAdminFees = 0;
    let normalBookingsCount = 0;
    let specialBookingsCount = 0;
    let marketerCommissions = 0;
    let insuranceReceived = 0;
    let insuranceReturned = 0;
    let nightsCount = 0;

    filteredBookings.forEach((b) => {
      grossRental += b.totalPrice || 0;
      const feeBreakdown = getBookingAdminFeeBreakdown(b, properties, specialAdminFeeBoxes);
      normalAdminFees += feeBreakdown.normalAdminFee;
      specialAdminFees += feeBreakdown.specialAdminFee;
      if (feeBreakdown.feeType === 'special') {
        specialBookingsCount += 1;
      } else if (feeBreakdown.feeType === 'normal') {
        normalBookingsCount += 1;
      }
      marketerCommissions += getBookingCommissionAmount(b);
      insuranceReceived += b.insuranceAmount || 0;
      if (b.insuranceReturned) insuranceReturned += b.insuranceAmount || 0;
      nightsCount += b.nightsCount || 1;
    });

    const totalAdminFees = normalAdminFees + specialAdminFees;
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = grossRental - totalAdminFees - marketerCommissions - totalExpenses;
    const profitMargin = grossRental > 0 ? Math.round((netProfit / grossRental) * 100) : 0;

    return {
      grossRental,
      normalAdminFees,
      specialAdminFees,
      totalAdminFees,
      normalBookingsCount,
      specialBookingsCount,
      adminFees: totalAdminFees,
      marketerCommissions,
      totalExpenses,
      insuranceReceived,
      insuranceReturned,
      netProfit,
      profitMargin,
      bookingsCount: filteredBookings.length,
      nightsCount,
    };
  }, [filteredBookings, filteredExpenses, properties, specialAdminFeeBoxes]);

  // Per-property financial breakdown (ONLY checked-out bookings)
  const propertyBreakdown = useMemo(() => {
    const list = selectedPropertyFilter === 'all'
      ? properties
      : properties.filter((p) => p.id === selectedPropertyFilter);

    return list.map((prop) => {
      const propBookings = filteredBookings.filter((b) => b.propertyId === prop.id);
      const propExpenses = filteredExpenses.filter((e) => e.propertyId === prop.id);

      let gross = 0;
      let normalAdminFees = 0;
      let specialAdminFees = 0;
      let commissions = 0;
      let nights = 0;

      propBookings.forEach((b) => {
        gross += b.totalPrice || 0;
        const feeBreakdown = getBookingAdminFeeBreakdown(b, properties, specialAdminFeeBoxes);
        normalAdminFees += feeBreakdown.normalAdminFee;
        specialAdminFees += feeBreakdown.specialAdminFee;
        commissions += getBookingCommissionAmount(b);
        nights += b.nightsCount || 1;
      });

      const totalPropAdminFees = normalAdminFees + specialAdminFees;
      const expTotal = propExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const net = gross - totalPropAdminFees - commissions - expTotal;
      const shareOfProfit = totals.netProfit > 0 ? Math.round((net / totals.netProfit) * 100) : 0;

      return {
        property: prop,
        bookingsCount: propBookings.length,
        nightsCount: nights,
        gross,
        normalAdminFees,
        specialAdminFees,
        adminFees: totalPropAdminFees,
        commissions,
        expensesTotal: expTotal,
        net,
        shareOfProfit,
      };
    });
  }, [properties, specialAdminFeeBoxes, selectedPropertyFilter, filteredBookings, filteredExpenses, totals.netProfit]);

  const handleSaveExpense = () => {
    setExpenseError(null);
    if (!expenseTitle.trim()) {
      setExpenseError('يرجى إدخال وصف المصروف أو البند.');
      return;
    }
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      setExpenseError('يرجى تحديد مبلغ المصروف بالريال السعودي.');
      return;
    }

    const targetProp = properties.find((p) => p.id === expensePropId);
    addExpense({
      propertyId: expensePropId,
      propertyName: targetProp?.name || 'استراحة',
      title: expenseTitle.trim(),
      category: expenseCategory,
      amount: Number(expenseAmount),
      date: expenseDate,
      notes: expenseNotes.trim() || undefined,
    });

    setExpenseModalOpen(false);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseNotes('');
  };

  const CATEGORY_LABELS: Record<PropertyExpense['category'], string> = {
    maintenance: 'صيانة وإصلاحات',
    cleaning: 'نظافة ومغسلة',
    hospitality: 'ضيافة وبخور',
    supplies: 'مستلزمات ومستهلكات',
    utilities: 'كهرباء ومياه',
    other: 'مصروفات أخرى',
  };

  const activePreset: Preset =
    (['today', 'week', 'month', 'quarter', 'year'] as const).find((p) => {
      const r = rangeFor(p);
      return r.from === fromDate && r.to === toDate;
    }) || 'custom';

  return (
    <div className="flex flex-col gap-3">
      {/* 1. الفترة والعقار */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="الفترة والعقار" icon={Calendar} />
        <Seg
          label="الفترة السريعة"
          value={activePreset}
          onChange={(p) => handleSetPreset(p as Exclude<Preset, 'custom'>)}
          items={[
            { id: 'today', label: 'اليوم' },
            { id: 'week', label: 'أسبوع' },
            { id: 'month', label: 'شهر' },
            { id: 'quarter', label: 'ربع' },
            { id: 'year', label: 'عام' },
          ]}
        />
        <div className="kt-fields">
          <Field label="من تاريخ">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="kt-input" />
          </Field>
          <Field label="إلى تاريخ">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="kt-input" />
          </Field>
          <Field label="العقار" className="kt-wide">
            <select value={selectedPropertyFilter} onChange={(e) => setSelectedPropertyFilter(e.target.value)} className="kt-input">
              <option value="all">كل العقارات ({fmtN(properties.length)})</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* 2. قاعدة الاعتماد المالي */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="قاعدة الاعتماد" icon={ShieldCheck} tone="jade" />
        <p className="kt-note">لا تُحتسب الإيجارات والعمولات والرسوم إلا بعد خروج العميل.</p>
        <Infos cols={2}>
          <Info label="معتمد بعد الخروج" value={`${fmtN(totals.bookingsCount)} حجز`} />
          <Info label="معلق قبل الخروج" value={`${fmtN(pendingCheckoutSummary.count)} حجز`} />
        </Infos>
        {pendingCheckoutSummary.count > 0 && (
          <div className="kt-warn p-3 text-[13px] font-bold leading-6" style={{ color: '#7A4A06' }}>
            المعلّق: {fmtN(pendingCheckoutSummary.rentalTotal)} ر.س إيجار · {fmtN(pendingCheckoutSummary.commissionTotal)} ر.س عمولة.
          </div>
        )}
      </section>

      {/* 3. المؤشرات الرئيسية */}
      <Stats cols={2}>
        <Stat icon={DollarSign} label="إجمالي الإيجارات" value={fmtN(totals.grossRental)} unit="ر.س" hint={`${fmtN(totals.bookingsCount)} حجز · ${fmtN(totals.nightsCount)} ليلة`} />
        <Stat icon={Layers} tone="sand" label="مجموع الرسوم" value={fmtN(totals.totalAdminFees)} unit="ر.س" hint="رسوم إدارية" />
        <Stat icon={Percent} tone="saph" label="عمولات المسوقين" value={fmtN(totals.marketerCommissions)} unit="ر.س" hint="بعد الخروج فقط" />
        <Stat icon={AlertCircle} tone="garn" label="مصاريف التشغيل" value={fmtN(totals.totalExpenses)} unit="ر.س" hint={`${fmtN(filteredExpenses.length)} بند`} />
        <Stat icon={TrendingUp} tone="jade" label="صافي الأرباح" value={fmtN(totals.netProfit)} unit="ر.س" hint="بعد كل الخصومات" />
        <Stat icon={Percent} tone="jade" label="هامش الربح" value={fmtN(totals.profitMargin)} unit="%" hint="من الإيجارات" />
      </Stats>

      {/* 4. تفصيل الرسوم الإدارية */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="تفصيل الرسوم" icon={TagIcon} tone="sand" />
        <p className="kt-note">
          {fmtN(totals.normalBookingsCount)} حجز عادي · {fmtN(totals.specialBookingsCount)} حجز Supervisor
        </p>
        <Infos cols={2}>
          <Info label="الرسوم العادية" value={`${fmtN(totals.normalAdminFees)} ر.س`} />
          <Info label="رسوم Supervisor" value={`${fmtN(totals.specialAdminFees)} ر.س`} />
          <Info hi wide label="المجموع الكلي" value={`${fmtN(totals.totalAdminFees)} ر.س`} />
        </Infos>
      </section>

      {/* 5. صافي الأرباح لكل عقار */}
      <section className="lux-card p-4 space-y-3.5">
        <Head
          title="الأرباح لكل عقار"
          icon={Building}
          count={propertyBreakdown.length}
          action={canManageExpenses ? <Act small tone="ink" icon={Plus} label="مصروف جديد" title="تسجيل مصروف تشغيلي جديد" onClick={() => setExpenseModalOpen(true)} /> : undefined}
        />
        {propertyBreakdown.map((item) => (
          <div key={item.property.id} className="kt-bk">
            <div className="kt-bk-h">
              <Tile icon={Building} tone="amy" size={44} />
              <span className="kt-row-t">
                <span className="kt-row-n">{item.property.name}</span>
                <span className="kt-row-s">
                  {fmtN(item.bookingsCount)} حجز · {fmtN(item.nightsCount)} ليلة
                </span>
              </span>
              <Tag tone="gray" mono>
                {fmtN(item.shareOfProfit)}%
              </Tag>
            </div>
            <Infos cols={2}>
              <Info label="الإيجار" value={`${fmtN(item.gross)} ر.س`} />
              <Info label="الرسوم" value={`${fmtN(item.adminFees)} ر.س`} />
              <Info label="العمولات" value={`${fmtN(item.commissions)} ر.س`} />
              <Info label="المصروفات" value={`${fmtN(item.expensesTotal)} ر.س`} />
              <Info hi wide label="صافي الربح" value={`${fmtN(item.net)} ر.س`} />
            </Infos>
          </div>
        ))}
      </section>

      {/* 6. سجل المصروفات */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="سجل المصروفات" icon={FileText} count={filteredExpenses.length} />
        <p className="kt-note">الإجمالي: {fmtN(totals.totalExpenses)} ر.س</p>
        {filteredExpenses.length === 0 ? (
          <EmptyBox icon={FileText} text="لا توجد مصاريف في هذه الفترة." />
        ) : (
          filteredExpenses.map((exp) => (
            <div key={exp.id} className="kt-bk">
              <div className="kt-bk-h">
                <Tile icon={FileText} tone="garn" size={44} />
                <span className="kt-row-t">
                  <span className="kt-row-n">{exp.title}</span>
                  <span className="kt-row-s">
                    {exp.propertyName} · {CATEGORY_LABELS[exp.category]}
                  </span>
                </span>
                <Tag tone="garn" mono>
                  {fmtN(exp.amount)} ر.س
                </Tag>
              </div>
              <p className="kt-note">
                <bdi dir="ltr">{exp.date}</bdi>
                {exp.notes ? ` · ${exp.notes}` : ''}
              </p>
              {canManageExpenses && <Act small tone="garnS" icon={Trash2} label="حذف المصروف" onClick={() => deleteExpense(exp.id)} />}
            </div>
          ))
        )}
      </section>

      {/* تسجيل مصروف */}
      {expenseModalOpen && (
        <Sheet
          lockBackdrop
          title="تسجيل مصروف"
          icon={Plus}
          tone="amy"
          onClose={() => setExpenseModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="ink" icon={CheckCircle2} label="حفظ المصروف" onClick={handleSaveExpense} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setExpenseModalOpen(false)} />
            </Acts>
          }
        >
          <div className="kt-fields">
            <Field label="العقار" className="kt-wide">
              <select value={expensePropId} onChange={(e) => setExpensePropId(e.target.value)} className="kt-input">
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="بند المصروف" className="kt-wide">
              <input
                type="text"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="مثال: صيانة فلتر المسبح"
                className="kt-input"
              />
            </Field>
            <Field label="التصنيف">
              <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value as PropertyExpense['category'])} className="kt-input">
                {(Object.keys(CATEGORY_LABELS) as PropertyExpense['category'][]).map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المبلغ (ر.س)">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="250"
                className="kt-input kt-num"
              />
            </Field>
            <Field label="التاريخ" className="kt-wide">
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="kt-input" />
            </Field>
            <Field label="ملاحظات" hint="اختياري" className="kt-wide">
              <input type="text" value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} placeholder="رقم الفاتورة أو اسم المحل" className="kt-input" />
            </Field>
          </div>
          {expenseError && (
            <div className="kt-err" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{expenseError}</span>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
};
