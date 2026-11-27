import { findEstateParent, getEstateOptions, isLinkedEstate, getEstateNightPrice, estateBookingBlocksUnit } from '../../lib/propertyUtils';
import React, { useState, useEffect } from 'react';
import { CalendarPlus, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { prepareReceiptFileForAppStorage } from '../../lib/bookingReceipts';
import { fmtN, nightsText, localTodayStr } from '../../lib/format';
import { Act, Acts, Field, Info, Infos, Seg, Sheet } from '../ui/kit';
import { FilePick } from '../dashboard/DashboardCards';

export const BookingModal: React.FC = () => {
  const {
    bookingModalOpen,
    setBookingModalOpen,
    preselectedDateForBooking,
    properties,
    selectedPropertyId,
    marketers,
    coordinators,
    coordinatorServices,
    isAdmin,
    currentMarketerId,
    activePermissions,
    canEditDeposit,
    addBooking,
    bookings,
    specialAdminFeeBoxes,
    preselectedSectionForBooking,
    dateOverrides,
  } = useApp();

  const [propId, setPropId] = useState(selectedPropertyId);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [commType, setCommType] = useState<'full' | 'partial' | 'special' | 'admin'>('partial');
  const [customNightlyPrice, setCustomNightlyPrice] = useState<number | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('05');
  const [custNationalId, setCustNationalId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [guestsCountInput, setGuestsCountInput] = useState('');
  const [inDate, setInDate] = useState('');
  const [outDate, setOutDate] = useState('');
  const [deposit, setDeposit] = useState<number>(250);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [assignedMarketerId, setAssignedMarketerId] = useState(
    isAdmin ? marketers[0]?.id || '' : currentMarketerId
  );
  const [selectedCoordPkg, setSelectedCoordPkg] = useState('none');
  const [selectedCoordId, setSelectedCoordId] = useState(() => coordinators[0]?.id || 'c1');
  const [depositReceiptFile, setDepositReceiptFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = localTodayStr();

  useEffect(() => {
    if (bookingModalOpen) {
      setErrorMsg(null);
      setPropId(selectedPropertyId);
      const today = preselectedDateForBooking || todayStr;
      const validIn = today < todayStr ? todayStr : today;
      setInDate(validIn);
      const nextD = new Date(validIn);
      nextD.setDate(nextD.getDate() + 1);
      setOutDate(nextD.toISOString().split('T')[0]);

      if (preselectedSectionForBooking) {
        setSelectedSectionId(preselectedSectionForBooking);
      } else {
        setSelectedSectionId('all');
      }

      const prop = properties.find((p) => p.id === selectedPropertyId);
      if (prop?.defaultDeposit) {
        setDeposit(prop.defaultDeposit);
      }
      if (!isAdmin) {
        setAssignedMarketerId(currentMarketerId);
      }
      if (!selectedCoordId && coordinators[0]?.id) {
        setSelectedCoordId(coordinators[0].id);
      }
      setDepositReceiptFile(null);
      setCustNationalId('');
      setVehiclePlate('');
      setGuestsCountInput(prop?.capacity ? String(prop.capacity) : '');
      setReceiptUploadError(null);
    }
  }, [bookingModalOpen, preselectedDateForBooking, preselectedSectionForBooking, selectedPropertyId, properties, isAdmin, currentMarketerId, todayStr, coordinators, selectedCoordId]);

  if (!bookingModalOpen) return null;

  const activeProp = properties.find((p) => p.id === propId) || properties[0];
  const activeSection =
    selectedSectionId !== 'all' && activeProp.sections
      ? activeProp.sections.find((s) => s.id === selectedSectionId)
      : null;

  const estateParentForModal = findEstateParent(activeProp, properties);
  const estateOptionsForModal = estateParentForModal ? getEstateOptions(estateParentForModal, properties) : [];
  const multiSections = activeProp.sections || [];
  const isMultiSection = multiSections.length >= 2;
  const isMerged = activeProp.isMergedProperty || Boolean(activeProp.mergedConfig?.isMerged);
  const mergeType = activeProp.mergedConfig?.mergeType || (activeProp.mergedPropertyIds?.length ? 'linked_properties' : 'internal_units');

  // 1. Linked Properties Merge (دمج عقارين أو أكثر مسجلة بالنظام)
  const linkedPropIds = activeProp.mergedConfig?.linkedPropertyIds || activeProp.mergedPropertyIds || [];
  const linkedProps = linkedPropIds.map((id) => properties.find((p) => p.id === id)).filter(Boolean) as typeof properties;

  // Find all bookings conflicting with ANY linked property during [inDate, outDate)
  const conflictingLinkedBookings = inDate && outDate && isMerged && mergeType === 'linked_properties' && linkedPropIds.length > 0
    ? bookings.filter((b) => {
        if (b.status === 'cancelled') return false;
        if (!linkedPropIds.includes(b.propertyId)) return false;
        return inDate < b.checkOutDate && outDate > b.checkInDate;
      })
    : [];

  const isMergedLinkedConflict = conflictingLinkedBookings.length > 0;

  // 1.b Check if this property is a constituent of any parent merger that is booked
  const conflictingParentBookings = inDate && outDate && !isMerged
    ? bookings.filter((b) => {
        if (b.status === 'cancelled') return false;
        const parent = properties.find((p) => p.id === b.propertyId && p.isMergedProperty);
        if (!parent) return false;
        const parentLinked = parent.mergedConfig?.linkedPropertyIds || parent.mergedPropertyIds || [];
        if (!parentLinked.includes(propId)) return false;
        if (!estateBookingBlocksUnit(b, propId, selectedSectionId === 'all' ? null : selectedSectionId)) return false;
        return inDate < b.checkOutDate && outDate > b.checkInDate;
      })
    : [];
  const isParentConflict = conflictingParentBookings.length > 0;

  // 2. وحدة/عقار بعدة أقسام: كل قسم يُحجز منفصلاً أو الكامل (سعره = مجموع أسعار الأقسام)
  const checkUnitConflict = (sectionId?: string) => {
    if (!inDate || !outDate) return false;
    return bookings.some((b) => {
      if (b.status === 'cancelled' || b.propertyId !== propId) return false;
      const overlaps = inDate < b.checkOutDate && outDate > b.checkInDate;
      if (!overlaps) return false;
      if (!sectionId || sectionId === 'all') {
        return true;
      }
      return !b.sectionId || b.sectionId === 'all' || b.sectionId === sectionId;
    });
  };

  const bookedSectionIds = new Set(multiSections.filter((sec) => checkUnitConflict(sec.id)).map((sec) => sec.id));
  const isFullBooked = isMultiSection && checkUnitConflict('all');
  const combinedWeekdayPrice = multiSections.reduce((acc, sec) => acc + (Number(sec.priceWeekday) || 0), 0);

  const inTime = new Date(inDate).getTime();
  const outTime = new Date(outDate).getTime();
  const nights = Math.max(1, Math.round((outTime - inTime) / (1000 * 60 * 60 * 24))) || 1;

  const standardBaseNightly = activeSection
    ? activeSection.priceWeekday
    : isLinkedEstate(activeProp)
    ? getEstateNightPrice(activeProp, properties, dateOverrides, inDate) || activeProp.basePriceWeekday
    : isMultiSection
    ? combinedWeekdayPrice || activeProp.basePriceWeekday
    : activeProp.basePriceWeekday;
  const baseNightly = (commType === 'admin' && customNightlyPrice !== null && customNightlyPrice > 0)
    ? customNightlyPrice
    : standardBaseNightly;
  const rawTotal = baseNightly * nights;
  const netTotal = Math.max(0, rawTotal - discount);
  const commissionRate = commType === 'special' || commType === 'admin' ? 0 : (commType === 'full' ? 7 : 5);
  const commissionAmount = Math.round(rawTotal * (commissionRate / 100));

  const checkInDay = inDate ? new Date(inDate).getDay() : 0;
  const isSpecialWeekend = checkInDay === 4 || checkInDay === 5;
  const matchedSpecialBox =
    specialAdminFeeBoxes.find(
      (box) =>
        (box.propertyId === propId || box.propertyId === 'all') &&
        box.period === (isSpecialWeekend ? 'weekend' : 'weekday')
    ) ||
    specialAdminFeeBoxes.find((box) => box.propertyId === propId || box.propertyId === 'all');
  const specialAdminFeePerNight = matchedSpecialBox
    ? matchedSpecialBox.specialAdminFee
    : isSpecialWeekend
    ? 500
    : 400;
  const specialAdminFeeTotal = specialAdminFeePerNight * nights;

  const activeCoordServices = coordinatorServices.filter((s) => s.isActive !== false);
  const selectedServiceItem =
    selectedCoordPkg !== 'none'
      ? activeCoordServices.find((s) => s.id === selectedCoordPkg)
      : undefined;
  const selectedCoordinatorObj =
    coordinators.find((c) => c.id === selectedCoordId) || coordinators[0] || null;
  const coordinatorServicePrice = selectedServiceItem
    ? selectedServiceItem.price
    : selectedCoordPkg !== 'none'
    ? Number((selectedCoordPkg.match(/\(([\d,]+)\s*ر\.س\)/)?.[1] || '0').replace(/,/g, '')) || 0
    : 0;
  const coordinatorServiceTitle = selectedServiceItem
    ? `${selectedServiceItem.title} (${selectedServiceItem.price.toLocaleString()} ر.س)`
    : selectedCoordPkg !== 'none'
    ? selectedCoordPkg
    : undefined;
  const bookingGrandTotal = netTotal + coordinatorServicePrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!custName.trim() || !custPhone.trim() || !inDate || !outDate) {
      setErrorMsg('يرجى تعبئة اسم العميل ورقم الجوال وتاريخ الدخول والخروج.');
      return;
    }

    if (inDate < todayStr) {
      setErrorMsg('يمنع إنشاء أو قبول أي حجز على تواريخ فائتة. يرجى اختيار تاريخ اليوم أو تاريخ قادم.');
      return;
    }

    if (isMerged && mergeType === 'linked_properties' && isMergedLinkedConflict) {
      const bookedSummary = conflictingLinkedBookings
        .map((cb) => {
          const pName = cb.propertyName || properties.find((p) => p.id === cb.propertyId)?.name || 'استراحة مدمجة';
          return `${pName} (محجوزة لدى: ${cb.customerName})`;
        })
        .join(' و ');
      setErrorMsg(
        `لا يمكن حجز ${activeProp.name} في هذا التاريخ لأن الاستراحة المدمجة محجوزة مسبقاً [${bookedSummary}]. شرط حجز العقار المدمج أن تكون كافة الاستراحات المدمجة متاحة معاً لنفس التاريخ للعميل الجديد.`
      );
      return;
    }

    if (isParentConflict) {
      const parentSummary = conflictingParentBookings
        .map((pb) => `${pb.propertyName} (النزيل: ${pb.customerName})`)
        .join(' و ');
      setErrorMsg(
        `لا يمكن حجز ${activeProp.name} في هذا التاريخ لأنه محجوز ومقفل لصالح العقار المدمج [${parentSummary}].`
      );
      return;
    }

    if (isMultiSection) {
      if (selectedSectionId === 'all' && isFullBooked) {
        const busy = multiSections.filter((sec) => bookedSectionIds.has(sec.id)).map((sec) => sec.name);
        setErrorMsg(
          `لا يمكن حجز ${activeProp.name} بالكامل في هذا التاريخ لأن ${busy.length ? busy.join(' و ') + ' محجوز مسبقاً' : 'جزءاً منه محجوز مسبقاً'}. حجز الكامل يتطلب توفر كل الأقسام.`
        );
        return;
      }
      if (selectedSectionId !== 'all' && bookedSectionIds.has(selectedSectionId)) {
        setErrorMsg('هذا القسم محجوز مسبقاً في هذا التاريخ ولا يمكن تكرار الحجز.');
        return;
      }
    } else {
      const isConflict = bookings.some((b) => {
        if (b.status === 'cancelled' || b.propertyId !== propId) return false;
        if (selectedSectionId !== 'all' && b.sectionId && b.sectionId !== selectedSectionId) {
          return false;
        }
        return inDate < b.checkOutDate && outDate > b.checkInDate;
      });

      if (isConflict) {
        setErrorMsg('اليوم محجوز ومؤكد ولا يمكن تكرار الحجز');
        return;
      }
    }

    try {
      addBooking({
        propertyId: propId,
        sectionId: selectedSectionId !== 'all' ? selectedSectionId : undefined,
        sectionName: activeSection ? activeSection.name : isMultiSection ? `كامل ${activeProp.name}` : undefined,
        customerName: custName.trim(),
        customerPhone: custPhone.trim(),
        customerNationalId: custNationalId.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        guestsCount: guestsCountInput.trim() && Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
        checkInDate: inDate,
        checkOutDate: outDate,
        nightsCount: nights,
        nightlyPrice: baseNightly,
        totalPrice: bookingGrandTotal,
        baseNightlyTotal: rawTotal,
        adminFee: commType === 'admin' ? 0 : commType === 'special' ? specialAdminFeeTotal : undefined,
        marketerCommission: commType === 'admin' || commType === 'special' ? 0 : commissionAmount,
        propertyNetPayout:
          commType === 'admin'
            ? bookingGrandTotal
            : commType === 'special'
            ? Math.max(0, netTotal - specialAdminFeeTotal)
            : undefined,
        discount,
        depositPaid: deposit,
        marketerId: assignedMarketerId || undefined,
        commissionRatePercent: commissionRate,
        bookingType: commType,
        isSpecialBooking: commType === 'special',
        isAdminBooking: commType === 'admin',
        customAdminNightlyPrice: commType === 'admin' && customNightlyPrice !== null ? customNightlyPrice : undefined,
        coordinatorName: coordinatorServiceTitle ? (selectedCoordinatorObj?.name || selectedServiceItem?.coordinatorName) : undefined,
        coordinatorPhone: coordinatorServiceTitle ? (selectedCoordinatorObj?.phone || selectedServiceItem?.coordinatorPhone) : undefined,
        coordinatorService: coordinatorServiceTitle,
        coordinatorPrice: coordinatorServicePrice || 0,
        depositReceiptUrl: depositReceiptFile?.dataUrl,
        depositReceiptName: depositReceiptFile?.name,
        receiptFileName: depositReceiptFile?.name,
        receiptDataUrl: depositReceiptFile?.dataUrl,
        notes,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر حفظ الحجز، يرجى مراجعة التواريخ والمحاولة مجدداً.');
      return;
    }

    setCustName('');
    setCustPhone('05');
    setDiscount(0);
    setNotes('');
    setSelectedCoordPkg('none');
    setDepositReceiptFile(null);
    setReceiptUploadError(null);
    setErrorMsg(null);
    setBookingModalOpen(false);
  };

  const n = fmtN;
  const showCoordinators =
    propId === 'hamran' ||
    activeProp.name.includes('حمران') ||
    activeProp.name.includes('الما') ||
    activeProp.name.includes('نايا');
  const nightlyShort = (v: number) => `${n(v)} ر.س`;

  return (
    <Sheet
      wide
      lockBackdrop
      title="حجز جديد"
      icon={CalendarPlus}
      tone="amy"
      onClose={() => setBookingModalOpen(false)}
      footer={
        <Acts cols={2}>
          <Act submit form="booking-form" tone="ink" icon={CheckCircle2} label="تأكيد الحجز" />
          <Act tone="line" icon={X} label="إلغاء" onClick={() => setBookingModalOpen(false)} />
        </Acts>
      }
    >
      <form id="booking-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* ── العقار والقسم ── */}
        <Field label="العقار">
          <select
            className="kt-input"
            value={propId}
            onChange={(e) => {
              setPropId(e.target.value);
              setSelectedSectionId('all');
            }}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {nightlyShort(p.basePriceWeekday)}
              </option>
            ))}
          </select>
        </Field>

        {estateParentForModal && estateOptionsForModal.length > 0 && (
          <Field label="الوحدة أو القسم" hint={estateParentForModal.name}>
            <select
              className="kt-input"
              value={`${propId}:${selectedSectionId}`}
              onChange={(e) => {
                const o = estateOptionsForModal.find((x) => x.key === e.target.value);
                if (o) {
                  setPropId(o.propertyId);
                  setSelectedSectionId(o.sectionId);
                }
              }}
            >
              {!estateOptionsForModal.some((x) => x.key === `${propId}:${selectedSectionId}`) && (
                <option value={`${propId}:${selectedSectionId}`}>اختر ما تريد حجزه…</option>
              )}
              {estateOptionsForModal.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label} · {nightlyShort(o.weekday)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {activeProp.sections && activeProp.sections.length > 0 && (
          <>
            <Field label={isMultiSection ? 'الكامل أو قسم' : 'القسم'} hint={activeProp.name}>
              <select
                className="kt-input"
                style={
                  isMultiSection && selectedSectionId === 'all' && isFullBooked
                    ? { background: '#fbe8ec', boxShadow: 'inset 0 0 0 1.5px #b8435e' }
                    : undefined
                }
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
              >
                {isMultiSection ? (
                  <option value="all" disabled={isFullBooked}>
                    {`الكامل · ${nightlyShort(combinedWeekdayPrice)} ${isFullBooked ? '⛔ غير متاح' : '✓'}`}
                  </option>
                ) : (
                  <option value="all">{`${activeProp.name} · ${nightlyShort(activeProp.basePriceWeekday)}`}</option>
                )}
                {activeProp.sections.map((sec) => {
                  const isSecBooked = bookedSectionIds.has(sec.id);
                  return (
                    <option key={sec.id} value={sec.id} disabled={isSecBooked}>
                      {`${sec.name} · ${nightlyShort(sec.priceWeekday)} ${isSecBooked ? '⛔ محجوز' : '✓'}`}
                    </option>
                  );
                })}
              </select>
            </Field>

            {/* دمج عقارين أو أكثر */}
            {isMerged && mergeType === 'linked_properties' && linkedPropIds.length > 0 && (
              <>
                {isMergedLinkedConflict ? (
                  <div className="kt-err" role="alert" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
                      <span>الاستراحات المدمجة غير متاحة معاً</span>
                    </span>
                    {conflictingLinkedBookings.map((cb) => {
                      const pName =
                        cb.propertyName || properties.find((p) => p.id === cb.propertyId)?.name || 'استراحة مدمجة';
                      return (
                        <span key={cb.id} className="text-[13px] font-semibold">
                          {pName} · {cb.customerName} · <bdi dir="ltr">{cb.checkInDate} ← {cb.checkOutDate}</bdi>
                        </span>
                      );
                    })}
                  </div>
                ) : inDate && outDate ? (
                  <div className="kt-ok">
                    <span className="text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                      ✓ كل الاستراحات المدمجة متاحة
                    </span>
                    <span className="kt-note">{linkedProps.map((p) => p.name).join(' + ')}</span>
                    <Infos cols={2}>
                      <Info label="سعر الدمج" value={`${n(rawTotal)} ر.س`} />
                      <Info label="المدة" value={nightsText(nights)} />
                    </Infos>
                  </div>
                ) : null}
              </>
            )}

            {/* عقار مقفل لصالح عقار مدمج محجوز */}
            {!isMerged && isParentConflict && (
              <div className="kt-err" role="alert" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <span className="flex items-center gap-2">
                  <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
                  <span>مقفل لصالح عقار مدمج</span>
                </span>
                {conflictingParentBookings.map((pb) => (
                  <span key={pb.id} className="text-[13px] font-semibold">
                    {pb.propertyName} · {pb.customerName}
                  </span>
                ))}
              </div>
            )}

            {/* حجز الكامل لعقار متعدد الأقسام */}
            {isMultiSection && selectedSectionId === 'all' && (
              <>
                {isFullBooked ? (
                  <div className="kt-err" role="alert" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
                      <span>الكامل يتطلب توفر كل الأقسام</span>
                    </span>
                    <span className="text-[13px] font-semibold">
                      {multiSections
                        .filter((sec) => bookedSectionIds.has(sec.id))
                        .map((sec) => sec.name)
                        .join(' و ') || 'أحد الأقسام'}{' '}
                      محجوز، احجز الأقسام المتاحة منفصلة
                    </span>
                  </div>
                ) : inDate && outDate ? (
                  <div className="kt-ok">
                    <span className="text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                      ✓ كل الأقسام متاحة لهذا التاريخ
                    </span>
                    <span className="kt-note">مجموع أسعار الأقسام: {nightlyShort(combinedWeekdayPrice)} لليلة</span>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}

        {/* ── بيانات النزيل والتواريخ ── */}
        <div className="kt-fields">
          <Field label="اسم النزيل" className="kt-wide">
            <input
              type="text"
              required
              className="kt-input"
              placeholder="الاسم الثلاثي"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
            />
          </Field>
          <Field label="الجوال">
            <input
              type="tel"
              required
              dir="ltr"
              className="kt-input kt-num"
              placeholder="05xxxxxxxx"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
            />
          </Field>
          <Field label="رقم الهوية" hint="اختياري">
            <input
              type="text"
              dir="ltr"
              className="kt-input kt-num"
              placeholder="10xxxxxxxx"
              value={custNationalId}
              onChange={(e) => setCustNationalId(e.target.value)}
            />
          </Field>
          <Field label="لوحة السيارة" hint="اختياري">
            <input
              type="text"
              className="kt-input"
              placeholder="د ب ي 8972"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
            />
          </Field>
          <Field label="عدد الأشخاص">
            <input
              type="number"
              min={1}
              className="kt-input kt-num"
              placeholder="30"
              value={guestsCountInput}
              onChange={(e) => setGuestsCountInput(e.target.value)}
            />
          </Field>
          <Field label="الدخول">
            <input
              type="date"
              required
              dir="ltr"
              min={todayStr}
              className="kt-input kt-num"
              value={inDate}
              onChange={(e) => {
                const val = e.target.value;
                if (val < todayStr) return;
                setInDate(val);
                if (outDate <= val) {
                  const nextD = new Date(val);
                  nextD.setDate(nextD.getDate() + 1);
                  setOutDate(nextD.toISOString().split('T')[0]);
                }
              }}
            />
          </Field>
          <Field label="الخروج">
            <input
              type="date"
              required
              dir="ltr"
              min={inDate || todayStr}
              className="kt-input kt-num"
              value={outDate}
              onChange={(e) => setOutDate(e.target.value)}
            />
          </Field>
        </div>

        {/* ── المسوق ── */}
        {isAdmin ? (
          <Field label="المسوق">
            <select className="kt-input" value={assignedMarketerId} onChange={(e) => setAssignedMarketerId(e.target.value)}>
              <option value="">حجز مباشر · بدون عمولة</option>
              {marketers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.code}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Infos cols={1}>
            <Info label="المسوق المسجل" value={marketers.find((m) => m.id === currentMarketerId)?.name || '—'} />
          </Infos>
        )}

        {/* ── نوع الحجز ── */}
        <div className="kt-field">
          <span className="kt-field-h">
            <span>نوع الحجز</span>
            <em>العمولة تُحتسب تلقائياً</em>
          </span>
          <Seg
            compact
            label="نوع الحجز"
            value={commType}
            onChange={(v) => {
              setCommType(v);
              if (v === 'admin' && customNightlyPrice === null) setCustomNightlyPrice(baseNightly);
            }}
            items={[
              { id: 'full' as const, label: 'كلي 7%' },
              { id: 'partial' as const, label: 'جزئي 5%' },
              { id: 'special' as const, label: 'خاص 0%' },
              ...(isAdmin ? [{ id: 'admin' as const, label: 'الإدارة' }] : []),
            ]}
          />
        </div>

        {commType === 'special' && (
          <Infos cols={2}>
            <Info hi label="العمولة" value="معفى 0%" />
            <Info label="الرسوم الإدارية" value={`${n(specialAdminFeeTotal)} ر.س`} />
          </Infos>
        )}

        {commType === 'admin' && (
          <Field label="سعر الليلة (ر.س)" hint="مستقل عن التقويم">
            <input
              type="number"
              min="0"
              className="kt-input kt-num"
              value={customNightlyPrice ?? baseNightly}
              onChange={(e) => setCustomNightlyPrice(Math.max(0, Number(e.target.value)))}
            />
          </Field>
        )}

        {/* ── خدمة المنسقة (حمران / الما / نايا) ── */}
        {showCoordinators && (
          <div className="kt-sub">
            <Field label="خدمة المنسقة" hint="اختياري">
              <select
                className="kt-input"
                value={selectedCoordPkg}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCoordPkg(val);
                  const matchedSvc = activeCoordServices.find((s) => s.id === val);
                  if (matchedSvc?.coordinatorId) {
                    setSelectedCoordId(matchedSvc.coordinatorId);
                  }
                }}
              >
                <option value="none">بدون خدمة</option>
                {activeCoordServices.length > 0 ? (
                  activeCoordServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.title} · {nightlyShort(svc.price)}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="باقة كوشة وضيافة ملكية VIP (1,500 ر.س)">كوشة وضيافة VIP · 1,500 ر.س</option>
                    <option value="باقة تزيين مسبح وبالونات (1,200 ر.س)">تزيين مسبح وبالونات · 1,200 ر.س</option>
                    <option value="باقة استقبال عرسان خاصة (950 ر.س)">استقبال عرسان · 950 ر.س</option>
                    <option value="باقة ضيافة نجدية وقهوة وشاي (800 ر.س)">ضيافة نجدية · 800 ر.س</option>
                  </>
                )}
              </select>
            </Field>
            {selectedCoordPkg !== 'none' && (
              <Field label="المنسقة">
                <select className="kt-input" value={selectedCoordId} onChange={(e) => setSelectedCoordId(e.target.value)}>
                  {coordinators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.specialty.slice(0, 22)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {/* ── العربون والملاحظات والإيصال ── */}
        <Field label="العربون (ر.س)">
          <input
            type="number"
            min={0}
            step={50}
            className="kt-input kt-num"
            value={deposit}
            onChange={(e) => setDeposit(Number(e.target.value))}
            disabled={!canEditDeposit && !isAdmin}
          />
        </Field>

        <Field label="ملاحظات" hint="اختياري">
          <textarea
            rows={2}
            className="kt-input kt-ta"
            placeholder="مثال: عائلة، طلبوا سرير إضافي"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="kt-field">
          <span className="kt-field-h">
            <span>إيصال العربون</span>
            <em>اختياري</em>
          </span>
          <FilePick
            name={depositReceiptFile?.name}
            placeholder="اختيار صورة أو PDF"
            error={receiptUploadError}
            onClear={() => setDepositReceiptFile(null)}
            onPick={async (file) => {
              setReceiptUploadError(null);
              if (!file) return;
              try {
                const prepared = await prepareReceiptFileForAppStorage(file);
                setDepositReceiptFile(prepared);
              } catch (err: any) {
                setReceiptUploadError(err?.message || 'تعذر تجهيز ملف الإيصال.');
              }
            }}
          />
        </div>

        {/* ── الملخص ── */}
        <div className="kt-sub">
          <p className="kt-sub-t">ملخص الحجز</p>
          <Infos cols={2}>
            <Info label="المدة" value={nightsText(nights)} />
            <Info label="سعر الليلة" value={`${n(baseNightly)} ر.س`} />
            {coordinatorServicePrice > 0 && (
              <Info label="خدمة المنسقة" value={`+ ${n(coordinatorServicePrice)} ر.س`} />
            )}
            <Info hi label="الإجمالي" value={`${n(bookingGrandTotal)} ر.س`} />
            <Info
              wide={coordinatorServicePrice > 0}
              label={`عمولة المسوق ${commissionRate}%`}
              value={`${n(commissionAmount)} ر.س`}
            />
          </Infos>
        </div>

        {errorMsg && (
          <div className="kt-err" role="alert" style={{ alignItems: 'flex-start' }}>
            <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </Sheet>
  );
};
