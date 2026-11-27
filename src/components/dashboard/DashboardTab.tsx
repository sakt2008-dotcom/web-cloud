import { FollowUpBoard } from './FollowUpBoard';
import {
  Acc,
  Act,
  Acts,
  ActSteps,
  Field,
  Head,
  IconBtn,
  Info,
  Infos,
  Row,
  SearchBox,
  Seg,
  Sheet,
  Stats,
  Tag,
  Tile,
} from '../ui/kit';
import {
  BkHead,
  BkTop,
  ContactList,
  EmptyBox,
  FilePick,
  GuardCashActs,
  KpiTile,
  LinkBtn,
  MsgBox,
  ServicesStrip,
  StageTrack,
  TextField,
  fmtN,
  nightsText,
} from './DashboardCards';
import React, { useState, useMemo, Suspense } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Users,
  Eye,
  MessageCircle,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Check,
  Bell,
  DollarSign,
  Calendar,
  X,
  Play,
  ArrowRight,
  TrendingUp,
  Clock,
  Send,
  AlertTriangle,
  Phone,
  Building2,
  Coffee,
  Sparkles,
  UploadCloud,
  FileText,
  Wallet,
  Camera,
  Image,
  Trash2,
  Percent,
  ShieldAlert,
  ChevronDown,
  Home,
  Copy,
  Settings,
  Printer,
  Download,
  Receipt,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Booking } from '../../types';
import { buildCustomerCallUrl, buildCustomerWhatsappUrl, openExternalUrlSafely } from '../../lib/customerLinks';
import {
  downloadReceiptFile,
  getBookingReceiptsList,
  prepareReceiptFileForAppStorage,
} from '../../lib/bookingReceipts';

import { PrintableContractModal } from '../modals/PrintableContractModal';
import { BookingReceiptsModal } from '../modals/BookingReceiptsModal';
import { BankReceiptsHubModal } from '../modals/BankReceiptsHubModal';

interface GuardActionModalData {
  kind: 'arrive' | 'insrecv' | 'exit' | 'insret';
  booking: Booking;
}

