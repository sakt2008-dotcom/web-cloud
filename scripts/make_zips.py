#!/usr/bin/env python3
import os
import zipfile
import shutil
import subprocess
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT_DIR, 'dist')
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')
TEMPLATES_DIR = os.path.join(ROOT_DIR, 'scripts', 'server_templates')

os.makedirs(PUBLIC_DIR, exist_ok=True)

# Ensure dist/ has a valid Vite production build before packaging
dist_index = os.path.join(DIST_DIR, 'index.html')
dist_assets = os.path.join(DIST_DIR, 'assets')
has_valid_dist = (
    os.path.exists(dist_index)
    and os.path.isdir(dist_assets)
    and any(os.scandir(dist_assets))
)
if not has_valid_dist:
    print("dist/ is empty or missing build assets — running npx vite build first...")
    subprocess.run(['npx', 'vite', 'build'], cwd=ROOT_DIR, check=True)

os.makedirs(DIST_DIR, exist_ok=True)

# Copy server templates / config into dist/
if os.path.exists(TEMPLATES_DIR):
    for f in os.listdir(TEMPLATES_DIR):
        src_path = os.path.join(TEMPLATES_DIR, f)
        dst_path = os.path.join(DIST_DIR, f)
        shutil.copy2(src_path, dst_path)

# Copy .htaccess to dist if present in public
src_htaccess = os.path.join(PUBLIC_DIR, '.htaccess')
dst_htaccess = os.path.join(DIST_DIR, '.htaccess')
if os.path.exists(src_htaccess) and not os.path.exists(dst_htaccess):
    shutil.copy2(src_htaccess, dst_htaccess)

# Remove any stale zip or temporary screenshot directories inside dist/
for stale_zip in ('amasa-dist.zip', 'amasa-cyberpanel.zip', 'amasa-resort-cyberpanel.zip', 'amasa-source.zip', 'amasa-base44.zip', 'amasa-clean-source.zip'):
    stale_p = os.path.join(DIST_DIR, stale_zip)
    if os.path.exists(stale_p):
        os.remove(stale_p)

dist_aistudio = os.path.join(DIST_DIR, 'assets', 'aistudio')
if os.path.exists(dist_aistudio):
    shutil.rmtree(dist_aistudio)

def should_skip(file_name, rel_path):
    norm_rel = rel_path.replace('\\', '/')
    if file_name.endswith('.zip') or file_name.endswith('.DS_Store') or file_name.startswith('.'):
        if file_name not in ('.htaccess', '.env.example', '.gitignore'):
            return True
    if 'aistudio' in norm_rel or 'node_modules' in norm_rel or '.git' in norm_rel or 'uploads' in norm_rel:
        return True
    if norm_rel.startswith('api/') or '/api/' in norm_rel:
        return True
    return False

def is_allowed_dist_entry(rel_path, prefixes):
    norm = rel_path.replace('\\', '/')
    if norm.startswith('workbox-') and norm.endswith('.js'):
        return True
    return any(norm == item or norm.startswith(item + '/') for item in prefixes)

def fmt_kb(path):
    return f"{os.path.getsize(path) / 1024:.1f} KB"

def write_zip_entries(zipf, base_dir, entries):
    """Write explicit directory entries and files with dual UNIX + DOS attributes for maximum compatibility."""
    added_dirs = set()

    def ensure_dir_entries(rel_file_path):
        norm_path = rel_file_path.replace('\\', '/')
        parts = norm_path.split('/')[:-1]
        cur = ''
        for part in parts:
            cur = f"{cur}{part}/"
            if cur not in added_dirs:
                added_dirs.add(cur)
                dinfo = zipfile.ZipInfo(cur)
                dinfo.date_time = (2026, 11, 16, 12, 0, 0)
                dinfo.external_attr = (0o040755 << 16) | 0x10
                dinfo.compress_type = zipfile.ZIP_STORED
                zipf.writestr(dinfo, b'')

    def sort_key(item):
        _, rel_p = item
        norm = rel_p.replace('\\', '/')
        is_dot = os.path.basename(norm).startswith('.')
        return (1 if is_dot else 0, norm.count('/'), norm)

    for abs_path, rel_path in sorted(entries, key=sort_key):
        norm_rel = rel_path.replace('\\', '/')
        ensure_dir_entries(norm_rel)
        st = os.stat(abs_path)
        lt = time.localtime(st.st_mtime)
        finfo = zipfile.ZipInfo(norm_rel, date_time=(lt.tm_year, lt.tm_mon, lt.tm_mday, lt.tm_hour, lt.tm_min, lt.tm_sec))
        finfo.compress_type = zipfile.ZIP_DEFLATED
        finfo.external_attr = (0o100644 << 16) | 0x20
        with open(abs_path, 'rb') as fh:
            zipf.writestr(finfo, fh.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)

