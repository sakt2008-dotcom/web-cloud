import {
  KayanDetergentItem,
  KayanOrderItem,
  KayanOrderSheet,
  KayanSettings,
  KayanUnit,
} from '../types';
import { buildCustomerWhatsappUrl, normalizeCustomerPhone } from './customerLinks';
import {
  generateContractPdfFile,
  sanitizePdfFileName,
  triggerPdfFileDownload,
} from './contractPdf';

export const KAYAN_UNIT_LABELS: Record<KayanUnit, string> = {
  piece: 'حبة',
  carton: 'كرتون',
  bale: 'بالة',
};

export const KAYAN_UNIT_ORDER: KayanUnit[] = ['piece', 'carton', 'bale'];

export const KAYAN_CATEGORIES = [
  'منظفات الأرضيات والأسطح',
  'الغسيل والمبيضات',
  'المعطرات والتعقيم',
  'الأوراق والبلاستيك',
  'العناية الشخصية والضيافة',
  'العناية بالمسابح',
  'أدوات ومعدات النظافة',
] as const;

export const KAYAN_DEFAULT_SETTINGS: KayanSettings = {
  delegatePhone: '0531418018',
  delegateName: 'مندوب كيان للمنظفات',
  propertyName: 'AMASA RESORT',
  locationUrl: 'https://maps.app.goo.gl/k35VPeSdH3k3UXVc9',
};

export const INITIAL_KAYAN_ITEMS: KayanDetergentItem[] = [
  {
    id: 'kayan-101',
    itemCode: 'KY-101',
    name: 'كلوركس منظف ومبيض ملابس',
    category: 'الغسيل والمبيضات',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-102',
    itemCode: 'KY-102',
    name: 'مطهر أرضيات وصنوبر مركز',
    category: 'منظفات الأرضيات والأسطح',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-103',
    itemCode: 'KY-103',
    name: 'سائل غسيل الصحون مركز',
    category: 'منظفات الأرضيات والأسطح',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-104',
    itemCode: 'KY-104',
    name: 'ملمع زجاج وأسطح',
    category: 'منظفات الأرضيات والأسطح',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-105',
    itemCode: 'KY-105',
    name: 'جل غسيل ملابس (عادي / أوتوماتيك)',
    category: 'الغسيل والمبيضات',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-106',
    itemCode: 'KY-106',
    name: 'منعم ومعطر ملابس',
    category: 'الغسيل والمبيضات',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-107',
    itemCode: 'KY-107',
    name: 'معطر جو ومفارش فندقي',
    category: 'المعطرات والتعقيم',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-108',
    itemCode: 'KY-108',
    name: 'معقم ومطهر دورات مياه',
    category: 'المعطرات والتعقيم',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-109',
    itemCode: 'KY-109',
    name: 'صابون يدين سائل فندقي',
    category: 'العناية الشخصية والضيافة',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-110',
    itemCode: 'KY-110',
    name: 'شامبو وجل استحمام ضيافة',
    category: 'العناية الشخصية والضيافة',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-111',
    itemCode: 'KY-111',
    name: 'مناديل وجه (علب ضيافة)',
    category: 'الأوراق والبلاستيك',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-112',
    itemCode: 'KY-112',
    name: 'مناديل رول ماكسي للمطابخ',
    category: 'الأوراق والبلاستيك',
    defaultUnit: 'bale',
  },
  {
    id: 'kayan-113',
    itemCode: 'KY-113',
    name: 'مناديل رول دورات المياه',
    category: 'الأوراق والبلاستيك',
    defaultUnit: 'bale',
  },
  {
    id: 'kayan-114',
    itemCode: 'KY-114',
    name: 'أكياس نفايات كبيرة (50 جالون)',
    category: 'الأوراق والبلاستيك',
    defaultUnit: 'bale',
  },
  {
    id: 'kayan-115',
    itemCode: 'KY-115',
    name: 'أكياس نفايات وسط (30 جالون)',
    category: 'الأوراق والبلاستيك',
    defaultUnit: 'bale',
  },
  {
    id: 'kayan-116',
    itemCode: 'KY-116',
    name: 'كلور مسابح حبيبات / أقراص',
    category: 'العناية بالمسابح',
    defaultUnit: 'piece',
  },
  {
    id: 'kayan-117',
    itemCode: 'KY-117',
    name: 'إسفنج وسلك مواعين',
    category: 'أدوات ومعدات النظافة',
    defaultUnit: 'carton',
  },
  {
    id: 'kayan-118',
    itemCode: 'KY-118',
    name: 'ممسحة أرضيات ومكنسة ناعمة',
    category: 'أدوات ومعدات النظافة',
    defaultUnit: 'piece',
  },
];

export function formatKayanUnitQuantity(quantity: number, unit: KayanUnit): string {
  const safeQty = Math.max(1, Number(quantity) || 1);
  return `${safeQty} ${KAYAN_UNIT_LABELS[unit] || 'حبة'}`;
}

