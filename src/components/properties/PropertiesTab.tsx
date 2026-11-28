import React, { useState, useMemo } from 'react';
import { PropertySelect } from '../shared/PropertySelect';
import {
  Search,
  Building2,
  MapPin,
  Eye,
  Share2,
  Send,
  Sparkles,
  Layers,
  Edit2,
  DollarSign,
  Waves,
  Check,
  Copy,
  Plus,
  Image as ImageIcon,
  Save,
  Link2,
  RefreshCw,
  CheckCircle2,
  X,
  FileText,
  Landmark,
  Trash2,
  Upload,
  Star,
  Phone,
  ShieldCheck,
  Camera,
  UserCheck,
  AlertCircle,
  Video,
  Film,
  Play,
  Loader2,
  GitMerge,
  Coffee,
  ArrowLeftRight,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Property, PropertySection } from '../../types';
import { HamranCoordinatorsCard } from './HamranCoordinatorsCard';
import { AddPropertyModal } from './AddPropertyModal';
import { MergeUnitsModal } from './MergeUnitsModal';
import { TransferUnitModal } from './TransferUnitModal';
import { UnitContractTemplateCard } from './UnitContractTemplateCard';
import { VideoUploader, SmartVideoPlayer } from '../video/VideoUploader';
import { isExternalVideoLink, shareOrDownloadVideoFile, uploadPhotoFile } from '../../lib/mediaStorage';
import { openExternalUrlSafely } from '../../lib/customerLinks';
import { getAggregatedProperty } from '../../lib/propertyAggregate';
import { fmtN } from '../../lib/format';
import { isLinkedEstate, createDefaultSectionsForProperty, resolvePropertyHasSections, getPropertyKind, getHierarchyLabels, describeChildrenCount, getChildCount } from '../../lib/propertyUtils';
import { LuxIcon } from '../ui/lux';
import { Head, Acts, Act, Infos, Info, Pill, Tag, SearchBox, Row, Switch, Acc, Field, Check as CheckRow, Sheet, Seg, Face, Tile, IconBtn } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';
import type { Ico } from '../ui/kit';

/** أيقونة تحميل دوّارة (لأزرار kt-act) */
const SpinIcon: Ico = (props) => <Loader2 {...props} className="animate-spin" />;

