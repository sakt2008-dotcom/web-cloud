import React, { useState, useMemo } from 'react';
import { FileCode2, Download, Copy, Check, FolderOpen, X, Layers, Database, Layout, Terminal, FileCheck, Package } from 'lucide-react';
import { downloadZipSafely } from '../../lib/downloadZip';
import { Sheet, Field, Head, Acts, Act, Tag, SearchBox } from '../ui/kit';
import { EmptyBox } from '../dashboard/DashboardCards';

export interface ProjectFileInfo {
  path: string;
  name: string;
  downloadUrl: string;
  category: 'config' | 'logic' | 'tabs' | 'components' | 'dist';
  description: string;
  sizeHint: string;
}

const ALL_PROJECT_FILES: ProjectFileInfo[] = [
  // Config
  {
    path: 'package.json',
    name: 'package.json',
    downloadUrl: '/api/raw-file?file=package.json',
    category: 'config',
    description: 'ملف الحزم والاعتماديات وتشغيل أوامر البناء',
    sizeHint: '~1.5 KB',
  },
  {
    path: 'index.html',
    name: 'index.html',
    downloadUrl: '/api/raw-file?file=index.html',
    category: 'config',
    description: 'ملف البداية الرئيسي وخط تجوال (Tajawal)',
    sizeHint: '~1.6 KB',
  },
  {
    path: 'vite.config.ts',
    name: 'vite.config.ts',
    downloadUrl: '/api/raw-file?file=vite.config.ts',
    category: 'config',
    description: 'إعدادات مجمع ومحول Vite و Tailwind v4',
    sizeHint: '~800 B',
  },
  {
    path: 'tsconfig.json',
    name: 'tsconfig.json',
    downloadUrl: '/api/raw-file?file=tsconfig.json',
    category: 'config',
    description: 'إعدادات مترجم TypeScript والمسارات',
    sizeHint: '~600 B',
  },
  {
    path: 'metadata.json',
    name: 'metadata.json',
    downloadUrl: '/api/raw-file?file=metadata.json',
    category: 'config',
    description: 'بيانات التطبيق في Google AI Studio',
    sizeHint: '~250 B',
  },

  // State & Logic
  {
    path: 'src/types.ts',
    name: 'types.ts',
    downloadUrl: '/api/raw-file?file=src/types.ts',
    category: 'logic',
    description: 'واجهات وأنواع البيانات (الحجوزات، العقارات، الموظفين، الأدوار)',
    sizeHint: '~7.5 KB',
  },
  {
    path: 'src/context/AppContext.tsx',
    name: 'AppContext.tsx',
    downloadUrl: '/api/raw-file?file=src/context/AppContext.tsx',
    category: 'logic',
    description: 'مزوّد الحالة المركزي، الصلاحيات، وحساب العمولات والعمليات',
    sizeHint: '~85 KB',
  },
  {
    path: 'src/data/mock.ts',
    name: 'mock.ts',
    downloadUrl: '/api/raw-file?file=src/data/mock.ts',
    category: 'logic',
    description: 'البيانات الافتراضية للشاليهات الخمسة، الموظفين، والحارس',
    sizeHint: '~45 KB',
  },
  {
    path: 'src/lib/storage.ts',
    name: 'storage.ts',
    downloadUrl: '/api/raw-file?file=src/lib/storage.ts',
    category: 'logic',
    description: 'طبقة التخزين المعزولة وسهلة الاستبدال بقاعدة بيانات',
    sizeHint: '~2.5 KB',
  },
  {
    path: 'src/lib/sound.ts',
    name: 'sound.ts',
    downloadUrl: '/api/raw-file?file=src/lib/sound.ts',
    category: 'logic',
    description: 'محاكي التنبيهات الصوتية ونظام الإشعارات',
    sizeHint: '~3.2 KB',
  },

  // Main Tabs & Layout
  {
    path: 'src/App.tsx',
    name: 'App.tsx',
    downloadUrl: '/api/raw-file?file=src/App.tsx',
    category: 'tabs',
    description: 'المكون الرئيسي وحاوية الشاشات والتوجيه',
    sizeHint: '~4.5 KB',
  },
  {
    path: 'src/index.css',
    name: 'index.css',
    downloadUrl: '/api/raw-file?file=src/index.css',
    category: 'tabs',
    description: 'تنسيقات CSS، الأزرار اللامعة (btn-mauve-shiny) والأنيميشن',
    sizeHint: '~4.2 KB',
  },
  {
    path: 'src/components/calendar/CalendarTab.tsx',
    name: 'CalendarTab.tsx',
    downloadUrl: '/api/raw-file?file=src/components/calendar/CalendarTab.tsx',
    category: 'tabs',
    description: 'شاشة التقويم الشهري التفاعلي، حجز الفترات، وتعطيل الأيام',
    sizeHint: '~50 KB',
  },
  {
    path: 'src/components/dashboard/DashboardTab.tsx',
    name: 'DashboardTab.tsx',
    downloadUrl: '/api/raw-file?file=src/components/dashboard/DashboardTab.tsx',
    category: 'tabs',
    description: 'لوحة التحكم المركزية، حركات الدخول والخروج، وإجراءات الحارس',
    sizeHint: '~68 KB',
  },
  {
    path: 'src/components/bookings/BookingsTab.tsx',
    name: 'BookingsTab.tsx',
    downloadUrl: '/api/raw-file?file=src/components/bookings/BookingsTab.tsx',
    category: 'tabs',
    description: 'شاشة إدارة الحجوزات، الفلاتر، وإيصالات الدفع والتأمين',
    sizeHint: '~75 KB',
  },
  {
    path: 'src/components/properties/PropertiesTab.tsx',
    name: 'PropertiesTab.tsx',
    downloadUrl: '/api/raw-file?file=src/components/properties/PropertiesTab.tsx',
    category: 'tabs',
    description: 'شاشة العقارات الخمسة، الأقسام، الأسعار ومشاركة البيانات',
    sizeHint: '~74 KB',
  },
  {
    path: 'src/components/marketers/MarketersTab.tsx',
    name: 'MarketersTab.tsx',
    downloadUrl: '/api/raw-file?file=src/components/marketers/MarketersTab.tsx',
    category: 'tabs',
    description: 'شاشة إدارة المسوقين، نسب العمولات (5%)، والتقارير المالية',
    sizeHint: '~86 KB',
  },
  {
    path: 'src/components/more/MoreTab.tsx',
    name: 'MoreTab.tsx',
    downloadUrl: '/api/raw-file?file=src/components/more/MoreTab.tsx',
    category: 'tabs',
    description: 'شاشة المزيد، الملف الشخصي، العقد، وسجل النشاط والتحميلات',
    sizeHint: '~40 KB',
  },

  // Modals & UI Components
  {
    path: 'src/components/Header.tsx',
    name: 'Header.tsx',
    downloadUrl: '/api/raw-file?file=src/components/Header.tsx',
    category: 'components',
    description: 'شريط الرأس العلوي، الإشعارات، وتبديل الحسابات',
    sizeHint: '~12 KB',
  },
  {
    path: 'src/components/ToastNotification.tsx',
    name: 'ToastNotification.tsx',
    downloadUrl: '/api/raw-file?file=src/components/ToastNotification.tsx',
    category: 'components',
    description: 'إشعارات البوب أب التلقائية مع مؤقت التقدم التنازلي',
    sizeHint: '~4.5 KB',
  },
  {
    path: 'src/components/auth/LoginScreen.tsx',
    name: 'LoginScreen.tsx',
    downloadUrl: '/api/raw-file?file=src/components/auth/LoginScreen.tsx',
    category: 'components',
    description: 'بوابة تسجيل الدخول الموثّق بحساب Google فقط',
    sizeHint: '~22 KB',
  },
  {
    path: 'src/components/modals/AuthModal.tsx',
    name: 'AuthModal.tsx',
    downloadUrl: '/api/raw-file?file=src/components/modals/AuthModal.tsx',
    category: 'components',
    description: 'نافذة تبديل الحسابات والمعاينة السريعة للأدوار',
    sizeHint: '~32 KB',
  },
  {
    path: 'src/components/modals/BookingModal.tsx',
    name: 'BookingModal.tsx',
    downloadUrl: '/api/raw-file?file=src/components/modals/BookingModal.tsx',
    category: 'components',
    description: 'نافذة إنشاء حجز جديد وتحديد الأسعار وتفاصيل النزيل',
    sizeHint: '~14 KB',
  },
  {
    path: 'src/components/modals/NotificationsModal.tsx',
    name: 'NotificationsModal.tsx',
    downloadUrl: '/api/raw-file?file=src/components/modals/NotificationsModal.tsx',
    category: 'components',
    description: 'مركز الإشعارات المفلترة حسب الدور والموظف المستهدف',
    sizeHint: '~12 KB',
  },
  {
    path: 'src/components/modals/TemplatesModal.tsx',
    name: 'TemplatesModal.tsx',
    downloadUrl: '/api/raw-file?file=src/components/modals/TemplatesModal.tsx',
    category: 'components',
    description: 'إدارة وتعديل قوالب الرسائل وصيغ الواتساب المعتمدة',
    sizeHint: '~22 KB',
  },
  {
    path: 'src/components/modals/PropertyModals.tsx',
    name: 'PropertyModals.tsx',
    downloadUrl: '/api/raw-file?file=src/components/modals/PropertyModals.tsx',
    category: 'components',
    description: 'نوافذ عرض الموقع والإحداثيات، الصور، والعقد الموحد',
    sizeHint: '~20 KB',
  },
  {
    path: 'src/components/more/GuardProfileCard.tsx',
    name: 'GuardProfileCard.tsx',
    downloadUrl: '/api/raw-file?file=src/components/more/GuardProfileCard.tsx',
    category: 'components',
    description: 'بطاقة ملف الحارس الشخصي وإدارة بياناته',
    sizeHint: '~7.0 KB',
  },
  {
    path: 'src/components/more/CommissionRequestsSection.tsx',
    name: 'CommissionRequestsSection.tsx',
    downloadUrl: '/api/raw-file?file=src/components/more/CommissionRequestsSection.tsx',
    category: 'components',
    description: 'قسم طلبات صرف العمولات وإرفاق إيصال التحويل',
    sizeHint: '~28 KB',
  },

  // Official Packages for Source Code & Production Dist
  {
    path: 'amasa-source.zip',
    name: 'amasa-source.zip (1. ملف المصدر الكامل)',
    downloadUrl: '/amasa-source.zip',
    category: 'dist',
    description: 'ملف المصدر: الكود البرمجي المصدري الكامل للمشروع والربط السحابي مع Firebase، جاهز للتطوير والتعديل.',
    sizeHint: '~250 KB',
  },
  {
    path: 'amasa-dist.zip',
    name: 'amasa-dist.zip (2. ملف الرئيسي - حزمة الإنتاج)',
    downloadUrl: '/amasa-dist.zip',
    category: 'dist',
    description: 'ملف الرئيسي: حزمة التطبيق المترجمة والجاهزة للاستعراض والنشر المباشر مع ملف index.html ومجلد الأصول assets.',
    sizeHint: '~260 KB',
  },
  {
    path: 'amasa-claude-starter.zip',
    name: 'amasa-claude-starter.zip (3. حزمة التأسيس للبناء عبر Claude)',
    downloadUrl: '/amasa-claude-starter.zip',
    category: 'dist',
    description: 'مجلد مضغوط يحتوي على موجه البناء، مواصفات النظام، هيكل Firestore، قواعد الحماية، دليل التخزين والاستضافة المجانية، ومساعد رابط العميل المباشر.',
    sizeHint: '~15 KB',
  },
  {
    path: 'amasa-android-studio.zip',
    name: 'amasa-android-studio.zip (4. مشروع Android Studio لبناء APK)',
    downloadUrl: '/amasa-android-studio.zip',
    category: 'dist',
    description: 'مجلد مشروع Android Studio أصلي (Kotlin + Gradle) بدون ملفات الويب، جاهز للفتح وبناء ملف APK مباشرة.',
    sizeHint: '~400 KB',
  },
  {
    path: '.htaccess',
    name: '.htaccess (إعدادات الاستضافة الساكنة SPA)',
    downloadUrl: '/.htaccess',
    category: 'config',
    description: 'ملف إعادة توجيه الروابط وتفعيل SPA وحماية الملفات للاستضافات الساكنة',
    sizeHint: '~1.8 KB',
  },
];

