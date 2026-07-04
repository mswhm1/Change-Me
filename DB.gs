// =====================================================
//  HairCare Pro — DB.gs
//  طبقة قاعدة البيانات (Google Sheets)
// =====================================================

// ===== قراءة بيانات ورقة =====
function getSheetData(sheetName) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var result  = [];
    for (var r = 1; r < data.length; r++) {
      // تخطي الصفوف الفارغة
      if (data[r].every(function(c) { return c === '' || c === null || c === undefined; })) continue;
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        var val = data[r][c];
        if (val instanceof Date) {
          // تحويل كائنات التاريخ إلى نصوص لتجنب أخطاء التحويل البرمجي أثناء الإرسال للعميل
          try {
            val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
            if (val.substring(11) === "00:00:00") {
              val = val.substring(0, 10);
            }
          } catch(e) {
            val = val.toISOString();
          }
        }
        obj[headers[c]] = (val !== undefined && val !== null) ? val : '';
      }
      result.push(obj);
    }
    return result;
  } catch (e) {
    Logger.log('getSheetData error [' + sheetName + ']: ' + e.message);
    return [];
  }
}

// ===== حفظ بيانات ورقة =====
function saveSheetData(sheetName, dataArray) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clearContents();
    if (!dataArray || dataArray.length === 0) return true;
    var headers = Object.keys(dataArray[0]);
    var values  = [headers];
    for (var i = 0; i < dataArray.length; i++) {
      var row = headers.map(function(h) {
        var v = dataArray[i][h];
        return (v !== undefined && v !== null) ? v : '';
      });
      values.push(row);
    }
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    return true;
  } catch (e) {
    Logger.log('saveSheetData error [' + sheetName + ']: ' + e.message);
    throw e;
  }
}

// ===== توليد ID جديد =====
function getNextId(sheetName, idColumn, prefix) {
  try {
    var data   = getSheetData(sheetName);
    if (data.length === 0) return prefix + '0001';
    var maxNum = 0;
    for (var i = 0; i < data.length; i++) {
      var id  = String(data[i][idColumn] || '');
      var num = parseInt(id.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    return prefix + String(maxNum + 1).padStart(4, '0');
  } catch (e) {
    Logger.log('getNextId error: ' + e.message);
    return prefix + String(Date.now()).slice(-4);
  }
}
