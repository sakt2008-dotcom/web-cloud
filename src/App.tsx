import React, { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { ToastNotification } from './components/ToastNotification';
import { LoginScreen } from './components/auth/LoginScreen';
import { UrgentBroadcastBanner } from './components/admin/UrgentBroadcastBanner';
import { SimulationTopBanner } from './components/admin/SimulationTopBanner';
import { STORAGE_KEYS } from './lib/storage';
import { exitPersonalDemoMode } from './lib/demoMode';
import {
  initMobileAudioUnlock,
  isBrowserNotificationSupported,
  unlockMobileAudio,
} from './lib/sound';
import { usePwaUpdate } from './lib/pwaUpdater';
import { Loader2, Lock, ArrowRightLeft, LogOut } from 'lucide-react';
import { Act, Acts, Tile } from './components/ui/kit';
import { LuxIcon } from './components/ui/lux';
import { ErrorBoundary } from './components/ErrorBoundary';
import loginBgUrl from './assets/images/login-bg.jpg';

import { AuthModal } from './components/modals/AuthModal';
import { BookingModal } from './components/modals/BookingModal';
import { NotificationsModal } from './components/modals/NotificationsModal';
import { CalendarTab } from './components/calendar/CalendarTab';
import { BookingsTab } from './components/bookings/BookingsTab';
import { SupervisorTab } from './components/supervisor/SupervisorTab';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { PropertiesTab } from './components/properties/PropertiesTab';
import { MarketersTab } from './components/marketers/MarketersTab';
import { MoreTab } from './components/more/MoreTab';
import { GuardTasksTab } from './components/guard/GuardTasksTab';
import { KayanDetergentsTab } from './components/kayan/KayanDetergentsTab';
import { TemplatesModal } from './components/modals/TemplatesModal';
import { GeminiAssistantModal } from './components/ai/GeminiAssistantModal';
import { AdminBroadcastModal } from './components/admin/AdminBroadcastModal';
import { AdminAccountSwitcherModal } from './components/admin/AdminAccountSwitcherModal';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    templatesModalOpen,
    setTemplatesModalOpen,
    activeTemplateTab,
    isAdmin,
    canViewDashboard,
    canViewGuardTasks,
    canViewCalendar,
    canViewBookings,
    canViewSupervisor,
    canViewProperties,
    canViewMarketers,
    canViewMore,
    canViewKayanDetergents,
    isAuthModalOpen,
    setIsAuthModalOpen,
    adminBroadcastModalOpen,
    setAdminBroadcastModalOpen,
    isAccountSwitcherOpen,
    setIsAccountSwitcherOpen,
    isDemoMode,
    logout,
    browserNotificationPermission,
    requestBrowserNotificationPermission,
    sendTestNotification,
  } = useApp();

  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false);
  const { updateAvailable, isApplying, applyUpdateNow } = usePwaUpdate();

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  // Continuously arm mobile audio unlock until both Web Audio and HTMLAudio chime are unlocked
  useEffect(() => {
    return initMobileAudioUnlock();
  }, []);

  const hasAnyPageAccess =
    isAdmin ||
    canViewDashboard ||
    canViewGuardTasks ||
    canViewCalendar ||
    canViewBookings ||
    canViewSupervisor ||
    canViewProperties ||
    canViewMarketers ||
    canViewMore;

  // Enforce tab permissions: if current tab is hidden by permissions, fall back to first accessible tab
  useEffect(() => {
    if (isAdmin) return;
    const allowedMap: Record<string, boolean> = {
      dashboard: canViewDashboard,
      'guard-tasks': canViewGuardTasks,
      calendar: canViewCalendar,
      bookings: canViewBookings,
      supervisor: canViewSupervisor,
      properties: canViewProperties,
      marketers: canViewMarketers,
      more: canViewMore,
      'kayan-detergents': canViewKayanDetergents,
    };
    if (!allowedMap[activeTab]) {
      const order: Array<'dashboard' | 'bookings' | 'supervisor' | 'guard-tasks' | 'calendar' | 'properties' | 'marketers' | 'more'> = [
        'dashboard',
        'bookings',
        'supervisor',
        'guard-tasks',
        'calendar',
        'properties',
        'marketers',
        'more',
      ];
      const fallback = order.find((tab) => allowedMap[tab]);
      if (fallback && fallback !== activeTab) {
        setActiveTab(fallback);
      }
    }
  }, [
    activeTab,
    isAdmin,
    canViewDashboard,
    canViewGuardTasks,
    canViewCalendar,
    canViewBookings,
    canViewSupervisor,
    canViewProperties,
    canViewMarketers,
    canViewMore,
    canViewKayanDetergents,
    setActiveTab,
  ]);

  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  return (
    <div className="h-[100dvh] overflow-hidden bg-transparent text-slate-900 flex flex-col font-['Tajawal',sans-serif]">
      {/* Isolated Personal Demo Mode Banner */}
      {isDemoMode && (
        <div
          dir="rtl"
          className="bg-[#FBEFD9] text-[#7A4A06] px-4 py-1.5 text-[13px] font-semibold flex items-center justify-between gap-2 shrink-0 border-b border-[#D9932B]/40 z-40"
        >
          <span className="truncate">
            وضع الديمو نشط — بيانات تجريبية مؤقتة
          </span>
          <button
            type="button"
            onClick={exitPersonalDemoMode}
            className="h-9 px-3.5 rounded-full bg-[#1B0E33] text-[#E8D4A2] text-[13px] font-semibold shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            خروج من الديمو
          </button>
        </div>
      )}

      {/* Simulation Top Banner (Admin Account Inspection & Error Diagnosis) */}
      <SimulationTopBanner />

      {/* Header */}
      <Header
        onOpenNotifications={() => setNotificationsModalOpen(true)}
        onOpenRoleSwitcher={() => setIsAuthModalOpen(true)}
        onOpenGeminiAI={() => setIsGeminiModalOpen(true)}
        navMenuOpen={navMenuOpen}
        setNavMenuOpen={setNavMenuOpen}
      />

      {/* Instant App Update Banner (updates Home Screen PWA in 1 tap without uninstalling) */}
      {(updateAvailable || isApplying) && (
        <div
          dir="rtl"
          className="bg-[#0E5A49] text-white px-4 py-2.5 text-[13px] flex items-center justify-between gap-3 shrink-0 border-b border-[#C9A45C]/40 z-20"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-full bg-white/12 flex items-center justify-center text-[#E8D4A2]">
              <LuxIcon name={isApplying ? 'spin' : 'refresh'} size={20} />
            </span>
            <span className="font-semibold leading-snug">
              {isApplying
                ? 'جاري تحديث التطبيق...'
                : 'يتوفر تحديث جديد للتطبيق'}
            </span>
          </div>
          {!isApplying && (
            <button
              type="button"
              onClick={() => void applyUpdateNow()}
              className="lux-metal h-10 px-4 rounded-full text-[#1B0E33] font-bold text-[13px] shrink-0 cursor-pointer active:scale-95 transition-all"
            >
              تحديث الآن
            </button>
          )}
        </div>
      )}

      {/* One-tap activation bar for Chrome Home Screen PWA when notification permission is not yet granted */}
      {!notifPromptDismissed &&
        isBrowserNotificationSupported() &&
        browserNotificationPermission === 'default' && (
          <div
            dir="rtl"
            className="bg-[#1B0E33] text-white px-4 py-2.5 text-[13px] flex items-center justify-between gap-3 shrink-0 border-b border-[#C9A45C]/30 z-20"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#E8D4A2]">
                <LuxIcon name="bell" size={20} />
              </span>
              <span className="font-semibold leading-snug">
                فعّل التنبيهات على شاشة القفل
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  unlockMobileAudio();
                  const perm = await requestBrowserNotificationPermission();
                  if (perm === 'granted') {
                    sendTestNotification();
                  }
                }}
                className="lux-metal h-11 px-4 rounded-full text-[#1B0E33] font-bold text-[13px] cursor-pointer active:scale-95 transition-all"
              >
                تفعيل
              </button>
              <button
                type="button"
                onClick={() => setNotifPromptDismissed(true)}
                aria-label="إغلاق"
                className="w-11 h-11 rounded-full text-[#BFB2DC] hover:bg-white/10 cursor-pointer flex items-center justify-center"
              >
                <LuxIcon name="close" size={20} />
              </button>
            </div>
          </div>
        )}

      {/* Urgent Broadcast Banner for Admin Decisions & Alerts */}
      <UrgentBroadcastBanner />

      {/* Main Content Area - Scrollable with clean bottom padding */}
      <main ref={mainRef} className="lx-stage flex-1 overflow-y-auto w-full pb-6">
        {!hasAnyPageAccess ? (
          <section className="lux-card max-w-md mx-auto mt-16 p-5 space-y-3 text-center" style={{ width: 'calc(100% - 32px)' }}>
            <div className="flex justify-center">
              <Tile icon={Lock} tone="amy" size={56} />
            </div>
            <h3 className="text-[17px] font-extrabold text-[#1A0F2E]">لا توجد صفحات مفعّلة</h3>
            <p className="kt-note">أُخفيت كل الصفحات من صلاحيات هذا الحساب. تواصل مع الإدارة لتفعيلها.</p>
            <Acts cols={2}>
              <Act tone="ink" icon={ArrowRightLeft} label="تبديل الحساب" onClick={() => setIsAuthModalOpen(true)} />
              <Act tone="garnS" icon={LogOut} label="تسجيل الخروج" onClick={logout} />
            </Acts>
          </section>
        ) : (
          <>
            {activeTab === 'calendar' && canViewCalendar && <CalendarTab />}
            {activeTab === 'bookings' && canViewBookings && <BookingsTab />}
            {activeTab === 'supervisor' && canViewSupervisor && <SupervisorTab />}
            {activeTab === 'dashboard' && canViewDashboard && <DashboardTab />}
            {activeTab === 'guard-tasks' && canViewGuardTasks && <GuardTasksTab />}
            {activeTab === 'properties' && canViewProperties && <PropertiesTab />}
            {activeTab === 'marketers' && canViewMarketers && (
              <MarketersTab onOpenGeminiAI={() => setIsGeminiModalOpen(true)} />
            )}
            {activeTab === 'kayan-detergents' && canViewKayanDetergents && <KayanDetergentsTab />}
            {activeTab === 'more' && canViewMore && (
              <MoreTab
                onOpenRoleSwitcher={() => setIsAuthModalOpen(true)}
                onOpenGeminiAI={() => setIsGeminiModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* الشريط السفلي العائم (الجوال) */}

      {/* Audio / Visual Toast Alerts */}
      <ToastNotification />

      {/* Modals */}
      {isAuthModalOpen && (
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      )}
      <BookingModal />
      {notificationsModalOpen && (
        <NotificationsModal isOpen={notificationsModalOpen} onClose={() => setNotificationsModalOpen(false)} />
      )}
      {templatesModalOpen && (
        <TemplatesModal
          isOpen={templatesModalOpen}
          onClose={() => setTemplatesModalOpen(false)}
          initialTab={activeTemplateTab}
        />
      )}
      {isGeminiModalOpen && (
        <GeminiAssistantModal
          isOpen={isGeminiModalOpen}
          onClose={() => setIsGeminiModalOpen(false)}
        />
      )}
      {adminBroadcastModalOpen && (
        <AdminBroadcastModal
          isOpen={adminBroadcastModalOpen}
          onClose={() => setAdminBroadcastModalOpen(false)}
        />
      )}
      {isAccountSwitcherOpen && (
        <AdminAccountSwitcherModal
          isOpen={isAccountSwitcherOpen}
          onClose={() => setIsAccountSwitcherOpen(false)}
        />
      )}
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { isAuthenticated, isInitialHydrating, isDemoMode, setIsAuthenticated } = useApp();

  const handleAuthenticated = () => {
    if (!isDemoMode) {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH, '1');
      } catch {}
    }
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginScreen onAuthed={handleAuthenticated} />;
  }

  if (isInitialHydrating) {
    return (
      <div
        dir="rtl"
        className="relative min-h-[100dvh] bg-[#140322] overflow-hidden flex items-center justify-center p-4 font-['Tajawal',sans-serif]"
      >
        <img
          src={loginBgUrl}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[#140322]/75 pointer-events-none" />
        <div className="relative z-10 w-full max-w-xs bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-purple-200/50 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1b0630] via-[#3b1263] to-[#120422] border border-purple-300/40 flex items-center justify-center shadow-lg">
            <span className="font-serif font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-purple-200">
              A
            </span>
          </div>
          <div className="space-y-1">
            <h2 className="text-[16px] font-extrabold text-[#1A0F2E]">جاري تجهيز بياناتك</h2>
            <p className="text-[13px] text-[#5E5575] leading-relaxed">مزامنة الوحدات والحجوزات والصلاحيات...</p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1 text-[#5B2EA6] text-[13px] font-bold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>يرجى الانتظار لحظة</span>
          </div>
        </div>
      </div>
    );
  }

  return <MainAppContent />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthGate />
      </AppProvider>
    </ErrorBoundary>
  );
}
