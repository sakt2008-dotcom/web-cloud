import { Booking, EstatePartRef, Property, PropertySection } from '../types';

export interface ContractVariableMeta {
  tag: string;
  label: string;
  sample: string;
}

export const CONTRACT_TEMPLATE_VARIABLES: ContractVariableMeta[] = [
  { tag: '{اسم_العميل}', label: 'اسم العميل', sample: 'خالد العتيبي' },
  { tag: '{رقم_الجوال}', label: 'رقم جوال العميل', sample: '0555123456' },
  { tag: '{رقم_الحجز}', label: 'رقم الحجز', sample: 'BK-2026-105' },
  { tag: '{اسم_العقار}', label: 'اسم العقار / الوحدة', sample: 'الترف' },
  { tag: '{اسم_القسم}', label: 'اسم القسم (إن وجد)', sample: 'القسم الأول' },
  { tag: '{تاريخ_الدخول}', label: 'تاريخ الدخول', sample: 'الخميس 15 أكتوبر 2026 م' },
  { tag: '{وقت_الدخول}', label: 'وقت الدخول', sample: 'الساعة 4:00 عصراً' },
  { tag: '{تاريخ_الخروج}', label: 'تاريخ الخروج', sample: 'الجمعة 16 أكتوبر 2026 م' },
  { tag: '{وقت_الخروج}', label: 'وقت الخروج', sample: 'الساعة 2:00 ظهراً' },
  { tag: '{عدد_الليالي}', label: 'عدد الليالي', sample: '1' },
  { tag: '{المبلغ_الإجمالي}', label: 'المبلغ الإجمالي', sample: '1200' },
  { tag: '{مبلغ_العربون}', label: 'العربون المدفوع', sample: '300' },
  { tag: '{المبلغ_المتبقي}', label: 'المبلغ المتبقي', sample: '900' },
  { tag: '{مبلغ_التأمين}', label: 'مبلغ التأمين', sample: '500' },
  { tag: '{شروط_العقد}', label: 'بنود الشروط والأحكام', sample: '1. يلتزم المستأجر بتسليم الاستراحة في الموعد المحدد.\n2. يُعاد مبلغ التأمين كاملاً عند التسليم.' },
  { tag: '{رقم_الإدارة}', label: 'واتساب الإدارة', sample: '0599525515' },
];

export function buildDefaultUnitContractTemplate(params: {
  unitLabel: string;
  sectionLabel?: string;
}): string {
  const headerName = params.sectionLabel
    ? `${params.unitLabel} - ${params.sectionLabel}`
    : params.unitLabel;

  return `عقد إيجار (${headerName}) 🏕️
رقم الحجز: {رقم_الحجز}
اسم العميل: {اسم_العميل}
رقم الجوال: {رقم_الجوال}
${params.sectionLabel ? 'القسم المحجوز: {اسم_القسم}\n' : ''}يوم الدخول: {تاريخ_الدخول} ({وقت_الدخول})
يوم الخروج: {تاريخ_الخروج} ({وقت_الخروج})
عدد الليالي: {عدد_الليالي}
المبلغ المتفق عليه: {المبلغ_الإجمالي} ريال
العربون المدفوع: {مبلغ_العربون} ريال
المتبقي عند الدخول: {المبلغ_المتبقي} ريال
التأمين المسترد: {مبلغ_التأمين} ريال

📌 الشروط والأحكام:
{شروط_العقد}

📱 واتساب إدارة AMASA RESORT الرسمي: {رقم_الإدارة}`;
}

export function findMatchedSection(
  property?: Property,
  sectionId?: string,
  sectionName?: string
): PropertySection | undefined {
  if (!property?.sections || property.sections.length === 0) return undefined;
  if (sectionId && sectionId !== 'all') {
    const byId = property.sections.find((s) => s.id === sectionId);
    if (byId) return byId;
  }
  if (sectionName && sectionName.trim() && sectionName.trim() !== 'كامل العقار' && sectionName.trim() !== 'كامل الاستراحة') {
    const clean = sectionName.trim();
    const byName = property.sections.find(
      (s) => s.name.trim() === clean || s.title?.trim() === clean
    );
    if (byName) return byName;
  }
  return undefined;
}

export function resolveContractTemplateAndTerms(params: {
  property?: Property;
  sectionId?: string;
  sectionName?: string;
  globalFallbackTemplate?: string;
}): {
  template: string;
  terms: string[];
  source: 'section' | 'property' | 'global';
  matchedSection?: PropertySection;
} {
  const { property, sectionId, sectionName, globalFallbackTemplate = '' } = params;
  const matchedSection = findMatchedSection(property, sectionId, sectionName);

  const defaultTerms = [
    'يلتزم المستأجر بالمحافظة على كافة مرافق الشاليه ومحتوياته وتسليمه في موعد الخروج المحدد.',
    'يُعاد مبلغ التأمين المسترد كاملاً عند المغادرة بعد معاينة الحارس وسلامة كافة المرافق والتجهيزات.',
    'العربون المدفوع غير قابل للاسترداد في حال إلغاء الحجز من طرف المستأجر.',
  ];

  const terms =
    matchedSection?.contractTerms && matchedSection.contractTerms.length > 0
      ? matchedSection.contractTerms
      : property?.contractTerms && property.contractTerms.length > 0
      ? property.contractTerms
      : defaultTerms;

  if (matchedSection?.contractTemplate && matchedSection.contractTemplate.trim()) {
    return {
      template: matchedSection.contractTemplate,
      terms,
      source: 'section',
      matchedSection,
    };
  }

  if (property?.contractTemplate && property.contractTemplate.trim()) {
    return {
      template: property.contractTemplate,
      terms,
      source: 'property',
      matchedSection,
    };
  }

  return {
    template: globalFallbackTemplate,
    terms,
    source: 'global',
    matchedSection,
  };
}

