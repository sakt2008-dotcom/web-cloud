import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  FileText,
  History,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Phone,
  Plus,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  KayanDetergentItem,
  KayanOrderItem,
  KayanOrderSheet,
  KayanUnit,
} from '../../types';
import {
  buildKayanWhatsappMessage,
  buildKayanWhatsappUrl,
  createKayanOrderSheet,
  formatKayanUnitQuantity,
  isValidKayanPhone,
  KAYAN_CATEGORIES,
  KAYAN_UNIT_LABELS,
  KAYAN_UNIT_ORDER,
  sendOrDownloadKayanOrderPdf,
} from '../../lib/kayanDetergents';
import { openExternalUrlSafely } from '../../lib/customerLinks';
import { STORAGE_KEYS, StorageService } from '../../lib/storage';
import { KayanOrderSheetDocument } from './KayanOrderSheetDocument';
import {
  Act,
  Acts,
  Chip,
  Chips,
  Field,
  Head,
  IconBtn,
  Info,
  Infos,
  Row,
  SearchBox,
  Seg,
  Sheet,
  Tag,
} from '../ui/kit';

type KayanSubView = 'order' | 'catalog' | 'history';

const ORDER_LOCALE = 'ar-SA-u-ca-gregory-nu-latn';
const orderDay = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(ORDER_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
};
const orderTime = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(ORDER_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });
};

/** أسماء قصيرة للتصنيفات (تُعرض في الشرائح والأسطر دون التفاف) */
const CATEGORY_SHORT: Record<string, string> = {
  'الكل': 'الكل',
  'منظفات الأرضيات والأسطح': 'الأرضيات',
  'الغسيل والمبيضات': 'الغسيل',
  'المعطرات والتعقيم': 'المعطرات',
  'الأوراق والبلاستيك': 'الأوراق',
  'العناية الشخصية والضيافة': 'الضيافة',
  'العناية بالمسابح': 'المسابح',
  'أدوات ومعدات النظافة': 'الأدوات',
};

interface DraftLineState {
  itemId: string;
  quantity: number;
  unit: KayanUnit;
}

