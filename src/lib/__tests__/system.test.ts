import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBookingCheckedOut,
  isSupervisorBooking,
  getBookingCommissionAmount,
  getSupervisorBookingTotalCredit,
} from '../financials';
import { generateQRCodeSvg } from '../qrCode';
import { normalizeCustomerPhone, buildCustomerWhatsappUrl, buildCustomerCallUrl } from '../customerLinks';
import {
  getBookingOwnerCategory,
  getBookingReceiptsList,
  clearBookingReceiptsAfterCommissionPaid,
  hasAnyBookingReceiptFields,
  isPdfReceiptUrl,
} from '../bookingReceipts';
import { Booking, Property, Guard } from '../../types';
import {
  buildOfficialContractData,
  formatArabicGregorianDate,
  formatNightsArabicLabel,
  sanitizePdfFileName,
} from '../contractPdf';
import { createChimeWavBytes } from '../sound';
import { doesPushSubscriberMatchTarget } from '../pushMatching';
import { isNewerBuildAvailable } from '../pwaUpdater';
import {
  buildKayanWhatsappMessage,
  buildKayanWhatsappUrl,
  createKayanOrderSheet,
  formatKayanUnitQuantity,
  INITIAL_KAYAN_ITEMS,
  KAYAN_DEFAULT_SETTINGS,
} from '../kayanDetergents';
import {
  clonePropertyAsDuplicate,
  clonePropertySection,
  createDefaultSectionsForProperty,
  executePropertyOrSectionTransfer,
  resolveContractTemplateAndTerms,
  resolvePropertyHasSections,
} from '../propertyUtils';
import { INITIAL_TEMPLATES } from '../../data/mock';

test('Financial helper: isBookingCheckedOut', () => {
  const b1: Booking = { id: 'b1', status: 'confirmed', checkedOut: true } as any;
  const b2: Booking = { id: 'b2', status: 'confirmed', checkedOut: false } as any;
  const b3: Booking = { id: 'b3', status: 'completed' } as any;
  const b4: Booking = { id: 'b4', status: 'cancelled', checkedOut: true } as any;

  assert.equal(isBookingCheckedOut(b1), true);
  assert.equal(isBookingCheckedOut(b2), false);
  assert.equal(isBookingCheckedOut(b3), true);
  assert.equal(isBookingCheckedOut(b4), false);
});

test('Financial helper: isSupervisorBooking & commission', () => {
  const sb: Booking = {
    id: 'sb1',
    isSupervisorBooking: true,
    supervisorId: 'm1',
    totalPrice: 2000,
    commissionRatePercent: 5,
    supervisorFee: 300,
    status: 'confirmed',
  } as any;

  assert.equal(isSupervisorBooking(sb), true);
  assert.equal(getBookingCommissionAmount(sb), 100);
  assert.equal(getSupervisorBookingTotalCredit(sb, [], []), 400);
});

test('QR code generator outputs valid data URI SVG', () => {
  const qrUri = generateQRCodeSvg('AMASA-BOOKING-2026-101', 120);
  assert.equal(qrUri.startsWith('data:image/svg+xml;utf8,'), true);
  assert.equal(qrUri.includes('AMASA'), true);
});

test('Customer phone normalization & direct WhatsApp/tel link generation', () => {
  assert.equal(normalizeCustomerPhone('0501234567'), '966501234567');
  assert.equal(normalizeCustomerPhone('00966 50 123 4567'), '966501234567');
  assert.equal(buildCustomerCallUrl('0501234567'), 'tel:+966501234567');
  const waUrl = buildCustomerWhatsappUrl('0501234567', 'مرحباً بكم');
  assert.equal(waUrl.startsWith('https://wa.me/966501234567?text='), true);
});