export function resolvePropertyHasSections(prop: Partial<Property>): boolean {
  if (prop.hasSections !== undefined) {
    return Boolean(prop.hasSections);
  }
  return Boolean(prop.sections && prop.sections.length > 0);
}

export function createDefaultSectionsForProperty(
  prop: Property,
  now: number = Date.now()
): PropertySection[] {
  return [
    {
      id: `sec-${now}-1`,
      name: 'القسم الأول',
      title: 'قسم الضيافة والمسبح',
      subtitle: 'قسم مجهز بمجلس ضيافة ومسبح مستقل',
      priceWeekday: Math.round((prop.basePriceWeekday || 1000) * 0.6),
      priceWeekend: Math.round((prop.basePriceWeekend || 1400) * 0.6),
      capacity: Math.round((prop.capacity || 20) * 0.6),
      bedrooms: 1,
      bathrooms: 1,
      areaM2: Math.round((prop.areaM2 || 400) * 0.5),
      poolType: prop.poolType || 'مسبح خاص',
      features: ['مجلس ضيافة', 'مسبح خاص'],
      images: [...(prop.images || [])],
      coverImage: prop.coverImage,
      isAvailable: true,
      hasBreakfast: prop.hasBreakfast ?? false,
      hasCoordinatorServices: prop.hasCoordinatorServices ?? false,
    },
    {
      id: `sec-${now}-2`,
      name: 'القسم الثاني',
      title: 'قسم الاسترخاء والجلسات',
      subtitle: 'قسم مجهز بجلسات خارجية وحديقة هادئة',
      priceWeekday: Math.round((prop.basePriceWeekday || 1000) * 0.5),
      priceWeekend: Math.round((prop.basePriceWeekend || 1400) * 0.5),
      capacity: Math.round((prop.capacity || 20) * 0.5),
      bedrooms: 1,
      bathrooms: 1,
      areaM2: Math.round((prop.areaM2 || 400) * 0.5),
      poolType: prop.poolType || 'مسبح خاص',
      features: ['صالة جلوس', 'حديقة خارجية'],
      images: [...(prop.images || [])],
      coverImage: prop.coverImage,
      isAvailable: true,
      hasBreakfast: prop.hasBreakfast ?? false,
      hasCoordinatorServices: prop.hasCoordinatorServices ?? false,
    },
  ];
}

export function clonePropertySection(
  prop: Property,
  sec: PropertySection,
  now: number = Date.now()
): PropertySection {
  const newSecId = `sec-${now}-${Math.floor(100 + Math.random() * 900)}`;
  const newSecName = `${sec.name} (نسخة)`;
  return {
    ...sec,
    id: newSecId,
    name: newSecName,
    title: sec.title ? `${sec.title} (نسخة)` : newSecName,
    features: [...(sec.features || [])],
    images: [...(sec.images || [])],
    hasBreakfast: sec.hasBreakfast ?? prop.hasBreakfast ?? false,
    hasCoordinatorServices: sec.hasCoordinatorServices ?? prop.hasCoordinatorServices ?? false,
    contractTemplate: sec.contractTemplate,
    contractTerms: sec.contractTerms ? [...sec.contractTerms] : undefined,
  };
}

export function clonePropertyAsDuplicate(
  orig: Property,
  now: number = Date.now()
): Property {
  const randomCodeNum = Math.floor(10000 + Math.random() * 90000);
  const newId = `prop-${now}`;
  const newName = `${orig.name} (نسخة)`;
  const newCode = `#${randomCodeNum}`;

  const duplicatedSections = orig.sections?.map((sec, idx) => ({
    ...sec,
    id: `sec-${now}-${idx + 1}`,
    name: sec.name,
    title: sec.title,
    features: [...(sec.features || [])],
    images: [...(sec.images || [])],
    hasBreakfast: sec.hasBreakfast ?? orig.hasBreakfast ?? false,
    hasCoordinatorServices: sec.hasCoordinatorServices ?? orig.hasCoordinatorServices ?? false,
    contractTemplate: sec.contractTemplate,
    contractTerms: sec.contractTerms ? [...sec.contractTerms] : undefined,
  }));

  return {
    ...orig,
    id: newId,
    name: newName,
    code: newCode,
    isPublished: false,
    hasSections: resolvePropertyHasSections(orig),
    hasBreakfast: orig.hasBreakfast ?? false,
    hasCoordinatorServices: orig.hasCoordinatorServices ?? false,
    sections: duplicatedSections,
    subUnitsCount:
      duplicatedSections && duplicatedSections.length > 0
        ? duplicatedSections.length
        : orig.subUnitsCount || 1,
    images: [...(orig.images || [])],
    features: [...(orig.features || [])],
    contractTerms: [...(orig.contractTerms || [])],
    contractTemplate: orig.contractTemplate,
    videoUrls: orig.videoUrls ? [...orig.videoUrls] : undefined,
    videoItems: orig.videoItems ? orig.videoItems.map((v) => ({ ...v })) : undefined,
    customPricingPeriods: orig.customPricingPeriods
      ? orig.customPricingPeriods.map((c) => ({ ...c }))
      : undefined,
    specialAdminFeeBoxes: orig.specialAdminFeeBoxes
      ? orig.specialAdminFeeBoxes.map((s, idx) => ({
          ...s,
          id: `box-${now}-${idx + 1}`,
        }))
      : undefined,
  };
}

