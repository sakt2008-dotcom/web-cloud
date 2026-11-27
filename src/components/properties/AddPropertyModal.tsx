import React, { useMemo, useState } from 'react';
import {
  Building2,
  X,
  Layers,
  Plus,
  Trash2,
  UserCheck,
  CreditCard,
  FileText,
  Upload,
  Film,
  Loader2,
  Home,
  LayoutGrid,
  MessageCircle,
  ChevronLeft,
  Save,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Property, PropertySection } from '../../types';
import { uploadPhotoFile } from '../../lib/mediaStorage';
import { VideoUploader, SmartVideoPlayer } from '../video/VideoUploader';
import { buildDefaultUnitContractTemplate, getPropertyKind } from '../../lib/propertyUtils';
import { Sheet, Seg, Field, Acts, Act, Row, Head, IconBtn } from '../ui/kit';
import type { Ico } from '../ui/kit';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newProperty: Property) => void;
}

type Kind = 'estate' | 'unit' | 'section';

const KIND_INFO: Record<Kind, { title: string; hint: string; icon: React.ElementType }> = {
  estate: { title: 'عقار', hint: 'يضم وحدتين — مثل حمران', icon: Building2 },
  unit: { title: 'وحدة', hint: 'تضم قسمين — مثل الترف', icon: Home },
  section: { title: 'قسم', hint: 'جزء من وحدة — مثل قسم النساء', icon: LayoutGrid },
};

