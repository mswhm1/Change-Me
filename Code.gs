// =====================================================
//  Change Me Clinics — Code.gs
//  نظام عيادات زراعة الشعر والتجميل | نقطة الدخول الرئيسية
// =====================================================

function doGet() {
  initSheets();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Change Me Clinics — نظام العيادة')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===== دالة الدمج للملفات الجزئية =====
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== تهيئة أوراق العمل =====
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetsConfig = {
    'Users_HR': [
      'EmpID','Name','UserName','Password','Role',
      'Department','Phone','Status','JoinDate','Notes','NationalID','Salary'
    ],
    'Patients': [
      'PatientID','Name','Phone','Gender','Age',
      'Address','Status','CreatedAt','Notes'
    ],
    'PatientsLog': [
      'FollowUpID','PatientID','DoctorID','DoctorName',
      'ProcedureName','Date','Notes','Status'
    ],
    'Marketing': [
      'CampaignID','AdSource','Createdby','MarketID',
      'Start','End','expectedBudget','ActualBudget','Status','Notes'
    ],
    'Leads': [
      'LeadID','PatientID','Createdtime','AdSource','CampaignID',
      'Phone','Name','SalesAgent','Action','FollowUpDate','Status','Notes','Timestamp'
    ],
    'visit': [
      'VisitID','PatientID','PatientName','TransformedFrom','EmpID',
      'DoctorID','DoctorName','ProcedureName','BookingDate',
      'TotalAmount','PaidAmount','RemainingAmount','PaymentMethod',
      'AccID','AccName','Status','Notes'
    ],
    'MedicalRecords': [
      'RecordID','PatientID','DoctorID','DoctorName','RecordDate',
      'ChiefComplaint','CurrentHistory','PastHistory','Allergies',
      'CurrentMeds','Diagnosis','TreatmentPlan','RecommendedProcedures','DoctorNotes'
    ],
    'Operations': [
      'OperationID','VisitID','PatientID','PatientName','OperationDate',
      'RoomNum','StartPhoto','PunchStart','PunchEnd','PunchType','PunchSize',
      'PunchPhoto','GraftsCount','HLPhoto','SlitStart','SlitEnd','SlitType',
      'SlitSize','SlitPhoto','ImpStart','ImpEnd','ImpType','EndPhoto','Status','Notes'
    ],
    'OPTimeline': [
      'OperationID','EmpID','Stage','Start','End','Count','Status'
    ],
    'Inventory': [
      'ItemID','ItemName','Category','Unit','CurrentQty',
      'MinQty','UnitCost','Supplier','LastUpdated','Notes'
    ],
    'InventoryLog': [
      'LogID','ItemID','ItemName','TransactionType','Quantity',
      'ReferenceID','HandledBy','Date','Notes'
    ],
    'Notifications': [
      'NotifID','ToRole','ToUser','FromUser','Message',
      'RefType','RefID','IsRead','CreatedAt'
    ]
  };

  var keys = Object.keys(sheetsConfig);
  for (var i = 0; i < keys.length; i++) {
    var name    = keys[i];
    var headers = sheetsConfig[name];
    var sheet   = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      // تنسيق الرأس
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1A2332');
      headerRange.setFontColor('#10B981');
      
      // إذا كانت ورقة المستخدمين، ننشئ مستخدم أدمن افتراضي للتمكن من تسجيل الدخول أول مرة
      if (name === 'Users_HR') {
        var defaultAdmin = ['ADM001', 'مدير النظام الافتراضي', 'admin', '12345', 'ADM_SUP', 'الإدارة', '0100000000', 'active', '2026-07-01', 'مسؤول النظام الافتراضي', '', ''];
        sheet.appendRow(defaultAdmin);
      }
    } else {
      // إذا كانت الورقة موجودة ولكن فارغة تماماً (بدون بيانات تحت الرأس)
      if (name === 'Users_HR' && sheet.getLastRow() < 2) {
        var defaultAdmin = ['ADM001', 'مدير النظام الافتراضي', 'admin', '12345', 'ADM_SUP', 'الإدارة', '0100000000', 'active', '2026-07-01', 'مسؤول النظام الافتراضي', '', ''];
        sheet.appendRow(defaultAdmin);
      }
    }
  }
}

function debugDatabase() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return "Spreadsheet is null (script is standalone)";
    var sheet = ss.getSheetByName("Users_HR");
    if (!sheet) return "Sheet Users_HR does not exist in spreadsheet: " + ss.getName();
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    var headers = [];
    if (lastRow > 0 && lastColumn > 0) {
      headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    }
    return {
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      sheetName: sheet.getName(),
      lastRow: lastRow,
      lastColumn: lastColumn,
      headers: headers.map(String)
    };
  } catch(e) {
    return "Error: " + e.message + "\nStack: " + e.stack;
  }
}