export const DashboardTab: React.FC = () => {
  const {
    properties,
    bookings,
    filteredBookings,
    todayArrivals,
    todayDepartures,
    sendCheckoutReminder,
    markCheckedOut,
    returnInsuranceDeposit,
    guardMarkArrived,
    guardReceiveInsurance,
    guardRequestInsuranceReturn,
    setBookingModalOpen,
    setSelectedPropertyId,
    setActiveTab,
    updateBookingStatus,
    isAdmin,
    isGuard,
    activePermissions,
    canViewDashboard,
    canViewBookings,
    canViewMarketers,
    currentMarketerId,
    currentMarketer,
    completeBookingPayment,
    sendPaymentCompletionRequest,
    guard,
    guardsList,
    recordCustomerArrival,
    recordInsuranceReceived,
    notifyGuardForCashPayment,
    notifyGuardForCashInsurance,
    guardProcessDeparture,
    confirmAttendanceByGuard,
    confirmCashInsuranceByGuard,
    uploadDigitalInsuranceReceipt,
    approveCleanlinessAndExit,
    toggleAdminCommissionApproval,
    uploadRemainingPaymentReceipt,
    toggleGuestArrivalStatus,
    sendQuickAlert,
    requestInsuranceRefundViaBank,
    requestInsuranceRefundViaGuardCash,
    finishBookingAndReturnInsurance,
  } = useApp();

  const effectiveGuard = guard;
  const hasAllBookingsAccess = isAdmin || !!activePermissions.canViewAllBookings || canViewMarketers;
  const hasAdminDashboardActions = isAdmin || (!isGuard && canViewDashboard);

  const [guardConfirm, setGuardConfirm] = useState<GuardActionModalData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [printableContractBooking, setPrintableContractBooking] = useState<Booking | null>(null);
  const [detailsTitle, setDetailsTitle] = useState('تفاصيل الحجز');

  // استرداد المحول (تأمين الحجز المسترد)
  const [refundModalBooking, setRefundModalBooking] = useState<Booking | null>(null);
  const [refundMethod, setRefundMethod] = useState<'bank' | 'cash'>('bank');
  const [refundBankImageFile, setRefundBankImageFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [refundBankImageError, setRefundBankImageError] = useState<string | null>(null);
  const [refundCustomerIban, setRefundCustomerIban] = useState<string>('');
  const [refundNotes, setRefundNotes] = useState<string>('');
  const [copiedGuardCashRefund, setCopiedGuardCashRefund] = useState<boolean>(false);

  // إنهاء الحجز مع رفع إيصال التأمين
  const [finishBookingModal, setFinishBookingModal] = useState<Booking | null>(null);
  const [finishReceiptFile, setFinishReceiptFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [finishFileError, setFinishFileError] = useState<string | null>(null);
  const [finishNotes, setFinishNotes] = useState<string>('');

  // 1. تذكير الحجز الترحيبي للعميل (الأيقونة الأولى)
  const [welcomeReminderBooking, setWelcomeReminderBooking] = useState<Booking | null>(null);
  const [welcomeReminderCustomText, setWelcomeReminderCustomText] = useState<string>('');
  const [copiedWelcome, setCopiedWelcome] = useState(false);

  // 2. سداد وتحصيل المتبقي (الأيقونة الثانية)
  const [remainingPaymentBooking, setRemainingPaymentBooking] = useState<Booking | null>(null);
  const [remainingPaymentTab, setRemainingPaymentTab] = useState<'receipt' | 'cash'>('receipt');
  const [remainingPaymentReceiptFile, setRemainingPaymentReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [remainingPaymentFileError, setRemainingPaymentFileError] = useState<string | null>(null);
  const [remainingPaymentNotes, setRemainingPaymentNotes] = useState('');
  const [copiedRemainingCash, setCopiedRemainingCash] = useState(false);

  // 3. إدارة وتوثيق التأمين (الأيقونة الثالثة)
  const [insuranceActionBooking, setInsuranceActionBooking] = useState<Booking | null>(null);
  const [insuranceActionTab, setInsuranceActionTab] = useState<'receipt' | 'cash'>('receipt');
  const [insuranceActionReceiptFile, setInsuranceActionReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [insuranceActionFileError, setInsuranceActionFileError] = useState<string | null>(null);
  const [insuranceActionCashAmount, setInsuranceActionCashAmount] = useState<number>(500);
  const [insuranceActionNotes, setInsuranceActionNotes] = useState('');
  const [copiedInsuranceCash, setCopiedInsuranceCash] = useState(false);

  // Guard Cash Insurance Modal State
  const [guardCashModalBooking, setGuardCashModalBooking] = useState<Booking | null>(null);
  const [guardCashReceivedAmount, setGuardCashReceivedAmount] = useState<number>(500);
  const [guardCashNotes, setGuardCashNotes] = useState<string>('');

  // Marketer Cash Insurance Alert Modal State
  const [marketerCashAlertBooking, setMarketerCashAlertBooking] = useState<Booking | null>(null);
  const [marketerCashAlertAmount, setMarketerCashAlertAmount] = useState<number>(500);
  const [marketerCashAlertNotes, setMarketerCashAlertNotes] = useState<string>('');

  // Complete payment modal state
  const [paymentModalBooking, setPaymentModalBooking] = useState<Booking | null>(null);
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [paymentFileError, setPaymentFileError] = useState<string | null>(null);

  // Digital Insurance Receipt Uploader State
  const [digitalInsuranceBooking, setDigitalInsuranceBooking] = useState<Booking | null>(null);
  const [digitalInsuranceFile, setDigitalInsuranceFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [digitalInsuranceError, setDigitalInsuranceError] = useState<string | null>(null);
  const [digitalInsuranceNotes, setDigitalInsuranceNotes] = useState<string>('');

  // New Arrival Modal State
  const [arrivalModalBooking, setArrivalModalBooking] = useState<Booking | null>(null);
  const [arrivalPayMethod, setArrivalPayMethod] = useState<'receipt' | 'cash'>('receipt');
  const [arrivalReceiptFile, setArrivalReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [arrivalFileError, setArrivalFileError] = useState<string | null>(null);
  const [arrivalNotes, setArrivalNotes] = useState('');

  // Marketer Complete Payment Modal State
  const [marketerPaymentModalBooking, setMarketerPaymentModalBooking] = useState<Booking | null>(null);
  const [marketerPaymentTab, setMarketerPaymentTab] = useState<'welcome' | 'payment'>('payment');
  const [marketerPayMethod, setMarketerPayMethod] = useState<'receipt' | 'cash'>('receipt');
  const [marketerReceiptFile, setMarketerReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [marketerFileError, setMarketerFileError] = useState<string | null>(null);
  const [marketerWelcomeCustomText, setMarketerWelcomeCustomText] = useState('');

  // New Insurance Modal State
  const [insuranceModalBooking, setInsuranceModalBooking] = useState<Booking | null>(null);
  const [insurancePayMethod, setInsurancePayMethod] = useState<'receipt' | 'cash'>('receipt');
  const [insuranceReceiptFile, setInsuranceReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [insuranceFileError, setInsuranceFileError] = useState<string | null>(null);
  const [insuranceNotes, setInsuranceNotes] = useState('');

  // Insurance confirmation modal (old quick confirm)
  const [insuranceConfirmBooking, setInsuranceConfirmBooking] = useState<Booking | null>(null);

  // Receipt view & hub modals
  const [viewReceiptBooking, setViewReceiptBooking] = useState<Booking | null>(null);
  const [receiptsModalBooking, setReceiptsModalBooking] = useState<Booking | null>(null);
  const [receiptsHubOpen, setReceiptsHubOpen] = useState<boolean>(false);

  // Guard Departure & Insurance Inspection Modal State (مغادرة اليوم: إعادة التأمين أو خصم مبلغ مع خانة إرفاق صور العبث والأضرار)
  const [guardInspectionBooking, setGuardInspectionBooking] = useState<Booking | null>(null);
  const [guardInspectionResult, setGuardInspectionResult] = useState<'full_refund' | 'deduction'>('full_refund');
  const [guardDeductionAmount, setGuardDeductionAmount] = useState<number>(0);
  const [guardDamageDesc, setGuardDamageDesc] = useState<string>('');
  const [guardDamagePhotos, setGuardDamagePhotos] = useState<{ name: string; dataUrl: string }[]>([]);
  const [guardInspectionError, setGuardInspectionError] = useState<string | null>(null);

  // Marketer Checkout Reminder Modal State (رسالة تذكير بالخروج تقوم المسوقة بذلك)
  const [reminderModalBooking, setReminderModalBooking] = useState<Booking | null>(null);
  const [customReminderMsg, setCustomReminderMsg] = useState<string>('');

  // Filter & search
  const [activeFilter, setActiveFilter] = useState<'all' | 'arrivals' | 'departures' | 'tracking'>('all');
  const [trackingSubFilter, setTrackingSubFilter] = useState<'all' | 'todayDepartures'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailableProps, setShowAvailableProps] = useState(true);
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});

  const toggleBookingExpanded = (id: string) => {
    setExpandedBookingIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }, []);

  // Available today properties
  const availableTodayProperties = useMemo(() => {
    return properties.filter((prop) => {
      if (!prop.isPublished) return false;
      const isBooked = bookings.some(
        (b) =>
          b.propertyId === prop.id &&
          b.status !== 'cancelled' &&
          todayStr >= b.checkInDate &&
          todayStr < b.checkOutDate
      );
      return !isBooked;
    });
  }, [properties, bookings, todayStr]);

  const activeBookings = useMemo(() => {
    return filteredBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'pending_payment' || b.status === 'waiting_deposit'
    );
  }, [filteredBookings]);

  // Role & permissions-driven arrivals visibility
  const visibleArrivals = useMemo(() => {
    if (hasAllBookingsAccess) return todayArrivals;
    if (isGuard) {
      const assignedIds = effectiveGuard.assignedPropertyIds && effectiveGuard.assignedPropertyIds.length > 0
        ? effectiveGuard.assignedPropertyIds
        : effectiveGuard.assignedPropertyId
        ? [effectiveGuard.assignedPropertyId]
        : [];
      if (assignedIds.length === 0) return todayArrivals;
      return todayArrivals.filter((b) => assignedIds.includes(b.propertyId));
    }
    return todayArrivals.filter(
      (b) => b.marketerId === currentMarketerId || (currentMarketer && b.marketerName === currentMarketer.name)
    );
  }, [todayArrivals, hasAllBookingsAccess, isGuard, effectiveGuard.assignedPropertyId, effectiveGuard.assignedPropertyIds, currentMarketerId, currentMarketer]);

  // المقيمون الآن (وصلوا ولم يخرجوا) حسب الدور
  const boardInStay = useMemo(() => {
    const assignedIds = effectiveGuard.assignedPropertyIds && effectiveGuard.assignedPropertyIds.length > 0
      ? effectiveGuard.assignedPropertyIds
      : effectiveGuard.assignedPropertyId ? [effectiveGuard.assignedPropertyId] : [];
    return bookings.filter((b) => {
      if (b.status === 'cancelled' || b.status === 'waiting_deposit') return false;
      if (b.checkedOut || !(todayStr >= b.checkInDate && todayStr <= b.checkOutDate)) return false;
      if (hasAllBookingsAccess) return true;
      if (isGuard) return assignedIds.length === 0 || assignedIds.includes(b.propertyId);
      return b.marketerId === currentMarketerId || (!!currentMarketer && b.marketerName === currentMarketer.name);
    });
  }, [bookings, todayStr, hasAllBookingsAccess, isGuard, effectiveGuard.assignedPropertyId, effectiveGuard.assignedPropertyIds, currentMarketerId, currentMarketer]);

  // Role & permissions-driven departures visibility
  const visibleDepartures = useMemo(() => {
    if (hasAllBookingsAccess) return todayDepartures;
    if (isGuard) {
      const assignedIds = effectiveGuard.assignedPropertyIds && effectiveGuard.assignedPropertyIds.length > 0
        ? effectiveGuard.assignedPropertyIds
        : effectiveGuard.assignedPropertyId
        ? [effectiveGuard.assignedPropertyId]
        : [];
      if (assignedIds.length === 0) return todayDepartures;
      return todayDepartures.filter((b) => assignedIds.includes(b.propertyId));
    }
    return todayDepartures.filter(
      (b) => b.marketerId === currentMarketerId || (currentMarketer && b.marketerName === currentMarketer.name)
    );
  }, [todayDepartures, hasAllBookingsAccess, isGuard, effectiveGuard.assignedPropertyId, effectiveGuard.assignedPropertyIds, currentMarketerId, currentMarketer]);

  // All bookings filtered according to permissions & role
  const roleFilteredBookings = useMemo(() => {
    if (hasAllBookingsAccess) return bookings;
    if (isGuard) {
      const assignedIds = effectiveGuard.assignedPropertyIds && effectiveGuard.assignedPropertyIds.length > 0
        ? effectiveGuard.assignedPropertyIds
        : effectiveGuard.assignedPropertyId
        ? [effectiveGuard.assignedPropertyId]
        : [];
      if (assignedIds.length === 0) return bookings;
      return bookings.filter((b) => assignedIds.includes(b.propertyId));
    }
    return bookings.filter(
      (b) => b.marketerId === currentMarketerId || (currentMarketer && b.marketerName === currentMarketer.name)
    );
  }, [bookings, hasAllBookingsAccess, isGuard, effectiveGuard.assignedPropertyId, effectiveGuard.assignedPropertyIds, currentMarketerId, currentMarketer]);

  // Tracking Bookings: support 'all' vs 'todayDepartures'
  const trackingBookings = useMemo(() => {
    let list = roleFilteredBookings.filter((b) => b.status !== 'cancelled');
    if (trackingSubFilter === 'todayDepartures') {
      list = list.filter((b) => b.checkOutDate === todayStr);
    }
    return [...list].sort((a, b) => {
      const aIsToday = a.checkInDate === todayStr || a.checkOutDate === todayStr ? 1 : 0;
      const bIsToday = b.checkInDate === todayStr || b.checkOutDate === todayStr ? 1 : 0;
      if (aIsToday !== bIsToday) return bIsToday - aIsToday;
      return b.checkInDate.localeCompare(a.checkInDate);
    });
  }, [roleFilteredBookings, trackingSubFilter, todayStr]);

  type ReceiptItem = ReturnType<typeof getBookingReceiptsList>[number];
  const [receiptGroup, setReceiptGroup] = useState<{ title: string; items: ReceiptItem[] } | null>(null);
  const receiptsOf = (bk: Booking, kinds: ReceiptItem['kind'][]) =>
    getBookingReceiptsList(bk).filter((r) => kinds.includes(r.kind));
  const openReceiptGroup = (bk: Booking, kinds: ReceiptItem['kind'][], title: string) => {
    const items = receiptsOf(bk, kinds);
    if (items.length === 0) {
      showToast(`لا توجد ${title} مرفوعة لهذا الحجز بعد`);
      return;
    }
    setReceiptGroup({ title, items });
  };

  const matchesSearch = (b: Booking) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      b.customerName.toLowerCase().includes(term) ||
      b.customerPhone.includes(term) ||
      b.propertyName.toLowerCase().includes(term) ||
      (b.marketerName && b.marketerName.toLowerCase().includes(term))
    );
  };

  const searchFilteredArrivals = useMemo(() => visibleArrivals.filter(matchesSearch), [visibleArrivals, searchTerm]);
  const searchFilteredDepartures = useMemo(() => visibleDepartures.filter(matchesSearch), [visibleDepartures, searchTerm]);
  const searchFilteredActive = useMemo(() => activeBookings.filter(matchesSearch), [activeBookings, searchTerm]);
  const searchFilteredTracking = useMemo(
    () => trackingBookings.filter(matchesSearch),
    [trackingBookings, searchTerm]
  );
  const waitingDepositBookings = useMemo(
    () => bookings.filter((b) => b.status === 'waiting_deposit').filter(matchesSearch),
    [bookings, searchTerm]
  );

  // مسار تتبع مراحل الحجز التلقائي (الـ 5 مراحل)
  const getBookingStages = (bk: Booking) => {
    // 1- تم الدخول (عند تسجيل دخول النزيل)
    const isEntered = Boolean(bk.guestArrived || bk.arrivalConfirmedAt);

    // 2- تم دفع المتبقي (فور سداد المبلغ المتبقي)
    const isRemainingPaid = Boolean(
      bk.remainingAmount <= 0 ||
      bk.paymentCompleted ||
      bk.arrivalPaymentMethod === 'receipt' ||
      bk.arrivalPaymentMethod === 'cash'
    );

    // 3- تم دفع التأمين (فور استلام أو دفع التأمين)
    const isInsurancePaid = Boolean(
      bk.insuranceReceivedCash ||
      bk.insurancePaymentMethod ||
      bk.cashInsuranceConfirmedByGuard ||
      bk.insuranceReceivedAmount ||
      bk.digitalInsuranceReceiptUrl
    );

    // 4- تم الخروج (فور تسجيل خروج النزيل)
    const isCheckedOut = Boolean(
      bk.checkedOut ||
      bk.cleanlinessApproved ||
      bk.status === 'completed'
    );

    // 5- تم استرجاع التأمين (فور إرجاع التأمين للنزيل)
    const isInsuranceRefunded = Boolean(
      bk.insuranceReturned
    );

    let completedCount = 0;
    if (isEntered) completedCount++;
    if (isRemainingPaid) completedCount++;
    if (isInsurancePaid) completedCount++;
    if (isCheckedOut) completedCount++;
    if (isInsuranceRefunded) completedCount++;

    return {
      isEntered,
      isRemainingPaid,
      isInsurancePaid,
      isCheckedOut,
      isInsuranceRefunded,
      completedCount,
    };
  };
  const completedBookingsCount = useMemo(
    () => bookings.filter((b) => b.status === 'completed').length,
    [bookings]
  );

  const handleCheckoutReminder = (bookingId: string) => {
    const { whatsappUrl } = sendCheckoutReminder(bookingId);
    if (whatsappUrl) {
      openExternalUrlSafely(whatsappUrl);
    }
    showToast('تم فتح واتساب مع نص تذكير الخروج للعميل بنجاح');
  };

  const handlePaymentReminder = (bookingId: string) => {
    const { whatsappUrl } = sendPaymentCompletionRequest(bookingId);
    if (whatsappUrl) {
      openExternalUrlSafely(whatsappUrl);
    }
    showToast('تم فتح واتساب مع نص تذكير الدفع للعميل');
  };

  const openPaymentModal = (b: Booking) => {
    setPaymentModalBooking(b);
    setPaymentReceiptFile(null);
    setPaymentFileError(null);
  };

  const handleReceiptFileChange = async (file?: File) => {
    setPaymentFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setPaymentReceiptFile(prepared);
    } catch (err: any) {
      setPaymentFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitPaymentCompletion = () => {
    if (!paymentModalBooking || !paymentReceiptFile) return;
    completeBookingPayment(paymentModalBooking.id, paymentReceiptFile.name, paymentReceiptFile.dataUrl);
    setPaymentModalBooking(null);
    setPaymentReceiptFile(null);
    showToast('تم حفظ الإيصال وتسجيل إكمال الدفع بنجاح');
  };

  const confirmInsuranceHandover = () => {
    if (insuranceConfirmBooking) {
      returnInsuranceDeposit(insuranceConfirmBooking.id);
      setInsuranceConfirmBooking(null);
      showToast('تم تسجيل تسليم التأمين للعميل بنجاح');
    }
  };

  const openArrivalModal = (bk: Booking) => {
    setArrivalModalBooking(bk);
    setArrivalPayMethod('receipt');
    setArrivalReceiptFile(null);
    setArrivalFileError(null);
    setArrivalNotes('');
  };

  const handleArrivalReceiptChange = async (file?: File) => {
    setArrivalFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setArrivalReceiptFile(prepared);
    } catch (err: any) {
      setArrivalFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitArrivalConfirmation = () => {
    if (!arrivalModalBooking) return;
    if (arrivalPayMethod === 'receipt' && arrivalModalBooking.remainingAmount > 0 && !arrivalReceiptFile) {
      setArrivalFileError('يرجى إرفاق صورة إيصال السداد البنكي للمتابعة.');
      return;
    }
    recordCustomerArrival({
      bookingId: arrivalModalBooking.id,
      paymentMethod: arrivalPayMethod,
      receiptName: arrivalReceiptFile?.name,
      receiptDataUrl: arrivalReceiptFile?.dataUrl,
      notes: arrivalNotes,
    });
    const targetBooking = arrivalModalBooking;
    setArrivalModalBooking(null);
    showToast(`تم تأكيد وصول العميل (${targetBooking.customerName}) وإرسال إشعار فوري للحارس والإدارة بنجاح ✓`);
  };

  const handleGuardArrivalClick = (bk: Booking) => {
    confirmAttendanceByGuard(bk.id);
    showToast(`تم [تأكيد الحضور] للعميل (${bk.customerName}) وإرسال إشعار فوري لمسوق الحجز والإدارة بنجاح ✓`);
  };

  const handleGuardConfirmAttendance = (bk: Booking) => {
    confirmAttendanceByGuard(bk.id);
    showToast(`تم [تأكيد الحضور] للعميل (${bk.customerName}) وإرسال إشعار فوري لمسوق الحجز والإدارة بنجاح ✓`);
  };

  const handleSendPaymentCompletionWhatsApp = (bk: Booking) => {
    const res = sendPaymentCompletionRequest(bk.id);
    if (res.whatsappUrl) {
      openExternalUrlSafely(res.whatsappUrl);
    }
    showToast(`تم فتح واتساب بقالب [إكمال المتبقي والتأمين] للعميل (${bk.customerName}) بنجاح ✓`);
  };

  const handleGuardConfirmCashInsurance = (bk: Booking) => {
    confirmCashInsuranceByGuard(bk.id);
    showToast(`تم [تأكيد استلام التأمين كاش] بمبلغ (${bk.insuranceAmount} ر.س) للعميل (${bk.customerName}) وتوثيقه بالنظام ✓`);
  };

  const handleMarketerSendCheckoutReminder = (bk: Booking) => {
    const res = sendCheckoutReminder(bk.id);
    if (res.whatsappUrl) {
      openExternalUrlSafely(res.whatsappUrl);
    }
    showToast(`تم إرسال [تذكير بالخروج] عبر واتساب للعميل (${bk.customerName}) وتنبيهه لتفادي خصم التأمين ✓`);
  };

  const handleGuardApproveCleanlinessAndExit = (bk: Booking) => {
    approveCleanlinessAndExit({
      bookingId: bk.id,
      result: 'full_refund',
    });
    showToast(`تم [تأكيد النظافة والخروج] للعميل (${bk.customerName}) وإغلاق دورة الحجز بنجاح ✓`);
  };

  const openMarketerPaymentModal = (bk: Booking, defaultTab: 'welcome' | 'payment' = 'payment') => {
    setMarketerPaymentModalBooking(bk);
    setMarketerPaymentTab(defaultTab);
    setMarketerPayMethod('receipt');
    setMarketerReceiptFile(null);
    setMarketerFileError(null);
    setMarketerWelcomeCustomText(
      `أهلاً وسهلاً بك أخي الكريم ${bk.customerName} في ${bk.propertyName} 🌿 يسعدنا ويشرفنا استقبالكم اليوم، ونتمنى لكم أوقاتاً ممتعة وسعيدة. لأي استفسار أو خدمة طوال إقامتكم نحن والحارس (${guard?.name || 'أبو راشد'}) بخدمتكم دائماً.`
    );
  };

  const handleMarketerReceiptChange = async (file?: File) => {
    setMarketerFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setMarketerReceiptFile(prepared);
    } catch (err: any) {
      setMarketerFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitMarketerPayment = () => {
    if (!marketerPaymentModalBooking) return;
    const bk = marketerPaymentModalBooking;

    if (marketerPayMethod === 'receipt') {
      if (!marketerReceiptFile && bk.remainingAmount > 0) {
        setMarketerFileError('يرجى إرفاق صورة إيصال السداد البنكي للمتابعة.');
        return;
      }
      completeBookingPayment(bk.id, marketerReceiptFile?.name || 'إيصال سداد', marketerReceiptFile?.dataUrl);
      setMarketerPaymentModalBooking(null);
      showToast(`تم حفظ الإيصال وتأكيد إكمال الدفع للعميل (${bk.customerName}) بنجاح ✓`);
    } else {
      // تسليم المبلغ كاش: يرسل إشعار للحارس للذهاب لاستلام المبلغ وسعر المبلغ المتبقي
      notifyGuardForCashPayment({ bookingId: bk.id });
      setMarketerPaymentModalBooking(null);
      showToast(`تم إرسال إشعار عاجل للحارس (${guard?.name || 'أبو راشد'}) بالتوجه لاستلام المبلغ المتبقي (${bk.remainingAmount} ر.س) كاش ✓`);
    }
  };

  const sendWelcomeMessageWhatsApp = (bk: Booking, customMsg?: string) => {
    const text =
      customMsg ||
      `أهلاً وسهلاً بك أخي الكريم ${bk.customerName} في ${bk.propertyName} 🌿 يسعدنا ويشرفنا استقبالكم اليوم، ونتمنى لكم أوقاتاً ممتعة وسعيدة. لأي استفسار أو خدمة طوال إقامتكم نحن والحارس (${guard?.name || 'أبو راشد'}) بخدمتكم دائماً.`;
    openExternalUrlSafely(buildCustomerWhatsappUrl(bk.customerPhone, text));
    showToast('تم فتح محادثة واتساب لإرسال رسالة الترحيب للعميل');
  };

  const copyTextToClipboard = (text: string, onSuccess: () => void) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        onSuccess();
        showToast('تم نسخ النص بنجاح للمراسلة عبر الواتساب والتطبيق ✓');
      }).catch(() => {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  };

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      onSuccess();
      showToast('تم نسخ النص بنجاح للمراسلة عبر الواتساب والتطبيق ✓');
    } catch {
      showToast('تعذر النسخ التلقائي، يرجى التحديد والنسخ يدوياً');
    }
  };

  // الأيقونة الأولى: تذكير الحجز
  const openWelcomeReminderModal = (bk: Booking) => {
    const prop = properties.find((p) => p.id === bk.propertyId);
    const checkInTime = prop?.checkInTimeText || 'الساعة 5:00 عصراً';
    const propGuard = guardsList?.find((g) => g.assignedPropertyId === bk.propertyId) || guard;
    const defaultText = `أهلاً وسهلاً بك أخي الكريم ${bk.customerName} في (${bk.propertyName}) 🌿
يسعدنا ويشرفنا استقبالكم اليوم، ونود تذكيركم بتفاصيل موعد الدخول وتجهيز المكان:

• موعد الدخول: ${checkInTime}
• المبلغ المتبقي للإقامة: ${bk.remainingAmount} ر.س
• مبلغ التأمين المسترد: ${bk.insuranceAmount} ر.س (على نفس الحساب)

🏦 بيانات الحساب البنكي المعتمد للتحويل:
• اسم البنك: ${prop?.bankName || 'مصرف الراجحي'}
• المستفيد: ${prop?.accountHolder || 'AMASA RESORT'}
• رقم الآيبان (IBAN):
${prop?.iban || 'SA0380000201608010998877'}

نتمنى لكم إقامة سعيدة وممتعة! لأي استفسار نحن والحارس (${propGuard?.name || 'أبو راشد'}) بخدمتكم دائماً ✨`;

    setWelcomeReminderBooking(bk);
    setWelcomeReminderCustomText(defaultText);
    setCopiedWelcome(false);
  };

  // الأيقونة الثانية: المتبقي
  const openRemainingPaymentModal = (bk: Booking) => {
    setRemainingPaymentBooking(bk);
    setRemainingPaymentTab('receipt');
    setRemainingPaymentReceiptFile(null);
    setRemainingPaymentFileError(null);
    setRemainingPaymentNotes('');
    setCopiedRemainingCash(false);
  };

  const handleRemainingReceiptFileChange = async (file?: File) => {
    setRemainingPaymentFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setRemainingPaymentReceiptFile(prepared);
    } catch (err: any) {
      setRemainingPaymentFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitRemainingReceiptToAdmin = () => {
    if (!remainingPaymentBooking) return;
    if (!remainingPaymentReceiptFile?.dataUrl) {
      setRemainingPaymentFileError('يرجى اختيار وإرفاق صورة إيصال السداد البنكي للمتابعة.');
      return;
    }
    uploadRemainingPaymentReceipt({
      bookingId: remainingPaymentBooking.id,
      receiptName: remainingPaymentReceiptFile.name,
      receiptDataUrl: remainingPaymentReceiptFile.dataUrl,
      notes: remainingPaymentNotes,
    });
    setRemainingPaymentBooking(null);
    showToast('تم رفع صورة الإيصال وإرسالها فوراً إلى «تنبيهات الإدارة» لحفظها ومراجعتها بنجاح ✓');
  };

  const submitRemainingCashToGuard = () => {
    if (!remainingPaymentBooking) return;
    notifyGuardForCashPayment({
      bookingId: remainingPaymentBooking.id,
      notes: remainingPaymentNotes,
    });
    setRemainingPaymentBooking(null);
    showToast(`تم إرسال إشعار فوري للوحة الحارس لاستلام المتبقي (${remainingPaymentBooking.remainingAmount} ر.س) كاش بنجاح ✓`);
  };

  const getRemainingCashGuardText = (bk: Booking) => {
    const propGuard = guardsList?.find((g) => g.assignedPropertyId === bk.propertyId) || guard;
    return `السلام عليكم يا ${propGuard?.name || 'أبو راشد'}، بخصوص حجز اليوم في ${bk.propertyName} للعميل ${bk.customerName} (جوال: ${bk.customerPhone}): يرجى التوجه واستلام المبلغ المتبقي كاش وقدره (${bk.remainingAmount} ر.س) وتأكيده بالنظام.${remainingPaymentNotes ? ` ملاحظات: ${remainingPaymentNotes}` : ''}`;
  };

  // الأيقونة الثالثة: التأمين
  const openInsuranceActionModal = (bk: Booking) => {
    setInsuranceActionBooking(bk);
    setInsuranceActionTab('receipt');
    setInsuranceActionReceiptFile(null);
    setInsuranceActionFileError(null);
    setInsuranceActionCashAmount(bk.insuranceAmount);
    setInsuranceActionNotes('');
    setCopiedInsuranceCash(false);
  };

  const handleInsuranceActionReceiptChange = async (file?: File) => {
    setInsuranceActionFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setInsuranceActionReceiptFile(prepared);
    } catch (err: any) {
      setInsuranceActionFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitInsuranceReceiptToAdmin = () => {
    if (!insuranceActionBooking) return;
    if (!insuranceActionReceiptFile?.dataUrl) {
      setInsuranceActionFileError('يرجى اختيار وإرفاق صورة إيصال التأمين البنكي للمتابعة.');
      return;
    }
    uploadDigitalInsuranceReceipt({
      bookingId: insuranceActionBooking.id,
      receiptName: insuranceActionReceiptFile.name,
      receiptDataUrl: insuranceActionReceiptFile.dataUrl,
      notes: insuranceActionNotes,
    });
    setInsuranceActionBooking(null);
    showToast('تم رفع صورة إيصال التأمين البنكي وإرسالها فوراً إلى «تنبيهات الإدارة» لحفظها ومراجعتها بنجاح ✓');
  };

  const submitInsuranceCashToGuard = () => {
    if (!insuranceActionBooking) return;
    const amount = insuranceActionCashAmount || insuranceActionBooking.insuranceAmount;
    notifyGuardForCashInsurance({
      bookingId: insuranceActionBooking.id,
      insuranceAmount: amount,
      notes: insuranceActionNotes,
    });
    setInsuranceActionBooking(null);
    showToast(`تم إرسال إشعار فوري للوحة الحارس لاستلام مبلغ التأمين (${amount} ر.س) كاش بنجاح ✓`);
  };

  const getInsuranceCashGuardText = (bk: Booking) => {
    const propGuard = guardsList?.find((g) => g.assignedPropertyId === bk.propertyId) || guard;
    const amount = insuranceActionCashAmount || bk.insuranceAmount;
    return `السلام عليكم يا ${propGuard?.name || 'أبو راشد'}، بخصوص حجز اليوم في ${bk.propertyName} للعميل ${bk.customerName} (جوال: ${bk.customerPhone}): يرجى التوجه واستلام مبلغ التأمين كاش وقدره (${amount} ر.س) وتأكيده بالنظام.${insuranceActionNotes ? ` ملاحظات: ${insuranceActionNotes}` : ''}`;
  };

  // مؤشر حالة الوصول: أداة سريعة
  const handleToggleArrival = (bk: Booking) => {
    const res = toggleGuestArrivalStatus(bk.id);
    if (res.isArrived) {
      showToast(`تم تأكيد وصول العميل (${bk.customerName}) وإرسال إشعار تلقائي فوري للحارس والإدارة بنجاح ✓`);
    } else {
      showToast(`تم إعادة حالة النزيل (${bk.customerName}) إلى (انتظار الوصول) بنجاح`);
    }
  };

  // استرداد المحول (تأمين الحجز المسترد)
  const openInsuranceRefundModal = (bk: Booking) => {
    setRefundModalBooking(bk);
    setRefundMethod(bk.insurancePaymentMethod === 'cash' || bk.insuranceReceivedCash ? 'cash' : 'bank');
    setRefundBankImageFile(
      bk.customerBankReceiptUrl
        ? { name: bk.customerBankReceiptName || 'صورة الحساب المحفوظة', dataUrl: bk.customerBankReceiptUrl }
        : null
    );
    setRefundCustomerIban(bk.customerIban || '');
    setRefundNotes('');
    setRefundBankImageError(null);
    setCopiedGuardCashRefund(false);
  };

  const handleRefundBankImageChange = async (file?: File) => {
    setRefundBankImageError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setRefundBankImageFile(prepared);
    } catch (err: any) {
      setRefundBankImageError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitRefundBankToAdmin = () => {
    if (!refundModalBooking) return;
    if (!refundBankImageFile && !refundCustomerIban.trim()) {
      setRefundBankImageError('يرجى رفع صورة الحساب البنكي / الآيبان أو كتابة رقم الآيبان للمتابعة.');
      return;
    }
    requestInsuranceRefundViaBank({
      bookingId: refundModalBooking.id,
      bankReceiptName: refundBankImageFile?.name,
      bankReceiptDataUrl: refundBankImageFile?.dataUrl,
      customerIban: refundCustomerIban.trim(),
      notes: refundNotes,
    });
    setRefundModalBooking(null);
    showToast('تم حفظ صورة الحساب وإرسال تنبيه فوري للإدارة لمراجعة التحويل بنجاح ✓');
  };

  const submitRefundCashToGuard = () => {
    if (!refundModalBooking) return;
    requestInsuranceRefundViaGuardCash({
      bookingId: refundModalBooking.id,
      notes: refundNotes,
    });
    setRefundModalBooking(null);
    showToast('تم إرسال توجيه فوري للوحة الحارس لتسليم التأمين كاش للنزيل بنجاح ✓');
  };

  const getGuardCashRefundText = (bk: Booking) => {
    const propGuard = guardsList?.find((g) => g.assignedPropertyId === bk.propertyId) || guard;
    const deduction = bk.insuranceDeductionAmount || 0;
    const refundAmount = Math.max(0, bk.insuranceAmount - deduction);
    return `السلام عليكم يا ${propGuard?.name || 'أبو راشد'}، بخصوص مغادرة اليوم في ${bk.propertyName} للعميل ${bk.customerName} (جوال: ${bk.customerPhone}): يرجى تسليم مبلغ التأمين كاش للنزيل وقدره (${refundAmount} ر.س) عند الخروج.${refundNotes ? ` ملاحظات: ${refundNotes}` : ''}`;
  };

  // إنهاء الحجز مع خيار رفع إيصال التأمين
  const openFinishBookingModal = (bk: Booking) => {
    setFinishBookingModal(bk);
    setFinishReceiptFile(
      bk.insuranceRefundReceiptUrl
        ? { name: bk.insuranceRefundReceiptName || 'إيصال التأمين المسترد', dataUrl: bk.insuranceRefundReceiptUrl }
        : null
    );
    setFinishFileError(null);
    setFinishNotes('');
  };

  const handleFinishReceiptChange = async (file?: File) => {
    setFinishFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setFinishReceiptFile(prepared);
    } catch (err: any) {
      setFinishFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitFinishBooking = () => {
    if (!finishBookingModal) return;
    finishBookingAndReturnInsurance({
      bookingId: finishBookingModal.id,
      receiptName: finishReceiptFile?.name,
      receiptDataUrl: finishReceiptFile?.dataUrl,
      notes: finishNotes,
    });
    setFinishBookingModal(null);
    showToast(`تم إنهاء الحجز #${finishBookingModal.bookingNumber} بنجاح وإرسال إشعار فوري للمسوقة والإدارة ✓`);
  };

  const openInsuranceModal = (bk: Booking) => {
    setInsuranceModalBooking(bk);
    setInsurancePayMethod('receipt');
    setInsuranceReceiptFile(null);
    setInsuranceFileError(null);
    setInsuranceNotes('');
  };

  const handleInsuranceReceiptChange = async (file?: File) => {
    setInsuranceFileError(null);
    if (!file) return;
    try {
      const prepared = await prepareReceiptFileForAppStorage(file);
      setInsuranceReceiptFile(prepared);
    } catch (err: any) {
      setInsuranceFileError(err?.message || 'تعذر تجهيز ملف الإيصال للحفظ.');
    }
  };

  const submitInsuranceConfirmation = () => {
    if (!insuranceModalBooking) return;
    if (insurancePayMethod === 'receipt' && !insuranceReceiptFile) {
      setInsuranceFileError('يجب إرفاق ملف إيصال التأمين البنكي للمتابعة!');
      return;
    }
    recordInsuranceReceived({
      bookingId: insuranceModalBooking.id,
      paymentMethod: insurancePayMethod,
      receiptName: insuranceReceiptFile?.name,
      receiptDataUrl: insuranceReceiptFile?.dataUrl,
      notes: insuranceNotes,
    });
    const targetBooking = insuranceModalBooking;
    setInsuranceModalBooking(null);
    showToast(`تم تأكيد استلام التأمين (${targetBooking.insuranceAmount} ر.س) وإرسال إشعار فوري للحارس والإدارة بنجاح ✓`);
  };

  const getWhatsAppCustomerUrl = (phone: string, name: string, prop: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '966' + clean.substring(1);
    else if (!clean.startsWith('966')) clean = '966' + clean;
    const text = `أهلاً بك أخي الكريم ${name}، يسعدنا استقبالكم اليوم في ${prop} الساعة 5 م. ونتمنى لكم إقامة ممتعة وسعيدة. لأي استفسار أو مساعدة نحن بخدمتكم دائماً.`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  const getWhatsAppGuardUrl = (bk: Booking) => {
    let clean = (guard?.phone || '0598881234').replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '966' + clean.substring(1);
    else if (!clean.startsWith('966')) clean = '966' + clean;
    const text = `السلام عليكم يا أبو راشد (${guard?.name || 'حارس الاستراحة'})، بخصوص حجز اليوم في ${bk.propertyName} للعميل ${bk.customerName} (جوال: ${bk.customerPhone}). حبيت أتابع معك موعد وصول النزيل وتجهيز الاستراحة واستلام التأمين (${bk.insuranceAmount} ريال).`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  const getWhatsAppAdminUrl = (bk: Booking) => {
    const text = `السلام عليكم إدارة AMASA RESORT، استفسار ومتابعة بخصوص حجز اليوم رقم ${bk.bookingNumber} في ${bk.propertyName} للعميل ${bk.customerName}. المتبقي للتحصيل: ${bk.remainingAmount} ر.س والتأمين: ${bk.insuranceAmount} ر.س.`;
    return `https://wa.me/966500000001?text=${encodeURIComponent(text)}`;
  };

  const openGuardInspectionModal = (bk: Booking) => {
    setGuardInspectionBooking(bk);
    setGuardInspectionResult('full_refund');
    setGuardDeductionAmount(0);
    setGuardDamageDesc('');
    setGuardDamagePhotos([]);
    setGuardInspectionError(null);
  };

  const handleDamagePhotoUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setGuardInspectionError(null);
    Array.from(files).forEach((file) => {
      if (file.size > 4 * 1024 * 1024) {
        setGuardInspectionError('تجاوزت بعض الصور الحد الأقصى المسموح (4 ميجابايت).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setGuardDamagePhotos((prev) => [...prev, { name: file.name, dataUrl: String(reader.result) }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeDamagePhoto = (index: number) => {
    setGuardDamagePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submitGuardDepartureInspection = () => {
    if (!guardInspectionBooking) return;
    const bk = guardInspectionBooking;

    if (guardInspectionResult === 'deduction') {
      if (!guardDeductionAmount || guardDeductionAmount <= 0) {
        setGuardInspectionError('يرجى تحديد مبلغ الخصم بالريال السعودي.');
        return;
      }
      if (guardDeductionAmount > bk.insuranceAmount) {
        setGuardInspectionError(`مبلغ الخصم لا يمكن أن يتجاوز إجمالي مبلغ التأمين (${bk.insuranceAmount} ر.س).`);
        return;
      }
      if (!guardDamageDesc.trim()) {
        setGuardInspectionError('يرجى كتابة وصف موجز للعبث أو الأضرار المرصودة بالاستراحة.');
        return;
      }
    }

    guardProcessDeparture({
      bookingId: bk.id,
      result: guardInspectionResult,
      deductionAmount: guardInspectionResult === 'deduction' ? guardDeductionAmount : 0,
      damageDescription: guardInspectionResult === 'deduction' ? guardDamageDesc : undefined,
      damagePhotos: guardInspectionResult === 'deduction' ? guardDamagePhotos : undefined,
    });

    setGuardInspectionBooking(null);
    showToast(
      guardInspectionResult === 'full_refund'
        ? `تم تسجيل خروج النزيل تماماً وإشعار المسوقة والإدارة بسلامة الاستراحة وإعادة التأمين (${bk.insuranceAmount} ر.س) ✓`
        : `تم تسجيل خروج النزيل وتوثيق خصم (${guardDeductionAmount} ر.س) مع إرفاق الصور وإشعار المسوقة والإدارة فوراً ✓`
    );
  };

  const openMarketerReminderModal = (bk: Booking) => {
    const prop = properties.find((p) => p.id === bk.propertyId);
    const checkOutTime = prop?.checkOutTimeText || 'الساعة 2:00 ظهراً';
    const defaultText = `السلام عليكم ورحمة الله وبركاته، أخي الكريم ${bk.customerName} 🌿 نود تذكيركم بموعد تسجيل الخروج اليوم من (${bk.propertyName}) في تمام ${checkOutTime}، وتسليم المفتاح للحارس (${guard?.name || 'أبو راشد'}) لمعاينة الاستراحة واسترداد مبلغ التأمين (${bk.insuranceAmount} ر.س). شاكرين لكم وممتنين لاختياركم لنا.`;
    setReminderModalBooking(bk);
    setCustomReminderMsg(defaultText);
  };

  const sendMarketerReminder = (bk: Booking, customText?: string) => {
    const res = sendCheckoutReminder(bk.id);
    const url = customText
      ? buildCustomerWhatsappUrl(bk.customerPhone || '0550000000', customText)
      : res.whatsappUrl;
    openExternalUrlSafely(url);
    setReminderModalBooking(null);
    showToast(`تم إرسال تذكير الخروج للنزيل (${bk.customerName}) عبر واتساب المسوقة بنجاح ✓`);
  };

  const getWhatsAppDirectUrl = (phone: string, name: string, prop: string, type: 'arrival' | 'departure') => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '966' + clean.substring(1);
    else if (!clean.startsWith('966')) clean = '966' + clean;

    const text =
      type === 'arrival'
        ? `أهلاً بك أخي الكريم ${name}، يسعدنا استقبالكم اليوم في ${prop} الساعة 5 م. ونتمنى لكم إقامة ممتعة وسعيدة. لأي استفسار نحن بخدمتكم دائماً.`
        : `أهلاً بك أخي الكريم ${name}، نأمل أن تكونوا قضيتم أوقاتاً ممتعة في ${prop}. نود تذكيركم بموعد المغادرة الساعة 2 م، وسيتم تسليم مبلغ التأمين عند الخروج. شكراً لكم.`;

    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  // تنفيذ إجراء الحارس/الإدارة (يُستخدم من نافذة التأكيد ومن السحب المباشر في لوحة المتابعة)
  const performGuardAction = (kind: NonNullable<typeof guardConfirm>['kind'], bk: Booking) => {
    if (kind === 'arrive') {
      confirmAttendanceByGuard(bk.id);
      showToast(`تم [تأكيد الحضور] للعميل (${bk.customerName}) وإرسال إشعار فوري لمسوق الحجز والإدارة بنجاح ✓`);
    } else if (kind === 'insrecv') {
      confirmCashInsuranceByGuard(bk.id);
      showToast(`تم [تأكيد استلام التأمين كاش] بمبلغ (${bk.insuranceAmount} ر.س) وتوثيقه رسمياً في النظام ✓`);
    } else if (kind === 'exit') {
      approveCleanlinessAndExit({
        bookingId: bk.id,
        result: 'full_refund',
      });
      showToast(`تم [تأكيد النظافة والخروج] للعميل (${bk.customerName}) وإغلاق دورة الحجز بنجاح ✓`);
    } else {
      returnInsuranceDeposit(bk.id);
      showToast('تم إرسال تنبيه إعادة التأمين كاش للعميل بنجاح ✓');
    }
  };

  const otherTracking =
    activeFilter === 'all'
      ? searchFilteredTracking.filter((b) => b.checkInDate !== todayStr && b.checkOutDate !== todayStr)
      : searchFilteredTracking;

  /** بطاقة دخول اليوم: مسار التتبع + وصول ← المتبقي ← التأمين ← الإيصالات */
  const renderArrivalCard = (bk: Booking, key: string) => {
    const stages = getBookingStages(bk);
    const isExpanded = Boolean(expandedBookingIds[key]);
    const propGuard = guardsList?.find((g) => g.assignedPropertyId === bk.propertyId) || guard;
    const isHamran = bk.propertyId === 'hamran' || bk.propertyName.includes('حمران');
    const isPaidInFull = bk.remainingAmount <= 0;
    const isInsurancePaid = Boolean(bk.insuranceReceivedCash || bk.insurancePaymentMethod || stages.isInsurancePaid);
    const arrived = Boolean(bk.guestArrived || bk.arrivalConfirmedAt);
    const hasBreakfast = !(bk.withoutBreakfast || (!bk.breakfastOption && !bk.breakfastPrice));
    const hasCoord = Boolean(bk.coordinatorName || bk.coordinatorService);
    const payCount = receiptsOf(bk, ['deposit', 'remaining']).length;
    const insCount = receiptsOf(bk, ['insurance']).length;

    return (
      <div key={key} className="kt-bk">
        <BkTop bk={bk} todayStr={todayStr} />
        {isHamran && (
          <ServicesStrip
            hasBreakfast={hasBreakfast}
            breakfastText={`${bk.breakfastOption || 'فطور شامي فاخر'}${bk.breakfastPrice ? ` · ${fmtN(bk.breakfastPrice)} ر.س` : ''}`}
            hasCoordinator={hasCoord}
            coordinatorText={`${bk.coordinatorName || 'المنسقة'}${bk.coordinatorService ? ` · ${bk.coordinatorService}` : ''}`}
          />
        )}
        <StageTrack bk={bk} todayStr={todayStr} stages={stages} />

        <ActSteps
          items={[
            {
              key: 'arr',
              label: 'وصول',
              value: arrived ? bk.guestArrivedAt || bk.arrivalConfirmedAt || 'تم ✓' : 'لم يصل',
              icon: arrived ? CheckCircle2 : Clock,
              tone: 'jade',
              done: arrived,
              onClick: () => handleToggleArrival(bk),
              title: 'تأكيد وصول النزيل',
            },
            {
              key: 'bal',
              label: 'المتبقي',
              value: isPaidInFull ? 'مسدد ✓' : fmtN(bk.remainingAmount),
              icon: DollarSign,
              tone: 'sand',
              done: isPaidInFull,
              onClick: () => openRemainingPaymentModal(bk),
              title: 'تذكير وسداد المتبقي',
            },
            {
              key: 'ins',
              label: 'التأمين',
              value: isInsurancePaid ? 'مستلم ✓' : fmtN(bk.insuranceAmount),
              icon: ShieldCheck,
              tone: 'line',
              done: isInsurancePaid,
              onClick: () => openInsuranceActionModal(bk),
              title: 'استلام التأمين',
            },
            {
              key: 'rc-pay',
              label: 'إيصالات',
              value: `الدفع ${payCount}/2`,
              icon: Wallet,
              tone: 'violet',
              done: payCount > 0,
              onClick: () => openReceiptGroup(bk, ['deposit', 'remaining'], 'إيصالات الدفع (العربون والمتبقي)'),
              title: 'نسخة إيصال العربون والمتبقي',
            },
            {
              key: 'rc-ins',
              label: 'إيصال',
              value: insCount > 0 ? 'التأمين ✓' : 'التأمين ✕',
              icon: Receipt,
              tone: 'violet',
              done: insCount > 0,
              onClick: () => openReceiptGroup(bk, ['insurance'], 'إيصال التأمين'),
              title: 'نسخة إيصال التأمين',
            },
          ]}
        />

        <Acc
          icon={<Phone size={20} strokeWidth={1.8} />}
          title="التواصل والتفاصيل"
          open={isExpanded}
          onToggle={() => toggleBookingExpanded(key)}
        >
          <ContactList
            customerName={bk.customerName}
            customerTel={`tel:${bk.customerPhone}`}
            customerWa={getWhatsAppCustomerUrl(bk.customerPhone, bk.customerName, bk.propertyName)}
            guardName={propGuard?.name || 'أبو راشد'}
            guardTel={`tel:${propGuard?.phone || '0598881234'}`}
            guardWa={getWhatsAppGuardUrl(bk)}
            adminTel="tel:0500000001"
            adminWa={getWhatsAppAdminUrl(bk)}
          />
          <Act tone="soft" icon={MessageCircle} label="تذكير الحجز" onClick={() => openWelcomeReminderModal(bk)} />
          <Act
            tone="ink"
            icon={Eye}
            label="عرض تفاصيل الحجز"
            onClick={() => {
              setDetailsTitle('تفاصيل الحجز الكاملة');
              setSelectedBookingForDetails(bk);
            }}
          />
        </Acc>
      </div>
    );
  };

  /** بطاقة مختصرة لباقي الحجوزات: مسار التتبع فقط + عرض التفاصيل */
  const renderCompactCard = (bk: Booking, key: string) => (
    <div key={key} className="kt-bk">
      <BkTop bk={bk} todayStr={todayStr} />
      <StageTrack bk={bk} todayStr={todayStr} stages={getBookingStages(bk)} />
      <Act
        tone="ink"
        icon={Eye}
        label="عرض تفاصيل الحجز"
        onClick={() => {
          setDetailsTitle('تفاصيل الحجز الكاملة');
          setSelectedBookingForDetails(bk);
        }}
      />
    </div>
  );

  return (
    <div className="pb-24 sm:pb-28 w-full max-w-[1920px] mx-auto px-2.5 sm:px-6 lg:px-8 pt-3 sm:pt-4 space-y-3.5 sm:space-y-5">
      {/* إشعار عائم موحّد */}
      {toastMessage && (
        <div className="kt-toast" role="status" aria-live="polite">
          <div className="is-ok">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <FollowUpBoard
        role={isAdmin ? 'admin' : isGuard ? 'guard' : 'marketer'}
        todayStr={todayStr}
        arrivals={visibleArrivals.filter((b) => b.status !== 'cancelled')}
        departures={visibleDepartures.filter((b) => b.status !== 'cancelled')}
        inStay={boardInStay}
        getStages={getBookingStages}
        onGuardAction={(kind, bk) => setGuardConfirm({ kind, booking: bk })}
        onGuardConfirm={(kind, bk) => performGuardAction(kind, bk)}
        sendAlert={sendQuickAlert}
        notify={showToast}
      />

      {/* أزرار الإجراءات العلوية — بأحجام متساوية */}
      <Acts
        cols={
          ([(!isGuard || canViewBookings || hasAllBookingsAccess), !isGuard, true].filter(Boolean).length || 1) as 1 | 2 | 3
        }
      >
        {(!isGuard || canViewBookings || hasAllBookingsAccess) && (
          <Act
            stack
            tone="ink"
            icon={Plus}
            label="حجز جديد"
            title="حجز جديد أو إغلاق تواريخ بدون حجز"
            onClick={() => setBookingModalOpen(true)}
          />
        )}
        {!isGuard && (
          <Act
            stack
            tone="soft"
            icon={Receipt}
            label={`الإيصالات ${roleFilteredBookings.filter((b) => b.status !== 'cancelled' && getBookingReceiptsList(b).length > 0).length}`}
            onClick={() => setReceiptsHubOpen(true)}
          />
        )}
        <Act stack tone="line" icon={RotateCcw} label="تحديث" onClick={() => showToast('تم تحديث البيانات الحية بنجاح')} />
      </Acts>

      {/* بطاقات الإحصاء — 4 بلاطات متساوية تعمل كمرشّحات */}
      <Stats cols={2} compact>
        <KpiTile
          label="دخول اليوم"
          value={visibleArrivals.length}
          hint="حركة اليوم"
          icon={LogIn}
          tone="saph"
          on={activeFilter === 'arrivals'}
          onClick={() => setActiveFilter('arrivals')}
        />
        <KpiTile
          label="خروج اليوم"
          value={visibleDepartures.length}
          hint="حركة اليوم"
          icon={LogOut}
          tone="garn"
          on={activeFilter === 'departures'}
          onClick={() => setActiveFilter('departures')}
        />
        <KpiTile
          label="كل الحجوزات"
          value={roleFilteredBookings.filter((b) => b.status !== 'cancelled').length}
          hint="نشطة الآن"
          icon={Clock}
          tone="sand"
          on={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <KpiTile
          label="تتبع الحجز"
          value={trackingBookings.length}
          hint="نزيل اليوم"
          icon={Settings}
          tone="jade"
          on={activeFilter === 'tracking'}
          onClick={() => setActiveFilter('tracking')}
        />
      </Stats>

      {/* البحث */}
      <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="ابحث بالاسم أو الجوال أو رقم الحجز" />

      {/* ═══ حركات دخول اليوم ═══ */}
      {(activeFilter === 'arrivals' || activeFilter === 'all') && (
        <section className="lux-card p-4 space-y-3.5">
          <Head
            title="دخول اليوم"
            icon={LogIn}
            tone="saph"
            count={searchFilteredArrivals.length}
            action={<Tag tone="saph">مباشر</Tag>}
          />

          {searchFilteredArrivals.length === 0 ? (
            <EmptyBox icon={Calendar} text="لا توجد حركات دخول لليوم" />
          ) : (
            <div className="space-y-3">
              {searchFilteredArrivals.map((bk, idx) => renderArrivalCard(bk, bk.id ? `arr-${bk.id}` : `arr-${idx}`))}
            </div>
          )}
        </section>
      )}

      {/* ═══ حركات خروج ومغادرة اليوم ═══ */}
      {(activeFilter === 'departures' || activeFilter === 'all') && (
        <section className="lux-card p-4 space-y-3.5">
          <Head
            title="خروج اليوم"
            icon={LogOut}
            tone="garn"
            count={searchFilteredDepartures.length}
            action={<Tag tone="garn">مغادرة</Tag>}
          />

          {searchFilteredDepartures.length === 0 ? (
            <EmptyBox icon={Calendar} text="لا توجد حركات خروج لليوم" />
          ) : (
            <div className="space-y-3">
              {searchFilteredDepartures.map((bk, idx) => {
                const adminFee = bk.adminFee ?? 50;
                const netRevenue = Math.max(0, bk.totalPrice - adminFee);
                const comm5 = Math.round(netRevenue * 0.05);
                const comm7 = Math.round(netRevenue * 0.07);
                const isApproved7 = Boolean(bk.adminApprovedFullBooking);
                const effectiveComm = isApproved7 ? bk.marketerCommission || comm7 : comm5;
                const effectivePercent = isApproved7 ? 7 : 5;
                const depKey = bk.id ? `dep-${bk.id}` : `dep-${idx}`;
                const isExpanded = Boolean(expandedBookingIds[depKey]);
                const exitDone = Boolean(bk.cleanlinessApproved || bk.checkedOut);
                const exitTime = bk.checkedOutAt || bk.cleanlinessApprovedAt || '';
                const hasBreakfast = Boolean(bk.breakfastOption);
                const hasCoord = Boolean(bk.coordinatorName);
                const refundLabel = bk.insuranceReturned
                  ? 'تم الاسترداد ✓'
                  : bk.insuranceRefundRequested
                  ? 'طلب الاسترداد'
                  : 'استرداد المحول';
                const refundTone = bk.insuranceReturned ? 'jadeS' : bk.insuranceRefundRequested ? 'sand' : 'soft';
                const reminderAct = (
                  <Act
                    tone={bk.checkoutReminderSent ? 'jadeS' : 'jade'}
                    icon={MessageCircle}
                    label={bk.checkoutReminderSent ? 'تم التذكير ✓' : 'تذكير بالخروج'}
                    onClick={() => handleMarketerSendCheckoutReminder(bk)}
                  />
                );

                const depStages = getBookingStages(bk);
                const insRecvCount = receiptsOf(bk, ['insurance', 'insurance_refund']).length;
                const depSteps: React.ComponentProps<typeof ActSteps>['items'] = [];
                if (!isGuard) {
                  depSteps.push({
                    key: 'rem',
                    label: 'تذكير',
                    value: bk.checkoutReminderSent ? 'تم ✓' : 'الخروج',
                    icon: MessageCircle,
                    tone: 'violet',
                    done: Boolean(bk.checkoutReminderSent),
                    onClick: () => handleMarketerSendCheckoutReminder(bk),
                    title: 'تذكير بالخروج',
                  });
                }
                depSteps.push({
                  key: 'exit',
                  label: 'تم الخروج',
                  value: exitDone ? exitTime || '✓' : isGuard || hasAdminDashboardActions ? 'تأكيد' : 'بانتظار الحارس',
                  icon: CheckCircle2,
                  tone: 'jade',
                  done: exitDone,
                  onClick: () => {
                    if (isGuard) setGuardConfirm({ kind: 'exit', booking: bk });
                    else if (hasAdminDashboardActions) openGuardInspectionModal(bk);
                    else showToast(exitDone ? 'تم تأكيد الخروج ✓' : 'بانتظار تأكيد الحارس للخروج');
                  },
                  title: 'تأكيد النظافة والخروج',
                });
                depSteps.push({
                  key: 'ref',
                  label: 'إعادة',
                  value: bk.insuranceReturned ? 'التأمين ✓' : bk.insuranceRefundRequested ? 'مطلوب' : 'التأمين',
                  icon: RotateCcw,
                  tone: bk.insuranceRefundRequested ? 'sand' : 'violet',
                  done: Boolean(bk.insuranceReturned),
                  onClick: () => openInsuranceRefundModal(bk),
                  title: `استرداد التأمين المحول (${fmtN(bk.insuranceAmount)} ر.س)`,
                });
                depSteps.push({
                  key: 'rc-ins',
                  label: 'إيصال',
                  value: insRecvCount > 0 ? 'التأمين ✓' : 'التأمين ✕',
                  icon: Receipt,
                  tone: 'violet',
                  done: insRecvCount > 0,
                  onClick: () => openReceiptGroup(bk, ['insurance', 'insurance_refund'], 'إيصالات التأمين (الاستلام والإعادة)'),
                  title: 'نسخة إيصال التأمين',
                });
                depSteps.push({
                  key: 'fin',
                  label: 'إنهاء',
                  value: bk.status === 'completed' ? 'منتهي ✓' : 'الحجز',
                  icon: CheckCircle2,
                  tone: 'line',
                  done: bk.status === 'completed',
                  onClick: () => openFinishBookingModal(bk),
                });

                return (
                  <div key={depKey} className="kt-bk">
                    <BkTop bk={bk} todayStr={todayStr} />

                    {(hasBreakfast || hasCoord) && (
                      <ServicesStrip
                        hasBreakfast={hasBreakfast}
                        breakfastText={bk.breakfastOption}
                        hasCoordinator={hasCoord}
                        coordinatorText={bk.coordinatorName}
                      />
                    )}

                    {isGuard && (
                      <Infos cols={1}>
                        <Info
                          hi={Boolean(bk.checkoutReminderSent)}
                          label="تذكير الخروج"
                          value={bk.checkoutReminderSent ? 'تم الإرسال ✓' : 'لم يُرسل'}
                        />
                      </Infos>
                    )}
                    {!isGuard && !hasAdminDashboardActions && (
                      <Infos cols={1}>
                        <Info
                          hi={exitDone}
                          label="حالة الخروج"
                          value={exitDone ? `تم الخروج ✓ ${exitTime}`.trim() : 'بانتظار الحارس'}
                        />
                      </Infos>
                    )}

                    <StageTrack bk={bk} todayStr={todayStr} stages={depStages} />
                    <ActSteps items={depSteps} />

                    <Acc
                      icon={<MessageCircle size={20} strokeWidth={1.8} />}
                      title="التواصل والتسوية"
                      open={isExpanded}
                      onToggle={() => toggleBookingExpanded(depKey)}
                    >
                      {bk.insuranceDeductionAmount && bk.insuranceDeductionAmount > 0 ? (
                        <div className="kt-warn p-3.5 space-y-2.5">
                          <div className="kt-bk-h">
                            <Tile icon={AlertTriangle} tone="sand" size={36} />
                            <span className="kt-row-t">
                              <span className="kt-row-n">تقرير الحارس: أضرار</span>
                              <span className="kt-row-s">خصم من التأمين</span>
                            </span>
                            <Tag tone="garn">{fmtN(bk.insuranceDeductionAmount)} ر.س</Tag>
                          </div>
                          {bk.damageDescription ? <p className="kt-note">{bk.damageDescription}</p> : null}
                          {bk.damagePhotos && bk.damagePhotos.length > 0 ? (
                            <div className="kt-photos">
                              {bk.damagePhotos.map((photo, pIdx) => (
                                <a key={pIdx} href={photo.dataUrl} target="_blank" rel="noopener noreferrer" className="kt-photo">
                                  <img src={photo.dataUrl} alt={photo.name} />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <ContactList
                        customerName={bk.customerName}
                        customerTel={`tel:${bk.customerPhone}`}
                        customerWa={getWhatsAppCustomerUrl(bk.customerPhone, bk.customerName, bk.propertyName)}
                        guardName={guard?.name || 'الحارس'}
                        guardTel={`tel:${guard?.phone || '0598881234'}`}
                        guardWa={getWhatsAppGuardUrl(bk)}
                        adminTel="tel:0500000001"
                        adminWa={getWhatsAppAdminUrl(bk)}
                      />
                      <Act
                        tone="ink"
                        icon={Eye}
                        label="تفاصيل الحجز والتسوية"
                        onClick={() => {
                          setDetailsTitle('تفاصيل الحجز الكاملة والتسوية');
                          setSelectedBookingForDetails(bk);
                        }}
                      />
                      <Infos cols={2}>
                        <Info label="الإجمالي" value={`${fmtN(bk.totalPrice)} ر.س`} />
                        <Info label="الرسوم" value={`${fmtN(adminFee)} ر.س`} />
                        <Info label="الصافي" value={`${fmtN(netRevenue)} ر.س`} />
                        <Info hi label={`العمولة ${effectivePercent}%`} value={`${fmtN(effectiveComm)} ر.س`} />
                      </Infos>
                      {hasAdminDashboardActions && (
                        <Row
                          title={isApproved7 ? 'معتمد 7% ✓' : 'نسبة العمولة 5%'}
                          sub="اعتماد 7% كحجز كامل"
                          end={
                            <Act
                              small
                              tone={isApproved7 ? 'jadeS' : 'soft'}
                              label={isApproved7 ? 'إلغاء 7%' : 'اعتماد 7%'}
                              onClick={() => toggleAdminCommissionApproval(bk.id)}
                            />
                          }
                        />
                      )}
                    </Acc>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ═══ كل الحجوزات النشطة ═══ */}
      {(!isGuard || canViewBookings || hasAllBookingsAccess) && activeFilter === 'all' && (
        <section className="lux-card p-4 space-y-3.5">
          <Head title="الحجوزات النشطة" icon={Users} count={searchFilteredActive.length} />

          {searchFilteredActive.length === 0 ? (
            <EmptyBox icon={Users} text="لا توجد حجوزات نشطة" />
          ) : (
            <div className="kt-grid2">
              {searchFilteredActive.map((bk, idx) => (
                <div key={`${bk.id || 'act'}-${idx}`} className="kt-bk">
                  <div className="kt-bk-h">
                    <span className="kt-row-t">
                      <span className="kt-row-n">{bk.customerName}</span>
                      <span className="kt-row-s">
                        <bdi dir="ltr">{bk.customerPhone}</bdi>
                      </span>
                    </span>
                    <LinkBtn
                      href={getWhatsAppDirectUrl(bk.customerPhone, bk.customerName, bk.propertyName, 'arrival')}
                      label="واتساب العميل"
                      icon={MessageCircle}
                      jade
                      external
                    />
                    <Act
                      small
                      tone="ink"
                      icon={Eye}
                      label="عرض"
                      onClick={() => {
                        setDetailsTitle('تفاصيل الحجز الكاملة');
                        setSelectedBookingForDetails(bk);
                      }}
                    />
                  </div>
                  <Infos cols={2}>
                    <Info label="العقار" value={bk.propertyName} />
                    <Info ltr label="الإجمالي / العربون" value={`${fmtN(bk.totalPrice)} / ${fmtN(bk.depositPaid)}`} />
                    <Info ltr label="الدخول" value={bk.checkInDate} />
                    <Info ltr label="الخروج" value={bk.checkOutDate} />
                  </Infos>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ تتبع الحجز ومسار المراحل الخمس ═══ */}
      {(activeFilter === 'tracking' || activeFilter === 'all') && (
        <section className="lux-card p-4 space-y-3.5">
          <Head title="باقي الحجوزات" icon={Settings} tone="jade" count={otherTracking.length} />

          <Seg
            compact
            label="تصفية التتبع"
            value={trackingSubFilter}
            onChange={setTrackingSubFilter}
            items={[
              {
                id: 'all' as const,
                label: 'الكل',
                badge: roleFilteredBookings.filter((b) => b.status !== 'cancelled').length,
              },
              {
                id: 'todayDepartures' as const,
                label: 'يخرج اليوم',
                badge: roleFilteredBookings.filter((b) => b.status !== 'cancelled' && b.checkOutDate === todayStr).length,
              },
            ]}
          />

          {otherTracking.length === 0 ? (
            <EmptyBox icon={Calendar} text="لا توجد حجوزات مطابقة" />
          ) : (
            <div className="space-y-3">
              {otherTracking.map((bk, idx) => renderCompactCard(bk, bk.id ? `trk-${bk.id}` : `trk-${idx}`))}
            </div>
          )}
        </section>
      )}

      {/* ═══ المتاح اليوم ═══ */}
      {(!isGuard || canViewBookings || hasAllBookingsAccess) && (
        <section className="lux-card p-4 space-y-3.5">
          <Head
            title="المتاح اليوم"
            icon={Calendar}
            tone="jade"
            count={availableTodayProperties.length}
            action={
              <Act
                small
                tone="soft"
                label={showAvailableProps ? 'إخفاء' : 'عرض'}
                onClick={() => setShowAvailableProps(!showAvailableProps)}
              />
            }
          />

          {showAvailableProps &&
            (availableTodayProperties.length === 0 ? (
              <EmptyBox icon={Home} text="لا توجد استراحات متاحة اليوم" />
            ) : (
              <div className="space-y-2.5 animate-in fade-in duration-150">
                {availableTodayProperties.map((prop) => (
                  <div key={prop.id} className="kt-bk">
                    <div className="kt-bk-h">
                      <Tile icon={Home} tone="jade" size={40} />
                      <span className="kt-row-t">
                        <span className="kt-row-n">{prop.name}</span>
                        <span className="kt-row-s">{prop.location}</span>
                      </span>
                    </div>
                    <div className="kt-g2">
                      <Info label="سعر الليلة" value={`${fmtN(prop.basePriceWeekday)} ر.س`} />
                      <Act
                        tone="ink"
                        label="حجز الآن"
                        onClick={() => {
                          setSelectedPropertyId(prop.id);
                          setActiveTab('calendar');
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </section>
      )}

      {/* ═══════════ النوافذ المنبثقة — نمط موحّد (ترويسة داكنة + أزرار متساوية) ═══════════ */}

      {/* تأكيد إجراء الحارس */}
      {guardConfirm && (
        <Sheet
          title="تأكيد الإرسال"
          icon={AlertTriangle}
          tone={
            guardConfirm.kind === 'arrive'
              ? 'saph'
              : guardConfirm.kind === 'insrecv'
              ? 'sand'
              : guardConfirm.kind === 'exit'
              ? 'garn'
              : 'jade'
          }
          onClose={() => setGuardConfirm(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="jade"
                icon={CheckCircle2}
                label={
                  guardConfirm.kind === 'arrive'
                    ? 'تأكيد الحضور'
                    : guardConfirm.kind === 'insrecv'
                    ? 'استلام التأمين'
                    : guardConfirm.kind === 'exit'
                    ? 'تأكيد الخروج'
                    : 'تأكيد الإرسال'
                }
                onClick={() => {
                  performGuardAction(guardConfirm.kind, guardConfirm.booking);
                  setGuardConfirm(null);
                }}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setGuardConfirm(null)} />
            </Acts>
          }
        >
          <BkHead bk={guardConfirm.booking} />
          <Infos cols={2}>
            <Info
              label="الجوال"
              ltr
              wide={!(guardConfirm.kind === 'insrecv' || guardConfirm.kind === 'insret')}
              value={guardConfirm.booking.customerPhone}
            />
            {(guardConfirm.kind === 'insrecv' || guardConfirm.kind === 'insret') && (
              <Info hi label="التأمين" value={`${fmtN(guardConfirm.booking.insuranceAmount)} ر.س`} />
            )}
          </Infos>
        </Sheet>
      )}

      {/* تفاصيل الحجز */}
      {selectedBookingForDetails &&
        (() => {
          const b = selectedBookingForDetails;
          const rcpts = getBookingReceiptsList(b);
          const rcptsGone = Boolean(b.receiptsDeletedAfterCommissionPaid || b.commissionStatus === 'paid');
          const owes = b.remainingAmount > 0;
          return (
            <Sheet
              title={detailsTitle.includes('التسوية') ? 'تفاصيل الحجز والتسوية' : 'تفاصيل الحجز'}
              icon={Eye}
              tone="amy"
              onClose={() => setSelectedBookingForDetails(null)}
              footer={
                <Acts cols={3}>
                  <Act
                    stack
                    tone="ink"
                    icon={FileText}
                    label="العقد PDF"
                    onClick={() => {
                      setSelectedBookingForDetails(null);
                      setPrintableContractBooking(b);
                    }}
                  />
                  <Act
                    stack
                    tone={owes ? 'jade' : 'jadeS'}
                    icon={MessageCircle}
                    label={owes ? 'تذكير الدفع' : 'مدفوع ✓'}
                    disabled={!owes}
                    onClick={() => {
                      handlePaymentReminder(b.id);
                      setSelectedBookingForDetails(null);
                    }}
                  />
                  <Act stack tone="line" icon={X} label="إغلاق" onClick={() => setSelectedBookingForDetails(null)} />
                </Acts>
              }
            >
              <BkHead bk={b} />
              <Infos cols={2}>
                <Info label="الجوال" ltr value={b.customerPhone} />
                <Info label="المدة" value={nightsText(b.nightsCount)} />
                <Info label="الدخول" ltr value={b.checkInDate} />
                <Info label="الخروج" ltr value={b.checkOutDate} />
                <Info label="الإجمالي" value={`${fmtN(b.totalPrice)} ر.س`} />
                <Info label="العربون" value={`${fmtN(b.depositPaid)} ر.س`} />
                <Info hi={!owes} label="المتبقي" value={owes ? `${fmtN(b.remainingAmount)} ر.س` : 'مسدد ✓'} />
                <Info
                  hi={Boolean(b.insuranceReturned)}
                  label={b.insuranceReturned ? 'التأمين (مسلَّم)' : 'التأمين (معلق)'}
                  value={`${fmtN(b.insuranceAmount)} ر.س`}
                />
                <Info label="المسوق" value={b.marketerName || 'حجز مباشر'} />
                <Info label="العمولة" value={b.marketerName ? `${fmtN(b.marketerCommission)} ر.س` : '—'} />
              </Infos>

              <div className="kt-sub">
                <Head
                  title="الإيصالات البنكية"
                  icon={Receipt}
                  tone="amy"
                  count={rcpts.length}
                  action={
                    <Act small tone="soft" icon={Eye} label="استعراض" onClick={() => setReceiptsModalBooking(b)} />
                  }
                />
                {rcptsGone ? (
                  <div className="kt-ok">
                    <span className="text-[13.5px] font-bold" style={{ color: '#0e5a49' }}>
                      ✓ حُذفت الإيصالات تلقائياً بعد تحويل العمولة
                    </span>
                  </div>
                ) : rcpts.length === 0 ? (
                  <p className="kt-note">لا توجد إيصالات بنكية مرفقة لهذا الحجز</p>
                ) : (
                  rcpts.map((item) => (
                    <Row
                      key={item.id}
                      icon={Receipt}
                      tone="amy"
                      title={item.label}
                      sub={item.fileName}
                      end={
                        <span className="flex gap-1.5">
                          <IconBtn icon={Eye} label="استعراض" onClick={() => setReceiptsModalBooking(b)} />
                          <IconBtn
                            icon={Download}
                            label="تحميل"
                            onClick={() =>
                              downloadReceiptFile(item.dataUrl, `${b.bookingNumber}-${item.label}-${item.fileName}`)
                            }
                          />
                        </span>
                      }
                    />
                  ))
                )}
              </div>
            </Sheet>
          );
        })()}

      {printableContractBooking && (
        <PrintableContractModal
          booking={printableContractBooking}
          property={properties.find((p) => p.id === printableContractBooking.propertyId)}
          onClose={() => setPrintableContractBooking(null)}
        />
      )}

      {/* عارض الإيصالات + مركز الإيصالات البنكية */}
      <BookingReceiptsModal
        booking={receiptsModalBooking || viewReceiptBooking}
        onClose={() => {
          setReceiptsModalBooking(null);
          setViewReceiptBooking(null);
        }}
      />
      <BankReceiptsHubModal isOpen={receiptsHubOpen} onClose={() => setReceiptsHubOpen(false)} />

      {/* معاينة الحارس عند الخروج: إعادة التأمين كاملاً أو خصم أضرار */}
      {guardInspectionBooking && (
        <Sheet
          title="معاينة الخروج"
          icon={ShieldCheck}
          tone="garn"
          onClose={() => setGuardInspectionBooking(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone={guardInspectionResult === 'deduction' ? 'garnet' : 'jade'}
                icon={CheckCircle2}
                label={guardInspectionResult === 'deduction' ? 'تأكيد الخصم' : 'تأكيد الخروج'}
                onClick={submitGuardDepartureInspection}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setGuardInspectionBooking(null)} />
            </Acts>
          }
        >
          <BkHead bk={guardInspectionBooking} />
          <Infos cols={2}>
            <Info label="المسوق" value={guardInspectionBooking.marketerName || 'حجز مباشر'} />
            <Info hi label="التأمين المودع" value={`${fmtN(guardInspectionBooking.insuranceAmount)} ر.س`} />
          </Infos>

          <Seg
            label="نتيجة المعاينة"
            value={guardInspectionResult}
            onChange={(v) => {
              setGuardInspectionResult(v);
              setGuardInspectionError(null);
            }}
            items={[
              { id: 'full_refund' as const, label: 'إعادة كاملة', icon: ShieldCheck },
              { id: 'deduction' as const, label: 'خصم أضرار', icon: AlertTriangle },
            ]}
          />

          {guardInspectionResult === 'deduction' && (
            <div className="kt-warn p-3.5 flex flex-col gap-3">
              <Field label="المبلغ المخصوم (ر.س) *" hint={`الحد ${fmtN(guardInspectionBooking.insuranceAmount)}`}>
                <input
                  type="number"
                  min={1}
                  max={guardInspectionBooking.insuranceAmount}
                  className="kt-input kt-num"
                  value={guardDeductionAmount || ''}
                  onChange={(e) => setGuardDeductionAmount(Number(e.target.value))}
                  placeholder="0"
                />
              </Field>
              <p className="kt-note">
                المسترد للعميل:{' '}
                {fmtN(Math.max(0, guardInspectionBooking.insuranceAmount - (guardDeductionAmount || 0)))} ر.س
              </p>
              <Field label="وصف الأضرار *">
                <textarea
                  rows={3}
                  className="kt-input kt-ta"
                  value={guardDamageDesc}
                  onChange={(e) => setGuardDamageDesc(e.target.value)}
                  placeholder="مثال: كسر طاولة، اتساخ شديد في المسبح"
                />
              </Field>
              <label className="kt-file">
                <Camera size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>إرفاق صور الأضرار</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleDamagePhotoUpload(e.target.files)}
                />
              </label>
              {guardDamagePhotos.length > 0 && (
                <div className="kt-photos">
                  {guardDamagePhotos.map((photo, idx) => (
                    <div key={idx} className="kt-photo">
                      <img src={photo.dataUrl} alt={photo.name} />
                      <button
                        type="button"
                        className="kt-photo-x"
                        aria-label="حذف الصورة"
                        onClick={() => removeDamagePhoto(idx)}
                      >
                        <Trash2 size={18} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {guardInspectionError && (
            <p className="kt-err" role="alert">
              {guardInspectionError}
            </p>
          )}
        </Sheet>
      )}

      {/* 1) تذكير الحجز والترحيب بالعميل */}
      {welcomeReminderBooking && (
        <Sheet
          wide
          title="تذكير الحجز"
          icon={MessageCircle}
          tone="amy"
          onClose={() => setWelcomeReminderBooking(null)}
          footer={
            <Acts cols={3}>
              <Act
                stack
                tone="jade"
                icon={MessageCircle}
                label="إرسال واتساب"
                onClick={() => {
                  openExternalUrlSafely(
                    buildCustomerWhatsappUrl(welcomeReminderBooking.customerPhone, welcomeReminderCustomText)
                  );
                  showToast('تم فتح واتساب لإرسال رسالة الترحيب للعميل بنجاح ✓');
                  setWelcomeReminderBooking(null);
                }}
              />
              <Act
                stack
                tone="soft"
                icon={copiedWelcome ? Check : Copy}
                label={copiedWelcome ? 'تم النسخ ✓' : 'نسخ النص'}
                onClick={() => {
                  copyTextToClipboard(welcomeReminderCustomText, () => {
                    setCopiedWelcome(true);
                    setTimeout(() => setCopiedWelcome(false), 2500);
                  });
                }}
              />
              <Act stack tone="line" icon={X} label="إلغاء" onClick={() => setWelcomeReminderBooking(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info label="العميل" value={welcomeReminderBooking.customerName} />
            <Info label="العقار" value={welcomeReminderBooking.propertyName} />
            <Info label="المتبقي" value={`${fmtN(welcomeReminderBooking.remainingAmount)} ر.س`} />
            <Info label="التأمين" value={`${fmtN(welcomeReminderBooking.insuranceAmount)} ر.س`} />
          </Infos>
          <Field label="نص رسالة الترحيب والتذكير">
            <textarea
              rows={8}
              className="kt-input kt-ta"
              value={welcomeReminderCustomText}
              onChange={(e) => setWelcomeReminderCustomText(e.target.value)}
            />
          </Field>
        </Sheet>
      )}

      {/* 2) سداد وتحصيل المتبقي */}
      {remainingPaymentBooking && (
        <Sheet
          title={`سداد المتبقي ${fmtN(remainingPaymentBooking.remainingAmount)}`}
          icon={DollarSign}
          tone="sand"
          onClose={() => setRemainingPaymentBooking(null)}
          footer={
            remainingPaymentTab === 'receipt' ? (
              <Acts cols={2}>
                <Act tone="ink" icon={CheckCircle2} label="إرسال للإدارة" onClick={submitRemainingReceiptToAdmin} />
                <Act tone="line" icon={X} label="إلغاء" onClick={() => setRemainingPaymentBooking(null)} />
              </Acts>
            ) : (
              <GuardCashActs
                sendLabel="إرسال للحارس"
                onSend={submitRemainingCashToGuard}
                copied={copiedRemainingCash}
                onCopy={() => {
                  copyTextToClipboard(getRemainingCashGuardText(remainingPaymentBooking), () => {
                    setCopiedRemainingCash(true);
                    setTimeout(() => setCopiedRemainingCash(false), 2500);
                  });
                }}
                onWhatsapp={() => {
                  const propGuard =
                    guardsList?.find((g) => g.assignedPropertyId === remainingPaymentBooking.propertyId) || guard;
                  openExternalUrlSafely(
                    buildCustomerWhatsappUrl(
                      propGuard?.phone || '0598881234',
                      getRemainingCashGuardText(remainingPaymentBooking)
                    )
                  );
                }}
              />
            )
          }
        >
          <BkHead bk={remainingPaymentBooking} />
          <Infos cols={2}>
            <Info hi label="المطلوب" value={`${fmtN(remainingPaymentBooking.remainingAmount)} ر.س`} />
            <Info label="الجوال" ltr value={remainingPaymentBooking.customerPhone} />
          </Infos>
          <Seg
            label="طريقة السداد"
            value={remainingPaymentTab}
            onChange={setRemainingPaymentTab}
            items={[
              { id: 'receipt' as const, label: 'إيصال بنكي', icon: UploadCloud },
              { id: 'cash' as const, label: 'كاش للحارس', icon: Wallet },
            ]}
          />
          {remainingPaymentTab === 'receipt' ? (
            <>
              <FilePick
                name={remainingPaymentReceiptFile?.name}
                placeholder="رفع إيصال السداد *"
                onPick={handleRemainingReceiptFileChange}
                onClear={() => setRemainingPaymentReceiptFile(null)}
                error={remainingPaymentFileError}
              />
              <TextField
                label="ملاحظات (اختياري)"
                value={remainingPaymentNotes}
                onChange={setRemainingPaymentNotes}
                placeholder="مثال: تحويل من بنك الراجحي"
              />
            </>
          ) : (
            <>
              <MsgBox label="نص إشعار الحارس" text={getRemainingCashGuardText(remainingPaymentBooking)} />
              <TextField
                label="ملاحظة للحارس (اختياري)"
                value={remainingPaymentNotes}
                onChange={setRemainingPaymentNotes}
                placeholder="مثال: استلم المبلغ عند الوصول"
              />
            </>
          )}
        </Sheet>
      )}

      {/* 3) التأمين: إيصال بنكي للإدارة أو كاش للحارس */}
      {insuranceActionBooking && (
        <Sheet
          title={`التأمين ${fmtN(insuranceActionBooking.insuranceAmount)} ر.س`}
          icon={ShieldCheck}
          tone="saph"
          onClose={() => setInsuranceActionBooking(null)}
          footer={
            insuranceActionTab === 'receipt' ? (
              <Acts cols={2}>
                <Act tone="ink" icon={CheckCircle2} label="إرسال للإدارة" onClick={submitInsuranceReceiptToAdmin} />
                <Act tone="line" icon={X} label="إلغاء" onClick={() => setInsuranceActionBooking(null)} />
              </Acts>
            ) : (
              <GuardCashActs
                sendLabel="إرسال للحارس"
                onSend={submitInsuranceCashToGuard}
                copied={copiedInsuranceCash}
                onCopy={() => {
                  copyTextToClipboard(getInsuranceCashGuardText(insuranceActionBooking), () => {
                    setCopiedInsuranceCash(true);
                    setTimeout(() => setCopiedInsuranceCash(false), 2500);
                  });
                }}
                onWhatsapp={() => {
                  const propGuard =
                    guardsList?.find((g) => g.assignedPropertyId === insuranceActionBooking.propertyId) || guard;
                  openExternalUrlSafely(
                    buildCustomerWhatsappUrl(
                      propGuard?.phone || '0598881234',
                      getInsuranceCashGuardText(insuranceActionBooking)
                    )
                  );
                }}
              />
            )
          }
        >
          <BkHead bk={insuranceActionBooking} />
          <Infos cols={2}>
            <Info hi label="المستحق" value={`${fmtN(insuranceActionBooking.insuranceAmount)} ر.س`} />
            <Info label="الجوال" ltr value={insuranceActionBooking.customerPhone} />
          </Infos>
          <Seg
            label="طريقة التأمين"
            value={insuranceActionTab}
            onChange={setInsuranceActionTab}
            items={[
              { id: 'receipt' as const, label: 'إيصال بنكي', icon: UploadCloud },
              { id: 'cash' as const, label: 'كاش للحارس', icon: Wallet },
            ]}
          />
          {insuranceActionTab === 'receipt' ? (
            <>
              <FilePick
                name={insuranceActionReceiptFile?.name}
                placeholder="رفع إيصال التأمين *"
                onPick={handleInsuranceActionReceiptChange}
                onClear={() => setInsuranceActionReceiptFile(null)}
                error={insuranceActionFileError}
              />
              <TextField
                label="ملاحظات (اختياري)"
                value={insuranceActionNotes}
                onChange={setInsuranceActionNotes}
                placeholder="مثال: حوالة من حساب العميل"
              />
            </>
          ) : (
            <>
              <Field label="مبلغ التأمين كاش (ر.س)">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={insuranceActionCashAmount || ''}
                  onChange={(e) => setInsuranceActionCashAmount(Number(e.target.value))}
                  placeholder="0"
                />
              </Field>
              <MsgBox label="نص إشعار الحارس" text={getInsuranceCashGuardText(insuranceActionBooking)} />
              <TextField
                label="ملاحظة للحارس (اختياري)"
                value={insuranceActionNotes}
                onChange={setInsuranceActionNotes}
                placeholder="مثال: سلّم العميل سند قبض عند البوابة"
              />
            </>
          )}
        </Sheet>
      )}

      {/* 4) استرداد التأمين المحوَّل */}
      {refundModalBooking && (
        <Sheet
          title="استرداد التأمين"
          icon={RotateCcw}
          tone="amy"
          onClose={() => setRefundModalBooking(null)}
          footer={
            refundMethod === 'bank' ? (
              <Acts cols={2}>
                <Act tone="ink" icon={CheckCircle2} label="إرسال للإدارة" onClick={submitRefundBankToAdmin} />
                <Act tone="line" icon={X} label="إلغاء" onClick={() => setRefundModalBooking(null)} />
              </Acts>
            ) : (
              <GuardCashActs
                sendLabel="إرسال للحارس"
                onSend={submitRefundCashToGuard}
                copied={copiedGuardCashRefund}
                onCopy={() => {
                  copyTextToClipboard(getGuardCashRefundText(refundModalBooking), () => {
                    setCopiedGuardCashRefund(true);
                    setTimeout(() => setCopiedGuardCashRefund(false), 2500);
                  });
                }}
                onWhatsapp={() => {
                  const propGuard =
                    guardsList?.find((g) => g.assignedPropertyId === refundModalBooking.propertyId) || guard;
                  openExternalUrlSafely(
                    buildCustomerWhatsappUrl(propGuard?.phone || '0598881234', getGuardCashRefundText(refundModalBooking))
                  );
                }}
              />
            )
          }
        >
          <BkHead bk={refundModalBooking} />
          <Infos cols={3}>
            <Info label="التأمين" value={`${fmtN(refundModalBooking.insuranceAmount)} ر.س`} />
            <Info label="الخصم" value={`${fmtN(refundModalBooking.insuranceDeductionAmount)} ر.س`} />
            <Info
              hi
              label="الصافي"
              value={`${fmtN(
                Math.max(0, refundModalBooking.insuranceAmount - (refundModalBooking.insuranceDeductionAmount || 0))
              )} ر.س`}
            />
          </Infos>
          <Infos cols={1}>
            <Info
              label="استلام التأمين الأصلي"
              value={
                refundModalBooking.insurancePaymentMethod === 'cash' || refundModalBooking.insuranceReceivedCash
                  ? 'كاش عند الدخول'
                  : 'تحويل بنكي'
              }
            />
          </Infos>
          <Seg
            label="طريقة الاسترداد"
            value={refundMethod}
            onChange={setRefundMethod}
            items={[
              { id: 'bank' as const, label: 'تحويل بنكي', icon: UploadCloud },
              { id: 'cash' as const, label: 'كاش من الحارس', icon: Wallet },
            ]}
          />
          {refundMethod === 'bank' ? (
            <>
              <FilePick
                name={refundBankImageFile?.name}
                placeholder="رفع صورة الحساب أو الآيبان *"
                onPick={handleRefundBankImageChange}
                onClear={() => setRefundBankImageFile(null)}
                error={refundBankImageError}
              />
              <TextField
                ltr
                label="الآيبان أو اسم البنك"
                hint="اختياري"
                value={refundCustomerIban}
                onChange={setRefundCustomerIban}
                placeholder="SA0000000000000000000000"
              />
              <TextField
                label="ملاحظات للإدارة (اختياري)"
                value={refundNotes}
                onChange={setRefundNotes}
                placeholder="مثال: حوّل التأمين للحساب المرفق"
              />
            </>
          ) : (
            <>
              <MsgBox label="نص التوجيه للحارس" text={getGuardCashRefundText(refundModalBooking)} />
              <TextField
                label="ملاحظة للحارس (اختياري)"
                value={refundNotes}
                onChange={setRefundNotes}
                placeholder="مثال: سلّم المبلغ بعد استلام المفتاح"
              />
            </>
          )}
        </Sheet>
      )}

      {/* 5) إنهاء الحجز وتوثيق التأمين */}
      {finishBookingModal && (
        <Sheet
          title="إنهاء الحجز"
          icon={CheckCircle2}
          tone="jade"
          onClose={() => setFinishBookingModal(null)}
          footer={
            <Acts cols={2}>
              <Act tone="jade" icon={CheckCircle2} label="تأكيد الإنهاء" onClick={submitFinishBooking} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setFinishBookingModal(null)} />
            </Acts>
          }
        >
          <BkHead bk={finishBookingModal} />
          <Infos cols={2}>
            <Info label="المسوق" value={finishBookingModal.marketerName || 'حجز مباشر'} />
            <Info
              hi
              label="التأمين المسترد"
              value={`${fmtN(
                Math.max(0, finishBookingModal.insuranceAmount - (finishBookingModal.insuranceDeductionAmount || 0))
              )} ر.س`}
            />
          </Infos>
          <FilePick
            name={finishReceiptFile?.name}
            placeholder="رفع إيصال التأمين المسترد"
            onPick={handleFinishReceiptChange}
            onClear={() => setFinishReceiptFile(null)}
            error={finishFileError}
          />
          <p className="kt-note">الإيصال اختياري للكاش، ومطلوب للتحويل البنكي.</p>
          <TextField
            label="ملاحظات الإنهاء (اختياري)"
            value={finishNotes}
            onChange={setFinishNotes}
            placeholder="مثال: خرج العميل وسُلّم التأمين كاملاً"
          />
        </Sheet>
      )}

      {/* نسخ إيصالات البنك (دفع / تأمين) */}
      {receiptGroup && (
        <Sheet
          wide
          title={receiptGroup.title}
          icon={Receipt}
          tone="amy"
          onClose={() => setReceiptGroup(null)}
          footer={
            <Acts cols={1}>
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setReceiptGroup(null)} />
            </Acts>
          }
        >
          {receiptGroup.items.map((item) => (
            <div key={item.id} className="space-y-2">
              <Row title={item.label} sub={item.fileName} />
              {item.dataUrl.startsWith('data:application/pdf') || /\.pdf(\?|#|$)/i.test(item.dataUrl) ? (
                <iframe title={item.label} src={item.dataUrl} style={{ width: '100%', height: '50vh', border: 0 }} />
              ) : (
                <img
                  src={item.dataUrl}
                  alt={item.label}
                  style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: 12 }}
                />
              )}
              <Act
                tone="jade"
                icon={Download}
                label="تحميل النسخة"
                onClick={() => downloadReceiptFile(item.dataUrl, item.fileName)}
              />
            </div>
          ))}
        </Sheet>
      )}
    </div>
  );
};
