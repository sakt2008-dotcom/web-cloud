import React, { useEffect } from 'react';
import { Download, LogOut, Megaphone, RefreshCw, Sparkles, type LucideProps } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { downloadZipSafely } from '../lib/downloadZip';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { usePwaUpdate } from '../lib/pwaUpdater';
import { useNavItems } from './nav/useNavItems';
import { Avatar, BrandMark, C, Gem, LuxIcon, StatusChip } from './ui/lux';
import { Act, Acts, Tile } from './ui/kit';

interface HeaderProps {
  onOpenNotifications: () => void;
  onOpenRoleSwitcher: () => void;
  onOpenGeminiAI?: () => void;
  navMenuOpen: boolean;
  setNavMenuOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  onOpenRoleSwitcher,
  onOpenGeminiAI,
  navMenuOpen,
  setNavMenuOpen,
}) => {
  const {
    currentMarketer,
    currentCoordinator,
    guard,
    isAdmin,
    isGuard,
    isCoordinator,
    isSupervisor,
    unreadNotificationsCount,
    activeTab,
    setActiveTab,
    canViewCalendar,
    setAdminBroadcastModalOpen,
    simulation,
    logout,
  } = useApp();

  const { updateAvailable, isChecking, isApplying, checkForUpdate, applyUpdateNow } = usePwaUpdate();
  const { apkInfo } = usePWAInstall();
  const { all, visible: visibleNavItems, activeBookingsCount, todayCount } = useNavItems();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavMenuOpen(false);
    };
    if (navMenuOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navMenuOpen, setNavMenuOpen]);

  const currentPageTitle = all.find((item) => item.id === activeTab)?.label || 'AMASA RESORT';

  const goHome = () => {
    const targetTab = canViewCalendar ? 'calendar' : visibleNavItems[0]?.id || (isGuard ? 'dashboard' : 'bookings');
    setActiveTab(targetTab);
  };

  const accountName = isAdmin
    ? 'الإدارة العامة'
    : isGuard
    ? guard.name
    : isCoordinator
    ? currentCoordinator?.name || 'منسقة'
    : currentMarketer?.name || '';
  const accountRole = isAdmin ? 'الإدارة' : isGuard ? 'الحارس' : isCoordinator ? 'المنسقة' : isSupervisor ? 'Supervisor' : 'مسوّق';
  const accountLetter = isAdmin ? 'A' : (accountName || accountRole).trim().charAt(0) || 'A';

  const navAlert = activeBookingsCount > 0 || (isGuard && todayCount > 0);

  // عدد أزرار الأدوات يحدد الأعمدة: كل الصناديق متساوية دائماً
  const toolCount = (isAdmin ? 1 : 0) + (onOpenGeminiAI ? 1 : 0) + 2;
  const toolCols: 1 | 2 | 3 | 4 = toolCount === 3 ? 3 : 2;
  const SpinIcon = (props: LucideProps) => (
    <RefreshCw {...props} className={isChecking || isApplying ? 'animate-spin' : undefined} />
  );

  return (
    <>
      {/* ───────── الشريط العلوي العائم ───────── */}
      <header
        className="sticky top-0 z-30 px-3 pt-2 pb-3"
        style={{ background: 'linear-gradient(180deg, rgba(247,243,236,.97) 58%, rgba(247,243,236,0))' }}
      >
        <div className="lx-bar max-w-5xl mx-auto h-[64px] px-2.5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setNavMenuOpen(true)}
            className="lx-dome relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer shrink-0"
            style={{ color: C.am }}
            aria-label="قائمة التنقل"
            aria-expanded={navMenuOpen}
          >
            <LuxIcon name="menu" size={24} strokeWidth={1.8} />
            {navAlert && (
              <span className="absolute top-1 left-1">
                <Gem color={C.garn} size={11} pulse />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={goHome}
            className="flex-1 min-w-0 flex items-center gap-2.5 text-right cursor-pointer select-none active:scale-[.985] transition-transform"
            aria-label={`AMASA RESORT — ${currentPageTitle}`}
          >
            <BrandMark size={44} />
            <span className="flex flex-col min-w-0 leading-none">
              <span className="text-[12px] font-semibold tracking-[.3em]" style={{ color: '#8D6B2C' }}>
                AMASA RESORT
              </span>
              <span className="text-[17px] font-bold truncate mt-1.5" style={{ color: C.txt }}>
                {currentPageTitle}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="lx-dome relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer shrink-0"
            style={{ color: C.am }}
            aria-label={
              unreadNotificationsCount > 0
                ? `الإشعارات والتنبيهات، ${unreadNotificationsCount} غير مقروءة`
                : 'الإشعارات والتنبيهات'
            }
          >
            <LuxIcon name="bell" size={24} strokeWidth={1.8} />
            {unreadNotificationsCount > 0 && (
              <span className="lx-count absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ───────── القائمة المنسدلة (تنطوي من الأعلى) ───────── */}
      {navMenuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="قائمة التنقل">
          <div
            onClick={() => setNavMenuOpen(false)}
            className="absolute inset-0 lux-fade"
            style={{ background: 'rgba(19,10,36,.62)', backdropFilter: 'blur(6px)' }}
            aria-hidden="true"
          />

          <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-md px-2.5 pt-2">
            <div
              className="lx-unfold lx-panel relative flex flex-col overflow-hidden rounded-[28px]"
              style={{ maxHeight: 'calc(100dvh - 16px)' }}
            >
              {/* الرأس الداكن: الهوية + الحساب */}
              <div className="lux-hero shrink-0 px-4 pt-4 pb-5" style={{ borderRadius: 0 }}>
                <div aria-hidden="true" className="lux-lattice" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <BrandMark size={50} />
                    <div className="min-w-0 leading-none">
                      <div className="text-[19px] font-bold tracking-[.22em]" style={{ color: C.snow }}>
                        AMASA
                      </div>
                      <div className="text-[12px] font-semibold tracking-[.5em] mt-2" style={{ color: C.chl }}>
                        RESORT
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNavMenuOpen(false)}
                    className="lx-dome-dark w-12 h-12 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                    style={{ color: C.chl }}
                    aria-label="إغلاق القائمة"
                  >
                    <LuxIcon name="close" size={22} strokeWidth={2} />
                  </button>
                </div>

                <div className="relative mt-4 flex items-center gap-3">
                  <Avatar letter={accountLetter} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold truncate" style={{ color: C.snow }}>
                      {accountName || accountRole}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StatusChip kind="jade" dark lead={<Gem color={C.jade} size={9} pulse />}>
                        {simulation?.isSimulating ? 'معاينة' : accountRole}
                      </StatusChip>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNavMenuOpen(false);
                      onOpenRoleSwitcher();
                    }}
                    className="lx-gold h-11 px-4 rounded-full text-[14px] font-semibold cursor-pointer shrink-0"
                  >
                    تبديل
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                {/* الأقسام: 3 أعمدة وصناديق متساوية بأسماء قصيرة */}
                <div className="px-4 pt-5 flex flex-col gap-3">
                  <span className="kt-sec-t">
                    <Gem color={C.ch} size={10} />
                    الأقسام
                  </span>
                  <div className="kt-navg">
                    {visibleNavItems.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            setNavMenuOpen(false);
                          }}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={item.label}
                          title={item.label}
                          className="kt-nav lx-press"
                        >
                          <Tile icon={item.icon} tone="amy" size={44} dark={isActive} />
                          <span>{item.short}</span>
                          {item.badge !== undefined && <span className="kt-nav-b">{item.badge}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* الأدوات */}
                <div className="px-4 pt-5 pb-6 flex flex-col gap-3">
                  <span className="kt-sec-t">
                    <Gem color={C.ch} size={10} />
                    أدوات سريعة
                  </span>

                  <Acts cols={toolCols}>
                    {isAdmin && (
                      <Act
                        stack={toolCols === 3}
                        tone="ink"
                        icon={Megaphone}
                        label="تعميم للفرق"
                        title="تعميم وقرار إداري للفرق"
                        onClick={() => {
                          setNavMenuOpen(false);
                          setAdminBroadcastModalOpen(true);
                        }}
                      />
                    )}
                    {onOpenGeminiAI && (
                      <Act
                        stack={toolCols === 3}
                        tone="gold"
                        icon={Sparkles}
                        label="المساعد الذكي"
                        title="مساعد AMASA RESORT الذكي"
                        onClick={() => {
                          setNavMenuOpen(false);
                          onOpenGeminiAI();
                        }}
                      />
                    )}
                    <PWAInstallButton variant="act" className={toolCols === 3 ? 'kt-stack' : ''} />
                    <Act
                      stack={toolCols === 3}
                      tone={updateAvailable ? 'jade' : 'soft'}
                      icon={SpinIcon}
                      label={
                        isApplying ? 'جاري التحديث…' : isChecking ? 'جاري الفحص…' : updateAvailable ? 'تحديث الآن' : 'فحص التحديثات'
                      }
                      title={updateAvailable ? 'تحديث التطبيق إلى أحدث نسخة الآن' : 'فحص تحديثات التطبيق'}
                      disabled={isChecking || isApplying}
                      onClick={async () => {
                        if (updateAvailable) {
                          await applyUpdateNow();
                        } else {
                          const found = await checkForUpdate();
                          if (found) await applyUpdateNow();
                        }
                      }}
                    />
                  </Acts>

                  {isAdmin && apkInfo.serverOnline && (
                    <div className="kt-sub">
                      <p className="kt-sub-t">حزم المشروع</p>
                      <Acts cols={3}>
                        {[
                          { href: '/amasa-source.zip', name: 'amasa-source.zip', label: 'المصدر', title: 'ملف المصدر (Source Code)' },
                          { href: '/amasa-dist.zip', name: 'amasa-dist.zip', label: 'الرفع', title: 'ملف الرفع للاستضافة (Dist)' },
                          { href: '/amasa-android-studio.zip', name: 'amasa-android-studio.zip', label: 'أندرويد', title: 'مشروع Android Studio' },
                        ].map((d) => (
                          <Act
                            key={d.href}
                            stack
                            tone="white"
                            icon={Download}
                            label={d.label}
                            title={d.title}
                            href={d.href}
                            download={d.name}
                            onClick={(e) => downloadZipSafely(e as React.MouseEvent<HTMLAnchorElement>, d.href, d.name)}
                          />
                        ))}
                      </Acts>
                    </div>
                  )}

                  <Act
                    tone="garnS"
                    icon={LogOut}
                    label="تسجيل الخروج"
                    title="تسجيل الخروج من الجلسة"
                    onClick={() => {
                      setNavMenuOpen(false);
                      logout();
                    }}
                  />

                  <div className="pt-1 text-center text-[12px] tracking-[.3em]" style={{ color: C.mut }}>
                    AMASA RESORT
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
