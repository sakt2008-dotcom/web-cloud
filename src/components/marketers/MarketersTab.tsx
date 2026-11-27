import React, { useState, useMemo, useEffect } from 'react';
import { CommissionRequestsSection } from '../more/CommissionRequestsSection';
import {
  Users,
  Percent,
  Download,
  Printer,
  Plus,
  Wallet,
  Briefcase,
  Shield,
  CreditCard,
  CheckCircle2,
  Clock,
  Check,
  Building,
  UserCheck,
  TrendingUp,
  FileCheck,
  UserPlus,
  Eye,
  Edit,
  DollarSign,
  Phone,
  Mail,
  Lock,
  FileText,
  BadgeAlert,
  ArrowRight,
  CalendarDays,
  Copy,
  Trash2,
  Sparkles,
  Award,
  Calendar,
  Send,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Sliders,
  ClipboardList,
  LayoutGrid,
  Settings,
  Save,
  RotateCcw,
  Loader2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Marketer, MarketerPermissions, UserRole, Booking } from '../../types';
import { AddMemberModal } from '../modals/AddMemberModal';
import { BookingReceiptsModal } from '../modals/BookingReceiptsModal';
import { PrintableContractModal } from '../modals/PrintableContractModal';
import { isBookingCheckedOut, getBookingCommissionAmount, isSupervisorBooking } from '../../lib/financials';
import { getBookingReceiptsList } from '../../lib/bookingReceipts';
import { openExternalUrlSafely } from '../../lib/customerLinks';
import { fmtN } from '../../lib/format';
import {
  Act,
  Acts,
  Check as CheckRow,
  Chip,
  Chips,
  Face,
  Head,
  Info,
  Infos,
  Pick,
  Pill,
  Rail,
  Row,
  SearchBox,
  Seg,
  Sheet,
  Field,
  Stat,
  Stats,
  Switch,
  Tag,
  Tile,
  type ActTone,
  type Ico,
  type Tone,
} from '../ui/kit';

interface MarketersTabProps {
  embedded?: boolean;
  onOpenGeminiAI?: () => void;
}

type MarketerSubTab = 'financials' | 'profile' | 'permissions';

/** تاريخ مختصر: 2026-11-25 ← 11-25 */
const shortDate = (d?: string) => (d ? d.slice(5) : '—');

const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: 'مؤكد', tone: 'jade' },
  waiting_deposit: { label: 'انتظار العربون', tone: 'sand' },
  pending_payment: { label: 'بانتظار السداد', tone: 'sand' },
  completed: { label: 'مكتمل', tone: 'saph' },
  cancelled: { label: 'ملغي', tone: 'gray' },
};

