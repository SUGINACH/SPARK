#!/usr/bin/env python3
"""בונה את תיקיית הדמו ל-GitHub Pages מקובצי הייצור.
שימוש:  python build_demo.py SRC_DIR OUT_DIR
SRC_DIR חייב להכיל: code.js, Index.html, ConsumptionAnalysis.html, SystemSizing.html, FinancialModel.html, PrintQuote.html
(הטופס Form.html אינו נכלל: הוא מצפין עם המפתח הציבורי של הפריסה האמיתית)."""
import sys, os, re, shutil

PAGES = {'Index.html': 'crm.html', 'ConsumptionAnalysis.html': 'consumption.html', 'SystemSizing.html': 'sizing.html',
         'FinancialModel.html': 'finance.html', 'PrintQuote.html': 'print.html'}
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, 'template')

def inject_shim(html, name):
    tag = '<script src="gas-shim.js"></script>'
    if re.search(r'<\?', html):
        print(f'  אזהרה: {name} מכיל תגי תבנית של Apps Script (<? ?>). הם יוסרו.')
        html = re.sub(r'<\?[=!]?.*?\?>', '', html, flags=re.S)
    m = re.search(r'<head[^>]*>', html, flags=re.I)
    if not m:
        raise SystemExit(f'{name}: לא נמצא תג <head> להזרקת שכבת התאימות')
    return html[:m.end()] + '\n' + tag + html[m.end():]

def main(src, out):
    os.makedirs(out, exist_ok=True)
    for srcname, dstname in PAGES.items():
        p = os.path.join(src, srcname)
        if not os.path.exists(p): raise SystemExit('חסר קובץ מקור: ' + p)
        html = open(p, encoding='utf-8').read()
        open(os.path.join(out, dstname), 'w', encoding='utf-8').write(inject_shim(html, srcname))
        print('  ', srcname, '->', dstname)
    shutil.copy(os.path.join(src, 'code.js'), os.path.join(out, 'code.js'))
    for f in ('index.html', 'gas-shim.js', 'README.md'):
        shutil.copy(os.path.join(TEMPLATE, f), os.path.join(out, f))
    sys.path.insert(0, HERE)
    import make_samples
    os.makedirs(os.path.join(out, 'samples'), exist_ok=True)
    make_samples.make_csv(os.path.join(out, 'samples', 'sample_iec_15min_2y.csv'))
    make_samples.make_json(os.path.join(out, 'samples', 'sample_form_billing.json'))
    print('הדמו נבנה ב:', out)

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