export const KayanDetergentsTab: React.FC = () => {
  const {
    isAdmin,
    kayanItems,
    kayanSettings,
    kayanOrders,
    addKayanItem,
    updateKayanItem,
    deleteKayanItem,
    updateKayanSettings,
    saveKayanOrder,
    deleteKayanOrder,
    triggerBrowserNotification,
  } = useApp();

  const [subView, setSubView] = useState<KayanSubView>('order');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  // Persisted active draft so admin never loses selected quantities while switching views
  const [draftLines, setDraftLines] = useState<Record<string, DraftLineState>>(() =>
    StorageService.get<Record<string, DraftLineState>>(STORAGE_KEYS.KAYAN_DRAFT, {})
  );
  useEffect(() => {
    StorageService.set(STORAGE_KEYS.KAYAN_DRAFT, draftLines);
  }, [draftLines]);

  // Editable delegate & destination fields for the current order (synced initially with saved settings, freely editable)
  const [delegatePhoneInput, setDelegatePhoneInput] = useState<string>(kayanSettings.delegatePhone || '');
  const [delegateNameInput, setDelegateNameInput] = useState<string>(kayanSettings.delegateName || '');
  const [propertyNameInput, setPropertyNameInput] = useState<string>(kayanSettings.propertyName || '');
  const [locationUrlInput, setLocationUrlInput] = useState<string>(kayanSettings.locationUrl || '');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [showLocationEditor, setShowLocationEditor] = useState(false);

  // Sync local input defaults when remote settings hydrate and local hasn't diverged intentionally
  useEffect(() => {
    setDelegatePhoneInput(kayanSettings.delegatePhone || '');
    setDelegateNameInput(kayanSettings.delegateName || '');
    setPropertyNameInput(kayanSettings.propertyName || '');
    setLocationUrlInput(kayanSettings.locationUrl || '');
  }, [
    kayanSettings.delegatePhone,
    kayanSettings.delegateName,
    kayanSettings.propertyName,
    kayanSettings.locationUrl,
  ]);

  // Catalog form state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState<string>(KAYAN_CATEGORIES[0]);
  const [formUnit, setFormUnit] = useState<KayanUnit>('carton');
  const [formRefPrice, setFormRefPrice] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Settings form state inside Catalog & Settings tab
  const [settingsPhone, setSettingsPhone] = useState(kayanSettings.delegatePhone || '');
  const [settingsDelegateName, setSettingsDelegateName] = useState(kayanSettings.delegateName || '');
  const [settingsPropertyName, setSettingsPropertyName] = useState(kayanSettings.propertyName || '');
  const [settingsLocationUrl, setSettingsLocationUrl] = useState(kayanSettings.locationUrl || '');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  useEffect(() => {
    setSettingsPhone(kayanSettings.delegatePhone || '');
    setSettingsDelegateName(kayanSettings.delegateName || '');
    setSettingsPropertyName(kayanSettings.propertyName || '');
    setSettingsLocationUrl(kayanSettings.locationUrl || '');
  }, [kayanSettings]);

  // Preview & PDF export state
  const [previewOrder, setPreviewOrder] = useState<KayanOrderSheet | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedOrderText, setCopiedOrderText] = useState(false);

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = setTimeout(() => setActionFeedback(null), actionFeedback.type === 'success' ? 4500 : 8000);
    return () => clearTimeout(timer);
  }, [actionFeedback]);

  const previewSheetRef = useRef<HTMLDivElement>(null);
  const hiddenExportSheetRef = useRef<HTMLDivElement>(null);
  const [hiddenRenderOrder, setHiddenRenderOrder] = useState<KayanOrderSheet | null>(null);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(['الكل']);
    kayanItems.forEach((it) => {
      if (it.category?.trim()) set.add(it.category.trim());
    });
    return Array.from(set);
  }, [kayanItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return kayanItems.filter((item) => {
      if (selectedCategory !== 'الكل' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [kayanItems, searchQuery, selectedCategory]);

  const selectedOrderItems: KayanOrderItem[] = useMemo(() => {
    const itemMap = new Map(kayanItems.map((it) => [it.id, it]));
    const list: KayanOrderItem[] = [];
    Object.values(draftLines).forEach((line) => {
      if (line.quantity <= 0) return;
      const catalogItem = itemMap.get(line.itemId);
      if (!catalogItem) return;
      list.push({
        itemId: catalogItem.id,
        itemCode: catalogItem.itemCode,
        name: catalogItem.name,
        quantity: line.quantity,
        unit: line.unit || catalogItem.defaultUnit || 'piece',
      });
    });
    return list;
  }, [draftLines, kayanItems]);

  const totalUnitsCount = useMemo(
    () => selectedOrderItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedOrderItems]
  );

  const phoneDirtyComparedToSaved =
    delegatePhoneInput.trim() !== (kayanSettings.delegatePhone || '').trim() ||
    delegateNameInput.trim() !== (kayanSettings.delegateName || '').trim();

  const updateItemQuantity = (item: KayanDetergentItem, nextQty: number) => {
    const clamped = Math.max(0, Math.min(9999, Math.round(nextQty || 0)));
    setDraftLines((prev) => {
      if (clamped <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          itemId: item.id,
          quantity: clamped,
          unit: existing?.unit || item.defaultUnit || 'piece',
        },
      };
    });
  };

  const updateItemUnit = (item: KayanDetergentItem, nextUnit: KayanUnit) => {
    setDraftLines((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          itemId: item.id,
          quantity: existing?.quantity && existing.quantity > 0 ? existing.quantity : 1,
          unit: nextUnit,
        },
      };
    });
  };

  const clearCurrentDraft = () => {
    setDraftLines({});
    setOrderNotes('');
    setActionFeedback(null);
  };

  const handleSaveCurrentPhoneAsDefault = () => {
    updateKayanSettings({
      delegatePhone: delegatePhoneInput.trim(),
      delegateName: delegateNameInput.trim() || undefined,
      propertyName: propertyNameInput.trim() || kayanSettings.propertyName,
      locationUrl: locationUrlInput.trim() || kayanSettings.locationUrl,
    });
    setActionFeedback({
      type: 'success',
      text: delegatePhoneInput.trim()
        ? `تم حفظ رقم المندوب (${delegatePhoneInput.trim()}) كرقم افتراضي للطلبات القادمة.`
        : 'تم مسح الرقم الافتراضي للمندوب.',
    });
  };

  const buildActiveOrderSheet = (): KayanOrderSheet | null => {
    if (selectedOrderItems.length === 0) {
      setActionFeedback({
        type: 'error',
        text: 'اختر صنفاً واحداً على الأقل وحدد كميته قبل إصدار ورقة الطلب.',
      });
      return null;
    }
    return createKayanOrderSheet({
      items: selectedOrderItems,
      delegatePhone: delegatePhoneInput.trim(),
      delegateName: delegateNameInput.trim() || undefined,
      propertyName: propertyNameInput.trim() || kayanSettings.propertyName,
      locationUrl: locationUrlInput.trim() || kayanSettings.locationUrl,
      notes: orderNotes.trim() || undefined,
      existingOrders: kayanOrders,
    });
  };

  const handleOpenPdfPreview = () => {
    const order = buildActiveOrderSheet();
    if (!order) return;
    saveKayanOrder(order);
    setActionFeedback(null);
    setPreviewOrder(order);
  };

  const handleDirectPdfExport = async (mode: 'download' | 'share') => {
    const order = buildActiveOrderSheet();
    if (!order) return;
    saveKayanOrder(order);
    setHiddenRenderOrder(order);
    setIsExportingPdf(true);
    setActionFeedback(null);

    // Wait one animation frame for the offscreen A4 container to commit DOM
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      const targetEl = hiddenExportSheetRef.current;
      if (!targetEl) {
        setPreviewOrder(order);
        return;
      }
      const res = await sendOrDownloadKayanOrderPdf({
        element: targetEl,
        order,
        mode,
      });
      setActionFeedback({
        type: res.status === 'cancelled' ? 'error' : 'success',
        text: res.message,
      });
      if (res.status !== 'cancelled') {
        triggerBrowserNotification('ورقة كيان للمنظفات', res.message, 'system');
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err?.message || 'تعذر إنشاء ملف PDF لورقة الطلب.',
      });
    } finally {
      setIsExportingPdf(false);
      setHiddenRenderOrder(null);
    }
  };

  const handleSendWhatsappDirectly = () => {
    const cleanPhone = delegatePhoneInput.trim();
    if (!isValidKayanPhone(cleanPhone)) {
      setActionFeedback({
        type: 'error',
        text: 'أدخل رقم جوال المندوب أولاً (مثال: 0531418018) لإرسال الطلب عبر واتساب.',
      });
      return;
    }
    const order = buildActiveOrderSheet();
    if (!order) return;
    saveKayanOrder(order);
    const url = buildKayanWhatsappUrl(cleanPhone, order);
    openExternalUrlSafely(url);
    setActionFeedback({
      type: 'success',
      text: `تم حفظ الطلب (${order.orderNumber}) وفتح محادثة واتساب مع المندوب (${cleanPhone}).`,
    });
  };

  const handleModalPdfAction = async (mode: 'download' | 'share') => {
    if (!previewOrder || !previewSheetRef.current) return;
    setIsExportingPdf(true);
    setActionFeedback(null);
    try {
      const res = await sendOrDownloadKayanOrderPdf({
        element: previewSheetRef.current,
        order: previewOrder,
        mode,
      });
      setActionFeedback({
        type: res.status === 'cancelled' ? 'error' : 'success',
        text: res.message,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء تصدير ورقة الطلب بصيغة PDF.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyWhatsappText = async (order: KayanOrderSheet) => {
    try {
      await navigator.clipboard.writeText(buildKayanWhatsappMessage(order));
      setCopiedOrderText(true);
      setTimeout(() => setCopiedOrderText(false), 2000);
    } catch {
      setActionFeedback({ type: 'error', text: 'تعذر نسخ نص الطلب.' });
    }
  };

  // Catalog CRUD helpers
  const openAddItemModal = () => {
    setEditingItemId(null);
    const nextNum = 101 + kayanItems.length;
    setFormName('');
    setFormCode(`KY-${nextNum}`);
    setFormCategory(selectedCategory !== 'الكل' ? selectedCategory : KAYAN_CATEGORIES[0]);
    setFormUnit('carton');
    setFormRefPrice('');
    setFormNotes('');
    setFormError('');
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: KayanDetergentItem) => {
    setEditingItemId(item.id);
    setFormName(item.name);
    setFormCode(item.itemCode);
    setFormCategory(item.category || KAYAN_CATEGORIES[0]);
    setFormUnit(item.defaultUnit || 'carton');
    setFormRefPrice(item.referencePrice !== undefined ? String(item.referencePrice) : '');
    setFormNotes(item.notes || '');
    setFormError('');
    setItemModalOpen(true);
  };

  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const cleanCode = formCode.trim();
    if (!cleanName) {
      setFormError('اسم الصنف مطلوب.');
      return;
    }
    if (!cleanCode) {
      setFormError('رقم الصنف مطلوب.');
      return;
    }

    const parsedPrice = formRefPrice.trim() ? Number(formRefPrice) : undefined;
    const safePrice =
      parsedPrice !== undefined && Number.isFinite(parsedPrice) && parsedPrice >= 0
        ? parsedPrice
        : undefined;

    if (editingItemId) {
      updateKayanItem(editingItemId, {
        name: cleanName,
        itemCode: cleanCode,
        category: formCategory.trim() || KAYAN_CATEGORIES[0],
        defaultUnit: formUnit,
        referencePrice: safePrice,
        notes: formNotes.trim() || undefined,
      });
    } else {
      addKayanItem({
        name: cleanName,
        itemCode: cleanCode,
        category: formCategory.trim() || KAYAN_CATEGORIES[0],
        defaultUnit: formUnit,
        referencePrice: safePrice,
        notes: formNotes.trim() || undefined,
      });
    }

    setItemModalOpen(false);
    setActionFeedback({
      type: 'success',
      text: editingItemId ? `تم تحديث الصنف (${cleanName}) بنجاح.` : `تمت إضافة الصنف (${cleanName}) إلى القائمة.`,
    });
  };

  const handleSaveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    updateKayanSettings({
      delegatePhone: settingsPhone.trim(),
      delegateName: settingsDelegateName.trim() || undefined,
      propertyName: settingsPropertyName.trim() || 'AMASA RESORT',
      locationUrl: settingsLocationUrl.trim(),
    });
    setSettingsSavedMsg('تم حفظ إعدادات المندوب وموقع الاستراحة ومزامنتها سحابياً.');
    setTimeout(() => setSettingsSavedMsg(''), 3500);
  };

  const loadOrderIntoDraft = (order: KayanOrderSheet) => {
    const nextDraft: Record<string, DraftLineState> = {};
    const byId = new Map(kayanItems.map((it) => [it.id, it]));
    const byCode = new Map(kayanItems.map((it) => [it.itemCode.trim().toLowerCase(), it]));
    order.items.forEach((line) => {
      const matched = byId.get(line.itemId) || byCode.get(line.itemCode.trim().toLowerCase());
      if (matched) {
        nextDraft[matched.id] = {
          itemId: matched.id,
          quantity: line.quantity,
          unit: line.unit,
        };
      }
    });
    setDraftLines(nextDraft);
    if (order.delegatePhone) setDelegatePhoneInput(order.delegatePhone);
    if (order.delegateName) setDelegateNameInput(order.delegateName);
    if (order.notes) setOrderNotes(order.notes);
    setSubView('order');
    setActionFeedback({
      type: 'success',
      text: `تم تحميل أصناف الطلب (${order.orderNumber}) في مسودة الطلب السريع.`,
    });
  };

  // Strict admin-only enforcement (بعد كل الـ hooks)
  if (!isAdmin) {
    return null;
  }

  const catShort = (c: string) => CATEGORY_SHORT[c] || (c.length > 10 ? `${c.slice(0, 9)}…` : c);

  const filterBlock = (
    <>
      <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="ابحث بالاسم أو رقم الصنف" />
      <Chips>
        {availableCategories.map((cat) => (
          <Chip key={cat} label={catShort(cat)} on={selectedCategory === cat} onClick={() => setSelectedCategory(cat)} />
        ))}
      </Chips>
    </>
  );

  const emptyFiltered = (
    <div className="kt-bk items-center text-center py-6">
      <Package className="w-7 h-7 text-[#5B2EA6]" aria-hidden="true" />
      <p className="kt-row-n" style={{ whiteSpace: 'normal' }}>
        لا توجد أصناف مطابقة
      </p>
      <Act tone="ink" icon={Plus} label="إضافة صنف جديد" onClick={openAddItemModal} />
    </div>
  );

  return (
    <div dir="rtl" className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-2 space-y-4">
      {/* 1. الترويسة */}
      <section className="lux-hero p-4 space-y-3.5">
        <div aria-hidden="true" className="lux-lattice" />
        <div className="relative space-y-2">
          <Tag tone="gold">الإدارة فقط</Tag>
          <h2 className="text-[19px] font-extrabold" style={{ color: '#F5F0FC' }}>
            توريد مستلزمات النظافة
          </h2>
        </div>
        <div className="relative">
          <Infos cols={3}>
            <Info dark label="الأصناف" value={kayanItems.length} />
            <Info dark label="في الطلب" value={selectedOrderItems.length} />
            <Info dark label="الطلبات" value={kayanOrders.length} />
          </Infos>
        </div>
      </section>

      {/* 2. التبويبات */}
      <Seg
        label="أقسام كيان"
        value={subView}
        onChange={setSubView}
        items={[
          { id: 'order', label: 'الطلب', icon: ClipboardList, badge: selectedOrderItems.length || undefined },
          { id: 'catalog', label: 'الأصناف', icon: Package },
          { id: 'history', label: 'السجل', icon: History, badge: kayanOrders.length || undefined },
        ]}
      />

      {/* تنبيه العملية */}
      {actionFeedback &&
        (actionFeedback.type === 'success' ? (
          <div className="kt-ok animate-in fade-in" role="status">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
              <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{actionFeedback.text}</span>
              <button type="button" onClick={() => setActionFeedback(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="kt-err animate-in fade-in" role="alert">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="flex-1 min-w-0">{actionFeedback.text}</span>
            <button type="button" onClick={() => setActionFeedback(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
              ✕
            </button>
          </div>
        ))}

      {/* ═══ الطلب السريع ═══ */}
      {subView === 'order' && (
        <>
          <section className="lux-card p-4 space-y-3.5">
            <Head
              title="اختر الأصناف"
              icon={Package}
              count={filteredItems.length}
              action={<Act small tone="soft" icon={Plus} label="صنف جديد" onClick={openAddItemModal} />}
            />
            {filterBlock}

            {filteredItems.length === 0 ? (
              emptyFiltered
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map((item) => {
                  const line = draftLines[item.id];
                  const qty = line?.quantity || 0;
                  const unit: KayanUnit = line?.unit || item.defaultUnit || 'piece';

                  return (
                    <div key={item.id} className={`kt-bk${qty > 0 ? ' kt-on' : ''}`}>
                      <div className="kt-bk-h">
                        <span className="kt-row-t">
                          <span className="kt-row-n">{item.name}</span>
                          <span className="kt-row-s">
                            <span dir="ltr" className="font-mono font-bold">
                              {item.itemCode}
                            </span>{' '}
                            · {catShort(item.category)}
                          </span>
                        </span>
                      </div>

                      <div className="kt-ord">
                        <Seg
                          compact
                          label={`وحدة ${item.name}`}
                          value={unit}
                          onChange={(u) => updateItemUnit(item, u)}
                          items={KAYAN_UNIT_ORDER.map((u) => ({ id: u, label: KAYAN_UNIT_LABELS[u] }))}
                        />
                        <div className="kt-step">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item, qty - 1)}
                            disabled={qty <= 0}
                            aria-label="إنقاص الكمية"
                          >
                            <Minus size={18} strokeWidth={2} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={9999}
                            value={qty === 0 ? '' : qty}
                            placeholder="0"
                            onChange={(e) => updateItemQuantity(item, Number(e.target.value))}
                            className="kt-raw"
                            aria-label={`كمية ${item.name}`}
                          />
                          <button
                            type="button"
                            className="kt-step-p"
                            onClick={() => updateItemQuantity(item, qty + 1)}
                            aria-label="زيادة الكمية"
                          >
                            <Plus size={18} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ورقة الطلب الحالية */}
          <section className="lux-card p-4 space-y-3.5">
            <Head
              title="ورقة الطلب"
              icon={ClipboardList}
              tone="sand"
              count={`${selectedOrderItems.length} صنف`}
              action={
                selectedOrderItems.length > 0 ? (
                  <Act small tone="garnS" label="تفريغ" onClick={clearCurrentDraft} />
                ) : undefined
              }
            />

            <Infos cols={2}>
              <Info label="عدد الأصناف" value={selectedOrderItems.length} />
              <Info hi label="إجمالي الوحدات" value={totalUnitsCount} />
            </Infos>

            {/* المندوب والموقع */}
            <div className="kt-sub">
              <Head title="المندوب والموقع" icon={Phone} tone="jade" />
              <div className="kt-fields">
                <Field label="جوال المندوب" className="kt-wide">
                  <input
                    type="tel"
                    dir="ltr"
                    inputMode="tel"
                    value={delegatePhoneInput}
                    onChange={(e) => setDelegatePhoneInput(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="kt-input kt-num"
                  />
                </Field>
                <Field label="اسم المندوب" hint="اختياري" className="kt-wide">
                  <input
                    type="text"
                    value={delegateNameInput}
                    onChange={(e) => setDelegateNameInput(e.target.value)}
                    placeholder="الاسم"
                    className="kt-input"
                  />
                </Field>
              </div>
              {phoneDirtyComparedToSaved && (
                <Act tone="soft" icon={Check} label="حفظ كرقم افتراضي" onClick={handleSaveCurrentPhoneAsDefault} />
              )}

              <Row
                icon={MapPin}
                tone="sand"
                title={propertyNameInput || 'الاستراحة'}
                sub="موقع التوصيل"
                end={
                  <Act
                    small
                    tone="soft"
                    label={showLocationEditor ? 'إخفاء' : 'تعديل'}
                    onClick={() => setShowLocationEditor((v) => !v)}
                  />
                }
              />
              {showLocationEditor && (
                <div className="kt-fields animate-in fade-in duration-200">
                  <Field label="اسم الاستراحة" className="kt-wide">
                    <input
                      type="text"
                      value={propertyNameInput}
                      onChange={(e) => setPropertyNameInput(e.target.value)}
                      placeholder="اسم الاستراحة / الشاليه"
                      className="kt-input"
                    />
                  </Field>
                  <Field label="رابط الموقع" hint="خرائط قوقل" className="kt-wide">
                    <input
                      type="url"
                      dir="ltr"
                      value={locationUrlInput}
                      onChange={(e) => setLocationUrlInput(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="kt-input"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* أصناف الطلب (الاسم + الرقم + الكمية والوحدة — بدون أسعار) */}
            {selectedOrderItems.length === 0 ? (
              <div className="kt-bk items-center text-center py-6">
                <ClipboardList className="w-7 h-7 text-[#5B2EA6]" aria-hidden="true" />
                <p className="kt-row-n" style={{ whiteSpace: 'normal' }}>
                  لم تُختَر أصناف بعد
                </p>
                <p className="kt-note">اضغط (+) بجانب أي صنف لإضافته للورقة.</p>
              </div>
            ) : (
              <div className="kt-scroll space-y-2">
                {selectedOrderItems.map((line, index) => {
                  const catalogItem = kayanItems.find((it) => it.id === line.itemId);
                  return (
                    <Row
                      key={line.itemId}
                      title={`${index + 1}. ${line.name}`}
                      sub={`${line.itemCode} · ${formatKayanUnitQuantity(line.quantity, line.unit)}`}
                      end={
                        catalogItem ? (
                          <IconBtn
                            icon={Trash2}
                            tone="garn"
                            label={`حذف ${line.name} من الطلب`}
                            onClick={() => updateItemQuantity(catalogItem, 0)}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            <Field label="ملاحظات التوصيل" hint="اختياري">
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="ملاحظات للمندوب"
                className="kt-input"
              />
            </Field>

            <Act
              tone="ink"
              icon={FileText}
              label="معاينة وإصدار ورقة PDF"
              disabled={selectedOrderItems.length === 0}
              onClick={handleOpenPdfPreview}
            />
            <Acts cols={2}>
              <Act
                tone="soft"
                icon={Download}
                label={isExportingPdf ? 'جاري التجهيز' : 'تنزيل PDF'}
                disabled={selectedOrderItems.length === 0 || isExportingPdf}
                onClick={() => void handleDirectPdfExport('download')}
              />
              <Act
                tone="jade"
                icon={MessageCircle}
                label="واتساب المندوب"
                disabled={selectedOrderItems.length === 0}
                onClick={handleSendWhatsappDirectly}
              />
            </Acts>
          </section>
        </>
      )}

      {/* ═══ الأصناف والإعدادات ═══ */}
      {subView === 'catalog' && (
        <>
          <section className="lux-card p-4 space-y-3.5">
            <Head
              title="قائمة الأصناف"
              icon={Package}
              count={filteredItems.length}
              action={<Act small tone="ink" icon={Plus} label="صنف جديد" onClick={openAddItemModal} />}
            />
            {filterBlock}

            {filteredItems.length === 0 ? (
              emptyFiltered
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map((item) => (
                  <div key={item.id} className="kt-bk">
                    <div className="kt-bk-h">
                      <span className="kt-row-t">
                        <span className="kt-row-n">{item.name}</span>
                        <span className="kt-row-s">
                          <span dir="ltr" className="font-mono font-bold">
                            {item.itemCode}
                          </span>{' '}
                          · {catShort(item.category)} · {KAYAN_UNIT_LABELS[item.defaultUnit]}
                        </span>
                      </span>
                      <IconBtn icon={Edit3} label={`تعديل ${item.name}`} onClick={() => openEditItemModal(item)} />
                      <IconBtn
                        icon={Trash2}
                        tone="garn"
                        label={`حذف ${item.name}`}
                        onClick={() => deleteKayanItem(item.id)}
                      />
                    </div>
                    {item.referencePrice !== undefined && item.referencePrice > 0 && (
                      <p className="kt-note">سعر مرجعي داخلي: {item.referencePrice} ر.س</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lux-card p-4 space-y-3.5">
            <Head title="إعدادات المندوب" icon={Settings} tone="jade" />
            <p className="kt-note">يُعتمد الرقم والموقع تلقائياً في كل الطلبات الجديدة.</p>
            <form onSubmit={handleSaveSettingsForm} className="space-y-3.5">
              <div className="kt-fields">
                <Field label="جوال المندوب">
                  <input
                    type="tel"
                    dir="ltr"
                    inputMode="tel"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="0531418018"
                    className="kt-input kt-num"
                  />
                </Field>
                <Field label="اسم المندوب" hint="اختياري">
                  <input
                    type="text"
                    value={settingsDelegateName}
                    onChange={(e) => setSettingsDelegateName(e.target.value)}
                    placeholder="مندوب كيان"
                    className="kt-input"
                  />
                </Field>
                <Field label="اسم الاستراحة" className="kt-wide">
                  <input
                    type="text"
                    value={settingsPropertyName}
                    onChange={(e) => setSettingsPropertyName(e.target.value)}
                    placeholder="AMASA RESORT"
                    className="kt-input"
                  />
                </Field>
                <Field label="رابط الموقع" hint="خرائط قوقل" className="kt-wide">
                  <input
                    type="url"
                    dir="ltr"
                    value={settingsLocationUrl}
                    onChange={(e) => setSettingsLocationUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="kt-input"
                  />
                </Field>
              </div>

              {settingsSavedMsg && (
                <div className="kt-ok" role="status">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
                    <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{settingsSavedMsg}</span>
                  </div>
                </div>
              )}

              <Act submit tone="ink" icon={Check} label="حفظ بيانات المندوب والموقع" />
            </form>
          </section>
        </>
      )}

      {/* ═══ سجل الطلبات ═══ */}
      {subView === 'history' && (
        <section className="lux-card p-4 space-y-3.5">
          <Head title="سجل الطلبات" icon={History} tone="sand" count={kayanOrders.length} />
          <p className="kt-note">أعد فتح ورقة PDF لأي طلب، أو أرسله للمندوب، أو كرّره كطلب جديد.</p>

          {kayanOrders.length === 0 ? (
            <div className="kt-bk items-center text-center py-6">
              <FileText className="w-7 h-7 text-[#5B2EA6]" aria-hidden="true" />
              <p className="kt-row-n" style={{ whiteSpace: 'normal' }}>
                لا توجد أوراق طلبات محفوظة
              </p>
              <Act tone="ink" icon={Plus} label="إنشاء أول ورقة طلب" onClick={() => setSubView('order')} />
            </div>
          ) : (
            <div className="space-y-2.5">
              {kayanOrders.map((ord) => (
                <div key={ord.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <Tag tone="amy" mono>
                      {ord.orderNumber}
                    </Tag>
                    <span className="flex-1" />
                    <Tag tone="jade">{ord.items.length} صنف</Tag>
                  </div>
                  <Infos cols={2}>
                    <Info label="التاريخ" value={orderDay(ord.createdAt)} />
                    <Info label="الوقت" value={orderTime(ord.createdAt)} />
                  </Infos>
                  <Infos cols={1}>
                    <Info ltr label="جوال المندوب" value={ord.delegatePhone || '—'} />
                  </Infos>
                  <Acts cols={2}>
                    <Act tone="ink" icon={FileText} label="عرض PDF" onClick={() => setPreviewOrder(ord)} />
                    <Act
                      tone="jade"
                      icon={MessageCircle}
                      label="واتساب"
                      href={buildKayanWhatsappUrl(delegatePhoneInput.trim() || ord.delegatePhone, ord)}
                    />
                    <Act tone="soft" icon={Copy} label="تكرار الطلب" onClick={() => loadOrderIntoDraft(ord)} />
                    <Act tone="garnS" icon={Trash2} label="حذف" onClick={() => deleteKayanOrder(ord.id)} />
                  </Acts>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* إضافة / تعديل صنف */}
      {itemModalOpen && (
        <Sheet
          title={editingItemId ? 'تعديل الصنف' : 'إضافة صنف'}
          icon={Package}
          tone="amy"
          onClose={() => setItemModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act tone="soft" label="إلغاء" onClick={() => setItemModalOpen(false)} />
              <Act submit form="kayan-item-form" tone="ink" icon={Check} label={editingItemId ? 'حفظ التعديل' : 'إضافة الصنف'} />
            </Acts>
          }
        >
          <form id="kayan-item-form" onSubmit={handleSaveCatalogItem} className="space-y-3">
            <div className="kt-fields">
              <Field label="اسم الصنف" className="kt-wide">
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: كلوركس منظف ومبيض"
                  className="kt-input"
                />
              </Field>
              <Field label="رقم الصنف">
                <input
                  type="text"
                  dir="ltr"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="KY-119"
                  className="kt-input kt-num"
                />
              </Field>
              <Field label="الوحدة">
                <select value={formUnit} onChange={(e) => setFormUnit(e.target.value as KayanUnit)} className="kt-input">
                  {KAYAN_UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>
                      {KAYAN_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="التصنيف" className="kt-wide">
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="kt-input">
                  {KAYAN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="السعر المرجعي" hint="داخلي · اختياري" className="kt-wide">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={formRefPrice}
                  onChange={(e) => setFormRefPrice(e.target.value)}
                  placeholder="0.00"
                  className="kt-input kt-num"
                />
              </Field>
            </div>
            <p className="kt-note">السعر المرجعي داخلي فقط، ولا يظهر في ورقة المندوب.</p>
            {formError && (
              <div className="kt-err" role="alert">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="flex-1 min-w-0">{formError}</span>
              </div>
            )}
          </form>
        </Sheet>
      )}

      {/* معاينة ورقة الطلب الرسمية */}
      {previewOrder && (
        <Sheet
          wide
          title={`ورقة الطلب ${previewOrder.orderNumber}`}
          icon={FileText}
          tone="amy"
          onClose={() => setPreviewOrder(null)}
          footer={
            <Acts cols={2}>
              <Act
                tone="ink"
                icon={Download}
                label={isExportingPdf ? 'جاري التوليد' : 'تنزيل PDF'}
                disabled={isExportingPdf}
                onClick={() => void handleModalPdfAction('download')}
              />
              <Act
                tone="soft"
                icon={Share2}
                label="مشاركة الملف"
                disabled={isExportingPdf}
                onClick={() => void handleModalPdfAction('share')}
              />
              <Act
                tone="jade"
                icon={MessageCircle}
                label="إرسال واتساب"
                href={buildKayanWhatsappUrl(previewOrder.delegatePhone, previewOrder)}
              />
              <Act
                tone="line"
                icon={copiedOrderText ? Check : Copy}
                label={copiedOrderText ? 'تم النسخ' : 'نسخ النص'}
                onClick={() => void handleCopyWhatsappText(previewOrder)}
              />
            </Acts>
          }
        >
          <p className="kt-note">الصنف · رقم الصنف · الكمية والوحدة (حبة / كرتون / بالة)</p>
          <div className="rounded-2xl bg-slate-100 p-2 sm:p-4 overflow-x-auto shrink-0">
            <div className="max-w-[780px] mx-auto">
              <KayanOrderSheetDocument ref={previewSheetRef} order={previewOrder} />
            </div>
          </div>
        </Sheet>
      )}

      {/* منصة A4 مخفية لتنزيل PDF بنقرة واحدة دون فتح المعاينة */}
      {hiddenRenderOrder && (
        <div
          style={{
            position: 'fixed',
            top: '-10000px',
            left: '0',
            width: '800px',
            pointerEvents: 'none',
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          <KayanOrderSheetDocument ref={hiddenExportSheetRef} order={hiddenRenderOrder} />
        </div>
      )}
    </div>
  );
};
