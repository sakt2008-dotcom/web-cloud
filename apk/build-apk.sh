#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== بناء حزمة الأندرويد (AMASA APK) ==="

if ! command -v node >/dev/null 2>&1; then
  echo "خطأ: Node.js غير مثبت."
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "خطأ: Java JDK (الإصدار 17 أو أحدث) غير مثبت في هذا الجهاز."
  echo "يرجى تشغيل هذا السكربت على جهاز يتوفر فيه JDK + Android SDK أو عبر GitHub Actions (apk/github-build-apk.yml)."
  exit 1
fi

if [ ! -d "$ROOT_DIR/dist" ] || [ ! -f "$ROOT_DIR/dist/index.html" ]; then
  echo "1/4 بناء نسخة الويب الإنتاجية (dist/)..."
  (cd "$ROOT_DIR" && npm run build)
else
  echo "1/4 نسخة الويب (dist/) جاهزة."
fi

cd "$SCRIPT_DIR"

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "2/4 تثبيت حزم Capacitor داخل مجلد apk/..."
  npm install
else
  echo "2/4 حزم Capacitor مثبتة بالفعل."
fi

if [ ! -d "$SCRIPT_DIR/android" ]; then
  echo "3/4 إنشاء مشروع Android داخل apk/android..."
  npx cap add android
else
  echo "3/4 مزامنة ملفات الويب مع apk/android..."
fi

npx cap sync android

echo "4/4 تجميع ملف APK..."
cd "$SCRIPT_DIR/android"
chmod +x ./gradlew
./gradlew assembleDebug

OUT_APK="$SCRIPT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$OUT_APK" ]; then
  cp "$OUT_APK" "$SCRIPT_DIR/amasa-resort.apk"
  echo "تم إنشاء الملف بنجاح: $SCRIPT_DIR/amasa-resort.apk"
else
  echo "تنبيه: تعذر العثور على app-debug.apk في مسار المخرجات المتوقع."
  exit 1
fi