export const MarketersTab: React.FC<MarketersTabProps> = ({ embedded = false, onOpenGeminiAI }) => {
  const [isEmailAddModalOpen, setIsEmailAddModalOpen] = useState(false);
  const {
    marketers,
    bookings,
    isAdmin,
    isGuard,
    isSupervisor,
    userRole,
    canViewMarketers,
    currentMarketerId,
    updateMarketerPermissions,
    saveMarketerPermissions,
    promoteMarketerToSupervisor,
    updateMarketerProfile,
    addMarketer,
    deleteMarketer,
    addAdminAccount,
    setMarketerAccountRole,
    userAccounts,
    payoutAllMarketerCommissions,
    payMarketerCommission,
    grantAllMarketersContractAndDepositPermissions,
    sendCheckoutReminder,
    sendPaymentCompletionRequest,
    notifyGuardForCashInsurance,
    properties,
    startSimulation,
    testAlertOnCurrentAccount,
  } = useApp();

  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const hasMarketersFullAccess = isAdmin || canViewMarketers;
  const isRestrictedToSelf = !hasMarketersFullAccess && userRole === 'marketer';
  const effectiveMarketerId = isRestrictedToSelf && currentMarketerId ? currentMarketerId : marketers[0]?.id || '';

  const [activeSubTab, setActiveSubTab] = useState<MarketerSubTab>('financials');
  const [financialSubView, setFinancialSubView] = useState<'ledger' | 'requests' | 'operations'>('ledger');

  const [selectedMarketerId, setSelectedMarketerId] = useState<string>(effectiveMarketerId);

  // Sync selectedMarketerId if user role changes to restricted marketer
  useEffect(() => {
    if (isRestrictedToSelf && currentMarketerId) {
      setSelectedMarketerId(currentMarketerId);
    }
  }, [isRestrictedToSelf, currentMarketerId]);

  useEffect(() => {
    setHasUnsavedChanges(false);
    setSaveSuccessNotice(null);
  }, [selectedMarketerId]);

  // Add marketer/admin modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addAccountType, setAddAccountType] = useState<UserRole>('marketer');
  const [addError, setAddError] = useState<string | null>(null);

  // Role upgrade confirm
  const [roleChangeTarget, setRoleChangeTarget] = useState<UserRole | null>(null);

  // Contract preview modal
  const [viewContractModalOpen, setViewContractModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);

  // Preview booking contract & receipts modal
  const [viewBookingContract, setViewBookingContract] = useState<Booking | null>(null);
  const [receiptsModalBooking, setReceiptsModalBooking] = useState<Booking | null>(null);

  // Payout confirmation modal
  const [payoutConfirmMarketer, setPayoutConfirmMarketer] = useState<Marketer | null>(null);
  const [deleteConfirmMarketer, setDeleteConfirmMarketer] = useState<Marketer | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'all' | 'ready_for_payout' | 'paid' | 'pending'>('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'confirmed' | 'pending_payment' | 'waiting_deposit' | 'completed' | 'cancelled'>('all');

  // Form fields for adding marketer
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formFalLicense, setFormFalLicense] = useState('');
  const [formIban, setFormIban] = useState('');
  const [formBankName, setFormBankName] = useState('مصرف الراجحي');

  // Form fields for editing marketer profile & contract
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editFalLicense, setEditFalLicense] = useState('');
  const [editIban, setEditIban] = useState('');
  const [editBankName, setEditBankName] = useState('مصرف الراجحي');
  const [editContractNum, setEditContractNum] = useState('');
  const [editContractDate, setEditContractDate] = useState('');
  const [editContractExpiry, setEditContractExpiry] = useState('');

  const currentMarketer = useMemo(() => {
    const targetId = isRestrictedToSelf && currentMarketerId ? currentMarketerId : selectedMarketerId;
    return marketers.find((m) => m.id === targetId) || marketers[0] || null;
  }, [marketers, selectedMarketerId, isRestrictedToSelf, currentMarketerId]);

  const openEditModal = (m: Marketer) => {
    setEditName(m.name || '');
    setEditPhone(m.phone || '');
    setEditEmail(m.email || '');
    setEditNationalId(m.nationalId || '');
    setEditFalLicense(m.falLicenseNumber || '1100028491');
    setEditIban(m.bankAccount || '');
    setEditBankName(m.bankName || 'مصرف الراجحي');
    setEditContractNum(m.contract?.contractNumber || `MKT-CTR-2026-${m.code.replace('MK-', '')}`);
    setEditContractDate(m.contract?.contractDate || m.joinDate || '2026-01-01');
    setEditContractExpiry(m.contract?.expiryDate || '2027-01-01');
    setEditProfileModalOpen(true);
  };

  const handleSaveProfileAndContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMarketer) return;

    const contractObj = {
      contractNumber: editContractNum,
      contractDate: editContractDate,
      expiryDate: editContractExpiry,
      commissionRatePercent: 5,
      status: currentMarketer.contract?.status || 'active',
      firstParty: 'إدارة AMASA RESORT',
      firstPartyRepresentative: 'المدير العام التنفيذي',
      secondParty: editName,
      secondPartyPhone: editPhone,
      secondPartyEmail: editEmail,
      secondPartyNationalId: editNationalId,
      secondPartyFalLicense: editFalLicense,
      terms: currentMarketer.contract?.terms || [
        'يستحق المسوق عمولة تسويق ثابتة قدرها 5% من القيمة الإجمالية لكل حجز مؤكد ومكتمل يتم إبرامه عبر رمزه التسويقي المعتمد.',
        'يتم تحويل العمولات المستحقة دورياً وفورياً إلى الحساب البنكي المعتمد والمثبت في هذا العقد.',
        'يلتزم المسوق بالترويج وفق سياسات وأسعار AMASA RESORT الرسمية، والحفاظ التام على سرية وخصوصية بيانات النزلاء.',
        'يمنح المسوق صلاحية إصدار عقود الإيجار المعتمدة وتعديل مبالغ العربون المبدئي بما يخدم مصلحة التشغيل وتسهيل الحجوزات.',
      ],
      isSigned: true,
      signedDate: editContractDate,
      notes: currentMarketer.contract?.notes || 'عقد وساطة وتسويق موثق إلكترونياً',
    };

    updateMarketerProfile(currentMarketer.id, {
      name: editName,
      phone: editPhone,
      email: editEmail,
      nationalId: editNationalId,
      falLicenseNumber: editFalLicense,
      bankAccount: editIban,
      bankName: editBankName,
      contract: contractObj,
    });

    setEditProfileModalOpen(false);
    setToastMessage(`تم تحديث الملف الشخصي ورخصة فال والعقد للمسوق ${editName} بنجاح`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Marketer Stats List (القاعدة: لا تُضاف الإيجارات ولا العمولات إلا بعد خروج العميل، وحجوزات Supervisor منفصلة تماماً)
  const marketerStats = useMemo(() => {
    return marketers.map((m) => {
      const allBks = bookings.filter((b) => b.marketerId === m.id && !isSupervisorBooking(b));
      const completedBks = allBks.filter((b) => isBookingCheckedOut(b));
      const preCheckoutBks = allBks.filter((b) => b.status !== 'cancelled' && !isBookingCheckedOut(b));
      const activeBks = allBks.filter((b) => b.status === 'confirmed' || b.status === 'pending_payment' || b.status === 'waiting_deposit');

      const completedSales = completedBks.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const totalSales = completedSales;

      const totalCommission = completedBks.reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);

      const paidCommission = completedBks
        .filter((b) => b.commissionStatus === 'paid')
        .reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);

      const readyCommission = completedBks
        .filter((b) => b.commissionStatus !== 'paid')
        .reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);

      const pendingCommission = 0; // الحجوزات قبل الخروج لا تُضاف في العمولات المستحقة
      const preCheckoutSales = preCheckoutBks.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const preCheckoutCommission = preCheckoutBks.reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);

      const totalDueCommission = readyCommission;
      const completionRate = allBks.length > 0 ? Math.round((completedBks.length / allBks.length) * 100) : 0;

      return {
        marketer: m,
        allBookings: allBks,
        completedBookings: completedBks,
        activeBookings: activeBks,
        preCheckoutCount: preCheckoutBks.length,
        preCheckoutSales,
        preCheckoutCommission,
        totalBookingsCount: allBks.length,
        completedBookingsCount: completedBks.length,
        activeBookingsCount: activeBks.length,
        totalSales,
        completedSales,
        completionRate,
        commissionRate: m.commissionRate || 0.05,
        totalCommission,
        paidCommission,
        readyCommission,
        pendingCommission,
        totalDueCommission,
      };
    });
  }, [marketers, bookings]);

  const currentStat = useMemo(() => {
    return marketerStats.find((s) => s.marketer.id === currentMarketer?.id) || marketerStats[0];
  }, [marketerStats, currentMarketer]);

  // Filtered Bookings for the selected marketer (excluding separated Supervisor bookings)
  const marketerFilteredBookings = useMemo(() => {
    if (!currentMarketer) return [];
    let list = bookings.filter((b) => b.marketerId === currentMarketer.id && !isSupervisorBooking(b));

    if (commissionStatusFilter !== 'all') {
      list = list.filter((b) => b.commissionStatus === commissionStatusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerPhone?.includes(q) ||
          b.propertyName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [bookings, currentMarketer, commissionStatusFilter, searchQuery]);

  // Exclusive Bookings with detailed operational status for this marketer
  const marketerExclusiveBookings = useMemo(() => {
    if (!currentMarketer) return [];
    let list = bookings.filter((b) => b.marketerId === currentMarketer.id && !isSupervisorBooking(b));

    if (bookingStatusFilter !== 'all') {
      list = list.filter((b) => b.status === bookingStatusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerPhone?.includes(q) ||
          b.propertyName?.toLowerCase().includes(q) ||
          (b.sectionName && b.sectionName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [bookings, currentMarketer, bookingStatusFilter, searchQuery]);

  const handleNotifyGuardCash = (b: Booking) => {
    notifyGuardForCashInsurance({
      bookingId: b.id,
      insuranceAmount: b.insuranceAmount || 500,
      notes: `إشعار من المسوق (${currentMarketer?.name || 'المسوق'}) بتسليم التأمين كاش`,
    });
    setToastMessage(`تم إرسال إشعار فوري للحارس لاستلام مبلغ التأمين (${b.insuranceAmount || 500} ر.س) كاش من العميل ${b.customerName}`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleSendPaymentReminder = (b: Booking) => {
    const res = sendPaymentCompletionRequest(b.id);
    if (res.whatsappUrl) {
      openExternalUrlSafely(res.whatsappUrl);
      setToastMessage(`تم فتح واتساب لإرسال تذكير سداد المتبقي للعميل ${b.customerName}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleSendCheckoutReminder = (b: Booking) => {
    const res = sendCheckoutReminder(b.id);
    if (res.whatsappUrl) {
      openExternalUrlSafely(res.whatsappUrl);
      setToastMessage(`تم فتح واتساب لإرسال تذكير موعد الخروج للعميل ${b.customerName}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const exportCsv = () => {
    if (!currentMarketer) return;
    const headers = [
      'رقم الحجز',
      'تاريخ الحجز',
      'اسم العميل',
      'رقم الجوال',
      'العقار',
      'تاريخ الدخول',
      'تاريخ الخروج',
      'الليالي',
      'إجمالي الحجز (ر.س)',
      'نسبة العمولة',
      'مبلغ العمولة (ر.س)',
      'حالة الحجز',
      'حالة العمولة',
    ];

    const rows = marketerFilteredBookings.map((b) => [
      b.bookingNumber,
      b.createdAt ? b.createdAt.split('T')[0] : b.checkInDate,
      b.customerName,
      b.customerPhone,
      b.propertyName,
      b.checkInDate,
      b.checkOutDate,
      b.nightsCount,
      b.totalPrice,
      '5%',
      b.marketerCommission || Math.round((b.totalPrice || 0) * 0.05),
      b.status === 'completed' ? 'مكتمل' : 'مؤكد',
      b.commissionStatus === 'paid' ? 'مسددة ومحولة' : b.commissionStatus === 'ready_for_payout' ? 'جاهزة للصرف' : 'قيد الانتظار',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `كشف_عمولات_${currentMarketer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const resolveMarketerPerm = (
    perms: Partial<MarketerPermissions> | undefined,
    key: keyof MarketerPermissions
  ): boolean => {
    const defaultTrueKeys: (keyof MarketerPermissions)[] = [
      'canViewDashboard',
      'canViewBookings',
      'canViewMore',
      'canCreateBooking',
      'canViewCustomerContacts',
      'canCreateContract',
      'canEditDeposit',
    ];
    if (defaultTrueKeys.includes(key)) {
      return perms?.[key] !== false;
    }
    return !!perms?.[key];
  };

  const handleSavePermissions = async () => {
    if (!currentMarketer) return;
    setIsSavingPermissions(true);
    setSaveSuccessNotice(null);
    try {
      const res = await saveMarketerPermissions(currentMarketer.id, currentMarketer.permissions);
      if (res.success) {
        setHasUnsavedChanges(false);
        setSaveSuccessNotice('تم الحفظ وتظهر الصفحات المفتوحة للمسوق فوراً');
        setToastMessage(`تم حفظ صلاحيات ${currentMarketer.name}`);
        setTimeout(() => {
          setSaveSuccessNotice(null);
          setToastMessage(null);
        }, 6000);
      } else {
        setToastMessage(res.message || 'تعذر الحفظ في Firebase');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      setToastMessage(err?.message || 'حدث خطأ أثناء حفظ الصلاحيات');
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const togglePermission = (key: keyof MarketerPermissions) => {
    if (!hasMarketersFullAccess || !currentMarketer) return;
    if (key === 'canViewSupervisor' && !currentMarketer.isSupervisor) {
      setToastMessage('يرجى ترقية المسوق إلى (Supervisor) أولاً لتفعيل إظهار صفحة المشرف له.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    const currentVal = resolveMarketerPerm(currentMarketer.permissions, key);
    const nextVal = !currentVal;
    updateMarketerPermissions(currentMarketer.id, {
      [key]: nextVal,
    });
    setHasUnsavedChanges(true);
    const itemTitle = pagePermissionsList.find((p) => p.key === key)?.title || key;
    setToastMessage(
      nextVal
        ? `تم فتح «${itemTitle}» لـ ${currentMarketer.name}. اضغط «حفظ الصلاحيات».`
        : `تم إخفاء «${itemTitle}» عن ${currentMarketer.name}. اضغط «حفظ الصلاحيات».`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePayoutConfirm = (marketerId: string) => {
    payoutAllMarketerCommissions(marketerId);
    const m = marketers.find((it) => it.id === marketerId);
    setPayoutConfirmMarketer(null);
    setToastMessage(`تمت تسوية وصرف كافة العمولات المستحقة بنجاح للمسوق: ${m?.name}`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleDeleteMarketerConfirm = (target: Marketer) => {
    const res = deleteMarketer(target.id);
    setDeleteConfirmMarketer(null);
    if (res.success) {
      const remaining = marketers.filter((m) => m.id !== target.id);
      setSelectedMarketerId(remaining[0]?.id || '');
      setToastMessage(`تم حذف المسوق (${target.name}) نهائياً ومزامنة سحابة Firebase بنجاح.`);
    } else {
      setToastMessage(res.message || 'تعذر حذف المسوق.');
    }
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    setAddError(null);
    if (addAccountType === 'admin') {
      const res = addAdminAccount({
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail,
      });
      if (!res.success) {
        setAddError(res.message);
        return;
      }
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setAddModalOpen(false);
      setAddAccountType('marketer');
      setToastMessage(`${res.message}. كلمة السر المؤقتة: ${res.password} (سلّمها له وليغيّرها بعد الدخول)`);
      setTimeout(() => setToastMessage(null), 30000);
      return;
    }

    const res = await addMarketer({
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim() || `marketer.${Date.now().toString().slice(-4)}@gmail.com`,
      nationalId: formNationalId.trim() || '1000000000',
      falLicenseNumber: formFalLicense.trim() || '1100028491',
      bankAccount: formIban.trim(),
      bankName: formBankName,
    });

    if (!res.success) {
      setAddError(res.message);
      return;
    }

    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNationalId('');
    setFormFalLicense('');
    setFormIban('');
    setAddModalOpen(false);
    setToastMessage(res.message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const pagePermissionsList: { key: keyof MarketerPermissions; title: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'canViewDashboard', title: 'لوحة التحكم', description: 'المتابعة والتعديل الكامل', icon: LayoutGrid },
    { key: 'canViewGuardTasks', title: 'مهمات الحارس', description: 'إضافة المهام ومراجعتها', icon: ShieldCheck },
    { key: 'canViewCalendar', title: 'ضبط الأسعار', description: 'الأسعار والمواسم والرسوم', icon: CalendarDays },
    { key: 'canViewBookings', title: 'الحجوزات', description: 'الحجوزات والعربون والعقود', icon: ClipboardList },
    { key: 'canViewProperties', title: 'العقار والوحدات', description: 'إضافة وتعديل ودمج الوحدات', icon: Building },
    { key: 'canViewMarketers', title: 'المسوقون والعمولات', description: 'المسوقون وطلبات الصرف', icon: Users },
    { key: 'canViewMore', title: 'المزيد والإعدادات', description: 'الإعدادات والمركز المالي', icon: Settings },
    { key: 'canViewSupervisor', title: 'صفحة المشرف', description: 'تسعير ورسوم المشرف', icon: ShieldCheck },
  ];



  return (
    <div className={embedded ? "space-y-4 font-['Tajawal',sans-serif] w-full" : "pb-28 max-w-5xl mx-auto px-3 sm:px-4 pt-3 space-y-4 font-['Tajawal',sans-serif]"}>

      {/* شريط المعلومة + الأدوات (تظهر في الشاشة الكاملة فقط) */}
      {!embedded && (
        <Acts cols={onOpenGeminiAI ? 2 : 1}>
          <Pill tone="ch">عمولة ثابتة 5%</Pill>
          {onOpenGeminiAI && <Act label="رسائل ذكية" icon={Sparkles} tone="soft" onClick={onOpenGeminiAI} />}
        </Acts>
      )}

      {toastMessage && (
        <div
          role="status"
          className="kt-row lux-fade"
          style={{ background: '#E1F3EE', boxShadow: 'inset 0 0 0 1px rgba(46,158,134,.3)' }}
        >
          <Tile icon={CheckCircle2} tone="jade" size={36} />
          <span className="flex-1 min-w-0 text-[13.5px] font-bold leading-snug" style={{ color: '#0E5A49' }}>
            {toastMessage}
          </span>
        </div>
      )}

      {/* الأقسام: أعمدة متساوية بأسماء قصيرة */}
      <Seg
        label="أقسام المسوقين"
        value={activeSubTab}
        onChange={setActiveSubTab}
        items={
          hasMarketersFullAccess
            ? [
                { id: 'profile', label: 'الملف', icon: Briefcase },
                { id: 'financials', label: 'المالية', icon: Wallet },
                { id: 'permissions', label: 'الصلاحيات', icon: Shield },
              ]
            : [
                { id: 'profile', label: 'ملفي', icon: Briefcase },
                { id: 'financials', label: 'عمولاتي', icon: Wallet },
              ]
        }
      />

      {/* اختيار المسوق: بطاقات بعرض موحّد */}
      {hasMarketersFullAccess && (
        <section className="lux-card p-4 space-y-3">
          <Head
            icon={Users}
            title="اختر المسوق"
            count={marketers.length}
            action={<Act small label="إضافة عضو" icon={Plus} tone="ink" onClick={() => setIsEmailAddModalOpen(true)} />}
          />
          <Rail>
            {marketers.map((m) => (
              <Pick
                key={m.id}
                name={m.name}
                sub={m.isSupervisor ? `مشرف · ${m.code}` : m.code}
                avatar={m.avatar}
                selected={m.id === currentMarketer?.id}
                onClick={() => setSelectedMarketerId(m.id)}
              />
            ))}
          </Rail>
        </section>
      )}

      {/* لا يوجد مسوقون بعد */}
      {marketers.length === 0 && (
        <div className="lux-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <Tile icon={Users} tone="amy" size={64} />
          </div>
          <h3 className="text-[16px] font-extrabold">لا يوجد مسوقون بعد</h3>
          <p className="kt-note max-w-xs mx-auto">أضف أول مسوق لتُحفظ بياناته وعمولاته في السحابة.</p>
          <Act label="إضافة مسوق" icon={Plus} tone="ink" onClick={() => setIsEmailAddModalOpen(true)} className="mx-auto max-w-[240px]" />
        </div>
      )}

      {/* ═════════ المالية ═════════ */}
      {activeSubTab === 'financials' && currentMarketer && (
        <div className="space-y-4">
          {/* بطاقة المسوق */}
          <section className="lux-hero p-4 space-y-3.5">
            <div aria-hidden="true" className="lux-lattice" />
            <div className="relative flex items-center gap-3">
              <Face src={currentMarketer.avatar} name={currentMarketer.name} size={56} square />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px]" style={{ color: '#BFB2DC' }}>
                    {isRestrictedToSelf ? 'محفظتي' : 'كشف العمولات'}
                  </span>
                  <Tag tone="gold" mono>
                    {currentMarketer.code}
                  </Tag>
                </div>
                <div className="text-[17px] font-extrabold truncate" style={{ color: '#F5F0FC' }}>
                  {currentMarketer.name}
                </div>
              </div>
            </div>

            <Infos className="relative">
              <Info dark label="الجوال" value={currentMarketer.phone} ltr />
              <Info dark label="البنك" value={currentMarketer.bankName || 'مصرف الراجحي'} />
              <Info dark wide label="الآيبان" value={currentMarketer.bankAccount || 'غير مسجل'} ltr />
            </Infos>

            {hasMarketersFullAccess && (
              <Acts cols={3} className="relative">
                <Act
                  stack
                  tone="gold"
                  icon={Eye}
                  label="معاينة"
                  title="تصفح كمسوق (معاينة)"
                  onClick={() => startSimulation('marketer', currentMarketer.id, currentMarketer.name)}
                />
                <Act
                  stack
                  tone="dark"
                  icon={Send}
                  label="تنبيه"
                  title="تجربة تنبيه فوري"
                  onClick={() => testAlertOnCurrentAccount('marketer', currentMarketer.id, currentMarketer.name)}
                />
                <Act
                  stack
                  tone="dgarn"
                  icon={Trash2}
                  label="حذف"
                  title="حذف المسوق"
                  onClick={() => setDeleteConfirmMarketer(currentMarketer)}
                />
              </Acts>
            )}

            {hasMarketersFullAccess && (currentStat?.readyCommission || 0) > 0 && (
              <Acts cols={1} className="relative">
                <Act
                  tone="jade"
                  icon={Wallet}
                  label={`صرف الجاهز · ${currentStat?.readyCommission} ر.س`}
                  title="تسوية وصرف العمولات الجاهزة"
                  onClick={() => setPayoutConfirmMarketer(currentMarketer)}
                />
              </Acts>
            )}
          </section>

          {/* أربع بطاقات بنفس الحجم */}
          <Stats>
            <Stat
              icon={Clock}
              tone="amy"
              label="عمولات مستحقة"
              value={currentStat?.totalDueCommission || 0}
              unit="ر.س"
              hint={
                currentStat?.preCheckoutCount
                  ? `قبل الخروج: ${currentStat.preCheckoutCommission} ر.س`
                  : 'بعد خروج العميل'
              }
            />
            <Stat
              icon={CheckCircle2}
              tone="jade"
              label="جاهزة للصرف"
              value={currentStat?.readyCommission || 0}
              unit="ر.س"
              hint="بعد الخروج فقط"
            />
            <Stat
              icon={Wallet}
              tone="saph"
              label="عمولات مصروفة"
              value={currentStat?.paidCommission || 0}
              unit="ر.س"
              hint="حُوّلت للبنك"
            />
            <Stat
              icon={TrendingUp}
              tone="ch"
              label="إجمالي الإيجار"
              value={currentStat?.totalSales || 0}
              unit="ر.س"
              hint={`من ${currentStat?.completedBookingsCount || 0} حجز`}
            />
          </Stats>

          {/* الأقسام المالية */}
          <Seg
            label="أقسام المالية"
            value={financialSubView}
            onChange={setFinancialSubView}
            items={[
              { id: 'ledger', label: 'الكشف', icon: Wallet, badge: marketerFilteredBookings.length },
              { id: 'requests', label: 'الصرف', icon: CreditCard },
              { id: 'operations', label: 'الحجوزات', icon: CalendarDays, badge: marketerExclusiveBookings.length },
            ]}
          />

          {/* ───── الحجوزات (المتابعة التشغيلية) ───── */}
          {financialSubView === 'operations' && (
            <div className="space-y-4">
              <Head
                icon={CalendarDays}
                title={isRestrictedToSelf ? 'حجوزاتي' : 'حجوزات المسوق'}
                count={marketerExclusiveBookings.length}
              />

              <Stats>
                <Stat
                  icon={ClipboardList}
                  tone="amy"
                  label="كل الحجوزات"
                  value={bookings.filter((b) => b.marketerId === currentMarketer.id).length}
                  hint={`رمزك ${currentMarketer.code}`}
                />
                <Stat
                  icon={CheckCircle2}
                  tone="jade"
                  label="مؤكدة"
                  value={bookings.filter((b) => b.marketerId === currentMarketer.id && b.status === 'confirmed').length}
                  hint="إقامة سارية"
                />
                <Stat
                  icon={Clock}
                  tone="sand"
                  label="بانتظار الدفع"
                  value={
                    bookings.filter(
                      (b) =>
                        b.marketerId === currentMarketer.id &&
                        (b.status === 'waiting_deposit' || b.status === 'pending_payment')
                    ).length
                  }
                  hint="تحتاج متابعة"
                />
                <Stat
                  icon={Check}
                  tone="saph"
                  label="مكتملة"
                  value={bookings.filter((b) => b.marketerId === currentMarketer.id && b.status === 'completed').length}
                  hint="خرج النزيل"
                />
              </Stats>

              <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="رقم الحجز أو العميل أو العقار" />

              <Chips>
                <Chip label="الكل" on={bookingStatusFilter === 'all'} onClick={() => setBookingStatusFilter('all')} />
                <Chip
                  label="مؤكدة"
                  dot="#2E9E86"
                  on={bookingStatusFilter === 'confirmed'}
                  onClick={() => setBookingStatusFilter('confirmed')}
                />
                <Chip
                  label="بانتظار الدفع"
                  dot="#D9932B"
                  on={bookingStatusFilter === 'pending_payment'}
                  onClick={() => setBookingStatusFilter('pending_payment')}
                />
                <Chip
                  label="انتظار العربون"
                  dot="#E07B39"
                  on={bookingStatusFilter === 'waiting_deposit'}
                  onClick={() => setBookingStatusFilter('waiting_deposit')}
                />
                <Chip
                  label="مكتملة"
                  dot="#3F6FD6"
                  on={bookingStatusFilter === 'completed'}
                  onClick={() => setBookingStatusFilter('completed')}
                />
                <Chip
                  label="ملغاة"
                  dot="#9A93AB"
                  on={bookingStatusFilter === 'cancelled'}
                  onClick={() => setBookingStatusFilter('cancelled')}
                />
              </Chips>

              {marketerExclusiveBookings.length === 0 ? (
                <div className="lux-card p-8 text-center space-y-3">
                  <div className="flex justify-center">
                    <Tile icon={CalendarDays} tone="amy" size={56} />
                  </div>
                  <h4 className="text-[15px] font-extrabold">لا توجد حجوزات مطابقة</h4>
                  <p className="kt-note">أنشئ حجزاً من التقويم وسيظهر هنا مع عمولته.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {marketerExclusiveBookings.map((b) => {
                    const comm = b.marketerCommission || Math.round((b.totalPrice || 0) * 0.05);
                    const isPaidComm = b.commissionStatus === 'paid';
                    const isReadyComm = b.commissionStatus === 'ready_for_payout';
                    const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.cancelled;
                    const cleanPhone = (b.customerPhone || '0500000000').replace(/\D/g, '').replace(/^0/, '966');

                    const acts: { key: string; label: string; icon: Ico; tone: ActTone; title?: string; href?: string; onClick?: () => void }[] = [
                      { key: 'wa', label: 'واتساب', icon: Send, tone: 'jadeS', href: `https://wa.me/${cleanPhone}` },
                      { key: 'tel', label: 'اتصال', icon: Phone, tone: 'soft', href: `tel:${b.customerPhone}` },
                    ];
                    if (b.remainingAmount > 0) {
                      acts.push({
                        key: 'pay',
                        label: 'تذكير السداد',
                        icon: Send,
                        tone: 'sand',
                        title: 'تذكير سداد المتبقي (واتساب)',
                        onClick: () => handleSendPaymentReminder(b),
                      });
                    }
                    acts.push({
                      key: 'out',
                      label: 'تذكير الخروج',
                      icon: Clock,
                      tone: 'soft',
                      title: 'تذكير موعد الخروج (واتساب)',
                      onClick: () => handleSendCheckoutReminder(b),
                    });
                    if (!b.insuranceReceivedCash) {
                      acts.push({
                        key: 'cash',
                        label: 'إشعار الحارس',
                        icon: ShieldCheck,
                        tone: 'jadeS',
                        title: 'إشعار الحارس لاستلام التأمين كاش',
                        onClick: () => handleNotifyGuardCash(b),
                      });
                    }
                    acts.push({
                      key: 'ctr',
                      label: 'العقد',
                      icon: FileText,
                      tone: 'line',
                      title: 'معاينة العقد الموثق',
                      onClick: () => setViewBookingContract(b),
                    });
                    acts.push(
                      b.receiptsDeletedAfterCommissionPaid || b.commissionStatus === 'paid'
                        ? { key: 'rcp', label: 'إيصالات محذوفة', icon: Check, tone: 'jadeS', onClick: () => setReceiptsModalBooking(b) }
                        : {
                            key: 'rcp',
                            label: `الإيصالات (${getBookingReceiptsList(b).length})`,
                            icon: Eye,
                            tone: 'soft',
                            title: 'الإيصالات البنكية',
                            onClick: () => setReceiptsModalBooking(b),
                          }
                    );

                    return (
                      <article key={b.id} className="lux-card p-4 space-y-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(b.bookingNumber, `bk-${b.id}`)}
                            aria-label="نسخ رقم الحجز"
                            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg font-mono text-[12.5px] font-extrabold cursor-pointer"
                            style={{ background: '#EDE6F8', color: '#46217F' }}
                          >
                            <span>{b.bookingNumber}</span>
                            <Copy size={14} />
                          </button>
                          <span className="flex-1 min-w-0 truncate text-[14px] font-extrabold">
                            {b.propertyName}
                            {b.sectionName ? ` · ${b.sectionName}` : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Pill tone={st.tone}>{st.label}</Pill>
                          <Pill tone={isPaidComm || isReadyComm ? 'jade' : 'amy'}>
                            {comm} ر.س · {isPaidComm ? 'مسددة' : isReadyComm ? 'جاهزة' : 'معلقة'}
                          </Pill>
                        </div>

                        <Infos>
                          <Info label="النزيل" value={b.customerName} />
                          <Info label="الجوال" value={b.customerPhone} ltr />
                          <Info label="الإقامة" value={`${shortDate(b.checkInDate)} ← ${shortDate(b.checkOutDate)}`} />
                          <Info label="الليالي" value={`${b.nightsCount} ليالٍ`} />
                          <Info label="الإجمالي" value={`${b.totalPrice} ر.س`} />
                          <Info label="المتبقي" value={`${b.remainingAmount} ر.س`} />
                        </Infos>

                        <div className="grid grid-cols-2 gap-2">
                          <CheckRow
                            label="العربون"
                            value={b.depositPaid > 0 ? 'مدفوع' : 'غير مدفوع'}
                            state={b.depositPaid > 0 ? 'ok' : 'wait'}
                          />
                          <CheckRow
                            label="الوصول"
                            value={b.guestArrived ? 'وصل النزيل' : 'بانتظار الوصول'}
                            state={b.guestArrived ? 'ok' : 'wait'}
                          />
                          <CheckRow
                            label="التأمين"
                            value={b.insuranceReceivedCash ? 'مستلم كاش' : 'لم يُستلم'}
                            state={b.insuranceReceivedCash ? 'ok' : 'wait'}
                          />
                          <CheckRow
                            label="التسليم"
                            value={b.checkedOut ? 'تم التسليم' : 'إقامة جارية'}
                            state={b.checkedOut ? 'done' : 'idle'}
                          />
                        </div>

                        <Acts>
                          {acts.map((a, i) => (
                            <Act
                              key={a.key}
                              label={a.label}
                              icon={a.icon}
                              tone={a.tone}
                              title={a.title}
                              href={a.href}
                              onClick={a.onClick}
                              className={acts.length % 2 === 1 && i === acts.length - 1 ? 'col-span-2' : ''}
                            />
                          ))}
                        </Acts>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ───── كشف العمولات ───── */}
          {financialSubView === 'ledger' && (
            <div className="space-y-4">
              <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="رقم الحجز أو العميل أو العقار" />

              <Chips>
                <Chip
                  label="الكل"
                  count={currentStat?.totalBookingsCount || 0}
                  on={commissionStatusFilter === 'all'}
                  onClick={() => setCommissionStatusFilter('all')}
                />
                <Chip
                  label="جاهزة"
                  dot="#2E9E86"
                  on={commissionStatusFilter === 'ready_for_payout'}
                  onClick={() => setCommissionStatusFilter('ready_for_payout')}
                />
                <Chip
                  label="مصروفة"
                  dot="#3F6FD6"
                  on={commissionStatusFilter === 'paid'}
                  onClick={() => setCommissionStatusFilter('paid')}
                />
                <Chip
                  label="قيد الإتمام"
                  dot="#D9932B"
                  on={commissionStatusFilter === 'pending'}
                  onClick={() => setCommissionStatusFilter('pending')}
                />
              </Chips>

              <Head icon={Clock} title="كشف العمولات" count={marketerFilteredBookings.length} />

              {marketerFilteredBookings.length === 0 ? (
                <div className="lux-card p-8 text-center space-y-3">
                  <div className="flex justify-center">
                    <Tile icon={Clock} tone="amy" size={56} />
                  </div>
                  <h4 className="text-[15px] font-extrabold">لا توجد حجوزات مطابقة</h4>
                  <p className="kt-note">غيّر التصفية أو البحث.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {marketerFilteredBookings.map((b, idx) => {
                    const comm = getBookingCommissionAmount(b);
                    const checkedOut = isBookingCheckedOut(b);
                    const isPaid = b.commissionStatus === 'paid';
                    const isReady = checkedOut && !isPaid;
                    const showPayNow = hasMarketersFullAccess && isReady;

                    return (
                      <article key={`${b.id || 'mbk'}-${idx}`} className="lux-card p-4 space-y-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0 inline-flex items-center h-8 px-2.5 rounded-lg font-mono text-[12.5px] font-extrabold"
                            style={{ background: '#EDE6F8', color: '#46217F' }}
                          >
                            {b.bookingNumber}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-[14px] font-extrabold">{b.customerName}</span>
                          <Tag tone={isPaid ? 'saph' : isReady ? 'jade' : 'sand'}>
                            {isPaid ? 'تم الصرف' : isReady ? 'جاهزة' : 'بانتظار الخروج'}
                          </Tag>
                        </div>

                        <p className="kt-note truncate">
                          {b.propertyName} · {shortDate(b.checkInDate)} · {b.nightsCount} ليالٍ
                        </p>

                        <Infos cols={3}>
                          <Info label="الإجمالي" value={`${b.totalPrice} ر.س`} />
                          <Info label="النسبة" value={`${b.commissionRatePercent || 5}%`} />
                          <Info label="العمولة" value={`${comm} ر.س`} />
                        </Infos>

                        <Acts>
                          {showPayNow && (
                            <Act
                              tone="jade"
                              icon={Wallet}
                              label="صرف الآن"
                              onClick={() => payMarketerCommission(b.id)}
                            />
                          )}
                          <Act
                            tone="soft"
                            icon={Eye}
                            label={
                              isPaid || b.receiptsDeletedAfterCommissionPaid
                                ? 'إيصالات محذوفة'
                                : `الإيصالات (${getBookingReceiptsList(b).length})`
                            }
                            onClick={() => setReceiptsModalBooking(b)}
                            className={showPayNow ? '' : 'col-span-2'}
                          />
                        </Acts>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* المجاميع */}
              <section className="lux-card p-4 space-y-3">
                <Head icon={TrendingUp} tone="ch" title="المجموع المعتمد" />
                <Infos>
                  <Info
                    label="إجمالي الإيجار"
                    value={`${marketerFilteredBookings
                      .filter((b) => isBookingCheckedOut(b))
                      .reduce((sum, b) => sum + (b.totalPrice || 0), 0)} ر.س`}
                  />
                  <Info
                    label="إجمالي العمولات"
                    value={`${marketerFilteredBookings
                      .filter((b) => isBookingCheckedOut(b))
                      .reduce((sum, b) => sum + getBookingCommissionAmount(b), 0)} ر.س`}
                  />
                </Infos>
                <p className="kt-note text-center">يُعتمد بعد خروج العميل فقط</p>
              </section>

              <Acts>
                <Act tone="line" icon={Download} label="تصدير CSV" onClick={exportCsv} />
                <Act tone="line" icon={Printer} label="طباعة" onClick={handlePrint} />
              </Acts>
            </div>
          )}

          {/* ───── الصرف (طلبات العمولات) ───── */}
          {financialSubView === 'requests' && (
            <div className="space-y-4">
              <CommissionRequestsSection />
            </div>
          )}
        </div>
      )}

      {/* ═════════ الملف ═════════ */}
      {activeSubTab === 'profile' && currentMarketer && (
        <div className="space-y-4">
          <section className="lux-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Face src={currentMarketer.avatar} name={currentMarketer.name} size={64} square />
              <div className="min-w-0 flex-1 space-y-1.5">
                <h4 className="text-[18px] font-extrabold truncate">{currentMarketer.name}</h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag tone="gold" mono>
                    {currentMarketer.code}
                  </Tag>
                  <Tag tone="jade">نشط وموثق</Tag>
                  {currentMarketer.isSupervisor && <Tag tone="saph">مشرف</Tag>}
                </div>
              </div>
            </div>

            <Infos>
              <Info label="الجوال" value={currentMarketer.phone} ltr />
              <Info label="الهوية" value={currentMarketer.nationalId || '1088923412'} ltr />
              <Info label="البنك" value={currentMarketer.bankName || 'مصرف الراجحي'} />
              <Info label="الإيميل" value={currentMarketer.email} ltr />
              <Info label="الآيبان" wide value={currentMarketer.bankAccount || 'لم يُسجّل'} ltr />
            </Infos>

            <Acts cols={3}>
              <Act stack tone="soft" icon={Phone} label="اتصال" href={`tel:${currentMarketer.phone}`} title="اتصال بالمسوق" />
              <Act
                stack
                tone="line"
                icon={Copy}
                label="نسخ الجوال"
                onClick={() => copyToClipboard(currentMarketer.phone, 'phone')}
              />
              <Act
                stack
                tone="line"
                icon={Mail}
                label="نسخ الإيميل"
                onClick={() => copyToClipboard(currentMarketer.email, 'email')}
              />
            </Acts>

            {copiedKey && (
              <p className="kt-note text-center font-bold" style={{ color: '#0E5A49' }}>
                تم النسخ ✓
              </p>
            )}
          </section>

          <Acts>
            <Act tone="soft" icon={Edit} label="تعديل البيانات" onClick={() => openEditModal(currentMarketer)} />
            <Act tone="ink" icon={FileCheck} label="عرض العقد" onClick={() => setViewContractModalOpen(true)} />
          </Acts>

          {isAdmin && (
            <section className="lux-card p-4 space-y-3">
              <Head icon={ShieldCheck} tone="saph" title="رتبة المشرف" />
              <Acts cols={currentMarketer.isSupervisor ? 2 : 1}>
                <Act
                  tone={currentMarketer.isSupervisor ? 'garnS' : 'ink'}
                  icon={ShieldCheck}
                  label={currentMarketer.isSupervisor ? 'إلغاء الترقية' : 'ترقية إلى مشرف'}
                  onClick={() => {
                    const nextPromote = !currentMarketer.isSupervisor;
                    const res = promoteMarketerToSupervisor(currentMarketer.id, nextPromote);
                    setToastMessage(res.message);
                    setTimeout(() => setToastMessage(null), 4000);
                  }}
                />
                {currentMarketer.isSupervisor && (
                  <Act
                    tone={currentMarketer.permissions?.canViewSupervisor ? 'jadeS' : 'line'}
                    icon={Eye}
                    label={currentMarketer.permissions?.canViewSupervisor ? 'الصفحة ظاهرة' : 'الصفحة مخفية'}
                    onClick={() => {
                      const nextVis = !currentMarketer.permissions?.canViewSupervisor;
                      updateMarketerPermissions(currentMarketer.id, { canViewSupervisor: nextVis });
                      setToastMessage(
                        nextVis
                          ? `تم إظهار صفحة المشرف لـ ${currentMarketer.name}`
                          : `تم إخفاء صفحة المشرف عن ${currentMarketer.name}`
                      );
                      setTimeout(() => setToastMessage(null), 3500);
                    }}
                  />
                )}
              </Acts>
            </section>
          )}

          {hasMarketersFullAccess && (
            <Act
              tone="garnS"
              icon={Trash2}
              label="حذف المسوق"
              title="حذف المسوق نهائياً"
              onClick={() => setDeleteConfirmMarketer(currentMarketer)}
              className="w-full"
            />
          )}
        </div>
      )}

      {/* ═════════ الصلاحيات ═════════ */}
      {activeSubTab === 'permissions' && currentMarketer && (
        <div className="space-y-4">
          <section className="lux-card p-4 space-y-3">
            <Head
              icon={Shield}
              title="صلاحيات الصفحات"
              count={`${pagePermissionsList.filter((p) => resolveMarketerPerm(currentMarketer.permissions, p.key)).length}/${pagePermissionsList.length}`}
            />
            <p className="kt-note truncate">للمسوق: {currentMarketer.name}</p>

            {hasMarketersFullAccess && (
              <Acts>
                <Act
                  tone="soft"
                  icon={ShieldCheck}
                  label="فتح الكل"
                  onClick={() => {
                    const allOpen: Partial<MarketerPermissions> = {
                      canViewDashboard: true,
                      canViewGuardTasks: true,
                      canViewCalendar: true,
                      canViewBookings: true,
                      canViewProperties: true,
                      canViewMarketers: true,
                      canViewMore: true,
                      canViewSupervisor: !!currentMarketer.isSupervisor,
                    };
                    updateMarketerPermissions(currentMarketer.id, allOpen);
                    setHasUnsavedChanges(true);
                    setToastMessage(`تم فتح كل الصفحات لـ ${currentMarketer.name}. اضغط «حفظ الصلاحيات» للتطبيق.`);
                    setTimeout(() => setToastMessage(null), 3500);
                  }}
                />
                <Act
                  tone="line"
                  icon={RotateCcw}
                  label="إغلاق الكل"
                  onClick={() => {
                    const allClosed: Partial<MarketerPermissions> = {
                      canViewDashboard: false,
                      canViewGuardTasks: false,
                      canViewCalendar: false,
                      canViewBookings: false,
                      canViewProperties: false,
                      canViewMarketers: false,
                      canViewMore: false,
                      canViewSupervisor: false,
                    };
                    updateMarketerPermissions(currentMarketer.id, allClosed);
                    setHasUnsavedChanges(true);
                    setToastMessage(`تم إغلاق كل الصفحات عن ${currentMarketer.name}. اضغط «حفظ الصلاحيات» للتطبيق.`);
                    setTimeout(() => setToastMessage(null), 3500);
                  }}
                />
              </Acts>
            )}
          </section>

          {/* صفوف متساوية: أيقونة + عنوان + وصف قصير + مفتاح */}
          <div className="space-y-2.5">
            {pagePermissionsList.map((item) => {
              const isEnabled = resolveMarketerPerm(currentMarketer.permissions, item.key);
              return (
                <div
                  key={item.key}
                  onClick={() => {
                    if (hasMarketersFullAccess) togglePermission(item.key);
                  }}
                  className={`kt-row ${hasMarketersFullAccess ? 'cursor-pointer select-none' : ''}`}
                  style={isEnabled ? { boxShadow: '0 0 0 1px rgba(201,164,92,.55)' } : undefined}
                >
                  <Tile icon={item.icon} tone={isEnabled ? 'amy' : 'gray'} size={40} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{item.title}</span>
                    <span className="kt-row-s">{item.description}</span>
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Switch
                      on={isEnabled}
                      label={`${item.title}: ${isEnabled ? 'مفتوحة' : 'مغلقة'}`}
                      disabled={!hasMarketersFullAccess}
                      onChange={() => togglePermission(item.key)}
                    />
                  </span>
                </div>
              );
            })}
          </div>

          {/* حفظ */}
          {hasMarketersFullAccess && (
            <section className="lux-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tile icon={Save} tone={hasUnsavedChanges ? 'sand' : 'jade'} size={36} />
                <span className="flex-1 min-w-0 text-[14px] font-extrabold truncate">
                  {hasUnsavedChanges ? 'تعديلات بانتظار الحفظ' : 'محفوظة ومتزامنة'}
                </span>
              </div>
              <Acts cols={1}>
                <Act
                  tone={hasUnsavedChanges ? 'jade' : 'ink'}
                  icon={isSavingPermissions ? Loader2 : Save}
                  label={isSavingPermissions ? 'جارٍ الحفظ…' : 'حفظ الصلاحيات'}
                  disabled={isSavingPermissions}
                  onClick={handleSavePermissions}
                />
              </Acts>
              {saveSuccessNotice && (
                <p className="kt-note text-center font-bold" style={{ color: '#0E5A49' }}>
                  {saveSuccessNotice}
                </p>
              )}
            </section>
          )}

          {/* الإدارة: ترقية الحساب إلى إدارة */}
          {isAdmin &&
            (() => {
              const acc = userAccounts.find((a) => a.marketerId === currentMarketer.id || a.id === currentMarketer.id);
              const isCurrentlyAdmin = acc?.role === 'admin';
              const nextRole: UserRole = isCurrentlyAdmin ? 'marketer' : 'admin';

              return (
                <section className="lux-card p-4 space-y-3">
                  <Head
                    icon={Award}
                    tone="sand"
                    title={isCurrentlyAdmin ? 'عضو إدارة' : 'الترقية إلى الإدارة'}
                  />
                  {roleChangeTarget === null ? (
                    <Acts cols={1}>
                      <Act
                        tone={isCurrentlyAdmin ? 'garnS' : 'ink'}
                        icon={Award}
                        label={isCurrentlyAdmin ? 'إرجاع إلى مسوق' : 'ترقية إلى إدارة'}
                        onClick={() => setRoleChangeTarget(nextRole)}
                      />
                    </Acts>
                  ) : (
                    <>
                      <p className="text-[13.5px] font-bold leading-relaxed">
                        {roleChangeTarget === 'admin'
                          ? `منح ${currentMarketer.name} كامل صلاحيات الإدارة؟`
                          : `إرجاع ${currentMarketer.name} إلى مسوق؟`}
                      </p>
                      <Acts>
                        <Act
                          tone="jade"
                          icon={Check}
                          label="نعم، تأكيد"
                          onClick={() => {
                            const res = setMarketerAccountRole(currentMarketer.id, roleChangeTarget);
                            setRoleChangeTarget(null);
                            setToastMessage(res.message);
                            setTimeout(() => setToastMessage(null), 5000);
                          }}
                        />
                        <Act tone="line" label="إلغاء" onClick={() => setRoleChangeTarget(null)} />
                      </Acts>
                    </>
                  )}
                </section>
              );
            })()}

          {/* الإدارة: ترقية إلى Supervisor */}
          {isAdmin && (
            <section className="lux-card p-4 space-y-3">
              <Head
                icon={ShieldCheck}
                tone="saph"
                title="صفحة المشرف"
                count={currentMarketer.isSupervisor ? 'معتمد' : undefined}
              />
              <Acts cols={currentMarketer.isSupervisor ? 2 : 1}>
                <Act
                  tone={currentMarketer.isSupervisor ? 'garnS' : 'ink'}
                  icon={ShieldCheck}
                  label={currentMarketer.isSupervisor ? 'إلغاء الترقية' : 'ترقية إلى مشرف'}
                  onClick={() => {
                    const nextPromote = !currentMarketer.isSupervisor;
                    const res = promoteMarketerToSupervisor(currentMarketer.id, nextPromote);
                    setToastMessage(res.message);
                    setTimeout(() => setToastMessage(null), 4000);
                  }}
                />
                {currentMarketer.isSupervisor && (
                  <Act
                    tone={currentMarketer.permissions?.canViewSupervisor ? 'jadeS' : 'line'}
                    icon={Eye}
                    label={currentMarketer.permissions?.canViewSupervisor ? 'الصفحة ظاهرة' : 'الصفحة مخفية'}
                    onClick={() => {
                      const nextVis = !currentMarketer.permissions?.canViewSupervisor;
                      updateMarketerPermissions(currentMarketer.id, { canViewSupervisor: nextVis });
                      setHasUnsavedChanges(true);
                      setToastMessage(
                        nextVis
                          ? `تم إظهار صفحة المشرف لـ ${currentMarketer.name}. اضغط «حفظ الصلاحيات».`
                          : `تم إخفاء صفحة المشرف عن ${currentMarketer.name}. اضغط «حفظ الصلاحيات».`
                      );
                      setTimeout(() => setToastMessage(null), 3500);
                    }}
                  />
                )}
              </Acts>
            </section>
          )}
        </div>
      )}

      {/* عرض العقد */}
      {viewContractModalOpen && currentMarketer && (
        <Sheet
          wide
          title="عقد المسوق"
          icon={FileCheck}
          tone="amy"
          onClose={() => setViewContractModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="ink" icon={Printer} label="طباعة العقد" onClick={() => window.print()} />
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setViewContractModalOpen(false)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info
              ltr
              label="رقم العقد"
              value={currentMarketer.contract?.contractNumber || `MKT-CTR-2026-${currentMarketer.code.replace('MK-', '')}`}
            />
            <Info ltr label="التاريخ" value={currentMarketer.contract?.contractDate || currentMarketer.joinDate} />
            <Info hi label="الحالة" value="ساري وموثق" />
            <Info label="العمولة" value="5%" />
          </Infos>

          <div className="kt-sub">
            <p className="kt-sub-t">الطرف الأول</p>
            <Infos cols={1}>
              <Info label="المنشأة" value="إدارة AMASA RESORT" />
              <Info label="يمثلها" value={currentMarketer.contract?.firstPartyRepresentative || 'المدير العام التنفيذي'} />
            </Infos>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">الطرف الثاني (المسوق)</p>
            <Infos cols={2}>
              <Info wide label="الاسم" value={currentMarketer.name} />
              <Info ltr label="الهوية" value={currentMarketer.nationalId || '—'} />
              <Info ltr label="الجوال" value={currentMarketer.phone} />
              <Info ltr wide label="رخصة فال العقارية" value={currentMarketer.falLicenseNumber || '1100028491'} />
            </Infos>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">بنود الاتفاقية</p>
            {(currentMarketer.contract?.terms || []).map((term, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span
                  className="shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-[13px] font-extrabold"
                  style={{ background: '#EAE3F4', color: '#2D1664' }}
                >
                  {idx + 1}
                </span>
                <p className="flex-1 min-w-0 text-[14px] leading-7 font-semibold" style={{ color: '#1A0F2E' }}>
                  {term}
                </p>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {/* تعديل ملف المسوق والعقد */}
      {editProfileModalOpen && currentMarketer && (
        <Sheet
          wide
          lockBackdrop
          title="تعديل المسوق والعقد"
          icon={Edit}
          tone="amy"
          onClose={() => setEditProfileModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act submit form="mk-edit-form" tone="ink" icon={Save} label="حفظ التعديلات" title="حفظ وتحديث الملف والعقد" />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setEditProfileModalOpen(false)} />
            </Acts>
          }
        >
          <form id="mk-edit-form" onSubmit={handleSaveProfileAndContract} className="kt-fields">
            <Field label="الاسم الكامل" className="kt-wide">
              <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="kt-input" />
            </Field>
            <Field label="الجوال">
              <input type="tel" required dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="kt-input kt-num" />
            </Field>
            <Field label="رقم الهوية">
              <input type="text" dir="ltr" value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} className="kt-input kt-num" />
            </Field>
            <Field label="إيميل الدخول" className="kt-wide">
              <input type="email" required dir="ltr" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="kt-input" />
            </Field>
            <Field label="رخصة فال" hint="الهيئة العامة للعقار" className="kt-wide">
              <input
                type="text"
                dir="ltr"
                placeholder="مثال: 1100028491"
                value={editFalLicense}
                onChange={(e) => setEditFalLicense(e.target.value)}
                className="kt-input kt-num"
              />
            </Field>
            <Field label="البنك" className="kt-wide">
              <select value={editBankName} onChange={(e) => setEditBankName(e.target.value)} className="kt-input">
                <option value="مصرف الراجحي">مصرف الراجحي</option>
                <option value="البنك الأهلي السعودي">البنك الأهلي السعودي</option>
                <option value="بنك الإنماء">بنك الإنماء</option>
                <option value="بنك الرياض">بنك الرياض</option>
                <option value="بنك البلاد">بنك البلاد</option>
              </select>
            </Field>
            <Field label="الآيبان (IBAN)" className="kt-wide">
              <input type="text" dir="ltr" value={editIban} onChange={(e) => setEditIban(e.target.value)} className="kt-input" />
            </Field>

            <div className="kt-sub kt-wide">
              <p className="kt-sub-t">بيانات العقد</p>
              <Field label="رقم العقد">
                <input type="text" dir="ltr" value={editContractNum} onChange={(e) => setEditContractNum(e.target.value)} className="kt-input" />
              </Field>
              <div className="kt-fields">
                <Field label="تاريخ الإبرام">
                  <input type="date" value={editContractDate} onChange={(e) => setEditContractDate(e.target.value)} className="kt-input" />
                </Field>
                <Field label="تاريخ التجديد">
                  <input type="date" value={editContractExpiry} onChange={(e) => setEditContractExpiry(e.target.value)} className="kt-input" />
                </Field>
              </div>
            </div>
          </form>
        </Sheet>
      )}

      {/* تأكيد صرف العمولة */}
      {payoutConfirmMarketer && (() => {
        const st = marketerStats.find((s) => s.marketer.id === payoutConfirmMarketer.id);
        const due = st ? st.totalDueCommission : 0;
        return (
          <Sheet
            title="صرف العمولة"
            icon={Wallet}
            tone="jade"
            onClose={() => setPayoutConfirmMarketer(null)}
            footer={
              <Acts cols={2}>
                <Act
                  tone="jade"
                  icon={Check}
                  label="تأكيد الصرف"
                  title={`تأكيد التحويل والصرف (${due} ر.س)`}
                  onClick={() => handlePayoutConfirm(payoutConfirmMarketer.id)}
                />
                <Act tone="line" icon={X} label="إلغاء" onClick={() => setPayoutConfirmMarketer(null)} />
              </Acts>
            }
          >
            <Row
              icon={Wallet}
              tone="jade"
              title={payoutConfirmMarketer.name}
              sub={`${payoutConfirmMarketer.code} · ${payoutConfirmMarketer.phone}`}
            />
            <Infos cols={1}>
              <Info hi label="العمولة المستحقة للصرف (5%)" value={`${fmtN(due)} ر.س`} />
            </Infos>
          </Sheet>
        );
      })()}

      {/* تأكيد حذف المسوق */}
      {deleteConfirmMarketer && (
        <Sheet
          title="حذف المسوق"
          icon={Trash2}
          tone="garn"
          onClose={() => setDeleteConfirmMarketer(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="garnet"
                icon={Trash2}
                label="تأكيد الحذف"
                title="تأكيد الحذف النهائي"
                onClick={() => handleDeleteMarketerConfirm(deleteConfirmMarketer)}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setDeleteConfirmMarketer(null)} />
            </Acts>
          }
        >
          <Row icon={Trash2} tone="garn" title={deleteConfirmMarketer.name} sub={`${deleteConfirmMarketer.code} · ${deleteConfirmMarketer.email}`} />
          <div className="kt-err" role="alert">
            <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
            <span>يُحذف الحساب وصلاحيات دخوله نهائياً.</span>
          </div>
        </Sheet>
      )}

      {/* Booking Contract Preview Modal */}
      {viewBookingContract && (
        <PrintableContractModal
          booking={viewBookingContract}
          onClose={() => setViewBookingContract(null)}
        />
      )}

      {isEmailAddModalOpen && (
        <AddMemberModal
          isOpen={isEmailAddModalOpen}
          onClose={() => setIsEmailAddModalOpen(false)}
          defaultRole="marketer"
        />
      )}

      <BookingReceiptsModal
        booking={receiptsModalBooking}
        onClose={() => setReceiptsModalBooking(null)}
      />
    </div>
  );
};
