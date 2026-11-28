import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Building2, Check, Layers, X } from 'lucide-react';
import { Sheet, Field, Acts, Act, Head, Choice, Switch } from '../ui/kit';
import { Property } from '../../types';
import {
  resolvePropertyHasSections,
  TransferMode,
  TransferUnitOrSectionParams,
} from '../../lib/propertyUtils';

interface TransferUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  initialSourcePropertyId: string;
  initialSourceSectionId?: string;
  onExecuteTransfer: (params: TransferUnitOrSectionParams) => {
    success: boolean;
    message: string;
    createdOrTargetPropertyId?: string;
  };
}

export const TransferUnitModal: React.FC<TransferUnitModalProps> = ({
  isOpen,
  onClose,
  properties,
  initialSourcePropertyId,
  initialSourceSectionId,
  onExecuteTransfer,
}) => {
  const [sourcePropertyId, setSourcePropertyId] = useState(initialSourcePropertyId);
  const [sourceSectionId, setSourceSectionId] = useState(initialSourceSectionId || '');
  const [mode, setMode] = useState<TransferMode>(
    initialSourceSectionId ? 'section_to_property' : 'unit_to_property_section'
  );
  const [targetPropertyId, setTargetPropertyId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [newName, setNewName] = useState('');
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [moveAllSourceSections, setMoveAllSourceSections] = useState(false);
  const [transferBookings, setTransferBookings] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sourceProperty = useMemo(
    () => properties.find((p) => p.id === sourcePropertyId) || properties[0],
    [properties, sourcePropertyId]
  );

  const sourceSections = useMemo(
    () => (resolvePropertyHasSections(sourceProperty || {}) ? sourceProperty?.sections || [] : []),
    [sourceProperty]
  );

  const otherProperties = useMemo(
    () => properties.filter((p) => p.id !== sourceProperty?.id),
    [properties, sourceProperty?.id]
  );

  const targetProperty = useMemo(
    () => properties.find((p) => p.id === targetPropertyId),
    [properties, targetPropertyId]
  );

  useEffect(() => {
    if (!isOpen) return;
    setSourcePropertyId(initialSourcePropertyId);
    setSourceSectionId(initialSourceSectionId || '');
    const initialMode: TransferMode = initialSourceSectionId
      ? 'section_to_property'
      : 'unit_to_property_section';
    setMode(initialMode);
    const firstOther = properties.find((p) => p.id !== initialSourcePropertyId);
    setTargetPropertyId(firstOther?.id || '');
    setTargetSectionId('');
    setNewName('');
    setKeepOriginal(false);
    setMoveAllSourceSections(false);
    setTransferBookings(true);
    setErrorMsg(null);
  }, [isOpen, initialSourcePropertyId, initialSourceSectionId, properties]);

  if (!isOpen || !sourceProperty) return null;

  const isSectionMode = mode === 'section_to_property' || mode === 'section_to_standalone';
  const effectiveSourceSectionId =
    sourceSectionId || (sourceSections.length > 0 ? sourceSections[0].id : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isSectionMode && !effectiveSourceSectionId) {
      setErrorMsg('هذه الوحدة لا تحتوي على أقسام لنقلها. اختر وضع "نقل الوحدة" أو أضف قسماً أولاً.');
      return;
    }

    if (mode !== 'section_to_standalone' && !targetPropertyId) {
      setErrorMsg('يرجى اختيار العقار الوجهة المستهدف.');
      return;
    }

    if (
      mode !== 'section_to_standalone' &&
      targetProperty &&
      (targetProperty.location || '').trim() !== (sourceProperty.location || '').trim()
    ) {
      setErrorMsg('لا يمكن النقل إلى عقار في موقع مختلف؛ وحدات العقار الواحد في موقع واحد.');
      return;
    }

    const res = onExecuteTransfer({
      mode,
      sourcePropertyId: sourceProperty.id,
      sourceSectionId:
        isSectionMode || (mode === 'unit_to_unit' && sourceSectionId)
          ? effectiveSourceSectionId || undefined
          : undefined,
      targetPropertyId: mode === 'section_to_standalone' ? undefined : targetPropertyId,
      targetSectionId: mode === 'unit_to_unit' && targetSectionId ? targetSectionId : undefined,
      newName: newName.trim() || undefined,
      keepOriginal,
      moveAllSourceSections,
      transferBookings,
    });

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    onClose();
  };

  const MODES: { id: TransferMode; title: string; sub: string }[] = [
    { id: 'section_to_property', title: 'نقل قسم لعقار آخر', sub: 'يصبح قسماً داخل عقار آخر' },
    { id: 'section_to_standalone', title: 'فصل قسم كوحدة مستقلة', sub: 'يتحول لعقار منفصل بالكامل' },
    { id: 'unit_to_property_section', title: 'نقل وحدة داخل عقار', sub: 'تُدمج كقسم داخل عقار آخر' },
    { id: 'unit_to_unit', title: 'نقل وحدة لوحدة', sub: 'تنتقل المواصفات والأسعار والعقد' },
  ];

  return (
    <Sheet
      wide
      lockBackdrop
      title="نقل وحدة أو قسم"
      icon={ArrowLeftRight}
      tone="amy"
      onClose={onClose}
      footer={
        <Acts cols={2}>
          <Act submit form="transfer-form" tone="ink" icon={Check} label="تنفيذ النقل" title="تنفيذ النقل الآن" />
          <Act tone="line" icon={X} label="إلغاء" onClick={onClose} />
        </Acts>
      }
    >
      <form id="transfer-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {errorMsg && (
          <div className="kt-err" role="alert">
            <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. المصدر */}
        <Head title="المصدر" icon={Layers} />
        <Field label="العقار / الوحدة">
          <select
            value={sourceProperty.id}
            onChange={(e) => {
              const nextSrcId = e.target.value;
              setSourcePropertyId(nextSrcId);
              const nextSrcProp = properties.find((p) => p.id === nextSrcId);
              const nextSecs = nextSrcProp?.sections || [];
              setSourceSectionId(nextSecs[0]?.id || '');
              if (targetPropertyId === nextSrcId) {
                const alt = properties.find((p) => p.id !== nextSrcId);
                setTargetPropertyId(alt?.id || '');
              }
            }}
            className="kt-input"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </Field>

        {(sourceSections.length > 0 || isSectionMode) && (
          <Field label="القسم المصدر">
            <select
              value={mode === 'unit_to_property_section' ? '' : effectiveSourceSectionId}
              onChange={(e) => {
                const val = e.target.value;
                setSourceSectionId(val);
                if (val && mode === 'unit_to_property_section') {
                  setMode('section_to_property');
                }
              }}
              disabled={mode === 'unit_to_property_section'}
              className="kt-input disabled:opacity-60"
            >
              {mode === 'unit_to_property_section' ? (
                <option value="">كامل الوحدة ({sourceProperty.name})</option>
              ) : sourceSections.length > 0 ? (
                sourceSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.priceWeekday} ر.س)
                  </option>
                ))
              ) : (
                <option value="">لا توجد أقسام فرعية</option>
              )}
            </select>
          </Field>
        )}

        {/* 2. طريقة النقل */}
        <Head title="طريقة النقل" icon={ArrowLeftRight} />
        {MODES.map((m) => (
          <Choice key={m.id} title={m.title} sub={m.sub} selected={mode === m.id} onClick={() => setMode(m.id)} />
        ))}

        {/* 3. الوجهة والخيارات */}
        <Head title="الوجهة والخيارات" icon={Building2} />
        {mode !== 'section_to_standalone' && (
          <Field label="العقار الوجهة">
            <select
              value={targetPropertyId}
              onChange={(e) => {
                setTargetPropertyId(e.target.value);
                setTargetSectionId('');
              }}
              className="kt-input"
            >
              <option value="">— اختر العقار —</option>
              {(mode === 'unit_to_unit' ? properties : otherProperties).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </Field>
        )}

        {mode === 'unit_to_unit' && targetProperty && targetProperty.sections && targetProperty.sections.length > 0 && (
          <Field label="القسم المستهدف" hint="اختياري">
            <select value={targetSectionId} onChange={(e) => setTargetSectionId(e.target.value)} className="kt-input">
              <option value="">كامل الوحدة ({targetProperty.name})</option>
              {targetProperty.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="الاسم في الوجهة" hint="اختياري">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اتركه فارغاً للاحتفاظ بالاسم"
            className="kt-input"
          />
        </Field>

        <div className="kt-sub">
          {mode === 'unit_to_property_section' && sourceSections.length > 0 && (
            <div className="kt-opt">
              <span>نقل كل أقسام الوحدة</span>
              <Switch on={moveAllSourceSections} onChange={setMoveAllSourceSections} label={`نقل كافة أقسام ${sourceProperty.name} كأقسام مستقلة داخل الوجهة`} />
            </div>
          )}
          <div className="kt-opt">
            <span>إبقاء النسخة الأصلية</span>
            <Switch on={keepOriginal} onChange={setKeepOriginal} label="الإبقاء على النسخة الأصلية في المصدر" />
          </div>
          <div className="kt-opt">
            <span>نقل الحجوزات تلقائياً</span>
            <Switch on={transferBookings} onChange={setTransferBookings} label="نقل الحجوزات المرتبطة إلى الوجهة" />
          </div>
        </div>
      </form>
    </Sheet>
  );
};
