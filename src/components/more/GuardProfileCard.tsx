import React, { useState } from 'react';
import { Guard, GuardPermissions } from '../../types';
import {
  ShieldCheck,
  Phone,
  Edit2,
  CalendarDays,
  Check,
  Lock,
  Key,
  LayoutGrid,
  ClipboardList,
  Camera,
  Coins,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Building2,
  Settings,
  Users,
  Trash2,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Head, Row, Tag, Face, Acts, Act, Infos, Info, Switch, Field, Choice, Sheet } from '../ui/kit';
import type { Ico } from '../ui/kit';

interface GuardProfileCardProps {
  guard: Guard;
  isAdmin: boolean;
  onSave?: (data: Partial<Guard>) => void;
  onDelete?: (guardId: string) => { success: boolean; message: string };
}

export const GuardProfileCard: React.FC<GuardProfileCardProps> = ({
  guard,
  isAdmin,
  onSave,
  onDelete,
}) => {
  const {
    toggleGuardPermission,
    updateGuardPermissions,
    updateGuardProfile,
    deleteGuard,
    guardsList,
    triggerBrowserNotification,
    properties,
  } = useApp();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Guard> & { assignedPropertyIds?: string[] }>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [permissionSuccessToast, setPermissionSuccessToast] = useState<string | null>(null);

  const startEdit = () => {
    const initialAssigned = guard.assignedPropertyIds && guard.assignedPropertyIds.length > 0
      ? guard.assignedPropertyIds
      : guard.assignedPropertyId ? [guard.assignedPropertyId] : [];

    setEditError(null);
    setFormData({
      name: guard.name || '',
      jobTitle: guard.jobTitle || '',
      phone: guard.phone || '',
      email: guard.email || '',
      nationalId: guard.nationalId || '',
      startDate: guard.startDate || '',
      iban: guard.iban || '',
      salary: guard.salary !== undefined ? guard.salary : 3500,
      avatar: guard.avatar || '',
      assignedPropertyIds: initialAssigned,
    });
    setIsEditModalOpen(true);
  };

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAdmin) return;

    const trimmedName = (formData.name || '').trim();
    const trimmedPhone = (formData.phone || '').trim();
    if (!trimmedName || !trimmedPhone) {
      setEditError('يرجى إدخال اسم الحارس ورقم الجوال قبل الحفظ');
      return;
    }

    const assignedIds = formData.assignedPropertyIds || [];
    const assignedNames = properties
      .filter((p) => assignedIds.includes(p.id))
      .map((p) => p.name);
    const primaryId = assignedIds[0] || undefined;
    const primaryName = assignedNames[0] || undefined;

    const payload: Partial<Guard> = {
      name: trimmedName,
      jobTitle: (formData.jobTitle || '').trim() || guard.jobTitle,
      phone: trimmedPhone,
      email: (formData.email || '').trim() || guard.email,
      nationalId: (formData.nationalId || '').trim(),
      startDate: formData.startDate || guard.startDate,
      iban: (formData.iban || '').trim(),
      salary: formData.salary !== undefined ? Number(formData.salary) : guard.salary,
      avatar: (formData.avatar || '').trim() || guard.avatar,
      assignedPropertyIds: assignedIds,
      assignedPropertyNames: assignedNames,
      assignedPropertyId: primaryId,
      assignedPropertyName: primaryName,
    };

    if (onSave) {
      onSave(payload);
    } else {
      updateGuardProfile(payload, guard.id);
    }

    setEditError(null);
    setIsEditModalOpen(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3500);
  };

  const handleConfirmDelete = () => {
    const res = onDelete ? onDelete(guard.id) : deleteGuard(guard.id);
    if (!res.success) {
      setDeleteError(res.message);
      return;
    }
    setDeleteError(null);
    setIsDeleteModalOpen(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const salaryNum = Number(guard.salary) || 3500;

  const GUARD_DEFAULT_FALSE_KEYS: (keyof GuardPermissions)[] = [
    'canViewCalendar',
    'canViewBookings',
    'canViewProperties',
    'canViewMarketers',
    'canViewMore',
    'canBlockDates',
  ];

  const resolveGuardPerm = (key: keyof GuardPermissions): boolean => {
    if (GUARD_DEFAULT_FALSE_KEYS.includes(key)) {
      return !!guard.permissions?.[key];
    }
    return guard.permissions?.[key] !== false;
  };

  interface PermItem {
    key: keyof GuardPermissions;
    /** عنوان قصير بسطر واحد */
    title: string;
    /** سطر ثانٍ صغير */
    sub: string;
    icon: Ico;
    category: 'pages' | 'operations' | 'finance';
  }

  const guardPermissionsList: PermItem[] = [
    { key: 'canViewDashboard', title: 'لوحة التحكم', sub: 'دخول وخروج اليوم', icon: LayoutGrid, category: 'pages' },
    { key: 'canViewGuardTasks', title: 'مهمات الحارس', sub: 'المهام اليومية والإثبات', icon: ShieldCheck, category: 'pages' },
    { key: 'canViewCalendar', title: 'ضبط الأسعار', sub: 'الأسعار والرسوم الإدارية', icon: CalendarDays, category: 'pages' },
    { key: 'canViewBookings', title: 'الحجوزات', sub: 'الحجوزات والعربون والعقود', icon: ClipboardList, category: 'pages' },
    { key: 'canViewProperties', title: 'العقار والوحدات', sub: 'تفاصيل الوحدات والاستراحات', icon: Building2, category: 'pages' },
    { key: 'canViewMarketers', title: 'المسوقون والعمولات', sub: 'المسوقون وطلبات الصرف', icon: Users, category: 'pages' },
    { key: 'canViewMore', title: 'المزيد والإعدادات', sub: 'المركز المالي وإدارة الفريق', icon: Settings, category: 'pages' },
    { key: 'canViewCustomerContacts', title: 'هواتف النزلاء', sub: 'رؤية الأرقام والاتصال', icon: Phone, category: 'operations' },
    { key: 'canConfirmArrival', title: 'تأكيد وصول النزيل', sub: 'توثيق الدخول وتسليم المفتاح', icon: Key, category: 'operations' },
    { key: 'canInspectUnit', title: 'فحص الوحدة', sub: 'المعاينة عند المغادرة', icon: Camera, category: 'operations' },
    { key: 'canBlockDates', title: 'إغلاق التواريخ', sub: 'للصيانة الطارئة', icon: Lock, category: 'operations' },
    { key: 'canReceiveInsurance', title: 'استلام التأمين', sub: 'نقداً أو إلكترونياً', icon: Coins, category: 'finance' },
    { key: 'canRefundInsurance', title: 'إرجاع التأمين', sub: 'وتأكيد خلو الذمة', icon: RotateCcw, category: 'finance' },
  ];

  const pagePerms = guardPermissionsList.filter((p) => p.category === 'pages');
  const fieldPerms = guardPermissionsList.filter((p) => p.category !== 'pages');
  const openPages = pagePerms.filter((p) => resolveGuardPerm(p.key)).length;
  const openFields = fieldPerms.filter((p) => resolveGuardPerm(p.key)).length;

  const assignedNames: string[] =
    guard.assignedPropertyNames && guard.assignedPropertyNames.length > 0
      ? guard.assignedPropertyNames
      : guard.assignedPropertyName
      ? [guard.assignedPropertyName]
      : [];

  const flashToast = (msg: string, ms = 3000) => {
    setPermissionSuccessToast(msg);
    setTimeout(() => setPermissionSuccessToast(null), ms);
  };

  const togglePerm = (perm: PermItem, isEnabled: boolean) => {
    toggleGuardPermission(perm.key, guard.id);
    flashToast(isEnabled ? `تم إغلاق: ${perm.title}` : `تم فتح: ${perm.title}`);
    if (perm.key === 'canViewCalendar') {
      triggerBrowserNotification(
        '🛡️ تحديث صلاحيات الحارس',
        isEnabled
          ? `تم إغلاق صفحة ضبط الأسعار عن الحارس ${guard.name} بنجاح.`
          : `تم فتح صفحة ضبط الأسعار للحارس ${guard.name} بنجاح!`,
        'permission'
      );
    }
  };

  const openAllPermissions = () => {
    updateGuardPermissions(
      {
        canViewDashboard: true,
        canViewGuardTasks: true,
        canViewCalendar: true,
        canViewBookings: true,
        canViewProperties: true,
        canViewMarketers: true,
        canViewMore: true,
        canViewCustomerContacts: true,
        canConfirmArrival: true,
        canReceiveInsurance: true,
        canInspectUnit: true,
        canRefundInsurance: true,
        canBlockDates: true,
      },
      guard.id
    );
    flashToast(`تم فتح كافة الصفحات والصلاحيات للحارس ${guard.name} بنجاح!`, 3500);
    triggerBrowserNotification('🛡️ تم تفعيل كافة الصلاحيات', `منح الحارس ${guard.name} كامل الصلاحيات والصفحات الـ 7`, 'permission');
  };

  const renderPerm = (perm: PermItem) => {
    const on = resolveGuardPerm(perm.key);
    return (
      <Row
        key={perm.key}
        icon={perm.icon}
        tone={on ? 'jade' : 'gray'}
        title={perm.title}
        sub={perm.sub}
        end={
          isAdmin ? (
            <Switch on={on} onChange={() => togglePerm(perm, on)} label={`${on ? 'إغلاق' : 'فتح'} صلاحية ${perm.title}`} />
          ) : (
            <Tag tone={on ? 'jade' : 'garn'}>{on ? 'مفتوح' : 'مغلق'}</Tag>
          )
        }
      />
    );
  };

  const closeEdit = () => {
    setIsEditModalOpen(false);
    setEditError(null);
  };

  return (
    <div className="space-y-3.5 font-['Tajawal',sans-serif]">
      {/* هوية الحارس */}
      <div className="kt-row">
        <Face src={guard.avatar} name={guard.name} size={48} square />
        <span className="kt-row-t">
          <span className="kt-row-n">{guard.name}</span>
          <span className="kt-row-s">#{guard.id.toUpperCase()} · حساب نشط وموثق</span>
        </span>
      </div>

      {isAdmin ? (
        <Acts cols={3}>
          <Act stack tone="soft" icon={Phone} label="اتصال" title="الاتصال بالحارس" href={`tel:${guard.phone}`} />
          <Act stack tone="ink" icon={Edit2} label="تعديل" title="تعديل بيانات الحارس" onClick={startEdit} />
          <Act
            stack
            tone="garnS"
            icon={Trash2}
            label="حذف"
            title="حذف الحارس"
            onClick={() => {
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
          />
        </Acts>
      ) : (
        <Row icon={Lock} tone="sand" title="ملفك الشخصي المعتمد" sub="التعديل من الإدارة فقط" />
      )}

      {justSaved && (
        <div className="kt-ok animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <Check className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">تم حفظ بيانات الحارس {guard.name} بنجاح</span>
          </div>
        </div>
      )}

      {/* بيانات الحارس — بلاطات متساوية؛ البلاطة ذات أيقونة النسخ تنسخ قيمتها بلمسة */}
      <Infos cols={2}>
        <Info label="رقم الجوال" value={guard.phone} ltr onCopy={() => copyToClipboard(guard.phone, 'phone')} />
        <Info hi label="الراتب الشهري" value={`${salaryNum.toLocaleString('en-US')} ر.س`} />
        <Info label="الهوية الوطنية" value={guard.nationalId || '1034567890'} ltr />
        <Info label="تاريخ المباشرة" value={guard.startDate || '2025-06-01'} ltr />
        <Info wide label="المسمى الوظيفي" value={guard.jobTitle || 'حارس ومشرف الاستراحات والعقارات'} />
        <Info wide label="إيميل الدخول" value={guard.email} ltr onCopy={() => copyToClipboard(guard.email, 'email')} />
        <Info
          wide
          label="الآيبان (لتحويل الراتب)"
          value={guard.iban || 'SA5580000201608010199999'}
          ltr
          onCopy={() => copyToClipboard(guard.iban || '', 'iban')}
        />
      </Infos>

      {copiedKey && (
        <div className="kt-ok animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <Check className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">
              تم نسخ {copiedKey === 'phone' ? 'رقم الجوال' : copiedKey === 'email' ? 'الإيميل' : 'رقم الآيبان'}
            </span>
          </div>
        </div>
      )}

      {/* الاستراحات المكلف بها */}
      <div className="kt-sub">
        <Head
          title="الاستراحات المكلف بها"
          icon={Building2}
          tone="sand"
          action={isAdmin ? <Act small tone="soft" icon={Edit2} label="تعديل" onClick={startEdit} /> : undefined}
        />
        {assignedNames.length > 0 ? (
          <div className="kt-g2">
            {assignedNames.map((pName, idx) => (
              <div key={`${pName}-${idx}`} className="kt-pt">
                <CheckCircle2 size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{pName}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="kt-note">لم يتم تعيين استراحة بعد</p>
        )}
        <p className="kt-note">نطاق عملاء لوحة الدخول والخروج للحارس</p>
      </div>

      {/* مصفوفة الصلاحيات */}
      <div className="kt-sub">
        <Head
          title="الصلاحيات"
          icon={Sliders}
          count={`${openPages + openFields}/${guardPermissionsList.length}`}
          action={isAdmin ? <Act small tone="jadeS" icon={ShieldCheck} label="فتح الكل" title="فتح كل الصفحات والصلاحيات" onClick={openAllPermissions} /> : undefined}
        />

        {permissionSuccessToast && (
          <div className="kt-ok animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
              <span className="flex-1 min-w-0 text-[13.5px] font-extrabold text-[#0E5A49]">{permissionSuccessToast}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h5 className="kt-sec">الصفحات</h5>
            <Tag tone="amy">{openPages}/{pagePerms.length} مفتوحة</Tag>
          </div>
          {pagePerms.map(renderPerm)}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h5 className="kt-sec">الميدانية والمالية</h5>
            <Tag tone="amy">{openFields}/{fieldPerms.length} مفتوحة</Tag>
          </div>
          {fieldPerms.map(renderPerm)}
        </div>
      </div>

      {/* نافذة تعديل بيانات الحارس */}
      {isEditModalOpen && (
        <Sheet
          title={`تعديل بيانات ${guard.name}`}
          icon={ShieldCheck}
          onClose={closeEdit}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={closeEdit} />
              <Act tone="ink" icon={Save} label="حفظ التعديلات" onClick={() => handleSave()} />
            </Acts>
          }
        >
          <form onSubmit={handleSave} noValidate className="space-y-3">
            {editError && (
              <div className="kt-err">
                <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
                <span className="flex-1 min-w-0">{editError}</span>
              </div>
            )}

            <div className="kt-fields">
              <Field label="اسم الحارس *" className="kt-wide">
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="kt-input"
                  required
                />
              </Field>
              <Field label="المسمى الوظيفي" className="kt-wide">
                <input
                  type="text"
                  value={formData.jobTitle || ''}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="kt-input"
                />
              </Field>
              <Field label="رقم الجوال *">
                <input
                  type="text"
                  inputMode="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="kt-input"
                  dir="ltr"
                  required
                />
              </Field>
              <Field label="الهوية الوطنية">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.nationalId || ''}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  className="kt-input"
                  dir="ltr"
                />
              </Field>
              <Field label="إيميل الدخول" className="kt-wide">
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="kt-input"
                  dir="ltr"
                />
              </Field>
              <Field label="تاريخ المباشرة">
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="kt-input"
                />
              </Field>
              <Field label="الراتب (ر.س)">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={formData.salary ?? ''}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="kt-input"
                />
              </Field>
              <Field label="رقم الآيبان (IBAN)" className="kt-wide">
                <input
                  type="text"
                  value={formData.iban || ''}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="kt-input"
                  dir="ltr"
                />
              </Field>
              <Field label="رابط الصورة الرمزية" className="kt-wide">
                <input
                  type="text"
                  inputMode="url"
                  value={formData.avatar || ''}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  className="kt-input"
                  dir="ltr"
                />
              </Field>
            </div>

            {/* إسناد الحارس إلى استراحاته */}
            <div className="space-y-2">
              <h5 className="kt-sec">الاستراحات المخصصة للحارس</h5>
              <div className="kt-grid2">
                {properties.map((prop) => {
                  const isSelected = (formData.assignedPropertyIds || []).includes(prop.id);
                  return (
                    <Choice
                      key={prop.id}
                      title={prop.name}
                      sub={prop.code}
                      selected={isSelected}
                      onClick={() => {
                        const current = formData.assignedPropertyIds || [];
                        const next = isSelected ? current.filter((id) => id !== prop.id) : [...current, prop.id];
                        setFormData({ ...formData, assignedPropertyIds: next });
                      }}
                    />
                  );
                })}
              </div>
              {(!formData.assignedPropertyIds || formData.assignedPropertyIds.length === 0) && (
                <div className="kt-warn p-3">
                  <p className="kt-note">
                    لم يتم اختيار أي استراحة بعد. بدون استراحة لن تظهر للحارس أسماء عملاء في لوحة التحكم.
                  </p>
                </div>
              )}
            </div>
          </form>
        </Sheet>
      )}

      {/* تأكيد حذف الحارس */}
      {isDeleteModalOpen && (
        <Sheet
          title="تأكيد حذف الحارس"
          icon={Trash2}
          tone="garn"
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteError(null);
          }}
          footer={
            <Acts cols={2}>
              <Act
                tone="soft"
                label="إلغاء"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteError(null);
                }}
              />
              <Act tone="garnet" icon={Trash2} label="تأكيد الحذف" onClick={handleConfirmDelete} />
            </Acts>
          }
        >
          {deleteError && (
            <div className="kt-warn p-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle size={20} strokeWidth={1.8} className="shrink-0 text-[#B8741A]" />
                <span className="flex-1 min-w-0 text-[13.5px] font-extrabold text-[#7a4a06]">{deleteError}</span>
              </div>
            </div>
          )}
          <div className="kt-sub">
            <p className="text-[15px] font-extrabold" style={{ color: '#1A0F2E' }}>
              حذف الحارس «{guard.name}» نهائياً؟
            </p>
            <p className="kt-note">سيتم إزالة حساب الدخول الخاص بالحارس وفك ارتباطه بأي استراحة مسندة إليه في النظام.</p>
          </div>
        </Sheet>
      )}
    </div>
  );
};