test('Booking receipts: owner categories (marketer, admin, supervisor)', () => {
  const marketerBooking: Booking = {
    id: 'bk-m',
    marketerId: 'm-1',
    bookingType: 'marketer',
  } as any;
  const adminBooking: Booking = {
    id: 'bk-a',
    isAdminBooking: true,
    bookingType: 'admin',
  } as any;
  const supervisorBooking: Booking = {
    id: 'bk-s',
    isSupervisorBooking: true,
    marketerId: 'sup-1',
    bookingType: 'supervisor',
  } as any;

  assert.equal(getBookingOwnerCategory(marketerBooking), 'marketer');
  assert.equal(getBookingOwnerCategory(adminBooking), 'admin');
  assert.equal(getBookingOwnerCategory(supervisorBooking), 'supervisor');
});

test('Booking receipts: list extraction & deletion after commission payout', () => {
  const bookingWithReceipts: Booking = {
    id: 'bk-r1',
    marketerId: 'm-1',
    marketerName: 'مسوق تجريبي',
    depositReceiptUrl: 'data:image/jpeg;base64,/9j/4AAQ',
    depositReceiptName: 'deposit.jpg',
    remainingReceiptDataUrl: 'data:application/pdf;base64,JVBERi0x',
    remainingReceiptName: 'remaining.pdf',
    digitalInsuranceReceiptUrl: 'data:image/png;base64,iVBOR',
    digitalInsuranceReceiptName: 'insurance.png',
    insuranceRefundReceiptUrl: 'data:image/jpeg;base64,/9j/refund',
    customerBankReceiptUrl: 'data:image/jpeg;base64,/9j/bank',
    commissionStatus: 'pending',
  } as any;

  const list = getBookingReceiptsList(bookingWithReceipts);
  assert.equal(list.length, 5);
  assert.equal(isPdfReceiptUrl(list[1].dataUrl, list[1].fileName), true);
  assert.equal(hasAnyBookingReceiptFields(bookingWithReceipts), true);

  const cleared = clearBookingReceiptsAfterCommissionPaid(bookingWithReceipts);
  assert.equal(cleared.commissionStatus, 'paid');
  assert.equal(cleared.receiptsDeletedAfterCommissionPaid, true);
  assert.equal(hasAnyBookingReceiptFields(cleared), false);
  assert.equal(getBookingReceiptsList(cleared).length, 0);
});

