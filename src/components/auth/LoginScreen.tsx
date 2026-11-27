import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useApp } from '../../context/AppContext';
import { googleLogout, googleSignIn } from '../../services/googleAuth';
import { auth, testFirestoreConnection } from '../../firebase';
import { STORAGE_KEYS } from '../../lib/storage';
import loginBgUrl from '../../assets/images/login-bg.jpg';
import { BrandMark, C } from '../ui/lux';
import { Act, Acts, Check, Row, type Ico } from '../ui/kit';

/** شعار Google الرسمي */
const GoogleG: Ico = ({ size = 24, className }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

interface LoginScreenProps {
  onAuthed: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthed }) => {
  const { loginWithGoogleAuth, refreshFromServer, syncStatus } = useApp();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRefreshingServer, setIsRefreshingServer] = useState(false);
  const [resumableEmail, setResumableEmail] = useState<string | null>(null);
  const [showPopupBlankHint, setShowPopupBlankHint] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    description: string;
    showBlankPopupTip?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isGoogleLoading) {
      setShowPopupBlankHint(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowPopupBlankHint(true);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [isGoogleLoading]);

  useEffect(() => {
    let explicitLogout = false;
    try {
      explicitLogout = localStorage.getItem(STORAGE_KEYS.AUTH) === '0';
    } catch {}
    if (explicitLogout) {
      setResumableEmail(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.email && fbUser.emailVerified) {
        setResumableEmail(fbUser.email.trim().toLowerCase());
      } else {
        setResumableEmail(null);
      }
    });
    return () => unsub();
  }, []);

  const handleResetLocalSwCache = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
      if ('caches' in window && caches.keys) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
      }
    } catch {}
    window.location.reload();
  };

  const handleResumeSession = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      setResumableEmail(null);
      return;
    }
    setFeedback(null);
    setIsGoogleLoading(true);
    try {
      const authRes = await loginWithGoogleAuth(
        fbUser.email,
        fbUser.displayName || undefined,
        fbUser.photoURL || undefined
      );
      if (authRes.success) {
        setFeedback({
          type: 'success',
          title: 'تم تسجيل الدخول',
          description: authRes.message,
        });
        onAuthed();
      } else {
        await googleLogout();
        setResumableEmail(null);
        setFeedback({
          type: 'error',
          title: 'الدخول غير مصرح به',
          description: authRes.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'تعذر متابعة الجلسة',
        description: err?.message || 'سجّل الدخول مرة أخرى بحساب Google',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleOfficialGoogleLogin = async () => {
    setFeedback(null);
    setShowPopupBlankHint(false);
    setIsGoogleLoading(true);

    try {
      // 1. Official Google Sign-In popup (Firebase GoogleAuthProvider)
      const googleRes = await googleSignIn();
      if (!googleRes?.user?.email) {
        throw new Error('لم يصل البريد من حساب Google');
      }

      // 2. Verify authenticated Google email against Firebase authorized accounts
      const authRes = await loginWithGoogleAuth(
        googleRes.user.email,
        googleRes.user.displayName || undefined,
        googleRes.user.photoURL || undefined
      );

      if (authRes.success) {
        setFeedback({
          type: 'success',
          title: 'تم تسجيل الدخول',
          description: authRes.message,
        });
        onAuthed();
      } else {
        await googleLogout();
        setResumableEmail(null);
        setFeedback({
          type: 'error',
          title: 'الدخول غير مصرح به',
          description: authRes.message,
        });
      }
    } catch (err: any) {
      console.error('Google Auth Failed:', err);
      const code = String(err?.code || '');
      const isPopupStalledOrClosed =
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/internal-error';

      setFeedback({
        type: 'error',
        title: 'فشل في تسجيل الدخول',
        description: err?.message || 'تعذر الدخول بحساب Google، حاول مرة أخرى',
        showBlankPopupTip: isPopupStalledOrClosed,
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const syncState: 'ok' | 'wait' | 'err' | 'idle' =
    syncStatus === 'connected' ? 'ok' : syncStatus === 'syncing' ? 'wait' : syncStatus === 'error' ? 'err' : 'idle';
  const syncLabel =
    syncStatus === 'connected'
      ? 'متصل'
      : syncStatus === 'syncing'
      ? 'جاري الحفظ'
      : syncStatus === 'error'
      ? 'تعذر الحفظ'
      : 'جاهز';

  const handleRefreshPermissions = async () => {
    setIsRefreshingServer(true);
    setFeedback(null);
    try {
      if (auth.currentUser) {
        const ok = await refreshFromServer();
        setFeedback(
          ok
            ? { type: 'success', title: 'تم تحديث الصلاحيات', description: 'تم تحديث الحساب والصلاحيات' }
            : { type: 'warning', title: 'تعذر التحديث الآن', description: 'تحقق من الاتصال ثم أعد المحاولة' }
        );
      } else {
        const online = await testFirestoreConnection();
        setFeedback(
          online
            ? { type: 'success', title: 'Firebase جاهز', description: 'اضغط «الدخول بحساب Google» للمتابعة' }
            : { type: 'warning', title: 'الخادم غير متصل', description: 'تعذر الوصول إلى Firebase، تحقق من الاتصال' }
        );
      }
    } finally {
      setIsRefreshingServer(false);
    }
  };

  const tone = {
    success: { fg: '#0E5A49', cls: 'kt-ok' },
    warning: { fg: '#7A4A06', cls: 'kt-warn' },
    error: { fg: '#8A1F3B', cls: 'kt-err' },
  } as const;

  return (
    <div
      className="relative min-h-[100dvh] bg-[#130A24] overflow-hidden flex items-center justify-center p-4 font-['Tajawal',sans-serif]"
      dir="rtl"
    >
      {/* صورة الخلفية (محفوظة مسبقاً للتشغيل دون اتصال) */}
      <img
        src={loginBgUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(19,10,36,.52) 0%, rgba(27,14,51,.78) 52%, rgba(19,10,36,.94) 100%)' }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-6 py-4">
        {/* الهوية */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size={76} />
          <div className="leading-none" dir="ltr">
            <div className="text-[28px] font-bold tracking-[.2em]" style={{ color: C.snow }}>
              AMASA
            </div>
            <div className="text-[13px] font-semibold tracking-[.55em] mt-2.5" style={{ color: C.chl }}>
              RESORT
            </div>
          </div>
          <p className="text-[14.5px]" style={{ color: C.dim }}>
            إدارة الاستراحات والحجوزات
          </p>
        </div>

        {/* البطاقة */}
        <div
          className="rounded-[30px] p-5 flex flex-col gap-3.5"
          style={{ background: C.pearl, boxShadow: '0 30px 60px -22px rgba(0,0,0,.65), inset 0 0 0 1px rgba(201,164,92,.4)' }}
        >
          <Row icon={ShieldCheck} tone="jade" title="الدخول عبر Google" sub="للحسابات المضافة مسبقاً فقط" />

          {/* رسائل النتيجة */}
          {feedback && (
            <div
              role="status"
              className={`${tone[feedback.type].cls} animate-in fade-in duration-200`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 14 }}
            >
              <span className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: tone[feedback.type].fg }}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
                ) : (
                  <ShieldAlert size={20} strokeWidth={1.8} className="shrink-0" />
                )}
                <span>{feedback.title}</span>
              </span>
              <p className="text-[13.5px] leading-6 font-semibold" style={{ color: tone[feedback.type].fg }}>
                {feedback.description}
              </p>
              {feedback.showBlankPopupTip && (
                <>
                  <p className="text-[13px] leading-6 font-semibold" style={{ color: C.txt }}>
                    ظهرت نافذة التوثيق بيضاء؟ امسح بيانات الموقع أو جرّب التصفح المتخفي ثم أعد المحاولة.
                  </p>
                  <Act
                    tone="soft"
                    icon={RefreshCw}
                    label="تنظيف الذاكرة"
                    title="تنظيف ذاكرة التطبيق وإعادة التحميل"
                    onClick={() => void handleResetLocalSwCache()}
                  />
                </>
              )}
            </div>
          )}

          {/* أزرار الدخول */}
          {resumableEmail && (
            <div className="kt-sub">
              <Row icon={CheckCircle2} tone="amy" title="جلسة سابقة" sub={resumableEmail} />
              <Act
                tone="ink"
                icon={isGoogleLoading ? Loader2 : CheckCircle2}
                label="متابعة الجلسة"
                title={`المتابعة بالحساب ${resumableEmail}`}
                disabled={isGoogleLoading}
                onClick={handleResumeSession}
              />
            </div>
          )}

          <Acts cols={1}>
            <Act
              tone="white"
              icon={isGoogleLoading ? Loader2 : GoogleG}
              label={isGoogleLoading ? 'جاري التحقق…' : 'الدخول بحساب Google'}
              title="تسجيل الدخول باستخدام Google"
              disabled={isGoogleLoading}
              onClick={handleOfficialGoogleLogin}
            />
          </Acts>

          {isGoogleLoading && showPopupBlankHint && (
            <p className="kt-warn text-[13px] leading-6 font-semibold p-3" style={{ color: '#7A4A06' }}>
              ظهرت نافذة بيضاء؟ أغلقها وجرّب التصفح المتخفي أو امسح بيانات الموقع.
            </p>
          )}

          {/* الصلاحيات والمزامنة */}
          <Acts cols={1}>
            <Act
              tone="soft"
              icon={RefreshCw}
              label={isRefreshingServer ? 'جاري التحديث…' : 'تحديث الصلاحيات'}
              disabled={isRefreshingServer}
              onClick={() => void handleRefreshPermissions()}
            />
          </Acts>
          <Check label="مزامنة Firebase" value={syncLabel} state={syncState} />
        </div>

        <p dir="ltr" className="text-center text-[13px] leading-relaxed" style={{ color: 'rgba(191,178,220,.8)' }}>
          © {new Date().getFullYear()} AMASA RESORT
        </p>
      </div>
    </div>
  );
};
