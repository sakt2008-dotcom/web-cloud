import React, { useState } from 'react';
import {
  PartyPopper,
  Sparkles,
  Phone,
  CheckCircle2,
  Clock,
  Plus,
  UserPlus,
  MessageCircle,
  Building,
  Check,
  AlertCircle,
  HeartHandshake,
  Eye,
  Pencil,
  Trash2,
  DollarSign,
  CalendarDays,
  LayoutGrid,
  ClipboardList,
  Settings,
  Sliders,
  ShieldCheck,
  Users,
  Save,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INITIAL_COORDINATORS, INITIAL_COORDINATION_TASKS } from '../../data/mock';
import { Coordinator, CoordinatorPermissions, CoordinationTask } from '../../types';
import { Head, Row, Tag, Tile, Face, Acts, Act, Infos, Info, Stats, Stat, Seg, Switch, Field, Sheet, Acc, IconBtn } from '../ui/kit';
import type { Ico } from '../ui/kit';

/** صلاحيات المنسقة: عناوين قصيرة بسطر واحد */
const COORD_PERMS: { key: keyof CoordinatorPermissions; label: string; icon: Ico }[] = [
  { key: 'canViewDashboard', label: 'لوحة التحكم', icon: LayoutGrid },
  { key: 'canViewGuardTasks', label: 'مهمات الحارس', icon: ShieldCheck },
  { key: 'canViewCalendar', label: 'ضبط الأسعار', icon: CalendarDays },
  { key: 'canViewBookings', label: 'الحجوزات', icon: ClipboardList },
  { key: 'canViewProperties', label: 'العقار والوحدات', icon: Building },
  { key: 'canViewMarketers', label: 'المسوقون والعمولات', icon: Users },
  { key: 'canViewMore', label: 'المزيد والإعدادات', icon: Settings },
  { key: 'canViewAllBookings', label: 'رؤية كافة الحجوزات', icon: Eye },
  { key: 'canCreateContract', label: 'إنشاء وتعديل العقود', icon: CheckCircle2 },
  { key: 'canEditDeposit', label: 'تعديل مبلغ العربون', icon: DollarSign },
];

interface CoordinatorsSectionProps {
  onOpenGeminiAI?: () => void;
}

interface ServiceDraft {
  id: string;
  title: string;
  price: number;
}

