export type UserRole = 'admin' | 'marketer' | 'guard' | 'coordinator';

export interface PropertySection {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  priceWeekday: number;
  priceWeekend: number;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  poolType: string;
  features: string[];
  images: any[];
  coverImage?: any;
  isAvailable?: boolean;
  hasBreakfast?: boolean;
  hasCoordinatorServices?: boolean;
  contractTemplate?: string;
  contractTerms?: string[];
  videoItems?: { title: string; url: string }[];
}

export interface SeasonalPricing {
  weekday: number;
  weekend: number;
  summer: number;
  eid: number;
  vacation: number;
}

export interface CustomFeeItem {
  id: string;
  name: string;
  amount: number;
}

export interface AdministrativeFees {
  weekday: number;
  weekend: number;
  summer: number;
  eid: number;
  vacation: number;
  customFees?: CustomFeeItem[];
}

export interface CustomPricingPeriod {
  id: string;
  name: string; // مثل: صيف 2026، عروض نوفمبر
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  basePriceWeekday: number;
  basePriceWeekend: number;
}


export type SpecialFeePeriod =
  | 'weekday' // وسط الأسبوع
  | 'weekend' // الويكند (خميس-جمعة)
  | 'custom_dates' // أيام محددة ومنفصلة
  | 'summer' // الصيف
  | 'vacation' // الإجازات المطولة
  | 'eid'; // الأعياد

export type SpecialFeeMode = '3_variables' | '2_variables';

export interface SpecialAdminFeeBox {
  id: string;
  name: string; // اسم البوكس (مثال: فرق السعر)
  propertyId: string;
  mode: SpecialFeeMode; // 3 متغيرات (+ الإجمالي) أو متغيران (سعر + رسوم)
  period: SpecialFeePeriod;
  periodLabel?: string;
  ownerPrice: number; // سعر العقار (المالك)
  specialAdminFee: number; // الرسوم الإدارية الخاصة
  totalSpecialPrice: number; // السعر الإجمالي الخاص = ownerPrice + specialAdminFee
  isLocked: boolean; // حالة القفل والحفظ
  notes?: string;
  updatedAt?: string;
}

export interface PropertyBreakfastPricing {
  enabled: boolean;
  weekday: number;
  weekend: number;
  summer: number;
  eid: number;
  vacation: number;
}

export interface MergedPropertyConfig {
  isMerged: boolean; // هل العقار عبارة عن دمج بين استراحتين
  mergeType: 'linked_properties' | 'internal_units'; // دمج استراحتين مسجلتين أو دمج وحدتين داخليتين (مثل حمران)
  linkedPropertyIds?: string[]; // معرفات الاستراحتين المدمجتين بالنظام
  linkedPropertyNames?: string[]; // أسماء الاستراحتين المدمجتين
  requireBothAvailable?: boolean; // اشتراط توفر الاستراحتين معاً
}

export interface Property {
  id: string;
  name: string;
  code: string;
  subUnitsCount: number;
  subtitle: string;
  location: string;
  address?: string;
  googleMapsUrl?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  isPublished: boolean;
  basePriceWeekday: number;
  basePriceWeekend: number;
  seasonalPricing: SeasonalPricing;
  administrativeFees: AdministrativeFees;
  hasSections?: boolean; // هل الوحدة تحتوي على أقسام (يوجد / لا يوجد)
  hasBreakfast?: boolean; // هل الوحدة تحتوي على إفطار (يوجد / لا يوجد)
  hasCoordinatorServices?: boolean; // هل الوحدة تحتوي على خدمات منسقات (يوجد / لا يوجد)
  sections?: PropertySection[];
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  poolType: string;
  coverImage: any;
  images: any[];
  features: string[];
  contractTerms: string[];
  contractTemplate?: string;
  iban: string;
  bankName: string;
  accountHolder: string;
  defaultDeposit: number;
  insuranceAmount: number;
  checkInTimeText: string;
  checkOutTimeText: string;
  defaultBreakfastPrice?: number;
  breakfastPricing?: PropertyBreakfastPricing;
  assignedGuardId?: string;
  assignedGuardName?: string;
  assignedGuardPhone?: string;
  assignedGuardNotes?: string;
  videoUrls?: string[];
  videoItems?: { title: string; url: string }[];
  driveUrl?: string;
  isMergedProperty?: boolean;
  mergedConfig?: MergedPropertyConfig;
  mergedPropertyIds?: string[];
  specialAdminFeeBoxes?: SpecialAdminFeeBox[];
  customPricingPeriods?: CustomPricingPeriod[];
  wifiName?: string;
  wifiPassword?: string;
  arrivalInstructions?: string;
  breakfastNote?: string;
  notes?: string;
}