export type TransferMode =
  | 'section_to_property' // نقل قسم من عقار إلى عقار آخر كقسم
  | 'section_to_standalone' // فصل قسم إلى وحدة / عقار مستقل جديد
  | 'unit_to_property_section' // نقل وحدة/عقار إلى داخل عقار آخر كقسم (أو دمج أقسامه)
  | 'unit_to_unit'; // نقل مواصفات وأسعار وقالب عقد وحدة/قسم إلى وحدة/قسم آخر

export interface TransferUnitOrSectionParams {
  mode: TransferMode;
  sourcePropertyId: string;
  sourceSectionId?: string;
  targetPropertyId?: string;
  targetSectionId?: string;
  newName?: string;
  keepOriginal?: boolean; // الإبقاء على الأصل (نسخ ونقل) أم إزالته من المصدر
  moveAllSourceSections?: boolean; // في حالة نقل عقار يحتوي أقسام إلى عقار آخر: نقل أقسامه أم دمجه كقسم واحد
  transferBookings?: boolean; // تحديث الحجوزات المرتبطة لتنتقل للوجهة الجديدة
  now?: number;
}

export interface TransferUnitOrSectionResult {
  success: boolean;
  message: string;
  properties: Property[];
  bookings: Booking[];
  createdOrTargetPropertyId?: string;
  createdOrTargetSectionId?: string;
  removedSourcePropertyId?: string;
  movedBookingsCount: number;
}

