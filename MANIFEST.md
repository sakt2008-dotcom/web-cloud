# MANIFEST — AMASA RESORT (amasa-web-source)

النسخة الكاملة من كود الويب كما هي الآن (بعد آخر تعديلات التصميم وصف أزرار مسار الحجز).

## أ) العدّ
- **الصفحات/التبويبات الرئيسية: 9** — calendar (ضبط الأسعار)، bookings، supervisor، dashboard (الرئيسية)، guard-tasks، properties، marketers، kayan-detergents، more (المزيد والإعدادات).
- **ملفات مكوّنات الواجهة (`src/components/**/*.tsx`): 59**، منها **20 ملف نافذة باسم Modal**؛ وبقية النوافذ مبنية بمكوّن `Sheet` من `src/components/ui/kit.tsx`.
- إجمالي الملفات في الأرشيف: **135** (مع هذا الملف).

## ب) المتطلبات والتشغيل
```
npm install        # يستخدم .npmrc (legacy-peer-deps=true)
npm run dev        # tsx server.ts  (خادم Express + Vite)
npm run lint       # tsc --noEmit
npm test           # 15 اختباراً
npm run build      # vite build + سكربت تجهيز الحزم (يحتاج python3)
npm start          # tsx server.ts
```
متغيرات البيئة (انظر `.env.example`): `GEMINI_API_KEY` (المساعد الذكي)، `APP_URL`، `VITE_CLOUDINARY_CLOUD_NAME`، `VITE_CLOUDINARY_UPLOAD_PRESET` (اختياريان)، `VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT` (اختيارية؛ تُنشأ تلقائياً إن غابت).

إعداد Firebase:
1. الإعدادات الحالية في `firebase-applet-config.json` (مفتاح الويب هذا عام وليس سراً؛ قاعدة البيانات `firestoreDatabaseId` مطابقة لتطبيق AI Studio).
2. انشر `firestore.rules` و`storage.rules` (`firebase.json` يشير إليهما).
3. Authentication ← Settings ← Authorized domains ← أضف نطاق الموقع.
4. تسجيل الدخول بالبريد وكلمة المرور؛ حساب المالك/المدير هو الحساب المسجَّل في التطبيق.

## ج) ما لا يوجد في المشروع (ولم أختلقه)
- لا يوجد `postcss.config.*` ولا `tailwind.config.*`: المشروع يستخدم Tailwind v4 عبر `@tailwindcss/vite` داخل `vite.config.ts`.
- لا يوجد `firestore.indexes.json` (لا فهارس مركّبة مستخدمة).
- لا يوجد `firebase-messaging-sw.js`: إشعارات الخلفية تستخدم Web Push (VAPID) عبر `public/sw-push.js` و`server.ts` (`/api/push/*`) وليست FCM.
- `cloudflare/_worker.ts` اختياري: بديل خادم الإشعارات عند الاستضافة على Cloudflare Pages فقط؛ لا حاجة له في AI Studio.

## د) نتائج التحقق (نسخة نظيفة مفكوكة من هذا الأرشيف)
- `npm install`: ناجح.
- `npx tsc --noEmit` (= `npm run lint`): **0 أخطاء**.
- `npm test`: **15 / 15 ناجح**.
- `npm run build`: **ناجح بلا أخطاء**.
- ملاحظة: أصلحت سطراً واحداً في `src/lib/demoMode.ts` (`import.meta.env?.`) لأن الاختبارات كانت تتعطل خارج Vite؛ لا أثر له على المظهر أو السلوك.
- لم يُختبر هنا: Firebase الحقيقي، الأجهزة الفعلية، الإشعارات الخلفية.

