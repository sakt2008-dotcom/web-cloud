import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  TrendingUp,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  SlidersHorizontal,
  Link2,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Layers,
  AlertTriangle,
  Receipt,
  Wallet,
  ExternalLink,
  ShieldCheck,
  Utensils,
  Edit3,
  AlertCircle,
  Trash2,
  GitMerge,
  User,
  Crown,
  Star,
  Phone,
  Calculator,
  Paperclip,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getPropertyKind, getHierarchyLabels, findEstateParent, getEstateOptions, isLinkedEstate, getEstateNightPrice, estateBookingBlocksUnit } from '../../lib/propertyUtils';
import { PropertySelect } from '../shared/PropertySelect';
import { EstateOptionsBar } from '../shared/EstateOptionsBar';
import { Head, Seg, Row, Tag, Choice, Acts, Act, Infos, Info, Stats, Stat, Rate, Field, Sheet, Switch } from '../ui/kit';
import { FilePick } from '../dashboard/DashboardCards';
import { nightsText } from '../../lib/format';
import type { Ico } from '../ui/kit';
import { Property, SeasonalPricing, AdministrativeFees, CustomFeeItem, PropertyBreakfastPricing } from '../../types';
import { AdministrativeFeesLedgerModal } from '../more/AdministrativeFeesLedgerModal';
import { CustomPricingSection } from './CustomPricingSection';
import { prepareReceiptFileForAppStorage } from '../../lib/bookingReceipts';

