import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Building2,
  Phone,
  Mail,
  Key,
  X,
  CreditCard,
  Briefcase,
  Wallet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Check,
} from 'lucide-react';
import { Sheet, Field, Acts, Act, Head, Tile, Tag } from '../ui/kit';
import { useApp } from '../../context/AppContext';

interface AddGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (guardId: string) => void;
}

export const AddGuardModal: React.FC<AddGuardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { properties, addGuard } = useApp();

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('حارس ومشرف ميداني');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('guard');
  const [nationalId, setNationalId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState<number>(3500);
  const [iban, setIban] = useState('SA');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80');
  const [assignedPropertyIds, setAssignedPropertyIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleProperty = (propId: string) => {
    setAssignedPropertyIds((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
    );
  };

  const handleSelectAllProperties = () => {
    if (assignedPropertyIds.length === properties.length) {
      setAssignedPropertyIds([]);
    } else {
      setAssignedPropertyIds(properties.map((p) => p.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم الحارس كاملاً');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('يرجى إدخال رقم جوال الحارس');
      return;
    }

    const assignedNames = properties
      .filter((p) => assignedPropertyIds.includes(p.id))
      .map((p) => p.name);

    const primaryId = assignedPropertyIds[0] || undefined;
    const primaryName = assignedNames[0] || undefined;

    const newGuard = addGuard({
      name: name.trim(),
      jobTitle: jobTitle.trim() || 'حارس ومشرف ميداني',
      phone: phone.trim(),
      email: email.trim() || `guard_${Date.now()}@amasa.app`,
      password: password.trim() || 'guard',
      nationalId: nationalId.trim() || '1000000000',
      startDate: startDate || new Date().toISOString().split('T')[0],
      salary: Number(salary) || 3500,
      iban: iban.trim(),
      avatar: avatar.trim(),
      assignedPropertyIds,
      assignedPropertyNames: assignedNames,
      assignedPropertyId: primaryId,
      assignedPropertyName: primaryName,
    });

    onClose();
    if (onSuccess) {
      onSuccess(newGuard.id);
    }
  };

  const allSelected = assignedPropertyIds.length === properties.length;

  return (
    <Sheet
      wide
      lockBackdrop
      title="إضافة حارس"
      icon={ShieldCheck}
      tone="sand"
      onClose={onClose}
      footer={
        <Acts cols={2}>
          <Act submit form="add-guard-form" tone="ink" icon={Plus} label="إضافة الحارس" title="تأكيد وإضافة الحارس الجديد" />
          <Act tone="line" icon={X} label="إلغاء" onClick={onClose} />
        </Acts>
      }
    >
      <form id="add-guard-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {errorMsg && (
          <div className="kt-err" role="alert">
            <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* الاستراحات المسندة — أساس ظهور النزلاء في لوحة الدخول والخروج */}
        <Head
          title="الاستراحات المسندة"
          icon={Building2}
          count={`${assignedPropertyIds.length}/${properties.length}`}
          action={
            <Act
              small
              tone="soft"
              label={allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
              title={allSelected ? 'إلغاء تحديد كل الاستراحات' : 'تحديد كل الاستراحات'}
              onClick={handleSelectAllProperties}
            />
          }
        />
        {properties.map((prop) => {
          const isSelected = assignedPropertyIds.includes(prop.id);
          return (
            <button
              key={prop.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleProperty(prop.id)}
              className={`kt-bk text-start cursor-pointer lx-press ${isSelected ? 'kt-on' : ''}`}
            >
              <div className="kt-bk-h">
                <Tile icon={Building2} tone={isSelected ? 'amy' : 'gray'} size={40} />
                <span className="kt-row-t">
                  <span className="kt-row-n">{prop.name}</span>
                  <span className="kt-row-s">{(prop.location || '').split(/[-/،,]/)[0].trim() || '—'}</span>
                </span>
                <Tag tone="gray" mono>
                  {prop.code}
                </Tag>
                <Tile icon={Check} tone={isSelected ? 'jade' : 'gray'} size={32} />
              </div>
            </button>
          );
        })}
        {assignedPropertyIds.length === 0 ? (
          <div className="kt-warn p-3 text-[13px] font-bold leading-6" style={{ color: '#7A4A06' }}>
            لم تُحدَّد أي استراحة بعد — حدّد واحدة أو أكثر ليرى الحارس نزلاءها.
          </div>
        ) : (
          <p className="kt-note" style={{ color: '#0E5A49', fontWeight: 800 }}>
            رُبط الحارس بـ {assignedPropertyIds.length} استراحة؛ يرى نزلاءها فقط.
          </p>
        )}

        {/* البيانات الشخصية والوظيفية */}
        <Head title="بيانات الحارس" icon={UserCheck} />
        <div className="kt-fields">
          <Field label="الاسم الكامل" hint="مطلوب" className="kt-wide">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أبو راشد"
              className="kt-input"
              required
            />
          </Field>
          <Field label="المسمى الوظيفي" className="kt-wide">
            <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="kt-input" />
          </Field>
          <Field label="الجوال (واتساب)" hint="مطلوب">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="kt-input kt-num"
              dir="ltr"
              required
            />
          </Field>
          <Field label="رقم الهوية">
            <input
              type="text"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="10xxxxxxxx"
              className="kt-input kt-num"
              dir="ltr"
            />
          </Field>
          <Field label="بريد الدخول" className="kt-wide">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guard@amasa.app"
              className="kt-input"
              dir="ltr"
            />
          </Field>
          <Field label="كلمة المرور">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="kt-input kt-num" dir="ltr" />
          </Field>
          <Field label="تاريخ المباشرة">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="kt-input" />
          </Field>
          <Field label="الراتب الشهري" className="kt-wide">
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="kt-input kt-num"
            />
          </Field>
          <Field label="الآيبان (IBAN)" hint="لتحويل الراتب" className="kt-wide">
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="SA..."
              className="kt-input"
              dir="ltr"
            />
          </Field>
        </div>
      </form>
    </Sheet>
  );
};
