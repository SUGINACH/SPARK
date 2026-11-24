/*
 * config.js - הגדרות האתר (ציבורי: אל תכניסו לכאן סיסמאות או מפתחות).
 *   API_URL          : כתובת ה-Web App של Apps Script (מסתיימת ב-/exec). ריק = מצב דמו (נתונים בדפדפן בלבד).
 *   EXPORT_MODE      : 'server' (ייצוא Excel ב-Apps Script, עם צבעים) | 'client' (בדפדפן, בלי צבעים) | '' (ברירת מחדל לפי המצב).
 *   GOOGLE_CLIENT_ID : מזהה לקוח OAuth (Web application) לכניסה עם Google. ריק = אין כפתור Google. חייב להיות זהה ל-BS_GOOGLE_CLIENT_ID בשרת.
 * כניסת משתמשים (שם משתמש וסיסמה או Google) מתבצעת בדפדפן מול השרת. המשתמשים מנוהלים רק מעורך Apps Script.
 */
window.BS_CONFIG = { API_URL: '', EXPORT_MODE: '', GOOGLE_CLIENT_ID: '' };
