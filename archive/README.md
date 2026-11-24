# ארכיב: קבצים היסטוריים

הקבצים כאן **אינם בשימוש** במערכת הנוכחית ונשמרים לעיון בלבד. אין לערוך אותם. המקור לאמת הוא קבצי השורש
(`crm.html`, `consumption.html`, `sizing.html`, `finance.html`, `print.html`, `apps-script/Code.gs`).
ענפי Git ההיסטוריים (`Black`, `Gold`, `Green`, `Red`, `Blue`, `archive`) נשארו כפי שהיו, כרשומת היסטוריה.

## `pages/`: עותקי הייצור הישנים של הדפים
| קובץ | מה היה | מקבילה נוכחית |
|---|---|---|
| `Index.html` | CRM והצעת מחיר (גרסת Apps Script שמוגשת מהשרת) | `crm.html` |
| `ConsumptionAnalysis.html` | שלב 1: ניתוח צריכה | `consumption.html` |
| `SystemSizing.html` | שלב 2: המלצת גודל מערכת | `sizing.html` |
| `FinancialModel.html` | שלב 3: מודל פיננסי | `finance.html` |
| `PrintQuote.html` | הצעת מחיר מודפסת | `print.html` |
| `Calculator.html` | מחשבון חד-קובצי ישן, לפני הפיצול לשלושה שלבים | אין (הוחלף בשלבים 1-3) |

הדפים הנוכחיים זהים לאלה בתוספת ארבעה סקריפטים של מתאם (`config.js`, `seed-data.js`, `fake-sheets.js`, `gas-shim.js`),
ותיקונים שנעשו מאז (D4, D14, D15, D23, לוח הגדרות).

## `server/`
| קובץ | מה היה |
|---|---|
| `code.js` | שרת Apps Script ישן שהגיש גם את דפי ה-HTML (`google.script.run`). הוחלף ב-`apps-script/Code.gs` (API בלבד, עם כניסת משתמשים) |

## `docs/`
| קובץ | מה היה |
|---|---|
| `solar_transition_brief.md` | מסמך מעבר ישן (לפני ההפרדה לאתר סטטי). הנוכחי: `docs/bereshit_solar_transition_brief.md` |
| `מדריך_ארכיטקטורה_מלא_...html` | מדריך ארכיטקטורה שקדם לפיצול. מיושן |
| `תכנית_השלמה_וחיבור_...html` | תכנית ההשלמה הראשונית |
| `תכנית_פיצול_המחשבון_ל3_שלבים.html` | תכנית הפיצול לשלושה שלבים |
| `שיחת AI קלוד - SOLAR_BLUE.md` | תמלול שיחת פיתוח ארוכה (כ-500KB) |

## `tools/`
| קובץ | מה היה |
|---|---|
| `build_site.py`, `build_demo.py` | בנו את האתר מקובצי הייצור הישנים בהזרקת המתאם. כבר לא נחוצים: הדפים נערכים ישירות והמתאם כבר מוטמע בהם |
| `template/` | תבנית הקבצים שהבנייה העתיקה. עותקי הקבצים החיים נמצאים בשורש |