export function executePropertyOrSectionTransfer(
  properties: Property[],
  bookings: Booking[],
  params: TransferUnitOrSectionParams
): TransferUnitOrSectionResult {
  const now = params.now ?? Date.now();
  const keepOriginal = Boolean(params.keepOriginal);
  const transferBookings = Boolean(params.transferBookings);

  const sourceProp = properties.find((p) => p.id === params.sourcePropertyId);
  if (!sourceProp) {
    return {
      success: false,
      message: 'الوحدة أو العقار المصدر غير موجود.',
      properties,
      bookings,
      movedBookingsCount: 0,
    };
  }

  let nextProperties: Property[] = properties.map((p): Property => ({
    ...p,
    sections: p.sections
      ? p.sections.map(
          (s): PropertySection => ({
            ...s,
            features: [...(s.features || [])],
            images: [...(s.images || [])],
            contractTerms: s.contractTerms ? [...s.contractTerms] : undefined,
          })
        )
      : undefined,
    features: [...(p.features || [])],
    images: [...(p.images || [])],
    contractTerms: [...(p.contractTerms || [])],
  }));

  let nextBookings = [...bookings];
  let movedBookingsCount = 0;

  // 1) نقل قسم إلى عقار آخر كقسم
  if (params.mode === 'section_to_property') {
    if (!params.sourceSectionId) {
      return { success: false, message: 'يرجى تحديد القسم المراد نقله.', properties, bookings, movedBookingsCount: 0 };
    }
    if (!params.targetPropertyId || params.targetPropertyId === params.sourcePropertyId) {
      return { success: false, message: 'يرجى اختيار عقار وجهة مختلف عن العقار الحالي.', properties, bookings, movedBookingsCount: 0 };
    }

    const src = nextProperties.find((p) => p.id === params.sourcePropertyId)!;
    const tgt = nextProperties.find((p) => p.id === params.targetPropertyId);
    if (!tgt) {
      return { success: false, message: 'العقار المستهدف غير موجود.', properties, bookings, movedBookingsCount: 0 };
    }

    const srcSec = src.sections?.find((s) => s.id === params.sourceSectionId);
    if (!srcSec) {
      return { success: false, message: 'القسم المراد نقله غير موجود.', properties, bookings, movedBookingsCount: 0 };
    }

    const targetSecId = keepOriginal ? `sec-${now}-${Math.floor(100 + Math.random() * 900)}` : srcSec.id;
    const finalSecName = params.newName?.trim() || srcSec.name;
    const transferredSec: PropertySection = {
      ...srcSec,
      id: targetSecId,
      name: finalSecName,
      title: srcSec.title || finalSecName,
      features: [...(srcSec.features || [])],
      images: [...(srcSec.images || [])],
      contractTerms: srcSec.contractTerms ? [...srcSec.contractTerms] : [...(src.contractTerms || [])],
      contractTemplate: srcSec.contractTemplate || src.contractTemplate,
      hasBreakfast: srcSec.hasBreakfast ?? src.hasBreakfast ?? false,
      hasCoordinatorServices: srcSec.hasCoordinatorServices ?? src.hasCoordinatorServices ?? false,
    };

    const existingTargetSections = tgt.sections ? [...tgt.sections] : [];
    const targetSections = [...existingTargetSections, transferredSec];

    nextProperties = nextProperties.map((p) => {
      if (p.id === tgt.id) {
        return {
          ...p,
          hasSections: true,
          sections: targetSections,
          subUnitsCount: targetSections.length,
        };
      }
      if (p.id === src.id && !keepOriginal) {
        const remaining = (p.sections || []).filter((s) => s.id !== srcSec.id);
        return {
          ...p,
          sections: remaining.length > 0 ? remaining : undefined,
          hasSections: remaining.length > 0,
          subUnitsCount: Math.max(1, remaining.length),
        };
      }
      return p;
    });

    if (transferBookings) {
      nextBookings = nextBookings.map((b) => {
        if (b.propertyId === src.id && (b.sectionId === srcSec.id || b.sectionName === srcSec.name)) {
          movedBookingsCount += 1;
          return {
            ...b,
            propertyId: tgt.id,
            propertyName: tgt.name,
            sectionId: targetSecId,
            sectionName: finalSecName,
          };
        }
        return b;
      });
    }

    return {
      success: true,
      message: keepOriginal
        ? `تم نسخ ونقل القسم (${finalSecName}) إلى عقار (${tgt.name}) مع الإبقاء على الأصل.`
        : `تم نقل القسم (${finalSecName}) من (${src.name}) إلى (${tgt.name}) بنجاح.`,
      properties: nextProperties,
      bookings: nextBookings,
      createdOrTargetPropertyId: tgt.id,
      createdOrTargetSectionId: targetSecId,
      movedBookingsCount,
    };
  }

  // 2) فصل قسم إلى عقار / وحدة مستقلة جديدة
  if (params.mode === 'section_to_standalone') {
    if (!params.sourceSectionId) {
      return { success: false, message: 'يرجى تحديد القسم المراد تحويله لوحدة مستقلة.', properties, bookings, movedBookingsCount: 0 };
    }
    const src = nextProperties.find((p) => p.id === params.sourcePropertyId)!;
    const srcSec = src.sections?.find((s) => s.id === params.sourceSectionId);
    if (!srcSec) {
      return { success: false, message: 'القسم المطلوب غير موجود.', properties, bookings, movedBookingsCount: 0 };
    }

    const newPropId = `prop-${now}`;
    const newPropName = params.newName?.trim() || `${src.name} - ${srcSec.name}`;
    const randomCodeNum = Math.floor(10000 + Math.random() * 90000);

    const standaloneProp: Property = {
      ...src,
      id: newPropId,
      name: newPropName,
      code: `#${randomCodeNum}`,
      subtitle: srcSec.subtitle || srcSec.title || src.subtitle,
      subUnitsCount: 1,
      hasSections: false,
      sections: undefined,
      basePriceWeekday: srcSec.priceWeekday || src.basePriceWeekday,
      basePriceWeekend: srcSec.priceWeekend || src.basePriceWeekend,
      seasonalPricing: {
        ...src.seasonalPricing,
        weekday: srcSec.priceWeekday || src.seasonalPricing.weekday,
        weekend: srcSec.priceWeekend || src.seasonalPricing.weekend,
      },
      capacity: srcSec.capacity || src.capacity,
      bedrooms: srcSec.bedrooms || src.bedrooms,
      bathrooms: srcSec.bathrooms || src.bathrooms,
      areaM2: srcSec.areaM2 || src.areaM2,
      poolType: srcSec.poolType || src.poolType,
      coverImage: srcSec.coverImage || src.coverImage,
      images: srcSec.images && srcSec.images.length > 0 ? [...srcSec.images] : [...(src.images || [])],
      features: srcSec.features && srcSec.features.length > 0 ? [...srcSec.features] : [...(src.features || [])],
      hasBreakfast: srcSec.hasBreakfast ?? src.hasBreakfast ?? false,
      hasCoordinatorServices: srcSec.hasCoordinatorServices ?? src.hasCoordinatorServices ?? false,
      contractTemplate: srcSec.contractTemplate || src.contractTemplate,
      contractTerms:
        srcSec.contractTerms && srcSec.contractTerms.length > 0
          ? [...srcSec.contractTerms]
          : [...(src.contractTerms || [])],
      isMergedProperty: false,
      mergedConfig: undefined,
      mergedPropertyIds: undefined,
    };

    nextProperties = nextProperties.map((p) => {
      if (p.id === src.id && !keepOriginal) {
        const remaining = (p.sections || []).filter((s) => s.id !== srcSec.id);
        return {
          ...p,
          sections: remaining.length > 0 ? remaining : undefined,
          hasSections: remaining.length > 0,
          subUnitsCount: Math.max(1, remaining.length),
        };
      }
      return p;
    });
    nextProperties.push(standaloneProp);

    if (transferBookings) {
      nextBookings = nextBookings.map((b) => {
        if (b.propertyId === src.id && (b.sectionId === srcSec.id || b.sectionName === srcSec.name)) {
          movedBookingsCount += 1;
          return {
            ...b,
            propertyId: newPropId,
            propertyName: newPropName,
            sectionId: undefined,
            sectionName: undefined,
          };
        }
        return b;
      });
    }

    return {
      success: true,
      message: keepOriginal
        ? `تم إنشاء وحدة مستقلة جديدة (${newPropName}) من القسم مع الإبقاء على القسم في (${src.name}).`
        : `تم فصل ونقل القسم (${srcSec.name}) ليصبح وحدة مستقلة باسم (${newPropName}) بنجاح.`,
      properties: nextProperties,
      bookings: nextBookings,
      createdOrTargetPropertyId: newPropId,
      movedBookingsCount,
    };
  }

  // 3) نقل وحدة/عقار كامل إلى داخل عقار آخر (كقسم أو دمج أقسامه)
  if (params.mode === 'unit_to_property_section') {
    if (!params.targetPropertyId || params.targetPropertyId === params.sourcePropertyId) {
      return { success: false, message: 'يرجى اختيار عقار وجهة مختلف عن العقار المصدر.', properties, bookings, movedBookingsCount: 0 };
    }
    const src = nextProperties.find((p) => p.id === params.sourcePropertyId)!;
    const tgt = nextProperties.find((p) => p.id === params.targetPropertyId);
    if (!tgt) {
      return { success: false, message: 'العقار المستهدف غير موجود.', properties, bookings, movedBookingsCount: 0 };
    }
    if (!keepOriginal && nextProperties.length <= 1) {
      return { success: false, message: 'لا يمكن إزالة العقار الوحيد في النظام، يرجى تفعيل خيار الإبقاء على الأصل.', properties, bookings, movedBookingsCount: 0 };
    }

    const srcHasSections = resolvePropertyHasSections(src) && src.sections && src.sections.length > 0;
    const existingTargetSections = tgt.sections ? [...tgt.sections] : [];
    let addedSections: PropertySection[] = [];

    if (srcHasSections && params.moveAllSourceSections) {
      addedSections = src.sections!.map((s, idx) => ({
        ...s,
        id: `sec-${now}-${idx + 1}`,
        name: s.name,
        title: s.title || s.name,
        features: [...(s.features || [])],
        images: [...(s.images || [])],
        contractTerms: s.contractTerms && s.contractTerms.length > 0 ? [...s.contractTerms] : [...(src.contractTerms || [])],
        contractTemplate: s.contractTemplate || src.contractTemplate,
        hasBreakfast: s.hasBreakfast ?? src.hasBreakfast ?? false,
        hasCoordinatorServices: s.hasCoordinatorServices ?? src.hasCoordinatorServices ?? false,
      }));
    } else {
      const sectionName = params.newName?.trim() || src.name;
      const singleSecId = `sec-${now}-1`;
      addedSections = [
        {
          id: singleSecId,
          name: sectionName,
          title: src.subtitle || sectionName,
          subtitle: src.subtitle || `قسم ${sectionName}`,
          priceWeekday: src.basePriceWeekday,
          priceWeekend: src.basePriceWeekend,
          capacity: src.capacity,
          bedrooms: src.bedrooms,
          bathrooms: src.bathrooms,
          areaM2: src.areaM2,
          poolType: src.poolType,
          features: [...(src.features || [])],
          images: [...(src.images || [])],
          coverImage: src.coverImage,
          isAvailable: src.isPublished,
          hasBreakfast: src.hasBreakfast ?? false,
          hasCoordinatorServices: src.hasCoordinatorServices ?? false,
          contractTemplate: src.contractTemplate,
          contractTerms: [...(src.contractTerms || [])],
        },
      ];
    }

    const updatedTargetSections = [...existingTargetSections, ...addedSections];

    nextProperties = nextProperties
      .filter((p) => keepOriginal || p.id !== src.id)
      .map((p) =>
        p.id === tgt.id
          ? {
              ...p,
              hasSections: true,
              sections: updatedTargetSections,
              subUnitsCount: updatedTargetSections.length,
            }
          : p
      );

    if (transferBookings) {
      const fallbackSection = addedSections[0];
      nextBookings = nextBookings.map((b) => {
        if (b.propertyId === src.id) {
          movedBookingsCount += 1;
          const matchingTransferredSec =
            srcHasSections && params.moveAllSourceSections
              ? addedSections.find((as) => as.name === b.sectionName) || fallbackSection
              : fallbackSection;
          return {
            ...b,
            propertyId: tgt.id,
            propertyName: tgt.name,
            sectionId: matchingTransferredSec.id,
            sectionName: matchingTransferredSec.name,
          };
        }
        return b;
      });
    }

    return {
      success: true,
      message: keepOriginal
        ? `تم نسخ ونقل (${src.name}) كقسم داخل (${tgt.name}) مع الإبقاء على الوحدة الأصلية.`
        : `تم نقل (${src.name}) إلى داخل (${tgt.name}) كقسم مستقل بنجاح.`,
      properties: nextProperties,
      bookings: nextBookings,
      createdOrTargetPropertyId: tgt.id,
      createdOrTargetSectionId: addedSections[0]?.id,
      removedSourcePropertyId: keepOriginal ? undefined : src.id,
      movedBookingsCount,
    };
  }

  // 4) نقل من وحدة إلى وحدة أو قسم إلى قسم محدد (تحديث/استبدال بيانات ومواصفات وقالب العقد)
  if (params.mode === 'unit_to_unit') {
    if (!params.targetPropertyId) {
      return { success: false, message: 'يرجى تحديد الوحدة المستهدفة.', properties, bookings, movedBookingsCount: 0 };
    }
    if (
      params.targetPropertyId === params.sourcePropertyId &&
      (!params.targetSectionId || params.targetSectionId === params.sourceSectionId)
    ) {
      return { success: false, message: 'يرجى اختيار وحدة أو قسم مستهدف مختلف عن المصدر.', properties, bookings, movedBookingsCount: 0 };
    }

    const src = nextProperties.find((p) => p.id === params.sourcePropertyId)!;
    const tgt = nextProperties.find((p) => p.id === params.targetPropertyId);
    if (!tgt) {
      return { success: false, message: 'الوحدة المستهدفة غير موجودة.', properties, bookings, movedBookingsCount: 0 };
    }

    const srcSec = params.sourceSectionId ? src.sections?.find((s) => s.id === params.sourceSectionId) : undefined;
    const payload = {
      name: params.newName?.trim() || (srcSec ? srcSec.name : src.name),
      subtitle: srcSec ? srcSec.subtitle : src.subtitle,
      priceWeekday: srcSec ? srcSec.priceWeekday : src.basePriceWeekday,
      priceWeekend: srcSec ? srcSec.priceWeekend : src.basePriceWeekend,
      capacity: srcSec ? srcSec.capacity : src.capacity,
      bedrooms: srcSec ? srcSec.bedrooms : src.bedrooms,
      bathrooms: srcSec ? srcSec.bathrooms : src.bathrooms,
      areaM2: srcSec ? srcSec.areaM2 : src.areaM2,
      poolType: srcSec ? srcSec.poolType : src.poolType,
      features: srcSec ? [...srcSec.features] : [...src.features],
      images: srcSec ? [...srcSec.images] : [...src.images],
      coverImage: srcSec ? srcSec.coverImage || src.coverImage : src.coverImage,
      hasBreakfast: srcSec ? (srcSec.hasBreakfast ?? src.hasBreakfast ?? false) : (src.hasBreakfast ?? false),
      hasCoordinatorServices: srcSec ? (srcSec.hasCoordinatorServices ?? src.hasCoordinatorServices ?? false) : (src.hasCoordinatorServices ?? false),
      contractTemplate: srcSec ? (srcSec.contractTemplate || src.contractTemplate) : src.contractTemplate,
      contractTerms:
        srcSec?.contractTerms && srcSec.contractTerms.length > 0
          ? [...srcSec.contractTerms]
          : [...(src.contractTerms || [])],
    };

    const removeSourceProp = !keepOriginal && !srcSec && src.id !== tgt.id && nextProperties.length > 1;
    const removeSourceSec = !keepOriginal && Boolean(srcSec) && src.id !== tgt.id;

    nextProperties = nextProperties
      .filter((p) => !(removeSourceProp && p.id === src.id))
      .map((p) => {
        if (p.id === src.id && removeSourceSec && srcSec) {
          const remaining = (p.sections || []).filter((s) => s.id !== srcSec.id);
          return {
            ...p,
            sections: remaining.length > 0 ? remaining : undefined,
            hasSections: remaining.length > 0,
            subUnitsCount: Math.max(1, remaining.length),
          };
        }
        if (p.id === tgt.id) {
          if (params.targetSectionId && p.sections?.some((s) => s.id === params.targetSectionId)) {
            const updatedSecs = p.sections.map((s) =>
              s.id === params.targetSectionId
                ? {
                    ...s,
                    name: params.newName?.trim() || s.name,
                    subtitle: payload.subtitle,
                    priceWeekday: payload.priceWeekday,
                    priceWeekend: payload.priceWeekend,
                    capacity: payload.capacity,
                    bedrooms: payload.bedrooms,
                    bathrooms: payload.bathrooms,
                    areaM2: payload.areaM2,
                    poolType: payload.poolType,
                    features: payload.features,
                    images: payload.images,
                    coverImage: payload.coverImage,
                    hasBreakfast: payload.hasBreakfast,
                    hasCoordinatorServices: payload.hasCoordinatorServices,
                    contractTemplate: payload.contractTemplate,
                    contractTerms: payload.contractTerms,
                  }
                : s
            );
            return { ...p, sections: updatedSecs };
          }

          return {
            ...p,
            name: params.newName?.trim() || p.name,
            subtitle: payload.subtitle,
            basePriceWeekday: payload.priceWeekday,
            basePriceWeekend: payload.priceWeekend,
            capacity: payload.capacity,
            bedrooms: payload.bedrooms,
            bathrooms: payload.bathrooms,
            areaM2: payload.areaM2,
            poolType: payload.poolType,
            features: payload.features,
            images: payload.images,
            coverImage: payload.coverImage,
            hasBreakfast: payload.hasBreakfast,
            hasCoordinatorServices: payload.hasCoordinatorServices,
            contractTemplate: payload.contractTemplate,
            contractTerms: payload.contractTerms,
          };
        }
        return p;
      });

    if (transferBookings) {
      nextBookings = nextBookings.map((b) => {
        const matchesSource = srcSec
          ? b.propertyId === src.id && (b.sectionId === srcSec.id || b.sectionName === srcSec.name)
          : b.propertyId === src.id;
        if (!matchesSource) return b;
        movedBookingsCount += 1;
        const targetSecObj = params.targetSectionId
          ? nextProperties.find((p) => p.id === tgt.id)?.sections?.find((s) => s.id === params.targetSectionId)
          : undefined;
        return {
          ...b,
          propertyId: tgt.id,
          propertyName: params.newName?.trim() || tgt.name,
          sectionId: targetSecObj ? targetSecObj.id : undefined,
          sectionName: targetSecObj ? targetSecObj.name : undefined,
        };
      });
    }

    return {
      success: true,
      message: `تم نقل وتحديث البيانات والمواصفات وقالب العقد إلى (${params.targetSectionId ? 'القسم المستهدف' : tgt.name}) بنجاح.`,
      properties: nextProperties,
      bookings: nextBookings,
      createdOrTargetPropertyId: tgt.id,
      createdOrTargetSectionId: params.targetSectionId,
      removedSourcePropertyId: removeSourceProp ? src.id : undefined,
      movedBookingsCount,
    };
  }

  return {
    success: false,
    message: 'نوع عملية النقل غير مدعوم.',
    properties,
    bookings,
    movedBookingsCount: 0,
  };
}