export function generateKayanOrderNumber(existingOrders: KayanOrderSheet[] = []): string {
  const year = new Date().getFullYear();
  const prefix = `KY-${year}-`;
  let maxSeq = 0;
  for (const ord of existingOrders) {
    if (ord.orderNumber && ord.orderNumber.startsWith(prefix)) {
      const n = Number(ord.orderNumber.slice(prefix.length));
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  const nextSeq = String(Math.max(existingOrders.length + 1, maxSeq + 1)).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

export function createKayanOrderSheet(params: {
  items: KayanOrderItem[];
  delegatePhone: string;
  delegateName?: string;
  propertyName?: string;
  locationUrl?: string;
  notes?: string;
  existingOrders?: KayanOrderSheet[];
}): KayanOrderSheet {
  const cleanItems = params.items
    .filter((it) => Number(it.quantity) > 0)
    .map((it) => ({
      itemId: it.itemId,
      itemCode: String(it.itemCode || '').trim(),
      name: String(it.name || '').trim(),
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      unit: it.unit || 'piece',
    }));

  return {
    id: `kayan-ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orderNumber: generateKayanOrderNumber(params.existingOrders),
    createdAt: new Date().toISOString(),
    delegatePhone: String(params.delegatePhone || '').trim(),
    delegateName: params.delegateName?.trim() || undefined,
    propertyName: (params.propertyName || KAYAN_DEFAULT_SETTINGS.propertyName).trim(),
    locationUrl: (params.locationUrl || KAYAN_DEFAULT_SETTINGS.locationUrl).trim(),
    notes: params.notes?.trim() || undefined,
    items: cleanItems,
  };
}

export function formatKayanOrderDateTime(isoStr?: string): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generates clean WhatsApp order text strictly listing:
 * item name + item number + quantity & unit (piece/carton/bale) — NO prices.
 */
export function buildKayanWhatsappMessage(order: KayanOrderSheet): string {
  const lines: string[] = [
    `*طلب توريد منظفات — كيان للمنظفات*`,
    `رقم الطلب: ${order.orderNumber}`,
    `التاريخ: ${formatKayanOrderDateTime(order.createdAt)}`,
    `الجهة: ${order.propertyName}`,
  ];

  if (order.delegateName) {
    lines.push(`المندوب: ${order.delegateName}`);
  }

  lines.push('', '*الأصناف المطلوبة:*');

  order.items.forEach((item, index) => {
    const codePart = item.itemCode ? ` (رقم الصنف: ${item.itemCode})` : '';
    lines.push(`${index + 1}. ${item.name}${codePart} — الكمية: ${formatKayanUnitQuantity(item.quantity, item.unit)}`);
  });

  if (order.notes) {
    lines.push('', `*ملاحظات:* ${order.notes}`);
  }

  if (order.locationUrl) {
    lines.push('', `*موقع التوصيل (الاستراحة):*`, order.locationUrl);
  }

  return lines.join('\n');
}

export function isValidKayanPhone(phone?: string): boolean {
  return normalizeCustomerPhone(phone || '').length >= 9;
}

export function buildKayanWhatsappUrl(delegatePhone: string, order: KayanOrderSheet): string {
  const message = buildKayanWhatsappMessage(order);
  const cleanPhone = String(delegatePhone || '').trim();
  if (!cleanPhone || !isValidKayanPhone(cleanPhone)) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  return buildCustomerWhatsappUrl(cleanPhone, message);
}

export interface SendKayanPdfResult {
  status: 'shared' | 'downloaded' | 'cancelled';
  fileName: string;
  whatsappUrl: string;
  message: string;
}

export async function sendOrDownloadKayanOrderPdf(params: {
  element: HTMLElement;
  order: KayanOrderSheet;
  mode: 'share' | 'download';
}): Promise<SendKayanPdfResult> {
  const { element, order, mode } = params;
  const safeCode = (order.orderNumber || 'طلب').replace(/\s+/g, '_');
  const fileName = sanitizePdfFileName(`طلب_كيان_للمنظفات_${safeCode}.pdf`);

  const pdfFile = await generateContractPdfFile(element, fileName);
  const whatsappUrl = buildKayanWhatsappUrl(order.delegatePhone, order);
  const shortCoverText = `ورقة طلب توريد منظفات — كيان للمنظفات (${order.orderNumber})\nموقع الاستراحة: ${order.locationUrl}`;

  if (mode === 'download') {
    triggerPdfFileDownload(pdfFile);
    return {
      status: 'downloaded',
      fileName: pdfFile.name,
      whatsappUrl,
      message: `تم تنزيل ورقة الطلبات بصيغة PDF (${pdfFile.name}) بنجاح.`,
    };
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare !== 'function' || navigator.canShare({ files: [pdfFile] });
    if (canShareFiles) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `طلب توريد — كيان للمنظفات (${order.orderNumber})`,
          text: shortCoverText,
        });
        return {
          status: 'shared',
          fileName: pdfFile.name,
          whatsappUrl,
          message: `تمت مشاركة ورقة الطلبات (${pdfFile.name}) بصيغة PDF بنجاح.`,
        };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return {
            status: 'cancelled',
            fileName: pdfFile.name,
            whatsappUrl,
            message: 'تم إلغاء مشاركة ورقة الطلبات.',
          };
        }
      }
    }
  }

  triggerPdfFileDownload(pdfFile);
  return {
    status: 'downloaded',
    fileName: pdfFile.name,
    whatsappUrl,
    message: `تم حفظ ورقة الطلبات (${pdfFile.name}) على جهازك — يمكنك إرسالها وإرفاقها مباشرة في محادثة المندوب.`,
  };
}
