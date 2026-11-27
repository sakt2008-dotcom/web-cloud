/**
 * Unified Customer Contact & Safe External Link Utilities
 * Formats Saudi / international phone numbers, generates permanent WhatsApp & tel: links,
 * and opens external URLs safely via anchor elements (no blocked window.open popups).
 */

export function normalizeCustomerPhone(rawPhone?: string, defaultCountryCode = '966'): string {
  const digits = String(rawPhone || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('05') && digits.length === 10) return `${defaultCountryCode}${digits.slice(1)}`;
  if (digits.startsWith('0') && digits.length >= 9) return `${defaultCountryCode}${digits.slice(1)}`;
  if (digits.startsWith('5') && digits.length === 9) return `${defaultCountryCode}${digits}`;
  if (!digits.startsWith(defaultCountryCode) && digits.length === 9) return `${defaultCountryCode}${digits}`;
  return digits;
}

export function buildCustomerWhatsappUrl(rawPhone?: string, message?: string): string {
  const clean = normalizeCustomerPhone(rawPhone);
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  if (!clean) {
    return message ? `https://wa.me/?text=${encodeURIComponent(message)}` : 'https://wa.me/';
  }
  return `https://wa.me/${clean}${textParam}`;
}

export function buildCustomerCallUrl(rawPhone?: string): string {
  const clean = normalizeCustomerPhone(rawPhone);
  return clean ? `tel:+${clean}` : '';
}

export function openExternalUrlSafely(url?: string): boolean {
  if (!url || typeof document === 'undefined') return false;
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}