export const CoordinatorsSection: React.FC<CoordinatorsSectionProps> = ({ onOpenGeminiAI }) => {
  const {
    properties,
    isAdmin,
    canViewMore,
    coordinatorServices,
    addCoordinatorService,
    updateCoordinatorService,
    deleteCoordinatorService,
    coordinators,
    addCoordinator,
    updateCoordinator,
    updateCoordinatorPermissions,
    deleteCoordinator,
  } = useApp();

  const canManageCoordinators = isAdmin || canViewMore;

  const resolveCoordinatorPerm = (
    perms: Partial<CoordinatorPermissions> | undefined,
    key: keyof CoordinatorPermissions
  ): boolean => {
    const defaultTrueKeys: (keyof CoordinatorPermissions)[] = [
      'canViewDashboard',
      'canViewBookings',
      'canCreateBooking',
      'canCreateContract',
      'canEditDeposit',
      'canViewCustomerContacts',
    ];
    if (defaultTrueKeys.includes(key)) {
      return perms?.[key] !== false;
    }
    return !!perms?.[key];
  };

  const [tasks, setTasks] = useState<CoordinationTask[]>(() => {
    try {
      const saved = localStorage.getItem('amasa_coordination_tasks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_COORDINATION_TASKS;
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'completed' | 'team'>('all');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [permOpen, setPermOpen] = useState<Record<string, boolean>>({});

  // New task modal
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [taskCustomerName, setTaskCustomerName] = useState('');
  const [taskCustomerPhone, setTaskCustomerPhone] = useState('');
  const [taskProperty, setTaskProperty] = useState(properties[0]?.name || 'الترف');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [taskServiceTitle, setTaskServiceTitle] = useState('');
  const [taskServiceDetails, setTaskServiceDetails] = useState('');
  const [taskCoordinatorId, setTaskCoordinatorId] = useState(coordinators[0]?.id || 'c1');
  const [taskPrice, setTaskPrice] = useState(1000);

  // New coordinator modal
  const [addCoordModalOpen, setAddCoordModalOpen] = useState(false);
  const [coordName, setCoordName] = useState('');
  const [coordPhone, setCoordPhone] = useState('');
  const [coordEmail, setCoordEmail] = useState('');
  const [coordNationalId, setCoordNationalId] = useState('');
  const [coordBank, setCoordBank] = useState('مصرف الراجحي');
  const [coordIban, setCoordIban] = useState('');

  // Edit coordinator modal
  const [editCoordModalOpen, setEditCoordModalOpen] = useState(false);
  const [selectedCoordForEdit, setSelectedCoordForEdit] = useState<Coordinator | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editBank, setEditBank] = useState('مصرف الراجحي');
  const [editIban, setEditIban] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editStatus, setEditStatus] = useState<'available' | 'busy'>('available');
  const [editCoordError, setEditCoordError] = useState<string | null>(null);

  // Delete coordinator confirmation modal state
  const [coordToDelete, setCoordToDelete] = useState<{ id: string; name: string } | null>(null);

  // Draft services inside the "إضافة منسقة معتمدة" modal
  const [coordServicesDraft, setCoordServicesDraft] = useState<ServiceDraft[]>([]);
  const [serviceTitleInput, setServiceTitleInput] = useState('');
  const [servicePriceInput, setServicePriceInput] = useState<number | ''>('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Modal to manage services of existing coordinator
  const [manageCoordServicesModalOpen, setManageCoordServicesModalOpen] = useState(false);
  const [selectedCoordForServices, setSelectedCoordForServices] = useState<Coordinator | null>(null);
  const [manageServiceTitle, setManageServiceTitle] = useState('');
  const [manageServicePrice, setManageServicePrice] = useState<number | ''>('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const saveTasks = (newTasks: CoordinationTask[]) => {
    setTasks(newTasks);
    try {
      localStorage.setItem('amasa_coordination_tasks', JSON.stringify(newTasks));
    } catch {}
  };

  // Draft services handlers in "إضافة منسقة معتمدة" modal
  const handleAddOrUpdateDraftService = () => {
    if (!serviceTitleInput.trim()) return;
    const priceNum = servicePriceInput === '' ? 0 : Number(servicePriceInput);

    if (editingDraftId) {
      setCoordServicesDraft((prev) =>
        prev.map((s) => (s.id === editingDraftId ? { ...s, title: serviceTitleInput.trim(), price: priceNum } : s))
      );
      setEditingDraftId(null);
    } else {
      const newDraft: ServiceDraft = {
        id: `draft-${Date.now()}`,
        title: serviceTitleInput.trim(),
        price: priceNum,
      };
      setCoordServicesDraft((prev) => [...prev, newDraft]);
    }

    setServiceTitleInput('');
    setServicePriceInput('');
  };

  const handleStartEditDraft = (srv: ServiceDraft) => {
    setEditingDraftId(srv.id);
    setServiceTitleInput(srv.title);
    setServicePriceInput(srv.price);
  };

  const handleCancelEditDraft = () => {
    setEditingDraftId(null);
    setServiceTitleInput('');
    setServicePriceInput('');
  };

  const handleDeleteDraft = (id: string) => {
    setCoordServicesDraft((prev) => prev.filter((s) => s.id !== id));
    if (editingDraftId === id) {
      handleCancelEditDraft();
    }
  };

  const handleUpdateStatus = (taskId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
    saveTasks(updated);
    const msg =
      newStatus === 'completed'
        ? 'تم تحديد الطلب كـ "تم التجهيز والتسليم بنجاح"!'
        : 'تم تحديث حالة التجهيز!';
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskCustomerName || !taskServiceTitle) return;

    const assignedCoord = coordinators.find((c) => c.id === taskCoordinatorId) || coordinators[0];

    const newTask: CoordinationTask = {
      id: `ct-${Date.now()}`,
      bookingCode: `BK-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName: taskCustomerName.trim(),
      customerPhone: taskCustomerPhone.trim() || '0500000000',
      propertyName: taskProperty,
      date: taskDate,
      serviceTitle: taskServiceTitle.trim(),
      serviceDetails: taskServiceDetails.trim() || 'تنسيق وتجهيز خاص للشاليه',
      coordinatorId: assignedCoord.id,
      coordinatorName: assignedCoord.name,
      coordinatorPhone: assignedCoord.phone,
      status: 'in_progress',
      price: Number(taskPrice) || 0,
    };

    saveTasks([newTask, ...tasks]);
    setSuccessToast(`تمت إضافة طلب التنسيق بنجاح وتعيين المنسقة (${assignedCoord.name})!`);
    setAddTaskModalOpen(false);
    setTaskCustomerName('');
    setTaskCustomerPhone('');
    setTaskServiceTitle('');
    setTaskServiceDetails('');
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleCreateCoordinator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordName.trim() || !coordPhone.trim()) return;

    // Collect all services including any currently typed in inputs
    const allServices = [...coordServicesDraft];
    if (serviceTitleInput.trim()) {
      allServices.push({
        id: `draft-${Date.now()}`,
        title: serviceTitleInput.trim(),
        price: servicePriceInput === '' ? 0 : Number(servicePriceInput),
      });
    }

    const specialtySummary =
      allServices.length > 0
        ? allServices.map((s) => `${s.title} (${s.price} ر.س)`).join('، ')
        : 'تنسيق وتجهيز مناسبات وشاليهات';

    const created = addCoordinator({
      name: coordName.trim(),
      phone: coordPhone.trim(),
      email: coordEmail.trim() || undefined,
      nationalId: coordNationalId.trim() || undefined,
      specialty: specialtySummary,
      bankName: coordBank,
      bankAccount: coordIban.trim(),
      status: 'available',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    });

    // Save all services to AppContext so they appear in bookings with their prices!
    allServices.forEach((s) => {
      addCoordinatorService({
        coordinatorId: created.id,
        coordinatorName: created.name,
        coordinatorPhone: created.phone,
        title: s.title,
        price: s.price,
        description: s.title,
        isActive: true,
      });
    });

    setSuccessToast(`تمت إضافة المنسقة (${coordName}) بنجاح مع (${allServices.length}) خدمات مدرجة في الحجوزات!`);
    setAddCoordModalOpen(false);
    setCoordName('');
    setCoordPhone('');
    setCoordEmail('');
    setCoordNationalId('');
    setCoordBank('مصرف الراجحي');
    setCoordIban('');
    setCoordServicesDraft([]);
    setServiceTitleInput('');
    setServicePriceInput('');
    setEditingDraftId(null);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenEditCoordinator = (coord: Coordinator) => {
    setSelectedCoordForEdit(coord);
    setEditName(coord.name || '');
    setEditPhone(coord.phone || '');
    setEditEmail(coord.email || '');
    setEditNationalId(coord.nationalId || '');
    setEditBank(coord.bankName || 'مصرف الراجحي');
    setEditIban(coord.bankAccount || '');
    setEditSpecialty(coord.specialty || '');
    setEditStatus(coord.status || 'available');
    setEditCoordError(null);
    setEditCoordModalOpen(true);
  };

  const handleSaveEditCoordinator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoordForEdit) return;
    if (!editName.trim() || !editPhone.trim()) {
      setEditCoordError('يرجى إدخال اسم المنسقة ورقم الجوال قبل الحفظ');
      return;
    }

    updateCoordinator(selectedCoordForEdit.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim() || undefined,
      nationalId: editNationalId.trim() || undefined,
      bankName: editBank,
      bankAccount: editIban.trim(),
      specialty: editSpecialty.trim(),
      status: editStatus,
    });

    // Update existing coordination tasks if assigned to this coordinator
    const updatedTasks = tasks.map((t) =>
      t.coordinatorId === selectedCoordForEdit.id
        ? { ...t, coordinatorName: editName.trim(), coordinatorPhone: editPhone.trim() }
        : t
    );
    saveTasks(updatedTasks);

    setEditCoordError(null);
    setEditCoordModalOpen(false);
    setSuccessToast(`تم حفظ وتحديث بيانات المنسقة (${editName.trim()}) بنجاح!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleDeleteCoordinator = (coordId: string, name: string) => {
    setCoordToDelete({ id: coordId, name });
  };

  const confirmDeleteCoordinator = () => {
    if (!coordToDelete) return;
    const res = deleteCoordinator(coordToDelete.id);

    // Update tasks if any
    const updatedTasks = tasks.filter((t) => t.coordinatorId !== coordToDelete.id);
    saveTasks(updatedTasks);

    setCoordToDelete(null);
    setSuccessToast(res.message);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Open modal to manage services for an existing coordinator
  const handleOpenManageServices = (coord: Coordinator) => {
    setSelectedCoordForServices(coord);
    setManageServiceTitle('');
    setManageServicePrice('');
    setEditingServiceId(null);
    setManageCoordServicesModalOpen(true);
  };

  const handleSaveExistingCoordinatorService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoordForServices || !manageServiceTitle.trim()) return;

    const priceNum = manageServicePrice === '' ? 0 : Number(manageServicePrice);

    if (editingServiceId) {
      updateCoordinatorService(editingServiceId, {
        title: manageServiceTitle.trim(),
        price: priceNum,
      });
      setSuccessToast(`تم تحديث خدمة "${manageServiceTitle}" بنجاح!`);
    } else {
      addCoordinatorService({
        coordinatorId: selectedCoordForServices.id,
        coordinatorName: selectedCoordForServices.name,
        coordinatorPhone: selectedCoordForServices.phone,
        title: manageServiceTitle.trim(),
        price: priceNum,
        description: manageServiceTitle.trim(),
        isActive: true,
      });
      setSuccessToast(`تمت إضافة خدمة جديدة للمنسقة (${selectedCoordForServices.name}) بنجاح!`);
    }

    setManageServiceTitle('');
    setManageServicePrice('');
    setEditingServiceId(null);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Metrics
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress' || t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalRevenue = tasks.reduce((sum, t) => sum + (t.price || 0), 0);

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'in_progress') return t.status === 'in_progress' || t.status === 'pending';
    if (activeFilter === 'completed') return t.status === 'completed';
    return true;
  });

  const flash = (msg: string, ms = 3000) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), ms);
  };

  const closeAddTask = () => setAddTaskModalOpen(false);
  const closeAddCoord = () => setAddCoordModalOpen(false);
  const closeEditCoord = () => {
    setEditCoordModalOpen(false);
    setEditCoordError(null);
  };
  const closeManage = () => setManageCoordServicesModalOpen(false);

  /** صفّ خدمة: عنوان + سعر وزرّا تعديل/حذف */
  const serviceRow = (
    key: string,
    title: string,
    price: number,
    onEdit: () => void,
    onDelete: () => void
  ) => (
    <Row
      key={key}
      title={title}
      sub={`${price} ر.س`}
      end={
        <>
          <IconBtn icon={Pencil} label={`تعديل خدمة ${title}`} onClick={onEdit} />
          <IconBtn icon={Trash2} tone="garn" label={`حذف خدمة ${title}`} onClick={onDelete} />
        </>
      }
    />
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* إشعار النجاح */}
      {successToast && (
        <div className="kt-ok animate-in fade-in" role="status">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{successToast}</span>
            <button type="button" onClick={() => setSuccessToast(null)} aria-label="إغلاق" className="kt-err-x">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 1. ترويسة لوحة المنسقات */}
      <section className="lux-hero p-4 space-y-3.5">
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative flex items-center gap-3.5">
          <Tile icon={PartyPopper} tone="ch" dark size={56} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-[18px] font-extrabold truncate" style={{ color: '#F5F0FC' }}>
              لوحة المنسقات
            </h3>
            <p className="text-[12.5px] truncate" style={{ color: '#BFB2DC' }}>
              خدمات المناسبات والضيافة
            </p>
            <Tag tone="gold">{coordinators.length} منسقات معتمدات</Tag>
          </div>
        </div>
        <Acts cols={2} className="relative">
          <Act tone="gold" icon={Plus} label="طلب تجهيز" onClick={() => setAddTaskModalOpen(true)} />
          {canManageCoordinators && (
            <Act tone="dark" icon={UserPlus} label="إضافة منسقة" onClick={() => setAddCoordModalOpen(true)} />
          )}
        </Acts>
      </section>

      {/* 2. مؤشرات سريعة */}
      <Stats cols={2} compact>
        <Stat label="فريق المنسقات" value={coordinators.length} unit="منسقة" icon={HeartHandshake} tone="garn" />
        <Stat label="قيد التجهيز" value={inProgressCount} unit="طلب" icon={Clock} tone="sand" />
        <Stat label="تم التسليم" value={completedCount} unit="مكتمل" icon={CheckCircle2} tone="jade" />
        <Stat label="قيمة التنسيق" value={totalRevenue.toLocaleString('en-US')} unit="ر.س" icon={Sparkles} tone="amy" />
      </Stats>

      {/* 3. الفلاتر */}
      <Seg
        label="تصفية طلبات التجهيز"
        value={activeFilter}
        onChange={setActiveFilter}
        items={[
          { id: 'all', label: 'الكل', icon: ClipboardList, badge: tasks.length },
          { id: 'in_progress', label: 'قيد التجهيز', icon: Clock, badge: inProgressCount },
          { id: 'completed', label: 'تم التسليم', icon: CheckCircle2, badge: completedCount },
          { id: 'team', label: 'الفريق', icon: HeartHandshake, badge: coordinators.length },
        ]}
      />

      {/* 4. فريق المنسقات */}
      {activeFilter === 'team' && (
        <div className="space-y-3">
          {coordinators.map((c) => {
            const srvList = coordinatorServices.filter((s) => s.coordinatorId === c.id || s.coordinatorName === c.name);
            const openCount = COORD_PERMS.filter((p) => resolveCoordinatorPerm(c.permissions, p.key)).length;
            const waHref = `https://wa.me/966${c.phone.replace(/^0/, '')}?text=${encodeURIComponent(
              `مرحباً أختي ${c.name}، نود التنسيق بشأن تجهيز الشاليه لحجز اليوم:`
            )}`;
            return (
              <section key={c.id} className="lux-card p-4 space-y-3.5">
                <div className="kt-row">
                  <Face src={c.avatar} name={c.name} size={48} square />
                  <span className="kt-row-t">
                    <span className="kt-row-n">{c.name}</span>
                    <span className="kt-row-s">
                      ★ {c.rating.toFixed(1)} · {c.completedTasks} مهمة
                    </span>
                  </span>
                  <Tag tone={c.status === 'busy' ? 'garn' : 'jade'}>{c.status === 'busy' ? 'مشغولة' : 'متاحة'}</Tag>
                </div>

                <Acts cols={4}>
                  <Act stack tone="soft" icon={Phone} label="اتصال" title={`الاتصال بـ ${c.name}`} href={`tel:${c.phone}`} />
                  <Act stack tone="jadeS" icon={MessageCircle} label="واتساب" title={`واتساب ${c.name}`} href={waHref} />
                  <Act stack tone="ink" icon={Pencil} label="تعديل" title={`تعديل بيانات ${c.name}`} onClick={() => handleOpenEditCoordinator(c)} />
                  <Act stack tone="garnS" icon={Trash2} label="حذف" title={`حذف ${c.name}`} onClick={() => handleDeleteCoordinator(c.id, c.name)} />
                </Acts>

                {/* الجوال والهوية والبريد والبنك */}
                <Infos cols={2}>
                  <Info label="الجوال" value={c.phone} ltr wide={!c.nationalId} />
                  {c.nationalId && <Info label="الهوية الوطنية" value={c.nationalId} ltr />}
                  {c.email && <Info wide label="البريد" value={c.email} ltr />}
                  {(c.bankName || c.bankAccount) && (
                    <Info wide label={c.bankName || 'البنك المعتمد'} value={c.bankAccount || 'غير مسجل'} ltr />
                  )}
                </Infos>

                {/* الخدمات والأسعار */}
                <div className="kt-sub">
                  <Head
                    title="الخدمات والأسعار"
                    icon={Sparkles}
                    tone="garn"
                    action={<Act small tone="soft" icon={Plus} label="إضافة خدمة" onClick={() => handleOpenManageServices(c)} />}
                  />
                  {srvList.length > 0 ? (
                    <div className="space-y-2">
                      {srvList.map((srv) =>
                        serviceRow(
                          srv.id,
                          srv.title,
                          srv.price,
                          () => {
                            setSelectedCoordForServices(c);
                            setManageServiceTitle(srv.title);
                            setManageServicePrice(srv.price);
                            setEditingServiceId(srv.id);
                            setManageCoordServicesModalOpen(true);
                          },
                          () => {
                            deleteCoordinatorService(srv.id);
                            flash(`تم حذف خدمة "${srv.title}" بنجاح!`);
                          }
                        )
                      )}
                    </div>
                  ) : (
                    <p className="kt-note">{c.specialty || 'لا توجد خدمات بعد. اضغط «إضافة خدمة» للإدراج.'}</p>
                  )}
                </div>

                {/* صلاحيات المنسقة */}
                {canManageCoordinators && (
                  <Acc
                    icon={<Sliders size={20} strokeWidth={1.8} />}
                    title="الصلاحيات"
                    tag={`${openCount}/${COORD_PERMS.length}`}
                    open={!!permOpen[c.id]}
                    onToggle={() => setPermOpen((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                  >
                    <div className="space-y-2">
                      <Act
                        tone="jadeS"
                        icon={ShieldCheck}
                        label="فتح كل الصفحات"
                        title="فتح كل الصفحات السبع للمنسقة"
                        onClick={() => {
                          updateCoordinatorPermissions(c.id, {
                            canViewDashboard: true,
                            canViewGuardTasks: true,
                            canViewCalendar: true,
                            canViewBookings: true,
                            canViewProperties: true,
                            canViewMarketers: true,
                            canViewMore: true,
                          });
                          flash(`تم فتح جميع الصفحات الـ 7 للمنسقة ${c.name} مع كامل التعديل`);
                        }}
                      />
                      {COORD_PERMS.map((item) => {
                        const on = resolveCoordinatorPerm(c.permissions, item.key);
                        return (
                          <Row
                            key={item.key}
                            icon={item.icon}
                            tone={on ? 'jade' : 'gray'}
                            title={item.label}
                            sub={on ? 'مفتوح' : 'مغلق'}
                            end={
                              <Switch
                                on={on}
                                label={`${on ? 'إغلاق' : 'فتح'} ${item.label} للمنسقة ${c.name}`}
                                onChange={() => {
                                  updateCoordinatorPermissions(c.id, { [item.key]: !on });
                                  flash(`تم ${!on ? 'فتح' : 'إغلاق'} (${item.label}) للمنسقة ${c.name}`);
                                }}
                              />
                            }
                          />
                        );
                      })}
                    </div>
                  </Acc>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* 5. طلبات التنسيق والتجهيز */}
      {activeFilter !== 'team' && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="kt-sub items-center text-center py-8">
              <PartyPopper className="w-10 h-10 mx-auto" style={{ color: '#C4BDD3' }} />
              <p className="kt-note">لا توجد طلبات تجهيز تطابق الفلتر الحالي.</p>
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isCompleted = t.status === 'completed';
              const waHref = `https://wa.me/966${t.coordinatorPhone.replace(/^0/, '')}?text=${encodeURIComponent(
                `السلام عليكم أختي ${t.coordinatorName}، بخصوص طلب التجهيز (${t.serviceTitle}) في ${t.propertyName}:`
              )}`;
              return (
                <section key={t.id} className="lux-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Tile icon={isCompleted ? CheckCircle2 : Clock} tone={isCompleted ? 'jade' : 'amy'} size={44} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h4 className="kt-task-t">{t.serviceTitle}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag tone={isCompleted ? 'jade' : 'sand'}>{isCompleted ? 'تم التجهيز والتسليم' : 'جاري التجهيز'}</Tag>
                        <Tag tone="amy" mono>
                          {t.bookingCode}
                        </Tag>
                      </div>
                    </div>
                  </div>

                  <Infos cols={2}>
                    <Info label="تاريخ الحجز" value={t.date} ltr />
                    <Info hi label="القيمة" value={`${t.price.toLocaleString('en-US')} ر.س`} />
                    <Info wide label="العقار" value={t.propertyName} />
                  </Infos>

                  {t.serviceDetails && (
                    <div className="kt-sub">
                      <p className="text-[13.5px] leading-[1.75]" style={{ color: '#3B2F55' }}>
                        {t.serviceDetails}
                      </p>
                    </div>
                  )}

                  <Row icon={HeartHandshake} tone="garn" title={t.coordinatorName} sub="المنسقة المسؤولة" />

                  <Acts cols={2}>
                    <Act tone="jadeS" icon={MessageCircle} label="واتساب المنسقة" href={waHref} />
                    {isCompleted ? (
                      <Act tone="soft" icon={RotateCcw} label="إعادة للتجهيز" title="إعادة الطلب إلى «قيد التجهيز»" onClick={() => handleUpdateStatus(t.id, 'in_progress')} />
                    ) : (
                      <Act tone="jade" icon={Check} label="تأكيد الاكتمال" title="تأكيد اكتمال التجهيز" onClick={() => handleUpdateStatus(t.id, 'completed')} />
                    )}
                  </Acts>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* نافذة: طلب تجهيز جديد */}
      {addTaskModalOpen && (
        <Sheet
          title="طلب تجهيز جديد"
          icon={PartyPopper}
          tone="garn"
          onClose={closeAddTask}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={closeAddTask} />
              <Act submit form="coord-task-form" tone="ink" icon={Save} label="حفظ وتعيين" />
            </Acts>
          }
        >
          <form id="coord-task-form" onSubmit={handleCreateTask} className="space-y-3">
            <div className="kt-fields">
              <Field label="نوع الخدمة / التنسيق *" className="kt-wide">
                <input
                  type="text"
                  required
                  placeholder="مثال: كوشة ورد طبيعي وضيافة VIP"
                  value={taskServiceTitle}
                  onChange={(e) => setTaskServiceTitle(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="اسم النزيل *">
                <input
                  type="text"
                  required
                  placeholder="فيصل الشمري"
                  value={taskCustomerName}
                  onChange={(e) => setTaskCustomerName(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="جوال النزيل">
                <input
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={taskCustomerPhone}
                  onChange={(e) => setTaskCustomerPhone(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Field label="العقار *">
                <select value={taskProperty} onChange={(e) => setTaskProperty(e.target.value)} className="kt-input">
                  {properties.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="تاريخ المناسبة *">
                <input
                  type="date"
                  required
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="المنسقة المسؤولة *">
                <select value={taskCoordinatorId} onChange={(e) => setTaskCoordinatorId(e.target.value)} className="kt-input">
                  {coordinators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="القيمة (ر.س)">
                <input
                  type="number"
                  inputMode="numeric"
                  value={taskPrice}
                  onChange={(e) => setTaskPrice(Number(e.target.value))}
                  className="kt-input"
                />
              </Field>
              <Field label="تفاصيل التجهيز والملاحظات" className="kt-wide">
                <textarea
                  className="kt-input kt-ta"
                  rows={3}
                  placeholder="الألوان المطلوبة، نوع الورد، موعد الدخول قبل النزيل…"
                  value={taskServiceDetails}
                  onChange={(e) => setTaskServiceDetails(e.target.value)}
                />
              </Field>
            </div>
          </form>
        </Sheet>
      )}

      {/* نافذة: إضافة منسقة */}
      {addCoordModalOpen && (
        <Sheet
          title="إضافة منسقة معتمدة"
          icon={UserPlus}
          onClose={closeAddCoord}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={closeAddCoord} />
              <Act submit form="coord-add-form" tone="ink" icon={Save} label="إضافة واعتماد" />
            </Acts>
          }
        >
          <form id="coord-add-form" onSubmit={handleCreateCoordinator} className="space-y-3">
            <div className="kt-fields">
              <Field label="اسم المنسقة *" className="kt-wide">
                <input
                  type="text"
                  required
                  placeholder="مثال: ريم السبيعي"
                  value={coordName}
                  onChange={(e) => setCoordName(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="رقم الجوال *">
                <input
                  type="tel"
                  required
                  placeholder="05xxxxxxxx"
                  value={coordPhone}
                  onChange={(e) => setCoordPhone(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Field label="الهوية الوطنية" hint="اختياري">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="10xxxxxxxx"
                  value={coordNationalId}
                  onChange={(e) => setCoordNationalId(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Field label="البريد الإلكتروني" hint="اختياري" className="kt-wide">
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={coordEmail}
                  onChange={(e) => setCoordEmail(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
            </div>

            {/* الخدمات مع الأسعار */}
            <div className="kt-sub">
              <Head title="الخدمات والأسعار" icon={Sparkles} tone="garn" />
              <p className="kt-note">تظهر مع أسعارها في شاشة الحجوزات.</p>
              <div className="kt-fields">
                <Field label="اسم الخدمة" className="kt-wide">
                  <input
                    type="text"
                    placeholder="كوشة ملكية، تزيين مسبح…"
                    value={serviceTitleInput}
                    onChange={(e) => setServiceTitleInput(e.target.value)}
                    className="kt-input"
                  />
                </Field>
                <Field label="السعر (ر.س)">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    value={servicePriceInput}
                    onChange={(e) => setServicePriceInput(e.target.value === '' ? '' : Number(e.target.value))}
                    className="kt-input"
                  />
                </Field>
                <div className="flex items-end">
                  <Act
                    tone={editingDraftId ? 'sand' : 'ink'}
                    icon={editingDraftId ? Check : Plus}
                    label={editingDraftId ? 'حفظ' : 'إضافة'}
                    onClick={handleAddOrUpdateDraftService}
                  />
                </div>
              </div>

              {coordServicesDraft.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="kt-sec">الخدمات المضافة ({coordServicesDraft.length})</h5>
                    {editingDraftId && <Act small tone="line" label="إلغاء التعديل" onClick={handleCancelEditDraft} />}
                  </div>
                  {coordServicesDraft.map((srv) =>
                    serviceRow(
                      srv.id,
                      srv.title,
                      srv.price,
                      () => handleStartEditDraft(srv),
                      () => handleDeleteDraft(srv.id)
                    )
                  )}
                </div>
              )}
            </div>

            <div className="kt-fields">
              <Field label="البنك المعتمد" className="kt-wide">
                <select value={coordBank} onChange={(e) => setCoordBank(e.target.value)} className="kt-input">
                  <option value="مصرف الراجحي">مصرف الراجحي</option>
                  <option value="البنك الأهلي السعودي">البنك الأهلي السعودي</option>
                  <option value="بنك الإنماء">بنك الإنماء</option>
                </select>
              </Field>
              <Field label="الآيبان (IBAN)" className="kt-wide">
                <input
                  type="text"
                  placeholder="SAxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={coordIban}
                  onChange={(e) => setCoordIban(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
            </div>
          </form>
        </Sheet>
      )}

      {/* نافذة: تعديل بيانات المنسقة */}
      {editCoordModalOpen && selectedCoordForEdit && (
        <Sheet
          title="تعديل بيانات المنسقة"
          icon={Pencil}
          onClose={closeEditCoord}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={closeEditCoord} />
              <Act submit form="coord-edit-form" tone="ink" icon={Save} label="حفظ التعديلات" />
            </Acts>
          }
        >
          <form id="coord-edit-form" onSubmit={handleSaveEditCoordinator} noValidate className="space-y-3">
            {editCoordError && (
              <div className="kt-err">
                <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
                <span className="flex-1 min-w-0">{editCoordError}</span>
              </div>
            )}
            <div className="kt-fields">
              <Field label="اسم المنسقة *" className="kt-wide">
                <input
                  type="text"
                  placeholder="مثال: منى الحربي"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="رقم الجوال *">
                <input
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Field label="حالة الجاهزية">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'available' | 'busy')}
                  className="kt-input"
                >
                  <option value="available">متاحة ✓</option>
                  <option value="busy">مشغولة ✕</option>
                </select>
              </Field>
              <Field label="البريد الإلكتروني" className="kt-wide">
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Field label="الهوية الوطنية" className="kt-wide">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="10xxxxxxxx"
                  value={editNationalId}
                  onChange={(e) => setEditNationalId(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Field label="التخصص ونبذة الخدمات" className="kt-wide">
                <textarea
                  className="kt-input kt-ta"
                  rows={2}
                  placeholder="تنسيق كوش، تزيين مسابح، ضيافة ملكية…"
                  value={editSpecialty}
                  onChange={(e) => setEditSpecialty(e.target.value)}
                />
              </Field>
              <Field label="البنك المعتمد" className="kt-wide">
                <select value={editBank} onChange={(e) => setEditBank(e.target.value)} className="kt-input">
                  <option value="مصرف الراجحي">مصرف الراجحي</option>
                  <option value="البنك الأهلي السعودي">البنك الأهلي السعودي</option>
                  <option value="بنك الإنماء">بنك الإنماء</option>
                  <option value="بنك الرياض">بنك الرياض</option>
                  <option value="بنك البلاد">بنك البلاد</option>
                </select>
              </Field>
              <Field label="الآيبان (IBAN)" className="kt-wide">
                <input
                  type="text"
                  placeholder="SAxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={editIban}
                  onChange={(e) => setEditIban(e.target.value)}
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
            </div>
          </form>
        </Sheet>
      )}

      {/* نافذة: خدمات منسقة موجودة */}
      {manageCoordServicesModalOpen && selectedCoordForServices && (
        <Sheet
          title="خدمات المنسقة"
          icon={Sparkles}
          onClose={closeManage}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إغلاق" onClick={closeManage} />
              <Act
                submit
                form="coord-srv-form"
                tone="ink"
                icon={editingServiceId ? Check : Plus}
                label={editingServiceId ? 'حفظ التعديل' : 'إضافة الخدمة'}
              />
            </Acts>
          }
        >
          <Row icon={HeartHandshake} tone="garn" title={selectedCoordForServices.name} sub={selectedCoordForServices.phone} />

          <form id="coord-srv-form" onSubmit={handleSaveExistingCoordinatorService} className="kt-sub">
            <div className="flex items-center justify-between gap-2">
              <h5 className="kt-sec">{editingServiceId ? 'تعديل الخدمة المحددة' : 'إضافة خدمة جديدة'}</h5>
              {editingServiceId && (
                <Act
                  small
                  tone="line"
                  label="إلغاء التعديل"
                  onClick={() => {
                    setEditingServiceId(null);
                    setManageServiceTitle('');
                    setManageServicePrice('');
                  }}
                />
              )}
            </div>
            <div className="kt-fields">
              <Field label="اسم الخدمة *" className="kt-wide">
                <input
                  type="text"
                  required
                  placeholder="مثال: باقة كوشة ورد ملكية VIP"
                  value={manageServiceTitle}
                  onChange={(e) => setManageServiceTitle(e.target.value)}
                  className="kt-input"
                />
              </Field>
              <Field label="السعر (ر.س) *" className="kt-wide">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  required
                  placeholder="1200"
                  value={manageServicePrice}
                  onChange={(e) => setManageServicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="kt-input"
                />
              </Field>
            </div>
          </form>

          <div className="space-y-2">
            <h5 className="kt-sec">الخدمات المعتمدة حالياً</h5>
            {coordinatorServices
              .filter(
                (s) =>
                  s.coordinatorId === selectedCoordForServices.id || s.coordinatorName === selectedCoordForServices.name
              )
              .map((srv) =>
                serviceRow(
                  srv.id,
                  srv.title,
                  srv.price,
                  () => {
                    setEditingServiceId(srv.id);
                    setManageServiceTitle(srv.title);
                    setManageServicePrice(srv.price);
                  },
                  () => {
                    deleteCoordinatorService(srv.id);
                    flash(`تم حذف خدمة "${srv.title}" بنجاح!`);
                  }
                )
              )}
          </div>
        </Sheet>
      )}

      {/* نافذة: تأكيد حذف المنسقة */}
      {coordToDelete && (
        <Sheet
          title="تأكيد حذف المنسقة"
          icon={Trash2}
          tone="garn"
          onClose={() => setCoordToDelete(null)}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={() => setCoordToDelete(null)} />
              <Act tone="garnet" icon={Trash2} label="تأكيد الحذف" onClick={confirmDeleteCoordinator} />
            </Acts>
          }
        >
          <div className="kt-sub">
            <p className="text-[15px] font-extrabold" style={{ color: '#1A0F2E' }}>
              حذف المنسقة «{coordToDelete.name}» نهائياً؟
            </p>
            <p className="kt-note">سيتم حذف جميع خدماتها المرتبطة من شاشة الحجوزات وحذف حسابها من النظام.</p>
          </div>
        </Sheet>
      )}
    </div>
  );
};