test('Official contract PDF data builder & Arabic formatting', () => {
  assert.equal(formatNightsArabicLabel(1), 'ليلة واحدة');
  assert.equal(formatNightsArabicLabel(2), 'ليلتان');
  assert.equal(formatNightsArabicLabel(5), '5 ليالٍ');
  assert.equal(formatArabicGregorianDate('2026-11-11'), 'الأربعاء، 11 نوفمبر 2026');
  assert.equal(sanitizePdfFileName('عقد/إيجار: فيلا*ألما'), 'عقد_إيجار_ فيلا_ألما.pdf');

  const prop: Property = {
    id: 'hamran',
    name: 'فيلا ألما',
    code: 'HAM',
    subUnitsCount: 2,
    subtitle: 'فندقية',
    location: 'أبها - حمران',
    coordinates: { lat: 18.2, lng: 42.5 },
    isPublished: true,
    basePriceWeekday: 1600,
    basePriceWeekend: 1900,
    seasonalPricing: { weekday: 1600, weekend: 1900, summer: 2000, eid: 2200, vacation: 1800 },
    administrativeFees: { weekday: 100, weekend: 150, summer: 150, eid: 200, vacation: 150 },
    capacity: 30,
    bedrooms: 3,
    bathrooms: 3,
    areaM2: 450,
    poolType: 'داخلي',
    coverImage: '',
    images: [],
    features: [],
    contractTerms: ['المحافظة على المرافق', 'عدم إزعاج الجيران'],
    iban: 'SA123',
    bankName: 'الراجحي',
    accountHolder: 'AMASA RESORT',
    defaultDeposit: 500,
    insuranceAmount: 500,
    checkInTimeText: 'من الساعة ٣ إلى ٤ عصراً',
    checkOutTimeText: 'الساعة ١ ظهراً',
    wifiName: 'Alma-5G',
    wifiPassword: '3',
    breakfastNote: 'يحضره الحارس إلى الفيلا يومياً',
    assignedGuardId: 'g1',
  };

  const guard: Guard = {
    id: 'g1',
    name: 'عبدالله',
    phone: '0501220719',
    email: 'g@amasa.sa',
    avatar: '',
  };

  const booking: Partial<Booking> = {
    bookingNumber: 'BK-2026-150',
    propertyId: 'hamran',
    sectionName: 'ألما ونايا الفندقية',
    customerName: 'حسام محمد الغامدي',
    customerPhone: '0544294587',
    customerNationalId: '1099103465',
    vehiclePlate: 'د ب ي 8972',
    guestsCount: 30,
    checkInDate: '2026-11-11',
    checkOutDate: '2026-11-12',
    nightsCount: 1,
    totalPrice: 1600,
    depositPaid: 500,
    remainingAmount: 1100,
    insuranceAmount: 500,
  };

  const data = buildOfficialContractData({ booking, property: prop, guards: [guard] });
  assert.equal(data.mainTitle, 'عقد إيجار فيلا ألما');
  assert.equal(data.customerNationalId, '1099103465');
  assert.equal(data.vehiclePlate, 'د ب ي 8972');
  assert.equal(data.nightsLabel, 'ليلة واحدة');
  assert.equal(data.guestsCount, 30);
  assert.equal(data.guardName, 'عبدالله');
  assert.equal(data.guardPhone, '0501220719');
  assert.equal(data.wifiDisplay, 'Alma-5G • كلمة المرور: 3');
  assert.equal(data.hasFinancialMismatch, false);
  assert.equal(data.breakfastBanner.show, true);
  assert.equal(data.contractTerms.length, 2);
});

test('PCM WAV chime generator produces valid RIFF/WAVE header and audio samples', () => {
  const wav = createChimeWavBytes(22050);
  assert.equal(wav.length > 44, true);
  assert.equal(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]), 'RIFF');
  assert.equal(String.fromCharCode(wav[8], wav[9], wav[10], wav[11]), 'WAVE');
  assert.equal(String.fromCharCode(wav[12], wav[13], wav[14], wav[15]), 'fmt ');
  assert.equal(String.fromCharCode(wav[36], wav[37], wav[38], wav[39]), 'data');

  let maxSample = 0;
  for (let i = 44; i < wav.length - 1; i += 2) {
    const val = Math.abs((wav[i] | (wav[i + 1] << 8)) << 16 >> 16);
    if (val > maxSample) maxSample = val;
  }
  assert.equal(maxSample > 1000, true);
});

test('Web Push audience matcher respects role and property targeting', () => {
  const admin = { role: 'admin', isAdmin: true };
  const guardTaraf = { role: 'guard', guardId: 'g-1', guardPropertyIds: ['al-taraf'] };
  const guardHamran = { role: 'guard', guardId: 'g-2', guardPropertyIds: ['hamran'] };
  const marketer1 = { role: 'marketer', marketerId: 'm-1', isSupervisor: false };
  const supervisor = { role: 'marketer', marketerId: 'm-sup', isSupervisor: true };

  assert.equal(doesPushSubscriberMatchTarget(admin, { targetAudience: 'admin_only' }), true);
  assert.equal(doesPushSubscriberMatchTarget(guardTaraf, { targetAudience: 'admin_only' }), false);
  assert.equal(doesPushSubscriberMatchTarget(guardTaraf, { targetAudience: 'guards', propertyId: 'al-taraf' }), true);
  assert.equal(doesPushSubscriberMatchTarget(guardHamran, { targetAudience: 'guards', propertyId: 'al-taraf' }), false);
  assert.equal(doesPushSubscriberMatchTarget(marketer1, { targetAudience: 'marketers', targetMarketerId: 'm-1' }), true);
  assert.equal(doesPushSubscriberMatchTarget(marketer1, { targetAudience: 'marketers', targetMarketerId: 'm-2' }), false);
  assert.equal(doesPushSubscriberMatchTarget(supervisor, { isSupervisorNotification: true }), true);
  assert.equal(doesPushSubscriberMatchTarget(marketer1, { isSupervisorNotification: true }), false);
});

