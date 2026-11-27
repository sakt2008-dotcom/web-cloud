import React, { useState } from 'react';
import { PartyPopper, Sparkles, Phone, MessageCircle, CheckCircle2, Plus, Send, X, Layers } from 'lucide-react';
import { INITIAL_COORDINATORS, INITIAL_COORDINATION_TASKS } from '../../data/mock';
import { Coordinator, CoordinationTask } from '../../types';
import { useApp } from '../../context/AppContext';
import { buildCustomerWhatsappUrl, openExternalUrlSafely } from '../../lib/customerLinks';
import { Sheet, Head, Row, Acts, Act, Field, Tag, Tile, Face } from '../ui/kit';
import { fmtN, localTodayStr } from '../../lib/format';

interface HamranCoordinatorsCardProps {
  propertyName: string;
  activeSectionName?: string;
  onOpenBookingWithCoord?: (coordinatorName: string, serviceTitle: string) => void;
}

export const HamranCoordinatorsCard: React.FC<HamranCoordinatorsCardProps> = ({
  propertyName,
  activeSectionName,
  onOpenBookingWithCoord,
}) => {
  const { coordinators } = useApp();

  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState<Coordinator>(coordinators[0] || INITIAL_COORDINATORS[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('05');
  const [serviceDate, setServiceDate] = useState(() => localTodayStr());
  const [packageType, setPackageType] = useState('باقة كوشة وضيافة ملكية VIP');
  const [notes, setNotes] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const packages = [
    {
      id: 'pkg-1',
      title: 'باقة كوشة وضيافة ملكية VIP',
      price: 1500,
      description: 'كوشة ورد طبيعي منسق بألوان الموف والأبيض، طاولة ضيافة فخمة ومباخر عود فاخرة.',
      suitableFor: 'وحدة الما ووحدة نايا',
      coordinator: coordinators[0]?.name || 'منى الحربي',
    },
    {
      id: 'pkg-2',
      title: 'باقة تزيين مسبح وإضاءة بالونات',
      price: 1200,
      description: 'بالونات هيليوم فاخرة محيطة بالمسبح، شعلات ليزر مضيئة، وكيكة مناسبة مخصصة.',
      suitableFor: 'المسبح الفيروزي في الما ونايا',
      coordinator: coordinators[1]?.name || 'لمى السبيعي',
    },
    {
      id: 'pkg-3',
      title: 'باقة استقبال عرسان خاصة',
      price: 950,
      description: 'مسار ورد جوري أحمر، شموع إلكترونية آمنة، وضيافة شوكولاتة باتشي فاخرة.',
      suitableFor: 'غرفة النوم الماستر وجلسة الاستجمام',
      coordinator: coordinators[1]?.name || 'لمى السبيعي',
    },
    {
      id: 'pkg-4',
      title: 'باقة ضيافة نجدية وقهوة وشاي',
      price: 800,
      description: 'طاولة خشبية نجدية، دلال قهوة شقراء، تمور فاخرة محشية، ومكسرات محمصة.',
      suitableFor: 'صالة الضيافة والمجلس العائلي',
      coordinator: coordinators[2]?.name || 'شهد التميمي',
    },
  ];

  const currentUnitLabel = activeSectionName || 'شاليه واستراحة حمران (الما ونايا)';

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;

    const newTask: CoordinationTask = {
      id: `ct-${Date.now()}`,
      bookingCode: `BK-HAMRAN-${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      propertyName: `حمران (${currentUnitLabel})`,
      date: serviceDate,
      serviceTitle: packageType,
      serviceDetails: notes.trim() || `طلب تنسيق خاص لشاليه ${currentUnitLabel}`,
      coordinatorId: selectedCoord.id,
      coordinatorName: selectedCoord.name,
      coordinatorPhone: selectedCoord.phone,
      status: 'in_progress',
      price: packages.find((p) => p.title === packageType)?.price || 1000,
    };

    try {
      const existing = localStorage.getItem('amasa_coordination_tasks');
      const parsed = existing ? JSON.parse(existing) : INITIAL_COORDINATION_TASKS;
      localStorage.setItem('amasa_coordination_tasks', JSON.stringify([newTask, ...parsed]));
    } catch {}

    const whatsappMsg = `السلام عليكم أختي ${selectedCoord.name}، لدينا طلب تنسيق جديد في شاليه حمران (${currentUnitLabel}):\n- الخدمة: ${packageType}\n- العميل: ${customerName}\n- الجوال: ${customerPhone}\n- التاريخ: ${serviceDate}\n${notes ? `- ملاحظات: ${notes}` : ''}`;
    const whatsappUrl = buildCustomerWhatsappUrl(selectedCoord.phone, whatsappMsg);

    setSuccessToast(`تم إرسال طلب التنسيق للمنسقة (${selectedCoord.name}) بنجاح!`);
    setRequestModalOpen(false);
    setCustomerName('');
    setNotes('');

    openExternalUrlSafely(whatsappUrl);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const shortUnit = currentUnitLabel.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim() || currentUnitLabel;
  const shortPkg = (t: string) => t.replace(/^باقة\s+/, '');
  const pkgNote = packages.find((p) => p.title === packageType)?.description;

  return (
    <>
      <section className="lux-card p-4 space-y-3">
        {successToast && (
          <div className="kt-ok" role="status">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-[#2E9E86] shrink-0" />
              <span className="flex-1 min-w-0 text-[14px] font-extrabold text-[#0E5A49]">{successToast}</span>
              <button type="button" onClick={() => setSuccessToast(null)} className="kt-err-x" aria-label="إغلاق التنبيه">
                ✕
              </button>
            </div>
          </div>
        )}

        <Head
          title="منسقات حمران"
          icon={PartyPopper}
          tone="ch"
          count={coordinators.length}
          action={<Act small tone="ink" icon={Plus} label="طلب تجهيز" title="طلب تجهيز للمكان" onClick={() => setRequestModalOpen(true)} />}
        />
        <p className="kt-note">الكوش والضيافة وتزيين المسابح لوحدتي الما ونايا.</p>
        <Row icon={Layers} tone="amy" title="الوحدة المحددة" sub={shortUnit} end={<Tag tone="jade">جاهز</Tag>} />

        {/* المنسقات */}
        {coordinators.map((c) => (
          <div key={c.id} className="kt-bk">
            <div className="kt-bk-h">
              <Face src={c.avatar} name={c.name} size={48} />
              <span className="kt-row-t">
                <span className="kt-row-n">{c.name}</span>
                <span className="kt-row-s">
                  {c.completedTasks} حفل — {c.specialty}
                </span>
              </span>
              <Tag tone="gold">
                <bdi dir="ltr">{c.rating.toFixed(1)} ★</bdi>
              </Tag>
            </div>
            <Acts cols={2}>
              <Act small tone="soft" icon={Phone} label="اتصال" title={`اتصال بـ ${c.name}`} href={`tel:${c.phone}`} />
              <Act
                small
                tone="jadeS"
                icon={MessageCircle}
                label="واتساب"
                title={`واتساب ${c.name}`}
                href={`https://wa.me/966${c.phone.replace(/^0/, '')}?text=${encodeURIComponent(`مرحباً أختي ${c.name}، نود التنسيق لتجهيز شاليه حمران (${currentUnitLabel}) لحجز قادم:`)}`}
              />
            </Acts>
          </div>
        ))}

        {/* الباقات */}
        <Head title="الباقات المعتمدة" icon={Sparkles} count={packages.length} />
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            aria-pressed={selectedPackage === pkg.id}
            className={`kt-bk w-full text-start cursor-pointer lx-press ${selectedPackage === pkg.id ? 'kt-on' : ''}`}
            onClick={() => {
              setSelectedPackage(pkg.id);
              setPackageType(pkg.title);
              const matched = coordinators.find((c) => c.name === pkg.coordinator) || coordinators[0];
              setSelectedCoord(matched);
              setRequestModalOpen(true);
            }}
          >
            <div className="kt-bk-h">
              <Tile icon={Sparkles} tone="ch" size={40} />
              <span className="kt-row-t">
                <span className="kt-row-n">{shortPkg(pkg.title)}</span>
                <span className="kt-row-s">المنسقة: {pkg.coordinator}</span>
              </span>
              <Tag tone="jade">{fmtN(pkg.price)} ر.س</Tag>
            </div>
          </button>
        ))}
      </section>

      {requestModalOpen && (
        <Sheet
          title="طلب تنسيق وتجهيز"
          icon={PartyPopper}
          tone="ch"
          onClose={() => setRequestModalOpen(false)}
          footer={
            <Acts cols={2}>
              <Act submit form="hamran-req-form" tone="ink" icon={Send} label="إرسال للمنسقة" title="إرسال الطلب والتواصل عبر واتساب" />
              <Act tone="line" icon={X} label="إلغاء" onClick={() => setRequestModalOpen(false)} />
            </Acts>
          }
        >
          <form id="hamran-req-form" onSubmit={handleSendRequest} className="kt-fields">
            <p className="kt-note kt-wide">الوحدة: {shortUnit}</p>
            <Field label="الباقة *" className="kt-wide">
              <select value={packageType} onChange={(e) => setPackageType(e.target.value)} className="kt-input">
                {packages.map((p) => (
                  <option key={p.id} value={p.title}>
                    {shortPkg(p.title)} — {fmtN(p.price)} ر.س
                  </option>
                ))}
                <option value="تنسيق وتجهيز مخصص حسب رغبة العميل">تنسيق مخصص</option>
              </select>
            </Field>
            {pkgNote && <p className="kt-note kt-wide">{pkgNote}</p>}
            <Field label="المنسقة *" className="kt-wide">
              <select
                value={selectedCoord.id}
                onChange={(e) => {
                  const c = coordinators.find((coord) => coord.id === e.target.value) || coordinators[0];
                  setSelectedCoord(c);
                }}
                className="kt-input"
              >
                {coordinators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="اسم النزيل *" className="kt-wide">
              <input type="text" required placeholder="اسم النزيل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="kt-input" />
            </Field>
            <Field label="الجوال *">
              <input type="tel" required placeholder="05xxxxxxxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="kt-input kt-num" />
            </Field>
            <Field label="التاريخ *">
              <input type="date" required value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="kt-input" />
            </Field>
            <Field label="ملاحظات" className="kt-wide">
              <textarea rows={3} placeholder="مثال: تجهيز الكوشة قبل 3 عصراً" value={notes} onChange={(e) => setNotes(e.target.value)} className="kt-input kt-ta" />
            </Field>
          </form>
        </Sheet>
      )}
    </>
  );
};
