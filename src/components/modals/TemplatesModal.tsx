import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RotateCcw, Save, Check, Copy, ExternalLink, HelpCircle, X, MessageSquare, FileText, DollarSign, Clock, Download } from 'lucide-react';
import { generateContractPdfFile, triggerPdfFileDownload } from '../../lib/contractPdf';
import { useApp, fillTemplate } from '../../context/AppContext';
import { MessageTemplates } from '../../types';
import { INITIAL_TEMPLATES } from '../../data/mock';
import { Sheet, Seg, Field, Head, Row, Acts, Act, Acc, IconBtn, SearchBox } from '../ui/kit';

interface VariableTag {
  tag: string;
  label: string;
  sample: string;
  category?: 'customer' | 'finance' | 'dates' | 'property' | 'other';
  highlight?: boolean;
}

interface TemplateMeta {
  id: keyof MessageTemplates;
  title: string;
  badge: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  availableTags: VariableTag[];
}

const TEMPLATES_META: TemplateMeta[] = [
  {
    id: 'depositRequest',
    title: 'صيغة طلب العربون',
    badge: 'مهلة 15 دقيقة',
    subtitle: 'الرسالة المرسلة للعميل فور اختيار الليالي لتحويل العربون',
    description:
      'تُرسل عبر رابط واتساب برقم العميل مباشرة عند الضغط على "طلب العربون"، مع توضيح رقم الآيبان والبنك وإمهاله 15 دقيقة لتحويل العربون وتثبيت الحجز.',
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    availableTags: [
      { tag: '{اسم_العميل}', label: 'اسم العميل', sample: 'علي السالم', category: 'customer' },
      { tag: '{رقم_الجوال}', label: 'رقم جوال العميل', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{customerPhone}', label: 'رقم جوال العميل (كود)', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{اسم_العقار}', label: 'اسم العقار', sample: 'كوخ البيلسان', category: 'property' },
      { tag: '{عدد_الليالي}', label: 'عدد الليالي', sample: '2', category: 'dates' },
      { tag: '{مبلغ_العربون}', label: 'مبلغ العربون', sample: '250', category: 'finance' },
      { tag: '{المبلغ_الإجمالي}', label: 'المبلغ الإجمالي', sample: '1500', category: 'finance' },
      { tag: '{المبلغ_المتبقي}', label: 'المتبقي عند الدخول', sample: '1250', category: 'finance' },
      { tag: '{مبلغ_التأمين}', label: 'مبلغ التأمين', sample: '300', category: 'finance' },
      { tag: '{اسم_البنك}', label: 'اسم البنك', sample: 'مصرف الراجحي', category: 'finance' },
      { tag: '{اسم_الحساب}', label: 'اسم الحساب المستفيد', sample: 'مؤسسة الشاليهات الفاخرة', category: 'finance' },
      { tag: '{رقم_الآيبان}', label: 'رقم الآيبان (IBAN)', sample: 'SA0380000000608010167519', category: 'finance' },
      { tag: '{مهلة_الدفع}', label: 'مهلة الدفع', sample: '15 دقيقة', category: 'other' },
      { tag: '{تاريخ_الدخول}', label: 'تاريخ الدخول', sample: 'الأحد 4 أكتوبر 2026', category: 'dates' },
      { tag: '{وقت_الدخول}', label: 'وقت الدخول', sample: 'الساعة 4:00 عصراً', category: 'dates' },
      { tag: '{تاريخ_الخروج}', label: 'تاريخ الخروج', sample: 'الإثنين 5 أكتوبر 2026', category: 'dates' },
      { tag: '{وقت_الخروج}', label: 'وقت الخروج', sample: 'الساعة 2:00 ظهراً', category: 'dates' },
      { tag: '{رقم_الإدارة}', label: 'واتساب إدارة AMASA RESORT', sample: '0599525515', category: 'other' },
    ],
  },
  {
    id: 'paymentCompletion',
    title: 'صيغة إكمال المتبقي والتأمين',
    badge: 'المتبقي والتأمين',
    subtitle: 'رسالة إكمال المتبقي والتأمين عبر واتساب للعميل فور تأكيد الحارس الحضور',
    description:
      'تُرسل للنزيل عبر واتساب فور تأكيد الحارس حضوره للاستراحة لطلب سداد المتبقي والتأمين مع بيانات الحساب البنكي والآيبان.',
    icon: <DollarSign className="w-4 h-4 text-indigo-500" />,
    availableTags: [
      { tag: '{اسم_العميل}', label: 'اسم العميل', sample: 'علي السالم', category: 'customer' },
      { tag: '{رقم_الجوال}', label: 'رقم جوال العميل', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{customerPhone}', label: 'رقم جوال العميل (كود)', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{رقم_الحجز}', label: 'رقم الحجز', sample: 'BK-2026-105', category: 'property' },
      { tag: '{اسم_العقار}', label: 'اسم العقار', sample: 'الترف', category: 'property' },
      { tag: '{المبلغ_الإجمالي}', label: 'المبلغ الإجمالي', sample: '1200', category: 'finance' },
      { tag: '{مبلغ_العربون}', label: 'العربون المسدد', sample: '300', category: 'finance' },
      { tag: '{المبلغ_المتبقي}', label: 'المبلغ المتبقي للتحصيل', sample: '900', category: 'finance' },
      { tag: '{مبلغ_التأمين}', label: 'مبلغ التأمين', sample: '500', category: 'finance' },
      { tag: '{المجموع_المطلوب}', label: 'إجمالي المطلوب (متبقي + تأمين)', sample: '1400', category: 'finance' },
      { tag: '{اسم_البنك}', label: 'اسم البنك', sample: 'مصرف الراجحي', category: 'finance' },
      { tag: '{اسم_الحساب}', label: 'اسم المستفيد', sample: 'AMASA RESORT', category: 'finance' },
      { tag: '{رقم_الآيبان}', label: 'رقم الآيبان (IBAN)', sample: 'SA0380000000608010167519', category: 'finance' },
      { tag: '{اسم_الحارس}', label: 'اسم الحارس', sample: 'أبو راشد', category: 'other' },
      { tag: '{رقم_الإدارة}', label: 'واتساب إدارة AMASA RESORT', sample: '0599525515', category: 'other' },
    ],
  },
  {
    id: 'contract',
    title: 'صيغة العقد والشروط',
    badge: 'العقد الرسمي',
    subtitle: 'عقد الإيجار وبنود الشروط والأحكام ومبلغ التأمين الإلزامي',
    description:
      'صيغة العقد النظامية المعتمدة التي تُرسل عبر رابط واتساب برقم العميل فور تأكيد الحجز، وتحتوي على مواعيد الدخول والخروج والأسعار والشروط والأحكام.',
    icon: <FileText className="w-4 h-4 text-purple-600" />,
    availableTags: [
      { tag: '{اسم_العقار}', label: 'اسم العقار', sample: 'كوخ زهرة البيلسان', category: 'property' },
      { tag: '{اسم_العميل}', label: 'اسم العميل', sample: 'علي', category: 'customer' },
      { tag: '{رقم_الجوال}', label: 'رقم جوال العميل', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{customerPhone}', label: 'رقم جوال العميل (كود)', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{رقم_الحجز}', label: 'رقم الحجز المعتمد', sample: 'BK-2026-105', category: 'property' },
      { tag: '{تاريخ_الدخول}', label: 'يوم وتاريخ الدخول', sample: 'الأحد 4 اكتوبر ( 10 ) 2026 م', category: 'dates' },
      { tag: '{وقت_الدخول}', label: 'وقت الدخول', sample: 'الساعة 4:00 عصراً', category: 'dates' },
      { tag: '{تاريخ_الخروج}', label: 'يوم وتاريخ الخروج', sample: 'الإثنين 5 اكتوبر ( 10 ) 2026 م', category: 'dates' },
      { tag: '{وقت_الخروج}', label: 'وقت الخروج', sample: 'الساعة 2:00 ظهراً', category: 'dates' },
      { tag: '{المبلغ_الإجمالي}', label: 'المبلغ المتفق عليه', sample: '300', category: 'finance' },
      { tag: '{مبلغ_العربون}', label: 'العربون', sample: '250', category: 'finance' },
      { tag: '{المبلغ_المتبقي}', label: 'المتبقي', sample: '50', category: 'finance' },
      { tag: '{مبلغ_التأمين}', label: 'التأمين', sample: '300', category: 'finance' },
      { tag: '{شروط_العقد}', label: 'بنود الشروط والأحكام', sample: '1. يلتزم المستأجر بتسليم الاستراحة في الوقت المحدد.', category: 'other' },
      { tag: '{رقم_الإدارة}', label: 'واتساب إدارة AMASA RESORT', sample: '0599525515', category: 'other' },
    ],
  },
  {
    id: 'checkoutReminder',
    title: 'صيغة تذكير الخروج',
    badge: 'إشعار المغادرة',
    subtitle: 'رسالة تذكير النزيل بموعد الخروج الساعة 2 ظهراً لتفادي الخصم من التأمين',
    description:
      'تُرسل تلقائياً عبر واتساب بالزر الأول في بطاقة دخول اليوم للشاشة الرئيسية لتنبيه العميل بالموعد المحدد وإخلاء الاستراحة.',
    icon: <Clock className="w-4 h-4 text-rose-500" />,
    availableTags: [
      { tag: '{اسم_العميل}', label: 'اسم العميل', sample: 'علي', category: 'customer' },
      { tag: '{رقم_الجوال}', label: 'رقم جوال العميل', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{customerPhone}', label: 'رقم جوال العميل (كود)', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{اسم_العقار}', label: 'اسم العقار', sample: 'كوخ البيلسان', category: 'property' },
      { tag: '{وقت_الخروج}', label: 'وقت الخروج', sample: 'الساعة 2 م', category: 'dates' },
      { tag: '{مبلغ_التأمين}', label: 'مبلغ التأمين', sample: '300', category: 'finance' },
      { tag: '{اسم_الحارس}', label: 'اسم الحارس', sample: 'أبو راشد', category: 'other' },
      { tag: '{رقم_الإدارة}', label: 'واتساب إدارة AMASA RESORT', sample: '0599525515', category: 'other' },
    ],
  },
  {
    id: 'coordinatorService',
    title: 'قالب إشعار المنسقات',
    badge: 'خدمات التنسيق',
    subtitle: 'الرسالة المرسلة لجوال المنسقة عند تأكيد الحجز وتحديد الخدمات المطلوبة',
    description:
      'تُرسل عبر واتساب إلى جوال المنسقة مباشرة عند تأكيد الحجز أو طلب خدمة التنسيق، وتتضمن تاريخ الحجز وساعة الدخول واسم العقار والخدمة المطلوبة.',
    icon: <Sparkles className="w-4 h-4 text-pink-500" />,
    availableTags: [
      { tag: '{اسم_المنسقة}', label: 'اسم المنسقة', sample: 'سارة الشمري', category: 'other' },
      { tag: '{تاريخ_الحجز}', label: 'تاريخ الحجز', sample: '2026-10-25', category: 'dates' },
      { tag: '{الساعة}', label: 'الساعة / وقت الدخول', sample: 'الساعة 4:00 عصراً', category: 'dates' },
      { tag: '{وقت_الدخول}', label: 'وقت الدخول', sample: 'الساعة 4:00 عصراً', category: 'dates' },
      { tag: '{اسم_العقار}', label: 'اسم العقار', sample: 'شاليه حمران (الما)', category: 'property' },
      { tag: '{رقم_الحجز}', label: 'رقم الحجز', sample: 'BK-2026-108', category: 'property' },
      { tag: '{اسم_العميل}', label: 'اسم العميل', sample: 'محمد العتيبي', category: 'customer' },
      { tag: '{جوال_العميل}', label: 'جوال العميل', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{رقم_الجوال}', label: 'رقم جوال العميل', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{customerPhone}', label: 'رقم جوال العميل (كود)', sample: '0555123456', category: 'customer', highlight: true },
      { tag: '{الخدمة_المطلوبة}', label: 'الخدمة المطلوبة', sample: 'باقة كوشة وضيافة ملكية VIP', category: 'other' },
      { tag: '{سعر_الخدمة}', label: 'سعر الخدمة', sample: '1500', category: 'finance' },
      { tag: '{رقم_الإدارة}', label: 'واتساب إدارة AMASA RESORT', sample: '0599525515', category: 'other' },
    ],
  },
];

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: keyof MessageTemplates;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({ isOpen, onClose, initialTab = 'depositRequest' }) => {
  const { messageTemplates, updateMessageTemplates, resetMessageTemplates } = useApp();
  const [activeTab, setActiveTab] = useState<keyof MessageTemplates>(() =>
    TEMPLATES_META.some((m) => m.id === initialTab) ? initialTab : 'depositRequest'
  );
  const [localTemplates, setLocalTemplates] = useState<MessageTemplates>(messageTemplates);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [insertedNotice, setInsertedNotice] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [searchTag, setSearchTag] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [confirmResetMode, setConfirmResetMode] = useState<null | 'current' | 'all'>(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track caret/selection indices
  const [cursorPos, setCursorPos] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (initialTab && TEMPLATES_META.some((m) => m.id === initialTab)) {
      setActiveTab(initialTab);
    } else {
      setActiveTab('depositRequest');
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    setLocalTemplates(messageTemplates);
  }, [messageTemplates, isOpen]);

  if (!isOpen) return null;

  const currentMeta = TEMPLATES_META.find((m) => m.id === activeTab) || TEMPLATES_META[0];
  const currentText = (localTemplates[activeTab] as string) || '';

  const updateCurrentText = (newVal: string) => {
    setLocalTemplates((prev) => ({ ...prev, [activeTab]: newVal }));
  };

  const syncCursorPos = () => {
    if (textareaRef.current) {
      setCursorPos({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      });
    }
  };

  // Insert tag at precise cursor / selection position inside textarea
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    let start = cursorPos ? cursorPos.start : textarea ? textarea.selectionStart : -1;
    let end = cursorPos ? cursorPos.end : textarea ? textarea.selectionEnd : -1;

    let updated = '';
    let nextCursor = 0;

    if (start >= 0 && end >= 0) {
      const before = currentText.slice(0, start);
      const after = currentText.slice(end);
      updated = before + tag + after;
      nextCursor = start + tag.length;
    } else {
      // Fallback: append with space
      updated = currentText ? `${currentText} ${tag}` : tag;
      nextCursor = updated.length;
    }

    updateCurrentText(updated);
    setCursorPos({ start: nextCursor, end: nextCursor });

    setInsertedNotice(tag);
    setTimeout(() => setInsertedNotice(null), 2500);

    // Refocus and place caret right after the inserted variable
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 30);
  };

  // One-click copy variable to clipboard
  const handleCopyTag = async (tag: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tag);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = tag;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2200);
    } catch {
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2200);
    }
  };

  const handleSaveAll = () => {
    updateMessageTemplates(localTemplates);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleResetCurrent = () => {
    const defaultText = INITIAL_TEMPLATES[activeTab];
    if (typeof defaultText === 'string') {
      updateCurrentText(defaultText);
    }
    setConfirmResetMode(null);
  };

  const handleResetAll = () => {
    resetMessageTemplates();
    setLocalTemplates(INITIAL_TEMPLATES);
    setConfirmResetMode(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const generateLivePreview = () => {
    const vars: Record<string, string> = {};
    currentMeta.availableTags.forEach((t) => {
      const cleanKey = t.tag.replace(/[{}]/g, '');
      vars[cleanKey] = t.sample;
    });
    return fillTemplate(currentText, vars);
  };

  // Filter tags
  const filteredTags = currentMeta.availableTags.filter((t) => {
    const matchesSearch =
      searchTag === '' ||
      t.tag.toLowerCase().includes(searchTag.toLowerCase()) ||
      t.label.toLowerCase().includes(searchTag.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'customer' && (t.category === 'customer' || t.highlight)) ||
      (selectedCategory === 'finance' && t.category === 'finance') ||
      (selectedCategory === 'dates' && t.category === 'dates') ||
      (selectedCategory === 'property' && t.category === 'property');

    return matchesSearch && matchesCategory;
  });

  const livePreview = generateLivePreview();

  return (
    <Sheet
      wide
      lockBackdrop
      title="قوالب الرسائل"
      icon={MessageSquare}
      tone="amy"
      onClose={onClose}
      footer={
        <Acts cols={2}>
          <Act
            tone={savedSuccess ? 'jade' : 'ink'}
            icon={savedSuccess ? Check : Save}
            label={savedSuccess ? 'تم الحفظ ✓' : 'حفظ التعديلات'}
            title="حفظ واعتماد التعديلات"
            onClick={handleSaveAll}
          />
          <Act tone="line" icon={X} label="إغلاق" onClick={onClose} />
        </Acts>
      }
    >
      {/* اختيار القالب */}
      <Field label="القالب">
        <select
          value={activeTab}
          onChange={(e) => {
            setActiveTab(e.target.value as keyof MessageTemplates);
            setSearchTag('');
            setSelectedCategory('all');
          }}
          className="kt-input"
        >
          {TEMPLATES_META.map((meta) => (
            <option key={meta.id} value={meta.id}>
              {meta.title}
            </option>
          ))}
        </select>
      </Field>
      <Row icon={Sparkles} tone="ch" title={currentMeta.badge} sub={currentMeta.subtitle} />

      {/* المحرر */}
      <Head title="نص القالب" icon={FileText} count={`${currentText.length} حرف`} />
      <textarea
        ref={textareaRef}
        aria-label="نص القالب"
        value={currentText}
        onChange={(e) => {
          updateCurrentText(e.target.value);
          setCursorPos({ start: e.target.selectionStart, end: e.target.selectionEnd });
        }}
        onSelect={syncCursorPos}
        onClick={syncCursorPos}
        onKeyUp={syncCursorPos}
        onFocus={syncCursorPos}
        rows={10}
        dir="rtl"
        placeholder="أدخل صيغة الرسالة هنا..."
        className="kt-input kt-ta"
      />
      <p className="kt-note">{currentText.split('\n').length} أسطر — اضغط متغيراً أدناه لإدراجه عند المؤشر.</p>

      {(insertedNotice || copiedTag) && (
        <div className="kt-ok" role="status">
          <div className="flex items-center gap-2.5 min-w-0">
            <Check className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">
              {insertedNotice ? 'أُدرج المتغير عند المؤشر' : 'نُسخ المتغير'} <bdi dir="ltr">{insertedNotice || copiedTag}</bdi>
            </span>
          </div>
        </div>
      )}

      {/* المتغيرات */}
      <Acc
        icon={<HelpCircle size={18} strokeWidth={1.8} />}
        title="المتغيرات التلقائية"
        tag={String(currentMeta.availableTags.length)}
        open={varsOpen}
        onToggle={() => setVarsOpen((v) => !v)}
      >
        <div className="flex flex-col gap-3">
          <Seg
            label="تصنيف المتغيرات"
            value={selectedCategory}
            onChange={setSelectedCategory}
            items={[
              { id: 'all', label: 'الكل' },
              { id: 'customer', label: 'العميل' },
              { id: 'finance', label: 'المبالغ' },
              { id: 'dates', label: 'المواعيد' },
              { id: 'property', label: 'العقار' },
            ]}
          />
          <SearchBox value={searchTag} onChange={setSearchTag} placeholder="ابحث عن متغير" />
          {filteredTags.length === 0 && <p className="kt-note">لا توجد متغيرات مطابقة.</p>}
          {filteredTags.map(({ tag, label, highlight }) => {
            const isCopied = copiedTag === tag;
            const isPhoneVar = tag.includes('الجوال') || tag.toLowerCase().includes('phone') || tag.includes('جوال');
            return (
              <div key={tag} className={`kt-bk ${highlight || isPhoneVar ? 'kt-on' : ''}`}>
                <div className="kt-bk-h">
                  <button type="button" onClick={() => insertTag(tag)} aria-label={`إدراج ${label}`} className="kt-row-t text-start flex-1 min-w-0 cursor-pointer lx-press">
                    <span className="kt-row-n">{label}</span>
                    <span className="kt-row-s" dir="ltr" style={{ textAlign: 'right' }}>
                      {tag}
                    </span>
                  </button>
                  <IconBtn icon={isCopied ? Check : Copy} label={`نسخ ${label}`} onClick={() => handleCopyTag(tag)} />
                </div>
              </div>
            );
          })}
        </div>
      </Acc>

      {/* المعاينة */}
      <Head title="معاينة واتساب" icon={MessageSquare} tone="jade" />
      <div className="kt-msg">{livePreview}</div>
      <Acts cols={2}>
        <Act tone="jadeS" icon={ExternalLink} label="تجربة في واتساب" title="تجربة فتح الرسالة في تطبيق واتساب" href={`https://wa.me/?text=${encodeURIComponent(livePreview)}`} />
        <Act tone="ink" icon={FileText} label="معاينة PDF" title="معاينة القالب بصيغة PDF" onClick={() => { setPdfErr(null); setPdfOpen(true); }} />
      </Acts>

      {pdfOpen && (
        <Sheet
          wide
          title="معاينة PDF"
          icon={FileText}
          tone="ink"
          onClose={() => setPdfOpen(false)}
          footer={
            <Acts cols={2}>
              <Act
                tone="ink"
                icon={Download}
                label={pdfBusy ? 'جارٍ الإنشاء…' : 'تحميل PDF'}
                title="تحميل القالب كملف PDF"
                disabled={pdfBusy}
                onClick={async () => {
                  if (!paperRef.current) return;
                  setPdfBusy(true);
                  setPdfErr(null);
                  try {
                    const file = await generateContractPdfFile(paperRef.current, `template-preview-${String(activeTab)}.pdf`);
                    triggerPdfFileDownload(file);
                  } catch (e: any) {
                    setPdfErr(e?.message || 'تعذر إنشاء ملف PDF حالياً.');
                  } finally {
                    setPdfBusy(false);
                  }
                }}
              />
              <Act tone="line" icon={X} label="إغلاق" onClick={() => setPdfOpen(false)} />
            </Acts>
          }
        >
          <p className="kt-note">معاينة بقيم تجريبية — الملف الفعلي يُملأ ببيانات الحجز.</p>
          {pdfErr && <div className="kt-err" role="alert"><span>{pdfErr}</span></div>}
          <div style={{ background: '#EFEAE0', borderRadius: 18, padding: 10, overflowX: 'auto' }}>
            <div
              ref={paperRef}
              dir="rtl"
              style={{
                background: '#fff',
                color: '#1B1530',
                borderRadius: 6,
                padding: '28px 26px',
                boxShadow: '0 2px 14px rgba(40,25,70,.15)',
                fontFamily: "'Tajawal', system-ui, sans-serif",
                minHeight: 380,
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '2px solid #B8904A', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ letterSpacing: 4, fontWeight: 800, fontSize: 13, color: '#8A6A2E' }}>AMASA RESORT</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{currentMeta.title}</div>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 2, fontSize: 14, fontWeight: 500 }}>{livePreview}</div>
            </div>
          </div>
        </Sheet>
      )}

      {/* استعادة الافتراضي */}
      <Head title="الاستعادة" icon={RotateCcw} tone="sand" />
      {confirmResetMode === 'current' ? (
        <div className="kt-warn p-3 space-y-3">
          <p className="text-[13.5px] font-bold leading-6" style={{ color: '#7A4A06' }}>
            استعادة الصيغة الافتراضية لهذا القالب؟
          </p>
          <Acts cols={2}>
            <Act small tone="garnet" label="نعم، استعد" onClick={handleResetCurrent} />
            <Act small tone="line" label="إلغاء" onClick={() => setConfirmResetMode(null)} />
          </Acts>
        </div>
      ) : confirmResetMode === 'all' ? (
        <div className="kt-warn p-3 space-y-3">
          <p className="text-[13.5px] font-bold leading-6" style={{ color: '#7A4A06' }}>
            استعادة جميع القوالب إلى الأصل؟
          </p>
          <Acts cols={2}>
            <Act small tone="garnet" label="نعم، استعد" onClick={handleResetAll} />
            <Act small tone="line" label="إلغاء" onClick={() => setConfirmResetMode(null)} />
          </Acts>
        </div>
      ) : (
        <Acts cols={2}>
          <Act tone="soft" icon={RotateCcw} label="هذا القالب" title="استعادة هذا القالب للافتراضي" onClick={() => setConfirmResetMode('current')} />
          <Act tone="garnS" icon={RotateCcw} label="كل القوالب" title="إعادة ضبط كافة القوالب للأصل" onClick={() => setConfirmResetMode('all')} />
        </Acts>
      )}
    </Sheet>
  );
};
