import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Property, PropertySection } from '../../types';
import { fillTemplate, useApp } from '../../context/AppContext';
import {
  buildDefaultUnitContractTemplate,
  CONTRACT_TEMPLATE_VARIABLES,
} from '../../lib/propertyUtils';
import { openExternalUrlSafely } from '../../lib/customerLinks';
import { Head, Row, Acts, Act, Acc, Tag, IconBtn } from '../ui/kit';

interface UnitContractTemplateCardProps {
  property: Property;
  section?: PropertySection;
  mode: 'property' | 'section';
  canEdit: boolean;
  onSaved?: (message: string) => void;
}

export const UnitContractTemplateCard: React.FC<UnitContractTemplateCardProps> = ({
  property,
  section,
  mode,
  canEdit,
  onSaved,
}) => {
  const { updateProperty, updatePropertySection, messageTemplates } = useApp();

  const unitLabel = property.name;
  const sectionLabel = mode === 'section' ? section?.name : undefined;

  const savedTemplate =
    mode === 'section'
      ? section?.contractTemplate || ''
      : property.contractTemplate || '';

  const fallbackDefault = buildDefaultUnitContractTemplate({
    unitLabel,
    sectionLabel,
  });

  const initialDisplayTemplate = savedTemplate.trim()
    ? savedTemplate
    : property.contractTemplate?.trim() && mode === 'section'
    ? property.contractTemplate
    : messageTemplates.contract?.trim() || fallbackDefault;

  const savedTerms =
    mode === 'section'
      ? section?.contractTerms && section.contractTerms.length > 0
        ? section.contractTerms
        : property.contractTerms || []
      : property.contractTerms || [];

  const [draftTemplate, setDraftTemplate] = useState<string>(initialDisplayTemplate);
  const [draftTerms, setDraftTerms] = useState<string[]>(savedTerms);
  const [newTermText, setNewTermText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [insertedTagNotice, setInsertedTagNotice] = useState<string | null>(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const nextSavedTpl =
      mode === 'section'
        ? section?.contractTemplate || ''
        : property.contractTemplate || '';

    const nextDisplay = nextSavedTpl.trim()
      ? nextSavedTpl
      : mode === 'section' && property.contractTemplate?.trim()
      ? property.contractTemplate
      : messageTemplates.contract?.trim() || fallbackDefault;

    const nextTerms =
      mode === 'section'
        ? section?.contractTerms && section.contractTerms.length > 0
          ? section.contractTerms
          : property.contractTerms || []
        : property.contractTerms || [];

    setDraftTemplate(nextDisplay);
    setDraftTerms([...nextTerms]);
  }, [
    property.id,
    property.contractTemplate,
    property.contractTerms,
    section?.id,
    section?.contractTemplate,
    section?.contractTerms,
    mode,
    messageTemplates.contract,
  ]);

  const isCustomized = Boolean(savedTemplate.trim());

  const syncCursorPos = () => {
    if (textareaRef.current) {
      setCursorPos({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      });
    }
  };

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    const start = cursorPos ? cursorPos.start : textarea ? textarea.selectionStart : -1;
    const end = cursorPos ? cursorPos.end : textarea ? textarea.selectionEnd : -1;

    let updated = '';
    let nextCursor = 0;

    if (start >= 0 && end >= 0) {
      updated = draftTemplate.slice(0, start) + tag + draftTemplate.slice(end);
      nextCursor = start + tag.length;
    } else {
      updated = draftTemplate ? `${draftTemplate} ${tag}` : tag;
      nextCursor = updated.length;
    }

    setDraftTemplate(updated);
    setCursorPos({ start: nextCursor, end: nextCursor });
    setInsertedTagNotice(tag);
    setTimeout(() => setInsertedTagNotice(null), 1800);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 30);
  };

  const renderLivePreview = () => {
    const termsText =
      draftTerms.length > 0
        ? draftTerms.map((t, idx) => `${idx + 1}. ${t}`).join('\n')
        : '1. يلتزم المستأجر بالمحافظة على مرافق الوحدة وتسليمها بالموعد المحدد.';

    const samplePrice =
      mode === 'section' && section ? section.priceWeekday : property.basePriceWeekday;
    const deposit = property.defaultDeposit || 300;
    const remaining = Math.max(0, samplePrice - deposit);

    return fillTemplate(draftTemplate, {
      اسم_العميل: 'خالد العتيبي',
      رقم_الجوال: '0555123456',
      رقم_الحجز: 'BK-2026-105',
      اسم_العقار:
        mode === 'section' && section
          ? `${property.name} (${section.name})`
          : property.name,
      اسم_القسم: mode === 'section' && section ? section.name : 'كامل العقار',
      تاريخ_الدخول: 'الخميس 15 أكتوبر 2026 م',
      وقت_الدخول: property.checkInTimeText || 'الساعة 4:00 عصراً',
      تاريخ_الخروج: 'الجمعة 16 أكتوبر 2026 م',
      وقت_الخروج: property.checkOutTimeText || 'الساعة 2:00 ظهراً',
      عدد_الليالي: 1,
      المبلغ_الإجمالي: samplePrice,
      مبلغ_العربون: deposit,
      المبلغ_المتبقي: remaining,
      مبلغ_التأمين: property.insuranceAmount || 500,
      شروط_العقد: termsText,
    });
  };

  const handleSave = () => {
    if (mode === 'section' && section) {
      updatePropertySection(property.id, section.id, {
        contractTemplate: draftTemplate.trim(),
        contractTerms: draftTerms,
      });
      onSaved?.(`تم حفظ قالب صيغة العقد لقسم "${section.name}" بشكل مستقل`);
    } else {
      updateProperty(property.id, {
        contractTemplate: draftTemplate.trim(),
        contractTerms: draftTerms,
      });
      onSaved?.(
        `تم حفظ قالب صيغة العقد لـ "${
          property.hasSections ? `كامل ${property.name}` : property.name
        }" بنجاح`
      );
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleRestoreDefault = () => {
    setDraftTemplate(fallbackDefault);
  };

  const handleAddTerm = () => {
    const clean = newTermText.trim();
    if (!clean) return;
    setDraftTerms((prev) => [...prev, clean]);
    setNewTermText('');
  };

  const handleCopyPreview = () => {
    const text = renderLivePreview();
    navigator.clipboard?.writeText(text);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  const cardTitle =
    mode === 'section' && section
      ? `قالب صيغة العقد للعميل — ${section.name}`
      : property.hasSections
      ? `قالب صيغة العقد للعميل — كامل العقار (${property.name})`
      : `قالب صيغة العقد للعميل — ${property.name}`;

  const cardSubtitle =
    mode === 'section' && section
      ? `صيغة العقد وبنود الشروط الخاصة بقسم (${section.name}) منفصلة عن باقي الأقسام`
      : property.hasSections
      ? `صيغة العقد وبنود الشروط الخاصة بحجز (${property.name}) كاملاً`
      : `صيغة العقد وبنود الشروط المخصصة لهذه الوحدة`;

  const scopeName = mode === 'section' && section ? section.name : property.hasSections ? 'كامل العقار' : property.name;
  const shortVar = (label: string) =>
    label
      .replace(/\s*[(（][^)）]*[)）]\s*$/, '')
      .replace(/\s*\/.*$/, '')
      .replace('بنود الشروط والأحكام', 'بنود الشروط')
      .replace('رقم جوال العميل', 'جوال العميل')
      .trim();

  return (
    <div className="kt-bk">
      <Row
        icon={FileText}
        tone={isCustomized ? 'jade' : 'amy'}
        title="قالب صيغة العقد"
        sub={scopeName}
        end={<Tag tone={isCustomized ? 'jade' : 'gray'}>{isCustomized ? 'مخصص' : 'مبدئي'}</Tag>}
      />

      <Acts cols={2}>
        <Act
          small
          tone={copiedPreview ? 'jade' : 'soft'}
          icon={copiedPreview ? Check : Copy}
          label={copiedPreview ? 'تم النسخ ✓' : 'نسخ الصيغة'}
          title="نسخ صيغة العقد كما ستصل للعميل"
          onClick={handleCopyPreview}
        />
        <Act
          small
          tone={isExpanded ? 'line' : 'ink'}
          label={isExpanded ? 'إخفاء المحرر' : canEdit ? 'تعديل القالب' : 'معاينة القالب'}
          onClick={() => setIsExpanded((v) => !v)}
        />
      </Acts>

      {!isExpanded && <div className="kt-msg">{renderLivePreview()}</div>}

      {isExpanded && (
        <div className="flex flex-col gap-3">
          {canEdit && (
            <>
              <Acc
                icon={<Sparkles size={18} strokeWidth={1.8} />}
                title="المتغيرات التلقائية"
                tag={String(CONTRACT_TEMPLATE_VARIABLES.length)}
                open={varsOpen}
                onToggle={() => setVarsOpen((v) => !v)}
              >
                <p className="kt-note mb-2">اضغط متغيراً لإدراجه عند المؤشر داخل نص العقد.</p>
                <Acts cols={2}>
                  {CONTRACT_TEMPLATE_VARIABLES.map((v) => (
                    <Act key={v.tag} small tone="soft" label={shortVar(v.label)} title={`إدراج ${v.tag}`} onClick={() => insertTag(v.tag)} />
                  ))}
                </Acts>
              </Acc>
              {insertedTagNotice && (
                <div className="kt-ok" role="status">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Check className="w-5 h-5 text-[#2E9E86] shrink-0" />
                    <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">
                      أُدرج <bdi dir="ltr">{insertedTagNotice}</bdi>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          <Head
            title="نص العقد"
            icon={FileText}
            action={canEdit ? <Act small tone="soft" icon={RotateCcw} label="الافتراضي" title="تعبئة الصيغة الافتراضية" onClick={handleRestoreDefault} /> : undefined}
          />
          <textarea
            ref={textareaRef}
            aria-label="نص قالب العقد"
            value={draftTemplate}
            readOnly={!canEdit}
            onChange={(e) => {
              setDraftTemplate(e.target.value);
              setCursorPos({
                start: e.target.selectionStart,
                end: e.target.selectionEnd,
              });
            }}
            onSelect={syncCursorPos}
            onClick={syncCursorPos}
            onKeyUp={syncCursorPos}
            rows={11}
            dir="rtl"
            className="kt-input kt-ta"
            placeholder="أدخل صيغة العقد لهذه الوحدة أو القسم"
          />

          <Head
            title="معاينة العميل"
            icon={ExternalLink}
            tone="jade"
            action={
              <Act
                small
                tone="jadeS"
                icon={ExternalLink}
                label="واتساب"
                title="تجربة الرسالة في واتساب"
                onClick={() => openExternalUrlSafely(`https://wa.me/?text=${encodeURIComponent(renderLivePreview())}`)}
              />
            }
          />
          <div className="kt-msg">{renderLivePreview()}</div>

          {/* البنود */}
          <Head title="البنود" icon={FileText} tone="sand" count={draftTerms.length} />
          {draftTerms.map((term, idx) => (
            <div key={idx} className="kt-bk">
              <div className="kt-bk-h">
                <span className="kt-row-t">
                  <span className="kt-row-n" style={{ whiteSpace: 'normal' }}>
                    {idx + 1}. {term}
                  </span>
                </span>
                {canEdit && <IconBtn icon={Trash2} tone="garn" label={`حذف البند ${idx + 1}`} onClick={() => setDraftTerms((prev) => prev.filter((_, i) => i !== idx))} />}
              </div>
            </div>
          ))}
          {draftTerms.length === 0 && <p className="kt-note">لا توجد بنود مخصصة حالياً.</p>}
          {canEdit && (
            <>
              <input
                type="text"
                aria-label="بند جديد"
                value={newTermText}
                onChange={(e) => setNewTermText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTerm();
                  }
                }}
                placeholder="بند أو شرط جديد"
                className="kt-input"
              />
              <Act tone="soft" icon={Plus} label="إضافة بند" onClick={handleAddTerm} />
            </>
          )}

          {canEdit && (
            <Act
              tone={savedNotice ? 'jade' : 'ink'}
              icon={savedNotice ? Check : Save}
              label={savedNotice ? 'تم الحفظ ✓' : 'حفظ القالب'}
              title={`حفظ قالب العقد (${mode === 'section' && section ? section.name : 'كامل العقار'})`}
              onClick={handleSave}
            />
          )}
        </div>
      )}
    </div>
  );
};
