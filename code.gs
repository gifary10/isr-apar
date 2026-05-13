// ==================== GOOGLE APPS SCRIPT BACKEND ====================
// Deploy ini di Google Apps Script pada spreadsheet Anda
// Spreadsheet ID: 1IkAumjEeLSaXCsdbIVZYtpC0VHIgheBVwWWhhl7xoVg

const SHEET_NAME = 'DATA';
const INSPECTION_SHEET_NAME = 'INSPECTION';

function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No parameters' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById('1IkAumjEeLSaXCsdbIVZYtpC0VHIgheBVwWWhhl7xoVg');
  
  if (action === 'getAllApar') {
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const aparList = [];
    
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) {
          aparList.push({
            id: data[i][0],
            lokasi: data[i][1] || '',
            jenis: data[i][2] || '',
            kelas: data[i][3] || '',
            kapasitas: data[i][4] || '',
            expRefill: data[i][5] || '',
            status: data[i][6] || 'Good'
          });
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: aparList }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getInspectionData') {
    const inspectionSheet = ss.getSheetByName(INSPECTION_SHEET_NAME);
    const today = new Date();
    
    if (!inspectionSheet) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        data: { thisMonth: [], details: {} } 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = inspectionSheet.getDataRange().getValues();
    const thisMonth = [];
    const details = {};
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][5]) {
          const inspectionDate = new Date(data[i][5]);
          if (inspectionDate.getMonth() === currentMonth && 
              inspectionDate.getFullYear() === currentYear) {
            if (thisMonth.indexOf(data[i][0]) === -1) {
              thisMonth.push(data[i][0]);
            }
          }
          
          try {
            details[data[i][0]] = JSON.parse(data[i][4] || '{}');
          } catch(e) {
            details[data[i][0]] = {};
          }
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      data: { thisMonth: thisMonth, details: details } 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No post data' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const postData = JSON.parse(e.postData.contents);
  const action = postData.action;
  const ss = SpreadsheetApp.openById('1IkAumjEeLSaXCsdbIVZYtpC0VHIgheBVwWWhhl7xoVg');
  
  if (action === 'saveApar') {
    const apar = postData.apar;
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Lokasi', 'Jenis', 'Kelas', 'Kapasitas', 'ExpRefill', 'Status', 'LastUpdated']);
      sheet.setFrozenRows(1);
    }
    
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === apar.id) {
        rowIndex = i + 1;
        break;
      }
    }
    
    const rowData = [
      apar.id,
      apar.lokasi,
      apar.jenis,
      apar.kelas,
      apar.kapasitas,
      apar.expRefill,
      apar.status,
      new Date().toISOString()
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Data saved' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'deleteApar') {
    const aparId = postData.id;
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === aparId) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Deleted' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'saveInspection') {
    let inspectionSheet = ss.getSheetByName(INSPECTION_SHEET_NAME);
    
    if (!inspectionSheet) {
      inspectionSheet = ss.insertSheet(INSPECTION_SHEET_NAME);
      inspectionSheet.appendRow(['APAR_ID', 'Standar_Count', 'Tidak_Standar_Count', 'Catatan', 'Detail_JSON', 'Timestamp']);
      inspectionSheet.setFrozenRows(1);
    }
    
    const rowData = [
      postData.aparId,
      postData.standarCount,
      postData.tidakStandarCount,
      postData.note || '',
      JSON.stringify(postData.checklist || {}),
      new Date().toISOString()
    ];
    
    inspectionSheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Inspection saved' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'syncAll') {
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['ID', 'Lokasi', 'Jenis', 'Kelas', 'Kapasitas', 'ExpRefill', 'Status', 'LastUpdated']);
      sheet.setFrozenRows(1);
    }
    
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    const aparData = postData.aparData || [];
    if (aparData.length > 0) {
      const rows = aparData.map(function(apar) {
        return [
          apar.id,
          apar.lokasi,
          apar.jenis,
          apar.kelas,
          apar.kapasitas,
          apar.expRefill,
          apar.status,
          new Date().toISOString()
        ];
      });
      
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Sync complete' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}