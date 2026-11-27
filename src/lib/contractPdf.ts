import { Booking, Guard, Marketer, Property } from '../types';
import { buildCustomerWhatsappUrl } from './customerLinks';
import { resolveContractTemplateAndTerms } from './propertyUtils';

export interface OfficialContractData {
  bookingNumber: string;
  issueDate: string;
  headerKicker: string;
  mainTitle: string;
  subCaption: string;
  propertyName: string;
  sectionName?: string;
  customerNationalId: string;
  customerName: string;
  vehiclePlate: string;
  customerPhone: string;
  nightsCount: number;
  nightsLabel: string;
  guestsCount: number;
  checkInDateLabel: string;
  checkInTimeLabel: string;
  checkOutDateLabel: string;
  checkOutTimeLabel: string;
  totalPrice: number;
  depositPaid: number;
  remainingAmount: number;
  insuranceAmount: number;
  hasFinancialMismatch: boolean;
  baseNightlyTotal: number;
  breakfastPrice: number;
  breakfastOption?: string;
  coordinatorName?: string;
  coordinatorService?: string;
  coordinatorPrice: number;
  breakfastBanner: {
    show: boolean;
    included: boolean;
    text: string;
  };
  contractTerms: string[];
  wifiDisplay: string;
  guardName: string;
  guardPhone: string;
  arrivalInstructions: string;
  mapsUrl: string;
  closingMessage: string;
  marketerLabel?: string;
}

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function formatArabicGregorianDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  const dayName = DAYS_AR[dateObj.getDay()];
  const monthName = MONTHS_AR[dateObj.getMonth()];
  return `${dayName}، ${d} ${monthName} ${y}`;
}

export function formatNightsArabicLabel(nights: number): string {
  const n = Math.max(1, Math.round(nights || 1));
  if (n === 1) return 'ليلة واحدة';
  if (n === 2) return 'ليلتان';
  if (n >= 3 && n <= 10) return `${n} ليالٍ`;
  return `${n} ليلة`;
}

