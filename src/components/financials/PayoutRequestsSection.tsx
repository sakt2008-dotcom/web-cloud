import React, { useState, useMemo } from 'react';
import { Send, Paperclip, CheckCircle2, XCircle, FileText, Download, AlertCircle, X, CreditCard, UploadCloud, Check, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Booking, CommissionRequest } from '../../types';
import { Head, Stats, Stat, Infos, Info, Acts, Act, Tag, Tile, Row, Field, Sheet } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';
import { fmtN, localTodayStr } from '../../lib/format';
import { SupervisorPayoutPanel } from './SupervisorPayoutPanel';
import { getSupervisorPayoutParts } from '../../lib/financials';

export const PayoutRequestsSection: React.FC = () => {
  const {
    isAdmin,
    isGuard,
    canViewMarketers,
    currentMarketer,
    currentMarketerId,
    bookings,
    properties,
    specialAdminFeeBoxes,
    commissionRequests,
    getEligibleCommissionBookings,
    createCommissionRequest,
    markCommissionTransferred,
    rejectCommissionRequest,
  } = useApp();

  const hasAdminPayoutAccess = isAdmin || canViewMarketers;

  const getTodayStr = () => localTodayStr();
  const getFirstDayOfMonth = () => getTodayStr().slice(0, 8) + '01';

  const [fromDate, setFromDate] = useState(getFirstDayOfMonth());
  const [toDate, setToDate] = useState(getTodayStr());
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Modals
  const [viewReceiptModal, setViewReceiptModal] = useState<CommissionRequest | null>(null);
  const [inspectBookingModal, setInspectBookingModal] = useState<Booking | null>(null);
  const [adminApprovalModal, setAdminApprovalModal] = useState<CommissionRequest | null>(null);
  const [approvalReceiptFile, setApprovalReceiptFile] = useState<{ name: string; dataUrl?: string } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [rejectModal, setRejectModal] = useState<CommissionRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Eligible bookings for marketer
  const eligibleBookings = useMemo(() => {
    if (isAdmin || isGuard) return [];
    return getEligibleCommissionBookings(currentMarketerId, fromDate, toDate);
  }, [isAdmin, isGuard, getEligibleCommissionBookings, currentMarketerId, fromDate, toDate]);

  const totalEligibleCommission = useMemo(() => {
    return eligibleBookings.reduce((sum, b) => sum + (b.marketerCommission || 0), 0);
  }, [eligibleBookings]);

  // Check if marketer already has an overlapping request (pending or transferred)
  const overlappingRequestForMarketer = useMemo(() => {
    if (isAdmin || isGuard) return null;
    return commissionRequests.find(
      (r) =>
        r.marketerId === currentMarketerId &&
        (r.status === 'pending' || r.status === 'transferred') &&
        fromDate <= r.toDate &&
        toDate >= r.fromDate
    );
  }, [commissionRequests, currentMarketerId, fromDate, toDate, isAdmin, isGuard]);

  // Handle Marketer Submission
  const handleSubmitRequest = () => {
    setStatusMessage(null);
    const res = createCommissionRequest({ fromDate, toDate });
    setStatusMessage({ ok: res.ok, text: res.message });
  };

  // Handle Receipt Upload in Admin Modal
  const handleReceiptFileChange = (file?: File) => {
    setApprovalError(null);
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setApprovalError('حجم الملف كبير، يرجى اختيار صورة أو مستند أقل من 4 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setApprovalReceiptFile({
        name: file.name,
        dataUrl: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle Admin Confirmation with Receipt
  const handleConfirmTransfer = () => {
    if (!adminApprovalModal) return;
    if (!approvalReceiptFile?.dataUrl) {
      setApprovalError('يرجى إرفاق صورة إيصال التحويل البنكي لإتمام الاعتماد وإرساله للمسوق.');
      return;
    }

    markCommissionTransferred(
      adminApprovalModal.id,
      approvalReceiptFile.name,
      approvalReceiptFile.dataUrl
    );

    setAdminApprovalModal(null);
    setApprovalReceiptFile(null);
    setApprovalNotes('');
    setStatusMessage({
      ok: true,
      text: `تم اعتماد صرف العمولة بنجاح وإدراج إيصال التحويل للمسوق (${adminApprovalModal.marketerName}) ✓`,
    });
  };

  // Handle Admin Rejection
  const handleConfirmReject = () => {
    if (!rejectModal) return;
    rejectCommissionRequest(rejectModal.id, rejectReason.trim() || undefined);
    setRejectModal(null);
    setRejectReason('');
    setStatusMessage({
      ok: false,
      text: `تم رفض طلب العمولة مع توجيه الملاحظات للمسوق (${rejectModal.marketerName}).`,
    });
  };

  const pendingRequests = useMemo(() => {
    return commissionRequests.filter((r) => r.status === 'pending');
  }, [commissionRequests]);

  const transferredRequests = useMemo(() => {
    return commissionRequests.filter((r) => r.status === 'transferred');
  }, [commissionRequests]);

  const marketerRequests = useMemo(() => {
    return commissionRequests.filter((r) => r.marketerId === currentMarketerId);
  }, [commissionRequests, currentMarketerId]);

  const shortName = (n: string) => n.replace(/\s*\(.*\)\s*$/, '').trim() || n;
  const period = (from: string, to: string) => (
    <>
      من <bdi dir="ltr">{from}</bdi> إلى <bdi dir="ltr">{to}</bdi>
    </>
  );
  const historyList = hasAdminPayoutAccess ? commissionRequests : marketerRequests;
  const pendingSum = pendingRequests.reduce((sum, r) => sum + r.amount, 0);
  const transferredSum = transferredRequests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. نظرة عامة */}
      <section className="lux-card p-4 space-y-3.5">
        <Stats cols={2}>
          <Stat tone="sand" icon={Clock} label="بانتظار الصرف" value={fmtN(pendingRequests.length)} unit="طلب" hint={`${fmtN(pendingSum)} ر.س`} />
          <Stat tone="jade" icon={CheckCircle2} label="تم تحويله" value={fmtN(transferredRequests.length)} unit="حوالة" hint={`${fmtN(transferredSum)} ر.س`} />
        </Stats>
        <p className="kt-note">لا يُقبل طلب عمولة لفترة متداخلة، ويلزم إرفاق إيصال الحوالة عند الاعتماد.</p>
      </section>

      {/* رسالة الحالة */}
      {statusMessage &&
        (statusMessage.ok ? (
          <div className="kt-ok animate-in fade-in" role="status">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
              <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{statusMessage.text}</span>
              <button type="button" onClick={() => setStatusMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="kt-err animate-in fade-in" role="alert">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1 min-w-0">{statusMessage.text}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
              ✕
            </button>
          </div>
        ))}

      {/* 2. المسوق: طلب صرف جديد */}
      {!isAdmin && !isGuard && currentMarketer?.isSupervisor && <SupervisorPayoutPanel />}
      {!isAdmin && !isGuard && currentMarketer && !currentMarketer.isSupervisor && (
        <section className="lux-card p-4 space-y-3.5">
          <Head title="طلب صرف عمولة" icon={Send} />
          <p className="kt-note">
            {currentMarketer?.name} · العمولة {fmtN(currentMarketer?.commissionRate || 5)}%
          </p>
          <div className="kt-fields">
            <Field label="من تاريخ">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setStatusMessage(null);
                }}
                className="kt-input"
              />
            </Field>
            <Field label="إلى تاريخ">
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setStatusMessage(null);
                }}
                className="kt-input"
              />
            </Field>
          </div>

          {overlappingRequestForMarketer && (
            <div className="kt-err" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                يوجد طلب سابق لفترة متداخلة ({period(overlappingRequestForMarketer.fromDate, overlappingRequestForMarketer.toDate)}) —{' '}
                {overlappingRequestForMarketer.status === 'transferred' ? 'تم صرفه' : 'قيد المراجعة'}. اختر فترة أخرى.
              </span>
            </div>
          )}

          <Infos cols={2}>
            <Info label="حجوزات مستحقة" value={fmtN(eligibleBookings.length)} />
            <Info hi label="العمولة المستحقة" value={`${fmtN(totalEligibleCommission)} ر.س`} />
          </Infos>
          <Act
            tone="ink"
            icon={Send}
            label="إرسال للإدارة"
            title="إرسال طلب الصرف للإدارة"
            disabled={Boolean(overlappingRequestForMarketer) || eligibleBookings.length === 0}
            onClick={handleSubmitRequest}
          />
        </section>
      )}

      {/* 3. الإدارة: طلبات بانتظار المراجعة */}
      {hasAdminPayoutAccess && (
        <section className="lux-card p-4 space-y-3.5">
          <Head title="بانتظار المراجعة" icon={Clock} tone="sand" count={pendingRequests.length} />
          {pendingRequests.length === 0 ? (
            <EmptyBox icon={CheckCircle2} text="لا توجد طلبات معلقة — كل الطلبات تمت مراجعتها." />
          ) : (
            pendingRequests.map((req) => {
              const reqBookings = bookings.filter((b) => req.bookingIds.includes(b.id));
              return (
                <div key={req.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <Tile icon={Clock} tone="sand" size={44} />
                    <span className="kt-row-t">
                      <span className="kt-row-n">{shortName(req.marketerName)}</span>
                      <span className="kt-row-s">{period(req.fromDate, req.toDate)}</span>
                    </span>
                    <Tag tone="sand">بانتظار</Tag>
                  </div>
                  <Infos cols={2}>
                    {req.kind === 'supervisor' && (
                      <>
                        <Info label="الرسوم الإدارية" value={`${fmtN(req.adminFeeAmount || 0)} ر.س`} />
                        <Info label="رسوم المشرف" value={`${fmtN(req.supervisorFeeAmount || 0)} ر.س`} />
                        <Info label="النسبة المئوية" value={`${fmtN(req.percentAmount || 0)} ر.س`} />
                      </>
                    )}
                    <Info label="الحجوزات" value={fmtN(reqBookings.length)} />
                    <Info hi wide label="المبلغ المطلوب" value={`${fmtN(req.amount)} ر.س`} />
                  </Infos>
                  {reqBookings.map((b) => (
                    <Row
                      key={b.id}
                      icon={FileText}
                      tone="amy"
                      title={b.customerName}
                      sub={`#${b.bookingNumber} · ${b.propertyName}`}
                      end={
                        <Tag tone="gray" mono>
                          {fmtN(req.kind === 'supervisor' ? getSupervisorPayoutParts(b, properties, specialAdminFeeBoxes).total : b.marketerCommission)} ر.س
                        </Tag>
                      }
                      onClick={() => setInspectBookingModal(b)}
                    />
                  ))}
                  <Acts cols={2}>
                    <Act
                      small
                      tone="jade"
                      icon={Check}
                      label="موافقة وإيصال"
                      title="موافقة وإدراج إيصال التحويل البنكي"
                      onClick={() => {
                        setAdminApprovalModal(req);
                        setApprovalReceiptFile(null);
                        setApprovalNotes('');
                        setApprovalError(null);
                      }}
                    />
                    <Act
                      small
                      tone="garnS"
                      icon={XCircle}
                      label="رفض"
                      title="رفض طلب الصرف"
                      onClick={() => {
                        setRejectModal(req);
                        setRejectReason('');
                      }}
                    />
                  </Acts>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* 4. السجل */}
      <section className="lux-card p-4 space-y-3.5">
        <Head title={hasAdminPayoutAccess ? 'سجل الطلبات' : 'سجل طلباتي'} icon={CreditCard} count={historyList.length} />
        {historyList.length === 0 ? (
          <EmptyBox icon={CreditCard} text="لا توجد طلبات مسجلة." />
        ) : (
          historyList.map((req) => {
            const isTransferred = req.status === 'transferred';
            const isPending = req.status === 'pending';
            return (
              <div key={req.id} className="kt-bk">
                <div className="kt-bk-h">
                  <Tile icon={isTransferred ? CheckCircle2 : isPending ? Clock : XCircle} tone={isTransferred ? 'jade' : isPending ? 'sand' : 'garn'} size={44} />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{hasAdminPayoutAccess ? shortName(req.marketerName) : 'طلب عمولة'}</span>
                    <span className="kt-row-s">{period(req.fromDate, req.toDate)}</span>
                  </span>
                  <Tag tone={isTransferred ? 'jade' : isPending ? 'sand' : 'garn'}>{isTransferred ? 'تم الصرف' : isPending ? 'قيد المراجعة' : 'مرفوض'}</Tag>
                </div>
                <Infos cols={2}>
                  {req.kind === 'supervisor' && (
                    <>
                      <Info label="الرسوم الإدارية" value={`${fmtN(req.adminFeeAmount || 0)} ر.س`} />
                      <Info label="رسوم المشرف" value={`${fmtN(req.supervisorFeeAmount || 0)} ر.س`} />
                      <Info label="النسبة المئوية" value={`${fmtN(req.percentAmount || 0)} ر.س`} />
                    </>
                  )}
                  <Info hi={isTransferred} label="المبلغ" value={`${fmtN(req.amount)} ر.س`} />
                  <Info label="الحجوزات" value={fmtN(req.bookingIds.length)} />
                </Infos>
                {req.processedAt && <p className="kt-note">تاريخ الصرف: {req.processedAt}</p>}
                {req.adminNote && <p className="kt-note">ملاحظة الإدارة: {req.adminNote}</p>}
                {isTransferred && req.receiptDataUrl && (
                  <Act small tone="soft" icon={Paperclip} label="عرض الإيصال" title="عرض الإيصال البنكي" onClick={() => setViewReceiptModal(req)} />
                )}
              </div>
            );
          })
        )}
      </section>

      {/* اعتماد الصرف وإدراج الإيصال */}
      {adminApprovalModal && (
        <Sheet
          lockBackdrop
          title="اعتماد صرف العمولة"
          icon={CheckCircle2}
          tone="jade"
          onClose={() => setAdminApprovalModal(null)}
          footer={
            <Acts cols={2}>
              <Act tone="jade" icon={Check} label="اعتماد وصرف" title="اعتماد وصرف العمولة وإرسال الإيصال" onClick={handleConfirmTransfer} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setAdminApprovalModal(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info label="المسوق" value={shortName(adminApprovalModal.marketerName)} />
            <Info label="الحجوزات" value={fmtN(adminApprovalModal.bookingIds.length)} />
            {adminApprovalModal.kind === 'supervisor' && (
              <>
                <Info label="الرسوم الإدارية" value={`${fmtN(adminApprovalModal.adminFeeAmount || 0)} ر.س`} />
                <Info label="رسوم المشرف" value={`${fmtN(adminApprovalModal.supervisorFeeAmount || 0)} ر.س`} />
                <Info label="النسبة المئوية" value={`${fmtN(adminApprovalModal.percentAmount || 0)} ر.س`} wide />
              </>
            )}
            <Info hi label="المبلغ" value={`${fmtN(adminApprovalModal.amount)} ر.س`} wide />
            <Info label="الفترة" value={period(adminApprovalModal.fromDate, adminApprovalModal.toDate)} wide />
          </Infos>

          <Head title="إيصال الحوالة" icon={UploadCloud} />
          <label className="kt-file">
            <UploadCloud size={20} strokeWidth={1.8} />
            <span>{approvalReceiptFile ? approvalReceiptFile.name : 'إرفاق صورة الإيصال (إلزامي)'}</span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleReceiptFileChange(e.target.files?.[0])} />
          </label>
          {approvalReceiptFile && <Act small tone="soft" icon={X} label="إزالة الإيصال" onClick={() => setApprovalReceiptFile(null)} />}
          {approvalError && (
            <div className="kt-err" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{approvalError}</span>
            </div>
          )}

          <Field label="رقم العملية / ملاحظات" hint="اختياري">
            <input
              type="text"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="مثال: حوالة رقم 49281"
              className="kt-input"
            />
          </Field>
        </Sheet>
      )}

      {/* عرض الإيصال */}
      {viewReceiptModal && (
        <Sheet
          title="إيصال الحوالة"
          icon={Paperclip}
          tone="jade"
          onClose={() => setViewReceiptModal(null)}
          footer={
            <Acts cols={viewReceiptModal.receiptDataUrl ? 2 : 1}>
              {viewReceiptModal.receiptDataUrl && (
                <Act tone="jade" icon={Download} label="تحميل" title="تحميل الإيصال" href={viewReceiptModal.receiptDataUrl} download={viewReceiptModal.receiptFileName || 'receipt.png'} />
              )}
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setViewReceiptModal(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info hi label="المبلغ" value={`${fmtN(viewReceiptModal.amount)} ر.س`} />
            <Info label="المسوق" value={shortName(viewReceiptModal.marketerName)} />
          </Infos>
          {viewReceiptModal.receiptDataUrl?.startsWith('data:image') ? (
            <img src={viewReceiptModal.receiptDataUrl} alt={viewReceiptModal.receiptFileName || 'إيصال التحويل'} className="w-full rounded-[18px] object-contain max-h-[50vh] bg-[#F4EFFB]" />
          ) : (
            <Row icon={FileText} tone="amy" title={viewReceiptModal.receiptFileName || 'ملف الإيصال'} sub="ملف مرفق" />
          )}
        </Sheet>
      )}

      {/* رفض الطلب */}
      {rejectModal && (
        <Sheet
          title="رفض الطلب"
          icon={XCircle}
          tone="garn"
          onClose={() => setRejectModal(null)}
          footer={
            <Acts cols={2}>
              <Act tone="garnet" icon={XCircle} label="تأكيد الرفض" onClick={handleConfirmReject} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setRejectModal(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info label="المسوق" value={shortName(rejectModal.marketerName)} />
            <Info label="المبلغ" value={`${fmtN(rejectModal.amount)} ر.س`} />
          </Infos>
          <div className="kt-err" role="alert">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>سيُبلَّغ المسوق بالرفض وسببه.</span>
          </div>
          <Field label="سبب الرفض" hint="اختياري">
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="اكتب السبب هنا" className="kt-input kt-ta" />
          </Field>
        </Sheet>
      )}

      {/* تفاصيل حجز */}
      {inspectBookingModal && (
        <Sheet
          title={`حجز #${inspectBookingModal.bookingNumber}`}
          icon={FileText}
          tone="amy"
          onClose={() => setInspectBookingModal(null)}
          footer={<Act tone="line" icon={X} label="إغلاق" onClick={() => setInspectBookingModal(null)} />}
        >
          <Infos cols={2}>
            <Info label="العميل" value={inspectBookingModal.customerName} />
            <Info label="الجوال" value={inspectBookingModal.customerPhone || '—'} ltr />
            <Info label="العقار" value={inspectBookingModal.propertyName} wide />
            <Info label="الإقامة" value={period(inspectBookingModal.checkInDate, inspectBookingModal.checkOutDate)} wide />
            <Info label="الليالي" value={fmtN(inspectBookingModal.nightsCount)} />
            <Info label="إجمالي الحجز" value={`${fmtN(inspectBookingModal.totalPrice)} ر.س`} />
            <Info hi label="عمولة المسوق" value={`${fmtN(inspectBookingModal.marketerCommission)} ر.س`} wide />
          </Infos>
        </Sheet>
      )}
    </div>
  );
};