test('PWA version comparator detects production updates without false triggers in dev', () => {
  assert.equal(isNewerBuildAvailable('dev-live', 'v-123'), false);
  assert.equal(isNewerBuildAvailable('v-100', 'dev-live'), false);
  assert.equal(isNewerBuildAvailable('v-100', 'v-100'), false);
  assert.equal(isNewerBuildAvailable('v-100', 'v-200'), true);
});

test('Kayan Detergents order sheet builds strict name/code/unit-qty message without prices', () => {
  assert.equal(INITIAL_KAYAN_ITEMS.length >= 10, true);
  assert.equal(KAYAN_DEFAULT_SETTINGS.delegatePhone, '0531418018');
  assert.equal(formatKayanUnitQuantity(3, 'piece'), '3 حبة');
  assert.equal(formatKayanUnitQuantity(2, 'carton'), '2 كرتون');
  assert.equal(formatKayanUnitQuantity(1, 'bale'), '1 بالة');

  const order = createKayanOrderSheet({
    delegatePhone: '0559988776',
    propertyName: 'AMASA RESORT',
    locationUrl: KAYAN_DEFAULT_SETTINGS.locationUrl,
    items: [
      { itemId: 'kayan-101', itemCode: 'KY-101', name: 'كلوركس منظف ومبيض ملابس', quantity: 2, unit: 'carton' },
      { itemId: 'kayan-114', itemCode: 'KY-114', name: 'أكياس نفايات كبيرة (50 جالون)', quantity: 4, unit: 'bale' },
    ],
  });

  const msg = buildKayanWhatsappMessage(order);
  assert.equal(msg.includes('KY-101'), true);
  assert.equal(msg.includes('2 كرتون'), true);
  assert.equal(msg.includes('4 بالة'), true);
  assert.equal(msg.includes('https://maps.app.goo.gl/k35VPeSdH3k3UXVc9'), true);
  assert.equal(msg.includes('ريال'), false);

  const waUrl = buildKayanWhatsappUrl('0559988776', order);
  assert.equal(waUrl.startsWith('https://wa.me/966559988776?text='), true);
});

