import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Smartphone, Database, Layers, Sparkles, Link as LinkIcon, Unlink, LogOut, Users } from 'lucide-react';
import {
  initGoogleAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  User,
} from '../../services/googleAuth';
import {
  createAppSheetSpreadsheet,
  syncAllDataToSheet,
  getSavedSpreadsheetInfo,
  saveSpreadsheetInfo,
  disconnectSpreadsheet,
  setAutoSyncPreference,
  fetchBookingsFromSheet,
  AppSheetSyncStatus,
} from '../../services/googleSheetsService';
import { useApp } from '../../context/AppContext';
import { Sheet, Seg, Field, Head, Row, Acts, Act, Acc, Tag, Tile, Face, Stats, Stat, Switch } from '../ui/kit';
import { fmtN } from '../../lib/format';

interface GoogleAppSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAppSheetModal: React.FC<GoogleAppSheetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { bookings, properties, marketers } = useApp();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [syncStatus, setSyncStatus] = useState<AppSheetSyncStatus>(getSavedSpreadsheetInfo());
  const [activeTab, setActiveTab] = useState<'sync' | 'guide' | 'schema'>('sync');

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [manualSheetInput, setManualSheetInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState<number | null>(0);

  // Initialize Auth listener
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser(user);
        setHasToken(Boolean(token));
      },
      () => {
        setCurrentUser(null);
        setHasToken(false);
      }
    );

    // Refresh sync status
    setSyncStatus(getSavedSpreadsheetInfo());

    // Check if we already have an active access token in memory
    getAccessToken().then((token) => {
      if (token) setHasToken(true);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Google Login
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setHasToken(true);
        setStatusMessage({
          type: 'success',
          text: `تم تسجيل الدخول بنجاح بحساب Google (${res.user.email})`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'تعذر تسجيل الدخول بحساب Google. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign Out
  const handleGoogleSignOut = async () => {
    try {
      await googleLogout();
      setCurrentUser(null);
      setHasToken(false);
      setStatusMessage({
        type: 'info',
        text: 'تم تسجيل الخروج من حساب Google.',
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Create new AppSheet spreadsheet
  const handleCreateSpreadsheet = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);
      const result = await createAppSheetSpreadsheet(
        'AMASA - نموذج الحجوزات و Google AppSheet'
      );

      // Now sync existing data right away
      await syncAllDataToSheet(result.spreadsheetId, bookings, properties, marketers);

      setSyncStatus(getSavedSpreadsheetInfo());
      setStatusMessage({
        type: 'success',
        text: 'تم إنشاء جدول AppSheet في حسابك بنجاح ومزامنة جميع الحجوزات الحالية!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء إنشاء الجدول في Google Drive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Sync data to existing sheet
  const handleSyncData = async () => {
    if (!syncStatus.spreadsheetId) return;
    try {
      setLoading(true);
      setStatusMessage(null);
      const result = await syncAllDataToSheet(
        syncStatus.spreadsheetId,
        bookings,
        properties,
        marketers
      );
      setSyncStatus(getSavedSpreadsheetInfo());
      setStatusMessage({
        type: 'success',
        text: `تمت مزامنة (${result.count}) حجز وكافة السجلات مع جدول Google بنجاح!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'فشلت المزامنة. يرجى التأكد من صلاحيات الوصول.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Test pull from sheet
  const handlePullData = async () => {
    if (!syncStatus.spreadsheetId) return;
    try {
      setLoading(true);
      setStatusMessage(null);
      const rows = await fetchBookingsFromSheet(syncStatus.spreadsheetId);
      setStatusMessage({
        type: 'success',
        text: `تم فحص الجدول بنجاح: تم العثور على (${rows.length}) صف مسجل في Google Sheets.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'فشل فحص بيانات الجدول.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Connect existing sheet
  const handleConnectManual = () => {
    if (!manualSheetInput.trim()) return;
    let sheetId = manualSheetInput.trim();
    // Check if user pasted full URL
    const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sheetId = match[1];
    }

    saveSpreadsheetInfo(sheetId, 'جدول Google Sheets مربوط يدوياً');
    setSyncStatus(getSavedSpreadsheetInfo());
    setShowManualInput(false);
    setManualSheetInput('');
    setStatusMessage({
      type: 'success',
      text: 'تم ربط جدول البيانات بنجاح! يمكنك الآن بدء المزامنة.',
    });
  };

  // Disconnect sheet
  const handleDisconnect = () => {
    disconnectSpreadsheet();
    setSyncStatus(getSavedSpreadsheetInfo());
    setConfirmDisconnect(false);
    setStatusMessage({
      type: 'info',
      text: 'تم فك ارتباط الجدول.',
    });
  };

  // Toggle Auto Sync
  const handleToggleAutoSync = () => {
    const nextVal = !syncStatus.autoSync;
    setAutoSyncPreference(nextVal);
    setSyncStatus((prev) => ({ ...prev, autoSync: nextVal }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const SCHEMA = [
    {
      title: 'الحجوزات',
      sheet: 'Bookings',
      cols: '29 عمود',
      text: 'رقم الحجز (Key) · اسم العميل · الجوال · الهوية الوطنية · العقار · القسم · تاريخ الدخول · تاريخ الخروج · عدد الليالي · سعر الليلة · الإجمالي · العربون المدفوع · المتبقي · التأمين · المسوق · عمولة المسوق · حالة الحجز · وصول النزيل · مغادرة النزيل · إيصال العربون · إيصال المتبقي · إيصال التأمين · إيصال استرداد التأمين · حالة الإيصالات.',
    },
    {
      title: 'حركات الدخول والخروج',
      sheet: 'CheckInOut',
      cols: '15 عمود',
      text: 'تاريخ الحركة · رقم الحجز · اسم النزيل · رقم الجوال · العقار · وصول النزيل · وقت الوصول · استلام التأمين نقداً · مغادرة النزيل · وقت المغادرة · إرجاع التأمين.',
    },
    {
      title: 'العقارات والوحدات',
      sheet: 'Properties',
      cols: '11 عمود',
      text: 'كود العقار · اسم العقار · الموقع · سعر وسط الأسبوع · سعر نهاية الأسبوع · عدد الوحدات · السعة · الغرف · الحمامات · الآيبان.',
    },
    {
      title: 'المسوقون والعمولات',
      sheet: 'Marketers',
      cols: '8 أعمدة',
      text: 'كود المسوق · اسم المسوق · رقم الجوال · البريد · نسبة العمولة (5%) · رقم الحساب البنكي · اسم البنك · حالة العقد.',
    },
  ];

  const GoogleG = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );

  const signedIn = !!currentUser && hasToken;

  return (
    <Sheet
      wide
      lockBackdrop
      title="ربط Google"
      icon={FileSpreadsheet}
      tone="jade"
      onClose={onClose}
      footer={<Act tone="line" icon={X} label="إغلاق" onClick={onClose} />}
    >
      <Seg
        label="أقسام الربط"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'sync', label: 'المزامنة', icon: Database },
          { id: 'guide', label: 'الدليل', icon: Smartphone },
          { id: 'schema', label: 'الجداول', icon: Layers },
        ]}
      />

      {statusMessage &&
        (statusMessage.type === 'error' ? (
          <div className="kt-err" role="alert">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{statusMessage.text}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
              ✕
            </button>
          </div>
        ) : statusMessage.type === 'success' ? (
          <div className="kt-ok" role="status">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
              <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{statusMessage.text}</span>
              <button type="button" onClick={() => setStatusMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="kt-note flex items-center gap-2" role="status">
            <span className="flex-1 min-w-0">{statusMessage.text}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
              ✕
            </button>
          </div>
        ))}

      {activeTab === 'sync' && (
        <>
          {/* حساب Google */}
          <Head title="حساب Google" icon={Users} />
          <div className="kt-bk">
            <div className="kt-bk-h">
              {currentUser ? (
                <Face src={currentUser.photoURL || undefined} name={currentUser.displayName || currentUser.email || 'G'} size={44} />
              ) : (
                <Tile icon={Users} tone="gray" size={44} />
              )}
              <span className="kt-row-t">
                <span className="kt-row-n">{currentUser ? currentUser.displayName || 'مستخدم Google' : 'غير مسجّل الدخول'}</span>
                <span className="kt-row-s" dir="ltr" style={{ textAlign: 'right' }}>
                  {currentUser ? currentUser.email : 'سجّل الدخول لربط الجداول'}
                </span>
              </span>
              {signedIn && <Tag tone="jade">نشط</Tag>}
            </div>
            {signedIn ? (
              <Act tone="line" icon={LogOut} label="تسجيل الخروج" onClick={handleGoogleSignOut} />
            ) : (
              <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="kt-act lx-press kt-t-line">
                <GoogleG />
                <span>{loading ? 'جارٍ الدخول…' : 'الدخول عبر Google'}</span>
              </button>
            )}
          </div>

          {/* الجدول */}
          {syncStatus.connected && syncStatus.spreadsheetId ? (
            <>
              <Head title="الجدول المربوط" icon={FileSpreadsheet} tone="jade" />
              <Row
                icon={FileSpreadsheet}
                tone="jade"
                title={syncStatus.spreadsheetName || 'جدول Google'}
                sub={`ID: ${syncStatus.spreadsheetId.slice(0, 14)}…\u200E`}
                end={<Tag tone="jade">متصل</Tag>}
              />
              <Acts cols={2}>
                <Act tone="jadeS" icon={FileSpreadsheet} label="فتح Sheets" title="فتح في Google Sheets" href={syncStatus.spreadsheetUrl!} />
                <Act tone="soft" icon={Smartphone} label="فتح AppSheet" title="فتح في AppSheet" href="https://www.appsheet.com/Template/App/new?source=sheets" />
              </Acts>
              <Acts cols={2}>
                <Act
                  tone="ink"
                  icon={RefreshCw}
                  label="مزامنة الآن"
                  title={`مزامنة كافة الحجوزات والسجلات الآن (${bookings.length} حجز)`}
                  disabled={loading || !hasToken}
                  onClick={handleSyncData}
                />
                <Act
                  tone="soft"
                  icon={Database}
                  label="فحص الجدول"
                  title="فحص وتحديث السجلات من Google Sheets"
                  disabled={loading || !hasToken}
                  onClick={handlePullData}
                />
              </Acts>
              <div className="kt-opt">
                <span>مزامنة تلقائية عند أي تعديل</span>
                <Switch on={!!syncStatus.autoSync} onChange={() => handleToggleAutoSync()} label="مزامنة تلقائية عند إنشاء أو تعديل أي حجز" />
              </div>
              {confirmDisconnect ? (
                <div className="kt-warn p-3 space-y-3">
                  <p className="text-[13.5px] font-bold leading-6" style={{ color: '#7A4A06' }}>
                    تأكيد قطع الاتصال بالجدول؟
                  </p>
                  <Acts cols={2}>
                    <Act small tone="garnet" icon={Unlink} label="نعم، اقطع" onClick={handleDisconnect} />
                    <Act small tone="line" label="إلغاء" onClick={() => setConfirmDisconnect(false)} />
                  </Acts>
                </div>
              ) : (
                <Act tone="garnS" icon={Unlink} label="قطع الاتصال بالجدول" onClick={() => setConfirmDisconnect(true)} />
              )}
            </>
          ) : (
            <>
              <Head title="الجدول" icon={FileSpreadsheet} tone="jade" />
              <Row icon={FileSpreadsheet} tone="gray" title="لا يوجد جدول مربوط" sub="أنشئ جدولاً جديداً أو اربط جدولاً موجوداً" />
              <Acts cols={2}>
                <Act
                  tone="ink"
                  icon={Sparkles}
                  label="إنشاء جدول جديد"
                  title="إنشاء نموذج AppSheet في Google Drive فوراً"
                  disabled={loading || !hasToken}
                  onClick={handleCreateSpreadsheet}
                />
                <Act tone="soft" icon={LinkIcon} label="ربط جدول حالي" title="ربط جدول حالي برابطه أو معرّفه" onClick={() => setShowManualInput(!showManualInput)} />
              </Acts>
              {!hasToken && <p className="kt-note">سجّل الدخول عبر Google أعلاه أولاً لمنح التطبيق صلاحية Drive.</p>}
            </>
          )}

          {showManualInput && (
            <>
              <Field label="رابط الجدول أو معرّفه">
                <input
                  type="text"
                  placeholder="الصق رابط Google Sheet أو المعرّف"
                  value={manualSheetInput}
                  onChange={(e) => setManualSheetInput(e.target.value)}
                  className="kt-input"
                  dir="ltr"
                />
              </Field>
              <Act tone="jade" icon={LinkIcon} label="ربط الجدول" onClick={handleConnectManual} />
            </>
          )}

          <Head title="ما سيُزامَن" icon={Layers} tone="sand" />
          <Stats cols={2} compact>
            <Stat label="الحجوزات" value={fmtN(bookings.length)} />
            <Stat label="حركات اليوم" value={fmtN(bookings.filter((b: any) => b.guestArrived || b.checkedOut).length)} />
            <Stat label="العقارات" value={fmtN(properties.length)} />
            <Stat label="المسوقون" value={fmtN(marketers.length)} />
          </Stats>
          <p className="kt-note">بياناتك محمية عبر تصريحات Google Workspace الرسمية.</p>
        </>
      )}

      {activeTab === 'guide' && (
        <>
          <p className="kt-note">يحوّل AppSheet جدول Google إلى تطبيق جوال بنماذج إدخال وأزرار اتصال وحفظ مباشر.</p>
          <Head title="4 خطوات" icon={Smartphone} />
          <Row icon={FileSpreadsheet} tone="jade" title="أنشئ الجدول" sub="من المزامنة ← إنشاء جدول جديد" end={<Tag tone="gray" mono>1</Tag>} />
          <Row icon={ExternalLink} tone="saph" title="افتح AppSheet" sub="appsheet.com ← Create ← App" end={<Tag tone="gray" mono>2</Tag>} />
          <Row icon={Database} tone="amy" title="اختر الملف" sub="Start with existing data ← ملف AMASA" end={<Tag tone="gray" mono>3</Tag>} />
          <Row icon={Smartphone} tone="ch" title="شارك التطبيق" sub="الحارس والمسوقون — تزامن فوري" end={<Tag tone="gray" mono>4</Tag>} />
          <Act tone="ink" icon={Smartphone} label="فتح معالج AppSheet" href="https://www.appsheet.com/Template/App/new?source=sheets" />
        </>
      )}

      {activeTab === 'schema' && (
        <>
          <Head title="جداول AppSheet" icon={Layers} count={SCHEMA.length} />
          {SCHEMA.map((s, i) => (
            <Acc
              key={s.sheet}
              icon={<Database size={18} strokeWidth={1.8} />}
              title={s.title}
              tag={s.cols}
              open={schemaOpen === i}
              onToggle={() => setSchemaOpen(schemaOpen === i ? null : i)}
            >
              <p className="kt-sub-t" dir="ltr" style={{ textAlign: 'right' }}>
                {s.sheet}
              </p>
              <p className="kt-note mt-2">{s.text}</p>
            </Acc>
          ))}
        </>
      )}
    </Sheet>
  );
};
