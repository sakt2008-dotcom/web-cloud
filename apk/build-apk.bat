@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "ROOT_DIR=%%~fI"

echo ==================================================
echo   بناء مشروع الاندرويد لفتحـه في Android Studio
echo ==================================================

where node >nul 2>nul
if errorlevel 1 (
  echo [خطأ] برنامج Node.js غير مثبت. يرجى تثبيته من https://nodejs.org
  pause
  exit /b 1
)

if not exist "%ROOT_DIR%\node_modules" (
  echo [1/4] تثبيت حزم المشروع الأساسية...
  pushd "%ROOT_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo [خطأ] فشل تثبيت الحزم الأساسية.
    pause
    exit /b 1
  )
  popd
)

if not exist "%ROOT_DIR%\dist\index.html" (
  echo [2/4] بناء ملفات الويب (dist)...
  pushd "%ROOT_DIR%"
  call npm run build
  if errorlevel 1 (
    popd
    echo [خطأ] فشل بناء ملفات dist.
    pause
    exit /b 1
  )
  popd
) else (
  echo [2/4] مجلد dist جاهز.
)

pushd "%SCRIPT_DIR%"

if not exist "%SCRIPT_DIR%\node_modules" (
  echo [3/4] تثبيت حزم Capacitor داخل مجلد apk...
  call npm install
  if errorlevel 1 (
    popd
    echo [خطأ] فشل تثبيت حزم Capacitor.
    pause
    exit /b 1
  )
)

if not exist "%SCRIPT_DIR%\android" (
  echo [4/4] إنشاء مجلد مشروع Android Studio لأول مرة (apk\android)...
  call npx cap add android
  if errorlevel 1 (
    popd
    echo [خطأ] فشل إنشاء مجلد android.
    pause
    exit /b 1
  )
)

echo مزامنة الملفات مع apk\android...
call npx cap sync android
if errorlevel 1 (
  popd
  echo [خطأ] فشلت المزامنة مع Android.
  pause
  exit /b 1
)

echo.
echo ==================================================
echo   تم تجهيز مشروع Android Studio بنجاح!
echo   المسار المطلوب فتحه داخل Android Studio:
echo   %SCRIPT_DIR%\android
echo ==================================================
echo.
echo الخطوة التالية:
echo 1. افتح Android Studio
echo 2. اختر File -^> Open ثم اختر المجلد: apk\android
echo 3. انتظر انتهاء Gradle Sync ثم اضغط Build -^> Build APK(s)
echo.

popd
pause