/**
 * الهرمية: العقار (وحدتان) ← الوحدة (قسمان) ← القسم.
 * العقار = بطاقة مدمجة داخلياً (مثل حمران) أبناؤها «وحدات».
 * الوحدة = أي بطاقة أخرى (مثل الترف) أبناؤها «أقسام».
 */
export type PropertyKind = 'estate' | 'unit';

export function getPropertyKind(p: {
  isMergedProperty?: boolean;
  mergedConfig?: { mergeType?: string; linkedPropertyIds?: string[] };
  mergedPropertyIds?: string[];
}): PropertyKind {
  const t = p.mergedConfig?.mergeType;
  if (p.isMergedProperty && t === 'internal_units') return 'estate';
  // دمج وحدتين أو أكثر مسجلتين في النظام = عقار
  if (t === 'linked_properties' || (!t && p.mergedPropertyIds?.length)) return 'estate';
  return 'unit';
}

/** عدد أبناء العقار: الوحدات المدمجة، أو الأقسام/الوحدات الداخلية */
export function getChildCount(p: {
  sections?: unknown[];
  mergedConfig?: { mergeType?: string; linkedPropertyIds?: string[] };
  mergedPropertyIds?: string[];
}): number {
  const t = p.mergedConfig?.mergeType;
  if (t === 'linked_properties' || (!t && p.mergedPropertyIds?.length)) {
    return (p.mergedConfig?.linkedPropertyIds || p.mergedPropertyIds || []).length;
  }
  return p.sections?.length || 0;
}

