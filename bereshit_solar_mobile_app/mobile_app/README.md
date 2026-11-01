# בראשית סולאר - אפליקציית מובייל (Flutter)

גרסה ניידת ל-CRM, לאנשי מכירות בשטח. עובדת מול **אותו גיליון Google Sheets** בדיוק
כמו מערכת ה-Apps Script הקיימת - שתי המערכות ממשיכות לפעול יחד, ותמיד דרך אותן
פונקציות ב-code.js (אין שכפול לוגיקה).

## איך זה בנוי

- **מסך רשימת לקוחות + חיפוש** - נתונים ניידים, נטענים דרך ה-API החדש (`apiCustomerList`).
- **מסך פרטי לקוח** - מציג את השלב הבא (בדיוק כמו הכפתורים ב-Index.html).
- **WebView** - כשלוחצים "המשך לשלב X" / "פתח טופס" / "פתח הצעת מחיר", האפליקציה
  פותחת את אותו דף HTML קיים בדיוק (ConsumptionAnalysis.html / SystemSizing.html /
  FinancialModel.html / Form.html / PrintQuote.html) בתוך חלון מובנה - שום דבר
  מהלוגיקה המורכבת (מנוע האיחוד, זיהוי שבת הלכתי, מנוע ההמלצה, המודל הפיננסי)
  לא שוכפל ב-Dart.

## הכנה בצד השרת (חד-פעמי)

1. ב-code.js המעודכן (מצורף גם הוא) כבר קיימות הפונקציות `handleApiRequest`,
   `apiCustomerList`, `apiCustomerDetail`, `setApiKey_oneTime`. יש להעלות את
   code.js המעודכן ל-Apps Script (אם עוד לא הועלה).
2. בעורך ה-Apps Script: לפתוח את `setApiKey_oneTime`, להחליף את
   `'CHANGE-ME-to-a-random-32-char-string'` במחרוזת אקראית משלכם (32+ תווים -
   אפשר ליצור באתר כמו passwordsgenerator.net), להריץ את הפונקציה פעם אחת.
3. לוודא שהפריסה (Deploy → Manage deployments) עדכנית לגרסת code.js הזו.
4. לשמור את כתובת ה-Web App (`.../exec`) ואת המפתח שבחרתם - יידרשו בהגדרות האפליקציה.

## הרצה מקומית (לבדיקה, לפני בניית APK/IPA)

```bash
cd mobile_app
flutter pub get
flutter run
```

בעליית האפליקציה בפעם הראשונה היא תבקש את כתובת ה-Web App ואת מפתח ה-API -
אלה נשמרים במכשיר (SharedPreferences) ולא צריך להזין שוב.

## בניית APK להתקנה על אנדרואיד

```bash
flutter build apk --release
```
הקובץ ייווצר ב-`build/app/outputs/flutter-apk/app-release.apk` - להעביר למכשיר ולהתקין
(יידרש לאשר "התקנה ממקורות לא ידועים" בהגדרות האנדרואיד בפעם הראשונה).

## גרסת iOS

דורשת Mac עם Xcode (לא ניתן לבנות iOS על Windows/Linux). כשתהיה מוכנה לכך:
```bash
flutter build ios --release
```
ואז דרך Xcode להעלות ל-TestFlight/App Store. אותו קוד Dart בדיוק עובד גם שם -
אין צורך בשינוי לוגיקה, רק בהגדרת חשבון מפתחים של אפל.

## מבנה הקבצים

```
mobile_app/
  pubspec.yaml
  lib/
    main.dart                          # נקודת כניסה + בדיקת הגדרות ראשונית
    models/customer.dart               # מודל לקוח קליל (תואם ל-apiCustomerList)
    services/api_service.dart          # כל התקשורת עם code.js (JSON API)
    screens/settings_screen.dart       # הגדרת כתובת שרת + מפתח API
    screens/customer_list_screen.dart  # רשימה + חיפוש
    screens/customer_detail_screen.dart# פרטי לקוח + כפתורי "המשך"
    screens/webview_screen.dart        # עטיפת WebView לדפי ה-HTML הקיימים
```

## הערה חשובה - לא נבדק בפועל

בסביבת העבודה שבה נכתב קוד זה אין Flutter/Dart SDK מותקן - כל הקבצים נכתבו
בעיון לפי תחביר Dart/Flutter תקני ונבדקו ידנית (כולל בדיקת איזון סוגריים
אוטומטית), אבל **לא הורצו/קומפלו בפועל**. מומלץ להריץ `flutter pub get` ואז
`flutter analyze` כצעד ראשון אחרי ההורדה, לפני `flutter run` - כדי לתפוס כל
בעיה שנשארה, בדיוק כמו שהייתי בודק סינטקס JS עם node לאורך כל הפרויקט הזה.
