import React from 'react';
import { Layers } from 'lucide-react';
import type { Property, EstatePartRef } from '../../types';
import { partKey } from '../../lib/propertyUtils';
import { Head, Choice, Info } from '../ui/kit';

interface Props {
  estate: Property;
  units: Property[]; // الوحدات المدمجة بالترتيب
  allParts: EstatePartRef[];
  selectedParts: EstatePartRef[];
  onChange: (keys: string[]) => void;
  summary: string;
  priceText: string;
}

/** احجز {العقار}: الافتراضي كل الأجزاء، ويمكن إلغاء قسم أو وحدة */
export const EstateBookingBuilder: React.FC<Props> = ({ estate, units, allParts, selectedParts, onChange, summary, priceText }) => {
  const selectedKeys = selectedParts.map(partKey);
  const fixedUnits = units.filter((u) => (u.sections || []).length < 2 && allParts.some((p) => p.propertyId === u.id));
  const sectionedUnits = units.filter((u) => (u.sections || []).length >= 2 && allParts.some((p) => p.propertyId === u.id));
  const fixedKeys = fixedUnits.flatMap((u) => allParts.filter((p) => p.propertyId === u.id).map(partKey));

  // الكوخ ثابت دائماً؛ الترف: قسم واحد أو القسمين معاً
  const pick = (u: Property, secIds: string[] | 'all') => {
    const unitKeys = allParts.filter((p) => p.propertyId === u.id);
    const chosen = secIds === 'all' ? unitKeys : unitKeys.filter((p) => secIds.includes(p.sectionId));
    const otherSectioned = sectionedUnits
      .filter((x) => x.id !== u.id)
      .flatMap((x) => allParts.filter((p) => p.propertyId === x.id).map(partKey))
      .filter((k) => selectedKeys.includes(k));
    onChange([...fixedKeys, ...otherSectioned, ...chosen.map(partKey)]);
  };

  return (
    <section className="lux-card p-4 space-y-3">
      <Head title={`احجز ${estate.name}`} icon={Layers} count="عقار" />

      <div className="space-y-2">
        {fixedUnits.map((u) => (
          <Choice key={u.id} title={u.name} sub="ثابت في كل الحجوزات" tag="ثابت" selected onClick={() => {}} />
        ))}

        {sectionedUnits.map((u) => {
          const unitParts = allParts.filter((p) => p.propertyId === u.id);
          const chosen = unitParts.filter((p) => selectedKeys.includes(partKey(p)));
          const bothOn = chosen.length === unitParts.length;
          return (
            <div key={u.id} className="space-y-2">
              <div className="kt-grid2">
                {unitParts.map((p) => {
                  const sec = (u.sections || []).find((x) => x.id === p.sectionId);
                  const on = !bothOn && chosen.length === 1 && chosen[0].sectionId === p.sectionId;
                  return (
                    <Choice
                      key={partKey(p)}
                      title={`${u.name} – ${sec?.name || p.sectionId}`}
                      selected={on}
                      onClick={() => pick(u, [p.sectionId])}
                    />
                  );
                })}
              </div>
              <Choice
                title={`${u.name} – القسمان معاً`}
                tag="كامل"
                selected={bothOn}
                onClick={() => pick(u, 'all')}
              />
            </div>
          );
        })}
      </div>

      <div className="kt-g2">
        <div className="kt-info" style={{ gridColumn: '1 / -1' }}>
          <span className="kt-info-l">المحجوز باسم {estate.name}</span>
          <span className="kt-info-v" style={{ whiteSpace: 'normal' }}>{summary}</span>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Info label="سعر الليلة" value={priceText.replace(/^ليلة\s*/, '')} ltr hi />
        </div>
      </div>
    </section>
  );
};