export function getHierarchyLabels(kind: PropertyKind) {
  return kind === 'estate'
    ? { self: 'عقار', child: 'وحدة', childPlural: 'وحدات', childAdd: 'إضافة وحدة جديدة', whole: 'كامل العقار' }
    : { self: 'وحدة', child: 'قسم', childPlural: 'أقسام', childAdd: 'إضافة قسم جديد', whole: 'كامل الوحدة' };
}

export function describeChildrenCount(kind: PropertyKind, count: number): string {
  if (kind === 'estate') {
    if (count <= 0) return 'بدون وحدات';
    if (count === 1) return 'وحدة واحدة';
    if (count === 2) return 'وحدتان';
    return `${count} وحدات`;
  }
  // الوحدة التي بلا أقسام معرّفة تُعامل كقسم واحد
  if (count <= 1) return 'قسم واحد';
  if (count === 2) return 'قسمان';
  return `${count} أقسام`;
}

/** معرّفات الأقسام التي يشملها «الحجز الكامل» للوحدة/العقار (فقط إن كان فيه قسمان فأكثر). */
export function getWholeSectionIds(
  p?: { id?: string; sections?: { id: string }[] } | null,
  fallbackPropertyId?: string
): string[] {
  const ids = (p?.sections || []).map((s) => s.id);
  if (ids.length >= 2) return ids;
  const pid = p?.id || fallbackPropertyId;
  if (pid === 'hamran') return ['hamran-alma', 'hamran-naya'];
  if (pid === 'al-taraf') return ['section-1', 'section-2'];
  return [];
}