def verify_zip(path, require_web_files=False):
    with open(path, 'rb') as f:
        magic = f.read(4)
        if magic != b'PK\x03\x04':
            raise RuntimeError(f"Invalid ZIP magic header in {path}: {magic!r}")
    with zipfile.ZipFile(path, 'r') as zf:
        bad = zf.testzip()
        if bad is not None:
            raise RuntimeError(f"Corrupted entry {bad} in {path}")
        infos = zf.infolist()
        file_names = [i.filename for i in infos if not i.is_dir()]
        if len(file_names) == 0:
            raise RuntimeError(f"Empty zip archive (0 files): {path}")
        if require_web_files:
            if 'index.html' not in file_names:
                raise RuntimeError(f"Missing index.html in {path}")
            if not any(n.startswith('assets/') for n in file_names):
                raise RuntimeError(f"Missing assets/ files in {path}")
            test_extract_dir = '/tmp/amasa-zip-verify'
            if os.path.exists(test_extract_dir):
                shutil.rmtree(test_extract_dir, ignore_errors=True)
            os.makedirs(test_extract_dir, exist_ok=True)
            zf.extractall(test_extract_dir)
            extracted_index = os.path.join(test_extract_dir, 'index.html')
            extracted_assets = os.path.join(test_extract_dir, 'assets')
            if not (os.path.isfile(extracted_index) and os.path.isdir(extracted_assets) and any(os.scandir(extracted_assets))):
                raise RuntimeError(f"Extraction check failed for {path}")
            shutil.rmtree(test_extract_dir, ignore_errors=True)
        return len(file_names)

# -------------------------------------------------------------
# 1. Production Bundle: amasa-dist.zip
# -------------------------------------------------------------
dist_zip_path = os.path.join(PUBLIC_DIR, 'amasa-dist.zip')
if os.path.exists(dist_zip_path):
    os.remove(dist_zip_path)

print(f"1. Creating {dist_zip_path} (حزمة الإنتاج والنشر السريع)...")
DIST_ALLOWED_PREFIXES = (
    'index.html',
    'favicon.ico',
    'apple-touch-icon.png',
    'icon.svg',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png',
    'assets',
    '.htaccess',
    '_redirects',
    'serve.cjs',
    'serve.mjs',
    'serve.py',
    'run.bat',
    'README.txt',
    'manifest.json',
    'manifest.webmanifest',
    'version.json',
    'sw.js',
    'sw-push.js',
    'registerSW.js',
)

dist_entries = []
for root, dirs, files in os.walk(DIST_DIR):
    for file in sorted(files):
        abs_path = os.path.join(root, file)
        rel_path = os.path.relpath(abs_path, DIST_DIR)
        if should_skip(file, rel_path):
            continue
        if is_allowed_dist_entry(rel_path, DIST_ALLOWED_PREFIXES):
            dist_entries.append((abs_path, rel_path))

with zipfile.ZipFile(dist_zip_path, 'w') as zipf:
    write_zip_entries(zipf, DIST_DIR, dist_entries)

dist_count = verify_zip(dist_zip_path, require_web_files=True)
print(f" -> amasa-dist.zip created ({fmt_kb(dist_zip_path)}, {dist_count} files).")

