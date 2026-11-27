import React, { useState, useMemo } from 'react';
import {
  Clock,
  Send,
  Eye,
  Paperclip,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  AlertCircle,
  BarChart3,
  History,
  Banknote,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Booking, CommissionRequest } from '../../types';
import { PrintableContractModal } from '../modals/PrintableContractModal';
import { Head, Tag, Acts, Act, Infos, Info, Field, Sheet } from '../ui/kit';
import type { Tone } from '../ui/kit';

const fmt = (n: number | undefined) => (n || 0).toLocaleString('en-US');

export const CommissionRequestsSection: React.FC = () => {
  const {
    isAdmin,
    isGuard,
    canViewMarketers,
    currentMarketer,
    currentMarketerId,
    bookings,
    commissionRequests,
    getEligibleCommissionBookings,
    createCommissionRequest,
    markCommissionTransferred,
    rejectCommissionRequest,
    markCommissionRequestSeen,
  } = useApp();

  const hasAdminPayoutAccess = isAdmin || canViewMarketers;

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstDayOfMonth = () => getTodayStr().slice(0, 8) + '01';

  const [fromDate, setFromDate] = useState(getFirstDayOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Receipt & Contract preview modals
  const [viewReceiptModal, setViewReceiptModal] = useState<CommissionRequest | null>(null);
  const [viewContractModal, setViewContractModal] = useState<Booking | null>(null);

  // Admin approval forms
  const [receiptFiles, setReceiptFiles] = useState<Record<string, { name: string; dataUrl?: string }>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const STATUS_META: Record<CommissionRequest['status'], { text: string; tone: Tone }> = {
    pending: { text: 'قيد التدقيق', tone: 'sand' },
    transferred: { text: 'تم التحويل', tone: 'jade' },
    rejected: { text: 'مرفوض', tone: 'garn' },
  };

  const eligibleBookings = useMemo(() => {
    if (isAdmin || isGuard) return [];
    return getEligibleCommissionBookings(currentMarketerId, fromDate, toDate);
  }, [isAdmin, isGuard, getEligibleCommissionBookings, currentMarketerId, fromDate, toDate]);

  const totalEligibleCommission = eligibleBookings.reduce(
    (sum, b) => sum + (b.marketerCommission || 0),
    0
  );

  const isBookingCompletedOrPast = (b: Booking) =>
    Boolean(b.checkedOut || b.cleanlinessApproved || b.status === 'completed');

  const periodBookings = useMemo(() => {
    if (isAdmin || isGuard) return [];
    return bookings
      .filter(
        (b) =>
          b.marketerId === currentMarketerId &&
          b.status !== 'cancelled' &&
          b.checkInDate >= fromDate &&
          b.checkInDate <= toDate
      )
      .sort((a, b) => (a.checkInDate < b.checkInDate ? 1 : -1));
  }, [isAdmin, isGuard, bookings, currentMarketerId, fromDate, toDate]);

  const completedInPeriod = periodBookings.filter(isBookingCompletedOrPast);
  const completedSalesTotal = completedInPeriod.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const eligibleSalesTotal = eligibleBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  const effectiveRate =
    eligibleSalesTotal > 0
      ? Math.round((totalEligibleCommission / eligibleSalesTotal) * 1000) / 10
      : 0;

  const fullCommissionsCount = eligibleBookings.filter(
    (b) => (b.commissionRatePercent || 5) === 7
  ).length;
  const partialCommissionsCount = eligibleBookings.length - fullCommissionsCount;

  const completionPercent =
    periodBookings.length > 0
      ? Math.round((completedInPeriod.length / periodBookings.length) * 100)
      : 0;

  const eligibleSet = new Set(eligibleBookings.map((b) => b.id));

  if (isGuard && !hasAdminPayoutAccess) return null;

  const myRequests = commissionRequests.filter((r) => r.marketerId === currentMarketerId);
  const pendingRequestsForAdmin = commissionRequests.filter((r) => r.status === 'pending');
  const pastRequestsForAdmin = commissionRequests.filter((r) => r.status !== 'pending').slice(0, 6);

  const handleSubmitRequest = () => {
    const res = createCommissionRequest({ fromDate, toDate });
    setStatusMessage({ ok: res.ok, text: res.message });
  };

  const handleFileUpload = (reqId: string, file?: File) => {
    setFileError(null);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setReceiptFiles((prev) => ({ ...prev, [reqId]: { name: file.name } }));
      setFileError('حجم الملف كبير، يرجى استخدام صورة أقل من 2MB لعرضها للموظف.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptFiles((prev) => ({
        ...prev,
        [reqId]: { name: file.name, dataUrl: String(reader.result) },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenReceipt = (req: CommissionRequest) => {
    setViewReceiptModal(req);
    if (!hasAdminPayoutAccess && !req.seenByMarketer) {
      markCommissionRequestSeen(req.id);
    }
  };

  const isImageReceipt = (url?: string) => !!url && url.startsWith('data:image');
  const isPdfReceipt = (url?: string) => !!url && url.startsWith('data:application/pdf');

  /** «من ← إلى»: التاريخان لاتينيان، وترتيبهما يتبع اتجاه القراءة العربي (من على اليمين) */
  const range = (from: string, to: string) => (
    <span className="inline-flex items-center gap-1.5 font-mono whitespace-nowrap">
      <span dir="ltr">{from}</span>
      <span aria-hidden="true">←</span>
      <span dir="ltr">{to}</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* ═════ المسوّق: نموذج الطلب ═════ */}
      {!isAdmin && !isGuard && (
        <>
          <section className="lux-card p-4 space-y-3.5">
            <Head title="طلب العمولة" icon={Banknote} tone="jade" />

            <div className="kt-fields">
              <Field label="من تاريخ">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="kt-input" />
              </Field>
              <Field label="إلى تاريخ">
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="kt-input" />
              </Field>
            </div>

            <Infos cols={2}>
              <Info label="حجوزات مستحقة" value={`${eligibleBookings.length} حجز`} />
              <Info hi label="إجمالي العمولة" value={`${fmt(totalEligibleCommission)} ر.س`} />
            </Infos>

            <Act
              tone="ink"
              icon={Send}
              label="إرسال الطلب للإدارة"
              disabled={eligibleBookings.length === 0 || !currentMarketer}
              onClick={handleSubmitRequest}
            />

            {statusMessage && (
              <div className={statusMessage.ok ? 'kt-ok' : 'kt-err'} role="status">
                {statusMessage.ok ? (
                  <span className="text-[14px] font-extrabold" style={{ color: '#0E5A49' }}>
                    {statusMessage.text}
                  </span>
                ) : (
                  <>
                    <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
                    <span className="flex-1 min-w-0">{statusMessage.text}</span>
                  </>
                )}
              </div>
            )}
          </section>

          {/* تحليل الفترة */}
          <section className="lux-card p-4 space-y-3.5">
            <Head title="تحليل الفترة" icon={BarChart3} tone="saph" />
            <Infos cols={2}>
              <Info label="عدد الحجوزات" value={periodBookings.length} />
              <Info label="المنجزة" value={`${completedInPeriod.length} (${completionPercent}%)`} />
              <Info label="قيمة المنجزة" value={`${fmt(completedSalesTotal)} ر.س`} />
              <Info hi label="نسبة العمولة الفعلية" value={`${effectiveRate}%`} />
            </Infos>
            <Infos cols={3}>
              <Info label="كلي 7%" value={fullCommissionsCount} />
              <Info label="جزئي 5%" value={partialCommissionsCount} />
              <Info label="ضمن الطلب" value={eligibleBookings.length} />
            </Infos>

            {periodBookings.length === 0 ? (
              <p className="kt-note text-center">لا توجد حجوزات لك في هذه الفترة.</p>
            ) : (
              <div className="kt-scroll space-y-2">
                {periodBookings.map((b, idx) => {
                  const rate = b.commissionRatePercent || 5;
                  const isDone = isBookingCompletedOrPast(b);
                  const isEligible = eligibleSet.has(b.id);
                  const stateTag: { text: string; tone: Tone } =
                    b.commissionStatus === 'paid'
                      ? { text: 'صُرفت', tone: 'gray' }
                      : isDone
                        ? { text: 'منجز', tone: 'jade' }
                        : { text: 'قادم', tone: 'sand' };
                  return (
                    <div key={`${b.id || 'comm'}-${idx}`} className="kt-bk">
                      <div className="kt-bk-h">
                        <span className="kt-row-n font-mono" dir="ltr" style={{ textAlign: 'right' }}>
                          {b.bookingNumber}
                        </span>
                        <Tag tone={stateTag.tone}>{stateTag.text}</Tag>
                        {isEligible && <Tag tone="amy">ضمن الطلب</Tag>}
                      </div>
                      <p className="kt-row-s">
                        {b.customerName} · {b.propertyName}
                      </p>
                      <p className="kt-row-s">{range(b.checkInDate, b.checkOutDate)}</p>
                      <Infos cols={3}>
                        <Info label="الإجمالي · ر.س" value={fmt(b.totalPrice)} />
                        <Info label="النسبة" value={`${rate}%`} />
                        <Info hi label="العمولة · ر.س" value={fmt(b.marketerCommission)} />
                      </Infos>
                      {isDone && (
                        <Act small tone="soft" icon={FileText} label="عرض العقد" className="kt-blk" onClick={() => setViewContractModal(b)} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* طلباتي السابقة */}
          <section className="lux-card p-4 space-y-3">
            <Head title="طلباتي السابقة" icon={History} tone="amy" count={myRequests.length} />
            {myRequests.length === 0 ? (
              <p className="kt-note text-center">لا توجد طلبات بعد.</p>
            ) : (
              myRequests.map((req) => (
                <div key={req.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <span className="kt-row-n">{range(req.fromDate, req.toDate)}</span>
                    <Tag tone={STATUS_META[req.status].tone}>{STATUS_META[req.status].text}</Tag>
                  </div>
                  <Infos cols={2}>
                    <Info label="عدد الحجوزات" value={req.bookingIds.length} />
                    <Info hi label="المبلغ" value={`${fmt(req.amount)} ر.س`} />
                  </Infos>
                  {req.status === 'transferred' && (
                    <Act
                      tone="ink"
                      icon={Eye}
                      label={req.seenByMarketer ? 'إيصال التحويل' : 'إيصال التحويل · جديد'}
                      onClick={() => handleOpenReceipt(req)}
                    />
                  )}
                  {req.status === 'rejected' && req.adminNote && (
                    <div className="kt-err">
                      <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
                      <span className="flex-1 min-w-0">{req.adminNote}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}

      {/* ═════ الإدارة: التدقيق والتحويل ═════ */}
      {hasAdminPayoutAccess && (
        <>
          <section className="lux-card p-4 space-y-3">
            <Head title="بانتظار التدقيق" icon={Clock} tone="sand" count={pendingRequestsForAdmin.length} />

            {pendingRequestsForAdmin.length === 0 && <p className="kt-note text-center">لا توجد طلبات معلقة حالياً.</p>}

            {pendingRequestsForAdmin.map((req) => (
              <div key={req.id} className="kt-bk">
                <div className="kt-bk-h">
                  <span className="kt-row-n">{req.marketerName}</span>
                  <Tag tone="gold">{fmt(req.amount)} ر.س</Tag>
                </div>
                <div className="kt-row-s flex items-center justify-between gap-2">
                  <span>{req.bookingIds.length} حجز</span>
                  {range(req.fromDate, req.toDate)}
                </div>

                <label className="kt-act kt-dash lx-press">
                  <Paperclip size={18} strokeWidth={1.8} />
                  <span>{receiptFiles[req.id]?.name || 'إرفاق إيصال التحويل'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(req.id, e.target.files?.[0])}
                  />
                </label>

                {fileError && (
                  <div className="kt-warn p-3 text-[13px] font-bold" style={{ color: '#7A4A00' }}>
                    {fileError}
                  </div>
                )}

                <input
                  type="text"
                  value={adminNotes[req.id] || ''}
                  onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  placeholder="ملاحظة عند الرفض"
                  className="kt-input"
                />

                <Acts cols={2}>
                  <Act
                    tone="jade"
                    icon={CheckCircle2}
                    label="تأكيد التحويل"
                    disabled={!receiptFiles[req.id]}
                    onClick={() =>
                      markCommissionTransferred(req.id, receiptFiles[req.id].name, receiptFiles[req.id].dataUrl)
                    }
                  />
                  <Act tone="garnS" icon={XCircle} label="رفض" onClick={() => rejectCommissionRequest(req.id, adminNotes[req.id])} />
                </Acts>
              </div>
            ))}
          </section>

          {pastRequestsForAdmin.length > 0 && (
            <section className="lux-card p-4 space-y-3">
              <Head title="آخر المعالجة" icon={History} tone="amy" count={pastRequestsForAdmin.length} />
              {pastRequestsForAdmin.map((req) => (
                <div key={req.id} className="kt-row">
                  <span className="kt-row-t">
                    <span className="kt-row-n">{req.marketerName}</span>
                    <span className="kt-row-s">{fmt(req.amount)} ر.س</span>
                  </span>
                  <Tag tone={STATUS_META[req.status].tone}>{STATUS_META[req.status].text}</Tag>
                  {req.status === 'transferred' && (
                    <button type="button" onClick={() => handleOpenReceipt(req)} aria-label={`عرض إيصال ${req.marketerName}`} title="عرض الإيصال" className="kt-ib lx-press">
                      <Eye size={18} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {/* عرض العقد */}
      {viewContractModal && (
        <PrintableContractModal booking={viewContractModal} onClose={() => setViewContractModal(null)} />
      )}

      {/* إيصال التحويل */}
      {viewReceiptModal && (
        <Sheet
          title="إيصال التحويل البنكي"
          icon={Paperclip}
          tone="jade"
          onClose={() => setViewReceiptModal(null)}
          footer={
            <Acts cols={1}>
              <Act tone="soft" label="إغلاق" onClick={() => setViewReceiptModal(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info hi label="المبلغ المحوّل" value={`${fmt(viewReceiptModal.amount)} ر.س`} />
            <Info label="تاريخ التحويل" value={viewReceiptModal.processedAt || '—'} ltr />
            <Info wide label="الفترة" value={range(viewReceiptModal.fromDate, viewReceiptModal.toDate)} />
          </Infos>

          {isImageReceipt(viewReceiptModal.receiptDataUrl) ? (
            <img src={viewReceiptModal.receiptDataUrl} alt="إيصال التحويل" className="w-full rounded-2xl" style={{ boxShadow: '0 0 0 1px rgba(27,14,51,.12)' }} />
          ) : isPdfReceipt(viewReceiptModal.receiptDataUrl) ? (
            <Act
              tone="ink"
              icon={Download}
              label="تنزيل الإيصال (PDF)"
              href={viewReceiptModal.receiptDataUrl}
              download={viewReceiptModal.receiptFileName || 'receipt.pdf'}
            />
          ) : (
            <div className="kt-row">
              <span className="kt-row-t">
                <span className="kt-row-n">{viewReceiptModal.receiptFileName || 'مرفق الإيصال'}</span>
                <span className="kt-row-s">لا توجد معاينة لهذا المرفق</span>
              </span>
              <FileText size={20} strokeWidth={1.8} color="#5B2EA6" />
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
};
