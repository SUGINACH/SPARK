/**
 * =====================================================================
 * בראשית סולאר — מערכת הצעות מחיר ו-CRM
 * code.js — לוגיקת צד-שרת (Google Apps Script)
 * =====================================================================
 * החלטות ארכיטקטוניות מחייבות (ר' מסמכי אפיון-על ודוחות הביקורת):
 *
 * 1. שמירת לקוח (saveCustomerData) היא תמיד כתיבה מלאה של 28 העמודות,
 *    בסדר קבוע ומדויק. כל קורא חדש (Calculator/Form/PrintQuote) שרוצה
 *    לעדכן רק חלק מהשדות חייב קודם לקרוא getCustomerData(clientId),
 *    למזג את השינויים לתוך האובייקט שחזר, ורק אז לשמור אותו בחזרה
 *    במלואו — אחרת כל שדה שלא נכלל בקריאה יימחק בשקט.
 *
 * 2. קריאת לקוח (getCustomerData) בונה אובייקט לפי שם כותרת עמודה
 *    (בטוח מול הוספת עמודות עתידית), ומבצעת תאימות-לאחור אוטומטית
 *    ללקוחות שנוצרו לפני שיפור הכרטיסיות (מרכיבה "כרטיסייה 1" מתוך
 *    חמשת העמודות הישנות אם 'רכיבי מערכת (JSON)' ריקה).
 *
 * 3. אין שימוש ב-localStorage להעברת מידע בין חלונות (Index/Calculator/
 *    Form/Print) — כל הגישור נעשה או דרך פרמטרי URL (מזהים קלים כמו
 *    clientId), או דרך קריאות שרת ישירות (google.script.run), כדי
 *    לעקוף את חסימת ה-Same-Origin Policy שמונעת שיתוף localStorage בין
 *    תת-הדומיינים הנפרדים של googleusercontent.com שמגישים כל עמוד.
 *
 * שמות קבצי ה-HTML בפרויקט ה-Apps Script עצמו (לא שם קובץ ה-.html
 * שמורידים למחשב) חייבים להיות בדיוק: Index, Form, PrintQuote,
 * CalcConsumption, CalcSizing, CalcFinancial — אלה השמות ש-doGet מפנה
 * אליהם למטה. (ה-page הישן 'calculator' יחיד הוחלף בשלושה: consumption/
 * sizing/financial, בעקבות פיצול המחשבון לשלושה שלבים נפרדים).
 *
 * 4. הסכימה גדלה מ-28 ל-31 עמודות (ר' oneTimeSetup_v3) כדי לתמוך בשלושת
 *    שלבי המחשבון: עמודה 29 = תוצאות שלב 1 (סדרת צריכה שעתית "רזה" +
 *    מטא-דאטה קצרה - לא הדוח המועשר המלא, שנשאר קובץ Excel להורדה בלבד
 *    ואינו נשמר בגיליון), עמודה 30 = סדרת ייצור שעתית "רזה" (בעמודה
 *    נפרדת מהצריכה, כדי לא לחרוג מ-~50,000 התווים לתא כששתיהן קיימות),
 *    עמודה 31 = תוצאות שלב 2 (המלצת גודל + הסבר). התוצאות של שלב 3
 *    (הפיננסי) ממשיכות להיכתב לעמודות הפיננסיות הקיימות (20-24) — אין
 *    להן עמודה ייעודית חדשה, כי הן כבר היעד הסופי שמזין את ההצעה.
 * =====================================================================
 */

