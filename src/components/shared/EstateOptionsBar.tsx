import React from 'react';
import { Layers } from 'lucide-react';
import type { Property } from '../../types';
import type { EstateOption } from '../../lib/propertyUtils';
import { Head, Choice } from '../ui/kit';

interface Props {
  parent: Property;
  options: EstateOption[];
  selectedPropertyId: string;
  activeSectionId: string;
  onPick?: (o: EstateOption) => void;
}

/** شريط خيارات العقار المدمج: اختر الوحدة أو القسم أو الوحدة كاملة */
export const EstateOptionsBar: React.FC<Props> = ({ parent, options, selectedPropertyId, activeSectionId, onPick }) => {
  if (options.length === 0) return null;
  return (
    <section className="lux-card p-4 space-y-3">
      <Head title={`خيارات ${parent.name}`} icon={Layers} count={options.length} />
      <div className="kt-grid2">
        {options.map((o) => {
          const active = o.propertyId === selectedPropertyId && o.sectionId === activeSectionId;
          return (
            <Choice
              key={o.key}
              title={o.label}
              sub={`${o.weekday} / ${o.weekend}`}
              selected={active}
              onClick={() => onPick?.(o)}
            />
          );
        })}
      </div>
    </section>
  );
};