# -------------------------------------------------------------
# 1b. Static-hosting upload package for CyberPanel / cPanel: amasa-resort-cyberpanel.zip
#     (web files + .htaccess only — no local servers, no README)
# -------------------------------------------------------------
cp_zip_path = os.path.join(PUBLIC_DIR, 'amasa-resort-cyberpanel.zip')
if os.path.exists(cp_zip_path):
    os.remove(cp_zip_path)

print(f"1b. Creating {cp_zip_path} (حزمة الرفع المباشر على CyberPanel — ملفات الموقع فقط)...")
LOCAL_ONLY = {'serve.cjs', 'serve.mjs', 'serve.py', 'README.txt', 'run.bat'}
cp_entries = [(a, r) for (a, r) in dist_entries if os.path.basename(r) not in LOCAL_ONLY]
with zipfile.ZipFile(cp_zip_path, 'w') as zipf:
    write_zip_entries(zipf, DIST_DIR, cp_entries)
cp_count = verify_zip(cp_zip_path, require_web_files=True)
with zipfile.ZipFile(cp_zip_path) as _z:
    _names = set(_z.namelist())
    for _must in ('index.html', '.htaccess', 'manifest.json'):
        if _must not in _names:
            raise RuntimeError(f"CyberPanel zip is missing {_must}")
    for _bad in LOCAL_ONLY:
        if _bad in _names:
            raise RuntimeError(f"CyberPanel zip must not contain {_bad}")
print(f" -> amasa-resort-cyberpanel.zip created ({fmt_kb(cp_zip_path)}, {cp_count} files).")

# -------------------------------------------------------------
# 2. Clean Source Code: amasa-source.zip
# -------------------------------------------------------------
source_zip_path = os.path.join(PUBLIC_DIR, 'amasa-source.zip')
if os.path.exists(source_zip_path):
    os.remove(source_zip_path)

print(f"2. Creating {source_zip_path} (ملف المصدر الكامل مع Firebase)...")
SOURCE_ROOT_FILES = [
    'index.html',
    'package.json',
    'package-lock.json',
    '.npmrc',
    'tsconfig.json',
    'vite.config.ts',
    'server.ts',
    'firebase.json',
    'firebase-applet-config.json',
    'firebase-blueprint.json',
    'firestore.rules',
    'storage.rules',
    '.env.example',
    '.gitignore',
    'metadata.json',
    'README.md',
]

source_entries = []
for f in SOURCE_ROOT_FILES:
    p = os.path.join(ROOT_DIR, f)
    if os.path.exists(p):
        source_entries.append((p, f))

src_dir = os.path.join(ROOT_DIR, 'src')
for root, dirs, files in os.walk(src_dir):
    for file in sorted(files):
        abs_path = os.path.join(root, file)
        rel_path = os.path.relpath(abs_path, ROOT_DIR)
        if should_skip(file, rel_path):
            continue
        source_entries.append((abs_path, rel_path))

scripts_dir = os.path.join(ROOT_DIR, 'scripts')
if os.path.exists(scripts_dir):
    for root, dirs, files in os.walk(scripts_dir):
        for file in sorted(files):
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, ROOT_DIR)
            if should_skip(file, rel_path):
                continue
            source_entries.append((abs_path, rel_path))

cf_worker = os.path.join(ROOT_DIR, 'cloudflare', '_worker.ts')
if os.path.exists(cf_worker):
    source_entries.append((cf_worker, 'cloudflare/_worker.ts'))

apk_dir = os.path.join(ROOT_DIR, 'apk')
if os.path.exists(apk_dir):
    for root, dirs, files in os.walk(apk_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'android', '.gradle', 'build')]
        for file in sorted(files):
            if file.endswith('.apk'):
                continue
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, ROOT_DIR)
            if should_skip(file, rel_path):
                continue
            source_entries.append((abs_path, rel_path))

