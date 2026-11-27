import React, { useState, useMemo } from 'react';
import {
  Sun,
  Moon,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ShieldCheck,
  User,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  Send,
  Trash2,
  Eye,
  Check,
  Filter,
  Layers,
  Award,
  Search,
  Edit3,
  RotateCcw,
  Wrench,
  Copy,
  Upload,
  X,
  LayoutGrid,
  Coins,
  CheckSquare,
  ClipboardList,
  Repeat,
  Pin,
  BookmarkPlus,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Head, Seg, Stats, Stat, Row, Tag, Tile, Acts, Act, Field, Choice, Switch, SearchBox, Infos, Info, Sheet } from '../ui/kit';
import { GuardDailyTask, GuardTaskTemplate, GuardTaskStatus, TaskShift, GuardTaskPriority } from '../../types';
import { InAppCameraModal } from './InAppCameraModal';

const QUICK_TIME_SLOTS = [
  '07:00 ص - 08:30 ص',
  '09:00 ص - 10:00 ص',
  '12:00 م - 01:30 م',
  '05:00 م - 06:30 م',
  '09:00 م - 10:30 م',
];

const WEEKDAYS_AR: { day: number; label: string; short: string }[] = [
  { day: 6, label: 'السبت', short: 'سبت' },
  { day: 0, label: 'الأحد', short: 'أحد' },
  { day: 1, label: 'الاثنين', short: 'إثنين' },
  { day: 2, label: 'الثلاثاء', short: 'ثلاثاء' },
  { day: 3, label: 'الأربعاء', short: 'أربعاء' },
  { day: 4, label: 'الخميس', short: 'خميس' },
  { day: 5, label: 'الجمعة', short: 'جمعة' },
];

