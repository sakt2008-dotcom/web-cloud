#!/usr/bin/env python3
"""
يبني نسخة «معاينة الجوال» في المجلد preview-dist/ لنشرها كصفحة معزولة (Artifact) أو فتحها من أي مضيف ثابت.

الفروق عن النسخة الإنتاجية (التي ترفعها على CyberPanel — لا تتأثر بهذا السكربت):
  • مسارات نسبية (base './') لتعمل تحت أي مسار فرعي.
  • بلا Service Worker ولا PWA.
  • وضع الديمو الشخصي مفروض (بيانات تجريبية معزولة عن Firebase).
  • شيم صغير في index.html: تخزين احتياطي في الذاكرة، تعطيل serviceWorker إن كان محجوباً،
    وإخفاء الصور الخارجية التي يحجبها الإطار المعزول.
  • بلا ملفات أرشيف (zip) ولا .htaccess، وبلا viewport-fit=cover.

التشغيل:  python3 scripts/make_preview.py
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'preview-dist')

SHIM = """<script>
// معاينة AMASA RESORT — حماية من قيود الإطار المعزول
(function () {
  try { void navigator.serviceWorker; } catch (e) { try { delete Navigator.prototype.serviceWorker; } catch (e2) {} }
  function guard(name) {
    try { var s = window[name]; s.getItem('__amasa_probe__'); return; } catch (e) {}
    var mem = {};
    var shim = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; }
    };
    try { Object.defineProperty(window, name, { value: shim, configurable: true }); } catch (e3) {}
  }
  guard('localStorage'); guard('sessionStorage');
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') { t.style.visibility = 'hidden'; }
  }, true);
})();
</script>
"""


def run_build():
    env = dict(os.environ, VITE_PREVIEW='1')
    cmd = ['npx', 'vite', 'build', '--outDir', 'preview-dist', '--emptyOutDir', '--logLevel', 'error']
    print('> ' + ' '.join(cmd) + '  (VITE_PREVIEW=1)')
    subprocess.run(cmd, cwd=ROOT, env=env, check=True)


def clean_output():
    for root, _dirs, files in os.walk(OUT):
        for f in files:
            low = f.lower()
            if low.endswith(('.zip', '.pdf', '.apk', '.gz', '.tar', '.7z')) or f in ('.htaccess', '_redirects', 'sw-push.js') \
                    or f.startswith(('serve.', 'run.')) or f == 'README.txt':
                os.remove(os.path.join(root, f))
    shutil.rmtree(os.path.join(OUT, 'uploads'), ignore_errors=True)


def patch_index():
    path = os.path.join(OUT, 'index.html')
    html = open(path, encoding='utf-8').read()
    html = re.sub(r'^\s*<!doctype html>', '<!DOCTYPE html>', html, count=1, flags=re.I)
    html = html.replace(', viewport-fit=cover', '').replace(',viewport-fit=cover', '')
    html = re.sub(r'(href|src)="/(?!/)', r'\1="./', html)
    html = html.replace('<head>', '<head>\n' + SHIM, 1)
    open(path, 'w', encoding='utf-8').write(html)


def report():
    total, count, biggest = 0, 0, ('', 0)
    for root, _dirs, files in os.walk(OUT):
        for f in files:
            p = os.path.join(root, f)
            size = os.path.getsize(p)
            total += size
            count += 1
            if size > biggest[1]:
                biggest = (os.path.relpath(p, OUT), size)
    print(f'preview-dist: {count} files, {total / 1024 / 1024:.1f} MB (largest: {biggest[0]} {biggest[1] / 1024:.0f} KB)')


if __name__ == '__main__':
    run_build()
    clean_output()
    patch_index()
    report()
    if not os.path.exists(os.path.join(OUT, 'index.html')):
        sys.exit('index.html missing')