interface IndividualFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IndividualFilesModal: React.FC<IndividualFilesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'جميع الملفات', icon: FolderOpen },
    { id: 'tabs', label: 'الشاشات الرئيسية', icon: Layout },
    { id: 'logic', label: 'الحالة والبيانات', icon: Database },
    { id: 'components', label: 'المكونات والنوافذ', icon: Layers },
    { id: 'config', label: 'إعدادات المشروع', icon: Terminal },
    { id: 'dist', label: 'حزم الإنتاج الجاهزة', icon: Package },
  ];

  const filteredFiles = useMemo(() => {
    return ALL_PROJECT_FILES.filter((file) => {
      const matchesCategory =
        selectedCategory === 'all' || file.category === selectedCategory;
      const matchesSearch =
        search.trim() === '' ||
        file.name.toLowerCase().includes(search.toLowerCase()) ||
        file.path.toLowerCase().includes(search.toLowerCase()) ||
        file.description.includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  const copyPathToClipboard = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (!isOpen) return null;

  const SHORT_CAT: Record<string, string> = {
    all: 'كل الملفات',
    tabs: 'الشاشات الرئيسية',
    logic: 'الحالة والبيانات',
    components: 'المكونات والنوافذ',
    config: 'إعدادات المشروع',
    dist: 'حزم الإنتاج',
  };

  return (
    <Sheet
      wide
      title="ملفات المشروع"
      icon={FileCode2}
      tone="amy"
      onClose={onClose}
      footer={<Act tone="line" icon={X} label="إغلاق" onClick={onClose} />}
    >
      <SearchBox value={search} onChange={setSearch} placeholder="ابحث باسم الملف أو وظيفته" />
      <Field label="التصنيف">
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="kt-input">
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {SHORT_CAT[cat.id] || cat.label}
            </option>
          ))}
        </select>
      </Field>

      <Head title="الملفات" icon={FolderOpen} count={filteredFiles.length} />

      {filteredFiles.map((file) => {
        const isCopied = copiedPath === file.path;
        const cleanName = file.path.split('/').pop() || file.name;
        return (
          <div key={file.path} className="kt-bk">
            <div className="kt-bk-h">
              <Tag tone="amy" mono>
                {(file.name.split('.').pop() || 'file').slice(0, 5)}
              </Tag>
              <span className="kt-row-t">
                <span className="kt-row-n" dir="ltr" style={{ textAlign: 'right' }}>
                  {file.name}
                </span>
                <span className="kt-row-s" dir="ltr" style={{ textAlign: 'right' }}>
                  {file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : 'المجلد الرئيسي'}
                </span>
              </span>
              <Tag tone="gray" mono>
                <bdi dir="ltr">{file.sizeHint}</bdi>
              </Tag>
            </div>
            <p className="kt-note">{file.description}</p>
            <Acts cols={2}>
              <Act
                small
                tone="ink"
                icon={Download}
                label="تحميل"
                title={`تحميل ${file.name}`}
                href={file.downloadUrl}
                download={cleanName}
                onClick={(e) => {
                  if (cleanName.endsWith('.zip')) {
                    downloadZipSafely(e as React.MouseEvent<HTMLAnchorElement>, file.downloadUrl, cleanName);
                  }
                }}
              />
              <Act
                small
                tone={isCopied ? 'jade' : 'soft'}
                icon={isCopied ? Check : Copy}
                label={isCopied ? 'تم النسخ ✓' : 'نسخ المسار'}
                title={`نسخ مسار ${file.name}`}
                onClick={() => copyPathToClipboard(file.path)}
              />
            </Acts>
          </div>
        );
      })}

      {filteredFiles.length === 0 && <EmptyBox icon={FileCheck} text="لا توجد ملفات مطابقة للبحث." />}
    </Sheet>
  );
};
