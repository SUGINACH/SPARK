/*
 * fake-sheets.js - גיליון Google Sheets מדומה בזיכרון (ערכים + מיזוגים; עיצוב נבלע בשקט).
 * משמש (1) את מצב הדמו בדפדפן ואת ייצוא ה-Excel בצד לקוח, (2) את שרת הבדיקה ב-Node.
 * UMD: בדפדפן חושף window.BSFake; ב-Node module.exports.
 */
(function (root) {
  'use strict';
  var sheetIdSeq = 1000;
  function FakeSheet(name, ss) {
    this.name = name; this.ss = ss;
    this.cells = new Map(); this.merges = [];
    this.lastRow = 0; this.lastCol = 0; this.maxRows = 1000; this.maxCols = 26;
    this.id = ++sheetIdSeq; this.rules = [];
    var self = this;
    this.proxy = new Proxy(this, { get: function (t, k) {      // שיטות לא מוכרות (setColumnWidth וכו') נבלעות בשקט
      if (k in t) return t[k];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return function () { return self.proxy; };
    } });
  }
  FakeSheet.prototype._set = function (r, c, v) {
    this.cells.set(r + ',' + c, v);
    if (r > this.lastRow) this.lastRow = r; if (c > this.lastCol) this.lastCol = c;
    if (r > this.maxRows) this.maxRows = r; if (c > this.maxCols) this.maxCols = c;
  };
  FakeSheet.prototype._get = function (r, c) { var v = this.cells.get(r + ',' + c); return v === undefined ? '' : v; };
  FakeSheet.prototype.getName = function () { return this.name; };
  FakeSheet.prototype.setName = function (n) { this.name = n; return this.proxy; };
  FakeSheet.prototype.getSheetId = function () { return this.id; };
  FakeSheet.prototype.getParent = function () { return this.ss; };
  FakeSheet.prototype.getLastRow = function () { return this.lastRow; };
  FakeSheet.prototype.getLastColumn = function () { return this.lastCol; };
  FakeSheet.prototype.getMaxRows = function () { return this.maxRows; };
  FakeSheet.prototype.getMaxColumns = function () { return this.maxCols; };
  FakeSheet.prototype.insertRowsAfter = function (pos, n) { this.maxRows += n; };
  FakeSheet.prototype.insertColumnsAfter = function (pos, n) { this.maxCols += n; };
  FakeSheet.prototype.setFrozenRows = function () {};
  FakeSheet.prototype.setFrozenColumns = function () {};
  FakeSheet.prototype.autoResizeColumn = function () {};
  FakeSheet.prototype.getConditionalFormatRules = function () { return this.rules; };
  FakeSheet.prototype.setConditionalFormatRules = function (r) { this.rules = r; };
  FakeSheet.prototype.appendRow = function (arr) { var r = this.lastRow + 1; for (var i = 0; i < arr.length; i++) this._set(r, i + 1, arr[i]); return this.proxy; };
  FakeSheet.prototype.getRange = function (r, c, nr, nc) { return makeRange(this, r, c, nr || 1, nc || 1); };
  FakeSheet.prototype.getDataRange = function () { return makeRange(this, 1, 1, Math.max(this.lastRow, 1), Math.max(this.lastCol, 1)); };
  FakeSheet.prototype.toArray = function () {
    var out = [];
    for (var r = 1; r <= this.lastRow; r++) { var row = []; for (var c = 1; c <= this.lastCol; c++) row.push(this._get(r, c)); out.push(row); }
    return out;
  };
  FakeSheet.prototype.fromArray = function (aoa) {
    var self = this;
    aoa.forEach(function (row, i) { row.forEach(function (v, j) { if (v !== '') self._set(i + 1, j + 1, v); }); });
  };
  function FakeRange(sheet, r, c, nr, nc) { this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  FakeRange.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) { var row = []; for (var j = 0; j < this.nc; j++) row.push(this.sheet._get(this.r + i, this.c + j)); out.push(row); }
    return out;
  };
  FakeRange.prototype.getDisplayValues = function () {
    return this.getValues().map(function (row) { return row.map(function (v) { return v === '' || v == null ? '' : String(v); }); });
  };
  FakeRange.prototype.getValue = function () { return this.sheet._get(this.r, this.c); };
  FakeRange.prototype.setValues = function (vals) {
    for (var i = 0; i < vals.length; i++) for (var j = 0; j < vals[i].length; j++) this.sheet._set(this.r + i, this.c + j, vals[i][j]);
    return this;
  };
  FakeRange.prototype.setValue = function (v) { this.sheet._set(this.r, this.c, v); return this; };
  FakeRange.prototype.mergeVertically = function () {       // ממזג כל עמודה בנפרד, כמו Apps Script
    for (var j = 0; j < this.nc; j++) this.sheet.merges.push({ r: this.r, c: this.c + j, nr: this.nr, nc: 1 });
    return this;
  };
  FakeRange.prototype.merge = function () { this.sheet.merges.push({ r: this.r, c: this.c, nr: this.nr, nc: this.nc }); return this; };
  function makeRange(sheet, r, c, nr, nc) {
    var range = new FakeRange(sheet, r, c, nr, nc), proxy = null;
    proxy = new Proxy(range, { get: function (t, k) {           // עיצוב (צבעים, גבולות, פילטר...) נבלע ומחזיר את אותו טווח
      if (k in t) return t[k];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return function () { return proxy; };
    } });
    return proxy;
  }
  function FakeSpreadsheet(name) { this.name = name; this.sheets = [new FakeSheet('Sheet1', this)]; this.id = 'fake-ss-' + Math.random().toString(36).slice(2); }
  FakeSpreadsheet.prototype.getSheets = function () { return this.sheets.map(function (s) { return s.proxy; }); };
  FakeSpreadsheet.prototype.getId = function () { return this.id; };
  FakeSpreadsheet.prototype.getSheetByName = function (n) { var f = this.sheets.find(function (s) { return s.name === n; }); return f ? f.proxy : null; };
  FakeSpreadsheet.prototype.insertSheet = function (n) { var s = new FakeSheet(n, this); this.sheets.push(s); return s.proxy; };
  FakeSpreadsheet.prototype.deleteSheet = function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s && x.proxy !== s; }); };
  FakeSpreadsheet.prototype.toJSON = function () { var o = {}; this.sheets.forEach(function (s) { o[s.name] = s.toArray(); }); return o; };
  FakeSpreadsheet.fromJSON = function (obj) {
    var ss = new FakeSpreadsheet('active'); ss.sheets = [];
    Object.keys(obj).forEach(function (n) { ss.insertSheet(n).fromArray(obj[n]); });
    return ss;
  };
  function bytesToBase64(bytes) {
    var chunks = [], CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) chunks.push(String.fromCharCode.apply(null, bytes.subarray ? bytes.subarray(i, i + CH) : bytes.slice(i, i + CH)));
    var bin = chunks.join('');
    return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  }
  function toXlsxBytes(ss, XLSX) {
    if (!XLSX) throw new Error('ספריית SheetJS (XLSX) לא נטענה. נדרש חיבור אינטרנט ל-CDN.');
    var wb = XLSX.utils.book_new();
    ss.sheets.forEach(function (sh) {
      var aoa = [];
      for (var r = 1; r <= sh.lastRow; r++) {
        var row = new Array(sh.lastCol);
        for (var c = 1; c <= sh.lastCol; c++) { var v = sh.cells.get(r + ',' + c); row[c - 1] = (v === undefined || v === '') ? null : v; }
        aoa.push(row);
      }
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = sh.merges.map(function (m) { return { s: { r: m.r - 1, c: m.c - 1 }, e: { r: m.r - 1 + m.nr - 1, c: m.c - 1 + m.nc - 1 } }; });
      XLSX.utils.book_append_sheet(wb, ws, String(sh.name).replace(/[\\\/?*\[\]:]/g, '_').slice(0, 31) || 'Sheet');
    });
    return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  }
  var api = { FakeSpreadsheet: FakeSpreadsheet, toXlsxBytes: toXlsxBytes, bytesToBase64: bytesToBase64 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BSFake = api;
})(typeof window !== 'undefined' ? window : this);