export interface MarketerPermissions {
  canCreateBooking: boolean;
  canEditPrices?: boolean;
  canViewAllBookings?: boolean;
  canBlockDates?: boolean;
  canViewCustomerContacts?: boolean;
  canExportReports?: boolean;
  canViewFinancials?: boolean;
  canCreateContract: boolean;
  canEditDeposit: boolean;
  canViewCalendar: boolean;
  canViewProperties: boolean;
  canViewDashboard: boolean;
  canViewMarketers: boolean;
  canViewGuardTasks?: boolean;
  canViewBookings?: boolean;
  canViewMore?: boolean;
  canManageTemplates: boolean;
  canViewRentalContract: boolean;
  canViewActivityLogs: boolean;
  canViewSupervisor?: boolean;
}

export interface MarketerContract {
  contractNumber: string;
  contractDate: string;
  expiryDate: string;
  commissionRatePercent: number;
  status: string;
  firstParty: string;
  firstPartyRepresentative: string;
  secondParty: string;
  secondPartyPhone: string;
  secondPartyEmail: string;
  secondPartyNationalId?: string;
  secondPartyFalLicense?: string;
  terms: string[];
  isSigned: boolean;
  signedDate: string;
  notes?: string;
}

export interface Marketer {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  avatar: string;
  code: string;
  commissionRate: number;
  joinDate: string;
  bankAccount: string;
  bankName: string;
  nationalId: string;
  falLicenseNumber?: string;
  contract: MarketerContract;
  permissions: MarketerPermissions;
  isSupervisor?: boolean;
}

export interface GuardPermissions {
  canViewCalendar: boolean;
  canViewCustomerContacts: boolean;
  canConfirmArrival: boolean;
  canReceiveInsurance: boolean;
  canInspectUnit: boolean;
  canRefundInsurance: boolean;
  canViewDashboard: boolean;
  canViewBookings: boolean;
  canViewGuardTasks?: boolean;
  canViewProperties?: boolean;
  canViewMarketers?: boolean;
  canViewMore?: boolean;
  canBlockDates?: boolean;
}

export interface Guard {
  id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  avatar: string;
  jobTitle?: string;
  nationalId?: string;
  startDate?: string;
  iban?: string;
  salary?: number;
  assignedPropertyId?: string;
  assignedPropertyName?: string;
  assignedPropertyIds?: string[];
  assignedPropertyNames?: string[];
  permissions?: GuardPermissions;
}