const DEFAULT_TERMS = [
  'يلتزم المستأجر بتسليم الاستراحة في الوقت المحدد للخروج.',
  'يُعاد مبلغ التأمين كاملاً عند التسليم سليمة خالية من أي أضرار.',
  'يتحمل المستأجر تكاليف أي أضرار تلحق بالاستراحة أو مرافقها.',
  'العربون المدفوع غير قابل للاسترداد في حال إلغاء الحجز من طرف المستأجر.',
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { addProperty, addPropertySection, guardsList, isAdmin, canViewProperties, properties } = useApp();

  const [kind, setKind] = useState<Kind | null>(null);
  const [parentId, setParentId] = useState<string>('');

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');

  // media
  const [coverImage, setCoverImage] = useState('');
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [extraImageUrl, setExtraImageUrl] = useState('');
  const [videoUrlsList, setVideoUrlsList] = useState<string[]>([]);
  const [isUploadingAlbum, setIsUploadingAlbum] = useState(false);
  const [albumProgress, setAlbumProgress] = useState('');

  // contract
  const [contractTouched, setContractTouched] = useState(false);
  const [contractTemplate, setContractTemplate] = useState('');
  const [contractTerms, setContractTerms] = useState<string[]>([...DEFAULT_TERMS]);
  const [newTermText, setNewTermText] = useState('');

  // bank + guard (العقار والوحدة المستقلة فقط)
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [guardMode, setGuardMode] = useState<'existing' | 'new' | 'none'>('existing');
  const [guardId, setGuardId] = useState<string>(guardsList[0]?.id || '');
  const [customGuardName, setCustomGuardName] = useState('');
  const [customGuardPhone, setCustomGuardPhone] = useState('05');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const estates = useMemo(() => properties.filter((p) => getPropertyKind(p) === 'estate'), [properties]);
  const units = useMemo(() => properties.filter((p) => getPropertyKind(p) === 'unit'), [properties]);

  if (!isOpen) return null;

  const parent = properties.find((p) => p.id === parentId);
  // الوحدة داخل عقار والقسم داخل وحدة يرثان الحارس والبنك من أبيهما
  const inheritsOwnerInfo = kind === 'section' || (kind === 'unit' && Boolean(parentId));

  const previewTemplate = buildDefaultUnitContractTemplate(
    kind === 'section'
      ? { unitLabel: parent?.name || 'اسم الوحدة', sectionLabel: name.trim() || 'اسم القسم' }
      : { unitLabel: name.trim() || (kind === 'estate' ? 'اسم العقار' : 'اسم الوحدة') }
  );
  const templateValue = contractTouched ? contractTemplate : previewTemplate;

  const reset = () => {
    setKind(null);
    setParentId('');
    setName('');
    setSubtitle('');
    setCoverImage('');
    setImagesList([]);
    setExtraImageUrl('');
    setVideoUrlsList([]);
    setContractTouched(false);
    setContractTemplate('');
    setContractTerms([...DEFAULT_TERMS]);
    setNewTermText('');
    setBankName('');
    setIban('');
    setAccountHolder('');
    setErrorMsg(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickKind = (k: Kind) => {
    setKind(k);
    setParentId('');
    setErrorMsg(null);
  };

  const handleAddImage = () => {
    const u = extraImageUrl.trim();
    if (!u) return;
    setImagesList((prev) => [...prev, u]);
    setExtraImageUrl('');
  };

  const handleAddTerm = () => {
    const t = newTermText.trim();
    if (!t) return;
    setContractTerms((prev) => [...prev, t]);
    setNewTermText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !canViewProperties) return;
    if (!kind) {
      setErrorMsg('اختر النوع أولاً: عقار أو وحدة أو قسم');
      return;
    }
    if (!name.trim()) {
      setErrorMsg(`يرجى إدخال اسم ${KIND_INFO[kind].title}`);
      return;
    }
    if (kind === 'section' && !parentId) {
      setErrorMsg('اختر الوحدة التي يتبع لها هذا القسم');
      return;
    }

    const cleanTerms = contractTerms.map((t) => t.trim()).filter(Boolean);
    const finalTemplate = contractTouched && contractTemplate.trim() ? contractTemplate : templateValue;
    const videoItems = videoUrlsList.map((url, i) => ({ title: `فيديو ${i + 1}`, url }));
    const cover = coverImage.trim() || imagesList[0] || '';

    // قسم، أو وحدة داخل عقار ← تُضاف كابن داخل الأب
    if (kind === 'section' || (kind === 'unit' && parentId)) {
      const created = addPropertySection(parentId, {
        name: name.trim(),
        title: name.trim(),
        subtitle: subtitle.trim() || undefined,
        images: imagesList,
        coverImage: cover || undefined,
        contractTemplate: finalTemplate,
        contractTerms: cleanTerms,
        videoItems,
      });
      if (!created) {
        setErrorMsg('تعذرت الإضافة، لم يتم العثور على الأب المحدد');
        return;
      }
      close();
      return;
    }

    // عقار أو وحدة مستقلة ← بطاقة رئيسية
    let gId: string | undefined;
    let gName: string | undefined;
    let gPhone: string | undefined;
    let gNotes: string | undefined;
    if (guardMode === 'existing') {
      const g = guardsList.find((item) => item.id === guardId);
      if (g) {
        gId = g.id;
        gName = g.name;
        gPhone = g.phone;
        gNotes = g.jobTitle || 'حارس مسؤول';
      }
    } else if (guardMode === 'new') {
      gName = customGuardName.trim();
      gPhone = customGuardPhone.trim();
    }

    const isEstate = kind === 'estate';
    const newProperty = addProperty({
      name: name.trim(),
      subtitle: subtitle.trim() || undefined,
      // الأسعار والإفطار تُضبط لاحقاً من صفحة ضبط الأسعار
      basePriceWeekday: 1000,
      basePriceWeekend: 1400,
      hasSections: false,
      coverImage: cover,
      images: imagesList,
      videoItems,
      videoUrls: videoUrlsList,
      contractTemplate: finalTemplate,
      contractTerms: cleanTerms.length > 0 ? cleanTerms : undefined,
      bankName: bankName.trim(),
      iban: iban.trim(),
      accountHolder: accountHolder.trim() || name.trim(),
      assignedGuardId: gId,
      assignedGuardName: gName,
      assignedGuardPhone: gPhone,
      assignedGuardNotes: gNotes,
      isMergedProperty: isEstate,
      mergedConfig: isEstate
        ? { isMerged: true, mergeType: 'internal_units', requireBothAvailable: true }
        : undefined,
      isPublished: true,
    });

    onSuccess?.(newProperty);
    close();
  };

  const parentOptions = kind === 'section' ? units : kind === 'unit' ? estates : [];
  const label = kind ? KIND_INFO[kind].title : '';
  const coverNow = coverImage || imagesList[0];

  return (
    <Sheet
      wide
      lockBackdrop
      title={kind ? `إضافة ${label} جديد${kind === 'unit' ? 'ة' : ''}` : 'إضافة جديدة'}
      icon={Building2}
      tone="amy"
      onClose={close}
      footer={
        kind ? (
          <Acts cols={2}>
            <Act submit form="add-prop-form" tone="ink" icon={Save} label={`حفظ ${label}`} />
            <Act tone="line" icon={X} label="إلغاء" onClick={close} />
          </Acts>
        ) : (
          <Act tone="line" icon={X} label="إلغاء" onClick={close} />
        )
      }
    >
      <form id="add-prop-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* 1) النوع أولاً */}
        {!kind && (
          <>
            <Head title="ما الذي تريد إضافته؟" icon={Plus} />
            {(Object.keys(KIND_INFO) as Kind[]).map((k) => (
              <Row
                key={k}
                icon={KIND_INFO[k].icon as Ico}
                tone="amy"
                title={KIND_INFO[k].title}
                sub={KIND_INFO[k].hint}
                end={<ChevronLeft size={20} strokeWidth={1.8} color="#5B2EA6" />}
                onClick={() => pickKind(k)}
              />
            ))}
          </>
        )}

        {kind && (
          <>
            <Row
              icon={KIND_INFO[kind].icon as Ico}
              tone="amy"
              title={label}
              sub="النوع المختار"
              end={<Act small tone="line" label="تغيير" title="تغيير النوع" onClick={() => setKind(null)} />}
            />

            {/* يتبع لمن؟ */}
            {kind !== 'estate' && (
              <Field label={kind === 'section' ? 'تابع لأي وحدة؟' : 'تابعة لأي عقار؟'} hint={kind === 'section' ? 'مطلوب' : 'اختياري'}>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="kt-input">
                  <option value="">{kind === 'section' ? '— اختر الوحدة —' : 'وحدة مستقلة (بدون عقار)'}</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {kind === 'unit' && estates.length === 0 && <span className="kt-note">لا توجد عقارات بعد، ستُضاف كوحدة مستقلة.</span>}
              </Field>
            )}

            {/* الاسم */}
            <Field label={`اسم ${label}`}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'section' ? 'مثال: قسم النساء' : 'مثال: الترف'}
                className="kt-input"
              />
            </Field>

            {/* الوصف المختصر */}
            <Field label="الوصف المختصر" hint="يُرسل للعميل بواتساب">
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={3}
                placeholder="وصف قصير ومميز يصل للعميل كما هو"
                className="kt-input kt-ta"
              />
            </Field>

            {/* الصور */}
            <div className="kt-sub">
              <p className="kt-sub-t">الصور ({imagesList.length})</p>
              <label className={`kt-act lx-press kt-t-jade ${isUploadingAlbum ? 'opacity-70 pointer-events-none' : ''}`}>
                {isUploadingAlbum ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={1.8} />}
                <span>{isUploadingAlbum ? albumProgress || 'جاري الرفع…' : 'رفع صور من الجهاز'}</span>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="hidden"
                  disabled={isUploadingAlbum}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setIsUploadingAlbum(true);
                    const urls: string[] = [];
                    try {
                      for (let i = 0; i < files.length; i++) {
                        setAlbumProgress(`رفع صورة ${i + 1} من ${files.length}...`);
                        const up = await uploadPhotoFile(files[i], (m) => setAlbumProgress(m));
                        if (up) urls.push(up);
                      }
                      if (urls.length) {
                        setImagesList((prev) => [...prev, ...urls]);
                        setCoverImage((c) => c || urls[0]);
                      }
                    } catch (err) {
                      console.error('Error uploading photos:', err);
                    } finally {
                      setIsUploadingAlbum(false);
                      setAlbumProgress('');
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              <Field label="أو رابط صورة">
                <input
                  type="url"
                  value={extraImageUrl}
                  onChange={(e) => setExtraImageUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                  className="kt-input"
                />
              </Field>
              <Act tone="soft" icon={Plus} label="إضافة الرابط" disabled={!extraImageUrl.trim()} onClick={handleAddImage} />
              {imagesList.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {imagesList.map((img, idx) => {
                    const isCover = coverNow === img;
                    return (
                      <div key={idx} className={`kt-bk ${isCover ? 'kt-on' : ''}`}>
                        <div className="relative aspect-[4/3] rounded-[14px] overflow-hidden bg-[#F4EFFB]">
                          <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          {isCover && (
                            <span className="absolute top-1.5 right-1.5 bg-[#C9A45C] text-[#2B1A00] text-[12px] font-extrabold h-6 px-2 rounded-full inline-flex items-center">
                              الغلاف
                            </span>
                          )}
                        </div>
                        <Acts cols={2}>
                          <Act small tone="sand" label="غلاف" title="تعيين كغلاف" disabled={isCover} onClick={() => setCoverImage(img)} />
                          <Act
                            small
                            tone="garnS"
                            label="حذف"
                            title="حذف الصورة"
                            onClick={() => setImagesList((prev) => prev.filter((_, i) => i !== idx))}
                          />
                        </Acts>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* الفيديوهات */}
            <div className="kt-sub">
              <p className="kt-sub-t">الفيديوهات ({videoUrlsList.length})</p>
              <VideoUploader propertyId="new-draft-property" onUploadSuccess={(url) => setVideoUrlsList((prev) => [...prev, url])} />
              {videoUrlsList.map((v, i) => (
                <div key={i} className="kt-bk">
                  <div className="relative rounded-[14px] overflow-hidden bg-black aspect-video">
                    <SmartVideoPlayer url={v} className="w-full h-full object-cover" />
                  </div>
                  <Act
                    small
                    tone="garnS"
                    icon={Trash2}
                    label="حذف الفيديو"
                    onClick={() => setVideoUrlsList((prev) => prev.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
            </div>

            {/* صيغة العقد */}
            <div className="kt-sub">
              <p className="kt-sub-t">صيغة العقد</p>
              <textarea
                aria-label="صيغة العقد"
                value={templateValue}
                onChange={(e) => {
                  setContractTouched(true);
                  setContractTemplate(e.target.value);
                }}
                rows={8}
                className="kt-input kt-ta"
              />
              {contractTouched && (
                <Act
                  tone="soft"
                  icon={RotateCcw}
                  label="الصيغة الافتراضية"
                  title="استرجاع الصيغة الافتراضية"
                  onClick={() => {
                    setContractTouched(false);
                    setContractTemplate('');
                  }}
                />
              )}
            </div>

            {/* شروط العقد */}
            <div className="kt-sub">
              <p className="kt-sub-t">شروط {label} في العقد</p>
              {contractTerms.map((term, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <textarea
                    aria-label={`الشرط ${idx + 1}`}
                    rows={2}
                    value={term}
                    onChange={(e) => setContractTerms((prev) => prev.map((t, i) => (i === idx ? e.target.value : t)))}
                    className="kt-input kt-ta flex-1 min-w-0"
                  />
                  <IconBtn icon={X} tone="garn" label={`حذف الشرط ${idx + 1}`} onClick={() => setContractTerms((prev) => prev.filter((_, i) => i !== idx))} />
                </div>
              ))}
              <input
                type="text"
                aria-label="شرط جديد"
                value={newTermText}
                onChange={(e) => setNewTermText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTerm();
                  }
                }}
                placeholder="أدخل شرطاً جديداً"
                className="kt-input"
              />
              <Act tone="soft" icon={Plus} label="إضافة شرط" disabled={!newTermText.trim()} onClick={handleAddTerm} />
            </div>

            {/* الحارس والبنك — للعقار والوحدة المستقلة فقط */}
            {!inheritsOwnerInfo ? (
              <>
                <div className="kt-sub">
                  <p className="kt-sub-t">الحارس</p>
                  <Seg
                    compact
                    label="مصدر الحارس"
                    value={guardMode}
                    onChange={setGuardMode}
                    items={[
                      { id: 'existing', label: 'حارس موجود' },
                      { id: 'new', label: 'حارس جديد' },
                      { id: 'none', label: 'بدون حارس' },
                    ]}
                  />
                  {guardMode === 'existing' && (
                    <select aria-label="الحارس" value={guardId} onChange={(e) => setGuardId(e.target.value)} className="kt-input">
                      {guardsList.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} — {g.phone}
                        </option>
                      ))}
                    </select>
                  )}
                  {guardMode === 'new' && (
                    <div className="kt-fields">
                      <Field label="اسم الحارس" className="kt-wide">
                        <input type="text" value={customGuardName} onChange={(e) => setCustomGuardName(e.target.value)} className="kt-input" />
                      </Field>
                      <Field label="الجوال" className="kt-wide">
                        <input
                          type="tel"
                          value={customGuardPhone}
                          onChange={(e) => setCustomGuardPhone(e.target.value)}
                          dir="ltr"
                          className="kt-input kt-num"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="kt-sub">
                  <p className="kt-sub-t">الحساب البنكي</p>
                  <div className="kt-fields">
                    <Field label="اسم البنك">
                      <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="kt-input" />
                    </Field>
                    <Field label="صاحب الحساب">
                      <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="kt-input" />
                    </Field>
                    <Field label="الآيبان (IBAN)" className="kt-wide">
                      <input type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA..." dir="ltr" className="kt-input" />
                    </Field>
                  </div>
                </div>
              </>
            ) : (
              <div className="kt-sub">
                <p className="kt-note">
                  <Layers size={16} strokeWidth={1.8} className="inline-block align-text-bottom me-1.5" />
                  الحارس والحساب البنكي من {parent ? `«${parent.name}»` : 'الأب'} تلقائياً.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="kt-err" role="alert">
                <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
};
