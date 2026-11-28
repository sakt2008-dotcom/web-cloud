import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  findEstateParent,
  getEstateOptions,
  estateBookingBlocksUnit,
  isLinkedEstate,
  getEstateParts,
  partKey,
  describeEstateParts,
  getPartsNightPrice,
  bookingOccupiesPart,
  getPropertyKind,
  getHierarchyLabels,
} from '../../lib/propertyUtils';
import { PropertySelect } from '../shared/PropertySelect';
import { EstateOptionsBar } from '../shared/EstateOptionsBar';
import { EstateBookingBuilder } from '../shared/EstateBookingBuilder';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShieldCheck,
  Calculator,
  Plus,
  X,
  Check,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Sparkles,
  LogOut,
  BadgeDollarSign,
  Send,
  MapPin,
  MapPinned,
  Home,
  Film,
  FileText,
  Paperclip,
  Copy,
  Edit2,
  MessageCircle,
  ExternalLink,
  Share2,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Head, Tag, Tile, Seg, Infos, Info, Acts, Act, Choice, Field, Tool, Sheet, IconBtn } from '../ui/kit';
import { SupervisorPayoutPanel } from '../financials/SupervisorPayoutPanel';
import { SpecialAdminFeesSection } from '../calendar/SpecialAdminFeesSection';
import { Booking } from '../../types';
import { SmartVideoPlayer } from '../video/VideoUploader';
import { isExternalVideoLink, shareOrDownloadVideoFile } from '../../lib/mediaStorage';
import { BookingReceiptsModal } from '../modals/BookingReceiptsModal';
import { PrintableContractModal } from '../modals/PrintableContractModal';
import {
  getBookingReceiptsList,
  isPdfReceiptUrl,
  prepareReceiptFileForAppStorage,
} from '../../lib/bookingReceipts';
import {
  isBookingCheckedOut,
  isSupervisorBooking as checkIsSupervisorBooking,
  getSupervisorBookingTotalCredit,
  getBookingCommissionAmount,
  getBookingAdminFeeAmount,
} from '../../lib/financials';

const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

type SelectionPatternMode = 'custom' | 'full_month' | 'weekday' | 'weekend';

