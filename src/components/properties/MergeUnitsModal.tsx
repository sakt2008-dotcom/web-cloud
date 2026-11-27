import React, { useState, useMemo } from 'react';
import {
  GitMerge,
  X,
  CheckCircle2,
  CalendarDays,
  Link2,
  DollarSign,
  ShieldCheck,
  Building2,
  Sparkles,
  Layers,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Property } from '../../types';
import { Sheet, Field, Acts, Act, Infos, Info, Head, Row, Face, Tag, Tile } from '../ui/kit';
import { fmtN } from '../../lib/format';

interface MergeUnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newMergedUnit: Property) => void;
}

export const MergeUnitsModal: React.FC<MergeUnitsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { properties, addProperty, setSelectedPropertyId } = useApp();

  // List of candidate units (exclude units that are already merged)
  const availableUnits = useMemo(() => {
    return properties.filter((p) => !p.isMergedProperty);
  }, [properties]);

  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [mergedName, setMergedName] = useState('');
  const [mergedCode, setMergedCode] = useState(() => `#MG-${Math.floor(1000 + Math.random() * 9000)}`);
  const [customWeekdayPrice, setCustomWeekdayPrice] = useState<number | ''>('');
  const [customWeekendPrice, setCustomWeekendPrice] = useState<number | ''>('');
  const [customDeposit, setCustomDeposit] = useState<number>(300);
  const [customInsurance, setCustomInsurance] = useState<number>(500);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Computed data from selected units
  const selectedUnits = useMemo(() => {
    return availableUnits.filter((u) => selectedUnitIds.includes(u.id));
  }, [availableUnits, selectedUnitIds]);

  const autoWeekdayPrice = useMemo(() => {
    // سعر الوحدة = مجموع أسعار أقسامها إن كان لها قسمان فأكثر
    return selectedUnits.reduce((acc, u) => {
      const secs = u.sections || [];
      return acc + (secs.length >= 2 ? secs.reduce((a, x) => a + (Number(x.priceWeekday) || 0), 0) : u.basePriceWeekday || 0);
    }, 0);
  }, [selectedUnits]);

  const autoWeekendPrice = useMemo(() => {
    return selectedUnits.reduce((acc, u) => {
      const secs = u.sections || [];
      return acc + (secs.length >= 2 ? secs.reduce((a, x) => a + (Number(x.priceWeekend) || 0), 0) : u.basePriceWeekend || 0);
    }, 0);
  }, [selectedUnits]);

  const autoCapacity = useMemo(() => {
    return selectedUnits.reduce((acc, u) => acc + (u.capacity || 20), 0);
  }, [selectedUnits]);

  // Handle toggling unit selection
  const handleToggleUnit = (unitId: string) => {
    setErrorMsg(null);
    let nextIds: string[];
    if (selectedUnitIds.includes(unitId)) {
      nextIds = selectedUnitIds.filter((id) => id !== unitId);
    } else {
      nextIds = [...selectedUnitIds, unitId];
    }
    setSelectedUnitIds(nextIds);

    const chosen = availableUnits.filter((u) => nextIds.includes(u.id));
    if (chosen.length >= 2) {
      const sumWd = chosen.reduce((acc, c) => acc + (c.basePriceWeekday || 0), 0);
      const sumWe = chosen.reduce((acc, c) => acc + (c.basePriceWeekend || 0), 0);
      setCustomWeekdayPrice(sumWd);
      setCustomWeekendPrice(sumWe);
      setCustomDeposit(Math.max(...chosen.map((c) => c.defaultDeposit || 300)));
      setCustomInsurance(Math.max(...chosen.map((c) => c.insuranceAmount || 500)));
    }
  };

  const handleConfirmMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnitIds.length < 2) {
      setErrorMsg('يجب اختيار وحدتين (استراحتين) على الأقل للدمج');
      return;
    }
    if (!mergedName.trim() || mergedName.trim().startsWith('دمج (')) {
      setErrorMsg('يجب تسمية العقار المدمج باسم خاص به (مثل: المزرعة)');
      return;
    }

    const unit1 = selectedUnits[0];
    const unit2 = selectedUnits[1];

    const finalWeekdayPrice = autoWeekdayPrice || 2000;
    const finalWeekendPrice = autoWeekendPrice || 2800;

    const mergedUnitData: Partial<Property> & { name: string; basePriceWeekday: number } = {
      name: mergedName.trim(),
      code: mergedCode,
      subtitle: `عقار مدمج شامل: (${selectedUnits.map((u) => u.name).join(' + ')})`,
      location: unit1.location || 'الرياض',
      coordinates: unit1.coordinates,
      isPublished: true,
      subUnitsCount: selectedUnits.length,
      capacity: autoCapacity,
      bedrooms: selectedUnits.reduce((acc, u) => acc + (u.bedrooms || 2), 0),
      bathrooms: selectedUnits.reduce((acc, u) => acc + (u.bathrooms || 2), 0),
      areaM2: selectedUnits.reduce((acc, u) => acc + (u.areaM2 || 400), 0),
      poolType: 'مسابح متعددة مدمجة مع مرافق ترفيهية متكاملة',
      basePriceWeekday: finalWeekdayPrice,
      basePriceWeekend: finalWeekendPrice,
      defaultDeposit: customDeposit,
      insuranceAmount: customInsurance,
      coverImage: unit1.coverImage || unit2?.coverImage || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
      images: [
        ...(unit1.images || []),
        ...(unit2?.images || []),
      ].slice(0, 8),
      features: [
        `دمج كامل بين استراحات: ${selectedUnits.map((u) => u.name).join(' و ')}`,
        'ربط تقويمي فوري وتزامن الإتاحة آلياً',
        'مجالس ضيافة متعددة ومسابح وجلسات خارجية فسيحة',
        'خصوصية تامة لجميع الأقسام والوحدات المدمجة',
      ],
      // Merged Configuration & Strict Calendar Linkage
      isMergedProperty: true,
      mergedPropertyIds: selectedUnitIds,
      mergedConfig: {
        isMerged: true,
        mergeType: 'linked_properties',
        linkedPropertyIds: selectedUnitIds,
        linkedPropertyNames: selectedUnits.map((u) => u.name),
        requireBothAvailable: true,
      },
      contractTerms: [
        `هذا العقد يشمل العقار المدمج بالكامل (${selectedUnits.map((u) => u.name).join(' + ')}).`,
        'يلتزم المستأجر بالمحافظة على جميع مرافق الوحدتين المدمجتين.',
        'يُعاد مبلغ التأمين كاملاً بعد فحص الوحدتين والتأكد من سلامتهما.',
      ],
      notes: notes.trim(),
    };

    const createdProp = addProperty(mergedUnitData);
    setSelectedPropertyId(createdProp.id);

    setSuccessMsg('✓ تم إنشاء العقار المدمج بنجاح وتفعيل ربط التقويم التلقائي بين الوحدات!');
    if (onSuccess) {
      onSuccess(createdProp);
    }
    setTimeout(() => {
      onClose();
      setSuccessMsg(null);
    }, 1500);
  };

  if (!isOpen) return null;

  const canSubmit = selectedUnitIds.length >= 2 && Boolean(mergedName.trim());

  return (
    <Sheet
      wide
      lockBackdrop
      title="دمج وحدتين"
      icon={GitMerge}
      tone="amy"
      onClose={onClose}
      footer={
        <Acts cols={2}>
          <Act
            submit
            form="merge-form"
            tone="ink"
            icon={GitMerge}
            label="دمج وإنشاء"
            title="تأكيد دمج الوحدتين وإنشاء العقار المدمج"
            disabled={!canSubmit}
          />
          <Act tone="line" icon={X} label="إلغاء" onClick={onClose} />
        </Acts>
      }
    >
      <form id="merge-form" onSubmit={handleConfirmMerge} className="flex flex-col gap-3">
        <p className="kt-note">سمِّ العقار المدمج، واختر الاستراحات؛ ويُربط التقويم بينها تلقائياً.</p>

        {errorMsg && (
          <div className="kt-err" role="alert">
            <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="kt-ok" role="status">
            <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
              <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
              <span>{successMsg}</span>
            </span>
          </div>
        )}

        {/* 1) الاسم والكود */}
        <div className="kt-fields">
          <Field label="اسم العقار المدمج" hint="مطلوب" className="kt-wide">
            <input
              type="text"
              required
              placeholder="مثال: المزرعة"
              value={mergedName}
              onChange={(e) => setMergedName(e.target.value)}
              className="kt-input"
            />
          </Field>
          <Field label="الكود" className="kt-wide">
            <input type="text" dir="ltr" value={mergedCode} onChange={(e) => setMergedCode(e.target.value)} className="kt-input kt-num" />
          </Field>
        </div>

        {/* 2) الوحدات */}
        <Head title="الوحدات المراد دمجها" icon={Layers} count={`${selectedUnitIds.length}/${availableUnits.length}`} />
        {selectedUnitIds.length < 2 && <p className="kt-note">اختر وحدتين على الأقل.</p>}
        {availableUnits.map((u) => {
          const isSelected = selectedUnitIds.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleToggleUnit(u.id)}
              className={`kt-bk text-start cursor-pointer lx-press ${isSelected ? 'kt-on' : ''}`}
            >
              <div className="kt-bk-h">
                <Face src={u.coverImage} name={u.name} size={44} square />
                <span className="kt-row-t">
                  <span className="kt-row-n">{u.name}</span>
                  <span className="kt-row-s">سعة {fmtN(u.capacity || 20)}</span>
                </span>
                <Tag tone="gray" mono>
                  {fmtN(u.basePriceWeekday)} ر.س
                </Tag>
                <Tile icon={Check} tone={isSelected ? 'jade' : 'gray'} size={32} />
              </div>
            </button>
          );
        })}

        {/* 3) التسعير المدمج */}
        {selectedUnitIds.length >= 2 && (
          <div className="kt-sub">
            <p className="kt-sub-t">السعر = مجموع أسعار الوحدات</p>
            <Infos cols={2}>
              <Info hi label="وسط الأسبوع" value={`${fmtN(autoWeekdayPrice)} ر.س`} />
              <Info hi label="الويكند" value={`${fmtN(autoWeekendPrice)} ر.س`} />
            </Infos>
            <div className="kt-fields">
              <Field label="العربون">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={customDeposit}
                  onChange={(e) => setCustomDeposit(Math.max(0, Number(e.target.value)))}
                  className="kt-input kt-num"
                />
              </Field>
              <Field label="مبلغ التأمين">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={customInsurance}
                  onChange={(e) => setCustomInsurance(Math.max(0, Number(e.target.value)))}
                  className="kt-input kt-num"
                />
              </Field>
            </div>
          </div>
        )}

        {/* ربط التقويم التلقائي */}
        <Head title="ربط التقويم التلقائي" icon={Link2} />
        <Row icon={Link2} tone="amy" title="حجز الوحدة الأولى" sub="يُقفل العقار المدمج تلقائياً" />
        <Row icon={Link2} tone="amy" title="حجز الوحدة الثانية" sub="يُقفل العقار المدمج تلقائياً" />
        <Row icon={Link2} tone="jade" title="حجز العقار المدمج" sub="يُقفل تقويم الوحدتين معاً" />
      </form>
    </Sheet>
  );
};
