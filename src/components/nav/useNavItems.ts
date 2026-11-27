import React from 'react';
import {
  Users,
  CalendarDays,
  CalendarCheck,
  Building2,
  LayoutGrid,
  Settings,
  ShieldCheck,
  ClipboardList,
  PackageCheck,
} from 'lucide-react';
import { ActiveTab, useApp } from '../../context/AppContext';
import type { IconName } from '../ui/lux';

export interface NavItem {
  id: ActiveTab;
  /** الاسم الكامل (القائمة الجانبية) */
  label: string;
  /** اسم قصير للشريط السفلي */
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  lux: IconName;
  badge?: number;
  hidden?: boolean;
}

/** ترتيب أولوية الظهور في الشريط السفلي (أول 4 متاحة للحساب) */
export const BOTTOM_PRIORITY: ActiveTab[] = [
  'dashboard',
  'bookings',
  'calendar',
  'properties',
  'guard-tasks',
  'marketers',
  'supervisor',
  'kayan-detergents',
  'more',
];

/** عناصر التنقل حسب صلاحيات الحساب — مصدر واحد للقائمة الجانبية والشريط السفلي */
export function useNavItems() {
  const {
    guard,
    isGuard,
    bookings,
    todayArrivals,
    todayDepartures,
    guardTasks,
    canViewDashboard,
    canViewGuardTasks,
    canViewCalendar,
    canViewBookings,
    canViewSupervisor,
    canViewProperties,
    canViewMarketers,
    canViewMore,
    canViewKayanDetergents,
  } = useApp();

  const activeBookingsCount = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'pending_payment'
  ).length;
  const todayCount = todayArrivals.length + todayDepartures.length;

  const guardAssignedIds =
    guard.assignedPropertyIds && guard.assignedPropertyIds.length > 0
      ? guard.assignedPropertyIds
      : guard.assignedPropertyId
      ? [guard.assignedPropertyId]
      : [];

  const pendingTasksCount = guardTasks.filter((t) => {
    const isUnfinished = t.status === 'pending' || t.status === 'in_progress';
    if (!isUnfinished) return false;
    if (isGuard) {
      return (
        t.guardId === guard.id ||
        t.propertyId === 'general' ||
        (t.propertyId && guardAssignedIds.includes(t.propertyId))
      );
    }
    return true;
  }).length;

  const all: NavItem[] = [
    {
      id: 'dashboard',
      label: isGuard ? 'دخول وخروج اليوم' : 'لوحة التحكم',
      short: isGuard ? 'اليوم' : 'الرئيسية',
      icon: LayoutGrid,
      lux: 'gem',
      badge: isGuard && todayCount > 0 ? todayCount : undefined,
      hidden: !canViewDashboard,
    },
    {
      id: 'guard-tasks',
      label: 'مهمات الحارس',
      short: 'المهمات',
      icon: ClipboardList,
      lux: 'tasks',
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      hidden: !canViewGuardTasks,
    },
    {
      id: 'calendar',
      label: 'ضبط الأسعار',
      short: 'الأسعار',
      icon: CalendarDays,
      lux: 'cash',
      hidden: !canViewCalendar,
    },
    {
      id: 'bookings',
      label: 'الحجوزات',
      short: 'الحجوزات',
      icon: CalendarCheck,
      lux: 'cal',
      badge: activeBookingsCount > 0 ? activeBookingsCount : undefined,
      hidden: !canViewBookings,
    },
    {
      id: 'supervisor',
      label: 'Supervisor',
      short: 'المشرف',
      icon: ShieldCheck,
      lux: 'shield',
      hidden: !canViewSupervisor,
    },
    {
      id: 'properties',
      label: 'العقار والوحدات',
      short: 'العقارات',
      icon: Building2,
      lux: 'building',
      hidden: !canViewProperties,
    },
    {
      id: 'marketers',
      label: 'المسوقون والعمولات',
      short: 'المسوقون',
      icon: Users,
      lux: 'marketer',
      hidden: !canViewMarketers,
    },
    {
      id: 'kayan-detergents',
      label: 'كيان للمنظفات',
      short: 'كيان',
      icon: PackageCheck,
      lux: 'box',
      hidden: !canViewKayanDetergents,
    },
    {
      id: 'more',
      label: 'المزيد والإعدادات',
      short: 'الإعدادات',
      icon: Settings,
      lux: 'settings',
      hidden: !canViewMore,
    },
  ];

  const visible = all.filter((i) => !i.hidden);
  const bottom = BOTTOM_PRIORITY.map((id) => visible.find((i) => i.id === id)).filter(
    (i): i is NavItem => Boolean(i)
  ).slice(0, 4);

  return { all, visible, bottom, activeBookingsCount, todayCount };
}