export const SupervisorTab: React.FC = () => {
  const {
    properties,
    selectedPropertyId,
    setSelectedPropertyId,
    selectedProperty,
    bookings,
    marketers,
    currentMarketer,
    isAdmin,
    isSupervisor,
    canViewSupervisor,
    canEditDeposit,
    canCreateContract,
    dateOverrides,
    nowTimestamp,
    supervisorDateOverrides,
    setSupervisorDateOverridesBulk,
    customSupervisorRates,
    addCustomSupervisorRate,
    removeCustomSupervisorRate,
    specialAdminFeeBoxes,
    addBooking,
    requestDeposit,
    cancelDepositWait,
    extendDepositWait,
    updateWaitingDepositAmount,
    confirmBookingWithReceipt,
    markCheckedOut,
    payoutSupervisorBalance,
  } = useApp();

  const hasAccess = isAdmin || (isSupervisor && canViewSupervisor);

  const todayStr = useMemo(() => {
    const now = new Date(nowTimestamp);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [nowTimestamp]);

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [selectMode, setSelectMode] = useState<'range' | 'multi'>('multi');
  const [calendarSize, setCalendarSize] = useState<'compact' | 'normal' | 'large'>('normal');
  const [selectedDates, setSelectedDates] = useState<string[]>([todayStr]);
  const [patternMode, setPatternMode] = useState<SelectionPatternMode>('custom');

  // Pricing counters (Owner + Supervisor Fee = Supervisor Visible Total Price)
  const [ownerPriceInput, setOwnerPriceInput] = useState<number>(1000);
  const [supervisorFeeInput, setSupervisorFeeInput] = useState<number>(400);
  const [totalPriceInput, setTotalPriceInput] = useState<number>(1400);
  const [appliedOverridesToast, setAppliedOverridesToast] = useState<string | null>(null);

  // Commission percentage selector (5%, 7%, + dynamic custom rates)
  const [selectedRatePercent, setSelectedRatePercent] = useState<number>(5);
  const [newRateInput, setNewRateInput] = useState<string>('');
  const [rateError, setRateError] = useState<string | null>(null);

  // Customer info, deposit request, receipt, and modals state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('05');
  const [custNationalId, setCustNationalId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [guestsCountInput, setGuestsCountInput] = useState(() =>
    selectedProperty.capacity ? String(selectedProperty.capacity) : ''
  );
  const [depositInput, setDepositInput] = useState<number>(() => selectedProperty.defaultDeposit || 250);
  const [editDepositModalOpen, setEditDepositModalOpen] = useState(false);
  const [tempDepositValue, setTempDepositValue] = useState<number>(() => selectedProperty.defaultDeposit || 250);
  const [bookingNotes, setBookingNotes] = useState('');
  const [infoModalType, setInfoModalType] = useState<'info' | 'photos' | 'location' | 'contract' | null>(null);
  const [receiptFile, setReceiptFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [sharingVideoKey, setSharingVideoKey] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [sentMessageData, setSentMessageData] = useState<{
    title: string;
    text: string;
    whatsappUrl: string;
    phone: string;
  } | null>(null);
  const [confirmedContractData, setConfirmedContractData] = useState<{
    booking: Booking;
    contractText: string;
    whatsappUrl: string;
    bookingNumber: string;
  } | null>(null);
  const [viewCardContractBooking, setViewCardContractBooking] = useState<Booking | null>(null);

  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(() => {
    if (!isAdmin && currentMarketer?.id) return currentMarketer.id;
    const firstSup = marketers.find((m) => m.isSupervisor);
    return firstSup?.id || currentMarketer?.id || '';
  });
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [copiedSentMsg, setCopiedSentMsg] = useState(false);

  const showActionToast = (type: 'error' | 'success', text: string) => {
    setActionToast({ type, text });
    setTimeout(() => setActionToast(null), 3500);
  };

  // Supervisor list for Admin assignment & balance view
  const supervisorMembers = useMemo(
    () => marketers.filter((m) => m.isSupervisor),
    [marketers]
  );

  useEffect(() => {
    if (!isAdmin && currentMarketer?.id) {
      setSelectedAssigneeId(currentMarketer.id);
    } else if (isAdmin && !selectedAssigneeId && supervisorMembers.length > 0) {
      setSelectedAssigneeId(supervisorMembers[0].id);
    }
  }, [isAdmin, currentMarketer?.id, selectedAssigneeId, supervisorMembers]);

  const estateParent = useMemo(() => findEstateParent(selectedProperty, properties), [selectedProperty, properties]);
  const [estateCtx, setEstateCtx] = useState<string | null>(null);
  const estateOptions = useMemo(() => (estateParent ? getEstateOptions(estateParent, properties) : []), [estateParent, properties]);

  // حجز العقار المدمج («المزرعة»): الافتراضي كل الأجزاء، ويمكن إلغاء وحدة أو قسم — مثل صفحة الحجوزات
  const isEstateSelf = isLinkedEstate(selectedProperty);
  const estateAllParts = useMemo(
    () => (isEstateSelf ? getEstateParts(selectedProperty, properties) : []),
    [isEstateSelf, selectedProperty, properties]
  );
  const [selectedPartKeys, setSelectedPartKeys] = useState<string[] | null>(null);
  useEffect(() => {
    setSelectedPartKeys(null);
  }, [selectedPropertyId]);
  const selectedParts = useMemo(
    () => estateAllParts.filter((p) => selectedPartKeys === null || selectedPartKeys.includes(partKey(p))),
    [estateAllParts, selectedPartKeys]
  );
  const estatePartsLabel = isEstateSelf ? describeEstateParts(selectedParts, selectedProperty, properties) : '';
  const estateSectionName = isEstateSelf ? estatePartsLabel : undefined;
  const estatePartsExtra = isEstateSelf ? { estateParts: selectedParts } : {};

  // Reset active section if property changes and doesn't have the section
  useEffect(() => {
    if (activeSectionId !== 'all') {
      const exists = selectedProperty.sections?.some((s) => s.id === activeSectionId);
      if (!exists) setActiveSectionId('all');
    }
    setDepositInput(selectedProperty.defaultDeposit || 250);
  }, [selectedPropertyId, selectedProperty, activeSectionId]);

  const activeSection = useMemo(() => {
    if (isLinkedEstate(selectedProperty) || !selectedProperty.sections || activeSectionId === 'all') return null;
    return selectedProperty.sections.find((s) => s.id === activeSectionId) || null;
  }, [selectedProperty, activeSectionId]);

  // Double-booking prevention: checks ALL non-cancelled bookings (regular + Supervisor + merged)
  const getDateBookingConflict = useCallback(
    (dateKey: string) => {
      const isMerged = selectedProperty.isMergedProperty || selectedProperty.mergedConfig?.isMerged;
      const mergeType = selectedProperty.mergedConfig?.mergeType;
      const linkedIds = selectedProperty.mergedConfig?.linkedPropertyIds || selectedProperty.mergedPropertyIds || [];

      if (isEstateSelf) {
        const hit = bookings.find((b) => {
          if (b.status === 'cancelled') return false;
          if (!(dateKey >= b.checkInDate && dateKey < b.checkOutDate)) return false;
          return selectedParts.some((part) => bookingOccupiesPart(b, part, selectedProperty));
        });
        return hit ? { isBooked: true, booking: hit } : { isBooked: false, booking: undefined };
      }

      const directBooking = bookings.find((b) => {
        if (b.propertyId !== selectedPropertyId || b.status === 'cancelled') return false;
        if (!(dateKey >= b.checkInDate && dateKey < b.checkOutDate)) return false;

        if ((selectedProperty.sections?.length || 0) >= 2) {
          if (!activeSection) return true;
          return !b.sectionId || b.sectionId === 'all' || b.sectionId === activeSection.id;
        }

        return !activeSection || !b.sectionId || b.sectionId === activeSection.id;
      });

      if (directBooking) {
        return { isBooked: true, booking: directBooking };
      }

      if (isMerged && mergeType === 'linked_properties' && linkedIds.length > 0) {
        const linkedBooking = bookings.find((b) => {
          if (b.status === 'cancelled') return false;
          if (!linkedIds.includes(b.propertyId)) return false;
          return dateKey >= b.checkInDate && dateKey < b.checkOutDate;
        });
        if (linkedBooking) {
          return { isBooked: true, booking: linkedBooking };
        }
      }

      const parentMergers = properties.filter(
        (p) =>
          p.id !== selectedPropertyId &&
          p.isMergedProperty &&
          (p.mergedConfig?.linkedPropertyIds?.includes(selectedPropertyId) ||
            p.mergedPropertyIds?.includes(selectedPropertyId))
      );
      if (parentMergers.length > 0) {
        const parentIds = parentMergers.map((p) => p.id);
        const parentBooking = bookings.find((b) => {
          if (b.status === 'cancelled') return false;
          if (!parentIds.includes(b.propertyId)) return false;
          if (!estateBookingBlocksUnit(b, selectedPropertyId, activeSection ? activeSection.id : null)) return false;
          return dateKey >= b.checkInDate && dateKey < b.checkOutDate;
        });
        if (parentBooking) {
          return { isBooked: true, booking: parentBooking };
        }
      }

      return { isBooked: false, booking: undefined };
    },
    [bookings, selectedPropertyId, selectedProperty, activeSection, properties, isEstateSelf, selectedParts]
  );

  // Resolve ownerPrice + supervisorFee + totalPrice for any single date
  const getSupervisorPricingForDate = useCallback(
    (dateKey: string) => {
      const sectionKey = activeSection
        ? `${selectedPropertyId}_${activeSection.id}_${dateKey}`
        : `${selectedPropertyId}_${dateKey}`;
      const ov =
        supervisorDateOverrides[sectionKey] ||
        supervisorDateOverrides[`${selectedPropertyId}_${dateKey}`];

      const dObj = new Date(dateKey);
      const isWknd = dObj.getDay() === 4 || dObj.getDay() === 5;

      const matchedBox =
        specialAdminFeeBoxes.find(
          (b) =>
            (b.propertyId === selectedPropertyId || b.propertyId === 'all') &&
            b.period === (isWknd ? 'weekend' : 'weekday')
        ) ||
        specialAdminFeeBoxes.find(
          (b) => b.propertyId === selectedPropertyId || b.propertyId === 'all'
        );

      let defaultOwner = 1000;
      if (isEstateSelf) {
        defaultOwner = getPartsNightPrice(selectedParts, properties, dateOverrides, dateKey);
      } else if (activeSection) {
        defaultOwner = isWknd ? activeSection.priceWeekend : activeSection.priceWeekday;
      } else if (selectedProperty.sections && selectedProperty.sections.length >= 2) {
        defaultOwner = selectedProperty.sections.reduce(
          (sum, sec) => sum + (Number(isWknd ? sec.priceWeekend : sec.priceWeekday) || 0),
          0
        );
      } else {
        defaultOwner = isWknd
          ? selectedProperty.seasonalPricing?.weekend || selectedProperty.basePriceWeekend || 1600
          : selectedProperty.seasonalPricing?.weekday || selectedProperty.basePriceWeekday || 1200;
      }

      const defaultFee = matchedBox ? matchedBox.specialAdminFee : isWknd ? 500 : 400;

      const ownerPrice =
        ov?.ownerPrice !== undefined ? Math.max(0, Number(ov.ownerPrice)) : defaultOwner;
      const supervisorFee =
        ov?.supervisorFee !== undefined ? Math.max(0, Number(ov.supervisorFee)) : defaultFee;
      const totalPrice =
        ov?.totalPrice !== undefined ? Math.max(0, Number(ov.totalPrice)) : ownerPrice + supervisorFee;

      return {
        ownerPrice,
        supervisorFee,
        totalPrice,
        hasOverride: Boolean(ov),
      };
    },
    [supervisorDateOverrides, activeSection, selectedPropertyId, selectedProperty, specialAdminFeeBoxes, isEstateSelf, selectedParts, properties, dateOverrides]
  );

  // Sync pricing counters whenever selected dates / property / section change
  const sortedSelected = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const selectedKey = sortedSelected.join(',');

  useEffect(() => {
    const targetDate = sortedSelected[0] || todayStr;
    const pricing = getSupervisorPricingForDate(targetDate);
    setOwnerPriceInput(pricing.ownerPrice);
    setSupervisorFeeInput(pricing.supervisorFee);
    setTotalPriceInput(pricing.ownerPrice + pricing.supervisorFee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, selectedPropertyId, activeSectionId]);

  // Filter out booked/past dates automatically when bookings change
  useEffect(() => {
    setSelectedDates((prev) => {
      const cleaned = prev.filter((d) => d >= todayStr && !getDateBookingConflict(d).isBooked);
      if (cleaned.length > 0) return cleaned;
      return getDateBookingConflict(todayStr).isBooked ? [] : [todayStr];
    });
  }, [todayStr, getDateBookingConflict]);

  // Build month days array
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateKey: string | null; dayNum: number | null; isWeekend: boolean }[] = [];
    for (let i = 0; i < startingWeekday; i++) {
      cells.push({ dateKey: null, dayNum: null, isWeekend: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${mStr}-${dStr}`;
      const dow = new Date(year, month, d).getDay();
      cells.push({
        dateKey,
        dayNum: d,
        isWeekend: dow === 4 || dow === 5,
      });
    }
    return cells;
  }, [currentMonthDate]);

  // All unbooked future dates in active month
  const availableMonthDates = useMemo(() => {
    return calendarDays
      .filter((c) => c.dateKey && c.dateKey >= todayStr && !getDateBookingConflict(c.dateKey).isBooked)
      .map((c) => c.dateKey as string);
  }, [calendarDays, todayStr, getDateBookingConflict]);

  const handleSelectPattern = (mode: SelectionPatternMode) => {
    setPatternMode(mode);
    if (mode === 'full_month') {
      setSelectedDates(availableMonthDates);
      if (availableMonthDates[0]) {
        const p = getSupervisorPricingForDate(availableMonthDates[0]);
        setOwnerPriceInput(p.ownerPrice);
        setSupervisorFeeInput(p.supervisorFee);
        setTotalPriceInput(p.ownerPrice + p.supervisorFee);
      }
      return;
    }
    if (mode === 'weekday') {
      const dates = availableMonthDates.filter((d) => {
        const dow = new Date(d).getDay();
        return dow !== 4 && dow !== 5;
      });
      setSelectedDates(dates);
      if (dates[0]) {
        const p = getSupervisorPricingForDate(dates[0]);
        setOwnerPriceInput(p.ownerPrice);
        setSupervisorFeeInput(p.supervisorFee);
        setTotalPriceInput(p.ownerPrice + p.supervisorFee);
      }
      return;
    }
    if (mode === 'weekend') {
      const dates = availableMonthDates.filter((d) => {
        const dow = new Date(d).getDay();
        return dow === 4 || dow === 5;
      });
      setSelectedDates(dates);
      if (dates[0]) {
        const p = getSupervisorPricingForDate(dates[0]);
        setOwnerPriceInput(p.ownerPrice);
        setSupervisorFeeInput(p.supervisorFee);
        setTotalPriceInput(p.ownerPrice + p.supervisorFee);
      }
      return;
    }
    // custom
    if (selectedDates.length === 0 && availableMonthDates[0]) {
      setSelectedDates([availableMonthDates[0]]);
    }
  };

  const handleDayClick = (dateKey: string) => {
    if (dateKey < todayStr) return;
    if (getDateBookingConflict(dateKey).isBooked) return;
    setPatternMode('custom');

    if (selectMode === 'multi') {
      setSelectedDates((prev) =>
        prev.includes(dateKey) ? prev.filter((d) => d !== dateKey) : [...prev, dateKey].sort()
      );
    } else {
      if (selectedDates.length === 0 || selectedDates.length > 1) {
        setSelectedDates([dateKey]);
      } else {
        const start = selectedDates[0];
        if (dateKey === start) {
          setSelectedDates([dateKey]);
          return;
        }
        const [from, to] = start < dateKey ? [start, dateKey] : [dateKey, start];
        const range: string[] = [];
        const curr = new Date(from);
        const end = new Date(to);
        while (curr <= end) {
          const ds = curr.toISOString().split('T')[0];
          if (!getDateBookingConflict(ds).isBooked) {
            range.push(ds);
          }
          curr.setDate(curr.getDate() + 1);
        }
        setSelectedDates(range.length > 0 ? range : [dateKey]);
      }
    }
  };

  // Linked 3-way pricing counter handlers
  const handleOwnerChange = (val: number) => {
    const clean = Math.max(0, Number(val) || 0);
    setOwnerPriceInput(clean);
    setTotalPriceInput(clean + supervisorFeeInput);
  };

  const handleSupervisorFeeChange = (val: number) => {
    const clean = Math.max(0, Number(val) || 0);
    setSupervisorFeeInput(clean);
    setTotalPriceInput(ownerPriceInput + clean);
  };

  const handleTotalChange = (val: number) => {
    const clean = Math.max(0, Number(val) || 0);
    setTotalPriceInput(clean);
    if (clean >= ownerPriceInput) {
      setSupervisorFeeInput(clean - ownerPriceInput);
    } else {
      setOwnerPriceInput(clean);
      setSupervisorFeeInput(0);
    }
  };

  const handleApplyPricingToSelectedDates = () => {
    const targets = sortedSelected.filter((d) => d >= todayStr && !getDateBookingConflict(d).isBooked);
    if (targets.length === 0) return;
    const labelMap: Record<SelectionPatternMode, string> = {
      custom: 'أيام محددة',
      full_month: 'كامل الشهر',
      weekday: 'وسط الأسبوع',
      weekend: 'الويكند',
    };
    setSupervisorDateOverridesBulk(
      selectedPropertyId,
      targets,
      {
        ownerPrice: ownerPriceInput,
        supervisorFee: supervisorFeeInput,
        totalPrice: ownerPriceInput + supervisorFeeInput,
        patternLabel: labelMap[patternMode],
      },
      activeSectionId
    );
    setAppliedOverridesToast(`تم تطبيق تسعير (${ownerPriceInput} + ${supervisorFeeInput} = ${ownerPriceInput + supervisorFeeInput} ر.س) على ${targets.length} يوم`);
    setTimeout(() => setAppliedOverridesToast(null), 2600);
  };

  // Aggregate booking financials across selected dates
  const activeDatesForBooking = useMemo(() => {
    const valid = sortedSelected.filter((d) => d >= todayStr && !getDateBookingConflict(d).isBooked);
    if (valid.length > 0) return valid;
    return availableMonthDates.length > 0 ? [availableMonthDates[0]] : [todayStr];
  }, [sortedSelected, todayStr, getDateBookingConflict, availableMonthDates]);

  const bookingTotals = useMemo(() => {
    const nights = Math.max(1, activeDatesForBooking.length);
    let totalOwner = 0;
    let totalSupFee = 0;
    let totalVisible = 0;

    if (sortedSelected.length === 1) {
      totalOwner = ownerPriceInput;
      totalSupFee = supervisorFeeInput;
      totalVisible = ownerPriceInput + supervisorFeeInput;
    } else if (sortedSelected.length > 1) {
      activeDatesForBooking.forEach((d) => {
        const p = getSupervisorPricingForDate(d);
        totalOwner += p.ownerPrice;
        totalSupFee += p.supervisorFee;
        totalVisible += p.ownerPrice + p.supervisorFee;
      });
    } else {
      totalOwner = ownerPriceInput;
      totalSupFee = supervisorFeeInput;
      totalVisible = ownerPriceInput + supervisorFeeInput;
    }

    const commissionAmount = Math.round((totalVisible * selectedRatePercent) / 100);
    const supervisorCredit = commissionAmount + totalSupFee;
    const propertyNet = Math.max(0, totalVisible - supervisorCredit);

    return {
      nights,
      totalOwner,
      totalSupFee,
      totalVisible,
      commissionAmount,
      supervisorCredit,
      propertyNet,
    };
  }, [
    activeDatesForBooking,
    sortedSelected.length,
    ownerPriceInput,
    supervisorFeeInput,
    getSupervisorPricingForDate,
    selectedRatePercent,
  ]);

  const allRateOptions = useMemo(() => {
    const base = [5, 7];
    const extras = (customSupervisorRates || []).filter((r) => r !== 5 && r !== 7);
    return [...base, ...extras];
  }, [customSupervisorRates]);

  const handleAddCustomRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newRateInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
      setRateError('أدخل نسبة صحيحة بين 0.5% و 100%');
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    addCustomSupervisorRate(rounded);
    setSelectedRatePercent(rounded);
    setNewRateInput('');
    setRateError(null);
  };

  const handleLoadFromSpecialBox = (initialOwner?: number, initialFee?: number) => {
    const owner = Math.max(0, Number(initialOwner ?? ownerPriceInput));
    const fee = Math.max(0, Number(initialFee ?? supervisorFeeInput));
    setOwnerPriceInput(owner);
    setSupervisorFeeInput(fee);
    setTotalPriceInput(owner + fee);
    setBookingErrorMsg(null);
    setBookingSuccessMsg(null);
    setBookingModalOpen(true);
  };

  const handleConfirmSupervisorBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErrorMsg(null);
    if (activeDatesForBooking.length === 0) {
      setBookingErrorMsg('يرجى تحديد يوم متاح واحد على الأقل.');
      return;
    }
    const sorted = [...activeDatesForBooking].sort();
    const checkIn = sorted[0];
    const lastDayObj = new Date(sorted[sorted.length - 1]);
    lastDayObj.setDate(lastDayObj.getDate() + 1);
    const checkOut = lastDayObj.toISOString().split('T')[0];

    const assignee =
      supervisorMembers.find((m) => m.id === selectedAssigneeId) ||
      (!isAdmin && currentMarketer ? currentMarketer : null);

    try {
      addBooking({
        propertyId: selectedPropertyId,
        propertyName: selectedProperty.name,
        sectionId: activeSectionId !== 'all' ? activeSectionId : undefined,
        sectionName: estateSectionName ?? activeSection?.name,
        ...estatePartsExtra,
        customerName: custName.trim() || 'عميل Supervisor',
        customerPhone: custPhone.trim() || '0500000000',
        customerNationalId: custNationalId.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        guestsCount: guestsCountInput.trim() && Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nightsCount: sorted.length,
        nightlyPrice: Math.round(bookingTotals.totalVisible / Math.max(1, sorted.length)),
        baseNightlyTotal: bookingTotals.totalVisible,
        totalPrice: bookingTotals.totalVisible,
        adminFee: bookingTotals.totalSupFee,
        supervisorFee: bookingTotals.totalSupFee,
        commissionRatePercent: selectedRatePercent,
        marketerCommission: bookingTotals.commissionAmount,
        supervisorTotalCredit: bookingTotals.supervisorCredit,
        propertyNetPayout: bookingTotals.propertyNet,
        depositPaid: depositInput,
        remainingAmount: Math.max(0, bookingTotals.totalVisible - depositInput),
        insuranceAmount: selectedProperty.insuranceAmount || 500,
        bookingType: 'supervisor',
        bookingCategory: 'supervisor',
        isSupervisorBooking: true,
        supervisorId: assignee?.id || currentMarketer?.id || 'admin-supervisor',
        supervisorName: assignee?.name || (isAdmin ? 'الإدارة / Supervisor' : currentMarketer?.name || 'Supervisor'),
        notes: `حجز Supervisor (${selectedRatePercent}%): المالك ${bookingTotals.totalOwner} + رسوم المشرف ${bookingTotals.totalSupFee} | العمولة ${bookingTotals.commissionAmount} | الرصيد عند الخروج ${bookingTotals.supervisorCredit} ر.س${bookingNotes.trim() ? ` | ${bookingNotes.trim()}` : ''}`,
        status: 'confirmed',
      });

      setBookingSuccessMsg('تم تأكيد حجز (Supervisor) بنجاح وإقفال التواريخ على جميع التقويمات!');
      setCustName('');
      setCustPhone('05');
      setBookingNotes('');
      setTimeout(() => {
        setBookingModalOpen(false);
        setBookingSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setBookingErrorMsg(err?.message || 'تعذر إتمام الحجز بسبب تعارض في التواريخ.');
    }
  };

  // Property Info, WhatsApp Sharing & 15-Minute Deposit Request Workflow
  const sortedActiveBookingDates = useMemo(() => [...activeDatesForBooking].sort(), [activeDatesForBooking]);
  const checkInDate = sortedActiveBookingDates[0] || todayStr;
  const checkOutDate = useMemo(() => {
    const last = sortedActiveBookingDates[sortedActiveBookingDates.length - 1] || checkInDate;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [sortedActiveBookingDates, checkInDate]);

  const insuranceAmount = selectedProperty.insuranceAmount || 500;
  const remainingAmount = Math.max(0, bookingTotals.totalVisible - depositInput);
  const isPhoneValid =
    custPhone.trim() !== '' &&
    custPhone.trim() !== '05' &&
    custPhone.trim().length >= 9;

  const waitingHoldInfo = useMemo(() => {
    const matchedDates: string[] = [];
    let firstOverride: (typeof dateOverrides)[string] | undefined;

    sortedActiveBookingDates.forEach((d) => {
      const uKey = activeSection ? `${selectedPropertyId}_${activeSection.id}_${d}` : `${selectedPropertyId}_${d}`;
      const ov = dateOverrides[uKey] || dateOverrides[`${selectedPropertyId}_${d}`];
      if (ov?.status === 'waiting_deposit' && ov.waitingDepositExpiresAt && ov.waitingDepositExpiresAt > nowTimestamp) {
        matchedDates.push(d);
        if (!firstOverride) firstOverride = ov;
      }
    });

    return {
      isAwaitingDeposit: matchedDates.length > 0,
      waitingDates: matchedDates,
      override: firstOverride,
      secondsLeft:
        firstOverride?.waitingDepositExpiresAt
          ? Math.max(0, Math.floor((firstOverride.waitingDepositExpiresAt - nowTimestamp) / 1000))
          : 0,
    };
  }, [sortedActiveBookingDates, activeSection, selectedPropertyId, dateOverrides, nowTimestamp]);

  const isAwaitingDeposit = waitingHoldInfo.isAwaitingDeposit;
  const currentOverride = waitingHoldInfo.override;
  const depositSecondsLeft = waitingHoldInfo.secondsLeft;

  const openWhatsAppMessageModal = (text: string, title = 'إرسال عبر واتساب') => {
    const raw = custPhone.trim();
    if (!raw || raw === '05' || raw.length < 9) {
      const url = `https://wa.me/966?text=${encodeURIComponent(text)}`;
      setSentMessageData({ title, text, whatsappUrl: url, phone: raw || '05' });
      return;
    }
    const clean = raw.replace(/\D/g, '').replace(/^0/, '966');
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    setSentMessageData({ title, text, whatsappUrl: url, phone: raw });
  };

  const displaySpecSource = activeSection || selectedProperty;
  const displayPropertyName = activeSection
    ? `${selectedProperty.name} (${activeSection.name})`
    : selectedProperty.name;
  const resolvedMapUrl =
    selectedProperty.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${selectedProperty.name} ${selectedProperty.address || selectedProperty.location}`
    )}`;

  // Supervisor weekday/weekend visible pricing estimate
  const supervisorRatesPreview = useMemo(() => {
    const todayDow = new Date(checkInDate).getDay();
    const isSelWknd = todayDow === 4 || todayDow === 5;
    const selectedDayVisible = getSupervisorPricingForDate(checkInDate).totalPrice;
    // Pick sample weekday and weekend dates in active month
    const yr = currentMonthDate.getFullYear();
    const mo = currentMonthDate.getMonth();
    const wkdayDate = `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
    let sampleWkday = selectedDayVisible;
    let sampleWknd = selectedDayVisible;
    for (let day = 1; day <= 10; day++) {
      const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = new Date(ds).getDay();
      if (dow !== 4 && dow !== 5) sampleWkday = getSupervisorPricingForDate(ds).totalPrice;
      if (dow === 4 || dow === 5) sampleWknd = getSupervisorPricingForDate(ds).totalPrice;
    }
    if (!isSelWknd) sampleWkday = selectedDayVisible;
    else sampleWknd = selectedDayVisible;
    void wkdayDate;
    return { weekdayPrice: sampleWkday, weekendPrice: sampleWknd };
  }, [checkInDate, currentMonthDate, getSupervisorPricingForDate]);

  // Quick WhatsApp Property Info (uses Supervisor Visible Price automatically)
  const sendQuickInfo = () => {
    const featuresText = displaySpecSource.features?.length
      ? `\n• المرافق والتجهيزات: ${displaySpecSource.features.join('، ')}`
      : '';
    const msg = `مرحباً بك أخي الكريم ${custName || ''}،
يسرنا تزويدكم بتفاصيل ومواصفات (${displayPropertyName}):

🏕️ *المواصفات:*
• ${displaySpecSource.subtitle}
• السعة: ${displaySpecSource.capacity} فرد
• غرف النوم: ${displaySpecSource.bedrooms} | دورات المياه: ${displaySpecSource.bathrooms}
• المساحة: ${displaySpecSource.areaM2} م² | المسبح: ${displaySpecSource.poolType}${featuresText}
• وقت الدخول: ${selectedProperty.checkInTimeText} | وقت الخروج: ${selectedProperty.checkOutTimeText}
• السعر المعتمد (${bookingTotals.nights} ${bookingTotals.nights === 1 ? 'ليلة' : 'ليالٍ'}): ${bookingTotals.totalVisible.toLocaleString()} ر.س
• سعر وسط الأسبوع: ${supervisorRatesPreview.weekdayPrice} ر.س | الويكند: ${supervisorRatesPreview.weekendPrice} ر.س
• التأمين المسترد: ${insuranceAmount} ريال

نتشرف بخدمتكم لحجز إقامتكم السعيدة!`;
    openWhatsAppMessageModal(msg, 'إرسال معلومات العقار عبر واتساب');
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
    const mediaLines: string[] = [];
    if (selectedProperty.images?.length) {
      selectedProperty.images.forEach((img, idx) => {
        mediaLines.push(`• 📸 صورة ${idx + 1}: ${img}`);
      });
    } else if (selectedProperty.coverImage) {
      mediaLines.push(`• 📸 الغلاف: ${selectedProperty.coverImage}`);
    }
    if (selectedProperty.videoItems?.length) {
      selectedProperty.videoItems.forEach((v, idx) => {
        mediaLines.push(`• 🎥 فيديو (${v.title || idx + 1}): ${v.url}`);
      });
    } else if (selectedProperty.videoUrls?.length) {
      selectedProperty.videoUrls.forEach((vUrl, idx) => {
        mediaLines.push(`• 🎥 فيديو ${idx + 1}: ${vUrl}`);
      });
    }
    if (selectedProperty.driveUrl) {
      mediaLines.push(`• 📁 ألبوم قوقل درايف: ${selectedProperty.driveUrl}`);
    }

    const msg = `أهلاً بك أخي الكريم ${custName || ''}،
مرفق لكم ألبوم الصور والفيديو لـ (${displayPropertyName}):

📸 *روابط الصور والتغطيات:*
${mediaLines.join('\n')}

نتمنى أن تنال إعجابكم ويسعدنا استقبال استفساراتكم! 🏕️`;
    openWhatsAppMessageModal(msg, 'إرسال الصور والفيديو عبر واتساب');
  };

  // Quick WhatsApp Location
  const sendQuickLocation = () => {
    const msg = `مرحباً بك أخي الكريم ${custName || ''}،
موقع ولوكيشن (${displayPropertyName}):

📍 *العنوان:* ${selectedProperty.address || selectedProperty.location}
🗺️ *رابط خرائط Google:*
${resolvedMapUrl}

نتمنى لكم رحلة وصول ميسرة وممتعة!`;
    openWhatsAppMessageModal(msg, 'إرسال اللوكيشن عبر واتساب');
  };

  // Quick WhatsApp Full Property Data (uses Supervisor Visible Price automatically)
  const sendFullPropertyData = () => {
    const featuresText = displaySpecSource.features?.length
      ? `\n• المرافق: ${displaySpecSource.features.join('، ')}`
      : '';
    const videoLine =
      selectedProperty.videoItems?.[0]?.url || selectedProperty.videoUrls?.[0]
        ? `\n🎥 *جولة فيديو:* ${selectedProperty.videoItems?.[0]?.url || selectedProperty.videoUrls?.[0]}`
        : '';
    const msg = `مرحباً بك أخي الكريم ${custName || ''}،
تفاصيل (${displayPropertyName}) الكاملة:

🏕️ *معلومات المكان:* ${displaySpecSource.subtitle}
• السعة: ${displaySpecSource.capacity} فرد | غرف النوم: ${displaySpecSource.bedrooms} | دورات المياه: ${displaySpecSource.bathrooms}
• المساحة: ${displaySpecSource.areaM2} م² | المسبح: ${displaySpecSource.poolType}${featuresText}
• وقت الدخول: ${selectedProperty.checkInTimeText} | وقت الخروج: ${selectedProperty.checkOutTimeText}

📍 *اللوكيشن على خرائط Google:*
${resolvedMapUrl}

📸 *ألبوم الصور:* ${selectedProperty.coverImage}${videoLine}

💰 *السعر المعتمد:* ${bookingTotals.totalVisible.toLocaleString()} ر.س (${bookingTotals.nights} ${bookingTotals.nights === 1 ? 'ليلة' : 'ليالٍ'}) | التأمين: ${insuranceAmount} ر.س
يسعدنا تأكيد حجزكم فور تحويل العربون!`;
    openWhatsAppMessageModal(msg, 'إرسال معلومات العقار كاملة عبر واتساب');
  };

  // 15-Minute Deposit Request (with Supervisor visible price)
  const handleRequestDeposit = () => {
    if (!isPhoneValid) {
      showActionToast('error', 'فضلاً أدخل رقم جوال العميل بصيغة صحيحة (مثال: 0551234567)');
      return;
    }
    if (sortedActiveBookingDates.length === 0) {
      showActionToast('error', 'يرجى تحديد يوم متاح واحد على الأقل.');
      return;
    }

    const assignee =
      supervisorMembers.find((m) => m.id === selectedAssigneeId) ||
      (!isAdmin && currentMarketer ? currentMarketer : null);

    const { whatsappUrl, message } = requestDeposit({
      propertyId: selectedPropertyId,
      sectionId: activeSection?.id,
      dates: sortedActiveBookingDates,
      customerName: custName.trim() || 'عميل كريم',
      customerPhone: custPhone.trim(),
      depositAmount: depositInput,
      totalPrice: bookingTotals.totalVisible,
      nightsCount: bookingTotals.nights,
      marketerId: assignee?.id || currentMarketer?.id,
      commissionRatePercent: selectedRatePercent,
      sectionName: estateSectionName ?? activeSection?.name,
      ...estatePartsExtra,
      isSupervisorBooking: true,
    });

    if (!whatsappUrl) {
      showActionToast('error', 'تعذر تعليق التواريخ، تأكد من اختيار تواريخ قادمة.');
      return;
    }

    setSentMessageData({
      title: 'طلب العربون (مهلة 15 دقيقة) عبر واتساب',
      text: message,
      whatsappUrl,
      phone: custPhone.trim(),
    });
  };

  const [receiptsModalBooking, setReceiptsModalBooking] = useState<Booking | null>(null);

  // Receipt image / PDF processing for reliable in-app & Firestore storage
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
    sortedActiveBookingDates.length > 0 &&
    custName.trim() !== '' &&
    isPhoneValid &&
    depositInput > 0 &&
    !!receiptFile;

  const handleConfirmWithReceipt = () => {
    if (!isConfirmReady || !receiptFile) return;

    const assignee =
      supervisorMembers.find((m) => m.id === selectedAssigneeId) ||
      (!isAdmin && currentMarketer ? currentMarketer : null);

    const { booking, whatsappContractUrl, contractText } = confirmBookingWithReceipt({
      propertyId: selectedPropertyId,
      dates: sortedActiveBookingDates,
      customerName: custName.trim(),
      customerPhone: custPhone.trim(),
      depositPaid: depositInput,
      totalPrice: bookingTotals.totalVisible,
      remainingAmount,
      insuranceAmount,
      receiptFileName: receiptFile.name,
      receiptDataUrl: receiptFile.dataUrl,
      marketerId: assignee?.id || currentMarketer?.id,
      commissionRatePercent: selectedRatePercent,
      sectionId: activeSection?.id,
      sectionName: estateSectionName ?? activeSection?.name,
      ...estatePartsExtra,
      isSupervisorBooking: true,
      supervisorId: assignee?.id || currentMarketer?.id || 'admin-supervisor',
      supervisorName: assignee?.name || (isAdmin ? 'الإدارة / Supervisor' : currentMarketer?.name || 'Supervisor'),
      supervisorFee: bookingTotals.totalSupFee,
      supervisorTotalCredit: bookingTotals.supervisorCredit,
      customerNationalId: custNationalId.trim() || undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      guestsCount: guestsCountInput.trim() && Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
      notes: `حجز Supervisor بإيصال (${selectedRatePercent}%): المالك ${bookingTotals.totalOwner} + رسوم المشرف ${bookingTotals.totalSupFee} | العمولة ${bookingTotals.commissionAmount} | الرصيد عند الخروج ${bookingTotals.supervisorCredit} ر.س`,
    });

    setConfirmedContractData({
      booking,
      contractText,
      whatsappUrl: whatsappContractUrl,
      bookingNumber: booking.bookingNumber,
    });
    setReceiptFile(null);
  };

  const handleInstantConfirmContract = () => {
    if (!isPhoneValid) {
      showActionToast('error', 'فضلاً أدخل رقم جوال العميل لإرسال العقد عبر واتساب');
      return;
    }

    const assignee =
      supervisorMembers.find((m) => m.id === selectedAssigneeId) ||
      (!isAdmin && currentMarketer ? currentMarketer : null);

    const { booking, whatsappContractUrl, contractText } = confirmBookingWithReceipt({
      propertyId: selectedPropertyId,
      dates: sortedActiveBookingDates,
      customerName: custName.trim() || currentOverride?.waitingCustomerName || 'عميل Supervisor',
      customerPhone: custPhone.trim(),
      depositPaid: currentOverride?.waitingDepositAmount || depositInput,
      totalPrice: bookingTotals.totalVisible,
      remainingAmount: Math.max(0, bookingTotals.totalVisible - (currentOverride?.waitingDepositAmount || depositInput)),
      insuranceAmount,
      receiptFileName: 'حجز_Supervisor_معتمد.pdf',
      marketerId: assignee?.id || currentMarketer?.id,
      commissionRatePercent: selectedRatePercent,
      sectionId: activeSection?.id,
      sectionName: estateSectionName ?? activeSection?.name,
      ...estatePartsExtra,
      isSupervisorBooking: true,
      supervisorId: assignee?.id || currentMarketer?.id || 'admin-supervisor',
      supervisorName: assignee?.name || (isAdmin ? 'الإدارة / Supervisor' : currentMarketer?.name || 'Supervisor'),
      supervisorFee: bookingTotals.totalSupFee,
      supervisorTotalCredit: bookingTotals.supervisorCredit,
      customerNationalId: custNationalId.trim() || undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      guestsCount: guestsCountInput.trim() && Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
      notes: `حجز فوري Supervisor (${selectedRatePercent}%): المالك ${bookingTotals.totalOwner} + رسوم المشرف ${bookingTotals.totalSupFee} | العمولة ${bookingTotals.commissionAmount} | الرصيد عند الخروج ${bookingTotals.supervisorCredit} ر.س`,
    });

    setConfirmedContractData({
      booking,
      contractText,
      whatsappUrl: whatsappContractUrl,
      bookingNumber: booking.bookingNumber,
    });
  };

  // Supervisor Bookings & Balance Ledger
  const supervisorBookings = useMemo(() => {
    const allSup = bookings.filter((b) => checkIsSupervisorBooking(b) && b.status !== 'cancelled');
    if (isAdmin) return allSup;
    return allSup.filter(
      (b) => b.supervisorId === currentMarketer?.id || b.marketerId === currentMarketer?.id
    );
  }, [bookings, isAdmin, currentMarketer?.id]);

  const balanceStats = useMemo(() => {
    let pendingCheckoutCredit = 0;
    let readyCredit = 0;
    let paidCredit = 0;
    let totalSupervisorFees = 0;
    let totalCommissions = 0;

    supervisorBookings.forEach((b) => {
      const credit = getSupervisorBookingTotalCredit(b, properties, specialAdminFeeBoxes);
      const fee = getBookingAdminFeeAmount(b, properties, specialAdminFeeBoxes);
      const comm = getBookingCommissionAmount(b);
      totalSupervisorFees += fee;
      totalCommissions += comm;

      if (b.commissionStatus === 'paid') {
        paidCredit += credit;
      } else if (isBookingCheckedOut(b)) {
        readyCredit += credit;
      } else {
        pendingCheckoutCredit += credit;
      }
    });

    return {
      pendingCheckoutCredit,
      readyCredit,
      paidCredit,
      totalSupervisorFees,
      totalCommissions,
    };
  }, [supervisorBookings, properties, specialAdminFeeBoxes]);

  if (!hasAccess) {
    return null;
  }

  const nightsWord = bookingTotals.nights === 1 ? 'ليلة' : 'ليالٍ';
  const money = (n: number) => `${Number(n || 0).toLocaleString('en-US')} ر.س`;
  const calHeight =
    calendarSize === 'compact' ? 'h-13 sm:h-15' : calendarSize === 'large' ? 'h-22 sm:h-26' : 'h-16 sm:h-20';
  const wholeLabel = getHierarchyLabels(getPropertyKind(selectedProperty)).whole;
  const waitingMmSs = `${Math.floor(depositSecondsLeft / 60)}:${String(depositSecondsLeft % 60).padStart(2, '0')}`;

  const PATTERNS: { id: SelectionPatternMode; title: string; sub: string }[] = [
    { id: 'custom', title: 'أيام محددة', sub: 'تحديد يدوي' },
    { id: 'full_month', title: 'كامل الشهر', sub: 'كل الأيام المتاحة' },
    { id: 'weekday', title: 'وسط الأسبوع', sub: 'عدا الخميس والجمعة' },
    { id: 'weekend', title: 'الويكند', sub: 'خميس – جمعة' },
  ];

  return (
    <div className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-2 space-y-4" dir="rtl">
      {actionToast && (
        <div className="kt-toast" role="status" aria-live="polite">
          <div className={actionToast.type === 'error' ? 'is-err' : 'is-ok'}>
            {actionToast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            )}
            <span>{actionToast.text}</span>
          </div>
        </div>
      )}

      {/* 1. الترويسة + رصيد المشرف */}
      <section className="lux-hero p-4 space-y-3.5">
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative space-y-1.5">
          <Tag tone="gold">للمشرف والإدارة</Tag>
          <h2 className="text-[19px] font-extrabold" style={{ color: '#F5F0FC' }}>
            صفحة Supervisor
          </h2>
          <p className="text-[12.5px]" style={{ color: '#BFB2DC' }}>
            حجز مباشر بسعر المشرف ورسومه
          </p>
        </div>
        <div className="relative">
          <Infos cols={2}>
            <Info dark label="جاهز للصرف" value={money(balanceStats.readyCredit)} />
            <Info dark label="معلّق للخروج" value={money(balanceStats.pendingCheckoutCredit)} />
          </Infos>
        </div>
      </section>

      {/* 2. اختيار العقار والقسم */}
      <PropertySelect
        properties={properties}
        value={
          estateCtx && estateParent && estateParent.id === estateCtx && selectedProperty.id !== estateParent.id
            ? estateCtx
            : selectedPropertyId
        }
        onChange={(id) => {
          setEstateCtx(null);
          setSelectedPropertyId(id);
        }}
      />

      {estateParent && !isEstateSelf && estateCtx === estateParent.id && (
        <EstateOptionsBar
          parent={estateParent}
          options={estateOptions}
          selectedPropertyId={selectedPropertyId}
          activeSectionId={activeSectionId}
          onPick={(o) => {
            setEstateCtx(estateParent.id);
            setSelectedPropertyId(o.propertyId);
            setActiveSectionId(o.sectionId);
          }}
        />
      )}

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
          priceText={`ليلة ${(sortedSelected[0] || todayStr).slice(5)}: ${getPartsNightPrice(selectedParts, properties, dateOverrides, sortedSelected[0] || todayStr)} ر.س`}
        />
      )}

      {!isEstateSelf && selectedProperty.sections && selectedProperty.sections.length > 0 && (
        <section className="lux-card p-4 space-y-3">
          <Head
            title={getPropertyKind(selectedProperty) === 'estate' ? 'اختر الوحدة' : 'اختر القسم'}
            icon={Layers}
            count={selectedProperty.sections.length + 1}
          />
          <div className="kt-grid2">
            {selectedProperty.sections.map((sec) => (
              <Choice
                key={sec.id}
                title={sec.name}
                sub={`أساسي ${sec.priceWeekday} / ${sec.priceWeekend}`}
                tag="مستقل"
                selected={activeSectionId === sec.id}
                onClick={() => setActiveSectionId(sec.id)}
              />
            ))}
            <Choice
              title={wholeLabel}
              sub="مجموع الأقسام"
              tag="شامل"
              selected={activeSectionId === 'all'}
              onClick={() => setActiveSectionId('all')}
            />
          </div>
        </section>
      )}

      {/* 3. بيانات العميل للواتساب */}
      <section className="lux-card p-4 space-y-3">
        <Head title="العميل" icon={Phone} tone="jade" />
        <div className="kt-fields">
          <Field label="اسم العميل" hint="اختياري">
            <input
              type="text"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="الاسم"
              className="kt-input"
            />
          </Field>
          <Field label="جوال العميل">
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="kt-input kt-num"
            />
          </Field>
        </div>
      </section>

      {/* 4. معلومات العقار وإرسالها بالواتساب */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="معلومات العقار" icon={Home} tone="amy" action={<Tag tone="jade" mono>{money(bookingTotals.totalVisible)}</Tag>} />
        <div className="kt-g2">
          <Tool
            icon={Home}
            title="معلومات المكان"
            onOpen={() => setInfoModalType('info')}
            actionLabel="واتساب"
            actionIcon={MessageCircle}
            onAction={sendQuickInfo}
          />
          <Tool
            icon={Film}
            title="الفيديو والصور"
            tone="sand"
            onOpen={() => setInfoModalType('photos')}
            actionLabel="واتساب"
            actionIcon={MessageCircle}
            onAction={sendQuickPhotos}
          />
          <Tool
            icon={MapPinned}
            title="اللوكيشن"
            tone="jade"
            onOpen={() => setInfoModalType('location')}
            actionLabel="واتساب"
            actionIcon={MessageCircle}
            onAction={sendQuickLocation}
          />
          <Tool
            icon={FileText}
            title="استعراض العقد"
            tone="ink"
            onOpen={() => setInfoModalType('contract')}
            actionLabel="إرسال PDF"
            actionIcon={Send}
            onAction={() => setInfoModalType('contract')}
          />
        </div>
        <Acts cols={2}>
          <Act
            tone="soft"
            icon={Share2}
            label={sharingVideoKey === 'sup-card-video' ? 'جاري التجهيز' : 'مشاركة الفيديو'}
            disabled={sharingVideoKey === 'sup-card-video'}
            onClick={() => {
              if (propertyVideos.length === 0) {
                showActionToast('error', 'لا يوجد فيديو مرفوع لهذا العقار بعد (يمكنك رفعه من صفحة العقارات)');
                setInfoModalType('photos');
                return;
              }
              if (propertyVideos.length === 1) {
                void handleShareVideoAsFile(propertyVideos[0].url, propertyVideos[0].title, 'sup-card-video');
              } else {
                setInfoModalType('photos');
              }
            }}
          />
          <Act tone="jade" icon={MessageCircle} label="إرسال الكل" onClick={sendFullPropertyData} />
        </Acts>
        <p className="kt-note">«إرسال الكل» يرسل المعلومات والصور واللوكيشن للعميل عبر واتساب.</p>
      </section>

      {/* 5. التقويم */}
      <section className="lux-card p-4 space-y-4">
        <Head
          title="التقويم"
          icon={CalendarDays}
          count={`${selectedDates.length} يوم`}
          action={<Tag tone="amy">{selectedProperty.name}</Tag>}
        />
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
          <button
            type="button"
            onClick={() => setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="kt-nav lx-press"
            aria-label="الشهر السابق"
          >
            <ChevronRight size={22} strokeWidth={1.8} />
          </button>
          <h3>
            {MONTHS_AR[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
          </h3>
          <button
            type="button"
            onClick={() => setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="kt-nav lx-press"
            aria-label="الشهر التالي"
          >
            <ChevronLeft size={22} strokeWidth={1.8} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS_AR.map((dayName, idx) => (
            <div
              key={dayName}
              className={`text-[12px] font-bold py-1 truncate ${idx === 4 || idx === 5 ? 'text-amber-700' : 'text-slate-500'}`}
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((cell, idx) => {
            if (!cell.dateKey || !cell.dayNum) {
              return <div key={`empty-${idx}`} className={`${calHeight} rounded-2xl bg-slate-50/50`} />;
            }
            const dateKey = cell.dateKey;
            const isPast = dateKey < todayStr;
            const isToday = dateKey === todayStr;
            const conflict = getDateBookingConflict(dateKey);
            const isBooked = conflict.isBooked;
            const unitWaitKey = activeSection
              ? `${selectedPropertyId}_${activeSection.id}_${dateKey}`
              : `${selectedPropertyId}_${dateKey}`;
            const waitOv = dateOverrides[unitWaitKey] || dateOverrides[`${selectedPropertyId}_${dateKey}`];
            const isWaiting =
              !isBooked &&
              !isPast &&
              waitOv?.status === 'waiting_deposit' &&
              !!waitOv.waitingDepositExpiresAt &&
              waitOv.waitingDepositExpiresAt > nowTimestamp;
            const waitSecs =
              isWaiting && waitOv?.waitingDepositExpiresAt
                ? Math.max(0, Math.floor((waitOv.waitingDepositExpiresAt - nowTimestamp) / 1000))
                : 0;
            const isSelected = selectedDates.includes(dateKey);
            const pricing = getSupervisorPricingForDate(dateKey);

            let stateCls = cell.isWeekend
              ? 'bg-[#FFF7E4] border-amber-200 text-slate-900 cursor-pointer'
              : 'bg-[#E8F8F1] border-emerald-200 text-emerald-950 cursor-pointer';
            let priceCls = cell.isWeekend ? 'text-amber-800' : 'text-emerald-800';
            if (isPast) {
              stateCls = 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-55 cursor-not-allowed';
              priceCls = 'text-slate-400';
            } else if (isBooked) {
              stateCls = 'bg-[#FCE7F3] border-pink-300 text-pink-950 cursor-not-allowed';
              priceCls = 'text-pink-800';
            } else if (isWaiting) {
              stateCls = 'bg-amber-100 border-amber-300 text-amber-950 cursor-pointer';
              priceCls = 'text-amber-800';
            }
            const todayCls = isToday && !isPast ? 'border-2 border-purple-400' : '';
            const selectedCls = isSelected
              ? 'ring-3 ring-purple-600 ring-offset-2 !border-2 !border-purple-600 !bg-purple-100/80 shadow-md scale-[1.02] z-20'
              : '';

            return (
              <button
                key={dateKey}
                type="button"
                disabled={isPast || isBooked}
                onClick={() => handleDayClick(dateKey)}
                title={isBooked ? 'محجوز ومقفل' : isWaiting ? 'بانتظار العربون' : undefined}
                className={`${calHeight} rounded-2xl border p-1 flex flex-col justify-between items-center transition-all relative select-none ${stateCls} ${todayCls} ${selectedCls}`}
              >
                <span className={`leading-none pt-0.5 text-[15px] font-bold font-mono tabular-nums ${isPast ? 'line-through' : ''}`}>
                  {cell.dayNum}
                </span>
                {pricing.hasOverride && !isPast && !isBooked && !isWaiting && (
                  <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-purple-600" aria-hidden="true" />
                )}

                <div className="flex flex-col items-center w-full min-w-0 px-0.5">
                  {isPast ? null : isBooked ? (
                    <span className={`truncate w-full text-center text-[12px] font-extrabold ${priceCls}`}>محجوز</span>
                  ) : isWaiting ? (
                    <>
                      <span dir="ltr" className={`truncate w-full text-center font-mono font-extrabold text-[12px] ${priceCls}`}>
                        {Math.floor(waitSecs / 60)}:{String(waitSecs % 60).padStart(2, '0')}
                      </span>
                      {calendarSize !== 'compact' && (
                        <span dir="ltr" className="truncate w-full text-center font-mono font-bold text-[12px] opacity-80">
                          {pricing.totalPrice}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span dir="ltr" className={`truncate w-full text-center font-mono font-extrabold text-[12px] ${priceCls}`}>
                        {pricing.totalPrice}
                      </span>
                      {calendarSize !== 'compact' && (
                        <span dir="ltr" className="truncate w-full text-center font-mono font-bold text-[12px] opacity-65">
                          +{pricing.supervisorFee}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="kt-legend">
          <div>
            <i style={{ background: '#E8F8F1', borderColor: '#6EE7B7' }} />
            <span>متاح</span>
          </div>
          <div>
            <i style={{ background: '#FFF7E4', borderColor: '#FCD34D' }} />
            <span>ويكند</span>
          </div>
          <div>
            <i style={{ background: '#FEF3C7', borderColor: '#F59E0B' }} />
            <span>عربون</span>
          </div>
          <div>
            <i style={{ background: '#FCE7F3', borderColor: '#F9A8D4' }} />
            <span>محجوز</span>
          </div>
          <div>
            <i style={{ background: '#F3E8FF', borderColor: '#7C3AED', borderWidth: 2 }} />
            <span>محدد ({selectedDates.length})</span>
          </div>
        </div>
        <p className="kt-note text-center">الرقم = سعر المشرف لليلة · «+» = رسوم Supervisor</p>
      </section>

      {/* 6. نمط التحديد + عدادات التسعير */}
      <section className="lux-card p-4 space-y-4">
        <Head title="تسعير الأيام" icon={Calculator} tone="sand" count={`${selectedDates.length} يوم`} />

        <div className="kt-field">
          <span className="kt-field-h">
            <span>نمط تحديد الأيام</span>
          </span>
          <div className="kt-g2">
            {PATTERNS.map((p) => (
              <Choice
                key={p.id}
                title={p.title}
                sub={p.sub}
                selected={patternMode === p.id}
                onClick={() => handleSelectPattern(p.id)}
              />
            ))}
          </div>
        </div>

        <div className="kt-sub">
          <span className="kt-sub-t">المالك + الرسوم = سعر المشرف</span>
          <div className="kt-f3">
            <Field label="سعر المالك">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={ownerPriceInput}
                onChange={(e) => handleOwnerChange(Number(e.target.value))}
                className="kt-input kt-num"
              />
            </Field>
            <Field label="الرسوم">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={supervisorFeeInput}
                onChange={(e) => handleSupervisorFeeChange(Number(e.target.value))}
                className="kt-input kt-num"
                style={{ color: '#B8435E' }}
              />
            </Field>
            <Field label="سعر المشرف">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={totalPriceInput}
                onChange={(e) => handleTotalChange(Number(e.target.value))}
                className="kt-input kt-num"
                style={{ background: '#E9F7F2', color: '#0E5A49', boxShadow: 'inset 0 0 0 1px rgba(46,158,134,.55)' }}
              />
            </Field>
          </div>
          <p className="kt-note text-center">
            <span dir="ltr" className="font-mono">
              {ownerPriceInput} + {supervisorFeeInput} = {ownerPriceInput + supervisorFeeInput}{' '}
              <span dir="rtl" className="font-sans">ر.س</span>
            </span>
          </p>
          <Acts cols={3}>
            {[-50, 50, 100].map((delta) => (
              <Act
                key={delta}
                tone="soft"
                label={delta > 0 ? `‎+${delta}` : `‎−${Math.abs(delta)}`}
                title={`تغيير الرسوم ${delta > 0 ? 'بزيادة' : 'بنقص'} ${Math.abs(delta)}`}
                onClick={() => handleSupervisorFeeChange(supervisorFeeInput + delta)}
              />
            ))}
          </Acts>
          <Act
            tone="gold"
            icon={Check}
            label={`تطبيق على ${selectedDates.length} يوم`}
            title="تطبيق السعر والرسوم على الأيام المحددة"
            disabled={selectedDates.length === 0}
            onClick={handleApplyPricingToSelectedDates}
          />
          {appliedOverridesToast && (
            <div className="kt-ok animate-in fade-in" role="status">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
                <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{appliedOverridesToast}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7. نسبة العمولة + الحساب المالي + الحجز */}
      <section className="lux-card p-4 space-y-4">
        <Head title="نسبة العمولة" icon={BadgeDollarSign} tone="sand" count={`${selectedRatePercent}%`} />

        <div className="kt-g2">
          {allRateOptions.map((rate) => {
            const isBuiltIn = rate === 5 || rate === 7;
            const title = rate === 5 ? 'حجز جزئي 5%' : rate === 7 ? 'حجز جزئي 7%' : `نسبة مخصصة ${rate}%`;
            return (
              <div key={rate} className="kt-opt-x">
                <Choice
                  title={title}
                  sub={isBuiltIn ? 'نسبة ثابتة' : 'أضفتها أنت'}
                  selected={selectedRatePercent === rate}
                  onClick={() => setSelectedRatePercent(rate)}
                />
                {!isBuiltIn && (
                  <IconBtn
                    icon={X}
                    tone="garn"
                    label={`حذف النسبة ${rate}%`}
                    onClick={() => {
                      removeCustomSupervisorRate(rate);
                      if (selectedRatePercent === rate) setSelectedRatePercent(5);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddCustomRate} className="kt-sub">
          <div className="flex items-end gap-2.5">
            <Field label="إضافة نسبة جديدة %" className="flex-1 min-w-0">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                inputMode="decimal"
                placeholder="مثال: 10"
                value={newRateInput}
                onChange={(e) => {
                  setNewRateInput(e.target.value);
                  setRateError(null);
                }}
                className="kt-input kt-num"
              />
            </Field>
            <div className="w-[128px] shrink-0">
              <Act submit tone="ink" icon={Plus} label="إضافة" />
            </div>
          </div>
          {rateError && (
            <div className="kt-err" role="alert">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="flex-1 min-w-0">{rateError}</span>
            </div>
          )}
        </form>

        {/* الحساب المالي */}
        <div className="kt-sub">
          <Head
            title="الحساب المالي"
            icon={Wallet}
            tone="jade"
            count={`${bookingTotals.nights} ${nightsWord} · ${selectedRatePercent}%`}
          />
          <Infos cols={2}>
            <Info hi label="إجمالي العميل" value={money(bookingTotals.totalVisible)} />
            <Info label="صافي العقار" value={money(bookingTotals.propertyNet)} />
            <Info label={`عمولة ${selectedRatePercent}%`} value={money(bookingTotals.commissionAmount)} />
            <Info label="رسوم Supervisor" value={money(bookingTotals.totalSupFee)} />
            <Info hi wide label="رصيد المشرف عند الخروج" value={money(bookingTotals.supervisorCredit)} />
          </Infos>
        </div>

        {/* لوحة انتظار العربون */}
        {isAwaitingDeposit && (
          <div className="kt-warn p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <Clock className="w-5 h-5 text-[#D9932B] shrink-0" />
              <span className="flex-1 min-w-0 text-[14.5px] font-extrabold text-[#5C3A00]">بانتظار تحويل العربون</span>
              <Tag tone="sand" mono>
                {waitingMmSs}
              </Tag>
            </div>
            <Infos cols={2}>
              <Info label="العميل" value={currentOverride?.waitingCustomerName || custName || 'قيد الانتظار'} />
              <Info ltr label="الجوال" value={currentOverride?.waitingCustomerPhone || custPhone} />
              <Info hi wide label="العربون المطلوب" value={money(Number(currentOverride?.waitingDepositAmount || depositInput))} />
            </Infos>
            <Acts cols={2}>
              {(canEditDeposit || isAdmin) && (
                <Act
                  tone="white"
                  icon={Edit2}
                  label="تعديل العربون"
                  onClick={() => {
                    setTempDepositValue(currentOverride?.waitingDepositAmount || depositInput);
                    setEditDepositModalOpen(true);
                  }}
                />
              )}
              <Act
                tone="white"
                icon={Clock}
                label="تمديد 15 دقيقة"
                onClick={() => extendDepositWait(selectedPropertyId, waitingHoldInfo.waitingDates, activeSection?.id)}
              />
              <Act
                tone="garnet"
                icon={X}
                label="إلغاء التعليق"
                onClick={() => cancelDepositWait(selectedPropertyId, waitingHoldInfo.waitingDates, activeSection?.id)}
              />
              <Act tone="ink" icon={Sparkles} label="تأكيد نهائي" onClick={handleInstantConfirmContract} />
            </Acts>
          </div>
        )}

        {/* بيانات الحجز */}
        <div className="kt-sub">
          <Head title="بيانات الحجز" icon={User} tone="amy" />
          <div className="kt-fields">
            <Field label="اسم العميل">
              <input
                type="text"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                placeholder="الاسم"
                className="kt-input"
              />
            </Field>
            <Field label="جوال العميل">
              <input
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                className="kt-input kt-num"
              />
            </Field>
            <Field label="العربون (ر.س)" hint={`الافتراضي ${selectedProperty.defaultDeposit || 250}`}>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                disabled={!canEditDeposit && !isAdmin}
                value={depositInput}
                onChange={(e) => setDepositInput(Math.max(0, Number(e.target.value)))}
                className="kt-input kt-num"
              />
            </Field>
            <Field label="عدد الأشخاص">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={guestsCountInput}
                onChange={(e) => setGuestsCountInput(e.target.value)}
                placeholder="30"
                className="kt-input kt-num"
              />
            </Field>
            <Field label="رقم الهوية" hint="اختياري">
              <input
                type="text"
                dir="ltr"
                inputMode="numeric"
                value={custNationalId}
                onChange={(e) => setCustNationalId(e.target.value)}
                placeholder="10xxxxxxxx"
                className="kt-input kt-num"
              />
            </Field>
            <Field label="لوحة السيارة" hint="اختياري">
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="د ب ي 8972"
                className="kt-input"
              />
            </Field>
          </div>
          <Act
            tone="gold"
            icon={Clock}
            label="طلب العربون · مهلة 15 دقيقة"
            disabled={!isPhoneValid}
            onClick={handleRequestDeposit}
          />
        </div>

        {/* إيصال التحويل وتأكيد الحجز */}
        <div className="kt-sub">
          <Head title="إيصال التحويل" icon={Paperclip} tone="jade" />
          <label className="kt-file">
            <Paperclip size={18} strokeWidth={1.8} />
            <span>{receiptFile?.name || 'إرفاق صورة أو ملف الإيصال'}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleReceiptChange(e.target.files?.[0])}
            />
          </label>
          {receiptError && (
            <div className="kt-err" role="alert">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="flex-1 min-w-0">{receiptError}</span>
            </div>
          )}
          {receiptFile && (
            <div className="kt-bk">
              {isPdfReceiptUrl(receiptFile.dataUrl, receiptFile.name) ? (
                <div className="kt-bk-h">
                  <Tile icon={FileText} tone="amy" size={40} />
                  <span className="kt-row-n">{receiptFile.name}</span>
                </div>
              ) : (
                <img
                  src={receiptFile.dataUrl}
                  alt="صورة الإيصال البنكي"
                  className="w-full max-h-48 object-contain rounded-2xl bg-white"
                />
              )}
              <Act tone="garnS" icon={X} label="إزالة الإيصال" onClick={() => setReceiptFile(null)} />
            </div>
          )}
          <Act
            tone="jade"
            icon={CheckCircle2}
            label="تأكيد الحجز وإصدار العقد"
            disabled={!isConfirmReady}
            onClick={handleConfirmWithReceipt}
          />
        </div>

        <Act
          tone="ink"
          icon={ShieldCheck}
          label={`اعتماد الحجز · ${money(bookingTotals.totalVisible)}`}
          onClick={() => {
            setBookingErrorMsg(null);
            setBookingSuccessMsg(null);
            setBookingModalOpen(true);
          }}
        />
      </section>

      {/* 8. رسوم Supervisor الخاصة */}
      <SpecialAdminFeesSection onOpenSpecialBookingModal={handleLoadFromSpecialBox} />

      {/* 9أ. طلب صرف المستحقات (للمشرف) */}
      {!isAdmin && <SupervisorPayoutPanel />}

      {/* 9. محفظة المشرف وسجل الحجوزات */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title="محفظة المشرف" icon={Wallet} tone="jade" count={supervisorBookings.length} />
        <Infos cols={3}>
          <Info hi label="جاهز" value={money(balanceStats.readyCredit)} />
          <Info label="معلّق" value={money(balanceStats.pendingCheckoutCredit)} />
          <Info label="مصروف" value={money(balanceStats.paidCredit)} />
        </Infos>
        <p className="kt-note">الجاهز = بعد خروج العميل · المعلّق = قبل الخروج · المصروف = تم تحويله للمشرف.</p>

        {isAdmin && balanceStats.readyCredit > 0 && selectedAssigneeId && (
          <Act
            tone="jade"
            icon={CheckCircle2}
            label={`صرف الرصيد · ${money(balanceStats.readyCredit)}`}
            onClick={() => payoutSupervisorBalance(selectedAssigneeId)}
          />
        )}

        {supervisorBookings.length === 0 ? (
          <div className="kt-bk items-center text-center py-6">
            <Wallet className="w-7 h-7 text-[#5B2EA6]" aria-hidden="true" />
            <p className="kt-row-n" style={{ whiteSpace: 'normal' }}>
              لا توجد حجوزات Supervisor بعد
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {supervisorBookings.map((b: Booking) => {
              const checkedOut = isBookingCheckedOut(b);
              const fee = getBookingAdminFeeAmount(b, properties, specialAdminFeeBoxes);
              const comm = getBookingCommissionAmount(b);
              const totalCred = comm + fee;
              const isPaid = b.commissionStatus === 'paid';
              const receiptsGone = isPaid || !!b.receiptsDeletedAfterCommissionPaid;

              return (
                <div key={b.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <Tag tone="amy" mono>
                      {b.bookingNumber}
                    </Tag>
                    <span className="kt-row-n">{b.customerName}</span>
                    {isPaid ? (
                      <Tag tone="gray">تم الصرف</Tag>
                    ) : checkedOut ? (
                      <Tag tone="jade">في الرصيد</Tag>
                    ) : (
                      <Tag tone="sand">معلّق</Tag>
                    )}
                  </div>

                  <Infos cols={2}>
                    <Info label="العقار" value={b.propertyName} />
                    <Info ltr label="التاريخ" value={b.checkInDate} />
                    <Info label="سعر العميل" value={money(Number(b.totalPrice))} />
                    <Info label={`عمولة ${b.commissionRatePercent || 0}%`} value={money(comm)} />
                    <Info label="رسوم Supervisor" value={money(fee)} />
                    <Info hi label="رصيد المشرف" value={money(totalCred)} />
                  </Infos>

                  <Acts cols={2}>
                    <Act tone="ink" icon={FileText} label="العقد PDF" onClick={() => setViewCardContractBooking(b)} />
                    <Act
                      tone="soft"
                      icon={Eye}
                      label={receiptsGone ? 'الإيصالات (محذوفة)' : `الإيصالات (${getBookingReceiptsList(b).length})`}
                      onClick={() => setReceiptsModalBooking(b)}
                    />
                  </Acts>

                  {isAdmin && !checkedOut && (
                    <Act
                      tone="jade"
                      icon={LogOut}
                      label={`تأكيد الخروج · +${money(totalCred)}`}
                      title="تأكيد خروج العميل وإضافة الرصيد للمشرف"
                      onClick={() => markCheckedOut(b.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <BookingReceiptsModal booking={receiptsModalBooking} onClose={() => setReceiptsModalBooking(null)} />

      {viewCardContractBooking && (
        <PrintableContractModal booking={viewCardContractBooking} onClose={() => setViewCardContractBooking(null)} />
      )}

      {/* نافذة تأكيد الحجز */}
      {bookingModalOpen && (
        <Sheet
          title="تأكيد حجز Supervisor"
          icon={Sparkles}
          tone="amy"
          onClose={() => setBookingModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={() => setBookingModalOpen(false)} />
              <Act submit form="sup-booking-form" tone="ink" icon={Check} label="تأكيد الحجز" />
            </Acts>
          }
        >
          <form id="sup-booking-form" onSubmit={handleConfirmSupervisorBooking} className="space-y-3">
            <Infos cols={2}>
              <Info label="العقار" value={selectedProperty.name} />
              <Info label="المدة والنسبة" value={`${activeDatesForBooking.length} ليلة · ${selectedRatePercent}%`} />
            </Infos>

            {isAdmin && supervisorMembers.length > 0 && (
              <Field label="المشرف المستفيد">
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  className="kt-input"
                >
                  {supervisorMembers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.code})
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="kt-fields">
              <Field label="اسم العميل">
                <input
                  type="text"
                  required
                  placeholder="الاسم"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="رقم الجوال">
                <input
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  required
                  placeholder="05xxxxxxxx"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="kt-input kt-num"
                />
              </Field>
              <Field label="رقم الهوية" hint="اختياري">
                <input
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="10xxxxxxxx"
                  value={custNationalId}
                  onChange={(e) => setCustNationalId(e.target.value)}
                  className="kt-input kt-num"
                />
              </Field>
              <Field label="لوحة السيارة" hint="اختياري">
                <input
                  type="text"
                  placeholder="د ب ي 8972"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="عدد الأشخاص">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="30"
                  value={guestsCountInput}
                  onChange={(e) => setGuestsCountInput(e.target.value)}
                  className="kt-input kt-num"
                />
              </Field>
              <Field label="العربون المدفوع (ر.س)">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={depositInput}
                  onChange={(e) => setDepositInput(Math.max(0, Number(e.target.value)))}
                  className="kt-input kt-num"
                />
              </Field>
              <Field label="ملاحظات الحجز" hint="اختياري" className="kt-wide">
                <input
                  type="text"
                  placeholder="ملاحظات"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="kt-input"
                />
              </Field>
            </div>

            <Infos cols={2}>
              <Info hi label="السعر للعميل" value={money(bookingTotals.totalVisible)} />
              <Info label="صافي العقار" value={money(bookingTotals.propertyNet)} />
              <Info hi wide label={`عمولة ${selectedRatePercent}% + رسوم Supervisor`} value={money(bookingTotals.supervisorCredit)} />
            </Infos>

            {bookingErrorMsg && (
              <div className="kt-err" role="alert">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="flex-1 min-w-0">{bookingErrorMsg}</span>
              </div>
            )}
            {bookingSuccessMsg && (
              <div className="kt-ok" role="status">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
                  <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{bookingSuccessMsg}</span>
                </div>
              </div>
            )}
          </form>
        </Sheet>
      )}

      {/* نافذة معلومات / صور / لوكيشن */}
      {infoModalType && infoModalType !== 'contract' && (
        <Sheet
          title={
            infoModalType === 'info'
              ? `معلومات ${displayPropertyName}`
              : infoModalType === 'photos'
              ? `صور وفيديو ${displayPropertyName}`
              : `لوكيشن ${displayPropertyName}`
          }
          icon={infoModalType === 'photos' ? Film : infoModalType === 'location' ? MapPinned : Home}
          tone="amy"
          onClose={() => setInfoModalType(null)}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إغلاق" onClick={() => setInfoModalType(null)} />
              <Act
                tone="jade"
                icon={MessageCircle}
                label="إرسال للعميل"
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
              {displaySpecSource.subtitle && <p className="kt-note">{displaySpecSource.subtitle}</p>}
              <Infos cols={2}>
                <Info label="السعة" value={`${displaySpecSource.capacity} فرد`} />
                <Info label="غرف النوم" value={displaySpecSource.bedrooms} />
                <Info label="دورات المياه" value={displaySpecSource.bathrooms} />
                <Info label="المساحة" value={`${displaySpecSource.areaM2} م²`} />
                <Info wide label="المسبح" value={displaySpecSource.poolType} />
                <Info label="وقت الدخول" value={selectedProperty.checkInTimeText} />
                <Info label="وقت الخروج" value={selectedProperty.checkOutTimeText} />
                <Info label="التأمين المسترد" value={money(insuranceAmount)} />
                <Info hi label={`السعر (${bookingTotals.nights} ${nightsWord})`} value={money(bookingTotals.totalVisible)} />
              </Infos>
              {displaySpecSource.features && displaySpecSource.features.length > 0 && (
                <div className="kt-bk">
                  <span className="kt-sub-t">المرافق والمميزات</span>
                  <p className="text-[14px] leading-7 text-[#5E5575]">{displaySpecSource.features.join(' · ')}</p>
                </div>
              )}
            </>
          )}

          {infoModalType === 'photos' && (
            <>
              <div className="kt-photos">
                {(selectedProperty.images?.length ? selectedProperty.images : [selectedProperty.coverImage]).map((img, idx) => (
                  <div key={idx} className="kt-photo" style={{ cursor: 'default' }}>
                    <img src={img} alt={selectedProperty.name} referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>

              <Head title="الفيديوهات" icon={Film} tone="sand" count={propertyVideos.length} />
              {propertyVideos.length > 0 ? (
                propertyVideos.map((vid, idx) => {
                  const shareKey = `sup-modal-${idx}`;
                  const isBusy = sharingVideoKey === shareKey;
                  const isExternal = isExternalVideoLink(vid.url);
                  return (
                    <div key={`${vid.url}-${idx}`} className="kt-bk">
                      <div className="aspect-video bg-black rounded-2xl overflow-hidden">
                        <SmartVideoPlayer url={vid.url} className="w-full h-full object-cover" />
                      </div>
                      <span className="kt-row-n">{vid.title}</span>
                      <Act
                        tone={isExternal ? 'soft' : 'ink'}
                        icon={Share2}
                        label={isBusy ? 'جاري التجهيز' : isExternal ? 'رابط خارجي فقط' : 'مشاركة كملف'}
                        disabled={isBusy}
                        onClick={() => void handleShareVideoAsFile(vid.url, vid.title, shareKey)}
                      />
                    </div>
                  );
                })
              ) : (
                <p className="kt-note text-center">لا توجد مقاطع فيديو مضافة لهذا العقار حالياً.</p>
              )}

              {selectedProperty.driveUrl && (
                <Act href={selectedProperty.driveUrl} tone="soft" icon={ExternalLink} label="ألبوم Google Drive" />
              )}
            </>
          )}

          {infoModalType === 'location' && (
            <>
              <Infos cols={1}>
                <Info label="العنوان" value={selectedProperty.address || selectedProperty.location || '—'} />
              </Infos>
              <Act href={resolvedMapUrl} tone="ink" icon={MapPin} label="فتح في خرائط Google" />
            </>
          )}
        </Sheet>
      )}

      {/* مسودة العقد (PDF) */}
      {infoModalType === 'contract' && (
        <PrintableContractModal
          booking={{
            bookingNumber: 'مسودة-حجز',
            propertyId: selectedProperty.id,
            propertyName: selectedProperty.name,
            sectionId: activeSection?.id,
            sectionName: estateSectionName ?? activeSection?.name,
            ...estatePartsExtra,
            customerName: custName.trim() || 'الضيف الكريم',
            customerPhone: custPhone || '05xxxxxxxx',
            customerNationalId: custNationalId.trim() || undefined,
            vehiclePlate: vehiclePlate.trim() || undefined,
            guestsCount:
              guestsCountInput.trim() && Number(guestsCountInput) > 0
                ? Number(guestsCountInput)
                : selectedProperty.capacity,
            checkInDate,
            checkOutDate,
            nightsCount: bookingTotals.nights,
            totalPrice: bookingTotals.totalVisible,
            depositPaid: depositInput,
            remainingAmount,
            insuranceAmount,
          }}
          property={selectedProperty}
          onClose={() => setInfoModalType(null)}
          title={`عقد إيجار ${displayPropertyName} (معاينة وإرسال PDF)`}
        />
      )}

      {/* العقد الرسمي بعد الاعتماد */}
      {confirmedContractData && (
        <PrintableContractModal
          booking={confirmedContractData.booking}
          property={selectedProperty}
          onClose={() => setConfirmedContractData(null)}
          title={`تم اعتماد الحجز وتوليد العقد الرسمي - ${confirmedContractData.bookingNumber}`}
        />
      )}

      {/* معاينة رسالة واتساب */}
      {sentMessageData && (
        <Sheet
          title={sentMessageData.title}
          icon={MessageCircle}
          tone="jade"
          onClose={() => setSentMessageData(null)}
          footer={
            <div className="space-y-2.5">
              <Act
                href={sentMessageData.whatsappUrl}
                tone="jade"
                icon={Send}
                label="فتح واتساب الآن"
                onClick={() => setSentMessageData(null)}
              />
              <Acts cols={2}>
                <Act
                  tone="soft"
                  icon={copiedSentMsg ? Check : Copy}
                  label={copiedSentMsg ? 'تم النسخ' : 'نسخ النص'}
                  onClick={() => {
                    navigator.clipboard.writeText(sentMessageData.text);
                    setCopiedSentMsg(true);
                    setTimeout(() => setCopiedSentMsg(false), 2000);
                  }}
                />
                <Act tone="line" label="إغلاق" onClick={() => setSentMessageData(null)} />
              </Acts>
            </div>
          }
        >
          <Field label="جوال العميل">
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              value={custPhone}
              onChange={(e) => {
                const nextPhone = e.target.value;
                setCustPhone(nextPhone);
                const clean = nextPhone.replace(/\D/g, '').replace(/^0/, '966');
                const nextUrl = `https://wa.me/${clean}?text=${encodeURIComponent(sentMessageData.text)}`;
                setSentMessageData({ ...sentMessageData, phone: nextPhone, whatsappUrl: nextUrl });
              }}
              placeholder="05xxxxxxxx"
              className="kt-input kt-num"
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

      {/* تعديل العربون */}
      {editDepositModalOpen && (
        <Sheet
          title="تعديل مبلغ العربون"
          icon={Edit2}
          tone="sand"
          onClose={() => setEditDepositModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={() => setEditDepositModalOpen(false)} />
              <Act
                tone="ink"
                icon={Check}
                label="حفظ العربون"
                onClick={() => {
                  setDepositInput(tempDepositValue);
                  if (waitingHoldInfo.waitingDates.length > 0) {
                    updateWaitingDepositAmount(
                      selectedPropertyId,
                      waitingHoldInfo.waitingDates,
                      tempDepositValue,
                      activeSection?.id
                    );
                  }
                  setEditDepositModalOpen(false);
                }}
              />
            </Acts>
          }
        >
          <Field label="مبلغ العربون الجديد (ر.س)">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={tempDepositValue}
              onChange={(e) => setTempDepositValue(Math.max(0, Number(e.target.value)))}
              placeholder="0"
              className="kt-input kt-num"
            />
          </Field>
          <div className="kt-field">
            <span className="kt-field-h">
              <span>نسب مقترحة من إجمالي المشرف</span>
              <em>{money(bookingTotals.totalVisible)}</em>
            </span>
            <Acts cols={2}>
              {[0.2, 0.3, 0.5].map((pct) => (
                <Act
                  key={pct}
                  tone="soft"
                  label={`${Math.round(pct * 100)}% · ${Math.round(bookingTotals.totalVisible * pct).toLocaleString('en-US')}`}
                  onClick={() => setTempDepositValue(Math.round(bookingTotals.totalVisible * pct))}
                />
              ))}
              <Act
                tone="line"
                label="الافتراضي"
                onClick={() => setTempDepositValue(selectedProperty.defaultDeposit || 250)}
              />
            </Acts>
          </div>
          <Infos cols={1}>
            <Info hi label="المتبقي للتحصيل" value={money(Math.max(0, bookingTotals.totalVisible - tempDepositValue))} />
          </Infos>
        </Sheet>
      )}
    </div>
  );
};
