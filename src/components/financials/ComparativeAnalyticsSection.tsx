import React, { useState, useMemo } from 'react';
import { Award, AlertTriangle, Building, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isBookingCheckedOut } from '../../lib/financials';
import { Head, Seg, Infos, Info, Tag, Tile, Field } from '../ui/kit';
import { fmtN } from '../../lib/format';

interface ComparativeAnalyticsSectionProps {
  fromDate: string;
  toDate: string;
  setFromDate: (d: string) => void;
  setToDate: (d: string) => void;
}

export const ComparativeAnalyticsSection: React.FC<ComparativeAnalyticsSectionProps> = ({
  fromDate,
  toDate,
  setFromDate,
  setToDate,
}) => {
  const { properties, bookings } = useApp();

  const [activeChartType, setActiveChartType] = useState<'bars' | 'donut'>('bars');

  // Filter ONLY checked-out bookings in range (لا تضاف مبالغ الإيجارات إلا بعد خروج العميل)
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!isBookingCheckedOut(b)) return false;
      const inDate = b.checkInDate;
      return inDate >= fromDate && inDate <= toDate;
    });
  }, [bookings, fromDate, toDate]);

  const totalBookingsCount = filteredBookings.length;
  const totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  // Calculate stats per property
  const propertyStats = useMemo(() => {
    const list = properties.map((prop, idx) => {
      const propBookings = filteredBookings.filter((b) => b.propertyId === prop.id);
      const bookingsCount = propBookings.length;
      const nightsCount = propBookings.reduce((sum, b) => sum + (b.nightsCount || 1), 0);
      const revenue = propBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const percentageOfBookings =
        totalBookingsCount > 0 ? Math.round((bookingsCount / totalBookingsCount) * 100) : 0;
      const percentageOfRevenue =
        totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;

      // Color scheme for charts
      const colors = [
        { bg: 'bg-purple-600', fill: '#9333ea', text: 'text-purple-600', light: 'bg-purple-50' },
        { bg: 'bg-emerald-600', fill: '#059669', text: 'text-emerald-600', light: 'bg-emerald-50' },
        { bg: 'bg-sky-600', fill: '#0284c7', text: 'text-sky-600', light: 'bg-sky-50' },
        { bg: 'bg-amber-600', fill: '#d97706', text: 'text-amber-600', light: 'bg-amber-50' },
        { bg: 'bg-rose-600', fill: '#e11d48', text: 'text-rose-600', light: 'bg-rose-50' },
      ];
      const color = colors[idx % colors.length];

      return {
        property: prop,
        bookingsCount,
        nightsCount,
        revenue,
        percentageOfBookings,
        percentageOfRevenue,
        color,
      };
    });

    // Sort descending by bookings count
    return [...list].sort((a, b) => b.bookingsCount - a.bookingsCount);
  }, [properties, filteredBookings, totalBookingsCount, totalRevenue]);

  // Identify most and least booked
  const mostBooked = propertyStats[0] || null;
  const leastBooked = propertyStats[propertyStats.length - 1] || null;

  // Max bookings for bar normalization
  const maxBookings = Math.max(...propertyStats.map((p) => p.bookingsCount), 1);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. الفترة ونوع الرسم */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="الفترة والمقارنة" icon={BarChart3} />
        <div className="kt-fields">
          <Field label="من تاريخ">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="kt-input" />
          </Field>
          <Field label="إلى تاريخ">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="kt-input" />
          </Field>
        </div>
        <Seg
          label="نوع الرسم"
          value={activeChartType}
          onChange={setActiveChartType}
          items={[
            { id: 'bars', label: 'أعمدة', icon: BarChart3 },
            { id: 'donut', label: 'حصص', icon: PieChartIcon },
          ]}
        />
        <p className="kt-note">تُحتسب الحجوزات بعد خروج العميل فقط · الإجمالي {fmtN(totalBookingsCount)} حجز.</p>
      </section>

      {/* 2. الأعلى والأقل */}
      {mostBooked && (
        <div className="kt-bk">
          <div className="kt-bk-h">
            <Tile icon={Award} tone="jade" size={44} />
            <span className="kt-row-t">
              <span className="kt-row-n">{mostBooked.property.name}</span>
              <span className="kt-row-s">الأكثر طلباً</span>
            </span>
            <Tag tone="jade" mono>
              {fmtN(mostBooked.percentageOfBookings)}%
            </Tag>
          </div>
          <Infos cols={2}>
            <Info label="الحجوزات" value={fmtN(mostBooked.bookingsCount)} />
            <Info label="الليالي" value={fmtN(mostBooked.nightsCount)} />
            <Info hi wide label="الإيرادات" value={`${fmtN(mostBooked.revenue)} ر.س`} />
          </Infos>
        </div>
      )}
      {leastBooked && propertyStats.length > 1 && (
        <div className="kt-bk">
          <div className="kt-bk-h">
            <Tile icon={AlertTriangle} tone="sand" size={44} />
            <span className="kt-row-t">
              <span className="kt-row-n">{leastBooked.property.name}</span>
              <span className="kt-row-s">الأقل حجوزاً</span>
            </span>
            <Tag tone="sand" mono>
              {fmtN(leastBooked.percentageOfBookings)}%
            </Tag>
          </div>
          <Infos cols={2}>
            <Info label="الحجوزات" value={fmtN(leastBooked.bookingsCount)} />
            <Info label="الليالي" value={fmtN(leastBooked.nightsCount)} />
            <Info wide label="الإيرادات" value={`${fmtN(leastBooked.revenue)} ر.س`} />
          </Infos>
          <p className="kt-note">يُوصى بعروض وتكثيف حملات المسوقين لرفع الإشغال.</p>
        </div>
      )}

      {/* 3. الرسم */}
      <section className="lux-card p-4 space-y-3.5">
        <Head
          title={activeChartType === 'bars' ? 'مقارنة الحجوزات' : 'الحصة من الحجوزات'}
          icon={activeChartType === 'bars' ? BarChart3 : PieChartIcon}
          count={fmtN(totalBookingsCount)}
        />
        {activeChartType === 'bars' ? (
          <div className="flex flex-col gap-3.5">
            {propertyStats.map((item, idx) => {
              const barWidth = Math.max(6, Math.round((item.bookingsCount / maxBookings) * 100));
              return (
                <div key={item.property.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[14px] font-extrabold text-[#1A0F2E] truncate">
                      {idx + 1}. {item.property.name}
                    </span>
                    <span className="text-[13px] font-extrabold text-[#5E5575] shrink-0">
                      {fmtN(item.bookingsCount)} حجز · {fmtN(item.percentageOfBookings)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: '#EAE3F4' }}>
                    <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: item.color.fill }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="relative mx-auto w-[200px] h-[200px]">
              <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90" aria-hidden="true">
                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#EAE3F4" strokeWidth="28" />
                {propertyStats.reduce(
                  (acc, item) => {
                    const circumference = 2 * Math.PI * 70;
                    const strokeDasharray = `${(item.percentageOfBookings / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -acc.offset;
                    const circleEl = (
                      <circle
                        key={item.property.id}
                        cx="100"
                        cy="100"
                        r="70"
                        fill="transparent"
                        stroke={item.color.fill}
                        strokeWidth="28"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                    return {
                      elements: [...acc.elements, circleEl],
                      offset: acc.offset + (item.percentageOfBookings / 100) * circumference,
                    };
                  },
                  { elements: [] as React.ReactNode[], offset: 0 }
                ).elements}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[12.5px] font-bold text-[#5E5575]">الحجوزات</span>
                <span className="text-[30px] font-black text-[#1A0F2E] leading-none font-mono">{fmtN(totalBookingsCount)}</span>
              </div>
            </div>
            {propertyStats.map((item) => (
              <div key={item.property.id} className="kt-bk">
                <div className="kt-bk-h">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: item.color.fill }} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{item.property.name}</span>
                    <span className="kt-row-s">{fmtN(item.bookingsCount)} حجز</span>
                  </span>
                  <Tag tone="gray" mono>
                    {fmtN(item.percentageOfBookings)}%
                  </Tag>
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      {/* 4. الترتيب والمقارنة الكاملة */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="ترتيب العقارات" icon={Building} count={propertyStats.length} />
        <p className="kt-note">مرتبة تنازلياً حسب عدد الحجوزات.</p>
        {propertyStats.map((item, idx) => (
          <div key={item.property.id} className="kt-bk">
            <div className="kt-bk-h">
              <Tag tone={idx === 0 ? 'gold' : 'gray'} mono>
                #{idx + 1}
              </Tag>
              <span className="kt-row-t">
                <span className="kt-row-n">{item.property.name}</span>
              </span>
              <Tag tone={idx === 0 ? 'jade' : idx === propertyStats.length - 1 ? 'garn' : 'gray'}>
                {idx === 0 ? 'ممتاز' : idx === propertyStats.length - 1 ? 'يحتاج دعم' : 'جيد جداً'}
              </Tag>
            </div>
            <Infos cols={2}>
              <Info label="الحجوزات" value={`${fmtN(item.bookingsCount)} (${fmtN(item.percentageOfBookings)}%)`} />
              <Info label="الليالي" value={fmtN(item.nightsCount)} />
              <Info label="الإيرادات" value={`${fmtN(item.revenue)} ر.س`} />
              <Info label="نسبة الإيراد" value={`${fmtN(item.percentageOfRevenue)}%`} />
            </Infos>
          </div>
        ))}
      </section>
    </div>
  );
};
