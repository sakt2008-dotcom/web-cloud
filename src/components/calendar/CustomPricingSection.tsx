import React, { useState } from 'react';
import { Plus, Trash2, CalendarDays, Save } from 'lucide-react';
import { Head, Act, Row, Field } from '../ui/kit';
import { useApp } from '../../context/AppContext';
import { CustomPricingPeriod } from '../../types';

export const CustomPricingSection: React.FC = () => {
  const { selectedProperty, updatePropertyCustomPricingPeriods, isAdmin, canViewCalendar } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [weekday, setWeekday] = useState('');
  const [weekend, setWeekend] = useState('');

  if (!isAdmin && !canViewCalendar) return null;

  const handleAdd = () => {
    const newPeriod: CustomPricingPeriod = {
      id: `cp-${Date.now()}`,
      name,
      startDate,
      endDate,
      basePriceWeekday: Number(weekday),
      basePriceWeekend: Number(weekend),
    };
    const updated = [...(selectedProperty.customPricingPeriods || []), newPeriod];
    updatePropertyCustomPricingPeriods(selectedProperty.id, updated);
    setIsAdding(false);
    setName('');
    setStartDate('');
    setEndDate('');
    setWeekday('');
    setWeekend('');
  };

  const handleDelete = (id: string) => {
    const updated = (selectedProperty.customPricingPeriods || []).filter(p => p.id !== id);
    updatePropertyCustomPricingPeriods(selectedProperty.id, updated);
  };

  const periods = selectedProperty.customPricingPeriods || [];

  return (
    <div className="kt-sub" dir="rtl">
      <Head
        title="مواسم التسعير"
        icon={CalendarDays}
        tone="saph"
        count={periods.length > 0 ? periods.length : undefined}
        action={
          isAdding ? (
            <Act small tone="line" label="إلغاء" onClick={() => setIsAdding(false)} />
          ) : (
            <Act small tone="ink" icon={Plus} label="موسم" title="إضافة موسم تسعير جديد" onClick={() => setIsAdding(true)} />
          )
        }
      />

      {isAdding && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <Field label="اسم الموسم">
            <input
              className="kt-input"
              placeholder="مثل: صيف 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="kt-fields">
            <Field label="من تاريخ">
              <input type="date" className="kt-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="إلى تاريخ">
              <input type="date" className="kt-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="وسط الأسبوع">
              <input
                type="number"
                inputMode="numeric"
                className="kt-input kt-num"
                placeholder="ر.س"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
              />
            </Field>
            <Field label="الويكند">
              <input
                type="number"
                inputMode="numeric"
                className="kt-input kt-num"
                placeholder="ر.س"
                value={weekend}
                onChange={(e) => setWeekend(e.target.value)}
              />
            </Field>
          </div>
          <Act tone="ink" icon={Save} label="حفظ الموسم" onClick={handleAdd} />
        </div>
      )}

      {periods.length > 0 ? (
        <div className="space-y-2">
          {periods.map((p) => (
            <Row
              key={p.id}
              icon={CalendarDays}
              tone="saph"
              title={p.name || 'موسم بدون اسم'}
              sub={`${p.startDate} ← ${p.endDate} · ${p.basePriceWeekday}/${p.basePriceWeekend}`}
              end={<Act small tone="garnS" icon={Trash2} label="حذف" title="حذف الموسم" onClick={() => handleDelete(p.id)} />}
            />
          ))}
        </div>
      ) : (
        !isAdding && <p className="kt-note text-center">لا توجد مواسم مخصصة بعد.</p>
      )}
    </div>
  );
};