export function buildOfficialContractData(params: {
  booking: Partial<Booking>;
  property?: Property;
  guards?: Guard[];
  marketers?: Marketer[];
}): OfficialContractData {
  const { booking, property, guards = [], marketers = [] } = params;

  const basePropName = (property?.name || booking.propertyName || 'AMASA RESORT').trim();
  const sectionName = booking.sectionName?.trim() || undefined;
  const nightsCount = Math.max(1, Number(booking.nightsCount || 1));

  const matchedGuard =
    guards.find((g) => property?.assignedGuardId && g.id === property.assignedGuardId) ||
    guards.find(
      (g) =>
        property?.id &&
        (g.assignedPropertyId === property.id ||
          (g.assignedPropertyIds && g.assignedPropertyIds.includes(property.id)))
    );

  const guardName = (
    property?.assignedGuardName ||
    matchedGuard?.name ||
    'الحارس المناوب'
  ).trim();
  const guardPhone = (property?.assignedGuardPhone || matchedGuard?.phone || '').trim();

  const totalPrice = Math.max(0, Number(booking.totalPrice || 0));
  const depositPaid = Math.max(0, Number(booking.depositPaid || 0));
  const remainingAmount =
    booking.remainingAmount !== undefined
      ? Math.max(0, Number(booking.remainingAmount))
      : Math.max(0, totalPrice - depositPaid);
  const insuranceAmount = Math.max(
    0,
    Number(booking.insuranceAmount ?? property?.insuranceAmount ?? 0)
  );
  const breakfastPrice = Math.max(0, Number(booking.breakfastPrice || 0));
  const coordinatorPrice = Math.max(0, Number(booking.coordinatorPrice || 0));
  const baseNightlyTotal = Math.max(
    0,
    Number(
      booking.baseNightlyTotal || Math.max(0, totalPrice - breakfastPrice - coordinatorPrice)
    )
  );

  const hasFinancialMismatch = depositPaid + remainingAmount !== totalPrice;

  const breakfastBanner = (() => {
    if (booking.withoutBreakfast) {
      return {
        show: true,
        included: false,
        text: 'الإقامة بدون وجبة إفطار حسب خيار الحجز.',
      };
    }
    if (breakfastPrice > 0 || booking.breakfastOption || property?.breakfastNote) {
      return {
        show: true,
        included: true,
        text:
          property?.breakfastNote ||
          (booking.breakfastOption
            ? `${booking.breakfastOption} — يحضره الحارس في الموعد المتفق عليه.`
            : 'الإفطار مشمول ضمن باقة الإقامة المعتمدة.'),
      };
    }
    if (property?.breakfastPricing?.enabled) {
      return {
        show: true,
        included: true,
        text:
          property.breakfastNote ||
          'خدمة الإفطار متاحة وفق الباقة المختارة في نظام الحجز.',
      };
    }
    return { show: false, included: false, text: '' };
  })();

  const { terms: contractTerms } = resolveContractTemplateAndTerms({
    property,
    sectionId: booking.sectionId,
    sectionName: booking.sectionName,
  });

  const wifiParts = [property?.wifiName?.trim(), property?.wifiPassword?.trim()].filter(Boolean);
  const wifiDisplay =
    wifiParts.length > 0 ? wifiParts.join(' • كلمة المرور: ') : 'تُسلّم بيانات الشبكة عند الوصول';

  const arrivalInstructions = (
    property?.arrivalInstructions ||
    property?.address ||
    property?.location ||
    'يرجى التواصل مع الحارس عند الاقتراب لفتح البوابة وتسهيل إجراءات الدخول.'
  ).trim();

  const mapsUrl =
    property?.googleMapsUrl?.trim() ||
    (property?.coordinates?.lat && property?.coordinates?.lng
      ? `https://www.google.com/maps/search/?api=1&query=${property.coordinates.lat},${property.coordinates.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${basePropName} ${property?.location || ''}`.trim()
        )}`);

  const matchedMarketer = marketers.find(
    (m) => m.id === (booking.supervisorId || booking.marketerId)
  );
  const marketerLabel =
    booking.marketerName || matchedMarketer?.name || (booking.isAdminBooking ? 'الإدارة المباشرة' : undefined);

  const guestsCount = Number(booking.guestsCount || property?.capacity || 0);

  return {
    bookingNumber: booking.bookingNumber || 'مسودة عقد',
    issueDate: booking.createdAt ? booking.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    headerKicker: sectionName ? `عقد ${basePropName} | ${sectionName}` : `مجموعة AMASA RESORT | ${basePropName}`,
    mainTitle: `عقد إيجار ${basePropName}`,
    subCaption: 'بيانات الحجز وشروط الإقامة • نسخة مخصصة للمشاركة',
    propertyName: basePropName,
    sectionName,
    customerNationalId: booking.customerNationalId?.trim() || '—',
    customerName: booking.customerName?.trim() || 'الضيف الكريم',
    vehiclePlate: booking.vehiclePlate?.trim() || '—',
    customerPhone: booking.customerPhone?.trim() || '—',
    nightsCount,
    nightsLabel: formatNightsArabicLabel(nightsCount),
    guestsCount,
    checkInDateLabel: formatArabicGregorianDate(booking.checkInDate),
    checkInTimeLabel: property?.checkInTimeText || 'الساعة 4:00 عصراً',
    checkOutDateLabel: formatArabicGregorianDate(booking.checkOutDate),
    checkOutTimeLabel: property?.checkOutTimeText || 'الساعة 2:00 ظهراً',
    totalPrice,
    depositPaid,
    remainingAmount,
    insuranceAmount,
    hasFinancialMismatch,
    baseNightlyTotal,
    breakfastPrice,
    breakfastOption: booking.breakfastOption,
    coordinatorName: booking.coordinatorName,
    coordinatorService: booking.coordinatorService,
    coordinatorPrice,
    breakfastBanner,
    contractTerms,
    wifiDisplay,
    guardName,
    guardPhone,
    arrivalInstructions,
    mapsUrl,
    closingMessage: `شاكرين لكم تفهمكم وتعاونكم، ونتمنى لكم إقامة سعيدة في ${basePropName} ♡`,
    marketerLabel,
  };
}

export function sanitizePdfFileName(rawName: string): string {
  const cleaned = (rawName || 'contract')
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  return `${cleaned || 'amasa-contract'}.pdf`;
}

/**
 * Generates an actual A4 PDF File from a contract DOM element with crisp Arabic typography.
 * Clones into an offscreen fixed-width wrapper so narrow mobile screens never squish the A4 layout.
 */
export async function generateContractPdfFile(
  element: HTMLElement,
  fileName: string
): Promise<File> {
  if (typeof document === 'undefined') {
    throw new Error('توليد ملف PDF متاح في المتصفح فقط.');
  }

  try {
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }
  } catch {
    // proceed
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  // كل صفحة A4 (794×1123) تُرسم بمفردها في مرحلة خارج الشاشة لتخرج صفحات PDF نظيفة
  const PAGE_W = 794;
  const pageEls = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  const sources = pageEls.length > 0 ? pageEls : [element];

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let firstPage = true;

  for (const src of sources) {
    const stage = document.createElement('div');
    stage.setAttribute('dir', 'rtl');
    stage.style.cssText = `position:fixed;top:-20000px;left:0;width:${PAGE_W}px;background:#fffefb;z-index:-1;pointer-events:none;font-family:'Tajawal',system-ui,sans-serif;`;
    const clone = src.cloneNode(true) as HTMLElement;
    clone.style.width = `${PAGE_W}px`;
    clone.style.transform = 'none';
    stage.appendChild(clone);
    document.body.appendChild(stage);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2.2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#fffefb',
        logging: false,
      });

      const hMm = (canvas.height * pageW) / canvas.width;
      const pxPerMm = canvas.width / pageW;
      const links = Array.from(clone.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const cloneRect = clone.getBoundingClientRect();

      // صفحة بحجم A4 تماماً، وإن زاد المحتوى يُقسَّم على صفحات إضافية
      let offsetMm = 0;
      while (offsetMm < hMm - 0.5) {
        const sliceMm = Math.min(pageH, hMm - offsetMm);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round(sliceMm * pxPerMm));
        const ctx = slice.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#fffefb';
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(
            canvas,
            0,
            Math.round(offsetMm * pxPerMm),
            canvas.width,
            slice.height,
            0,
            0,
            slice.width,
            slice.height
          );
        }
        if (!firstPage) pdf.addPage();
        firstPage = false;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageW, sliceMm, undefined, 'FAST');

        for (const a of links) {
          const r = a.getBoundingClientRect();
          const xMm = ((r.left - cloneRect.left) / cloneRect.width) * pageW;
          const wMm = (r.width / cloneRect.width) * pageW;
          const yMm = ((r.top - cloneRect.top) / cloneRect.width) * pageW - offsetMm;
          const hLinkMm = (r.height / cloneRect.width) * pageW;
          if (yMm >= 0 && yMm + hLinkMm <= sliceMm + 0.5) {
            pdf.link(xMm, yMm, wMm, hLinkMm, { url: a.href });
          }
        }
        offsetMm += sliceMm;
      }
    } finally {
      if (stage.parentNode) stage.parentNode.removeChild(stage);
    }
  }

    const safeName = sanitizePdfFileName(fileName);
    const pdfBlob = pdf.output('blob');
    return new File([pdfBlob], safeName, { type: 'application/pdf' });
}

