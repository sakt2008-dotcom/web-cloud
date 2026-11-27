import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Key,
  Users,
  Briefcase,
  FileText,
  MessageSquare,
  History,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Phone,
  Mail,
  Copy,
  Edit,
  Printer,
  Download,
  AlertCircle,
  X,
  CreditCard,
  Building,
  FileCode2,
  FileSpreadsheet,
  Smartphone,
  Database,
  PartyPopper,
  Receipt,
  Send,
  CheckCircle2,
  Globe,
  DollarSign,
  TrendingUp,
  BarChart3,
  Plus,
  Code,
  RefreshCw,
  Bell,
  Volume2,
  Megaphone,
  Maximize2,
  Loader2,
  Save,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from '../PWAInstallButton';
import { usePwaUpdate } from '../../lib/pwaUpdater';
import { downloadZipSafely } from '../../lib/downloadZip';
import { MarketersTab } from '../marketers/MarketersTab';
import { GuardProfileCard } from './GuardProfileCard';
import { AddGuardModal } from './AddGuardModal';
import { CommissionRequestsSection } from './CommissionRequestsSection';
import { IndividualFilesModal } from '../modals/IndividualFilesModal';
import { GoogleAppSheetModal } from '../modals/GoogleAppSheetModal';
import { CoordinatorsSection } from './CoordinatorsSection';
import { AdministrativeFeesLedgerModal } from './AdministrativeFeesLedgerModal';
import { FinancialHubView } from '../financials/FinancialHubView';
import { BankReceiptsHubModal } from '../modals/BankReceiptsHubModal';
import { isBookingCheckedOut, getBookingCommissionAmount } from '../../lib/financials';
import { getBookingReceiptsList } from '../../lib/bookingReceipts';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { LuxIcon } from '../ui/lux';
import { Head, Row, Tag, Tile, Acts, Act, Seg, Switch, Infos, Info, Stats, Stat, Rail, Pick, Sheet, Field } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';
import { fmtN } from '../../lib/format';
import type { Ico } from '../ui/kit';

/** أيقونة تحميل دوّارة (لأزرار kt-act) */
const SpinIcon: Ico = (props) => <Loader2 {...props} className="animate-spin" />;

interface MoreTabProps {
  onOpenRoleSwitcher: () => void;
  onOpenContract?: () => void;
  onOpenGeminiAI?: () => void;
}