/**
פונקציה ראשית להגשת ה-HTML עם ניתוב דינמי לפי פרמטר page
*/
function doGet(e) {
  const page = e.parameter.page || 'Index';

  if (page === 'print') {
    return HtmlService.createTemplateFromFile('PrintQuote')
      .evaluate()
      .setTitle('בראשית סולאר - הדפסת הצעת מחיר')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // שלושת שלבי המחשבון (הוחלפו מ-page='calculator' יחיד) - כל שלב הוא קובץ HTML נפרד,
  // מוזן מהקודם דרך clientId ב-URL בלבד (getCustomerData שולף את הנתונים בפועל בצד השרת)
  if (page === 'consumption') {
    return HtmlService.createHtmlOutputFromFile('CalcConsumption')
      .setTitle('שלב 1 - ניתוח והעשרת נתוני צריכה וייצור')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (page === 'sizing') {
    return HtmlService.createHtmlOutputFromFile('CalcSizing')
      .setTitle('שלב 2 - המלצת גודל מערכת')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (page === 'financial') {
    return HtmlService.createHtmlOutputFromFile('CalcFinancial')
      .setTitle('שלב 3 - ניתוח פיננסי')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // חלון טופס איסוף נתונים ללקוח
  // משתמשים ב-Template כדי להזריק את ה-clientId מהשרת ישירות ל-HTML
  // (ולא לקרוא אותו מ-JS בצד הלקוח — תוספי דפדפן מסוימים מפילים את
  // הקריאה הזו אם היא מתבצעת מאוחר מדי, ר' החלטה מתועדת במסמכי האפיון)
  if (page === 'form') {
    const tmpl = HtmlService.createTemplateFromFile('Form');
    tmpl.clientIdParam = e.parameter.clientId || '';
    return tmpl.evaluate()
      .setTitle('טופס לאיסוף נתוני חשמל')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('בראשית סולאר - מערכת הצעות מחיר')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
משיכת כתובת ה-Web App המעודכנת לצורך פתיחת חלון חדש (מחשבון/טופס/הדפסה)
*/
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
משיכת נתונים ראשונית (מחירון, לקוחות קיימים והגדרות)
כולל המרה אוטומטית של תמונות שהוכנסו לתא (CellImage) לקוד Base64
*/
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // מחירון
  const catalogSheet = ss.getSheetByName("מחירון");
  const catalogValues = catalogSheet.getDataRange().getValues(); // שימוש ב-getValues לשמירה על אובייקטי תמונה
  const catalogHeaders = catalogValues.shift().map(h => String(h).trim());

  // זיהוי דינמי של עמודת התמונה (תומך ב"תמונה", "תמונות", "תמונת מוצר" וכו')
  const imgColIdx = catalogHeaders.findIndex(h => h.includes('תמונ') || h.includes('לוגו') || h.toLowerCase().includes('image'));

  const catalog = catalogValues.map(row => {
    let obj = {};
    catalogHeaders.forEach((h, i) => {
      let val = row[i];
      // המרה אוטומטית ובטוחה של CellImage לקוד Base64
      if (i === imgColIdx && val) {
        val = convertCellImageToBase64(val);
        obj['image'] = val; // מפתח קבוע ואחיד לכל התמונות באפליקציה
      }
      obj[h] = val;
    });
    return obj;
  });

  // לקוחות ופרוייקטים
  const customerSheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const customerData = customerSheet.getDataRange().getDisplayValues();
  const customerHeaders = customerData.shift().map(h => String(h).trim());
  const customers = customerData.map(row => {
    let obj = {};
    customerHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // הגדרות
  const settingsSheet = ss.getSheetByName("הגדרות");
  const settingsData = settingsSheet.getDataRange().getDisplayValues();
  const settingsHeaders = settingsData.shift().map(h => String(h).trim());
  const settings = { powerSources: [], consumers: [] };

  if (settingsHeaders.includes('מקורות חשמל')) {
    settings.powerSources = settingsData.map(r => r[settingsHeaders.indexOf('מקורות חשמל')]).filter(v => v && v.toString().trim() !== '');
  } else {
    settings.powerSources = ['חברת החשמל', 'חשמל מתחדש', 'אחר'];
  }

  if (settingsHeaders.includes('צרכנים')) {
    settings.consumers = settingsData.map(r => r[settingsHeaders.indexOf('צרכנים')]).filter(v => v && v.toString().trim() !== '');
  } else {
    settings.consumers = ['מזגן', 'תנור', 'כביסה', 'קומפרסור', 'אחר'];
  }

  return { catalog, customers, settings };
}

/**
המרת אובייקט CellImage של גוגל לקוד Base64 הניתן להצגה ב-HTML.
אם התא כבר מכיל מחרוזת Base64/URL רגילה (לא אובייקט CellImage), היא מוחזרת כמות שהיא.
*/
function convertCellImageToBase64(cellImageValue) {
  if (!cellImageValue) return "";
  try {
    if (typeof cellImageValue === 'object' && typeof cellImageValue.getBlob === 'function') {
      const blob = cellImageValue.getBlob();
      if (blob) {
        const bytes = blob.getBytes();
        const base64 = Utilities.base64Encode(bytes);
        return "data:" + blob.getContentType() + ";base64," + base64;
      }
    }
  } catch (e) {
    // אם התא כבר מכיל מחרוזת Base64 או URL, נחזיר אותו כפי שהוא
    return cellImageValue;
  }
  return cellImageValue;
}

/**
טעינת פרטי לקוח ספציפי — משמש את Index (חיפוש/רענון), את Form (מילוי מוקדם),
ובעתיד גם את Calculator (קריאה-מיזוג-שמירה) ואת PrintQuote (שליפת כל הנתונים
המחושבים/השמורים לפי clientId, ללא שום payload חוצה-חלון).
*/
function getCustomerData(clientId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data.shift().map(h => String(h).trim());

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(clientId).trim()) {
      let obj = {};
      headers.forEach((h, idx) => obj[h] = data[i][idx]);

      // כל השדות שנשמרים כ-JSON חייבים לעבור כאן פענוח (ולא רק חלקם) —
      // "תמונות לקוח (JSON)" נוספה כאן כתיקון: saveCustomerData כבר כתבה
      // אותה כ-JSON, אבל היא הייתה חסרה מהרשימה הזו, כך שכל קורא ישיר של
      // getCustomerData (לא רק Index, שעשה פענוח כפול בעצמו בצד הלקוח) היה
      // מקבל בחזרה מחרוזת גולמית במקום מערך.
      const jsonFields = ['מקורות חשמל (JSON)', 'צרכנים (JSON)', 'מצברים', 'ממירים', 'פאנלים', 'התקנה', 'תוספות', 'רכיבי מערכת (JSON)', 'תמונות לקוח (JSON)'];
      jsonFields.forEach(field => {
        if (obj[field] && (obj[field].toString().startsWith('{') || obj[field].toString().startsWith('['))) {
          try { obj[field] = JSON.parse(obj[field]); } catch(e) { obj[field] = []; }
        } else {
          obj[field] = [];
        }
      });

      // עמודות שלבי המחשבון (29-31): אובייקטים (לא מערכים) שמברירת המחדל שלהם היא null
      // (לא []), כי "אין עדיין תוצאה משלב זה" הוא מצב תקין ושכיח (למשל שלב 3 נפתח לפני שלב 1-2 רצו).
      const jsonObjectFields = ['נתוני צריכה שעתיים (מערך רזה)', 'נתוני ייצור שעתיים (מערך רזה)', 'נתוני המלצת גודל (JSON)'];
      jsonObjectFields.forEach(field => {
        if (obj[field] && (obj[field].toString().startsWith('{') || obj[field].toString().startsWith('['))) {
          try { obj[field] = JSON.parse(obj[field]); } catch(e) { obj[field] = null; }
        } else {
          obj[field] = null;
        }
      });

      // תאימות לאחור (שיפור 1): אם 'רכיבי מערכת (JSON)' ריק (שורות שנוצרו לפני הכרטיסיות),
      // בונים "כרטיסייה 1" באופן שקוף מתוך חמשת העמודות הישנות — בלי צורך במיגרציה חד-פעמית על הנתונים.
      if (!obj['רכיבי מערכת (JSON)'] || !obj['רכיבי מערכת (JSON)'].length) {
        obj['רכיבי מערכת (JSON)'] = [{
          name: 'רכיבי מערכת 1',
          batteries: obj['מצברים'],
          inverters: obj['ממירים'],
          panels: obj['פאנלים'],
          installation: obj['התקנה'],
          addons: obj['תוספות']
        }];
      }

      return obj;
    }
  }
  return null;
}

/**
שמירה או עדכון של נתוני לקוח ופרויקט — כתיבה מלאה של 31 העמודות, בסדר קבוע.
ר' הערת הארכיטקטורה בראש הקובץ: קריאה חלקית (payload עם רק כמה שדות) תמחק
בשקט כל שדה אחר שלא נכלל בו — כל צרכן חייב לקרוא getCustomerData קודם,
למזג, ורק אז לשמור בחזרה במלואו.
*/
function saveCustomerData(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("לקוחות ופרוייקטים");
  const data = JSON.parse(payload);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.clientId).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowData = [
    data.clientId || "",
    data.clientName || "",
    data.clientAddress || "",
    data.clientContact || "",
    data.clientPhone || "",
    data.projectTitle || "",
    data.quoteDate || "",
    data.roofArea || "",
    data.form4 || "",
    data.gridQuota || "",
    JSON.stringify(data.powerSources || []),
    JSON.stringify(data.consumers || []),
    data.panelPower || "",
    data.storageCapacity || "",
    JSON.stringify(data.batteries || []),       // עמודה 15: כפילות של הכרטיסייה הפעילה (תאימות לאחור, החלטה סופית)
    JSON.stringify(data.inverters || []),        // עמודה 16: כנ"ל
    JSON.stringify(data.panels || []),           // עמודה 17: כנ"ל
    JSON.stringify(data.installation || []),     // עמודה 18: כנ"ל
    JSON.stringify(data.extras || []),           // עמודה 19: כנ"ל
    data.totalPrice || "",
    data.annualSavings || "",
    data.roi || "",
    data.profit25 || "",
    data.analysisNotes || "",                      // עמודה 24: "הערות ניתוח"
    JSON.stringify(data.clientImages || []),       // עמודה 25: "תמונות לקוח (JSON)"
    JSON.stringify(data.systemCards || []),        // עמודה 26: מערך כל כרטיסיות רכיבי המערכת
    data.activeCardIndex != null ? data.activeCardIndex : 0, // עמודה 27: איזו כרטיסייה תיפתח כברירת מחדל בפעם הבאה
    data.inverterPowerTarget || "",                 // עמודה 28: עוצמת ממיר נדרשת (kW), לסקשן הצעת השילובים
    data.consumptionHourlyLean ? JSON.stringify(data.consumptionHourlyLean) : "", // עמודה 29: פלט שלב 1 (מחשבון) - סדרת צריכה שעתית רזה + מטא-דאטה
    data.productionHourlyLean ? JSON.stringify(data.productionHourlyLean) : "",   // עמודה 30: סדרת ייצור שעתית רזה, בעמודה נפרדת מהצריכה (מגבלת תווים לתא)
    data.sizingRecommendation ? JSON.stringify(data.sizingRecommendation) : ""    // עמודה 31: פלט שלב 2 (מחשבון) - המלצת גודל + הסבר
  ].map(val => val === null || val === undefined ? "" : String(val));

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 31).setValues([rowData]);
    return "הנתונים עודכנו בהצלחה!";
  } else {
    sheet.appendRow(rowData);
    return "לקוח חדש נשמר בהצלחה!";
  }
}

/**
שליפת תעריף מחברת החשמל.
כרגע ערך קבוע (stub) — ניתן להחליף בעתיד בקריאת API אמיתית כשתהיה זמינה.
*/
function getTariffFromCompany() {
  return { fixed: 70.15, toz: "44.8-123.3" };
}

/**
=====================================================================
 הרצה חד-פעמית בלבד! להריץ ידנית פעם אחת מתוך עורך ה-Apps Script
 (בחירת הפונקציה מהתפריט למעלה ← Run), ולא לקרוא לה משום קוד אחר.
 לאחר הרצה מוצלחת אחת אפשר למחוק את הפונקציה הזו.

 מבצעת:
 1. תיקון כותרות עמודות 24-25 בגיליון "לקוחות ופרוייקטים" — התוכן שכבר
    שמור בעמודות האלה תקין ולא זז ממקומו; רק הכותרות היו שגויות/חסרות,
    מה שגרם לטופס לקרוא הערות-ניתוח ותמונות-לקוח מהמקום ההפוך.
 2. הוספת כותרות לעמודות 26-28 החדשות (כרטיסיות/אינדקס פעיל/עוצמת ממיר).
 3. הוספת כותרות (בלבד — לא ערכים) לעמודות החדשות הדרושות ב"מחירון".
    את הערכים בפועל (מידות/הספק/קיבולת/וכו') יש למלא ידנית לפי המפרט
    האמיתי של כל מוצר — זה לא ניתן לגזור אוטומטית משם הדגם.
=====================================================================
*/
function oneTimeSetup_v2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const custSheet = ss.getSheetByName("לקוחות ופרוייקטים");
  custSheet.getRange(1, 24).setValue("הערות ניתוח");
  custSheet.getRange(1, 25).setValue("תמונות לקוח (JSON)");
  custSheet.getRange(1, 26).setValue("רכיבי מערכת (JSON)");
  custSheet.getRange(1, 27).setValue("כרטיסייה פעילה (אינדקס)");
  custSheet.getRange(1, 28).setValue("עוצמת ממיר נדרשת");

  const catSheet = ss.getSheetByName("מחירון");
  const lastCol = catSheet.getLastColumn();
  const existingHeaders = catSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  // הסדר כאן הוא רק לצורך הוספה נוחה; לכל עמודה יש משמעות רק בקטגוריה הרלוונטית לה (ר' הודעת הליווי)
  const newCatalogHeaders = [
    "מידות", "הספק",                                              // פאנלים
    "קיבולת", "מגבלת הכפלה", "מגבלת שרשור", "BMS כלול",           // מצברים
    "עוצמה", "היברידי", "התאמה למערכת",                           // ממירים
    "קבוצת התאמה"                                                  // חוצה-קטגוריות (מצברים/ממירים/פאנלים/תוספות)
  ];
  let nextCol = lastCol + 1;
  newCatalogHeaders.forEach(h => {
    if (existingHeaders.indexOf(h) === -1) {
      catSheet.getRange(1, nextCol).setValue(h);
      nextCol++;
    }
  });

  SpreadsheetApp.getUi().alert(
    "המיגרציה הושלמה.\n\n" +
    "נותר למלא ידנית בגיליון 'מחירון': מידות+הספק לכל פאנל, קיבולת+מגבלת הכפלה+מגבלת שרשור+BMS כלול לכל מצבר, " +
    "עוצמה+היברידי+התאמה למערכת לכל ממיר, וקבוצת התאמה איפה שרלוונטי."
  );
}

/**
=====================================================================
 הרצה חד-פעמית בלבד! להריץ ידנית פעם אחת מתוך עורך ה-Apps Script,
 בדיוק כמו oneTimeSetup_v2 (שאותה אינה דורסת/כופלת - בטוח להריץ את שתיהן,
 בכל סדר, גם יותר מפעם אחת - כל כותרת נכתבת רק אם עדיין לא קיימת).

 מוסיפה את שלוש כותרות העמודות הדרושות לפיצול המחשבון לשלושה שלבים:
 עמודה 29 (פלט שלב 1: צריכה), עמודה 30 (פלט שלב 1: ייצור), עמודה 31
 (פלט שלב 2: המלצת גודל). אינה נוגעת בשום נתון קיים בעמודות 1-28.
=====================================================================
*/
function oneTimeSetup_v3() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet = ss.getSheetByName("לקוחות ופרוייקטים");

  const newHeaders = [
    [29, "נתוני צריכה שעתיים (מערך רזה)"],
    [30, "נתוני ייצור שעתיים (מערך רזה)"],
    [31, "נתוני המלצת גודל (JSON)"]
  ];
  newHeaders.forEach(([col, header]) => {
    const existing = custSheet.getRange(1, col).getValue();
    if (!existing) custSheet.getRange(1, col).setValue(header);
  });

  SpreadsheetApp.getUi().alert(
    "המיגרציה הושלמה: עמודות 29-31 (נתוני שלב 1+2 של המחשבון) קיימות כעת בגיליון 'לקוחות ופרוייקטים'."
  );
}
