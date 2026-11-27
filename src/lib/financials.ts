import { Booking, Property, SpecialAdminFeeBox } from '../types';

/**
 * التحقق من أن العميل قد خرج فعلياً من الاستراحة (تأكيد الخروج / النظافة / اكتمال الحجز)
 * القاعدة المالية: لا تُضاف مبالغ الإيجارات أو العمولات أو الرسوم الإدارية في الأمور المالية العامة إلا بعد خروج العميل.
 */
export function isBookingCheckedOut(booking: Booking): boolean {
  if (booking.status === 'cancelled') return false;
  return Boolean(
    booking.checkedOut === true ||
      booking.cleanlinessApproved === true ||
      booking.status === 'completed'
  );
}

/**
 * هل الحجز من فئة "Supervisor" (حجز المشرف)
 */
export function isSupervisorBooking(booking: Booking): boolean {
  return Boolean(
    booking.isSupervisorBooking === true ||
      booking.bookingType === 'supervisor' ||
      booking.bookingCategory === 'supervisor'
  );
}

/**
 * هل الحجز من فئة "حجز خاص" قديم (معفى من عمولة المسوق)
 */
export function isSpecialFeeBooking(booking: Booking): boolean {
  return Boolean(
    !isSupervisorBooking(booking) &&
      (booking.isSpecialBooking === true ||
        booking.bookingType === 'special' ||
        booking.bookingCategory === 'special')
  );
}

/**
 * هل الحجز "حجز إدارة مباشر" (معفى من الرسوم الإدارية 0 ر.س ومن العمولة 0%)
 */
export function isAdminDirectBooking(booking: Booking): boolean {
  return Boolean(
    booking.isAdminBooking === true ||
      booking.bookingType === 'admin' ||
      booking.bookingCategory === 'admin'
  );
}

/**
 * حساب إجمالي الرسم الإداري أو رسوم (Supervisor) المستحقة على الحجز
 */
export function getBookingAdminFeeAmount(
  booking: Booking,
  properties: Property[] = [],
  specialAdminFeeBoxes: SpecialAdminFeeBox[] = []
): number {
  if (isAdminDirectBooking(booking)) {
    return 0;
  }

  if (isSupervisorBooking(booking) && booking.supervisorFee !== undefined && booking.supervisorFee !== null) {
    return Math.max(0, Number(booking.supervisorFee) || 0);
  }

  if (booking.adminFee !== undefined && booking.adminFee !== null) {
    return Math.max(0, Number(booking.adminFee) || 0);
  }

  const nights = Math.max(1, booking.nightsCount || 1);
  const checkInDay = booking.checkInDate ? new Date(booking.checkInDate).getDay() : 0;
  const isWeekend = checkInDay === 4 || checkInDay === 5; // الخميس والجمعة ويكند

  if (isSpecialFeeBooking(booking) || isSupervisorBooking(booking)) {
    const matchedBox =
      specialAdminFeeBoxes.find(
        (box) =>
          (box.propertyId === booking.propertyId || box.propertyId === 'all') &&
          box.period === (isWeekend ? 'weekend' : 'weekday')
      ) ||
      specialAdminFeeBoxes.find(
        (box) => box.propertyId === booking.propertyId || box.propertyId === 'all'
      );

    const specialPerNight = matchedBox
      ? matchedBox.specialAdminFee
      : isWeekend
      ? 500
      : 400;

    return specialPerNight * nights;
  }

  const prop = properties.find((p) => p.id === booking.propertyId);
  if (!prop) {
    return (isWeekend ? 100 : 50) * nights;
  }

  const feePerNight = isWeekend
    ? (prop.administrativeFees?.weekend ?? 100)
    : (prop.administrativeFees?.weekday ?? 50);

  return feePerNight * nights;
}

export interface BookingAdminFeeBreakdown {
  normalAdminFee: number;
  specialAdminFee: number;
  totalAdminFee: number;
  feeType: 'normal' | 'special' | 'admin' | 'supervisor';
}

/**
 * فصل الرسوم الإدارية للحجز:
 * - الرسوم الإدارية العادية على حدة
 * - رسوم (Supervisor) / الخاصة على حدة
 * - مجموع الرسوم الكلية مجتمعة
 */
