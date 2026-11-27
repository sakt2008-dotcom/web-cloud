import type { CommissionRequest, Marketer, MarketerPermissions, UserAccount } from '../types';

export const PERSONAL_DEMO_TOKEN = 'amasa-sakt-2026';

let cachedDemoState: boolean | null = null;

/**
 * Evaluates whether the app was launched using the owner's personal demo link
 * (?demo=amasa-sakt-2026). Cached for the duration of the page load so the
 * session remains 100% isolated from Firebase and production localStorage.
 */
export function isPersonalDemoMode(): boolean {
  if (cachedDemoState !== null) return cachedDemoState;
  // نسخة المعاينة المنشورة داخل إطار معزول لا يمرّ فيها الـ query string، فيُفرض الديمو وقت البناء.
  if (import.meta.env?.VITE_PREVIEW === '1') {
    cachedDemoState = true;
    return true;
  }
  if (typeof window === 'undefined') {
    cachedDemoState = false;
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    cachedDemoState = params.get('demo') === PERSONAL_DEMO_TOKEN;
  } catch {
    cachedDemoState = false;
  }
  return cachedDemoState;
}

export function exitPersonalDemoMode(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.location.href = url.toString();
  } catch {
    window.location.href = '/';
  }
}

export function buildPersonalDemoUrl(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/?demo=${PERSONAL_DEMO_TOKEN}`;
}

const DEMO_DEFAULT_MARKETER_PERMISSIONS: MarketerPermissions = {
  canViewCalendar: true,
  canCreateBooking: true,
  canCreateContract: true,
  canEditDeposit: true,
  canViewDashboard: true,
  canViewGuardTasks: false,
  canViewBookings: true,
  canViewSupervisor: false,
  canViewProperties: true,
  canViewMarketers: false,
  canViewMore: true,
  canViewAllBookings: false,
  canViewCustomerContacts: true,
  canManageTemplates: false,
  canViewRentalContract: true,
  canViewActivityLogs: false,
};

/** ربط حجوزات العيّنة بمسوقي الديمو لتظهر عمولاتهم في صفحة المسوقين (بيئة الديمو فقط) */
const DEMO_BOOKING_MARKETERS: Record<string, string> = {
  'bk-today-in': 'demo-mk-1',
  'bk-today-hamran': 'demo-mk-1',
  'bk-today-out': 'demo-mk-1',
  'bk-01': 'demo-mk-1',
  'bk-03': 'demo-mk-1',
  'bk-04': 'demo-mk-1',
  'bk-02': 'demo-mk-2',
};

export const attachDemoMarketers = <T extends { id: string; marketerId?: string }>(list: T[]): T[] =>
  list.map((b) => (DEMO_BOOKING_MARKETERS[b.id] && !b.marketerId ? { ...b, marketerId: DEMO_BOOKING_MARKETERS[b.id] } : b));

export const DEMO_SAMPLE_MARKETERS: Marketer[] = [
  {
    id: 'demo-mk-1',
    name: 'فيصل الدوسري (مسوق تجريبي)',
    phone: '0501112233',
    email: 'demo.marketer@amasa.demo',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    code: 'DEMO-MK1',
    commissionRate: 10,
    joinDate: '2026-01-01',
    bankName: 'مصرف الراجحي',
    bankAccount: 'SA0000000000000000000001',
    nationalId: '1000000001',
    isSupervisor: false,
    contract: {
      contractNumber: 'DEMO-CNT-01',
      contractDate: '2026-01-01',
      expiryDate: '2027-01-01',
      commissionRatePercent: 10,
      status: 'active',
      firstParty: 'AMASA RESORT',
      firstPartyRepresentative: 'الإدارة (ديمو)',
      secondParty: 'فيصل الدوسري (مسوق تجريبي)',
      secondPartyPhone: '0501112233',
      secondPartyEmail: 'demo.marketer@amasa.demo',
      terms: ['عقد تسويق تجريبي خاص ببيئة الديمو المعزولة'],
      isSigned: true,
      signedDate: '2026-01-01',
    },
    permissions: { ...DEMO_DEFAULT_MARKETER_PERMISSIONS },
  },
  {
    id: 'demo-mk-2',
    name: 'نورة القحطاني (مشرفة تجريبية)',
    phone: '0554445566',
    email: 'demo.supervisor@amasa.demo',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    code: 'DEMO-SUP1',
    commissionRate: 12,
    joinDate: '2026-01-01',
    bankName: 'البنك الأهلي السعودي',
    bankAccount: 'SA0000000000000000000002',
    nationalId: '1000000002',
    isSupervisor: true,
    contract: {
      contractNumber: 'DEMO-CNT-02',
      contractDate: '2026-01-01',
      expiryDate: '2027-01-01',
      commissionRatePercent: 12,
      status: 'active',
      firstParty: 'AMASA RESORT',
      firstPartyRepresentative: 'الإدارة (ديمو)',
      secondParty: 'نورة القحطاني (مشرفة تجريبية)',
      secondPartyPhone: '0554445566',
      secondPartyEmail: 'demo.supervisor@amasa.demo',
      terms: ['عقد إشراف تجريبي خاص ببيئة الديمو المعزولة'],
      isSigned: true,
      signedDate: '2026-01-01',
    },
    permissions: {
      ...DEMO_DEFAULT_MARKETER_PERMISSIONS,
      canViewSupervisor: true,
      canViewAllBookings: true,
      canViewMarketers: true,
    },
  },
];

/** طلبات صرف عمولة تجريبية (بيئة الديمو فقط) لمعاينة شاشة الصرف بحالاتها الثلاث */
export const DEMO_SAMPLE_COMMISSION_REQUESTS: CommissionRequest[] = [
  {
    id: 'demo-cr-1',
    marketerId: 'demo-mk-1',
    marketerName: 'فيصل الدوسري (مسوق تجريبي)',
    fromDate: '2026-11-01',
    toDate: '2026-11-20',
    bookingIds: ['bk-01', 'bk-03'],
    amount: 520,
    status: 'pending',
    createdAt: '2026-11-21T09:30:00.000Z',
  },
  {
    id: 'demo-cr-2',
    marketerId: 'demo-mk-2',
    marketerName: 'نورة القحطاني (مشرفة تجريبية)',
    fromDate: '2026-11-05',
    toDate: '2026-11-22',
    bookingIds: ['bk-02'],
    amount: 340,
    status: 'pending',
    createdAt: '2026-11-23T11:10:00.000Z',
  },
  {
    id: 'demo-cr-3',
    marketerId: 'demo-mk-1',
    marketerName: 'فيصل الدوسري (مسوق تجريبي)',
    fromDate: '2026-10-01',
    toDate: '2026-10-31',
    bookingIds: ['bk-04'],
    amount: 410,
    status: 'transferred',
    createdAt: '2026-11-01T08:00:00.000Z',
    processedAt: '2026-11-02',
    receiptFileName: 'receipt-oct.pdf',
    seenByMarketer: false,
  },
  {
    id: 'demo-cr-4',
    marketerId: 'demo-mk-1',
    marketerName: 'فيصل الدوسري (مسوق تجريبي)',
    fromDate: '2026-09-01',
    toDate: '2026-09-30',
    bookingIds: ['bk-05'],
    amount: 210,
    status: 'rejected',
    createdAt: '2026-10-01T10:00:00.000Z',
    processedAt: '2026-10-02',
    adminNote: 'يرجى تحديث رقم الآيبان ثم إعادة إرسال الطلب.',
  },
];

export const DEMO_SAMPLE_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'demo-admin',
    role: 'admin',
    name: 'وضع الديمو (الإدارة)',
    email: 'demo.admin@amasa.demo',
    phone: '0500000000',
  },
  {
    id: 'demo-mk-1-acc',
    role: 'marketer',
    name: 'فيصل الدوسري (مسوق تجريبي)',
    email: 'demo.marketer@amasa.demo',
    marketerId: 'demo-mk-1',
    phone: '0501112233',
  },
  {
    id: 'demo-mk-2-acc',
    role: 'marketer',
    name: 'نورة القحطاني (مشرفة تجريبية)',
    email: 'demo.supervisor@amasa.demo',
    marketerId: 'demo-mk-2',
    isSupervisor: true,
    phone: '0554445566',
  },
  {
    id: 'demo-coord-1-acc',
    role: 'coordinator',
    name: 'منى الحربي (منسقة تجريبية)',
    email: 'demo.coordinator@amasa.demo',
    coordinatorId: 'c1',
    phone: '0551234890',
  },
  {
    id: 'demo-guard-1-acc',
    role: 'guard',
    name: 'أبو راشد (حارس تجريبي)',
    email: 'demo.guard@amasa.demo',
    guardId: 'g1',
    phone: '0598881234',
  },
];
