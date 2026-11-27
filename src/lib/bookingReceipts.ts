import { Booking } from '../types';

export type BookingReceiptKind =
  | 'deposit'
  | 'remaining'
  | 'insurance'
  | 'insurance_refund'
  | 'customer_bank';

export type BookingOwnerCategory = 'marketer' | 'admin' | 'supervisor';

export interface BookingReceiptItem {
  id: string;
  kind: BookingReceiptKind;
  label: string;
  fileName: string;
  dataUrl: string;
  dateLabel?: string;
  actorLabel?: string;
}

export function isRenderableReceiptUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:application/pdf') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/uploads/')
  );
}

export function isPdfReceiptUrl(value?: string | null, fileName?: string | null): boolean {
  const lower = (value || '').trim().toLowerCase();
  const lowerName = (fileName || '').trim().toLowerCase();
  return (
    lower.startsWith('data:application/pdf') ||
    /\.pdf(\?|#|$)/i.test(lower) ||
    /\.pdf$/i.test(lowerName)
  );
}

export function isImageReceiptUrl(value?: string | null): boolean {
  if (!value) return false;
  const lower = value.trim().toLowerCase();
  if (lower.startsWith('data:image/')) return true;
  if (isPdfReceiptUrl(lower)) return false;
  return (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('/uploads/')
  );
}

export function getBookingOwnerCategory(booking: Booking): BookingOwnerCategory {
  if (
    booking.isSupervisorBooking ||
    booking.bookingType === 'supervisor' ||
    booking.bookingCategory === 'supervisor'
  ) {
    return 'supervisor';
  }
  if (
    booking.isAdminBooking ||
    booking.bookingType === 'admin' ||
    booking.bookingCategory === 'admin' ||
    booking.isSpecialBooking ||
    !booking.marketerId
  ) {
    return 'admin';
  }
  return 'marketer';
}

export function getBookingOwnerCategoryLabel(category: BookingOwnerCategory): string {
  switch (category) {
    case 'supervisor':
      return 'حجز مشرف';
    case 'admin':
      return 'حجز إدارة';
    case 'marketer':
    default:
      return 'حجز مسوق';
  }
}

export function getBookingReceiptsList(booking: Booking): BookingReceiptItem[] {
  const items: BookingReceiptItem[] = [];

  const depositUrl = isRenderableReceiptUrl(booking.depositReceiptUrl)
    ? booking.depositReceiptUrl!
    : isRenderableReceiptUrl(booking.receiptDataUrl)
    ? booking.receiptDataUrl!
    : '';
  if (depositUrl) {
    items.push({
      id: `${booking.id}-deposit`,
      kind: 'deposit',
      label: 'إيصال العربون',
      fileName:
        booking.depositReceiptName ||
        booking.receiptFileName ||
        (!isRenderableReceiptUrl(booking.depositReceiptUrl) && booking.depositReceiptUrl
          ? booking.depositReceiptUrl
          : 'إيصال_العربون.jpg'),
      dataUrl: depositUrl,
      dateLabel: booking.createdAt,
      actorLabel: booking.marketerName || 'الإدارة',
    });
  }

  const remainingUrl = isRenderableReceiptUrl(booking.remainingReceiptDataUrl)
    ? booking.remainingReceiptDataUrl!
    : isRenderableReceiptUrl(booking.paymentReceiptDataUrl)
    ? booking.paymentReceiptDataUrl!
    : '';
  if (remainingUrl) {
    items.push({
      id: `${booking.id}-remaining`,
      kind: 'remaining',
      label: 'إيصال المتبقي / إكمال الدفع',
      fileName:
        booking.remainingReceiptName ||
        booking.paymentReceiptName ||
        'إيصال_المتبقي.jpg',
      dataUrl: remainingUrl,
      dateLabel: booking.paymentCompletedAt,
      actorLabel: booking.paymentCompletedBy,
    });
  }

  const insuranceUrl = isRenderableReceiptUrl(booking.digitalInsuranceReceiptUrl)
    ? booking.digitalInsuranceReceiptUrl!
    : isRenderableReceiptUrl(booking.insuranceReceiptDataUrl)
    ? booking.insuranceReceiptDataUrl!
    : '';
  if (insuranceUrl) {
    items.push({
      id: `${booking.id}-insurance`,
      kind: 'insurance',
      label: 'إيصال استلام التأمين',
      fileName:
        booking.digitalInsuranceReceiptName ||
        booking.insuranceReceiptName ||
        'إيصال_التأمين.jpg',
      dataUrl: insuranceUrl,
      dateLabel: booking.insuranceReceivedAt,
      actorLabel: booking.insuranceUploadedBy,
    });
  }

  if (isRenderableReceiptUrl(booking.insuranceRefundReceiptUrl)) {
    items.push({
      id: `${booking.id}-insurance-refund`,
      kind: 'insurance_refund',
      label: 'إيصال استرداد التأمين',
      fileName: booking.insuranceRefundReceiptName || 'إيصال_استرداد_التأمين.jpg',
      dataUrl: booking.insuranceRefundReceiptUrl!,
      dateLabel: booking.insuranceReturnedAt,
    });
  }

  if (isRenderableReceiptUrl(booking.customerBankReceiptUrl)) {
    items.push({
      id: `${booking.id}-customer-bank`,
      kind: 'customer_bank',
      label: 'صورة حساب العميل لاسترداد التأمين',
      fileName: booking.customerBankReceiptName || 'صورة_حساب_العميل.jpg',
      dataUrl: booking.customerBankReceiptUrl!,
    });
  }

  return items;
}

export function hasAnyBookingReceiptFields(booking: Booking): boolean {
  return Boolean(
    booking.depositReceiptUrl ||
      booking.depositReceiptName ||
      booking.remainingReceiptName ||
      booking.remainingReceiptDataUrl ||
      booking.paymentReceiptName ||
      booking.paymentReceiptDataUrl ||
      booking.insuranceReceiptName ||
      booking.insuranceReceiptDataUrl ||
      booking.digitalInsuranceReceiptName ||
      booking.digitalInsuranceReceiptUrl ||
      booking.insuranceRefundReceiptName ||
      booking.insuranceRefundReceiptUrl ||
      booking.customerBankReceiptName ||
      booking.customerBankReceiptUrl ||
      booking.receiptFileName ||
      booking.receiptDataUrl
  );
}

/**
 * Clears all customer bank receipts stored inside a booking once the marketer commission is transferred.
 */
export function clearBookingReceiptsAfterCommissionPaid(booking: Booking): Booking {
  const deletedDate = booking.receiptsDeletedAt || new Date().toISOString().split('T')[0];
  return {
    ...booking,
    commissionStatus: 'paid',
    depositReceiptUrl: undefined,
    depositReceiptName: undefined,
    remainingReceiptName: undefined,
    remainingReceiptDataUrl: undefined,
    paymentReceiptName: undefined,
    paymentReceiptDataUrl: undefined,
    insuranceReceiptName: undefined,
    insuranceReceiptDataUrl: undefined,
    digitalInsuranceReceiptName: undefined,
    digitalInsuranceReceiptUrl: undefined,
    insuranceRefundReceiptName: undefined,
    insuranceRefundReceiptUrl: undefined,
    customerBankReceiptName: undefined,
    customerBankReceiptUrl: undefined,
    receiptFileName: undefined,
    receiptDataUrl: undefined,
    receiptsDeletedAfterCommissionPaid: true,
    receiptsDeletedAt: deletedDate,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف المختار.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses receipt images cleanly below ~95KB so they persist reliably inside the app & Firestore.
 */
export async function prepareReceiptFileForAppStorage(
  file: File
): Promise<{ name: string; dataUrl: string }> {
  const isPdf =
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|heic|bmp)$/i.test(file.name);

  if (!isImage && !isPdf) {
    throw new Error('يرجى اختيار صورة (JPG / PNG / WebP) أو ملف PDF للإيصال.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('حجم الملف كبير جداً. الحد الأقصى المسموح 10 ميجابايت.');
  }

  if (isPdf) {
    const raw = await readFileAsDataUrl(file);
    if (raw.length > 115000) {
      throw new Error(
        'ملف PDF كبير للحفظ داخل التطبيق؛ يرجى إرفاق لقطة شاشة/صورة للإيصال ليتم ضغطها وحفظها تلقائياً.'
      );
    }
    return { name: file.name, dataUrl: raw };
  }

  const { compressImageFile } = await import('./mediaStorage');

  const attempts: [number, number][] = [
    [1200, 0.8],
    [950, 0.7],
    [760, 0.6],
    [580, 0.48],
    [440, 0.38],
  ];

  let compressed = '';
  for (const [dim, quality] of attempts) {
    compressed = await compressImageFile(file, dim, quality);
    if (compressed.length <= 95000) {
      break;
    }
  }

  if (!compressed || compressed.length > 118000) {
    throw new Error('تعذر ضغط صورة الإيصال للحجم المناسب، يرجى اختيار صورة أوضح بحجم أصغر.');
  }

  return {
    name: file.name,
    dataUrl: compressed,
  };
}

function inferDownloadExtension(dataUrl: string, fileName: string): string {
  const lowerUrl = dataUrl.toLowerCase();
  if (lowerUrl.startsWith('data:application/pdf') || /\.pdf(\?|#|$)/i.test(fileName)) return 'pdf';
  if (lowerUrl.startsWith('data:image/png') || /\.png(\?|#|$)/i.test(fileName)) return 'png';
  if (lowerUrl.startsWith('data:image/webp') || /\.webp(\?|#|$)/i.test(fileName)) return 'webp';
  return 'jpg';
}

function sanitizeDownloadName(baseName: string, ext: string): string {
  const withoutExt = (baseName || 'receipt').replace(/\.[^/.]+$/, '').trim();
  const safe = withoutExt.replace(/[\\/:*?"<>|]/g, '_') || 'receipt';
  return `${safe}.${ext}`;
}

export async function downloadReceiptFile(dataUrl: string, suggestedName: string): Promise<void> {
  if (!dataUrl) return;
  const ext = inferDownloadExtension(dataUrl, suggestedName);
  const finalName = sanitizeDownloadName(suggestedName, ext);

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = finalName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }, 10000);
  } catch {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = finalName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
