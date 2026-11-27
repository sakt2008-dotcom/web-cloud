import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, UserPlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { Act, Acts, Field, Seg, Sheet } from '../ui/kit';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  defaultRole = 'marketer',
}) => {
  const { addMemberByEmail } = useApp();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const emailClean = email.trim().toLowerCase();
    if (!emailClean || !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(emailClean)) {
      setFeedback({ ok: false, msg: 'أدخل بريد Google صحيحاً مثل user@gmail.com' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addMemberByEmail(emailClean, role, name.trim());
      if (res.success) {
        setFeedback({ ok: true, msg: res.message });
        setTimeout(() => {
          setEmail('');
          setName('');
          setFeedback(null);
          onClose();
        }, 1500);
      } else {
        setFeedback({ ok: false, msg: res.message });
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err?.message || 'تعذرت إضافة العضو' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      title="إضافة عضو"
      icon={UserPlus}
      tone="amy"
      onClose={onClose}
      lockBackdrop
      footer={
        <Acts cols={2}>
          <Act
            submit
            form="add-member-form"
            tone="ink"
            icon={isSubmitting ? Loader2 : CheckCircle2}
            label={isSubmitting ? 'جاري الإضافة…' : 'إضافة العضو'}
            title="إضافة العضو وتفعيل حسابه"
            disabled={isSubmitting}
          />
          <Act tone="line" icon={X} label="إلغاء" onClick={onClose} />
        </Acts>
      }
    >
      <form id="add-member-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {feedback && (
          <div className={feedback.ok ? 'kt-ok' : 'kt-err'} role={feedback.ok ? 'status' : 'alert'}>
            {feedback.ok ? (
              <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{feedback.msg}</span>
              </span>
            ) : (
              <>
                <AlertCircle size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{feedback.msg}</span>
              </>
            )}
          </div>
        )}

        <Field label="بريد Google" hint="مطلوب">
          <input
            type="email"
            dir="ltr"
            required
            className="kt-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@gmail.com"
          />
        </Field>

        <Field label="الاسم" hint="اختياري">
          <input
            type="text"
            className="kt-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: نورة الشمري"
          />
        </Field>

        <div className="kt-field">
          <span className="kt-field-h">
            <span>الدور والصلاحية</span>
          </span>
          <Seg
            compact
            label="الدور"
            value={role}
            onChange={setRole}
            items={[
              { id: 'marketer' as UserRole, label: 'مسوقة' },
              { id: 'coordinator' as UserRole, label: 'منسقة' },
              { id: 'guard' as UserRole, label: 'حارس' },
              { id: 'admin' as UserRole, label: 'إدارة' },
            ]}
          />
        </div>
      </form>
    </Sheet>
  );
};
