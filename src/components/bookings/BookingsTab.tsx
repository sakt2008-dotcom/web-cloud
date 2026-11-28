import { findEstateParent, getEstateOptions, isLinkedEstate, getEstateParts, partKey, describeEstateParts, getPartsNightPrice, bookingOccupiesPart, estateBookingBlocksUnit } from '../../lib/propertyUtils';
import { EstateBookingBuilder } from '../shared/EstateBookingBuilder';
import { EstateOptionsBar } from '../shared/EstateOptionsBar';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Download,
  Phone,
  Send,
  MapPin,
  Film,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  X,
  Copy,
  Check,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Lock,
  Layers,
  Share2,
  Loader2,
  Percent,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Booking } from '../../types';
import { SmartVideoPlayer } from '../video/VideoUploader';
import { isExternalVideoLink, shareOrDownloadVideoFile } from '../../lib/mediaStorage';
import { isPdfReceiptUrl, prepareReceiptFileForAppStorage } from '../../lib/bookingReceipts';
import { PrintableContractModal } from '../modals/PrintableContractModal';
import { PropertySelect } from '../shared/PropertySelect';
import { Head, Seg, Infos, Info, Acts, Act, Choice, Field, Tool, Tile, Pill, Sheet } from '../ui/kit';
import type { Ico } from '../ui/kit';

/** أيقونة تحميل دوّارة (لأزرار kt-act) */
const SpinIcon: Ico = (props) => <Loader2 {...props} className="animate-spin" />;

