/* בראשית סולאר: מודל ייצור סולארי משותף (שלב 1 להערכת ייצור עבר, שלב 2 לצריכה עצמית).
 * ייצור שנתי נתון מפוזר לחודשים לפי מקדמי עונתיות (הגדרות) ולשעות היום לפי עקומת sin בין זריחה לשקיעה (חישוב NOAA).
 * נטען אחרי settings.js. */
(function () {
  'use strict';
    function hc_g2j(Y,M,D){
        const a=Math.floor((14-M)/12), y=Y+4800-a, m=M+12*a-3;
        return D + Math.floor((153*m+2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
    }
    function hc_israelDst(y,m,d){
        const dt=new Date(y,m-1,d);
        const apr2=new Date(y,3,2);
        const fBack=((apr2.getDay()-5)%7+7)%7||7;
        const dstStart=new Date(y,3,2-fBack);
        const oct1=new Date(y,9,1);
        const sBack=((oct1.getDay()-0)%7+7)%7||7;
        const dstEnd=new Date(y,9,1-sBack);
        return dt>=dstStart && dt<dstEnd;
    }
    function hc_noaa(jd){
        const T=(jd-2451545.0)/36525.0, r=Math.PI/180;
        const L0=((280.46646+36000.76983*T+0.0003032*T*T)%360+360)%360;
        const M=((357.52911+35999.05029*T-0.0001537*T*T)%360+360)%360;
        const Mr=M*r;
        const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);
        const omega=125.04-1934.136*T;
        const appLon=L0+C-0.00569-0.00478*Math.sin(omega*r);
        let ob=23.0+(26.0+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60.0)/60.0;
        ob += 0.00256*Math.cos(omega*r);
        const decl=Math.asin(Math.sin(ob*r)*Math.sin(appLon*r))/r;
        const y2=Math.tan(ob*r/2)**2, e=0.016708634-0.000042037*T, L0r=L0*r;
        const eot=4.0/r*(y2*Math.sin(2*L0r)-2*e*Math.sin(Mr)+4*e*y2*Math.sin(Mr)*Math.cos(2*L0r)-0.5*y2*y2*Math.sin(4*L0r)-1.25*e*e*Math.sin(2*Mr));
        return {decl,eot};
    }
    function hc_sunEvent(jd0,lat,lon,zenith,rising){
        const r=Math.PI/180;
        let utcMin=720.0;
        for(let i=0;i<5;i++){
            const {decl,eot}=hc_noaa(jd0+utcMin/1440.0);
            const cosH=(Math.cos(zenith*r)-Math.sin(lat*r)*Math.sin(decl*r))/(Math.cos(lat*r)*Math.cos(decl*r));
            if(cosH<-1||cosH>1) return null;
            const H=Math.acos(Math.max(-1,Math.min(1,cosH)))/r;
            const noon=720.0-4.0*lon-eot;
            utcMin=noon+(rising?-4.0*H:4.0*H);
        }
        return ((utcMin/60.0)%24+24)%24;
    }

  function sunriseSunsetLocalHours(dateObj) {
    var Y = dateObj.getFullYear(), M = dateObj.getMonth() + 1, D = dateObj.getDate();
    var jd0 = hc_g2j(Y, M, D) - 0.5, tz = 2 + (hc_israelDst(Y, M, D) ? 1 : 0);
    var lat = BS_SETTINGS.get('location.lat'), lon = BS_SETTINGS.get('location.lon');
    var sr = hc_sunEvent(jd0, lat, lon, 90.833, true), ss = hc_sunEvent(jd0, lat, lon, 90.833, false);
    if (sr === null || ss === null) return null;
    return { sr: ((sr + tz) % 24 + 24) % 24, ss: ((ss + tz) % 24 + 24) % 24 };
  }

  /** מערך nDays*24 של קוט"ש לשעה, מתחיל בחצות של gridStart. annualKwh = ייצור שנתי כולל (תפוקה × כיוון × הצללה × הספק). */
  function hourlyProductionGrid(gridStart, nDays, annualKwh) {
    var factors = [];
    for (var m = 1; m <= 12; m++) factors.push(BS_SETTINGS.get('prodEst.month' + String(m).padStart(2, '0')));
    var nominalDays = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var norm = factors.reduce(function (s, f, i) { return s + f * nominalDays[i]; }, 0);   // שנה שלמה מסתכמת בדיוק לתפוקה השנתית
    var k = BS_SETTINGS.get('prodEst.shapeExponent');
    var y = gridStart.getFullYear(), mo = gridStart.getMonth(), d0 = gridStart.getDate();
    var out = new Array(nDays * 24).fill(0);
    for (var d = 0; d < nDays; d++) {
      var day = new Date(y, mo, d0 + d), sun = sunriseSunsetLocalHours(day);
      if (!sun || sun.ss <= sun.sr) continue;
      var len = sun.ss - sun.sr, daily = annualKwh * factors[day.getMonth()] / norm;
      var w = new Array(24).fill(0), tot = 0;
      for (var h = 0; h < 24; h++) {
        var a = Math.max(h, sun.sr), b = Math.min(h + 1, sun.ss);
        if (b <= a) continue;
        var steps = 6, acc = 0;
        for (var s = 0; s < steps; s++) { var tt = a + (b - a) * (s + 0.5) / steps; acc += Math.pow(Math.sin(Math.PI * (tt - sun.sr) / len), k) * (b - a) / steps; }
        w[h] = acc; tot += acc;
      }
      if (tot > 0) for (var hh = 0; hh < 24; hh++) out[d * 24 + hh] = daily * w[hh] / tot;
    }
    return out;
  }

  window.BS_SOLAR = { sunriseSunsetLocalHours: sunriseSunsetLocalHours, hourlyProductionGrid: hourlyProductionGrid };
})();
