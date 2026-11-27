import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  ActivityLog,
  AppNotification,
  Booking,
  BookingStatus,
  CommissionRequest,
  DateOverride,
  Guard,
  GuardPermissions,
  CoordinatorPermissions,
  Marketer,
  MarketerPermissions,
  MessageTemplates,
  Property,
  PropertySection,
  ToastData,
  UserAccount,
  UserRole,
  AdminBroadcastMessage,
  BroadcastTargetGroup,
  BroadcastPriority,
  BroadcastCategory,
  SeasonalPricing,
  AdministrativeFees,
  PropertyBreakfastPricing,
  CoordinatorServiceItem,
  Coordinator,
  PropertyExpense,
  GuardDailyTask,
  GuardTaskTemplate,
  TaskShift,
  TaskProofPhoto,
  GuardTaskStatus,
  GuardTaskPriority,
  SpecialAdminFeeBox,
  SpecialFeePeriod,
  SpecialFeeMode,
  CustomPricingPeriod,
  SupervisorDateOverride,
  KayanDetergentItem,
  KayanOrderSheet,
  KayanSettings,
  EstatePartRef,
} from '../types';
import {
  INITIAL_KAYAN_ITEMS,
  KAYAN_DEFAULT_SETTINGS,
} from '../lib/kayanDetergents';
import { STORAGE_KEYS, StorageService } from '../lib/storage';
import {
  DEMO_SAMPLE_COMMISSION_REQUESTS,
  DEMO_SAMPLE_MARKETERS,
  DEMO_SAMPLE_USER_ACCOUNTS,
  exitPersonalDemoMode,
  isPersonalDemoMode,
  attachDemoMarketers,
} from '../lib/demoMode';
import { isBookingCheckedOut, sumSupervisorPayout } from '../lib/financials';
import {
  clonePropertyAsDuplicate,
  clonePropertySection,
  createDefaultSectionsForProperty,
  executePropertyOrSectionTransfer,
  resolveContractTemplateAndTerms,
  resolvePropertyHasSections,
  TransferUnitOrSectionParams,
  TransferUnitOrSectionResult,
  getWholeSectionIds,
  isLinkedEstate,
  getEstateNightPrice,
  getPartNightPrice,
  estateBookingBlocksUnit,
  bookingOccupiesPart,
  estateOverrideKeys,
} from '../lib/propertyUtils';
import {
  INITIAL_BOOKINGS,
  INITIAL_GUARD,
  INITIAL_GUARDS_LIST,
  INITIAL_LOGS,
  INITIAL_MARKETERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PROPERTIES,
  MAZRAA_ESTATE,
  INITIAL_TEMPLATES,
  INITIAL_USER_ACCOUNTS,
  INITIAL_ADMIN_BROADCASTS,
  INITIAL_COORDINATOR_SERVICES,
  INITIAL_COORDINATORS,
  INITIAL_EXPENSES,
  INITIAL_GUARD_TASKS,
  INITIAL_GUARD_TASK_TEMPLATES,
  INITIAL_SPECIAL_ADMIN_FEE_BOXES,
} from '../data/mock';
import {
  getBrowserNotificationPermission,
  playChimeSound,
  requestBrowserNotificationPermission,
  triggerSystemNotification,
  unlockMobileAudio,
} from '../lib/sound';
import {
  dispatchRemotePushNotification,
  sendSelfTestWebPush,
  syncWebPushSubscription,
} from '../lib/pushNotifications';
import { PushSubscriberMeta } from '../lib/pushMatching';
import {
  buildCustomerCallUrl,
  buildCustomerWhatsappUrl,
} from '../lib/customerLinks';
import { deleteMediaFromIndexedDB } from '../lib/mediaStorage';
import {
  getSavedSpreadsheetInfo,
  appendBookingToSheet,
} from '../services/googleSheetsService';
import {
  clearBookingReceiptsAfterCommissionPaid,
  hasAnyBookingReceiptFields,
  isRenderableReceiptUrl,
} from '../lib/bookingReceipts';
import { googleLogout } from '../services/googleAuth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  CLIENT_SYNC_ID,
  createFirestoreSyncState,
  deleteAuthorizedUserFromFirestore,
  deleteCollectionDocFromFirestore,
  ensureFirestoreAdminBootstrap,
  fetchAuthorizedUserStatusFromFirestore,
  hasMissingAuthorizedEmailsInCache,
  hydrateFromFirestoreOnce,
  isCurrentUserAdmin,
  notifySyncStatus,
  OWNER_EMAIL,
  propagateAuthorizedEmailsToAllCollections,
  pushAdminFeeBoxesToFirestore,
  pushBookingsToFirestore,
  pushCommissionRequestsToFirestore,
  pushGuardTasksToFirestore,
  pushPropertiesToFirestore,
  pushStaffMembersToFirestore,
  pushSystemStateToFirestore,
  SaveResult,
  StoreData,
  subscribeFirestoreRealtime,
  subscribeSyncStatus,
  syncAuthorizedUsersToFirestore,
  SyncStatus,
} from '../services/firestoreSync';

const READ_NOTIFS_STORAGE_KEY = 'amasa_read_notifs_v1';

interface NotificationAudienceContext {
  isAdmin: boolean;
  isGuard: boolean;
  isCoordinator: boolean;
  activeGuardId: string;
  guardPropertyIds: string[];
  currentCoordinatorId: string;
  currentCoordinatorName?: string;
  currentMarketerId: string;
  bookings: Booking[];
  marketers: Marketer[];
}

function isNotificationVisibleToActor(
  n: AppNotification,
  ctx: NotificationAudienceContext
): boolean {
  if (ctx.isAdmin) return true;

  if (ctx.isGuard) {
    if (
      n.targetAudience === 'admin_only' ||
      n.targetAudience === 'marketer' ||
      n.targetAudience === 'marketers' ||
      n.targetAudience === 'coordinators' ||
      n.groupType === 'all_marketers' ||
      n.groupType === 'female_marketers' ||
      n.groupType === 'coordinators'
    ) {
      return false;
    }

    if (n.groupType === 'custom') {
      return Boolean(n.targetGuardIds?.includes(ctx.activeGuardId) || n.targetGuardId === ctx.activeGuardId);
    }

    if (n.targetAudience === 'guards' || n.groupType === 'all_guards') {
      return true;
    }

    if (n.targetGuardIds && n.targetGuardIds.length > 0) {
      return n.targetGuardIds.includes(ctx.activeGuardId);
    }

    if (n.targetGuardId) {
      return (
        n.targetGuardId === ctx.activeGuardId ||
        Boolean(n.propertyId && ctx.guardPropertyIds.includes(n.propertyId))
      );
    }

    if (n.propertyId) {
      return ctx.guardPropertyIds.includes(n.propertyId);
    }
    if (n.linkToBookingId) {
      const bk = ctx.bookings.find((b) => b.id === n.linkToBookingId);
      if (bk?.propertyId) {
        return ctx.guardPropertyIds.includes(bk.propertyId);
      }
    }

    return n.targetAudience === 'all' || n.targetAudience === 'admin_and_guard' || n.targetAudience === 'all_staff';
  }

  if (ctx.isCoordinator) {
    if (
      n.targetAudience === 'admin_only' ||
      n.targetAudience === 'admin_and_guard' ||
      n.targetAudience === 'guards' ||
      n.targetAudience === 'marketer' ||
      n.targetAudience === 'marketers' ||
      n.groupType === 'all_guards' ||
      n.groupType === 'specific_guard' ||
      n.groupType === 'all_marketers' ||
      n.groupType === 'female_marketers'
    ) {
      return false;
    }

    if (n.groupType === 'custom') {
      return Boolean(n.targetCoordinatorIds?.includes(ctx.currentCoordinatorId));
    }

    if (n.targetCoordinatorIds && n.targetCoordinatorIds.length > 0) {
      return n.targetCoordinatorIds.includes(ctx.currentCoordinatorId);
    }

    if (n.groupType === 'coordinators' || n.targetAudience === 'coordinators') {
      return true;
    }

    if (n.linkToBookingId) {
      const bk = ctx.bookings.find((b) => b.id === n.linkToBookingId);
      if (bk && ctx.currentCoordinatorName) {
        const isAssignedCoord =
          bk.coordinatorName === ctx.currentCoordinatorName ||
          bk.coordinatorServicesList?.some((s) => s.coordinatorName === ctx.currentCoordinatorName) ||
          bk.marketerId === ctx.currentCoordinatorId;
        if (isAssignedCoord) return true;
      }
      return n.targetAudience === 'all' || n.targetAudience === 'all_staff';
    }

    return n.targetAudience === 'all' || n.targetAudience === 'all_staff';
  }

  // Marketer
  const femaleNames = ['سارة', 'ريم', 'نورة', 'منيرة', 'هند', 'مها', 'عبير', 'خلود', 'فاطمة', 'عائشة', 'لطيفة', 'أمل', 'شهد'];
  const currentMkt = ctx.marketers.find((m) => m.id === ctx.currentMarketerId);
  const isFemaleMarketer = currentMkt
    ? femaleNames.some((fn) => currentMkt.name.includes(fn)) ||
      currentMkt.id === 'm2' ||
      currentMkt.id === 'm4' ||
      currentMkt.id === 'm5'
    : false;

  if (
    n.targetAudience === 'admin_only' ||
    n.targetAudience === 'admin_and_guard' ||
    n.targetAudience === 'guards' ||
    n.targetAudience === 'coordinators' ||
    n.groupType === 'all_guards' ||
    n.groupType === 'specific_guard' ||
    n.groupType === 'coordinators'
  ) {
    return false;
  }

  if (n.groupType === 'custom') {
    return Boolean(n.targetMarketerIds?.includes(ctx.currentMarketerId));
  }

  if (n.groupType === 'female_marketers') {
    return isFemaleMarketer;
  }

  if (n.targetMarketerIds && n.targetMarketerIds.length > 0) {
    return n.targetMarketerIds.includes(ctx.currentMarketerId);
  }

  if (n.targetMarketerId && n.targetMarketerId !== ctx.currentMarketerId) {
    return false;
  }

  if (n.linkToBookingId) {
    const bk = ctx.bookings.find((b) => b.id === n.linkToBookingId);
    if (bk && bk.marketerId && bk.marketerId !== ctx.currentMarketerId) {
      return false;
    }
  }

  return true;
}

export type ActiveTab = 'calendar' | 'bookings' | 'supervisor' | 'dashboard' | 'properties' | 'marketers' | 'more' | 'guard-tasks' | 'kayan-detergents';
export type AuthModalMode = 'quick_select' | 'login' | 'change_password' | 'roles';

export interface SimulationState {
  isSimulating: boolean;
  role: UserRole;
  targetId?: string;
  targetName: string;
  targetCode?: string;
  targetProperty?: string;
  targetPhone?: string;
  startedAt?: string;
}

export interface AppContextType {
  simulation: SimulationState;
  startSimulation: (role: UserRole, targetId?: string, targetName?: string, targetProperty?: string) => void;
  exitSimulation: () => void;
  testAlertOnCurrentAccount: (targetRole?: UserRole, targetId?: string, targetName?: string) => void;
  diagnoseCurrentAccount: () => { hasErrors: boolean; issues: string[]; details: string[] };
  isAccountSwitcherOpen: boolean;
  setIsAccountSwitcherOpen: (open: boolean) => void;
  openAccountSwitcher: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userRole: UserRole;
  currentMarketerId: string;
  currentMarketer: Marketer | null;
  currentCoordinatorId: string;
  currentCoordinator: Coordinator | null;
  guard: Guard;
  guardPropertyIds: string[];
  isAdmin: boolean;
  isGuard: boolean;
  isCoordinator: boolean;
  isSupervisor: boolean;
  activePermissions: MarketerPermissions;
  switchUser: (role: UserRole, targetId?: string) => void;
  updateGuardProfile: (data: Partial<Guard>, guardId?: string) => void;
  addGuard: (guardData: Omit<Guard, 'id'>) => Guard;
  deleteGuard: (guardId: string) => { success: boolean; message: string };
  updateGuardPermissions: (perms: Partial<GuardPermissions>, guardId?: string) => void;
  toggleGuardPermission: (key: keyof GuardPermissions, guardId?: string) => void;
  userAccounts: UserAccount[];
  currentUserAccount: UserAccount;
  loginWithGmailAndPassword: (email: string, pass: string) => { success: boolean; message: string };
  loginWithGoogleAuth: (email: string, displayName?: string, photoURL?: string) => Promise<{ success: boolean; message: string; account?: UserAccount }>;
  addMemberByEmail: (email: string, role: UserRole, customName?: string) => Promise<{ success: boolean; message: string }>;
  isAuthenticated: boolean;
  isInitialHydrating: boolean;
  isDemoMode: boolean;
  setIsAuthenticated: (val: boolean) => void;
  syncStatus: SyncStatus;
  syncMessage: string;
  refreshFromServer: () => Promise<boolean>;
  changePassword: (accountId: string, newPass: string) => { success: boolean; message: string };
  updateUserAccount: (accountId: string, data: Partial<UserAccount>) => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: AuthModalMode;
  setAuthModalMode: (mode: AuthModalMode) => void;
  openAuthModal: (mode?: AuthModalMode) => void;

  canCreateContract: boolean;
  canEditDeposit: boolean;
  canViewDashboard: boolean;
  canViewGuardTasks: boolean;
  canViewCalendar: boolean;
  canViewBookings: boolean;
  canViewSupervisor: boolean;
  canViewProperties: boolean;
  canViewMarketers: boolean;
  canViewMore: boolean;
  canViewKayanDetergents: boolean;
  canManageTemplates: boolean;
  canViewRentalContract: boolean;
  canViewActivityLogs: boolean;

  grantAllMarketersContractAndDepositPermissions: () => void;
  updateWaitingDepositAmount: (propertyId: string, dates: string[], amount: number, sectionId?: string) => void;

  properties: Property[];
  selectedPropertyId: string;
  selectedProperty: Property;
  setSelectedPropertyId: (id: string) => void;
  addProperty: (propertyData: Partial<Property> & { name: string; basePriceWeekday: number }) => Property;
  updateProperty: (id: string, data: Partial<Property>) => void;
  deleteProperty: (propertyId: string) => { success: boolean; message: string };
  duplicateProperty: (propertyId: string) => Property | null;
  updatePropertySection: (propertyId: string, sectionId: string, data: Partial<PropertySection>) => void;
  duplicatePropertySection: (propertyId: string, sectionId: string) => PropertySection | null;
  addPropertySection: (propertyId: string, sectionData: Partial<PropertySection>) => PropertySection | null;
  deletePropertySection: (propertyId: string, sectionId: string) => void;
  togglePropertyBreakfast: (propertyId: string) => void;
  togglePropertyCoordinatorServices: (propertyId: string) => void;
  togglePropertyHasSections: (propertyId: string) => void;
  transferPropertyOrSection: (params: TransferUnitOrSectionParams) => TransferUnitOrSectionResult;
  togglePropertyPublished: (propertyId: string) => void;
  guardsList: Guard[];
  updatePropertyGuard: (propertyId: string, guardData: { guardId?: string; guardName: string; guardPhone: string; guardNotes?: string }) => void;
  updatePropertyPhotos: (propertyId: string, photos: { coverImage?: string; images: string[] }) => void;
  deletePropertyPhoto: (propertyId: string, photoUrl: string) => void;
  addPropertyPhotos: (propertyId: string, newPhotoUrls: string[]) => void;
  setPropertyCoverPhoto: (propertyId: string, photoUrl: string) => void;
  addPropertyVideo: (propertyId: string, videoUrl: string) => void;
  deletePropertyVideo: (propertyId: string, videoIndex: number) => void;
  savePropertiesNow: () => Promise<SaveResult>;
  switchGuardAssignedProperty: (propertyId: string) => void;
  updatePropertySeasonalPricing: (propertyId: string, seasonalPricing: SeasonalPricing) => void;
  updatePropertyBreakfastPrice: (propertyId: string, defaultBreakfastPrice: number) => void;
  updatePropertyBreakfastPricing: (propertyId: string, breakfastPricing: PropertyBreakfastPricing) => void;
  updatePropertyAdministrativeFees: (propertyId: string, administrativeFees: AdministrativeFees) => void;
  updatePropertyCustomPricingPeriods: (propertyId: string, periods: CustomPricingPeriod[]) => void;

  coordinatorServices: CoordinatorServiceItem[];
  addCoordinatorService: (service: Omit<CoordinatorServiceItem, 'id'>) => CoordinatorServiceItem;
  updateCoordinatorService: (id: string, updates: Partial<CoordinatorServiceItem>) => void;
  deleteCoordinatorService: (id: string) => void;

  coordinators: Coordinator[];
  addCoordinator: (coord: Omit<Coordinator, 'id' | 'rating' | 'completedTasks'> & { rating?: number; completedTasks?: number }) => Coordinator;
  updateCoordinator: (id: string, data: Partial<Coordinator>) => void;
  updateCoordinatorPermissions: (id: string, perms: Partial<CoordinatorPermissions>) => void;
  deleteCoordinator: (id: string) => { success: boolean; message: string };

  marketers: Marketer[];
  updateMarketerPermissions: (id: string, perms: Partial<MarketerPermissions>) => void;
  saveMarketerPermissions: (id: string, perms?: Partial<MarketerPermissions>) => Promise<{ success: boolean; message: string }>;
  updateMarketerProfile: (id: string, data: Partial<Marketer>) => void;
  addMarketer: (data: { name: string; email: string; phone: string; nationalId?: string; falLicenseNumber?: string; bankAccount?: string; bankName?: string }) => Promise<{ success: boolean; message: string }>;
  deleteMarketer: (marketerId: string) => { success: boolean; message: string };
  addAdminAccount: (data: { name: string; email: string; phone?: string }) => { success: boolean; message: string; password?: string };
  deleteUserAccount: (accountId: string) => { success: boolean; message: string };
  setMarketerAccountRole: (marketerId: string, role: UserRole) => { success: boolean; message: string };
  promoteMarketerToSupervisor: (marketerId: string, promote: boolean) => { success: boolean; message: string };
  payMarketerCommission: (bookingId: string) => void;
  payoutAllMarketerCommissions: (marketerId: string) => void;
  payoutSupervisorBalance: (supervisorId: string) => void;

  bookings: Booking[];
  filteredBookings: Booking[];
  todayArrivals: Booking[];
  todayDepartures: Booking[];
  addBooking: (booking: Partial<Booking> & { propertyId: string; customerName: string; customerPhone: string; checkInDate: string; checkOutDate: string }) => Booking;
  updateBookingContractFields: (
    bookingId: string,
    fields: { customerNationalId?: string; vehiclePlate?: string; guestsCount?: number }
  ) => void;
  updateBookingStatus: (id: string, status: Booking['status']) => void;
  cancelBooking: (id: string) => void;
  sendCheckoutReminder: (bookingId: string) => { whatsappUrl: string; message: string };
  sendPaymentCompletionRequest: (bookingId: string) => { whatsappUrl: string; message: string };
  sendCoordinatorWhatsAppNotification: (bookingId: string) => { whatsappUrl: string; message: string; coordinatorName: string; coordinatorPhone: string } | null;
  markCheckedOut: (bookingId: string) => void;
  guardMarkArrived: (bookingId: string) => void;
  guardReceiveInsurance: (bookingId: string) => void;
  guardRequestInsuranceReturn: (bookingId: string) => void;
  returnInsuranceDeposit: (bookingId: string) => void;
  completeBookingPayment: (bookingId: string, receiptName: string, receiptDataUrl?: string) => void;
  recordCustomerArrival: (params: {
    bookingId: string;
    paymentMethod: 'receipt' | 'cash';
    receiptName?: string;
    receiptDataUrl?: string;
    notes?: string;
  }) => void;
  recordInsuranceReceived: (params: {
    bookingId: string;
    paymentMethod: 'receipt' | 'cash';
    receiptName?: string;
    receiptDataUrl?: string;
    notes?: string;
  }) => void;
  notifyGuardForCashPayment: (params: {
    bookingId: string;
    notes?: string;
  }) => void;
  guardProcessDeparture: (params: {
    bookingId: string;
    result: 'full_refund' | 'deduction';
    deductionAmount?: number;
    damageDescription?: string;
    damagePhotos?: { name: string; dataUrl: string }[];
    notes?: string;
  }) => void;
  confirmAttendanceByGuard: (bookingId: string) => void;
  confirmCashInsuranceByGuard: (params: string | {
    bookingId: string;
    receivedAmount?: number;
    notes?: string;
  }) => void;
  notifyGuardForCashInsurance: (params: {
    bookingId: string;
    insuranceAmount?: number;
    notes?: string;
  }) => void;
  uploadDigitalInsuranceReceipt: (params: {
    bookingId: string;
    receiptName: string;
    receiptDataUrl: string;
    notes?: string;
  }) => void;
  approveCleanlinessAndExit: (params: {
    bookingId: string;
    result: 'full_refund' | 'deduction';
    deductionAmount?: number;
    damageDescription?: string;
    damagePhotos?: { name: string; dataUrl: string }[];
    notes?: string;
  }) => void;
  toggleAdminCommissionApproval: (bookingId: string) => void;
  uploadRemainingPaymentReceipt: (params: {
    bookingId: string;
    receiptName: string;
    receiptDataUrl: string;
    notes?: string;
  }) => void;
  toggleGuestArrivalStatus: (bookingId: string) => { isArrived: boolean };
  sendQuickAlert: (params: { bookingId: string; to: 'guard' | 'marketer'; title: string; text: string }) => void;
  requestInsuranceRefundViaBank: (params: {
    bookingId: string;
    bankReceiptName?: string;
    bankReceiptDataUrl?: string;
    customerIban?: string;
    notes?: string;
  }) => void;
  requestInsuranceRefundViaGuardCash: (params: {
    bookingId: string;
    notes?: string;
  }) => void;
  finishBookingAndReturnInsurance: (params: {
    bookingId: string;
    receiptName?: string;
    receiptDataUrl?: string;
    notes?: string;
  }) => void;

  dateOverrides: Record<string, DateOverride>;
  setDateOverride: (propertyId: string, date: string, override: Partial<DateOverride>, sectionId?: string) => void;
  setDateOverridesBulk: (propertyId: string, dates: string[], override: Partial<DateOverride>, sectionId?: string) => void;
  applySeasonalPricingPattern: (propertyId: string, dates: string[], season: keyof Property['seasonalPricing'], sectionId?: string) => void;

  requestDeposit: (params: {
    propertyId: string;
    dates: string[];
    customerName: string;
    customerPhone: string;
    depositAmount: number;
    totalPrice: number;
    nightsCount: number;
    marketerId?: string;
    commissionRatePercent?: number;
    sectionId?: string;
    sectionName?: string;
    breakfastOption?: string;
    breakfastPrice?: number;
    coordinatorName?: string;
    coordinatorService?: string;
    coordinatorPrice?: number;
    baseNightlyTotal?: number;
    isSupervisorBooking?: boolean;
  }) => { whatsappUrl: string; message: string };
  cancelDepositWait: (propertyId: string, dates: string[], sectionId?: string) => void;
  extendDepositWait: (propertyId: string, dates: string[], sectionId?: string) => void;
  confirmBookingWithReceipt: (params: {
    propertyId: string;
    dates: string[];
    customerName: string;
    customerPhone: string;
    depositPaid: number;
    totalPrice: number;
    remainingAmount: number;
    insuranceAmount: number;
    receiptFileName: string;
    receiptDataUrl?: string;
    marketerId?: string;
    commissionRatePercent?: number;
    notes?: string;
    sectionId?: string;
    sectionName?: string;
    estateParts?: EstatePartRef[];
    breakfastOption?: string;
    breakfastPrice?: number;
    coordinatorName?: string;
    coordinatorService?: string;
    coordinatorPrice?: number;
    baseNightlyTotal?: number;
    isSupervisorBooking?: boolean;
    supervisorId?: string;
    supervisorName?: string;
    supervisorFee?: number;
    supervisorTotalCredit?: number;
    customerNationalId?: string;
    vehiclePlate?: string;
    guestsCount?: number;
  }) => { booking: Booking; whatsappContractUrl: string; contractText: string };

  notifications: AppNotification[];
  filteredNotifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationsAsRead: () => void;

  commissionRequests: CommissionRequest[];
  getEligibleCommissionBookings: (marketerId: string, fromDate: string, toDate: string) => Booking[];
  createCommissionRequest: (params: { fromDate: string; toDate: string }) => { ok: boolean; message: string };
  markCommissionTransferred: (requestId: string, receiptFileName?: string, receiptDataUrl?: string) => void;
  rejectCommissionRequest: (requestId: string, note?: string) => void;
  markCommissionRequestSeen: (requestId: string) => void;

  expenses: PropertyExpense[];
  addExpense: (expense: Omit<PropertyExpense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;

  activityLogs: ActivityLog[];
  logActivity: (actorName: string, actorRole: string, action: string, details: string) => void;

  bookingModalOpen: boolean;
  setBookingModalOpen: (open: boolean) => void;
  preselectedDateForBooking: string | null;
  setPreselectedDateForBooking: (date: string | null) => void;
  preselectedSectionForBooking: string | null;
  setPreselectedSectionForBooking: (sectionId: string | null) => void;

  messageTemplates: MessageTemplates;
  updateMessageTemplates: (templates: Partial<MessageTemplates>) => void;
  resetMessageTemplates: () => void;
  templatesModalOpen: boolean;
  setTemplatesModalOpen: (open: boolean) => void;
  activeTemplateTab: keyof MessageTemplates;
  openTemplatesModal: (tab?: keyof MessageTemplates) => void;

  resetAllData: () => void;
  nowTimestamp: number;

  browserNotificationPermission: NotificationPermission | 'unsupported';
  requestBrowserNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  isPushSubscribed: boolean;
  syncPushSubscription: () => Promise<boolean>;
  sendBackgroundPushTest: () => Promise<boolean>;
  isSoundEnabled: boolean;
  toggleSound: () => void;
  activeToast: ToastData | null;
  dismissToast: () => void;
  triggerBrowserNotification: (title: string, body: string, type?: ToastData['type']) => void;
  sendTestNotification: () => void;

  adminBroadcasts: AdminBroadcastMessage[];
  sendAdminBroadcast: (params: {
    title: string;
    content: string;
    targetGroup: BroadcastTargetGroup;
    targetGroupName?: string;
    targetPropertyId?: string;
    targetPropertyName?: string;
    targetGuardId?: string;
    targetGuardIds?: string[];
    targetMarketerIds?: string[];
    targetCoordinatorIds?: string[];
    priority: BroadcastPriority;
    category: BroadcastCategory;
    effectiveDate?: string;
    sendWhatsapp?: boolean;
  }) => { ok: boolean; message: string; broadcastId: string; whatsappUrl?: string };
  deleteAdminBroadcast: (broadcastId: string) => void;
  acknowledgeBroadcast: (broadcastId: string) => void;
  adminBroadcastModalOpen: boolean;
  setAdminBroadcastModalOpen: (open: boolean) => void;
  activeUrgentBroadcast: AdminBroadcastMessage | null;

  guardTasks: GuardDailyTask[];
  addGuardTask: (task: Omit<GuardDailyTask, 'id' | 'createdAt' | 'proofPhotos' | 'status'> & { proofPhotos?: TaskProofPhoto[]; status?: GuardTaskStatus }) => GuardDailyTask;
  updateGuardTask: (id: string, updates: Partial<GuardDailyTask>) => void;
  deleteGuardTask: (id: string) => void;
  completeGuardTaskWithPhoto: (taskId: string, photoDataUrl: string, note?: string) => void;
  completeGuardTaskWithoutPhoto: (taskId: string, note?: string) => void;
  verifyGuardTask: (taskId: string, adminFeedback?: string) => void;
  reopenGuardTask: (taskId: string, adminFeedback: string) => void;
  sendGuardFieldReport: (params: { propertyId: string; propertyName: string; category: 'maintenance' | 'supplies' | 'emergency' | 'guest_note'; title: string; details: string; guardId?: string; guardName?: string }) => void;

  guardTaskTemplates: GuardTaskTemplate[];
  addGuardTaskTemplate: (tpl: Omit<GuardTaskTemplate, 'id' | 'createdAt'>) => GuardTaskTemplate;
  updateGuardTaskTemplate: (id: string, updates: Partial<GuardTaskTemplate>) => void;
  deleteGuardTaskTemplate: (id: string) => void;
  generateWeeklyGuardTasksNow: (forceToday?: boolean) => number;

  specialAdminFeeBoxes: SpecialAdminFeeBox[];
  saveSpecialFeeBox: (box: SpecialAdminFeeBox) => void;
  deleteSpecialFeeBox: (id: string) => void;
  getSpecialFeeForPeriod: (propertyId: string, period: SpecialFeePeriod) => SpecialAdminFeeBox | undefined;

  supervisorDateOverrides: Record<string, SupervisorDateOverride>;
  setSupervisorDateOverride: (propertyId: string, date: string, override: Partial<SupervisorDateOverride>, sectionId?: string) => void;
  setSupervisorDateOverridesBulk: (propertyId: string, dates: string[], override: Partial<SupervisorDateOverride>, sectionId?: string) => void;
  customSupervisorRates: number[];
  addCustomSupervisorRate: (rate: number) => void;
  removeCustomSupervisorRate: (rate: number) => void;

  kayanItems: KayanDetergentItem[];
  kayanSettings: KayanSettings;
  kayanOrders: KayanOrderSheet[];
  addKayanItem: (item: Omit<KayanDetergentItem, 'id' | 'createdAt' | 'updatedAt'>) => KayanDetergentItem;
  updateKayanItem: (id: string, updates: Partial<KayanDetergentItem>) => void;
  deleteKayanItem: (id: string) => void;
  updateKayanSettings: (updates: Partial<KayanSettings>) => void;
  saveKayanOrder: (order: KayanOrderSheet) => void;
  deleteKayanOrder: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AMASA_BUSINESS_PHONE = '0599525515';
export const AMASA_BUSINESS_PHONE_INTL = '966599525515';

// Universal alias dictionary mapping canonical placeholders to all English & Arabic variations
const TEMPLATE_ALIAS_GROUPS: Record<string, string[]> = {
  customerName: ['customerName', 'customer_name', 'اسم_العميل', 'اسم العميل', 'العميل', 'clientName', 'client_name'],
  customerPhone: ['customerPhone', 'customer_phone', 'رقم_الجوال', 'رقم الجوال', 'جوال_العميل', 'جوال العميل', 'رقم_جوال_العميل', 'رقم جوال العميل', 'هاتف_العميل', 'هاتف العميل', 'جوال', 'phone', 'clientPhone', 'client_phone'],
  propertyName: ['propertyName', 'property_name', 'اسم_العقار', 'اسم العقار', 'العقار', 'chaletName', 'chalet_name'],
  sectionName: ['sectionName', 'section_name', 'اسم_القسم', 'القسم'],
  nightsCount: ['nightsCount', 'nights_count', 'عدد_الليالي', 'عدد الليالي', 'الليالي', 'nights'],
  depositAmount: ['depositAmount', 'deposit_amount', 'مبلغ_العربون', 'مبلغ العربون', 'العربون', 'deposit', 'depositPaid'],
  totalPrice: ['totalPrice', 'total_price', 'المبلغ_الإجمالي', 'المبلغ الإجمالي', 'إجمالي_المبلغ', 'السعر_الإجمالي', 'total'],
  remainingAmount: ['remainingAmount', 'remaining_amount', 'المبلغ_المتبقي', 'المبلغ المتبقي', 'المتبقي', 'remaining'],
  insuranceAmount: ['insuranceAmount', 'insurance_amount', 'مبلغ_التأمين', 'مبلغ التأمين', 'التأمين', 'insurance'],
  bankName: ['bankName', 'bank_name', 'اسم_البنك', 'اسم البنك', 'البنك'],
  accountHolder: ['accountHolder', 'account_holder', 'accountName', 'اسم_الحساب', 'اسم الحساب', 'المستفيد', 'اسم_المستفيد'],
  iban: ['iban', 'ibanNumber', 'رقم_الآيبان', 'رقم الآيبان', 'الآيبان', 'IBAN'],
  paymentDeadline: ['paymentDeadline', 'payment_deadline', 'depositDeadline', 'مهلة_الدفع', 'مهلة الدفع', 'مهلة_سداد_العربون', 'المهلة', 'deadline'],
  checkInDate: ['checkInDate', 'check_in_date', 'تاريخ_الدخول', 'تاريخ الدخول', 'يوم_الدخول'],
  checkInTime: ['checkInTime', 'check_in_time', 'وقت_الدخول', 'وقت الدخول', 'الساعة'],
  checkOutDate: ['checkOutDate', 'check_out_date', 'تاريخ_الخروج', 'تاريخ الخروج', 'يوم_الخروج'],
  checkOutTime: ['checkOutTime', 'check_out_time', 'وقت_الخروج', 'وقت الخروج'],
  bookingNumber: ['bookingNumber', 'booking_number', 'رقم_الحجز', 'رقم الحجز', 'الحجز', 'bookingCode'],
  contractTerms: ['contractTerms', 'contract_terms', 'شروط_العقد', 'شروط العقد', 'الشروط_والأحكام', 'بنود_العقد', 'بنود العقد', 'terms'],
  guardName: ['guardName', 'guard_name', 'اسم_الحارس', 'اسم الحارس', 'الحارس'],
  businessPhone: ['businessPhone', 'business_phone', 'businessNumber', 'رقم_الإدارة', 'رقم الإدارة', 'رقم_الواتساب', 'واتساب_ماسة', 'واتساب_AMASA', 'هاتف_الأعمال'],
  marketerName: ['marketerName', 'marketer_name', 'اسم_المسوقة', 'اسم_المسوق', 'المسوقة', 'المسوق'],
  totalRequired: ['totalRequired', 'total_required', 'المجموع_المطلوب', 'المجموع المطلوب'],
  coordinatorName: ['coordinatorName', 'coordinator_name', 'اسم_المنسقة', 'المنسقة'],
  coordinatorService: ['coordinatorService', 'الخدمة_المطلوبة', 'خدمة_التنسيق'],
  coordinatorPrice: ['coordinatorPrice', 'سعر_الخدمة', 'قيمة_الخدمة'],
};

export const fillTemplate = (template: string, vars: Record<string, string | number | undefined>): string => {
  if (!template) return '';
  let result = template;

  const expanded: Record<string, string> = {
    businessPhone: AMASA_BUSINESS_PHONE,
    businessNumber: AMASA_BUSINESS_PHONE,
    رقم_الإدارة: AMASA_BUSINESS_PHONE,
    paymentDeadline: '15 دقيقة',
    مهلة_الدفع: '15 دقيقة',
  };

  Object.entries(vars).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      const strVal = String(val);
      expanded[key] = strVal;

      for (const group of Object.values(TEMPLATE_ALIAS_GROUPS)) {
        if (group.includes(key)) {
          group.forEach((alias) => {
            expanded[alias] = strVal;
          });
        }
      }
    }
  });

  Object.entries(expanded).forEach(([k, v]) => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{\\s*${escaped}\\s*}`, 'g');
    result = result.replace(regex, v);
  });

  return result;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const isDemoMode = isPersonalDemoMode();
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [userRole, setUserRole] = useState<UserRole>(() =>
    StorageService.getString(STORAGE_KEYS.USER_ROLE, 'admin') as UserRole
  );
  const [currentMarketerId, setCurrentMarketerId] = useState<string>(() => {
    const saved = StorageService.getString(STORAGE_KEYS.MARKETER_ID, '');
    if (saved === 'm1' || saved === 'm2' || saved === 'm3' || saved === 'm4' || saved === 'm5') {
      StorageService.set(STORAGE_KEYS.MARKETER_ID, '');
      return '';
    }
    return saved;
  });
  const [currentCoordinatorId, setCurrentCoordinatorId] = useState<string>(() =>
    StorageService.getString(STORAGE_KEYS.COORDINATOR_ID, '')
  );

  const [userAccounts, setUserAccounts] = useState<UserAccount[]>(() => {
    if (isDemoMode) {
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, DEMO_SAMPLE_USER_ACCOUNTS);
      return DEMO_SAMPLE_USER_ACCOUNTS;
    }
    let hasRawSaved = false;
    try {
      hasRawSaved = localStorage.getItem(STORAGE_KEYS.USER_ACCOUNTS) !== null;
    } catch {}
    const saved = StorageService.get<UserAccount[]>(STORAGE_KEYS.USER_ACCOUNTS, INITIAL_USER_ACCOUNTS);
    const FAKE_MOCK_IDS = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'admin']);
    const FAKE_EMAILS = new Set([
      'admin.amasa@gmail.com',
      'ahmed.shammari@gmail.com',
      'sarah.otb@gmail.com',
      'mohammed.gh@gmail.com',
      'reem.q@gmail.com',
      'noura.dossari@gmail.com',
    ]);
    const filtered = (Array.isArray(saved) ? saved : INITIAL_USER_ACCOUNTS).filter(
      (acc) => acc && acc.email && !FAKE_MOCK_IDS.has(acc.id) && !FAKE_EMAILS.has(acc.email.trim().toLowerCase())
    );
    const list = [...filtered];
    if (!hasRawSaved || list.length === 0) {
      INITIAL_USER_ACCOUNTS.forEach((acc) => {
        if (!list.some((it) => it.id === acc.id || it.email.toLowerCase() === acc.email.toLowerCase())) list.push(acc);
      });
    } else if (!list.some((it) => it.email.toLowerCase() === 'sakt2008@gmail.com')) {
      list.unshift(INITIAL_USER_ACCOUNTS[0]);
    }
    StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, list);
    return list;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('quick_select');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isDemoMode) return true;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH);
      if (saved === '0') return false;
      if (saved === '1') return true;
      // Strict Google authentication requirement: false until Google login completes
      return false;
    } catch {
      return false;
    }
  });
  const [isInitialHydrating, setIsInitialHydrating] = useState<boolean>(() => !isDemoMode && isAuthenticated);
  const [authSessionEpoch, setAuthSessionEpoch] = useState<number>(0);
  const isAuthenticatedRef = React.useRef<boolean>(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const [guard, setGuard] = useState<Guard>(() => {
    const saved = StorageService.get<Guard>(STORAGE_KEYS.GUARD, INITIAL_GUARD);
    if (!saved.assignedPropertyId) {
      return { ...saved, assignedPropertyId: 'al-taraf', assignedPropertyName: 'الترف' };
    }
    return saved;
  });

  const [guardsList, setGuardsList] = useState<Guard[]>(() =>
    StorageService.get<Guard[]>(STORAGE_KEYS.GUARDS_LIST, INITIAL_GUARDS_LIST)
  );

  const [properties, setProperties] = useState<Property[]>(() => {
    const saved = StorageService.get<Property[]>(STORAGE_KEYS.PROPERTIES, INITIAL_PROPERTIES);
    const hasOldAlmaNaya = saved.some((p) => p.id === 'alma' || p.id === 'naya');

    if (hasOldAlmaNaya) {
      StorageService.set(STORAGE_KEYS.PROPERTIES, INITIAL_PROPERTIES);
      return INITIAL_PROPERTIES;
    }

    // المزرعة (عقار = الترف + الكوخ): تُضاف تلقائياً للبيانات المحفوظة إن لم تكن موجودة
    const needsMazraa =
      !saved.some((p) => p.id === 'al-mazraa') &&
      saved.some((p) => p.id === 'al-taraf') &&
      saved.some((p) => p.id === 'al-baylasan');
    const savedWithEstate = needsMazraa ? [...saved, MAZRAA_ESTATE] : saved;

    return savedWithEstate.map((prop) => {
      const init = INITIAL_PROPERTIES.find((p) => p.id === prop.id);
      let updated = { ...prop };
      // توحيد أسماء أقسام الترف المحفوظة سابقاً: قسم النساء / قسم الرجال
      if (updated.sections?.some((sec) => sec.name === 'القسم الأول (نساء)' || sec.name === 'القسم الثاني (رجال)')) {
        updated = {
          ...updated,
          sections: updated.sections.map((sec) =>
            sec.name === 'القسم الأول (نساء)' ? { ...sec, name: 'قسم النساء' } : sec.name === 'القسم الثاني (رجال)' ? { ...sec, name: 'قسم الرجال' } : sec
          ),
        };
      }
      if (!updated.assignedGuardName && init?.assignedGuardName) {
        updated.assignedGuardId = init.assignedGuardId;
        updated.assignedGuardName = init.assignedGuardName;
        updated.assignedGuardPhone = init.assignedGuardPhone;
        updated.assignedGuardNotes = init.assignedGuardNotes;
      }
      if (!updated.defaultBreakfastPrice) {
        updated.defaultBreakfastPrice = init?.defaultBreakfastPrice || 150;
      }
      if (init?.sections && prop.hasSections !== false && (!prop.sections || prop.sections.length === 0)) {
        updated = {
          ...updated,
          sections: init.sections,
          subUnitsCount: init.subUnitsCount,
          subtitle: init.subtitle,
        };
      }
      return updated;
    });
  });

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(() => {
    const savedId = StorageService.getString(STORAGE_KEYS.SELECTED_PROPERTY, 'al-taraf');
    if (savedId === 'alma' || savedId === 'naya') {
      StorageService.set(STORAGE_KEYS.SELECTED_PROPERTY, 'hamran');
      return 'hamran';
    }
    return savedId;
  });

  const [marketers, setMarketers] = useState<Marketer[]>(() => {
    if (isDemoMode) {
      StorageService.set(STORAGE_KEYS.MARKETERS, DEMO_SAMPLE_MARKETERS);
      return DEMO_SAMPLE_MARKETERS;
    }
    const list = StorageService.get<Marketer[]>(STORAGE_KEYS.MARKETERS, INITIAL_MARKETERS);
    const FAKE_MOCK_IDS = new Set(['m1', 'm2', 'm3', 'm4', 'm5']);
    const FAKE_EMAILS = new Set([
      'ahmed.shammari@gmail.com',
      'sarah.otb@gmail.com',
      'mohammed.gh@gmail.com',
      'reem.q@gmail.com',
      'noura.dossari@gmail.com',
    ]);
    const cleaned = (Array.isArray(list) ? list : []).filter(
      (m) => !FAKE_MOCK_IDS.has(m.id) && !FAKE_EMAILS.has(m.email)
    );
    StorageService.set(STORAGE_KEYS.MARKETERS, cleaned);
    return cleaned.map((m) => {
      const perms = (m.permissions || {}) as Partial<MarketerPermissions>;
      return {
        ...m,
        permissions: {
          ...m.permissions,
          canCreateBooking: perms.canCreateBooking !== false,
          canCreateContract: perms.canCreateContract !== false,
          canEditDeposit: perms.canEditDeposit !== false,
          canViewDashboard: perms.canViewDashboard !== false,
          canViewBookings: perms.canViewBookings !== false,
          canViewMore: perms.canViewMore !== false,
          canViewCustomerContacts: perms.canViewCustomerContacts !== false,
        },
      };
    });
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const savedRaw = StorageService.get<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    const saved = isPersonalDemoMode() ? attachDemoMarketers(savedRaw) : savedRaw;
    let migrated = false;
    const mapped = saved.map((b) => {
      if (b.propertyId === 'alma') {
        migrated = true;
        return {
          ...b,
          propertyId: 'hamran',
          propertyName: 'حمران',
          sectionId: 'hamran-alma',
          sectionName: 'وحدة الما',
        };
      }
      if (b.propertyId === 'naya') {
        migrated = true;
        return {
          ...b,
          propertyId: 'hamran',
          propertyName: 'حمران',
          sectionId: 'hamran-naya',
          sectionName: 'وحدة نايا',
        };
      }
      return b;
    });

    // Strictly deduplicate by id so no two bookings can ever have the same ID
    const seenIds = new Set<string>();
    const deduplicatedResult: Booking[] = [];
    for (const b of mapped) {
      if (!seenIds.has(b.id)) {
        seenIds.add(b.id);
        deduplicatedResult.push(b);
      } else {
        migrated = true;
      }
    }

    // Clean any fake mock marketer links from saved bookings
    const FAKE_MARKETER_IDS = new Set(['m1', 'm2', 'm3', 'm4', 'm5']);
    deduplicatedResult.forEach((b) => {
      if (b.marketerId && FAKE_MARKETER_IDS.has(b.marketerId)) {
        b.marketerId = undefined;
        b.marketerName = undefined;
        b.marketerCommission = 0;
        b.commissionStatus = undefined;
        migrated = true;
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    ['bk-today-hamran', 'bk-today-in', 'bk-today-out'].forEach((demoId) => {
      const idx = deduplicatedResult.findIndex((b) => b.id === demoId);
      const sample = INITIAL_BOOKINGS.find((b) => b.id === demoId);
      if (sample && idx !== -1) {
        deduplicatedResult[idx] = {
          ...sample,
          ...deduplicatedResult[idx],
          checkInDate: demoId === 'bk-today-out' ? yesterdayStr : todayStr,
          checkOutDate: demoId === 'bk-today-out' ? todayStr : tomorrowStr,
          breakfastOption: sample.breakfastOption,
          coordinatorName: sample.coordinatorName,
          coordinatorService: sample.coordinatorService,
        };
        migrated = true;
      }
    });

    // Clean up receipts on bookings whose commission has already been transferred/paid
    for (let i = 0; i < deduplicatedResult.length; i += 1) {
      const bk = deduplicatedResult[i];
      if (bk.commissionStatus === 'paid' && hasAnyBookingReceiptFields(bk)) {
        deduplicatedResult[i] = clearBookingReceiptsAfterCommissionPaid(bk);
        migrated = true;
      }
    }

    if (migrated) {
      StorageService.set(STORAGE_KEYS.BOOKINGS, deduplicatedResult);
    }
    return deduplicatedResult;
  });

  const [dateOverrides, setDateOverrides] = useState<Record<string, DateOverride>>(() =>
    StorageService.get<Record<string, DateOverride>>(STORAGE_KEYS.OVERRIDES, {})
  );

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
    StorageService.get<ActivityLog[]>(STORAGE_KEYS.LOGS, INITIAL_LOGS)
  );

  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    StorageService.get<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS)
  );

  const [commissionRequests, setCommissionRequests] = useState<CommissionRequest[]>(() =>
    StorageService.get<CommissionRequest[]>(
      STORAGE_KEYS.COMMISSION_REQUESTS,
      isDemoMode ? DEMO_SAMPLE_COMMISSION_REQUESTS : []
    )
  );

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [preselectedDateForBooking, setPreselectedDateForBooking] = useState<string | null>(null);
  const [preselectedSectionForBooking, setPreselectedSectionForBooking] = useState<string | null>(null);

  const [messageTemplates, setMessageTemplates] = useState<MessageTemplates>(() =>
    StorageService.get<MessageTemplates>(STORAGE_KEYS.TEMPLATES, INITIAL_TEMPLATES)
  );

  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState<keyof MessageTemplates>('depositRequest');

  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission()
  );
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    const val = StorageService.getString(STORAGE_KEYS.SOUND_ENABLED, 'true');
    return val === 'true';
  });

  const [activeToast, setActiveToast] = useState<ToastData | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  const [adminBroadcasts, setAdminBroadcasts] = useState<AdminBroadcastMessage[]>(() =>
    StorageService.get<AdminBroadcastMessage[]>(STORAGE_KEYS.ADMIN_BROADCASTS, INITIAL_ADMIN_BROADCASTS)
  );

  const [acknowledgedBroadcastIds, setAcknowledgedBroadcastIds] = useState<string[]>(() =>
    StorageService.get<string[]>(STORAGE_KEYS.ACKNOWLEDGED_BROADCASTS, [])
  );

  const [adminBroadcastModalOpen, setAdminBroadcastModalOpen] = useState(false);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.ACKNOWLEDGED_BROADCASTS, acknowledgedBroadcastIds);
  }, [acknowledgedBroadcastIds]);

  const [coordinatorServices, setCoordinatorServices] = useState<CoordinatorServiceItem[]>(() =>
    StorageService.get<CoordinatorServiceItem[]>(STORAGE_KEYS.COORDINATOR_SERVICES, INITIAL_COORDINATOR_SERVICES)
  );

  const [coordinators, setCoordinators] = useState<Coordinator[]>(() =>
    StorageService.get<Coordinator[]>(STORAGE_KEYS.COORDINATORS, INITIAL_COORDINATORS)
  );

  const [expenses, setExpenses] = useState<PropertyExpense[]>(() =>
    StorageService.get<PropertyExpense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES)
  );

  const [guardTasks, setGuardTasks] = useState<GuardDailyTask[]>(() =>
    StorageService.get<GuardDailyTask[]>(STORAGE_KEYS.GUARD_TASKS, INITIAL_GUARD_TASKS)
  );

  const [guardTaskTemplates, setGuardTaskTemplates] = useState<GuardTaskTemplate[]>(() =>
    StorageService.get<GuardTaskTemplate[]>(STORAGE_KEYS.GUARD_TASK_TEMPLATES, INITIAL_GUARD_TASK_TEMPLATES)
  );

  const [specialAdminFeeBoxes, setSpecialAdminFeeBoxes] = useState<SpecialAdminFeeBox[]>(() =>
    StorageService.get<SpecialAdminFeeBox[]>(STORAGE_KEYS.SPECIAL_ADMIN_FEE_BOXES, INITIAL_SPECIAL_ADMIN_FEE_BOXES)
  );

  const [supervisorDateOverrides, setSupervisorDateOverrides] = useState<Record<string, SupervisorDateOverride>>(() =>
    StorageService.get<Record<string, SupervisorDateOverride>>(STORAGE_KEYS.SUPERVISOR_OVERRIDES, {})
  );

  const [customSupervisorRates, setCustomSupervisorRates] = useState<number[]>(() =>
    StorageService.get<number[]>(STORAGE_KEYS.SUPERVISOR_CUSTOM_RATES, [])
  );

  const [kayanItems, setKayanItems] = useState<KayanDetergentItem[]>(() =>
    StorageService.get<KayanDetergentItem[]>(STORAGE_KEYS.KAYAN_ITEMS, INITIAL_KAYAN_ITEMS)
  );

  const [kayanSettings, setKayanSettings] = useState<KayanSettings>(() =>
    StorageService.get<KayanSettings>(STORAGE_KEYS.KAYAN_SETTINGS, KAYAN_DEFAULT_SETTINGS)
  );

  const [kayanOrders, setKayanOrders] = useState<KayanOrderSheet[]>(() =>
    StorageService.get<KayanOrderSheet[]>(STORAGE_KEYS.KAYAN_ORDERS, [])
  );

  const toggleSound = useCallback(() => {
    unlockMobileAudio();
    setIsSoundEnabled((prev) => {
      const next = !prev;
      StorageService.set(STORAGE_KEYS.SOUND_ENABLED, String(next));
      if (next) playChimeSound(true);
      return next;
    });
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const isSoundEnabledRef = React.useRef<boolean>(isSoundEnabled);
  isSoundEnabledRef.current = isSoundEnabled;

  const triggerBrowserNotification = useCallback(
    (title: string, body: string, type: ToastData['type'] = 'booking') => {
      setActiveToast({
        id: `toast-${Date.now()}-${Math.random()}`,
        title,
        body,
        type,
      });
      const soundOn = isSoundEnabledRef.current;
      if (soundOn) {
        playChimeSound(true);
      }
      void triggerSystemNotification(title, {
        body,
        type,
        playSound: false,
        silent: !soundOn,
        tag: `amasa-booking-${Date.now()}`,
      });
    },
    []
  );

  const sendTestNotification = useCallback(() => {
    unlockMobileAudio();
    triggerBrowserNotification(
      '🔔 تجربة إشعارات شاشة الجوال — AMASA RESORT',
      'تم تفعيل ظهور الإشعارات على شاشة الجوال ونغمة التنبيه الصوتية بنجاح!',
      'deposit_confirmed'
    );
  }, [triggerBrowserNotification]);

  const dispatchedPushNotifIdsRef = React.useRef<Set<string>>(
    new Set(notifications.map((n) => n.id))
  );

  const [simulation, setSimulation] = useState<SimulationState>(() =>
    StorageService.get<SimulationState>('amasa_simulation_state', {
      isSimulating: false,
      role: 'admin',
      targetName: 'الإدارة (المدير العام)',
    })
  );

  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  useEffect(() => {
    StorageService.set('amasa_simulation_state', simulation);
  }, [simulation]);

  const openAccountSwitcher = useCallback(() => {
    setIsAccountSwitcherOpen(true);
  }, []);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connected');
  const [syncMessage, setSyncMessage] = useState<string>('');

  useEffect(() => {
    return subscribeSyncStatus((st, msg) => {
      setSyncStatus(st);
      if (msg !== undefined) setSyncMessage(msg);
    });
  }, []);

  const [localReadNotifIds, setLocalReadNotifIds] = useState<string[]>(() =>
    StorageService.get<string[]>(READ_NOTIFS_STORAGE_KEY, [])
  );

  useEffect(() => {
    StorageService.set(READ_NOTIFS_STORAGE_KEY, localReadNotifIds.slice(-300));
  }, [localReadNotifIds]);

  const hasCompletedInitialSyncRef = React.useRef(false);
  const localWriteEpochRef = React.useRef(0);
  const activeSaveCountRef = React.useRef(0);
  const inFlightSliceKeysRef = React.useRef<Map<string, number>>(new Map());
  const activeAuthUidRef = React.useRef<string | null>(null);
  const pendingProtectedAccountEmailsRef = React.useRef<Map<string, UserAccount>>(new Map());
  const recentlyDeletedAccountIdsRef = React.useRef<Set<string>>(new Set());

  const userAccountsRef = React.useRef<UserAccount[]>(userAccounts);
  userAccountsRef.current = userAccounts;
  const marketersRef = React.useRef<Marketer[]>(marketers);
  marketersRef.current = marketers;
  const coordinatorsRef = React.useRef<Coordinator[]>(coordinators);
  coordinatorsRef.current = coordinators;
  const guardsListRef = React.useRef<Guard[]>(guardsList);
  guardsListRef.current = guardsList;

  const userRoleRef = React.useRef<UserRole>(userRole);
  userRoleRef.current = userRole;
  const currentMarketerIdRef = React.useRef<string>(currentMarketerId);
  currentMarketerIdRef.current = currentMarketerId;
  const currentCoordinatorIdRef = React.useRef<string>(currentCoordinatorId);
  currentCoordinatorIdRef.current = currentCoordinatorId;
  const guardRef = React.useRef<Guard>(guard);
  guardRef.current = guard;
  const simulationRef = React.useRef<SimulationState>(simulation);
  simulationRef.current = simulation;
  const localReadNotifIdsRef = React.useRef<string[]>(localReadNotifIds);
  localReadNotifIdsRef.current = localReadNotifIds;
  const currentUserReadKeyRef = React.useRef<string>('admin');

  const lastSyncedJsonRef = React.useRef<Record<string, string>>({
    properties: JSON.stringify(properties),
    bookings: JSON.stringify(bookings),
    dateOverrides: JSON.stringify(dateOverrides),
    commissionRequests: JSON.stringify(commissionRequests),
    notifications: JSON.stringify(notifications),
    marketers: JSON.stringify(marketers),
    coordinators: JSON.stringify(coordinators),
    guardsList: JSON.stringify(guardsList),
    guardTasks: JSON.stringify(guardTasks),
    guardTaskTemplates: JSON.stringify(guardTaskTemplates),
    specialAdminFeeBoxes: JSON.stringify(specialAdminFeeBoxes),
    supervisorDateOverrides: JSON.stringify(supervisorDateOverrides),
    customSupervisorRates: JSON.stringify(customSupervisorRates),
    adminBroadcasts: JSON.stringify(adminBroadcasts),
    userAccounts: JSON.stringify(userAccounts),
    coordinatorServices: JSON.stringify(coordinatorServices),
    expenses: JSON.stringify(expenses),
    messageTemplates: JSON.stringify(messageTemplates),
    activityLogs: JSON.stringify(activityLogs.slice(0, 80)),
    kayanItems: JSON.stringify(kayanItems),
    kayanSettings: JSON.stringify(kayanSettings),
    kayanOrders: JSON.stringify(kayanOrders.slice(0, 120)),
  });
  const pendingSyncDeltaRef = React.useRef<Partial<StoreData>>({});
  const syncFlushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);
  const firestoreSyncStateRef = React.useRef(createFirestoreSyncState());
  const bookingsRef = React.useRef<Booking[]>(bookings);
  bookingsRef.current = bookings;
  const propertiesRef = React.useRef<Property[]>(properties);
  propertiesRef.current = properties;
  // الأقسام التي يغطيها الحجز/الإغلاق «الكامل» للعقار (أي وحدة بقسمين فأكثر، لا الترف وحمران فقط)
  const wholeIdsOf = (propertyId: string): string[] =>
    getWholeSectionIds(propertiesRef.current.find((x) => x.id === propertyId), propertyId);
  const specialAdminFeeBoxesRef = React.useRef<SpecialAdminFeeBox[]>(specialAdminFeeBoxes);
  specialAdminFeeBoxesRef.current = specialAdminFeeBoxes;
  const guardTasksRef = React.useRef<GuardDailyTask[]>(guardTasks);
  guardTasksRef.current = guardTasks;
  const guardTaskTemplatesRef = React.useRef<GuardTaskTemplate[]>(guardTaskTemplates);
  guardTaskTemplatesRef.current = guardTaskTemplates;
  const commissionRequestsRef = React.useRef<CommissionRequest[]>(commissionRequests);
  commissionRequestsRef.current = commissionRequests;
  const dateOverridesRef = React.useRef<Record<string, DateOverride>>(dateOverrides);
  dateOverridesRef.current = dateOverrides;
  const supervisorDateOverridesRef = React.useRef<Record<string, SupervisorDateOverride>>(supervisorDateOverrides);
  supervisorDateOverridesRef.current = supervisorDateOverrides;
  const customSupervisorRatesRef = React.useRef(customSupervisorRates);
  customSupervisorRatesRef.current = customSupervisorRates;
  const adminBroadcastsRef = React.useRef<AdminBroadcastMessage[]>(adminBroadcasts);
  adminBroadcastsRef.current = adminBroadcasts;
  const notificationsRef = React.useRef<AppNotification[]>(notifications);
  notificationsRef.current = notifications;
  const coordinatorServicesRef = React.useRef<CoordinatorServiceItem[]>(coordinatorServices);
  coordinatorServicesRef.current = coordinatorServices;
  const expensesRef = React.useRef<PropertyExpense[]>(expenses);
  expensesRef.current = expenses;
  const messageTemplatesRef = React.useRef<MessageTemplates>(messageTemplates);
  messageTemplatesRef.current = messageTemplates;
  const activityLogsRef = React.useRef<ActivityLog[]>(activityLogs);
  activityLogsRef.current = activityLogs;
  const kayanItemsRef = React.useRef<KayanDetergentItem[]>(kayanItems);
  kayanItemsRef.current = kayanItems;
  const kayanSettingsRef = React.useRef<KayanSettings>(kayanSettings);
  kayanSettingsRef.current = kayanSettings;
  const kayanOrdersRef = React.useRef<KayanOrderSheet[]>(kayanOrders);
  kayanOrdersRef.current = kayanOrders;

  const formatFirestoreWriteError = (err: any): string => {
    const rawMsg = String(err?.message || err || '');
    let innerError = rawMsg;
    let errPath = '';
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed?.error) innerError = String(parsed.error);
      if (parsed?.path) errPath = String(parsed.path);
    } catch {}
    const lower = innerError.toLowerCase();
    if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
      return `لا توجد صلاحية كافية في قواعد Firebase (${errPath || 'Firestore'}) — تأكد من تسجيل الدخول بحساب الإدارة الموثق عبر Google.`;
    }
    if (lower.includes('quota') || lower.includes('resource-exhausted')) {
      return 'تم تجاوز الحصة اليومية المجانية في Firebase (تتجدد تلقائياً غداً).';
    }
    if (lower.includes('exceeds the maximum allowed size') || lower.includes('too large')) {
      return `حجم السجل يتجاوز حد المستند (1MB) في (${errPath || 'Firestore'}).`;
    }
    if (lower.includes('offline') || lower.includes('unavailable') || lower.includes('network')) {
      return 'تعذر الوصول إلى خوادم Firebase — تأكد من اتصالك بالإنترنت.';
    }
    return innerError || 'تعذر الحفظ في Firebase';
  };

  const mirrorBatchToFirestore = useCallback(async (batch: Partial<StoreData>): Promise<SaveResult> => {
    if (isPersonalDemoMode()) {
      return { ok: true, message: 'تم الحفظ مؤقتاً في جلسة الديمو الشخصية فقط (بدون اتصال بـ Firebase)' };
    }
    if (!auth.currentUser && typeof (auth as any).authStateReady === 'function') {
      try {
        await (auth as any).authStateReady();
      } catch {}
    }
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
      return { ok: false, error: 'يجب تسجيل الدخول بحساب Google الموثق للحفظ في Firebase.' };
    }
    const accounts = batch.userAccounts || userAccountsRef.current;
    notifySyncStatus('syncing', 'جاري حفظ التعديلات في Firebase...');
    try {
      if (isCurrentUserAdmin(accounts) && fbUser.email.trim().toLowerCase() !== OWNER_EMAIL) {
        await ensureFirestoreAdminBootstrap(accounts);
      }
      if (Array.isArray(batch.userAccounts)) {
        await syncAuthorizedUsersToFirestore(batch.userAccounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.marketers) || Array.isArray(batch.coordinators) || Array.isArray(batch.guardsList)) {
        await pushStaffMembersToFirestore(
          batch.marketers || marketersRef.current,
          batch.coordinators || coordinatorsRef.current,
          batch.guardsList || guardsListRef.current,
          accounts,
          firestoreSyncStateRef.current
        );
      }
      if (Array.isArray(batch.bookings)) {
        await pushBookingsToFirestore(batch.bookings, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.properties)) {
        await pushPropertiesToFirestore(batch.properties, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.specialAdminFeeBoxes)) {
        await pushAdminFeeBoxesToFirestore(batch.specialAdminFeeBoxes, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.guardTasks) || Array.isArray(batch.guardTaskTemplates)) {
        await pushGuardTasksToFirestore(
          batch.guardTasks || guardTasksRef.current,
          batch.guardTaskTemplates || guardTaskTemplatesRef.current,
          accounts,
          firestoreSyncStateRef.current
        );
      }
      if (Array.isArray(batch.commissionRequests)) {
        await pushCommissionRequestsToFirestore(batch.commissionRequests, accounts, firestoreSyncStateRef.current);
      }
      if (batch.dateOverrides && typeof batch.dateOverrides === 'object') {
        await pushSystemStateToFirestore('dateOverrides', batch.dateOverrides, accounts, firestoreSyncStateRef.current);
      }
      if (batch.supervisorDateOverrides && typeof batch.supervisorDateOverrides === 'object') {
        await pushSystemStateToFirestore('supervisorDateOverrides', batch.supervisorDateOverrides, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.customSupervisorRates)) {
        await pushSystemStateToFirestore('customSupervisorRates', batch.customSupervisorRates, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.adminBroadcasts)) {
        await pushSystemStateToFirestore('adminBroadcasts', batch.adminBroadcasts, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.notifications)) {
        await pushSystemStateToFirestore('notifications', batch.notifications, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.coordinatorServices)) {
        await pushSystemStateToFirestore('coordinatorServices', batch.coordinatorServices, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.expenses)) {
        await pushSystemStateToFirestore('expenses', batch.expenses, accounts, firestoreSyncStateRef.current);
      }
      if (batch.messageTemplates && typeof batch.messageTemplates === 'object') {
        await pushSystemStateToFirestore('messageTemplates', batch.messageTemplates, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.activityLogs)) {
        await pushSystemStateToFirestore('activityLogs', batch.activityLogs.slice(0, 80), accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.kayanItems)) {
        await pushSystemStateToFirestore('kayanItems', batch.kayanItems, accounts, firestoreSyncStateRef.current);
      }
      if (batch.kayanSettings && typeof batch.kayanSettings === 'object') {
        await pushSystemStateToFirestore('kayanSettings', batch.kayanSettings, accounts, firestoreSyncStateRef.current);
      }
      if (Array.isArray(batch.kayanOrders)) {
        await pushSystemStateToFirestore('kayanOrders', batch.kayanOrders.slice(0, 120), accounts, firestoreSyncStateRef.current);
      }
      notifySyncStatus('connected', 'متصل ومزامن لحظياً مع Firebase');
      return { ok: true, message: 'تم الحفظ والمزامنة في Firebase بنجاح' };
    } catch (err: any) {
      console.warn('Firestore sync error:', err);
      const errMsg = formatFirestoreWriteError(err);
      notifySyncStatus('error', errMsg);
      return { ok: false, error: errMsg };
    }
  }, []);

  const propagateAccessInBackground = useCallback((accountsOverride?: UserAccount[]): Promise<void> => {
    if (isPersonalDemoMode()) return Promise.resolve();
    const accountsToUse = accountsOverride || userAccountsRef.current;
    if (!isCurrentUserAdmin(accountsToUse)) return Promise.resolve();
    return propagateAuthorizedEmailsToAllCollections(
      {
        userAccounts: accountsToUse,
        marketers: marketersRef.current,
        coordinators: coordinatorsRef.current,
        guardsList: guardsListRef.current,
        bookings: bookingsRef.current,
        properties: propertiesRef.current,
        specialAdminFeeBoxes: specialAdminFeeBoxesRef.current,
        guardTasks: guardTasksRef.current,
        guardTaskTemplates: guardTaskTemplatesRef.current,
        commissionRequests: commissionRequestsRef.current,
        dateOverrides: dateOverridesRef.current,
        supervisorDateOverrides: supervisorDateOverridesRef.current,
        customSupervisorRates: customSupervisorRatesRef.current,
        adminBroadcasts: adminBroadcastsRef.current,
        notifications: notificationsRef.current,
        coordinatorServices: coordinatorServicesRef.current,
        expenses: expensesRef.current,
        messageTemplates: messageTemplatesRef.current,
        activityLogs: activityLogsRef.current,
        kayanItems: kayanItemsRef.current,
        kayanSettings: kayanSettingsRef.current,
        kayanOrders: kayanOrdersRef.current,
      },
      firestoreSyncStateRef.current
    );
  }, []);

  const pushSliceNow = useCallback(async (batch: Partial<StoreData>): Promise<SaveResult> => {
    localWriteEpochRef.current += 1;
    const keys = Object.keys(batch);
    keys.forEach((k) => {
      const v = (batch as Record<string, any>)[k];
      if (v !== undefined) {
        lastSyncedJsonRef.current[k] = JSON.stringify(k === 'activityLogs' && Array.isArray(v) ? v.slice(0, 80) : v);
      }
      inFlightSliceKeysRef.current.set(k, (inFlightSliceKeysRef.current.get(k) || 0) + 1);
    });
    if (syncFlushTimerRef.current) {
      // Remove keys already being pushed immediately so debounced batch does not send stale copies
      keys.forEach((k) => {
        delete (pendingSyncDeltaRef.current as Record<string, any>)[k];
      });
    }
    try {
      broadcastChannelRef.current?.postMessage({
        originId: CLIENT_SYNC_ID,
        data: batch,
      });
    } catch {}
    activeSaveCountRef.current += 1;
    try {
      const res = await mirrorBatchToFirestore(batch);
      if (res.ok && Array.isArray(batch.userAccounts)) {
        const savedEmails = new Set(batch.userAccounts.map((a) => a.email.trim().toLowerCase()));
        for (const emailKey of Array.from(pendingProtectedAccountEmailsRef.current.keys())) {
          if (savedEmails.has(emailKey)) {
            pendingProtectedAccountEmailsRef.current.delete(emailKey);
          }
        }
      }
      return res;
    } finally {
      activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      keys.forEach((k) => {
        const nextCount = Math.max(0, (inFlightSliceKeysRef.current.get(k) || 0) - 1);
        if (nextCount === 0) inFlightSliceKeysRef.current.delete(k);
        else inFlightSliceKeysRef.current.set(k, nextCount);
      });
    }
  }, [mirrorBatchToFirestore]);

  const queueRealtimePush = useCallback((sliceKey: keyof StoreData, value: any) => {
    const normalizedVal = sliceKey === 'activityLogs' && Array.isArray(value) ? value.slice(0, 80) : value;
    const json = JSON.stringify(normalizedVal);
    if (json === lastSyncedJsonRef.current[sliceKey as string]) {
      return;
    }
    lastSyncedJsonRef.current[sliceKey as string] = json;

    if (!hasCompletedInitialSyncRef.current) {
      return;
    }

    localWriteEpochRef.current += 1;
    try {
      broadcastChannelRef.current?.postMessage({
        originId: CLIENT_SYNC_ID,
        data: { [sliceKey]: normalizedVal },
      });
    } catch {}

    (pendingSyncDeltaRef.current as Record<string, any>)[sliceKey as string] = normalizedVal;
    if (syncFlushTimerRef.current) {
      clearTimeout(syncFlushTimerRef.current);
    }
    syncFlushTimerRef.current = setTimeout(async () => {
      const batch = { ...pendingSyncDeltaRef.current };
      pendingSyncDeltaRef.current = {};
      syncFlushTimerRef.current = null;
      const batchKeys = Object.keys(batch);
      if (batchKeys.length > 0) {
        batchKeys.forEach((k) => {
          inFlightSliceKeysRef.current.set(k, (inFlightSliceKeysRef.current.get(k) || 0) + 1);
        });
        activeSaveCountRef.current += 1;
        try {
          const res = await mirrorBatchToFirestore(batch);
          if (res.ok && Array.isArray(batch.userAccounts)) {
            const savedEmails = new Set(batch.userAccounts.map((a) => a.email.trim().toLowerCase()));
            for (const emailKey of Array.from(pendingProtectedAccountEmailsRef.current.keys())) {
              if (savedEmails.has(emailKey)) {
                pendingProtectedAccountEmailsRef.current.delete(emailKey);
              }
            }
          }
        } finally {
          activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
          batchKeys.forEach((k) => {
            const nextCount = Math.max(0, (inFlightSliceKeysRef.current.get(k) || 0) - 1);
            if (nextCount === 0) inFlightSliceKeysRef.current.delete(k);
            else inFlightSliceKeysRef.current.set(k, nextCount);
          });
        }
      }
    }, 40);
  }, [mirrorBatchToFirestore]);

  const applyRemoteStoreDataRef = React.useRef<(storeData: StoreData | null, isInitial: boolean, fetchEpoch?: number) => void>(() => {});

  // Central Real-Time BroadcastChannel Sync (same-browser instant cross-tab updates alongside Firebase Firestore)
  useEffect(() => {
    let isMounted = true;

    const applyRemoteStoreData = (storeData: StoreData | null, isInitial: boolean, fetchEpoch?: number) => {
      if (!isMounted || !storeData) return;

      if (!isInitial && typeof fetchEpoch === 'number' && fetchEpoch !== localWriteEpochRef.current) {
        return;
      }

      const isSliceBusy = (key: keyof StoreData): boolean => {
        if (isInitial) return false;
        const inFlight = (inFlightSliceKeysRef.current.get(key as string) || 0) > 0;
        const queued = (key as string) in (pendingSyncDeltaRef.current as Record<string, any>);
        return inFlight || queued;
      };

      const buildAudienceCtx = (): NotificationAudienceContext => {
        const roleNow = userRoleRef.current;
        const activeG = guardsListRef.current.find((g) => g.id === guardRef.current.id) || guardRef.current;
        const gPropIds: string[] = [];
        if (Array.isArray(activeG.assignedPropertyIds)) {
          gPropIds.push(...activeG.assignedPropertyIds);
        }
        if (activeG.assignedPropertyId && !gPropIds.includes(activeG.assignedPropertyId)) {
          gPropIds.push(activeG.assignedPropertyId);
        }
        const activeCoord = coordinatorsRef.current.find((c) => c.id === currentCoordinatorIdRef.current);
        return {
          isAdmin: roleNow === 'admin',
          isGuard: roleNow === 'guard',
          isCoordinator: roleNow === 'coordinator',
          activeGuardId: activeG.id,
          guardPropertyIds: gPropIds,
          currentCoordinatorId: currentCoordinatorIdRef.current,
          currentCoordinatorName: activeCoord?.name,
          currentMarketerId: currentMarketerIdRef.current,
          bookings: bookingsRef.current,
          marketers: marketersRef.current,
        };
      };

      let hasTriggeredToastThisBatch = false;

      // 1. Check for new Admin Broadcasts (real-time notification propagation)
      if (!isSliceBusy('adminBroadcasts') && Array.isArray(storeData.adminBroadcasts)) {
        const json = JSON.stringify(storeData.adminBroadcasts);
        if (json !== lastSyncedJsonRef.current.adminBroadcasts) {
          lastSyncedJsonRef.current.adminBroadcasts = json;
          adminBroadcastsRef.current = storeData.adminBroadcasts;
          setAdminBroadcasts((prev) => {
            const existingIds = new Set(prev.map((b) => b.id));
            const newBroadcasts = storeData.adminBroadcasts!.filter((b) => !existingIds.has(b.id));

            if (newBroadcasts.length > 0 && !isInitial) {
              const latest = newBroadcasts[0];
              hasTriggeredToastThisBatch = true;
              triggerBrowserNotification(`📢 ${latest.title}`, latest.content, 'system');
            }
            return storeData.adminBroadcasts!;
          });
        }
      }

      // 2. Properties (prices, seasonal pricing, admin fees, availability, media)
      if (!isSliceBusy('properties') && Array.isArray(storeData.properties) && storeData.properties.length > 0) {
        const canWritePropsToCloud = isCurrentUserAdmin(userAccountsRef.current);
        const mergedProperties = storeData.properties.map((remoteProp) => {
          if (canWritePropsToCloud) return remoteProp;
          const localProp = propertiesRef.current.find((p) => p.id === remoteProp.id);
          if (!localProp) return remoteProp;
          const remoteVideos = remoteProp.videoUrls || [];
          const localOnlyVideos = (localProp.videoUrls || []).filter(
            (u) => u && !remoteVideos.includes(u)
          );
          if (localOnlyVideos.length === 0) return remoteProp;
          return {
            ...remoteProp,
            videoUrls: [...remoteVideos, ...localOnlyVideos],
          };
        });
        const json = JSON.stringify(mergedProperties);
        if (json !== lastSyncedJsonRef.current.properties) {
          lastSyncedJsonRef.current.properties = json;
          propertiesRef.current = mergedProperties;
          setProperties(mergedProperties);
        }
      }

      // 3. Calendar Date Overrides (daily prices, normal admin fees, blocked/booked/waiting_deposit)
      if (!isSliceBusy('dateOverrides') && storeData.dateOverrides && typeof storeData.dateOverrides === 'object' && !Array.isArray(storeData.dateOverrides)) {
        const json = JSON.stringify(storeData.dateOverrides);
        if (json !== lastSyncedJsonRef.current.dateOverrides) {
          lastSyncedJsonRef.current.dateOverrides = json;
          dateOverridesRef.current = storeData.dateOverrides;
          setDateOverrides(storeData.dateOverrides);
        }
      }

      // 4. Bookings (new bookings, check-outs, status changes, cancellations)
      if (!isSliceBusy('bookings') && Array.isArray(storeData.bookings)) {
        const json = JSON.stringify(storeData.bookings);
        if (json !== lastSyncedJsonRef.current.bookings) {
          lastSyncedJsonRef.current.bookings = json;
          bookingsRef.current = storeData.bookings;
          setBookings((prev) => {
            if (!isInitial) {
              const prevIds = new Set(prev.map((b) => b.id));
              const newlyAdded = storeData.bookings!.filter((b) => !prevIds.has(b.id));
              if (newlyAdded.length > 0) {
                const latest = newlyAdded[0];
                hasTriggeredToastThisBatch = true;
                playChimeSound(true);
                triggerBrowserNotification(
                  `🎉 حجز جديد - ${latest.propertyName}`,
                  `تم تسجيل حجز (${latest.bookingNumber}) للعميل ${latest.customerName} وتم تحديث التقويم فوراً`,
                  'booking'
                );
              }
            }
            return storeData.bookings!;
          });
        }
      }

      // 5. Commission Requests
      if (!isSliceBusy('commissionRequests') && Array.isArray(storeData.commissionRequests)) {
        const json = JSON.stringify(storeData.commissionRequests);
        if (json !== lastSyncedJsonRef.current.commissionRequests) {
          lastSyncedJsonRef.current.commissionRequests = json;
          commissionRequestsRef.current = storeData.commissionRequests;
          setCommissionRequests(storeData.commissionRequests);
        }
      }

      // 6. Marketers
      if (!isSliceBusy('marketers') && Array.isArray(storeData.marketers)) {
        const FAKE_MOCK_IDS = new Set(['m1', 'm2', 'm3', 'm4', 'm5']);
        const cleaned = storeData.marketers.filter((m) => m && !FAKE_MOCK_IDS.has(m.id));
        const json = JSON.stringify(cleaned);
        if (json !== lastSyncedJsonRef.current.marketers) {
          lastSyncedJsonRef.current.marketers = json;
          marketersRef.current = cleaned;
          setMarketers(cleaned);
        }
      }

      // 7. Coordinators (accepts empty array so deleting the last coordinator syncs)
      if (!isSliceBusy('coordinators') && Array.isArray(storeData.coordinators)) {
        const json = JSON.stringify(storeData.coordinators);
        if (json !== lastSyncedJsonRef.current.coordinators) {
          lastSyncedJsonRef.current.coordinators = json;
          coordinatorsRef.current = storeData.coordinators;
          setCoordinators(storeData.coordinators);
        }
      }

      // 8. Guards List
      if (!isSliceBusy('guardsList') && Array.isArray(storeData.guardsList) && storeData.guardsList.length > 0) {
        const json = JSON.stringify(storeData.guardsList);
        if (json !== lastSyncedJsonRef.current.guardsList) {
          lastSyncedJsonRef.current.guardsList = json;
          guardsListRef.current = storeData.guardsList;
          setGuardsList(storeData.guardsList);
          const matchingActiveGuard = storeData.guardsList.find((g) => g.id === guardRef.current.id);
          if (matchingActiveGuard) {
            setGuard(matchingActiveGuard);
          }
        }
      }

      // 9. User accounts (with pending-mutation protection, live role sync & merge safety)
      if (!isSliceBusy('userAccounts') && Array.isArray(storeData.userAccounts) && storeData.userAccounts.length > 0) {
        const FAKE_MOCK_IDS = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'admin']);
        const FAKE_EMAILS = new Set([
          'admin.amasa@gmail.com',
          'ahmed.shammari@gmail.com',
          'sarah.otb@gmail.com',
          'mohammed.gh@gmail.com',
          'reem.q@gmail.com',
          'noura.dossari@gmail.com',
        ]);
        const cleanedAccounts = storeData.userAccounts.filter(
          (a) =>
            a &&
            a.email &&
            !FAKE_MOCK_IDS.has(a.id) &&
            !FAKE_MOCK_IDS.has(a.marketerId || '') &&
            !FAKE_EMAILS.has(a.email.trim().toLowerCase()) &&
            !recentlyDeletedAccountIdsRef.current.has(a.id)
        );

        const prevList = userAccountsRef.current;
        const mergedList: UserAccount[] = [...cleanedAccounts];
        const seenEmails = new Set(mergedList.map((a) => a.email.trim().toLowerCase()));
        let shouldPushMerged = false;

        if (!seenEmails.has('sakt2008@gmail.com')) {
          const adminAcc =
            prevList.find((a) => a.email.toLowerCase() === 'sakt2008@gmail.com') ||
            INITIAL_USER_ACCOUNTS[0];
          mergedList.unshift(adminAcc);
          seenEmails.add('sakt2008@gmail.com');
          shouldPushMerged = true;
        }

        // Always keep newly approved/added accounts until Firebase confirms them
        pendingProtectedAccountEmailsRef.current.forEach((pendingAcc, pendingEmail) => {
          if (!seenEmails.has(pendingEmail) && !recentlyDeletedAccountIdsRef.current.has(pendingAcc.id)) {
            mergedList.push(pendingAcc);
            seenEmails.add(pendingEmail);
            shouldPushMerged = true;
          }
        });

        // On initial sync, preserve any valid local authorized accounts not present in Firestore yet
        if (isInitial && prevList.length > 0 && isCurrentUserAdmin(prevList)) {
          prevList.forEach((localAcc) => {
            const em = (localAcc.email || '').trim().toLowerCase();
            if (
              em &&
              !seenEmails.has(em) &&
              !FAKE_MOCK_IDS.has(localAcc.id) &&
              !FAKE_EMAILS.has(em) &&
              !recentlyDeletedAccountIdsRef.current.has(localAcc.id)
            ) {
              mergedList.push(localAcc);
              seenEmails.add(em);
              shouldPushMerged = true;
            }
          });
        }

        const json = JSON.stringify(mergedList);
        if (json !== lastSyncedJsonRef.current.userAccounts) {
          lastSyncedJsonRef.current.userAccounts = json;
          userAccountsRef.current = mergedList;
          setUserAccounts(mergedList);
          StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, mergedList);
        }

        if (shouldPushMerged && isCurrentUserAdmin(mergedList)) {
          void pushSliceNow({ userAccounts: mergedList });
        }
      }

      // Always reconcile active signed-in user's role & staff profile when accounts or staff lists hydrate/update
      if (
        !simulationRef.current.isSimulating &&
        (storeData.userAccounts || storeData.marketers || storeData.coordinators || storeData.guardsList)
      ) {
        const activeEmail = auth.currentUser?.email?.trim().toLowerCase();
        if (activeEmail) {
          const myAcc = userAccountsRef.current.find((a) => a.email.trim().toLowerCase() === activeEmail);
          if (myAcc) {
            if (userRoleRef.current !== myAcc.role) {
              setUserRole(myAcc.role);
            }
            if (myAcc.role === 'marketer') {
              const matchedM = marketersRef.current.find(
                (m) =>
                  m.id === myAcc.marketerId ||
                  m.id === myAcc.id ||
                  m.email?.trim().toLowerCase() === activeEmail
              );
              const resolvedMId = myAcc.marketerId || matchedM?.id || myAcc.id;
              if (resolvedMId && currentMarketerIdRef.current !== resolvedMId) {
                setCurrentMarketerId(resolvedMId);
              }
            } else if (myAcc.role === 'coordinator') {
              const matchedC = coordinatorsRef.current.find(
                (c) =>
                  c.id === myAcc.coordinatorId ||
                  c.id === myAcc.id ||
                  c.email?.trim().toLowerCase() === activeEmail
              );
              const resolvedCId = myAcc.coordinatorId || matchedC?.id || myAcc.id;
              if (resolvedCId && currentCoordinatorIdRef.current !== resolvedCId) {
                setCurrentCoordinatorId(resolvedCId);
              }
            } else if (myAcc.role === 'guard') {
              const mg = guardsListRef.current.find(
                (g) =>
                  g.id === myAcc.guardId ||
                  g.id === myAcc.id ||
                  g.email?.trim().toLowerCase() === activeEmail
              );
              if (mg && guardRef.current.id !== mg.id) setGuard(mg);
            }
          }
        }
      }

      // 10. Notifications (realtime incoming alerts for visible unread items)
      if (!isSliceBusy('notifications') && Array.isArray(storeData.notifications)) {
        const json = JSON.stringify(storeData.notifications);
        if (json !== lastSyncedJsonRef.current.notifications) {
          lastSyncedJsonRef.current.notifications = json;
          const prevNotifications = notificationsRef.current;
          storeData.notifications.forEach((n) => dispatchedPushNotifIdsRef.current.add(n.id));
          notificationsRef.current = storeData.notifications;
          setNotifications(storeData.notifications);

          if (!isInitial) {
            const prevIds = new Set(prevNotifications.map((n) => n.id));
            const readKey = currentUserReadKeyRef.current;
            const localReadSet = new Set(localReadNotifIdsRef.current);
            const audCtx = buildAudienceCtx();
            const incomingUnreadVisible = storeData.notifications.filter((n) => {
              if (prevIds.has(n.id)) return false;
              const isReadByMe = Boolean(
                n.readBy?.includes(readKey) ||
                  localReadSet.has(`${readKey}::${n.id}`) ||
                  (n.readBy === undefined && n.read)
              );
              if (isReadByMe) return false;
              return isNotificationVisibleToActor(n, audCtx);
            });

            if (incomingUnreadVisible.length > 0 && !hasTriggeredToastThisBatch) {
              const latest = incomingUnreadVisible[0];
              const toastType: ToastData['type'] =
                latest.type === 'deposit_confirmed' ||
                latest.type === 'deposit_request' ||
                latest.type === 'booking' ||
                latest.type === 'checkout' ||
                latest.type === 'commission' ||
                latest.type === 'insurance' ||
                latest.type === 'permission'
                  ? latest.type
                  : 'system';
              triggerBrowserNotification(latest.title, latest.description, toastType);
            }
          }
        }
      }

      // 11. Guard Daily Tasks
      if (!isSliceBusy('guardTasks') && Array.isArray(storeData.guardTasks)) {
        const json = JSON.stringify(storeData.guardTasks);
        if (json !== lastSyncedJsonRef.current.guardTasks) {
          lastSyncedJsonRef.current.guardTasks = json;
          guardTasksRef.current = storeData.guardTasks;
          setGuardTasks(storeData.guardTasks);
        }
      }

      // 11b. Guard Task Templates (Saved Task Names & Weekly Recurring Schedule)
      if (!isSliceBusy('guardTaskTemplates') && Array.isArray(storeData.guardTaskTemplates)) {
        const json = JSON.stringify(storeData.guardTaskTemplates);
        if (json !== lastSyncedJsonRef.current.guardTaskTemplates) {
          lastSyncedJsonRef.current.guardTaskTemplates = json;
          guardTaskTemplatesRef.current = storeData.guardTaskTemplates;
          setGuardTaskTemplates(storeData.guardTaskTemplates);
        }
      }

      // 12. Special Admin Fee Boxes (accepts empty array on deletion)
      if (!isSliceBusy('specialAdminFeeBoxes') && Array.isArray(storeData.specialAdminFeeBoxes)) {
        const json = JSON.stringify(storeData.specialAdminFeeBoxes);
        if (json !== lastSyncedJsonRef.current.specialAdminFeeBoxes) {
          lastSyncedJsonRef.current.specialAdminFeeBoxes = json;
          specialAdminFeeBoxesRef.current = storeData.specialAdminFeeBoxes;
          setSpecialAdminFeeBoxes(storeData.specialAdminFeeBoxes);
        }
      }

      // 13. Supervisor Date Overrides
      if (!isSliceBusy('supervisorDateOverrides') && storeData.supervisorDateOverrides && typeof storeData.supervisorDateOverrides === 'object' && !Array.isArray(storeData.supervisorDateOverrides)) {
        const json = JSON.stringify(storeData.supervisorDateOverrides);
        if (json !== lastSyncedJsonRef.current.supervisorDateOverrides) {
          lastSyncedJsonRef.current.supervisorDateOverrides = json;
          supervisorDateOverridesRef.current = storeData.supervisorDateOverrides;
          setSupervisorDateOverrides(storeData.supervisorDateOverrides);
        }
      }

      // 14. Custom Supervisor Commission Rates
      if (!isSliceBusy('customSupervisorRates') && Array.isArray(storeData.customSupervisorRates)) {
        const json = JSON.stringify(storeData.customSupervisorRates);
        if (json !== lastSyncedJsonRef.current.customSupervisorRates) {
          lastSyncedJsonRef.current.customSupervisorRates = json;
          customSupervisorRatesRef.current = storeData.customSupervisorRates;
          setCustomSupervisorRates(storeData.customSupervisorRates);
        }
      }

      // 15. Coordinator Services
      if (!isSliceBusy('coordinatorServices') && Array.isArray(storeData.coordinatorServices)) {
        const json = JSON.stringify(storeData.coordinatorServices);
        if (json !== lastSyncedJsonRef.current.coordinatorServices) {
          lastSyncedJsonRef.current.coordinatorServices = json;
          coordinatorServicesRef.current = storeData.coordinatorServices;
          setCoordinatorServices(storeData.coordinatorServices);
        }
      }

      // 16. Expenses
      if (!isSliceBusy('expenses') && Array.isArray(storeData.expenses)) {
        const json = JSON.stringify(storeData.expenses);
        if (json !== lastSyncedJsonRef.current.expenses) {
          lastSyncedJsonRef.current.expenses = json;
          expensesRef.current = storeData.expenses;
          setExpenses(storeData.expenses);
        }
      }

      // 17. Message Templates
      if (!isSliceBusy('messageTemplates') && storeData.messageTemplates && typeof storeData.messageTemplates === 'object' && !Array.isArray(storeData.messageTemplates)) {
        const json = JSON.stringify(storeData.messageTemplates);
        if (json !== lastSyncedJsonRef.current.messageTemplates) {
          lastSyncedJsonRef.current.messageTemplates = json;
          messageTemplatesRef.current = storeData.messageTemplates;
          setMessageTemplates(storeData.messageTemplates);
        }
      }

      // 18. Activity Logs
      if (!isSliceBusy('activityLogs') && Array.isArray(storeData.activityLogs)) {
        const sliced = storeData.activityLogs.slice(0, 80);
        const json = JSON.stringify(sliced);
        if (json !== lastSyncedJsonRef.current.activityLogs) {
          lastSyncedJsonRef.current.activityLogs = json;
          activityLogsRef.current = storeData.activityLogs;
          setActivityLogs(storeData.activityLogs);
        }
      }

      // 19. Kayan Detergents Catalog
      if (!isSliceBusy('kayanItems') && Array.isArray(storeData.kayanItems)) {
        const json = JSON.stringify(storeData.kayanItems);
        if (json !== lastSyncedJsonRef.current.kayanItems) {
          lastSyncedJsonRef.current.kayanItems = json;
          kayanItemsRef.current = storeData.kayanItems;
          setKayanItems(storeData.kayanItems);
        }
      }

      // 20. Kayan Detergents Settings (Delegate Phone & Location)
      if (!isSliceBusy('kayanSettings') && storeData.kayanSettings && typeof storeData.kayanSettings === 'object' && !Array.isArray(storeData.kayanSettings)) {
        const json = JSON.stringify(storeData.kayanSettings);
        if (json !== lastSyncedJsonRef.current.kayanSettings) {
          lastSyncedJsonRef.current.kayanSettings = json;
          kayanSettingsRef.current = storeData.kayanSettings;
          setKayanSettings(storeData.kayanSettings);
        }
      }

      // 21. Kayan Detergents Orders
      if (!isSliceBusy('kayanOrders') && Array.isArray(storeData.kayanOrders)) {
        const sliced = storeData.kayanOrders.slice(0, 120);
        const json = JSON.stringify(sliced);
        if (json !== lastSyncedJsonRef.current.kayanOrders) {
          lastSyncedJsonRef.current.kayanOrders = json;
          kayanOrdersRef.current = sliced;
          setKayanOrders(sliced);
        }
      }
    };

    applyRemoteStoreDataRef.current = applyRemoteStoreData;

    // Cross-tab BroadcastChannel sync in the same browser (strictly separated channel in demo mode)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channelName = isDemoMode ? 'amasa_demo_realtime_sync' : 'amasa_realtime_sync';
        const bc = new BroadcastChannel(channelName);
        broadcastChannelRef.current = bc;
        bc.onmessage = (ev) => {
          if (ev.data?.originId === CLIENT_SYNC_ID) return;
          if (ev.data?.data) {
            applyRemoteStoreData(ev.data.data, false);
          }
        };
      } catch {}
    }

    return () => {
      isMounted = false;
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
    };
  }, [triggerBrowserNotification, playChimeSound, pushSliceNow]);

  // Exclusive Firebase Firestore Real-Time Sync (Hydrates remote state FIRST, seeds only missing collections if admin, then subscribes)
  useEffect(() => {
    if (isDemoMode) {
      hasCompletedInitialSyncRef.current = true;
      setIsInitialHydrating(false);
      notifySyncStatus('connected', 'وضع الديمو الشخصي (معزول تماماً عن Firebase)');
      return;
    }
    if (!isAuthenticated) {
      hasCompletedInitialSyncRef.current = false;
      activeAuthUidRef.current = null;
      firestoreSyncStateRef.current = createFirestoreSyncState();
      setIsInitialHydrating(false);
      return;
    }
    let isEffectActive = true;
    let unsubFirestore: (() => void) | null = null;
    setIsInitialHydrating(true);
    const hydrationSafetyTimer = setTimeout(() => {
      if (isEffectActive) {
        setIsInitialHydrating(false);
      }
    }, 4500);
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!fbUser && typeof (auth as any).authStateReady === 'function') {
        try {
          await (auth as any).authStateReady();
        } catch {}
        if (!isEffectActive) return;
        fbUser = auth.currentUser;
      }

      if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
        hasCompletedInitialSyncRef.current = false;
        activeAuthUidRef.current = null;
        firestoreSyncStateRef.current = createFirestoreSyncState();
        pendingProtectedAccountEmailsRef.current.clear();
        setIsInitialHydrating(false);
        notifySyncStatus('offline', 'انتهت جلسة Google — يرجى إعادة تسجيل الدخول للمزامنة');
        try {
          localStorage.setItem(STORAGE_KEYS.AUTH, '0');
        } catch {}
        setIsAuthenticated(false);
        return;
      }

      if (activeAuthUidRef.current !== fbUser.uid) {
        activeAuthUidRef.current = fbUser.uid;
        firestoreSyncStateRef.current = createFirestoreSyncState();
        hasCompletedInitialSyncRef.current = false;
        pendingProtectedAccountEmailsRef.current.clear();
      }

      try {
        await ensureFirestoreAdminBootstrap(userAccountsRef.current);

        // 1. Hydrate existing data from Firestore BEFORE enabling outgoing pushes (protects remote records from stale defaults)
        const { storeData, populatedCollections } = await hydrateFromFirestoreOnce(
          firestoreSyncStateRef.current,
          userAccountsRef.current
        );
        if (!isEffectActive) return;

        if (Object.keys(storeData).length > 0) {
          applyRemoteStoreDataRef.current(storeData, true, localWriteEpochRef.current);
        }

        // 2. Seed any missing Firestore collections safely (only if empty remotely & user is admin/authorized)
        const accountsNow = storeData.userAccounts || userAccountsRef.current;
        const isAdminNow = isCurrentUserAdmin(accountsNow);
        if (isAdminNow && fbUser.email.trim().toLowerCase() !== OWNER_EMAIL) {
          await ensureFirestoreAdminBootstrap(accountsNow);
        }
        const seedBatch: Partial<StoreData> = {};
        if (isAdminNow && !populatedCollections.has('authorizedUsers')) seedBatch.userAccounts = accountsNow;
        if (!populatedCollections.has('bookings') && isAdminNow) seedBatch.bookings = bookingsRef.current;
        if (isAdminNow && !populatedCollections.has('properties')) seedBatch.properties = propertiesRef.current;
        if (isAdminNow && !populatedCollections.has('adminFeeBoxes')) seedBatch.specialAdminFeeBoxes = specialAdminFeeBoxesRef.current;
        if (isAdminNow && !populatedCollections.has('staffMembers')) {
          seedBatch.marketers = marketersRef.current;
          seedBatch.coordinators = coordinatorsRef.current;
          seedBatch.guardsList = guardsListRef.current;
        }
        if (isAdminNow && !populatedCollections.has('guardTasks')) {
          seedBatch.guardTasks = guardTasksRef.current;
          seedBatch.guardTaskTemplates = guardTaskTemplatesRef.current;
        }
        if (isAdminNow && !populatedCollections.has('commissionRequests') && commissionRequestsRef.current.length > 0) {
          seedBatch.commissionRequests = commissionRequestsRef.current;
        }
        if (isAdminNow && !populatedCollections.has('systemStates')) {
          seedBatch.dateOverrides = dateOverridesRef.current;
          seedBatch.supervisorDateOverrides = supervisorDateOverridesRef.current;
          seedBatch.customSupervisorRates = customSupervisorRatesRef.current;
          seedBatch.adminBroadcasts = adminBroadcastsRef.current;
          seedBatch.notifications = notificationsRef.current;
        }
        if (isAdminNow && storeData.coordinatorServices === undefined) {
          seedBatch.coordinatorServices = coordinatorServicesRef.current;
        }
        if (isAdminNow && storeData.expenses === undefined) {
          seedBatch.expenses = expensesRef.current;
        }
        if (isAdminNow && storeData.messageTemplates === undefined) {
          seedBatch.messageTemplates = messageTemplatesRef.current;
        }
        if (isAdminNow && storeData.activityLogs === undefined) {
          seedBatch.activityLogs = activityLogsRef.current.slice(0, 80);
        }
        if (isAdminNow && storeData.kayanItems === undefined) {
          seedBatch.kayanItems = kayanItemsRef.current;
        }
        if (isAdminNow && storeData.kayanSettings === undefined) {
          seedBatch.kayanSettings = kayanSettingsRef.current;
        }
        if (isAdminNow && storeData.kayanOrders === undefined) {
          seedBatch.kayanOrders = kayanOrdersRef.current.slice(0, 120);
        }

        hasCompletedInitialSyncRef.current = true;
        if (!isEffectActive) return;

        // Seed missing collections & propagate permissions in the background without blocking login entry
        if (Object.keys(seedBatch).length > 0 || (isAdminNow && hasMissingAuthorizedEmailsInCache(accountsNow, firestoreSyncStateRef.current))) {
          void (async () => {
            if (Object.keys(seedBatch).length > 0) {
              await mirrorBatchToFirestore(seedBatch);
            }
            if (isAdminNow && hasMissingAuthorizedEmailsInCache(accountsNow, firestoreSyncStateRef.current)) {
              await propagateAccessInBackground(accountsNow);
            }
          })();
        }

        // 3. Attach real-time Firestore listeners
        unsubFirestore = subscribeFirestoreRealtime(firestoreSyncStateRef.current, {
          onAuthorizedUsers: (accounts) => {
            applyRemoteStoreDataRef.current({ userAccounts: accounts }, false, localWriteEpochRef.current);
          },
          onOwnAccountUpdated: (ownAccount) => {
            const emailNorm = ownAccount.email.trim().toLowerCase();
            const merged = userAccountsRef.current.some((a) => a.email.trim().toLowerCase() === emailNorm)
              ? userAccountsRef.current.map((a) => (a.email.trim().toLowerCase() === emailNorm ? ownAccount : a))
              : [...userAccountsRef.current, ownAccount];
            userAccountsRef.current = merged;
            setUserAccounts(merged);
            StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, merged);

            if (!simulationRef.current.isSimulating) {
              if (userRoleRef.current !== ownAccount.role) {
                setUserRole(ownAccount.role);
              }
              if (ownAccount.role === 'marketer') {
                const matchedM = marketersRef.current.find(
                  (m) =>
                    m.id === ownAccount.marketerId ||
                    m.id === ownAccount.id ||
                    m.email?.trim().toLowerCase() === emailNorm
                );
                const resolvedMId = ownAccount.marketerId || matchedM?.id || ownAccount.id;
                if (resolvedMId) setCurrentMarketerId(resolvedMId);
              } else if (ownAccount.role === 'coordinator') {
                const matchedC = coordinatorsRef.current.find(
                  (c) =>
                    c.id === ownAccount.coordinatorId ||
                    c.id === ownAccount.id ||
                    c.email?.trim().toLowerCase() === emailNorm
                );
                const resolvedCId = ownAccount.coordinatorId || matchedC?.id || ownAccount.id;
                if (resolvedCId) setCurrentCoordinatorId(resolvedCId);
              } else if (ownAccount.role === 'guard') {
                const matchedG = guardsListRef.current.find(
                  (g) =>
                    g.id === ownAccount.guardId ||
                    g.id === ownAccount.id ||
                    g.email?.trim().toLowerCase() === emailNorm
                );
                if (matchedG) setGuard(matchedG);
              }
            }
          },
          onOwnAccountRevoked: () => {
            const activeEmail = auth.currentUser?.email?.trim().toLowerCase();
            if (activeEmail && activeEmail !== OWNER_EMAIL && !simulationRef.current.isSimulating) {
              hasCompletedInitialSyncRef.current = false;
              notifySyncStatus('error', 'تمت إزالة صلاحية دخول هذا الحساب من الإدارة');
              triggerBrowserNotification('⛔ انتهت صلاحية الدخول', 'تمت إزالة هذا الحساب من قائمة المصرح لهم في AMASA.', 'system');
              try {
                localStorage.setItem(STORAGE_KEYS.AUTH, '0');
              } catch {}
              setIsAuthenticated(false);
            }
          },
          onBookings: (remoteBookings) => {
            applyRemoteStoreDataRef.current({ bookings: remoteBookings }, false, localWriteEpochRef.current);
          },
          onProperties: (remoteProps) => {
            applyRemoteStoreDataRef.current({ properties: remoteProps }, false, localWriteEpochRef.current);
          },
          onAdminFeeBoxes: (remoteBoxes) => {
            applyRemoteStoreDataRef.current({ specialAdminFeeBoxes: remoteBoxes }, false, localWriteEpochRef.current);
          },
          onStaffMembers: ({ marketers: mks, coordinators: coords, guardsList: gds }) => {
            applyRemoteStoreDataRef.current(
              {
                marketers: mks,
                coordinators: coords,
                ...(gds.length > 0 ? { guardsList: gds } : {}),
              },
              false,
              localWriteEpochRef.current
            );
          },
          onGuardTasks: ({ tasks, templates }) => {
            applyRemoteStoreDataRef.current(
              {
                guardTasks: tasks,
                guardTaskTemplates: templates,
              },
              false,
              localWriteEpochRef.current
            );
          },
          onCommissionRequests: (reqs) => {
            applyRemoteStoreDataRef.current({ commissionRequests: reqs }, false, localWriteEpochRef.current);
          },
          onSystemState: (stateId, value) => {
            applyRemoteStoreDataRef.current({ [stateId]: value } as Partial<StoreData>, false, localWriteEpochRef.current);
          },
        });
      } catch (err) {
        hasCompletedInitialSyncRef.current = true;
        console.warn('Firestore init/subscribe error:', err);
      } finally {
        clearTimeout(hydrationSafetyTimer);
        if (isEffectActive) {
          setIsInitialHydrating(false);
        }
      }
    });

    return () => {
      isEffectActive = false;
      clearTimeout(hydrationSafetyTimer);
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, [isAuthenticated, isDemoMode, authSessionEpoch, mirrorBatchToFirestore, propagateAccessInBackground, triggerBrowserNotification]);

  const refreshFromServer = useCallback(async (): Promise<boolean> => {
    if (isPersonalDemoMode()) {
      return true;
    }
    try {
      const fetchEpoch = localWriteEpochRef.current;
      const { storeData } = await hydrateFromFirestoreOnce(
        firestoreSyncStateRef.current,
        userAccountsRef.current
      );
      if (Object.keys(storeData).length > 0) {
        applyRemoteStoreDataRef.current(storeData, false, fetchEpoch);
        return true;
      }
      return Boolean(auth.currentUser);
    } catch {
      return false;
    }
  }, []);

  // Keep nowTimestamp updated every 1s for the 15-minute countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save states to StorageService & push changes immediately to all connected screens
  useEffect(() => {
    StorageService.set(STORAGE_KEYS.USER_ROLE, userRole);
    StorageService.set(STORAGE_KEYS.MARKETER_ID, currentMarketerId);
    StorageService.set(STORAGE_KEYS.COORDINATOR_ID, currentCoordinatorId);
  }, [userRole, currentMarketerId, currentCoordinatorId]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.GUARD, guard);
  }, [guard]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.GUARDS_LIST, guardsList);
    queueRealtimePush('guardsList', guardsList);
  }, [guardsList, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.PROPERTIES, properties);
    queueRealtimePush('properties', properties);
  }, [properties, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.SELECTED_PROPERTY, selectedPropertyId);
  }, [selectedPropertyId]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.MARKETERS, marketers);
    queueRealtimePush('marketers', marketers);
  }, [marketers, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.BOOKINGS, bookings);
    queueRealtimePush('bookings', bookings);
  }, [bookings, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.OVERRIDES, dateOverrides);
    queueRealtimePush('dateOverrides', dateOverrides);
  }, [dateOverrides, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.LOGS, activityLogs);
    queueRealtimePush('activityLogs', activityLogs.slice(0, 80));
  }, [activityLogs, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.COORDINATOR_SERVICES, coordinatorServices);
    queueRealtimePush('coordinatorServices', coordinatorServices);
  }, [coordinatorServices, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.EXPENSES, expenses);
    queueRealtimePush('expenses', expenses);
  }, [expenses, queueRealtimePush]);

  useEffect(() => {
    const newLocalNotifs = notifications.filter((n) => !dispatchedPushNotifIdsRef.current.has(n.id));
    newLocalNotifs.forEach((n) => dispatchedPushNotifIdsRef.current.add(n.id));

    if (hasCompletedInitialSyncRef.current && newLocalNotifs.length > 0 && !isDemoMode) {
      const latestLocal = newLocalNotifs[0];
      if (latestLocal && !latestLocal.id.startsWith('test-notif-')) {
        void dispatchRemotePushNotification({
          id: latestLocal.id,
          title: latestLocal.title,
          body: latestLocal.description,
          type: latestLocal.type,
          targetAudience: latestLocal.targetAudience,
          propertyId: latestLocal.propertyId,
          targetGuardId: latestLocal.targetGuardId,
          targetGuardIds: latestLocal.targetGuardIds,
          targetMarketerId: latestLocal.targetMarketerId,
          targetMarketerIds: latestLocal.targetMarketerIds,
          targetCoordinatorIds: latestLocal.targetCoordinatorIds,
          silent: !isSoundEnabledRef.current,
        });
      }
    }

    StorageService.set(STORAGE_KEYS.NOTIFICATIONS, notifications);
    queueRealtimePush('notifications', notifications);
  }, [notifications, queueRealtimePush, isDemoMode]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, userAccounts);
    queueRealtimePush('userAccounts', userAccounts);
  }, [userAccounts, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.COMMISSION_REQUESTS, commissionRequests);
    queueRealtimePush('commissionRequests', commissionRequests);
  }, [commissionRequests, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.ADMIN_BROADCASTS, adminBroadcasts);
    queueRealtimePush('adminBroadcasts', adminBroadcasts);
  }, [adminBroadcasts, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.COORDINATORS, coordinators);
    queueRealtimePush('coordinators', coordinators);
  }, [coordinators, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.GUARD_TASKS, guardTasks);
    queueRealtimePush('guardTasks', guardTasks);
  }, [guardTasks, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.GUARD_TASK_TEMPLATES, guardTaskTemplates);
    queueRealtimePush('guardTaskTemplates', guardTaskTemplates);
  }, [guardTaskTemplates, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.SPECIAL_ADMIN_FEE_BOXES, specialAdminFeeBoxes);
    queueRealtimePush('specialAdminFeeBoxes', specialAdminFeeBoxes);
  }, [specialAdminFeeBoxes, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.SUPERVISOR_OVERRIDES, supervisorDateOverrides);
    queueRealtimePush('supervisorDateOverrides', supervisorDateOverrides);
  }, [supervisorDateOverrides, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.SUPERVISOR_CUSTOM_RATES, customSupervisorRates);
    queueRealtimePush('customSupervisorRates', customSupervisorRates);
  }, [customSupervisorRates, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.TEMPLATES, messageTemplates);
    queueRealtimePush('messageTemplates', messageTemplates);
  }, [messageTemplates, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.KAYAN_ITEMS, kayanItems);
    queueRealtimePush('kayanItems', kayanItems);
  }, [kayanItems, queueRealtimePush]);

  useEffect(() => {
    StorageService.set(STORAGE_KEYS.KAYAN_SETTINGS, kayanSettings);
    queueRealtimePush('kayanSettings', kayanSettings);
  }, [kayanSettings, queueRealtimePush]);

  useEffect(() => {
    const sliced = kayanOrders.slice(0, 120);
    StorageService.set(STORAGE_KEYS.KAYAN_ORDERS, sliced);
    queueRealtimePush('kayanOrders', sliced);
  }, [kayanOrders, queueRealtimePush]);

  const logActivity = useCallback((actorName: string, actorRole: string, action: string, details: string) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleString('ar-SA', { hour12: false }),
      actorName,
      actorRole,
      action,
      details,
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  }, []);

  // Check expiration of 15-minute deposit holds
  useEffect(() => {
    let hasChanges = false;
    const updated = { ...dateOverrides };

    Object.entries(dateOverrides).forEach(([key, override]) => {
      if (
        override.status === 'waiting_deposit' &&
        override.waitingDepositExpiresAt &&
        override.waitingDepositExpiresAt <= nowTimestamp
      ) {
        hasChanges = true;
        updated[key] = {
          ...override,
          status: 'available',
          waitingDepositExpiresAt: undefined,
          waitingCustomerName: undefined,
          waitingCustomerPhone: undefined,
          waitingDepositAmount: undefined,
        };

        const [propId, dateKey] = key.split('_');
        const propName = properties.find((p) => p.id === propId)?.name || propId;

        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}-${Math.random()}`,
            title: 'انتهت مهلة تحويل العربون (15 دقيقة)',
            description: `انتهى عداد مهلة العربون لعقار ${propName} في تاريخ ${dateKey}، وعاد اليوم متاحاً للحجز تلقائياً (اللون الأخضر).`,
            timestamp: 'الآن',
            read: false,
            type: 'deposit_expired',
            targetAudience: 'all',
          },
          ...prev,
        ]);

        logActivity(
          'النظام التلقائي',
          'system',
          'انتهاء مهلة العربون',
          `انتهت مهلة الـ 15 دقيقة لتحويل العربون لعقار ${propName} في تاريخ ${dateKey}، وعاد التاريخ متاحاً.`
        );
      }
    });

    if (hasChanges) {
      setDateOverrides(updated);
    }
  }, [nowTimestamp, dateOverrides, properties, logActivity]);

  const isAdmin = userRole === 'admin';
  const isGuard = userRole === 'guard';
  const isCoordinator = userRole === 'coordinator';

  const activeGuard = useMemo<Guard>(() => {
    return guardsList.find((g) => g.id === guard.id) || guard;
  }, [guardsList, guard]);

  const currentMarketer = useMemo(() => {
    if (currentMarketerId) {
      const found = marketers.find((m) => m.id === currentMarketerId);
      if (found) return found;
    }
    const activeAuthEmail = (auth.currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('amasa_active_email') : ''))?.trim().toLowerCase();
    if (activeAuthEmail) {
      const foundByEmail = marketers.find((m) => m.email?.trim().toLowerCase() === activeAuthEmail);
      if (foundByEmail) return foundByEmail;
    }
    return marketers[0] || null;
  }, [marketers, currentMarketerId]);

  const isSupervisor = !isAdmin && !isGuard && !isCoordinator && !!currentMarketer?.isSupervisor;

  const currentCoordinator = useMemo(() => {
    return coordinators.find((c) => c.id === currentCoordinatorId) || coordinators[0] || null;
  }, [coordinators, currentCoordinatorId]);

  const activePermissions = useMemo<MarketerPermissions>(() => {
    if (isAdmin) {
      return {
        canCreateBooking: true,
        canEditPrices: true,
        canViewAllBookings: true,
        canBlockDates: true,
        canViewCustomerContacts: true,
        canExportReports: true,
        canViewFinancials: true,
        canCreateContract: true,
        canEditDeposit: true,
        canViewDashboard: true,
        canViewGuardTasks: true,
        canViewCalendar: true,
        canViewBookings: true,
        canViewProperties: true,
        canViewMarketers: true,
        canViewMore: true,
        canManageTemplates: true,
        canViewRentalContract: true,
        canViewActivityLogs: true,
        canViewSupervisor: true,
      };
    }
    if (isGuard) {
      const gPerms = activeGuard.permissions || {
        canViewCalendar: false,
        canViewCustomerContacts: true,
        canConfirmArrival: true,
        canReceiveInsurance: true,
        canInspectUnit: true,
        canRefundInsurance: true,
        canViewDashboard: true,
        canViewGuardTasks: true,
        canViewBookings: false,
        canViewProperties: false,
        canViewMarketers: false,
        canViewMore: false,
        canBlockDates: false,
      };
      return {
        canCreateBooking: !!gPerms.canViewBookings || !!gPerms.canViewCalendar,
        canEditPrices: !!gPerms.canViewCalendar || !!gPerms.canViewProperties,
        canViewAllBookings: !!gPerms.canViewCalendar || !!gPerms.canViewBookings || !!gPerms.canViewMarketers,
        canBlockDates: !!gPerms.canBlockDates || !!gPerms.canViewCalendar,
        canViewCustomerContacts: gPerms.canViewCustomerContacts !== false,
        canExportReports: !!gPerms.canViewMore || !!gPerms.canViewMarketers,
        canViewFinancials: !!gPerms.canViewMore || !!gPerms.canViewMarketers,
        canCreateContract: !!gPerms.canViewBookings || !!gPerms.canViewMore,
        canEditDeposit: !!gPerms.canViewBookings || !!gPerms.canViewCalendar,
        canViewDashboard: gPerms.canViewDashboard !== false,
        canViewGuardTasks: gPerms.canViewGuardTasks !== false,
        canViewCalendar: !!gPerms.canViewCalendar,
        canViewBookings: !!gPerms.canViewBookings,
        canViewProperties: !!gPerms.canViewProperties,
        canViewMarketers: !!gPerms.canViewMarketers,
        canViewMore: !!gPerms.canViewMore,
        canManageTemplates: !!gPerms.canViewMore,
        canViewRentalContract: !!gPerms.canViewMore,
        canViewActivityLogs: !!gPerms.canViewMore,
      };
    }
    if (isCoordinator) {
      const cPerms = currentCoordinator?.permissions;
      return {
        canCreateBooking: cPerms?.canCreateBooking !== false,
        canEditPrices: !!cPerms?.canEditPrices || !!cPerms?.canViewCalendar || !!cPerms?.canViewProperties,
        canViewAllBookings: !!cPerms?.canViewAllBookings,
        canBlockDates: !!cPerms?.canBlockDates || !!cPerms?.canViewCalendar,
        canViewCustomerContacts: cPerms?.canViewCustomerContacts !== false,
        canExportReports: !!cPerms?.canExportReports || !!cPerms?.canViewMore,
        canViewFinancials: !!cPerms?.canViewFinancials || !!cPerms?.canViewMore || !!cPerms?.canViewMarketers,
        canCreateContract: cPerms?.canCreateContract !== false,
        canEditDeposit: cPerms?.canEditDeposit !== false,
        canViewDashboard: cPerms?.canViewDashboard !== false,
        canViewGuardTasks: !!cPerms?.canViewGuardTasks,
        canViewCalendar: !!cPerms?.canViewCalendar,
        canViewBookings: cPerms?.canViewBookings !== false,
        canViewProperties: !!cPerms?.canViewProperties,
        canViewMarketers: !!cPerms?.canViewMarketers,
        canViewMore: !!cPerms?.canViewMore,
        canManageTemplates: !!cPerms?.canManageTemplates || !!cPerms?.canViewMore,
        canViewRentalContract: !!cPerms?.canViewRentalContract || !!cPerms?.canViewMore,
        canViewActivityLogs: !!cPerms?.canViewActivityLogs || !!cPerms?.canViewMore,
      };
    }
    const mPerms = currentMarketer?.permissions;
    return {
      canCreateBooking: true,
      canEditPrices: true,
      canViewAllBookings: true,
      canBlockDates: true,
      canViewCustomerContacts: true,
      canExportReports: true,
      canViewFinancials: true,
      canCreateContract: true,
      canEditDeposit: true,
      canViewDashboard: mPerms?.canViewDashboard !== false,
      canViewGuardTasks: !!mPerms?.canViewGuardTasks,
      canViewCalendar: !!mPerms?.canViewCalendar,
      canViewBookings: mPerms?.canViewBookings !== false,
      canViewProperties: !!mPerms?.canViewProperties,
      canViewMarketers: !!mPerms?.canViewMarketers,
      canViewMore: mPerms?.canViewMore !== false,
      canManageTemplates: true,
      canViewRentalContract: true,
      canViewActivityLogs: true,
      canViewSupervisor: !!currentMarketer?.isSupervisor && !!mPerms?.canViewSupervisor,
    };
  }, [isAdmin, isGuard, isCoordinator, activeGuard.permissions, currentCoordinator?.permissions, currentMarketer?.permissions, currentMarketer?.isSupervisor]);

  const canViewDashboard = isAdmin || !!activePermissions.canViewDashboard;
  const canViewGuardTasks = isAdmin || !!activePermissions.canViewGuardTasks;
  const canViewCalendar = isAdmin || !!activePermissions.canViewCalendar;
  const canViewBookings = isAdmin || !!activePermissions.canViewBookings;
  const canViewSupervisor = isAdmin || !!activePermissions.canViewSupervisor;
  const canViewProperties = isAdmin || !!activePermissions.canViewProperties;
  const canViewMarketers = isAdmin || !!activePermissions.canViewMarketers;
  const canViewMore = isAdmin || !!activePermissions.canViewMore;
  const canViewKayanDetergents = isAdmin;

  const canCreateContract = isAdmin || !!activePermissions.canCreateContract;
  const canEditDeposit = isAdmin || !!activePermissions.canEditDeposit;
  const canManageTemplates = isAdmin || canViewMore || !!activePermissions.canManageTemplates;
  const canViewRentalContract = isAdmin || canViewMore || !!activePermissions.canViewRentalContract;
  const canViewActivityLogs = isAdmin || canViewMore || !!activePermissions.canViewActivityLogs;

  // Automatically redirect restricted tabs when switching roles or toggling permissions
  useEffect(() => {
    const isAllowed = (tab: ActiveTab): boolean => {
      if (isAdmin) return true;
      switch (tab) {
        case 'dashboard': return canViewDashboard;
        case 'guard-tasks': return canViewGuardTasks;
        case 'calendar': return canViewCalendar;
        case 'bookings': return canViewBookings;
        case 'supervisor': return canViewSupervisor;
        case 'properties': return canViewProperties;
        case 'marketers': return canViewMarketers;
        case 'more': return canViewMore;
        case 'kayan-detergents': return false;
        default: return false;
      }
    };
    if (!isAllowed(activeTab)) {
      const order: ActiveTab[] = ['dashboard', 'bookings', 'supervisor', 'guard-tasks', 'calendar', 'properties', 'marketers', 'more'];
      const fallback = order.find((t) => isAllowed(t));
      if (fallback && fallback !== activeTab) {
        setActiveTab(fallback);
      }
    }
  }, [
    isAdmin,
    activeTab,
    canViewDashboard,
    canViewGuardTasks,
    canViewCalendar,
    canViewBookings,
    canViewSupervisor,
    canViewProperties,
    canViewMarketers,
    canViewMore,
  ]);

  const currentUserAccount = useMemo(() => {
    const activeAuthEmail = (
      auth.currentUser?.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('amasa_active_email') : '') ||
      ''
    )
      .trim()
      .toLowerCase();

    if (isAdmin) {
      return (
        (activeAuthEmail
          ? userAccounts.find((a) => a.role === 'admin' && a.email.trim().toLowerCase() === activeAuthEmail)
          : undefined) ||
        userAccounts.find((a) => a.role === 'admin' && a.email.trim().toLowerCase() === 'sakt2008@gmail.com') ||
        userAccounts.find((a) => a.role === 'admin') ||
        INITIAL_USER_ACCOUNTS[0]
      );
    }
    if (isGuard) {
      return (
        userAccounts.find((a) => a.role === 'guard' && (a.guardId === activeGuard.id || a.id === activeGuard.id || (activeAuthEmail && a.email.trim().toLowerCase() === activeAuthEmail) || a.email === activeGuard.email)) ||
        userAccounts.find((a) => a.role === 'guard') ||
        INITIAL_USER_ACCOUNTS[1]
      );
    }
    if (isCoordinator) {
      return (
        userAccounts.find((a) => a.role === 'coordinator' && (a.coordinatorId === currentCoordinatorId || a.id === currentCoordinatorId || (activeAuthEmail && a.email.trim().toLowerCase() === activeAuthEmail) || (currentCoordinator?.email && a.email.toLowerCase() === currentCoordinator.email.toLowerCase()))) ||
        userAccounts.find((a) => a.role === 'coordinator') ||
        INITIAL_USER_ACCOUNTS[0]
      );
    }
    return (
      userAccounts.find((a) => a.marketerId === currentMarketerId) ||
      userAccounts.find((a) => a.id === currentMarketerId) ||
      (activeAuthEmail ? userAccounts.find((a) => a.email.trim().toLowerCase() === activeAuthEmail) : undefined) ||
      userAccounts.find((a) => a.role === 'marketer') ||
      INITIAL_USER_ACCOUNTS[0]
    );
  }, [userAccounts, isAdmin, isGuard, isCoordinator, activeGuard.id, activeGuard.email, currentCoordinatorId, currentCoordinator?.email, currentMarketerId]);

  const selectedProperty = useMemo(() => {
    return properties.find((p) => p.id === selectedPropertyId) || properties[0];
  }, [properties, selectedPropertyId]);

  const guardPropertyIds = useMemo<string[]>(() => {
    if (!isGuard) return [];
    const ids: string[] = [];
    if (Array.isArray(activeGuard.assignedPropertyIds) && activeGuard.assignedPropertyIds.length > 0) {
      ids.push(...activeGuard.assignedPropertyIds);
    }
    if (activeGuard.assignedPropertyId && !ids.includes(activeGuard.assignedPropertyId)) {
      ids.push(activeGuard.assignedPropertyId);
    }
    return ids;
  }, [isGuard, activeGuard.assignedPropertyIds, activeGuard.assignedPropertyId]);

  const filteredBookings = useMemo(() => {
    const isSupBk = (b: Booking) =>
      Boolean(b.isSupervisorBooking || b.bookingType === 'supervisor' || b.bookingCategory === 'supervisor');
    let list: Booking[];
    if (isAdmin) {
      list = bookings;
    } else if (activePermissions.canViewAllBookings) {
      // Marketers never see separate Supervisor bookings/pricing in general bookings feed
      list = bookings.filter((b) => !isSupBk(b) || (isSupervisor && b.supervisorId === currentMarketerId));
    } else if (isGuard) {
      if (guardPropertyIds.length === 0) {
        return [];
      }
      list = bookings.filter((b) => guardPropertyIds.includes(b.propertyId));
    } else if (isCoordinator) {
      const cName = currentCoordinator?.name;
      list = bookings.filter(
        (b) =>
          !isSupBk(b) &&
          ((cName && (b.coordinatorName === cName || b.coordinatorServicesList?.some((s) => s.coordinatorName === cName))) ||
            b.marketerId === currentCoordinatorId)
      );
    } else {
      // Standard marketers only see their standard bookings (Supervisor bookings live exclusively inside Supervisor page)
      list = bookings.filter((b) => !isSupBk(b) && b.marketerId === currentMarketerId);
    }
    const seen = new Set<string>();
    return list.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [bookings, isAdmin, isGuard, isCoordinator, isSupervisor, activePermissions.canViewAllBookings, guardPropertyIds, currentCoordinator?.name, currentCoordinatorId, currentMarketerId]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayArrivals = useMemo(() => {
    const isSupBk = (b: Booking) =>
      Boolean(b.isSupervisorBooking || b.bookingType === 'supervisor' || b.bookingCategory === 'supervisor');
    let baseBookings = bookings;
    if (!isAdmin) {
      if (activePermissions.canViewAllBookings) {
        baseBookings = bookings.filter((b) => !isSupBk(b));
      } else if (isGuard) {
        if (guardPropertyIds.length === 0) return [];
        baseBookings = bookings.filter((b) => guardPropertyIds.includes(b.propertyId));
      } else if (isCoordinator) {
        const cName = currentCoordinator?.name;
        baseBookings = bookings.filter(
          (b) =>
            !isSupBk(b) &&
            ((cName && (b.coordinatorName === cName || b.coordinatorServicesList?.some((s) => s.coordinatorName === cName))) ||
              b.marketerId === currentCoordinatorId)
        );
      } else {
        baseBookings = bookings.filter((b) => !isSupBk(b) && b.marketerId === currentMarketerId);
      }
    }
    const list = baseBookings.filter(
      (b) =>
        (b.checkInDate === todayStr ||
          b.id === 'bk-today-in' ||
          b.id === 'bk-today-hamran' ||
          b.id === 'bk-today-out' ||
          b.checkInDate === '2026-10-06') &&
        b.status !== 'cancelled'
    );
    const seen = new Set<string>();
    return list.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [bookings, todayStr, isGuard, isCoordinator, activePermissions.canViewAllBookings, guardPropertyIds, isAdmin, currentCoordinator?.name, currentCoordinatorId, currentMarketerId]);

  const todayDepartures = useMemo(() => {
    const isSupBk = (b: Booking) =>
      Boolean(b.isSupervisorBooking || b.bookingType === 'supervisor' || b.bookingCategory === 'supervisor');
    let baseBookings = bookings;
    if (!isAdmin) {
      if (activePermissions.canViewAllBookings) {
        baseBookings = bookings.filter((b) => !isSupBk(b));
      } else if (isGuard) {
        if (guardPropertyIds.length === 0) return [];
        baseBookings = bookings.filter((b) => guardPropertyIds.includes(b.propertyId));
      } else if (isCoordinator) {
        const cName = currentCoordinator?.name;
        baseBookings = bookings.filter(
          (b) =>
            !isSupBk(b) &&
            ((cName && (b.coordinatorName === cName || b.coordinatorServicesList?.some((s) => s.coordinatorName === cName))) ||
              b.marketerId === currentCoordinatorId)
        );
      } else {
        baseBookings = bookings.filter((b) => !isSupBk(b) && b.marketerId === currentMarketerId);
      }
    }
    const list = baseBookings.filter(
      (b) =>
        (b.checkOutDate === todayStr || b.id === 'bk-today-out' || b.checkOutDate === '2026-10-06') &&
        b.status !== 'cancelled'
    );
    const seen = new Set<string>();
    return list.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [bookings, todayStr, isGuard, isCoordinator, activePermissions.canViewAllBookings, guardPropertyIds, isAdmin, currentCoordinator?.name, currentCoordinatorId, currentMarketerId]);

  const currentUserReadKey = useMemo(() => {
    if (isAdmin) return auth.currentUser?.email?.trim().toLowerCase() || 'admin';
    if (isGuard) return `guard:${activeGuard.id}`;
    if (isCoordinator) return `coord:${currentCoordinatorId}`;
    return `mkt:${currentMarketerId}`;
  }, [isAdmin, isGuard, isCoordinator, activeGuard.id, currentCoordinatorId, currentMarketerId]);

  currentUserReadKeyRef.current = currentUserReadKey;

  // Notifications filtering strictly by targetAudience, groupType, and role, with per-user read state
  const filteredNotifications = useMemo(() => {
    const audCtx: NotificationAudienceContext = {
      isAdmin,
      isGuard,
      isCoordinator,
      activeGuardId: activeGuard.id,
      guardPropertyIds,
      currentCoordinatorId,
      currentCoordinatorName: currentCoordinator?.name,
      currentMarketerId,
      bookings,
      marketers,
    };
    const localReadSet = new Set(localReadNotifIds);
    return notifications
      .filter((n) => isNotificationVisibleToActor(n, audCtx))
      .map((n) => {
        const isReadForMe = Boolean(
          n.readBy?.includes(currentUserReadKey) ||
            localReadSet.has(`${currentUserReadKey}::${n.id}`) ||
            (n.readBy === undefined && n.read)
        );
        return isReadForMe === n.read ? n : { ...n, read: isReadForMe };
      });
  }, [
    notifications,
    isAdmin,
    isGuard,
    isCoordinator,
    currentMarketerId,
    currentCoordinatorId,
    currentCoordinator?.name,
    activeGuard.id,
    guardPropertyIds,
    bookings,
    marketers,
    localReadNotifIds,
    currentUserReadKey,
  ]);

  // Active urgent broadcast calculation for high-visibility banner
  const activeUrgentBroadcast = useMemo(() => {
    const currentActorId = isGuard
      ? activeGuard.id
      : isCoordinator
      ? currentCoordinatorId
      : isAdmin
      ? 'admin'
      : currentMarketerId;

    const urgentList = adminBroadcasts.filter(
      (b) =>
        b.priority === 'urgent' &&
        !acknowledgedBroadcastIds.includes(b.id) &&
        !(b.acknowledgedBy || []).includes(currentActorId)
    );
    if (urgentList.length === 0) return null;

    if (isAdmin) {
      return urgentList[0];
    }

    if (isGuard) {
      return (
        urgentList.find((b) => {
          if (b.targetGroup === 'all') return true;
          if (b.targetGroup === 'all_guards') return true;
          if (b.targetGroup === 'specific_guard') {
            return (
              (b.targetGuardId && b.targetGuardId === activeGuard.id) ||
              (b.targetPropertyId && guardPropertyIds.includes(b.targetPropertyId))
            );
          }
          if (b.targetGroup === 'custom') {
            return Boolean(b.targetGuardIds?.includes(activeGuard.id));
          }
          return false;
        }) || null
      );
    }

    if (isCoordinator) {
      return (
        urgentList.find((b) => {
          if (b.targetGroup === 'all') return true;
          if (b.targetGroup === 'coordinators') return true;
          if (b.targetGroup === 'custom') {
            return Boolean(b.targetCoordinatorIds?.includes(currentCoordinatorId));
          }
          return false;
        }) || null
      );
    }

    // Marketer
    const femaleNames = ['سارة', 'ريم', 'نورة', 'منيرة', 'هند', 'مها', 'عبير', 'خلود', 'فاطمة', 'عائشة', 'لطيفة', 'أمل', 'شهد'];
    const currentMkt = marketers.find((m) => m.id === currentMarketerId);
    const isFemale = currentMkt
      ? femaleNames.some((fn) => currentMkt.name.includes(fn)) ||
        currentMkt.id === 'm2' ||
        currentMkt.id === 'm4' ||
        currentMkt.id === 'm5'
      : false;

    return (
      urgentList.find((b) => {
        if (b.targetGroup === 'all') return true;
        if (b.targetGroup === 'all_marketers') return true;
        if (b.targetGroup === 'female_marketers') return isFemale;
        if (b.targetGroup === 'custom' && b.targetMarketerIds) {
          return b.targetMarketerIds.includes(currentMarketerId);
        }
        return false;
      }) || null
    );
  }, [
    adminBroadcasts,
    acknowledgedBroadcastIds,
    isAdmin,
    isGuard,
    isCoordinator,
    activeGuard.id,
    guardPropertyIds,
    currentCoordinatorId,
    currentMarketerId,
    marketers,
  ]);

  const unreadNotificationsCount = useMemo(() => {
    return filteredNotifications.filter((n) => !n.read).length;
  }, [filteredNotifications]);

  const addGuardTask = useCallback(
    (taskData: Omit<GuardDailyTask, 'id' | 'createdAt' | 'proofPhotos' | 'status'> & { proofPhotos?: TaskProofPhoto[]; status?: GuardTaskStatus }) => {
      const newId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nowStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const newTask: GuardDailyTask = {
        ...taskData,
        id: newId,
        status: taskData.status || 'pending',
        proofPhotos: taskData.proofPhotos || [],
        createdAt: `اليوم ${nowStr}`,
        createdBy: isAdmin ? 'الإدارة العامة' : 'المشرف',
      };

      setGuardTasks((prev) => [newTask, ...prev]);

      // Send immediate notification to guard
      const shiftLabel = newTask.shift === 'morning' ? 'الفترة الصباحية 🌅' : 'الفترة المسائية 🌙';
      const notifTitle = `📋 مهمة حراسة جديدة (${shiftLabel}): ${newTask.title}`;
      const notifBody = `${newTask.description || ''} - العقار: ${newTask.propertyName}`;

      playChimeSound(true);
      triggerBrowserNotification(notifTitle, notifBody, 'system');

      const taskNotif: AppNotification = {
        id: `notif-${newId}`,
        title: notifTitle,
        description: notifBody,
        timestamp: 'الآن',
        read: false,
        type: 'system',
        targetAudience: 'guards',
        targetGuardId: newTask.guardId,
        propertyId: newTask.propertyId,
      };

      setNotifications((prev) => [taskNotif, ...prev]);

      logActivity(
        'الإدارة العامة',
        'admin',
        'إسناد مهمة يومية للحارس',
        `تم إسناد مهمة "${newTask.title}" للحارس (${newTask.guardName || 'غير محدد'}) - ${shiftLabel}`
      );

      return newTask;
    },
    [isAdmin, playChimeSound, triggerBrowserNotification, logActivity]
  );

  const updateGuardTask = useCallback((id: string, updates: Partial<GuardDailyTask>) => {
    setGuardTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteGuardTask = useCallback((id: string) => {
    setGuardTasks((prev) => prev.filter((t) => t.id !== id));
    void deleteCollectionDocFromFirestore('guardTasks', `task_${id}`, firestoreSyncStateRef.current);
  }, []);

  const completeGuardTaskWithPhoto = useCallback(
    (taskId: string, photoDataUrl: string, note?: string) => {
      const nowStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const photoId = `photo-${Date.now()}`;
      const newPhoto: TaskProofPhoto = {
        id: photoId,
        url: photoDataUrl,
        timestamp: `اليوم ${nowStr}`,
        note: note || '',
      };

      setGuardTasks((prev) => {
        const target = prev.find((t) => t.id === taskId);
        const next = prev.map((t) => {
          if (t.id !== taskId) return t;
          const photos = [...t.proofPhotos, newPhoto];
          return {
            ...t,
            status: 'completed' as GuardTaskStatus,
            proofPhotos: photos,
            guardNotes: note || t.guardNotes,
            completedAt: `اليوم ${nowStr}`,
          };
        });

        // Notify Admin of task completion with photo
        if (target) {
          const shiftLabel = target.shift === 'morning' ? 'الصباحية' : 'المسائية';
          const notifTitle = `✅ تم إنجاز مهمة الحارس (${shiftLabel}): ${target.title}`;
          const notifBody = `أنجز الحارس (${target.guardName || 'الحارس'}) المهمة وتم إرفاق صورة الإثبات من كاميرا الجوال.`;
          playChimeSound(true);
          triggerBrowserNotification(notifTitle, notifBody, 'system');

          const notif: AppNotification = {
            id: `notif-comp-${taskId}-${Date.now()}`,
            title: notifTitle,
            description: notifBody,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'admin_only',
            propertyId: target.propertyId,
          };
          setNotifications((nPrev) => [notif, ...nPrev]);
        }

        return next;
      });

      logActivity(
        guard.name,
        'guard',
        'إكمال مهمة الحارس وتصوير الإثبات',
        `تم التقاط صورة الإثبات وإكمال المهمة رقم (${taskId})`
      );
    },
    [guard.name, playChimeSound, triggerBrowserNotification, logActivity]
  );

  const completeGuardTaskWithoutPhoto = useCallback(
    (taskId: string, note?: string) => {
      const nowStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      setGuardTasks((prev) => {
        const target = prev.find((t) => t.id === taskId);
        const next = prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            status: 'completed' as GuardTaskStatus,
            guardNotes: note?.trim() ? note.trim() : t.guardNotes,
            completedAt: `اليوم ${nowStr}`,
            deductionApplied: false,
          };
        });
        StorageService.set(STORAGE_KEYS.GUARD_TASKS, next);

        if (target) {
          const shiftLabel = target.shift === 'morning' ? 'الصباحية' : 'المسائية';
          const notifTitle = `✅ تم إنجاز مهمة الحارس (${shiftLabel}): ${target.title}`;
          const notifBody = `أنهى الحارس (${target.guardName || guard.name}) المهمة بدون صورة إثبات${note?.trim() ? ` - ملاحظة: ${note.trim()}` : ''}.`;
          playChimeSound(true);
          triggerBrowserNotification(notifTitle, notifBody, 'system');

          const notif: AppNotification = {
            id: `notif-comp-np-${taskId}-${Date.now()}`,
            title: notifTitle,
            description: notifBody,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'admin_only',
            propertyId: target.propertyId,
          };
          setNotifications((nPrev) => [notif, ...nPrev]);
        }
        return next;
      });

      logActivity(
        guard.name,
        'guard',
        'إنجاز مهمة الحارس',
        `تم تأكيد إنجاز المهمة رقم (${taskId})${note?.trim() ? ` - ${note.trim()}` : ''}`
      );
    },
    [guard.name, playChimeSound, triggerBrowserNotification, logActivity]
  );

  const verifyGuardTask = useCallback((taskId: string, adminFeedback?: string) => {
    setGuardTasks((prev) => {
      const next = prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'verified' as GuardTaskStatus,
              deductionApplied: false,
              adminFeedback: adminFeedback?.trim() || 'تم اعتماد واكتمال المهمة بنجاح من الإدارة.',
            }
          : t
      );
      StorageService.set(STORAGE_KEYS.GUARD_TASKS, next);
      return next;
    });
    playChimeSound(true);
    triggerBrowserNotification('🎖️ تم اعتماد إنجاز المهمة', 'تم اعتماد ومراجعة صور الإثبات بنجاح من الإدارة.', 'system');
  }, [playChimeSound, triggerBrowserNotification]);

  const reopenGuardTask = useCallback((taskId: string, adminFeedback: string) => {
    const cleanFeedback = adminFeedback.trim() || 'يرجى إعادة تنفيذ المهمة وتحديث التوثيق من الموقع.';
    setGuardTasks((prev) => {
      const target = prev.find((t) => t.id === taskId);
      const next = prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'pending' as GuardTaskStatus,
              adminFeedback: `⚠️ مطلوب إعادة تنفيذ: ${cleanFeedback}`,
            }
          : t
      );
      StorageService.set(STORAGE_KEYS.GUARD_TASKS, next);

      if (target) {
        const notifTitle = `🔄 إعادة مهمة للحارس: ${target.title}`;
        const notifBody = `العقار: ${target.propertyName} — السبب: ${cleanFeedback}`;
        const notif: AppNotification = {
          id: `notif-reopen-${taskId}-${Date.now()}`,
          title: notifTitle,
          description: notifBody,
          timestamp: 'الآن',
          read: false,
          type: 'system',
          targetAudience: 'guards',
          targetGuardId: target.guardId,
          propertyId: target.propertyId,
        };
        setNotifications((nPrev) => [notif, ...nPrev]);
      }
      return next;
    });
    playChimeSound(true);
    triggerBrowserNotification('🔄 تم إرجاع المهمة للحارس', cleanFeedback, 'system');
  }, [playChimeSound, triggerBrowserNotification]);

  const sendGuardFieldReport = useCallback(
    (params: {
      propertyId: string;
      propertyName: string;
      category: 'maintenance' | 'supplies' | 'emergency' | 'guest_note';
      title: string;
      details: string;
      guardId?: string;
      guardName?: string;
    }) => {
      const catLabels: Record<'maintenance' | 'supplies' | 'emergency' | 'guest_note', string> = {
        maintenance: '🔧 عطل / صيانة عاجلة',
        supplies: '🧴 نقص مستلزمات / نظافة',
        emergency: '🚨 تنبيه أمني / طارئ',
        guest_note: '📝 ملاحظة عن نزيل / مرافق',
      };
      const label = catLabels[params.category];
      const reporter = params.guardName || guard.name || 'الحارس';
      const notifTitle = `${label} (${params.propertyName}): ${params.title}`;
      const notifBody = `بواسطة الحارس: ${reporter} — ${params.details}`;

      playChimeSound(true);
      triggerBrowserNotification(notifTitle, notifBody, 'system');

      const notif: AppNotification = {
        id: `notif-field-${Date.now()}`,
        title: notifTitle,
        description: notifBody,
        timestamp: 'الآن',
        read: false,
        type: 'system',
        targetAudience: 'admin_only',
        propertyId: params.propertyId,
        targetGuardId: params.guardId || guard.id,
        priority: params.category === 'emergency' ? 'urgent' : 'important',
      };

      setNotifications((prev) => [notif, ...prev]);

      logActivity(
        reporter,
        'guard',
        `بلاغ ميداني: ${label}`,
        `${params.propertyName} — ${params.title}: ${params.details}`
      );
    },
    [guard.id, guard.name, playChimeSound, triggerBrowserNotification, logActivity]
  );

  const addGuardTaskTemplate = useCallback(
    (tplData: Omit<GuardTaskTemplate, 'id' | 'createdAt'>): GuardTaskTemplate => {
      const newTpl: GuardTaskTemplate = {
        ...tplData,
        id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setGuardTaskTemplates((prev) => {
        const next = [newTpl, ...prev];
        StorageService.set(STORAGE_KEYS.GUARD_TASK_TEMPLATES, next);
        return next;
      });
      return newTpl;
    },
    []
  );

  const updateGuardTaskTemplate = useCallback((id: string, updates: Partial<GuardTaskTemplate>) => {
    setGuardTaskTemplates((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      StorageService.set(STORAGE_KEYS.GUARD_TASK_TEMPLATES, next);
      return next;
    });
  }, []);

  const deleteGuardTaskTemplate = useCallback((id: string) => {
    setGuardTaskTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      StorageService.set(STORAGE_KEYS.GUARD_TASK_TEMPLATES, next);
      return next;
    });
    void deleteCollectionDocFromFirestore('guardTasks', `tpl_${id}`, firestoreSyncStateRef.current);
  }, []);

  const generateWeeklyGuardTasksNow = useCallback(
    (forceToday = false): number => {
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const todayWeekday = now.getDay(); // 0..6
      const timeNowStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const pinnedTemplates = guardTaskTemplates.filter((tpl) => tpl.isWeeklyRecurring);
      if (pinnedTemplates.length === 0) return 0;

      const generatedTasks: GuardDailyTask[] = [];
      const updatedTemplateIds = new Set<string>();

      pinnedTemplates.forEach((tpl) => {
        const days = Array.isArray(tpl.weeklyDays) && tpl.weeklyDays.length > 0 ? tpl.weeklyDays : [0, 1, 2, 3, 4, 5, 6];
        const matchesDay = forceToday || days.includes(todayWeekday);
        if (!matchesDay) return;

        const alreadyGeneratedForToday =
          tpl.lastGeneratedDate === todayDate ||
          guardTasks.some((gt) => gt.templateId === tpl.id && gt.date === todayDate);

        if (alreadyGeneratedForToday) return;

        const targetGuard =
          guardsList.find((g) => g.id === tpl.guardId) ||
          guardsList[0] ||
          guard;

        generatedTasks.push({
          id: `task-wk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: tpl.title,
          description: tpl.description,
          propertyId: 'general',
          propertyName: tpl.title,
          guardId: targetGuard.id,
          guardName: tpl.guardName || targetGuard.name,
          shift: tpl.shift,
          date: todayDate,
          timeSlot: tpl.timeSlot,
          adminReferencePhoto: tpl.adminReferencePhoto,
          deductionAmount: tpl.deductionAmount ?? 25,
          priority: tpl.priority,
          status: 'pending',
          requiresPhoto: tpl.requiresPhoto,
          proofPhotos: [],
          createdAt: `تلقائي أسبوعي ${timeNowStr}`,
          createdBy: 'الجدول الأسبوعي الآلي',
          templateId: tpl.id,
          isWeeklyPinned: true,
          weeklyDays: days,
        });
        updatedTemplateIds.add(tpl.id);
      });

      if (generatedTasks.length === 0) return 0;

      setGuardTasks((prev) => {
        const existingKeys = new Set(prev.filter((t) => t.templateId).map((t) => `${t.templateId}__${t.date}`));
        const uniqueNew = generatedTasks.filter((t) => !existingKeys.has(`${t.templateId}__${t.date}`));
        if (uniqueNew.length === 0) return prev;
        const next = [...uniqueNew, ...prev];
        StorageService.set(STORAGE_KEYS.GUARD_TASKS, next);
        return next;
      });

      setGuardTaskTemplates((prev) => {
        const next = prev.map((tpl) =>
          updatedTemplateIds.has(tpl.id) ? { ...tpl, lastGeneratedDate: todayDate } : tpl
        );
        StorageService.set(STORAGE_KEYS.GUARD_TASK_TEMPLATES, next);
        return next;
      });

      return generatedTasks.length;
    },
    [guardTaskTemplates, guardTasks, guardsList, guard]
  );

  // Automatic Weekly Recurring Scheduler (checks on mount, template updates, and every 60s for day rollover)
  useEffect(() => {
    generateWeeklyGuardTasksNow(false);
    const interval = setInterval(() => {
      generateWeeklyGuardTasksNow(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [generateWeeklyGuardTasksNow]);

  const saveSpecialFeeBox = useCallback((box: SpecialAdminFeeBox) => {
    setSpecialAdminFeeBoxes((prev) => {
      const idx = prev.findIndex((b) => b.id === box.id);
      let next: SpecialAdminFeeBox[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...box, updatedAt: new Date().toISOString() };
      } else {
        next = [...prev, { ...box, updatedAt: new Date().toISOString() }];
      }
      return next;
    });
  }, []);

  const deleteSpecialFeeBox = useCallback((id: string) => {
    setSpecialAdminFeeBoxes((prev) => prev.filter((b) => b.id !== id));
    void deleteCollectionDocFromFirestore('adminFeeBoxes', id, firestoreSyncStateRef.current);
  }, []);

  const getSpecialFeeForPeriod = useCallback((propertyId: string, period: SpecialFeePeriod) => {
    return specialAdminFeeBoxes.find(
      (b) => (b.propertyId === propertyId || b.propertyId === 'all') && b.period === period
    );
  }, [specialAdminFeeBoxes]);

  const switchUser = useCallback(
    (role: UserRole, targetId?: string) => {
      setUserRole(role);
      if (role === 'marketer' && targetId) {
        setCurrentMarketerId(targetId);
      } else if (role === 'coordinator' && targetId) {
        setCurrentCoordinatorId(targetId);
      } else if (role === 'guard' && targetId) {
        const matched = guardsList.find((g) => g.id === targetId || g.assignedPropertyId === targetId);
        if (matched) setGuard(matched);
      }
      const roleName =
        role === 'admin'
          ? 'الإدارة (المدير العام)'
          : role === 'guard'
          ? (guardsList.find((g) => g.id === targetId)?.name || activeGuard.name)
          : role === 'coordinator'
          ? (coordinators.find((c) => c.id === targetId)?.name || 'منسقة')
          : marketers.find((m) => m.id === targetId)?.name || 'مسوق';

      logActivity(
        roleName,
        role,
        'تبديل الحساب',
        `تم تسجيل الدخول بصلاحية: ${role === 'admin' ? 'الإدارة' : role === 'guard' ? 'الحارس' : role === 'coordinator' ? 'منسقة' : 'مسوق'}`
      );
    },
    [guardsList, activeGuard.name, coordinators, marketers, logActivity]
  );

  const startSimulation = useCallback(
    (role: UserRole, targetId?: string, targetName?: string, targetProperty?: string) => {
      let resolvedName = targetName;
      let resolvedCode: string | undefined;
      let resolvedPhone: string | undefined;

      if (role === 'guard') {
        const g = guardsList.find((item) => item.id === targetId || item.assignedPropertyId === targetId) || activeGuard;
        resolvedName = resolvedName || g.name;
        resolvedPhone = g.phone;
        setGuard(g);
        setUserRole('guard');
        if (g.permissions?.canViewDashboard !== false) setActiveTab('dashboard');
      } else if (role === 'marketer') {
        const m = marketers.find((item) => item.id === targetId);
        resolvedName = resolvedName || m?.name || 'مسوق';
        resolvedCode = m?.code;
        resolvedPhone = m?.phone;
        if (targetId) setCurrentMarketerId(targetId);
        setUserRole('marketer');
        if (m?.permissions?.canViewBookings !== false) setActiveTab('bookings');
      } else if (role === 'coordinator') {
        const c = coordinators.find((item) => item.id === targetId);
        resolvedName = resolvedName || c?.name || 'منسقة حفلات';
        resolvedPhone = c?.phone;
        if (targetId) setCurrentCoordinatorId(targetId);
        setUserRole('coordinator');
        if (c?.permissions?.canViewBookings !== false) setActiveTab('bookings');
      } else {
        setUserRole('admin');
        resolvedName = 'الإدارة (المدير العام)';
      }

      const state: SimulationState = {
        isSimulating: role !== 'admin',
        role,
        targetId,
        targetName: resolvedName || 'حساب مستخدم',
        targetCode: resolvedCode,
        targetProperty,
        targetPhone: resolvedPhone,
        startedAt: new Date().toLocaleTimeString('ar-SA'),
      };
      setSimulation(state);

      logActivity(
        'الإدارة العامة',
        'admin',
        'معاينة وتبديل حساب فعلي',
        `تم التحويل الفعلي للمعاينة بحساب: ${state.targetName} (${role === 'guard' ? 'حارس' : role === 'marketer' ? 'مسوق' : 'منسقة'})`
      );

      triggerBrowserNotification(
        `👁️ وضع المعاينة المباشر: ${state.targetName}`,
        `أنت تتصفح وتختبر الآن بهوية (${state.targetName}). يمكنك رؤية التنبيهات والأخطاء مباشرة.`,
        'system'
      );
    },
    [guardsList, activeGuard, marketers, coordinators, logActivity, triggerBrowserNotification]
  );

  const exitSimulation = useCallback(() => {
    setSimulation({
      isSimulating: false,
      role: 'admin',
      targetName: 'الإدارة (المدير العام)',
    });
    setUserRole('admin');
    logActivity('الإدارة العامة', 'admin', 'إنهاء المعاينة', 'تم الرجوع إلى حساب الإدارة العامة (المدير العام)');
    triggerBrowserNotification('👑 عودة لحساب الإدارة', 'تم الرجوع إلى صلاحيات وحساب الإدارة العامة بنجاح', 'system');
  }, [logActivity, triggerBrowserNotification]);

  const testAlertOnCurrentAccount = useCallback((tRole?: UserRole, tId?: string, tName?: string) => {
    const role = tRole || simulation.role || userRole;
    const id = tId || simulation.targetId || (role === 'marketer' ? currentMarketerId : guard.id);
    const name = tName || simulation.targetName || (role === 'admin' ? 'الإدارة' : role === 'guard' ? guard.name : currentMarketer?.name || 'المستخدم');

    const title = `🔔 تجربة تنبيه وتفاعل فوري: ${name}`;
    const body = `تم إطلاق هذا التنبيه التجريبي المباشر لفحص وصول التنبيهات ونغمة الصوت الموسيقية لحساب (${name}).`;

    triggerBrowserNotification(title, body, 'system');

    const testNotif: AppNotification = {
      id: `test-notif-${Date.now()}`,
      title,
      description: body,
      timestamp: 'الآن',
      read: false,
      type: 'system',
      targetAudience: role === 'guard' ? 'guards' : role === 'marketer' ? 'marketers' : 'all',
      targetMarketerId: role === 'marketer' ? id : undefined,
      targetGuardId: role === 'guard' ? id : undefined,
    };

    setNotifications((prev) => [testNotif, ...prev]);

    logActivity('فحص التنبيهات', role, 'إرسال تنبيه تجريبي', `تم اختبار وصول التنبيه الفوري لحساب ${name}`);
  }, [simulation, userRole, currentMarketerId, guard.id, guard.name, currentMarketer?.name, playChimeSound, triggerBrowserNotification, logActivity]);

  const diagnoseCurrentAccount = useCallback(() => {
    const issues: string[] = [];
    const details: string[] = [];

    const role = simulation.isSimulating ? simulation.role : userRole;
    const targetId = simulation.targetId || (role === 'marketer' ? currentMarketerId : guard.id);

    if (role === 'marketer') {
      const m = marketers.find((item) => item.id === targetId) || currentMarketer;
      if (!m) {
        issues.push('سجل المسوق غير موجود');
      } else {
        details.push(`المسوق: ${m.name}`);
        details.push(`الكود: ${m.code || 'بدون'}`);
        details.push(`العمولة: ${m.commissionRate || 0}%`);
        if (!m.bankAccount || m.bankAccount.length < 10) {
          issues.push('الآيبان غير مكتمل');
        }
        if (!m.phone) {
          issues.push('الجوال غير مسجل');
        }
        if (!m.permissions?.canCreateContract) {
          details.push('إنشاء العقود: غير مسموح');
        }
        if (!m.permissions?.canEditPrices) {
          details.push('تعديل الأسعار: للإدارة فقط');
        }
      }
    } else if (role === 'guard') {
      const g = guardsList.find((item) => item.id === targetId) || guard;
      if (!g) {
        issues.push('سجل الحارس غير موجود');
      } else {
        details.push(`الحارس: ${g.name}`);
        details.push(`العقار: ${g.assignedPropertyName || 'غير محدد'}`);
        if (!g.phone) {
          issues.push('جوال الحارس مفقود');
        }
        if (!g.assignedPropertyId) {
          issues.push('الحارس غير مربوط بعقار');
        }
        const gTasks = guardTasks.filter((t) => t.guardId === g.id || !t.guardId);
        const morningTasks = gTasks.filter((t) => t.shift === 'morning');
        const eveningTasks = gTasks.filter((t) => t.shift === 'evening');
        const pendingCount = gTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
        details.push(`المهمات: ${gTasks.length} (${morningTasks.length} صباحي، ${eveningTasks.length} مسائي)`);
        if (pendingCount > 0) {
          details.push(`بانتظار الإنجاز: ${pendingCount}`);
        } else {
          details.push('كل المهمات مكتملة');
        }
      }
    } else {
      details.push('حساب الإدارة: كل الصلاحيات');
    }

    if (syncStatus === 'error' || syncStatus === 'offline') {
      issues.push(`Firebase: ${syncMessage || 'غير متصل'}`);
    } else {
      details.push('Firebase: متصل ويزامن لحظياً');
    }

    if (!isSoundEnabled) {
      issues.push('الصوت معطّل');
    } else {
      details.push('صوت التنبيه: مفعّل');
    }

    return {
      hasErrors: issues.length > 0,
      issues,
      details,
    };
  }, [simulation, userRole, currentMarketerId, guard, marketers, currentMarketer, guardsList, syncStatus, syncMessage, isSoundEnabled]);

  const updateGuardProfile = useCallback(
    (data: Partial<Guard>, guardId?: string) => {
      if (!isAdmin && !canViewMore) return;
      const targetId = guardId || data.id || guard.id;
      const targetGuard = guardsList.find((g) => g.id === targetId) || guard;

      // Update current active guard if matches
      setGuard((prev) => {
        if (prev.id === targetId) {
          const next = { ...prev, ...data };
          StorageService.set(STORAGE_KEYS.GUARD, next);
          return next;
        }
        return prev;
      });

      // Update in guardsList
      const nextGuards = guardsListRef.current.map((g) => (g.id === targetId ? { ...g, ...data } : g));
      guardsListRef.current = nextGuards;
      setGuardsList(nextGuards);
      StorageService.set(STORAGE_KEYS.GUARDS_LIST, nextGuards);

      // Sync assigned guard details on properties if name or phone changed
      if (data.name !== undefined || data.phone !== undefined) {
        setProperties((prev) => {
          const next = prev.map((p) =>
            p.assignedGuardId === targetId
              ? {
                  ...p,
                  assignedGuardName: data.name ?? p.assignedGuardName,
                  assignedGuardPhone: data.phone ?? p.assignedGuardPhone,
                }
              : p
          );
          StorageService.set(STORAGE_KEYS.PROPERTIES, next);
          return next;
        });
      }

      // Sync or create UserAccount for this guard so Google login works immediately in Firebase
      const prevEmail = (targetGuard?.email || '').trim().toLowerCase();
      const nextEmailNorm = data.email ? data.email.trim().toLowerCase() : prevEmail;
      let matchedAny = false;
      let nextAccounts = userAccountsRef.current.map((acc) => {
        if (
          acc.id === targetId ||
          acc.guardId === targetId ||
          (prevEmail && acc.email.trim().toLowerCase() === prevEmail)
        ) {
          matchedAny = true;
          return {
            ...acc,
            name: data.name ?? acc.name,
            email: nextEmailNorm || acc.email,
            phone: data.phone ?? acc.phone,
            updatedAt: new Date().toISOString(),
          };
        }
        return acc;
      });
      if (!matchedAny && nextEmailNorm && nextEmailNorm.includes('@')) {
        const newAcc: UserAccount = {
          id: targetId,
          role: 'guard',
          guardId: targetId,
          name: data.name || targetGuard.name,
          email: nextEmailNorm,
          password: targetGuard.password || 'guard',
          phone: data.phone ?? targetGuard.phone,
          avatar: data.avatar ?? targetGuard.avatar,
          createdAt: new Date().toISOString(),
        };
        if (!nextAccounts.some((a) => a.email.trim().toLowerCase() === nextEmailNorm)) {
          nextAccounts = [...nextAccounts, newAcc];
          pendingProtectedAccountEmailsRef.current.set(nextEmailNorm, newAcc);
        }
      } else if (nextEmailNorm) {
        const syncedAcc = nextAccounts.find((a) => a.email.trim().toLowerCase() === nextEmailNorm);
        if (syncedAcc) pendingProtectedAccountEmailsRef.current.set(nextEmailNorm, syncedAcc);
      }
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ guardsList: nextGuards, userAccounts: nextAccounts });
      if (data.email !== undefined) {
        void propagateAccessInBackground(nextAccounts);
      }

      logActivity('الإدارة', 'admin', 'تحديث بيانات الحارس والوحدات', `تم تحديث ملف وبيانات الحارس ${data.name || targetGuard.name}`);
      triggerBrowserNotification('🛡️ تحديث بيانات الحارس', `تم حفظ وتحديث بيانات الحارس (${data.name || targetGuard.name}) بنجاح`, 'system');
    },
    [isAdmin, canViewMore, guard, guardsList, logActivity, triggerBrowserNotification, pushSliceNow, propagateAccessInBackground]
  );

  const addGuard = useCallback(
    (guardData: Omit<Guard, 'id'>): Guard => {
      const generatedId = `g${Date.now()}`;
      const emailNorm = (guardData.email || `guard_${generatedId}@amasa.app`).trim().toLowerCase();
      const newGuard: Guard = {
        ...guardData,
        email: emailNorm,
        id: generatedId,
        permissions: guardData.permissions || {
          canViewCalendar: false,
          canViewCustomerContacts: true,
          canConfirmArrival: true,
          canReceiveInsurance: true,
          canInspectUnit: true,
          canRefundInsurance: true,
          canViewDashboard: true,
          canViewGuardTasks: true,
          canViewBookings: false,
          canViewProperties: false,
          canViewMarketers: false,
          canViewMore: false,
          canBlockDates: false,
        },
      };

      const nextGuards = [...guardsListRef.current, newGuard];
      guardsListRef.current = nextGuards;
      setGuardsList(nextGuards);
      StorageService.set(STORAGE_KEYS.GUARDS_LIST, nextGuards);

      // Also create a UserAccount so this guard can log in
      const newAccount: UserAccount = {
        id: generatedId,
        role: 'guard',
        guardId: generatedId,
        name: newGuard.name,
        email: emailNorm,
        password: newGuard.password || 'guard',
        phone: newGuard.phone,
        avatar: newGuard.avatar,
        createdAt: new Date().toISOString(),
      };

      const nextAccounts = userAccountsRef.current.some((a) => a.email.trim().toLowerCase() === emailNorm)
        ? userAccountsRef.current
        : [...userAccountsRef.current, newAccount];
      pendingProtectedAccountEmailsRef.current.set(emailNorm, newAccount);
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ guardsList: nextGuards, userAccounts: nextAccounts });
      void propagateAccessInBackground(nextAccounts);

      const assignedText = newGuard.assignedPropertyNames?.length
        ? newGuard.assignedPropertyNames.join('، ')
        : newGuard.assignedPropertyName || 'غير محدد';

      logActivity(
        'الإدارة',
        'admin',
        'إضافة حارس ميداني جديد',
        `تم تسجيل الحارس ${newGuard.name} (${newGuard.jobTitle || 'مشرف'}) وتعيينه على: ${assignedText}`
      );

      triggerBrowserNotification(
        '🛡️ إضافة حارس جديد',
        `تمت إضافة الحارس (${newGuard.name}) بنجاح وربطه بالاستراحات: ${assignedText}.`,
        'system'
      );

      return newGuard;
    },
    [logActivity, triggerBrowserNotification, pushSliceNow, propagateAccessInBackground]
  );

  const deleteGuard = useCallback(
    (guardId: string) => {
      const target = guardsListRef.current.find((g) => g.id === guardId);
      if (!target) return { success: false, message: 'الحارس غير موجود' };
      if (guardsListRef.current.length <= 1) {
        return { success: false, message: 'لا يمكن حذف الحارس الوحيد المتبقي في النظام' };
      }

      const remainingGuards = guardsListRef.current.filter((g) => g.id !== guardId);
      guardsListRef.current = remainingGuards;
      setGuardsList(remainingGuards);
      StorageService.set(STORAGE_KEYS.GUARDS_LIST, remainingGuards);

      const targetEmail = (target.email || '').trim().toLowerCase();
      recentlyDeletedAccountIdsRef.current.add(guardId);
      if (targetEmail) pendingProtectedAccountEmailsRef.current.delete(targetEmail);
      const nextAccounts = userAccountsRef.current.filter((acc) => {
        if (acc.email.trim().toLowerCase() === 'sakt2008@gmail.com') return true;
        const remove =
          acc.id === guardId ||
          acc.guardId === guardId ||
          (targetEmail && acc.email.trim().toLowerCase() === targetEmail);
        if (remove) recentlyDeletedAccountIdsRef.current.add(acc.id);
        return !remove;
      });
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      lastSyncedJsonRef.current.guardsList = JSON.stringify(remainingGuards);
      lastSyncedJsonRef.current.userAccounts = JSON.stringify(nextAccounts);
      localWriteEpochRef.current += 1;
      void deleteCollectionDocFromFirestore('staffMembers', `gd_${guardId}`, firestoreSyncStateRef.current);
      if (targetEmail) {
        void deleteAuthorizedUserFromFirestore(targetEmail, firestoreSyncStateRef.current);
      }

      // Clear deleted guard assignments from properties
      setProperties((prev) => {
        const next = prev.map((p) =>
          p.assignedGuardId === guardId
            ? {
                ...p,
                assignedGuardId: undefined,
                assignedGuardName: undefined,
                assignedGuardPhone: undefined,
                assignedGuardNotes: undefined,
              }
            : p
        );
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      if (guard.id === guardId && remainingGuards.length > 0) {
        setGuard(remainingGuards[0]);
        StorageService.set(STORAGE_KEYS.GUARD, remainingGuards[0]);
      }

      logActivity('الإدارة', 'admin', 'حذف حارس', `تم حذف ملف الحارس ${target.name} من النظام`);
      triggerBrowserNotification('🛡️ حذف حارس', `تم حذف الحارس (${target.name}) بنجاح`, 'system');
      return { success: true, message: `تم حذف الحارس (${target.name}) بنجاح` };
    },
    [guardsList, guard.id, logActivity, triggerBrowserNotification]
  );

  const DEFAULT_GUARD_PERMS: GuardPermissions = {
    canViewCalendar: false,
    canViewCustomerContacts: true,
    canConfirmArrival: true,
    canReceiveInsurance: true,
    canInspectUnit: true,
    canRefundInsurance: true,
    canViewDashboard: true,
    canViewGuardTasks: true,
    canViewBookings: false,
    canViewProperties: false,
    canViewMarketers: false,
    canViewMore: false,
    canBlockDates: false,
  };

  const updateGuardPermissions = useCallback(
    (perms: Partial<GuardPermissions>, guardId?: string) => {
      if (!isAdmin && !canViewMore) return;
      const targetId = guardId || guard.id;
      const targetName = guardsList.find((g) => g.id === targetId)?.name || guard.name;

      setGuardsList((prev) => {
        const next = prev.map((g) => {
          if (g.id !== targetId) return g;
          const base: GuardPermissions = { ...DEFAULT_GUARD_PERMS, ...(g.permissions || {}) };
          return { ...g, permissions: { ...base, ...perms } };
        });
        StorageService.set(STORAGE_KEYS.GUARDS_LIST, next);
        return next;
      });

      setGuard((prev) => {
        if (prev.id !== targetId) return prev;
        const base: GuardPermissions = { ...DEFAULT_GUARD_PERMS, ...(prev.permissions || {}) };
        const next = { ...prev, permissions: { ...base, ...perms } };
        StorageService.set(STORAGE_KEYS.GUARD, next);
        return next;
      });

      logActivity(
        'الإدارة',
        'admin',
        'تعديل مصفوفة صلاحيات الحارس',
        `تم تحديث صلاحيات الحارس الميداني ${targetName}`
      );
    },
    [isAdmin, canViewMore, guard.id, guard.name, guardsList, logActivity]
  );

  const toggleGuardPermission = useCallback(
    (key: keyof GuardPermissions, guardId?: string) => {
      if (!isAdmin && !canViewMore) return;
      const targetId = guardId || guard.id;
      const targetGuard = guardsList.find((g) => g.id === targetId) || guard;
      const base: GuardPermissions = { ...DEFAULT_GUARD_PERMS, ...(targetGuard.permissions || {}) };
      const currentVal = Boolean(base[key]);
      const nextVal = !currentVal;

      setGuardsList((prev) => {
        const next = prev.map((g) => {
          if (g.id !== targetId) return g;
          const gBase: GuardPermissions = { ...DEFAULT_GUARD_PERMS, ...(g.permissions || {}) };
          return { ...g, permissions: { ...gBase, [key]: nextVal } };
        });
        StorageService.set(STORAGE_KEYS.GUARDS_LIST, next);
        return next;
      });

      setGuard((prev) => {
        if (prev.id !== targetId) return prev;
        const pBase: GuardPermissions = { ...DEFAULT_GUARD_PERMS, ...(prev.permissions || {}) };
        const next = { ...prev, permissions: { ...pBase, [key]: nextVal } };
        StorageService.set(STORAGE_KEYS.GUARD, next);
        return next;
      });

      logActivity(
        'الإدارة',
        'admin',
        'تعديل صلاحية الحارس',
        `تم تبديل صلاحية (${key}) للحارس ${targetGuard.name}`
      );
    },
    [isAdmin, canViewMore, guard, guardsList, logActivity]
  );

  const loginWithGmailAndPassword = useCallback(
    (email: string, pass: string) => {
      const target = email.trim().toLowerCase();
      const account = userAccounts.find((u) => u.email.trim().toLowerCase() === target);
      if (!account) {
        return {
          success: false,
          message: 'البريد الإلكتروني غير مسجل في النظام. تأكد من إدخال بريد Gmail الصحيح.',
        };
      }
      if (account.password && account.password !== pass) {
        return {
          success: false,
          message: 'كلمة المرور غير صحيحة. يمكنك إنشاء كلمة سر جديدة أو استعادتها.',
        };
      }
      setUserRole(account.role);
      if (account.marketerId) {
        setCurrentMarketerId(account.marketerId);
      } else if (account.role === 'coordinator') {
        const matchedCoord = coordinators.find(
          (c) => c.id === account.coordinatorId || c.id === account.id || (c.email && c.email.toLowerCase() === target)
        );
        if (matchedCoord) setCurrentCoordinatorId(matchedCoord.id);
      } else if (account.role === 'guard') {
        const matchedGuard = guardsList.find(
          (g) => g.id === account.guardId || g.id === account.id || (g.email && g.email.toLowerCase() === target)
        );
        if (matchedGuard) setGuard(matchedGuard);
      }
      setIsAuthenticated(true);
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH, '1');
      } catch {}
      logActivity(
        account.name,
        account.role,
        'تسجيل الدخول عبر Gmail',
        `تم تسجيل الدخول بنجاح عبر بريد Gmail (${account.email}) بصلاحية: ${
          account.role === 'admin' ? 'الإدارة' : account.role === 'guard' ? 'الحارس' : account.role === 'coordinator' ? 'منسقة' : 'مسوق'
        }`
      );
      triggerBrowserNotification(
        '👋 مرحباً بك في AMASA RESORT',
        `تم تسجيل الدخول بنجاح بحساب (${account.name})`,
        'system'
      );
      return {
        success: true,
        message: `مرحباً بك ${account.name}، تم تسجيل الدخول بنجاح!`,
      };
    },
    [userAccounts, coordinators, guardsList, logActivity, triggerBrowserNotification]
  );

  const updateUserAccount = useCallback(
    (accountId: string, data: Partial<UserAccount>) => {
      const nextAccounts = userAccountsRef.current.map((acc) =>
        acc.id === accountId ? { ...acc, ...data, updatedAt: new Date().toISOString() } : acc
      );
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ userAccounts: nextAccounts });
      if (data.email !== undefined || data.role !== undefined) {
        void propagateAccessInBackground(nextAccounts);
      }
    },
    [pushSliceNow, propagateAccessInBackground]
  );

  const loginWithGoogleAuth = useCallback(
    async (email: string, displayName?: string, photoURL?: string) => {
      const emailNorm = email.trim().toLowerCase();

      // 1. Validate Google-authenticated email format
      if (!emailNorm || !emailNorm.includes('@')) {
        return {
          success: false,
          message: 'يرجى تقديم عنوان بريد إلكتروني صحيح لحساب Google.',
        };
      }

      let account = userAccountsRef.current.find((a) => a.email.trim().toLowerCase() === emailNorm);

      // Always verify non-owner accounts directly against live Firestore server before authorizing
      if (emailNorm !== 'sakt2008@gmail.com') {
        const lookup = await fetchAuthorizedUserStatusFromFirestore(emailNorm);
        if (lookup.status === 'found' && lookup.account) {
          account = lookup.account;
          const merged = [
            ...userAccountsRef.current.filter((a) => a.email.trim().toLowerCase() !== emailNorm),
            lookup.account,
          ];
          userAccountsRef.current = merged;
          setUserAccounts(merged);
          StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, merged);
        } else if (lookup.status === 'not_found' && !pendingProtectedAccountEmailsRef.current.has(emailNorm)) {
          // Server confirmed account is not authorized: purge any stale local entry instead of logging in and kicking out
          if (account) {
            const pruned = userAccountsRef.current.filter((a) => a.email.trim().toLowerCase() !== emailNorm);
            userAccountsRef.current = pruned;
            setUserAccounts(pruned);
            StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, pruned);
            account = undefined;
          }
        }
      }

      // Primary owner sakt2008@gmail.com is permanently authorized as admin
      if (!account && emailNorm === 'sakt2008@gmail.com') {
        account = {
          id: 'admin-owner',
          role: 'admin',
          name: displayName || 'المالك (الإدارة العامة)',
          email: 'sakt2008@gmail.com',
          avatar: photoURL,
        };
        const nextAccounts = [account!, ...userAccountsRef.current.filter((a) => a.email.toLowerCase() !== 'sakt2008@gmail.com')];
        userAccountsRef.current = nextAccounts;
        setUserAccounts(nextAccounts);
        StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
        void pushSliceNow({ userAccounts: nextAccounts });
        void propagateAccessInBackground(nextAccounts);
      }

      if (!account) {
        return {
          success: false,
          message: `عذراً، حساب Google (${email}) غير مضاف في قائمة المصرح لهم بالدخول. يرجى مراجعة إدارة AMASA RESORT لإضافتك أولاً.`,
        };
      }

      // Clear any previous simulation state and bind exact active role & staff profile
      setSimulation({
        isSimulating: false,
        role: account.role,
        targetName: account.role === 'admin' ? 'الإدارة (المدير العام)' : account.name,
      });
      setUserRole(account.role);

      if (account.role === 'marketer') {
        const matchedM = marketersRef.current.find(
          (m) =>
            m.id === account!.marketerId ||
            m.id === account!.id ||
            (m.email && m.email.trim().toLowerCase() === emailNorm)
        );
        setCurrentMarketerId(account.marketerId || matchedM?.id || account.id);
        setCurrentCoordinatorId('');
      } else if (account.role === 'coordinator') {
        const matchedCoord = coordinatorsRef.current.find(
          (c) =>
            c.id === account!.coordinatorId ||
            c.id === account!.id ||
            (c.email && c.email.trim().toLowerCase() === emailNorm)
        );
        setCurrentCoordinatorId(account.coordinatorId || matchedCoord?.id || account.id);
        setCurrentMarketerId('');
      } else if (account.role === 'guard') {
        const matchedGuard = guardsListRef.current.find(
          (g) =>
            g.id === account!.guardId ||
            g.id === account!.id ||
            (g.email && g.email.trim().toLowerCase() === emailNorm)
        );
        if (matchedGuard) setGuard(matchedGuard);
        setCurrentMarketerId('');
        setCurrentCoordinatorId('');
      } else {
        setCurrentMarketerId('');
        setCurrentCoordinatorId('');
      }

      if (photoURL && !account.avatar && isCurrentUserAdmin([account])) {
        updateUserAccount(account.id, { avatar: photoURL });
      }
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH, '1');
        localStorage.setItem('amasa_active_email', account.email);
      } catch {}
      setIsAuthModalOpen(false);
      if (isAuthenticatedRef.current) {
        // Switching accounts while already inside the app: re-run sync effect cleanly without locking the screen if UID stayed the same
        setAuthSessionEpoch((prev) => prev + 1);
      } else {
        if (!isDemoMode) {
          setIsInitialHydrating(true);
        }
        setIsAuthenticated(true);
      }

      const roleAr =
        account.role === 'admin'
          ? 'الإدارة'
          : account.role === 'guard'
          ? 'الحارس'
          : account.role === 'coordinator'
          ? 'المنسقة'
          : 'المسوقة';

      logActivity(
        account.name,
        account.role,
        'تسجيل الدخول عبر Google',
        `تم تسجيل الدخول بنجاح عبر حساب Google المعتمد (${account.email}) بصلاحية: ${roleAr}`
      );

      triggerBrowserNotification(
        '👋 مرحباً بك في AMASA RESORT',
        `تم تسجيل الدخول بنجاح عبر حساب Google (${account.name})`,
        'system'
      );

      return {
        success: true,
        message: `مرحباً بك ${account.name}، تم التحقق من حساب Google وتسجيل الدخول بنجاح!`,
        account,
      };
    },
    [isDemoMode, logActivity, triggerBrowserNotification, updateUserAccount, pushSliceNow, propagateAccessInBackground]
  );

  const changePassword = useCallback(
    (accountId: string, newPass: string) => {
      if (!newPass || newPass.trim().length < 2) {
        return { success: false, message: 'يرجى كتابة كلمة مرور صالحة (مكونة من خانتين على الأقل).' };
      }
      let accName = '';
      const emailLower = accountId.trim().toLowerCase();

      const nextAccounts = userAccountsRef.current.map((acc) => {
        if (acc.id === accountId || acc.email.trim().toLowerCase() === emailLower) {
          accName = acc.name;
          return { ...acc, password: newPass, updatedAt: new Date().toISOString() };
        }
        return acc;
      });
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);

      const nextMarketers = marketersRef.current.map((m) =>
        m.id === accountId || m.email.trim().toLowerCase() === emailLower
          ? { ...m, password: newPass }
          : m
      );
      marketersRef.current = nextMarketers;
      setMarketers(nextMarketers);
      StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);

      if (guard.id === accountId || guard.email.trim().toLowerCase() === emailLower) {
        setGuard((prev) => ({ ...prev, password: newPass }));
      }
      void pushSliceNow({ userAccounts: nextAccounts, marketers: nextMarketers });

      logActivity(accName || 'المستخدم', userRole, 'تحديث كلمة المرور', `تم تعيين كلمة مرور جديدة ومخصصة للحساب: ${accName || emailLower}`);
      triggerBrowserNotification('🔑 تحديث كلمة المرور', `تم حفظ وتعيين كلمة المرور الجديدة للحساب (${accName || emailLower}) بنجاح!`, 'system');
      return { success: true, message: `تم تحديث كلمة المرور للحساب ${accName || emailLower} بنجاح!` };
    },
    [guard.id, guard.email, userRole, logActivity, triggerBrowserNotification, pushSliceNow]
  );

  const logout = useCallback(async () => {
    if (isPersonalDemoMode()) {
      exitPersonalDemoMode();
      return;
    }
    try {
      await googleLogout();
    } catch {}
    hasCompletedInitialSyncRef.current = false;
    activeAuthUidRef.current = null;
    firestoreSyncStateRef.current = createFirestoreSyncState();
    pendingProtectedAccountEmailsRef.current.clear();
    setIsInitialHydrating(false);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTH, '0');
      localStorage.removeItem('amasa_google_user');
      localStorage.removeItem('amasa_google_token');
      localStorage.removeItem('amasa_active_email');
      localStorage.removeItem('amasa_simulation_state');
    } catch {}
    setSimulation({
      isSimulating: false,
      role: 'admin',
      targetName: 'الإدارة (المدير العام)',
    });
    setCurrentMarketerId('');
    setCurrentCoordinatorId('');
    setIsAuthenticated(false);
    setUserRole('admin');
    setIsAuthModalOpen(false);
    logActivity('المستخدم', 'admin', 'تسجيل الخروج', 'تم تسجيل الخروج الرسمي وإقفال الجلسة بنجاح');
  }, [logActivity]);

  const openAuthModal = useCallback((mode: AuthModalMode = 'quick_select') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const grantAllMarketersContractAndDepositPermissions = useCallback(() => {
    setMarketers((prev) =>
      prev.map((m) => ({
        ...m,
        permissions: {
          ...m.permissions,
          canCreateContract: true,
          canEditDeposit: true,
        },
      }))
    );
    logActivity(
      'الإدارة',
      'admin',
      'تفعيل صلاحيات العقود والعربون',
      'تم منح وتفعيل صلاحيات إنشاء العقد وتعديل العربون لجميع الموظفين والمسوقين'
    );
    triggerBrowserNotification(
      '📜 صلاحيات الموظفين المحدثة',
      'تم منح وتفعيل صلاحيات إنشاء العقود وتعديل العربون لجميع الموظفين بنجاح',
      'permission'
    );
  }, [logActivity, triggerBrowserNotification]);

  const updateWaitingDepositAmount = useCallback(
    (propertyId: string, dates: string[], amount: number, sectionId?: string) => {
      setDateOverrides((prev) => {
        const next = { ...prev };
        dates.forEach((d) => {
          const keys = [
            `${propertyId}_${d}`,
            ...(sectionId && sectionId !== 'all' ? [`${propertyId}_${sectionId}_${d}`] : []),
          ];
          keys.forEach((k) => {
            if (next[k]) {
              next[k] = { ...next[k], waitingDepositAmount: amount };
            }
          });
        });
        return next;
      });

      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'موظف',
        userRole,
        'تعديل مبلغ العربون قبل التأكيد',
        `تم تعديل مبلغ العربون المطلوب إلى ${amount} ريال للتواريخ المعلقة (${dates.join(', ')})`
      );

      triggerBrowserNotification(
        '✏️ تم تعديل مبلغ العربون',
        `تم تحديث مبلغ العربون إلى ${amount} ريال قبل تأكيد الحجز`,
        'deposit_request'
      );
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const updateProperty = useCallback(
    (id: string, data: Partial<Property>) => {
      const targetName = data.name || properties.find((p) => p.id === id)?.name || id;
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== id) return p;
          const updatedSeasonal = data.seasonalPricing
            ? data.seasonalPricing
            : data.basePriceWeekday !== undefined || data.basePriceWeekend !== undefined
            ? {
                ...p.seasonalPricing,
                weekday: data.basePriceWeekday ?? p.seasonalPricing.weekday,
                weekend: data.basePriceWeekend ?? p.seasonalPricing.weekend,
              }
            : p.seasonalPricing;
          return {
            ...p,
            ...data,
            seasonalPricing: updatedSeasonal,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تحديث بيانات عقار',
        `تم تحديث تفاصيل العقار: ${targetName}`
      );
      if (isAdmin) {
        setNotifications((prev) => [
          {
            id: `notif-prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: `🏰 تحديث بيانات العقار - ${targetName}`,
            description: `قامت الإدارة بتحديث بيانات أو أسعار العقار (${targetName}).`,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'all',
            propertyId: id,
          },
          ...prev,
        ]);
      }
      triggerBrowserNotification('🏰 تحديث بيانات العقار', `تم حفظ التعديلات على العقار (${targetName}) بنجاح`, 'system');
    },
    [isAdmin, currentMarketer?.name, userRole, properties, logActivity, triggerBrowserNotification]
  );

  const addProperty = useCallback(
    (propertyData: Partial<Property> & { name: string; basePriceWeekday: number }): Property => {
      const generatedId = propertyData.id || `prop-${Date.now()}`;
      const randomCodeNum = Math.floor(10000 + Math.random() * 90000);
      const generatedCode = propertyData.code || `#${randomCodeNum}`;
      const weekdayPrice = Number(propertyData.basePriceWeekday) || 1000;
      const weekendPrice = Number(propertyData.basePriceWeekend) || Math.round(weekdayPrice * 1.35) || 1350;

      const resolvedVideoItems =
        propertyData.videoItems && propertyData.videoItems.length > 0
          ? propertyData.videoItems
          : undefined;
      const resolvedVideoUrls =
        propertyData.videoUrls && propertyData.videoUrls.length > 0
          ? propertyData.videoUrls
          : resolvedVideoItems
          ? resolvedVideoItems.map((v) => v.url).filter(Boolean)
          : [];

      const newProp: Property = {
        id: generatedId,
        name: propertyData.name.trim(),
        code: generatedCode,
        subUnitsCount: propertyData.subUnitsCount || (propertyData.sections && propertyData.sections.length > 0 ? propertyData.sections.length : 1),
        subtitle: propertyData.subtitle || `شاليه واستراحة ${propertyData.name.trim()} الراقية`,
        location: propertyData.location || 'الرياض',
        address: propertyData.address,
        googleMapsUrl: propertyData.googleMapsUrl,
        coordinates: propertyData.coordinates || { lat: 24.7136, lng: 46.6753 },
        isPublished: propertyData.isPublished !== undefined ? propertyData.isPublished : true,
        basePriceWeekday: weekdayPrice,
        basePriceWeekend: weekendPrice,
        seasonalPricing: propertyData.seasonalPricing || {
          weekday: weekdayPrice,
          weekend: weekendPrice,
          summer: Math.round(weekdayPrice * 1.1) || 1100,
          eid: Math.round(weekdayPrice * 1.8) || 1800,
          vacation: Math.round(weekdayPrice * 1.3) || 1300,
        },
        administrativeFees: propertyData.administrativeFees || {
          weekday: 50,
          weekend: 100,
          summer: 100,
          eid: 200,
          vacation: 150,
        },
        hasSections:
          propertyData.hasSections !== undefined
            ? propertyData.hasSections
            : Boolean(propertyData.sections && propertyData.sections.length > 0),
        hasBreakfast: propertyData.hasBreakfast ?? false,
        hasCoordinatorServices: propertyData.hasCoordinatorServices ?? false,
        sections: propertyData.sections && propertyData.sections.length > 0 ? propertyData.sections : undefined,
        capacity: Number(propertyData.capacity) || 20,
        bedrooms: Number(propertyData.bedrooms) || 2,
        bathrooms: Number(propertyData.bathrooms) || 2,
        areaM2: Number(propertyData.areaM2) || 450,
        poolType: propertyData.poolType || 'مسبح خارجي متطور مع شلال مائي',
        coverImage: propertyData.coverImage || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
        images: propertyData.images && propertyData.images.length > 0 ? propertyData.images : [
          propertyData.coverImage || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        ],
        videoUrls: resolvedVideoUrls,
        videoItems: resolvedVideoItems,
        driveUrl: propertyData.driveUrl,
        features: propertyData.features && propertyData.features.length > 0 ? propertyData.features : [
          'مجلس ضيافة ملكي فخم مجهز بالكامل',
          'مسبح خاص مع جلسات خارجية ومسطحات خضراء',
          'ركن شواء ومطبخ مجهز بكافة الاحتياجات',
          'أجواء استجمام هادئة وخصوصية تامة للعائلة',
        ],
        contractTerms: propertyData.contractTerms && propertyData.contractTerms.length > 0 ? propertyData.contractTerms : [
          'يلتزم المستأجر بتسليم الاستراحة في الوقت المحدد للخروج.',
          'يُعاد مبلغ التأمين كاملاً عند التسليم سليمة خالية من أي أضرار.',
          'يتحمل المستأجر تكاليف أي أضرار تلحق بالاستراحة.',
          'العربون المدفوع غير قابل للاسترداد في حال إلغاء الحجز.',
        ],
        iban: propertyData.iban || 'SA0380000201608010111122',
        bankName: propertyData.bankName || 'مصرف الراجحي',
        accountHolder: propertyData.accountHolder || propertyData.name,
        defaultDeposit: Number(propertyData.defaultDeposit) || 300,
        insuranceAmount: Number(propertyData.insuranceAmount) || 500,
        checkInTimeText: propertyData.checkInTimeText || 'الساعة ٥ م',
        checkOutTimeText: propertyData.checkOutTimeText || 'الساعة ٢ م',
        defaultBreakfastPrice: propertyData.defaultBreakfastPrice || 150,
        breakfastPricing: propertyData.breakfastPricing,
        assignedGuardId: propertyData.assignedGuardId,
        assignedGuardName: propertyData.assignedGuardName,
        assignedGuardPhone: propertyData.assignedGuardPhone,
        assignedGuardNotes: propertyData.assignedGuardNotes,
        isMergedProperty: propertyData.isMergedProperty,
        mergedConfig: propertyData.mergedConfig,
        mergedPropertyIds: propertyData.mergedPropertyIds,
      };

      setProperties((prev) => {
        const next = [...prev, newProp];
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      logActivity(
        'الإدارة العامة',
        'admin',
        'إضافة عقار جديد',
        `تمت إضافة وتفعيل عقار جديد بنجاح: ${newProp.name} (${newProp.code})`
      );

      setNotifications((prev) => [
        {
          id: `notif-newprop-${Date.now()}`,
          title: `🏰 إضافة عقار جديد - ${newProp.name}`,
          description: `تمت إضافة عقار ${newProp.name} إلى منظومة AMASA RESORT وتفعيله في التقويم والحجوزات.`,
          timestamp: 'الآن',
          read: false,
          type: 'system',
          targetAudience: 'all',
          propertyId: newProp.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        '🏰 إضافة عقار جديد',
        `تمت إضافة عقار ${newProp.name} بنجاح إلى منظومة AMASA RESORT وتفعيله في التقويم والحجوزات.`,
        'booking'
      );

      return newProp;
    },
    [logActivity, triggerBrowserNotification]
  );

  const deleteProperty = useCallback(
    (propertyId: string) => {
      const target = properties.find((p) => p.id === propertyId);
      if (!target) {
        return { success: false, message: 'العقار غير موجود في النظام' };
      }
      if (properties.length <= 1) {
        return { success: false, message: 'لا يمكن حذف العقار الوحيد المتبقي في النظام' };
      }

      const nextProperties = properties
        .filter((p) => p.id !== propertyId)
        .map((p) => {
          if (!p.isMergedProperty) return p;
          const filteredIds = p.mergedPropertyIds?.filter((id) => id !== propertyId);
          const filteredLinkedIds = p.mergedConfig?.linkedPropertyIds?.filter((id) => id !== propertyId);
          const filteredLinkedNames = p.mergedConfig?.linkedPropertyNames?.filter((name) => name !== target.name);
          return {
            ...p,
            mergedPropertyIds: filteredIds,
            mergedConfig: p.mergedConfig
              ? {
                  ...p.mergedConfig,
                  linkedPropertyIds: filteredLinkedIds,
                  linkedPropertyNames: filteredLinkedNames,
                }
              : undefined,
          };
        });

      setProperties(nextProperties);
      StorageService.set(STORAGE_KEYS.PROPERTIES, nextProperties);
      void deleteCollectionDocFromFirestore('properties', propertyId, firestoreSyncStateRef.current);

      if (selectedPropertyId === propertyId && nextProperties.length > 0) {
        setSelectedPropertyId(nextProperties[0].id);
      }

      // Clean up guard property assignments referencing the deleted property
      setGuardsList((prev) => {
        const nextGuards = prev.map((g) => {
          const nextIds = (g.assignedPropertyIds || (g.assignedPropertyId ? [g.assignedPropertyId] : [])).filter(
            (id) => id !== propertyId
          );
          const nextNames = nextProperties.filter((p) => nextIds.includes(p.id)).map((p) => p.name);
          return {
            ...g,
            assignedPropertyIds: nextIds,
            assignedPropertyNames: nextNames,
            assignedPropertyId: nextIds[0] || undefined,
            assignedPropertyName: nextNames[0] || undefined,
          };
        });
        StorageService.set(STORAGE_KEYS.GUARDS_LIST, nextGuards);
        return nextGuards;
      });

      setGuard((prev) => {
        const nextIds = (prev.assignedPropertyIds || (prev.assignedPropertyId ? [prev.assignedPropertyId] : [])).filter(
          (id) => id !== propertyId
        );
        const nextNames = nextProperties.filter((p) => nextIds.includes(p.id)).map((p) => p.name);
        const nextGuard = {
          ...prev,
          assignedPropertyIds: nextIds,
          assignedPropertyNames: nextNames,
          assignedPropertyId: nextIds[0] || undefined,
          assignedPropertyName: nextNames[0] || undefined,
        };
        StorageService.set(STORAGE_KEYS.GUARD, nextGuard);
        return nextGuard;
      });

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مسوق',
        userRole,
        'حذف عقار من النظام',
        `تم حذف العقار (${target.name} - ${target.code}) بنجاح`
      );
      triggerBrowserNotification('🏰 حذف عقار', `تم حذف العقار (${target.name}) بنجاح`, 'system');

      return { success: true, message: `تم حذف العقار (${target.name}) بنجاح` };
    },
    [properties, selectedPropertyId, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const updatePropertyGuard = useCallback(
    (propertyId: string, guardData: { guardId?: string; guardName: string; guardPhone: string; guardNotes?: string }) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) => {
        const next = prev.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                assignedGuardId: guardData.guardId || p.assignedGuardId,
                assignedGuardName: guardData.guardName,
                assignedGuardPhone: guardData.guardPhone,
                assignedGuardNotes: guardData.guardNotes,
              }
            : p
        );
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      // If current guard matches or is assigned to this property, sync active guard state
      setGuard((prev) => {
        if (prev.assignedPropertyId === propertyId || (guardData.guardId && prev.id === guardData.guardId)) {
          const nextGuard = {
            ...prev,
            name: guardData.guardName,
            phone: guardData.guardPhone,
            assignedPropertyId: propertyId,
            assignedPropertyName: propObj?.name || prev.assignedPropertyName,
          };
          StorageService.set(STORAGE_KEYS.GUARD, nextGuard);
          return nextGuard;
        }
        return prev;
      });

      // Also update in guardsList
      setGuardsList((prev) => {
        const nextGuards = prev.map((g) => {
          if (g.assignedPropertyId === propertyId || (guardData.guardId && g.id === guardData.guardId)) {
            return {
              ...g,
              name: guardData.guardName,
              phone: guardData.guardPhone,
              assignedPropertyId: propertyId,
              assignedPropertyName: propObj?.name || g.assignedPropertyName,
            };
          }
          return g;
        });
        StorageService.set(STORAGE_KEYS.GUARDS_LIST, nextGuards);
        return nextGuards;
      });

      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعيين حارس للعقار',
        `تم تعيين الحارس (${guardData.guardName} - جوال: ${guardData.guardPhone}) مسؤولاً عن عقار ${propObj?.name || propertyId} واستلام إشعاراته حصرياً`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updatePropertyPhotos = useCallback(
    (propertyId: string, photos: { coverImage?: string; images: string[] }) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const nextImages = photos.images.length > 0 ? photos.images : p.images;
          const nextCover = photos.coverImage || (nextImages.length > 0 ? nextImages[0] : p.coverImage);
          return {
            ...p,
            images: nextImages,
            coverImage: nextCover,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل صور العقار',
        `تم تحديث ألبوم صور عقار ${propObj?.name || propertyId} (إجمالي: ${photos.images.length} صورة)`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const deletePropertyPhoto = useCallback(
    (propertyId: string, photoUrl: string) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const filtered = p.images.filter((img) => (typeof img === 'string' ? img : img.url) !== photoUrl);
          const currentCoverUrl = typeof p.coverImage === 'string' ? p.coverImage : p.coverImage?.url;
          const nextCover = currentCoverUrl === photoUrl ? (filtered[0] || '') : p.coverImage;
          return {
            ...p,
            images: filtered,
            coverImage: nextCover,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'حذف صورة من العقار',
        `تم حذف صورة من ألبوم عقار ${propObj?.name || propertyId}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const addPropertyPhotos = useCallback(
    (propertyId: string, newPhotoUrls: string[]) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const combined = [...p.images, ...newPhotoUrls];
          return {
            ...p,
            images: combined,
            coverImage: p.coverImage || combined[0],
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'إضافة صور جديدة للعقار',
        `تمت إضافة ${newPhotoUrls.length} صورة جديدة لعقار ${propObj?.name || propertyId}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const setPropertyCoverPhoto = useCallback(
    (propertyId: string, photoUrl: string) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const hasPhoto = p.images.some((img) => (typeof img === 'string' ? img : img.url) === photoUrl);
          const images = hasPhoto ? p.images : [photoUrl, ...p.images];
          return {
            ...p,
            coverImage: photoUrl,
            images,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعيين غلاف العقار',
        `تم تعيين صورة رئيسية جديدة لعقار ${propObj?.name || propertyId}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const savePropertiesNow = useCallback(async (): Promise<SaveResult> => {
    const latest = propertiesRef.current;
    StorageService.set(STORAGE_KEYS.PROPERTIES, latest);
    const res = await pushSliceNow({ properties: latest });
    if (!res.ok) {
      return {
        ok: true,
        message: 'تم الحفظ محلياً بنجاح (سيتم المزامنة السحابية عند توفر اتصال مدير النظام)',
      };
    }
    return res;
  }, [pushSliceNow]);

  const addPropertyVideo = useCallback(
    (propertyId: string, videoUrl: string) => {
      const cleanUrl = videoUrl.trim();
      if (!cleanUrl) return;
      const propObj = propertiesRef.current.find((p) => p.id === propertyId);
      let updatedList: Property[] | null = null;
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const currentVideos = p.videoUrls || [];
          if (currentVideos.includes(cleanUrl)) return p;
          return {
            ...p,
            videoUrls: [...currentVideos, cleanUrl],
          };
        });
        propertiesRef.current = next;
        updatedList = next;
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      if (updatedList) {
        void pushSliceNow({ properties: updatedList });
      }
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'إضافة فيديو للعقار',
        `تمت إضافة فيديو جديد لعقار ${propObj?.name || propertyId}`
      );
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, pushSliceNow]
  );

  const deletePropertyVideo = useCallback(
    (propertyId: string, videoIndex: number) => {
      const propObj = propertiesRef.current.find((p) => p.id === propertyId);
      const removedUrl = propObj?.videoUrls?.[videoIndex];
      let updatedList: Property[] | null = null;
      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const currentVideos = p.videoUrls || [];
          const nextVideos = currentVideos.filter((_: string, idx: number) => idx !== videoIndex);
          return {
            ...p,
            videoUrls: nextVideos,
          };
        });
        propertiesRef.current = next;
        updatedList = next;
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      if (removedUrl && removedUrl.startsWith('idb://')) {
        void deleteMediaFromIndexedDB(removedUrl);
      }
      if (updatedList) {
        void pushSliceNow({ properties: updatedList });
      }
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'حذف فيديو من العقار',
        `تم حذف فيديو من عقار ${propObj?.name || propertyId}`
      );
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, pushSliceNow]
  );

  const switchGuardAssignedProperty = useCallback(
    (propertyId: string) => {
      const propObj = properties.find((p) => p.id === propertyId);
      if (!propObj) return;
      setGuard((prev) => ({
        ...prev,
        assignedPropertyId: propertyId,
        assignedPropertyName: propObj.name,
      }));
      logActivity(
        guard.name,
        'guard',
        'تغيير العقار المسؤول عنه الحارس',
        `قام الحارس ${guard.name} باختيار متابعة عقار ${propObj.name}`
      );
    },
    [properties, guard.name, logActivity]
  );

  const updatePropertySection = useCallback(
    (propertyId: string, sectionId: string, data: Partial<PropertySection>) => {
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== propertyId) return p;
          const nextSections = (p.sections || []).map((sec) =>
            sec.id === sectionId ? { ...sec, ...data } : sec
          );
          return { ...p, sections: nextSections };
        })
      );
      const propObj = properties.find((p) => p.id === propertyId);
      const secObj = propObj?.sections?.find((s) => s.id === sectionId);
      const secName = secObj?.name || (sectionId === 'hamran-alma' ? 'وحدة الما' : sectionId === 'hamran-naya' ? 'وحدة نايا' : 'القسم');
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تحديث معلومات وسعر القسم',
        `تم تحديث مواصفات وسعر ${secName} لعقار ${propObj?.name || 'العقار'} بنجاح`
      );
      if (isAdmin) {
        setNotifications((prev) => [
          {
            id: `notif-sec-${Date.now()}`,
            title: `💰 تحديث بيانات وسعر القسم - ${propObj?.name || 'العقار'}`,
            description: `تم تحديث مواصفات وأسعار (${secName}) في عقار ${propObj?.name || propertyId}.`,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'all',
            propertyId,
          },
          ...prev,
        ]);
      }
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, properties]
  );

  const duplicateProperty = useCallback(
    (propertyId: string): Property | null => {
      const orig = properties.find((p) => p.id === propertyId);
      if (!orig) return null;

      const clonedProp = clonePropertyAsDuplicate(orig);

      setProperties((prev) => {
        const next = [...prev, clonedProp];
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'نسخ وحدة / عقار',
        `تم نسخ الوحدة بنجاح: ${orig.name} إلى ${clonedProp.name} (${clonedProp.code})`
      );

      setNotifications((prev) => [
        {
          id: `notif-dup-prop-${Date.now()}`,
          title: `📋 تم نسخ الوحدة - ${clonedProp.name}`,
          description: `تم إنشاء نسخة طبق الأصل من عقار ${orig.name} باسم (${clonedProp.name}) مع كامل الأقسام والإعدادات.`,
          timestamp: 'الآن',
          read: false,
          type: 'system',
          targetAudience: 'all',
          propertyId: clonedProp.id,
        },
        ...prev,
      ]);

      return clonedProp;
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const duplicatePropertySection = useCallback(
    (propertyId: string, sectionId: string): PropertySection | null => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return null;
      const sec = prop.sections?.find((s) => s.id === sectionId);
      if (!sec) return null;

      const duplicatedSec = clonePropertySection(prop, sec);

      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const currentSections = p.sections || [];
          const updatedSections = [...currentSections, duplicatedSec];
          return {
            ...p,
            hasSections: true,
            sections: updatedSections,
            subUnitsCount: updatedSections.length,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'نسخ قسم داخل الوحدة',
        `تم نسخ القسم ${sec.name} إلى ${duplicatedSec.name} في عقار ${prop.name}`
      );

      setNotifications((prev) => [
        {
          id: `notif-dup-sec-${Date.now()}`,
          title: `📑 تم نسخ قسم - ${duplicatedSec.name}`,
          description: `تمت إضافة نسخة جديدة من القسم (${sec.name}) في عقار ${prop.name}.`,
          timestamp: 'الآن',
          read: false,
          type: 'system',
          targetAudience: 'all',
          propertyId,
        },
        ...prev,
      ]);

      return duplicatedSec;
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const addPropertySection = useCallback(
    (propertyId: string, sectionData: Partial<PropertySection>): PropertySection | null => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return null;

      const newSecId = sectionData.id || `sec-${Date.now()}`;
      const newSecName = sectionData.name?.trim() || `قسم جديد ${(prop.sections?.length || 0) + 1}`;
      const newSection: PropertySection = {
        id: newSecId,
        name: newSecName,
        title: sectionData.title || newSecName,
        subtitle: sectionData.subtitle || `مواصفات وتجهيزات ${newSecName}`,
        priceWeekday: Number(sectionData.priceWeekday) || Math.round((prop.basePriceWeekday || 1000) * 0.65),
        priceWeekend: Number(sectionData.priceWeekend) || Math.round((prop.basePriceWeekend || 1400) * 0.65),
        capacity: Number(sectionData.capacity) || 15,
        bedrooms: Number(sectionData.bedrooms) || 1,
        bathrooms: Number(sectionData.bathrooms) || 1,
        areaM2: Number(sectionData.areaM2) || 250,
        poolType: sectionData.poolType || prop.poolType || 'مسبح خاص',
        features: sectionData.features && sectionData.features.length > 0 ? [...sectionData.features] : ['مجلس ضيافة مستقل', 'جلسة خارجية خاصة'],
        images: sectionData.images && sectionData.images.length > 0 ? [...sectionData.images] : [...(prop.images || [])],
        coverImage: sectionData.coverImage || prop.coverImage,
        isAvailable: true,
        hasBreakfast: sectionData.hasBreakfast ?? prop.hasBreakfast ?? false,
        hasCoordinatorServices: sectionData.hasCoordinatorServices ?? prop.hasCoordinatorServices ?? false,
        contractTemplate: sectionData.contractTemplate?.trim() ? sectionData.contractTemplate : undefined,
        contractTerms: sectionData.contractTerms && sectionData.contractTerms.length > 0 ? [...sectionData.contractTerms] : undefined,
        videoItems: sectionData.videoItems && sectionData.videoItems.length > 0 ? [...sectionData.videoItems] : undefined,
      };

      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const currentSections = p.sections || [];
          const updatedSections = [...currentSections, newSection];
          return {
            ...p,
            hasSections: true,
            sections: updatedSections,
            subUnitsCount: updatedSections.length,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'إضافة قسم جديد للوحدة',
        `تمت إضافة ${newSecName} إلى عقار ${prop.name}`
      );

      return newSection;
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const deletePropertySection = useCallback(
    (propertyId: string, sectionId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return;
      const targetSec = prop.sections?.find((s) => s.id === sectionId);

      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          const remainingSections = (p.sections || []).filter((s) => s.id !== sectionId);
          return {
            ...p,
            sections: remainingSections.length > 0 ? remainingSections : undefined,
            subUnitsCount: Math.max(1, remainingSections.length),
            hasSections: remainingSections.length > 0,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'حذف قسم من الوحدة',
        `تم حذف القسم ${targetSec?.name || sectionId} من عقار ${prop.name}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const togglePropertyBreakfast = useCallback(
    (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return;
      const nextVal = !prop.hasBreakfast;
      setProperties((prev) => {
        const next = prev.map((p) => (p.id === propertyId ? { ...p, hasBreakfast: nextVal } : p));
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'تحديث خدمة الإفطار',
        `تم تغيير حالة توفر الإفطار لعقار ${prop.name} إلى: ${nextVal ? 'يوجد' : 'لا يوجد'}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const togglePropertyCoordinatorServices = useCallback(
    (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return;
      const nextVal = !prop.hasCoordinatorServices;
      setProperties((prev) => {
        const next = prev.map((p) => (p.id === propertyId ? { ...p, hasCoordinatorServices: nextVal } : p));
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });
      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'تحديث خدمات المنسقات',
        `تم تغيير حالة خدمات المنسقات لعقار ${prop.name} إلى: ${nextVal ? 'يوجد' : 'لا يوجد'}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const togglePropertyHasSections = useCallback(
    (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return;
      const currentHas = resolvePropertyHasSections(prop);
      const nextVal = !currentHas;

      setProperties((prev) => {
        const next = prev.map((p) => {
          if (p.id !== propertyId) return p;
          let nextSections = p.sections;
          if (nextVal && (!p.sections || p.sections.length === 0)) {
            nextSections = createDefaultSectionsForProperty(p);
          }
          return {
            ...p,
            hasSections: nextVal,
            sections: nextSections,
            subUnitsCount: nextVal && nextSections ? nextSections.length : 1,
          };
        });
        StorageService.set(STORAGE_KEYS.PROPERTIES, next);
        return next;
      });

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'تحديث خاصية الأقسام للوحدة',
        `تم تغيير خاصية احتواء الوحدة على أقسام لعقار ${prop.name} إلى: ${nextVal ? 'يوجد أقسام' : 'لا يوجد (وحدة واحدة)'}`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const transferPropertyOrSection = useCallback(
    (params: TransferUnitOrSectionParams): TransferUnitOrSectionResult => {
      const result = executePropertyOrSectionTransfer(properties, bookings, params);
      if (!result.success) return result;

      setProperties(result.properties);
      StorageService.set(STORAGE_KEYS.PROPERTIES, result.properties);

      if (result.removedSourcePropertyId) {
        void deleteCollectionDocFromFirestore(
          'properties',
          result.removedSourcePropertyId,
          firestoreSyncStateRef.current
        );
        if (selectedPropertyId === result.removedSourcePropertyId && result.createdOrTargetPropertyId) {
          setSelectedPropertyId(result.createdOrTargetPropertyId);
        }
      }

      if (result.movedBookingsCount > 0) {
        setBookings(result.bookings);
        StorageService.set(STORAGE_KEYS.BOOKINGS, result.bookings);
      }

      logActivity(
        isAdmin ? 'الإدارة العامة' : currentMarketer?.name || 'مستخدم',
        userRole,
        'نقل وحدة / قسم بين العقارات',
        result.message
      );

      setNotifications((prev) => [
        {
          id: `notif-transfer-${Date.now()}`,
          title: '🔄 نقل وحدة / قسم بنجاح',
          description: result.message,
          timestamp: 'الآن',
          read: false,
          type: 'system',
          targetAudience: 'all',
          propertyId: result.createdOrTargetPropertyId,
        },
        ...prev,
      ]);

      return result;
    },
    [properties, bookings, selectedPropertyId, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updatePropertySeasonalPricing = useCallback(
    (propertyId: string, seasonalPricing: SeasonalPricing) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== propertyId) return p;
          return { ...p, seasonalPricing: { ...p.seasonalPricing, ...seasonalPricing } };
        })
      );
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل وحفظ أسعار أنماط المواسم',
        `تم حفظ أسعار المواسم لعقار ${propObj?.name || propertyId} (وسط الأسبوع: ${seasonalPricing.weekday}، الويكند: ${seasonalPricing.weekend}، الصيف: ${seasonalPricing.summer}، الأعياد: ${seasonalPricing.eid}، الإجازات: ${seasonalPricing.vacation} ر.س)`
      );
      if (isAdmin) {
        setNotifications((prev) => [
          {
            id: `notif-season-${Date.now()}`,
            title: `💰 تحديث أسعار المواسم - ${propObj?.name || propertyId}`,
            description: `تم تحديث الأسعار الموسمية لعقار ${propObj?.name || propertyId} (وسط الأسبوع ${seasonalPricing.weekday} ر.س، الويكند ${seasonalPricing.weekend} ر.س).`,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'all',
            propertyId,
          },
          ...prev,
        ]);
      }
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updatePropertyBreakfastPrice = useCallback(
    (propertyId: string, defaultBreakfastPrice: number) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== propertyId) return p;
          return { ...p, defaultBreakfastPrice };
        })
      );
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل سعر الإفطار الافتراضي',
        `تم تعديل سعر الإفطار لعقار ${propObj?.name || propertyId} إلى ${defaultBreakfastPrice} ر.س`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updatePropertyBreakfastPricing = useCallback(
    (propertyId: string, breakfastPricing: PropertyBreakfastPricing) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== propertyId) return p;
          return {
            ...p,
            defaultBreakfastPrice: breakfastPricing.weekday,
            breakfastPricing,
            hasBreakfast: breakfastPricing.enabled,
          };
        })
      );
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل وحفظ إعدادات وأسعار الإفطار للعقار',
        `تم حفظ إعدادات وأسعار الإفطار لعقار ${propObj?.name || propertyId} (مفعل: ${breakfastPricing.enabled ? 'نعم' : 'لا'}، وسط الأسبوع: ${breakfastPricing.weekday}، الويكند: ${breakfastPricing.weekend}، الصيف: ${breakfastPricing.summer}، الأعياد: ${breakfastPricing.eid}، الإجازات المطولة: ${breakfastPricing.vacation} ر.س)`
      );
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updatePropertyAdministrativeFees = useCallback(
    (propertyId: string, administrativeFees: AdministrativeFees) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== propertyId) return p;
          return { ...p, administrativeFees };
        })
      );
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل وحفظ أسعار الرسوم الإدارية',
        `تم حفظ أسعار الرسوم الإدارية لعقار ${propObj?.name || propertyId} (وسط الأسبوع: ${administrativeFees.weekday}، الويكند: ${administrativeFees.weekend}، الصيف: ${administrativeFees.summer}، الأعياد: ${administrativeFees.eid}، الإجازات المطولة: ${administrativeFees.vacation} ر.س)`
      );
      if (isAdmin) {
        setNotifications((prev) => [
          {
            id: `notif-admfee-${Date.now()}`,
            title: `🧾 تحديث الرسوم الإدارية - ${propObj?.name || propertyId}`,
            description: `تم تعديل جدول الرسوم الإدارية لعقار ${propObj?.name || propertyId}.`,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'all',
            propertyId,
          },
          ...prev,
        ]);
      }
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updatePropertyCustomPricingPeriods = useCallback(
    (propertyId: string, customPricingPeriods: CustomPricingPeriod[]) => {
      const propObj = properties.find((p) => p.id === propertyId);
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id !== propertyId) return p;
          return { ...p, customPricingPeriods };
        })
      );
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل وحفظ مواسم التسعير المخصصة',
        `تم حفظ ${customPricingPeriods.length} موسم تسعير مخصص لعقار ${propObj?.name || propertyId}`
      );
      if (isAdmin) {
        setNotifications((prev) => [
          {
            id: `notif-cperiod-${Date.now()}`,
            title: `📅 تحديث مواسم التسعير المخصصة - ${propObj?.name || propertyId}`,
            description: `تم حفظ (${customPricingPeriods.length}) فترة تسعير مخصصة لعقار ${propObj?.name || propertyId}.`,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'all',
            propertyId,
          },
          ...prev,
        ]);
      }
    },
    [properties, isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const addCoordinatorService = useCallback(
    (serviceData: Omit<CoordinatorServiceItem, 'id'>) => {
      const newService: CoordinatorServiceItem = {
        ...serviceData,
        id: `cs-${Date.now()}`,
        isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
      };
      setCoordinatorServices((prev) => [newService, ...prev]);
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'إدراج خدمة منسقة جديدة',
        `تمت إضافة خدمة "${newService.title}" بسعر ${newService.price} ر.س للمنسقة ${newService.coordinatorName}`
      );
      return newService;
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const updateCoordinatorService = useCallback(
    (id: string, updates: Partial<CoordinatorServiceItem>) => {
      setCoordinatorServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل خدمة منسقة',
        `تم تحديث بيانات الخدمة رقم ${id}`
      );
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const deleteCoordinatorService = useCallback(
    (id: string) => {
      setCoordinatorServices((prev) => prev.filter((s) => s.id !== id));
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'حذف خدمة منسقة',
        `تم حذف الخدمة رقم ${id}`
      );
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const addCoordinator = useCallback(
    (coordData: Omit<Coordinator, 'id' | 'rating' | 'completedTasks'> & { rating?: number; completedTasks?: number }) => {
      const emailNorm = coordData.email ? coordData.email.trim().toLowerCase() : undefined;
      const coordId = `c-${Date.now()}`;
      const newCoord: Coordinator = {
        ...coordData,
        email: emailNorm,
        id: coordId,
        rating: coordData.rating || 5.0,
        completedTasks: coordData.completedTasks || 0,
        status: coordData.status || 'available',
        avatar: coordData.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
        permissions: coordData.permissions || {
          canViewDashboard: true,
          canViewGuardTasks: false,
          canViewCalendar: false,
          canViewBookings: true,
          canViewProperties: false,
          canViewMarketers: false,
          canViewMore: false,
          canViewAllBookings: false,
          canViewCustomerContacts: true,
          canCreateBooking: true,
          canCreateContract: true,
          canEditDeposit: true,
        },
      };
      const nextCoords = [...coordinatorsRef.current, newCoord];
      coordinatorsRef.current = nextCoords;
      setCoordinators(nextCoords);
      StorageService.set(STORAGE_KEYS.COORDINATORS, nextCoords);

      let nextAccounts = userAccountsRef.current;
      if (emailNorm && emailNorm.includes('@') && !userAccountsRef.current.some((a) => a.email.trim().toLowerCase() === emailNorm)) {
        const newAcc: UserAccount = {
          id: coordId,
          role: 'coordinator',
          coordinatorId: coordId,
          name: newCoord.name,
          email: emailNorm,
          phone: newCoord.phone,
          avatar: newCoord.avatar,
          createdAt: new Date().toISOString(),
        };
        nextAccounts = [...userAccountsRef.current, newAcc];
        pendingProtectedAccountEmailsRef.current.set(emailNorm, newAcc);
        userAccountsRef.current = nextAccounts;
        setUserAccounts(nextAccounts);
        StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      }

      void pushSliceNow({ coordinators: nextCoords, userAccounts: nextAccounts });
      void propagateAccessInBackground(nextAccounts);

      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'إضافة منسقة معتمدة',
        `تمت إضافة المنسقة المعتمدة: ${newCoord.name}`
      );
      triggerBrowserNotification('🌸 إضافة منسقة جديدة', `تمت إضافة المنسقة (${newCoord.name}) بنجاح إلى الفريق`, 'system');
      return newCoord;
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification, pushSliceNow, propagateAccessInBackground]
  );

  const updateCoordinatorPermissions = useCallback(
    (id: string, perms: Partial<CoordinatorPermissions>) => {
      if (!isAdmin && !canViewMore) return;
      const targetName = coordinators.find((c) => c.id === id)?.name || id;
      setCoordinators((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          const basePerms: CoordinatorPermissions = {
            canViewDashboard: true,
            canViewGuardTasks: false,
            canViewCalendar: false,
            canViewBookings: true,
            canViewProperties: false,
            canViewMarketers: false,
            canViewMore: false,
            canViewAllBookings: false,
            canViewCustomerContacts: true,
            canCreateBooking: true,
            canCreateContract: true,
            canEditDeposit: true,
            ...(c.permissions || {}),
          };
          return {
            ...c,
            permissions: {
              ...basePerms,
              ...perms,
            },
          };
        });
        StorageService.set(STORAGE_KEYS.COORDINATORS, next);
        return next;
      });
      logActivity(
        'الإدارة',
        'admin',
        'تعديل مصفوفة صلاحيات المنسق/ة',
        `تم تحديث مصفوفة الصلاحيات للمنسقة: ${targetName}`
      );
    },
    [isAdmin, canViewMore, coordinators, logActivity]
  );

  const updateCoordinator = useCallback(
    (id: string, data: Partial<Coordinator>) => {
      const targetCoord = coordinatorsRef.current.find((c) => c.id === id);
      const updatedName = data.name || targetCoord?.name || id;
      const normalizedEmail = data.email !== undefined ? data.email.trim().toLowerCase() : targetCoord?.email?.trim().toLowerCase();
      const nextCoords = coordinatorsRef.current.map((c) =>
        c.id === id ? { ...c, ...data, ...(data.email !== undefined ? { email: normalizedEmail || undefined } : {}) } : c
      );
      coordinatorsRef.current = nextCoords;
      setCoordinators(nextCoords);
      StorageService.set(STORAGE_KEYS.COORDINATORS, nextCoords);

      if (data.name !== undefined || data.phone !== undefined) {
        setCoordinatorServices((prev) =>
          prev.map((s) => {
            if (s.coordinatorId === id) {
              return {
                ...s,
                coordinatorName: data.name ?? s.coordinatorName,
                coordinatorPhone: data.phone ?? s.coordinatorPhone,
              };
            }
            return s;
          })
        );
      }

      let nextAccounts = userAccountsRef.current;
      if (data.name !== undefined || data.phone !== undefined || data.email !== undefined) {
        const prevEmail = (targetCoord?.email || '').trim().toLowerCase();
        let matchedAny = false;
        nextAccounts = userAccountsRef.current.map((acc) => {
          if (
            acc.id === id ||
            acc.coordinatorId === id ||
            (prevEmail && acc.email.trim().toLowerCase() === prevEmail)
          ) {
            matchedAny = true;
            return {
              ...acc,
              name: data.name ?? acc.name,
              phone: data.phone ?? acc.phone,
              email: normalizedEmail || acc.email,
              updatedAt: new Date().toISOString(),
            };
          }
          return acc;
        });
        if (!matchedAny && normalizedEmail && normalizedEmail.includes('@')) {
          const newAcc: UserAccount = {
            id,
            role: 'coordinator',
            coordinatorId: id,
            name: updatedName,
            email: normalizedEmail,
            phone: data.phone ?? targetCoord?.phone,
            avatar: data.avatar ?? targetCoord?.avatar,
            createdAt: new Date().toISOString(),
          };
          if (!nextAccounts.some((a) => a.email.trim().toLowerCase() === normalizedEmail)) {
            nextAccounts = [...nextAccounts, newAcc];
            pendingProtectedAccountEmailsRef.current.set(normalizedEmail, newAcc);
          }
        } else if (normalizedEmail) {
          const syncedAcc = nextAccounts.find((a) => a.email.trim().toLowerCase() === normalizedEmail);
          if (syncedAcc) pendingProtectedAccountEmailsRef.current.set(normalizedEmail, syncedAcc);
        }
        userAccountsRef.current = nextAccounts;
        setUserAccounts(nextAccounts);
        StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      }

      void pushSliceNow({ coordinators: nextCoords, userAccounts: nextAccounts });
      if (data.email !== undefined) {
        void propagateAccessInBackground(nextAccounts);
      }

      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'تعديل بيانات منسقة',
        `تم تحديث بيانات المنسقة: ${updatedName}`
      );
      triggerBrowserNotification('🌸 تعديل بيانات المنسقة', `تم تحديث بيانات المنسقة (${updatedName}) بنجاح`, 'system');
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification, pushSliceNow, propagateAccessInBackground]
  );

  const deleteCoordinator = useCallback(
    (id: string) => {
      const target = coordinatorsRef.current.find((c) => c.id === id);
      if (!target) return { success: false, message: 'المنسقة غير موجودة' };

      const nextCoords = coordinatorsRef.current.filter((c) => c.id !== id);
      coordinatorsRef.current = nextCoords;
      setCoordinators(nextCoords);
      StorageService.set(STORAGE_KEYS.COORDINATORS, nextCoords);
      setCoordinatorServices((prev) => prev.filter((s) => s.coordinatorId !== id && s.coordinatorName !== target.name));

      const targetEmail = (target.email || '').trim().toLowerCase();
      recentlyDeletedAccountIdsRef.current.add(id);
      if (targetEmail) pendingProtectedAccountEmailsRef.current.delete(targetEmail);
      const nextAccounts = userAccountsRef.current.filter((acc) => {
        if (acc.email.trim().toLowerCase() === 'sakt2008@gmail.com') return true;
        const remove =
          acc.id === id ||
          acc.coordinatorId === id ||
          (targetEmail && acc.email.trim().toLowerCase() === targetEmail);
        if (remove) recentlyDeletedAccountIdsRef.current.add(acc.id);
        return !remove;
      });
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      lastSyncedJsonRef.current.coordinators = JSON.stringify(nextCoords);
      lastSyncedJsonRef.current.userAccounts = JSON.stringify(nextAccounts);
      localWriteEpochRef.current += 1;

      // Immediately delete from Firebase Firestore
      void deleteCollectionDocFromFirestore('staffMembers', `co_${id}`, firestoreSyncStateRef.current);
      if (targetEmail) {
        void deleteAuthorizedUserFromFirestore(targetEmail, firestoreSyncStateRef.current);
      }

      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'حذف منسقة معتمدة',
        `تم حذف المنسقة (${target.name}) وخدماتها وحسابها من النظام وقاعدة بيانات Firebase`
      );
      triggerBrowserNotification('🌸 حذف منسقة', `تم حذف المنسقة (${target.name}) ومزامنة Firebase بنجاح`, 'system');
      return { success: true, message: `تم حذف المنسقة (${target.name}) وخدماتها بنجاح.` };
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const togglePropertyPublished = useCallback(
    (propertyId: string) => {
      const targetProp = propertiesRef.current.find((p) => p.id === propertyId);
      const nextPublishedVal = targetProp ? !targetProp.isPublished : true;
      setProperties((prev) =>
        prev.map((p) => {
          if (p.id === propertyId) {
            const nextPublished = !p.isPublished;
            logActivity(
              'الإدارة',
              'admin',
              nextPublished ? 'فتح العقار لجميع الأيام' : 'إيقاف العقار كامل لجميع الأيام',
              nextPublished
                ? `تم فتح العقار (${p.name}) كامل لجميع الأيام واستكمال إنشاء الحجوزات`
                : `تم إيقاف العقار (${p.name}) كامل لجميع الأيام وتعطيل إنشاء الحجوزات`
            );
            return { ...p, isPublished: nextPublished };
          }
          return p;
        })
      );
      if (targetProp) {
        setNotifications((prev) => [
          {
            id: `notif-pub-${Date.now()}`,
            title: nextPublishedVal
              ? `✅ فتح الحجوزات لعقار ${targetProp.name}`
              : `⛔ إيقاف الحجوزات مؤقتاً لعقار ${targetProp.name}`,
            description: nextPublishedVal
              ? `قامت الإدارة بفتح العقار (${targetProp.name}) واستقبال الحجوزات.`
              : `قامت الإدارة بإيقاف العقار (${targetProp.name}) مؤقتاً.`,
            timestamp: 'الآن',
            read: false,
            type: 'system',
            targetAudience: 'all',
            propertyId,
          },
          ...prev,
        ]);
      }
    },
    [logActivity]
  );

  const updateMarketerPermissions = useCallback((id: string, perms: Partial<MarketerPermissions>) => {
    setMarketers((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, permissions: { ...m.permissions, ...perms } } : m));
      marketersRef.current = next;
      StorageService.set(STORAGE_KEYS.MARKETERS, next);
      return next;
    });
  }, []);

  const saveMarketerPermissions = useCallback(
    async (id: string, perms?: Partial<MarketerPermissions>): Promise<{ success: boolean; message: string }> => {
      const targetMarketer = marketersRef.current.find((m) => m.id === id);
      if (!targetMarketer) {
        return { success: false, message: 'لم يتم العثور على المسوق.' };
      }

      const nextPermissions = perms ? { ...targetMarketer.permissions, ...perms } : targetMarketer.permissions;
      const nextMarketers = marketersRef.current.map((m) =>
        m.id === id ? { ...m, permissions: nextPermissions } : m
      );
      marketersRef.current = nextMarketers;
      setMarketers(nextMarketers);
      StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);

      let nextAccounts = userAccountsRef.current;
      if (targetMarketer.isSupervisor !== undefined) {
        nextAccounts = userAccountsRef.current.map((acc) =>
          acc.marketerId === id || acc.id === id
            ? { ...acc, isSupervisor: targetMarketer.isSupervisor }
            : acc
        );
        userAccountsRef.current = nextAccounts;
        setUserAccounts(nextAccounts);
        StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      }

      // Save directly to Firebase Firestore
      const saveRes = await pushSliceNow({
        marketers: nextMarketers,
        userAccounts: nextAccounts,
      });

      if (!saveRes.ok) {
        return {
          success: false,
          message: `تم حفظ الصلاحيات محلياً ولكن تعذر المزامنة السحابية: ${saveRes.error || 'خطأ في الاتصال بالسحابة'}`,
        };
      }

      logActivity(
        'الإدارة',
        'admin',
        'حفظ وتطبيق صلاحيات المسوق',
        `تم حفظ وتحديث صلاحيات المسوق (${targetMarketer.name}) بنجاح في Firebase`
      );

      void propagateAccessInBackground(userAccountsRef.current);

      return {
        success: true,
        message: `تم حفظ وتطبيق الصلاحيات بنجاح للمسوق (${targetMarketer.name}). ستظهر الصفحات المفتوحة له فوراً بكامل مميزاتها.`,
      };
    },
    [pushSliceNow, propagateAccessInBackground, logActivity]
  );

  const updateMarketerProfile = useCallback(
    (id: string, data: Partial<Marketer>) => {
      const targetMarketer = marketersRef.current.find((m) => m.id === id);
      const prevEmail = (targetMarketer?.email || '').trim().toLowerCase();
      const nextEmailNorm = data.email !== undefined ? data.email.trim().toLowerCase() : prevEmail;
      const nextMarketers = marketersRef.current.map((m) =>
        m.id === id
          ? {
              ...m,
              ...data,
              ...(data.email !== undefined ? { email: nextEmailNorm } : {}),
              contract: data.contract ? { ...m.contract, ...data.contract } : m.contract,
            }
          : m
      );
      marketersRef.current = nextMarketers;
      setMarketers(nextMarketers);
      StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);

      let matchedAny = false;
      let nextAccounts = userAccountsRef.current.map((acc) => {
        if (
          acc.id === id ||
          acc.marketerId === id ||
          (prevEmail && acc.email.trim().toLowerCase() === prevEmail)
        ) {
          matchedAny = true;
          return {
            ...acc,
            name: data.name ?? acc.name,
            email: nextEmailNorm || acc.email,
            phone: data.phone ?? acc.phone,
            updatedAt: new Date().toISOString(),
          };
        }
        return acc;
      });
      if (!matchedAny && nextEmailNorm && nextEmailNorm.includes('@')) {
        const newAcc: UserAccount = {
          id,
          role: 'marketer',
          marketerId: id,
          name: data.name || targetMarketer?.name || nextEmailNorm.split('@')[0],
          email: nextEmailNorm,
          phone: data.phone ?? targetMarketer?.phone,
          avatar: data.avatar ?? targetMarketer?.avatar,
          createdAt: new Date().toISOString(),
        };
        if (!nextAccounts.some((a) => a.email.trim().toLowerCase() === nextEmailNorm)) {
          nextAccounts = [...nextAccounts, newAcc];
          pendingProtectedAccountEmailsRef.current.set(nextEmailNorm, newAcc);
        }
      } else if (nextEmailNorm) {
        const syncedAcc = nextAccounts.find((a) => a.email.trim().toLowerCase() === nextEmailNorm);
        if (syncedAcc) pendingProtectedAccountEmailsRef.current.set(nextEmailNorm, syncedAcc);
      }
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ marketers: nextMarketers, userAccounts: nextAccounts });
      if (data.email !== undefined) {
        void propagateAccessInBackground(nextAccounts);
      }

      logActivity('الإدارة', 'admin', 'تحديث بيانات المسوق', `تم تحديث الملف الشخصي وبيانات العقد للمسوق: ${data.name || id}`);
    },
    [logActivity, pushSliceNow, propagateAccessInBackground]
  );

  const addMarketer = useCallback(
    async (data: { name: string; email: string; phone: string; nationalId?: string; falLicenseNumber?: string; bankAccount?: string; bankName?: string }) => {
      const emailNorm = data.email.trim().toLowerCase();
      const code = `MK-${100 + marketersRef.current.length + 1}`;
      const today = new Date().toISOString().split('T')[0];
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const newMarketer: Marketer = {
        id: `m${Date.now()}`,
        name: data.name,
        email: emailNorm,
        password: '123',
        phone: data.phone,
        bankAccount: data.bankAccount || '',
        bankName: data.bankName || 'مصرف الراجحي',
        nationalId: data.nationalId || '1000000000',
        falLicenseNumber: data.falLicenseNumber || '1100028491',
        avatar: `https://images.unsplash.com/photo-${1530000000000 + marketersRef.current.length}?auto=format&fit=crop&w=200&q=80`,
        code,
        commissionRate: 0.05,
        joinDate: today,
        contract: {
          contractNumber: `MKT-CTR-2026-${100 + marketersRef.current.length + 1}`,
          contractDate: today,
          expiryDate: expiry,
          commissionRatePercent: 5,
          status: 'active',
          firstParty: 'إدارة AMASA RESORT',
          firstPartyRepresentative: 'المدير العام التنفيذي',
          secondParty: data.name,
          secondPartyPhone: data.phone,
          secondPartyEmail: emailNorm,
          secondPartyNationalId: data.nationalId || '1000000000',
          secondPartyFalLicense: data.falLicenseNumber || '1100028491',
          terms: [
            'يستحق المسوق عمولة تسويق ثابتة قدرها 5% من القيمة الإجمالية لكل حجز مؤكد ومكتمل يتم إبرامه عبر رمزه التسويقي المعتمد.',
            'يتم تحويل العمولات المستحقة دورياً وفورياً إلى الحساب البنكي المعتمد للمسوق.',
            'يلتزم المسوق بالترويج بالأسعار الرسمية المعتمدة والحفاظ على سرية وخصوصية بيانات العملاء.',
            'يمنح المسوق صلاحية إصدار عقود الإيجار المعتمدة وتعديل مبالغ العربون المبدئي لتسهيل الحجوزات.',
          ],
          isSigned: true,
          signedDate: today,
          notes: 'عقد وساطة وتسويق موثق إلكترونياً',
        },
        permissions: {
          canCreateBooking: true,
          canEditPrices: false,
          canViewAllBookings: false,
          canBlockDates: false,
          canViewCustomerContacts: true,
          canExportReports: false,
          canViewFinancials: false,
          canCreateContract: true,
          canEditDeposit: true,
          canViewDashboard: true,
          canViewGuardTasks: false,
          canViewCalendar: false,
          canViewBookings: true,
          canViewProperties: false,
          canViewMarketers: false,
          canViewMore: true,
          canManageTemplates: false,
          canViewRentalContract: false,
          canViewActivityLogs: false,
        },
      };

      const nextMarketers = [...marketersRef.current, newMarketer];
      marketersRef.current = nextMarketers;
      setMarketers(nextMarketers);
      StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);

      const newAccount: UserAccount = {
        id: newMarketer.id,
        role: 'marketer',
        marketerId: newMarketer.id,
        name: data.name,
        email: emailNorm,
        password: '123',
        phone: data.phone,
        avatar: newMarketer.avatar,
        createdAt: new Date().toISOString(),
      };
      const nextAccounts = userAccountsRef.current.some((a) => a.email.trim().toLowerCase() === emailNorm)
        ? userAccountsRef.current
        : [...userAccountsRef.current, newAccount];
      pendingProtectedAccountEmailsRef.current.set(emailNorm, newAccount);
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);

      const saveResult = await pushSliceNow({ marketers: nextMarketers, userAccounts: nextAccounts });

      logActivity('الإدارة', 'admin', 'إضافة مسوق جديد', `تم تسجيل المسوق الجديد: ${data.name} بنسبة عمولة 5% وإصدار العقد الرسمي`);
      if (!saveResult.ok) {
        return {
          success: false,
          message: `تم حفظ المسوق محلياً ولكن تعذر الحفظ في Firebase: ${saveResult.error || 'تأكد من تسجيل الدخول بحساب الإدارة الموثق.'}`,
        };
      }
      void propagateAccessInBackground(nextAccounts);
      return {
        success: true,
        message: 'تمت إضافة المسوق الجديد ورخصة فال وتوليد عقده وحفظه في Firebase بنجاح بنسبة عمولة 5%',
      };
    },
    [logActivity, pushSliceNow, propagateAccessInBackground]
  );

  const addAdminAccount = useCallback(
    (data: { name: string; email: string; phone?: string }) => {
      const emailNorm = data.email.trim().toLowerCase();
      if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(emailNorm)) {
        return { success: false, message: 'أدخل بريد Google إلكترونياً صحيحاً (مثال: name@gmail.com).' };
      }
      if (userAccountsRef.current.some((acc) => acc.email.trim().toLowerCase() === emailNorm)) {
        return { success: false, message: 'هذا البريد مسجل مسبقاً لحساب آخر.' };
      }

      const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
      const arr = new Uint8Array(8);
      crypto.getRandomValues(arr);
      const autoPass = Array.from(arr, (b) => chars[b % chars.length]).join('');

      const newAdmin: UserAccount = {
        id: `admin-${Date.now()}`,
        role: 'admin',
        name: data.name,
        email: emailNorm,
        password: autoPass,
        phone: data.phone,
        createdAt: new Date().toISOString(),
      };
      const nextAccounts = [...userAccountsRef.current, newAdmin];
      pendingProtectedAccountEmailsRef.current.set(emailNorm, newAdmin);
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ userAccounts: nextAccounts });
      void propagateAccessInBackground(nextAccounts);

      logActivity('الإدارة', 'admin', 'إضافة عضو إدارة', `تم إضافة عضو إدارة بكامل الصلاحيات: ${data.name}`);
      return { success: true, message: 'تمت إضافة عضو الإدارة بكامل الصلاحيات', password: autoPass };
    },
    [logActivity, pushSliceNow, propagateAccessInBackground]
  );

  const setMarketerAccountRole = useCallback(
    (marketerId: string, newRole: UserRole) => {
      const acc = userAccountsRef.current.find((a) => a.marketerId === marketerId || a.id === marketerId);
      const marketerObj = marketersRef.current.find((m) => m.id === marketerId);
      if (!acc || !marketerObj) {
        return { success: false, message: 'لم يتم العثور على حساب هذا المسوق.' };
      }
      if (acc.role === newRole) {
        return { success: true, message: newRole === 'admin' ? 'الحساب إدارة بالفعل.' : 'الحساب مسوق بالفعل.' };
      }

      const nextAccounts = userAccountsRef.current.map((a) => (a.id === acc.id ? { ...a, role: newRole } : a));
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ userAccounts: nextAccounts });
      void propagateAccessInBackground(nextAccounts);

      logActivity(
        'الإدارة',
        'admin',
        newRole === 'admin' ? 'ترقية مسوق إلى إدارة' : 'إرجاع عضو إدارة إلى مسوق',
        newRole === 'admin'
          ? `تمت ترقية ${marketerObj.name} إلى الإدارة بكامل الصلاحيات.`
          : `تم إرجاع ${marketerObj.name} إلى صلاحيات مسوق.`
      );

      return {
        success: true,
        message:
          newRole === 'admin'
            ? `تمت ترقية ${marketerObj.name} إلى الإدارة.`
            : `تم إرجاع ${marketerObj.name} إلى مسوق.`,
      };
    },
    [logActivity, pushSliceNow, propagateAccessInBackground]
  );

  const promoteMarketerToSupervisor = useCallback(
    (marketerId: string, promote: boolean) => {
      const marketerObj = marketersRef.current.find((m) => m.id === marketerId);
      if (!marketerObj) {
        return { success: false, message: 'لم يتم العثور على المسوق.' };
      }

      const nextMarketers = marketersRef.current.map((m) =>
        m.id === marketerId
          ? {
              ...m,
              isSupervisor: promote,
              permissions: {
                ...m.permissions,
                canViewSupervisor: promote,
              },
            }
          : m
      );
      marketersRef.current = nextMarketers;
      setMarketers(nextMarketers);
      StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);

      const nextAccounts = userAccountsRef.current.map((a) =>
        a.marketerId === marketerId || a.id === marketerId ? { ...a, isSupervisor: promote } : a
      );
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      void pushSliceNow({ marketers: nextMarketers, userAccounts: nextAccounts });

      logActivity(
        'الإدارة',
        'admin',
        promote ? 'ترقية مسوق إلى مشرف (Supervisor)' : 'إلغاء صفة مشرف (Supervisor)',
        promote
          ? `تمت ترقية ${marketerObj.name} إلى مشرف (Supervisor) وتفعيل صلاحية عرض صفحة Supervisor.`
          : `تمت إزالة صفة المشرف (Supervisor) عن ${marketerObj.name} وإخفاء صفحة Supervisor.`
      );

      return {
        success: true,
        message: promote
          ? `تمت ترقية ${marketerObj.name} إلى Supervisor بنجاح.`
          : `تم إلغاء ترقية ${marketerObj.name} كـ Supervisor.`,
      };
    },
    [logActivity, pushSliceNow]
  );

  const deleteUserAccount = useCallback(
    (accountId: string) => {
      const target = userAccountsRef.current.find((a) => a.id === accountId);
      if (!target) {
        return { success: false, message: 'الحساب غير موجود.' };
      }
      if (target.email.trim().toLowerCase() === 'sakt2008@gmail.com') {
        return { success: false, message: 'لا يمكن حذف حساب المالك الأساسي للنظام.' };
      }
      const adminCount = userAccountsRef.current.filter((a) => a.role === 'admin').length;
      if (target.role === 'admin' && adminCount <= 1) {
        return { success: false, message: 'لا يمكن حذف الحساب الإداري الوحيد المتبقي.' };
      }

      recentlyDeletedAccountIdsRef.current.add(accountId);
      pendingProtectedAccountEmailsRef.current.delete(target.email.trim().toLowerCase());
      const nextAccounts = userAccountsRef.current.filter((a) => a.id !== accountId);
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      lastSyncedJsonRef.current.userAccounts = JSON.stringify(nextAccounts);
      if (target.marketerId) {
        const nextMarketers = marketersRef.current.filter((m) => m.id !== target.marketerId);
        marketersRef.current = nextMarketers;
        setMarketers(nextMarketers);
        StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);
        lastSyncedJsonRef.current.marketers = JSON.stringify(nextMarketers);
        void deleteCollectionDocFromFirestore('staffMembers', `mk_${target.marketerId}`, firestoreSyncStateRef.current);
      }
      if (target.coordinatorId) {
        const nextCoords = coordinatorsRef.current.filter((c) => c.id !== target.coordinatorId);
        coordinatorsRef.current = nextCoords;
        setCoordinators(nextCoords);
        StorageService.set(STORAGE_KEYS.COORDINATORS, nextCoords);
        lastSyncedJsonRef.current.coordinators = JSON.stringify(nextCoords);
        void deleteCollectionDocFromFirestore('staffMembers', `co_${target.coordinatorId}`, firestoreSyncStateRef.current);
      }
      if (target.guardId && guardsListRef.current.length > 1) {
        const nextGuards = guardsListRef.current.filter((g) => g.id !== target.guardId);
        guardsListRef.current = nextGuards;
        setGuardsList(nextGuards);
        StorageService.set(STORAGE_KEYS.GUARDS_LIST, nextGuards);
        lastSyncedJsonRef.current.guardsList = JSON.stringify(nextGuards);
        void deleteCollectionDocFromFirestore('staffMembers', `gd_${target.guardId}`, firestoreSyncStateRef.current);
      }
      localWriteEpochRef.current += 1;
      void deleteAuthorizedUserFromFirestore(target.email, firestoreSyncStateRef.current);

      logActivity('الإدارة', 'admin', 'حذف حساب مستخدم', `تم حذف حساب (${target.name}) - ${target.email} من النظام وFirebase`);
      triggerBrowserNotification('🗑️ تم حذف الحساب', `تم حذف حساب ${target.name} بنجاح من النظام وFirebase`, 'system');
      return { success: true, message: `تم حذف حساب (${target.name}) بنجاح.` };
    },
    [logActivity, triggerBrowserNotification]
  );

  const deleteMarketer = useCallback(
    (marketerId: string) => {
      const target = marketersRef.current.find((m) => m.id === marketerId);
      if (!target) {
        return { success: false, message: 'المسوق غير موجود.' };
      }
      const nextMarketers = marketersRef.current.filter((m) => m.id !== marketerId);
      marketersRef.current = nextMarketers;
      setMarketers(nextMarketers);
      StorageService.set(STORAGE_KEYS.MARKETERS, nextMarketers);

      const targetEmail = (target.email || '').trim().toLowerCase();
      recentlyDeletedAccountIdsRef.current.add(marketerId);
      if (targetEmail) pendingProtectedAccountEmailsRef.current.delete(targetEmail);
      const nextAccounts = userAccountsRef.current.filter((a) => {
        if (a.email.trim().toLowerCase() === 'sakt2008@gmail.com') return true;
        const remove =
          a.marketerId === marketerId ||
          a.id === marketerId ||
          (targetEmail && a.email.trim().toLowerCase() === targetEmail);
        if (remove) recentlyDeletedAccountIdsRef.current.add(a.id);
        return !remove;
      });
      userAccountsRef.current = nextAccounts;
      setUserAccounts(nextAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, nextAccounts);
      lastSyncedJsonRef.current.marketers = JSON.stringify(nextMarketers);
      lastSyncedJsonRef.current.userAccounts = JSON.stringify(nextAccounts);
      localWriteEpochRef.current += 1;

      if (currentMarketerId === marketerId) {
        setCurrentMarketerId('');
      }

      // Immediately delete in Firebase Firestore
      void deleteCollectionDocFromFirestore('staffMembers', `mk_${marketerId}`, firestoreSyncStateRef.current);
      if (targetEmail) {
        void deleteAuthorizedUserFromFirestore(targetEmail, firestoreSyncStateRef.current);
      }

      logActivity('الإدارة', 'admin', 'حذف مسوق', `تم حذف المسوق (${target.name}) وجميع بيانات دخوله من النظام وFirebase`);
      triggerBrowserNotification('🗑️ تم حذف المسوق', `تم حذف المسوق ${target.name} ومزامنة Firebase بنجاح`, 'system');
      return { success: true, message: `تم حذف المسوق (${target.name}) بنجاح.` };
    },
    [currentMarketerId, logActivity, triggerBrowserNotification]
  );

  const addMemberByEmail = useCallback(
    async (email: string, role: UserRole, customName?: string) => {
      const emailNorm = email.trim().toLowerCase();
      if (!emailNorm || !emailNorm.includes('@')) {
        return { success: false, message: 'يرجى إدخال بريد إلكتروني صالح.' };
      }
      const existingAcc = userAccountsRef.current.find((acc) => acc.email.trim().toLowerCase() === emailNorm);
      if (existingAcc) {
        // If a previous add saved locally while Firebase failed, retry pushing it to Firebase seamlessly
        if (pendingProtectedAccountEmailsRef.current.has(emailNorm)) {
          const retryRes = await pushSliceNow({
            marketers: marketersRef.current,
            coordinators: coordinatorsRef.current,
            guardsList: guardsListRef.current,
            userAccounts: userAccountsRef.current,
          });
          if (!retryRes.ok) {
            return {
              success: false,
              message: `تعذر الحفظ في Firebase: ${retryRes.error || 'تأكد من اتصالك بالإنترنت ومن تسجيل الدخول بحساب الإدارة الموثق.'}`,
            };
          }
          return {
            success: true,
            message: `تمت مزامنة وحفظ (${existingAcc.name || emailNorm}) في Firebase بنجاح.`,
          };
        }
        return { success: false, message: 'هذا البريد الإلكتروني مسجل مسبقاً في النظام.' };
      }

      const defaultName = customName?.trim() || emailNorm.split('@')[0];
      const today = new Date().toISOString().split('T')[0];
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let newAccount: UserAccount;
      let newMarketer: Marketer | undefined;
      let newCoordinator: Coordinator | undefined;
      let newGuard: Guard | undefined;

      if (role === 'marketer') {
        const id = `m${Date.now()}`;
        const code = `MK-${100 + marketersRef.current.length + 1}`;
        newMarketer = {
          id,
          name: defaultName,
          email: emailNorm,
          phone: '',
          code,
          commissionRate: 0.05,
          joinDate: today,
          bankAccount: '',
          bankName: 'مصرف الراجحي',
          nationalId: '',
          falLicenseNumber: '',
          avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80`,
          contract: {
            contractNumber: `MKT-CTR-2026-${100 + marketersRef.current.length + 1}`,
            contractDate: today,
            expiryDate: expiry,
            commissionRatePercent: 5,
            status: 'active',
            firstParty: 'إدارة AMASA RESORT',
            firstPartyRepresentative: 'المدير العام التنفيذي',
            secondParty: defaultName,
            secondPartyPhone: '',
            secondPartyEmail: emailNorm,
            terms: [
              'تستحق المسوقة عمولة تسويق 5% من القيمة الإجمالية لكل حجز مؤكد ومكتمل.',
              'يتم تسجيل الدخول حصراً عبر حساب Google الرسمي المعتمد.',
              'تلتزم المسوقة بالحفاظ على سرية بيانات العملاء والأسعار المعتمدة.',
            ],
            isSigned: true,
            signedDate: today,
            notes: 'عقد مسوقة معتمدة - مضافة عبر البريد الإلكتروني',
          },
          permissions: {
            canCreateBooking: true,
            canEditPrices: false,
            canViewAllBookings: false,
            canBlockDates: false,
            canViewCustomerContacts: true,
            canExportReports: false,
            canViewFinancials: false,
            canCreateContract: true,
            canEditDeposit: true,
            canViewDashboard: true,
            canViewGuardTasks: false,
            canViewCalendar: false,
            canViewBookings: true,
            canViewProperties: false,
            canViewMarketers: false,
            canViewMore: true,
            canManageTemplates: false,
            canViewRentalContract: false,
            canViewActivityLogs: false,
          },
        };
        newAccount = {
          id,
          role: 'marketer',
          marketerId: id,
          name: defaultName,
          email: emailNorm,
          avatar: newMarketer.avatar,
          createdAt: new Date().toISOString(),
        };
      } else if (role === 'coordinator') {
        const id = `c-${Date.now()}`;
        newCoordinator = {
          id,
          name: defaultName,
          email: emailNorm,
          phone: '',
          specialty: 'تنسيق الحفلات والمناسبات',
          status: 'available',
          rating: 5.0,
          completedTasks: 0,
          avatar: `https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80`,
          permissions: {
            canViewDashboard: true,
            canViewGuardTasks: false,
            canViewCalendar: false,
            canViewBookings: true,
            canViewProperties: false,
            canViewMarketers: false,
            canViewMore: false,
            canViewAllBookings: false,
            canViewCustomerContacts: true,
            canCreateBooking: true,
            canCreateContract: true,
            canEditDeposit: true,
          },
        };
        newAccount = {
          id,
          role: 'coordinator',
          coordinatorId: id,
          name: defaultName,
          email: emailNorm,
          avatar: newCoordinator.avatar,
          createdAt: new Date().toISOString(),
        };
      } else if (role === 'guard') {
        const id = `g${Date.now()}`;
        newGuard = {
          id,
          name: defaultName,
          jobTitle: 'حارس ومشرف ميداني',
          phone: '',
          email: emailNorm,
          password: 'guard',
          nationalId: '',
          startDate: today,
          iban: '',
          salary: 3500,
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
          permissions: {
            canViewCalendar: false,
            canViewCustomerContacts: true,
            canConfirmArrival: true,
            canReceiveInsurance: true,
            canInspectUnit: true,
            canRefundInsurance: true,
            canViewDashboard: true,
            canViewGuardTasks: true,
            canViewBookings: false,
            canViewProperties: false,
            canViewMarketers: false,
            canViewMore: false,
            canBlockDates: false,
          },
        };
        newAccount = {
          id,
          role: 'guard',
          guardId: id,
          name: defaultName,
          email: emailNorm,
          avatar: newGuard.avatar,
          createdAt: new Date().toISOString(),
        };
      } else {
        const id = `admin-${Date.now()}`;
        newAccount = {
          id,
          role: 'admin',
          name: defaultName,
          email: emailNorm,
          createdAt: new Date().toISOString(),
        };
      }

      // Compute updated arrays from latest refs (zero stale closures!) and protect new email
      const updatedAccounts = [...userAccountsRef.current, newAccount];
      const updatedMarketers = newMarketer ? [...marketersRef.current, newMarketer] : marketersRef.current;
      const updatedCoordinators = newCoordinator ? [...coordinatorsRef.current, newCoordinator] : coordinatorsRef.current;
      const updatedGuardsList = newGuard ? [...guardsListRef.current, newGuard] : guardsListRef.current;

      pendingProtectedAccountEmailsRef.current.set(emailNorm, newAccount);
      recentlyDeletedAccountIdsRef.current.delete(newAccount.id);

      userAccountsRef.current = updatedAccounts;
      setUserAccounts(updatedAccounts);
      StorageService.set(STORAGE_KEYS.USER_ACCOUNTS, updatedAccounts);

      if (newMarketer) {
        marketersRef.current = updatedMarketers;
        setMarketers(updatedMarketers);
        StorageService.set(STORAGE_KEYS.MARKETERS, updatedMarketers);
      }
      if (newCoordinator) {
        coordinatorsRef.current = updatedCoordinators;
        setCoordinators(updatedCoordinators);
        StorageService.set(STORAGE_KEYS.COORDINATORS, updatedCoordinators);
      }
      if (newGuard) {
        guardsListRef.current = updatedGuardsList;
        setGuardsList(updatedGuardsList);
        StorageService.set(STORAGE_KEYS.GUARDS_LIST, updatedGuardsList);
      }

      // Step 1 (Critical): Push authorizedUsers + staffMembers first so adding a marketer never fails due to unrelated collections
      const saveResult = await pushSliceNow({
        marketers: updatedMarketers,
        coordinators: updatedCoordinators,
        guardsList: updatedGuardsList,
        userAccounts: updatedAccounts,
      });

      const roleAr =
        role === 'marketer'
          ? 'مسوقة'
          : role === 'coordinator'
          ? 'منسقة'
          : role === 'guard'
          ? 'حارس'
          : 'إدارة';

      logActivity('الإدارة', 'admin', 'إضافة عضو بالبريد', `تمت إضافة (${defaultName} - ${emailNorm}) بصلاحية: ${roleAr}`);
      triggerBrowserNotification('✨ إضافة عضو جديد', `تمت إضافة (${defaultName}) بنجاح. يمكنه الدخول عبر زر Google.`);

      if (!saveResult.ok) {
        return {
          success: false,
          message: `تم حفظ البريد (${emailNorm}) محلياً ولكن تعذر الحفظ في Firebase: ${saveResult.error || 'تأكد من اتصالك بالإنترنت ومن تسجيل الدخول بحساب الإدارة الموثق.'}`,
        };
      }

      // Step 2 (Isolated Propagation): Update authorizedEmails across operational collections independently without blocking member creation
      void propagateAccessInBackground(updatedAccounts);

      return {
        success: true,
        message: `تمت إضافة (${defaultName}) بصلاحية ${roleAr} وحفظه في Firebase بنجاح (${updatedAccounts.length} مصرح لهم). يستطيع الآن تسجيل الدخول مباشرة عبر حساب Google.`,
      };
    },
    [logActivity, triggerBrowserNotification, pushSliceNow, propagateAccessInBackground]
  );

  const setDateOverride = useCallback((propertyId: string, date: string, override: Partial<DateOverride>, sectionId?: string) => {
    setDateOverrides((prev) => {
      const next = { ...prev };
      const wholeIds = wholeIdsOf(propertyId);
      if (wholeIds.length >= 2) {
        if (!sectionId || sectionId === 'all') {
          next[`${propertyId}_${date}`] = { ...next[`${propertyId}_${date}`], ...override };
          wholeIds.forEach((sid) => {
            next[`${propertyId}_${sid}_${date}`] = { ...next[`${propertyId}_${sid}_${date}`], ...override };
          });
        } else {
          next[`${propertyId}_${sectionId}_${date}`] = { ...next[`${propertyId}_${sectionId}_${date}`], ...override };
          // الإتاحة تنعكس على الكامل، أما السعر فيُحسب دائماً من مجموع أسعار الأقسام
          const { price: _p, adminFee: _a, ...nonPrice } = override as any;
          next[`${propertyId}_${date}`] = { ...next[`${propertyId}_${date}`], ...nonPrice };
        }
      } else {
        const k = sectionId && sectionId !== 'all' ? `${propertyId}_${sectionId}_${date}` : `${propertyId}_${date}`;
        next[k] = { ...next[k], ...override };
      }
      return next;
    });
  }, []);

  const setDateOverridesBulk = useCallback((propertyId: string, dates: string[], override: Partial<DateOverride>, sectionId?: string) => {
    setDateOverrides((prev) => {
      const next = { ...prev };
      dates.forEach((d) => {
        const wholeIds = wholeIdsOf(propertyId);
        if (wholeIds.length >= 2) {
          if (!sectionId || sectionId === 'all') {
            next[`${propertyId}_${d}`] = { ...next[`${propertyId}_${d}`], ...override };
            wholeIds.forEach((sid) => {
              next[`${propertyId}_${sid}_${d}`] = { ...next[`${propertyId}_${sid}_${d}`], ...override };
            });
          } else {
            next[`${propertyId}_${sectionId}_${d}`] = { ...next[`${propertyId}_${sectionId}_${d}`], ...override };
            // الإتاحة تنعكس على الكامل، أما السعر فيُحسب دائماً من مجموع أسعار الأقسام
            const { price: _p, adminFee: _a, ...nonPrice } = override as any;
            next[`${propertyId}_${d}`] = { ...next[`${propertyId}_${d}`], ...nonPrice };
          }
        } else {
          const k = sectionId && sectionId !== 'all' ? `${propertyId}_${sectionId}_${d}` : `${propertyId}_${d}`;
          next[k] = { ...next[k], ...override };
        }
      });
      return next;
    });
  }, []);

  const setSupervisorDateOverride = useCallback(
    (propertyId: string, date: string, override: Partial<SupervisorDateOverride>, sectionId?: string) => {
      setSupervisorDateOverrides((prev) => {
        const next = { ...prev };
        const patch = { ...override, updatedAt: new Date().toISOString() };
        const wholeIds = wholeIdsOf(propertyId);
        if (wholeIds.length >= 2) {
          if (!sectionId || sectionId === 'all') {
            next[`${propertyId}_${date}`] = { ...next[`${propertyId}_${date}`], ...patch };
            wholeIds.forEach((sid) => {
              next[`${propertyId}_${sid}_${date}`] = { ...next[`${propertyId}_${sid}_${date}`], ...patch };
            });
          } else {
            next[`${propertyId}_${sectionId}_${date}`] = { ...next[`${propertyId}_${sectionId}_${date}`], ...patch };
            // الإتاحة تنعكس على الكامل، أما السعر فيُحسب دائماً من مجموع أسعار الأقسام
            const { price: _p, adminFee: _a, ...nonPrice } = patch as any;
            next[`${propertyId}_${date}`] = { ...next[`${propertyId}_${date}`], ...nonPrice };
          }
        } else {
          const k = sectionId && sectionId !== 'all' ? `${propertyId}_${sectionId}_${date}` : `${propertyId}_${date}`;
          next[k] = { ...next[k], ...patch };
        }
        return next;
      });
    },
    []
  );

  const setSupervisorDateOverridesBulk = useCallback(
    (propertyId: string, dates: string[], override: Partial<SupervisorDateOverride>, sectionId?: string) => {
      setSupervisorDateOverrides((prev) => {
        const next = { ...prev };
        const patch = { ...override, updatedAt: new Date().toISOString() };
        dates.forEach((d) => {
          const wholeIds = wholeIdsOf(propertyId);
          if (wholeIds.length >= 2) {
            if (!sectionId || sectionId === 'all') {
              next[`${propertyId}_${d}`] = { ...next[`${propertyId}_${d}`], ...patch };
              wholeIds.forEach((sid) => {
                next[`${propertyId}_${sid}_${d}`] = { ...next[`${propertyId}_${sid}_${d}`], ...patch };
              });
            } else {
              next[`${propertyId}_${sectionId}_${d}`] = { ...next[`${propertyId}_${sectionId}_${d}`], ...patch };
              // الإتاحة تنعكس على الكامل، أما السعر فيُحسب دائماً من مجموع أسعار الأقسام
              const { price: _p, adminFee: _a, ...nonPrice } = patch as any;
              next[`${propertyId}_${d}`] = { ...next[`${propertyId}_${d}`], ...nonPrice };
            }
          } else {
            const k = sectionId && sectionId !== 'all' ? `${propertyId}_${sectionId}_${d}` : `${propertyId}_${d}`;
            next[k] = { ...next[k], ...patch };
          }
        });
        return next;
      });
    },
    []
  );

  const addCustomSupervisorRate = useCallback((rate: number) => {
    const clean = Math.round(Number(rate) * 100) / 100;
    if (!Number.isFinite(clean) || clean <= 0 || clean > 100 || clean === 5 || clean === 7) return;
    setCustomSupervisorRates((prev) => (prev.includes(clean) ? prev : [...prev, clean].sort((a, b) => a - b)));
  }, []);

  const removeCustomSupervisorRate = useCallback((rate: number) => {
    setCustomSupervisorRates((prev) => prev.filter((r) => r !== rate));
  }, []);

  const applySeasonalPricingPattern = useCallback(
    (propertyId: string, dates: string[], season: keyof Property['seasonalPricing'], sectionId?: string) => {
      const prop = properties.find((p) => p.id === propertyId) || selectedProperty;
      let price = prop.seasonalPricing[season] || prop.basePriceWeekday;
      if (sectionId && sectionId !== 'all') {
        const sec = prop.sections?.find((s) => s.id === sectionId);
        if (sec) {
          if (season === 'weekday') price = sec.priceWeekday;
          else if (season === 'weekend') price = sec.priceWeekend;
          else if (season === 'summer') price = Math.round(sec.priceWeekday * 1.1);
          else if (season === 'eid') price = Math.round(sec.priceWeekend * 1.5);
          else if (season === 'vacation') price = Math.round(sec.priceWeekday * 1.25);
        }
      }
      setDateOverridesBulk(propertyId, dates, { price, season: String(season) }, sectionId);
    },
    [properties, selectedProperty, setDateOverridesBulk]
  );

  const requestDeposit = useCallback(
    ({
      propertyId,
      dates,
      customerName,
      customerPhone,
      depositAmount,
      totalPrice,
      nightsCount,
      marketerId,
      commissionRatePercent,
      sectionId,
      sectionName,
      estateParts: holdParts,
      breakfastOption,
      breakfastPrice,
      coordinatorName,
      coordinatorService,
      coordinatorPrice,
      baseNightlyTotal,
      isSupervisorBooking,
    }: {
      propertyId: string;
      dates: string[];
      customerName: string;
      customerPhone: string;
      depositAmount: number;
      totalPrice: number;
      nightsCount: number;
      marketerId?: string;
      commissionRatePercent?: number;
      sectionId?: string;
      sectionName?: string;
      estateParts?: EstatePartRef[];
      breakfastOption?: string;
      breakfastPrice?: number;
      coordinatorName?: string;
      coordinatorService?: string;
      coordinatorPrice?: number;
      baseNightlyTotal?: number;
      isSupervisorBooking?: boolean;
    }) => {
      const prop = properties.find((p) => p.id === propertyId) || selectedProperty;
      const displayName = sectionName ? `${prop.name} (${sectionName})` : prop.name;
      const targetMarketer = marketers.find((m) => m.id === (marketerId || currentMarketerId));
      const expiresAt = Date.now() + 900 * 1000; // 15 minutes = 900 seconds
      const todayStr = new Date().toISOString().split('T')[0];
      const validDates = dates.filter((d) => d >= todayStr);
      if (validDates.length === 0) {
        return { whatsappUrl: '', message: '' };
      }

      const resolvedCommissionRate =
        commissionRatePercent !== undefined && commissionRatePercent >= 0 ? commissionRatePercent : 5;

      setDateOverrides((prev) => {
        const next = { ...prev };
        validDates.forEach((d) => {
          const waitPayload: Partial<DateOverride> = {
            status: 'waiting_deposit',
            waitingDepositExpiresAt: expiresAt,
            waitingCustomerName: customerName,
            waitingCustomerPhone: customerPhone,
            waitingDepositAmount: depositAmount,
            waitingMarketerName: targetMarketer?.name || (isSupervisorBooking ? 'Supervisor' : undefined),
            waitingMarketerId: targetMarketer?.id,
            waitingCommissionRate: resolvedCommissionRate,
          };

          if (holdParts && holdParts.length > 0) {
            estateOverrideKeys(prop, holdParts, d, propertiesRef.current).forEach((k) => {
              next[k] = { ...next[k], ...waitPayload };
            });
          } else if (sectionId && sectionId !== 'all') {
            next[`${propertyId}_${sectionId}_${d}`] = {
              ...next[`${propertyId}_${sectionId}_${d}`],
              ...waitPayload,
            };
          } else {
            next[`${propertyId}_${d}`] = {
              ...next[`${propertyId}_${d}`],
              ...waitPayload,
            };
            wholeIdsOf(propertyId).forEach((sid) => {
              next[`${propertyId}_${sid}_${d}`] = { ...next[`${propertyId}_${sid}_${d}`], ...waitPayload };
            });
          }
        });
        return next;
      });

      const notifDesc = `⚠️ طلب عربون جديد لعقار (${displayName}) للعميل ${customerName} بمبلغ ${depositAmount} ريال. التواريخ معلقة باللون الأصفر لمدة 15 دقيقة للتحويل!`;

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: `طلب عربون جديد (مهلة 15 دقيقة) - ${displayName}`,
          description: notifDesc,
          timestamp: 'الآن',
          read: false,
          type: 'deposit_request',
          targetAudience: isSupervisorBooking ? 'admin_only' : 'all',
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `⏳ طلب عربون جديد (مهلة 15 دقيقة) - ${displayName}`,
        `تم طلب عربون بقيمة ${depositAmount} ريال للعميل ${customerName} لعقار ${displayName} لحفظ الحجز فوراً`,
        'deposit_request'
      );

      const sortedValidDates = [...validDates].sort();
      const inDate = sortedValidDates[0];
      const lastNight = sortedValidDates[sortedValidDates.length - 1];
      const outDateObj = new Date(lastNight);
      outDateObj.setDate(outDateObj.getDate() + 1);

      const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const inDateObj = new Date(inDate);
      const formattedInDate = `${daysAr[inDateObj.getDay()]} ${inDateObj.getDate()} ${monthsAr[inDateObj.getMonth()]} ${inDateObj.getFullYear()} م`;
      const formattedOutDate = `${daysAr[outDateObj.getDay()]} ${outDateObj.getDate()} ${monthsAr[outDateObj.getMonth()]} ${outDateObj.getFullYear()} م`;

      const termsText = prop.contractTerms ? prop.contractTerms.map((t, idx) => `${idx + 1}. ${t}`).join('\n') : '';

      let msg = fillTemplate(messageTemplates.depositRequest, {
        customerName: customerName || 'العميل الكريم',
        customerPhone,
        propertyName: displayName,
        nightsCount,
        depositAmount,
        totalPrice,
        remainingAmount: Math.max(0, totalPrice - depositAmount),
        insuranceAmount: prop.insuranceAmount,
        bankName: prop.bankName,
        accountHolder: prop.accountHolder,
        iban: prop.iban,
        paymentDeadline: '15 دقيقة',
        checkInDate: formattedInDate,
        checkInTime: prop.checkInTimeText || 'الساعة 4:00 عصراً',
        checkOutDate: formattedOutDate,
        checkOutTime: prop.checkOutTimeText || 'الساعة 2:00 ظهراً',
        contractTerms: termsText,
        guardName: prop.assignedGuardName || 'أبو راشد',
        businessPhone: AMASA_BUSINESS_PHONE,
        marketerName: targetMarketer?.name || (isSupervisorBooking ? 'Supervisor' : 'مسوق معتمد'),
      });

      // إدراج تفصيل مالي منفصل للإقامة، الفطور، وخدمة المنسقة مع مجموع الحجز الإجمالي
      if ((breakfastPrice && breakfastPrice > 0) || (coordinatorPrice && coordinatorPrice > 0) || baseNightlyTotal) {
        let breakdown = '\n📊 *تفاصيل الحساب المالي والتسعير المعتمد:*';
        const nightsPrice = baseNightlyTotal || (totalPrice - (breakfastPrice || 0) - (coordinatorPrice || 0));
        breakdown += `\n• سعر الإقامة (${nightsCount} ليلة): ${nightsPrice} ريال`;
        if (breakfastPrice && breakfastPrice > 0) {
          breakdown += `\n• وجبة الإفطار (${breakfastOption || 'مع الفطور'}): ${breakfastPrice} ريال`;
        }
        if (coordinatorPrice && coordinatorPrice > 0) {
          breakdown += `\n• خدمة طلب المنسقة والتجهيز (${coordinatorName || 'المنسقة'}${coordinatorService ? ` - ${coordinatorService}` : ''}): ${coordinatorPrice} ريال`;
        }
        breakdown += `\n• *مجموع الحجز الإجمالي:* ${totalPrice} ريال`;

        if (msg.includes('📋 *تفاصيل الحساب المالي')) {
          msg = msg.replace(/📋 \*تفاصيل الحساب المالي[^*]*\*/, `📋 *تفاصيل الحساب المالي:*\n${breakdown}\n`);
        } else {
          msg = `${msg}\n${breakdown}`;
        }
      }

      const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

      logActivity(
        targetMarketer?.name || (isSupervisorBooking ? 'Supervisor' : 'المسوق'),
        userRole,
        'طلب عربون (مهلة 15 دقيقة) عبر واتساب',
        `تم إرسال طلب عربون بقيمة ${depositAmount} ريال للعميل ${customerName} لعقار ${displayName} برقم أعمال AMASA RESORT (${AMASA_BUSINESS_PHONE}) ومهلة 15 دقيقة`
      );

      return { whatsappUrl, message: msg };
    },
    [properties, selectedProperty, marketers, currentMarketerId, messageTemplates, triggerBrowserNotification, userRole, logActivity]
  );

  const cancelDepositWait = useCallback((propertyId: string, dates: string[], sectionId?: string) => {
    setDateOverrides((prev) => {
      const next = { ...prev };
      dates.forEach((d) => {
        const keys = [
          `${propertyId}_${d}`,
          ...(sectionId && sectionId !== 'all' ? [`${propertyId}_${sectionId}_${d}`] : []),
          ...(!sectionId || sectionId === 'all' ? wholeIdsOf(propertyId).map((sid) => `${propertyId}_${sid}_${d}`) : []),
        ];
        keys.forEach((k) => {
          if (next[k]) {
            next[k] = {
              ...next[k],
              status: 'available',
              waitingDepositExpiresAt: undefined,
              waitingCustomerName: undefined,
              waitingCustomerPhone: undefined,
              waitingDepositAmount: undefined,
            };
          }
        });
      });
      return next;
    });

    logActivity('المسوق', userRole, 'إلغاء حجز العربون المؤقت', `تم إلغاء حجز العربون المؤقت وإعادة التواريخ المحددة متاحة باللون الأخضر.`);
    triggerBrowserNotification('🔓 إلغاء حجز العربون', 'تم إلغاء قفل العربون المؤقت وعادت الأيام متاحة باللون الأخضر.');
  }, [userRole, logActivity, triggerBrowserNotification]);

  const extendDepositWait = useCallback((propertyId: string, dates: string[], sectionId?: string) => {
    const newExpiresAt = Date.now() + 900 * 1000; // extend by 15 mins
    setDateOverrides((prev) => {
      const next = { ...prev };
      dates.forEach((d) => {
        const keys = [
          `${propertyId}_${d}`,
          ...(sectionId && sectionId !== 'all' ? [`${propertyId}_${sectionId}_${d}`] : []),
          ...(!sectionId || sectionId === 'all' ? wholeIdsOf(propertyId).map((sid) => `${propertyId}_${sid}_${d}`) : []),
        ];
        keys.forEach((k) => {
          if (next[k]) {
            next[k] = {
              ...next[k],
              waitingDepositExpiresAt: newExpiresAt,
            };
          }
        });
      });
      return next;
    });

    logActivity('المسوق', userRole, 'تمديد مهلة العربون (15 دقيقة)', `تم تمديد مهلة تحويل العربون 15 دقيقة إضافية للعميل.`);
    triggerBrowserNotification('⏱️ تمديد مهلة العربون', 'تم تمديد عداد مهلة تحويل العربون 15 دقيقة إضافية بنجاح.', 'deposit_request');
  }, [userRole, logActivity, triggerBrowserNotification]);

  const confirmBookingWithReceipt = useCallback(
    ({
      propertyId,
      dates,
      customerName,
      customerPhone,
      depositPaid,
      totalPrice,
      remainingAmount,
      insuranceAmount,
      receiptFileName,
      receiptDataUrl,
      marketerId,
      commissionRatePercent,
      notes,
      sectionId,
      sectionName,
      estateParts,
      breakfastOption,
      breakfastPrice,
      coordinatorName,
      coordinatorService,
      coordinatorPrice,
      baseNightlyTotal,
      isSupervisorBooking: isSupBookingParam,
      supervisorId: supIdParam,
      supervisorName: supNameParam,
      supervisorFee: supFeeParam,
      supervisorTotalCredit: supCreditParam,
      customerNationalId,
      vehiclePlate,
      guestsCount,
    }: {
      propertyId: string;
      dates: string[];
      customerName: string;
      customerPhone: string;
      depositPaid: number;
      totalPrice: number;
      remainingAmount: number;
      insuranceAmount: number;
      receiptFileName: string;
      receiptDataUrl?: string;
      marketerId?: string;
      commissionRatePercent?: number;
      notes?: string;
      sectionId?: string;
      sectionName?: string;
      estateParts?: EstatePartRef[];
      breakfastOption?: string;
      breakfastPrice?: number;
      coordinatorName?: string;
      coordinatorService?: string;
      coordinatorPrice?: number;
      baseNightlyTotal?: number;
      isSupervisorBooking?: boolean;
      supervisorId?: string;
      supervisorName?: string;
      supervisorFee?: number;
      supervisorTotalCredit?: number;
      customerNationalId?: string;
      vehiclePlate?: string;
      guestsCount?: number;
    }) => {
      const prop = properties.find((p) => p.id === propertyId) || selectedProperty;
      const displayName = sectionName ? `${prop.name} (${sectionName})` : prop.name;
      const targetMarketer = marketers.find((m) => m.id === (supIdParam || marketerId || currentMarketerId));
      const isSupBooking = Boolean(isSupBookingParam);

      const todayStr = new Date().toISOString().split('T')[0];
      const validDates = dates.filter((d) => d >= todayStr);
      const sortedDates = [...(validDates.length > 0 ? validDates : dates)].sort();
      const checkInDate = sortedDates[0];
      const lastNight = sortedDates[sortedDates.length - 1];
      const checkOutDateObj = new Date(lastNight);
      checkOutDateObj.setDate(checkOutDateObj.getDate() + 1);
      const checkOutDate = checkOutDateObj.toISOString().split('T')[0];

      const nightsCount = sortedDates.length;
      const nightsPrice = baseNightlyTotal || (totalPrice - (breakfastPrice || 0) - (coordinatorPrice || 0));
      const nightlyPrice = Math.round(nightsPrice / Math.max(1, nightsCount));
      const rate = commissionRatePercent !== undefined ? Math.max(0, commissionRatePercent) : 5;
      const commissionAmount = rate === 0 ? 0 : (isSupBooking || targetMarketer ? Math.round(nightsPrice * (rate / 100)) : 0);

      const checkInDateObj = new Date(checkInDate);
      const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

      const inDayName = daysAr[checkInDateObj.getDay()];
      const inDayNum = checkInDateObj.getDate();
      const inMonthNum = checkInDateObj.getMonth() + 1;
      const inMonthName = monthsAr[checkInDateObj.getMonth()];
      const inYear = checkInDateObj.getFullYear();

      const outDayName = daysAr[checkOutDateObj.getDay()];
      const outDayNum = checkOutDateObj.getDate();
      const outMonthNum = checkOutDateObj.getMonth() + 1;
      const outMonthName = monthsAr[checkOutDateObj.getMonth()];
      const outYear = checkOutDateObj.getFullYear();

      const generatedBookingNumber = `BK-2026-${100 + bookings.length + 1}`;
      const { template: resolvedContractTpl, terms: resolvedTerms, matchedSection } =
        resolveContractTemplateAndTerms({
          property: prop,
          sectionId,
          sectionName,
          globalFallbackTemplate: messageTemplates.contract,
        });

      const adaptedTerms =
        estateParts && estateParts.length > 0 && sectionName
          ? resolvedTerms.map((t) =>
              t.startsWith('هذا العقد يشمل العقار المدمج') ? `هذا العقد يشمل ${sectionName} من ${prop.name} فقط.` : t
            )
          : resolvedTerms;
      const termsText = adaptedTerms.map((t, idx) => `${idx + 1}. ${t}`).join('\n');
      const resolvedSectionLabel =
        sectionName || (sectionId && sectionId !== 'all' ? matchedSection?.name : '') || 'كامل العقار';

      let contractText = fillTemplate(resolvedContractTpl, {
        اسم_العقار: prop.name === 'كوخ البيلسان' ? 'كوخ زهرة البيلسان 🏕️' : `${displayName} 🏕️`,
        اسم_القسم: resolvedSectionLabel,
        رقم_الحجز: generatedBookingNumber,
        اسم_العميل: customerName,
        رقم_الجوال: customerPhone,
        تاريخ_الدخول: `${inDayName} ${inDayNum} ${inMonthName} ( ${inMonthNum} ) ${inYear} م`,
        وقت_الدخول: prop.checkInTimeText,
        تاريخ_الخروج: `${outDayName} ${outDayNum} ${outMonthName} ( ${outMonthNum} ) ${outYear} م`,
        وقت_الخروج: prop.checkOutTimeText,
        عدد_الليالي: nightsCount,
        المبلغ_الإجمالي: totalPrice,
        مبلغ_العربون: depositPaid,
        المبلغ_المتبقي: remainingAmount,
        مبلغ_التأمين: insuranceAmount,
        شروط_العقد: termsText,
      });

      // تفصيل سعر الإقامة، الفطور، ورسوم المنسقة في العقد بشكل منفصل
      if ((breakfastPrice && breakfastPrice > 0) || (coordinatorPrice && coordinatorPrice > 0) || baseNightlyTotal) {
        let pricingBreakdown = '\n📊 تفاصيل الحساب والتسعير المعتمد:\n';
        pricingBreakdown += `• سعر الإقامة (${nightsCount} ليلة): ${nightsPrice} ريال\n`;
        if (estateParts && estateParts.length > 0) {
          estateParts.forEach((part) => {
            const partTotal = sortedDates.reduce(
              (sum, d) => sum + getPartNightPrice(part, propertiesRef.current, dateOverridesRef.current, d),
              0
            );
            pricingBreakdown += `   ◦ ${part.label}: ${partTotal} ريال\n`;
          });
        }
        if (breakfastPrice && breakfastPrice > 0) {
          pricingBreakdown += `• وجبة الإفطار (${breakfastOption || 'مع الفطور'}): ${breakfastPrice} ريال\n`;
        }
        if (coordinatorPrice && coordinatorPrice > 0) {
          pricingBreakdown += `• خدمة طلب المنسقة والتجهيز (${coordinatorName || 'المنسقة'}${coordinatorService ? ` - ${coordinatorService}` : ''}): ${coordinatorPrice} ريال\n`;
        }
        pricingBreakdown += `• إجمالي المبلغ المتفق عليه: ${totalPrice} ريال\n`;

        if (contractText.includes('المبلغ المتفق عليه:')) {
          contractText = contractText.replace('المبلغ المتفق عليه:', `${pricingBreakdown}المبلغ المتفق عليه:`);
        } else {
          contractText += `\n${pricingBreakdown}`;
        }
      }

      if (!contractText.includes('الشروط والأحكام') && !contractText.includes(termsText)) {
        contractText += `\n\n📌 الشروط والأحكام:\n${termsText}`;
      }

      const totalAdminFee = isSupBooking
        ? (supFeeParam !== undefined
            ? supFeeParam
            : sortedDates.reduce((sum, d) => {
                const k = sectionId ? `${propertyId}_${sectionId}_${d}` : `${propertyId}_${d}`;
                const ov = supervisorDateOverrides[k] || supervisorDateOverrides[`${propertyId}_${d}`];
                if (ov?.supervisorFee !== undefined) return sum + ov.supervisorFee;
                const dayOfWeek = new Date(d).getDay();
                const isWknd = dayOfWeek === 4 || dayOfWeek === 5;
                return sum + (isWknd ? 500 : 400);
              }, 0))
        : sortedDates.reduce((sum, d) => {
            const k = sectionId ? `${propertyId}_${sectionId}_${d}` : `${propertyId}_${d}`;
            const ov = dateOverrides[k] || dateOverrides[`${propertyId}_${d}`];
            if (ov?.adminFee !== undefined) return sum + ov.adminFee;
            const dayOfWeek = new Date(d).getDay();
            const isWknd = dayOfWeek === 4 || dayOfWeek === 5;
            const defaultRate = isWknd ? (prop.administrativeFees?.weekend ?? 150) : (prop.administrativeFees?.weekday ?? 100);
            return sum + defaultRate;
          }, 0);

      const resolvedSupervisorCredit = isSupBooking
        ? (supCreditParam !== undefined ? supCreditParam : commissionAmount + totalAdminFee)
        : undefined;

      // صافي ربح العقار = السعر الكلي مخصوم منه عمولة المسوق ثم الرسوم الإدارية / رسوم المشرف
      const calculatedNetPayout = Math.max(0, totalPrice - commissionAmount - totalAdminFee);
      const resolvedSupId = isSupBooking ? (supIdParam || targetMarketer?.id || 'admin-supervisor') : undefined;
      const resolvedSupName = isSupBooking ? (supNameParam || targetMarketer?.name || 'Supervisor') : undefined;

      const newBooking: Booking = {
        id: `bk-${Date.now()}`,
        bookingNumber: generatedBookingNumber,
        propertyId,
        propertyName: displayName,
        sectionId,
        sectionName,
        ...(estateParts && estateParts.length > 0 ? { estateParts } : {}),
        customerName,
        customerPhone,
        ...(customerNationalId?.trim() ? { customerNationalId: customerNationalId.trim() } : {}),
        ...(vehiclePlate?.trim() ? { vehiclePlate: vehiclePlate.trim() } : {}),
        ...(guestsCount && Number(guestsCount) > 0 ? { guestsCount: Number(guestsCount) } : {}),
        checkInDate,
        checkOutDate,
        nightsCount,
        nightlyPrice,
        totalPrice,
        adminFee: totalAdminFee,
        propertyNetPayout: calculatedNetPayout,
        taxAmount: 0,
        discount: 0,
        depositPaid,
        remainingAmount,
        insuranceAmount,
        depositReceiptName: receiptFileName,
        depositReceiptUrl: isRenderableReceiptUrl(receiptDataUrl) ? receiptDataUrl : undefined,
        receiptFileName,
        receiptDataUrl: isRenderableReceiptUrl(receiptDataUrl) ? receiptDataUrl : undefined,
        marketerId: isSupBooking ? resolvedSupId : targetMarketer?.id,
        marketerName: isSupBooking ? resolvedSupName : targetMarketer?.name,
        marketerCommission: commissionAmount,
        commissionRatePercent: rate,
        bookingType: isSupBooking ? 'supervisor' : (rate === 7 ? 'full' : 'partial'),
        bookingCategory: isSupBooking ? 'supervisor' : 'standard',
        isSupervisorBooking: isSupBooking || undefined,
        supervisorId: resolvedSupId,
        supervisorName: resolvedSupName,
        supervisorFee: isSupBooking ? totalAdminFee : undefined,
        supervisorTotalCredit: resolvedSupervisorCredit,
        breakfastOption,
        breakfastPrice: breakfastPrice || 0,
        coordinatorName,
        coordinatorService,
        coordinatorPrice: coordinatorPrice || 0,
        baseNightlyTotal: nightsPrice,
        commissionStatus: 'pending',
        status: 'confirmed',
        createdAt: new Date().toISOString().split('T')[0],
        notes: notes || `تم تأكيد الحجز بإرفاق الإيصال: ${receiptFileName}`,
        customerWhatsappUrl: buildCustomerWhatsappUrl(customerPhone, contractText),
        customerCallUrl: buildCustomerCallUrl(customerPhone),
        contractSigned: true,
        contractMessage: contractText,
        checkedOut: false,
        insuranceReturned: false,
      };

      setBookings((prev) => {
        const next = [newBooking, ...prev];
        StorageService.set(STORAGE_KEYS.BOOKINGS, next);
        return next;
      });

      // Turn dates RED (booked)
      setDateOverrides((prev) => {
        const next = { ...prev };
        const isMergedLinked =
          (prop.isMergedProperty || Boolean(prop.mergedConfig?.isMerged)) &&
          prop.mergedConfig?.mergeType === 'linked_properties';
        const linkedIds = prop.mergedConfig?.linkedPropertyIds || prop.mergedPropertyIds || [];

        sortedDates.forEach((d) => {
          const wholeIdsConfirm = wholeIdsOf(propertyId);
          if (wholeIdsConfirm.length >= 2 && (!sectionId || sectionId === 'all')) {
            const clearWait = {
              status: 'booked' as const,
              waitingDepositExpiresAt: undefined,
              waitingCustomerName: undefined,
              waitingCustomerPhone: undefined,
              waitingDepositAmount: undefined,
            };
            next[`${propertyId}_${d}`] = { ...next[`${propertyId}_${d}`], ...clearWait };
            wholeIdsConfirm.forEach((sid) => {
              next[`${propertyId}_${sid}_${d}`] = { ...next[`${propertyId}_${sid}_${d}`], ...clearWait };
            });
          } else if (isMergedLinked && linkedIds.length > 0) {
            const lockKeys = estateParts && estateParts.length > 0
              ? estateOverrideKeys(prop, estateParts, d, propertiesRef.current)
              : [propertyId, ...linkedIds].map((pid) => `${pid}_${d}`);
            lockKeys.forEach((lk) => {
              next[lk] = {
                ...next[lk],
                status: 'booked',
                waitingDepositExpiresAt: undefined,
                waitingCustomerName: undefined,
                waitingCustomerPhone: undefined,
                waitingDepositAmount: undefined,
              };
            });
          } else {
            const k = sectionId ? `${propertyId}_${sectionId}_${d}` : `${propertyId}_${d}`;
            next[k] = {
              ...next[k],
              status: 'booked',
              waitingDepositExpiresAt: undefined,
              waitingCustomerName: undefined,
              waitingCustomerPhone: undefined,
              waitingDepositAmount: undefined,
            };
          }
        });
        StorageService.set(STORAGE_KEYS.OVERRIDES, next);
        return next;
      });

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: `🎉 تأكيد حجز جديد - ${prop.name}`,
          description: `تم تأكيد الحجز ${newBooking.bookingNumber} للعميل ${customerName} واستلام الإيصال (${receiptFileName}) وإرسال العقد عبر واتساب`,
          timestamp: 'الآن',
          read: false,
          type: 'deposit_confirmed',
          targetAudience: isSupBooking ? 'admin_only' : 'all',
          linkToBookingId: newBooking.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `💰 تأكيد دفع عربون - ${prop.name}`,
        `تم استلام وتأكيد سداد العربون (${depositPaid} ريال) للعميل ${customerName} (${newBooking.bookingNumber}) واعتماد العقد!`,
        'deposit_confirmed'
      );

      const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^0/, '966');
      const whatsappContractUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(contractText)}`;

      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, newBooking).catch(() => {});
        }
      } catch {}

      return { booking: newBooking, whatsappContractUrl, contractText };
    },
    [properties, selectedProperty, marketers, currentMarketerId, bookings.length, messageTemplates.contract, triggerBrowserNotification, dateOverrides, supervisorDateOverrides]
  );

  const addBooking = useCallback(
    (params: Partial<Booking> & { propertyId: string; customerName: string; customerPhone: string; checkInDate: string; checkOutDate: string }) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const validCheckIn = params.checkInDate < todayStr ? todayStr : params.checkInDate;
      const validCheckOut =
        params.checkOutDate <= validCheckIn
          ? new Date(new Date(validCheckIn).getTime() + 86400000).toISOString().split('T')[0]
          : params.checkOutDate;

      const prop = properties.find((p) => p.id === params.propertyId) || selectedProperty;
      const marketerId = params.marketerId || (isAdmin ? undefined : currentMarketerId);
      const marketerObj = marketers.find((m) => m.id === marketerId);
      const isHamran = params.propertyId === 'hamran';

      // التحقق من التعارض لأي وحدة/عقار فيه قسمان فأكثر:
      // حجز الكامل يتطلب خلوّ كل الأقسام، وحجز قسم يتعارض مع نفس القسم أو أي حجز كامل
      const wholeIdsForBooking = wholeIdsOf(params.propertyId);
      const isFullBooking = !params.sectionId || params.sectionId === 'all';
      if (wholeIdsForBooking.length >= 2) {
        const conflict = bookings.find((b) => {
          if (b.propertyId !== params.propertyId || b.status === 'cancelled') return false;
          const overlaps = validCheckIn < b.checkOutDate && validCheckOut > b.checkInDate;
          if (!overlaps) return false;
          if (isFullBooking) return true;
          return !b.sectionId || b.sectionId === 'all' || b.sectionId === params.sectionId;
        });
        if (conflict) {
          console.warn('Booking conflict detected for multi-section booking:', conflict);
          throw new Error('Booking conflict: the whole unit requires all its sections to be available.');
        }
      }

      // Generalized Merged Property validation (خاصية الدمج المشابهة لحمران):
      const isMerged = prop.isMergedProperty || Boolean(prop.mergedConfig?.isMerged) || params.propertyId === 'hamran';
      const mergeType = prop.mergedConfig?.mergeType || (params.propertyId === 'hamran' ? 'internal_units' : (prop.mergedPropertyIds?.length ? 'linked_properties' : 'internal_units'));

      if (isMerged && params.propertyId !== 'hamran') {
        if (mergeType === 'linked_properties') {
          const linkedIds = prop.mergedConfig?.linkedPropertyIds || prop.mergedPropertyIds || [];
          if (linkedIds.length > 0) {
            // حجز كامل: كل الوحدات يجب أن تكون متاحة؛ حجز بأجزاء محددة (الكوخ + قسم): الأجزاء المختارة فقط
            const conflict = bookings.find((b) => {
              if (b.status === 'cancelled') return false;
              const overlaps = validCheckIn < b.checkOutDate && validCheckOut > b.checkInDate;
              if (!overlaps) return false;
              if (params.estateParts && params.estateParts.length > 0) {
                return params.estateParts.some((part) => bookingOccupiesPart(b, part, prop));
              }
              return b.propertyId === params.propertyId || linkedIds.includes(b.propertyId);
            });
            if (conflict) {
              const conflictProp = properties.find((p) => p.id === conflict.propertyId);
              throw new Error(`تعذر الحجز: إحدى الاستراحتين المدمجتين (${conflictProp?.name || 'العقار المدمج'}) محجوزة مسبقاً في هذا التاريخ. شرط حجز العقار المدمج أن تكون كلا الاستراحتين متاحتين معاً.`);
            }
          }
        } else if (mergeType === 'internal_units' && prop.sections && prop.sections.length >= 2) {
          // Booking full merged property requires all sub-units free!
          const isFullMerged = !params.sectionId || params.sectionId === 'all';
          const conflict = bookings.find((b) => {
            if (b.propertyId !== params.propertyId || b.status === 'cancelled') return false;
            const overlaps = validCheckIn < b.checkOutDate && validCheckOut > b.checkInDate;
            if (!overlaps) return false;
            if (isFullMerged) return true;
            return !b.sectionId || b.sectionId === 'all' || b.sectionId === params.sectionId;
          });
          if (conflict) {
            throw new Error(`تعذر الحجز: إحدى وحدات العقار المدمج محجوزة مسبقاً في هذا التاريخ. شرط حجز العقار المدمج بالكامل أن تكون كافة الوحدات متاحة معاً.`);
          }
        }
      }

      // Also: If someone is booking a normal property that is part of a parent merged property:
      const parentMergedProperties = properties.filter((p) => 
        (p.isMergedProperty || p.mergedConfig?.isMerged) && 
        (p.mergedConfig?.linkedPropertyIds?.includes(params.propertyId) || p.mergedPropertyIds?.includes(params.propertyId))
      );
      if (parentMergedProperties.length > 0) {
        const parentMergedIds = parentMergedProperties.map((p) => p.id);
        const conflict = bookings.find((b) => {
          if (b.status === 'cancelled') return false;
          const overlaps = validCheckIn < b.checkOutDate && validCheckOut > b.checkInDate;
          if (!overlaps) return false;
          if (!parentMergedIds.includes(b.propertyId)) return false;
          return estateBookingBlocksUnit(b, params.propertyId, params.sectionId && params.sectionId !== 'all' ? params.sectionId : null);
        });
        if (conflict) {
          const parentProp = properties.find((p) => p.id === conflict.propertyId);
          throw new Error(`تعذر الحجز: هذا العقار محجوز مسبقاً ضمن حجز دمج (${parentProp?.name || 'عقار مدمج'}) لنفس التاريخ.`);
        }
      }

      const sectionsForSum = (prop.sections || []).filter((sec) => wholeIdsForBooking.includes(sec.id));
      const wholeCombinedPrice = sectionsForSum.reduce((sum, sec) => sum + (Number(sec.priceWeekday) || 0), 0);
      const estateLivePrice = isLinkedEstate(prop)
        ? getEstateNightPrice(prop, propertiesRef.current, dateOverridesRef.current, params.checkInDate)
        : 0;
      const effectiveDefaultPrice =
        estateLivePrice > 0
          ? estateLivePrice
          : wholeIdsForBooking.length >= 2 && isFullBooking && wholeCombinedPrice > 0
          ? wholeCombinedPrice
          : prop.basePriceWeekday;

      const isAdminB = params.isAdminBooking || params.bookingType === 'admin';
      const isSupervisorB = Boolean(params.isSupervisorBooking || params.bookingType === 'supervisor' || params.bookingCategory === 'supervisor');
      const isSpecB = !isSupervisorB && (params.isSpecialBooking || params.bookingType === 'special');

      const supervisorObj =
        marketers.find((m) => m.id === (params.supervisorId || marketerId || currentMarketerId)) ||
        marketerObj ||
        null;

      const netTotal = (params.totalPrice || effectiveDefaultPrice) - (params.discount || 0);
      const nightsPrice = params.baseNightlyTotal || (params.totalPrice || effectiveDefaultPrice);
      const rate =
        params.commissionRatePercent === 0 || isAdminB || isSpecB
          ? 0
          : params.commissionRatePercent !== undefined && params.commissionRatePercent > 0
          ? Number(params.commissionRatePercent)
          : 5;

      const commission =
        params.marketerCommission !== undefined
          ? params.marketerCommission
          : rate === 0 || isAdminB || isSpecB
          ? 0
          : marketerObj || supervisorObj
          ? Math.round(nightsPrice * (rate / 100))
          : 0;
      const deposit = params.depositPaid || prop.defaultDeposit;
      const remaining = params.remainingAmount !== undefined ? params.remainingAmount : netTotal - deposit;
      const insurance = params.insuranceAmount || prop.insuranceAmount;

      const computedSpecialFee = (() => {
        const checkInDay = new Date(validCheckIn).getDay();
        const isWknd = checkInDay === 4 || checkInDay === 5;
        const matchedBox =
          specialAdminFeeBoxes.find(
            (box) =>
              (box.propertyId === params.propertyId || box.propertyId === 'all') &&
              box.period === (isWknd ? 'weekend' : 'weekday')
          ) ||
          specialAdminFeeBoxes.find(
            (box) => box.propertyId === params.propertyId || box.propertyId === 'all'
          );
        const specialRate = matchedBox ? matchedBox.specialAdminFee : (isWknd ? 500 : 400);
        return specialRate * Math.max(1, params.nightsCount || 1);
      })();

      const computedSupervisorFee = (() => {
        const nights = Math.max(1, params.nightsCount || 1);
        let sum = 0;
        const curr = new Date(validCheckIn);
        for (let i = 0; i < nights; i++) {
          const dStr = curr.toISOString().split('T')[0];
          const sectionKey = params.sectionId ? `${params.propertyId}_${params.sectionId}_${dStr}` : `${params.propertyId}_${dStr}`;
          const ov = supervisorDateOverrides[sectionKey] || supervisorDateOverrides[`${params.propertyId}_${dStr}`];
          if (ov?.supervisorFee !== undefined) {
            sum += Math.max(0, Number(ov.supervisorFee) || 0);
          } else {
            const checkDay = curr.getDay();
            const isWknd = checkDay === 4 || checkDay === 5;
            const matchedBox =
              specialAdminFeeBoxes.find(
                (box) =>
                  (box.propertyId === params.propertyId || box.propertyId === 'all') &&
                  box.period === (isWknd ? 'weekend' : 'weekday')
              ) ||
              specialAdminFeeBoxes.find(
                (box) => box.propertyId === params.propertyId || box.propertyId === 'all'
              );
            sum += matchedBox ? matchedBox.specialAdminFee : (isWknd ? 500 : 400);
          }
          curr.setDate(curr.getDate() + 1);
        }
        return sum;
      })();

      const computedNormalFee = (() => {
        const nights = Math.max(1, params.nightsCount || 1);
        let sum = 0;
        const curr = new Date(validCheckIn);
        for (let i = 0; i < nights; i++) {
          const dStr = curr.toISOString().split('T')[0];
          const sectionKey = params.sectionId ? `${params.propertyId}_${params.sectionId}_${dStr}` : `${params.propertyId}_${dStr}`;
          const ov = dateOverrides[sectionKey] || dateOverrides[`${params.propertyId}_${dStr}`];
          if (ov?.adminFee !== undefined) {
            sum += Math.max(0, Number(ov.adminFee) || 0);
          } else {
            const dayOfWeek = curr.getDay();
            const isWknd = dayOfWeek === 4 || dayOfWeek === 5;
            const defaultRate = isWknd ? (prop.administrativeFees?.weekend ?? 150) : (prop.administrativeFees?.weekday ?? 100);
            sum += defaultRate;
          }
          curr.setDate(curr.getDate() + 1);
        }
        return sum;
      })();

      const resolvedSupervisorFee = isSupervisorB
        ? Math.max(0, Number(params.supervisorFee ?? params.adminFee ?? computedSupervisorFee) || 0)
        : 0;

      const resolvedAdminFee =
        isSupervisorB
          ? resolvedSupervisorFee
          : params.adminFee !== undefined
          ? params.adminFee
          : isAdminB
          ? 0
          : isSpecB
          ? computedSpecialFee
          : computedNormalFee;

      const resolvedSupervisorCredit = isSupervisorB
        ? Math.max(0, Number(params.supervisorTotalCredit ?? (commission + resolvedSupervisorFee)))
        : 0;

      const newBooking: Booking = {
        id: `bk-${Date.now()}`,
        bookingNumber: `BK-2026-${100 + bookings.length + 1}`,
        propertyId: params.propertyId,
        propertyName: prop.name,
        sectionId: params.sectionId,
        sectionName: params.sectionName || (wholeIdsForBooking.length >= 2 && isFullBooking ? `كامل ${prop.name}` : undefined),
        ...(params.estateParts && params.estateParts.length > 0 ? { estateParts: params.estateParts } : {}),
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        ...(params.customerNationalId?.trim() ? { customerNationalId: params.customerNationalId.trim() } : {}),
        ...(params.vehiclePlate?.trim() ? { vehiclePlate: params.vehiclePlate.trim() } : {}),
        ...(params.guestsCount && Number(params.guestsCount) > 0 ? { guestsCount: Number(params.guestsCount) } : {}),
        checkInDate: validCheckIn,
        checkOutDate: validCheckOut,
        nightsCount: params.nightsCount || 1,
        nightlyPrice: params.nightlyPrice || effectiveDefaultPrice,
        totalPrice: netTotal,
        adminFee: resolvedAdminFee,
        propertyNetPayout:
          params.propertyNetPayout !== undefined
            ? params.propertyNetPayout
            : (isAdminB
                ? netTotal
                : isSupervisorB
                ? Math.max(0, netTotal - commission - resolvedSupervisorFee)
                : isSpecB
                ? Math.max(0, netTotal - resolvedAdminFee)
                : Math.max(0, netTotal - commission - resolvedAdminFee)),
        taxAmount: 0,
        discount: params.discount || 0,
        depositPaid: deposit,
        remainingAmount: remaining,
        insuranceAmount: insurance,
        ...(params.depositReceiptUrl ? { depositReceiptUrl: params.depositReceiptUrl } : {}),
        ...(params.depositReceiptName ? { depositReceiptName: params.depositReceiptName } : {}),
        ...(params.receiptFileName ? { receiptFileName: params.receiptFileName } : {}),
        ...(params.receiptDataUrl ? { receiptDataUrl: params.receiptDataUrl } : {}),
        breakfastOption: params.breakfastOption,
        breakfastPrice: params.breakfastPrice || 0,
        coordinatorName: params.coordinatorName,
        coordinatorPhone: params.coordinatorPhone,
        coordinatorService: params.coordinatorService,
        coordinatorPrice: params.coordinatorPrice || 0,
        coordinatorServicesList: params.coordinatorServicesList,
        marketerId: isSupervisorB ? (params.supervisorId || marketerObj?.id || supervisorObj?.id) : marketerObj?.id,
        marketerName: isSupervisorB ? (params.supervisorName || marketerObj?.name || supervisorObj?.name || 'Supervisor') : marketerObj?.name,
        marketerCommission: commission,
        commissionRatePercent: rate,
        bookingType: isAdminB ? 'admin' : isSupervisorB ? 'supervisor' : isSpecB ? 'special' : (rate === 7 ? 'full' : 'partial'),
        bookingCategory: isAdminB ? 'admin' : isSupervisorB ? 'supervisor' : isSpecB ? 'special' : 'standard',
        isSpecialBooking: isSpecB || undefined,
        isSupervisorBooking: isSupervisorB || undefined,
        supervisorId: isSupervisorB ? (params.supervisorId || marketerObj?.id || supervisorObj?.id || 'admin-supervisor') : undefined,
        supervisorName: isSupervisorB ? (params.supervisorName || supervisorObj?.name || 'الإدارة / Supervisor') : undefined,
        supervisorFee: isSupervisorB ? resolvedSupervisorFee : undefined,
        supervisorTotalCredit: isSupervisorB ? resolvedSupervisorCredit : undefined,
        isAdminBooking: isAdminB || undefined,
        customAdminNightlyPrice: params.customAdminNightlyPrice,
        commissionStatus: 'pending',
        status: 'confirmed',
        createdAt: new Date().toISOString().split('T')[0],
        notes: params.notes || '',
        customerWhatsappUrl: buildCustomerWhatsappUrl(
          params.customerPhone,
          `مرحباً أ/ ${params.customerName}، تم تأكيد حجزكم في ${prop.name} بتاريخ ${params.checkInDate}.`
        ),
        customerCallUrl: buildCustomerCallUrl(params.customerPhone),
        contractSigned: true,
        checkedOut: false,
        insuranceReturned: false,
      };

      setBookings((prev) => {
        const next = [newBooking, ...prev];
        StorageService.set(STORAGE_KEYS.BOOKINGS, next);
        return next;
      });

      // Automatically sync dates in calendar overrides:
      // If full Hamran, full Al-Taraf, or linked merged property was booked, lock all linked dates together!
      const linkedIdsForBooking =
        isMerged && mergeType === 'linked_properties'
          ? prop.mergedConfig?.linkedPropertyIds || prop.mergedPropertyIds || []
          : [];

      setDateOverrides((prev) => {
        const next = { ...prev };
        const curr = new Date(validCheckIn);
        const end = new Date(validCheckOut);
        while (curr < end) {
          const dStr = curr.toISOString().split('T')[0];
          if (wholeIdsForBooking.length >= 2 && isFullBooking) {
            next[`${params.propertyId}_${dStr}`] = { ...next[`${params.propertyId}_${dStr}`], status: 'booked' };
            wholeIdsForBooking.forEach((sid) => {
              next[`${params.propertyId}_${sid}_${dStr}`] = { ...next[`${params.propertyId}_${sid}_${dStr}`], status: 'booked' };
            });
          } else if (linkedIdsForBooking.length > 0) {
            estateOverrideKeys(prop, params.estateParts, dStr, propertiesRef.current).forEach((k) => {
              next[k] = { ...next[k], status: 'booked' };
            });
          } else if (params.sectionId) {
            next[`${params.propertyId}_${params.sectionId}_${dStr}`] = {
              ...next[`${params.propertyId}_${params.sectionId}_${dStr}`],
              status: 'booked',
            };
          } else {
            next[`${params.propertyId}_${dStr}`] = {
              ...next[`${params.propertyId}_${dStr}`],
              status: 'booked',
            };
          }
          curr.setDate(curr.getDate() + 1);
        }
        StorageService.set(STORAGE_KEYS.OVERRIDES, next);
        return next;
      });

      setNotifications((prev) => {
        const newNotifs: AppNotification[] = [
          {
            id: `notif-${Date.now()}`,
            title: `🎉 حجز جديد - ${prop.name}`,
            description: `تم استلام حجز جديد برقم ${newBooking.bookingNumber} للعميل ${params.customerName} بقيمة ${netTotal} ر.س`,
            timestamp: 'الآن',
            read: false,
            type: 'booking',
            propertyId: params.propertyId,
            targetAudience: 'all',
            linkToBookingId: newBooking.id,
          },
        ];
        if (params.coordinatorService && params.coordinatorName) {
          newNotifs.unshift({
            id: `notif-coord-${Date.now()}`,
            title: `💐 طلب تجهيز منسقة جديد - ${prop.name}`,
            description: `تم طلب خدمة (${params.coordinatorService}) للمنسقة ${params.coordinatorName} مع حجز ${newBooking.bookingNumber} بتاريخ ${validCheckIn}`,
            timestamp: 'الآن',
            read: false,
            type: 'booking',
            propertyId: params.propertyId,
            targetAudience: 'coordinators',
            linkToBookingId: newBooking.id,
          });
        }
        return [...newNotifs, ...prev];
      });

      triggerBrowserNotification(
        `🎉 استلام حجز جديد - ${prop.name}`,
        `تم استلام حجز جديد (${newBooking.bookingNumber}) للعميل ${params.customerName} بقيمة ${netTotal} ر.س ومسوق: ${marketerObj?.name || 'مباشر'}`,
        'booking'
      );

      // Auto-sync to connected Google Sheets / AppSheet if enabled
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, newBooking).catch((err) => {
            console.warn('Auto-sync to Google Sheets failed:', err);
          });
        }
      } catch (err) {
        console.warn('Auto-sync check failed:', err);
      }

      return newBooking;
    },
    [properties, selectedProperty, isAdmin, currentMarketerId, marketers, bookings, triggerBrowserNotification, specialAdminFeeBoxes, dateOverrides, supervisorDateOverrides]
  );

  const updateBookingContractFields = useCallback(
    (
      bookingId: string,
      fields: { customerNationalId?: string; vehiclePlate?: string; guestsCount?: number }
    ) => {
      setBookings((prev) => {
        const next = prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            ...(fields.customerNationalId !== undefined
              ? { customerNationalId: fields.customerNationalId.trim() || undefined }
              : {}),
            ...(fields.vehiclePlate !== undefined
              ? { vehiclePlate: fields.vehiclePlate.trim() || undefined }
              : {}),
            ...(fields.guestsCount !== undefined
              ? { guestsCount: fields.guestsCount > 0 ? Number(fields.guestsCount) : undefined }
              : {}),
          };
        });
        StorageService.set(STORAGE_KEYS.BOOKINGS, next);
        return next;
      });
    },
    []
  );

  const updateBookingStatus = useCallback(
    (id: string, status: Booking['status']) => {
      const currentTarget = bookingsRef.current.find((b) => b.id === id) || null;
      const updatedTarget: Booking | null = currentTarget
        ? (() => {
            const hasCredit = (currentTarget.marketerCommission || 0) + (currentTarget.supervisorFee || 0) > 0;
            const nextCommStatus =
              status === 'completed' && (currentTarget.marketerId || currentTarget.supervisorId) && hasCredit
                ? 'ready_for_payout'
                : currentTarget.commissionStatus;
            return { ...currentTarget, status, commissionStatus: nextCommStatus };
          })()
        : null;

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const hasCredit = (b.marketerCommission || 0) + (b.supervisorFee || 0) > 0;
          const nextCommStatus = status === 'completed' && (b.marketerId || b.supervisorId) && hasCredit ? 'ready_for_payout' : b.commissionStatus;
          return { ...b, status, commissionStatus: nextCommStatus };
        })
      );

      if (updatedTarget) {
        const b = updatedTarget;
        const statusLabels: Record<string, string> = {
          confirmed: 'مؤكد',
          waiting_deposit: 'قيد الانتظار',
          pending: 'قيد الانتظار',
          pending_payment: 'قيد الانتظار',
          cancelled: 'ملغي',
          completed: 'مكتمل',
        };
        const label = statusLabels[status] || status;
        logActivity(
          isGuard ? 'حارس العقار' : isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
          userRole,
          'تحديث حالة الحجز',
          `تم تغيير حالة الحجز ${b.bookingNumber} (${b.propertyName}) إلى: ${label}`
        );

        // Synchronize dateOverrides (including full Hamran, Al-Taraf, and merged linked properties)
        const bookedProp = properties.find((p) => p.id === b.propertyId);
        const linkedIdsForStatus =
          bookedProp && (bookedProp.isMergedProperty || bookedProp.mergedConfig?.isMerged) && bookedProp.mergedConfig?.mergeType === 'linked_properties'
            ? bookedProp.mergedConfig?.linkedPropertyIds || bookedProp.mergedPropertyIds || []
            : [];

        setDateOverrides((prev) => {
          const next = { ...prev };
          if (b.checkInDate && b.checkOutDate) {
            const start = new Date(b.checkInDate);
            const end = new Date(b.checkOutDate);
            const curr = new Date(start);
            const applyStatus = (key: string) => {
              if (status === 'cancelled') {
                if (next[key]?.status === 'booked' || next[key]?.status === 'waiting_deposit') {
                  next[key] = { ...next[key], status: 'available' };
                }
              } else if (status === 'confirmed') {
                next[key] = { ...next[key], status: 'booked' };
              } else if (status === 'waiting_deposit' || status === 'pending') {
                next[key] = { ...next[key], status: 'waiting_deposit' };
              }
            };
            while (curr < end) {
              const dStr = curr.toISOString().split('T')[0];
              const wholeIdsStatus = wholeIdsOf(b.propertyId);
              if (wholeIdsStatus.length >= 2 && (!b.sectionId || b.sectionId === 'all')) {
                applyStatus(`${b.propertyId}_${dStr}`);
                wholeIdsStatus.forEach((sid) => applyStatus(`${b.propertyId}_${sid}_${dStr}`));
              } else if (linkedIdsForStatus.length > 0) {
                [b.propertyId, ...linkedIdsForStatus].forEach((pid) => applyStatus(`${pid}_${dStr}`));
              } else {
                const k = b.sectionId ? `${b.propertyId}_${b.sectionId}_${dStr}` : `${b.propertyId}_${dStr}`;
                applyStatus(k);
              }
              curr.setDate(curr.getDate() + 1);
            }
          }
          StorageService.set(STORAGE_KEYS.OVERRIDES, next);
          return next;
        });

        triggerBrowserNotification(
          'تحديث حالة الحجز',
          `تم تغيير حالة الحجز ${b.bookingNumber} للعميل ${b.customerName} إلى (${label}) بنجاح.`,
          'system'
        );

        try {
          const sheetInfo = getSavedSpreadsheetInfo();
          if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
            appendBookingToSheet(sheetInfo.spreadsheetId, updatedTarget).catch(() => {});
          }
        } catch {}
      }
    },
    [properties, isGuard, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const cancelBooking = useCallback(
    (id: string) => {
      updateBookingStatus(id, 'cancelled');
    },
    [updateBookingStatus]
  );

  const payMarketerCommission = useCallback((bookingId: string) => {
    const existing = bookingsRef.current.find((b) => b.id === bookingId);
    const updatedBooking = existing ? clearBookingReceiptsAfterCommissionPaid(existing) : null;
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? clearBookingReceiptsAfterCommissionPaid(b) : b))
    );
    if (updatedBooking) {
      logActivity(
        'الإدارة',
        userRole,
        'تحويل عمولة وحذف الإيصالات تلقائياً',
        `تم تحويل عمولة الحجز ${updatedBooking.bookingNumber} وحذف إيصالاته البنكية المحفوظة تلقائياً.`
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, updatedBooking).catch(() => {});
        }
      } catch {}
    }
  }, [logActivity, userRole]);

  const payoutAllMarketerCommissions = useCallback((marketerId: string) => {
    const updatedList = bookingsRef.current
      .filter(
        (b) =>
          (b.marketerId === marketerId || b.supervisorId === marketerId) &&
          isBookingCheckedOut(b) &&
          (b.commissionStatus === 'ready_for_payout' || b.commissionStatus === 'pending')
      )
      .map((b) => clearBookingReceiptsAfterCommissionPaid(b));

    setBookings((prev) =>
      prev.map((b) => {
        if (
          (b.marketerId === marketerId || b.supervisorId === marketerId) &&
          isBookingCheckedOut(b) &&
          (b.commissionStatus === 'ready_for_payout' || b.commissionStatus === 'pending')
        ) {
          return clearBookingReceiptsAfterCommissionPaid(b);
        }
        return b;
      })
    );
    if (updatedList.length > 0) {
      logActivity(
        'الإدارة',
        userRole,
        'صرف عمولات وحذف الإيصالات تلقائياً',
        `تم صرف عمولات (${updatedList.length}) حجز وحذف إيصالاتها البنكية تلقائياً.`
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          updatedList.forEach((bk) => {
            appendBookingToSheet(sheetInfo.spreadsheetId!, bk).catch(() => {});
          });
        }
      } catch {}
    }
  }, [logActivity, userRole]);

  const payoutSupervisorBalance = useCallback((supervisorId: string) => {
    const updatedList = bookingsRef.current
      .filter(
        (b) =>
          (b.isSupervisorBooking || b.bookingType === 'supervisor' || b.bookingCategory === 'supervisor') &&
          (b.supervisorId === supervisorId || b.marketerId === supervisorId) &&
          isBookingCheckedOut(b) &&
          b.commissionStatus !== 'paid'
      )
      .map((b) => clearBookingReceiptsAfterCommissionPaid(b));

    setBookings((prev) =>
      prev.map((b) => {
        if (
          (b.isSupervisorBooking || b.bookingType === 'supervisor' || b.bookingCategory === 'supervisor') &&
          (b.supervisorId === supervisorId || b.marketerId === supervisorId) &&
          isBookingCheckedOut(b) &&
          b.commissionStatus !== 'paid'
        ) {
          return clearBookingReceiptsAfterCommissionPaid(b);
        }
        return b;
      })
    );
    if (updatedList.length > 0) {
      logActivity(
        'الإدارة',
        userRole,
        'صرف رصيد المشرف وحذف الإيصالات تلقائياً',
        `تم صرف رصيد (${updatedList.length}) حجز للمشرف وحذف إيصالاتها البنكية تلقائياً.`
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          updatedList.forEach((bk) => {
            appendBookingToSheet(sheetInfo.spreadsheetId!, bk).catch(() => {});
          });
        }
      } catch {}
    }
  }, [logActivity, userRole]);

  const sendCheckoutReminder = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      const prop = properties.find((p) => p.id === bk?.propertyId) || selectedProperty;
      const defaultCheckoutTpl = `عذراً عن الإزعاج ومنعاً للإحراج، نود تذكيركم أخي الكريم {اسم_العميل} بأن موعد تسجيل الخروج اليوم من ({اسم_العقار}) في تمام {وقت_الخروج}.
⚠️ نرجو التكرم بالاستعداد للخروج في الوقت المحدد لتفادي أي خصم من مبلغ التأمين كما هو موضح في العقد المبرم، ولإتاحة المجال للحارس ({اسم_الحارس}) لمعاينة وتجهيز المكان.
شاكرين لكم حسن تعاونكم وممتنين لاختياركم لنا 🌿`;

      const rawTpl = messageTemplates.checkoutReminder || defaultCheckoutTpl;

      const msg = fillTemplate(rawTpl, {
        اسم_العميل: bk?.customerName || '',
        رقم_الجوال: bk?.customerPhone || '',
        اسم_العقار: bk?.propertyName || prop.name,
        وقت_الخروج: prop.checkOutTimeText || 'الساعة 2 م',
        مبلغ_التأمين: bk?.insuranceAmount || prop.insuranceAmount || 500,
        اسم_الحارس: prop.assignedGuardName || guard.name || 'أبو راشد',
      });

      const cleanPhone = (bk?.customerPhone || '0550000000').replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, checkoutReminderSent: true, checkoutReminderSentAt: timeStr }
            : b
        )
      );

      logActivity(
        isAdmin ? 'الإدارة' : isGuard ? guard.name : currentMarketer?.name || 'المسوقة',
        userRole,
        'إرسال تذكير خروج (المسوقة)',
        `تم إرسال تذكير الخروج والتحذير من خصم التأمين عبر واتساب للعميل ${bk?.customerName} لعقار ${bk?.propertyName}`
      );

      return { whatsappUrl, message: msg };
    },
    [bookings, properties, selectedProperty, messageTemplates.checkoutReminder, logActivity, isAdmin, isGuard, guard.name, currentMarketer?.name, userRole]
  );

  const sendPaymentCompletionRequest = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return { whatsappUrl: '', message: '' };
      const prop = properties.find((p) => p.id === bk.propertyId) || selectedProperty;

      const totalRequired = (bk.remainingAmount || 0) + (bk.insurancePaymentMethod ? 0 : bk.insuranceAmount);

      const defaultPaymentCompletionTpl = `أهلاً وسهلاً بك أخي الكريم {اسم_العميل} 🌿
يسعدنا استقبالكم في ({اسم_العقار}). وحرصاً على سرعة تسليمكم المفتاح وتجهيز الدخول، نرجو التكرم بسداد إكمال المتبقي والتأمين:

📋 *تفاصيل الحساب المالي المطلوب:*
• رقم الحجز: {رقم_الحجز}
• المبلغ المتبقي للإقامة: *{المبلغ_المتبقي} ريال*
• مبلغ التأمين المسترد: *{مبلغ_التأمين} ريال*
• إجمالي المطلوب سداده الآن: *{المجموع_المطلوب} ريال*

🏦 *بيانات الحساب البنكي المعتمد للتحويل:*
• اسم البنك: {اسم_البنك}
• المستفيد: {اسم_الحساب}
• رقم الآيبان (IBAN):
*{رقم_الآيبان}*

💡 *ملاحظة:*
في حال تفضيلكم دفع مبلغ التأمين نقداً، يمكنكم تسليمه مباشرة للحارس ({اسم_الحارس}) عند البوابة.
نتمنى لكم إقامة سعيدة وممتعة! ✨`;

      const rawTpl = messageTemplates.paymentCompletion || defaultPaymentCompletionTpl;

      const msg = fillTemplate(rawTpl, {
        اسم_العميل: bk.customerName,
        رقم_الجوال: bk.customerPhone,
        اسم_العقار: bk.propertyName,
        رقم_الحجز: bk.bookingNumber,
        تاريخ_الدخول: bk.checkInDate,
        وقت_الدخول: prop.checkInTimeText,
        تاريخ_الخروج: bk.checkOutDate,
        وقت_الخروج: prop.checkOutTimeText,
        عدد_الليالي: bk.nightsCount,
        المبلغ_الإجمالي: bk.totalPrice,
        مبلغ_العربون: bk.depositPaid,
        المبلغ_المتبقي: bk.remainingAmount,
        مبلغ_التأمين: bk.insuranceAmount,
        المجموع_المطلوب: totalRequired,
        اسم_البنك: prop.bankName,
        اسم_الحساب: prop.accountHolder,
        رقم_الآيبان: prop.iban,
        اسم_الحارس: prop.assignedGuardName || guard.name || 'أبو راشد',
      });

      const cleanPhone = (bk.customerPhone || '0550000000').replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

      logActivity(
        isAdmin ? 'الإدارة' : isGuard ? guard.name : currentMarketer?.name || 'المسوقة',
        userRole,
        'إرسال رسالة إكمال المتبقي والتأمين عبر واتساب',
        `تم إرسال طلب إكمال المتبقي (${bk.remainingAmount} ريال) والتأمين (${bk.insuranceAmount} ريال) عبر واتساب للعميل ${bk.customerName} لحجز ${bk.bookingNumber}`
      );

      return { whatsappUrl, message: msg };
    },
    [bookings, properties, selectedProperty, messageTemplates.paymentCompletion, logActivity, isAdmin, isGuard, guard.name, currentMarketer?.name, userRole]
  );

  const sendCoordinatorWhatsAppNotification = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return null;
      const prop = properties.find((p) => p.id === bk.propertyId) || selectedProperty;

      const coordName = bk.coordinatorName || (bk.coordinatorServicesList && bk.coordinatorServicesList[0]?.coordinatorName) || 'المنسقة';
      const coordPhone = bk.coordinatorPhone || (bk.coordinatorServicesList && bk.coordinatorServicesList[0]?.coordinatorPhone) || '0550000000';
      const servicesListStr = bk.coordinatorServicesList && bk.coordinatorServicesList.length > 0
        ? bk.coordinatorServicesList.map((s) => `${s.title} (${s.price} ر.س)`).join(' + ')
        : (bk.coordinatorService || 'خدمة تنسيق المناسبات');
      const totalServicesPrice = bk.coordinatorPrice || (bk.coordinatorServicesList ? bk.coordinatorServicesList.reduce((sum, s) => sum + s.price, 0) : 0);

      const rawTpl = messageTemplates.coordinatorService || INITIAL_TEMPLATES.coordinatorService || '';
      const msg = fillTemplate(rawTpl, {
        اسم_المنسقة: coordName,
        اسم_العقار: bk.propertyName || prop.name,
        رقم_الحجز: bk.bookingNumber,
        تاريخ_الحجز: bk.checkInDate,
        وقت_الدخول: prop.checkInTimeText || 'الساعة 4:00 عصراً',
        الساعة: prop.checkInTimeText || 'الساعة 4:00 عصراً',
        اسم_العميل: bk.customerName,
        جوال_العميل: bk.customerPhone,
        الخدمة_المطلوبة: servicesListStr,
        سعر_الخدمة: totalServicesPrice,
      });

      const cleanPhone = coordPhone.replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'مسوق',
        userRole,
        'إرسال إشعار للمنسقة عبر واتساب',
        `تم تجهيز وإرسال تفاصيل حجز ${bk.bookingNumber} وخدمات التنسيق إلى المنسقة ${coordName}`
      );

      return {
        whatsappUrl,
        message: msg,
        coordinatorName: coordName,
        coordinatorPhone: coordPhone,
      };
    },
    [bookings, properties, selectedProperty, messageTemplates.coordinatorService, logActivity, isAdmin, currentMarketer?.name, userRole]
  );

  const markCheckedOut = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                checkedOut: true,
                checkedOutAt: timeStr,
                stayEvents: [...(b.stayEvents || []).filter((e) => e.type !== 'checked_out'), { type: 'checked_out' as const, at: timeStr, date: new Date().toISOString().split('T')[0], by: 'النظام', byRole: 'guard' as const }],
                status: 'completed',
                commissionStatus:
                  b.commissionStatus === 'paid'
                    ? 'paid'
                    : (b.marketerId || b.supervisorId) && ((b.marketerCommission || 0) + (b.supervisorFee || 0)) > 0
                    ? 'ready_for_payout'
                    : b.commissionStatus,
              }
            : b
        )
      );

      setNotifications((prev) => [
        ...(bk.marketerId
          ? [
              {
                id: `notif-empcheckout-${Date.now()}`,
                title: `🚪 خرج العميل - ${bk.propertyName}`,
                description: `خرج العميل (${bk.customerName}) من عقار ${bk.propertyName} في تمام الساعة ${timeStr}.`,
                timestamp: 'الآن',
                read: false,
                type: 'checkout' as const,
                targetAudience: 'marketer' as const,
                targetMarketerId: bk.marketerId,
                propertyId: bk.propertyId,
                linkToBookingId: bk.id,
              },
            ]
          : []),
        {
          id: `notif-checkout-${Date.now()}`,
          title: `🚪 تم خروج النزيل - ${bk.propertyName}`,
          description: `أكد النزيل (${bk.customerName}) خروجه من عقار ${bk.propertyName} في تمام الساعة ${timeStr} وجاري معاينة المكان من قبل الحارس.`,
          timestamp: 'الآن',
          read: false,
          type: 'checkout' as const,
          targetAudience: 'admin_and_guard' as const,
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      logActivity(
        isAdmin ? 'الإدارة' : isGuard ? guard.name : 'موظف',
        userRole,
        'تسجيل خروج النزيل',
        `تم تسجيل خروج العميل ${bk.customerName} من عقار ${bk.propertyName} وإشعار الحارس والإدارة والموظف.`
      );
    },
    [bookings, logActivity, isAdmin, isGuard, guard.name, userRole]
  );

  /** إشعار وصول العميل: يصل لمسوق الحجز والإدارة (والحارس المسؤول عن العقار) فقط */
  const pushArrivalAlert = useCallback(
    (bk: Booking, actor: string, actorRole: 'guard' | 'admin' | 'marketer' | 'coordinator', timeStr: string) => {
      const roleLabel = actorRole === 'guard' ? 'الحارس' : actorRole === 'admin' ? 'الإدارة' : 'الموظف';
      const needsPayment = (bk.remainingAmount || 0) > 0;
      setNotifications((prev) => [
        {
          id: `notif-arrived-${bk.id}-${Date.now()}`,
          title: `🚪 وصل العميل ${bk.customerName} - ${bk.propertyName}`,
          description: `أكّد ${roleLabel} (${actor}) وصول العميل (${bk.customerName}) إلى (${bk.propertyName}) في تمام الساعة ${timeStr}، حجز رقم ${bk.bookingNumber}.${
            needsPayment ? ` المتبقي على العميل ${bk.remainingAmount} ر.س، يُرجى من مسوق الحجز (${bk.marketerName || 'المسؤول'}) إكمال المتبقي والتأمين.` : ''
          }`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'all',
          targetMarketerId: bk.marketerId,
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
          priority: 'high' as any,
        },
        ...prev,
      ]);
      triggerBrowserNotification(
        `🚪 وصل العميل ${bk.customerName} - ${bk.propertyName}`,
        `أكّد ${roleLabel} (${actor}) الوصول الساعة ${timeStr}${bk.marketerName ? ` - للمسوق ${bk.marketerName}` : ''}`
      );
    },
    [triggerBrowserNotification]
  );

  const confirmAttendanceByGuard = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                guestArrived: true,
                guestArrivedAt: timeStr,
                arrivalConfirmedAt: timeStr,
                arrivalConfirmedBy: guard.name || 'الحارس',
                stayEvents: [
                  { type: 'arrived' as const, at: timeStr, date: new Date().toISOString().split('T')[0], by: guard.name || 'الحارس', byRole: 'guard' as const },
                  ...(b.stayEvents || []).filter((e) => e.type !== 'arrived'),
                ],
              }
            : b
        )
      );

      pushArrivalAlert(bk, guard.name || 'الحارس', 'guard', timeStr);

      logActivity(
        guard.name || 'الحارس',
        'guard',
        'تأكيد الحضور من الحارس',
        `أكّد الحارس ${guard.name || 'الحارس'} حضور العميل ${bk.customerName} إلى ${bk.propertyName} في تمام ${timeStr} وتم إرسال إشعار فوري للمسوقة.`
      );
    },
    [bookings, logActivity, guard.name, pushArrivalAlert]
  );

  const guardMarkArrived = confirmAttendanceByGuard;

  const notifyGuardForCashPayment = useCallback(
    (params: {
      bookingId: string;
      notes?: string;
    }) => {
      const { bookingId, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const remainingPrev = bk.remainingAmount;

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            depositPaid: b.depositPaid + remainingPrev,
            remainingAmount: 0,
            paymentCompleted: true,
            paymentCompletedAt: timeStr,
            paymentCompletedBy: actor,
            arrivalPaymentMethod: 'cash',
            notes: notes ? (b.notes ? `${b.notes} | ${notes}` : notes) : b.notes,
          };
        })
      );

      setNotifications((prev) => [
        {
          id: `notif-cash-guard-${Date.now()}`,
          title: `🚨 تنبيه للحارس: توجه لاستلام المبلغ كاش (${remainingPrev} ر.س) - ${bk.propertyName}`,
          description: `تنبيه من المسوقة (${actor}): يرجى من الحارس (${guard.name}) التوجه فوراً للعميل (${bk.customerName} - جوال: ${bk.customerPhone}) في (${bk.propertyName}) لاستلام المبلغ المتبقي كاش وقدره (${remainingPrev} ريال).`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `🚨 تنبيه للحارس: استلام كاش (${remainingPrev} ر.س)`,
        `يرجى التوجه للعميل (${bk.customerName}) في (${bk.propertyName}) لاستلام المبلغ المتبقي كاش وقدره (${remainingPrev} ريال).`
      );

      logActivity(
        actor,
        userRole,
        'إشعار الحارس لاستلام المتبقي كاش',
        `تم إشعار الحارس ${guard.name} بالتوجه لاستلام المبلغ المتبقي (${remainingPrev} ريال) كاش من العميل ${bk.customerName}.`
      );
    },
    [bookings, isAdmin, guard.name, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const approveCleanlinessAndExit = useCallback(
    (params: {
      bookingId: string;
      result: 'full_refund' | 'deduction';
      deductionAmount?: number;
      damageDescription?: string;
      damagePhotos?: { name: string; dataUrl: string }[];
      notes?: string;
    }) => {
      const { bookingId, result, deductionAmount = 0, damageDescription, damagePhotos, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const isRefund = result === 'full_refund';

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            checkedOut: true,
            checkedOutAt: timeStr,
            stayEvents: [...(b.stayEvents || []).filter((e) => e.type !== 'checked_out'), { type: 'checked_out' as const, at: timeStr, date: new Date().toISOString().split('T')[0], by: 'النظام', byRole: 'guard' as const }],
            cleanlinessApproved: true,
            cleanlinessApprovedAt: timeStr,
            cleanlinessApprovedBy: guard.name || 'الحارس',
            status: 'completed',
            commissionStatus:
              b.commissionStatus === 'paid'
                ? 'paid'
                : (b.marketerId || b.supervisorId) && ((b.marketerCommission || 0) + (b.supervisorFee || 0)) > 0
                ? 'ready_for_payout'
                : b.commissionStatus,
            guardInspectionResult: result,
            insuranceReturned: isRefund,
            insuranceReturnedAt: isRefund ? timeStr : undefined,
            insuranceDeductionAmount: isRefund ? 0 : deductionAmount,
            damageDescription: isRefund ? undefined : damageDescription,
            damagePhotos: isRefund ? undefined : damagePhotos,
            notes: notes ? (b.notes ? `${b.notes} | ${notes}` : notes) : b.notes,
          };
        })
      );

      // Send notifications to marketer and admin
      if (isRefund) {
        setNotifications((prev) => [
          {
            id: `notif-checkout-clean-${Date.now()}`,
            title: `✨ تأكيد النظافة والخروج وإغلاق الحجز - ${bk.propertyName}`,
            description: `أكّد الحارس (${guard.name || 'الحارس'}) نظافة الاستراحة تماماً وخروج العميل (${bk.customerName}) في تمام الساعة ${timeStr}، وتم إغلاق دورة الحجز بنجاح وإعادة مبلغ التأمين كاملاً (${bk.insuranceAmount} ر.س).`,
            timestamp: 'الآن',
            read: false,
            type: 'checkout',
            targetAudience: 'all',
            targetMarketerId: bk.marketerId,
            propertyId: bk.propertyId,
            linkToBookingId: bk.id,
          },
          ...prev,
        ]);
        triggerBrowserNotification(
          `✨ تأكيد النظافة والخروج - ${bk.propertyName}`,
          `الاستراحة نظيفة وسليمة، وتم تأكيد خروج العميل (${bk.customerName}) وإعادة التأمين (${bk.insuranceAmount} ر.س).`
        );
      } else {
        setNotifications((prev) => [
          {
            id: `notif-checkout-damage-${Date.now()}`,
            title: `⚠️ تأكيد الخروج مع خصم أضرار (${deductionAmount} ر.س) - ${bk.propertyName}`,
            description: `أكّد الحارس (${guard.name || 'الحارس'}) خروج العميل (${bk.customerName}) مع رصد ملاحظات أضرار: ${damageDescription || 'تلفيات بالاستراحة'}، وتم تقرير خصم مبلغ (${deductionAmount} ر.س) من التأمين مع إرفاق صور التوثيق وإغلاق دورة الحجز.`,
            timestamp: 'الآن',
            read: false,
            type: 'checkout',
            targetAudience: 'all',
            targetMarketerId: bk.marketerId,
            propertyId: bk.propertyId,
            linkToBookingId: bk.id,
          },
          ...prev,
        ]);
        triggerBrowserNotification(
          `⚠️ خروج مع خصم أضرار (${deductionAmount} ر.س) - ${bk.propertyName}`,
          `تم رصد أضرار: ${damageDescription || 'تلفيات'}، وخصم (${deductionAmount} ر.س) مع إرفاق صور التوثيق وإغلاق الحجز.`
        );
      }

      logActivity(
        guard.name || 'الحارس',
        userRole,
        isRefund ? 'تأكيد النظافة والخروج وإعادة التأمين' : 'تأكيد الخروج مع خصم أضرار',
        isRefund
          ? `أكّد الحارس ${guard.name || 'الحارس'} نظافة الاستراحة وخروج العميل ${bk.customerName} من ${bk.propertyName} وإغلاق دورة الحجز وإعادة التأمين (${bk.insuranceAmount} ريال).`
          : `أكّد الحارس ${guard.name || 'الحارس'} خروج العميل ${bk.customerName} من ${bk.propertyName} مع خصم أضرار (${deductionAmount} ريال) وإغلاق دورة الحجز.`
      );
    },
    [bookings, guard.name, userRole, logActivity, triggerBrowserNotification]
  );

  const guardProcessDeparture = approveCleanlinessAndExit;

  const toggleAdminCommissionApproval = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const willApprove = !bk.adminApprovedFullBooking;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const newRate = willApprove ? 7 : 5;
      const calendarNightlyTotal = bk.baseNightlyTotal || (bk.nightsCount > 0 && bk.nightlyPrice > 0 ? bk.nightlyPrice * bk.nightsCount : bk.totalPrice);
      const newCommission = Math.round(calendarNightlyTotal * (newRate / 100));

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            adminApprovedFullBooking: willApprove,
            adminApprovedAt: willApprove ? timeStr : undefined,
            adminApprovedBy: willApprove ? 'الإدارة' : undefined,
            commissionRatePercent: newRate,
            marketerCommission: newCommission,
            bookingType: willApprove ? 'full' : 'partial',
          };
        })
      );

      if (willApprove) {
        setNotifications((prev) => [
          {
            id: `notif-comm7-${Date.now()}`,
            title: `🌟 موافقة الإدارة: اعتماد نسبة 7% (حجز كامل) - ${bk.propertyName}`,
            description: `وافقت الإدارة على اعتماد الحجز (${bk.bookingNumber}) للعميل (${bk.customerName}) كـ "حجز كامل" واحتساب عمولة المسوقة بنسبة 7% بمبلغ (${newCommission} ر.س) من الصافي بعد الرسوم الإدارية.`,
            timestamp: 'الآن',
            read: false,
            type: 'booking',
            targetAudience: 'all',
            linkToBookingId: bk.id,
          },
          ...prev,
        ]);
        triggerBrowserNotification(
          `🌟 اعتماد نسبة 7% (حجز كامل)`,
          `وافقت الإدارة على اعتماد نسبة 7% بمبلغ (${newCommission} ر.س) للمسوقة (${bk.marketerName || 'المسؤولة'}).`
        );
      }

      logActivity(
        'الإدارة',
        userRole,
        willApprove ? 'موافقة الإدارة على نسبة 7% (حجز كامل)' : 'إلغاء اعتماد نسبة 7% والعودة لـ 5%',
        `تم ${willApprove ? 'اعتماد' : 'إلغاء اعتماد'} نسبة 7% لحجز ${bk.bookingNumber} للعميل ${bk.customerName}، العمولة المحدثة: ${newCommission} ريال.`
      );
    },
    [bookings, userRole, logActivity, triggerBrowserNotification]
  );

  const uploadRemainingPaymentReceipt = useCallback(
    (params: {
      bookingId: string;
      receiptName: string;
      receiptDataUrl: string;
      notes?: string;
    }) => {
      const { bookingId, receiptName, receiptDataUrl, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const updatedBookingForSheet: Booking = {
        ...bk,
        remainingReceiptName: receiptName,
        remainingReceiptDataUrl: receiptDataUrl,
        depositPaid: bk.depositPaid + bk.remainingAmount,
        remainingAmount: 0,
        paymentCompleted: true,
        paymentCompletedAt: timeStr,
        paymentCompletedBy: actor,
        arrivalPaymentMethod: 'receipt',
        paymentReceiptName: receiptName,
        paymentReceiptDataUrl: receiptDataUrl,
        notes: notes ? (bk.notes ? `${bk.notes} | إيصال المتبقي: ${notes}` : `إيصال المتبقي: ${notes}`) : bk.notes,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? updatedBookingForSheet : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, updatedBookingForSheet).catch(() => {});
        }
      } catch {}

      setNotifications((prev) => [
        {
          id: `notif-remaining-receipt-${Date.now()}`,
          title: `💳 تنبيه للإدارة: رفع إيصال سداد المتبقي - ${bk.propertyName}`,
          description: `رفعت المسوقة (${actor}) صورة إيصال سداد المتبقي للعميل (${bk.customerName}) بمبلغ (${bk.remainingAmount} ر.س) في (${bk.propertyName}). تم حفظ الإيصال للمراجعة.`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `💳 إيصال سداد المتبقي: ${bk.propertyName}`,
        `تم رفع صورة إيصال سداد المتبقي للعميل (${bk.customerName}) بنجاح.`
      );

      logActivity(
        actor,
        userRole,
        'رفع إيصال سداد المتبقي',
        `تم رفع إيصال سداد المتبقي لحجز ${bk.bookingNumber} للعميل ${bk.customerName}.`
      );
    },
    [bookings, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  /** تنبيه سريع بنص جاهز: من الحارس إلى مسوق الحجز، أو من المسوق/الإدارة إلى حارس العقار (والإدارة ترى الكل) */
  const sendQuickAlert = useCallback(
    (params: { bookingId: string; to: 'guard' | 'marketer'; title: string; text: string }) => {
      const bk = bookings.find((b) => b.id === params.bookingId);
      if (!bk) return;
      const actor = isGuard ? guard.name || 'الحارس' : isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوق';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      setNotifications((prev) => [
        {
          id: `notif-quick-${bk.id}-${Date.now()}`,
          title: `${params.title} - ${bk.propertyName}`,
          description: `${params.text}\n— من ${actor} · ${timeStr}`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: params.to === 'guard' ? 'admin_and_guard' : 'all',
          ...(params.to === 'marketer' ? { targetMarketerId: bk.marketerId } : {}),
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
          priority: 'high' as any,
        },
        ...prev,
      ]);
      setBookings((prev) =>
        prev.map((b) => (b.id === bk.id ? { ...b, lastAlert: { text: params.text, at: timeStr, by: actor, to: params.to } } : b))
      );
      triggerBrowserNotification(`${params.title} - ${bk.propertyName}`, params.text);
      logActivity(actor, userRole, 'تنبيه سريع', `${actor} أرسل تنبيهاً (${params.title}) بخصوص حجز ${bk.bookingNumber} - ${bk.customerName}.`);
    },
    [bookings, isGuard, guard.name, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const toggleGuestArrivalStatus = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return { isArrived: false };
      const currentlyArrived = Boolean(bk.guestArrived || bk.arrivalConfirmedAt);
      const willBeArrived = !currentlyArrived;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const actor = isGuard ? (guard.name || 'الحارس') : isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';

      const todayIso = new Date().toISOString().split('T')[0];
      const actorRole = isGuard ? 'guard' : isAdmin ? 'admin' : 'marketer';
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          const others = (b.stayEvents || []).filter((e) => e.type !== 'arrived');
          return {
            ...b,
            guestArrived: willBeArrived,
            guestArrivedAt: willBeArrived ? timeStr : undefined,
            arrivalConfirmedAt: willBeArrived ? timeStr : undefined,
            arrivalConfirmedBy: willBeArrived ? actor : undefined,
            stayEvents: willBeArrived
              ? [{ type: 'arrived' as const, at: timeStr, date: todayIso, by: actor, byRole: actorRole as 'guard' | 'admin' | 'marketer' }, ...others]
              : others,
          };
        })
      );

      if (willBeArrived) pushArrivalAlert(bk, actor, actorRole as 'guard' | 'admin' | 'marketer', timeStr);

      logActivity(
        actor,
        userRole,
        willBeArrived ? 'تأكيد وصول النزيل' : 'إعادة حالة النزيل لانتظار الوصول',
        `تم ${willBeArrived ? 'تأكيد وصول' : 'إلغاء تأكيد وصول'} العميل ${bk.customerName} لحجز ${bk.bookingNumber}.`
      );

      return { isArrived: willBeArrived };
    },
    [bookings, isGuard, guard.name, isAdmin, currentMarketer?.name, userRole, logActivity, pushArrivalAlert]
  );

  const requestInsuranceRefundViaBank = useCallback(
    (params: {
      bookingId: string;
      bankReceiptName?: string;
      bankReceiptDataUrl?: string;
      customerIban?: string;
      notes?: string;
    }) => {
      const { bookingId, bankReceiptName, bankReceiptDataUrl, customerIban, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';

      const updatedRefundBooking: Booking = {
        ...bk,
        insuranceRefundRequested: true,
        customerBankReceiptName: bankReceiptName || bk.customerBankReceiptName,
        customerBankReceiptUrl: bankReceiptDataUrl || bk.customerBankReceiptUrl,
        customerIban: customerIban || bk.customerIban,
        notes: notes ? (bk.notes ? `${bk.notes} | طلب استرداد بنكي: ${notes}` : `طلب استرداد بنكي: ${notes}`) : bk.notes,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? updatedRefundBooking : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, updatedRefundBooking).catch(() => {});
        }
      } catch {}

      setNotifications((prev) => [
        {
          id: `notif-refund-bank-${Date.now()}`,
          title: `🏦 تنبيه للإدارة: طلب استرداد تأمين بنكي - ${bk.propertyName}`,
          description: `تم رفع صورة الحساب/الآيبان لتحويل تأمين العميل (${bk.customerName}) بمبلغ (${bk.insuranceAmount} ر.س) لحجز (${bk.bookingNumber}). يُرجى تحويل المبلغ وتأكيد العملية.`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `🏦 طلب استرداد تأمين بنكي: ${bk.propertyName}`,
        `تم حفظ صورة الحساب وإرسال تنبيه للإدارة لتحويل التأمين (${bk.customerName}).`
      );

      logActivity(
        actor,
        userRole,
        'طلب استرداد تأمين بنكي',
        `تم رفع بيانات حساب العميل ${bk.customerName} لتحويل التأمين (${bk.insuranceAmount} ر.س).`
      );
    },
    [bookings, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const requestInsuranceRefundViaGuardCash = useCallback(
    (params: {
      bookingId: string;
      notes?: string;
    }) => {
      const { bookingId, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';
      const deduction = bk.insuranceDeductionAmount || 0;
      const refundAmount = Math.max(0, bk.insuranceAmount - deduction);

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            insuranceRefundRequested: true,
            notes: notes ? (b.notes ? `${b.notes} | توجيه تسليم كاش للحارس: ${notes}` : `توجيه تسليم كاش للحارس: ${notes}`) : b.notes,
          };
        })
      );

      setNotifications((prev) => [
        {
          id: `notif-refund-guard-${Date.now()}`,
          title: `💵 تنبيه للحارس: تسليم التأمين كاش للنزيل (${refundAmount} ر.س) - ${bk.propertyName}`,
          description: `توجيه من (${actor}): يرجى من الحارس (${guard.name}) تسليم مبلغ التأمين كاش وقدره (${refundAmount} ر.س) للعميل (${bk.customerName} - جوال: ${bk.customerPhone}) عند الخروج.`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `💵 توجيه للحارس: تسليم تأمين كاش (${refundAmount} ر.س)`,
        `يرجى تسليم مبلغ التأمين نقداً للنزيل (${bk.customerName}) عند الخروج.`
      );

      logActivity(
        actor,
        userRole,
        'توجيه الحارس لتسليم التأمين كاش',
        `تم إرسال توجيه للحارس ${guard.name} لتسليم التأمين (${refundAmount} ريال) كاش للعميل ${bk.customerName}.`
      );
    },
    [bookings, isAdmin, currentMarketer?.name, guard.name, userRole, logActivity, triggerBrowserNotification]
  );

  const finishBookingAndReturnInsurance = useCallback(
    (params: {
      bookingId: string;
      receiptName?: string;
      receiptDataUrl?: string;
      notes?: string;
    }) => {
      const { bookingId, receiptName, receiptDataUrl, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const finishedBookingForSheet: Booking = {
        ...bk,
        status: 'completed' as BookingStatus,
        commissionStatus:
          bk.commissionStatus === 'paid'
            ? 'paid'
            : (bk.marketerId || bk.supervisorId) && ((bk.marketerCommission || 0) + (bk.supervisorFee || 0)) > 0
            ? 'ready_for_payout'
            : bk.commissionStatus,
        checkedOut: true,
        checkedOutAt: bk.checkedOutAt || timeStr,
        stayEvents: [...(bk.stayEvents || []).filter((e) => e.type !== 'checked_out'), { type: 'checked_out' as const, at: timeStr, date: new Date().toISOString().split('T')[0], by: 'النظام', byRole: 'guard' as const }],
        insuranceReturned: true,
        insuranceReturnedAt: timeStr,
        insuranceRefundReceiptName: receiptName || bk.insuranceRefundReceiptName,
        insuranceRefundReceiptUrl: receiptDataUrl || bk.insuranceRefundReceiptUrl,
        notes: notes ? (bk.notes ? `${bk.notes} | إنهاء الحجز: ${notes}` : `إنهاء الحجز: ${notes}`) : bk.notes,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? finishedBookingForSheet : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, finishedBookingForSheet).catch(() => {});
        }
      } catch {}

      setNotifications((prev) => [
        {
          id: `notif-finish-booking-${Date.now()}`,
          title: `✅ إنهاء الحجز بنجاح: #${bk.bookingNumber} - ${bk.propertyName}`,
          description: `تم إنهاء الحجز للعميل (${bk.customerName}) وتوثيق تسليم وإرجاع التأمين (${bk.insuranceAmount} ر.س) بنجاح بواسطة (${actor}).`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `✅ إنهاء الحجز #${bk.bookingNumber}`,
        `تم إنهاء الحجز للعميل (${bk.customerName}) وتوثيق التأمين بنجاح.`
      );

      logActivity(
        actor,
        userRole,
        'إنهاء الحجز وتوثيق التأمين',
        `تم إنهاء دورة الحجز ${bk.bookingNumber} وتوثيق التأمين المسترد للعميل ${bk.customerName}.`
      );
    },
    [bookings, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const confirmCashInsuranceByGuard = useCallback(
    (params: string | { bookingId: string; receivedAmount?: number; notes?: string }) => {
      const bookingId = typeof params === 'string' ? params : params.bookingId;
      const customAmount = typeof params === 'string' ? undefined : params.receivedAmount;
      const customNotes = typeof params === 'string' ? undefined : params.notes;

      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const finalAmount = customAmount !== undefined ? customAmount : bk.insuranceAmount;

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                insuranceReceivedCash: true,
                cashInsuranceConfirmedByGuard: true,
                insurancePaymentMethod: 'cash',
                insuranceReceived: true,
                insuranceReceivedAmount: finalAmount,
                insuranceReceivedAt: timeStr,
                insuranceReceivedBy: guard.name || 'حارس العقار',
                notes: customNotes ? (b.notes ? `${b.notes} | استلام كاش: ${customNotes}` : `استلام كاش: ${customNotes}`) : b.notes,
              }
            : b
        )
      );

      setNotifications((prev) => [
        {
          id: `notif-insrecv-${Date.now()}`,
          title: `💵 تأكيد استلام التأمين كاش (${finalAmount} ر.س) - ${bk.propertyName}`,
          description: `أكّد الحارس (${guard.name || 'الحارس'}) رسمياً استلام مبلغ التأمين (${finalAmount} ريال) نقداً (كاش) من العميل (${bk.customerName}) وتم إثباته وتوثيقه بالنظام للإدارة والمسوقة.`,
          timestamp: 'الآن',
          read: false,
          type: 'insurance',
          targetAudience: 'all',
          targetMarketerId: bk.marketerId,
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `💵 تأكيد استلام التأمين كاش (${finalAmount} ر.س) - ${bk.propertyName}`,
        `استلم الحارس (${guard.name || 'الحارس'}) مبلغ التأمين (${finalAmount} ر.س) نقداً (كاش) من العميل (${bk.customerName})`
      );

      logActivity(
        guard.name || 'الحارس',
        'guard',
        'تأكيد استلام التأمين كاش رسمياً',
        `أكّد الحارس ${guard.name || 'الحارس'} استلام مبلغ التأمين (${finalAmount} ريال) كاش من العميل ${bk.customerName} وتم تسجيله رسمياً بالنظام وإشعار الإدارة والمسوقة.`
      );
    },
    [bookings, logActivity, guard.name, triggerBrowserNotification]
  );

  const guardReceiveInsurance = confirmCashInsuranceByGuard;

  const notifyGuardForCashInsurance = useCallback(
    (params: {
      bookingId: string;
      insuranceAmount?: number;
      notes?: string;
    }) => {
      const { bookingId, insuranceAmount, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const targetInsuranceAmount = insuranceAmount !== undefined ? insuranceAmount : bk.insuranceAmount;

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            insurancePaymentMethod: 'cash',
            insurancePendingCashCollection: true,
            insuranceNotifiedToGuardAt: timeStr,
            notes: notes ? (b.notes ? `${b.notes} | إشعار الحارس للتأمين: ${notes}` : `إشعار الحارس للتأمين: ${notes}`) : b.notes,
          };
        })
      );

      setNotifications((prev) => [
        {
          id: `notif-cash-ins-guard-${Date.now()}`,
          title: `🛡️ إشعار للحارس: استلام التأمين كاش (${targetInsuranceAmount} ر.س) - ${bk.propertyName}`,
          description: `إشعار من المسوقة (${actor}): العميل (${bk.customerName} - جوال: ${bk.customerPhone}) سيقوم بدفع مبلغ التأمين كاش وقدره (${targetInsuranceAmount} ريال) للحارس (${guard.name || 'أبو راشد'}). يرجى التوجه لاستلامه وتأكيده بالنظام.`,
          timestamp: 'الآن',
          read: false,
          type: 'insurance',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `🛡️ تنبيه للحارس: استلام تأمين كاش (${targetInsuranceAmount} ر.س)`,
        `توجه للعميل (${bk.customerName}) في ${bk.propertyName} لاستلام التأمين كاش وقدره (${targetInsuranceAmount} ريال).`
      );

      logActivity(
        actor,
        userRole,
        'إشعار الحارس باستلام التأمين كاش',
        `تم إشعار الحارس ${guard.name} بمبلغ التأمين (${targetInsuranceAmount} ريال) كاش المطلوب تحصيله من العميل ${bk.customerName} في ${bk.propertyName}.`
      );
    },
    [bookings, isAdmin, guard.name, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const uploadDigitalInsuranceReceipt = useCallback(
    (params: {
      bookingId: string;
      receiptName: string;
      receiptDataUrl: string;
      notes?: string;
    }) => {
      const { bookingId, receiptName, receiptDataUrl, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : currentMarketer?.name || 'المسوقة';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      const updatedInsBooking: Booking = {
        ...bk,
        insurancePaymentMethod: 'receipt',
        insuranceReceiptName: receiptName,
        insuranceReceiptDataUrl: receiptDataUrl,
        digitalInsuranceReceiptName: receiptName,
        digitalInsuranceReceiptUrl: receiptDataUrl,
        insuranceReceivedAt: timeStr,
        insuranceUploadedBy: actor,
        insuranceUploadedAt: timeStr,
        notes: notes ? (bk.notes ? `${bk.notes} | ${notes}` : notes) : bk.notes,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? updatedInsBooking : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, updatedInsBooking).catch(() => {});
        }
      } catch {}

      setNotifications((prev) => [
        {
          id: `notif-ins-digital-${Date.now()}`,
          title: `🛡️ تم توثيق إيصال التأمين بنكياً - ${bk.propertyName}`,
          description: `قامت المسوقة (${actor}) برفع وتوثيق إيصال تحويل التأمين البنكي (${bk.insuranceAmount} ريال) للعميل (${bk.customerName}). لا حاجة لمطالبة العميل بالتأمين كاش من قبل الحارس.`,
          timestamp: 'الآن',
          read: false,
          type: 'insurance',
          targetAudience: 'all',
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `🛡️ اعتماد إيصال التأمين البنكي - ${bk.propertyName}`,
        `تم توثيق إيصال تحويل التأمين (${bk.insuranceAmount} ر.س) للعميل (${bk.customerName}) بنجاح`
      );

      logActivity(
        actor,
        userRole,
        'رفع واعتماد إيصال تحويل التأمين البنكي',
        `قامت المسوقة ${actor} برفع وتوثيق إيصال تحويل التأمين (${bk.insuranceAmount} ريال) للعميل ${bk.customerName}.`
      );
    },
    [bookings, isAdmin, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const guardRequestInsuranceReturn = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk || bk.insuranceReturnRequested) return;

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, insuranceReturnRequested: true } : b))
      );

      setNotifications((prev) => [
        {
          id: `notif-insreturnreq-${Date.now()}`,
          title: `🔔 جاهز لإعادة التأمين - ${bk.propertyName}`,
          description: `خرج العميل (${bk.customerName}) من عقار ${bk.propertyName} والتأمين (${bk.insuranceAmount} ريال) جاهز للإعادة بعد معاينة العقار.`,
          timestamp: 'الآن',
          read: false,
          type: 'insurance',
          targetAudience: bk.marketerId ? 'marketer' : 'admin_only',
          targetMarketerId: bk.marketerId,
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      logActivity(
        isAdmin ? 'الإدارة' : isGuard ? guard.name : 'موظف',
        userRole,
        'تنبيه الموظف لإعادة التأمين',
        `تم إرسال تنبيه للموظف لإعادة تأمين العميل ${bk.customerName} (${bk.insuranceAmount} ريال).`
      );
    },
    [bookings, logActivity, isAdmin, isGuard, guard.name, userRole]
  );

  const returnInsuranceDeposit = useCallback(
    (bookingId: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, insuranceReturned: true, insuranceReturnedAt: timeStr } : b
        )
      );

      setNotifications((prev) => [
        ...(bk.marketerId
          ? [
              {
                id: `notif-empinsret-${Date.now()}`,
                title: `💵 تمت إعادة التأمين كاش للعميل - ${bk.propertyName}`,
                description: `أعاد الحارس مبلغ التأمين (${bk.insuranceAmount} ريال) كاش للعميل ${bk.customerName} بعد معاينة عقار ${bk.propertyName} في تمام الساعة ${timeStr}.`,
                timestamp: 'الآن',
                read: false,
                type: 'insurance' as const,
                targetAudience: 'marketer' as const,
                targetMarketerId: bk.marketerId,
                propertyId: bk.propertyId,
                linkToBookingId: bk.id,
              },
            ]
          : []),
        {
          id: `notif-insurance-${Date.now()}`,
          title: `💵 تم تسليم وإرجاع التأمين - ${bk.propertyName}`,
          description: `تم استرجاع وتسليم مبلغ التأمين (${bk.insuranceAmount} ريال) للعميل ${bk.customerName} بعد فحص عقار ${bk.propertyName} والتأكد من خلوه من أي تلفيات.`,
          timestamp: 'الآن',
          read: false,
          type: 'insurance' as const,
          targetAudience: 'admin_only' as const,
          propertyId: bk.propertyId,
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      logActivity(
        isAdmin ? 'الإدارة' : isGuard ? guard.name : 'موظف',
        userRole,
        'تسليم التأمين للعميل',
        `تم تسليم مبلغ التأمين (${bk.insuranceAmount} ريال) للعميل ${bk.customerName} وإشعار الإدارة والموظف.`
      );
    },
    [bookings, logActivity, isAdmin, isGuard, guard.name, userRole]
  );

  const completeBookingPayment = useCallback(
    (bookingId: string, receiptName: string, receiptDataUrl?: string) => {
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : isGuard ? guard.name : currentMarketer?.name || 'موظف';
      const dateStr = new Date().toISOString().split('T')[0];

      const paidBookingForSheet: Booking = {
        ...bk,
        depositPaid: bk.depositPaid + bk.remainingAmount,
        remainingAmount: 0,
        paymentCompleted: true,
        paymentReceiptName: receiptName,
        paymentReceiptDataUrl: receiptDataUrl,
        paymentCompletedAt: dateStr,
        paymentCompletedBy: actor,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? paidBookingForSheet : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, paidBookingForSheet).catch(() => {});
        }
      } catch {}

      setNotifications((prev) => [
        {
          id: `notif-payment-${Date.now()}`,
          title: `✅ تم إكمال الدفع - ${bk.propertyName}`,
          description: `أكمل العميل ${bk.customerName} سداد المبلغ المتبقي (${bk.remainingAmount} ريال) لحجز ${bk.bookingNumber} بإيصال بنكي مرفق (${receiptName}) - سجّله ${actor}.`,
          timestamp: 'الآن',
          read: false,
          type: 'booking',
          targetAudience: 'admin_only',
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      logActivity(
        actor,
        userRole,
        'إكمال دفع حجز بإيصال بنكي',
        `تم إكمال دفع حجز ${bk.bookingNumber} للعميل ${bk.customerName} وإرفاق الإيصال: ${receiptName}.`
      );
    },
    [bookings, isAdmin, isGuard, guard.name, currentMarketer?.name, userRole, logActivity]
  );

  const recordCustomerArrival = useCallback(
    (params: {
      bookingId: string;
      paymentMethod: 'receipt' | 'cash';
      receiptName?: string;
      receiptDataUrl?: string;
      notes?: string;
    }) => {
      const { bookingId, paymentMethod, receiptName, receiptDataUrl, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : isGuard ? guard.name : currentMarketer?.name || 'المسوق';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const methodLabel = paymentMethod === 'receipt' ? 'إيصال بنكي مرفق' : 'دفع كاش مباشر';
      const remainingPrev = bk.remainingAmount;

      const updatedArrivalBooking: Booking = {
        ...bk,
        guestArrived: true,
        guestArrivedAt: timeStr,
        stayEvents: [
          { type: 'arrived' as const, at: timeStr, date: new Date().toISOString().split('T')[0], by: actor || 'الموظف', byRole: (isAdmin ? 'admin' : isGuard ? 'guard' : 'marketer') as 'admin' | 'guard' | 'marketer' },
          ...(bk.stayEvents || []).filter((e) => e.type !== 'arrived'),
        ],
        arrivalPaymentMethod: paymentMethod,
        ...(remainingPrev > 0
          ? {
              depositPaid: bk.depositPaid + remainingPrev,
              remainingAmount: 0,
              paymentCompleted: true,
              paymentCompletedAt: timeStr,
              paymentCompletedBy: actor,
              paymentReceiptName: receiptName || bk.paymentReceiptName,
              paymentReceiptDataUrl: receiptDataUrl || bk.paymentReceiptDataUrl,
            }
          : {}),
        notes: notes ? (bk.notes ? `${bk.notes} | ${notes}` : notes) : bk.notes,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? updatedArrivalBooking : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, updatedArrivalBooking).catch(() => {});
        }
      } catch {}

      pushArrivalAlert(bk, actor || 'الموظف', isAdmin ? 'admin' : isGuard ? 'guard' : 'marketer', timeStr);

      logActivity(
        actor,
        userRole,
        'تسجيل وصول العميل وإشعار الحارس والإدارة',
        `تم تسجيل وصول العميل ${bk.customerName} في ${bk.propertyName} وسداد المتبقي (${remainingPrev} ريال) عبر ${methodLabel}.`
      );
    },
    [bookings, isAdmin, isGuard, guard.name, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification, pushArrivalAlert]
  );

  const recordInsuranceReceived = useCallback(
    (params: {
      bookingId: string;
      paymentMethod: 'receipt' | 'cash';
      receiptName?: string;
      receiptDataUrl?: string;
      notes?: string;
    }) => {
      const { bookingId, paymentMethod, receiptName, receiptDataUrl, notes } = params;
      const bk = bookings.find((b) => b.id === bookingId);
      if (!bk) return;

      const actor = isAdmin ? 'الإدارة' : isGuard ? guard.name : currentMarketer?.name || 'المسوق';
      const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const methodLabel = paymentMethod === 'receipt' ? 'إيصال بنكي مرفق' : 'دفع كاش مباشر';

      const updatedInsRecvBooking: Booking = {
        ...bk,
        insuranceReceivedCash: paymentMethod === 'cash',
        insurancePaymentMethod: paymentMethod,
        insuranceReceiptName: receiptName,
        insuranceReceiptDataUrl: receiptDataUrl,
        insuranceReceivedAt: timeStr,
        notes: notes ? (bk.notes ? `${bk.notes} | ${notes}` : notes) : bk.notes,
      };
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? updatedInsRecvBooking : b))
      );
      try {
        const sheetInfo = getSavedSpreadsheetInfo();
        if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
          appendBookingToSheet(sheetInfo.spreadsheetId, updatedInsRecvBooking).catch(() => {});
        }
      } catch {}

      setNotifications((prev) => [
        {
          id: `notif-ins-recv-${Date.now()}`,
          title: `🛡️ استلام مبلغ التأمين - ${bk.propertyName}`,
          description: `تم تأكيد استلام مبلغ التأمين (${bk.insuranceAmount} ريال) للعميل (${bk.customerName}) في ${bk.propertyName} عبر: ${methodLabel}. تم إشعار الحارس والإدارة فوراً.`,
          timestamp: 'الآن',
          read: false,
          type: 'insurance',
          targetAudience: 'all',
          linkToBookingId: bk.id,
        },
        ...prev,
      ]);

      triggerBrowserNotification(
        `🛡️ استلام التأمين - ${bk.propertyName}`,
        `استلام تأمين (${bk.insuranceAmount} ريال) للعميل (${bk.customerName}) عبر ${methodLabel}`
      );

      logActivity(
        actor,
        userRole,
        'استلام وتأكيد مبلغ التأمين',
        `تم تأكيد استلام تأمين العميل ${bk.customerName} (${bk.insuranceAmount} ريال) عبر ${methodLabel} وإشعار الحارس والإدارة.`
      );
    },
    [bookings, isAdmin, isGuard, guard.name, currentMarketer?.name, userRole, logActivity, triggerBrowserNotification]
  );

  const markNotificationsAsRead = useCallback(() => {
    const key = currentUserReadKeyRef.current;
    const audCtx: NotificationAudienceContext = {
      isAdmin: userRoleRef.current === 'admin',
      isGuard: userRoleRef.current === 'guard',
      isCoordinator: userRoleRef.current === 'coordinator',
      activeGuardId: activeGuard.id,
      guardPropertyIds,
      currentCoordinatorId,
      currentCoordinatorName: currentCoordinator?.name,
      currentMarketerId,
      bookings: bookingsRef.current,
      marketers: marketersRef.current,
    };

    const visibleIds = new Set(
      notificationsRef.current.filter((n) => isNotificationVisibleToActor(n, audCtx)).map((n) => n.id)
    );
    if (visibleIds.size === 0) return;

    setLocalReadNotifIds((prev) => {
      const set = new Set(prev);
      visibleIds.forEach((id) => set.add(`${key}::${id}`));
      return Array.from(set).slice(-300);
    });

    setNotifications((prev) =>
      prev.map((n) => {
        if (!visibleIds.has(n.id)) return n;
        const nextReadBy = Array.from(new Set([...(n.readBy || []), key]));
        return { ...n, read: false, readBy: nextReadBy };
      })
    );
  }, [activeGuard.id, guardPropertyIds, currentCoordinatorId, currentCoordinator?.name, currentMarketerId]);

  const getEligibleCommissionBookings = useCallback(
    (marketerId: string, fromDate: string, toDate: string): Booking[] => {
      // Exclude booking IDs that are part of ANY pending or already-transferred requests
      const requestedOrPaidBookingIds = new Set(
        commissionRequests
          .filter((r) => r.status === 'pending' || r.status === 'transferred')
          .flatMap((r) => r.bookingIds)
      );

      const isSup = Boolean(marketers.find((m) => m.id === marketerId)?.isSupervisor);
      return bookings.filter(
        (b) =>
          (b.marketerId === marketerId || (isSup && b.supervisorId === marketerId)) &&
          b.status !== 'cancelled' &&
          isBookingCheckedOut(b) &&
          b.commissionStatus !== 'paid' &&
          !requestedOrPaidBookingIds.has(b.id) &&
          b.checkInDate >= fromDate &&
          b.checkInDate <= toDate
      );
    },
    [bookings, commissionRequests, marketers]
  );

  const createCommissionRequest = useCallback(
    ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
      const targetMarketer = marketers.find((m) => m.id === currentMarketerId);
      if (!targetMarketer) {
        return { ok: false, message: 'لم يتم العثور على حساب الموظف' };
      }
      if (!fromDate || !toDate || fromDate > toDate) {
        return { ok: false, message: 'اختر فترة زمنية صحيحة (تاريخ البداية قبل النهاية)' };
      }

      // Check if there is already an existing request (pending or transferred) covering overlapping dates
      const overlappingReq = commissionRequests.find(
        (r) =>
          r.marketerId === targetMarketer.id &&
          (r.status === 'pending' || r.status === 'transferred') &&
          fromDate <= r.toDate &&
          toDate >= r.fromDate
      );
      if (overlappingReq) {
        const statusText = overlappingReq.status === 'transferred' ? 'تم تحويله وصرفه سابقاً' : 'قيد المراجعة والتدقيق';
        return {
          ok: false,
          message: `لا يمكن طلب عمولة لنفس التاريخ: يوجد طلب سابق (${statusText}) للفترة من ${overlappingReq.fromDate} إلى ${overlappingReq.toDate}.`,
        };
      }

      const eligible = getEligibleCommissionBookings(targetMarketer.id, fromDate, toDate);
      if (eligible.length === 0) {
        return { ok: false, message: 'لا توجد حجوزات مؤكدة جديدة مستحقة العمولة في هذه الفترة' };
      }

      const isSupReq = Boolean(targetMarketer.isSupervisor);
      const supParts = isSupReq ? sumSupervisorPayout(eligible, properties, specialAdminFeeBoxes) : null;
      const totalComm = supParts ? supParts.total : eligible.reduce((sum, b) => sum + (b.marketerCommission || 0), 0);
      if (totalComm <= 0) {
        return { ok: false, message: 'لا يوجد مبلغ مستحق في هذه الفترة' };
      }
      const newReq: CommissionRequest = {
        ...(supParts
          ? { kind: 'supervisor' as const, adminFeeAmount: supParts.adminFee, supervisorFeeAmount: supParts.supervisorFee, percentAmount: supParts.percent }
          : {}),
        id: `creq-${Date.now()}`,
        marketerId: targetMarketer.id,
        marketerName: targetMarketer.name,
        fromDate,
        toDate,
        bookingIds: eligible.map((b) => b.id),
        amount: totalComm,
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0],
      };

      setCommissionRequests((prev) => [newReq, ...prev]);

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: `${isSupReq ? 'طلب صرف مستحقات مشرف' : 'طلب صرف عمولة جديد'} - ${targetMarketer.name}`,
          description: `طلب ${isSupReq ? 'المشرف' : 'المسوق'} ${targetMarketer.name} صرف ${totalComm} ريال عن ${eligible.length} حجز للفترة من ${fromDate} إلى ${toDate}. بانتظار التدقيق.`,
          timestamp: 'الآن',
          read: false,
          type: 'commission',
          targetAudience: 'admin_only',
        },
        ...prev,
      ]);

      return {
        ok: true,
        message: `تم إرسال طلب ${isSupReq ? 'الصرف' : 'العمولة'} (${totalComm} ريال) للإدارة للتدقيق`,
      };
    },
    [marketers, currentMarketerId, getEligibleCommissionBookings, commissionRequests, properties, specialAdminFeeBoxes]
  );

  const markCommissionTransferred = useCallback(
    (requestId: string, receiptFileName?: string, receiptDataUrl?: string) => {
      const req = commissionRequests.find((r) => r.id === requestId);
      if (!req) return;

      setCommissionRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'transferred',
                processedAt: new Date().toISOString().split('T')[0],
                receiptFileName,
                receiptDataUrl,
                seenByMarketer: false,
              }
            : r
        )
      );

      // Mark associated bookings as paid and automatically delete their stored bank receipts
      const cleanedBookingsForSheet = bookingsRef.current
        .filter((b) => req.bookingIds.includes(b.id))
        .map((b) => clearBookingReceiptsAfterCommissionPaid(b));

      setBookings((prev) =>
        prev.map((b) => {
          if (!req.bookingIds.includes(b.id)) return b;
          return clearBookingReceiptsAfterCommissionPaid(b);
        })
      );

      if (cleanedBookingsForSheet.length > 0) {
        logActivity(
          'الإدارة',
          userRole,
          'تحويل عمولة وحذف الإيصالات تلقائياً',
          `تم تحويل عمولة المسوق ${req.marketerName} (${req.amount} ريال) وحذف الإيصالات البنكية لـ (${cleanedBookingsForSheet.length}) حجز تلقائياً.`
        );
        try {
          const sheetInfo = getSavedSpreadsheetInfo();
          if (sheetInfo.connected && sheetInfo.autoSync && sheetInfo.spreadsheetId) {
            cleanedBookingsForSheet.forEach((bk) => {
              appendBookingToSheet(sheetInfo.spreadsheetId!, bk).catch(() => {});
            });
          }
        } catch {}
      }

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'تم تحويل عمولتك',
          description: `حوّلت الإدارة عمولتك (${req.amount} ريال) للفترة من ${req.fromDate} إلى ${req.toDate}. تم حذف إيصالات الحجوزات تلقائياً ويمكنك الاطلاع على إيصال تحويل العمولة من صفحة المزيد.`,
          timestamp: 'الآن',
          read: false,
          type: 'commission',
          targetAudience: 'marketer',
          targetMarketerId: req.marketerId,
        },
        ...prev,
      ]);
    },
    [commissionRequests, logActivity, userRole]
  );

  const rejectCommissionRequest = useCallback(
    (requestId: string, note?: string) => {
      const req = commissionRequests.find((r) => r.id === requestId);
      if (!req) return;

      setCommissionRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'rejected',
                processedAt: new Date().toISOString().split('T')[0],
                adminNote: note || '',
                seenByMarketer: false,
              }
            : r
        )
      );

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'تم رفض طلب العمولة',
          description: `تم رفض طلب العمولة للفترة من ${req.fromDate} إلى ${req.toDate}.${note ? ' السبب: ' + note : ''}`,
          timestamp: 'الآن',
          read: false,
          type: 'commission',
          targetAudience: 'marketer',
          targetMarketerId: req.marketerId,
        },
        ...prev,
      ]);
    },
    [commissionRequests]
  );

  const markCommissionRequestSeen = useCallback((requestId: string) => {
    setCommissionRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, seenByMarketer: true } : r))
    );
  }, []);

  const addExpense = useCallback(
    (expense: Omit<PropertyExpense, 'id' | 'createdAt'>) => {
      const newExp: PropertyExpense = {
        ...expense,
        id: `exp-${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        createdBy: isAdmin ? 'الإدارة' : currentMarketer?.name || 'موظف',
      };
      setExpenses((prev) => [newExp, ...prev]);
      logActivity(
        isAdmin ? 'الإدارة' : currentMarketer?.name || 'موظف',
        userRole,
        'إضافة مصروف تشغيلي',
        `تم تسجيل مصروف بقيمة ${expense.amount} ر.س (${expense.title}) لعقار ${expense.propertyName}.`
      );
    },
    [isAdmin, currentMarketer?.name, userRole, logActivity]
  );

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateMessageTemplates = useCallback((templates: Partial<MessageTemplates>) => {
    setMessageTemplates((prev) => ({ ...prev, ...templates }));
  }, []);

  const resetMessageTemplates = useCallback(() => {
    setMessageTemplates(INITIAL_TEMPLATES);
  }, []);

  const openTemplatesModal = useCallback((tab?: keyof MessageTemplates) => {
    if (tab && (tab as string) !== 'bookingConfirmation') {
      setActiveTemplateTab(tab);
    } else if (tab) {
      setActiveTemplateTab('depositRequest');
    }
    setTemplatesModalOpen(true);
  }, []);

  const sendAdminBroadcast = useCallback(
    (params: {
      title: string;
      content: string;
      targetGroup: BroadcastTargetGroup;
      targetGroupName?: string;
      targetPropertyId?: string;
      targetPropertyName?: string;
      targetGuardId?: string;
      targetGuardIds?: string[];
      targetMarketerIds?: string[];
      targetCoordinatorIds?: string[];
      priority: BroadcastPriority;
      category: BroadcastCategory;
      effectiveDate?: string;
      sendWhatsapp?: boolean;
    }) => {
      const broadcastId = `bc-${Date.now()}`;
      const nowStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const todayDateStr = new Date().toISOString().split('T')[0];

      let groupLabel = params.targetGroupName;
      if (!groupLabel) {
        if (params.targetGroup === 'all') groupLabel = 'الجميع (المسوقون والمنسقات والحراس)';
        else if (params.targetGroup === 'all_marketers') groupLabel = 'جميع المسوقات والمسوقين';
        else if (params.targetGroup === 'all_guards') groupLabel = 'جميع حراس العقارات';
        else if (params.targetGroup === 'specific_guard') groupLabel = `حارس عقار ${params.targetPropertyName || ''}`;
        else if (params.targetGroup === 'female_marketers') groupLabel = 'فريق مسوقات حمران';
        else if (params.targetGroup === 'coordinators') groupLabel = 'فريق المنسقات الميدانيات';
        else if (params.targetGroup === 'custom') groupLabel = 'أعضاء محددون بالاسم';
      }

      const newBroadcast: AdminBroadcastMessage = {
        id: broadcastId,
        title: params.title,
        content: params.content,
        targetGroup: params.targetGroup,
        targetGroupName: groupLabel || 'الجميع',
        targetPropertyId: params.targetPropertyId,
        targetPropertyName: params.targetPropertyName,
        targetGuardId: params.targetGuardId,
        targetGuardIds: params.targetGuardIds,
        targetMarketerIds: params.targetMarketerIds,
        targetCoordinatorIds: params.targetCoordinatorIds,
        priority: params.priority,
        category: params.category,
        effectiveDate: params.effectiveDate || todayDateStr,
        sentAt: `اليوم ${nowStr}`,
        senderName: 'الإدارة العامة',
        senderRole: 'admin',
        acknowledgedBy: [],
        whatsappShared: !!params.sendWhatsapp,
      };

      setAdminBroadcasts((prev) => {
        const next = [newBroadcast, ...prev];
        StorageService.set(STORAGE_KEYS.ADMIN_BROADCASTS, next);
        return next;
      });

      let audience: AppNotification['targetAudience'] = 'all';
      if (params.targetGroup === 'all_marketers' || params.targetGroup === 'female_marketers') {
        audience = 'marketers';
      } else if (params.targetGroup === 'all_guards' || params.targetGroup === 'specific_guard') {
        audience = 'guards';
      } else if (params.targetGroup === 'coordinators') {
        audience = 'coordinators';
      } else if (params.targetGroup === 'custom') {
        audience = 'all_staff';
      }

      const categoryLabel =
        params.category === 'decision'
          ? '📜 قرار إداري'
          : params.category === 'alert'
          ? '🚨 تنبيه تشغيلي'
          : params.category === 'update'
          ? '🔄 تعديل شروط'
          : params.category === 'instruction'
          ? '💡 توجيهات عمل'
          : '📢 تعميم إداري';

      const priorityPrefix =
        params.priority === 'urgent'
          ? '🔴 عاجل: '
          : params.priority === 'important'
          ? '🟡 هام: '
          : '';

      const notifTitle = `${priorityPrefix}${categoryLabel} - ${params.title}`;

      const newNotif: AppNotification = {
        id: `notif-${broadcastId}`,
        title: notifTitle,
        description: `${params.content} (توجيه لـ: ${groupLabel} - ساري: ${params.effectiveDate || 'فوراً'})`,
        timestamp: 'الآن',
        read: false,
        type: 'broadcast',
        targetAudience: audience,
        broadcastId: broadcastId,
        groupType: params.targetGroup,
        groupName: groupLabel,
        priority: params.priority,
        category: params.category,
        effectiveDate: params.effectiveDate || todayDateStr,
        propertyId: params.targetPropertyId,
        targetGuardId: params.targetGuardId,
        targetGuardIds: params.targetGuardIds,
        targetMarketerIds: params.targetMarketerIds,
        targetCoordinatorIds: params.targetCoordinatorIds,
        requiresAcknowledgment: params.priority === 'urgent',
      };

      setNotifications((prev) => {
        const next = [newNotif, ...prev];
        StorageService.set(STORAGE_KEYS.NOTIFICATIONS, next);
        return next;
      });

      triggerBrowserNotification(notifTitle, params.content, 'system');

      logActivity(
        'الإدارة العامة',
        'admin',
        'إرسال تعميم / قرار إداري للفرق',
        `تم إرسال تعميم "${params.title}" موجه إلى (${groupLabel}) بأولوية (${params.priority}).`
      );

      const formattedMsg = `*📢 إعلان وتعميم إداري - إدارة AMASA RESORT*\n\n*📌 الموضوع:* ${params.title}\n*🏷️ التصنيف:* ${categoryLabel}\n*👥 الفئة المستهدفة:* ${groupLabel}\n*⏰ تاريخ وساعة السريان:* ${params.effectiveDate || 'فوراً'}\n\n*📝 نص القرار والتوجيهات:*\n${params.content}\n\n------------------------\n_نرجو من الجميع الالتزام والاطلاع الفوري ومتابعة المستجدات عبر التطبيق._`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(formattedMsg)}`;

      return {
        ok: true,
        message: `تم إرسال التعميم والقرار بنجاح إلى (${groupLabel})`,
        broadcastId,
        whatsappUrl,
      };
    },
    [playChimeSound, triggerBrowserNotification, logActivity]
  );

  const deleteAdminBroadcast = useCallback(
    (broadcastId: string) => {
      setAdminBroadcasts((prev) => {
        const next = prev.filter((b) => b.id !== broadcastId);
        StorageService.set(STORAGE_KEYS.ADMIN_BROADCASTS, next);
        return next;
      });
      setNotifications((nPrev) => {
        const next = nPrev.filter((n) => n.broadcastId !== broadcastId);
        StorageService.set(STORAGE_KEYS.NOTIFICATIONS, next);
        return next;
      });
      logActivity('الإدارة العامة', 'admin', 'حذف تعميم إداري', `تم حذف التعميم الإداري رقم ${broadcastId}`);
    },
    [logActivity]
  );

  const acknowledgeBroadcast = useCallback(
    (broadcastId: string) => {
      const userId = isGuard
        ? activeGuard.id
        : isCoordinator
        ? currentCoordinatorId
        : isAdmin
        ? 'admin'
        : currentMarketerId;
      setAcknowledgedBroadcastIds((prev) =>
        prev.includes(broadcastId) ? prev : [...prev, broadcastId]
      );
      setAdminBroadcasts((prev) => {
        const next = prev.map((b) => {
          if (b.id !== broadcastId) return b;
          const acks = b.acknowledgedBy || [];
          return {
            ...b,
            acknowledgedBy: acks.includes(userId) ? acks : [...acks, userId],
          };
        });
        StorageService.set(STORAGE_KEYS.ADMIN_BROADCASTS, next);
        return next;
      });
      setNotifications((prev) => {
        const next = prev.map((n) => {
          if (n.broadcastId !== broadcastId) return n;
          const acks = n.acknowledgedBy || [];
          return {
            ...n,
            read: true,
            acknowledgedBy: acks.includes(userId) ? acks : [...acks, userId],
          };
        });
        StorageService.set(STORAGE_KEYS.NOTIFICATIONS, next);
        return next;
      });
    },
    [isGuard, isCoordinator, activeGuard.id, currentCoordinatorId, isAdmin, currentMarketerId]
  );

  const resetAllData = useCallback(() => {
    StorageService.clear();
    setProperties(INITIAL_PROPERTIES);
    setMarketers(INITIAL_MARKETERS);
    setGuard(INITIAL_GUARD);
    setGuardsList(INITIAL_GUARDS_LIST);
    setBookings(INITIAL_BOOKINGS);
    setDateOverrides({});
    setSupervisorDateOverrides({});
    setCustomSupervisorRates([]);
    setActivityLogs(INITIAL_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setMessageTemplates(INITIAL_TEMPLATES);
    setAdminBroadcasts(INITIAL_ADMIN_BROADCASTS);
    setAcknowledgedBroadcastIds([]);
    setCoordinatorServices(INITIAL_COORDINATOR_SERVICES);
    setCoordinators(INITIAL_COORDINATORS);
    setGuardTasks(INITIAL_GUARD_TASKS);
    setKayanItems(INITIAL_KAYAN_ITEMS);
    setKayanSettings(KAYAN_DEFAULT_SETTINGS);
    setKayanOrders([]);
    setUserAccounts(INITIAL_USER_ACCOUNTS);
    setUserRole('admin');
    setCurrentMarketerId('');
    setSelectedPropertyId('al-taraf');
    setActiveTab('calendar');
  }, []);

  const addKayanItem = useCallback(
    (item: Omit<KayanDetergentItem, 'id' | 'createdAt' | 'updatedAt'>): KayanDetergentItem => {
      const now = new Date().toISOString();
      const newItem: KayanDetergentItem = {
        ...item,
        id: `kayan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      setKayanItems((prev) => [newItem, ...prev]);
      return newItem;
    },
    []
  );

  const updateKayanItem = useCallback((id: string, updates: Partial<KayanDetergentItem>) => {
    setKayanItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates, updatedAt: new Date().toISOString() } : it))
    );
  }, []);

  const deleteKayanItem = useCallback((id: string) => {
    setKayanItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const updateKayanSettings = useCallback((updates: Partial<KayanSettings>) => {
    setKayanSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveKayanOrder = useCallback((order: KayanOrderSheet) => {
    setKayanOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)].slice(0, 120));
  }, []);

  const deleteKayanOrder = useCallback((id: string) => {
    setKayanOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const buildCurrentPushMeta = useCallback((): PushSubscriberMeta => {
    const activeG = guardsListRef.current.find((g) => g.id === guardRef.current.id) || guardRef.current;
    const gPropIds: string[] = [];
    if (Array.isArray(activeG.assignedPropertyIds)) {
      gPropIds.push(...activeG.assignedPropertyIds);
    }
    if (activeG.assignedPropertyId && !gPropIds.includes(activeG.assignedPropertyId)) {
      gPropIds.push(activeG.assignedPropertyId);
    }
    const roleNow = userRoleRef.current;
    const activeMarketer = marketersRef.current.find((m) => m.id === currentMarketerIdRef.current);
    return {
      role: roleNow,
      email: auth.currentUser?.email?.trim().toLowerCase() || undefined,
      isAdmin: roleNow === 'admin',
      isSupervisor: Boolean(roleNow === 'marketer' && activeMarketer?.isSupervisor),
      marketerId: roleNow === 'marketer' ? currentMarketerIdRef.current : undefined,
      guardId: roleNow === 'guard' ? activeG.id : undefined,
      coordinatorId: roleNow === 'coordinator' ? currentCoordinatorIdRef.current : undefined,
      guardPropertyIds: gPropIds,
    };
  }, []);

  const syncPushSubscription = useCallback(async (): Promise<boolean> => {
    const res = await syncWebPushSubscription(buildCurrentPushMeta());
    setIsPushSubscribed(res.subscribed);
    return res.subscribed;
  }, [buildCurrentPushMeta]);

  const sendBackgroundPushTest = useCallback(async (): Promise<boolean> => {
    return await sendSelfTestWebPush(buildCurrentPushMeta());
  }, [buildCurrentPushMeta]);

  useEffect(() => {
    if (!isAuthenticated || browserNotificationPermission !== 'granted') {
      if (browserNotificationPermission !== 'granted') {
        setIsPushSubscribed(false);
      }
      return;
    }
    void syncPushSubscription();
  }, [
    isAuthenticated,
    browserNotificationPermission,
    userRole,
    currentMarketerId,
    currentCoordinatorId,
    guard.id,
    syncPushSubscription,
  ]);

  // Listen to Service Worker push & notification click messages when PWA is open
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'AMASA_PUSH_RECEIVED') {
        if (isSoundEnabledRef.current) {
          playChimeSound(true);
        }
      } else if (msg.type === 'AMASA_NOTIFICATION_CLICK') {
        const notifType = msg.data?.type;
        if (notifType === 'commission') {
          setActiveTab('marketers');
        } else if (notifType === 'booking' || notifType === 'deposit_confirmed' || notifType === 'deposit_request' || notifType === 'insurance' || notifType === 'checkout') {
          setActiveTab('bookings');
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);

  const requestBrowserNotificationPermissionHandler = useCallback(async () => {
    unlockMobileAudio();
    const res = await requestBrowserNotificationPermission();
    setBrowserNotificationPermission(res);
    if (res === 'granted') {
      await syncPushSubscription();
      triggerBrowserNotification(
        '🔔 تم تفعيل إشعارات وصوت الجوال بنجاح!',
        'ستصلك تنبيهات فورية على شاشة الجوال مع نغمة الصوت عند وصول أي حجز أو تأكيد عربون.',
        'deposit_confirmed'
      );
    }
    return res;
  }, [syncPushSubscription, triggerBrowserNotification]);

  return (
    <AppContext.Provider
      value={{
        simulation,
        startSimulation,
        exitSimulation,
        testAlertOnCurrentAccount,
        diagnoseCurrentAccount,
        isAccountSwitcherOpen,
        setIsAccountSwitcherOpen,
        openAccountSwitcher,
        activeTab,
        setActiveTab,
        userRole,
        currentMarketerId,
        currentMarketer,
        currentCoordinatorId,
        currentCoordinator,
        guard: activeGuard,
        guardPropertyIds,
        isAdmin,
        isGuard,
        isCoordinator,
        isSupervisor,
        activePermissions,
        switchUser,
        updateGuardProfile,
        addGuard,
        deleteGuard,
        updateGuardPermissions,
        toggleGuardPermission,
        userAccounts,
        currentUserAccount,
        loginWithGmailAndPassword,
        loginWithGoogleAuth,
        addMemberByEmail,
        isAuthenticated,
        isInitialHydrating,
        isDemoMode,
        setIsAuthenticated,
        syncStatus,
        syncMessage,
        refreshFromServer,
        changePassword,
        updateUserAccount,
        logout,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuthModal,

        canCreateContract,
        canEditDeposit,
        canViewDashboard,
        canViewGuardTasks,
        canViewCalendar,
        canViewBookings,
        canViewSupervisor,
        canViewProperties,
        canViewMarketers,
        canViewMore,
        canViewKayanDetergents,
        canManageTemplates,
        canViewRentalContract,
        canViewActivityLogs,

        grantAllMarketersContractAndDepositPermissions,
        updateWaitingDepositAmount,

        properties,
        selectedPropertyId,
        selectedProperty,
        setSelectedPropertyId,
        addProperty,
        updateProperty,
        deleteProperty,
        duplicateProperty,
        updatePropertySection,
        duplicatePropertySection,
        addPropertySection,
        deletePropertySection,
        togglePropertyBreakfast,
        togglePropertyCoordinatorServices,
        togglePropertyHasSections,
        transferPropertyOrSection,
        togglePropertyPublished,
        guardsList,
        updatePropertyGuard,
        updatePropertyPhotos,
        deletePropertyPhoto,
        addPropertyPhotos,
        setPropertyCoverPhoto,
        addPropertyVideo,
        deletePropertyVideo,
        savePropertiesNow,
        switchGuardAssignedProperty,
        updatePropertySeasonalPricing,
        updatePropertyBreakfastPrice,
        updatePropertyBreakfastPricing,
        updatePropertyAdministrativeFees,
        updatePropertyCustomPricingPeriods,

        coordinatorServices,
        addCoordinatorService,
        updateCoordinatorService,
        deleteCoordinatorService,

        coordinators,
        addCoordinator,
        updateCoordinator,
        updateCoordinatorPermissions,
        deleteCoordinator,

        marketers,
        updateMarketerPermissions,
        saveMarketerPermissions,
        updateMarketerProfile,
        addMarketer,
        deleteMarketer,
        addAdminAccount,
        deleteUserAccount,
        setMarketerAccountRole,
        promoteMarketerToSupervisor,
        payMarketerCommission,
        payoutAllMarketerCommissions,
        payoutSupervisorBalance,

        bookings,
        filteredBookings,
        todayArrivals,
        todayDepartures,
        addBooking,
        updateBookingContractFields,
        updateBookingStatus,
        cancelBooking,
        sendCheckoutReminder,
        sendPaymentCompletionRequest,
        sendCoordinatorWhatsAppNotification,
        markCheckedOut,
        guardMarkArrived,
        guardReceiveInsurance,
        guardRequestInsuranceReturn,
        returnInsuranceDeposit,
        completeBookingPayment,
        recordCustomerArrival,
        recordInsuranceReceived,
        notifyGuardForCashPayment,
        guardProcessDeparture,
        confirmAttendanceByGuard,
        confirmCashInsuranceByGuard,
        notifyGuardForCashInsurance,
        uploadDigitalInsuranceReceipt,
        approveCleanlinessAndExit,
        toggleAdminCommissionApproval,
        uploadRemainingPaymentReceipt,
        toggleGuestArrivalStatus,
        sendQuickAlert,
        requestInsuranceRefundViaBank,
        requestInsuranceRefundViaGuardCash,
        finishBookingAndReturnInsurance,

        dateOverrides,
        setDateOverride,
        setDateOverridesBulk,
        applySeasonalPricingPattern,

        requestDeposit,
        cancelDepositWait,
        extendDepositWait,
        confirmBookingWithReceipt,

        notifications,
        filteredNotifications,
        unreadNotificationsCount,
        markNotificationsAsRead,

        commissionRequests,
        getEligibleCommissionBookings,
        createCommissionRequest,
        markCommissionTransferred,
        rejectCommissionRequest,
        markCommissionRequestSeen,

        expenses,
        addExpense,
        deleteExpense,

        activityLogs,
        logActivity,

        bookingModalOpen,
        setBookingModalOpen,
        preselectedDateForBooking,
        setPreselectedDateForBooking,
        preselectedSectionForBooking,
        setPreselectedSectionForBooking,

        messageTemplates,
        updateMessageTemplates,
        resetMessageTemplates,
        templatesModalOpen,
        setTemplatesModalOpen,
        activeTemplateTab,
        openTemplatesModal,

        resetAllData,
        nowTimestamp,

        browserNotificationPermission,
        requestBrowserNotificationPermission: requestBrowserNotificationPermissionHandler,
        isPushSubscribed,
        syncPushSubscription,
        sendBackgroundPushTest,
        isSoundEnabled,
        toggleSound,
        activeToast,
        dismissToast,
        triggerBrowserNotification,
        sendTestNotification,

        adminBroadcasts,
        sendAdminBroadcast,
        deleteAdminBroadcast,
        acknowledgeBroadcast,
        adminBroadcastModalOpen,
        setAdminBroadcastModalOpen,
        activeUrgentBroadcast,

        guardTasks,
        addGuardTask,
        updateGuardTask,
        deleteGuardTask,
        completeGuardTaskWithPhoto,
        completeGuardTaskWithoutPhoto,
        verifyGuardTask,
        reopenGuardTask,
        sendGuardFieldReport,
        guardTaskTemplates,
        addGuardTaskTemplate,
        updateGuardTaskTemplate,
        deleteGuardTaskTemplate,
        generateWeeklyGuardTasksNow,

        specialAdminFeeBoxes,
        saveSpecialFeeBox,
        deleteSpecialFeeBox,
        getSpecialFeeForPeriod,

        supervisorDateOverrides,
        setSupervisorDateOverride,
        setSupervisorDateOverridesBulk,
        customSupervisorRates,
        addCustomSupervisorRate,
        removeCustomSupervisorRate,
        kayanItems,
        kayanSettings,
        kayanOrders,
        addKayanItem,
        updateKayanItem,
        deleteKayanItem,
        updateKayanSettings,
        saveKayanOrder,
        deleteKayanOrder,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