export const GuardTasksTab: React.FC = () => {
  const {
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
    isAdmin,
    isGuard,
    canViewGuardTasks,
    canViewDashboard,
    setActiveTab,
    guard,
    guardsList,
    properties,
  } = useApp();

  const canManageTasks = isAdmin || (!isGuard && canViewGuardTasks);
  const todayStr = new Date().toISOString().split('T')[0];

  // Filters (replaced property filter with task-name filter)
  const [selectedShift, setSelectedShift] = useState<'all' | TaskShift>('all');
  const [selectedTaskNameFilter, setSelectedTaskNameFilter] = useState<string>('all');
  const [selectedGuardFilter, setSelectedGuardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'verified'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Saved task names & weekly recurring library toggle
  const [isLibraryExpanded, setIsLibraryExpanded] = useState<boolean>(false);

  // Inline feedback toast
  const [localToast, setLocalToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => setLocalToast(null), 3500);
  };

  // New task form state (for Admin / Manager)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGuardId, setFormGuardId] = useState<string>(() => guardsList[0]?.id || guard.id);
  const [formShift, setFormShift] = useState<TaskShift>('morning');
  const [formPriority, setFormPriority] = useState<GuardTaskPriority>('normal');
  const [formRequiresPhoto, setFormRequiresPhoto] = useState<boolean>(true);
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formTimeSlot, setFormTimeSlot] = useState<string>('09:00 ص - 10:00 ص');
  const [formAdminReferencePhoto, setFormAdminReferencePhoto] = useState<string>('');
  const [formDeductionAmount, setFormDeductionAmount] = useState<string>('25');
  const [formSaveToLibrary, setFormSaveToLibrary] = useState<boolean>(true);
  const [formWeeklyRecurring, setFormWeeklyRecurring] = useState<boolean>(false);
  const [formWeeklyDays, setFormWeeklyDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Add/Edit Saved Task Name (Template) Modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GuardTaskTemplate | null>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplShift, setTplShift] = useState<TaskShift>('morning');
  const [tplPriority, setTplPriority] = useState<GuardTaskPriority>('normal');
  const [tplTimeSlot, setTplTimeSlot] = useState('09:00 ص - 10:00 ص');
  const [tplDeductionAmount, setTplDeductionAmount] = useState('25');
  const [tplRequiresPhoto, setTplRequiresPhoto] = useState(true);
  const [tplAdminReferencePhoto, setTplAdminReferencePhoto] = useState('');
  const [tplGuardId, setTplGuardId] = useState<string>(guardsList[0]?.id || guard.id);
  const [tplWeeklyRecurring, setTplWeeklyRecurring] = useState(false);
  const [tplWeeklyDays, setTplWeeklyDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Delete Template Confirmation Modal
  const [templateToDelete, setTemplateToDelete] = useState<GuardTaskTemplate | null>(null);

  // Edit Existing Task Modal state (supports editing waiting OR completed/verified tasks + completion time)
  const [editingTask, setEditingTask] = useState<GuardDailyTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGuardId, setEditGuardId] = useState('');
  const [editShift, setEditShift] = useState<TaskShift>('morning');
  const [editPriority, setEditPriority] = useState<GuardTaskPriority>('normal');
  const [editStatus, setEditStatus] = useState<GuardTaskStatus>('pending');
  const [editCompletedAt, setEditCompletedAt] = useState('');
  const [editGuardNotes, setEditGuardNotes] = useState('');
  const [editAdminFeedback, setEditAdminFeedback] = useState('');
  const [editRequiresPhoto, setEditRequiresPhoto] = useState(true);
  const [editDate, setEditDate] = useState(todayStr);
  const [editTimeSlot, setEditTimeSlot] = useState('');
  const [editAdminReferencePhoto, setEditAdminReferencePhoto] = useState('');
  const [editDeductionAmount, setEditDeductionAmount] = useState('25');
  const [editWeeklyPinned, setEditWeeklyPinned] = useState(false);
  const [editWeeklyDays, setEditWeeklyDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Camera modal state
  const [cameraModalTask, setCameraModalTask] = useState<GuardDailyTask | null>(null);

  // Quick complete without photo modal
  const [quickCompleteTask, setQuickCompleteTask] = useState<GuardDailyTask | null>(null);
  const [quickCompleteNote, setQuickCompleteNote] = useState('');

  // Reopen / Return task modal (Admin)
  const [reopenTargetTask, setReopenTargetTask] = useState<GuardDailyTask | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  // Delete task confirmation modal
  const [taskToDelete, setTaskToDelete] = useState<GuardDailyTask | null>(null);

  // Guard Emergency / Maintenance Field Report modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<'maintenance' | 'supplies' | 'emergency' | 'guest_note'>('maintenance');
  const [reportPropertyId, setReportPropertyId] = useState<string>(
    guard.assignedPropertyId || guard.assignedPropertyIds?.[0] || properties[0]?.id || 'al-taraf'
  );
  const [reportTitle, setReportTitle] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  // Photo viewer modal state
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; title: string; time: string; note?: string } | null>(null);

  const effectiveGuard = guard;
  const guardAssignedIds = useMemo(() => {
    if (effectiveGuard.assignedPropertyIds && effectiveGuard.assignedPropertyIds.length > 0) {
      return effectiveGuard.assignedPropertyIds;
    }
    return effectiveGuard.assignedPropertyId ? [effectiveGuard.assignedPropertyId] : [];
  }, [effectiveGuard.assignedPropertyId, effectiveGuard.assignedPropertyIds]);

  // Base scoped tasks (for Guard role, scoped to their assigned tasks/general/properties)
  const scopedTasks = useMemo(() => {
    if (isGuard && !isAdmin) {
      return guardTasks.filter(
        (t) =>
          t.guardId === effectiveGuard.id ||
          t.propertyId === 'general' ||
          (t.propertyId && guardAssignedIds.includes(t.propertyId))
      );
    }
    return guardTasks;
  }, [guardTasks, isGuard, isAdmin, effectiveGuard.id, guardAssignedIds]);

  // Distinct task names for the filter dropdown (from templates + active tasks)
  const allTaskNames = useMemo(() => {
    const names = new Set<string>();
    guardTaskTemplates.forEach((tpl) => {
      if (tpl.title?.trim()) names.add(tpl.title.trim());
    });
    scopedTasks.forEach((t) => {
      if (t.title?.trim()) names.add(t.title.trim());
    });
    return Array.from(names);
  }, [guardTaskTemplates, scopedTasks]);

  // Filter tasks with search, status, shift, task name, guard, and date
  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedTasks.filter((t) => {
      if (selectedShift !== 'all' && t.shift !== selectedShift) return false;
      if (selectedTaskNameFilter !== 'all' && t.title.trim() !== selectedTaskNameFilter) return false;
      if (selectedGuardFilter !== 'all' && t.guardId !== selectedGuardFilter) return false;
      if (dateFilter === 'today' && t.date !== todayStr) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && (t.status === 'completed' || t.status === 'verified')) return false;
        if (statusFilter === 'completed' && t.status !== 'completed') return false;
        if (statusFilter === 'verified' && t.status !== 'verified') return false;
      }

      if (q) {
        const hay = `${t.title} ${t.description || ''} ${t.guardName || ''} ${t.guardNotes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    scopedTasks,
    selectedShift,
    selectedTaskNameFilter,
    selectedGuardFilter,
    dateFilter,
    todayStr,
    statusFilter,
    searchQuery,
  ]);

  // Shift & compliance statistics computed over scopedTasks
  const stats = useMemo(() => {
    const morningCount = scopedTasks.filter((t) => t.shift === 'morning').length;
    const morningDone = scopedTasks.filter(
      (t) => t.shift === 'morning' && (t.status === 'completed' || t.status === 'verified')
    ).length;
    const eveningCount = scopedTasks.filter((t) => t.shift === 'evening').length;
    const eveningDone = scopedTasks.filter(
      (t) => t.shift === 'evening' && (t.status === 'completed' || t.status === 'verified')
    ).length;
    const pendingCount = scopedTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
    const completedAwaitingVerifyCount = scopedTasks.filter((t) => t.status === 'completed').length;
    const verifiedCount = scopedTasks.filter((t) => t.status === 'verified').length;
    const totalCount = scopedTasks.length;
    const totalDone = completedAwaitingVerifyCount + verifiedCount;
    const appliedDeductionsTotal = scopedTasks
      .filter((t) => t.deductionApplied)
      .reduce((sum, t) => sum + (Number(t.deductionAmount) || 0), 0);
    const weeklyPinnedTemplatesCount = guardTaskTemplates.filter((t) => t.isWeeklyRecurring).length;

    return {
      morningCount,
      morningDone,
      eveningCount,
      eveningDone,
      pendingCount,
      completedAwaitingVerifyCount,
      verifiedCount,
      totalCount,
      totalDone,
      appliedDeductionsTotal,
      weeklyPinnedTemplatesCount,
      progressPercent: totalCount > 0 ? Math.round((totalDone / totalCount) * 100) : 0,
    };
  }, [scopedTasks, guardTaskTemplates]);

  // Helper to read local image as resized dataUrl for admin reference photo
  const handleReferencePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onDone: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > 960 ? 960 / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onDone(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleDayInArray = (days: number[], day: number): number[] => {
    if (days.includes(day)) {
      return days.length > 1 ? days.filter((d) => d !== day) : days;
    }
    return [...days, day];
  };

  const formatWeeklyDaysText = (days?: number[]) => {
    if (!days || days.length === 0 || days.length === 7) return 'يومياً كل أسبوع';
    return WEEKDAYS_AR.filter((w) => days.includes(w.day))
      .map((w) => w.short)
      .join('، ');
  };

  const handleApplyTemplateToForm = (tpl: GuardTaskTemplate) => {
    setSelectedTemplateId(tpl.id);
    setFormTitle(tpl.title);
    setFormDescription(tpl.description || '');
    setFormShift(tpl.shift);
    setFormPriority(tpl.priority);
    setFormTimeSlot(tpl.timeSlot || '09:00 ص - 10:00 ص');
    setFormDeductionAmount(String(tpl.deductionAmount ?? 25));
    setFormRequiresPhoto(tpl.requiresPhoto);
    setFormAdminReferencePhoto(tpl.adminReferencePhoto || '');
    if (tpl.guardId) setFormGuardId(tpl.guardId);
    setFormWeeklyRecurring(Boolean(tpl.isWeeklyRecurring));
    setFormWeeklyDays(tpl.weeklyDays && tpl.weeklyDays.length > 0 ? tpl.weeklyDays : [0, 1, 2, 3, 4, 5, 6]);
    setFormSaveToLibrary(false);
    setIsAddFormOpen(true);
  };

  const handleQuickAssignTemplateToday = (tpl: GuardTaskTemplate) => {
    const targetG = guardsList.find((g) => g.id === tpl.guardId) || guardsList[0] || guard;
    addGuardTask({
      title: tpl.title,
      description: tpl.description || '',
      propertyId: 'general',
      propertyName: tpl.title,
      guardId: targetG.id,
      guardName: tpl.guardName || targetG.name,
      shift: tpl.shift,
      date: todayStr,
      timeSlot: tpl.timeSlot,
      adminReferencePhoto: tpl.adminReferencePhoto,
      deductionAmount: tpl.deductionAmount ?? 25,
      priority: tpl.priority,
      requiresPhoto: tpl.requiresPhoto,
      createdBy: isAdmin ? 'الإدارة العامة' : 'المشرف',
      templateId: tpl.id,
      isWeeklyPinned: Boolean(tpl.isWeeklyRecurring),
      weeklyDays: tpl.weeklyDays,
    });
    showToast(`تم إسناد مهمة "${tpl.title}" لليوم للحارس (${targetG.name})`);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = formTitle.trim();
    if (!cleanTitle) return;

    const assignedG = guardsList.find((g) => g.id === formGuardId) || guardsList[0] || guard;
    const cleanDeduct = Math.max(0, Number(formDeductionAmount) || 0);
    const cleanRefPhoto = formAdminReferencePhoto.trim() || undefined;
    const cleanSlot = formTimeSlot.trim() || undefined;

    let templateIdUsed = selectedTemplateId || undefined;

    if (formSaveToLibrary || formWeeklyRecurring) {
      const existingTpl = guardTaskTemplates.find(
        (t) => t.id === selectedTemplateId || t.title.trim() === cleanTitle
      );
      if (existingTpl) {
        updateGuardTaskTemplate(existingTpl.id, {
          title: cleanTitle,
          description: formDescription.trim(),
          shift: formShift,
          priority: formPriority,
          timeSlot: cleanSlot,
          deductionAmount: cleanDeduct,
          requiresPhoto: formRequiresPhoto,
          adminReferencePhoto: cleanRefPhoto,
          guardId: assignedG.id,
          guardName: assignedG.name,
          isWeeklyRecurring: formWeeklyRecurring,
          weeklyDays: formWeeklyDays,
        });
        templateIdUsed = existingTpl.id;
      } else {
        const createdTpl = addGuardTaskTemplate({
          title: cleanTitle,
          description: formDescription.trim(),
          shift: formShift,
          priority: formPriority,
          timeSlot: cleanSlot,
          deductionAmount: cleanDeduct,
          requiresPhoto: formRequiresPhoto,
          adminReferencePhoto: cleanRefPhoto,
          guardId: assignedG.id,
          guardName: assignedG.name,
          isWeeklyRecurring: formWeeklyRecurring,
          weeklyDays: formWeeklyDays,
          lastGeneratedDate: formDate === todayStr ? todayStr : undefined,
        });
        templateIdUsed = createdTpl.id;
      }
    }

    addGuardTask({
      title: cleanTitle,
      description: formDescription.trim(),
      propertyId: 'general',
      propertyName: cleanTitle,
      guardId: assignedG.id,
      guardName: assignedG.name,
      shift: formShift,
      date: formDate,
      timeSlot: cleanSlot,
      adminReferencePhoto: cleanRefPhoto,
      deductionAmount: cleanDeduct,
      priority: formPriority,
      requiresPhoto: formRequiresPhoto,
      createdBy: isAdmin ? 'الإدارة العامة' : 'المشرف',
      templateId: templateIdUsed,
      isWeeklyPinned: formWeeklyRecurring,
      weeklyDays: formWeeklyRecurring ? formWeeklyDays : undefined,
    });

    setFormTitle('');
    setFormDescription('');
    setFormAdminReferencePhoto('');
    setFormDeductionAmount('25');
    setSelectedTemplateId('');
    setFormWeeklyRecurring(false);
    setIsAddFormOpen(false);
    showToast(
      formWeeklyRecurring
        ? `تم إرسال المهمة للحارس (${assignedG.name}) وتثبيتها أسبوعياً آلياً 🔁`
        : `تم حفظ وإرسال المهمة للحارس (${assignedG.name}) بنجاح ✅`
    );
  };

  // Template Modal handlers (Add & Save new task name, or Edit existing task name)
  const openAddTemplateModal = () => {
    setEditingTemplate(null);
    setTplTitle('');
    setTplDescription('');
    setTplShift('morning');
    setTplPriority('normal');
    setTplTimeSlot('09:00 ص - 10:00 ص');
    setTplDeductionAmount('25');
    setTplRequiresPhoto(true);
    setTplAdminReferencePhoto('');
    setTplGuardId(guardsList[0]?.id || guard.id);
    setTplWeeklyRecurring(false);
    setTplWeeklyDays([0, 1, 2, 3, 4, 5, 6]);
    setTemplateModalOpen(true);
  };

  const openEditTemplateModal = (tpl: GuardTaskTemplate) => {
    setEditingTemplate(tpl);
    setTplTitle(tpl.title);
    setTplDescription(tpl.description || '');
    setTplShift(tpl.shift);
    setTplPriority(tpl.priority);
    setTplTimeSlot(tpl.timeSlot || '09:00 ص - 10:00 ص');
    setTplDeductionAmount(String(tpl.deductionAmount ?? 25));
    setTplRequiresPhoto(tpl.requiresPhoto);
    setTplAdminReferencePhoto(tpl.adminReferencePhoto || '');
    setTplGuardId(tpl.guardId || guardsList[0]?.id || guard.id);
    setTplWeeklyRecurring(Boolean(tpl.isWeeklyRecurring));
    setTplWeeklyDays(tpl.weeklyDays && tpl.weeklyDays.length > 0 ? tpl.weeklyDays : [0, 1, 2, 3, 4, 5, 6]);
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = tplTitle.trim();
    if (!cleanTitle) return;

    const assignedG = guardsList.find((g) => g.id === tplGuardId) || guardsList[0] || guard;
    const payload = {
      title: cleanTitle,
      description: tplDescription.trim(),
      shift: tplShift,
      priority: tplPriority,
      timeSlot: tplTimeSlot.trim() || undefined,
      deductionAmount: Math.max(0, Number(tplDeductionAmount) || 0),
      requiresPhoto: tplRequiresPhoto,
      adminReferencePhoto: tplAdminReferencePhoto.trim() || undefined,
      guardId: assignedG.id,
      guardName: assignedG.name,
      isWeeklyRecurring: tplWeeklyRecurring,
      weeklyDays: tplWeeklyDays,
    };

    if (editingTemplate) {
      updateGuardTaskTemplate(editingTemplate.id, payload);
      showToast(`تم حفظ تعديلات اسم المهمة "${cleanTitle}" بنجاح`);
    } else {
      addGuardTaskTemplate(payload);
      showToast(`تم إضافة وحفظ المهمة الجديدة "${cleanTitle}" بنجاح`);
    }
    setTemplateModalOpen(false);
  };

  // Edit Existing Task Modal handlers (works for BOTH waiting AND completed/verified + editing completedAt)
  const openEditTaskModal = (task: GuardDailyTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditGuardId(task.guardId || guardsList[0]?.id || guard.id);
    setEditShift(task.shift);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditCompletedAt(task.completedAt || '');
    setEditGuardNotes(task.guardNotes || '');
    setEditAdminFeedback(task.adminFeedback || '');
    setEditRequiresPhoto(task.requiresPhoto);
    setEditDate(task.date || todayStr);
    setEditTimeSlot(task.timeSlot || '');
    setEditAdminReferencePhoto(task.adminReferencePhoto || '');
    setEditDeductionAmount(String(task.deductionAmount ?? 25));
    setEditWeeklyPinned(Boolean(task.isWeeklyPinned));
    setEditWeeklyDays(task.weeklyDays && task.weeklyDays.length > 0 ? task.weeklyDays : [0, 1, 2, 3, 4, 5, 6]);
  };

  const handleSaveTaskEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    const assignedG = guardsList.find((g) => g.id === editGuardId) || guard;
    const cleanTitle = editTitle.trim();
    const isNowFinished = editStatus === 'completed' || editStatus === 'verified';
    const nowTimeText = `اليوم ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
    const resolvedCompletedAt = isNowFinished
      ? editCompletedAt.trim() || editingTask.completedAt || nowTimeText
      : undefined;

    updateGuardTask(editingTask.id, {
      title: cleanTitle,
      propertyName: cleanTitle,
      description: editDescription.trim(),
      guardId: assignedG.id,
      guardName: assignedG.name,
      shift: editShift,
      priority: editPriority,
      status: editStatus,
      completedAt: resolvedCompletedAt,
      guardNotes: editGuardNotes.trim() || undefined,
      adminFeedback: editAdminFeedback.trim() || undefined,
      date: editDate,
      timeSlot: editTimeSlot.trim() || undefined,
      adminReferencePhoto: editAdminReferencePhoto.trim() || undefined,
      deductionAmount: Math.max(0, Number(editDeductionAmount) || 0),
      requiresPhoto: editRequiresPhoto,
      isWeeklyPinned: editWeeklyPinned,
      weeklyDays: editWeeklyPinned ? editWeeklyDays : undefined,
    });

    // If weekly pinning is turned ON from task edit, ensure matching saved template is also pinned weekly
    if (editWeeklyPinned) {
      const existingTpl = guardTaskTemplates.find(
        (t) => t.id === editingTask.templateId || t.title.trim() === cleanTitle
      );
      if (existingTpl) {
        updateGuardTaskTemplate(existingTpl.id, {
          title: cleanTitle,
          description: editDescription.trim(),
          shift: editShift,
          priority: editPriority,
          timeSlot: editTimeSlot.trim() || undefined,
          deductionAmount: Math.max(0, Number(editDeductionAmount) || 0),
          requiresPhoto: editRequiresPhoto,
          adminReferencePhoto: editAdminReferencePhoto.trim() || undefined,
          guardId: assignedG.id,
          guardName: assignedG.name,
          isWeeklyRecurring: true,
          weeklyDays: editWeeklyDays,
        });
      } else {
        addGuardTaskTemplate({
          title: cleanTitle,
          description: editDescription.trim(),
          shift: editShift,
          priority: editPriority,
          timeSlot: editTimeSlot.trim() || undefined,
          deductionAmount: Math.max(0, Number(editDeductionAmount) || 0),
          requiresPhoto: editRequiresPhoto,
          adminReferencePhoto: editAdminReferencePhoto.trim() || undefined,
          guardId: assignedG.id,
          guardName: assignedG.name,
          isWeeklyRecurring: true,
          weeklyDays: editWeeklyDays,
          lastGeneratedDate: editDate === todayStr ? todayStr : undefined,
        });
      }
    }

    setEditingTask(null);
    showToast('تم حفظ وتحديث بيانات المهمة بنجاح ✅');
  };

  const handleSubmitFieldReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportDetails.trim()) return;
    const prop = properties.find((p) => p.id === reportPropertyId);
    sendGuardFieldReport({
      propertyId: reportPropertyId,
      propertyName: prop?.name || 'الاستراحة',
      category: reportCategory,
      title: reportTitle.trim(),
      details: reportDetails.trim(),
      guardId: effectiveGuard.id,
      guardName: effectiveGuard.name,
    });
    setReportTitle('');
    setReportDetails('');
    setIsReportModalOpen(false);
    showToast('تم إرسال البلاغ الميداني للإدارة العامة بنجاح 🚨');
  };

  const handleCopyDailySummary = () => {
    const header = `📋 *تقرير مهام الحراسة اليومي — AMASA RESORT*\n📅 التاريخ: ${todayStr}\n👮 الحارس: ${isGuard ? effectiveGuard.name : 'طاقم الحراسة'}\n📊 الإنجاز: ${stats.totalDone}/${stats.totalCount} (${stats.progressPercent}%)\n`;
    const lines = filteredTasks.map((t, idx) => {
      const icon = t.status === 'verified' ? '🎖️ معتمدة' : t.status === 'completed' ? '✅ مكتملة' : '⏳ انتظار';
      const timeTxt = t.timeSlot ? ` [${t.timeSlot}]` : '';
      return `${idx + 1}. ${t.title} — الحارس: ${t.guardName || 'غير محدد'}${timeTxt} (${icon})`;
    });
    const text = `${header}\n${lines.length ? lines.join('\n') : 'لا توجد مهام ضمن الفلتر الحالي.'}`;
    navigator.clipboard.writeText(text);
    showToast('تم نسخ تقرير مهام الحراسة بصيغة جاهزة للواتساب 📋');
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 pb-24" dir="rtl">
      {localToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white border border-amber-400/50 px-4 py-2.5 rounded-2xl shadow-xl text-[13.5px] font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{localToast}</span>
        </div>
      )}

      {/* 1. الترويسة */}
      <section className="lux-hero p-4 space-y-3.5">
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative space-y-1.5">
          <Tag tone="gold">تشغيل وحراسة</Tag>
          <h2 className="text-[19px] font-extrabold" style={{ color: '#F5F0FC' }}>
            صفحة الحارس وإدارة المهام
          </h2>
          <p className="text-[12.5px]" style={{ color: '#BFB2DC' }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="relative space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-bold" style={{ color: '#D8CCEE' }}>
              إنجاز المهام
            </span>
            <span className="font-mono font-black text-[17px]" style={{ color: '#E8D4A2' }}>
              {stats.progressPercent}%
            </span>
          </div>
          <div className="kt-bar">
            <i style={{ width: `${stats.progressPercent}%` }} />
          </div>
          <p className="text-[12.5px]" style={{ color: '#BFB2DC' }}>
            {stats.totalDone} من {stats.totalCount} مهمة · {stats.pendingCount} بالانتظار
          </p>
        </div>
      </section>

      {/* أرقام الفترات */}
      <Stats compact cols={stats.appliedDeductionsTotal > 0 ? 2 : 3}>
        <Stat icon={Sun} tone="sand" label="الصباح" value={`${stats.morningDone}/${stats.morningCount}`} />
        <Stat icon={Moon} tone="amy" label="المساء" value={`${stats.eveningDone}/${stats.eveningCount}`} />
        <Stat icon={Repeat} tone="jade" label="مثبتة" value={stats.weeklyPinnedTemplatesCount} />
        {stats.appliedDeductionsTotal > 0 && (
          <Stat icon={Coins} tone="garn" label="الخصومات" value={stats.appliedDeductionsTotal} unit="ر.س" />
        )}
      </Stats>

      {/* 1.5 الحارس وأدوات الميدان */}
      <section className="lux-card p-4 space-y-3">
        <Row
          icon={User}
          tone="amy"
          title={isGuard ? `مرحباً، ${effectiveGuard.name}` : 'طاقم الحراسة'}
          sub={isGuard ? undefined : `${guardsList.length} حراس`}
        />
        <Acts cols={canViewDashboard ? 3 : 2}>
          {canViewDashboard && (
            <Act stack tone="soft" icon={LayoutGrid} label="حركة اليوم" title="دخول وخروج اليوم" onClick={() => setActiveTab('dashboard')} />
          )}
          <Act stack tone="garnS" icon={Wrench} label="بلاغ طارئ" title="بلاغ طارئ / صيانة" onClick={() => setIsReportModalOpen(true)} />
          <Act stack tone="jadeS" icon={Copy} label="نسخ التقرير" title="نسخ التقرير للواتساب" onClick={handleCopyDailySummary} />
        </Acts>
      </section>

      {/* 2. أسماء المهام المحفوظة والتثبيت الأسبوعي */}
      {canManageTasks && (
        <section className="lux-card p-4 space-y-3">
          <Head
            title="المهام المحفوظة"
            icon={Pin}
            count={guardTaskTemplates.length}
            action={
              <Act
                small
                tone="line"
                icon={isLibraryExpanded ? ChevronUp : ChevronDown}
                label={isLibraryExpanded ? 'إخفاء' : 'عرض'}
                title={isLibraryExpanded ? 'إخفاء قائمة المهام المحفوظة' : 'عرض قائمة المهام المحفوظة'}
                onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
              />
            }
          />

          <Acts cols={2}>
            <Act
              tone="sand"
              icon={Repeat}
              label="توليد الأسبوع"
              title="توليد مهام الأسبوع الآن"
              onClick={() => {
                const count = generateWeeklyGuardTasksNow(true);
                if (count > 0) {
                  showToast(`تم توليد (${count}) مهمة مثبتة أسبوعياً لليوم آلياً 🔁`);
                } else {
                  showToast('جميع المهام المثبتة أسبوعياً مولّدة مسبقاً لليوم أو لا توجد مهام مثبتة.');
                }
              }}
            />
            <Act tone="jade" icon={BookmarkPlus} label="مهمة جديدة" title="إضافة وحفظ مهمة جديدة" onClick={openAddTemplateModal} />
          </Acts>

          {isLibraryExpanded && (
            <div className="kt-grid2">
              {guardTaskTemplates.length === 0 ? (
                <p className="kt-note text-center" style={{ gridColumn: '1 / -1' }}>
                  لا توجد مهام محفوظة. اضغط «مهمة جديدة» لإضافة أول مهمة.
                </p>
              ) : (
                guardTaskTemplates.map((tpl) => {
                  const isWeekly = Boolean(tpl.isWeeklyRecurring);
                  return (
                    <div key={tpl.id} className={`kt-sub ${isWeekly ? 'kt-sub-on' : ''}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <Tile icon={tpl.shift === 'morning' ? Sun : Moon} tone={tpl.shift === 'morning' ? 'sand' : 'amy'} size={40} />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <h4 className="kt-task-t">{tpl.title}</h4>
                          <p className="kt-note">
                            {tpl.shift === 'morning' ? 'صباحية' : 'مسائية'}
                            {tpl.timeSlot ? ` · ${tpl.timeSlot}` : ''}
                          </p>
                          {isWeekly && (
                            <p className="kt-note" style={{ color: '#5B2EA6', fontWeight: 800 }}>
                              آلي أسبوعي: {formatWeeklyDaysText(tpl.weeklyDays)}
                            </p>
                          )}
                        </div>
                      </div>
                      {tpl.description && <p className="kt-note line-clamp-1">{tpl.description}</p>}

                      <Acts cols={4}>
                        <Act stack tone="ink" icon={Send} label="إسناد" title="إسناد لليوم" onClick={() => handleQuickAssignTemplateToday(tpl)} />
                        <Act
                          stack
                          tone={isWeekly ? 'gold' : 'soft'}
                          icon={Repeat}
                          label={isWeekly ? 'مثبتة' : 'تثبيت'}
                          title={isWeekly ? 'مثبتة أسبوعياً (اضغط للإلغاء)' : 'تثبيت أسبوعي آلي'}
                          onClick={() => {
                            const nextWeekly = !isWeekly;
                            updateGuardTaskTemplate(tpl.id, {
                              isWeeklyRecurring: nextWeekly,
                              weeklyDays:
                                tpl.weeklyDays && tpl.weeklyDays.length > 0 ? tpl.weeklyDays : [0, 1, 2, 3, 4, 5, 6],
                            });
                            showToast(
                              nextWeekly
                                ? `تم تثبيت "${tpl.title}" أسبوعياً آلياً 🔁`
                                : `تم إلغاء التثبيت الأسبوعي عن "${tpl.title}"`
                            );
                          }}
                        />
                        <Act stack tone="line" icon={Edit3} label="تعديل" title="تعديل المهمة المحفوظة" onClick={() => openEditTemplateModal(tpl)} />
                        <Act stack tone="garnS" icon={Trash2} label="حذف" title="حذف المهمة المحفوظة" onClick={() => setTemplateToDelete(tpl)} />
                      </Acts>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      )}

      {/* 3. إسناد مهمة جديدة */}
      {canManageTasks && (
        <section className="lux-card p-4 space-y-3">
          <Head
            title="إسناد مهمة"
            icon={Send}
            tone="jade"
            action={
              <Act
                small
                tone={isAddFormOpen ? 'line' : 'ink'}
                icon={isAddFormOpen ? X : Plus}
                label={isAddFormOpen ? 'إغلاق' : 'مهمة جديدة'}
                title={isAddFormOpen ? 'إغلاق النموذج' : 'إسناد مهمة جديدة'}
                onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              />
            }
          />

          {isAddFormOpen && (
            <form onSubmit={handleCreateTask} className="space-y-4 animate-in fade-in duration-200">
              {/* أسماء مهام محفوظة للتعبئة التلقائية */}
              {guardTaskTemplates.length > 0 && (
                <div className="kt-field">
                  <span className="kt-field-h">
                    <span>تعبئة من مهمة محفوظة</span>
                    <em>{guardTaskTemplates.length}</em>
                  </span>
                  <div className="kt-g2 kt-scroll">
                    {guardTaskTemplates.map((tpl) => (
                      <Choice
                        key={tpl.id}
                        title={tpl.title}
                        sub={`${tpl.shift === 'morning' ? 'صباحية' : 'مسائية'}${tpl.timeSlot ? ` · ${tpl.timeSlot}` : ''}`}
                        selected={selectedTemplateId === tpl.id}
                        onClick={() => handleApplyTemplateToForm(tpl)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="kt-fields">
                <Field label="اسم المهمة *" className="kt-wide">
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      setSelectedTemplateId('');
                    }}
                    placeholder="مثال: فحص مياه المسبح"
                    required
                    className="kt-input"
                  />
                </Field>

                <Field label="الحارس المكلف" className="kt-wide">
                  <select value={formGuardId} onChange={(e) => setFormGuardId(e.target.value)} className="kt-input">
                    {guardsList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.phone})
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="kt-field kt-wide">
                  <span className="kt-field-h">
                    <span>الفترة التشغيلية</span>
                  </span>
                  <Seg
                    compact
                    label="الفترة التشغيلية"
                    value={formShift}
                    onChange={setFormShift}
                    items={[
                      { id: 'morning', label: 'صباحاً', icon: Sun },
                      { id: 'evening', label: 'مساءً', icon: Moon },
                    ]}
                  />
                </div>

                <div className="kt-field kt-wide">
                  <span className="kt-field-h">
                    <span>درجة الأهمية</span>
                  </span>
                  <Seg
                    compact
                    label="درجة الأهمية"
                    value={formPriority}
                    onChange={setFormPriority}
                    items={[
                      { id: 'normal', label: 'عادية' },
                      { id: 'important', label: 'هامة' },
                      { id: 'urgent', label: 'عاجلة' },
                    ]}
                  />
                </div>

                <Field label="تاريخ المهمة">
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="kt-input" />
                </Field>

                <Field label="غرامة التأخير">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={formDeductionAmount}
                    onChange={(e) => setFormDeductionAmount(e.target.value)}
                    placeholder="ر.س"
                    className="kt-input kt-num"
                  />
                </Field>

                <Field label="وقت / فترة المهمة" className="kt-wide">
                  <input
                    type="text"
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                    placeholder="09:00 ص - 10:00 ص"
                    className="kt-input"
                  />
                </Field>

                <div className="kt-field kt-wide">
                  <span className="kt-field-h">
                    <span>أوقات سريعة</span>
                  </span>
                  <div className="kt-g2">
                    {QUICK_TIME_SLOTS.map((slot) => (
                      <Act key={slot} small tone={formTimeSlot === slot ? 'ink' : 'line'} label={slot} onClick={() => setFormTimeSlot(slot)} />
                    ))}
                  </div>
                </div>

                <div className="kt-field kt-wide">
                  <span className="kt-field-h">
                    <span>صورة توضيحية</span>
                    <em>اختياري</em>
                  </span>
                  <input
                    type="text"
                    value={formAdminReferencePhoto}
                    onChange={(e) => setFormAdminReferencePhoto(e.target.value)}
                    placeholder="رابط الصورة https://..."
                    className="kt-input font-mono text-left"
                    dir="ltr"
                  />
                  <label className="kt-act lx-press kt-t-soft">
                    <Upload size={18} strokeWidth={1.8} />
                    <span>رفع صورة من الجهاز</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleReferencePhotoUpload(e, setFormAdminReferencePhoto)}
                    />
                  </label>
                </div>

                <Field label="تعليمات إضافية للحارس" className="kt-wide">
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="اكتب أي توجيهات يلتزم بها الحارس أثناء التنفيذ"
                    rows={2}
                    className="kt-input"
                  />
                </Field>
              </div>

              {/* خيارات الحفظ والتثبيت */}
              <div className="kt-sub">
                <div className="kt-opt">
                  <span>اشتراط التصوير بكاميرا الجوال</span>
                  <Switch on={formRequiresPhoto} onChange={setFormRequiresPhoto} label="اشتراط توثيق الإنجاز بكاميرا الجوال المباشرة" />
                </div>
                <div className="kt-opt">
                  <span>حفظ في المهام المحفوظة</span>
                  <Switch on={formSaveToLibrary} onChange={setFormSaveToLibrary} label="حفظ بيانات المهمة في قائمة الأسماء المحفوظة" />
                </div>
                <div className="kt-opt">
                  <span>تثبيت أسبوعي آلي</span>
                  <Switch on={formWeeklyRecurring} onChange={setFormWeeklyRecurring} label="تثبيت المهمة أسبوعياً آلياً" />
                </div>

                {formWeeklyRecurring && (
                  <div className="kt-field">
                    <span className="kt-field-h">
                      <span>أيام التكرار الأسبوعي</span>
                    </span>
                    <div className="kt-days">
                      {WEEKDAYS_AR.map((w) => {
                        const active = formWeeklyDays.includes(w.day);
                        return (
                          <button
                            key={w.day}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setFormWeeklyDays((prev) => toggleDayInArray(prev, w.day))}
                            className="kt-day"
                          >
                            {w.label}
                          </button>
                        );
                      })}
                      <button type="button" aria-pressed={false} aria-label="كل أيام الأسبوع" onClick={() => setFormWeeklyDays([0, 1, 2, 3, 4, 5, 6])} className="kt-day kt-day-all">
                      الكل
                    </button>
                    </div>
                  </div>
                )}
              </div>

              <Act submit tone="jade" icon={Send} label="حفظ وإرسال للحارس" title="حفظ وإرسال المهمة للحارس" />
            </form>
          )}
        </section>
      )}

      {/* 4. الفلاتر والبحث */}
      <section className="lux-card p-4 space-y-3">
        <Seg
          label="فلتر الفترة"
          value={selectedShift}
          onChange={setSelectedShift}
          items={[
            { id: 'all', label: 'الكل', icon: Layers, badge: stats.totalCount },
            { id: 'morning', label: 'صباحية', icon: Sun, badge: stats.morningCount },
            { id: 'evening', label: 'مسائية', icon: Moon, badge: stats.eveningCount },
          ]}
        />

        <Seg
          compact
          label="فلتر التاريخ"
          value={dateFilter}
          onChange={setDateFilter}
          items={[
            { id: 'all', label: 'كل التواريخ' },
            { id: 'today', label: 'مهام اليوم' },
          ]}
        />

        <div className="kt-fields">
          <Field label="اسم المهمة" className={canManageTasks ? '' : 'kt-wide'}>
            <select value={selectedTaskNameFilter} onChange={(e) => setSelectedTaskNameFilter(e.target.value)} className="kt-input">
              <option value="all">الكل ({allTaskNames.length})</option>
              {allTaskNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          {canManageTasks && (
            <Field label="الحارس">
              <select value={selectedGuardFilter} onChange={(e) => setSelectedGuardFilter(e.target.value)} className="kt-input">
                <option value="all">الكل ({guardsList.length})</option>
                {guardsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Seg
          label="فلتر الحالة"
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: 'all', label: 'الكل', badge: stats.totalCount },
            { id: 'pending', label: 'انتظار', badge: stats.pendingCount },
            { id: 'completed', label: 'منجزة', badge: stats.completedAwaitingVerifyCount },
            { id: 'verified', label: 'معتمدة', badge: stats.verifiedCount },
          ]}
        />

        <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="ابحث باسم المهمة أو الملاحظات" />
      </section>

      {/* 5. بطاقات المهام */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <section className="lux-card p-8 text-center space-y-3">
            <div className="flex justify-center">
              <Tile icon={CheckCircle2} tone="amy" size={56} />
            </div>
            <h4 className="font-extrabold text-[15px] text-[#1A0F2E]">لا توجد مهمات مطابقة للفلتر</h4>
          </section>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed' || task.status === 'verified';
            const isVerified = task.status === 'verified';
            const hasDeduction = typeof task.deductionAmount === 'number' && task.deductionAmount > 0;
            const priorityLabel = task.priority === 'urgent' ? 'عاجل جداً' : task.priority === 'important' ? 'هام' : 'عادي';
            const statusTag = isVerified
              ? { tone: 'jade' as const, text: 'معتمدة' }
              : isCompleted
              ? { tone: 'saph' as const, text: 'مكتملة' }
              : { tone: 'sand' as const, text: task.status === 'in_progress' ? 'جارٍ التنفيذ' : 'قيد الانتظار' };

            // بلاطات المعلومات: صفوف متساوية الأعمدة (3 ثم الوقت بعرض كامل ثم صف الحارس/الغرامة/التكرار)
            const topRow = [
              { k: 'date', label: 'التاريخ', value: task.date === todayStr ? 'اليوم' : (task.date || '').slice(5) || '—', ltr: task.date !== todayStr },
              { k: 'shift', label: 'الفترة', value: task.shift === 'morning' ? 'صباحية' : 'مسائية', ltr: false },
              { k: 'prio', label: 'الأهمية', value: priorityLabel, ltr: false },
            ];
            const bottomRow = [
              { k: 'guard', label: 'الحارس', value: task.guardName || 'غير مسند', ltr: false },
              ...(hasDeduction
                ? [{ k: 'ded', label: task.deductionApplied ? 'تم الخصم' : 'الغرامة', value: `${task.deductionAmount} ر.س`, ltr: false }]
                : []),
              ...(task.isWeeklyPinned ? [{ k: 'rep', label: 'التكرار', value: 'أسبوعي', ltr: false }] : []),
            ];

            return (
              <article
                key={task.id}
                className={`lux-card p-4 space-y-3 ${
                  task.deductionApplied ? 'kt-ring-late' : isVerified ? 'kt-ring-ok' : isCompleted ? 'kt-ring-done' : ''
                }`}
              >
                {/* الرأس: أيقونة الحالة + اسم المهمة + حبة الحالة */}
                <div className="flex items-start gap-3 min-w-0">
                  <Tile
                    icon={isVerified ? Award : isCompleted ? Check : task.shift === 'morning' ? Sun : Moon}
                    tone={isVerified ? 'jade' : isCompleted ? 'saph' : task.shift === 'morning' ? 'sand' : 'amy'}
                    size={44}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h4 className="kt-task-t">{task.title}</h4>
                    <Tag tone={statusTag.tone}>{statusTag.text}</Tag>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Infos cols={3}>
                    {topRow.map((m) => (
                      <Info key={m.k} label={m.label} value={m.value} ltr={m.ltr} />
                    ))}
                  </Infos>
                  {task.timeSlot && (
                    <Infos cols={1}>
                      <Info label="الوقت" value={task.timeSlot} />
                    </Infos>
                  )}
                  <Infos cols={bottomRow.length as 1 | 2 | 3}>
                    {bottomRow.map((m) => (
                      <Info key={m.k} label={m.label} value={m.value} ltr={m.ltr} />
                    ))}
                  </Infos>
                </div>

                {task.description && <p className="kt-note whitespace-pre-line" style={{ fontSize: 13.5 }}>{task.description}</p>}

                {/* صورة توضيحية من الإدارة */}
                {task.adminReferencePhoto && (
                  <div className="kt-field">
                    <span className="kt-field-h">
                      <span>صورة توضيحية من الإدارة</span>
                    </span>
                    <div className="kt-photos">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingPhoto({
                            url: task.adminReferencePhoto!,
                            title: `صورة مرجعية للمهمة: ${task.title}`,
                            time: task.createdAt,
                            note: 'صورة توضيحية معتمدة من الإدارة لإرشاد الحارس أثناء التنفيذ',
                          })
                        }
                        className="kt-photo group"
                        aria-label="عرض الصورة التوضيحية"
                      >
                        <img src={task.adminReferencePhoto} alt="صورة مرجعية للمهمة" className="group-hover:scale-105 transition-transform" />
                        <span className="kt-photo-eye">
                          <Eye className="w-5 h-5" />
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* صور الإثبات */}
                {task.proofPhotos && task.proofPhotos.length > 0 && (
                  <div className="kt-field">
                    <span className="kt-field-h">
                      <span>صور الإثبات</span>
                      <em>{task.proofPhotos.length}</em>
                    </span>
                    <div className="kt-photos">
                      {task.proofPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() =>
                            setViewingPhoto({
                              url: photo.url,
                              title: task.title,
                              time: photo.timestamp,
                              note: photo.note || task.guardNotes,
                            })
                          }
                          className="kt-photo group"
                          aria-label="عرض صورة الإثبات"
                        >
                          <img src={photo.url} alt="صورة إثبات" className="group-hover:scale-105 transition-transform" />
                          <span className="kt-photo-eye">
                            <Eye className="w-5 h-5" />
                          </span>
                          <span className="kt-photo-t">{photo.timestamp.split(' ')[1] || 'صورة'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ملاحظات الحارس */}
                {task.guardNotes && (
                  <div className="kt-warn p-3.5 space-y-1">
                    <span className="kt-field-h">
                      <span>ملاحظات الحارس</span>
                    </span>
                    <p className="text-[14px] font-semibold text-[#5C3A00] leading-relaxed">{task.guardNotes}</p>
                  </div>
                )}

                {/* ملاحظات الإدارة */}
                {task.adminFeedback && (
                  <div
                    className={`${task.status === 'pending' ? 'kt-err kt-col' : 'kt-ok'} space-y-1`}
                    style={task.status === 'pending' ? undefined : { gap: 4 }}
                  >
                    <span className="kt-field-h">
                      <span>ملاحظات الإدارة</span>
                    </span>
                    <p className="text-[14px] font-semibold leading-relaxed">{task.adminFeedback}</p>
                  </div>
                )}

                <p className="kt-note">
                  أُسندت: {task.createdAt}
                  {task.completedAt ? ` · وقت الإنجاز: ${task.completedAt}` : ''}
                </p>

                {/* الإجراءات: أزرار بعرض متساوٍ */}
                <Acts cols={2}>
                  {/* تصوير الإثبات (يتاح قبل الاعتماد) */}
                  {!isVerified && (
                    <Act
                      tone="gold"
                      icon={Camera}
                      label={isCompleted ? 'إضافة إثبات' : 'تصوير الإثبات'}
                      title={isCompleted ? 'إضافة صورة إثبات أخرى' : 'تصوير الإثبات بالكاميرا'}
                      onClick={() => setCameraModalTask(task)}
                    />
                  )}

                  {/* إتمام سريع بدون صورة عند عدم اشتراطها */}
                  {!isVerified && !isCompleted && !task.requiresPhoto && (
                    <Act
                      tone="jade"
                      icon={CheckSquare}
                      label="إتمام المهمة"
                      onClick={() => {
                        setQuickCompleteNote('');
                        setQuickCompleteTask(task);
                      }}
                    />
                  )}

                  {/* اعتماد / إعادة للحارس */}
                  {canManageTasks && isCompleted && !isVerified && (
                    <>
                      <Act
                        tone="jade"
                        icon={ShieldCheck}
                        label="اعتماد الإنجاز"
                        onClick={() => {
                          verifyGuardTask(task.id);
                          showToast('تم اعتماد إنجاز المهمة بنجاح 🎖️');
                        }}
                      />
                      <Act
                        tone="sand"
                        icon={RotateCcw}
                        label="إعادة للحارس"
                        onClick={() => {
                          setReopenReason('');
                          setReopenTargetTask(task);
                        }}
                      />
                    </>
                  )}

                  {/* تطبيق / إلغاء غرامة التأخير */}
                  {canManageTasks && !isVerified && hasDeduction && (
                    <Act
                      tone={task.deductionApplied ? 'garnet' : 'garnS'}
                      icon={Coins}
                      label={task.deductionApplied ? 'إلغاء الغرامة' : 'تطبيق الغرامة'}
                      onClick={() => {
                        const nextState = !task.deductionApplied;
                        updateGuardTask(task.id, {
                          deductionApplied: nextState,
                          deductionAppliedAt: nextState ? new Date().toLocaleDateString('ar-SA') : undefined,
                        });
                        showToast(
                          nextState
                            ? `تم تطبيق غرامة التأخير (${task.deductionAmount} ر.س) على المهمة`
                            : 'تم إلغاء غرامة التأخير عن المهمة'
                        );
                      }}
                    />
                  )}

                  {/* تعديل / حذف */}
                  {canManageTasks && <Act tone="soft" icon={Edit3} label="تعديل" title="تعديل بيانات المهمة" onClick={() => openEditTaskModal(task)} />}
                  {canManageTasks && <Act tone="garnS" icon={Trash2} label="حذف" title="حذف المهمة" onClick={() => setTaskToDelete(task)} />}
                </Acts>
              </article>
            );
          })
        )}
      </div>

      {/* In-App Mobile Camera Modal */}
      {cameraModalTask && (
        <InAppCameraModal
          isOpen={Boolean(cameraModalTask)}
          onClose={() => setCameraModalTask(null)}
          onCapture={(photoDataUrl, note) => {
            completeGuardTaskWithPhoto(cameraModalTask.id, photoDataUrl, note || '');
            setCameraModalTask(null);
            showToast('تم توثيق الصورة وإتمام المهمة بنجاح ✅');
          }}
          taskTitle={cameraModalTask.title}
          propertyName={cameraModalTask.propertyName || cameraModalTask.title}
          guardName={cameraModalTask.guardName || guard.name}
        />
      )}

      {/* إنجاز مهمة بدون صورة */}
      {quickCompleteTask && (
        <Sheet
          title="إنجاز المهمة"
          icon={CheckSquare}
          tone="jade"
          onClose={() => setQuickCompleteTask(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="jade"
                icon={Check}
                label="تأكيد الإنجاز"
                onClick={() => {
                  completeGuardTaskWithoutPhoto(quickCompleteTask.id, quickCompleteNote);
                  setQuickCompleteTask(null);
                  showToast('تم إتمام المهمة وإشعار الإدارة بنجاح ✅');
                }}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setQuickCompleteTask(null)} />
            </Acts>
          }
        >
          <Infos cols={1}>
            <Info label="المهمة" value={quickCompleteTask.title} />
          </Infos>
          <Field label="ملاحظات التنفيذ" hint="اختياري">
            <textarea
              rows={3}
              value={quickCompleteNote}
              onChange={(e) => setQuickCompleteNote(e.target.value)}
              placeholder="أي تفاصيل عن الإنجاز"
              className="kt-input kt-ta"
            />
          </Field>
        </Sheet>
      )}

      {/* إضافة / تعديل اسم مهمة محفوظ */}
      {templateModalOpen && (
        <Sheet
          wide
          lockBackdrop
          title={editingTemplate ? 'تعديل اسم المهمة' : 'اسم مهمة جديد'}
          icon={BookmarkPlus}
          tone="amy"
          onClose={() => setTemplateModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act submit form="tpl-form" tone="ink" icon={Save} label={editingTemplate ? 'حفظ التعديلات' : 'حفظ المهمة'} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setTemplateModalOpen(false)} />
            </Acts>
          }
        >
          <form id="tpl-form" onSubmit={handleSaveTemplate} className="kt-fields">
            <Field label="اسم المهمة" className="kt-wide">
              <input
                type="text"
                required
                value={tplTitle}
                onChange={(e) => setTplTitle(e.target.value)}
                placeholder="مثال: فحص مياه المسبح"
                className="kt-input"
              />
            </Field>

            <Field label="الحارس الافتراضي" className="kt-wide">
              <select value={tplGuardId} onChange={(e) => setTplGuardId(e.target.value)} className="kt-input">
                {guardsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>الفترة التشغيلية</span>
              </span>
              <Seg
                compact
                label="الفترة التشغيلية"
                value={tplShift}
                onChange={setTplShift}
                items={[
                  { id: 'morning', label: 'صباحاً', icon: Sun },
                  { id: 'evening', label: 'مساءً', icon: Moon },
                ]}
              />
            </div>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>درجة الأهمية</span>
              </span>
              <Seg
                compact
                label="درجة الأهمية"
                value={tplPriority}
                onChange={setTplPriority}
                items={[
                  { id: 'normal', label: 'عادية' },
                  { id: 'important', label: 'هامة' },
                  { id: 'urgent', label: 'عاجلة' },
                ]}
              />
            </div>

            <Field label="الوقت">
              <input
                type="text"
                value={tplTimeSlot}
                onChange={(e) => setTplTimeSlot(e.target.value)}
                placeholder="09:00 ص - 10:00 ص"
                className="kt-input"
              />
            </Field>

            <Field label="غرامة التأخير">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={tplDeductionAmount}
                onChange={(e) => setTplDeductionAmount(e.target.value)}
                placeholder="ر.س"
                className="kt-input kt-num"
              />
            </Field>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>صورة توضيحية</span>
                <em>اختياري</em>
              </span>
              <input
                type="text"
                value={tplAdminReferencePhoto}
                onChange={(e) => setTplAdminReferencePhoto(e.target.value)}
                placeholder="رابط الصورة https://..."
                className="kt-input font-mono text-left"
                dir="ltr"
              />
              <label className="kt-act lx-press kt-t-soft">
                <Upload size={18} strokeWidth={1.8} />
                <span>رفع صورة من الجهاز</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReferencePhotoUpload(e, setTplAdminReferencePhoto)}
                />
              </label>
            </div>

            <Field label="التفاصيل والتعليمات" className="kt-wide">
              <textarea
                rows={2}
                value={tplDescription}
                onChange={(e) => setTplDescription(e.target.value)}
                className="kt-input kt-ta"
              />
            </Field>

            <div className="kt-sub kt-wide">
              <div className="kt-opt">
                <span>اشتراط التصوير بالكاميرا</span>
                <Switch on={tplRequiresPhoto} onChange={setTplRequiresPhoto} label="اشتراط توثيق الصورة بالكاميرا" />
              </div>
              <div className="kt-opt">
                <span>تثبيت أسبوعي آلي</span>
                <Switch on={tplWeeklyRecurring} onChange={setTplWeeklyRecurring} label="تثبيت هذه المهمة أسبوعياً آلياً" />
              </div>

              {tplWeeklyRecurring && (
                <div className="kt-field">
                  <span className="kt-field-h">
                    <span>أيام التكرار الأسبوعي</span>
                  </span>
                  <div className="kt-days">
                    {WEEKDAYS_AR.map((w) => {
                      const active = tplWeeklyDays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setTplWeeklyDays((prev) => toggleDayInArray(prev, w.day))}
                          className="kt-day"
                        >
                          {w.label}
                        </button>
                      );
                    })}
                    <button type="button" aria-pressed={false} aria-label="كل أيام الأسبوع" onClick={() => setTplWeeklyDays([0, 1, 2, 3, 4, 5, 6])} className="kt-day kt-day-all">
                      الكل
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </Sheet>
      )}

      {/* حذف اسم مهمة محفوظ */}
      {templateToDelete && (
        <Sheet
          title="حذف اسم المهمة"
          icon={AlertTriangle}
          tone="garn"
          onClose={() => setTemplateToDelete(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="garnet"
                icon={Trash2}
                label="تأكيد الحذف"
                onClick={() => {
                  deleteGuardTaskTemplate(templateToDelete.id);
                  setTemplateToDelete(null);
                  showToast('تم حذف اسم المهمة من القائمة بنجاح');
                }}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setTemplateToDelete(null)} />
            </Acts>
          }
        >
          <Infos cols={1}>
            <Info label="الاسم المحفوظ" value={templateToDelete.title} />
          </Infos>
          <div className="kt-err" role="alert">
            <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
            <span>سيُحذف الاسم من قائمة المهام المحفوظة.</span>
          </div>
        </Sheet>
      )}

      {/* تعديل المهمة (للإدارة) */}
      {editingTask && (
        <Sheet
          wide
          lockBackdrop
          title="تعديل المهمة"
          icon={Edit3}
          tone="amy"
          onClose={() => setEditingTask(null)}
          footer={
            <Acts cols={2}>
              <Act submit form="task-edit-form" tone="ink" icon={Save} label="حفظ التعديلات" />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setEditingTask(null)} />
            </Acts>
          }
        >
          <form id="task-edit-form" onSubmit={handleSaveTaskEdit} className="kt-fields">
            <Field label="اسم المهمة" className="kt-wide">
              <input type="text" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="kt-input" />
            </Field>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>حالة المهمة</span>
              </span>
              <Seg
                compact
                label="حالة المهمة"
                value={editStatus}
                onChange={setEditStatus}
                items={[
                  { id: 'pending', label: 'انتظار' },
                  { id: 'in_progress', label: 'جارية' },
                  { id: 'completed', label: 'مكتملة' },
                  { id: 'verified', label: 'معتمدة' },
                ]}
              />
            </div>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>وقت الإنجاز</span>
                <em>اختياري</em>
              </span>
              <input
                type="text"
                value={editCompletedAt}
                onChange={(e) => setEditCompletedAt(e.target.value)}
                placeholder="مثال: اليوم 09:45 ص"
                className="kt-input"
              />
              <Act
                tone="soft"
                icon={Clock}
                label="الوقت الآن"
                title="تعبئة وقت الإنجاز بالوقت الحالي"
                onClick={() =>
                  setEditCompletedAt(
                    `اليوم ${new Date().toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  )
                }
              />
            </div>

            <Field label="الحارس المكلف" className="kt-wide">
              <select value={editGuardId} onChange={(e) => setEditGuardId(e.target.value)} className="kt-input">
                {guardsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>الفترة التشغيلية</span>
              </span>
              <Seg
                compact
                label="الفترة التشغيلية"
                value={editShift}
                onChange={setEditShift}
                items={[
                  { id: 'morning', label: 'صباحاً', icon: Sun },
                  { id: 'evening', label: 'مساءً', icon: Moon },
                ]}
              />
            </div>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>درجة الأهمية</span>
              </span>
              <Seg
                compact
                label="درجة الأهمية"
                value={editPriority}
                onChange={setEditPriority}
                items={[
                  { id: 'normal', label: 'عادية' },
                  { id: 'important', label: 'هامة' },
                  { id: 'urgent', label: 'عاجلة' },
                ]}
              />
            </div>

            <Field label="التاريخ">
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="kt-input" />
            </Field>

            <Field label="غرامة التأخير">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={editDeductionAmount}
                onChange={(e) => setEditDeductionAmount(e.target.value)}
                placeholder="ر.س"
                className="kt-input kt-num"
              />
            </Field>

            <Field label="الوقت المجدول" className="kt-wide">
              <input
                type="text"
                value={editTimeSlot}
                onChange={(e) => setEditTimeSlot(e.target.value)}
                placeholder="09:00 ص - 10:00 ص"
                className="kt-input"
              />
            </Field>

            <div className="kt-field kt-wide">
              <span className="kt-field-h">
                <span>صورة توضيحية</span>
                <em>اختياري</em>
              </span>
              <input
                type="text"
                value={editAdminReferencePhoto}
                onChange={(e) => setEditAdminReferencePhoto(e.target.value)}
                placeholder="رابط الصورة https://..."
                className="kt-input font-mono text-left"
                dir="ltr"
              />
              <label className="kt-act lx-press kt-t-soft">
                <Upload size={18} strokeWidth={1.8} />
                <span>رفع صورة من الجهاز</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReferencePhotoUpload(e, setEditAdminReferencePhoto)}
                />
              </label>
            </div>

            <Field label="التفاصيل والتعليمات" className="kt-wide">
              <textarea rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="kt-input kt-ta" />
            </Field>

            <Field label="ملاحظات الحارس" className="kt-wide">
              <input
                type="text"
                value={editGuardNotes}
                onChange={(e) => setEditGuardNotes(e.target.value)}
                placeholder="ملاحظات الحارس عند الإنجاز"
                className="kt-input"
              />
            </Field>

            <Field label="ملاحظات الإدارة" className="kt-wide">
              <input
                type="text"
                value={editAdminFeedback}
                onChange={(e) => setEditAdminFeedback(e.target.value)}
                placeholder="ملاحظات أو اعتماد الإدارة"
                className="kt-input"
              />
            </Field>

            <div className="kt-sub kt-wide">
              <div className="kt-opt">
                <span>اشتراط التصوير بالكاميرا</span>
                <Switch on={editRequiresPhoto} onChange={setEditRequiresPhoto} label="اشتراط توثيق الصورة بالكاميرا لإكمال المهمة" />
              </div>
              <div className="kt-opt">
                <span>تثبيت أسبوعي آلي</span>
                <Switch on={editWeeklyPinned} onChange={setEditWeeklyPinned} label="تثبيت المهمة أسبوعياً آلياً" />
              </div>

              {editWeeklyPinned && (
                <div className="kt-field">
                  <span className="kt-field-h">
                    <span>أيام التكرار الأسبوعي</span>
                  </span>
                  <div className="kt-days">
                    {WEEKDAYS_AR.map((w) => {
                      const active = editWeeklyDays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setEditWeeklyDays((prev) => toggleDayInArray(prev, w.day))}
                          className="kt-day"
                        >
                          {w.label}
                        </button>
                      );
                    })}
                    <button type="button" aria-pressed={false} aria-label="كل أيام الأسبوع" onClick={() => setEditWeeklyDays([0, 1, 2, 3, 4, 5, 6])} className="kt-day kt-day-all">
                      الكل
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </Sheet>
      )}

      {/* إرجاع المهمة للحارس */}
      {reopenTargetTask && (
        <Sheet
          title="إرجاع للحارس"
          icon={RotateCcw}
          tone="sand"
          onClose={() => setReopenTargetTask(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="sand"
                icon={Send}
                label="إرسال وإرجاع"
                title="إرسال الملاحظة وإرجاع المهمة للحارس"
                onClick={() => {
                  reopenGuardTask(reopenTargetTask.id, reopenReason);
                  setReopenTargetTask(null);
                  showToast('تم إرجاع المهمة للحارس وإشعاره بالملاحظات 🔄');
                }}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setReopenTargetTask(null)} />
            </Acts>
          }
        >
          <Infos cols={1}>
            <Info label="المهمة" value={reopenTargetTask.title} />
          </Infos>
          <Field label="سبب الإرجاع أو الملاحظة">
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="مثال: الصورة غير واضحة"
              className="kt-input kt-ta"
            />
          </Field>
        </Sheet>
      )}

      {/* حذف مهمة */}
      {taskToDelete && (
        <Sheet
          title="حذف المهمة"
          icon={AlertTriangle}
          tone="garn"
          onClose={() => setTaskToDelete(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="garnet"
                icon={Trash2}
                label="تأكيد الحذف"
                onClick={() => {
                  deleteGuardTask(taskToDelete.id);
                  setTaskToDelete(null);
                  showToast('تم حذف المهمة من السجل');
                }}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setTaskToDelete(null)} />
            </Acts>
          }
        >
          <Infos cols={1}>
            <Info label="المهمة" value={taskToDelete.title} />
          </Infos>
          <div className="kt-err" role="alert">
            <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
            <span>سيُحذف السجل نهائياً.</span>
          </div>
        </Sheet>
      )}

      {/* بلاغ ميداني / طلب صيانة */}
      {isReportModalOpen && (
        <Sheet
          lockBackdrop
          title="بلاغ للإدارة"
          icon={Wrench}
          tone="garn"
          onClose={() => setIsReportModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act submit form="report-form" tone="garnet" icon={Send} label="إرسال البلاغ" title="إرسال البلاغ للإدارة" />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setIsReportModalOpen(false)} />
            </Acts>
          }
        >
          <form id="report-form" onSubmit={handleSubmitFieldReport} className="kt-fields">
            <Field label="نوع البلاغ" className="kt-wide">
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value as 'maintenance' | 'supplies' | 'emergency' | 'guest_note')}
                className="kt-input"
              >
                <option value="maintenance">عطل / صيانة عاجلة</option>
                <option value="supplies">نقص مستلزمات نظافة</option>
                <option value="emergency">طارئ أمني</option>
                <option value="guest_note">ملاحظة عن نزيل</option>
              </select>
            </Field>

            <Field label="الموقع" className="kt-wide">
              <select value={reportPropertyId} onChange={(e) => setReportPropertyId(e.target.value)} className="kt-input">
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="عنوان البلاغ" className="kt-wide">
              <input
                type="text"
                required
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="مثال: تعطل مضخة المسبح"
                className="kt-input"
              />
            </Field>

            <Field label="التفاصيل" className="kt-wide">
              <textarea
                rows={3}
                required
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="اشرح الحالة والمطلوب من الإدارة"
                className="kt-input kt-ta"
              />
            </Field>
          </form>
        </Sheet>
      )}

      {/* عرض صورة التوثيق */}
      {viewingPhoto && (
        <Sheet
          title="صورة التوثيق"
          icon={Camera}
          tone="ink"
          onClose={() => setViewingPhoto(null)}
          footer={<Act tone="line" icon={X} label="إغلاق" onClick={() => setViewingPhoto(null)} />}
        >
          <Infos cols={2}>
            <Info label="المهمة" value={viewingPhoto.title} />
            <Info label="وقت التوثيق" value={viewingPhoto.time} />
          </Infos>
          <div
            className="rounded-[18px] overflow-hidden flex items-center justify-center min-h-[200px]"
            style={{ background: '#efeae2', boxShadow: 'inset 0 0 0 1px rgba(27,14,51,.08)' }}
          >
            <img src={viewingPhoto.url} alt="صورة توثيق المهمة" className="w-full h-auto max-h-[56vh] object-contain" />
          </div>
          {viewingPhoto.note && (
            <Infos cols={1}>
              <Info label="ملاحظات الحارس" value={viewingPhoto.note} />
            </Infos>
          )}
        </Sheet>
      )}
    </div>
  );
};