## هـ) قائمة الملفات
- `.env.example`
- `.gitignore`
- `.npmrc`
- `README.md`
- `apk/README.md`
- `apk/build-apk.bat`
- `apk/build-apk.sh`
- `apk/capacitor.config.json`
- `apk/github-build-apk.yml`
- `apk/package.json`
- `cloudflare/README-CLOUDFLARE-PUSH.txt`
- `cloudflare/_worker.ts`
- `firebase-applet-config.json`
- `firebase-blueprint.json`
- `firebase.json`
- `firestore.rules`
- `index.html`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `public/.htaccess`
- `public/_redirects`
- `public/apple-touch-icon.png`
- `public/favicon.ico`
- `public/icon.svg`
- `public/manifest.json`
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/pwa-maskable-512x512.png`
- `public/sw-push.js`
- `scripts/make_preview.py`
- `scripts/make_zips.py`
- `scripts/server_templates/.htaccess`
- `scripts/server_templates/README.txt`
- `scripts/server_templates/run.bat`
- `scripts/server_templates/serve.cjs`
- `scripts/server_templates/serve.mjs`
- `scripts/server_templates/serve.py`
- `server.ts`
- `src/App.tsx`
- `src/assets/images/login-bg.jpg`
- `src/assets/images/supervisor_gold_ui_preview_1794997197729.jpg`
- `src/assets/images/supervisor_purple_gold_preview_1794997305636.jpg`
- `src/components/ErrorBoundary.tsx`
- `src/components/Header.tsx`
- `src/components/PWAInstallButton.tsx`
- `src/components/ToastNotification.tsx`
- `src/components/admin/AdminAccountSwitcherModal.tsx`
- `src/components/admin/AdminBroadcastModal.tsx`
- `src/components/admin/SimulationTopBanner.tsx`
- `src/components/admin/UrgentBroadcastBanner.tsx`
- `src/components/ai/GeminiAssistantModal.tsx`
- `src/components/auth/LoginScreen.tsx`
- `src/components/bookings/BookingsTab.tsx`
- `src/components/calendar/CalendarTab.tsx`
- `src/components/calendar/CustomPricingSection.tsx`
- `src/components/calendar/SpecialAdminFeesSection.tsx`
- `src/components/contracts/OfficialContractDocument.tsx`
- `src/components/dashboard/DashboardCards.tsx`
- `src/components/dashboard/DashboardTab.tsx`
- `src/components/dashboard/FollowUpBoard.tsx`
- `src/components/drive/DriveEmbed.tsx`
- `src/components/financials/ComparativeAnalyticsSection.tsx`
- `src/components/financials/FinancialHubView.tsx`
- `src/components/financials/NetProfitSection.tsx`
- `src/components/financials/PayoutRequestsSection.tsx`
- `src/components/financials/SupervisorPayoutPanel.tsx`
- `src/components/guard/GuardTasksTab.tsx`
- `src/components/guard/InAppCameraModal.tsx`
- `src/components/kayan/KayanDetergentsTab.tsx`
- `src/components/kayan/KayanOrderSheetDocument.tsx`
- `src/components/marketers/MarketersTab.tsx`
- `src/components/modals/AddMemberModal.tsx`
- `src/components/modals/AuthModal.tsx`
- `src/components/modals/BankReceiptsHubModal.tsx`
- `src/components/modals/BookingModal.tsx`
- `src/components/modals/BookingReceiptsModal.tsx`
- `src/components/modals/GoogleAppSheetModal.tsx`
- `src/components/modals/IndividualFilesModal.tsx`
- `src/components/modals/InstallAppModal.tsx`
- `src/components/modals/NotificationsModal.tsx`
- `src/components/modals/PrintableContractModal.tsx`
- `src/components/modals/TemplatesModal.tsx`
- `src/components/more/AddGuardModal.tsx`
- `src/components/more/AdministrativeFeesLedgerModal.tsx`
- `src/components/more/CommissionRequestsSection.tsx`
- `src/components/more/CoordinatorsSection.tsx`
- `src/components/more/GuardProfileCard.tsx`
- `src/components/more/MoreTab.tsx`
- `src/components/nav/useNavItems.ts`
- `src/components/properties/AddPropertyModal.tsx`
- `src/components/properties/HamranCoordinatorsCard.tsx`
- `src/components/properties/MergeUnitsModal.tsx`
- `src/components/properties/PropertiesTab.tsx`
- `src/components/properties/TransferUnitModal.tsx`
- `src/components/properties/UnitContractTemplateCard.tsx`
- `src/components/shared/EstateBookingBuilder.tsx`
- `src/components/shared/EstateOptionsBar.tsx`
- `src/components/shared/PropertySelect.tsx`
- `src/components/supervisor/SupervisorTab.tsx`
- `src/components/ui/kit.tsx`
- `src/components/ui/lux.tsx`
- `src/components/video/VideoUploader.tsx`
- `src/context/AppContext.tsx`
- `src/data/mock.ts`
- `src/firebase.ts`
- `src/hooks/usePWAInstall.ts`
- `src/index.css`
- `src/lib/__tests__/system.test.ts`
- `src/lib/bookingReceipts.ts`
- `src/lib/contractPdf.ts`
- `src/lib/customerLinks.ts`
- `src/lib/demoMode.ts`
- `src/lib/downloadZip.ts`
- `src/lib/financials.ts`
- `src/lib/format.ts`
- `src/lib/kayanDetergents.ts`
- `src/lib/mediaStorage.ts`
- `src/lib/propertyUtils.ts`
- `src/lib/pushMatching.ts`
- `src/lib/pushNotifications.ts`
- `src/lib/pwaUpdater.ts`
- `src/lib/qrCode.ts`
- `src/lib/sound.ts`
- `src/lib/storage.ts`
- `src/lib/stripEmoji.ts`
- `src/main.tsx`
- `src/services/firestoreSync.ts`
- `src/services/googleAuth.ts`
- `src/services/googleSheetsService.ts`
- `src/types.ts`
- `storage.rules`
- `tsconfig.json`
- `vite.config.ts`
