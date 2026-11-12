#!/usr/bin/env python3
"""יוצר קבצי דוגמה סינתטיים לדמו (אין בהם נתונים אמיתיים):
   samples/sample_iec_15min_2y.csv  - מונה חח"י ברבע-שעה, שנתיים (01/10/2024-30/09/2026), בפורמט שהמערכת קוראת
   samples/sample_form_billing.json - קובץ בפורמט הטופס: סדרה שעתית לשנה + סוג נכס + נתוני חיוב
שימוש: python make_samples.py OUT_DIR"""
import sys, os, json, random, datetime as dt

HOURLY_KW = [0.35]*6 + [0.6, 0.9, 0.7, 0.5, 0.5, 0.5, 0.6, 0.6, 0.6, 0.7, 0.7, 1.1, 1.5, 1.5, 1.5, 1.5, 1.0, 0.6]

def kw(t, rng):
    h = t.hour
    v = HOURLY_KW[h]
    if t.month in (6, 7, 8, 9) and h >= 12: v += 0.8            # מזגן בקיץ
    if t.month in (12, 1, 2) and h >= 17: v += 0.4             # חימום בחורף
    if t.weekday() == 5 and 9 <= h <= 16: v += 0.2             # שבת: בבית
    if t >= dt.datetime(2025, 10, 1): v *= 1.08                # גידול בשנה השנייה
    return v * (1 + rng.uniform(-0.1, 0.1))

def make_csv(path):
    rng = random.Random(42)
    start = dt.datetime(2024, 10, 1); end = dt.datetime(2026, 10, 1)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write('שם לקוח,כתובת,מספר חוזה\n\nלקוח לדוגמה (דמו),"רחוב הדמו 1, תל אביב",123456789\n')
        f.write('סוג מונה,קוד מונה,מספר מונה\n\nצריכה,01,987654321\n\n')
        f.write('קוד ומספר מונה,סוג מונה,תאריך,שעת התחלה,צריכה (קוט"ש),הזרמה\n')
        t = start
        while t < end:
            f.write('01-987654321,צריכה,%s,%s,%.3f,\n' % (t.strftime('%d/%m/%Y'), t.strftime('%H:%M'), kw(t, rng) / 4))
            t += dt.timedelta(minutes=15)

def make_json(path):
    rng = random.Random(7)
    start = dt.datetime(2025, 10, 1); series = []; monthly = {}
    t = start
    while t < dt.datetime(2026, 10, 1):
        v = round(kw(t, rng), 3)
        series.append({'date': t.strftime('%Y-%m-%d'), 'hour': t.hour, 'kwh': v})
        monthly[t.month] = monthly.get(t.month, 0) + v
        t += dt.timedelta(hours=1)
    total = sum(monthly.values())
    payload = {
        'fileType': 'bereshit-solar-consumption-data-v1',
        'client': {'name': 'לקוח לדוגמה (דמו)', 'address': 'רחוב הדמו 1, תל אביב', 'propertyType': 'private_house'},
        'billing': {'annualKwh': round(total), 'annualNis': round(total * 0.62),
                    'monthly': [{'month': m, 'kwh': round(monthly[m]), 'nis': round(monthly[m] * 0.62)} for m in range(1, 13)]},
        'hourlySeries': series
    }
    with open(path, 'w', encoding='utf-8') as f: json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'samples'
    os.makedirs(out, exist_ok=True)
    make_csv(os.path.join(out, 'sample_iec_15min_2y.csv'))
    make_json(os.path.join(out, 'sample_form_billing.json'))
    print('samples written to', out)
