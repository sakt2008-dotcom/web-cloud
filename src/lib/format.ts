/** أدوات تنسيق عرض مشتركة (أرقام لاتينية، عدد الليالي بصياغة عربية صحيحة) */

/** رقم بأرقام لاتينية وفواصل آلاف */
export const fmtN = (n?: number): string => Number(n || 0).toLocaleString('en-US');

/** عدد الليالي بصياغة عربية صحيحة (ليلة / ليلتان / 3 ليالٍ / 11 ليلة) */
export const nightsText = (n?: number): string => {
  const c = Number(n || 0);
  if (c === 1) return 'ليلة واحدة';
  if (c === 2) return 'ليلتان';
  if (c >= 3 && c <= 10) return `${c} ليالٍ`;
  return `${c} ليلة`;
};

/** تاريخ اليوم المحلي بصيغة YYYY-MM-DD (وليس تاريخ UTC الذي يتأخر يوماً بعد منتصف الليل في السعودية) */
export const localTodayStr = (): string => {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

/** يحوّل الأرقام العربية الهندية (٠١٢…) إلى لاتينية (012…) لعرض موحّد */
export const toLatinDigits = (s?: string): string =>
  (s || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
