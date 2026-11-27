import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SpecialAdminFeeBox, SpecialFeePeriod, SpecialFeeMode } from '../../types';
import { Head, Tag, Acts, Act, Infos, Info, Field, IconBtn } from '../ui/kit';

interface SpecialAdminFeesSectionProps {
  onOpenSpecialBookingModal?: (initialOwnerPrice?: number, initialFee?: number) => void;
}

const PERIOD_LABELS: Record<SpecialFeePeriod, string> = {
  weekday: 'وسط الأسبوع',
  weekend: 'الويكند (خميس-جمعة)',
  custom_dates: 'أيام محددة ومنفصلة',
  summer: 'الصيف',
  vacation: 'الإجازات المطولة',
  eid: 'الأعياد',
};

/** أسماء قصيرة لقوائم الاختيار (الاسم الكامل يبقى في PERIOD_LABELS) */
const PERIOD_SHORT: Record<SpecialFeePeriod, string> = {
  weekday: 'وسط الأسبوع',
  weekend: 'الويكند',
  custom_dates: 'أيام محددة',
  summer: 'الصيف',
  vacation: 'الإجازات',
  eid: 'الأعياد',
};

export const SpecialAdminFeesSection: React.FC<SpecialAdminFeesSectionProps> = ({
  onOpenSpecialBookingModal,
}) => {
  const {
    selectedProperty,
    specialAdminFeeBoxes,
    saveSpecialFeeBox,
    deleteSpecialFeeBox,
    isAdmin,
    canViewSupervisor,
  } = useApp();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Draft state for adding a new box
  const [draftName, setDraftName] = useState('رسوم (Supervisor)');
  const [draftMode, setDraftMode] = useState<SpecialFeeMode>('3_variables');
  const [draftPeriod, setDraftPeriod] = useState<SpecialFeePeriod>('weekday');
  const [draftOwnerPrice, setDraftOwnerPrice] = useState<string>('1000');
  const [draftSpecialFee, setDraftSpecialFee] = useState<string>('400');
  const [draftTotalPrice, setDraftTotalPrice] = useState<string>('1400');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Filter boxes for current property or global
  const propertyBoxes = specialAdminFeeBoxes.filter(
    (b) => b.propertyId === selectedProperty.id || b.propertyId === 'all'
  );

  // Visible only to Admin or promoted Supervisors with canViewSupervisor
  if (!isAdmin && !canViewSupervisor) {
    return null;
  }

  // Real-time calculation helpers for draft
  const handleDraftOwnerPriceChange = (valStr: string) => {
    setDraftOwnerPrice(valStr);
    const owner = Number(valStr) || 0;
    if (draftMode === '3_variables') {
      const total = Number(draftTotalPrice) || 0;
      if (total > 0 && total >= owner) {
        setDraftSpecialFee(String(total - owner));
      } else {
        const fee = Number(draftSpecialFee) || 0;
        setDraftTotalPrice(String(owner + fee));
      }
    } else {
      const fee = Number(draftSpecialFee) || 0;
      setDraftTotalPrice(String(owner + fee));
    }
  };

  const handleDraftSpecialFeeChange = (valStr: string) => {
    setDraftSpecialFee(valStr);
    const fee = Number(valStr) || 0;
    const owner = Number(draftOwnerPrice) || 0;
    setDraftTotalPrice(String(owner + fee));
  };

  const handleDraftTotalPriceChange = (valStr: string) => {
    setDraftTotalPrice(valStr);
    const total = Number(valStr) || 0;
    const owner = Number(draftOwnerPrice) || 0;
    if (total >= owner) {
      setDraftSpecialFee(String(total - owner));
    } else {
      setDraftSpecialFee('0');
      setDraftOwnerPrice(String(total));
    }
  };

  const handleSaveDraftBox = () => {
    const owner = Number(draftOwnerPrice) || 0;
    const fee = Number(draftSpecialFee) || 0;
    const total = Number(draftTotalPrice) || (owner + fee);

    const newBox: SpecialAdminFeeBox = {
      id: `sfb-${Date.now()}`,
      name: draftName.trim() || 'فرق السعر',
      propertyId: selectedProperty.id || 'all',
      mode: draftMode,
      period: draftPeriod,
      periodLabel: PERIOD_LABELS[draftPeriod],
      ownerPrice: owner,
      specialAdminFee: fee,
      totalSpecialPrice: total,
      isLocked: true,
      updatedAt: new Date().toISOString(),
    };

    saveSpecialFeeBox(newBox);
    setIsAddingNew(false);
    setFeedbackMsg(`✓ تم حفظ وقفل بوكس (${newBox.name}) بنجاح`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Editing existing box live
  const handleUpdateBoxValues = (
    box: SpecialAdminFeeBox,
    field: 'ownerPrice' | 'specialAdminFee' | 'totalSpecialPrice',
    val: number
  ) => {
    let newOwner = box.ownerPrice;
    let newFee = box.specialAdminFee;
    let newTotal = box.totalSpecialPrice;

    if (field === 'ownerPrice') {
      newOwner = Math.max(0, val);
      if (box.mode === '3_variables' && newTotal > 0 && newTotal >= newOwner) {
        newFee = Math.max(0, newTotal - newOwner);
      } else {
        newTotal = newOwner + newFee;
      }
    } else if (field === 'specialAdminFee') {
      newFee = Math.max(0, val);
      newTotal = newOwner + newFee;
    } else if (field === 'totalSpecialPrice') {
      newTotal = Math.max(0, val);
      if (newTotal >= newOwner) {
        newFee = Math.max(0, newTotal - newOwner);
      } else {
        newOwner = newTotal;
        newFee = 0;
      }
    }

    saveSpecialFeeBox({
      ...box,
      ownerPrice: newOwner,
      specialAdminFee: newFee,
      totalSpecialPrice: newTotal,
      periodLabel: PERIOD_LABELS[box.period] || box.periodLabel,
    });
  };

  const handleToggleLockBox = (box: SpecialAdminFeeBox) => {
    saveSpecialFeeBox({
      ...box,
      isLocked: !box.isLocked,
    });
  };

  const handleChangeBoxPeriod = (box: SpecialAdminFeeBox, period: SpecialFeePeriod) => {
    saveSpecialFeeBox({
      ...box,
      period,
      periodLabel: PERIOD_LABELS[period],
    });
  };

  const handleChangeBoxMode = (box: SpecialAdminFeeBox, mode: SpecialFeeMode) => {
    saveSpecialFeeBox({
      ...box,
      mode,
    });
  };

  // ترتيب الفترات في القوائم
  const periodsOrder: SpecialFeePeriod[] = [
    'weekday',
    'weekend',
    'custom_dates',
    'summer',
    'vacation',
    'eid',
  ];


  return (
    <section className="lux-card p-4 space-y-3.5 animate-in fade-in duration-200">
      <Head
        title="رسوم Supervisor"
        icon={Lock}
        tone="sand"
        count={propertyBoxes.length}
        action={
          <IconBtn
            icon={isExpanded ? ChevronUp : ChevronDown}
            label={isExpanded ? 'طيّ القسم' : 'فتح القسم'}
            onClick={() => setIsExpanded(!isExpanded)}
          />
        }
      />
      <p className="kt-note">للمشرف والإدارة فقط · غير مرئي للمسوقين</p>

      {feedbackMsg && (
        <div className="kt-ok animate-in fade-in" role="status">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{feedbackMsg.replace(/^✓\s*/, '')}</span>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-3">
          {/* البوكسات المضبوطة */}
          {propertyBoxes.map((box) => (
            <div key={box.id} className="kt-bk">
              <div className="kt-bk-h">
                <span className="kt-row-n">{box.name}</span>
                {box.isLocked && <Tag tone="amy">مقفل</Tag>}
                <IconBtn
                  icon={box.isLocked ? Lock : Unlock}
                  label={box.isLocked ? 'فتح القفل للتعديل' : 'قفل البوكس'}
                  onClick={() => handleToggleLockBox(box)}
                />
                {propertyBoxes.length > 1 && (
                  <IconBtn icon={Trash2} tone="garn" label={`حذف ${box.name}`} onClick={() => deleteSpecialFeeBox(box.id)} />
                )}
              </div>

              <div className="kt-fields">
                <Field label="المتغيرات">
                  <select
                    value={box.mode}
                    onChange={(e) => handleChangeBoxMode(box, e.target.value as SpecialFeeMode)}
                    disabled={box.isLocked}
                    className="kt-input"
                  >
                    <option value="3_variables">3 متغيرات</option>
                    <option value="2_variables">متغيران</option>
                  </select>
                </Field>
                <Field label="الفترة">
                  <select
                    value={box.period}
                    onChange={(e) => handleChangeBoxPeriod(box, e.target.value as SpecialFeePeriod)}
                    disabled={box.isLocked}
                    className="kt-input"
                  >
                    {periodsOrder.map((k) => (
                      <option key={k} value={k}>
                        {PERIOD_SHORT[k]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className={box.mode === '3_variables' ? 'kt-f3' : 'kt-g2'}>
                <Field label="سعر المالك">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    disabled={box.isLocked}
                    value={box.ownerPrice}
                    onChange={(e) => handleUpdateBoxValues(box, 'ownerPrice', Number(e.target.value))}
                    className="kt-input kt-num"
                  />
                </Field>
                <Field label="الرسوم">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    disabled={box.isLocked}
                    value={box.specialAdminFee}
                    onChange={(e) => handleUpdateBoxValues(box, 'specialAdminFee', Number(e.target.value))}
                    className="kt-input kt-num"
                    style={{ color: '#B8435E' }}
                  />
                </Field>
                {box.mode === '3_variables' && (
                  <Field label="سعر المشرف">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      disabled={box.isLocked}
                      value={box.totalSpecialPrice}
                      onChange={(e) => handleUpdateBoxValues(box, 'totalSpecialPrice', Number(e.target.value))}
                      className="kt-input kt-num"
                      style={{ background: '#E9F7F2', color: '#0E5A49', boxShadow: 'inset 0 0 0 1px rgba(46,158,134,.55)' }}
                    />
                  </Field>
                )}
              </div>

              <Infos cols={1}>
                <Info hi label="المعادلة" value={`${box.ownerPrice} + ${box.specialAdminFee} = ${box.totalSpecialPrice} ر.س`} />
              </Infos>

              <Acts cols={2}>
                <Act
                  tone="soft"
                  icon={RefreshCw}
                  label="تحديث"
                  onClick={() => {
                    setFeedbackMsg(`تم تحديث بيانات ${box.name}`);
                    setTimeout(() => setFeedbackMsg(null), 2500);
                  }}
                />
                {onOpenSpecialBookingModal && (
                  <Act
                    tone="ink"
                    icon={ShieldCheck}
                    label="حجز بهذه القيم"
                    onClick={() => onOpenSpecialBookingModal(box.ownerPrice, box.specialAdminFee)}
                  />
                )}
              </Acts>
            </div>
          ))}

          {/* نموذج بوكس جديد */}
          {isAddingNew ? (
            <div className="kt-sub kt-sub-on animate-in slide-in-from-top-2 duration-200">
              <Head title="بوكس جديد" icon={Plus} tone="amy" />
              <div className="kt-fields">
                <Field label="اسم البوكس" className="kt-wide">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="مثال: فرق السعر"
                    className="kt-input"
                  />
                </Field>
                <Field label="المتغيرات">
                  <select value={draftMode} onChange={(e) => setDraftMode(e.target.value as SpecialFeeMode)} className="kt-input">
                    <option value="3_variables">3 متغيرات</option>
                    <option value="2_variables">متغيران</option>
                  </select>
                </Field>
                <Field label="الفترة">
                  <select value={draftPeriod} onChange={(e) => setDraftPeriod(e.target.value as SpecialFeePeriod)} className="kt-input">
                    {periodsOrder.map((k) => (
                      <option key={k} value={k}>
                        {PERIOD_SHORT[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="سعر المالك">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={draftOwnerPrice}
                    onChange={(e) => handleDraftOwnerPriceChange(e.target.value)}
                    className="kt-input"
                  />
                </Field>
                <Field label="رسوم Supervisor">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={draftSpecialFee}
                    onChange={(e) => handleDraftSpecialFeeChange(e.target.value)}
                    className="kt-input"
                  />
                </Field>
                {draftMode === '3_variables' && (
                  <Field label="السعر الظاهر للمشرف" className="kt-wide">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={draftTotalPrice}
                      onChange={(e) => handleDraftTotalPriceChange(e.target.value)}
                      className="kt-input"
                    />
                  </Field>
                )}
              </div>
              <p className="kt-note">المالك + الرسوم = السعر الظاهر للمشرف (يُحسب تلقائياً).</p>
              <Acts cols={2}>
                <Act tone="soft" label="إلغاء" onClick={() => setIsAddingNew(false)} />
                <Act tone="ink" icon={Lock} label="حفظ وقفل" onClick={handleSaveDraftBox} />
              </Acts>
            </div>
          ) : (
            <Act tone="line" className="kt-dash" icon={Plus} label="إضافة رسوم جديدة" onClick={() => setIsAddingNew(true)} />
          )}
        </div>
      )}
    </section>
  );
};
