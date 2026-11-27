import React, { useState } from 'react';
import { X, Send, Users, AlertTriangle, FileText, Clock, Share2, Trash2, CheckCircle2, Layers, Check, ExternalLink, Copy, Megaphone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  BroadcastTargetGroup,
  BroadcastPriority,
  BroadcastCategory,
  AdminBroadcastMessage,
} from '../../types';
import { Sheet, Seg, Field, Head, Acts, Act, Infos, Info, Tag, Tile, Switch } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';
import { fmtN, localTodayStr, toLatinDigits } from '../../lib/format';

interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminBroadcastModal: React.FC<AdminBroadcastModalProps> = ({ isOpen, onClose }) => {
  const {
    adminBroadcasts,
    sendAdminBroadcast,
    deleteAdminBroadcast,
    marketers,
    coordinators,
    guardsList,
    properties,
    isAdmin,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form states
  const [targetGroup, setTargetGroup] = useState<BroadcastTargetGroup>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('al-taraf');
  const [selectedGuardId, setSelectedGuardId] = useState<string>('g1');
  const [selectedMarketerIds, setSelectedMarketerIds] = useState<string[]>([]);
  const [selectedCoordinatorIds, setSelectedCoordinatorIds] = useState<string[]>([]);
  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([]);
  const [category, setCategory] = useState<BroadcastCategory>('decision');
  const [priority, setPriority] = useState<BroadcastPriority>('urgent');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => localTodayStr());
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [whatsappShareUrl, setWhatsappShareUrl] = useState<string | null>(null);
  const [copiedWhatsappLink, setCopiedWhatsappLink] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset templates
  const presets = [
    {
      title: 'توحيد أوقات الدخول والخروج الرسمية',
      category: 'decision' as BroadcastCategory,
      priority: 'urgent' as BroadcastPriority,
      targetGroup: 'all' as BroadcastTargetGroup,
      content:
        'تقرر رسمياً توحيد وقت الدخول لجميع الاستراحات والشاليهات في تمام الساعة ٤:٠٠ عصراً، ووقت الخروج في تمام الساعة ١٢:٠٠ ظهراً. نرجو من كافة المسوقين والحراس الالتزام التام بهذه المواعيد وإبلاغ النزلاء بها مسبقاً لضمان تجهيز الوحدات.',
    },
    {
      title: 'إلزامية معاينة التأمين وتوثيق التلفيات بالصور قبل الإعادة',
      category: 'instruction' as BroadcastCategory,
      priority: 'urgent' as BroadcastPriority,
      targetGroup: 'all_guards' as BroadcastTargetGroup,
      content:
        'تعميم هام لحراس العقارات: يُمنع منعاً باتاً إعادة أي مبلغ تأمين للنزيل قبل إجراء الفحص الشامل لمحتويات الاستراحة والمسبح، وفي حال وجود أي تلفيات أو عبث يجب تصويرها وتوثيقها عبر خانة المعاينة بالتطبيق قبل تسجيل الخروج.',
    },
    {
      title: 'تعليمات استلام مبالغ الكاش المتبقية عند البوابة',
      category: 'alert' as BroadcastCategory,
      priority: 'important' as BroadcastPriority,
      targetGroup: 'all_guards' as BroadcastTargetGroup,
      content:
        'تنبيه تشغيلي للحراس: عند حضور العميل ودفع المبلغ المتبقي نقداً (كاش) عند البوابة، يجب الدخول فوراً على خانة الحجز والضغط على "استلام الكاش عند البوابة" وتأكيد الاستلام لتصل إشعارات السداد للإدارة والمسوقين.',
    },
    {
      title: 'تحديث شروط حجز عربون الـ 20 دقيقة وسرعة المتابعة',
      category: 'update' as BroadcastCategory,
      priority: 'important' as BroadcastPriority,
      targetGroup: 'all_marketers' as BroadcastTargetGroup,
      content:
        'توجيه لفريق المسوقين: مهلة انتظار تحويل العربون هي ٢٠ دقيقة فقط، ويلغى الحجز المؤقت تلقائياً بعد انتهاء المهلة. يرجى متابعة العميل خلال هذه الفترة للتأكد من إرفاق إيصال التحويل البنكي.',
    },
    {
      title: 'آلية اعتماد عمولة المسوقين 7% بعد خروج النزيل',
      category: 'instruction' as BroadcastCategory,
      priority: 'normal' as BroadcastPriority,
      targetGroup: 'female_marketers' as BroadcastTargetGroup,
      content:
        'توجيه لفريق مسوقات حمران: تبدأ نسبة العمولة بـ 5%، ولا تُعتمد نسبة الـ 7% إلا بعد موافقة الإدارة والتأكد من كون الحجز كاملاً بعد مغادرة النزيل تماماً والتأكد من سلامة الاستراحة.',
    },
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    setTitle(preset.title);
    setContent(preset.content);
    setCategory(preset.category);
    setPriority(preset.priority);
    setTargetGroup(preset.targetGroup);
  };

  const handleToggleMarketerSelect = (id: string) => {
    setSelectedMarketerIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleToggleCoordinatorSelect = (id: string) => {
    setSelectedCoordinatorIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const handleToggleGuardSelect = (id: string) => {
    setSelectedGuardIds((prev) =>
      prev.includes(id) ? prev.filter((gId) => gId !== id) : [...prev, id]
    );
  };

  const totalCustomSelectedCount =
    selectedMarketerIds.length + selectedCoordinatorIds.length + selectedGuardIds.length;
  const totalCustomAvailableCount =
    marketers.length + coordinators.length + guardsList.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!title.trim() || !content.trim()) return;

    if (targetGroup === 'custom' && totalCustomSelectedCount === 0) {
      setErrorMessage('يرجى تحديد عضو واحد على الأقل (مسوق/ة أو منسقة أو حارس) عند اختيار التوجيه المخصص بالأسماء.');
      return;
    }

    let targetPropName = '';
    if (targetGroup === 'specific_guard') {
      const p = properties.find((it) => it.id === selectedPropertyId);
      targetPropName = p ? p.name : '';
    }

    const res = sendAdminBroadcast({
      title: title.trim(),
      content: content.trim(),
      targetGroup,
      targetPropertyId: targetGroup === 'specific_guard' ? selectedPropertyId : undefined,
      targetPropertyName: targetGroup === 'specific_guard' ? targetPropName : undefined,
      targetGuardId: targetGroup === 'specific_guard' ? selectedGuardId : undefined,
      targetMarketerIds: targetGroup === 'custom' ? selectedMarketerIds : undefined,
      targetCoordinatorIds: targetGroup === 'custom' ? selectedCoordinatorIds : undefined,
      targetGuardIds: targetGroup === 'custom' ? selectedGuardIds : undefined,
      priority,
      category,
      effectiveDate,
      sendWhatsapp,
    });

    setSuccessMessage(res.message);
    if (res.whatsappUrl) {
      setWhatsappShareUrl(res.whatsappUrl);
    }

    // Reset fields after sending
    setTitle('');
    setContent('');
  };

  const GROUP_OPTIONS: { id: BroadcastTargetGroup; label: string }[] = [
    { id: 'all', label: 'الجميع' },
    { id: 'all_marketers', label: 'المسوقون والمسوقات' },
    { id: 'coordinators', label: 'فريق المنسقات' },
    { id: 'all_guards', label: 'حراس العقارات' },
    { id: 'specific_guard', label: 'حارس عقار محدد' },
    { id: 'female_marketers', label: 'مسوقات حمران' },
    { id: 'custom', label: 'اختيار مخصص' },
  ];

  const shortName = (n: string) => n.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim() || n;

  const memberPick = (key: string, name: string, on: boolean, toggle: () => void) => (
    <button key={key} type="button" aria-pressed={on} onClick={toggle} className={`kt-bk text-start cursor-pointer lx-press ${on ? 'kt-on' : ''}`}>
      <div className="kt-bk-h">
        <span className="kt-row-t">
          <span className="kt-row-n">{shortName(name)}</span>
        </span>
        {on ? (
          <Tile icon={Check} tone="jade" size={32} />
        ) : (
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, border: '1.5px solid #D9D2E8', background: '#fff', flex: 'none' }} />
        )}
      </div>
    </button>
  );

  const allCustomSelected = totalCustomSelectedCount === totalCustomAvailableCount;

  return (
    <Sheet
      wide
      lockBackdrop
      title="التعميمات والقرارات"
      icon={Megaphone}
      tone="amy"
      onClose={onClose}
      footer={
        activeTab === 'create' ? (
          <Acts cols={2}>
            <Act submit form="broadcast-form" tone="ink" icon={Send} label="إرسال التعميم" title="إرسال وتعميم القرار الآن" disabled={!title.trim() || !content.trim()} />
            <Act tone="line" icon={X} label="إلغاء" onClick={onClose} />
          </Acts>
        ) : (
          <Act tone="line" icon={X} label="إغلاق" onClick={onClose} />
        )
      }
    >
      <Seg
        label="قسم التعميمات"
        value={activeTab}
        onChange={(v) => {
          setActiveTab(v);
          setSuccessMessage(null);
        }}
        items={[
          { id: 'create', label: 'تعميم جديد', icon: Send },
          { id: 'history', label: 'السجل', icon: Clock, badge: adminBroadcasts.length },
        ]}
      />

      {successMessage && (
        <div className="kt-ok animate-in fade-in" role="status">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
            <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
              ✕
            </button>
          </div>
          {whatsappShareUrl && (
            <Acts cols={2}>
              <Act small tone="jade" icon={ExternalLink} label="إرسال واتساب" title="إرسال نص التعميم عبر واتساب" href={whatsappShareUrl} />
              <Act
                small
                tone="soft"
                icon={copiedWhatsappLink ? Check : Copy}
                label={copiedWhatsappLink ? 'تم النسخ ✓' : 'نسخ الرابط'}
                onClick={() => {
                  navigator.clipboard?.writeText(whatsappShareUrl);
                  setCopiedWhatsappLink(true);
                  setTimeout(() => setCopiedWhatsappLink(false), 2500);
                }}
              />
            </Acts>
          )}
        </div>
      )}

      {activeTab === 'create' ? (
        <form id="broadcast-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* 1) المجموعة المستهدفة */}
          <Head title="المجموعة المستهدفة" icon={Users} />
          <Field label="موجّه إلى">
            <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value as BroadcastTargetGroup)} className="kt-input">
              {GROUP_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          {targetGroup === 'specific_guard' && (
            <Field label="العقار">
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  const p = properties.find((it) => it.id === e.target.value);
                  if (p?.assignedGuardId) setSelectedGuardId(p.assignedGuardId);
                }}
                className="kt-input"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {targetGroup === 'custom' && (
            <>
              <Head
                title="الأعضاء"
                icon={Users}
                tone="sand"
                count={`${totalCustomSelectedCount}/${totalCustomAvailableCount}`}
                action={
                  <Act
                    small
                    tone="soft"
                    label={allCustomSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                    onClick={() => {
                      if (allCustomSelected) {
                        setSelectedMarketerIds([]);
                        setSelectedCoordinatorIds([]);
                        setSelectedGuardIds([]);
                      } else {
                        setSelectedMarketerIds(marketers.map((m) => m.id));
                        setSelectedCoordinatorIds(coordinators.map((c) => c.id));
                        setSelectedGuardIds(guardsList.map((g) => g.id));
                      }
                    }}
                  />
                }
              />
              <p className="kt-sub-t" style={{ textAlign: 'start' }}>
                المسوقون ({selectedMarketerIds.length}/{marketers.length})
              </p>
              {marketers.map((m) => memberPick(m.id, m.name, selectedMarketerIds.includes(m.id), () => handleToggleMarketerSelect(m.id)))}
              {coordinators.length > 0 && (
                <>
                  <p className="kt-sub-t" style={{ textAlign: 'start' }}>
                    المنسقات ({selectedCoordinatorIds.length}/{coordinators.length})
                  </p>
                  {coordinators.map((c) => memberPick(c.id, c.name, selectedCoordinatorIds.includes(c.id), () => handleToggleCoordinatorSelect(c.id)))}
                </>
              )}
              {guardsList.length > 0 && (
                <>
                  <p className="kt-sub-t" style={{ textAlign: 'start' }}>
                    الحراس ({selectedGuardIds.length}/{guardsList.length})
                  </p>
                  {guardsList.map((g) => memberPick(g.id, g.name, selectedGuardIds.includes(g.id), () => handleToggleGuardSelect(g.id)))}
                </>
              )}
            </>
          )}

          {/* 2) التصنيف والأولوية */}
          <Head title="التصنيف والأولوية" icon={Layers} />
          <Field label="التصنيف">
            <select value={category} onChange={(e) => setCategory(e.target.value as BroadcastCategory)} className="kt-input">
              <option value="decision">قرار إداري</option>
              <option value="alert">تنبيه تشغيلي</option>
              <option value="update">تعديل شروط أو أسعار</option>
              <option value="instruction">توجيهات عمل</option>
              <option value="general">تعميم عام</option>
            </select>
          </Field>
          <Seg
            label="الأولوية"
            value={priority}
            onChange={setPriority}
            items={[
              { id: 'urgent', label: 'عاجل' },
              { id: 'important', label: 'هام' },
              { id: 'normal', label: 'عادي' },
            ]}
          />

          {/* 3) القوالب الجاهزة */}
          <Field label="قالب جاهز" hint="يملأ الحقول">
            <select
              value=""
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (!Number.isNaN(idx) && presets[idx]) handleApplyPreset(presets[idx]);
              }}
              className="kt-input"
            >
              <option value="">— اختر قالباً —</option>
              {presets.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>

          {/* 4) العنوان والنص */}
          <Head title="نص التعميم" icon={FileText} />
          <div className="kt-fields">
            <Field label="العنوان" className="kt-wide">
              <input type="text" required placeholder="مثال: توحيد أوقات الدخول والخروج" value={title} onChange={(e) => setTitle(e.target.value)} className="kt-input" />
            </Field>
            <Field label="تاريخ السريان" className="kt-wide">
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="kt-input" />
            </Field>
            <Field label="التفاصيل" hint={`${content.length} حرف`} className="kt-wide">
              <textarea required rows={5} placeholder="اكتب تفاصيل القرار أو التعليمات" value={content} onChange={(e) => setContent(e.target.value)} className="kt-input kt-ta" />
            </Field>
          </div>

          <div className="kt-opt">
            <span>تجهيز رابط واتساب</span>
            <Switch on={sendWhatsapp} onChange={setSendWhatsapp} label="تجهيز رابط واتساب لمشاركة التعميم في المجموعات" />
          </div>
          <p className="kt-note">التعميمات العاجلة تظهر كبانر أعلى الشاشة حتى تأكيد الاطلاع.</p>

          {errorMessage && (
            <div className="kt-err" role="alert">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      ) : (
        <>
          <Head title="السجل" icon={Clock} count={adminBroadcasts.length} />
          {adminBroadcasts.length === 0 ? (
            <EmptyBox icon={FileText} text="لا توجد تعميمات سابقة." />
          ) : (
            adminBroadcasts.map((bc) => {
              const isUrgent = bc.priority === 'urgent';
              const isImportant = bc.priority === 'important';
              const categoryBadge =
                bc.category === 'decision' ? 'قرار إداري' : bc.category === 'alert' ? 'تنبيه تشغيلي' : bc.category === 'update' ? 'تعديل شروط' : 'توجيهات';
              return (
                <div key={bc.id} className="kt-bk">
                  <div className="kt-bk-h">
                    <Tag tone={isUrgent ? 'garn' : isImportant ? 'sand' : 'gray'}>{isUrgent ? 'عاجل' : isImportant ? 'هام' : 'عادي'}</Tag>
                    <Tag tone="amy">{categoryBadge}</Tag>
                    <span className="kt-row-t" />
                    <span className="text-[12.5px] font-bold text-[#5E5575] shrink-0"><bdi dir="ltr">{toLatinDigits(bc.sentAt)}</bdi></span>
                  </div>
                  <h4 className="text-[15.5px] font-extrabold leading-7 text-[#1A0F2E]">{bc.title}</h4>
                  <p className="kt-note whitespace-pre-wrap">{bc.content}</p>
                  <Infos cols={2}>
                    <Info label="ساري من" value={<bdi dir="ltr">{toLatinDigits(bc.effectiveDate)}</bdi>} />
                    <Info label="تأكيد الاطلاع" value={fmtN(bc.acknowledgedBy?.length || 0)} />
                    <Info wide label="موجّه لـ" value={shortName(bc.targetGroupName)} />
                    <Info wide label="المرسل" value={bc.senderName} />
                  </Infos>
                  {isAdmin && confirmDeleteId === bc.id ? (
                    <Acts cols={2}>
                      <Act
                        small
                        tone="garnet"
                        icon={Trash2}
                        label="تأكيد الحذف"
                        onClick={() => {
                          deleteAdminBroadcast(bc.id);
                          setConfirmDeleteId(null);
                        }}
                      />
                      <Act small tone="line" label="إلغاء" onClick={() => setConfirmDeleteId(null)} />
                    </Acts>
                  ) : (
                    <Acts cols={isAdmin ? 2 : 1}>
                      <Act
                        small
                        tone="jadeS"
                        icon={Share2}
                        label="مشاركة واتساب"
                        href={`https://wa.me/?text=${encodeURIComponent(`*📢 تعميم إداري: ${bc.title}*\n\n${bc.content}`)}`}
                      />
                      {isAdmin && <Act small tone="garnS" icon={Trash2} label="حذف" title="حذف التعميم" onClick={() => setConfirmDeleteId(bc.id)} />}
                    </Acts>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </Sheet>
  );
};