// ───────── العقار المدمج (دمج وحدتين أو أكثر): خيارات الحجز ─────────
export interface EstateOption {
  key: string;
  propertyId: string;
  sectionId: string; // 'all' = الوحدة كاملة
  label: string;
  weekday: number;
  weekend: number;
}

const linkedIdsOf = (p: Property): string[] => {
  const t = p.mergedConfig?.mergeType;
  if (t === 'linked_properties' || (!t && p.mergedPropertyIds?.length)) {
    return p.mergedConfig?.linkedPropertyIds || p.mergedPropertyIds || [];
  }
  return [];
};

/** العقار المدمج الذي ينتمي إليه العقار المحدد (أو هو نفسه)، وإلا null */
export function findEstateParent(selected: Property, all: Property[]): Property | null {
  if (linkedIdsOf(selected).length > 0) return selected;
  return all.find((p) => p.id !== selected.id && linkedIdsOf(p).includes(selected.id)) || null;
}

/** خيارات الحجز: كل وحدة بلا أقسام، أو (كل قسم + الوحدة كاملة) للوحدة ذات القسمين فأكثر */
export function getEstateOptions(parent: Property, all: Property[]): EstateOption[] {
  const opts: EstateOption[] = [];
  linkedIdsOf(parent).forEach((id) => {
    const u = all.find((x) => x.id === id);
    if (!u) return;
    const secs = u.sections || [];
    if (secs.length >= 2) {
      secs.forEach((sec) =>
        opts.push({
          key: `${u.id}:${sec.id}`,
          propertyId: u.id,
          sectionId: sec.id,
          label: `${u.name} — ${sec.name}`,
          weekday: sec.priceWeekday,
          weekend: sec.priceWeekend,
        })
      );
      opts.push({
        key: `${u.id}:all`,
        propertyId: u.id,
        sectionId: 'all',
        label: `${u.name} كامل (كل الأقسام معاً)`,
        weekday: secs.reduce((a, x) => a + (Number(x.priceWeekday) || 0), 0),
        weekend: secs.reduce((a, x) => a + (Number(x.priceWeekend) || 0), 0),
      });
    } else {
      opts.push({
        key: `${u.id}:all`,
        propertyId: u.id,
        sectionId: 'all',
        label: u.name,
        weekday: u.basePriceWeekday,
        weekend: u.basePriceWeekend,
      });
    }
  });
  return opts;
}

export const isLinkedEstate = (p: Property): boolean => linkedIdsOf(p).length > 0;

const isWeekendDate = (dateKey: string): boolean => {
  const d = new Date(`${dateKey}T00:00:00`).getDay();
  return d === 4 || d === 5; // الخميس والجمعة
};

/** سعر ليلة وحدة: مجموع أسعار أقسامها إن كان فيها قسمان فأكثر، وإلا سعر الوحدة نفسها */
export function getUnitNightPrice(
  unit: Property,
  dateKey: string,
  overrides: Record<string, { price?: number } | undefined>
): number {
  const wk = isWeekendDate(dateKey);
  const secs = unit.sections || [];
  if (secs.length >= 2) {
    return secs.reduce(
      (sum, sec) => sum + (overrides[`${unit.id}_${sec.id}_${dateKey}`]?.price ?? (wk ? sec.priceWeekend : sec.priceWeekday) ?? 0),
      0
    );
  }
  return overrides[`${unit.id}_${dateKey}`]?.price ?? (wk ? unit.basePriceWeekend : unit.basePriceWeekday);
}

/** سعر ليلة العقار المدمج = مجموع أسعار وحداته (وسعر كل وحدة = مجموع أقسامها) */
export function getEstateNightPrice(
  estate: Property,
  all: Property[],
  overrides: Record<string, { price?: number } | undefined>,
  dateKey: string
): number {
  return linkedIdsOf(estate).reduce((sum, id) => {
    const u = all.find((x) => x.id === id);
    return sum + (u ? getUnitNightPrice(u, dateKey, overrides) : 0);
  }, 0);
}

