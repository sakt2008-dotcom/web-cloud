import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Printer,
  FileCheck,
  Download,
  Send,
  Loader2,
  Edit3,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Booking, Property } from '../../types';
import { useApp } from '../../context/AppContext';
import { OfficialContractDocument } from '../contracts/OfficialContractDocument';
import { sendOrDownloadContractPdf, SendContractPdfResult } from '../../lib/contractPdf';

interface PrintableContractModalProps {
  booking: Partial<Booking> | null;
  property?: Property;
  onClose: () => void;
  title?: string;
}

export const PrintableContractModal: React.FC<PrintableContractModalProps> = ({
  booking,
  property: propOverride,
  onClose,
  title,
}) => {
  const {
    properties,
    guardsList,
    marketers,
    bookings,
    updateBookingContractFields,
  } = useApp();

  const contractRef = useRef<HTMLDivElement>(null);

  const liveBooking: Partial<Booking> | null = booking
    ? (booking.id ? bookings.find((b) => b.id === booking.id) || booking : booking)
    : null;

  const resolvedProperty =
    propOverride ||
    properties.find((p) => p.id === liveBooking?.propertyId) ||
    properties.find((p) => p.name === liveBooking?.propertyName);

  const [showEditStrip, setShowEditStrip] = useState(false);
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [vehiclePlateInput, setVehiclePlateInput] = useState('');
  const [guestsCountInput, setGuestsCountInput] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const [isExportingPdf, setIsExportingPdf] = useState<'whatsapp' | 'download' | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<SendContractPdfResult | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!liveBooking) return;
    setNationalIdInput(liveBooking.customerNationalId || '');
    setVehiclePlateInput(liveBooking.vehiclePlate || '');
    setGuestsCountInput(
      liveBooking.guestsCount
        ? String(liveBooking.guestsCount)
        : resolvedProperty?.capacity
        ? String(resolvedProperty.capacity)
        : ''
    );
    setPdfFeedback(null);
    setPdfError(null);
  }, [liveBooking?.id, liveBooking?.bookingNumber, resolvedProperty?.id]);

  if (!liveBooking) return null;

  const mergedBooking: Partial<Booking> = {
    ...liveBooking,
    customerNationalId: nationalIdInput.trim() || liveBooking.customerNationalId,
    vehiclePlate: vehiclePlateInput.trim() || liveBooking.vehiclePlate,
    guestsCount:
      guestsCountInput.trim() && Number(guestsCountInput) > 0
        ? Number(guestsCountInput)
        : liveBooking.guestsCount,
  };

  const handleSaveContractFields = () => {
    if (liveBooking.id) {
      updateBookingContractFields(liveBooking.id, {
        customerNationalId: nationalIdInput.trim(),
        vehiclePlate: vehiclePlateInput.trim(),
        guestsCount: Number(guestsCountInput) > 0 ? Number(guestsCountInput) : undefined,
      });
    }
    setSavedNotice(true);
    setShowEditStrip(false);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handlePdfAction = async (mode: 'whatsapp' | 'download') => {
    if (!contractRef.current) return;
    setIsExportingPdf(mode);
    setPdfError(null);
    try {
      const result = await sendOrDownloadContractPdf({
        element: contractRef.current,
        booking: mergedBooking,
        property: resolvedProperty,
        mode,
      });
      setPdfFeedback(result);
    } catch (err: any) {
      setPdfError(err?.message || 'تعذر إنشاء ملف PDF للعقد حالياً.');
    } finally {
      setIsExportingPdf(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs font-['Tajawal',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[94vh] overflow-hidden shadow-2xl border border-[#D8CEBA] flex flex-col">
        {/* Top Action Toolbar (Hidden on print) */}
        <div className="px-4 py-3.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 bg-[#F8F5EE] print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#193B30] text-white flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                {title || `عقد إيجار ${resolvedProperty?.name || mergedBooking.propertyName || ''}`}
              </h3>
              {mergedBooking.bookingNumber && (
                <span className="text-[11px] text-stone-600 font-mono block">
                  #{mergedBooking.bookingNumber}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowEditStrip((v) => !v)}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#193B30]" />
              <span>{showEditStrip ? 'إغلاق التعديل' : 'الهوية واللوحة'}</span>
            </button>

            <button
              type="button"
              disabled={isExportingPdf !== null}
              onClick={() => handlePdfAction('whatsapp')}
              className="px-3.5 py-2 bg-[#193B30] hover:bg-[#122D24] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isExportingPdf === 'whatsapp' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>إرسال PDF للعميل</span>
            </button>

            <button
              type="button"
              disabled={isExportingPdf !== null}
              onClick={() => handlePdfAction('download')}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isExportingPdf === 'download' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>تحميل PDF</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white border border-stone-200 text-slate-500 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Quick Edit Strip for National ID / Vehicle Plate / Guests Count */}
        {showEditStrip && (
          <div className="px-4 py-3 bg-[#FAF6EE] border-b border-[#E5DEC9] grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end print:hidden">
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">رقم الهوية</label>
              <input
                type="text"
                value={nationalIdInput}
                onChange={(e) => setNationalIdInput(e.target.value)}
                placeholder="10xxxxxxxx"
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-[#193B30]/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                لوحة السيارة المصرح لها
              </label>
              <input
                type="text"
                value={vehiclePlateInput}
                onChange={(e) => setVehiclePlateInput(e.target.value)}
                placeholder="مثال: د ب ي 8972"
                className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#193B30]/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">عدد الأشخاص</label>
              <input
                type="number"
                min={1}
                value={guestsCountInput}
                onChange={(e) => setGuestsCountInput(e.target.value)}
                placeholder="مثال: 30"
                className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#193B30]/30"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveContractFields}
              className="px-4 py-2 bg-[#193B30] hover:bg-[#122D24] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تحديث البيانات</span>
            </button>
          </div>
        )}

        {/* Inline PDF Status / WhatsApp Handoff Notice */}
        {(savedNotice || pdfFeedback || pdfError) && (
          <div className="px-4 py-2.5 border-b border-stone-200 bg-emerald-50/90 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
            {savedNotice && (
              <span className="font-bold text-emerald-900">
                ✓ تم تحديث بيانات المستأجر والمركبة داخل العقد بنجاح.
              </span>
            )}
            {pdfError && <span className="font-bold text-rose-700">{pdfError}</span>}
            {pdfFeedback && (
              <>
                <span className="font-bold text-[#193B30]">{pdfFeedback.message}</span>
                {pdfFeedback.whatsappUrl && pdfFeedback.status === 'downloaded' && (
                  <a
                    href={pdfFeedback.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح واتساب العميل لإرفاق PDF</span>
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {/* Scrollable Official Contract Document */}
        <div
          id="printable-contract"
          className="p-3 sm:p-6 overflow-y-auto flex-1 bg-stone-100/80 print:p-0 print:bg-white"
        >
          <OfficialContractDocument
            ref={contractRef}
            booking={mergedBooking}
            property={resolvedProperty}
            guards={guardsList}
            marketers={marketers}
          />
        </div>
      </div>
    </div>
  );
};