export function triggerPdfFileDownload(file: File): void {
  const androidBridge = (window as any)?.AmasaAndroid;
  if (androidBridge && typeof androidBridge.saveBase64File === 'function') {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        androidBridge.saveBase64File(String(reader.result), file.name, 'application/pdf');
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  const blobUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = file.name;
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
  }, 15000);
}

export interface SendContractPdfResult {
  status: 'shared' | 'downloaded' | 'cancelled';
  fileName: string;
  whatsappUrl?: string;
  message: string;
}

export async function sendOrDownloadContractPdf(params: {
  element: HTMLElement;
  booking: Partial<Booking>;
  property?: Property;
  mode: 'whatsapp' | 'share' | 'download';
}): Promise<SendContractPdfResult> {
  const { element, booking, property, mode } = params;
  const propLabel = (property?.name || booking.propertyName || 'AMASA_RESORT').replace(/\s+/g, '_');
  const bookingCode = (booking.bookingNumber || booking.customerName || 'عقد').replace(/\s+/g, '_');
  const fileName = sanitizePdfFileName(`عقد_ايجار_${propLabel}_${bookingCode}.pdf`);

  const pdfFile = await generateContractPdfFile(element, fileName);

  const shortCoverText = `عقد إيجار ${property?.name || booking.propertyName || ''} (${booking.bookingNumber || 'معتمد'})\nالضيف: ${booking.customerName || 'الكريم'}\nمرفق لكم ملف العقد الرسمي بصيغة PDF.`;
  const whatsappUrl = booking.customerPhone
    ? buildCustomerWhatsappUrl(booking.customerPhone, shortCoverText)
    : `https://wa.me/?text=${encodeURIComponent(shortCoverText)}`;

  if (mode === 'download') {
    triggerPdfFileDownload(pdfFile);
    return {
      status: 'downloaded',
      fileName: pdfFile.name,
      whatsappUrl,
      message: `تم تنزيل ملف العقد بصيغة PDF (${pdfFile.name}) بنجاح.`,
    };
  }

  // Prefer native Web Share API with the actual PDF file (works natively on Android/iOS Safari/Chrome -> WhatsApp)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare !== 'function' || navigator.canShare({ files: [pdfFile] });
    if (canShareFiles) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `عقد إيجار ${property?.name || booking.propertyName || ''}`,
          text: shortCoverText,
        });
        return {
          status: 'shared',
          fileName: pdfFile.name,
          whatsappUrl,
          message: `تمت مشاركة ملف العقد (${pdfFile.name}) بصيغة PDF بنجاح.`,
        };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return {
            status: 'cancelled',
            fileName: pdfFile.name,
            whatsappUrl,
            message: 'تم إلغاء مشاركة ملف العقد.',
          };
        }
        // Fallback to direct PDF download + WhatsApp handoff if iframe/desktop blocks file share
      }
    }
  }

  triggerPdfFileDownload(pdfFile);
  return {
    status: 'downloaded',
    fileName: pdfFile.name,
    whatsappUrl,
    message: `تم حفظ العقد بصيغة PDF (${pdfFile.name}) على جهازك — يمكنك إرفاق الملف مباشرة في محادثة واتساب للعميل.`,
  };
}