test('Property & section duplication deep-clones fields, preserves flags, and avoids mutating source', () => {
  const originalProp: Property = {
    id: 'al-taraf',
    name: 'الترف',
    code: '#83820',
    subUnitsCount: 2,
    subtitle: 'شاليه الترف',
    location: 'الرياض',
    coordinates: { lat: 24.8, lng: 46.8 },
    isPublished: true,
    basePriceWeekday: 1200,
    basePriceWeekend: 1600,
    seasonalPricing: { weekday: 1200, weekend: 1600, summer: 1400, eid: 2500, vacation: 1800 },
    administrativeFees: { weekday: 50, weekend: 100, summer: 100, eid: 200, vacation: 150 },
    hasSections: true,
    hasBreakfast: true,
    hasCoordinatorServices: false,
    sections: [
      {
        id: 'section-1',
        name: 'القسم الأول',
        title: 'قسم الضيافة',
        subtitle: 'تفاصيل القسم',
        priceWeekday: 750,
        priceWeekend: 950,
        capacity: 25,
        bedrooms: 1,
        bathrooms: 2,
        areaM2: 420,
        poolType: 'مسبح دافئ',
        features: ['مسبح', 'مجلس'],
        images: ['img1.jpg'],
        hasBreakfast: true,
        hasCoordinatorServices: false,
      },
    ],
    capacity: 25,
    bedrooms: 2,
    bathrooms: 3,
    areaM2: 750,
    poolType: 'مسبح دافئ',
    coverImage: 'cover.jpg',
    images: ['img1.jpg'],
    features: ['واي فاي'],
    contractTerms: ['شرط 1'],
    iban: 'SA03',
    bankName: 'الراجحي',
    accountHolder: 'AMASA RESORT',
    defaultDeposit: 300,
    insuranceAmount: 500,
    checkInTimeText: '٥ م',
    checkOutTimeText: '٢ م',
  };

  assert.equal(resolvePropertyHasSections(originalProp), true);
  assert.equal(resolvePropertyHasSections({ ...originalProp, hasSections: false }), false);

  const dupProp = clonePropertyAsDuplicate(originalProp, 1700000000000);
  assert.notEqual(dupProp.id, originalProp.id);
  assert.notEqual(dupProp.code, originalProp.code);
  assert.equal(dupProp.name, 'الترف (نسخة)');
  assert.equal(dupProp.isPublished, false);
  assert.equal(dupProp.hasSections, true);
  assert.equal(dupProp.hasBreakfast, true);
  assert.equal(dupProp.hasCoordinatorServices, false);
  assert.equal(dupProp.sections?.length, 1);
  assert.notEqual(dupProp.sections?.[0].id, originalProp.sections?.[0].id);

  // Mutating duplicated features/sections must not affect original
  dupProp.features.push('ميزة إضافية');
  dupProp.sections?.[0].features.push('ميزة قسم');
  assert.equal(originalProp.features.length, 1);
  assert.equal(originalProp.sections?.[0].features.length, 2);

  const dupSec = clonePropertySection(originalProp, originalProp.sections![0], 1700000000001);
  assert.notEqual(dupSec.id, originalProp.sections![0].id);
  assert.equal(dupSec.name, 'القسم الأول (نسخة)');
  assert.equal(dupSec.hasBreakfast, true);
  assert.equal(dupSec.hasCoordinatorServices, false);

  const defaultSecs = createDefaultSectionsForProperty(originalProp, 1700000000002);
  assert.equal(defaultSecs.length, 2);
  assert.equal(defaultSecs[0].hasBreakfast, true);
  assert.equal(defaultSecs[0].hasCoordinatorServices, false);
});

test('INITIAL_TEMPLATES omits removed bookingConfirmation template', () => {
  assert.equal('bookingConfirmation' in INITIAL_TEMPLATES, false);
  assert.equal(typeof INITIAL_TEMPLATES.contract, 'string');
  assert.equal(typeof INITIAL_TEMPLATES.depositRequest, 'string');
});