export const CalendarTab: React.FC = () => {
  const {
    properties,
    selectedPropertyId,
    selectedProperty,
    setSelectedPropertyId,
    bookings,
    dateOverrides,
    setDateOverridesBulk,
    applySeasonalPricingPattern,
    togglePropertyPublished,
    setActiveTab,
    setPreselectedDateForBooking,
    setPreselectedSectionForBooking,
    nowTimestamp,
    triggerBrowserNotification,
    isAdmin,
    canViewCalendar,
    updatePropertySeasonalPricing,
    updatePropertyBreakfastPrice,
    updatePropertyBreakfastPricing,
    updatePropertyAdministrativeFees,
    updateProperty,
    updatePropertySection,
    cancelBooking,
    addBooking,
  } = useApp();

  const hasCalendarFullAccess = isAdmin || canViewCalendar;

  const todayStr = useMemo(() => {
    const now = new Date(nowTimestamp || Date.now());
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [nowTimestamp]);

  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [selectMode, setSelectMode] = useState<'range' | 'multi'>('range');
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return [`${y}-${m}-${d}`];
  });
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth()); // 0-indexed
  const [priceInput, setPriceInput] = useState<number>(3000);
  const [panelMode, setPanelMode] = useState<'prices' | 'seasons'>('prices');
  const [targetStatus, setTargetStatus] = useState<'available' | 'blocked'>('available');
  const [savedStatusSuccess, setSavedStatusSuccess] = useState(false);
  const [savedPriceSuccess, setSavedPriceSuccess] = useState(false);
  const [calendarSize, setCalendarSize] = useState<'compact' | 'normal' | 'large'>('normal');
  const [quickSelectionMode, setQuickSelectionMode] = useState<'custom' | 'month' | 'weekday' | 'weekend'>('custom');

  // Quick Selection Helpers
  const handleSelectFullMonth = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mPadded = String(month + 1).padStart(2, '0');
      const dPadded = String(d).padStart(2, '0');
      const dStr = `${year}-${mPadded}-${dPadded}`;
      if (dStr >= todayStr) {
        list.push(dStr);
      }
    }
    setSelectMode('multi');
    setQuickSelectionMode('month');
    setSelectedDates(list);
  };

  const handleSelectWeekdays = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.getDay();
      if (dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3) {
        const mPadded = String(month + 1).padStart(2, '0');
        const dPadded = String(d).padStart(2, '0');
        const dStr = `${year}-${mPadded}-${dPadded}`;
        if (dStr >= todayStr) {
          list.push(dStr);
        }
      }
    }
    setSelectMode('multi');
    setQuickSelectionMode('weekday');
    setSelectedDates(list);
  };

  const handleSelectWeekends = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.getDay();
      if (dayOfWeek === 4 || dayOfWeek === 5) {
        const mPadded = String(month + 1).padStart(2, '0');
        const dPadded = String(d).padStart(2, '0');
        const dStr = `${year}-${mPadded}-${dPadded}`;
        if (dStr >= todayStr) {
          list.push(dStr);
        }
      }
    }
    setSelectMode('multi');
    setQuickSelectionMode('weekend');
    setSelectedDates(list);
  };

  const handleSelectCustomDays = () => {
    setSelectMode('multi');
    setQuickSelectionMode('custom');
  };

  // Seasonal Pricing Editing States (إمكانية تعديل وحفظ سعر أنماط المواسم)
  const [isEditingSeasons, setIsEditingSeasons] = useState(false);
  const [seasonalInputs, setSeasonalInputs] = useState<SeasonalPricing>(() => ({
    weekday: selectedProperty.seasonalPricing?.weekday || 2500,
    weekend: selectedProperty.seasonalPricing?.weekend || 3500,
    summer: selectedProperty.seasonalPricing?.summer || 2800,
    eid: selectedProperty.seasonalPricing?.eid || 4500,
    vacation: selectedProperty.seasonalPricing?.vacation || 3200,
  }));
  const [savedSeasonsSuccess, setSavedSeasonsSuccess] = useState(false);

  useEffect(() => {
    if (selectedProperty.seasonalPricing) {
      setSeasonalInputs({
        weekday: selectedProperty.seasonalPricing.weekday,
        weekend: selectedProperty.seasonalPricing.weekend,
        summer: selectedProperty.seasonalPricing.summer,
        eid: selectedProperty.seasonalPricing.eid,
        vacation: selectedProperty.seasonalPricing.vacation,
      });
    }
  }, [selectedPropertyId, selectedProperty.seasonalPricing]);

  const handleSaveSeasonalPricing = () => {
    updatePropertySeasonalPricing(selectedPropertyId, seasonalInputs);
    setSavedSeasonsSuccess(true);
    setTimeout(() => {
      setSavedSeasonsSuccess(false);
    }, 2200);
  };

  // Breakfast Pricing & Availability Container per Property (عنصر إعدادات وتسعير الإفطار لكل عقار)
  const [breakfastInputs, setBreakfastInputs] = useState<PropertyBreakfastPricing>(() => {
    if (selectedProperty.breakfastPricing) {
      return { ...selectedProperty.breakfastPricing };
    }
    const def = selectedProperty.defaultBreakfastPrice !== undefined ? selectedProperty.defaultBreakfastPrice : 150;
    return {
      enabled: true,
      weekday: def,
      weekend: def,
      summer: def,
      eid: def + 50,
      vacation: def,
    };
  });
  const [selectedBreakfastTier, setSelectedBreakfastTier] = useState<'weekday' | 'weekend' | 'summer' | 'eid' | 'vacation'>('weekday');
  const [savedBreakfastSuccess, setSavedBreakfastSuccess] = useState(false);
  const [appliedBreakfastDatesSuccess, setAppliedBreakfastDatesSuccess] = useState(false);

  useEffect(() => {
    if (selectedProperty.breakfastPricing) {
      setBreakfastInputs({ ...selectedProperty.breakfastPricing });
    } else {
      const def = selectedProperty.defaultBreakfastPrice !== undefined ? selectedProperty.defaultBreakfastPrice : 150;
      setBreakfastInputs({
        enabled: true,
        weekday: def,
        weekend: def,
        summer: def,
        eid: def + 50,
        vacation: def,
      });
    }
  }, [selectedPropertyId, selectedProperty.breakfastPricing, selectedProperty.defaultBreakfastPrice]);

  const handleSaveBreakfastPricing = () => {
    updatePropertyBreakfastPricing(selectedPropertyId, breakfastInputs);
    setSavedBreakfastSuccess(true);
    setTimeout(() => setSavedBreakfastSuccess(false), 2200);
  };

  const activeBreakfastAmount = useMemo(() => {
    if (!breakfastInputs.enabled) return 0;
    return breakfastInputs[selectedBreakfastTier] ?? breakfastInputs.weekday;
  }, [breakfastInputs, selectedBreakfastTier]);

  const handleApplyBreakfastToDates = () => {
    if (selectedDates.length === 0) return;
    const validDates = selectedDates.filter((d) => d >= todayStr && !isDateBooked(d));
    if (validDates.length === 0) return;

    setDateOverridesBulk(selectedPropertyId, validDates, {
      breakfastPrice: breakfastInputs.enabled ? activeBreakfastAmount : 0,
    });
    setAppliedBreakfastDatesSuccess(true);
    setTimeout(() => setAppliedBreakfastDatesSuccess(false), 2200);
  };

  // Administrative Fees states (الرسوم الإدارية المقتطعة من سعر الليلة لكل عقار بشكل مستقل)
  const [adminFeesLedgerOpen, setAdminFeesLedgerOpen] = useState(false);
  const [adminFeesInputs, setAdminFeesInputs] = useState<AdministrativeFees>(() => ({
    weekday: selectedProperty.administrativeFees?.weekday ?? 100,
    weekend: selectedProperty.administrativeFees?.weekend ?? 150,
    vacation: selectedProperty.administrativeFees?.vacation ?? 150,
    eid: selectedProperty.administrativeFees?.eid ?? 200,
    summer: selectedProperty.administrativeFees?.summer ?? 100,
    customFees: selectedProperty.administrativeFees?.customFees || [],
  }));
  const [selectedFeeTier, setSelectedFeeTier] = useState<string>('weekday');
  const [customFeeNameInput, setCustomFeeNameInput] = useState('');
  const [customFeeAmountInput, setCustomFeeAmountInput] = useState<number>(50);
  const [isAddingCustomFee, setIsAddingCustomFee] = useState(false);
  const [savedAdminFeeSuccess, setSavedAdminFeeSuccess] = useState(false);
  const [appliedAdminFeeSuccess, setAppliedAdminFeeSuccess] = useState(false);

  // Property Base (سعر الليلة الأساسي لصاحب العقار) & Administrative Fee (الرسوم الإدارية)
  // السعر الإجمالي بالتقويم = سعر الليلة الأساسي + سعر الرسوم الإدارية
  const [feeWeekdayBasePrice, setFeeWeekdayBasePrice] = useState<number>(() => {
    return selectedProperty.basePriceWeekday || 1000;
  });
  const [feeWeekdayAdminFee, setFeeWeekdayAdminFee] = useState<number>(() => {
    return selectedProperty.administrativeFees?.weekday ?? 100;
  });

  const [feeWeekendBasePrice, setFeeWeekendBasePrice] = useState<number>(() => {
    return selectedProperty.basePriceWeekend || 1400;
  });
  const [feeWeekendAdminFee, setFeeWeekendAdminFee] = useState<number>(() => {
    return selectedProperty.administrativeFees?.weekend ?? 150;
  });

  // Computed total prices in calendar
  const feeWeekdayTotalPrice = feeWeekdayBasePrice + feeWeekdayAdminFee;
  const feeWeekendTotalPrice = feeWeekendBasePrice + feeWeekendAdminFee;

  // Active Tab for Pricing & Administrative Fees box ('weekday' | 'weekend')
  // لا يوجد زر تبديل: النوع يتبع الأيام المحددة تلقائياً (الخميس والجمعة = ويكند) حتى لا يتعارض السعر مع اليوم
  const isWeekendDateKey = (d: string) => {
    const wd = new Date(`${d}T00:00:00`).getDay();
    return wd === 4 || wd === 5;
  };
  const feeReferenceDate = [...selectedDates].sort()[0] || todayStr;
  const feePricingTab: 'weekday' | 'weekend' = isWeekendDateKey(feeReferenceDate) ? 'weekend' : 'weekday';
  const feeSelectionIsMixed =
    selectedDates.length > 1 && new Set(selectedDates.map((d) => isWeekendDateKey(d))).size > 1;
  const isFeeWeekday = feePricingTab === 'weekday';
  const activeBasePrice = isFeeWeekday ? feeWeekdayBasePrice : feeWeekendBasePrice;
  const activeAdminFee = isFeeWeekday ? feeWeekdayAdminFee : feeWeekendAdminFee;
  const activeTotalPrice = isFeeWeekday ? feeWeekdayTotalPrice : feeWeekendTotalPrice;

  // 1. عند تعديل سعر الليلة (السعر الظاهر بالتقويم):
  // يتحدّث سعر المالك تلقائياً = سعر الليلة - الرسوم الإدارية
  const handleNightPriceChange = (val: number) => {
    const nightPrice = Math.max(0, val);
    setPriceInput(nightPrice);
    const ownerPrice = Math.max(0, nightPrice - activeAdminFee);
    if (isFeeWeekday) {
      setFeeWeekdayBasePrice(ownerPrice);
    } else {
      setFeeWeekendBasePrice(ownerPrice);
    }
  };

  // 2. عند تعديل سعر المالك (سعر الليلة الأساسي):
  // يتحدّث سعر الليلة تلقائياً = سعر المالك + الرسوم الإدارية
  const handleOwnerBasePriceChange = (val: number) => {
    const ownerPrice = Math.max(0, val);
    if (isFeeWeekday) {
      setFeeWeekdayBasePrice(ownerPrice);
    } else {
      setFeeWeekendBasePrice(ownerPrice);
    }
    const nightPrice = ownerPrice + activeAdminFee;
    setPriceInput(nightPrice);
  };

  // 3. عند تعديل الرسوم الإدارية:
  // يتحدّث سعر الليلة تلقائياً = سعر المالك + الرسوم الإدارية
  const handleAdminFeeChange = (val: number) => {
    const fee = Math.max(0, val);
    if (isFeeWeekday) {
      setFeeWeekdayAdminFee(fee);
    } else {
      setFeeWeekendAdminFee(fee);
    }
    const nightPrice = activeBasePrice + fee;
    setPriceInput(nightPrice);
  };

  const handleAdjustNightPrice = (delta: number) => {
    const newPrice = Math.max(0, priceInput + delta);
    handleNightPriceChange(newPrice);
  };

  const handleSyncFromCalendarPrice = () => {
    const calendarNum = Number(priceInput) || Number(selectedDatePrice) || activeTotalPrice;
    if (calendarNum > 0) {
      handleNightPriceChange(calendarNum);
    }
  };

  // Admin Booking Modal State (حجز الإدارة - تعديل مباشر من الإدارة لسعر الليلة: لا يوجد رسوم إدارية ولا يوجد عمولة)
  const [adminBookingModalOpen, setAdminBookingModalOpen] = useState(false);
  const [adminCustName, setAdminCustName] = useState('');
  const [adminCustPhone, setAdminCustPhone] = useState('05');
  const [adminCustomNightPrice, setAdminCustomNightPrice] = useState<number>(() => priceInput || activeTotalPrice || activeBasePrice);
  const [adminBookingDeposit, setAdminBookingDeposit] = useState<number>(250);
  const [adminBookingNotes, setAdminBookingNotes] = useState('');
  const [adminUpdateCalendarPrice, setAdminUpdateCalendarPrice] = useState<boolean>(false);
  const [adminDepositReceiptFile, setAdminDepositReceiptFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [adminReceiptError, setAdminReceiptError] = useState<string | null>(null);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);

  const handleOpenAdminBookingModal = () => {
    // حجز الإدارة: تعديل مباشر لسعر الليلة، لا يوجد رسوم إدارية (0 ر.س) ولا يوجد عمولة (0%)
    setAdminCustomNightPrice(priceInput || activeTotalPrice || activeBasePrice);
    setAdminBookingDeposit(selectedProperty.defaultDeposit || 250);
    setAdminCustName('');
    setAdminCustPhone('05');
    setAdminBookingNotes('');
    setAdminUpdateCalendarPrice(false);
    setAdminDepositReceiptFile(null);
    setAdminReceiptError(null);
    setAdminSuccessMsg(null);
    setAdminBookingModalOpen(true);
  };

  const getSelectedDatesForBooking = () => {
    const valid = selectedDates.filter((d) => d >= todayStr).sort();
    if (valid.length > 0) return valid;
    return [todayStr];
  };

  const handleConfirmAdminBooking = () => {
    const datesToBook = getSelectedDatesForBooking();
    const checkIn = datesToBook[0];
    const lastD = datesToBook[datesToBook.length - 1];
    const nextD = new Date(lastD);
    nextD.setDate(nextD.getDate() + 1);
    const checkOut = nextD.toISOString().split('T')[0];
    const nights = datesToBook.length;

    // حجز الإدارة: لا يوجد رسوم إدارية (0 ر.س) ولا يوجد عمولة مسوق (0%)
    const totalFees = 0;
    const baseTotal = adminCustomNightPrice * nights;
    const total = baseTotal;
    const commission = 0;
    const propertyNet = total; // كامل السعر المباشر صافي للعقار

    addBooking({
      propertyId: selectedPropertyId,
      propertyName: selectedProperty.name,
      sectionId: activeSectionId !== 'all' ? activeSectionId : undefined,
      customerName: adminCustName.trim() || 'حجز إدارة مباشر',
      customerPhone: adminCustPhone.trim() || '0500000000',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nightsCount: nights,
      nightlyPrice: adminCustomNightPrice,
      totalPrice: total,
      adminFee: 0,
      commissionRatePercent: 0,
      marketerCommission: 0,
      propertyNetPayout: propertyNet,
      depositPaid: adminBookingDeposit,
      remainingAmount: Math.max(0, total - adminBookingDeposit),
      insuranceAmount: selectedProperty.insuranceAmount || 500,
      bookingType: 'admin',
      bookingCategory: 'admin',
      isAdminBooking: true,
      customAdminNightlyPrice: adminCustomNightPrice,
      depositReceiptUrl: adminDepositReceiptFile?.dataUrl,
      depositReceiptName: adminDepositReceiptFile?.name,
      receiptFileName: adminDepositReceiptFile?.name,
      receiptDataUrl: adminDepositReceiptFile?.dataUrl,
      notes: `👑 حجز الإدارة (سعر مباشر: ${adminCustomNightPrice} ر.س/ليلة - لا رسوم إدارية 0 ر.س ولا عمولة مسوق 0%): صافي العقار ${propertyNet} ر.س كاملاً | ${adminBookingNotes.trim()}`,
      status: 'confirmed',
    });

    if (adminUpdateCalendarPrice) {
      setDateOverridesBulk(
        selectedPropertyId,
        datesToBook,
        {
          price: adminCustomNightPrice,
          adminFee: 0,
        },
        activeSectionId
      );
    }

    setAdminSuccessMsg('✓ تم تأكيد حجز الإدارة بدون رسوم إدارية وبدون عمولة بنجاح!');
    setTimeout(() => {
      setAdminBookingModalOpen(false);
      setAdminSuccessMsg(null);
    }, 1800);
  };

  useEffect(() => {
    const feeWd = selectedProperty.administrativeFees?.weekday ?? 100;
    const feeWe = selectedProperty.administrativeFees?.weekend ?? 150;

    setAdminFeesInputs({
      weekday: feeWd,
      weekend: feeWe,
      vacation: selectedProperty.administrativeFees?.vacation ?? 150,
      eid: selectedProperty.administrativeFees?.eid ?? 200,
      summer: selectedProperty.administrativeFees?.summer ?? 100,
      customFees: selectedProperty.administrativeFees?.customFees || [],
    });

    const defaultWdTotal = selectedProperty.seasonalPricing?.weekday || selectedProperty.basePriceWeekday || 1200;
    const defaultWeTotal = selectedProperty.seasonalPricing?.weekend || selectedProperty.basePriceWeekend || 1600;

    setFeeWeekdayBasePrice(Math.max(0, defaultWdTotal - feeWd));
    setFeeWeekdayAdminFee(feeWd);

    setFeeWeekendBasePrice(Math.max(0, defaultWeTotal - feeWe));
    setFeeWeekendAdminFee(feeWe);
  }, [selectedPropertyId, selectedProperty]);

  const activeFeeAmount = useMemo(() => {
    if (selectedFeeTier === 'weekday') return adminFeesInputs.weekday;
    if (selectedFeeTier === 'weekend') return adminFeesInputs.weekend;
    if (selectedFeeTier === 'vacation') return adminFeesInputs.vacation;
    if (selectedFeeTier === 'eid') return adminFeesInputs.eid;
    if (selectedFeeTier === 'summer') return adminFeesInputs.summer;
    const foundCustom = adminFeesInputs.customFees?.find((c) => c.id === selectedFeeTier);
    if (foundCustom) return foundCustom.amount;
    return adminFeesInputs.weekday;
  }, [selectedFeeTier, adminFeesInputs]);

  // Double-booking prevention alert state
  const [blockedAlertMessage, setBlockedAlertMessage] = useState<string | null>(null);
  const blockedAlertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<{
    dateKey: string;
    booking: (typeof bookings)[0];
    bookedPropertyName: string;
    source: 'direct' | 'linked_constituent' | 'parent_merger' | 'internal_unit';
    reasonText: string;
  } | null>(null);

  const showBlockedAlert = useCallback(
    (msg = 'اليوم محجوز ومؤكد ولا يمكن تكرار الحجز') => {
      setBlockedAlertMessage(msg);
      triggerBrowserNotification('⚠️ منع الحجز المزدوج', msg, 'system');
      if (blockedAlertTimeoutRef.current) clearTimeout(blockedAlertTimeoutRef.current);
      blockedAlertTimeoutRef.current = setTimeout(() => {
        setBlockedAlertMessage(null);
      }, 5500);
    },
    [triggerBrowserNotification]
  );

  const activeSection = useMemo(() => {
    if (!selectedProperty.sections || selectedProperty.sections.length === 0 || activeSectionId === 'all') {
      return null;
    }
    return selectedProperty.sections.find((s) => s.id === activeSectionId) || null;
  }, [selectedProperty, activeSectionId]);

  // الوحدة/العقار الذي يضم قسمين فأكثر: يمكن حجز كل قسم منفصلاً أو الكامل (سعره = مجموع أسعار الأقسام)
  const unitSections = selectedProperty.sections || [];
  const isMultiSection = unitSections.length >= 2;
  const isWeekendKey = (dk: string) => {
    const w = new Date(`${dk}T00:00:00`).getDay();
    return w === 4 || w === 5;
  };
  const sectionNightPrice = (sec: { id: string; priceWeekday: number; priceWeekend: number }, dk: string) =>
    dateOverrides[`${selectedPropertyId}_${sec.id}_${dk}`]?.price ??
    (isWeekendKey(dk) ? sec.priceWeekend : sec.priceWeekday);
  const isEstateSelf = isLinkedEstate(selectedProperty);
  const wholeNightPrice = (dk: string) =>
    isEstateSelf
      ? getEstateNightPrice(selectedProperty, properties, dateOverrides, dk)
      : unitSections.reduce((sum, sec) => sum + sectionNightPrice(sec, dk), 0);

  const getDateBookingConflict = useCallback(
    (dateKey: string) => {
      const isMerged = selectedProperty.isMergedProperty || selectedProperty.mergedConfig?.isMerged;
      const mergeType = selectedProperty.mergedConfig?.mergeType;
      const linkedIds = selectedProperty.mergedConfig?.linkedPropertyIds || selectedProperty.mergedPropertyIds || [];

      // 1. Direct booking check on selected property (Supervisor & standard bookings lock calendar dates)
      const directBooking = bookings.find((b) => {
        if (b.propertyId !== selectedPropertyId || b.status === 'cancelled' || (b.isSpecialBooking && !b.isSupervisorBooking)) return false;
        if (!(dateKey >= b.checkInDate && dateKey < b.checkOutDate)) return false;

        if (isMultiSection) {
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
    },
    [bookings, selectedPropertyId, selectedProperty, activeSection, properties]
  );

  const isDateBooked = useCallback(
    (dateKey: string) => {
      return getDateBookingConflict(dateKey).isBooked;
    },
    [getDateBookingConflict]
  );

  // Filter out any past or already booked dates from selectedDates automatically
  useEffect(() => {
    setSelectedDates((prev) => {
      const filtered = prev.filter((d) => d >= todayStr && !isDateBooked(d));
      return filtered.length > 0 ? filtered : [todayStr];
    });
  }, [todayStr, isDateBooked]);

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
  }, [selectedPropertyId]);

  // عقار مدمج: خيارات (وحدة / قسم / وحدة كاملة)
  const estateParent = useMemo(() => findEstateParent(selectedProperty, properties), [selectedProperty, properties]);
  const estateOptions = useMemo(() => (estateParent ? getEstateOptions(estateParent, properties) : []), [estateParent, properties]);
  const [estateCtx, setEstateCtx] = useState<string | null>(null);
  const ctxActive = !!(estateCtx && estateParent && estateParent.id === estateCtx && selectedProperty.id !== estateParent.id);
  const pickEstateOption = (o: { propertyId: string; sectionId: string }) => {
    if (estateParent) setEstateCtx(estateParent.id);
    if (o.propertyId === selectedPropertyId) {
      setActiveSectionId(o.sectionId);
    } else {
      pendingSectionRef.current = o.sectionId;
      setSelectedPropertyId(o.propertyId);
    }
  };

  // iCal sync modal state
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [gathernIcalUrl, setGathernIcalUrl] = useState('');
  const [bookingIcalUrl, setBookingIcalUrl] = useState('');
  const [airbnbIcalUrl, setAirbnbIcalUrl] = useState('');

  const [syncStatuses, setSyncStatuses] = useState<Record<string, { gathern?: boolean; booking?: boolean; airbnb?: boolean; lastSync?: string }>>(() => {
    try {
      const saved = localStorage.getItem('property_calendar_sync_status');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'al-taraf': { gathern: true, booking: true, airbnb: false, lastSync: 'منذ 5 دقائق' },
      'al-baylasan': { gathern: true, booking: false, airbnb: false, lastSync: 'منذ 18 دقيقة' },
      rans: { gathern: false, booking: false, airbnb: false },
      alma: { gathern: true, booking: true, airbnb: false, lastSync: 'منذ ساعة' },
      naya: { gathern: false, booking: false, airbnb: false },
      hamran: { gathern: false, booking: false, airbnb: false },
    };
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleManualSync = () => {
    setSyncing(true);
    setSyncSuccessMsg(null);
    setTimeout(() => {
      setSyncing(false);
      const updated = {
        ...syncStatuses,
        [selectedPropertyId]: {
          gathern: !!gathernIcalUrl || syncStatuses[selectedPropertyId]?.gathern || true,
          booking: !!bookingIcalUrl || syncStatuses[selectedPropertyId]?.booking || true,
          airbnb: !!airbnbIcalUrl || syncStatuses[selectedPropertyId]?.airbnb || false,
          lastSync: 'الآن',
        },
      };
      setSyncStatuses(updated);
      try {
        localStorage.setItem('property_calendar_sync_status', JSON.stringify(updated));
        const urlsObj = { [selectedPropertyId]: { gathern: gathernIcalUrl, booking: bookingIcalUrl, airbnb: airbnbIcalUrl } };
        localStorage.setItem('property_calendar_sync_urls', JSON.stringify(urlsObj));
      } catch {}
      setSyncSuccessMsg('تمت مزامنة وتقييد الحجوزات مع جاذر إن وبوكينج بنجاح!');
      setTimeout(() => setSyncSuccessMsg(null), 3000);
    }, 1200);
  };

  const monthsAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const daysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

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

  const daysMatrix = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const items: (null | {
      dayNum: number;
      dateKey: string;
      price: number;
      status: 'available' | 'booked' | 'blocked' | 'waiting_deposit';
      booking?: (typeof bookings)[0];
      depositRemainingSeconds: number;
      override?: (typeof dateOverrides)[string];
      isPast: boolean;
      isToday: boolean;
      bookedPropertyName?: string;
      bookingSource?: 'direct' | 'linked_constituent' | 'parent_merger' | 'internal_unit';
      bookingReasonText?: string;
    })[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      items.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthPadded = String(month + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      const dateKey = `${year}-${monthPadded}-${dayPadded}`;
      const dayDate = new Date(year, month, d);
      const isWeekend = dayDate.getDay() === 4 || dayDate.getDay() === 5; // Thursday & Friday
      const unitKey = activeSection
        ? `${selectedPropertyId}_${activeSection.id}_${dateKey}`
        : `${selectedPropertyId}_${dateKey}`;
      const override = dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${dateKey}`];
      const calculatedBasePrice = activeSection
        ? (isWeekend ? activeSection.priceWeekend : activeSection.priceWeekday)
        : (isWeekend ? selectedProperty.basePriceWeekend : selectedProperty.basePriceWeekday);

      // القسم: سعره الخاص فقط. الكامل: مجموع أسعار الأقسام. غير ذلك: سعر الوحدة.
      const price = activeSection
        ? (dateOverrides[unitKey]?.price ?? calculatedBasePrice)
        : (isMultiSection || isEstateSelf)
        ? wholeNightPrice(dateKey)
        : (override?.price !== undefined ? override.price : calculatedBasePrice);

      // الكامل غير متاح إذا أُغلق أي قسم
      const wholeBlockedBySection =
        !activeSection &&
        isMultiSection &&
        unitSections.some((sec) => dateOverrides[`${selectedPropertyId}_${sec.id}_${dateKey}`]?.status === 'blocked');

      // Check booking conflict with full linked & constituent metadata
      const conflict = getDateBookingConflict(dateKey);
      const matchedBooking = conflict.booking;

      const isPast = dateKey < todayStr;
      const isToday = dateKey === todayStr;

      let status: 'available' | 'booked' | 'blocked' | 'waiting_deposit' = 'available';
      if (isPast) {
        // Automatically disabled & closed for all past dates
        status = 'blocked';
      } else if (!selectedProperty.isPublished || (activeSection && activeSection.isAvailable === false)) {
        status = 'blocked';
      } else if (conflict.isBooked) {
        status = 'booked';
      } else if (override?.status === 'waiting_deposit') {
        status = 'waiting_deposit';
      } else if (override?.status === 'blocked' || wholeBlockedBySection) {
        status = 'blocked';
      }

      let depositRemainingSeconds = 0;
      if (override?.status === 'waiting_deposit' && override.waitingDepositExpiresAt) {
        depositRemainingSeconds = Math.max(0, Math.floor((override.waitingDepositExpiresAt - nowTimestamp) / 1000));
      }

      items.push({
        dayNum: d,
        dateKey,
        price,
        status,
        booking: matchedBooking,
        depositRemainingSeconds,
        override,
        isPast,
        isToday,
        bookedPropertyName: conflict.bookedPropertyName,
        bookingSource: conflict.bookingSource,
        bookingReasonText: conflict.reasonText,
      });
    }

    return items;
  }, [year, month, selectedPropertyId, selectedProperty, activeSection, bookings, dateOverrides, nowTimestamp, todayStr, properties, getDateBookingConflict]);

  const handleDateClick = (dateKey: string) => {
    // Strictly disable past dates: non-clickable and cannot be selected
    if (dateKey < todayStr) {
      return;
    }

    // Strictly prevent double-booking on confirmed/booked days UNLESS user has full Calendar access
    if (isDateBooked(dateKey) && !hasCalendarFullAccess) {
      const conflict = getDateBookingConflict(dateKey);
      const msg = conflict.bookedPropertyName
        ? `⛔ هذا التاريخ محجوز لدى "${conflict.bookedPropertyName}". وفقاً لشروط الدمج، لا يمكن الحجز إلا إذا كانت جميع الاستراحات متاحة بالكامل للعميل الجديد.`
        : 'اليوم محجوز ومؤكد ولا يمكن تكرار الحجز';
      showBlockedAlert(msg);
      if (conflict.booking) {
        setSelectedBookingDetail({
          dateKey,
          booking: conflict.booking,
          bookedPropertyName: conflict.bookedPropertyName,
          source: conflict.bookingSource,
          reasonText: conflict.reasonText,
        });
      }
      return;
    }

    setQuickSelectionMode('custom');

    if (selectMode === 'multi') {
      if (selectedDates.includes(dateKey)) {
        if (selectedDates.length > 1) {
          setSelectedDates(selectedDates.filter((d) => d !== dateKey));
        }
      } else {
        setSelectedDates([...selectedDates, dateKey].sort());
      }
    } else {
      // Range mode
      if (selectedDates.length === 0 || selectedDates.length >= 2) {
        setSelectedDates([dateKey]);
      } else {
        const start = selectedDates[0];
        if (dateKey >= start) {
          const list: string[] = [];
          const curr = new Date(start);
          const end = new Date(dateKey);
          let foundBooked = false;
          while (curr <= end) {
            const dStr = curr.toISOString().split('T')[0];
            if (isDateBooked(dStr) && !hasCalendarFullAccess) {
              foundBooked = true;
              break;
            }
            if (dStr >= todayStr) {
              list.push(dStr);
            }
            curr.setDate(curr.getDate() + 1);
          }
          if (foundBooked && !hasCalendarFullAccess) {
            showBlockedAlert('اليوم محجوز ومؤكد ولا يمكن تكرار الحجز');
            return;
          }
          setSelectedDates(list.length > 0 ? list : [dateKey]);
        } else {
          setSelectedDates([dateKey]);
        }
      }
    }
  };

  const sortedSelected = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const cardRefDate = sortedSelected[0] || todayStr;
  const checkInDate = sortedSelected[0] || todayStr;
  const lastSelectedDate = sortedSelected[sortedSelected.length - 1] || checkInDate;

  const checkOutDate = useMemo(() => {
    const d = new Date(lastSelectedDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [lastSelectedDate]);

  const totalNights = Math.max(1, selectedDates.length);

  const estimatedTotal = useMemo(() => {
    let sum = 0;
    sortedSelected.forEach((d) => {
      if (!activeSection && (isMultiSection || isEstateSelf)) {
        sum += wholeNightPrice(d);
        return;
      }
      const unitKey = activeSection
        ? `${selectedPropertyId}_${activeSection.id}_${d}`
        : `${selectedPropertyId}_${d}`;
      const ov = activeSection ? dateOverrides[unitKey] : (dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${d}`]);
      if (ov?.price !== undefined) {
        sum += ov.price;
      } else {
        const isWk = isWeekendKey(d);
        sum += activeSection
          ? (isWk ? activeSection.priceWeekend : activeSection.priceWeekday)
          : (isWk ? selectedProperty.basePriceWeekend : selectedProperty.basePriceWeekday);
      }
    });
    return sum;
  }, [sortedSelected, dateOverrides, selectedPropertyId, selectedProperty, activeSection, isMultiSection, isEstateSelf, properties]);

  const estimatedCommission = Math.round(estimatedTotal * 0.05);

  const handleApplyStatus = (status: 'available' | 'blocked') => {
    const validDates = selectedDates.filter((d) => d >= todayStr);
    if (validDates.length === 0) return;

    // If reopening / setting to available with full calendar access, cancel conflicting booking locks for these dates
    if (status === 'available' && hasCalendarFullAccess) {
      bookings.forEach((b) => {
        if (
          b.propertyId === selectedPropertyId &&
          b.status !== 'cancelled' &&
          (!activeSection || !b.sectionId || b.sectionId === 'all' || b.sectionId === activeSection.id)
        ) {
          const hasOverlap = validDates.some((vd) => vd >= b.checkInDate && vd < b.checkOutDate);
          if (hasOverlap) {
            cancelBooking(b.id);
          }
        }
      });
    }

    setDateOverridesBulk(selectedPropertyId, validDates, { status }, activeSectionId);
  };

  const saveStatusSelection = () => {
    const validDates = selectedDates.filter((d) => d >= todayStr);
    if (validDates.length === 0) return;
    handleApplyStatus(targetStatus);
    setSavedStatusSuccess(true);
    setTimeout(() => setSavedStatusSuccess(false), 2000);
  };

  const seasonalPrices = useMemo(() => {
    if (activeSection) {
      return {
        weekday: activeSection.priceWeekday,
        weekend: activeSection.priceWeekend,
        summer: Math.round(activeSection.priceWeekday * 1.1),
        eid: Math.round(activeSection.priceWeekend * 1.5),
        vacation: Math.round(activeSection.priceWeekday * 1.25),
      };
    }
    return {
      weekday: seasonalInputs.weekday || selectedProperty.seasonalPricing.weekday,
      weekend: seasonalInputs.weekend || selectedProperty.seasonalPricing.weekend,
      summer: seasonalInputs.summer || selectedProperty.seasonalPricing.summer,
      eid: seasonalInputs.eid || selectedProperty.seasonalPricing.eid,
      vacation: seasonalInputs.vacation || selectedProperty.seasonalPricing.vacation,
    };
  }, [activeSection, selectedProperty, seasonalInputs]);

  // Live Calendar Night Prices automatically retrieved from "نظام تعديل سعر الليلة" (المعروضة بالتقويم)
  const calendarWeekdayPrice = useMemo(() => {
    if (activeSection) return activeSection.priceWeekday;
    return seasonalPrices.weekday || selectedProperty.seasonalPricing?.weekday || selectedProperty.basePriceWeekday || 1200;
  }, [activeSection, seasonalPrices.weekday, selectedProperty]);

  const calendarWeekendPrice = useMemo(() => {
    if (activeSection) return activeSection.priceWeekend;
    return seasonalPrices.weekend || selectedProperty.seasonalPricing?.weekend || selectedProperty.basePriceWeekend || 1600;
  }, [activeSection, seasonalPrices.weekend, selectedProperty]);

  // Determine which season tier matches the selected calendar date
  const selectedDateSeasonTier = useMemo<'weekday' | 'weekend'>(() => {
    if (selectedDates.length === 0) return 'weekday';
    const dObj = new Date(selectedDates[0]);
    const isWk = dObj.getDay() === 4 || dObj.getDay() === 5;
    return isWk ? 'weekend' : 'weekday';
  }, [selectedDates]);

  // Read current active price from calendar table for the selected date(s)
  const selectedDatesSyncKey = sortedSelected.join(',');

  const selectedDatePrice = useMemo(() => {
    const targetDate = sortedSelected[0] || todayStr;
    const unitKey = activeSection
      ? `${selectedPropertyId}_${activeSection.id}_${targetDate}`
      : `${selectedPropertyId}_${targetDate}`;
    if (!activeSection && (isMultiSection || isEstateSelf)) return wholeNightPrice(targetDate);
    const override = activeSection ? dateOverrides[unitKey] : (dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${targetDate}`]);
    if (override?.price !== undefined) return override.price;
    const isWk = isWeekendKey(targetDate);
    if (activeSection) {
      return isWk ? activeSection.priceWeekend : activeSection.priceWeekday;
    }
    return isWk ? seasonalPrices.weekend : seasonalPrices.weekday;
  }, [sortedSelected, todayStr, activeSection, selectedPropertyId, selectedProperty, dateOverrides, seasonalPrices]);

  // Real-time synchronization: when a date or selection pattern is chosen, automatically load that day's price & normal admin fee
  useEffect(() => {
    const targetDate = sortedSelected[0] || todayStr;
    const unitKey = activeSection
      ? `${selectedPropertyId}_${activeSection.id}_${targetDate}`
      : `${selectedPropertyId}_${targetDate}`;
    const override = dateOverrides[unitKey] || dateOverrides[`${selectedPropertyId}_${targetDate}`];
    const dObj = new Date(targetDate);
    const isWk = dObj.getDay() === 4 || dObj.getDay() === 5;
    const targetTab: 'weekday' | 'weekend' =
      quickSelectionMode === 'weekday'
        ? 'weekday'
        : quickSelectionMode === 'weekend'
        ? 'weekend'
        : isWk
        ? 'weekend'
        : 'weekday';

    const resolvedFee =
      override?.adminFee !== undefined
        ? Math.max(0, Number(override.adminFee))
        : isWk
        ? selectedProperty.administrativeFees?.weekend ?? 150
        : selectedProperty.administrativeFees?.weekday ?? 100;

    const resolvedTotal =
      selectedDatePrice !== undefined && selectedDatePrice > 0
        ? selectedDatePrice
        : isWk
        ? seasonalPrices.weekend
        : seasonalPrices.weekday;

    const computedBase = Math.max(0, resolvedTotal - resolvedFee);

    setPriceInput(resolvedTotal);
    if (targetTab === 'weekday') {
      setFeeWeekdayAdminFee(resolvedFee);
      setFeeWeekdayBasePrice(computedBase);
    } else {
      setFeeWeekendAdminFee(resolvedFee);
      setFeeWeekendBasePrice(computedBase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatesSyncKey, selectedPropertyId, activeSectionId, quickSelectionMode]);

  const handleApplyPrice = () => {
    const validDates = selectedDates.filter((d) => d >= todayStr);
    if (validDates.length === 0 || !priceInput) return;
    const numericPrice = Number(priceInput);

    // 1. Update calendar date overrides across all matching keys so the price appears immediately in the calendar table!
    setDateOverridesBulk(
      selectedPropertyId,
      validDates,
      {
        price: numericPrice,
        season: selectedDateSeasonTier,
        adminFee: activeAdminFee,
      },
      activeSectionId
    );

    // 2. Synchronize "أنماط المواسم" with this new price so the two elements are 100% in sync!
    const updatedSeasons: SeasonalPricing = {
      ...seasonalInputs,
      [selectedDateSeasonTier]: numericPrice,
    };
    setSeasonalInputs(updatedSeasons);
    updatePropertySeasonalPricing(selectedPropertyId, updatedSeasons);

    // 3. Keep the base price (owner price) updated: owner base = total night price - admin fee
    const computedBase = Math.max(0, numericPrice - activeAdminFee);
    if (selectedDateSeasonTier === 'weekday') {
      setFeeWeekdayBasePrice(computedBase);
    } else {
      setFeeWeekendBasePrice(computedBase);
    }

    // If viewing a sub-unit, also keep its base price in sync
    if (activeSection) {
      if (selectedDateSeasonTier === 'weekday') {
        updatePropertySection(selectedPropertyId, activeSection.id, { priceWeekday: numericPrice });
      } else {
        updatePropertySection(selectedPropertyId, activeSection.id, { priceWeekend: numericPrice });
      }
    }

    setSavedPriceSuccess(true);
    setTimeout(() => setSavedPriceSuccess(false), 2200);
  };

  const handleApplyFeesModelToCalendar = () => {
    let validDates = selectedDates.filter((d) => d >= todayStr);
    if (validDates.length === 0) {
      validDates = [todayStr];
    }

    // كل يوم يأخذ سعر نوعه: الخميس والجمعة سعر الويكند، وبقية الأيام سعر وسط الأسبوع
    const weekendDates = validDates.filter((d) => isWeekendDateKey(d));
    const weekdayDates = validDates.filter((d) => !isWeekendDateKey(d));

    const applyGroup = (dates: string[], base: number, fee: number) => {
      if (dates.length === 0) return 0;
      const targetFee = Math.max(0, Number(fee) || 0);
      const total = Math.max(0, Number(base) || 0) + targetFee;
      setDateOverridesBulk(selectedPropertyId, dates, { price: total, adminFee: targetFee }, activeSectionId);
      return total;
    };

    const wdTotal = applyGroup(weekdayDates, feeWeekdayBasePrice, feeWeekdayAdminFee);
    const weTotal = applyGroup(weekendDates, feeWeekendBasePrice, feeWeekendAdminFee);

    // Keep calendar price input synchronized
    setPriceInput(feePricingTab === 'weekend' ? weTotal || wdTotal : wdTotal || weTotal);

    setAppliedAdminFeeSuccess(true);
    setTimeout(() => setAppliedAdminFeeSuccess(false), 2200);
  };

  const handleSaveAdminFees = () => {
    updatePropertyAdministrativeFees(selectedPropertyId, adminFeesInputs);
    setSavedAdminFeeSuccess(true);
    setTimeout(() => setSavedAdminFeeSuccess(false), 2200);
  };

  const handleApplyAdminFee = (feeOverride?: number) => {
    const validDates = selectedDates.filter((d) => d >= todayStr);
    if (validDates.length === 0) return;
    const feeToApply = feeOverride !== undefined ? feeOverride : activeFeeAmount;
    setDateOverridesBulk(selectedPropertyId, validDates, { adminFee: Number(feeToApply) }, activeSectionId);
    setAppliedAdminFeeSuccess(true);
    setTimeout(() => setAppliedAdminFeeSuccess(false), 2000);
  };

  const handleAddCustomFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFeeNameInput.trim()) return;
    const newFee: CustomFeeItem = {
      id: `fee-${Date.now()}`,
      name: customFeeNameInput.trim(),
      amount: Math.max(0, Number(customFeeAmountInput)),
    };
    const updated: AdministrativeFees = {
      ...adminFeesInputs,
      customFees: [...(adminFeesInputs.customFees || []), newFee],
    };
    setAdminFeesInputs(updated);
    updatePropertyAdministrativeFees(selectedPropertyId, updated);
    setSelectedFeeTier(newFee.id);
    setCustomFeeNameInput('');
    setCustomFeeAmountInput(50);
    setIsAddingCustomFee(false);
  };

  const handleDeleteCustomFee = (feeId: string) => {
    const updated: AdministrativeFees = {
      ...adminFeesInputs,
      customFees: (adminFeesInputs.customFees || []).filter((c) => c.id !== feeId),
    };
    setAdminFeesInputs(updated);
    updatePropertyAdministrativeFees(selectedPropertyId, updated);
    if (selectedFeeTier === feeId) {
      setSelectedFeeTier('weekday');
    }
  };

  const handleApplySeason = (season: keyof Property['seasonalPricing']) => {
    const validDates = selectedDates.filter((d) => d >= todayStr);
    if (validDates.length === 0) return;
    const seasonPrice = seasonalPrices[season] || seasonalInputs[season] || Number(priceInput);

    // 1. Immediately synchronize the custom price input with the season price
    setPriceInput(seasonPrice);

    // 2. Set date override in calendar table so it renders immediately
    setDateOverridesBulk(
      selectedPropertyId,
      validDates,
      {
        price: seasonPrice,
        season: String(season),
      },
      activeSectionId
    );

    applySeasonalPricingPattern(selectedPropertyId, validDates, season, activeSectionId);
    setSavedPriceSuccess(true);
    setTimeout(() => setSavedPriceSuccess(false), 2000);
  };

  return (
    <div className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-2 space-y-4">
      {/* اختيار العقار */}
      <PropertySelect
        properties={properties}
        value={ctxActive && estateCtx ? estateCtx : selectedPropertyId}
        onChange={(id) => {
          setEstateCtx(null);
          setSelectedPropertyId(id);
        }}
      />

      {/* عقار مدمج (نظام حمران للدمج بين استراحتين) */}
      {(selectedProperty.isMergedProperty || ctxActive) && estateParent && (
        <section className="lux-card p-4">
          <Row
            icon={GitMerge}
            tone="ch"
            title={`${estateParent.name} (عقار مدمج)`}
            sub={
              estateParent.mergedConfig?.mergeType === 'linked_properties'
                ? `يجمع ${estateParent.mergedConfig.linkedPropertyNames?.join(' + ') || 'وحدتين'}`
                : 'يجمع وحدتين'
            }
            end={<Tag tone="amy">مزامنة ثنائية</Tag>}
          />
        </section>
      )}

      {/* استراحة مشمولة ضمن عقار مدمج */}
      {!selectedProperty.isMergedProperty &&
        !ctxActive &&
        properties.some(
          (p) =>
            p.id !== selectedPropertyId &&
            p.isMergedProperty &&
            (p.mergedConfig?.linkedPropertyIds?.includes(selectedPropertyId) || p.mergedPropertyIds?.includes(selectedPropertyId))
        ) && (
          <section className="lux-card p-4 space-y-2.5">
            <Row
              icon={Link2}
              tone="amy"
              title="مشمولة ضمن عقار مدمج"
              sub={properties
                .filter(
                  (p) =>
                    p.id !== selectedPropertyId &&
                    p.isMergedProperty &&
                    (p.mergedConfig?.linkedPropertyIds?.includes(selectedPropertyId) ||
                      p.mergedPropertyIds?.includes(selectedPropertyId))
                )
                .map((p) => p.name)
                .join('، ')}
              end={<Tag tone="amy">ربط تلقائي</Tag>}
            />
            <p className="kt-note">أي حجز مؤكد على العقار المدمج يقفل التقويم هنا تلقائياً.</p>
          </section>
        )}

      {estateParent && (estateParent.id === selectedProperty.id || ctxActive) && (
        <EstateOptionsBar
          parent={estateParent}
          options={estateOptions}
          selectedPropertyId={selectedPropertyId}
          activeSectionId={activeSectionId}
          onPick={pickEstateOption}
        />
      )}

      {/* اختيار القسم / الوحدة (للعقارات متعددة الوحدات) */}
      {!ctxActive && selectedProperty.sections && selectedProperty.sections.length > 0 && (
        <section className="lux-card p-4 space-y-3">
          <Head
            title={getPropertyKind(selectedProperty) === 'estate' ? 'اختر الوحدة' : 'اختر القسم'}
            icon={Layers}
            count={selectedProperty.sections.length + (isMultiSection ? 1 : 0)}
          />
          <div className="kt-grid2">
            {selectedProperty.sections.map((sec) => (
              <Choice
                key={sec.id}
                title={sec.name}
                sub={`ليلة ${cardRefDate.slice(5)}: ${sectionNightPrice(sec, cardRefDate)} · أساسي ${sec.priceWeekday}/${sec.priceWeekend}`}
                tag="مستقل"
                selected={activeSectionId === sec.id}
                onClick={() => setActiveSectionId(sec.id)}
              />
            ))}
            {isMultiSection && (
              <Choice
                title={getHierarchyLabels(getPropertyKind(selectedProperty)).whole}
                sub={`ليلة ${cardRefDate.slice(5)}: ${wholeNightPrice(cardRefDate)} · مجموع الأقسام`}
                tag="شامل"
                selected={activeSectionId === 'all'}
                onClick={() => setActiveSectionId('all')}
              />
            )}
          </div>
          <p className="kt-note">{isMultiSection ? 'سعر «الكامل» = مجموع أسعار الأقسام.' : 'كل وحدة تُحجز بشكل مستقل.'}</p>
        </section>
      )}

      {/* نمط التحديد */}
      <Seg
        compact
        label="نمط التحديد"
        value={selectMode}
        onChange={setSelectMode}
        items={[
          { id: 'range', label: 'فترة متصلة' },
          { id: 'multi', label: 'ليالٍ متعددة' },
        ]}
      />

      {/* Calendar Card */}
      <div className="lux-card p-4 space-y-4">
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

        {/* تنبيه الحجز المزدوج */}
        {blockedAlertMessage && (
          <div className="kt-err animate-in fade-in slide-in-from-top-1" role="alert">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="flex-1 min-w-0">{blockedAlertMessage}</span>
            <button type="button" onClick={() => setBlockedAlertMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
              ✕
            </button>
          </div>
        )}

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {daysAr.map((day, idx) => (
            <div key={idx} className="text-xs font-bold text-slate-500 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysMatrix.map((item, idx) => {
            const heightCls =
              calendarSize === 'compact'
                ? 'h-13 sm:h-15'
                : calendarSize === 'large'
                ? 'h-22 sm:h-26'
                : 'h-16 sm:h-20';

            if (!item) {
              return <div key={`empty-${idx}`} className={`${heightCls} rounded-2xl bg-slate-50/50`} />;
            }

            const { dayNum, dateKey, price, status, depositRemainingSeconds, isPast, isToday } = item;
            const isConfirmedBooked = status === 'booked' || !!item.booking;
            const isSelected = selectedDates.includes(dateKey);

            let colorClasses = 'bg-[#E8F8F1] border-emerald-200 text-emerald-950';
            let label = `${price}`;
            // أسماء قصيرة داخل الخانة؛ الاسم الكامل يظهر في التلميح وعند فتح تفاصيل الحجز
            const shortSec = (n?: string) => (n || '').replace(/^(قسم|وحدة|جناح)\s+/, '');

            if (isPast) {
              colorClasses = 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-55 cursor-not-allowed pointer-events-none';
              label = item.booking ? 'مؤكد' : '';
            } else if (status === 'waiting_deposit') {
              colorClasses = 'bg-amber-100 border-amber-300 text-amber-950 btn-beam-shine';
              label = `${Math.floor(depositRemainingSeconds / 60)}:${String(depositRemainingSeconds % 60).padStart(2, '0')}`;
            } else if (status === 'booked') {
              colorClasses = 'bg-[#FCE7F3] border-pink-300 text-pink-950 hover:border-pink-400';
              const isMerged = selectedProperty.isMergedProperty || selectedProperty.mergedConfig?.isMerged;
              const mergeType = selectedProperty.mergedConfig?.mergeType;

              if (item.bookedPropertyName && (item.bookingSource === 'linked_constituent' || item.bookingSource === 'parent_merger')) {
                label = 'مدمج';
              } else if (item.booking && item.booking.propertyId !== selectedPropertyId) {
                // Booked through linked property or parent merger
                label = 'مدمج';
              } else if (isMultiSection) {
                if (!activeSection) {
                  if (item.booking?.sectionId && item.booking.sectionId !== 'all') {
                    const sec = selectedProperty.sections?.find((s) => s.id === item.booking?.sectionId);
                    label = sec ? shortSec(sec.name) : 'محجوز';
                  } else {
                    label = 'كامل';
                  }
                } else if (!item.booking?.sectionId || item.booking?.sectionId === 'all') {
                  label = 'كامل';
                } else {
                  label = 'مؤكد';
                }
              } else if (isMerged && mergeType === 'linked_properties') {
                label = 'مدمج';
              } else {
                label = item.bookedPropertyName && item.bookedPropertyName !== selectedProperty.name ? 'مدمج' : 'مؤكد';
              }
            } else if (status === 'blocked') {
              colorClasses = 'bg-slate-100 border-slate-200 text-slate-400';
              label = 'مغلق';
            }

            // Elegantly styled today's date and non-black selection border
            const todayClasses = isToday
              ? 'border-2 border-purple-400 bg-purple-50/40 font-bold'
              : '';
            const selectedClasses = isSelected
              ? 'ring-3 ring-purple-600 ring-offset-2 !border-2 !border-purple-600 !bg-purple-100/80 shadow-md font-black scale-[1.02] z-20'
              : '';

            return (
              <div
                key={dateKey}
                onClick={() => {
                  if (isPast) return;
                  if (isConfirmedBooked) {
                    if (item.booking) {
                      setSelectedBookingDetail({
                        dateKey,
                        booking: item.booking,
                        bookedPropertyName: item.bookedPropertyName || selectedProperty.name,
                        source: item.bookingSource || 'direct',
                        reasonText: item.bookingReasonText || `محجوز لدى ${item.bookedPropertyName || selectedProperty.name}`,
                      });
                    }
                    if (!hasCalendarFullAccess) {
                      showBlockedAlert(
                        item.bookedPropertyName
                          ? `⛔ هذا التاريخ محجوز لدى "${item.bookedPropertyName}". وفقاً لشروط الدمج، لا يمكن الحجز إلا إذا كانت جميع الاستراحات متاحة بالكامل للعميل الجديد.`
                          : 'اليوم محجوز ومؤكد ولا يمكن تكرار الحجز'
                      );
                      return;
                    }
                  }
                  handleDateClick(dateKey);
                }}
                aria-disabled={isPast || (isConfirmedBooked && !hasCalendarFullAccess)}
                title={
                  isConfirmedBooked
                    ? item.bookedPropertyName
                      ? `محجوز لدى: ${item.bookedPropertyName} (انقر للاطلاع على تفاصيل الحجز)`
                      : hasCalendarFullAccess
                      ? 'حجز مؤكد (انقر للإدارة لإعادة فتح التقويم أو التعديل)'
                      : 'اليوم محجوز ومؤكد ولا يمكن تكرار الحجز'
                    : undefined
                }
                className={`${heightCls} rounded-2xl border p-1 sm:p-1.5 flex flex-col justify-between items-center transition-all relative select-none ${colorClasses} ${todayClasses} ${selectedClasses} ${
                  isPast
                    ? 'cursor-not-allowed pointer-events-none'
                    : isConfirmedBooked && !hasCalendarFullAccess
                    ? 'cursor-pointer'
                    : 'cursor-pointer'
                }`}
              >
                <span
                  className={`leading-none pt-0.5 ${
                    isToday
                      ? 'font-black text-purple-950 font-mono'
                      : isPast
                      ? 'font-medium text-slate-400 line-through decoration-slate-300'
                      : 'font-bold'
                  } ${calendarSize === 'large' ? 'text-[17px]' : 'text-[15px]'}`}
                >
                  {dayNum}
                </span>

                <div className="flex flex-col items-center w-full min-w-0 px-0.5">
                  <span
                    className={`truncate text-center w-full leading-tight ${
                      isPast
                        ? 'text-[12px] font-bold text-slate-400'
                        : calendarSize === 'large'
                        ? 'font-mono font-extrabold text-[13px]'
                        : 'font-mono font-extrabold text-[12px]'
                    } ${
                      isPast
                        ? 'text-slate-400'
                        : isToday
                        ? 'text-slate-950'
                        : status === 'waiting_deposit'
                        ? 'text-amber-800'
                        : status === 'booked'
                        ? 'text-pink-800'
                        : 'text-emerald-800'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* دليل الألوان */}
        <div className="kt-legend">
          <div>
            <i style={{ background: '#E8F8F1', borderColor: '#6EE7B7' }} />
            <span>متاح</span>
          </div>
          <div>
            <i style={{ background: '#FCE7F3', borderColor: '#F9A8D4' }} />
            <span>مؤكد</span>
          </div>
          <div>
            <i style={{ background: '#FEF3C7', borderColor: '#FCD34D' }} />
            <span>عربون</span>
          </div>
          <div>
            <i style={{ background: '#fff', borderColor: '#CBD5E1' }} />
            <span>مغلق</span>
          </div>
          <div>
            <i style={{ background: '#F3E8FF', borderColor: '#7C3AED', borderWidth: 2 }} />
            <span>محدد ({selectedDates.length})</span>
          </div>
        </div>
        <p className="kt-note text-center">الرقم داخل الخانة = سعر الليلة بالريال</p>
      </div>

      {/* لوحة التحكم: الأسعار / الفطور / الإغلاق */}
      <section className="lux-card p-4 space-y-4">
        <Head
          title={selectedDates.length > 0 ? `${selectedDates.length} يوم محدد` : 'تعديل أسعار الأيام'}
          icon={SlidersHorizontal}
          action={<Act small tone="garnS" label="مسح التحديد" onClick={() => setSelectedDates([])} />}
        />

        {/* فتح / إغلاق الأيام المحددة */}
        <div className="kt-sub">
          <span className="kt-sub-t">فتح / إغلاق الأيام المحددة</span>
          <Seg
            compact
            label="حالة الأيام المحددة"
            value={targetStatus}
            onChange={setTargetStatus}
            items={[
              { id: 'available', label: 'متاح' },
              { id: 'blocked', label: 'مغلق' },
            ]}
          />
          <Act tone="ink" icon={Check} label={savedStatusSuccess ? 'تم الحفظ ✓' : 'حفظ الحالة'} onClick={saveStatusSelection} />

          {/* تنبيه وزر إعادة فتح التقويم المخصص للإدارة عند تحديد يوم به حجز مؤكد */}
          {hasCalendarFullAccess && selectedDates.some(isDateBooked) && (
            <div className="kt-warn p-3.5 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 text-[#D9932B] shrink-0" />
                <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#5C3A00]">في الأيام المحددة حجز مؤكد</span>
              </div>
              <Act
                tone="jade"
                icon={Check}
                label="إعادة فتح التقويم"
                title="إعادة فتح التقويم فوراً وإلغاء القفل"
                onClick={() => {
                  handleApplyStatus('available');
                  setTargetStatus('available');
                  setSavedStatusSuccess(true);
                  setTimeout(() => setSavedStatusSuccess(false), 2500);
                }}
              />
            </div>
          )}
        </div>

        {/* تعديل سعر الليلة: نطاق الأيام */}
        <div className="kt-sub">
          <Head
            title="تعديل سعر الليلة"
            icon={DollarSign}
            tone="sand"
            count={selectedDates.length > 0 ? `${selectedDates.length} ليلة` : undefined}
          />
          <div className="kt-field">
            <span className="kt-field-h">
              <span>
                نطاق الأيام — {monthsAr[month]} {year}
              </span>
            </span>
            <div className="kt-g2">
              <Choice title="أيام محددة" sub="تحديد يدوي" selected={quickSelectionMode === 'custom'} onClick={handleSelectCustomDays} />
              <Choice title="كامل الشهر" sub="كل الأيام" selected={quickSelectionMode === 'month'} onClick={handleSelectFullMonth} />
              <Choice title="وسط الأسبوع" sub="سبت – أربعاء" selected={quickSelectionMode === 'weekday'} onClick={handleSelectWeekdays} />
              <Choice title="الويكند" sub="خميس – جمعة" selected={quickSelectionMode === 'weekend'} onClick={handleSelectWeekends} />
            </div>
          </div>
        </div>

        {/* تسعير الليلة والرسوم (مع التزامن الفوري) */}
        {hasCalendarFullAccess && (
          <div className="kt-sub animate-in fade-in duration-200">
            <Head
              title="تسعير الليلة"
              icon={Receipt}
              action={
                <Tag tone="amy">{feeSelectionIsMixed ? 'مختلط' : feePricingTab === 'weekend' ? 'الويكند' : 'وسط الأسبوع'}</Tag>
              }
            />
            <p className="kt-note">
              {selectedProperty.name}
              {feeSelectionIsMixed
                ? ' — تحديد مختلط: عند التطبيق يأخذ كل يوم سعر نوعه.'
                : feePricingTab === 'weekend'
                ? ' — سعر الويكند (خميس / جمعة).'
                : ' — سعر وسط الأسبوع.'}
            </p>

            {!activeSection && (isMultiSection || isEstateSelf) ? (
              <>
                <Infos cols={2}>
                  <Info
                    label={`سعر ${getHierarchyLabels(getPropertyKind(selectedProperty)).whole}`}
                    value={isEstateSelf ? 'مجموع الوحدات' : 'مجموع الأقسام'}
                  />
                  <Info hi label="الليلة المحددة" value={`${selectedDatePrice} ر.س`} />
                </Infos>
                <p className="kt-note">لتعديل السعر اختر الوحدة أو القسم من الأعلى، ويتحدث سعر الكامل تلقائياً.</p>
              </>
            ) : (
              <>
                <div className="kt-f3">
                  <Field label="سعر المالك">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={activeBasePrice}
                      onChange={(e) => handleOwnerBasePriceChange(Number(e.target.value))}
                      className="kt-input kt-num"
                    />
                  </Field>
                  <Field label="الرسوم">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={activeAdminFee}
                      onChange={(e) => handleAdminFeeChange(Number(e.target.value))}
                      className="kt-input kt-num"
                      style={{ color: '#B8435E' }}
                    />
                  </Field>
                  <Field label="سعر المسوقين">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={activeTotalPrice}
                      onChange={(e) => handleNightPriceChange(Number(e.target.value))}
                      className="kt-input kt-num"
                      style={{ background: '#E9F7F2', color: '#0E5A49', boxShadow: 'inset 0 0 0 1px rgba(46,158,134,.55)' }}
                    />
                  </Field>
                </div>
                <p className="kt-note text-center">المالك + الرسوم = سعر المسوقين</p>

                {/* صافي العقار للحالتين (5% و 7%) */}
                <Stats cols={2}>
                  <Stat
                    label="صافي جزئي 5%"
                    value={Math.max(0, activeTotalPrice - Math.round(activeTotalPrice * 0.05) - activeAdminFee)}
                    unit="ر.س"
                    hint={`عمولة ${Math.round(activeTotalPrice * 0.05)} · رسوم ${activeAdminFee}`}
                  />
                  <Stat
                    label="صافي كلي 7%"
                    value={Math.max(0, activeTotalPrice - Math.round(activeTotalPrice * 0.07) - activeAdminFee)}
                    unit="ر.س"
                    hint={`عمولة ${Math.round(activeTotalPrice * 0.07)} · رسوم ${activeAdminFee}`}
                  />
                </Stats>

                <Act
                  tone="gold"
                  icon={Check}
                  label={appliedAdminFeeSuccess ? 'تم التطبيق ✓' : `تطبيق على ${selectedDates.length > 0 ? selectedDates.length : 1} ليلة`}
                  title="تطبيق السعر الإجمالي والرسوم على الأيام المحددة"
                  onClick={handleApplyFeesModelToCalendar}
                />
              </>
            )}

            {/* حجز الإدارة المباشر */}
            <Act
              tone="ink"
              icon={Crown}
              label={`حجز الإدارة · ${priceInput || activeTotalPrice} ر.س`}
              title="حجز الإدارة (سعر مباشر مخصص)"
              onClick={handleOpenAdminBookingModal}
            />

            <Acts cols={2}>
              <Act
                tone="soft"
                icon={RefreshCw}
                label="مزامنة السعر"
                title={`مزامنة الإجمالي من سعر التقويم (${activeTotalPrice})`}
                onClick={handleSyncFromCalendarPrice}
              />
              <Act tone="soft" icon={Receipt} label="جدول الرسوم" title="جدول معاملات الرسوم" onClick={() => setAdminFeesLedgerOpen(true)} />
            </Acts>
          </div>
        )}

        {/* مواسم التسعير المخصصة */}
        {hasCalendarFullAccess && <CustomPricingSection />}

        {/* وجبة الإفطار */}
        <div className="kt-sub">
          <Head title="وجبة الإفطار" icon={Utensils} tone="sand" />
          <Seg
            compact
            label="توفر الإفطار في هذا العقار"
            value={breakfastInputs.enabled ? 'on' : 'off'}
            onChange={(v) => setBreakfastInputs((prev) => ({ ...prev, enabled: v === 'on' }))}
            items={[
              { id: 'on', label: 'يوجد فطور' },
              { id: 'off', label: 'لا يوجد' },
            ]}
          />

          {breakfastInputs.enabled ? (
            <>
              <Infos cols={1}>
                <Info
                  hi
                  label="الموسم المحدد للتطبيق"
                  value={`${
                    { weekday: 'وسط الأسبوع', weekend: 'الويكند', vacation: 'الإجازات', eid: 'الأعياد', summer: 'الصيف' }[
                      selectedBreakfastTier
                    ]
                  } — ${activeBreakfastAmount} ر.س`}
                />
              </Infos>

              <div className="kt-g2">
                <Rate
                  label="وسط الأسبوع"
                  value={breakfastInputs.weekday}
                  selected={selectedBreakfastTier === 'weekday'}
                  onSelect={() => setSelectedBreakfastTier('weekday')}
                  onChange={(n) => setBreakfastInputs((prev) => ({ ...prev, weekday: n }))}
                />
                <Rate
                  label="الويكند"
                  value={breakfastInputs.weekend}
                  selected={selectedBreakfastTier === 'weekend'}
                  onSelect={() => setSelectedBreakfastTier('weekend')}
                  onChange={(n) => setBreakfastInputs((prev) => ({ ...prev, weekend: n }))}
                />
                <Rate
                  label="الإجازات"
                  value={breakfastInputs.vacation}
                  selected={selectedBreakfastTier === 'vacation'}
                  onSelect={() => setSelectedBreakfastTier('vacation')}
                  onChange={(n) => setBreakfastInputs((prev) => ({ ...prev, vacation: n }))}
                />
                <Rate
                  label="الأعياد"
                  value={breakfastInputs.eid}
                  selected={selectedBreakfastTier === 'eid'}
                  onSelect={() => setSelectedBreakfastTier('eid')}
                  onChange={(n) => setBreakfastInputs((prev) => ({ ...prev, eid: n }))}
                />
                <Rate
                  label="الصيف"
                  value={breakfastInputs.summer}
                  selected={selectedBreakfastTier === 'summer'}
                  onSelect={() => setSelectedBreakfastTier('summer')}
                  onChange={(n) => setBreakfastInputs((prev) => ({ ...prev, summer: n }))}
                />
              </div>

              <Act
                tone="gold"
                icon={Utensils}
                label={
                  appliedBreakfastDatesSuccess
                    ? 'تم التطبيق ✓'
                    : selectedDates.length > 0
                    ? `تطبيق على ${selectedDates.length} ليلة`
                    : 'حدد أيامًا من التقويم'
                }
                title={`تطبيق سعر الإفطار المحدد (${activeBreakfastAmount} ر.س) على التواريخ المحددة بالتقويم`}
                disabled={selectedDates.length === 0}
                onClick={handleApplyBreakfastToDates}
              />
              <p className="kt-note text-center">
                {selectedDates.length > 0
                  ? `قيمة الإفطار المخصومة لو أُلغي: ${activeBreakfastAmount * selectedDates.length} ر.س`
                  : 'حدد تواريخ من التقويم لتطبيق سعر الإفطار عليها'}
              </p>
            </>
          ) : (
            /* في حال تم اختيار لا يوجد فطور */
            <div className="kt-warn p-3.5 space-y-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 text-[#D9932B] shrink-0" />
                <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#5C3A00]">العقار بدون إفطار</span>
              </div>
              <p className="kt-note">سعر الحجز للإقامة فقط، دون احتساب أو خصم للإفطار.</p>
              {selectedDates.length > 0 && (
                <Act
                  tone="garnS"
                  label={appliedBreakfastDatesSuccess ? 'تم الإلغاء ✓' : `إلغاء الإفطار على ${selectedDates.length} ليلة`}
                  title="تأكيد إلغاء الإفطار على التواريخ المحددة بالتقويم"
                  onClick={handleApplyBreakfastToDates}
                />
              )}
            </div>
          )}
        </div>

        {/* إغلاق / فتح العقار كامل */}
        <Act
          tone={selectedProperty.isPublished ? 'garnS' : 'jadeS'}
          icon={selectedProperty.isPublished ? Lock : Unlock}
          label={selectedProperty.isPublished ? 'إغلاق العقار كامل' : 'فتح العقار كامل'}
          title={selectedProperty.isPublished ? 'إغلاق العقار كامل' : 'فتح العقار كامل لجميع الأيام'}
          onClick={() => togglePropertyPublished(selectedPropertyId)}
        />
      </section>

      {/* الشارت السريع */}
      <section className="lux-card p-4 space-y-4">
        <Head
          title="الشارت السريع"
          icon={TrendingUp}
          tone="jade"
          count={`${totalNights} ${totalNights === 1 ? 'ليلة' : 'ليالٍ'}`}
        />

        <Infos cols={2}>
          <Info label="تاريخ الدخول" value={checkInDate} ltr />
          <Info label="تاريخ الخروج" value={checkOutDate} ltr />
          <Info label="عدد الليالي" value={totalNights} />
          <Info label="إجمالي الفترة" value={`${estimatedTotal} ر.س`} />
          <Info wide hi label="عمولة 5%" value={`${estimatedCommission} ر.س`} />
        </Infos>

        {/* Booked Conflict Warning Banner for Marketer */}
        {(() => {
          const bookedInSelection = selectedDates.filter((d) => isDateBooked(d));
          if (bookedInSelection.length === 0) return null;
          const conflictInfos = bookedInSelection.map((d) => ({
            date: d,
            ...getDateBookingConflict(d),
          }));
          const uniqueNames = Array.from(new Set(conflictInfos.map((c) => c.bookedPropertyName).filter(Boolean)));
          const namesText = uniqueNames.join(' و ');

          return (
            <div className="kt-err kt-col">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="flex-1 min-w-0 truncate">تاريخ محجوز لدى استراحة مرتبطة</span>
                <Tag tone="garn">
                  {bookedInSelection.length} {bookedInSelection.length === 1 ? 'يوم' : 'أيام'}
                </Tag>
              </div>
              <p className="text-[13.5px] font-semibold leading-relaxed">
                محجوز لدى: <b>{namesText || 'استراحة أخرى'}</b>. لا يمكن الحجز للعميل الجديد إلا إذا كانت كل الاستراحات المرتبطة متاحة.
              </p>
              <Infos cols={1}>
                {conflictInfos.map((c) => (
                  <Info key={c.date} label={c.date} ltr value={c.bookedPropertyName || 'استراحة مرتبطة'} />
                ))}
              </Infos>
            </div>
          );
        })()}

        {(() => {
          const bookedInSelection = selectedDates.filter((d) => isDateBooked(d));
          const hasBooked = bookedInSelection.length > 0;
          let blockedNames = '';
          if (hasBooked) {
            const conflictInfos = bookedInSelection.map((d) => getDateBookingConflict(d));
            const uniqueNames = Array.from(new Set(conflictInfos.map((c) => c.bookedPropertyName).filter(Boolean)));
            blockedNames = uniqueNames.join(' و ');
          }
          const isPastStart = checkInDate < todayStr;

          return (
            <div className="space-y-3">
              <Act
                tone={hasBooked ? 'garnS' : 'ink'}
                icon={Sparkles}
                label={hasBooked ? 'غير متاح للحجز' : isPastStart ? 'التاريخ فائت' : 'المتابعة للحجز'}
                disabled={isPastStart || hasBooked}
                onClick={() => {
                  if (isPastStart) return;
                  if (hasBooked) {
                    showBlockedAlert(
                      blockedNames
                        ? `⛔ هذا التاريخ محجوز لدى "${blockedNames}". لا يمكن الحجز إلا إذا كانت جميع الاستراحات متاحة بالكامل للعميل الجديد.`
                        : 'اليوم محجوز ومؤكد ولا يمكن تكرار الحجز'
                    );
                    return;
                  }
                  setPreselectedDateForBooking(checkInDate);
                  if (activeSectionId && activeSectionId !== 'all') {
                    setPreselectedSectionForBooking(activeSectionId);
                  }
                  setActiveTab('bookings');
                }}
              />
              <p className="kt-note text-center">
                {hasBooked
                  ? `محجوز لدى: ${blockedNames || 'استراحة مرتبطة'}`
                  : isPastStart
                  ? 'اختر تاريخ اليوم أو تاريخًا قادمًا.'
                  : `${activeSection ? `${activeSection.name} · ` : ''}يُطلب العربون خلال 15 دقيقة من صفحة الحجوزات.`}
              </p>

              {/* زر سريع للإدارة: حجز الإدارة */}
              {hasCalendarFullAccess && !hasBooked && !isPastStart && (
                <Act
                  tone="soft"
                  icon={Crown}
                  label="حجز الإدارة"
                  title="حجز الإدارة (سعر مباشر مخصص)"
                  onClick={handleOpenAdminBookingModal}
                />
              )}
            </div>
          );
        })()}
      </section>

      {/* مزامنة التقويم (iCal) */}
      {syncModalOpen && (
        <Sheet
          wide
          title="ربط التقويم"
          icon={Link2}
          tone="jade"
          onClose={() => setSyncModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act
                tone="jade"
                icon={RefreshCw}
                label={syncing ? 'جارٍ المزامنة…' : 'مزامنة الآن'}
                title="حفظ ومزامنة فورية الآن"
                disabled={syncing}
                onClick={handleManualSync}
              />
              <Act tone="line" label="إغلاق" onClick={() => setSyncModalOpen(false)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info wide label="العقار" value={selectedProperty.name} />
          </Infos>

          {syncSuccessMsg && (
            <div className="kt-ok" role="status">
              <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{syncSuccessMsg}</span>
              </span>
            </div>
          )}

          {/* التصدير */}
          <div className="kt-sub">
            <p className="kt-sub-t">رابط تقويم العقار</p>
            <Field label="للتصدير (Export)" hint="مباشر ومحدّث">
              <input
                type="text"
                readOnly
                dir="ltr"
                className="kt-input"
                value={`https://amasa.app/api/calendar/ical/${selectedPropertyId}.ics?key=auth_sync_2026`}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Field>
            <Act
              tone="ink"
              icon={copiedKey === 'export' ? Check : Copy}
              label={copiedKey === 'export' ? 'تم النسخ' : 'نسخ الرابط'}
              onClick={() =>
                copyToClipboard(`https://amasa.app/api/calendar/ical/${selectedPropertyId}.ics?key=auth_sync_2026`, 'export')
              }
            />
          </div>

          {/* الاستيراد */}
          <div className="kt-sub">
            <p className="kt-sub-t">استيراد من المنصات (Import)</p>
            <Field label="جاذر إن" hint={syncStatuses[selectedPropertyId]?.gathern ? 'متصل ✓' : 'غير مربوط'}>
              <input
                type="url"
                dir="ltr"
                className="kt-input"
                placeholder="https://gathern.co/calendars/.../sync.ics"
                value={gathernIcalUrl}
                onChange={(e) => setGathernIcalUrl(e.target.value)}
              />
            </Field>
            <Field label="بوكينج" hint={syncStatuses[selectedPropertyId]?.booking ? 'متصل ✓' : 'غير مربوط'}>
              <input
                type="url"
                dir="ltr"
                className="kt-input"
                placeholder="https://admin.booking.com/.../ical.html?t=..."
                value={bookingIcalUrl}
                onChange={(e) => setBookingIcalUrl(e.target.value)}
              />
            </Field>
            <Field label="منصات أخرى (Airbnb)" hint="اختياري">
              <input
                type="url"
                dir="ltr"
                className="kt-input"
                placeholder="https://www.airbnb.com/calendar/ical/...ics"
                value={airbnbIcalUrl}
                onChange={(e) => setAirbnbIcalUrl(e.target.value)}
              />
            </Field>
          </div>

          <Infos cols={2}>
            <Info label="التحديث التلقائي" value="كل 10 دقائق" />
            <Info label="آخر تحديث" value={syncStatuses[selectedPropertyId]?.lastSync || 'لم يتم بعد'} />
          </Infos>
        </Sheet>
      )}

      {/* تفاصيل حجز التاريخ المحدد (غير متاح) */}
      {selectedBookingDetail && (
        <Sheet
          title="تاريخ غير متاح"
          icon={Lock}
          tone="garn"
          onClose={() => setSelectedBookingDetail(null)}
          footer={<Act tone="ink" label="إغلاق" onClick={() => setSelectedBookingDetail(null)} />}
        >
          <Infos cols={2}>
            <Info ltr label="التاريخ" value={selectedBookingDetail.dateKey} />
            <Info hi label="محجوز لدى" value={selectedBookingDetail.bookedPropertyName} />
          </Infos>
          {selectedBookingDetail.reasonText && <p className="kt-note">{selectedBookingDetail.reasonText}</p>}

          {selectedBookingDetail.booking && (
            <div className="kt-sub">
              <p className="kt-sub-t">بيانات الحجز #{selectedBookingDetail.booking.id}</p>
              <Infos cols={2}>
                <Info label="العميل" value={selectedBookingDetail.booking.customerName} />
                <Info
                  label="الحالة"
                  value={
                    <>
                      {selectedBookingDetail.booking.status === 'confirmed' ? 'مؤكد' : selectedBookingDetail.booking.status}
                      {selectedBookingDetail.booking.isSpecialBooking ? ' · خاص 0%' : ''}
                      {selectedBookingDetail.booking.isAdminBooking ? ' · إدارة' : ''}
                    </>
                  }
                />
                <Info ltr label="الدخول" value={selectedBookingDetail.booking.checkInDate} />
                <Info ltr label="الخروج" value={selectedBookingDetail.booking.checkOutDate} />
              </Infos>
              {selectedBookingDetail.booking.propertyNetPayout !== undefined && (
                <Infos cols={3}>
                  <Info label="سعر الليلة" value={`${selectedBookingDetail.booking.nightlyPrice} ر.س`} />
                  <Info label="الرسوم" value={`${selectedBookingDetail.booking.adminFee || 0} ر.س`} />
                  <Info hi label="صافي العقار" value={`${selectedBookingDetail.booking.propertyNetPayout} ر.س`} />
                </Infos>
              )}
            </div>
          )}
        </Sheet>
      )}

      {/* حجز الإدارة: تعديل مباشر لسعر الليلة — بلا رسوم إدارية وبلا عمولة مسوق */}
      {adminBookingModalOpen && (() => {
        const datesToBook = getSelectedDatesForBooking();
        const nights = datesToBook.length;
        const baseTotal = adminCustomNightPrice * nights;
        const grandTotal = baseTotal;
        const propertyNet = grandTotal; // كامل السعر المباشر صافي للعقار

        return (
          <Sheet
            wide
            lockBackdrop
            title="حجز الإدارة"
            icon={Crown}
            tone="sand"
            onClose={() => setAdminBookingModalOpen(false)}
            footer={
              <Acts cols={2}>
                <Act
                  tone="ink"
                  icon={Crown}
                  label="تأكيد الحجز"
                  title="تأكيد حجز الإدارة وإقفال التقويم"
                  onClick={handleConfirmAdminBooking}
                />
                <Act tone="line" label="إلغاء" onClick={() => setAdminBookingModalOpen(false)} />
              </Acts>
            }
          >
            <Infos cols={2}>
              <Info label="العقار" value={selectedProperty.name} />
              <Info label="المدة" value={nightsText(nights)} />
              <Info
                wide
                ltr
                label="التاريخ"
                value={`${datesToBook[0]}${nights > 1 ? ` ← ${datesToBook[datesToBook.length - 1]}` : ''}`}
              />
            </Infos>

            <Field label="سعر الليلة (ر.س)" hint="تعديل مباشر">
              <input
                type="number"
                min="0"
                className="kt-input kt-num"
                value={adminCustomNightPrice}
                onChange={(e) => setAdminCustomNightPrice(Math.max(0, Number(e.target.value)))}
              />
            </Field>
            <Acts cols={4}>
              {[100, 50, -50, -100].map((delta) => (
                <Act
                  key={delta}
                  small
                  tone="soft"
                  label={delta > 0 ? `+${delta}` : `${delta}`}
                  title={`تعديل السعر ${delta > 0 ? '+' : ''}${delta}`}
                  onClick={() => setAdminCustomNightPrice((prev) => Math.max(0, prev + delta))}
                />
              ))}
            </Acts>

            <div className="kt-sub">
              <p className="kt-sub-t">ملخص الحجز</p>
              <Infos cols={2}>
                <Info label="إجمالي النزيل" value={`${grandTotal.toLocaleString('en-US')} ر.س`} />
                <Info hi label="صافي العقار" value={`${propertyNet.toLocaleString('en-US')} ر.س`} />
                <Info label="الرسوم الإدارية" value="معفى 0" />
                <Info label="عمولة المسوق" value="معفى 0%" />
              </Infos>
            </div>

            <div className="kt-fields">
              <Field label="اسم العميل" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="اسم العميل"
                  value={adminCustName}
                  onChange={(e) => setAdminCustName(e.target.value)}
                />
              </Field>
              <Field label="الجوال">
                <input
                  type="tel"
                  dir="ltr"
                  className="kt-input kt-num"
                  placeholder="05xxxxxxxx"
                  value={adminCustPhone}
                  onChange={(e) => setAdminCustPhone(e.target.value)}
                />
              </Field>
              <Field label="العربون (ر.س)">
                <input
                  type="number"
                  min="0"
                  className="kt-input kt-num"
                  value={adminBookingDeposit}
                  onChange={(e) => setAdminBookingDeposit(Math.max(0, Number(e.target.value)))}
                />
              </Field>
              <Field label="سبب الحجز" hint="اختياري" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="سعر تفاوضي، خصم إداري…"
                  value={adminBookingNotes}
                  onChange={(e) => setAdminBookingNotes(e.target.value)}
                />
              </Field>
            </div>

            <div className="kt-field">
              <span className="kt-field-h">
                <span>إيصال التحويل</span>
                <em>اختياري</em>
              </span>
              <FilePick
                name={adminDepositReceiptFile?.name}
                placeholder="اختيار صورة أو PDF"
                error={adminReceiptError}
                onClear={() => setAdminDepositReceiptFile(null)}
                onPick={async (file) => {
                  setAdminReceiptError(null);
                  if (!file) return;
                  try {
                    const prepared = await prepareReceiptFileForAppStorage(file);
                    setAdminDepositReceiptFile(prepared);
                  } catch (err: any) {
                    setAdminReceiptError(err?.message || 'تعذر تجهيز ملف الإيصال.');
                  }
                }}
              />
            </div>

            <Row
              title="تحديث أسعار التقويم"
              sub={`للأيام المحددة إلى ${adminCustomNightPrice} ر.س`}
              end={<Switch on={adminUpdateCalendarPrice} onChange={setAdminUpdateCalendarPrice} label="تحديث سعر هذه الأيام في جدول التقويم" />}
            />

            {adminSuccessMsg && (
              <div className="kt-ok" role="status">
                <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                  <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
                  <span>{adminSuccessMsg}</span>
                </span>
              </div>
            )}
          </Sheet>
        );
      })()}

      {/* Administrative Fees Financial Ledger Modal */}
      <AdministrativeFeesLedgerModal
        isOpen={adminFeesLedgerOpen}
        onClose={() => setAdminFeesLedgerOpen(false)}
      />
    </div>
  );
};
