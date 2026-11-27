# مجلد تطبيق الأندرويد المنفصل (`apk/`)

هذا المجلد منفصل تماماً عن ملفات الويب، ومخصص لبناء وحفظ ملف التثبيت المباشر للأندرويد (**APK**) لتطبيق **AMASA RESORT**.

---

## كيف يتصل هذا المجلد بالتطبيق تلقائياً؟
الخادم (`server.ts`) يفحص هذا المجلد (`apk/`) أولاً عند كل طلب:
- إذا تم وضع ملف APK صالح داخل هذا المجلد بأحد الأسماء التالية (أو أي اسم ينتهي بـ `.apk`):
  - `apk/amasa-resort.apk` *(المفضل)*
  - `apk/amasa.apk`
  - `apk/app-release.apk`
  - `apk/app-debug.apk`
- يتم تفعيل الروابط التالية تلقائياً بدون أي تعديل برمجي إضافي:
  - `/api/apk-info` (يعيد `available: true` وحجم الملف)
  - `/download/apk` و`/amasa-resort.apk` (تنزيل مباشر بضغطة واحدة)
  - زر **«تحميل التطبيق» / «تثبيت التطبيق على الجوال»** داخل التطبيق يقوم تلقائياً بتنزيل ملف APK مباشرة على أجهزة الأندرويد.

---

## محتويات المجلد
- `capacitor.config.json` — إعدادات تغليف التطبيق لنظام Android عبر Capacitor (`com.amasa.resort`) وتشير إلى مخرجات البناء `../dist`.
- `package.json` — حزمة مستقلة لـ Android/Capacitor معزولة عن حزم الموقع الرئيسية.
- `build-apk.sh` — سكربت بناء آلي لنظامي Linux/macOS ينتج ملف `apk/amasa-resort.apk` على أي جهاز يتوفر فيه `Java JDK 17+` و`Android SDK`.
- `build-apk.bat` — سكربت تجهيز مخصص لنظام **Windows** لإنشاء مجلد المشروع الأصلي `apk\android` الجاهز للفتح مباشرة داخل **Android Studio**.
- `github-build-apk.yml` — قالب جاهز لـ GitHub Actions لبناء ملف APK سحابياً مجاناً وبدون تثبيت Android Studio.

---

## طرق توليد ملف APK

### الطريقة 1: البناء على جهازك (Windows أو Mac/Linux)
**على نظام Windows (داخل Android Studio):**
1. شغّل الملف `apk\build-apk.bat` (أو نفّذ داخل مجلد `apk`: `npm install && npx cap add android && npx cap sync android`).
2. داخل **Android Studio** اختر `File -> Open` وحدد المجلد **`apk\android`** (وليس المجلد الرئيسي للمشروع).
3. انتظر انتهاء **Gradle Sync** ثم اضغط `Build -> Generate App Bundles or APKs -> Build APK(s)`.

**على نظام Linux / macOS:**
```bash
cd apk
chmod +x build-apk.sh
./build-apk.sh
```
سيتم توليد الملف النهائي وحفظه تلقائياً في:
`apk/amasa-resort.apk`

### الطريقة 2: البناء السحابي بدون تثبيت Android Studio (GitHub Actions)
1. انسخ الملف `apk/github-build-apk.yml` إلى المسار `.github/workflows/build-apk.yml` في مستودع GitHub.
2. شغّل Workflow باسم **Build AMASA Android APK**.
3. حمّل الملف الناتج `amasa-resort.apk` من قسم **Artifacts** وضعه داخل هذا المجلد `apk/amasa-resort.apk`.

### الطريقة 3: عبر PWABuilder (بدون كود)
1. افتح [pwabuilder.com](https://www.pwabuilder.com) وأدخل رابط التطبيق المنشور (`Shared App URL`).
2. اختر **Package for Stores → Android → Generate Package**.
3. فك الضغط وضع ملف `.apk` داخل `apk/amasa-resort.apk`.