export interface UserAccount {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  avatar?: string;
  marketerId?: string;
  coordinatorId?: string;
  guardId?: string;
  isSupervisor?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type BookingStatus = 'pending' | 'waiting_deposit' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled';
export type CommissionStatus = 'pending' | 'ready_for_payout' | 'paid';

export interface EstatePartRef {
  propertyId: string; // الوحدة (الكوخ، الترف…)
  sectionId: string; // 'all' = الوحدة كاملة (وحدة بلا أقسام)، أو معرّف القسم
  label: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  propertyId: string;
  propertyName: string;
  sectionId?: string;
  sectionName?: string;
  /** حجز عقار مدمج: الأجزاء التي اختارها العميل (وحدة أو قسم). غير موجود = العقار كاملاً */
  estateParts?: EstatePartRef[];
  customerName: string;
  customerPhone: string;
  customerWhatsappUrl?: string;
  customerCallUrl?: string;
  customerNationalId?: string;
  vehiclePlate?: string;
  guestsCount?: number;
  checkInDate: string;
  checkOutDate: string;
  nightsCount: number;
  nightlyPrice: number;
  totalPrice: number;
  adminFee?: number;
  propertyNetPayout?: number;
  taxAmount: number;
  discount: number;
  depositPaid: number;
  remainingAmount: number;
  insuranceAmount: number;
  depositReceiptUrl?: string;
  depositReceiptName?: string;
  receiptsDeletedAfterCommissionPaid?: boolean;
  receiptsDeletedAt?: string;
  marketerId?: string;
  marketerName?: string;
  marketerCommission?: number;
  commissionRatePercent?: number;
  bookingType?: 'full' | 'partial' | 'special' | 'admin' | 'supervisor';
  bookingCategory?: 'standard' | 'special' | 'admin' | 'supervisor';
  isSpecialBooking?: boolean;
  isSupervisorBooking?: boolean;
  supervisorId?: string;
  supervisorName?: string;
  supervisorFee?: number;
  supervisorTotalCredit?: number;
  isAdminBooking?: boolean;
  customAdminNightlyPrice?: number;
  breakfastOption?: string;
  breakfastPrice?: number;
  withoutBreakfast?: boolean;
  breakfastDiscount?: number;
  coordinatorName?: string;
  coordinatorService?: string;
  coordinatorPrice?: number;
  coordinatorPhone?: string;
  coordinatorServicesList?: { id: string; title: string; price: number; coordinatorName: string; coordinatorPhone: string }[];
  baseNightlyTotal?: number;
  commissionStatus?: CommissionStatus;
  status: BookingStatus;
  createdAt: string;
  notes?: string;
  contractSigned: boolean;
  contractMessage?: string;
  checkedOut?: boolean;
  checkedOutAt?: string;
  insuranceReturned?: boolean;
  insuranceReturnedAt?: string;
  guestArrived?: boolean;
  guestArrivedAt?: string;
  insuranceReceivedCash?: boolean;
  insuranceReceivedAt?: string;
  insuranceReturnRequested?: boolean;
  insurancePaymentMethod?: 'receipt' | 'cash';
  insuranceReceiptName?: string;
  insuranceReceiptDataUrl?: string;
  paymentCompleted?: boolean;
  paymentReceiptName?: string;
  paymentReceiptDataUrl?: string;
  paymentCompletedAt?: string;
  paymentCompletedBy?: string;
  arrivalPaymentMethod?: 'receipt' | 'cash';
  checkoutReminderSent?: boolean;
  checkoutReminderSentAt?: string;
  guardInspectionResult?: 'full_refund' | 'deduction';
  insuranceDeductionAmount?: number;
  damageDescription?: string;
  damagePhotos?: { name: string; dataUrl: string }[];
  arrivalConfirmedBy?: string;
  arrivalConfirmedAt?: string;
  /** سجل تتبع الإقامة من الوصول إلى الخروج */
  stayEvents?: StayEvent[];
  /** آخر تنبيه سريع أُرسل بين الحارس والمسوق */
  lastAlert?: { text: string; at: string; by: string; to: 'guard' | 'marketer' };
  cashInsuranceConfirmedByGuard?: boolean;
  insuranceReceivedAmount?: number;
  insurancePendingCashCollection?: boolean;
  insuranceNotifiedToGuardAt?: string;
  digitalInsuranceReceiptUrl?: string;
  digitalInsuranceReceiptName?: string;
  receiptFileName?: string;
  receiptDataUrl?: string;
  insuranceUploadedBy?: string;
  insuranceUploadedAt?: string;
  cleanlinessApproved?: boolean;
  cleanlinessApprovedAt?: string;
  cleanlinessApprovedBy?: string;
  adminApprovedFullBooking?: boolean;
  adminApprovedAt?: string;
  adminApprovedBy?: string;
  customerBankReceiptUrl?: string;
  customerBankReceiptName?: string;
  customerIban?: string;
  insuranceRefundReceiptUrl?: string;
  insuranceRefundReceiptName?: string;
  insuranceRefundRequested?: boolean;
  remainingReceiptName?: string;
  remainingReceiptDataUrl?: string;
}

export interface StayEvent {
  type: 'arrived' | 'checked_out';
  at: string; // وقت العرض (مثل 12:45 م)
  date: string; // yyyy-mm-dd
  by: string;
  byRole: 'guard' | 'admin' | 'marketer' | 'coordinator';
}

export interface DateOverride {
  status?: 'available' | 'booked' | 'blocked' | 'waiting_deposit';
  price?: number;
  adminFee?: number;
  breakfastPrice?: number;
  season?: string;
  bookingId?: string;
  waitingDepositExpiresAt?: number;
  waitingCustomerName?: string;
  waitingCustomerPhone?: string;
  waitingDepositAmount?: number;
  waitingMarketerName?: string;
  waitingMarketerId?: string;
  waitingCommissionRate?: number;
}

export interface SupervisorDateOverride {
  ownerPrice?: number;
  supervisorFee?: number;
  totalPrice?: number;
  patternLabel?: string;
  updatedAt?: string;
}

export interface CommissionRequest {
  id: string;
  marketerId: string;
  marketerName: string;
  fromDate: string;
  toDate: string;
  bookingIds: string[];
  amount: number;
  /** طلب صرف مشرف: تفصيل المبلغ (الرسوم الإدارية + رسوم المشرف + النسبة) */
  kind?: 'marketer' | 'supervisor';
  adminFeeAmount?: number;
  supervisorFeeAmount?: number;
  percentAmount?: number;
  status: 'pending' | 'transferred' | 'rejected';
  createdAt: string;
  processedAt?: string;
  receiptFileName?: string;
  receiptDataUrl?: string;
  adminNote?: string;
  seenByMarketer?: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  details: string;
}

export type BroadcastTargetGroup =
  | 'all'
  | 'all_marketers'
  | 'all_guards'
  | 'specific_guard'
  | 'female_marketers'
  | 'coordinators'
  | 'custom';

export type BroadcastPriority = 'normal' | 'important' | 'urgent';

export type BroadcastCategory = 'decision' | 'alert' | 'update' | 'instruction' | 'general';

export interface AdminBroadcastMessage {
  id: string;
  title: string;
  content: string;
  targetGroup: BroadcastTargetGroup;
  targetGroupName: string;
  targetPropertyId?: string;
  targetPropertyName?: string;
  targetGuardId?: string;
  targetGuardIds?: string[];
  targetMarketerIds?: string[];
  targetCoordinatorIds?: string[];
  priority: BroadcastPriority;
  category: BroadcastCategory;
  effectiveDate: string;
  sentAt: string;
  senderName: string;
  senderRole: string;
  acknowledgedBy?: string[];
  whatsappShared?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  readBy?: string[];
  type: 'booking' | 'deposit_request' | 'deposit_confirmed' | 'deposit_expired' | 'commission' | 'permission' | 'checkout' | 'insurance' | 'system' | 'broadcast';
  targetAudience?: 'all' | 'admin_only' | 'admin_and_guard' | 'marketer' | 'marketers' | 'guards' | 'coordinators' | 'all_staff';
  targetMarketerId?: string;
  targetMarketerIds?: string[];
  targetCoordinatorIds?: string[];
  targetGuardIds?: string[];
  linkToBookingId?: string;
  propertyId?: string;
  targetGuardId?: string;
  broadcastId?: string;
  groupType?: BroadcastTargetGroup;
  groupName?: string;
  priority?: BroadcastPriority;
  category?: BroadcastCategory;
  effectiveDate?: string;
  requiresAcknowledgment?: boolean;
  acknowledgedBy?: string[];
}

export interface MessageTemplates {
  depositRequest: string;
  paymentCompletion: string;
  contract: string;
  checkoutReminder: string;
  coordinatorService?: string;
  quickResponses?: Record<string, string>;
}

export interface ToastData {
  id: string;
  title: string;
  body: string;
  type: 'booking' | 'deposit_confirmed' | 'deposit_request' | 'commission' | 'permission' | 'checkout' | 'insurance' | 'system';
}

export interface CoordinatorServiceItem {
  id: string;
  title: string;
  price: number;
  description: string;
  coordinatorId: string;
  coordinatorName: string;
  coordinatorPhone: string;
  category?: string;
  isActive?: boolean;
}

export interface CoordinatorPermissions {
  canViewDashboard?: boolean;
  canViewGuardTasks?: boolean;
  canViewCalendar: boolean;
  canViewBookings?: boolean;
  canViewProperties?: boolean;
  canViewMarketers?: boolean;
  canViewMore?: boolean;
  canViewAllBookings?: boolean;
  canViewCustomerContacts?: boolean;
  canCreateBooking?: boolean;
  canEditPrices?: boolean;
  canBlockDates?: boolean;
  canExportReports?: boolean;
  canViewFinancials?: boolean;
  canCreateContract?: boolean;
  canEditDeposit?: boolean;
  canManageTemplates?: boolean;
  canViewRentalContract?: boolean;
  canViewActivityLogs?: boolean;
}

export interface Coordinator {
  id: string;
  name: string;
  phone: string;
  email?: string;
  specialty: string;
  avatar: string;
  rating: number;
  completedTasks: number;
  status: 'available' | 'busy';
  bankName?: string;
  bankAccount?: string;
  nationalId?: string;
  permissions?: CoordinatorPermissions;
}

export interface CoordinationTask {
  id: string;
  bookingCode?: string;
  customerName: string;
  customerPhone: string;
  propertyName: string;
  date: string;
  serviceTitle: string;
  serviceDetails: string;
  coordinatorId: string;
  coordinatorName: string;
  coordinatorPhone: string;
  status: 'pending' | 'in_progress' | 'completed';
  price: number;
  notes?: string;
}

export interface PropertyExpense {
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  category: 'maintenance' | 'cleaning' | 'supplies' | 'hospitality' | 'utilities' | 'other';
  amount: number;
  date: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export type TaskShift = 'morning' | 'evening';
export type GuardTaskStatus = 'pending' | 'in_progress' | 'completed' | 'verified';
export type GuardTaskPriority = 'normal' | 'important' | 'urgent';

export interface TaskProofPhoto {
  id: string;
  url: string;
  timestamp: string;
  note?: string;
}

export interface GuardDailyTask {
  id: string;
  title: string;
  description?: string;
  propertyId: string;
  propertyName: string;
  guardId?: string;
  guardName?: string;
  shift: TaskShift;
  date: string; // YYYY-MM-DD
  timeSlot?: string;
  adminReferencePhoto?: string;
  deductionAmount?: number;
  deductionApplied?: boolean;
  deductionAppliedAt?: string;
  priority: GuardTaskPriority;
  status: GuardTaskStatus;
  requiresPhoto: boolean;
  proofPhotos: TaskProofPhoto[];
  guardNotes?: string;
  adminFeedback?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
  templateId?: string;
  isWeeklyPinned?: boolean;
  weeklyDays?: number[]; // 0 (Sunday) .. 6 (Saturday)
}

export interface GuardTaskTemplate {
  id: string;
  title: string; // اسم المهمة
  description?: string;
  shift: TaskShift;
  priority: GuardTaskPriority;
  timeSlot?: string;
  deductionAmount?: number;
  requiresPhoto: boolean;
  adminReferencePhoto?: string;
  guardId?: string;
  guardName?: string;
  isWeeklyRecurring?: boolean; // تثبيت أسبوعي آلي
  weeklyDays?: number[]; // 0 (الأحد) .. 6 (السبت)
  lastGeneratedDate?: string; // YYYY-MM-DD
  createdAt?: string;
}

export type KayanUnit = 'piece' | 'carton' | 'bale';

export interface KayanDetergentItem {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  defaultUnit: KayanUnit;
  referencePrice?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KayanOrderItem {
  itemId: string;
  itemCode: string;
  name: string;
  quantity: number;
  unit: KayanUnit;
}

export interface KayanOrderSheet {
  id: string;
  orderNumber: string;
  createdAt: string;
  delegatePhone: string;
  delegateName?: string;
  propertyName: string;
  locationUrl: string;
  notes?: string;
  items: KayanOrderItem[];
}

export interface KayanSettings {
  delegatePhone: string;
  delegateName?: string;
  propertyName: string;
  locationUrl: string;
}