export const MoreTab: React.FC<MoreTabProps> = ({ onOpenRoleSwitcher, onOpenGeminiAI }) => {
  const {
    isAdmin,
    isGuard,
    isCoordinator,
    currentMarketer,
    currentCoordinator,
    guard,
    guardsList,
    activityLogs,
    marketers,
    bookings,
    setActiveTab,
    openTemplatesModal,
    canViewMarketers,
    canViewMore,
    canManageTemplates,
    canViewActivityLogs,
    updateMarketerProfile,
    updateGuardProfile,
    deleteGuard,
    logout,
    adminBroadcasts,
    setAdminBroadcastModalOpen,
    requestBrowserNotificationPermission,
    browserNotificationPermission,
    sendTestNotification,
    isSoundEnabled,
    toggleSound,
  } = useApp();
  const { apkInfo } = usePWAInstall();

  const hasMoreFullAccess = isAdmin || canViewMore;
  /** المسوّق العادي: يرى ملفه وأموره المالية فقط */
  const isMarketerView = !isAdmin && !isGuard && !isCoordinator && !hasMoreFullAccess && Boolean(currentMarketer);
  const selfGuard = guard;
  const {
    buildId: pwaBuildId,
    updateAvailable: pwaUpdateAvailable,
    isChecking: isCheckingPwaUpdate,
    isApplying: isApplyingPwaUpdate,
    statusMessage: pwaUpdateMsg,
    checkForUpdate: checkPwaUpdate,
    applyUpdateNow: applyPwaUpdateNow,
  } = usePwaUpdate();

  const [selectedMarketerId, setSelectedMarketerId] = useState(
    currentMarketer?.id || marketers[0]?.id || ''
  );
  const [selectedGuardId, setSelectedGuardId] = useState<string>(() => selfGuard?.id || 'g1');
  const [guardActionMsg, setGuardActionMsg] = useState<string | null>(null);
  const [isAddGuardModalOpen, setIsAddGuardModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [financialsModalOpen, setFinancialsModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [appSheetModalOpen, setAppSheetModalOpen] = useState(false);
  const [adminFeesLedgerOpen, setAdminFeesLedgerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'admin' | 'marketers' | 'coordinators' | 'guard'>(
    isAdmin ? 'admin' : isGuard ? 'guard' : isCoordinator ? 'coordinators' : 'marketers'
  );
  const [financialHubOpen, setFinancialHubOpen] = useState(false);
  const [financialHubInitialTab, setFinancialHubInitialTab] = useState<'profits' | 'payouts' | 'analytics'>('profits');
  const [receiptsHubOpen, setReceiptsHubOpen] = useState(false);

  const openFinancialHub = (tab: 'profits' | 'payouts' | 'analytics' = 'profits') => {
    setFinancialHubInitialTab(tab);
    setFinancialHubOpen(true);
  };
  const [showMarketersPanel, setShowMarketersPanel] = useState(true);
  const [showGuardProfile, setShowGuardProfile] = useState(true);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editBankName, setEditBankName] = useState('مصرف الراجحي');
  const [editIban, setEditIban] = useState('');
  const [editContractNum, setEditContractNum] = useState('');
  const [editContractDate, setEditContractDate] = useState('');
  const [editContractExpiry, setEditContractExpiry] = useState('');

  const targetMarketer = marketers.find((m) => m.id === selectedMarketerId) || currentMarketer || marketers[0] || null;

  const openEditModal = () => {
    if (!targetMarketer) return;
    setEditName(targetMarketer.name);
    setEditPhone(targetMarketer.phone);
    setEditEmail(targetMarketer.email);
    setEditNationalId(targetMarketer.nationalId || '1088923412');
    setEditBankName(targetMarketer.bankName || 'مصرف الراجحي');
    setEditIban(targetMarketer.bankAccount || '');
    setEditContractNum(targetMarketer.contract?.contractNumber || `MKT-CTR-2026-${targetMarketer.code.replace('MK-', '')}`);
    setEditContractDate(targetMarketer.contract?.contractDate || '2026-01-15');
    setEditContractExpiry(targetMarketer.contract?.expiryDate || '2027-01-15');
    setEditProfileModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMarketer) return;

    if (!hasMoreFullAccess) {
      updateMarketerProfile(targetMarketer.id, {
        name: editName,
        phone: editPhone,
        email: editEmail,
        nationalId: editNationalId,
        bankName: editBankName,
        bankAccount: editIban,
      });
      setEditProfileModalOpen(false);
      return;
    }

    updateMarketerProfile(targetMarketer.id, {
      name: editName,
      phone: editPhone,
      email: editEmail,
      nationalId: editNationalId,
      bankName: editBankName,
      bankAccount: editIban,
      contract: {
        contractNumber: editContractNum,
        contractDate: editContractDate,
        expiryDate: editContractExpiry,
        commissionRatePercent: targetMarketer.contract?.commissionRatePercent || 5,
        status: targetMarketer.contract?.status || 'active',
        firstParty: 'إدارة AMASA RESORT',
        firstPartyRepresentative: 'الإدارة العامة والتشغيل',
        secondParty: editName,
        secondPartyPhone: editPhone,
        secondPartyEmail: editEmail,
        secondPartyNationalId: editNationalId,
        isSigned: true,
        signedDate: targetMarketer.contract?.signedDate || editContractDate,
        terms: targetMarketer.contract?.terms || [
          'الالتزام بالأسعار المعتمدة للشاليهات والاستراحات من قبل إدارة AMASA RESORT.',
          'يحق للمسوق إنشاء وتعديل عقود الإيجار المعتمدة والتنسيق مع النزلاء.',
          'يحق للمسوق تعديل مبلغ العربون قبل تأكيد الحجز.',
          'تصرف العمولة (5%) من كل حجز مؤكد لحساب المسوق البنكي المعتمد.',
        ],
      },
    });

    setEditProfileModalOpen(false);
  };

  const currentMarketerBookings = bookings.filter((b) => b.marketerId === targetMarketer?.id);
  const checkedOutMarketerBookings = currentMarketerBookings.filter((b) => isBookingCheckedOut(b));
  const preCheckoutMarketerBookings = currentMarketerBookings.filter(
    (b) => b.status !== 'cancelled' && !isBookingCheckedOut(b)
  );
  const totalSales = checkedOutMarketerBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const totalCommission = checkedOutMarketerBookings.reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);
  const paidCommission = checkedOutMarketerBookings
    .filter((b) => b.commissionStatus === 'paid')
    .reduce((sum, b) => sum + getBookingCommissionAmount(b), 0);
  const pendingCommission = Math.max(0, totalCommission - paidCommission);

  if (financialHubOpen) {
    return (
      <FinancialHubView
        initialTab={financialHubInitialTab}
        marketerView={isMarketerView}
        onBack={() => setFinancialHubOpen(false)}
      />
    );
  }

  const roleTitle = isAdmin
    ? 'الإدارة العامة'
    : isGuard
    ? `الحارس (${selfGuard?.name || 'المشرف الميداني'})`
    : isCoordinator
    ? `المنسق/ة (${currentCoordinator?.name || 'منسق'})`
    : `${currentMarketer?.name || 'الموظف'} (شاشة الموظف)`;
  const roleLabel = isAdmin
    ? 'مدير · كامل الصلاحيات'
    : isGuard
    ? 'مشرف الميدان والاستلام'
    : isCoordinator
    ? 'منسق تجهيزات وفعاليات'
    : 'مسوق معتمد · عمولة 5%';
  const receiptsCount = bookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    if (!isAdmin && currentMarketer?.id && b.marketerId !== currentMarketer.id && b.supervisorId !== currentMarketer.id) {
      return false;
    }
    return getBookingReceiptsList(b).length > 0;
  }).length;
  const chev = <ChevronLeft className="w-5 h-5 shrink-0 text-[#5B2EA6]" aria-hidden="true" />;

  return (
    <div className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-3 space-y-4 font-['Tajawal',sans-serif]">
      {/* 1. بطاقة المستخدم الحالية */}
      <section className="lux-hero p-4">
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative flex items-center gap-3.5">
          <Tile icon={isAdmin ? ShieldCheck : isGuard ? Key : UserCheck} tone="ch" dark size={56} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-[18px] font-extrabold truncate" style={{ color: '#F5F0FC' }}>
              {roleTitle}
            </h3>
            <Tag tone="gold">{roleLabel}</Tag>
            {!isAdmin && (
              <p className="text-[12.5px] truncate" style={{ color: '#BFB2DC' }}>
                {isGuard
                  ? `جوال: ${selfGuard?.phone || 'غير مسجل'}`
                  : isCoordinator
                  ? `جوال: ${currentCoordinator?.phone || ''}`
                  : `كود المسوق: ${currentMarketer?.code || ''}`}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 2. تبديل الحساب وتسجيل الخروج */}
      <Acts cols={2}>
        <Act tone="soft" icon={UserCheck} label="تبديل الحساب" onClick={onOpenRoleSwitcher} />
        <Act tone="garnS" icon={LogOut} label="تسجيل الخروج" onClick={logout} />
      </Acts>

      {/* 3. إعدادات الإشعارات والتثبيت */}
      <section className="lux-card p-4 space-y-3">
        <Head title="إعدادات التطبيق" icon={Smartphone} />

        <Row
          icon={Bell}
          tone={browserNotificationPermission === 'granted' ? 'jade' : browserNotificationPermission === 'denied' ? 'garn' : 'amy'}
          title="إشعارات الجوال"
          sub={
            browserNotificationPermission === 'denied'
              ? 'محظورة — فعّلها من إعدادات الجوال'
              : browserNotificationPermission === 'granted'
              ? 'مفعلة على هذا الجهاز'
              : 'اسمح بإشعارات الشاشة'
          }
          end={
            <Act
              small
              tone={
                browserNotificationPermission === 'granted' ? 'jadeS' : browserNotificationPermission === 'denied' ? 'garnS' : 'soft'
              }
              label={
                browserNotificationPermission === 'granted' ? 'مفعلة' : browserNotificationPermission === 'denied' ? 'محظورة' : 'السماح'
              }
              title="طلب السماح بإشعارات الجوال"
              onClick={async () => {
                const res = await requestBrowserNotificationPermission();
                if (res === 'granted') sendTestNotification();
              }}
            />
          }
        />

        {browserNotificationPermission === 'granted' && (
          <Row
            icon={Send}
            tone="amy"
            title="تجربة التنبيه"
            sub="إرسال إشعار تجريبي الآن"
            end={<Act small tone="soft" label="تجربة" onClick={sendTestNotification} />}
          />
        )}

        <Row
          icon={Volume2}
          tone={isSoundEnabled ? 'jade' : 'gray'}
          title="نغمات التنبيه"
          sub={isSoundEnabled ? 'مفعلة (صوت)' : 'غير مفعلة'}
          end={<Switch on={isSoundEnabled} onChange={() => toggleSound()} label="تشغيل نغمات تنبيهات الجوال" />}
        />

        <Row icon={Download} tone="amy" title="تثبيت التطبيق" sub="على الشاشة الرئيسية" end={<PWAInstallButton variant="row" />} />

        <Row
          icon={RefreshCw}
          tone={pwaUpdateAvailable ? 'jade' : 'amy'}
          title="تحديث التطبيق"
          sub={pwaUpdateMsg || `الإصدار: ${pwaBuildId}`}
          end={
            <Act
              small
              tone={pwaUpdateAvailable ? 'jade' : 'soft'}
              icon={isCheckingPwaUpdate || isApplyingPwaUpdate ? SpinIcon : RefreshCw}
              label={
                isApplyingPwaUpdate ? 'جاري…' : isCheckingPwaUpdate ? 'فحص…' : pwaUpdateAvailable ? 'تحديث' : 'فحص'
              }
              title="تحديث التطبيق مباشرة (بدون حذف)"
              disabled={isCheckingPwaUpdate || isApplyingPwaUpdate}
              onClick={async () => {
                if (pwaUpdateAvailable) {
                  await applyPwaUpdateNow();
                } else {
                  const found = await checkPwaUpdate();
                  if (found) {
                    await applyPwaUpdateNow();
                  }
                }
              }}
            />
          }
        />
      </section>

      {/* ملف المسوق (يظهر أولًا للمسوق) */}
      {isMarketerView && targetMarketer && (
        <section className="lux-card p-4 space-y-3.5">
          <Row icon={UserCheck} tone="amy" title="ملفي وعمولاتي" sub={`كود المسوق: ${targetMarketer.code} · عمولة 5%`} />
          <Acts cols={2}>
            <Act tone="soft" icon={FileText} label="البيانات والعقد" title="عرض البيانات والعقد" onClick={() => setProfileModalOpen(true)} />
            <Act tone="ink" icon={Edit} label="تعديل البيانات" onClick={openEditModal} />
          </Acts>
          <Stats cols={2} compact>
            <Stat label="مبيعات الحجوزات" value={fmtN(totalSales)} unit="ر.س" />
            <Stat tone="jade" label="العمولات المستحقة" value={fmtN(totalCommission)} unit="ر.س" />
          </Stats>
        </section>
      )}

      {/* 🌟 قسم الأمور المالية */}
      {isMarketerView ? (
        <section className="lux-card p-4 space-y-3">
          <Head title="أموري المالية" icon={DollarSign} tone="jade" />
          <Row icon={CreditCard} tone="sand" title="عمولاتي وطلبات الصرف" sub="طلب صرف وسجل طلباتي" onClick={() => openFinancialHub('payouts')} end={chev} />
          <Row icon={BarChart3} tone="jade" title="كشف عمولاتي" sub="المستحقة والمصروفة" onClick={() => setFinancialsModalOpen(true)} end={chev} />
        </section>
      ) : (
        (!isGuard || hasMoreFullAccess) && (
        <section className="lux-card p-4 space-y-3">
          <Head title="الأمور المالية" icon={DollarSign} tone="jade" action={<Tag tone="jade">جديد</Tag>} />
          <Row icon={TrendingUp} tone="jade" title="صافي الأرباح والإيجار" onClick={() => openFinancialHub('profits')} end={chev} />
          <Row icon={CreditCard} tone="sand" title="طلبات الصرف" sub="للعمولات" onClick={() => openFinancialHub('payouts')} end={chev} />
          <Row icon={BarChart3} tone="amy" title="التحليل البياني" sub="بين الاستراحات" onClick={() => openFinancialHub('analytics')} end={chev} />
        </section>
        )
      )}

      {/* سجل الإيصالات البنكية */}
      {!isGuard && !isMarketerView && (
        <section className="lux-card p-4">
          <Row
            icon={Receipt}
            tone="amy"
            title="الإيصالات البنكية"
            sub="المسوق والإدارة والمشرف"
            onClick={() => setReceiptsHubOpen(true)}
            end={
              <>
                <Tag tone="amy" mono>
                  {receiptsCount}
                </Tag>
                {chev}
              </>
            }
          />
        </section>
      )}

      {/* 3. أقسام الإدارة (للإدارة فقط) */}
      {isAdmin && (
        <Seg
          label="أقسام الإدارة"
          value={activeSection}
          onChange={setActiveSection}
          items={[
            { id: 'admin', label: 'الإدارة', icon: ShieldCheck },
            { id: 'marketers', label: 'المسوقون', icon: Users },
            { id: 'coordinators', label: 'المنسقات', icon: PartyPopper },
            { id: 'guard', label: 'الحارس', icon: Key },
          ]}
        />
      )}

      {/* القسم الأول: لوحة الإدارة */}
      {isAdmin && activeSection === 'admin' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* مركز التعميمات والقرارات الإدارية */}
          <section className="lux-hero p-4 space-y-3.5">
            <div aria-hidden="true" className="lux-lattice" />
            <div className="relative flex items-center gap-3">
              <Tile icon={Megaphone} tone="ch" dark size={44} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[16.5px] font-extrabold truncate" style={{ color: '#F5F0FC' }}>
                  مركز التعميمات
                </h3>
                <p className="text-[12.5px] truncate" style={{ color: '#BFB2DC' }}>
                  قرارات وتنبيهات لمجموعات الفرق
                </p>
              </div>
            </div>
            <Act
              tone="gold"
              icon={Send}
              label="إرسال تعميم جديد للفرق"
              onClick={() => setAdminBroadcastModalOpen(true)}
              className="relative"
            />
            <Infos cols={3} className="relative">
              <Info dark label="التعميمات" value={adminBroadcasts.length} />
              <Info dark label="المجموعات" value="6" />
              <Info dark label="العاجلة" value={adminBroadcasts.filter((b) => b.priority === 'urgent').length} />
            </Infos>
          </section>

          {/* تصنيف: الرسائل والعقود */}
          {(canManageTemplates || onOpenGeminiAI) && (
            <div className="space-y-2">
              <h4 className="kt-sec">الرسائل والعقود</h4>
              <section className="lux-card p-3 space-y-2">
                {canManageTemplates && (
                  <Row
                    icon={MessageSquare}
                    tone="amy"
                    title="قوالب الرسائل والعقود"
                    sub="تعديل صيغ الرسائل"
                    onClick={() => openTemplatesModal('depositRequest')}
                    end={chev}
                  />
                )}
                {onOpenGeminiAI && (
                  <Row
                    icon={Sparkles}
                    tone="ch"
                    title="مساعد AMASA الذكي"
                    sub="Google Gemini"
                    onClick={onOpenGeminiAI}
                    end={
                      <>
                        <Tag tone="gold">ذكاء</Tag>
                        {chev}
                      </>
                    }
                  />
                )}
              </section>
            </div>
          )}

          {/* تصنيف: المتابعة والرقابة */}
          <div className="space-y-2">
            <h4 className="kt-sec">المتابعة والرقابة</h4>
            <section className="lux-card p-3 space-y-2">
              {canViewActivityLogs && (
                <Row
                  icon={History}
                  tone="amy"
                  title="سجل العمليات"
                  sub="الصلاحيات (Audit Log)"
                  onClick={() => setLogsModalOpen(true)}
                  end={
                    <>
                      <Tag tone="amy" mono>
                        {activityLogs.length}
                      </Tag>
                      {chev}
                    </>
                  }
                />
              )}
              {(!isGuard || hasMoreFullAccess) && (
                <Row
                  icon={CreditCard}
                  tone="amy"
                  title="كشف حساب العمولات"
                  sub="التقارير المالية"
                  onClick={() => setFinancialsModalOpen(true)}
                  end={chev}
                />
              )}
              {hasMoreFullAccess && (
                <Row
                  icon={Receipt}
                  tone="ch"
                  title="جدول الرسوم الإدارية"
                  sub="المعاملات المالية"
                  onClick={() => setAdminFeesLedgerOpen(true)}
                  end={
                    <>
                      <Tag tone="gold">إدارة</Tag>
                      {chev}
                    </>
                  }
                />
              )}
              {hasMoreFullAccess && (
                <Row
                  icon={FileSpreadsheet}
                  tone="jade"
                  title="ربط AppSheet"
                  sub="Google Workspace"
                  onClick={() => setAppSheetModalOpen(true)}
                  end={chev}
                />
              )}

              {/* حزم المشروع: تظهر فقط عند التشغيل على خادم Node */}
              {apkInfo.serverOnline && (
                <>
                  <Row
                    icon={Code}
                    tone="saph"
                    title="ملف المصدر"
                    sub="الكود المصدري الأصلي"
                    end={
                      <Act
                        small
                        tone="soft"
                        icon={Download}
                        label="تحميل"
                        title="تحميل ملف المصدر (ZIP)"
                        href="/amasa-source.zip"
                        onClick={(e) => downloadZipSafely(e as React.MouseEvent<HTMLAnchorElement>, '/amasa-source.zip', 'amasa-source.zip')}
                      />
                    }
                  />
                  <Row
                    icon={Globe}
                    tone="sand"
                    title="ملف الرئيسي"
                    sub="نسخة الإنتاج العامة"
                    end={
                      <Act
                        small
                        tone="soft"
                        icon={Download}
                        label="تحميل"
                        title="تحميل ملف الرئيسي (ZIP)"
                        href="/amasa-dist.zip"
                        onClick={(e) => downloadZipSafely(e as React.MouseEvent<HTMLAnchorElement>, '/amasa-dist.zip', 'amasa-dist.zip')}
                      />
                    }
                  />
                  <Row
                    icon={Sparkles}
                    tone="jade"
                    title="حزمة كلود"
                    sub="ملفات البناء التأسيسية"
                    end={
                      <Act
                        small
                        tone="soft"
                        icon={Download}
                        label="تحميل"
                        title="تحميل حزمة كلود (ZIP)"
                        href="/amasa-claude-starter.zip"
                        onClick={(e) =>
                          downloadZipSafely(e as React.MouseEvent<HTMLAnchorElement>, '/amasa-claude-starter.zip', 'amasa-claude-starter.zip')
                        }
                      />
                    }
                  />
                  <Row
                    icon={Smartphone}
                    tone="jade"
                    title="Android Studio"
                    sub="APK بدون ملفات الويب"
                    end={
                      <Act
                        small
                        tone="soft"
                        icon={Download}
                        label="تحميل"
                        title="تحميل مشروع Android Studio (ZIP)"
                        href="/amasa-android-studio.zip"
                        onClick={(e) =>
                          downloadZipSafely(e as React.MouseEvent<HTMLAnchorElement>, '/amasa-android-studio.zip', 'amasa-android-studio.zip')
                        }
                      />
                    }
                  />
                  {hasMoreFullAccess && (
                    <Row
                      icon={Download}
                      tone="amy"
                      title="ملفات المشروع"
                      sub="نسخة الإنتاج (dist.zip)"
                      onClick={() => setFilesModalOpen(true)}
                      end={chev}
                    />
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {/* القسم الثاني: لوحة المسوقين */}
      {isAdmin && activeSection === 'marketers' && (
        <section className="lux-card p-4 space-y-3.5 animate-in fade-in duration-200">
          <Head
            title="المسوقون والعمولات"
            icon={Users}
            action={<Act small tone="soft" icon={Maximize2} label="تكبير" onClick={() => setActiveTab('marketers')} />}
          />
          <MarketersTab embedded={true} onOpenGeminiAI={onOpenGeminiAI} />
        </section>
      )}

      {/* لوحة المنسقات */}
      {isAdmin && activeSection === 'coordinators' && <CoordinatorsSection onOpenGeminiAI={onOpenGeminiAI} />}

      {/* لوحة الحراس */}
      {isAdmin && activeSection === 'guard' && (
        <section className="lux-card p-4 space-y-3.5 animate-in fade-in duration-200">
          <Head
            title={hasMoreFullAccess ? `الحراس (${guardsList.length})` : 'لوحة الحارس'}
            icon={Key}
            tone="sand"
            action={
              hasMoreFullAccess ? (
                <Act small tone="ink" icon={Plus} label="حارس جديد" onClick={() => setIsAddGuardModalOpen(true)} />
              ) : undefined
            }
          />

          {hasMoreFullAccess && guardsList && guardsList.length > 0 && (
            <Rail>
              {guardsList.map((g) => {
                const isSelected = selectedGuardId === g.id || (!selectedGuardId && g.id === (selfGuard?.id || 'g1'));
                const assignedCount = g.assignedPropertyIds?.length || (g.assignedPropertyId ? 1 : 0);
                return (
                  <Pick
                    key={g.id}
                    name={g.name}
                    sub={assignedCount > 0 ? `${assignedCount} استراحة` : 'بدون استراحة'}
                    avatar={g.avatar}
                    selected={isSelected}
                    onClick={() => setSelectedGuardId(g.id)}
                  />
                );
              })}
            </Rail>
          )}

          {guardActionMsg && (
            <div className="kt-ok animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
                <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{guardActionMsg}</span>
                <button type="button" onClick={() => setGuardActionMsg(null)} className="kt-err-x" aria-label="إغلاق">
                  ✕
                </button>
              </div>
            </div>
          )}

          {(() => {
            const displayedGuard =
              (hasMoreFullAccess && guardsList.find((g) => g.id === selectedGuardId)) || guardsList[0] || selfGuard;
            return (
              <GuardProfileCard
                key={displayedGuard.id}
                guard={displayedGuard}
                isAdmin={hasMoreFullAccess}
                onSave={(data) => updateGuardProfile(data, displayedGuard.id)}
                onDelete={(guardId) => {
                  const res = deleteGuard(guardId);
                  if (res.success) {
                    const nextGuard = guardsList.find((g) => g.id !== guardId);
                    if (nextGuard) {
                      setSelectedGuardId(nextGuard.id);
                    }
                    setGuardActionMsg(res.message);
                    setTimeout(() => setGuardActionMsg(null), 4000);
                  }
                  return res;
                }}
              />
            );
          })()}
        </section>
      )}

      {/* لغير الإدارة: بطاقة الحارس الشخصية */}
      {!isAdmin && isGuard && (
        <section className="lux-card p-4 space-y-3.5">
          <Head title="بيانات الحارس" icon={Key} tone="sand" />
          <GuardProfileCard
            guard={selfGuard}
            isAdmin={false}
            onSave={(data) => updateGuardProfile(data, selfGuard?.id || 'g1')}
          />
        </section>
      )}

      {/* لغير الإدارة: ملف المسوق وعمولاته */}
      {!isMarketerView && !isAdmin && !isGuard && targetMarketer && (
        <section className="lux-card p-4 space-y-3.5">
          <Row icon={UserCheck} tone="amy" title="ملفي وعمولاتي" sub={`كود المسوق: ${targetMarketer.code} · عمولة 5%`} />
          <Acts cols={2}>
            <Act tone="soft" icon={FileText} label="البيانات والعقد" title="عرض البيانات والعقد" onClick={() => setProfileModalOpen(true)} />
            <Act tone="ink" icon={Edit} label="تعديل البيانات" onClick={openEditModal} />
          </Acts>
          <Stats cols={2} compact>
            <Stat label="مبيعات الحجوزات" value={fmtN(totalSales)} unit="ر.س" />
            <Stat tone="jade" label="العمولات المستحقة" value={fmtN(totalCommission)} unit="ر.س" />
          </Stats>
        </section>
      )}

      {/* بيانات الموظف */}
      {profileModalOpen && targetMarketer && (
        <Sheet
          title="بيانات الموظف"
          icon={UserCheck}
          tone="amy"
          onClose={() => setProfileModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="ink" icon={Edit} label="تعديل البيانات" onClick={openEditModal} />
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setProfileModalOpen(false)} />
            </Acts>
          }
        >
          <Row
            icon={UserCheck}
            tone="amy"
            title={targetMarketer.name}
            sub={`${targetMarketer.code} · انضم ${targetMarketer.joinDate}`}
          />
          <Infos cols={2}>
            <Info ltr label="الجوال" value={targetMarketer.phone} onCopy={() => navigator.clipboard?.writeText(targetMarketer.phone)} />
            <Info ltr label="الهوية" value={targetMarketer.nationalId || '—'} />
            <Info ltr wide label="البريد الإلكتروني" value={targetMarketer.email} />
            <Info label="البنك" value={targetMarketer.bankName || '—'} wide />
            <Info
              ltr
              wide
              label="الآيبان (IBAN)"
              value={targetMarketer.bankAccount || 'غير مسجل'}
              onCopy={targetMarketer.bankAccount ? () => navigator.clipboard?.writeText(targetMarketer.bankAccount || '') : undefined}
            />
          </Infos>
        </Sheet>
      )}

      {/* تعديل بيانات الموظف والعقد */}
      {editProfileModalOpen && (
        <Sheet
          wide
          lockBackdrop
          title="تعديل البيانات"
          icon={Edit}
          tone="amy"
          onClose={() => setEditProfileModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act submit form="mk-profile-form" tone="ink" icon={Save} label="حفظ البيانات" />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setEditProfileModalOpen(false)} />
            </Acts>
          }
        >
          <form id="mk-profile-form" onSubmit={handleSaveProfile} className="kt-fields">
            <Field label="الاسم الكامل" className="kt-wide">
              <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="kt-input" />
            </Field>
            <Field label="الجوال">
              <input type="tel" required dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="kt-input kt-num" />
            </Field>
            <Field label="رقم الهوية">
              <input type="text" dir="ltr" value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} className="kt-input kt-num" />
            </Field>
            <Field label="البريد الإلكتروني" className="kt-wide">
              <input type="email" required dir="ltr" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="kt-input" />
            </Field>
            <Field label="البنك" className="kt-wide">
              <input type="text" value={editBankName} onChange={(e) => setEditBankName(e.target.value)} className="kt-input" />
            </Field>
            <Field label="الآيبان (IBAN)" className="kt-wide">
              <input type="text" dir="ltr" value={editIban} onChange={(e) => setEditIban(e.target.value)} className="kt-input" />
            </Field>

            {hasMoreFullAccess && (
              <div className="kt-sub kt-wide">
                <p className="kt-sub-t">بيانات العقد (للإدارة)</p>
                <Field label="رقم العقد">
                  <input type="text" dir="ltr" value={editContractNum} onChange={(e) => setEditContractNum(e.target.value)} className="kt-input" />
                </Field>
                <div className="kt-fields">
                  <Field label="تاريخ العقد">
                    <input type="date" value={editContractDate} onChange={(e) => setEditContractDate(e.target.value)} className="kt-input" />
                  </Field>
                  <Field label="الانتهاء">
                    <input type="date" value={editContractExpiry} onChange={(e) => setEditContractExpiry(e.target.value)} className="kt-input" />
                  </Field>
                </div>
              </div>
            )}
          </form>
        </Sheet>
      )}

      {/* سجل النشاطات */}
      {logsModalOpen && (
        <Sheet
          wide
          title="سجل العمليات"
          icon={History}
          tone="amy"
          onClose={() => setLogsModalOpen(false)}
          footer={<Act tone="line" icon={X} label="إغلاق" onClick={() => setLogsModalOpen(false)} />}
        >
          {activityLogs.length === 0 ? (
            <EmptyBox icon={History} text="لا توجد عمليات مسجّلة بعد" />
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className="kt-bk">
                <div className="kt-bk-h">
                  <span className="kt-row-n">{log.action}</span>
                  <Tag tone="gray" mono>
                    {log.timestamp}
                  </Tag>
                </div>
                {log.details && <p className="kt-note line-clamp-2">{log.details}</p>}
                <p className="kt-note" style={{ color: '#5B2EA6', fontWeight: 800 }}>
                  {log.actorName} · {log.actorRole === 'admin' ? 'الإدارة' : 'موظف'}
                </p>
              </div>
            ))
          )}
        </Sheet>
      )}

      {/* كشف حساب العمولات */}
      {financialsModalOpen && (
        <Sheet
          title="كشف العمولات"
          icon={CreditCard}
          tone="jade"
          onClose={() => setFinancialsModalOpen(false)}
          footer={<Act tone="line" icon={X} label="إغلاق" onClick={() => setFinancialsModalOpen(false)} />}
        >
          <Stats cols={2} compact>
            <Stat label="الإيجارات" value={fmtN(totalSales)} unit="ر.س" />
            <Stat tone="jade" label="المستحقة" value={fmtN(totalCommission)} unit="ر.س" />
            <Stat label="المصروفة" value={fmtN(paidCommission)} unit="ر.س" />
            <Stat tone="sand" label="جاهزة للصرف" value={fmtN(pendingCommission)} unit="ر.س" />
          </Stats>
          {preCheckoutMarketerBookings.length > 0 && (
            <div className="kt-warn p-3 text-[13px] font-bold leading-6" style={{ color: '#7A4A06' }}>
              {preCheckoutMarketerBookings.length} حجز قيد الإقامة — لا تُضاف مبالغه وعمولته إلا بعد الخروج.
            </div>
          )}
        </Sheet>
      )}

      {/* نافذة تحميل الملفات المنفصلة */}
      <IndividualFilesModal
        isOpen={filesModalOpen}
        onClose={() => setFilesModalOpen(false)}
      />

      {/* Google AppSheet & Google Workspace Modal */}
      <GoogleAppSheetModal
        isOpen={appSheetModalOpen}
        onClose={() => setAppSheetModalOpen(false)}
      />

      {/* Administrative Fees Financial Ledger Modal */}
      <AdministrativeFeesLedgerModal
        isOpen={adminFeesLedgerOpen}
        onClose={() => setAdminFeesLedgerOpen(false)}
      />

      {/* Bank Receipts Hub Modal */}
      <BankReceiptsHubModal
        isOpen={receiptsHubOpen}
        onClose={() => setReceiptsHubOpen(false)}
      />

      {/* Add Guard Modal */}
      <AddGuardModal
        isOpen={isAddGuardModalOpen}
        onClose={() => setIsAddGuardModalOpen(false)}
        onSuccess={(newId) => setSelectedGuardId(newId)}
      />
    </div>
  );
};
