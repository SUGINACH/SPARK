# בדיקות דפדפן למצב API (לא חובה לפריסה)

מריצות את כל הזרימה בדפדפן (Playwright) מול **שרת בדיקה מקומי** (`fake_gas_server.js`) שמחקה את נקודת הקצה של Apps Script: POST ל-`/exec`, הפניה 302, בלי preflight, ו-`Code.gs` האמיתי על גיליון מדומה.
הבדיקות לא מוכיחות התנהגות של Google עצמו (CORS, מכסות, זמני ריצה): את זה בודקים בפריסה אמיתית.

דרישות: `pip install playwright && playwright install chromium`, ו-Node. בתיקייה שמכילה את תיקיית האתר: `npm i papaparse@5.4.1 xlsx@0.18.5 chart.js@4.4.1` (תיקיית `node_deps`). הספריות מ-CDN מוחלפות בקבצים מקומיים בזמן הבדיקה.
משתני סביבה: `BS_WORK` (ברירת מחדל `/home/claude/work`), `BS_SITE` (שם תיקיית האתר, ברירת מחדל `site_out`).

סדר: `api_p1.py` (מאפס מצב) ← `api_p2.py` ← `api_p3.py` ← `api_p4.py` (חיבור, מפתח שגוי, שגיאות, ניתוק).