test('Per-unit and per-section contract template and terms resolution', () => {
  const prop: Property = {
    id: 'p1',
    name: 'شاليه الترف',
    code: '#100',
    subUnitsCount: 2,
    subtitle: 'وصف',
    location: 'الرياض',
    coordinates: { lat: 24.7, lng: 46.6 },
    isPublished: true,
    basePriceWeekday: 1400,
    basePriceWeekend: 1800,
    seasonalPricing: { weekday: 1400, weekend: 1800, summer: 1600, eid: 2200, vacation: 1800 },
    administrativeFees: { weekday: 100, weekend: 150, summer: 150, eid: 200, vacation: 150 },
    hasSections: true,
    contractTemplate: 'عقد كامل العقار {اسم_العقار} للعميل {اسم_العميل}',
    contractTerms: ['شرط العقار العام'],
    sections: [
      {
        id: 'sec-a',
        name: 'قسم النخيل',
        title: 'النخيل',
        subtitle: 'وصف',
        priceWeekday: 800,
        priceWeekend: 1000,
        capacity: 15,
        bedrooms: 1,
        bathrooms: 1,
        areaM2: 300,
        poolType: 'مسبح',
        features: [],
        images: [],
        contractTemplate: 'عقد قسم النخيل الخاص للعميل {اسم_العميل}',
        contractTerms: ['شرط خاص بقسم النخيل'],
      },
      {
        id: 'sec-b',
        name: 'قسم الورود',
        title: 'الورود',
        subtitle: 'وصف',
        priceWeekday: 700,
        priceWeekend: 900,
        capacity: 12,
        bedrooms: 1,
        bathrooms: 1,
        areaM2: 250,
        poolType: 'مسبح',
        features: [],
        images: [],
      },
    ],
    capacity: 30,
    bedrooms: 2,
    bathrooms: 2,
    areaM2: 600,
    poolType: 'مسبح',
    coverImage: '',
    images: [],
    features: [],
    iban: 'SA00',
    bankName: 'الراجحي',
    accountHolder: 'AMASA RESORT',
    defaultDeposit: 300,
    insuranceAmount: 500,
    checkInTimeText: '4 م',
    checkOutTimeText: '2 م',
  };

  // Section A has custom template & terms
  const resSecA = resolveContractTemplateAndTerms({
    property: prop,
    sectionId: 'sec-a',
    globalFallbackTemplate: 'عام',
  });
  assert.equal(resSecA.source, 'section');
  assert.equal(resSecA.template, 'عقد قسم النخيل الخاص للعميل {اسم_العميل}');
  assert.deepEqual(resSecA.terms, ['شرط خاص بقسم النخيل']);

  // Section B inherits property-level custom template & terms
  const resSecB = resolveContractTemplateAndTerms({
    property: prop,
    sectionId: 'sec-b',
    globalFallbackTemplate: 'عام',
  });
  assert.equal(resSecB.source, 'property');
  assert.equal(resSecB.template, 'عقد كامل العقار {اسم_العقار} للعميل {اسم_العميل}');
  assert.deepEqual(resSecB.terms, ['شرط العقار العام']);

  // Full property ("all") resolves property-level template
  const resFull = resolveContractTemplateAndTerms({
    property: prop,
    sectionId: 'all',
    globalFallbackTemplate: 'عام',
  });
  assert.equal(resFull.source, 'property');

  // PDF official data uses section-specific terms when booked section has custom terms
  const pdfData = buildOfficialContractData({
    booking: { propertyId: 'p1', sectionId: 'sec-a', sectionName: 'قسم النخيل' },
    property: prop,
  });
  assert.deepEqual(pdfData.contractTerms, ['شرط خاص بقسم النخيل']);
});

