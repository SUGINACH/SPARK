/**
פונקציה ראשית להגשת ה-HTML עם ניתוב דינמי לעמוד ההדפסה
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
  
  if (page === 'calculator') {
    return HtmlService.createHtmlOutputFromFile('Calculator')
      .setTitle('מחשבון כדאיות ואגירה')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // חלון טופס איסוף נתונים ללקוח
  // הפעם אנו משתמשים ב-Template כדי להזריק את ה-clientId מהשרת ישירות ל-HTML
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
משיכת כתובת ה-Web App המעודכנת לצורך פתיחת חלון חדש
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
המרת אובייקט CellImage של גוגל לקוד Base64 הניתן להצגה ב-HTML
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
טעינת פרטי לקוח ספציפי (משמש גם את ה-Index וגם את הטופס המותאם אישית)
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
      
      const jsonFields = ['מקורות חשמל (JSON)', 'צרכנים (JSON)', 'מצברים', 'ממירים', 'פאנלים', 'התקנה', 'תוספות', 'רכיבי מערכת (JSON)'];
      jsonFields.forEach(field => {
        if (obj[field] && (obj[field].toString().startsWith('{') || obj[field].toString().startsWith('['))) {
          try { obj[field] = JSON.parse(obj[field]); } catch(e) { obj[field] = []; }
        } else {
          obj[field] = [];
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
שמירה או עדכון של נתוני לקוח ופרויקט
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
    JSON.stringify(data.powerSources) || "[]",
    JSON.stringify(data.consumers) || "[]",
    data.panelPower || "",
    data.storageCapacity || "",
    JSON.stringify(data.batteries) || "[]",       // עמודה 15: כפילות של הכרטיסייה הפעילה (תאימות לאחור, החלטה סופית)
    JSON.stringify(data.inverters) || "[]",        // עמודה 16: כנ"ל
    JSON.stringify(data.panels) || "[]",           // עמודה 17: כנ"ל
    JSON.stringify(data.installation) || "[]",     // עמודה 18: כנ"ל
    JSON.stringify(data.extras) || "[]",           // עמודה 19: כנ"ל
    data.totalPrice || "",
    data.annualSavings || "",
    data.roi || "",
    data.profit25 || "",
    data.analysisNotes || "",                      // עמודה 24: כותרת בגיליון חייבת להיות "הערות ניתוח" (ר' הערת מיגרציה בראש הקובץ)
    JSON.stringify(data.clientImages) || "[]",     // עמודה 25: כותרת בגיליון חייבת להיות "תמונות לקוח (JSON)" (ר' הערת מיגרציה בראש הקובץ)
    JSON.stringify(data.systemCards) || "[]",      // עמודה 26 (חדשה): מערך כל כרטיסיות רכיבי המערכת
    data.activeCardIndex != null ? data.activeCardIndex : 0, // עמודה 27 (חדשה): איזו כרטיסייה תיפתח כברירת מחדל בפעם הבאה
    data.inverterPowerTarget || ""                 // עמודה 28 (חדשה): עוצמת ממיר נדרשת (kW), לסקשן הצעת השילובים
  ].map(val => val === null || val === undefined ? "" : String(val));

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 28).setValues([rowData]);
    return "הנתונים עודכנו בהצלחה!";
  } else {
    sheet.appendRow(rowData);
    return "לקוח חדש נשמר בהצלחה!";
  }
}

/**
שליפת תעריף מחברת החשמל
*/
function getTariffFromCompany() {
  try {
    return { fixed: 70.15, toz: "44.8-123.3" };
  } catch (e) {
    Logger.log("שגיאה בשליפת תעריף: " + e.toString());
    return { fixed: 70.15, toz: "44.8-123.3" };
  }
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