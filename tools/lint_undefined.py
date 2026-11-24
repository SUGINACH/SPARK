#!/usr/bin/env python3
"""סורק את ה-JS של כל דפי HTML בתיקייה ומדווח על זיהוי משתנים/פונקציות שלא הוגדרו (no-undef).
תפס את detectStepHours ו-fmtDateInput שנשכחו בפיצול המחשבון. להריץ לפני כל העלאה.
שימוש:  python lint_undefined.py <תיקיית HTML> [נתיב ל-eslint]   (דורש: npm i eslint@8)"""
import sys, os, subprocess, glob, re, tempfile
try:
    from bs4 import BeautifulSoup
except ImportError:
    raise SystemExit('נדרש: pip install beautifulsoup4')
src = sys.argv[1] if len(sys.argv) > 1 else '.'
eslint = sys.argv[2] if len(sys.argv) > 2 else 'eslint'
bad = 0
for path in sorted(glob.glob(os.path.join(src, '*.html'))):
    soup = BeautifulSoup(open(path, encoding='utf-8').read(), 'html.parser')
    js = '\n'.join((s.string or s.get_text()) for s in soup.find_all('script') if not s.get('src'))
    if not js.strip(): continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f: f.write(js); tmp = f.name
    r = subprocess.run([eslint, '--no-eslintrc', '--env', 'browser,es2021', '--parser-options', 'ecmaVersion:2022', '--global', 'google,XLSX,Papa,Chart,BS_SEED,BSFake',
                        '--rule', '{"no-undef":"error"}', '-f', 'unix', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    lines = [l for l in r.stdout.split('\n') if 'is not defined' in l]
    names = sorted(set(re.findall(r"'([^']+)' is not defined", '\n'.join(lines))))
    print(f'{os.path.basename(path):28}', ('✅ אין' if not names else '🔴 ' + ', '.join(names)))
    bad += len(names)
sys.exit(1 if bad else 0)