export const BookingsTab: React.FC = () => {
  const {
    properties,
    selectedPropertyId,
    selectedProperty,
    setSelectedPropertyId,
    bookings,
    dateOverrides,
    setDateOverridesBulk,
    requestDeposit,
    confirmBookingWithReceipt,
    isAdmin,
    isRestrictedMarketer,
    canViewCalendar,
    currentMarketerId,
    nowTimestamp,
    canCreateContract,
    canEditDeposit,
    updateWaitingDepositAmount,
  } = useApp();

  const [commissionType, setCommissionType] = useState<'full' | 'partial'>('partial');
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return [`${y}-${m}-${d}`];
  });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('05');
  const [customerNationalId, setCustomerNationalId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [guestsCountInput, setGuestsCountInput] = useState(() =>
    selectedProperty.capacity ? String(selectedProperty.capacity) : ''
  );
  const [depositAmount, setDepositAmount] = useState<number>(selectedProperty.defaultDeposit || 250);

  // Edit deposit modal
  const [editDepositModalOpen, setEditDepositModalOpen] = useState(false);
  const [tempDepositValue, setTempDepositValue] = useState<number>(selectedProperty.defaultDeposit || 250);

  // Modals for Info / Photos / Location / Contract
  const [infoModalType, setInfoModalType] = useState<'info' | 'photos' | 'location' | 'contract' | null>(null);

  // Receipt upload
  const [receiptFile, setReceiptFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Message preview / sent modal
  const [sentMessageData, setSentMessageData] = useState<{
    title: string;
    text: string;
    whatsappUrl: string;
    phone: string;
  } | null>(null);

  // Contract confirmed popup
  const [confirmedContractData, setConfirmedContractData] = useState<{
    booking: Booking;
    contractText: string;
    whatsappUrl: string;
    bookingNumber: string;
  } | null>(null);

  const [calendarSize, setCalendarSize] = useState<'compact' | 'normal' | 'large'>('normal');
  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [actionToast, setActionToast] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [copiedSentMsg, setCopiedSentMsg] = useState(false);
  const [sharingVideoKey, setSharingVideoKey] = useState<string | null>(null);

  const showActionToast = (type: 'error' | 'success', text: string) => {
    setActionToast({ type, text });
    setTimeout(() => setActionToast(null), 3500);
  };

  const pendingSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingSectionRef.current) {
      setActiveSectionId(pendingSectionRef.current);
      pendingSectionRef.current = null;
    } else if (selectedProperty.sections && selectedProperty.sections.length > 0) {
      setActiveSectionId(selectedProperty.sections[0].id);
    } else {
      setActiveSectionId('all');
    }
  }, [selectedPropertyId, selectedProperty]);

  // العقار = دمج وحدتين أو أكثر: خيارات الحجز = كل وحدة، وكل قسم، وكامل الوحدة
  const mergedParent = useMemo(() => findEstateParent(selectedProperty, properties), [selectedProperty, properties]);
  const mergedOptions = useMemo(() => (mergedParent ? getEstateOptions(mergedParent, properties) : []), [mergedParent, properties]);

  const pickMergedOption = (o: { propertyId: string; sectionId: string }) => {
    pendingSectionRef.current = o.sectionId;
    if (o.propertyId === selectedPropertyId) {
      setActiveSectionId(o.sectionId);
      pendingSectionRef.current = null;
    } else {
      setSelectedPropertyId(o.propertyId);
    }
  };

  useEffect(() => {
    if (selectedProperty.defaultDeposit) {
      setDepositAmount(selectedProperty.defaultDeposit);
    }
    setGuestsCountInput(selectedProperty.capacity ? String(selectedProperty.capacity) : '');
  }, [selectedPropertyId, selectedProperty]);

  const activeSection = useMemo(() => {
    // «المزرعة» حاوية: اختيار الأجزاء من «احجز المزرعة» فقط، دون قسم مستقل
    if (isLinkedEstate(selectedProperty) || !selectedProperty.sections || selectedProperty.sections.length === 0 || activeSectionId === 'all') {
      return null;
    }
    return selectedProperty.sections.find((s) => s.id === activeSectionId) || null;
  }, [selectedProperty, activeSectionId]);

  const todayStr = useMemo(() => {
    const now = new Date(nowTimestamp);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [nowTimestamp]);

  const sectionsList = selectedProperty.sections || [];
  const isMultiSection = sectionsList.length >= 2;
  const isEstateSelf = isLinkedEstate(selectedProperty);
  const estateAllParts = useMemo(
    () => (isEstateSelf ? getEstateParts(selectedProperty, properties) : []),
    [isEstateSelf, selectedProperty, properties]
  );
  // الافتراضي: كل الأجزاء (الكوخ + الترف كاملاً)؛ يمكن إلغاء قسم أو وحدة
  const [selectedPartKeys, setSelectedPartKeys] = useState<string[] | null>(null);
  useEffect(() => {
    setSelectedPartKeys(null);
  }, [selectedPropertyId]);
  const selectedParts = useMemo(
    () => estateAllParts.filter((p) => selectedPartKeys === null || selectedPartKeys.includes(partKey(p))),
    [estateAllParts, selectedPartKeys]
  );
  const estatePartsLabel = isEstateSelf ? describeEstateParts(selectedParts, selectedProperty, properties) : '';
  const wholeNightPriceFor = (dk: string, isWk: boolean) =>
    isEstateSelf
      ? getPartsNightPrice(selectedParts, properties, dateOverrides, dk)
      : sectionsList.reduce(
          (sum, sec) =>
            sum + (dateOverrides[`${selectedPropertyId}_${sec.id}_${dk}`]?.price ?? (isWk ? sec.priceWeekend : sec.priceWeekday)),
          0
        );

  const getDateBookingConflict = useMemo(() => {
    return (dateKey: string) => {
      const isMerged = selectedProperty.isMergedProperty || selectedProperty.mergedConfig?.isMerged;
      const mergeType = selectedProperty.mergedConfig?.mergeType;
      const linkedIds = selectedProperty.mergedConfig?.linkedPropertyIds || selectedProperty.mergedPropertyIds || [];

      // عقار مدمج: التاريخ محجوز إذا شغل أي جزء من الأجزاء المختارة (الكوخ، قسم من الترف …)
      if (isEstateSelf) {
        const hit = bookings.find((b) => {
          if (b.status === 'cancelled' || (b.isSpecialBooking && !b.isSupervisorBooking)) return false;
          if (!(dateKey >= b.checkInDate && dateKey < b.checkOutDate)) return false;
          return selectedParts.some((part) => bookingOccupiesPart(b, part, selectedProperty));
        });
        if (hit) {
          const hitProp = properties.find((p) => p.id === hit.propertyId);
          const name = hit.propertyId === selectedPropertyId ? selectedProperty.name : hitProp?.name || 'جزء من العقار';
          return {
            isBooked: true,
            booking: hit,
            bookedPropertyName: name,
            bookingSource: (hit.propertyId === selectedPropertyId ? 'direct' : 'linked_constituent') as 'direct' | 'linked_constituent',
            reasonText: `محجوز: ${hit.propertyName}`,
          };
        }
        return { isBooked: false, booking: undefined, bookedPropertyName: '', bookingSource: 'direct' as const, reasonText: '' };
      }

      // 1. Direct booking check on selected property (Supervisor & standard bookings lock calendar dates)
      const directBooking = bookings.find((b) => {
        if (b.propertyId !== selectedPropertyId || b.status === 'cancelled' || (b.isSpecialBooking && !b.isSupervisorBooking)) return false;
        if (!(dateKey >= b.checkInDate && dateKey < b.checkOutDate)) return false;

        if ((selectedProperty.sections?.length || 0) >= 2) {
          if (!activeSection) {
            // الكامل يتطلب خلوّ كل الأقسام
            return true;
          }
          return !b.sectionId || b.sectionId === 'all' || b.sectionId === activeSection.id;
        }

        return !activeSection || !b.sectionId || b.sectionId === activeSection.id;
      });

      if (directBooking) {
        let name = selectedProperty.name;
        let source: 'direct' | 'internal_unit' = 'direct';
        let reason = `محجوز مباشرة في "${selectedProperty.name}"`;
        if (directBooking.sectionId && directBooking.sectionId !== 'all') {
          const sec = selectedProperty.sections?.find((s) => s.id === directBooking.sectionId);
          if (sec) {
            name = `${selectedProperty.name} (${sec.name})`;
            source = 'internal_unit';
            reason = `محجوز في قسم "${sec.name}"`;
          }
        }
        return {
          isBooked: true,
          booking: directBooking,
          bookedPropertyName: name,
          bookingSource: source,
          reasonText: reason,
        };
      }

      // 2. If this property is a merger of linked properties, check if ANY linked property is booked on this date!
      if (isMerged && mergeType === 'linked_properties' && linkedIds.length > 0) {
        const linkedBooking = bookings.find((b) => {
          if (b.status === 'cancelled' || (b.isSpecialBooking && !b.isSupervisorBooking)) return false;
          if (!linkedIds.includes(b.propertyId)) return false;
          return dateKey >= b.checkInDate && dateKey < b.checkOutDate;
        });
        if (linkedBooking) {
          const bookedProp = properties.find((p) => p.id === linkedBooking.propertyId);
          const name = bookedProp?.name || 'استراحة مرتبطة بالدمج';
          return {
            isBooked: true,
            booking: linkedBooking,
            bookedPropertyName: name,
            bookingSource: 'linked_constituent' as const,
            reasonText: `محجوز لدى استراحة "${name}" المشمولة في هذا الدمج`,
          };
        }
      }

      // 3. If this property is one of the linked properties inside a parent merger, check if ANY parent merger is booked!
      const parentMergers = properties.filter(
        (p) =>
          p.id !== selectedPropertyId &&
          p.isMergedProperty &&
          (p.mergedConfig?.linkedPropertyIds?.includes(selectedPropertyId) || p.mergedPropertyIds?.includes(selectedPropertyId))
      );
      if (parentMergers.length > 0) {
        const parentIds = parentMergers.map((p) => p.id);
        const parentBooking = bookings.find((b) => {
          if (b.status === 'cancelled' || (b.isSpecialBooking && !b.isSupervisorBooking)) return false;
          if (!parentIds.includes(b.propertyId)) return false;
          if (!estateBookingBlocksUnit(b, selectedPropertyId, activeSection ? activeSection.id : null)) return false;
          return dateKey >= b.checkInDate && dateKey < b.checkOutDate;
        });
        if (parentBooking) {
          const parentProp = properties.find((p) => p.id === parentBooking.propertyId);
          const name = parentProp?.name || 'العقار المدمج الرئيسي';
          return {
            isBooked: true,
            booking: parentBooking,
            bookedPropertyName: name,
            bookingSource: 'parent_merger' as const,
            reasonText: `محجوز لدى العقار المدمج "${name}" الذي يحتوي على هذه الاستراحة`,
          };
        }
      }

      return {
        isBooked: false,
        booking: undefined,
        bookedPropertyName: '',
        bookingSource: 'direct' as const,
        reasonText: '',
      };
    };
  }, [bookings, selectedPropertyId, selectedProperty, activeSection, properties, isEstateSelf, selectedParts]);

  const sortedDates = useMemo(() => [...selectedDates].sort(), [selectedDates]);

  // سعر البطاقات يعكس سعر التقويم لليوم المحدد (أو اليوم الحالي)، لا السعر الأساسي المخزن فقط
  const cardRefDate = sortedDates[0] || todayStr;
  const cardRefIsWk = [4, 5].includes(new Date(`${cardRefDate}T00:00:00`).getDay());
  const cardRefLabel = `ليلة ${cardRefDate.slice(5)}`;
  const cardSectionPrice = (sec: { id: string; priceWeekday: number; priceWeekend: number }) =>
    dateOverrides[`${selectedPropertyId}_${sec.id}_${cardRefDate}`]?.price ?? (cardRefIsWk ? sec.priceWeekend : sec.priceWeekday);

  const checkInDate = sortedDates[0] || todayStr;
  const lastSelectedDate = sortedDates[sortedDates.length - 1] || checkInDate;

  const checkOutDate = useMemo(() => {
    const d = new Date(lastSelectedDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [lastSelectedDate]);

  const nightsCount = Math.max(1, selectedDates.length);

  const totalPrice = useMemo(() => {
    let sum = 0;
    sortedDates.forEach((d) => {
      const isWk = [4, 5].includes(new Date(`${d}T00:00:00`).getDay());
      // الكامل (وحدة متعددة الأقسام أو عقار مدمج): السعر من الأجزاء المختارة دائماً
      if (!activeSection && (isMultiSection || isEstateSelf)) {
        sum += wholeNightPriceFor(d, isWk);
        return;
      }
      const unitKey = activeSection
        ? `${selectedPropertyId}_${activeSection.id}_${d}`
        : `${selectedPropertyId}_${d}`;
      const ov = activeSection ? dateOverrides[unitKey] : dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${d}`];
      if (ov?.price !== undefined) {
        sum += ov.price;
      } else if (activeSection) {
        sum += isWk ? activeSection.priceWeekend : activeSection.priceWeekday;
      } else {
        sum += isWk ? selectedProperty.basePriceWeekend : selectedProperty.basePriceWeekday;
      }
    });
    return sum;
  }, [sortedDates, dateOverrides, selectedPropertyId, selectedProperty, activeSection, isMultiSection, isEstateSelf, selectedParts, properties]);

  const remainingAmount = Math.max(0, totalPrice - depositAmount);
  const insuranceAmount = selectedProperty.insuranceAmount || 300;

  // Waiting deposit hold on checkInDate
  const currentUnitKey = activeSection
    ? `${selectedPropertyId}_${activeSection.id}_${checkInDate}`
    : `${selectedPropertyId}_${checkInDate}`;
  const currentOverride = dateOverrides[currentUnitKey] || dateOverrides[`${selectedPropertyId}_${checkInDate}`];
  const isAwaitingDeposit =
    currentOverride?.status === 'waiting_deposit' &&
    !!currentOverride.waitingDepositExpiresAt &&
    currentOverride.waitingDepositExpiresAt > nowTimestamp;

  const depositSecondsLeft =
    isAwaitingDeposit && currentOverride?.waitingDepositExpiresAt
      ? Math.max(0, Math.floor((currentOverride.waitingDepositExpiresAt - nowTimestamp) / 1000))
      : 0;

  const isPhoneValid =
    customerPhone.trim() !== '' &&
    customerPhone.trim() !== '05' &&
    customerPhone.trim().length >= 9;

  const commissionPercent =
    isAwaitingDeposit && currentOverride?.waitingCommissionRate
      ? currentOverride.waitingCommissionRate
      : commissionType === 'full'
      ? 7
      : 5;

  const marketerCommission = Math.round(totalPrice * (commissionPercent / 100));

  // حساب الرسوم الإدارية الإجمالية للأيام المحددة
  const totalAdminFee = useMemo(() => {
    return sortedDates.reduce((sum, d) => {
      const unitKey = activeSection
        ? `${selectedPropertyId}_${activeSection.id}_${d}`
        : `${selectedPropertyId}_${d}`;
      const ov = dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${d}`];
      if (ov?.adminFee !== undefined) return sum + ov.adminFee;
      const dayOfWeek = new Date(d).getDay();
      const isWknd = dayOfWeek === 4 || dayOfWeek === 5;
      const defaultRate = isWknd
        ? (selectedProperty.administrativeFees?.weekend ?? 150)
        : (selectedProperty.administrativeFees?.weekday ?? 100);
      return sum + defaultRate;
    }, 0);
  }, [sortedDates, activeSection, selectedPropertyId, selectedProperty, dateOverrides]);

  // صافي ربح العقار = السعر الكلي بالتقويم مخصوم منه عمولة المسوق ثم الرسوم الإدارية
  const propertyNetPayout = Math.max(0, totalPrice - marketerCommission - totalAdminFee);

  const monthsAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const daysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  const daysMatrix = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const items = [];

    for (let i = 0; i < firstDay; i++) {
      items.push(null);
    }

    for (let d = 1; d <= daysCount; d++) {
      const monthPadded = String(month + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      const dateKey = `${year}-${monthPadded}-${dayPadded}`;
      const dayDate = new Date(year, month, d);
      const isWk = dayDate.getDay() === 4 || dayDate.getDay() === 5;
      const unitKey = activeSection
        ? `${selectedPropertyId}_${activeSection.id}_${dateKey}`
        : `${selectedPropertyId}_${dateKey}`;
      const ov = dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${dateKey}`];

      const basePrice = activeSection
        ? (isWk ? activeSection.priceWeekend : activeSection.priceWeekday)
        : (isWk ? selectedProperty.basePriceWeekend : selectedProperty.basePriceWeekday);

      const price = !activeSection && (isMultiSection || isEstateSelf)
        ? wholeNightPriceFor(dateKey, isWk)
        : activeSection
        ? (dateOverrides[unitKey]?.price ?? basePrice)
        : (ov?.price !== undefined ? ov.price : basePrice);

      const alTarafSectionBlocked =
        !activeSection &&
        isMultiSection &&
        sectionsList.some((sec) => dateOverrides[`${selectedPropertyId}_${sec.id}_${dateKey}`]?.status === 'blocked');

      const conflict = getDateBookingConflict(dateKey);
      const isPast = dateKey < todayStr;
      const isToday = dateKey === todayStr;

      let status: 'available' | 'booked' | 'blocked' | 'waiting_deposit' = 'available';
      if (isPast) {
        status = 'blocked';
      } else if (!selectedProperty.isPublished || (activeSection && activeSection.isAvailable === false)) {
        status = 'blocked';
      } else if (conflict.isBooked) {
        status = 'booked';
      } else if (ov?.status === 'waiting_deposit') {
        status = 'waiting_deposit';
      } else if (ov?.status === 'blocked' || alTarafSectionBlocked) {
        status = 'blocked';
      }

      let depositRemainingSeconds = 0;
      if (ov?.status === 'waiting_deposit' && ov.waitingDepositExpiresAt) {
        depositRemainingSeconds = Math.max(0, Math.floor((ov.waitingDepositExpiresAt - nowTimestamp) / 1000));
      }

      items.push({
        dayNum: d,
        dateKey,
        price,
        status,
        booking: conflict.booking,
        bookedPropertyName: conflict.bookedPropertyName,
        bookingSource: conflict.bookingSource,
        bookingReasonText: conflict.reasonText,
        depositRemainingSeconds,
        override: ov,
        isPast,
        isToday,
      });
    }

    return items;
  }, [year, month, selectedPropertyId, selectedProperty, activeSection, dateOverrides, nowTimestamp, todayStr, getDateBookingConflict, selectedParts, isEstateSelf, isMultiSection, properties]);

  const handleDateClick = (dateKey: string) => {
    if (dateKey < todayStr) return;
    const conflict = getDateBookingConflict(dateKey);
    if (conflict.isBooked && !isAdmin && !canViewCalendar) {
      showActionToast('error', `هذا اليوم محجوز مسبقاً (${conflict.reasonText})`);
      return;
    }

    if (selectedDates.includes(dateKey)) {
      if (selectedDates.length > 1) {
        setSelectedDates(selectedDates.filter((d) => d !== dateKey));
      }
    } else {
      setSelectedDates([...selectedDates, dateKey].sort());
    }
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const openWhatsAppMessageModal = (text: string, title = 'إرسال عبر واتساب') => {
    const raw = customerPhone.trim();
    if (!raw || raw === '05' || raw.length < 9) {
      const url = `https://wa.me/966?text=${encodeURIComponent(text)}`;
      setSentMessageData({ title, text, whatsappUrl: url, phone: raw || '05' });
      return;
    }
    const clean = raw.replace(/\D/g, '').replace(/^0/, '966');
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    setSentMessageData({ title, text, whatsappUrl: url, phone: raw });
  };

  // Quick WhatsApp Info
  const sendQuickInfo = () => {
    const msg = `مرحباً بك أخي الكريم ${customerName || ''}،
يسرنا تزويدكم بتفاصيل ومواصفات استراحة (${selectedProperty.name}):

🏕️ *المواصفات:*
• ${selectedProperty.subtitle}
• السعة: ${selectedProperty.capacity} فرد
• غرف النوم: ${selectedProperty.bedrooms} | دورات المياه: ${selectedProperty.bathrooms}
• المساحة: ${selectedProperty.areaM2} م² | المسبح: ${selectedProperty.poolType}
• وقت الدخول: ${selectedProperty.checkInTimeText} | وقت الخروج: ${selectedProperty.checkOutTimeText}
• سعر الليلة: ${selectedProperty.basePriceWeekday} ر.س (وسط الأسبوع) / ${selectedProperty.basePriceWeekend} ر.س (الويكند)
• التأمين المسترد: ${insuranceAmount} ريال

نتشرف بخدمتكم لحجز إقامتكم السعيدة!`;
    openWhatsAppMessageModal(msg);
  };

  const propertyVideos = useMemo(() => {
    const seen = new Set<string>();
    const list: { title: string; url: string }[] = [];
    (selectedProperty.videoItems || []).forEach((item, idx) => {
      const cleanUrl = (item?.url || '').trim();
      if (cleanUrl && !seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        list.push({
          title: item.title || `فيديو ${selectedProperty.name} ${idx + 1}`,
          url: cleanUrl,
        });
      }
    });
    (selectedProperty.videoUrls || []).forEach((rawUrl, idx) => {
      const cleanUrl = (rawUrl || '').trim();
      if (cleanUrl && !seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        list.push({
          title: `فيديو ${selectedProperty.name} #${idx + 1}`,
          url: cleanUrl,
        });
      }
    });
    return list;
  }, [selectedProperty]);

  const handleShareVideoAsFile = async (videoUrl: string, title?: string, key = 'default') => {
    if (sharingVideoKey) return;
    setSharingVideoKey(key);
    try {
      const result = await shareOrDownloadVideoFile(videoUrl, title || `فيديو_${selectedProperty.name}`);
      if (result.status === 'external_link') {
        showActionToast('error', result.message);
      } else if (result.status === 'shared' || result.status === 'downloaded') {
        showActionToast('success', result.message);
      }
    } catch (err: any) {
      showActionToast('error', err?.message || 'تعذر تجهيز ملف الفيديو للمشاركة');
    } finally {
      setSharingVideoKey(null);
    }
  };

  // Quick WhatsApp Photos & Video
  const sendQuickPhotos = () => {
    const imageLines = (selectedProperty.images || [])
      .map(
        (img, idx) =>
          `• ${
            img.includes('youtube.com') || img.includes('youtu.be') || img.includes('.mp4')
              ? '🎥 فيديو'
              : '📸 صورة'
          } ${idx + 1}: ${img}`
      );
    const shareableVideoLines = propertyVideos
      .filter((v) => !v.url.startsWith('idb://'))
      .map((v, idx) => `• 🎥 ${v.title || `فيديو ${idx + 1}`}: ${v.url}`);
    const mediaLinks = [...imageLines, ...shareableVideoLines].length
      ? [...imageLines, ...shareableVideoLines].join('\n')
      : `• رابط الألبوم: ${selectedProperty.coverImage}`;

    const msg = `أهلاً بك أخي الكريم ${customerName || ''}،
مرفق لكم ألبوم الصور والفيديو لاستراحة (${selectedProperty.name}):

📸 *روابط الصور والتغطيات:*
${mediaLinks}

نتمنى أن تنال إعجابكم ويسعدنا استقبال استفساراتكم! 🏕️`;
    openWhatsAppMessageModal(msg, 'إرسال الوسائط عبر واتساب');
  };

  // Quick WhatsApp Location
  const sendQuickLocation = () => {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${selectedProperty.name} ${selectedProperty.location}`
    )}`;
    const msg = `مرحباً بك أخي الكريم ${customerName || ''}،
موقع ولوكيشن استراحة (${selectedProperty.name}):

📍 *العنوان:* ${selectedProperty.location}
🗺️ *رابط خرائط Google:*
${mapUrl}

نتمنى لكم رحلة وصول ميسرة وممتعة!`;
    openWhatsAppMessageModal(msg);
  };

  // Quick WhatsApp Full Property Data
  const sendFullPropertyData = () => {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${selectedProperty.name} ${selectedProperty.location}`
    )}`;
    const msg = `مرحباً بك أخي الكريم ${customerName || ''}،
تفاصيل استراحة (${selectedProperty.name}) الكاملة:

🏕️ *معلومات المكان:* ${selectedProperty.subtitle}
• السعة: ${selectedProperty.capacity} فرد | غرف النوم: ${selectedProperty.bedrooms}
• المسبح: ${selectedProperty.poolType}
• وقت الدخول: ${selectedProperty.checkInTimeText} | وقت الخروج: ${selectedProperty.checkOutTimeText}

📍 *اللوكيشن على خرائط Google:*
${mapUrl}

📸 *ألبوم الصور:* ${selectedProperty.coverImage}

💰 *الأسعار:* ${totalPrice} ر.س (${nightsCount} ليالي) | التأمين: ${insuranceAmount} ر.س
يسعدنا تأكيد حجزكم فور تحويل العربون!`;
    openWhatsAppMessageModal(msg);
  };

  // 15-Minute Deposit Request
  const handleRequestDeposit = () => {
    if (!customerPhone.trim() || customerPhone === '05' || customerPhone.length < 9) {
      showActionToast('error', 'فضلاً أدخل رقم جوال العميل بصيغة صحيحة (مثال: 0551234567)');
      return;
    }

    const { whatsappUrl, message } = requestDeposit({
      propertyId: selectedPropertyId,
      dates: selectedDates,
      customerName: customerName.trim() || 'عميل كريم',
      customerPhone,
      depositAmount,
      totalPrice,
      nightsCount,
      marketerId: currentMarketerId,
      commissionRatePercent: commissionPercent,
      sectionName: isEstateSelf ? estatePartsLabel : activeSection?.name,
      ...(isEstateSelf ? { estateParts: selectedParts } : {}),
    });

    setSentMessageData({
      title: 'طلب العربون (مهلة 15 دقيقة) عبر واتساب',
      text: message,
      whatsappUrl,
      phone: customerPhone,
    });
  };

  // Receipt image / PDF processing
  const handleReceiptChange = async (file?: File) => {
    setReceiptError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setReceiptFile(prepared);
    } catch (err: any) {
      setReceiptError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const isConfirmReady =
    selectedDates.length > 0 &&
    customerName.trim() !== '' &&
    isPhoneValid &&
    depositAmount > 0 &&
    !!receiptFile;

  // Confirm booking with receipt
  const handleConfirmWithReceipt = () => {
    if (!isConfirmReady || !receiptFile) return;

    const { booking, whatsappContractUrl, contractText } = confirmBookingWithReceipt({
      propertyId: selectedPropertyId,
      dates: selectedDates,
      customerName: customerName.trim(),
      customerPhone,
      depositPaid: depositAmount,
      totalPrice,
      remainingAmount,
      insuranceAmount,
      receiptFileName: receiptFile.name,
      receiptDataUrl: receiptFile.dataUrl,
      marketerId: currentMarketerId,
      commissionRatePercent: commissionPercent,
      sectionId: activeSection?.id,
      sectionName: isEstateSelf ? estatePartsLabel : activeSection?.name,
      ...(isEstateSelf ? { estateParts: selectedParts } : {}),
      customerNationalId: customerNationalId.trim() || undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      guestsCount: guestsCountInput.trim() && Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
    });

    setConfirmedContractData({
      booking,
      contractText,
      whatsappUrl: whatsappContractUrl,
      bookingNumber: booking.bookingNumber,
    });

    setReceiptFile(null);
  };

  // Instant booking & contract creation
  const handleInstantBooking = () => {
    if (!isPhoneValid) {
      showActionToast('error', 'فضلاً أدخل رقم جوال العميل لإرسال العقد عبر واتساب');
      return;
    }

    const { booking, whatsappContractUrl, contractText } = confirmBookingWithReceipt({
      propertyId: selectedPropertyId,
      dates: selectedDates,
      customerName: customerName.trim() || 'الضيف الكريم',
      customerPhone,
      depositPaid: depositAmount,
      totalPrice,
      remainingAmount,
      insuranceAmount,
      receiptFileName: 'حجز_فوري_معتمد.pdf',
      marketerId: currentMarketerId,
      commissionRatePercent: commissionPercent,
      sectionId: activeSection?.id,
      sectionName: isEstateSelf ? estatePartsLabel : activeSection?.name,
      ...(isEstateSelf ? { estateParts: selectedParts } : {}),
      customerNationalId: customerNationalId.trim() || undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      guestsCount: guestsCountInput.trim() && Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
    });

    setConfirmedContractData({
      booking,
      contractText,
      whatsappUrl: whatsappContractUrl,
      bookingNumber: booking.bookingNumber,
    });
  };

  const handleBlockSelectedDays = () => {
    if (selectedDates.length === 0) return;
    setDateOverridesBulk(selectedPropertyId, selectedDates, { status: 'blocked' });
    showActionToast('success', `تم إغلاق الأيام المحددة (${selectedDates.length} يوم) لعقار ${selectedProperty.name}`);
  };

  const handleDownloadCsv = () => {
    const csvContent = `الاستراحة,${selectedProperty.name}\nتاريخ الدخول,${checkInDate}\nتاريخ الخروج,${checkOutDate}\nالليالي,${nightsCount}\nالسعر,${totalPrice}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `حجز_${selectedProperty.name}.csv`;
    link.click();
  };

  return (
    <div className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-1 space-y-4 font-['Tajawal',sans-serif]">
      {actionToast && (
        <div className="kt-toast" role="status" aria-live="polite">
          <div className={actionToast.type === 'error' ? 'is-err' : 'is-ok'}>
            {actionToast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            <span>{actionToast.text}</span>
          </div>
        </div>
      )}
      {/* العقار + تنزيل ملخص الحجز */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0">
          <PropertySelect properties={properties} value={selectedPropertyId} onChange={setSelectedPropertyId} />
        </div>
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="kt-sq lx-press"
          aria-label="تنزيل ملخص الحجز"
          title="تنزيل ملخص الحجز (CSV)"
        >
          <Download size={22} strokeWidth={1.8} />
        </button>
      </div>

      {isEstateSelf && (
        <EstateBookingBuilder
          estate={selectedProperty}
          units={(selectedProperty.mergedConfig?.linkedPropertyIds || selectedProperty.mergedPropertyIds || [])
            .map((id) => properties.find((x) => x.id === id))
            .filter(Boolean) as typeof properties}
          allParts={estateAllParts}
          selectedParts={selectedParts}
          onChange={setSelectedPartKeys}
          summary={estatePartsLabel}
          priceText={`ليلة ${cardRefDate.slice(5)}: ${wholeNightPriceFor(cardRefDate, cardRefIsWk)} ر.س`}
        />
      )}

      {/* اختيار القسم (للعقارات ذات الأقسام) */}
      {!isEstateSelf && selectedProperty.sections && selectedProperty.sections.length > 0 && (
        <section className="lux-card p-4 space-y-3">
          <Head title="اختر القسم" icon={Layers} count={selectedProperty.sections.length + 1} />
          <div className="kt-grid2">
            {selectedProperty.sections.map((sec) => (
              <Choice
                key={sec.id}
                title={sec.name}
                sub={`${cardRefLabel}: ${cardSectionPrice(sec)} · أساسي ${sec.priceWeekday}/${sec.priceWeekend}`}
                tag="مستقل"
                selected={activeSectionId === sec.id}
                onClick={() => setActiveSectionId(sec.id)}
              />
            ))}
            <Choice
              title={`كامل ${selectedProperty.name}`}
              sub={`${cardRefLabel}: ${
                isMultiSection || isEstateSelf
                  ? wholeNightPriceFor(cardRefDate, cardRefIsWk)
                  : cardRefIsWk
                  ? selectedProperty.basePriceWeekend
                  : selectedProperty.basePriceWeekday
              } · مجموع الأقسام`}
              tag="شامل"
              selected={activeSectionId === 'all'}
              onClick={() => setActiveSectionId('all')}
            />
          </div>
        </section>
      )}

      {/* بيانات العميل السريعة (ترتبط بكل روابط الواتساب) */}
      <section className="lux-card p-4 space-y-3">
        <Head title="بيانات العميل" icon={Phone} tone="jade" />
        <div className="kt-fields">
          <Field label="الاسم (اختياري)">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم العميل"
              dir="rtl"
              className="kt-input"
            />
          </Field>
          <Field label="جوال الواتساب">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              dir="ltr"
              className="kt-input font-mono text-left"
            />
          </Field>
        </div>
      </section>

      {/* أدوات الإرسال للعميل: 4 بلاطات متساوية */}
      <section className="lux-card p-4 space-y-3">
        <Head title="إرسال للعميل" icon={Send} tone="jade" />
        <div className="kt-g2">
          <Tool
            icon={MapPin}
            title="معلومات المكان"
            onOpen={() => setInfoModalType('info')}
            actionLabel="واتساب"
            actionIcon={Send}
            onAction={sendQuickInfo}
          />
          <Tool
            icon={Film}
            title="الفيديو والصور"
            onOpen={() => setInfoModalType('photos')}
            actionLabel="واتساب"
            actionIcon={Send}
            onAction={sendQuickPhotos}
          />
          <Tool
            icon={MapPin}
            title="اللوكيشن"
            tone="saph"
            onOpen={() => setInfoModalType('location')}
            actionLabel="واتساب"
            actionIcon={Send}
            onAction={sendQuickLocation}
          />
          <Tool
            icon={FileText}
            title="استعراض العقد"
            tone="ch"
            onOpen={() => setInfoModalType('contract')}
            actionLabel="إرسال PDF"
            actionIcon={Send}
            onAction={() => setInfoModalType('contract')}
          />
        </div>
        <Acts cols={2}>
          <Act
            tone="soft"
            icon={sharingVideoKey === 'card-video' ? SpinIcon : Share2}
            label={sharingVideoKey === 'card-video' ? 'جاري التجهيز…' : 'مشاركة الفيديو'}
            disabled={sharingVideoKey === 'card-video'}
            onClick={() => {
              if (propertyVideos.length === 0) {
                showActionToast('error', 'لا يوجد فيديو مرفوع لهذا العقار بعد (يمكنك رفعه من صفحة العقارات)');
                setInfoModalType('photos');
                return;
              }
              if (propertyVideos.length === 1) {
                void handleShareVideoAsFile(propertyVideos[0].url, propertyVideos[0].title, 'card-video');
              } else {
                setInfoModalType('photos');
              }
            }}
          />
          <Act tone="ink" icon={Sparkles} label="إرسال الكل" onClick={sendFullPropertyData} title="إرسال معلومات المكان والصور واللوكيشن كاملة للعميل (واتساب)" />
        </Acts>
      </section>

      {/* التقويم */}
      <section className="lux-card p-4 space-y-4">
        <Seg
          compact
          label="حجم التقويم"
          value={calendarSize}
          onChange={setCalendarSize}
          items={[
            { id: 'compact', label: 'مدمج' },
            { id: 'normal', label: 'قياسي' },
            { id: 'large', label: 'كبير' },
          ]}
        />

        <div className="kt-month">
          <button type="button" onClick={prevMonth} className="kt-nav lx-press" aria-label="الشهر السابق">
            <ChevronRight size={22} strokeWidth={1.8} />
          </button>
          <h3>
            {monthsAr[month]} {year}
          </h3>
          <button type="button" onClick={nextMonth} className="kt-nav lx-press" aria-label="الشهر التالي">
            <ChevronLeft size={22} strokeWidth={1.8} />
          </button>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {daysAr.map((d, idx) => (
            <span key={idx} className="text-xs font-bold text-purple-600/70 py-1 truncate">
              {d}
            </span>
          ))}
        </div>

        {/* Grid Days */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {daysMatrix.map((item, idx) => {
            const heightCls =
              calendarSize === 'compact' ? 'h-12 sm:h-14' : calendarSize === 'large' ? 'h-20 sm:h-24' : 'h-16 sm:h-18';

            if (!item) {
              return <div key={`empty-${idx}`} className={`${heightCls} rounded-2xl bg-[#FAF8FD]/50`} />;
            }

            const isSelected = selectedDates.includes(item.dateKey);
            let colorCls = 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]';
            let label = `${item.price}`;

            if (item.isPast) {
              colorCls = 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-55 cursor-not-allowed pointer-events-none';
              label = item.booking ? 'محجوز' : 'فائت';
            } else if (item.status === 'booked') {
              colorCls = 'bg-[#FDF2F8] border-[#FBCFE8] text-[#9D174D]';
              label = 'محجوز';
            } else if (item.status === 'waiting_deposit') {
              colorCls = 'bg-[#FEFCE8] border-[#FDE68A] text-[#854D0E]';
              const mins = Math.floor(item.depositRemainingSeconds / 60);
              const secs = item.depositRemainingSeconds % 60;
              label = `${mins}:${String(secs).padStart(2, '0')}`;
            } else if (item.status === 'blocked') {
              colorCls = 'bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239]';
              label = '--';
            }

            const tooltip = item.bookingReasonText
              ? item.bookingReasonText
              : item.status === 'booked'
              ? 'محجوز ومؤكد'
              : item.status === 'waiting_deposit'
              ? `بانتظار تحويل العربون (${item.depositRemainingSeconds} ثانية متبقية)`
              : item.status === 'blocked'
              ? 'مغلق للصيانة'
              : `متاح بسعر ${item.price} ريال`;

            return (
              <div
                key={item.dateKey}
                onClick={() => handleDateClick(item.dateKey)}
                title={tooltip}
                className={`${heightCls} rounded-2xl border flex flex-col items-center justify-between py-1.5 px-0.5 transition-all select-none ${colorCls} ${
                  item.isPast ? '' : 'cursor-pointer hover:scale-102'
                } ${
                  isSelected
                    ? 'ring-2 ring-[#7C3AED] ring-offset-1 bg-[#F5F3FF] border-[#7C3AED] font-black scale-102 shadow-xs'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between w-full px-1">
                  <span className={`font-bold ${calendarSize === 'large' ? 'text-base' : 'text-sm'}`}>
                    {item.dayNum}
                  </span>
                  {item.isToday && (
                    <span className="text-xs bg-purple-600 text-white px-1.5 leading-5 rounded-full font-bold">
                      اليوم
                    </span>
                  )}
                </div>
                <span className="font-mono leading-none truncate max-w-full px-0.5 text-xs font-bold">
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* دليل الألوان */}
        <div className="kt-legend">
          <div>
            <i style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }} />
            <span>متاح</span>
          </div>
          <div>
            <i style={{ background: '#FDF2F8', borderColor: '#FBCFE8' }} />
            <span>مؤكد</span>
          </div>
          <div>
            <i style={{ background: '#FEFCE8', borderColor: '#FDE68A' }} />
            <span>عربون</span>
          </div>
          <div>
            <i style={{ background: '#FFF1F2', borderColor: '#FECDD3' }} />
            <span>مغلق</span>
          </div>
          <div>
            <i style={{ background: '#F5F3FF', borderColor: '#7C3AED', borderWidth: 2 }} />
            <span>محدد</span>
          </div>
        </div>
      </section>

      {/* نوع الحجز لحساب عمولة الموظف */}
      <section className="lux-card p-4 space-y-3">
        <Head title="عمولة الموظف" icon={Percent} tone="ch" />
        <Seg
          compact
          label="نوع الحجز"
          disabled={isAwaitingDeposit}
          value={commissionPercent === 7 ? 'full' : 'partial'}
          onChange={setCommissionType}
          items={[
            { id: 'full', label: 'حجز كلي 7%' },
            { id: 'partial', label: 'حجز جزئي 5%' },
          ]}
        />
      </section>

      {/* الملخص المالي */}
      <section className="lux-card p-4 space-y-3">
        <Head title="الملخص المالي" icon={Wallet} tone="jade" />
        <Infos cols={2}>
          <Info label="تاريخ الدخول" value={checkInDate} ltr />
          <Info label="تاريخ الخروج" value={checkOutDate} ltr />
          <Info label="عدد الليالي" value={nightsCount} />
          <Info label="الإجمالي" value={`${totalPrice} ر.س`} />
        </Infos>
        {isRestrictedMarketer ? (
          <Infos cols={2}>
            <Info label="سعر الليلة" value={`${nightsCount > 0 ? Math.round(totalPrice / nightsCount) : totalPrice} ر.س`} />
            <Info hi label={`العمولة ${commissionPercent}%`} value={`${marketerCommission} ر.س`} />
          </Infos>
        ) : (
          <>
            <Infos cols={3}>
              <Info label={`العمولة ${commissionPercent}%`} value={`-${marketerCommission}`} />
              <Info label="الرسوم" value={`-${totalAdminFee}`} />
              <Info label="صافي المالك" value={`${propertyNetPayout}`} hi />
            </Infos>
            <p className="kt-note text-center">
              الصافي = {totalPrice} − {marketerCommission} (عمولة) − {totalAdminFee} (رسوم)
            </p>
          </>
        )}
      </section>

      {/* بانتظار العربون (مهلة 15 دقيقة) */}
      {isAwaitingDeposit && (
        <section className="kt-warn p-4 space-y-3">
          <Head
            title="بانتظار العربون"
            icon={Clock}
            tone="sand"
            action={
              <Pill tone="sand">
                {Math.floor(depositSecondsLeft / 60)}:{String(depositSecondsLeft % 60).padStart(2, '0')}
              </Pill>
            }
          />
          <Infos cols={3}>
            <Info label="العميل" value={currentOverride?.waitingCustomerName || customerName || 'قيد الانتظار'} />
            <Info label="الجوال" value={currentOverride?.waitingCustomerPhone || customerPhone} ltr />
            <Info label="العربون" value={`${currentOverride?.waitingDepositAmount || depositAmount} ر.س`} />
          </Infos>
          <Acts cols={canEditDeposit || isAdmin ? 2 : 1}>
            {(canEditDeposit || isAdmin) && (
              <Act
                tone="white"
                icon={Edit2}
                label="تعديل العربون"
                onClick={() => {
                  setTempDepositValue(currentOverride?.waitingDepositAmount || depositAmount);
                  setEditDepositModalOpen(true);
                }}
              />
            )}
            <Act tone="ink" icon={Sparkles} label="تأكيد الحجز" onClick={handleInstantBooking} />
          </Acts>
        </section>
      )}

      {/* حجز جديد */}
      <section className="lux-card p-4 space-y-4">
        <Head
          title="حجز جديد"
          icon={CalendarDays}
          action={
            <Act
              small
              tone="line"
              label="مسح"
              title="مسح التحديد"
              onClick={() => {
                setSelectedDates([]);
                setCustomerName('');
                setCustomerPhone('05');
              }}
            />
          }
        />

        <div className="kt-fields">
          <Field label="الاسم (اختياري)">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم العميل"
              dir="rtl"
              className="kt-input"
            />
          </Field>
          <Field label="رقم الجوال">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              dir="ltr"
              className="kt-input font-mono text-left"
            />
          </Field>
          <Field label="الهوية (اختياري)">
            <input
              type="text"
              value={customerNationalId}
              onChange={(e) => setCustomerNationalId(e.target.value)}
              placeholder="10xxxxxxxx"
              dir="ltr"
              className="kt-input font-mono text-left"
            />
          </Field>
          <Field label="لوحة السيارة">
            <input
              type="text"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="د ب ي 8972"
              className="kt-input"
            />
          </Field>
          <Field label="عدد الأشخاص">
            <input
              type="number"
              min={1}
              value={guestsCountInput}
              onChange={(e) => setGuestsCountInput(e.target.value)}
              placeholder="30"
              className="kt-input font-mono"
            />
          </Field>
          <Field label="العربون (ر.س)">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
              disabled={!canEditDeposit && !isAdmin}
              placeholder={String(selectedProperty.defaultDeposit || 250)}
              dir="rtl"
              className="kt-input font-mono font-bold disabled:opacity-60"
            />
          </Field>
        </div>

        <Infos cols={3}>
          <Info label="الإجمالي" value={`${totalPrice} ر.س`} />
          <Info label="عمولة الموظف" value={`${marketerCommission} ر.س`} />
          <Info label="الأيام المحددة" value={`${nightsCount} ليلة`} />
        </Infos>

        <Act
          tone="gold"
          icon={Clock}
          label="طلب العربون (مهلة 15 دقيقة)"
          disabled={!isPhoneValid}
          onClick={handleRequestDeposit}
        />

        {/* إيصال التحويل وتأكيد الحجز */}
        <div className="lx-well p-3 space-y-3">
          <label className="kt-file">
            <Paperclip size={20} strokeWidth={1.8} />
            <span>{receiptFile?.name || 'إرفاق إيصال التحويل'}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleReceiptChange(e.target.files?.[0])}
            />
          </label>

          {receiptError && <p className="text-[12px] text-rose-700 font-bold">{receiptError}</p>}

          {receiptFile && (
            <div className="relative">
              {isPdfReceiptUrl(receiptFile.dataUrl, receiptFile.name) ? (
                <div className="kt-row">
                  <Tile icon={FileText} tone="garn" size={40} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{receiptFile.name}</span>
                  </span>
                </div>
              ) : (
                <img
                  src={receiptFile.dataUrl}
                  alt="صورة الإيصال البنكي"
                  className="w-full max-h-48 object-contain rounded-2xl border border-slate-200 bg-white"
                />
              )}
              <button
                type="button"
                onClick={() => setReceiptFile(null)}
                aria-label="إزالة الإيصال"
                className="absolute top-1.5 left-1.5 w-9 h-9 rounded-full bg-white/95 border border-slate-200 text-rose-600 flex items-center justify-center cursor-pointer hover:bg-rose-50"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <Act tone="jade" icon={CheckCircle2} label="تأكيد الحجز" disabled={!isConfirmReady} onClick={handleConfirmWithReceipt} />
        </div>

        <Act tone="ink" icon={Sparkles} label="حجز فوري وإصدار العقد" onClick={handleInstantBooking} />
      </section>

      {/* معلومات / صور / لوكيشن */}
      {infoModalType && infoModalType !== 'contract' && (
        <Sheet
          title={
            infoModalType === 'info'
              ? `معلومات ${selectedProperty.name}`
              : infoModalType === 'photos'
              ? `صور وفيديو ${selectedProperty.name}`
              : `لوكيشن ${selectedProperty.name}`
          }
          icon={infoModalType === 'photos' ? Film : MapPin}
          onClose={() => setInfoModalType(null)}
          footer={
            <Acts cols={2}>
              <Act tone="line" label="إغلاق" onClick={() => setInfoModalType(null)} />
              <Act
                tone="jade"
                icon={Send}
                label="إرسال واتساب"
                title="إرسال هذا المحتوى للعميل عبر واتساب"
                onClick={() => {
                  if (infoModalType === 'info') sendQuickInfo();
                  else if (infoModalType === 'photos') sendQuickPhotos();
                  else if (infoModalType === 'location') sendQuickLocation();
                  setInfoModalType(null);
                }}
              />
            </Acts>
          }
        >
          {infoModalType === 'info' && (
            <>
              {selectedProperty.subtitle && <p className="kt-note" style={{ fontSize: 13.5 }}>{selectedProperty.subtitle}</p>}
              <Infos cols={2}>
                <Info label="السعة" value={`${selectedProperty.capacity} فرد`} />
                <Info label="غرف النوم" value={selectedProperty.bedrooms} />
                <Info label="دورات المياه" value={selectedProperty.bathrooms} />
                <Info label="المساحة" value={`${selectedProperty.areaM2} م²`} />
                <Info label="المسبح" value={selectedProperty.poolType} wide />
              </Infos>
              <Infos cols={2}>
                <Info label="وقت الدخول" value={selectedProperty.checkInTimeText} />
                <Info label="وقت الخروج" value={selectedProperty.checkOutTimeText} />
                <Info label="التأمين المسترد" value={`${insuranceAmount} ر.س`} wide />
              </Infos>
            </>
          )}

          {infoModalType === 'photos' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(selectedProperty.images || [selectedProperty.coverImage]).map((img, idx) => (
                  <div
                    key={idx}
                    className="h-28 rounded-2xl overflow-hidden"
                    style={{ boxShadow: '0 0 0 1px rgba(27,14,51,.08)' }}
                  >
                    <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              <Head title="الفيديوهات" icon={Film} count={propertyVideos.length} />

              {propertyVideos.length > 0 ? (
                <div className="space-y-2.5">
                  {propertyVideos.map((vid, idx) => {
                    const shareKey = `modal-${idx}`;
                    const isBusy = sharingVideoKey === shareKey;
                    const isExternal = isExternalVideoLink(vid.url);
                    return (
                      <div
                        key={`${vid.url}-${idx}`}
                        className="rounded-2xl overflow-hidden bg-white"
                        style={{ boxShadow: '0 0 0 1px rgba(27,14,51,.08)' }}
                      >
                        <div className="aspect-video bg-black">
                          <SmartVideoPlayer url={vid.url} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3 flex items-center gap-2">
                          <span className="flex-1 min-w-0 truncate font-bold text-[14px]">{vid.title}</span>
                          <Act
                            small
                            tone={isExternal ? 'line' : 'ink'}
                            icon={isBusy ? SpinIcon : Share2}
                            label={isBusy ? 'جاري التجهيز…' : isExternal ? 'رابط خارجي' : 'مشاركة كملف'}
                            disabled={isBusy}
                            onClick={() => void handleShareVideoAsFile(vid.url, vid.title, shareKey)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="kt-note text-center">لا توجد فيديوهات لهذا العقار بعد. يمكنك رفعها من صفحة العقارات.</p>
              )}
            </>
          )}

          {infoModalType === 'location' && (
            <>
              <div className="kt-info">
                <span className="kt-info-l">العنوان</span>
                <span className="kt-info-v" style={{ whiteSpace: 'normal' }}>{selectedProperty.location}</span>
              </div>
              <Act
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${selectedProperty.name} ${selectedProperty.location}`
                )}`}
                tone="ink"
                icon={MapPin}
                label="فتح على خرائط Google"
              />
            </>
          )}
        </Sheet>
      )}

      {/* Official Contract Draft Modal (PDF) */}
      {infoModalType === 'contract' && (
        <PrintableContractModal
          booking={{
            bookingNumber: 'مسودة-حجز',
            propertyId: selectedProperty.id,
            propertyName: selectedProperty.name,
            sectionId: activeSection?.id,
            sectionName: isEstateSelf ? estatePartsLabel : activeSection?.name,
      ...(isEstateSelf ? { estateParts: selectedParts } : {}),
            customerName: customerName.trim() || 'الضيف الكريم',
            customerPhone: customerPhone || '05xxxxxxxx',
            customerNationalId: customerNationalId.trim() || undefined,
            vehiclePlate: vehiclePlate.trim() || undefined,
            guestsCount:
              guestsCountInput.trim() && Number(guestsCountInput) > 0
                ? Number(guestsCountInput)
                : selectedProperty.capacity,
            checkInDate,
            checkOutDate,
            nightsCount,
            totalPrice,
            depositPaid: depositAmount,
            remainingAmount,
            insuranceAmount,
          }}
          property={selectedProperty}
          onClose={() => setInfoModalType(null)}
          title={`عقد إيجار ${selectedProperty.name} (معاينة وإرسال PDF)`}
        />
      )}

      {/* Confirmed Contract Modal (PDF) */}
      {confirmedContractData && (
        <PrintableContractModal
          booking={confirmedContractData.booking}
          property={selectedProperty}
          onClose={() => setConfirmedContractData(null)}
          title={`تم اعتماد الحجز وتوليد العقد الرسمي - ${confirmedContractData.bookingNumber}`}
        />
      )}

      {/* نص الرسالة المرسلة للعميل */}
      {sentMessageData && (
        <Sheet
          wide
          title={sentMessageData.title}
          icon={Send}
          tone="jade"
          onClose={() => setSentMessageData(null)}
          footer={
            <Acts cols={3}>
              <Act
                stack
                tone="line"
                icon={copiedSentMsg ? Check : Copy}
                label={copiedSentMsg ? 'تم النسخ' : 'نسخ النص'}
                onClick={() => {
                  navigator.clipboard.writeText(sentMessageData.text);
                  setCopiedSentMsg(true);
                  setTimeout(() => setCopiedSentMsg(false), 2000);
                }}
              />
              <Act stack tone="line" icon={X} label="إغلاق" onClick={() => setSentMessageData(null)} />
              <Act
                stack
                tone="jade"
                icon={Send}
                label="فتح واتساب"
                title="فتح واتساب الآن"
                href={sentMessageData.whatsappUrl}
                onClick={() => setSentMessageData(null)}
              />
            </Acts>
          }
        >
          <Field label="جوال العميل">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => {
                const nextPhone = e.target.value;
                setCustomerPhone(nextPhone);
                const clean = nextPhone.replace(/\D/g, '').replace(/^0/, '966');
                const nextUrl = `https://wa.me/${clean}?text=${encodeURIComponent(sentMessageData.text)}`;
                setSentMessageData({ ...sentMessageData, phone: nextPhone, whatsappUrl: nextUrl });
              }}
              placeholder="05xxxxxxxx"
              dir="ltr"
              className="kt-input font-mono font-bold text-left"
            />
          </Field>

          <div className="kt-field">
            <span className="kt-field-h">
              <span>نص الرسالة</span>
            </span>
            <div className="kt-msg">{sentMessageData.text}</div>
          </div>
        </Sheet>
      )}

      {/* تعديل العربون قبل التأكيد */}
      {editDepositModalOpen && (
        <Sheet
          title="تعديل العربون"
          icon={Edit2}
          tone="sand"
          onClose={() => setEditDepositModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="line" label="إلغاء" onClick={() => setEditDepositModalOpen(false)} />
              <Act
                tone="gold"
                icon={Check}
                label="حفظ العربون"
                title="حفظ وتحديث العربون فورياً"
                onClick={() => {
                  setDepositAmount(tempDepositValue);
                  if (selectedDates.length > 0) {
                    updateWaitingDepositAmount(selectedPropertyId, selectedDates, tempDepositValue);
                  }
                  setEditDepositModalOpen(false);
                }}
              />
            </Acts>
          }
        >
          <Field label="المبلغ الجديد (ر.س)">
            <input
              type="number"
              value={tempDepositValue}
              onChange={(e) => setTempDepositValue(Math.max(0, Number(e.target.value)))}
              placeholder="0"
              dir="rtl"
              className="kt-input font-mono font-bold"
            />
          </Field>

          <div className="kt-field">
            <span className="kt-field-h">
              <span>نسب مقترحة</span>
              <em>من {totalPrice} ر.س</em>
            </span>
            <Acts cols={2}>
              <Act tone="soft" label={`20% (${Math.round(totalPrice * 0.2)})`} onClick={() => setTempDepositValue(Math.round(totalPrice * 0.2))} />
              <Act tone="soft" label={`30% (${Math.round(totalPrice * 0.3)})`} onClick={() => setTempDepositValue(Math.round(totalPrice * 0.3))} />
              <Act tone="soft" label={`50% (${Math.round(totalPrice * 0.5)})`} onClick={() => setTempDepositValue(Math.round(totalPrice * 0.5))} />
              <Act tone="line" label="الافتراضي" onClick={() => setTempDepositValue(selectedProperty.defaultDeposit || 250)} />
            </Acts>
          </div>

          <Infos cols={1}>
            <Info label="المتبقي للتحصيل" value={`${Math.max(0, totalPrice - tempDepositValue)} ر.س`} hi />
          </Infos>
        </Sheet>
      )}
    </div>
  );
};
