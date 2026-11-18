#!/usr/bin/env python3
"""בונה את תיקיית האתר ל-GitHub Pages מקובצי הייצור.
שימוש:  python build_site.py SRC_DIR OUT_DIR
SRC_DIR חייב להכיל: Code.gs, Index.html, ConsumptionAnalysis.html, SystemSizing.html, FinancialModel.html, PrintQuote.html
(הטופס Form.html אינו נכלל: הוא מצפין עם המפתח הציבורי של הפריסה האמיתית, ופענוח דורש את המפתח הפרטי)."""
import sys, os, re, shutil

PAGES = {'Index.html': 'crm.html', 'ConsumptionAnalysis.html': 'consumption.html', 'SystemSizing.html': 'sizing.html',
         'FinancialModel.html': 'finance.html', 'PrintQuote.html': 'print.html'}
SHIM_TAGS = ['config.js', 'seed-data.js', 'fake-sheets.js', 'gas-shim.js']
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, 'template')

def inject(html, name):
    if re.search(r'<\?', html):
        print(f'  אזהרה: {name} מכיל תגי תבנית של Apps Script (<? ?>). הם יוסרו.')
        html = re.sub(r'<\?[=!]?.*?\?>', '', html, flags=re.S)
    m = re.search(r'<head[^>]*>', html, flags=re.I)
    if not m: raise SystemExit(f'{name}: לא נמצא תג <head> להזרקת המתאם')
    tags = '\n'.join(f'<script src="{t}"></script>' for t in SHIM_TAGS)
    return html[:m.end()] + '\n' + tags + html[m.end():]

def main(src, out):
    os.makedirs(os.path.join(out, 'apps-script'), exist_ok=True)
    for srcname, dstname in PAGES.items():
        p = os.path.join(src, srcname)
        if not os.path.exists(p): raise SystemExit('חסר קובץ מקור: ' + p)
        open(os.path.join(out, dstname), 'w', encoding='utf-8').write(inject(open(p, encoding='utf-8').read(), srcname))
        print('  ', srcname, '->', dstname)
    gs = os.path.join(src, 'Code.gs')
    if not os.path.exists(gs): raise SystemExit('חסר קובץ מקור: ' + gs)
    shutil.copy(gs, os.path.join(out, 'apps-script', 'Code.gs'))
    for f in ['index.html'] + SHIM_TAGS + ['README.md']:
        shutil.copy(os.path.join(TEMPLATE, f), os.path.join(out, f))
    sys.path.insert(0, HERE)
    import make_samples
    os.makedirs(os.path.join(out, 'samples'), exist_ok=True)
    make_samples.make_csv(os.path.join(out, 'samples', 'sample_iec_15min_2y.csv'))
    make_samples.make_json(os.path.join(out, 'samples', 'sample_form_billing.json'))
    print('האתר נבנה ב:', out)

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
