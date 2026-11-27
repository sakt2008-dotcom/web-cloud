/**
 * يحذف رموز الإيموجي من نص يُعرض داخل واجهة AMASA RESORT.
 * تبقى الرموز في رسائل واتساب والتنبيهات الخارجية فقط (تُرسل خارج التطبيق).
 */
export const stripEmoji = (s?: string | null): string =>
  (s ?? '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2705}\u{FE0F}\u{200D}]+\s*/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