# Include essential public assets (manifest, icons, server rewrites) in source package
public_files = [
    'manifest.json',
    'favicon.ico',
    'apple-touch-icon.png',
    'icon.svg',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png',
    'sw-push.js',
    '.htaccess',
    '_redirects',
]
for pf in public_files:
    extra_p = os.path.join(PUBLIC_DIR, pf)
    if os.path.exists(extra_p):
        source_entries.append((extra_p, os.path.join('public', pf)))

with zipfile.ZipFile(source_zip_path, 'w') as zipf:
    write_zip_entries(zipf, ROOT_DIR, source_entries)

src_count = verify_zip(source_zip_path, require_web_files=False)
print(f" -> amasa-source.zip created successfully ({fmt_kb(source_zip_path)}, {src_count} files).")

# -------------------------------------------------------------
# 3. Claude Starter Blueprint Kit: amasa-claude-starter.zip
# -------------------------------------------------------------
starter_zip_path = os.path.join(PUBLIC_DIR, 'amasa-claude-starter.zip')
if os.path.exists(starter_zip_path):
    os.remove(starter_zip_path)

STARTER_DIR = os.path.join(ROOT_DIR, 'claude-starter-kit')
starter_count = 0
if os.path.isdir(STARTER_DIR):
    print(f"3. Creating {starter_zip_path} (حزمة التأسيس والملفات المرجعية للرفع في كلود)...")
    starter_entries = []
    for root, dirs, files in os.walk(STARTER_DIR):
        for file in sorted(files):
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, STARTER_DIR)
            if should_skip(file, rel_path):
                continue
            starter_entries.append((abs_path, rel_path))
    with zipfile.ZipFile(starter_zip_path, 'w') as zipf:
        write_zip_entries(zipf, STARTER_DIR, starter_entries)
    starter_count = verify_zip(starter_zip_path, require_web_files=False)
    print(f" -> amasa-claude-starter.zip created successfully ({fmt_kb(starter_zip_path)}, {starter_count} files).")

# -------------------------------------------------------------
# 4. Standalone Android Studio APK Project: amasa-android-studio.zip
# -------------------------------------------------------------
android_zip_path = os.path.join(PUBLIC_DIR, 'amasa-android-studio.zip')
if os.path.exists(android_zip_path):
    os.remove(android_zip_path)

ANDROID_STUDIO_DIR = os.path.join(ROOT_DIR, 'android-studio-amasa')
android_count = 0
if os.path.isdir(ANDROID_STUDIO_DIR):
    print(f"4. Creating {android_zip_path} (مجلد Android Studio بدون ملفات الويب لإنشاء APK)...")
    android_entries = []
    for root, dirs, files in os.walk(ANDROID_STUDIO_DIR):
        dirs[:] = [d for d in dirs if d not in ('.gradle', '.idea', 'build')]
        for file in sorted(files):
            if file.endswith('.apk') or file.endswith('.iml'):
                continue
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, ANDROID_STUDIO_DIR)
            if should_skip(file, rel_path):
                continue
            android_entries.append((abs_path, rel_path))
    with zipfile.ZipFile(android_zip_path, 'w') as zipf:
        write_zip_entries(zipf, ANDROID_STUDIO_DIR, android_entries)
    android_count = verify_zip(android_zip_path, require_web_files=False)
    print(f" -> amasa-android-studio.zip created successfully ({fmt_kb(android_zip_path)}, {android_count} files).")

print("Completed successfully: verified packages placed in public/:")
print(f" 1. public/amasa-source.zip         ({fmt_kb(source_zip_path)}, {src_count} files)")
print(f" 2. public/amasa-dist.zip           ({fmt_kb(dist_zip_path)}, {dist_count} files)")
print(f" 2b. public/amasa-resort-cyberpanel.zip ({fmt_kb(cp_zip_path)}, {cp_count} files)  <- الرفع على CyberPanel")
if starter_count:
    print(f" 3. public/amasa-claude-starter.zip ({fmt_kb(starter_zip_path)}, {starter_count} files)")
if android_count:
    print(f" 4. public/amasa-android-studio.zip ({fmt_kb(android_zip_path)}, {android_count} files)")

