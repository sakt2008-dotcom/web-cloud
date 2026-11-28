import type { Property } from '../types';

/** مجموعة وسائط تخص وحدة واحدة (أو وسائط قديمة على العقار نفسه) */
export interface UnitMediaGroup {
  key: string;
  unitName: string;
  /** وسائط قديمة محفوظة على العقار نفسه (تبقى ظاهرة ولا تُحذف تلقائيًا) */
  legacy?: boolean;
  propertyId: string;
  images: string[];
  videos: { title: string; url: string; legacyIndex?: number }[];
}

export interface AggregatedProperty {
  /** هل هو حاوية (عقار) أو وحدة مركّبة من أقسام: بياناته مجمّعة من الوحدات */
  isContainer: boolean;
  units: string[];
  groups: UnitMediaGroup[];
  totalImages: number;
  totalVideos: number;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  minPrice: number;
  maxPrice: number;
}

const strImages = (arr: any[] | undefined): string[] =>
  (arr || []).map((x) => (typeof x === 'string' ? x : x?.url || x?.dataUrl || '')).filter(Boolean);

export const getChildPropertyIds = (p: Property): string[] =>
  Array.from(new Set([...(p.mergedPropertyIds || []), ...(p.mergedConfig?.linkedPropertyIds || [])]));

export const isContainerProperty = (p: Property): boolean =>
  getChildPropertyIds(p).length > 0 || (p.sections?.length || 0) > 0;

/** يجمّع بيانات ووسائط العقار/الوحدة من وحداته وأقسامه تلقائيًا */
export function getAggregatedProperty(p: Property, all: Property[]): AggregatedProperty {
  const groups: UnitMediaGroup[] = [];
  const units: string[] = [];
  const prices: number[] = [];
  let capacity = 0;
  let bedrooms = 0;
  let bathrooms = 0;
  let areaM2 = 0;
  const seen = new Set<string>();

  const walk = (prop: Property, isRoot: boolean) => {
    if (seen.has(prop.id)) return;
    seen.add(prop.id);

    const childIds = getChildPropertyIds(prop);
    const sections = prop.sections || [];

    if (childIds.length > 0) {
      childIds.forEach((id) => {
        const child = all.find((x) => x.id === id);
        if (child) walk(child, false);
      });
    } else if (sections.length > 0) {
      if (!isRoot) units.push(prop.name);
      sections.forEach((sec) => {
        if (isRoot) units.push(sec.name);
        capacity += Number(sec.capacity) || 0;
        bedrooms += Number(sec.bedrooms) || 0;
        bathrooms += Number(sec.bathrooms) || 0;
        areaM2 += Number(sec.areaM2) || 0;
        [sec.priceWeekday, sec.priceWeekend].forEach((v) => Number(v) > 0 && prices.push(Number(v)));
        groups.push({
          key: `${prop.id}:${sec.id}`,
          unitName: sections.length > 1 && !isRoot ? `${prop.name} › ${sec.name}` : sec.name,
          propertyId: prop.id,
          images: strImages(sec.images),
          videos: (sec.videoItems || []).map((v) => ({ title: v.title, url: v.url })),
        });
      });
    } else {
      units.push(prop.name);
      capacity += Number(prop.capacity) || 0;
      bedrooms += Number(prop.bedrooms) || 0;
      bathrooms += Number(prop.bathrooms) || 0;
      areaM2 += Number(prop.areaM2) || 0;
      [prop.basePriceWeekday, prop.basePriceWeekend].forEach((v) => Number(v) > 0 && prices.push(Number(v)));
      groups.push({
        key: `${prop.id}:self`,
        unitName: prop.name,
        propertyId: prop.id,
        images: strImages(prop.images),
        videos: (prop.videoItems && prop.videoItems.length
          ? prop.videoItems
          : (prop.videoUrls || []).map((url, i) => ({ title: `فيديو ${i + 1}`, url }))
        ).map((v) => ({ title: v.title, url: v.url })),
      });
    }

    // وسائط قديمة محفوظة على الحاوية نفسها: تبقى ظاهرة للنقل لاحقًا إلى وحدة
    if (childIds.length > 0 || sections.length > 0) {
      const legacyVideos = (prop.videoUrls || []).map((url, i) => ({ title: `فيديو ${i + 1}`, url, legacyIndex: i }));
      // الصور القديمة نُسخت سابقًا من الوحدات، فلا تُعرض؛ تُعرض الفيديوهات القديمة فقط ليتم نقلها أو حذفها
      if (legacyVideos.length) {
        groups.unshift({
          key: `${prop.id}:legacy`,
          unitName: `وسائط قديمة على ${prop.name}`,
          legacy: true,
          propertyId: prop.id,
          images: [],
          videos: legacyVideos,
        });
      }
    }
  };

  walk(p, true);

  return {
    isContainer: isContainerProperty(p),
    units,
    groups,
    totalImages: groups.reduce((a, g) => a + g.images.length, 0),
    totalVideos: groups.reduce((a, g) => a + g.videos.length, 0),
    capacity,
    bedrooms,
    bathrooms,
    areaM2,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

export const sameLocation = (a?: Property, b?: Property): boolean =>
  !!a && !!b && (a.location || '').trim() === (b.location || '').trim();
