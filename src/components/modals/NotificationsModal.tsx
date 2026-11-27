import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  Clock,
  DoorOpen,
  Gem,
  KeyRound,
  LogOut,
  Megaphone,
  MessageCircle,
  Send,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { stripEmoji } from '../../lib/stripEmoji';
import { unlockMobileAudio, triggerMobileVibration, playChimeSound } from '../../lib/sound';
import { Act, Acts, Chip, Chips, Head, Row, Sheet, Tag, Tile, type Ico, type Tone } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Filter = 'all' | 'arrival' | 'finance' | 'admin';

const latin = (s?: string) => (s || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const {
    filteredNotifications,
    markNotificationsAsRead,
    unreadNotificationsCount,
    browserNotificationPermission,
    requestBrowserNotificationPermission,
    isPushSubscribed,
    syncPushSubscription,
    sendBackgroundPushTest,
    isSoundEnabled,
    toggleSound,
    sendTestNotification,
    isGuard,
    guard,
    guardPropertyIds,
    properties,
    isAdmin,
    setAdminBroadcastModalOpen,
    acknowledgeBroadcast,
    sendPaymentCompletionRequest,
  } = useApp();

  const [requestingPerm, setRequestingPerm] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [preparedWhatsappUrl, setPreparedWhatsappUrl] = useState<{ notifId: string; url: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const classify = (n: (typeof filteredNotifications)[number]): Filter => {
    const txt = `${n.title} ${n.description}`;
    if (n.type === 'broadcast' || n.type === 'permission') return 'admin';
    if (n.type === 'deposit_request' || n.type === 'insurance' || n.type === 'commission' || /متبقي|تأمين|عمولة|سداد/.test(txt)) return 'finance';
    if (/وصل|حضور|دخول|خروج|مغادرة/.test(txt) || n.type === 'checkout' || n.type === 'booking') return 'arrival';
    return 'all';
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: filteredNotifications.length, arrival: 0, finance: 0, admin: 0 };
    filteredNotifications.forEach((n) => {
      const k = classify(n);
      if (k !== 'all') c[k] += 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNotifications]);

  if (!isOpen) return null;

  const visibleList = filter === 'all' ? filteredNotifications : filteredNotifications.filter((n) => classify(n) === filter);
  const unreadList = visibleList.filter((n) => !n.read);
  const readList = visibleList.filter((n) => n.read);

  const handleActivateMobileNotifications = async () => {
    unlockMobileAudio();
    triggerMobileVibration([180, 70, 180]);
    playChimeSound(true);
    setRequestingPerm(true);
    const perm = await requestBrowserNotificationPermission();
    if (perm === 'granted') {
      await syncPushSubscription();
    }
    setRequestingPerm(false);
    sendTestNotification();
  };

  const handleTestBackgroundPush = async () => {
    unlockMobileAudio();
    triggerMobileVibration([150, 70, 150]);
    playChimeSound(true);
    setTestingPush(true);
    const ok = await sendBackgroundPushTest();
    setTestingPush(false);
    if (!ok) {
      sendTestNotification();
    }
  };

  const isGranted = browserNotificationPermission === 'granted';
  const isDenied = browserNotificationPermission === 'denied';

  const iconFor = (n: (typeof filteredNotifications)[number]): { icon: Ico; tone: Tone } => {
    const txt = `${n.title} ${n.description}`;
    if (n.type === 'broadcast') return { icon: n.priority === 'urgent' ? AlertTriangle : Megaphone, tone: n.priority === 'urgent' ? 'garn' : 'amy' };
    if (/لم يصل|تأخر/.test(txt)) return { icon: Clock, tone: 'sand' };
    if (n.type === 'deposit_request') return { icon: Wallet, tone: 'sand' };
    if (n.type === 'commission') return { icon: Wallet, tone: 'saph' };
    if (n.type === 'insurance') return { icon: ShieldCheck, tone: 'saph' };
    if (n.type === 'permission') return { icon: KeyRound, tone: 'ch' };
    if (n.type === 'checkout') return { icon: LogOut, tone: 'garn' };
    if (/وصل|حضور/.test(txt)) return { icon: DoorOpen, tone: 'jade' };
    if (n.type === 'booking' || n.type === 'deposit_confirmed') return { icon: Check, tone: 'jade' };
    return { icon: Bell, tone: 'amy' };
  };

  const FILTERS: Array<[Filter, string]> = [
    ['all', 'الكل'],
    ['arrival', 'الحركة'],
    ['finance', 'مالية'],
    ['admin', 'الإدارة'],
  ];

  const renderCard = (notif: (typeof filteredNotifications)[number]) => {
    const { icon, tone } = iconFor(notif);
    const urgent = notif.type === 'broadcast' && notif.priority === 'urgent';
    const showPay =
      notif.linkToBookingId &&
      (notif.title.includes('حضور') || notif.title.includes('وصل') || notif.description.includes('إكمال المتبقي والتأمين'));
    const isRead = Boolean(notif.read);
    const needsAck = Boolean(notif.broadcastId && notif.requiresAcknowledgment && !notif.read);
    const audienceTag =
      notif.targetAudience === 'admin_and_guard'
        ? 'للحارس والإدارة'
        : notif.targetAudience === 'admin_only'
        ? 'للإدارة فقط'
        : '';
    return (
      <article key={notif.id} className={`kt-bk ${isRead ? '' : 'kt-on'}`} style={urgent ? { boxShadow: 'inset 0 0 0 1.5px rgba(184,67,94,.6)' } : undefined}>
        <div className="kt-bk-h">
          <Tile icon={icon} tone={tone} size={40} />
          <span className="kt-row-t">
            <span className="kt-row-n">{stripEmoji(notif.title)}</span>
            <span className="kt-row-s">{latin(notif.timestamp)}</span>
          </span>
          {urgent ? <Tag tone="garn">عاجل</Tag> : !isRead ? <Tag tone="jade">جديد</Tag> : null}
        </div>

        <p className="text-[13.5px] leading-[1.75]" style={{ color: '#3b3150' }}>
          {stripEmoji(notif.description)}
        </p>

        {(notif.groupName || audienceTag) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {notif.groupName && <Tag tone="amy">لـ: {notif.groupName}</Tag>}
            {audienceTag && <Tag tone={notif.targetAudience === 'admin_only' ? 'sand' : 'amy'}>{audienceTag}</Tag>}
          </div>
        )}

        {needsAck && <Act tone="jade" icon={Check} label="تأكيد الاطلاع" onClick={() => acknowledgeBroadcast(notif.broadcastId!)} />}

        {showPay &&
          (preparedWhatsappUrl?.notifId === notif.id ? (
            <Act tone="jade" icon={Send} label="فتح واتساب" href={preparedWhatsappUrl.url} onClick={() => onClose()} title="فتح واتساب وإرسال الرسالة" />
          ) : (
            <Act
              tone="ink"
              icon={MessageCircle}
              label="رسالة المتبقي"
              title="تجهيز رسالة إكمال المتبقي والتأمين"
              onClick={() => {
                const res = sendPaymentCompletionRequest(notif.linkToBookingId!);
                if (res.whatsappUrl) {
                  setPreparedWhatsappUrl({ notifId: notif.id, url: res.whatsappUrl });
                }
              }}
            />
          ))}
      </article>
    );
  };

  const guardPlaces =
    guardPropertyIds.length > 0
      ? guardPropertyIds.map((pid) => properties.find((p) => p.id === pid)?.name || pid).join('، ')
      : guard.assignedPropertyName || 'الترف';

  return (
    <Sheet title="التنبيهات" icon={Bell} tone="ch" onClose={onClose}>
      {/* تصفية متساوية */}
      <Chips fill={4}>
        {FILTERS.map(([key, label]) => (
          <Chip key={key} label={label} on={filter === key} onClick={() => setFilter(key)} count={counts[key] > 0 ? counts[key] : undefined} />
        ))}
      </Chips>

      {/* تفعيل إشعارات الجوال */}
      {!isGranted ? (
        isDenied ? (
          <div className="kt-err" role="alert" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span className="flex items-center gap-2">
              <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
              <span>الإشعارات محظورة على هذا الجهاز</span>
            </span>
            <span className="text-[13px] font-semibold leading-6">
              افتح إعدادات الجوال ← التطبيقات ← <bdi>AMASA RESORT</bdi> ← الإشعارات ← فعّلها، ثم أعد فتح التطبيق.
            </span>
          </div>
        ) : (
          <div className="kt-sub">
            <Row icon={BellRing} tone="amy" title="إشعارات الجوال" sub="تصلك حتى والتطبيق مغلق" />
            <Act
              tone="gold"
              icon={Bell}
              label={requestingPerm ? 'جاري التفعيل…' : 'تفعيل الإشعارات'}
              title="تفعيل الإشعارات على الجوال"
              disabled={requestingPerm}
              onClick={handleActivateMobileNotifications}
            />
          </div>
        )
      ) : (
        <div className="kt-sub">
          <Row icon={BellRing} tone="jade" title="الإشعارات مفعّلة" sub={isPushSubscribed ? 'تعمل مع إغلاق التطبيق' : 'تعمل داخل التطبيق'} />
          <Acts cols={isPushSubscribed ? 3 : 2}>
            <Act stack tone={isSoundEnabled ? 'soft' : 'line'} icon={isSoundEnabled ? Volume2 : VolumeX} label={isSoundEnabled ? 'الصوت' : 'صامت'} title={isSoundEnabled ? 'الصوت مفعّل' : 'الصوت مكتوم'} onClick={toggleSound} />
            <Act stack tone="soft" icon={Bell} label="تجربة" onClick={handleActivateMobileNotifications} />
            {isPushSubscribed && (
              <Act stack tone="soft" icon={Send} label={testingPush ? 'جاري…' : 'فحص الخلفية'} disabled={testingPush} onClick={handleTestBackgroundPush} />
            )}
          </Acts>
        </div>
      )}

      {isAdmin && (
        <Act
          tone="ink"
          icon={Megaphone}
          label="تعميم للفرق"
          title="تعميم وقرار إداري للفرق"
          onClick={() => {
            onClose();
            setAdminBroadcastModalOpen(true);
          }}
        />
      )}

      {isGuard && <Row icon={ShieldCheck} tone="sand" title={`حارس: ${guardPlaces}`} sub="تظهر لك إشعارات عقاراتك فقط" />}

      {visibleList.length === 0 ? (
        <EmptyBox icon={Gem} text="لا توجد تنبيهات هنا حالياً" />
      ) : (
        <>
          {unreadList.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="تنبيهات جديدة">
              <Head
                title="جديدة"
                icon={BellRing}
                tone="garn"
                count={unreadList.length}
                action={<Act small tone="line" label="قراءة الكل" onClick={markNotificationsAsRead} className="!w-auto px-4" />}
              />
              {unreadList.map((n) => renderCard(n))}
            </section>
          )}
          {readList.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="تنبيهات مقروءة">
              <Head title="سبق قراءتها" icon={Check} tone="gray" count={readList.length} />
              {readList.map((n) => renderCard(n))}
            </section>
          )}
        </>
      )}
    </Sheet>
  );
};
