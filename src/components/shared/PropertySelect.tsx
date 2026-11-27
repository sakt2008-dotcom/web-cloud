import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Tile } from '../ui/kit';

interface Props {
  properties: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  allLabel?: string; // إن وُجد تظهر خيار "الكل" بقيمة ''
}

/** قائمة اختيار العقار الموحّدة: بلاطة + عنوان صغير + الاسم، والقائمة الأصلية شفافة فوقها */
export const PropertySelect: React.FC<Props> = ({ properties, value, onChange, label = 'العقار', allLabel }) => {
  const current = value ? properties.find((p) => p.id === value)?.name : allLabel;
  return (
    <div className="kt-select">
      <Tile icon={Building2} tone="amy" size={42} />
      <span className="kt-select-t">
        <span className="kt-select-l">{label.replace(/:\s*$/, '')}</span>
        <span className="kt-select-v">{current || '—'}</span>
      </span>
      <ChevronDown size={20} strokeWidth={1.8} aria-hidden="true" />
      <select aria-label={label.replace(/:\s*$/, '')} value={value} onChange={(e) => onChange(e.target.value)}>
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
};