// ───────── حجز العقار المدمج بأجزاء (الكوخ + قسم من الترف …) ─────────
export type { EstatePartRef };

type PriceOverrides = Record<string, { price?: number } | undefined>;

/** كل الأجزاء القابلة للحجز داخل العقار المدمج (الوحدة بلا أقسام = جزء، والوحدة ذات الأقسام = جزء لكل قسم) */
export function getEstateParts(estate: Property, all: Property[]): EstatePartRef[] {
  const parts: EstatePartRef[] = [];
  linkedIdsOf(estate).forEach((id) => {
    const u = all.find((x) => x.id === id);
    if (!u) return;
    const secs = u.sections || [];
    if (secs.length >= 2) {
      secs.forEach((sec) => parts.push({ propertyId: u.id, sectionId: sec.id, label: `${u.name} — ${sec.name}` }));
    } else {
      parts.push({ propertyId: u.id, sectionId: 'all', label: u.name });
    }
  });
  return parts;
}

export const partKey = (p: { propertyId: string; sectionId: string }) => `${p.propertyId}:${p.sectionId}`;

/** نص مختصر للأجزاء المختارة: "الكوخ + الترف كامل" أو "الكوخ + الترف (القسم الأول)" */
export function describeEstateParts(selected: EstatePartRef[], estate: Property, all: Property[]): string {
  const bits: string[] = [];
  linkedIdsOf(estate).forEach((id) => {
    const u = all.find((x) => x.id === id);
    if (!u) return;
    const chosen = selected.filter((p) => p.propertyId === u.id);
    if (chosen.length === 0) return;
    const secs = u.sections || [];
    if (secs.length >= 2) {
      if (chosen.length === secs.length) bits.push(`${u.name} كامل`);
      else {
        const names = chosen.map((c) => secs.find((s) => s.id === c.sectionId)?.name || c.sectionId);
        bits.push(`${u.name} (${names.join(' + ')})`);
      }
    } else {
      bits.push(u.name);
    }
  });
  return bits.join(' + ');
}

/** سعر ليلة جزء واحد */
export function getPartNightPrice(part: EstatePartRef, all: Property[], overrides: PriceOverrides, dateKey: string): number {
  const u = all.find((x) => x.id === part.propertyId);
  if (!u) return 0;
  const wk = isWeekendDate(dateKey);
  if (part.sectionId !== 'all') {
    const sec = (u.sections || []).find((s) => s.id === part.sectionId);
    if (!sec) return 0;
    return overrides[`${u.id}_${sec.id}_${dateKey}`]?.price ?? (wk ? sec.priceWeekend : sec.priceWeekday) ?? 0;
  }
  return overrides[`${u.id}_${dateKey}`]?.price ?? (wk ? u.basePriceWeekend : u.basePriceWeekday);
}

/** سعر ليلة مجموعة الأجزاء المختارة = مجموع أسعارها */
export function getPartsNightPrice(parts: EstatePartRef[], all: Property[], overrides: PriceOverrides, dateKey: string): number {
  return parts.reduce((sum, p) => sum + getPartNightPrice(p, all, overrides, dateKey), 0);
}

/** هل يشغل هذا الحجز الجزء المعطى؟ (حجز مباشر على الوحدة/القسم، أو حجز عقار مدمج يشمله) */
export function bookingOccupiesPart(
  b: { propertyId: string; sectionId?: string; estateParts?: EstatePartRef[] },
  part: EstatePartRef,
  estate: Property
): boolean {
  if (b.propertyId === part.propertyId) {
    if (part.sectionId === 'all') return true;
    return !b.sectionId || b.sectionId === 'all' || b.sectionId === part.sectionId;
  }
  if (b.propertyId === estate.id) {
    if (!b.estateParts || b.estateParts.length === 0) return true; // حجز العقار كاملاً
    return b.estateParts.some((p) => p.propertyId === part.propertyId && p.sectionId === part.sectionId);
  }
  return false;
}

/** حجز على العقار المدمج: هل يمنع الوحدة/القسم المعطى (عند عرض الوحدة نفسها)؟ sectionId=null يعني الوحدة كاملة */
export function estateBookingBlocksUnit(
  b: { estateParts?: EstatePartRef[] },
  unitId: string,
  sectionId: string | null
): boolean {
  if (!b.estateParts || b.estateParts.length === 0) return true;
  return b.estateParts.some(
    (p) => p.propertyId === unitId && (sectionId === null || sectionId === 'all' || p.sectionId === 'all' || p.sectionId === sectionId)
  );
}


/** مفاتيح تواريخ التقويم (overrides) التي يغطيها حجز عقار مدمج: الأجزاء المختارة فقط (أو كل الوحدات إن لم تُحدَّد أجزاء) */
export function estateOverrideKeys(estate: Property, parts: EstatePartRef[] | undefined, dateKey: string, all: Property[]): string[] {
  const keys = [`${estate.id}_${dateKey}`];
  if (!parts || parts.length === 0) {
    linkedIdsOf(estate).forEach((id) => keys.push(`${id}_${dateKey}`));
    return keys;
  }
  parts.forEach((p) => keys.push(p.sectionId === 'all' ? `${p.propertyId}_${dateKey}` : `${p.propertyId}_${p.sectionId}_${dateKey}`));
  linkedIdsOf(estate).forEach((id) => {
    const secs = all.find((x) => x.id === id)?.sections || [];
    if (secs.length >= 2 && secs.every((s) => parts.some((p) => p.propertyId === id && p.sectionId === s.id))) keys.push(`${id}_${dateKey}`);
  });
  return Array.from(new Set(keys));
}
