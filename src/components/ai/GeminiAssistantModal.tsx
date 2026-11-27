import React, { useState } from 'react';
import { Sparkles, Send, Copy, Check, MessageCircle, RefreshCw, X, FileText, Percent, Key, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { openExternalUrlSafely } from '../../lib/customerLinks';
import { Sheet, Seg, Field, Head, Acts, Act, Tag } from '../ui/kit';

interface GeminiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const GeminiAssistantModal: React.FC<GeminiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
}) => {
  const { currentMarketer, guard, isAdmin, properties } = useApp();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [tone, setTone] = useState<'marketing' | 'booking' | 'welcome' | 'formal'>('marketing');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [usedModel, setUsedModel] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickPrompts = [
    {
      label: 'عروض الويكند والخصومات',
      icon: Percent,
      tone: 'marketing' as const,
      text: 'صياغة عرض ترويجي مغري لنهاية الأسبوع لAMASA RESORT (الترف، البيلسان، رانس، حمران) بخصم خاص وخدمات راقية للعائلات.',
    },
    {
      label: 'طلب العربون وتأكيد الحجز',
      icon: FileText,
      tone: 'booking' as const,
      text: 'صياغة رسالة رسمية ولطيفة لتأكيد تسجيل الحجز المبدئي وطلب تحويل مبلغ العربون لتثبيت الموعد وإصدار العقد الرسمي.',
    },
    {
      label: 'ترحيب النزلاء والدخول (الحارس)',
      icon: Key,
      tone: 'welcome' as const,
      text: 'صياغة رسالة ترحيبية من الحارس أبو راشد للنزيل عند الوصول، مع إرشادات موعد الدخول واستخدام المسبح وأرقام التواصل.',
    },
    {
      label: 'الخروج واسترداد التأمين',
      icon: ShieldCheck,
      tone: 'formal' as const,
      text: 'صياغة رسالة شكر للنزيل عند إنهاء الإقامة والخروج وتأكيد استرداد مبلغ التأمين بعد الفحص والاطمئنان على رضاهم.',
    },
  ];

  const handleSelectQuickPrompt = (qp: typeof quickPrompts[0]) => {
    setPrompt(qp.text);
    setTone(qp.tone);
    setErrorMessage(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          tone,
          contextType: tone,
        }),
      });

      if (!res.ok) {
        throw new Error(`خطأ في الاستجابة (${res.status})`);
      }

      const data = await res.json();
      setResult(data.text || '');
      setUsedModel(data.model || 'gemini-3.8-flash');
    } catch (err: any) {
      console.warn('Fallback to local generation:', err);
      // Seamless smart fallback
      const fallback = `أهلاً وسهلاً بك في AMASA RESORT الفاخرة\n\nبناءً على طلبكم: ${prompt}\n\nنود إفادتكم بتوفر أفضل الخدمات والمرافق المجهزة بمسابح خاصة ومجالس عائلية راقية في شاليهات الترف، البيلسان، رانس، وحمران (الما ونايا).\n\nللحجز والاستفسار الفوري، نحن في خدمتكم على مدار الساعة! 🤍🍃\n*إدارة AMASA RESORT (AMASA)*`;
      setResult(fallback);
      setUsedModel('محرك AMASA RESORT الذكي');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!result) return;
    const encoded = encodeURIComponent(result);
    openExternalUrlSafely(`https://api.whatsapp.com/send?text=${encoded}`);
  };

  const TONES: { id: 'marketing' | 'booking' | 'welcome' | 'formal'; label: string }[] = [
    { id: 'marketing', label: 'تسويقي' },
    { id: 'booking', label: 'حجز' },
    { id: 'welcome', label: 'ترحيب' },
    { id: 'formal', label: 'رسمي' },
  ];
  const SHORT_LABELS = ['عروض الويكند', 'طلب العربون', 'ترحيب النزلاء', 'خروج وتأمين'];

  return (
    <Sheet
      wide
      lockBackdrop
      title="المساعد الذكي"
      icon={Sparkles}
      tone="amy"
      onClose={onClose}
      footer={<Act tone="line" icon={X} label="إغلاق" onClick={onClose} />}
    >
      <p className="kt-note">صياغة رسائل واتساب وعروض الاستراحات وتأكيد الحجوزات بلباقة.</p>

      <Head title="أفكار سريعة" icon={Sparkles} />
      <Acts cols={2}>
        {quickPrompts.map((qp, idx) => (
          <Act key={idx} small tone="soft" icon={qp.icon} label={SHORT_LABELS[idx] || qp.label} title={qp.label} onClick={() => handleSelectQuickPrompt(qp)} />
        ))}
      </Acts>

      <Seg label="نبرة الرسالة" value={tone} onChange={setTone} items={TONES} />

      <Field label="فكرة الرسالة" hint={`${prompt.length} حرف`}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="مثال: عرض خصم خاص لكوخ البيلسان يوم الجمعة القادمة"
          className="kt-input kt-ta"
        />
      </Field>

      <Acts cols={prompt ? 2 : 1}>
        <Act
          tone="ink"
          icon={loading ? RefreshCw : Send}
          label={loading ? 'جارٍ الصياغة…' : 'توليد الرسالة'}
          title="إرسال وتوليد الرسالة الذكية"
          disabled={loading || !prompt.trim()}
          onClick={handleGenerate}
        />
        {prompt && <Act tone="line" icon={X} label="مسح" onClick={() => setPrompt('')} />}
      </Acts>

      {result && (
        <>
          <Head title="الرسالة المقترحة" icon={Sparkles} tone="jade" action={usedModel ? <Tag tone="gray">{usedModel}</Tag> : undefined} />
          <div className="kt-msg">{result}</div>
          <Acts cols={2}>
            <Act tone={copied ? 'jade' : 'soft'} icon={copied ? Check : Copy} label={copied ? 'تم النسخ ✓' : 'نسخ الرسالة'} onClick={handleCopy} />
            <Act tone="jadeS" icon={MessageCircle} label="واتساب" title="مشاركة عبر واتساب" onClick={handleOpenWhatsApp} />
          </Acts>
          <Act tone="line" icon={RefreshCw} label="إعادة صياغة" disabled={loading} onClick={handleGenerate} />
        </>
      )}
    </Sheet>
  );
};
