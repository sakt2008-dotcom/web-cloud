import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  DollarSign,
  Building,
  Calendar,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  X,
  Lock,
  ArrowDownRight,
  CheckCircle2,
  Wallet,
  Clock,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Booking } from '../../types';
import {
  isBookingCheckedOut,
  getBookingAdminFeeBreakdown,
  getBookingCommissionAmount,
} from '../../lib/financials';
import { Sheet, Acts, Act, Stats, Stat, Infos, Info, SearchBox, Field, Head, Tag } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';
import { fmtN, nightsText } from '../../lib/format';

interface AdministrativeFeesLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdministrativeFeesLedgerModal: React.FC<AdministrativeFeesLedgerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { bookings, properties, specialAdminFeeBoxes, isAdmin, canViewCalendar, canViewMore } = useApp();
  const [selectedPropFilter, setSelectedPropFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const pendingCheckoutCount = useMemo(() => {
    return bookings.filter((b) => b.status !== 'cancelled' && !isBookingCheckedOut(b)).length;
  }, [bookings]);

  const ledgerRecords = useMemo(() => {
    return bookings
      .filter((b) => isBookingCheckedOut(b))
      .map((b) => {
        const breakdown = getBookingAdminFeeBreakdown(b, properties, specialAdminFeeBoxes);
        const totalAdminFee = breakdown.totalAdminFee;
        const feePerNight = Math.round(totalAdminFee / Math.max(1, b.nightsCount));
        const grossNightly = Math.round((b.baseNightlyTotal || b.nightlyPrice * b.nightsCount) / Math.max(1, b.nightsCount));
        const grossTotal = b.totalPrice || (grossNightly * b.nightsCount);
        const commissionAmount = getBookingCommissionAmount(b);
        const netOwnerPayout = b.propertyNetPayout !== undefined ? b.propertyNetPayout : Math.max(0, grossTotal - commissionAmount - totalAdminFee);
        const netNightly = Math.round(netOwnerPayout / Math.max(1, b.nightsCount));

        return {
          id: b.id,
          bookingNumber: b.bookingNumber,
          propertyName: b.propertyName,
          propertyId: b.propertyId,
          sectionName: b.sectionName,
          customerName: b.customerName,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          nightsCount: b.nightsCount,
          grossNightly,
          feePerNight,
          netNightly,
          grossTotal,
          commissionRatePercent: b.commissionRatePercent || 5,
          commissionAmount,
          normalAdminFee: breakdown.normalAdminFee,
          specialAdminFee: breakdown.specialAdminFee,
          totalAdminFee,
          feeType: breakdown.feeType,
          netOwnerPayout,
          netTotal: netOwnerPayout,
          marketerName: b.marketerName || 'الإدارة مباشرة',
          date: b.createdAt || b.checkInDate,
          status: 'معتمد بعد خروج العميل',
        };
      });
  }, [bookings, properties, specialAdminFeeBoxes]);

  const filteredRecords = useMemo(() => {
    return ledgerRecords.filter((rec) => {
      const matchProp = selectedPropFilter === 'all' || rec.propertyId === selectedPropFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        rec.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.marketerName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchProp && matchSearch;
    });
  }, [ledgerRecords, selectedPropFilter, searchQuery]);

  // Aggregate stats (Normal on its own, Special on its own, Combined Total together)
  const totalNormalFees = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.normalAdminFee, 0);
  }, [filteredRecords]);

  const totalSpecialFees = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.specialAdminFee, 0);
  }, [filteredRecords]);

  const totalCollectedFees = totalNormalFees + totalSpecialFees;

  const totalGrossNightsRevenue = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.grossTotal, 0);
  }, [filteredRecords]);

  const totalNetNightsRevenue = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.netTotal, 0);
  }, [filteredRecords]);

  const totalNightsProcessed = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.nightsCount, 0);
  }, [filteredRecords]);

  const handleCopyTableForSheets = () => {
    const headers = [
      'كود الحجز',
      'العقار والوحدة',
      'العميل',
      'تاريخ الدخول',
      'تاريخ الخروج',
      'الليالي',
      'إجمالي الإيجار',
      'الرسوم الإدارية العادية',
      'رسوم (Supervisor)',
      'مجموع الرسوم الكلية',
      'صافي دخل الإقامة',
      'المسوق المسؤول',
      'حالة القيد المالي',
    ].join('\t');

    const rows = filteredRecords
      .map((r) =>
        [
          r.bookingNumber,
          r.propertyName,
          r.customerName,
          r.checkInDate,
          r.checkOutDate,
          r.nightsCount,
          r.grossTotal,
          r.normalAdminFee,
          r.specialAdminFee,
          r.totalAdminFee,
          r.netTotal,
          r.marketerName,
          r.status,
        ].join('\t')
      )
      .join('\n');

    const fullTsv = `${headers}\n${rows}`;
    navigator.clipboard?.writeText(fullTsv);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  if (!isOpen) return null;

  // Allow Admin or users with Calendar / More full permissions
  if (!isAdmin && !canViewCalendar && !canViewMore) {
    return (
      <Sheet
        title="غير مصرح بالوصول"
        icon={Lock}
        tone="garn"
        onClose={onClose}
        footer={<Act tone="line" icon={X} label="إغلاق" onClick={onClose} />}
      >
        <div className="kt-err" role="alert">
          <Lock size={20} strokeWidth={1.8} className="shrink-0" />
          <span>هذا الجدول مخصص للإدارة العامة فقط.</span>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      wide
      title="الرسوم الإدارية"
      icon={Receipt}
      tone="sand"
      onClose={onClose}
      footer={
        <Acts cols={2}>
          <Act
            tone={copiedSuccess ? 'jade' : 'soft'}
            icon={copiedSuccess ? Check : FileSpreadsheet}
            label={copiedSuccess ? 'تم النسخ ✓' : 'نسخ للجدول'}
            title="نسخ الجدول إلى Sheets / Excel"
            onClick={handleCopyTableForSheets}
          />
          <Act tone="line" icon={X} label="إغلاق" onClick={onClose} />
        </Acts>
      }
    >
      <p className="kt-note">سرّي للإدارة فقط — لا تُضاف المبالغ إلا بعد خروج العميل.</p>
      {pendingCheckoutCount > 0 && (
        <div className="kt-warn p-3 text-[13px] font-bold leading-6" style={{ color: '#7A4A06' }}>
          {pendingCheckoutCount} حجز لم يخرج عميله بعد (مستبعد مؤقتاً).
        </div>
      )}

      <Stats cols={2} compact>
        <Stat label="الرسوم العادية" value={fmtN(totalNormalFees)} unit="ر.س" />
        <Stat tone="jade" label="رسوم Supervisor" value={fmtN(totalSpecialFees)} unit="ر.س" />
        <Stat tone="sand" label="مجموع الرسوم" value={fmtN(totalCollectedFees)} unit="ر.س" />
        <Stat label="إجمالي الإيجار" value={fmtN(totalGrossNightsRevenue)} unit="ر.س" />
        <Stat tone="jade" label="الصافي بعد الخصم" value={fmtN(totalNetNightsRevenue)} unit="ر.س" />
        <Stat label="الحجوزات" value={fmtN(filteredRecords.length)} hint={`${fmtN(totalNightsProcessed)} ليلة`} />
      </Stats>

      <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="رقم الحجز أو العقار أو العميل" />
      <Field label="العقار">
        <select value={selectedPropFilter} onChange={(e) => setSelectedPropFilter(e.target.value)} className="kt-input">
          <option value="all">جميع العقارات</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Head title="المعاملات" icon={Receipt} count={filteredRecords.length} />
      {filteredRecords.length === 0 ? (
        <EmptyBox icon={Receipt} text="لا توجد معاملات مطابقة بعد خروج العميل" />
      ) : (
        filteredRecords.map((rec) => (
          <div key={rec.id} className="kt-bk">
            <div className="kt-bk-h">
              <span className="kt-row-t">
                <span className="kt-row-n">
                  {rec.propertyName}
                  {rec.sectionName ? ` · ${rec.sectionName}` : ''}
                </span>
                <span className="kt-row-s">
                  <bdi dir="ltr">{rec.bookingNumber}</bdi> · {nightsText(rec.nightsCount)}
                </span>
              </span>
              <Tag tone="jade">معتمد</Tag>
            </div>
            <p className="kt-note">
              من <bdi dir="ltr">{rec.checkInDate}</bdi> إلى <bdi dir="ltr">{rec.checkOutDate}</bdi> · {rec.marketerName}
            </p>
            <Infos cols={2}>
              <Info label="الإيجار" value={`${fmtN(rec.grossTotal)} ر.س`} />
              <Info label={`عمولة ${rec.commissionRatePercent}%`} value={`-${fmtN(rec.commissionAmount)} ر.س`} />
              <Info label="الرسوم العادية" value={rec.normalAdminFee > 0 ? `-${fmtN(rec.normalAdminFee)} ر.س` : '0 ر.س'} />
              <Info label="رسوم Supervisor" value={rec.specialAdminFee > 0 ? `-${fmtN(rec.specialAdminFee)} ر.س` : '0 ر.س'} />
              <Info label="مجموع الرسوم" value={`-${fmtN(rec.totalAdminFee)} ر.س`} />
              <Info hi label="صافي العقار" value={`${fmtN(rec.netOwnerPayout)} ر.س`} />
            </Infos>
          </div>
        ))
      )}
    </Sheet>
  );
};