test('Flexible unit & section transfer handles all open transfer modes cleanly', () => {
  const propA: Property = {
    id: 'prop-a',
    name: 'استراحة أ',
    code: '#111',
    subUnitsCount: 2,
    subtitle: 'أ',
    location: 'الرياض',
    coordinates: { lat: 24.7, lng: 46.6 },
    isPublished: true,
    basePriceWeekday: 1500,
    basePriceWeekend: 1900,
    seasonalPricing: { weekday: 1500, weekend: 1900, summer: 1600, eid: 2200, vacation: 1800 },
    administrativeFees: { weekday: 100, weekend: 150, summer: 150, eid: 200, vacation: 150 },
    hasSections: true,
    sections: [
      {
        id: 'sec-1',
        name: 'القسم الذهبي',
        title: 'الذهبي',
        subtitle: 'وصف الذهبي',
        priceWeekday: 850,
        priceWeekend: 1100,
        capacity: 20,
        bedrooms: 1,
        bathrooms: 1,
        areaM2: 350,
        poolType: 'مسبح',
        features: ['جاكوزي'],
        images: [],
        contractTemplate: 'عقد القسم الذهبي',
      },
      {
        id: 'sec-2',
        name: 'القسم الفضي',
        title: 'الفضي',
        subtitle: 'وصف الفضي',
        priceWeekday: 750,
        priceWeekend: 950,
        capacity: 15,
        bedrooms: 1,
        bathrooms: 1,
        areaM2: 300,
        poolType: 'مسبح',
        features: [],
        images: [],
      },
    ],
    capacity: 35,
    bedrooms: 2,
    bathrooms: 2,
    areaM2: 650,
    poolType: 'مسبح',
    coverImage: '',
    images: [],
    features: ['مجلس'],
    contractTerms: ['شرط أ'],
    iban: 'SA1',
    bankName: 'الراجحي',
    accountHolder: 'AMASA RESORT',
    defaultDeposit: 300,
    insuranceAmount: 500,
    checkInTimeText: '4 م',
    checkOutTimeText: '2 م',
  };

  const propB: Property = {
    ...propA,
    id: 'prop-b',
    name: 'استراحة ب',
    code: '#222',
    subUnitsCount: 1,
    hasSections: false,
    sections: undefined,
    contractTerms: ['شرط ب'],
  };

  const sampleBookings: Booking[] = [
    {
      id: 'bk-1',
      bookingNumber: 'BK-1',
      propertyId: 'prop-a',
      propertyName: 'استراحة أ',
      sectionId: 'sec-1',
      sectionName: 'القسم الذهبي',
    } as any,
  ];

  // 1. Move section from propA to propB and migrate its bookings
  const moveSecRes = executePropertyOrSectionTransfer([propA, propB], sampleBookings, {
    mode: 'section_to_property',
    sourcePropertyId: 'prop-a',
    sourceSectionId: 'sec-1',
    targetPropertyId: 'prop-b',
    keepOriginal: false,
    transferBookings: true,
    now: 1700000100000,
  });
  assert.equal(moveSecRes.success, true);
  assert.equal(moveSecRes.movedBookingsCount, 1);
  const movedA = moveSecRes.properties.find((p) => p.id === 'prop-a')!;
  const movedB = moveSecRes.properties.find((p) => p.id === 'prop-b')!;
  assert.equal(movedA.sections?.length, 1);
  assert.equal(movedB.hasSections, true);
  assert.equal(movedB.sections?.length, 1);
  assert.equal(movedB.sections?.[0].contractTemplate, 'عقد القسم الذهبي');
  assert.equal(moveSecRes.bookings[0].propertyId, 'prop-b');

  // 2. Promote section to standalone property (keepOriginal: true)
  const standaloneRes = executePropertyOrSectionTransfer(moveSecRes.properties, moveSecRes.bookings, {
    mode: 'section_to_standalone',
    sourcePropertyId: 'prop-a',
    sourceSectionId: 'sec-2',
    newName: 'فيلا الفضي المستقلة',
    keepOriginal: true,
    now: 1700000200000,
  });
  assert.equal(standaloneRes.success, true);
  assert.equal(standaloneRes.properties.length, 3);
  const newStandalone = standaloneRes.properties.find((p) => p.name === 'فيلا الفضي المستقلة')!;
  assert.equal(newStandalone.hasSections, false);
  assert.equal(newStandalone.basePriceWeekday, 750);
  // Source section kept because keepOriginal: true
  assert.equal(standaloneRes.properties.find((p) => p.id === 'prop-a')?.sections?.length, 1);

  // 3. Move standalone unit into propB as a section and remove standalone unit
  const mergeUnitRes = executePropertyOrSectionTransfer(standaloneRes.properties, standaloneRes.bookings, {
    mode: 'unit_to_property_section',
    sourcePropertyId: newStandalone.id,
    targetPropertyId: 'prop-b',
    keepOriginal: false,
    now: 1700000300000,
  });
  assert.equal(mergeUnitRes.success, true);
  assert.equal(mergeUnitRes.properties.length, 2);
  assert.equal(mergeUnitRes.properties.find((p) => p.id === 'prop-b')?.sections?.length, 2);
});