export function getBookingAdminFeeBreakdown(
  booking: Booking,
  properties: Property[] = [],
  specialAdminFeeBoxes: SpecialAdminFeeBox[] = []
): BookingAdminFeeBreakdown {
  if (isAdminDirectBooking(booking)) {
    return {
      normalAdminFee: 0,
      specialAdminFee: 0,
      totalAdminFee: 0,
      feeType: 'admin',
    };
  }

  const amount = getBookingAdminFeeAmount(booking, properties, specialAdminFeeBoxes);

  if (isSupervisorBooking(booking)) {
    return {
      normalAdminFee: 0,
      specialAdminFee: amount,
      totalAdminFee: amount,
      feeType: 'supervisor',
    };
  }

  if (isSpecialFeeBooking(booking)) {
    return {
      normalAdminFee: 0,
      specialAdminFee: amount,
      totalAdminFee: amount,
      feeType: 'special',
    };
  }

  return {
    normalAdminFee: amount,
    specialAdminFee: 0,
    totalAdminFee: amount,
    feeType: 'normal',
  };
}

/**
 * حساب عمولة المسوق / المشرف الفعلية للحجز
 */
export function getBookingCommissionAmount(booking: Booking): number {
  if (isAdminDirectBooking(booking) || isSpecialFeeBooking(booking)) {
    return 0;
  }
  if (booking.marketerCommission !== undefined && booking.marketerCommission !== null) {
    return Math.max(0, Number(booking.marketerCommission) || 0);
  }
  if (!booking.marketerId && !booking.supervisorId) return 0;
  const rate = booking.commissionRatePercent ?? 5;
  return Math.round((booking.totalPrice || 0) * (rate / 100));
}

/**
 * إجمالي المستحق لرصيد المشرف عند خروج العميل (مبلغ العمولة + رسوم Supervisor)
 */
export function getSupervisorBookingTotalCredit(
  booking: Booking,
  properties: Property[] = [],
  specialAdminFeeBoxes: SpecialAdminFeeBox[] = []
): number {
  if (!isSupervisorBooking(booking)) return 0;
  const comm = getBookingCommissionAmount(booking);
  const fee =
    booking.supervisorFee !== undefined && booking.supervisorFee !== null
      ? Math.max(0, Number(booking.supervisorFee) || 0)
      : getBookingAdminFeeAmount(booking, properties, specialAdminFeeBoxes);
  return comm + fee;
}


export interface SupervisorPayoutParts {
  adminFee: number; // الرسوم الإدارية العادية (حجوزات صفحة الحجوزات)
  supervisorFee: number; // رسوم المشرف (حجوزات صفحة المشرف)
  percent: number; // النسبة المئوية (حجوزات صفحة المشرف فقط)
  total: number;
}

/** مستحق المشرف من حجز واحد: حجز المشرف = رسوم المشرف + النسبة، أي حجز آخر = الرسوم الإدارية العادية فقط */
export function getSupervisorPayoutParts(
  booking: Booking,
  properties: Property[] = [],
  specialAdminFeeBoxes: SpecialAdminFeeBox[] = []
): SupervisorPayoutParts {
  if (isAdminDirectBooking(booking)) return { adminFee: 0, supervisorFee: 0, percent: 0, total: 0 };
  const fee = getBookingAdminFeeAmount(booking, properties, specialAdminFeeBoxes);
  if (isSupervisorBooking(booking)) {
    const percent = getBookingCommissionAmount(booking);
    return { adminFee: 0, supervisorFee: fee, percent, total: fee + percent };
  }
  return { adminFee: fee, supervisorFee: 0, percent: 0, total: fee };
}

export function sumSupervisorPayout(
  bookings: Booking[],
  properties: Property[] = [],
  specialAdminFeeBoxes: SpecialAdminFeeBox[] = []
): SupervisorPayoutParts {
  return bookings.reduce(
    (acc, b) => {
      const p = getSupervisorPayoutParts(b, properties, specialAdminFeeBoxes);
      return {
        adminFee: acc.adminFee + p.adminFee,
        supervisorFee: acc.supervisorFee + p.supervisorFee,
        percent: acc.percent + p.percent,
        total: acc.total + p.total,
      };
    },
    { adminFee: 0, supervisorFee: 0, percent: 0, total: 0 }
  );
}