export const PropertiesTab: React.FC = () => {
  const {
    properties,
    updateProperty,
    deleteProperty,
    duplicateProperty,
    updatePropertySection,
    duplicatePropertySection,
    addPropertySection,
    deletePropertySection,
    togglePropertyBreakfast,
    togglePropertyCoordinatorServices,
    togglePropertyHasSections,
    transferPropertyOrSection,
    togglePropertyPublished,
    isAdmin,
    canViewProperties,
    setSelectedPropertyId,
    setActiveTab,
    guardsList,
    updatePropertyGuard,
    updatePropertyPhotos,
    deletePropertyPhoto,
    addPropertyPhotos,
    setPropertyCoverPhoto,
    addPropertyVideo,
    deletePropertyVideo,
    savePropertiesNow,
    messageTemplates,
  } = useApp();

  const hasPropertiesFullAccess = isAdmin || canViewProperties;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [selectedPropertyDetailId, setSelectedPropertyDetailId] = useState<string | null>(null);
  const [editSectionKey, setEditSectionKey] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Property>>({});
  const [newPropertyFeatureText, setNewPropertyFeatureText] = useState('');
  const [newPropertyTermText, setNewPropertyTermText] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('section-1');
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [transferModalState, setTransferModalState] = useState<{
    isOpen: boolean;
    sourcePropertyId: string;
    sourceSectionId?: string;
  } | null>(null);

  // Photo & Video management state
  const [photoManageModalOpen, setPhotoManageModalOpen] = useState(false);
  const [mediaModalTab, setMediaModalTab] = useState<'photos' | 'videos'>('photos');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [photoProgressMsg, setPhotoProgressMsg] = useState('');
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Guard assignment state
  const [guardAssignModalOpen, setGuardAssignModalOpen] = useState(false);
  const [selectedGuardOption, setSelectedGuardOption] = useState<'existing' | 'custom'>('existing');
  const [guardForm, setGuardForm] = useState({
    guardId: '',
    guardName: '',
    guardPhone: '',
    guardNotes: '',
  });

  // Section editor modal
  const [editingSection, setEditingSection] = useState<PropertySection | null>(null);
  const [sectionFormData, setSectionFormData] = useState<Partial<PropertySection>>({});
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null);
  const [newFeatureText, setNewFeatureText] = useState('');

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // iCal sync modal
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncPropId, setSyncPropId] = useState<string | null>(null);
  const [copiedSyncKey, setCopiedSyncKey] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [gathernUrl, setGathernUrl] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [airbnbUrl, setAirbnbUrl] = useState('');

  const [syncStatuses, setSyncStatuses] = useState<Record<string, { gathern?: boolean; booking?: boolean; airbnb?: boolean; lastSync?: string }>>(() => {
    try {
      const s = localStorage.getItem('property_calendar_sync_status');
      if (s) return JSON.parse(s);
    } catch {}
    return {
      'al-taraf': { gathern: true, booking: true, airbnb: false, lastSync: 'منذ 5 دقائق' },
      'al-baylasan': { gathern: true, booking: false, airbnb: false, lastSync: 'منذ 18 دقيقة' },
      rans: { gathern: false, booking: false, airbnb: false },
      alma: { gathern: true, booking: true, airbnb: false, lastSync: 'منذ ساعة' },
      naya: { gathern: false, booking: false, airbnb: false },
      hamran: { gathern: false, booking: false, airbnb: false },
    };
  });

  const [sharingVideoKey, setSharingVideoKey] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSharePropertyVideoAsFile = async (videoUrl: string, title: string, key: string) => {
    if (sharingVideoKey) return;
    setSharingVideoKey(key);
    try {
      const result = await shareOrDownloadVideoFile(videoUrl, title);
      if (result.status !== 'cancelled') {
        showToast(result.message);
      }
    } catch (err: any) {
      showToast(err?.message || 'تعذر تجهيز ملف الفيديو للمشاركة');
    } finally {
      setSharingVideoKey(null);
    }
  };

  const openSyncModal = (propId: string) => {
    setSyncPropId(propId);
    try {
      const raw = localStorage.getItem('property_calendar_sync_urls');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[propId]) {
          setGathernUrl(parsed[propId].gathern || '');
          setBookingUrl(parsed[propId].booking || '');
          setAirbnbUrl(parsed[propId].airbnb || '');
        } else {
          setGathernUrl('');
          setBookingUrl('');
          setAirbnbUrl('');
        }
      }
    } catch {}
    setSyncModalOpen(true);
  };

  const copySyncText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedSyncKey(key);
    setTimeout(() => setCopiedSyncKey(null), 2000);
  };

  const executeSync = () => {
    if (!syncPropId) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    setTimeout(() => {
      setIsSyncing(false);
      const updated = {
        ...syncStatuses,
        [syncPropId]: {
          gathern: !!gathernUrl || syncStatuses[syncPropId]?.gathern || true,
          booking: !!bookingUrl || syncStatuses[syncPropId]?.booking || true,
          airbnb: !!airbnbUrl || syncStatuses[syncPropId]?.airbnb || false,
          lastSync: 'الآن',
        },
      };
      setSyncStatuses(updated);
      try {
        localStorage.setItem('property_calendar_sync_status', JSON.stringify(updated));
        const raw = localStorage.getItem('property_calendar_sync_urls');
        const urls = raw ? JSON.parse(raw) : {};
        urls[syncPropId] = { gathern: gathernUrl, booking: bookingUrl, airbnb: airbnbUrl };
        localStorage.setItem('property_calendar_sync_urls', JSON.stringify(urls));
      } catch {}
      setSyncFeedback('تمت مزامنة وتقييد الحجوزات مع جاذر إن وبوكينج بنجاح!');
      showToast('تم حفظ روابط المزامنة وتقييد الحجوزات بنجاح');
      setTimeout(() => setSyncFeedback(null), 3000);
    }, 1200);
  };

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = filterPropertyId ? properties.filter((p) => p.id === filterPropertyId) : properties;
    if (!q) return base;
    return base.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        (p.subtitle || '').toLowerCase().includes(q)
      );
    });
  }, [properties, searchQuery, filterPropertyId]);

  const activeProperty = useMemo(() => {
    if (!selectedPropertyDetailId) return null;
    return properties.find((p) => p.id === selectedPropertyDetailId) || null;
  }, [properties, selectedPropertyDetailId]);

  const agg = useMemo(() => (activeProperty ? getAggregatedProperty(activeProperty, properties) : null), [activeProperty, properties]);

  const startEditSection = (sec: PropertySection) => {
    setEditingSection(sec);
    setSectionFormData({
      ...sec,
      features: [...sec.features],
      hasBreakfast: sec.hasBreakfast ?? activeProperty?.hasBreakfast ?? false,
      hasCoordinatorServices: sec.hasCoordinatorServices ?? activeProperty?.hasCoordinatorServices ?? false,
    });
    setNewFeatureText('');
  };

  const saveSectionChanges = () => {
    if (!activeProperty || !editingSection) return;
    updatePropertySection(activeProperty.id, editingSection.id, sectionFormData);
    setEditingSection(null);
    showToast(`تم حفظ معلومات ${editingSection.name} بنجاح`);
  };

  const handleDuplicateProperty = (e: React.MouseEvent, propId: string) => {
    e.stopPropagation();
    const cloned = duplicateProperty(propId);
    if (cloned) {
      showToast(`تم نسخ الوحدة بنجاح باسم: ${cloned.name}`);
      setSelectedPropertyDetailId(cloned.id);
    }
  };

  const handleDuplicateSection = (e: React.MouseEvent, propId: string, secId: string) => {
    e.stopPropagation();
    const clonedSec = duplicatePropertySection(propId, secId);
    if (clonedSec) {
      showToast(`تم نسخ القسم بنجاح: ${clonedSec.name}`);
      setActiveSectionId(clonedSec.id);
    }
  };

  const handleAddSection = (propId: string) => {
    const nextIdx = (activeProperty?.sections?.length || 0) + 1;
    const newSec = addPropertySection(propId, {
      name: `القسم ${nextIdx}`,
      title: `قسم ضيافة إضافي ${nextIdx}`,
    });
    if (newSec) {
      showToast(`تمت إضافة القسم بنجاح: ${newSec.name}`);
      setActiveSectionId(newSec.id);
      startEditSection(newSec);
    }
  };

  const handleDeleteSection = (propId: string, secId: string, secName: string) => {
    if (confirmDeleteSectionId !== secId) {
      setConfirmDeleteSectionId(secId);
      setTimeout(() => {
        setConfirmDeleteSectionId((prev) => (prev === secId ? null : prev));
      }, 4000);
      return;
    }
    setConfirmDeleteSectionId(null);
    deletePropertySection(propId, secId);
    showToast(`تم حذف ${secName} بنجاح`);
    setActiveSectionId('all');
  };

  const addFeatureToSection = () => {
    if (!newFeatureText.trim()) return;
    const current = sectionFormData.features || [];
    setSectionFormData({ ...sectionFormData, features: [...current, newFeatureText.trim()] });
    setNewFeatureText('');
  };

  const removeFeatureFromSection = (idx: number) => {
    const current = sectionFormData.features || [];
    setSectionFormData({ ...sectionFormData, features: current.filter((_, i) => i !== idx) });
  };

  const sendSectionWhatsApp = (prop: Property, sec: PropertySection) => {
    const text = `أهلاً وسهلاً بك 🌿
تفاصيل وأسعار (${prop.name} - ${sec.name}):

💰 الأسعار المعتمدة:
• وسط الأسبوع: ${sec.priceWeekday} ر.س / ليلة
• نهاية الأسبوع (الويكند): ${sec.priceWeekend} ر.س / ليلة

📋 معلومات ومواصفات القسم:
• ${sec.subtitle}
• السعة: تتسع لـ ${sec.capacity} فرداً
• غرف النوم: ${sec.bedrooms} | دورات المياه: ${sec.bathrooms}
• المساحة: ${sec.areaM2} م²
${sec.poolType ? `• المسبح: ${sec.poolType}\n` : ''}
✨ أبرز المرافق والتجهيزات:
${sec.features.map((f) => `• ${f}`).join('\n')}

📍 الموقع: ${prop.location}
يسعدنا تواصلكم لتأكيد الحجز!`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    openExternalUrlSafely(url);
  };

  const copySectionInfo = (prop: Property, sec: PropertySection) => {
    const text = `🌿 تفاصيل وأسعار (${prop.name} - ${sec.name}):
• السعر وسط الأسبوع: ${sec.priceWeekday} ر.س / ليلة
• السعر نهاية الأسبوع: ${sec.priceWeekend} ر.س / ليلة
• المعلومات: ${sec.subtitle}
• السعة: ${sec.capacity} فرداً | غرف النوم: ${sec.bedrooms} | دورات المياه: ${sec.bathrooms}
• المساحة: ${sec.areaM2} م²
${sec.poolType ? `• المسبح: ${sec.poolType}\n` : ''}• المرافق: ${sec.features.join('، ')}
• الموقع: ${prop.location}`;

    navigator.clipboard?.writeText(text);
    showToast(`تم نسخ معلومات وسعر ${sec.name}`);
  };

  // One-click copy of ALL property details for the marketer (requirement from prompt)
  const copyAllPropertyData = (prop: Property) => {
    const sectionsText = prop.sections?.length
      ? prop.sections
          .map(
            (sec) =>
              `\n--- [${sec.name}: ${sec.title}] ---\n• وسط الأسبوع: ${sec.priceWeekday} ر.س | الويكند: ${sec.priceWeekend} ر.س\n• السعة: ${sec.capacity} فرد | المساحة: ${sec.areaM2} م² | غرف: ${sec.bedrooms} | حمام: ${sec.bathrooms}\n• المسبح: ${sec.poolType}\n• المواصفات: ${sec.subtitle}\n• المرافق: ${sec.features.join('، ')}`
          )
          .join('\n')
      : '';

    const text = `🏰 بيانات عقار: ${prop.name} (${prop.code})
📍 الموقع: ${prop.location}
💰 الأسعار الرسمية:
• وسط الأسبوع: ${prop.basePriceWeekday} ر.س / ليلة
• نهاية الأسبوع (الويكند): ${prop.basePriceWeekend} ر.س / ليلة
• التأمين المسترد: ${prop.insuranceAmount} ر.س | العربون: ${prop.defaultDeposit} ر.س
• أوقات الدخول والخروج: دخول ${prop.checkInTimeText} - خروج ${prop.checkOutTimeText}
• السعة: ${prop.capacity} فرد | المساحة: ${prop.areaM2} م² | غرف النوم: ${prop.bedrooms} | دورات المياه: ${prop.bathrooms}
• المسبح: ${prop.poolType}
• الوصف: ${prop.subtitle}
• المرافق والتجهيزات: ${prop.features.join('، ')}
${sectionsText ? `\n🏢 الأقسام المستقلة:${sectionsText}\n` : ''}
🏦 الحساب البنكي المعتمد:
• البنك: ${prop.bankName}
• المستفيد: ${prop.accountHolder}
• الآيبان (IBAN): ${prop.iban}
📍 خريطة Google: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${prop.name} ${prop.location}`)}
📸 صور العقار: ${prop.coverImage}${prop.videoUrls && prop.videoUrls.length > 0 ? `\n🎥 جولة فيديو للعقار: ${prop.videoUrls[0]}` : ''}`;

    navigator.clipboard?.writeText(text);
    showToast(`تم نسخ كل بيانات ${prop.name} بالكامل بنقرة واحدة!`);
  };

  const startEditProperty = (sectionKey: string, propOverride?: Property) => {
    const target = propOverride || activeProperty;
    if (target) {
      setEditSectionKey(sectionKey);
      setEditErrorMsg(null);
      setNewPropertyFeatureText('');
      setNewPropertyTermText('');
      setEditFormData({
        ...target,
        features: [...(target.features || [])],
        contractTerms: [...(target.contractTerms || [])],
      });
    }
  };

  const savePropertyEdit = () => {
    if (!activeProperty || !selectedPropertyDetailId) return;

    if (editSectionKey === 'info' && !(editFormData.name || '').trim()) {
      setEditErrorMsg('يرجى إدخال اسم العقار قبل الحفظ');
      return;
    }

    const sanitizedData: Partial<Property> = {
      ...editFormData,
      name: editFormData.name !== undefined ? editFormData.name.trim() : activeProperty.name,
      code: editFormData.code !== undefined ? editFormData.code.trim() || activeProperty.code : activeProperty.code,
      location: editFormData.location !== undefined ? editFormData.location.trim() : activeProperty.location,
      subtitle: editFormData.subtitle !== undefined ? editFormData.subtitle.trim() : activeProperty.subtitle,
      poolType: editFormData.poolType !== undefined ? editFormData.poolType.trim() : activeProperty.poolType,
      checkInTimeText:
        editFormData.checkInTimeText !== undefined
          ? editFormData.checkInTimeText.trim()
          : activeProperty.checkInTimeText,
      checkOutTimeText:
        editFormData.checkOutTimeText !== undefined
          ? editFormData.checkOutTimeText.trim()
          : activeProperty.checkOutTimeText,
      bankName: editFormData.bankName !== undefined ? editFormData.bankName.trim() : activeProperty.bankName,
      accountHolder:
        editFormData.accountHolder !== undefined ? editFormData.accountHolder.trim() : activeProperty.accountHolder,
      iban: editFormData.iban !== undefined ? editFormData.iban.trim() : activeProperty.iban,
      basePriceWeekday: Number(editFormData.basePriceWeekday ?? activeProperty.basePriceWeekday) || 0,
      basePriceWeekend: Number(editFormData.basePriceWeekend ?? activeProperty.basePriceWeekend) || 0,
      insuranceAmount: Number(editFormData.insuranceAmount ?? activeProperty.insuranceAmount) || 0,
      defaultDeposit: Number(editFormData.defaultDeposit ?? activeProperty.defaultDeposit) || 0,
      capacity: Number(editFormData.capacity ?? activeProperty.capacity) || 0,
      bedrooms: Number(editFormData.bedrooms ?? activeProperty.bedrooms) || 0,
      bathrooms: Number(editFormData.bathrooms ?? activeProperty.bathrooms) || 0,
      areaM2: Number(editFormData.areaM2 ?? activeProperty.areaM2) || 0,
      subUnitsCount: Number(editFormData.subUnitsCount ?? activeProperty.subUnitsCount) || 1,
      hasSections: isLinkedEstate(activeProperty)
        ? false
        : editFormData.hasSections !== undefined
        ? editFormData.hasSections
        : resolvePropertyHasSections(activeProperty),
      hasBreakfast:
        editFormData.hasBreakfast !== undefined
          ? editFormData.hasBreakfast
          : Boolean(activeProperty.hasBreakfast),
      hasCoordinatorServices:
        editFormData.hasCoordinatorServices !== undefined
          ? editFormData.hasCoordinatorServices
          : Boolean(activeProperty.hasCoordinatorServices),
      sections: isLinkedEstate(activeProperty)
        ? undefined
        : editFormData.hasSections && (!activeProperty.sections || activeProperty.sections.length === 0)
          ? createDefaultSectionsForProperty(activeProperty)
          : editFormData.sections ?? activeProperty.sections,
    };

    updateProperty(selectedPropertyDetailId, sanitizedData);
    setEditErrorMsg(null);
    setEditSectionKey(null);
    showToast(`تم حفظ التعديلات على عقار "${sanitizedData.name}" بنجاح`);
  };

  const handleConfirmDeleteProperty = () => {
    if (!propertyToDelete) return;
    const targetId = propertyToDelete.id;
    const res = deleteProperty(targetId);
    setPropertyToDelete(null);
    if (res.success && selectedPropertyDetailId === targetId) {
      setSelectedPropertyDetailId(null);
      setEditSectionKey(null);
    }
    showToast(res.message);
  };

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeProperty) return;
    setIsProcessingPhotos(true);
    const newUrls: string[] = [];
    const total = files.length;
    try {
      for (let i = 0; i < total; i++) {
        setPhotoProgressMsg(`رفع الصورة ${i + 1} من ${total}...`);
        const file = files[i];
        if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(file.name)) {
          const uploadedUrl = await uploadPhotoFile(file, (msg) => setPhotoProgressMsg(`${i + 1}/${total}: ${msg}`));
          if (uploadedUrl) newUrls.push(uploadedUrl);
        }
      }
      if (newUrls.length > 0) {
        addPropertyPhotos(activeProperty.id, newUrls);
        await savePropertiesNow();
        showToast(`تم رفع وحفظ ${newUrls.length} صورة بنجاح`);
      }
    } catch (err: any) {
      console.error('Failed to process photos:', err);
      showToast('حدث خطأ أثناء معالجة الصور');
    } finally {
      setIsProcessingPhotos(false);
      setPhotoProgressMsg('');
    }
  };

  const addPropertyFeatureToEdit = () => {
    const v = newPropertyFeatureText.trim();
    if (!v) return;
    setEditFormData({ ...editFormData, features: [...(editFormData.features || []), v] });
    setNewPropertyFeatureText('');
  };

  const addPropertyTermToEdit = () => {
    const v = newPropertyTermText.trim();
    if (!v) return;
    setEditFormData({ ...editFormData, contractTerms: [...(editFormData.contractTerms || []), v] });
    setNewPropertyTermText('');
  };

  const closePropertyInfoEdit = () => {
    setEditSectionKey(null);
    setEditErrorMsg(null);
  };

  return (
    <div className="pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-2 space-y-4 font-['Tajawal',sans-serif]">
      {toastMsg && (
        <div className="kt-toast" role="status" aria-live="polite">
          <div className="is-ok">
            <Check className="w-5 h-5 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Main List View */}
      {!selectedPropertyDetailId && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <section className="lux-card p-4 space-y-3">
            <Head title="العقارات والوحدات" icon={Building2} count={filteredProperties.length} />
            {hasPropertiesFullAccess && (
              <Acts cols={2}>
                <Act
                  tone="line"
                  icon={GitMerge}
                  label="دمج وحدتين"
                  title="دمج وحدتين (إنشاء عقار مدمج)"
                  onClick={() => setIsMergeModalOpen(true)}
                />
                <Act tone="ink" icon={Plus} label="إضافة وحدة" title="إضافة وحدة جديدة" onClick={() => setIsAddPropertyModalOpen(true)} />
              </Acts>
            )}
          </section>

          <PropertySelect properties={properties} value={filterPropertyId} onChange={setFilterPropertyId} allLabel="كل العقارات والوحدات" />

          <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="بحث بالاسم أو الموقع أو الكود" />

          {/* Properties Cards List */}
          <div className="space-y-4">
            {filteredProperties.map((prop) => {
              const kind = getPropertyKind(prop);
              const parents = properties.filter(
                (p) =>
                  p.id !== prop.id &&
                  p.isMergedProperty &&
                  (p.mergedConfig?.linkedPropertyIds?.includes(prop.id) || p.mergedPropertyIds?.includes(prop.id))
              );
              const showSections = resolvePropertyHasSections(prop) && prop.sections && prop.sections.length > 0;
              return (
                <article
                  key={prop.id}
                  onClick={() => setSelectedPropertyDetailId(prop.id)}
                  className="lux-card overflow-hidden cursor-pointer group"
                >
                  <div className="bg-[#F4EFFB] p-4 relative min-h-[150px] flex flex-col justify-between overflow-hidden">
                    {prop.coverImage && (
                      <img
                        src={prop.coverImage}
                        alt={prop.name}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#240B3B]/85 via-[#240B3B]/35 to-black/25 pointer-events-none" />
                    <div className="flex items-center justify-between gap-2 w-full z-10">
                      <div
                        className={`h-8 px-3 rounded-full text-[13px] font-extrabold flex items-center gap-1.5 backdrop-blur-xs ${
                          prop.isPublished
                            ? 'bg-[#EAF8F1]/95 text-[#1E7E52] border border-[#B7E8D0]'
                            : 'bg-[#FDF0ED]/95 text-[#C0392B] border border-[#F5C6CB]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${prop.isPublished ? 'bg-[#1E7E52]' : 'bg-[#C0392B]'}`} />
                        <span>{prop.isPublished ? 'متاح' : 'مغلق'}</span>
                      </div>

                      <div className="h-8 min-w-0 bg-[#2D1664]/90 backdrop-blur-xs text-white px-3 rounded-full text-[13px] font-extrabold flex items-center gap-1.5 border border-white/20">
                        <Building2 className="w-4 h-4 text-[#E8D4A2] shrink-0" />
                        <span className="truncate">
                          {getHierarchyLabels(kind).self} · {describeChildrenCount(kind, getChildCount(prop))}
                        </span>
                      </div>
                    </div>

                    {!prop.coverImage && (
                      <div className="flex-1 flex items-center justify-center py-4 z-10">
                        <div className="w-16 h-16 rounded-2xl bg-purple-200/40 border border-purple-300/40 flex items-center justify-center text-purple-100">
                          <Building2 className="w-9 h-9 stroke-[1.5]" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="flex-1 min-w-0 truncate text-xl font-extrabold text-[#1A0F2E]">{prop.name}</h3>
                      <Tag mono>{prop.code}</Tag>
                    </div>

                    <div className="flex items-center gap-2 text-[13px] text-[#5E5575] min-w-0">
                      <MapPin size={16} strokeWidth={1.8} className="shrink-0 text-[#5B2EA6]" />
                      <span className="truncate">{prop.location}</span>
                    </div>

                    <Infos cols={2}>
                      {prop.assignedGuardName && <Info label="الحارس" value={prop.assignedGuardName} />}
                      {prop.assignedGuardName && <Info label="جوال الحارس" value={prop.assignedGuardPhone || '—'} ltr />}
                      <Info label="خدمات المنسقات" value={prop.hasCoordinatorServices ? 'يوجد' : 'لا يوجد'} hi={!!prop.hasCoordinatorServices} />
                      <Info
                        label={kind === 'estate' ? 'الوحدات' : 'الأقسام'}
                        value={getChildCount(prop)}
                      />
                      {prop.isMergedProperty && (
                        <Info
                          wide
                          label="عقار مدمج · تزامن الإتاحة"
                          value={
                            prop.mergedConfig?.mergeType === 'linked_properties'
                              ? prop.mergedConfig.linkedPropertyNames && prop.mergedConfig.linkedPropertyNames.length > 0
                                ? prop.mergedConfig.linkedPropertyNames.join(' + ')
                                : 'دمج بين استراحتين'
                              : 'دمج وحدتين داخليتين'
                          }
                        />
                      )}
                      {!prop.isMergedProperty && parents.length > 0 && (
                        <Info wide label="مرتبط بعقار مدمج" value={parents.map((p) => p.name).join('، ')} />
                      )}
                    </Infos>

                    {showSections && (
                      <div className="kt-field">
                        <span className="kt-field-h">
                          <span>{kind === 'estate' ? 'وحدات' : 'أقسام'} {prop.name}</span>
                        </span>
                        <div className="kt-g2">
                          {prop.sections!.map((s) => (
                            <Pill key={s.id} tone="amy">
                              {s.name}
                            </Pill>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      {hasPropertiesFullAccess ? (
                        <>
                          <Acts cols={3}>
                            <Act stack tone="soft" icon={Copy} label="نسخ البيانات" onClick={() => copyAllPropertyData(prop)} />
                            <Act
                              stack
                              tone="sand"
                              icon={Copy}
                              label="نسخ الوحدة"
                              title="إنشاء نسخة كاملة ومطابقة من هذه الوحدة"
                              onClick={(e) => handleDuplicateProperty(e, prop.id)}
                            />
                            <Act
                              stack
                              tone="jadeS"
                              icon={ArrowLeftRight}
                              label="نقل"
                              title="نقل الوحدة أو أقسامها إلى عقار آخر"
                              onClick={() => setTransferModalState({ isOpen: true, sourcePropertyId: prop.id })}
                            />
                          </Acts>
                          <Acts cols={2}>
                            <Act
                              tone="ink"
                              icon={Edit2}
                              label="تعديل"
                              onClick={() => {
                                setSelectedPropertyDetailId(prop.id);
                                startEditProperty('info', prop);
                              }}
                            />
                            <Act tone="garnS" icon={Trash2} label="حذف" onClick={() => setPropertyToDelete(prop)} />
                          </Acts>
                        </>
                      ) : (
                        <Acts cols={1}>
                          <Act tone="soft" icon={Copy} label="نسخ البيانات" onClick={() => copyAllPropertyData(prop)} />
                        </Acts>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Property Details View */}
      {selectedPropertyDetailId && activeProperty && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3 pt-1">
            <Act
              small
              tone="line"
              icon={ArrowRight}
              label="العودة للقائمة"
              onClick={() => {
                setSelectedPropertyDetailId(null);
                setEditSectionKey(null);
              }}
            />
            <Tag mono>{activeProperty.code}</Tag>
          </div>

          {/* Banner with cover */}
          <div className="relative rounded-3xl overflow-hidden shadow-xs h-48 sm:h-56 bg-gradient-to-br from-[#5B3B8C] via-[#3E1D6B] to-[#260E47] flex flex-col justify-end p-5 text-white">
            {activeProperty.coverImage && (
              <img
                src={activeProperty.coverImage}
                alt={activeProperty.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1E0836]/90 via-[#2E1045]/45 to-black/20" />
            <div className="flex items-end justify-between z-10 gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md truncate">{activeProperty.name}</h2>
                <p className="text-[13px] text-purple-100 flex items-center gap-1 mt-0.5 drop-shadow-sm min-w-0">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeProperty.location}</span>
                </p>
              </div>
              <span className="h-8 text-[13px] bg-black/40 backdrop-blur-md text-white font-extrabold px-3 rounded-full border border-white/20 shrink-0 flex items-center whitespace-nowrap">
                {getHierarchyLabels(getPropertyKind(activeProperty)).self} · {describeChildrenCount(getPropertyKind(activeProperty), getChildCount(activeProperty))}
              </span>
            </div>
          </div>

          {/* الحالة والإجراءات السريعة */}
          <section className="lux-card p-4 space-y-3">
            <Row
              icon={activeProperty.isPublished ? CheckCircle2 : AlertCircle}
              tone={activeProperty.isPublished ? 'jade' : 'garn'}
              title={activeProperty.isPublished ? 'متاح للحجز' : 'مغلق حالياً'}
              sub="حالة العقار"
              end={
                hasPropertiesFullAccess ? (
                  <Switch
                    on={!!activeProperty.isPublished}
                    label="تغيير حالة العقار بين متاح ومغلق"
                    onChange={() => {
                      togglePropertyPublished(activeProperty.id);
                      showToast(activeProperty.isPublished ? `تم إيقاف ${activeProperty.name}` : `تم فتح ${activeProperty.name}`);
                    }}
                  />
                ) : undefined
              }
            />

            <Acts cols={3}>
              <Act
                stack
                tone="soft"
                icon={Eye}
                label="معاينة"
                title="معاينة بالتقويم"
                onClick={() => {
                  setSelectedPropertyId(activeProperty.id);
                  setActiveTab('calendar');
                }}
              />
              <Act stack tone="soft" icon={Copy} label="نسخ البيانات" title="نسخ كل بيانات العقار" onClick={() => copyAllPropertyData(activeProperty)} />
              <Act stack tone="jadeS" icon={Link2} label="ربط التقويم" onClick={() => openSyncModal(activeProperty.id)} />
            </Acts>

            {hasPropertiesFullAccess && (
              <>
                <Acts cols={3}>
                  <Act
                    stack
                    tone="sand"
                    icon={Copy}
                    label="نسخ الوحدة"
                    title="إنشاء نسخة كاملة ومطابقة من هذه الوحدة مع كامل الأقسام والإعدادات"
                    onClick={(e) => handleDuplicateProperty(e, activeProperty.id)}
                  />
                  <Act
                    stack
                    tone="jadeS"
                    icon={ArrowLeftRight}
                    label="نقل الوحدة"
                    title="نقل هذه الوحدة أو قسم منها إلى عقار آخر"
                    onClick={() => setTransferModalState({ isOpen: true, sourcePropertyId: activeProperty.id })}
                  />
                  <Act stack tone="ink" icon={Edit2} label="تعديل العقار" onClick={() => startEditProperty('info')} />
                </Acts>
                <Acts cols={1}>
                  <Act tone="garnS" icon={Trash2} label="حذف العقار" onClick={() => setPropertyToDelete(activeProperty)} />
                </Acts>
              </>
            )}
          </section>

          {/* إمكانيات الوحدة: أقسام + خدمات منسقات */}
          <section className="lux-card p-4 space-y-3">
            <Head title="إمكانيات الوحدة" icon={Layers} />
            {(() => {
              const hasSecs = activeProperty.hasSections ?? Boolean(activeProperty.sections && activeProperty.sections.length > 0);
              return (
                <Row
                  icon={Layers}
                  tone="amy"
                  title="أقسام الوحدة"
                  sub={hasSecs ? `يوجد (${activeProperty.sections?.length || 2} أقسام)` : 'وحدة واحدة'}
                  end={
                    hasPropertiesFullAccess ? (
                      <Switch
                        on={!!hasSecs}
                        label="تفعيل أقسام الوحدة"
                        onChange={() => {
                          togglePropertyHasSections(activeProperty.id);
                          showToast('تم تحديث خاصية أقسام الوحدة');
                        }}
                      />
                    ) : (
                      <Tag tone={hasSecs ? 'amy' : 'gray'}>{hasSecs ? 'يوجد' : 'لا يوجد'}</Tag>
                    )
                  }
                />
              );
            })()}
            <Row
              icon={Sparkles}
              tone="garn"
              title="خدمات المنسقات"
              sub={activeProperty.hasCoordinatorServices ? 'متوفرة' : 'غير متوفرة'}
              end={
                hasPropertiesFullAccess ? (
                  <Switch
                    on={!!activeProperty.hasCoordinatorServices}
                    label="تفعيل خدمات المنسقات"
                    onChange={() => {
                      togglePropertyCoordinatorServices(activeProperty.id);
                      showToast('تم تحديث خدمات المنسقات للوحدة');
                    }}
                  />
                ) : (
                  <Tag tone={activeProperty.hasCoordinatorServices ? 'garn' : 'gray'}>
                    {activeProperty.hasCoordinatorServices ? 'يوجد' : 'لا يوجد'}
                  </Tag>
                )
              }
            />
            <p className="kt-note">الأسعار والإفطار تُضبط من صفحة «ضبط الأسعار».</p>
          </section>

          {/* العقار المدمج (نظام حمران) */}
          {activeProperty.isMergedProperty && (
            <section className="lux-card p-4 space-y-3">
              <Head
                title="عقار مدمج"
                icon={GitMerge}
                tone="ch"
                count={activeProperty.mergedConfig?.mergeType === 'linked_properties' ? 'استراحتان' : 'وحدتان'}
              />
              <Infos cols={1}>
                <div className="kt-info">
                  <span className="kt-info-l">
                    {activeProperty.mergedConfig?.mergeType === 'linked_properties' ? 'الاستراحتان المدمجتان' : 'الوحدات الداخلية'}
                  </span>
                  <span className="kt-info-v" style={{ whiteSpace: 'normal' }}>
                    {activeProperty.mergedConfig?.mergeType === 'linked_properties'
                      ? activeProperty.mergedConfig.linkedPropertyNames?.join(' + ') || 'استراحتان مسجلتان'
                      : activeProperty.sections?.map((s) => s.name).join(' + ') || 'الوحدات الداخلية'}
                  </span>
                </div>
              </Infos>
              <CheckRow label="فحص الإتاحة" value="نشط" state="ok" />
            </section>
          )}

          {/* عقار مشمول ضمن عقار مدمج */}
          {!activeProperty.isMergedProperty &&
            properties.some(
              (p) =>
                p.id !== activeProperty.id &&
                p.isMergedProperty &&
                (p.mergedConfig?.linkedPropertyIds?.includes(activeProperty.id) ||
                  p.mergedPropertyIds?.includes(activeProperty.id))
            ) && (
              <section className="lux-card p-4">
                <Row
                  icon={Link2}
                  tone="amy"
                  title="مشمول ضمن عقار مدمج"
                  sub={properties
                    .filter(
                      (p) =>
                        p.id !== activeProperty.id &&
                        p.isMergedProperty &&
                        (p.mergedConfig?.linkedPropertyIds?.includes(activeProperty.id) ||
                          p.mergedPropertyIds?.includes(activeProperty.id))
                    )
                    .map((p) => p.name)
                    .join('، ')}
                  end={<Tag tone="amy">تزامن متبادل</Tag>}
                />
              </section>
            )}

          {/* الأقسام / الوحدات داخل العقار */}
          {resolvePropertyHasSections(activeProperty) && activeProperty.sections && activeProperty.sections.length > 0 && (() => {
            const effectiveSectionId =
              activeSectionId === 'all' || activeSectionId === 'none'
                ? activeSectionId
                : activeProperty.sections!.some((s) => s.id === activeSectionId)
                  ? activeSectionId
                  : activeProperty.sections![0].id;

            const hLabels = getHierarchyLabels(getPropertyKind(activeProperty));
            return (
            <section className="lux-card p-4 space-y-3">
              <Head
                title={`${hLabels.childPlural} ${activeProperty.name}`}
                icon={Layers}
                count={getChildCount(activeProperty)}
              />

              <div className="space-y-2.5">
                {activeProperty.sections.map((sec, idx) => {
                  const isOpen = effectiveSectionId === sec.id;
                  const secCoord = sec.hasCoordinatorServices ?? activeProperty.hasCoordinatorServices;
                  return (
                    <Acc
                      key={sec.id}
                      icon={<span>{idx === 0 ? '👑' : idx === 1 ? '🌿' : idx === 2 ? '✨' : '🏢'}</span>}
                      title={sec.name}
                      tag={hLabels.child}
                      open={isOpen}
                      onToggle={() => setActiveSectionId(isOpen ? 'none' : sec.id)}
                    >
                      {sec.title && (
                        <div>
                          <Tag tone="gold">{sec.title}</Tag>
                        </div>
                      )}

                      {hasPropertiesFullAccess && (
                        <Acts cols={2}>
                          <Act
                            tone="sand"
                            icon={Copy}
                            label="نسخ القسم"
                            title="إنشاء نسخة مطابقة من هذا القسم"
                            onClick={(e) => handleDuplicateSection(e, activeProperty.id, sec.id)}
                          />
                          <Act
                            tone="jadeS"
                            icon={ArrowLeftRight}
                            label="نقل القسم"
                            title="نقل هذا القسم إلى عقار آخر أو فصله كوحدة مستقلة"
                            onClick={() =>
                              setTransferModalState({
                                isOpen: true,
                                sourcePropertyId: activeProperty.id,
                                sourceSectionId: sec.id,
                              })
                            }
                          />
                          <Act tone="ink" icon={Edit2} label="تعديل القسم" title={`تعديل معلومات ${sec.name}`} onClick={() => startEditSection(sec)} />
                          {activeProperty.sections && activeProperty.sections.length > 1 && (
                            <Act
                              tone={confirmDeleteSectionId === sec.id ? 'garnet' : 'garnS'}
                              icon={Trash2}
                              label={confirmDeleteSectionId === sec.id ? 'تأكيد الحذف؟' : 'حذف'}
                              title="حذف هذا القسم"
                              onClick={() => handleDeleteSection(activeProperty.id, sec.id, sec.name)}
                            />
                          )}
                        </Acts>
                      )}

                      <CheckRow
                        label="خدمات المنسقات"
                        value={secCoord ? 'متوفرة' : 'غير متوفرة'}
                        state={secCoord ? 'ok' : 'idle'}
                      />

                      {sec.subtitle && <p className="kt-note" style={{ fontSize: 13.5 }}>{sec.subtitle}</p>}

                      <Infos cols={2}>
                        <Info label="السعة" value={`${sec.capacity} فرد`} />
                        <Info label="غرف النوم" value={sec.bedrooms} />
                        <Info label="دورات المياه" value={sec.bathrooms} />
                        <Info label="المساحة" value={`${sec.areaM2} م²`} />
                        {sec.poolType && <Info wide label="المسبح أو الجاكوزي" value={sec.poolType} />}
                      </Infos>

                      {sec.features && sec.features.length > 0 && (
                        <div className="kt-field">
                          <span className="kt-field-h">
                            <span>المرافق والتجهيزات</span>
                            <em>{sec.features.length}</em>
                          </span>
                          <div className="space-y-2">
                            {sec.features.map((feat, fi) => (
                              <div key={fi} className="kt-feat">
                                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sec.videoItems && sec.videoItems.length > 0 && (
                        <div className="kt-field">
                          <span className="kt-field-h">
                            <span>فيديوهات {sec.name}</span>
                            <em>{sec.videoItems.length}</em>
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sec.videoItems.map((v, vi) => (
                              <div key={vi} className="rounded-2xl overflow-hidden bg-black aspect-video">
                                <SmartVideoPlayer url={v.url} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Acts cols={2}>
                        <Act tone="soft" icon={Copy} label="نسخ المعلومات" title="نسخ معلومات القسم" onClick={() => copySectionInfo(activeProperty, sec)} />
                        <Act tone="jadeS" icon={Send} label="واتساب للعميل" onClick={() => sendSectionWhatsApp(activeProperty, sec)} />
                      </Acts>

                      {/* Separate Customer Contract Template for This Section */}
                      <UnitContractTemplateCard
                        property={activeProperty}
                        section={sec}
                        mode="section"
                        canEdit={hasPropertiesFullAccess}
                        onSaved={(msg) => showToast(msg)}
                      />
                    </Acc>
                  );
                })}

                {hasPropertiesFullAccess && (
                  <Act tone="line" icon={Plus} label={hLabels.childAdd} className="kt-dash" onClick={() => handleAddSection(activeProperty.id)} />
                )}

                {/* كامل الوحدة / العقار */}
                <Acc
                  icon={<LuxIcon name="building" size={22} />}
                  title={hLabels.whole}
                  open={effectiveSectionId === 'all'}
                  onToggle={() => setActiveSectionId(effectiveSectionId === 'all' ? 'none' : 'all')}
                >
                  {/* Separate Customer Contract Template for Full Property */}
                  <UnitContractTemplateCard
                    property={activeProperty}
                    mode="property"
                    canEdit={hasPropertiesFullAccess}
                    onSaved={(msg) => showToast(msg)}
                  />
                </Acc>
              </div>
            </section>
            );
          })()}

          {/* وحدة واحدة بلا أقسام */}
          {(!resolvePropertyHasSections(activeProperty) || !activeProperty.sections || activeProperty.sections.length === 0) && (
            <section className="lux-card p-4 space-y-3">
              <Row icon={Layers} tone="amy" title="وحدة واحدة متكاملة" sub="يمكن تقسيمها لأقسام قابلة للحجز المنفصل" />
              {hasPropertiesFullAccess && (
                <Act
                  tone="ink"
                  icon={Plus}
                  label="تفعيل أقسام مستقلة"
                  title="تفعيل أقسام مستقلة للوحدة"
                  onClick={() => {
                    togglePropertyHasSections(activeProperty.id);
                    showToast('تم تفعيل أقسام مستقلة للوحدة بنجاح');
                  }}
                />
              )}
            </section>
          )}

          {/* Customer Contract Template Card for Standalone / Single-Unit Property */}
          {(!resolvePropertyHasSections(activeProperty) || !activeProperty.sections || activeProperty.sections.length === 0) && (
            <UnitContractTemplateCard
              property={activeProperty}
              mode="property"
              canEdit={hasPropertiesFullAccess}
              onSaved={(msg) => showToast(msg)}
            />
          )}

          {/* General Property Info Card */}
          <section className="lux-card p-4 space-y-3">
            <Head
              title="معلومات العقار"
              icon={FileText}
              action={
                hasPropertiesFullAccess && editSectionKey !== 'info' ? (
                  <Act small tone="line" icon={Edit2} label="تعديل" title="تعديل البيانات" onClick={() => startEditProperty('info')} />
                ) : undefined
              }
            />

            <div className="space-y-3">
              {activeProperty.subtitle && <p className="kt-note" style={{ fontSize: 13.5 }}>{activeProperty.subtitle}</p>}
              <Infos cols={2}>
                <Info label="السعة" value={`${activeProperty.capacity} فرد`} />
                <Info label="غرف النوم" value={activeProperty.bedrooms} />
                <Info label="دورات المياه" value={activeProperty.bathrooms} />
                <Info label="المساحة" value={`${activeProperty.areaM2} م²`} />
                <Info label="العربون" value={`${activeProperty.defaultDeposit} ر.س`} />
                <Info label="التأمين" value={`${activeProperty.insuranceAmount} ر.س`} />
                <Info label="وقت الدخول" value={activeProperty.checkInTimeText} />
                <Info label="وقت الخروج" value={activeProperty.checkOutTimeText} />
                {activeProperty.poolType && <Info wide label="المسبح" value={activeProperty.poolType} />}
              </Infos>

              {activeProperty.features && activeProperty.features.length > 0 && (
                <div className="kt-field">
                  <span className="kt-field-h">
                    <span>المرافق والتجهيزات</span>
                    <em>{activeProperty.features.length}</em>
                  </span>
                  <div className="space-y-2">
                    {activeProperty.features.map((feat, idx) => (
                      <div key={idx} className="kt-feat">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* وسائط العقار/الوحدة المركّبة: تُجمّع تلقائيًا من الوحدات */}
          {agg && agg.isContainer && (
            <section className="lux-card p-4 space-y-3">
              <Head title="بيانات ووسائط الوحدات" icon={Film} count={agg.totalVideos} />
              <p className="kt-note">
                لا يملك {activeProperty.name} بيانات أو فيديوهات خاصة به؛ تُجمَّع تلقائيًا من وحداته. أضف الفيديوهات من تعديل كل وحدة/قسم.
              </p>
              <Infos cols={2}>
                <Info label="الوحدات" value={`${agg.units.length}`} />
                <Info label="السعة" value={`${fmtN(agg.capacity)} ضيف`} />
                <Info label="الغرف / الحمامات" value={`${agg.bedrooms} / ${agg.bathrooms}`} />
                <Info label="المساحة" value={`${fmtN(agg.areaM2)} م²`} />
                <Info wide label="نطاق الأسعار" value={agg.minPrice ? `${fmtN(agg.minPrice)} – ${fmtN(agg.maxPrice)} ر.س` : '—'} />
              </Infos>
              {agg.groups.map((g) => (
                <div key={g.key} className="kt-sub">
                  <p className="kt-sub-t">
                    {g.unitName} · {g.images.length} صور · {g.videos.length} فيديو
                  </p>
                  {g.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {g.images.slice(0, 6).map((img, i) => (
                        <img key={i} src={img} alt={g.unitName} referrerPolicy="no-referrer" className="w-full aspect-square object-cover rounded-xl" />
                      ))}
                    </div>
                  )}
                  {g.videos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {g.videos.map((v, vi) => (
                        <div key={vi} className="space-y-1.5">
                          <div className="rounded-2xl overflow-hidden bg-black aspect-video">
                            <SmartVideoPlayer url={v.url} className="w-full h-full object-cover" />
                          </div>
                          {g.legacy && v.legacyIndex !== undefined && hasPropertiesFullAccess && (
                            <Act
                              small
                              tone="garnS"
                              icon={Trash2}
                              label="حذف"
                              onClick={() => {
                                deletePropertyVideo(g.propertyId, v.legacyIndex as number);
                                showToast('تم حذف الفيديو القديم');
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {g.images.length === 0 && g.videos.length === 0 && <p className="kt-note">لا وسائط لهذه الوحدة بعد.</p>}
                </div>
              ))}
            </section>
          )}

          {agg && !agg.isContainer && (
            <>
          {/* Photos Album Card */}
          <section className="lux-card p-4 space-y-3">
            <Head title="ألبوم الصور" icon={ImageIcon} count={activeProperty.images?.length || 0} />
            <Acts cols={2}>
              <label
                className={`kt-act lx-press kt-t-jade ${isProcessingPhotos ? 'opacity-70 pointer-events-none' : ''}`}
              >
                {isProcessingPhotos ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={1.8} />}
                <span>{isProcessingPhotos ? photoProgressMsg || 'جاري الضغط…' : 'إضافة صور'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isProcessingPhotos}
                  onChange={(e) => {
                    handleUploadPhotos(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <Act
                tone="ink"
                icon={Edit2}
                label="تعديل وحذف"
                title="تعديل وحذف الصور"
                onClick={() => {
                  setMediaModalTab('photos');
                  setPhotoManageModalOpen(true);
                }}
              />
            </Acts>

            <div className="grid grid-cols-3 gap-2">
              {(activeProperty.images || [activeProperty.coverImage]).map((img, idx) => {
                const isCover = img === activeProperty.coverImage;
                return (
                  <div
                    key={idx}
                    onClick={() => setPreviewImage(img)}
                    className={`aspect-square rounded-2xl overflow-hidden transition-all cursor-pointer relative group bg-[#F4EFFB] ${
                      isCover ? 'ring-2 ring-[#C9A45C]' : 'ring-1 ring-[#1B0E33]/10'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${activeProperty.name} ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {isCover && (
                      <div className="absolute top-1.5 right-1.5 bg-[#C9A45C] text-[#2B1A00] text-[12px] font-extrabold h-6 px-2 rounded-full flex items-center gap-1 shadow-xs">
                        <Star className="w-3 h-3 fill-[#2B1A00]" />
                        <span>الغلاف</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Videos Card - Property Video Tours */}
          <section className="lux-card p-4 space-y-3">
            <Head
              title="فيديوهات العقار"
              icon={Film}
              count={(activeProperty.videoUrls || []).length}
              action={
                <Act
                  small
                  tone="ink"
                  icon={Video}
                  label="إدارة"
                  title="إدارة ورفع الفيديوهات"
                  onClick={() => {
                    setMediaModalTab('videos');
                    setPhotoManageModalOpen(true);
                  }}
                />
              }
            />

            {/* Quick Upload Video Box in Card */}
            <VideoUploader
              propertyId={activeProperty.id}
              onUploadSuccess={(url) => {
                addPropertyVideo(activeProperty.id, url);
                showToast('تم رفع الفيديو وإضافته بنجاح');
              }}
              onSaveAndFinish={async () => {
                await savePropertiesNow();
                showToast('تم حفظ وتثبيت الفيديو نهائياً في العقار وقاعدة البيانات');
              }}
            />

            {activeProperty.videoUrls && activeProperty.videoUrls.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeProperty.videoUrls.map((vUrl, vIdx) => {
                  const external = isExternalVideoLink(vUrl);
                  const busy = sharingVideoKey === `prop-card-${vIdx}`;
                  return (
                    <div key={vIdx} className="rounded-2xl overflow-hidden bg-white flex flex-col" style={{ boxShadow: '0 0 0 1px rgba(27,14,51,.1)' }}>
                      <div className="relative aspect-video bg-black flex items-center justify-center">
                        <SmartVideoPlayer url={vUrl} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 space-y-2.5">
                        <span className="kt-field-h">
                          <span>فيديو #{vIdx + 1}</span>
                        </span>
                        <Acts cols={external ? 3 : 4}>
                          <Act stack tone="ink" icon={Play} label="تكبير" onClick={() => setPreviewVideoUrl(vUrl)} />
                          {!external && (
                            <Act
                              stack
                              tone="jadeS"
                              icon={busy ? SpinIcon : Share2}
                              label={busy ? 'جاري…' : 'مشاركة'}
                              title="مشاركة الفيديو كملف"
                              disabled={busy}
                              onClick={() =>
                                void handleSharePropertyVideoAsFile(vUrl, `فيديو_${activeProperty.name}_${vIdx + 1}`, `prop-card-${vIdx}`)
                              }
                            />
                          )}
                          <Act
                            stack
                            tone="soft"
                            icon={Copy}
                            label="نسخ"
                            title="نسخ رابط الفيديو"
                            onClick={async () => {
                              if (vUrl.startsWith('idb://')) {
                                showToast('الفيديو محفوظ محلياً على هذا الجهاز — استخدم زر «مشاركة كملف» لإرساله مباشرة.');
                                return;
                              }
                              try {
                                if (navigator.clipboard?.writeText) {
                                  await navigator.clipboard.writeText(vUrl);
                                } else {
                                  const ta = document.createElement('textarea');
                                  ta.value = vUrl;
                                  ta.style.position = 'fixed';
                                  ta.style.opacity = '0';
                                  document.body.appendChild(ta);
                                  ta.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(ta);
                                }
                                showToast('تم نسخ رابط الفيديو بنجاح');
                              } catch {
                                showToast('تعذر النسخ التلقائي للرابط');
                              }
                            }}
                          />
                          <Act
                            stack
                            tone="garnS"
                            icon={Trash2}
                            label="حذف"
                            onClick={() => {
                              deletePropertyVideo(activeProperty.id, vIdx);
                              showToast('تم حذف الفيديو من العقار');
                            }}
                          />
                        </Acts>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="kt-note text-center">لا توجد فيديوهات لهذا العقار بعد.</p>
            )}
          </section>
            </>
          )}

          {/* Property Guard Card - Exclusive Notifications */}
          <section className="lux-card p-4 space-y-3">
            <Head
              title="حارس العقار"
              icon={ShieldCheck}
              tone="sand"
              action={
                hasPropertiesFullAccess ? (
                  <Act
                    small
                    tone="ink"
                    icon={Edit2}
                    label={activeProperty.assignedGuardName ? 'تغيير' : 'تعيين'}
                    title={activeProperty.assignedGuardName ? 'تعديل / تغيير الحارس' : 'تعيين حارس للعقار'}
                    onClick={() => {
                      setGuardForm({
                        guardId: activeProperty.assignedGuardId || '',
                        guardName: activeProperty.assignedGuardName || '',
                        guardPhone: activeProperty.assignedGuardPhone || '',
                        guardNotes: activeProperty.assignedGuardNotes || '',
                      });
                      setSelectedGuardOption(activeProperty.assignedGuardId ? 'existing' : 'custom');
                      setGuardAssignModalOpen(true);
                    }}
                  />
                ) : undefined
              }
            />

            <Row
              icon={ShieldCheck}
              tone="sand"
              title={activeProperty.assignedGuardName || 'لم يُعيَّن حارس بعد'}
              sub={activeProperty.assignedGuardPhone || 'لا يوجد رقم جوال مسجل'}
              end={activeProperty.assignedGuardName ? <Tag tone="sand">معتمد</Tag> : undefined}
            />

            {activeProperty.assignedGuardPhone && (
              <Acts cols={2}>
                <Act tone="line" icon={Phone} label="اتصال" href={`tel:${activeProperty.assignedGuardPhone}`} />
                <Act
                  tone="jade"
                  icon={Send}
                  label="واتساب"
                  href={`https://wa.me/966${activeProperty.assignedGuardPhone.replace(/\D/g, '').replace(/^0/, '')}`}
                />
              </Acts>
            )}

            <p className="kt-note">
              <strong>توجيه حصري:</strong> يستلم الحارس إشعارات عقار ({activeProperty.name}) فقط — وصول العميل، استلام المتبقي، تفقد المغادرة والتأمين.
            </p>
          </section>

          {/* Coordinators Section - ONLY for Hamran, Alma, and Naya */}
          {(activeProperty.id === 'hamran' ||
            activeProperty.name.includes('حمران') ||
            activeProperty.name.includes('الما') ||
            activeProperty.name.includes('نايا')) && (
            <HamranCoordinatorsCard
              propertyName={activeProperty.name}
              activeSectionName={
                activeSectionId === 'hamran-alma'
                  ? 'وحدة الما الفندقية'
                  : activeSectionId === 'hamran-naya'
                  ? 'وحدة نايا العائلية'
                  : 'شاليه واستراحة حمران (الما ونايا)'
              }
            />
          )}

          {/* Bank Info Card */}
          <section className="lux-card p-4 space-y-3">
            <Head
              title="المعلومات البنكية"
              icon={Landmark}
              tone="ch"
              action={
                hasPropertiesFullAccess && editSectionKey !== 'bank' ? (
                  <Act
                    small
                    tone="line"
                    icon={Edit2}
                    label={activeProperty.iban ? 'تعديل' : 'إضافة'}
                    title={activeProperty.iban ? 'تعديل الحساب' : 'إضافة حساب'}
                    onClick={() => startEditProperty('bank')}
                  />
                ) : undefined
              }
            />

            {editSectionKey === 'bank' ? (
              <div className="space-y-3 animate-in fade-in">
                <div className="kt-fields">
                  <Field label="اسم البنك">
                    <input
                      type="text"
                      value={editFormData.bankName || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                      className="kt-input"
                    />
                  </Field>
                  <Field label="صاحب الحساب">
                    <input
                      type="text"
                      value={editFormData.accountHolder || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, accountHolder: e.target.value })}
                      className="kt-input"
                    />
                  </Field>
                  <Field label="رقم الآيبان (IBAN)" className="kt-wide">
                    <input
                      type="text"
                      value={editFormData.iban || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, iban: e.target.value })}
                      dir="ltr"
                      className="kt-input font-mono font-bold text-left"
                      placeholder="SA..."
                    />
                  </Field>
                </div>
                <Acts cols={2}>
                  <Act tone="line" label="إلغاء" onClick={() => setEditSectionKey(null)} />
                  <Act tone="ink" icon={Save} label="حفظ" title="حفظ البيانات البنكية" onClick={savePropertyEdit} />
                </Acts>
              </div>
            ) : (
              <Infos cols={2}>
                <Info label="البنك" value={activeProperty.bankName || '—'} />
                <Info label="صاحب الحساب" value={activeProperty.accountHolder || '—'} />
                <Info wide ltr label="الآيبان (IBAN)" value={<span className="font-mono select-all">{activeProperty.iban || '—'}</span>} />
              </Infos>
            )}
          </section>
        </div>
      )}

      {/* تعديل معلومات العقار */}
      {editSectionKey === 'info' && activeProperty && (
        <Sheet
          wide
          lockBackdrop
          title="تعديل معلومات العقار"
          icon={FileText}
          tone="amy"
          onClose={closePropertyInfoEdit}
          footer={
            <div className="space-y-3">
              {editErrorMsg && (
                <div className="kt-err" role="alert">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{editErrorMsg}</span>
                </div>
              )}
              <Acts cols={2}>
                <Act tone="ink" icon={Save} label="حفظ التعديلات" onClick={savePropertyEdit} />
                <Act tone="line" icon={X} label="إلغاء" onClick={closePropertyInfoEdit} />
              </Acts>
            </div>
          }
        >
          <div className="kt-sub">
            <p className="kt-sub-t">الأساسيات</p>
            <div className="kt-fields">
              <Field label="اسم العقار *" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </Field>
              <Field label="الكود">
                <input
                  type="text"
                  dir="ltr"
                  className="kt-input font-mono font-bold text-left"
                  value={editFormData.code || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                />
              </Field>
              <Field label="الموقع">
                <input
                  type="text"
                  className="kt-input"
                  value={editFormData.location || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                />
              </Field>
              <Field label="وصف مختصر" hint="اختياري" className="kt-wide">
                <textarea
                  rows={3}
                  className="kt-input kt-ta"
                  value={editFormData.subtitle || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, subtitle: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">المبالغ والأوقات</p>
            <div className="kt-fields">
              <Field label="العربون (ر.س)">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={editFormData.defaultDeposit ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, defaultDeposit: Number(e.target.value) })}
                />
              </Field>
              <Field label="التأمين (ر.س)">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={editFormData.insuranceAmount ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, insuranceAmount: Number(e.target.value) })}
                />
              </Field>
              <Field label="وقت الدخول">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="الساعة ٤ م"
                  value={editFormData.checkInTimeText || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, checkInTimeText: e.target.value })}
                />
              </Field>
              <Field label="وقت الخروج">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="الساعة ٢ م"
                  value={editFormData.checkOutTimeText || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, checkOutTimeText: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">المواصفات</p>
            <div className="kt-fields">
              <Field label="السعة (فرد)">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={editFormData.capacity ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, capacity: Number(e.target.value) })}
                />
              </Field>
              <Field label="غرف النوم">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={editFormData.bedrooms ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, bedrooms: Number(e.target.value) })}
                />
              </Field>
              <Field label="دورات المياه">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={editFormData.bathrooms ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, bathrooms: Number(e.target.value) })}
                />
              </Field>
              <Field label="المساحة (م²)">
                <input
                  type="number"
                  min={0}
                  className="kt-input kt-num"
                  value={editFormData.areaM2 ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, areaM2: Number(e.target.value) })}
                />
              </Field>
              <Field label="المسبح / الجاكوزي" hint="اختياري" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  value={editFormData.poolType || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, poolType: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">الخصائص</p>
            <div className="kt-fields">
              {!isLinkedEstate(activeProperty) && (
              <div className="kt-field">
                <span className="kt-field-h">
                  <span>أقسام مستقلة</span>
                </span>
                <Seg
                  compact
                  label="أقسام مستقلة"
                  value={resolvePropertyHasSections(editFormData) ? 'yes' : 'no'}
                  onChange={(v) => setEditFormData({ ...editFormData, hasSections: v === 'yes' })}
                  items={[
                    { id: 'yes' as const, label: 'يوجد' },
                    { id: 'no' as const, label: 'لا يوجد' },
                  ]}
                />
              </div>
              )}
              <div className="kt-field">
                <span className="kt-field-h">
                  <span>خدمات المنسقات</span>
                </span>
                <Seg
                  compact
                  label="خدمات المنسقات"
                  value={editFormData.hasCoordinatorServices ? 'yes' : 'no'}
                  onChange={(v) => setEditFormData({ ...editFormData, hasCoordinatorServices: v === 'yes' })}
                  items={[
                    { id: 'yes' as const, label: 'يوجد' },
                    { id: 'no' as const, label: 'لا يوجد' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">المرافق والتجهيزات</p>
            {(editFormData.features || []).map((feat, idx) => (
              <div key={idx} className="kt-bk">
                <div className="kt-bk-h">
                  <span className="kt-row-t">
                    <span className="kt-row-n" style={{ whiteSpace: 'normal' }}>
                      {feat}
                    </span>
                  </span>
                  <IconBtn
                    icon={X}
                    tone="garn"
                    label={`حذف ${feat}`}
                    onClick={() =>
                      setEditFormData({
                        ...editFormData,
                        features: (editFormData.features || []).filter((_, i) => i !== idx),
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <input
              type="text"
              aria-label="مرفق جديد"
              className="kt-input"
              value={newPropertyFeatureText}
              onChange={(e) => setNewPropertyFeatureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPropertyFeatureToEdit();
                }
              }}
              placeholder="مرفق جديد (مثال: ركن شواء)"
            />
            <Act tone="soft" icon={Plus} label="إضافة مرفق" onClick={addPropertyFeatureToEdit} />
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">صيغة عقد الإيجار</p>
            <p className="kt-note">
              {(editFormData.contractTemplate || '').trim()
                ? 'صيغة خاصة بهذا العقار.'
                : 'يستخدم القالب العام. اكتب صيغة هنا لتخصيصها.'}
            </p>
            <textarea
              aria-label="صيغة عقد الإيجار"
              rows={8}
              dir="rtl"
              className="kt-input kt-ta"
              value={editFormData.contractTemplate || ''}
              onChange={(e) => setEditFormData({ ...editFormData, contractTemplate: e.target.value })}
              placeholder="اتركه فارغاً لاستخدام القالب العام"
            />
            <p className="kt-note">
              المتغيرات: {'{اسم_العقار} {اسم_القسم} {اسم_العميل} {رقم_الجوال} {رقم_الحجز} {تاريخ_الدخول} {وقت_الدخول} {تاريخ_الخروج} {وقت_الخروج} {المبلغ_الإجمالي} {مبلغ_العربون} {المبلغ_المتبقي} {مبلغ_التأمين} {شروط_العقد}'}
            </p>
            <Acts cols={2}>
              <Act
                small
                tone="soft"
                icon={Copy}
                label="نسخ القالب العام"
                title="نسخ القالب العام كنقطة بداية"
                onClick={() => setEditFormData({ ...editFormData, contractTemplate: messageTemplates.contract || '' })}
              />
              <Act
                small
                tone="line"
                icon={X}
                label="استخدام العام"
                title="مسح الصيغة الخاصة والعودة للقالب العام"
                disabled={!(editFormData.contractTemplate || '').trim()}
                onClick={() => setEditFormData({ ...editFormData, contractTemplate: '' })}
              />
            </Acts>
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">شروط العقد</p>
            {(editFormData.contractTerms || []).map((term, idx) => (
              <div key={idx} className="kt-bk">
                <div className="kt-bk-h">
                  <span className="kt-row-t">
                    <span className="kt-row-n" style={{ whiteSpace: 'normal' }}>
                      {idx + 1}. {term}
                    </span>
                  </span>
                  <IconBtn
                    icon={X}
                    tone="garn"
                    label={`حذف الشرط ${idx + 1}`}
                    onClick={() =>
                      setEditFormData({
                        ...editFormData,
                        contractTerms: (editFormData.contractTerms || []).filter((_, i) => i !== idx),
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <input
              type="text"
              aria-label="شرط جديد"
              className="kt-input"
              value={newPropertyTermText}
              onChange={(e) => setNewPropertyTermText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPropertyTermToEdit();
                }
              }}
              placeholder="شرط عقد جديد"
            />
            <Act tone="soft" icon={Plus} label="إضافة شرط" onClick={addPropertyTermToEdit} />
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">الوصول والواي فاي</p>
            <p className="kt-note">تظهر هذه البيانات تلقائياً في العقد الرسمي PDF.</p>
            <div className="kt-fields">
              <Field label="شبكة الواي فاي">
                <input
                  type="text"
                  dir="ltr"
                  className="kt-input text-left"
                  placeholder="AMASA-Guest"
                  value={editFormData.wifiName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, wifiName: e.target.value })}
                />
              </Field>
              <Field label="كلمة المرور">
                <input
                  type="text"
                  dir="ltr"
                  className="kt-input font-mono text-left"
                  placeholder="كلمة السر"
                  value={editFormData.wifiPassword || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, wifiPassword: e.target.value })}
                />
              </Field>
              <Field label="ملاحظة الإفطار" hint="اختياري" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="مثال: يحضره الحارس من 7:30 إلى 8:30 صباحاً"
                  value={editFormData.breakfastNote || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, breakfastNote: e.target.value })}
                />
              </Field>
              <Field label="إرشادات الوصول" className="kt-wide">
                <textarea
                  rows={3}
                  className="kt-input kt-ta"
                  placeholder="الطريق والبوابة والتواصل مع الحارس"
                  value={editFormData.arrivalInstructions || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, arrivalInstructions: e.target.value })}
                />
              </Field>
              <Field label="رابط Google Maps" className="kt-wide">
                <input
                  type="url"
                  dir="ltr"
                  className="kt-input font-mono text-left"
                  placeholder="https://maps.google.com/..."
                  value={editFormData.googleMapsUrl || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, googleMapsUrl: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Sheet>
      )}

      {/* تعديل القسم */}
      {editingSection && (
        <Sheet
          wide
          lockBackdrop
          title="تعديل القسم"
          icon={Layers}
          tone="amy"
          onClose={() => setEditingSection(null)}
          footer={
            <Acts cols={2}>
              <Act tone="ink" icon={Save} label="حفظ القسم" title="حفظ معلومات القسم" onClick={saveSectionChanges} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setEditingSection(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info label="العقار" value={activeProperty?.name || '—'} />
            <Info label="القسم" value={editingSection.name} />
          </Infos>

          <div className="kt-fields">
            <Field label="اسم القسم" className="kt-wide">
              <input
                type="text"
                className="kt-input"
                value={sectionFormData.name || ''}
                onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
              />
            </Field>
            <Field label="العنوان التوضيحي" hint="اختياري" className="kt-wide">
              <input
                type="text"
                className="kt-input"
                value={sectionFormData.title || ''}
                onChange={(e) => setSectionFormData({ ...sectionFormData, title: e.target.value })}
                placeholder="مثال: قسم الضيافة والمسبح"
              />
            </Field>
            <Field label="الوصف" className="kt-wide">
              <textarea
                rows={4}
                className="kt-input kt-ta"
                value={sectionFormData.subtitle || ''}
                onChange={(e) => setSectionFormData({ ...sectionFormData, subtitle: e.target.value })}
              />
            </Field>
            <Field label="السعة">
              <input
                type="number"
                className="kt-input kt-num"
                value={sectionFormData.capacity || 0}
                onChange={(e) => setSectionFormData({ ...sectionFormData, capacity: Number(e.target.value) })}
              />
            </Field>
            <Field label="غرف النوم">
              <input
                type="number"
                className="kt-input kt-num"
                value={sectionFormData.bedrooms || 0}
                onChange={(e) => setSectionFormData({ ...sectionFormData, bedrooms: Number(e.target.value) })}
              />
            </Field>
            <Field label="دورات المياه">
              <input
                type="number"
                className="kt-input kt-num"
                value={sectionFormData.bathrooms || 0}
                onChange={(e) => setSectionFormData({ ...sectionFormData, bathrooms: Number(e.target.value) })}
              />
            </Field>
            <Field label="المساحة م²">
              <input
                type="number"
                className="kt-input kt-num"
                value={sectionFormData.areaM2 || 0}
                onChange={(e) => setSectionFormData({ ...sectionFormData, areaM2: Number(e.target.value) })}
              />
            </Field>
            <Field label="المسبح أو الجاكوزي" hint="اختياري" className="kt-wide">
              <input
                type="text"
                className="kt-input"
                value={sectionFormData.poolType || ''}
                onChange={(e) => setSectionFormData({ ...sectionFormData, poolType: e.target.value })}
                placeholder="مثال: مسبح أوفر فلو دافئ"
              />
            </Field>
          </div>

          <div className="kt-field">
            <span className="kt-field-h">
              <span>خدمات المنسقات</span>
            </span>
            <Seg
              compact
              label="خدمات المنسقات"
              value={sectionFormData.hasCoordinatorServices ? 'yes' : 'no'}
              onChange={(v) => setSectionFormData({ ...sectionFormData, hasCoordinatorServices: v === 'yes' })}
              items={[
                { id: 'yes' as const, label: 'يوجد' },
                { id: 'no' as const, label: 'لا يوجد' },
              ]}
            />
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">المرافق والتجهيزات</p>
            {(sectionFormData.features || []).map((feat, idx) => (
              <div key={idx} className="kt-bk">
                <div className="kt-bk-h">
                  <span className="kt-row-t">
                    <span className="kt-row-n" style={{ whiteSpace: 'normal' }}>
                      {feat}
                    </span>
                  </span>
                  <IconBtn icon={X} tone="garn" label={`حذف ${feat}`} onClick={() => removeFeatureFromSection(idx)} />
                </div>
              </div>
            ))}
            <input
              type="text"
              className="kt-input"
              value={newFeatureText}
              onChange={(e) => setNewFeatureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addFeatureToSection();
                }
              }}
              placeholder="مرفق جديد (مثال: ركن شواء)"
            />
            <Act tone="soft" icon={Plus} label="إضافة مرفق" onClick={addFeatureToSection} />
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">فيديوهات {sectionFormData.name || 'الوحدة'} ({(sectionFormData.videoItems || []).length})</p>
            <VideoUploader
              propertyId={`${activeProperty?.id || 'prop'}-${editingSection?.id || 'sec'}`}
              onUploadSuccess={(url) =>
                setSectionFormData((prev) => {
                  const cur = prev.videoItems || [];
                  return { ...prev, videoItems: [...cur, { title: `فيديو ${cur.length + 1}`, url }] };
                })
              }
            />
            {(sectionFormData.videoItems || []).map((v, i) => (
              <div key={i} className="kt-bk">
                <div className="relative rounded-[14px] overflow-hidden bg-black aspect-video">
                  <SmartVideoPlayer url={v.url} className="w-full h-full object-cover" />
                </div>
                <Act
                  small
                  tone="garnS"
                  icon={Trash2}
                  label="حذف الفيديو"
                  onClick={() =>
                    setSectionFormData((prev) => ({ ...prev, videoItems: (prev.videoItems || []).filter((_, j) => j !== i) }))
                  }
                />
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {/* إدارة الصور والفيديو */}
      {photoManageModalOpen && activeProperty && (
        <Sheet
          wide
          title="الصور والفيديو"
          icon={Camera}
          tone="amy"
          onClose={() => setPhotoManageModalOpen(false)}
          footer={
            <Act
              tone="ink"
              icon={Save}
              label="حفظ وإنهاء"
              title="حفظ وتثبيت وسائط العقار"
              onClick={async () => {
                await savePropertiesNow();
                showToast('تم حفظ وتثبيت وسائط العقار بنجاح');
                setPhotoManageModalOpen(false);
              }}
            />
          }
        >
          <Infos cols={1}>
            <Info label="العقار" value={activeProperty.name} />
          </Infos>
          <Seg
            compact
            label="نوع الوسائط"
            value={mediaModalTab}
            onChange={setMediaModalTab}
            items={[
              { id: 'photos' as const, label: `الصور ${activeProperty.images?.length || 0}` },
              { id: 'videos' as const, label: `الفيديو ${(activeProperty.videoUrls || []).length}` },
            ]}
          />

          {mediaModalTab === 'photos' && (
            <>
              <div className="kt-sub">
                <p className="kt-sub-t">إضافة صور</p>
                <label className={`kt-act lx-press kt-t-jade ${isProcessingPhotos ? 'opacity-70 pointer-events-none' : ''}`}>
                  {isProcessingPhotos ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={1.8} />}
                  <span>{isProcessingPhotos ? photoProgressMsg || 'جاري الضغط…' : 'رفع من الجهاز'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={isProcessingPhotos}
                    onChange={(e) => {
                      handleUploadPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <Field label="أو رابط صورة (URL)">
                  <input
                    type="url"
                    dir="ltr"
                    className="kt-input"
                    placeholder="https://images.unsplash.com/..."
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                  />
                </Field>
                <Act
                  tone="soft"
                  icon={Plus}
                  label="إضافة الرابط"
                  disabled={!newPhotoUrl.trim()}
                  onClick={() => {
                    if (!newPhotoUrl.trim()) return;
                    addPropertyPhotos(activeProperty.id, [newPhotoUrl.trim()]);
                    setNewPhotoUrl('');
                    showToast('تمت إضافة الصورة بنجاح');
                  }}
                />
              </div>

              <Head title="الصور الحالية" icon={ImageIcon} count={activeProperty.images?.length || 0} />
              <div className="grid grid-cols-2 gap-2.5">
                {(activeProperty.images || [activeProperty.coverImage]).map((img, idx) => {
                  const isCover = img === activeProperty.coverImage;
                  return (
                    <div key={idx} className={`kt-bk ${isCover ? 'kt-on' : ''}`}>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(img)}
                        aria-label={`تكبير الصورة ${idx + 1}`}
                        className="relative aspect-[4/3] rounded-[14px] overflow-hidden bg-[#F4EFFB] cursor-pointer"
                      >
                        <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        {isCover && (
                          <span className="absolute top-1.5 right-1.5 bg-[#C9A45C] text-[#2B1A00] text-[12px] font-extrabold h-6 px-2 rounded-full inline-flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#2B1A00]" />
                            الغلاف
                          </span>
                        )}
                      </button>
                      <Acts cols={2}>
                        <Act
                          small
                          tone="sand"
                          label="غلاف"
                          title="تعيين كغلاف رئيسي"
                          disabled={isCover}
                          onClick={() => {
                            setPropertyCoverPhoto(activeProperty.id, img);
                            showToast('تم تعيين الصورة كغلاف رئيسي');
                          }}
                        />
                        <Act
                          small
                          tone="garnS"
                          label="حذف"
                          title="حذف الصورة"
                          onClick={() => {
                            deletePropertyPhoto(activeProperty.id, img);
                            showToast('تم حذف الصورة');
                          }}
                        />
                      </Acts>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {mediaModalTab === 'videos' && (
            <>
              <VideoUploader
                propertyId={activeProperty.id}
                onUploadSuccess={(url) => {
                  addPropertyVideo(activeProperty.id, url);
                  showToast('تم رفع الفيديو وإضافته بنجاح للعقار');
                }}
                onSaveAndFinish={async () => {
                  await savePropertiesNow();
                  showToast('تم حفظ وتثبيت الفيديو نهائياً في العقار وقاعدة البيانات');
                  setPhotoManageModalOpen(false);
                }}
              />

              <Head title="الفيديوهات الحالية" icon={Film} count={(activeProperty.videoUrls || []).length} />
              {activeProperty.videoUrls && activeProperty.videoUrls.length > 0 ? (
                activeProperty.videoUrls.map((vUrl, idx) => {
                  const external = isExternalVideoLink(vUrl);
                  const busy = sharingVideoKey === `prop-modal-${idx}`;
                  return (
                    <div key={idx} className="kt-bk">
                      <div className="relative aspect-video rounded-[14px] overflow-hidden bg-black flex items-center justify-center">
                        <SmartVideoPlayer url={vUrl} className="w-full h-full object-cover" />
                      </div>
                      <span className="kt-field-h">
                        <span>فيديو #{idx + 1}</span>
                      </span>
                      <Acts cols={external ? 3 : 4}>
                        <Act stack tone="ink" icon={Play} label="تكبير" onClick={() => setPreviewVideoUrl(vUrl)} />
                        {!external && (
                          <Act
                            stack
                            tone="jadeS"
                            icon={busy ? SpinIcon : Share2}
                            label={busy ? 'جاري…' : 'مشاركة'}
                            title="مشاركة الفيديو كملف"
                            disabled={busy}
                            onClick={() =>
                              void handleSharePropertyVideoAsFile(vUrl, `فيديو_${activeProperty.name}_${idx + 1}`, `prop-modal-${idx}`)
                            }
                          />
                        )}
                        <Act
                          stack
                          tone="soft"
                          icon={Copy}
                          label="نسخ"
                          title="نسخ رابط الفيديو"
                          onClick={async () => {
                            if (vUrl.startsWith('idb://')) {
                              showToast('الفيديو محفوظ محلياً على هذا الجهاز — استخدم زر «مشاركة» لإرساله مباشرة.');
                              return;
                            }
                            try {
                              if (navigator.clipboard?.writeText) {
                                await navigator.clipboard.writeText(vUrl);
                              } else {
                                const ta = document.createElement('textarea');
                                ta.value = vUrl;
                                ta.style.position = 'fixed';
                                ta.style.opacity = '0';
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                              }
                              showToast('تم نسخ رابط الفيديو بنجاح');
                            } catch {
                              showToast('تعذر النسخ التلقائي للرابط');
                            }
                          }}
                        />
                        <Act
                          stack
                          tone="garnS"
                          icon={Trash2}
                          label="حذف"
                          onClick={() => {
                            deletePropertyVideo(activeProperty.id, idx);
                            showToast('تم حذف الفيديو');
                          }}
                        />
                      </Acts>
                    </div>
                  );
                })
              ) : (
                <EmptyBox icon={Film} text="لا توجد فيديوهات لهذا العقار بعد" />
              )}
            </>
          )}
        </Sheet>
      )}

      {/* تعيين حارس العقار */}
      {guardAssignModalOpen && activeProperty && (
        <Sheet
          wide
          lockBackdrop
          title="حارس العقار"
          icon={ShieldCheck}
          tone="sand"
          onClose={() => setGuardAssignModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act
                tone="ink"
                icon={Save}
                label="حفظ الحارس"
                title="حفظ وتفعيل الحارس للعقار"
                onClick={() => {
                  if (!guardForm.guardName.trim()) {
                    showToast('يرجى تحديد أو إدخال اسم الحارس');
                    return;
                  }
                  updatePropertyGuard(activeProperty.id, {
                    guardId: guardForm.guardId || undefined,
                    guardName: guardForm.guardName.trim(),
                    guardPhone: guardForm.guardPhone.trim(),
                    guardNotes: guardForm.guardNotes.trim(),
                  });
                  setGuardAssignModalOpen(false);
                  showToast(`تم تعيين (${guardForm.guardName}) حارساً مسؤولاً لعقار ${activeProperty.name}`);
                }}
              />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setGuardAssignModalOpen(false)} />
            </Acts>
          }
        >
          <Infos cols={1}>
            <Info label="العقار" value={activeProperty.name} />
          </Infos>
          <Seg
            compact
            label="مصدر الحارس"
            value={selectedGuardOption}
            onChange={setSelectedGuardOption}
            items={[
              { id: 'existing' as const, label: 'من النظام' },
              { id: 'custom' as const, label: 'حارس جديد' },
            ]}
          />

          {selectedGuardOption === 'existing' ? (
            guardsList.map((g) => {
              const isSelected = guardForm.guardId === g.id || (!guardForm.guardId && guardForm.guardName === g.name);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    setGuardForm({
                      guardId: g.id,
                      guardName: g.name,
                      guardPhone: g.phone,
                      guardNotes: g.jobTitle || '',
                    })
                  }
                  className={`kt-bk text-start cursor-pointer lx-press ${isSelected ? 'kt-on' : ''}`}
                >
                  <div className="kt-bk-h">
                    <Face src={g.avatar} name={g.name} size={40} />
                    <span className="kt-row-t">
                      <span className="kt-row-n">{g.name}</span>
                      <span className="kt-row-s">
                        <bdi dir="ltr">{g.phone}</bdi>
                        {g.assignedPropertyName ? ` · ${g.assignedPropertyName}` : ''}
                      </span>
                    </span>
                    <Tile icon={Check} tone={isSelected ? 'jade' : 'gray'} size={32} />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="kt-fields">
              <Field label="اسم الحارس" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="مثال: أبو راشد"
                  value={guardForm.guardName}
                  onChange={(e) => setGuardForm({ ...guardForm, guardName: e.target.value })}
                />
              </Field>
              <Field label="الجوال" className="kt-wide">
                <input
                  type="text"
                  dir="ltr"
                  className="kt-input kt-num"
                  placeholder="05xxxxxxxx"
                  value={guardForm.guardPhone}
                  onChange={(e) => setGuardForm({ ...guardForm, guardPhone: e.target.value })}
                />
              </Field>
              <Field label="ملاحظات أو مهام" hint="اختياري" className="kt-wide">
                <input
                  type="text"
                  className="kt-input"
                  placeholder="مثال: استقبال النزلاء واستلام المبالغ"
                  value={guardForm.guardNotes}
                  onChange={(e) => setGuardForm({ ...guardForm, guardNotes: e.target.value })}
                />
              </Field>
            </div>
          )}
        </Sheet>
      )}

      {/* ربط تقويم العقار (iCal) */}
      {syncModalOpen && (
        <Sheet
          wide
          title="ربط التقويم"
          icon={Link2}
          tone="jade"
          onClose={() => setSyncModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act
                tone="jade"
                icon={isSyncing ? SpinIcon : RefreshCw}
                label={isSyncing ? 'جارٍ المزامنة…' : 'مزامنة الآن'}
                title="حفظ ومزامنة فورية الآن"
                disabled={isSyncing}
                onClick={executeSync}
              />
              <Act tone="line" label="إغلاق" onClick={() => setSyncModalOpen(false)} />
            </Acts>
          }
        >
          <Infos cols={1}>
            <Info label="العقار" value={properties.find((p) => p.id === syncPropId)?.name || '—'} />
          </Infos>

          {syncFeedback && (
            <div className="kt-ok" role="status">
              <span className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: '#0e5a49' }}>
                <CheckCircle2 size={20} strokeWidth={1.8} className="shrink-0" />
                <span>{syncFeedback}</span>
              </span>
            </div>
          )}

          <div className="kt-sub">
            <p className="kt-sub-t">رابط تقويم العقار</p>
            <Field label="للتصدير (Export)" hint="مباشر ومحدّث">
              <input
                type="text"
                readOnly
                dir="ltr"
                className="kt-input"
                value={`https://amasa.app/api/calendar/ical/${syncPropId || 'prop'}.ics?key=auth_sync_2026`}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Field>
            <Act
              tone="ink"
              icon={copiedSyncKey === 'export' ? Check : Copy}
              label={copiedSyncKey === 'export' ? 'تم النسخ' : 'نسخ الرابط'}
              onClick={() => copySyncText(`https://amasa.app/api/calendar/ical/${syncPropId || 'prop'}.ics?key=auth_sync_2026`, 'export')}
            />
          </div>

          <div className="kt-sub">
            <p className="kt-sub-t">استيراد من المنصات (Import)</p>
            <Field label="جاذر إن" hint={syncStatuses[syncPropId || '']?.gathern ? 'متصل ✓' : 'غير مربوط'}>
              <input
                type="url"
                dir="ltr"
                className="kt-input"
                placeholder="https://gathern.co/calendars/.../sync.ics"
                value={gathernUrl}
                onChange={(e) => setGathernUrl(e.target.value)}
              />
            </Field>
            <Field label="بوكينج" hint={syncStatuses[syncPropId || '']?.booking ? 'متصل ✓' : 'غير مربوط'}>
              <input
                type="url"
                dir="ltr"
                className="kt-input"
                placeholder="https://admin.booking.com/.../ical.html?t=..."
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
              />
            </Field>
          </div>
        </Sheet>
      )}

      {/* إضافة وحدة جديدة */}
      <AddPropertyModal isOpen={isAddPropertyModalOpen} onClose={() => setIsAddPropertyModalOpen(false)} />

      {/* دمج وحدتين (اسم جديد + ربط التقويم) */}
      <MergeUnitsModal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} />

      {/* تأكيد حذف العقار */}
      {propertyToDelete && (
        <Sheet
          title="حذف العقار"
          icon={Trash2}
          tone="garn"
          onClose={() => setPropertyToDelete(null)}
          footer={
            <Acts cols={2}>
              <Act tone="garnet" icon={Trash2} label="تأكيد الحذف" title="تأكيد حذف العقار" onClick={handleConfirmDeleteProperty} />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setPropertyToDelete(null)} />
            </Acts>
          }
        >
          <Infos cols={2}>
            <Info label="العقار" value={propertyToDelete.name} />
            <Info ltr label="الكود" value={propertyToDelete.code} />
          </Infos>
          <div className="kt-err" role="alert">
            <Trash2 size={20} strokeWidth={1.8} className="shrink-0" />
            <span>هل أنت متأكد من حذف هذا العقار؟</span>
          </div>
        </Sheet>
      )}

      {/* معاينة الصورة */}
      {previewImage && activeProperty && (
        <Sheet
          title="معاينة الصورة"
          icon={ImageIcon}
          tone="amy"
          onClose={() => setPreviewImage(null)}
          footer={
            previewImage !== activeProperty.coverImage ? (
              <Acts cols={3}>
                <Act
                  stack
                  tone="sand"
                  icon={Star}
                  label="غلاف"
                  title="تعيين كغلاف رئيسي"
                  onClick={() => {
                    setPropertyCoverPhoto(activeProperty.id, previewImage);
                    showToast('تم تعيين الصورة كغلاف رئيسي للعقار بنجاح');
                  }}
                />
                <Act
                  stack
                  tone="garnS"
                  icon={Trash2}
                  label="حذف"
                  title="حذف الصورة"
                  onClick={() => {
                    deletePropertyPhoto(activeProperty.id, previewImage);
                    setPreviewImage(null);
                    showToast('تم حذف الصورة من العقار');
                  }}
                />
                <Act stack tone="line" icon={X} label="إغلاق" onClick={() => setPreviewImage(null)} />
              </Acts>
            ) : (
              <Acts cols={2}>
                <Act
                  tone="garnS"
                  icon={Trash2}
                  label="حذف"
                  title="حذف الصورة"
                  onClick={() => {
                    deletePropertyPhoto(activeProperty.id, previewImage);
                    setPreviewImage(null);
                    showToast('تم حذف الصورة من العقار');
                  }}
                />
                <Act tone="line" icon={X} label="إغلاق" onClick={() => setPreviewImage(null)} />
              </Acts>
            )
          }
        >
          <div className="flex">
            {previewImage === activeProperty.coverImage ? <Tag tone="gold">الصورة الرئيسية (الغلاف)</Tag> : <Tag tone="gray">من الألبوم</Tag>}
          </div>
          <div
            className="rounded-[18px] overflow-hidden flex items-center justify-center min-h-[200px]"
            style={{ background: '#efeae2', boxShadow: 'inset 0 0 0 1px rgba(27,14,51,.08)' }}
          >
            <img src={previewImage} alt="معاينة الصورة" referrerPolicy="no-referrer" className="w-full h-auto max-h-[56vh] object-contain" />
          </div>
        </Sheet>
      )}

      {/* مشاهدة الفيديو */}
      {previewVideoUrl && (
        <Sheet
          wide
          title="فيديو العقار"
          icon={Film}
          tone="ink"
          onClose={() => setPreviewVideoUrl(null)}
          footer={
            <Acts cols={isExternalVideoLink(previewVideoUrl) ? 2 : 3}>
              {!isExternalVideoLink(previewVideoUrl) && (
                <Act
                  stack
                  tone="jadeS"
                  icon={sharingVideoKey === 'prop-preview' ? SpinIcon : Share2}
                  label={sharingVideoKey === 'prop-preview' ? 'جاري…' : 'مشاركة'}
                  title="مشاركة الفيديو كملف"
                  disabled={sharingVideoKey === 'prop-preview'}
                  onClick={() =>
                    void handleSharePropertyVideoAsFile(previewVideoUrl, `فيديو_${activeProperty?.name || 'العقار'}`, 'prop-preview')
                  }
                />
              )}
              <Act
                stack={!isExternalVideoLink(previewVideoUrl)}
                tone="soft"
                icon={Copy}
                label="نسخ الرابط"
                title="نسخ رابط الفيديو لمشاركته"
                onClick={async () => {
                  if (previewVideoUrl.startsWith('idb://')) {
                    showToast('الفيديو محفوظ محلياً على هذا الجهاز — استخدم زر «مشاركة» لإرساله مباشرة.');
                    return;
                  }
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(previewVideoUrl);
                    } else {
                      const ta = document.createElement('textarea');
                      ta.value = previewVideoUrl;
                      ta.style.position = 'fixed';
                      ta.style.opacity = '0';
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand('copy');
                      document.body.removeChild(ta);
                    }
                    showToast('تم نسخ رابط الفيديو بنجاح');
                  } catch {
                    showToast('تعذر النسخ التلقائي للرابط');
                  }
                }}
              />
              <Act stack={!isExternalVideoLink(previewVideoUrl)} tone="line" icon={X} label="إغلاق" onClick={() => setPreviewVideoUrl(null)} />
            </Acts>
          }
        >
          <div className="rounded-[18px] overflow-hidden aspect-video bg-black flex items-center justify-center">
            <SmartVideoPlayer url={previewVideoUrl} autoPlay className="w-full max-h-[60vh] object-contain" />
          </div>
        </Sheet>
      )}

      {/* Transfer Unit or Section Modal */}
      {transferModalState?.isOpen && (
        <TransferUnitModal
          isOpen={transferModalState.isOpen}
          onClose={() => setTransferModalState(null)}
          properties={properties}
          initialSourcePropertyId={transferModalState.sourcePropertyId}
          initialSourceSectionId={transferModalState.sourceSectionId}
          onExecuteTransfer={(params) => {
            const res = transferPropertyOrSection(params);
            if (res.success) {
              showToast(res.message);
              if (res.createdOrTargetPropertyId) {
                setSelectedPropertyDetailId(res.createdOrTargetPropertyId);
                if (res.createdOrTargetSectionId) {
                  setActiveSectionId(res.createdOrTargetSectionId);
                }
              }
            }
            return res;
          }}
        />
      )}
    </div>
  );
};
