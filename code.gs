const SHEET_NAME = 'DATA';
const INSPECTION_SHEET_NAME = 'INSPECTION';
const SPREADSHEET_ID = '1IkAumjEeLSaXCsdbIVZYtpC0VHIgheBVwWWhhl7xoVg';

// ── Helper: Build row map untuk O(1) lookup ──────────────────────
function _buildRowMap(data) {
  const map = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      map[String(data[i][0])] = i + 1;  // 1-indexed row number
    }
  }
  return map;
}

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatTanggal(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

function parseTanggal(str) {
  if (!str) return null;
  str = String(str).trim();

  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));

  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function readTanggal(cellValue) {
  if (!cellValue) return '';
  if (cellValue instanceof Date) return formatTanggal(cellValue);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(cellValue))) return String(cellValue);
  const d = new Date(cellValue);
  return isNaN(d.getTime()) ? String(cellValue) : formatTanggal(d);
}

function doGet(e) {
  if (!e || !e.parameter) {
    return makeResponse({ success: false, error: 'No parameters' });
  }

  const action = e.parameter.action;

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // ── READ: Semua APAR ──────────────────────────────────────────────
    if (action === 'getAllApar') {
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) return makeResponse({ success: true, data: [] });

      const data = sheet.getDataRange().getValues();
      const aparList = [];
      
      // Cek apakah kolom operationalStatus ada (kolom ke-8)
      const hasOpStatus = data[0] && data[0].length > 7;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) {
          aparList.push({
            id:        String(data[i][0] || ''),
            lokasi:    String(data[i][1] || ''),
            jenis:     String(data[i][2] || ''),
            kelas:     String(data[i][3] || ''),
            kapasitas: String(data[i][4] || ''),
            expRefill: readTanggal(data[i][5]),
            status:    String(data[i][6] || 'Good'),
            operationalStatus: hasOpStatus ? String(data[i][7] || 'ACTIVE') : 'ACTIVE'
          });
        }
      }
      return makeResponse({ success: true, data: aparList });
    }

    // ── READ: Data inspeksi ───────────────────────────────────────────
    if (action === 'getInspectionData') {
      const inspSheet = ss.getSheetByName(INSPECTION_SHEET_NAME);
      if (!inspSheet) return makeResponse({ success: true, data: { thisMonth: [], details: {} } });

      const data = inspSheet.getDataRange().getValues();
      const thisMonth = [];
      const details = {};
      const today = new Date();
      const cm = today.getMonth();
      const cy = today.getFullYear();

      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        const aparId = String(data[i][0]);

        if (data[i][5]) {
          const d = (data[i][5] instanceof Date) ? data[i][5] : new Date(data[i][5]);
          if (!isNaN(d.getTime()) && d.getMonth() === cm && d.getFullYear() === cy) {
            if (thisMonth.indexOf(aparId) === -1) thisMonth.push(aparId);
          }
        }

        try { details[aparId] = JSON.parse(data[i][4] || '{}'); }
        catch(err) { details[aparId] = {}; }
      }
      return makeResponse({ success: true, data: { thisMonth: thisMonth, details: details } });
    }

    // ── WRITE: Simpan satu APAR ───────────────────────────────────────
    if (action === 'saveApar') {
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID','Lokasi','Jenis','Kelas','Kapasitas','ExpRefill','Status','OperationalStatus','LastUpdated']);
        sheet.setFrozenRows(1);
      }

      const apar = JSON.parse(decodeURIComponent(e.parameter.data));

      // Validasi kelas: hanya BC dan ABC
      const validKelas = ['BC', 'ABC'];
      if (!validKelas.includes(apar.kelas)) {
        return makeResponse({ success: false, error: 'Kelas tidak valid. Hanya BC dan ABC yang diperbolehkan.' });
      }

      // Validasi jenis: tanpa Wet Chemical
      const validJenis = ['CO2', 'Dry Powder', 'Foam'];
      if (!validJenis.includes(apar.jenis)) {
        return makeResponse({ success: false, error: 'Jenis tidak valid. Hanya CO2, Dry Powder, dan Foam yang tersedia.' });
      }

      const expDate = parseTanggal(apar.expRefill);
      const expValue = expDate ? expDate : (apar.expRefill || '');

      const sd = sheet.getDataRange().getValues();
      const rowMap = _buildRowMap(sd);  // O(1) lookup helper
      const rowIndex = rowMap[apar.id] || -1;
      let hasOpStatus = false;
      
      // Cek apakah header memiliki kolom OperationalStatus
      if (sd[0] && sd[0].length > 7) {
        hasOpStatus = true;
      }

      const opStatus = apar.operationalStatus || 'ACTIVE';
      
      const row = [
        apar.id, apar.lokasi, apar.jenis, apar.kelas,
        apar.kapasitas,
        expValue,
        apar.status,
        opStatus,
        new Date()
      ];

      if (rowIndex > 0) {
        // Update existing row
        if (hasOpStatus) {
          sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
        } else {
          // Kolom OperationalStatus belum ada, perlu menambah atau menyesuaikan
          const existingRow = sheet.getRange(rowIndex, 1, 1, sd[0].length).getValues()[0];
          const newRow = [];
          for (let j = 0; j < Math.max(sd[0].length, 9); j++) {
            if (j === 7) newRow.push(opStatus);
            else if (j === 8) newRow.push(new Date());
            else if (j < row.length && j !== 7 && j !== 8) newRow.push(row[j]);
            else if (j < existingRow.length) newRow.push(existingRow[j]);
            else newRow.push('');
          }
          sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
        }
      } else {
        sheet.appendRow(row);
      }

      const lastRow = rowIndex > 0 ? rowIndex : sheet.getLastRow();
      sheet.getRange(lastRow, 6).setNumberFormat('dd/mm/yyyy');
      sheet.getRange(lastRow, 9).setNumberFormat('dd/mm/yyyy');
      
      // Update header jika perlu
      const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (header.length < 8 || header[7] !== 'OperationalStatus') {
        if (header.length === 8) {
          sheet.getRange(1, 9).setValue('LastUpdated');
        } else if (header.length === 7) {
          sheet.getRange(1, 8).setValue('OperationalStatus');
          sheet.getRange(1, 9).setValue('LastUpdated');
        }
      }

      return makeResponse({ success: true, message: 'Data saved' });
    }

    // ── WRITE: Batch update status APAR ───────────────────────────────
    if (action === 'batchUpdateStatus') {
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        return makeResponse({ success: false, error: 'Sheet DATA tidak ditemukan' });
      }
      
      const updatedApars = JSON.parse(decodeURIComponent(e.parameter.data));
      if (!updatedApars || !updatedApars.length) {
        return makeResponse({ success: true, message: 'Tidak ada data yang diupdate' });
      }
      
      const data = sheet.getDataRange().getValues();
      
      const rowMap = {};
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) {
          rowMap[String(data[i][0])] = i + 1;
        }
      }
      
      let updatedCount = 0;
      const now = new Date();
      
      for (const apar of updatedApars) {
        const rowIndex = rowMap[apar.id];
        if (rowIndex) {
          sheet.getRange(rowIndex, 7).setValue(apar.status);
          sheet.getRange(rowIndex, 9).setValue(now);
          sheet.getRange(rowIndex, 9).setNumberFormat('dd/mm/yyyy');
          updatedCount++;
        }
      }
      
      return makeResponse({ success: true, message: `${updatedCount} APAR status updated` });
    }

    // ── WRITE: Batch update operational status ────────────────────────
    if (action === 'batchUpdateOperationalStatus') {
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        return makeResponse({ success: false, error: 'Sheet DATA tidak ditemukan' });
      }
      
      const updates = JSON.parse(decodeURIComponent(e.parameter.data));
      if (!updates || !updates.length) {
        return makeResponse({ success: true, message: 'Tidak ada data yang diupdate' });
      }
      
      const data = sheet.getDataRange().getValues();
      const rowMap = {};
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) {
          rowMap[String(data[i][0])] = i + 1;
        }
      }
      
      let updatedCount = 0;
      const now = new Date();
      
      for (const update of updates) {
        const rowIndex = rowMap[update.id];
        if (rowIndex) {
          sheet.getRange(rowIndex, 8).setValue(update.operationalStatus);
          sheet.getRange(rowIndex, 9).setValue(now);
          sheet.getRange(rowIndex, 9).setNumberFormat('dd/mm/yyyy');
          updatedCount++;
        }
      }
      
      return makeResponse({ success: true, message: `${updatedCount} APAR operational status updated` });
    }

    // ── WRITE: Hapus APAR ─────────────────────────────────────────────
    if (action === 'deleteApar') {
      const aparId = e.parameter.id;
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (sheet) {
        const sd = sheet.getDataRange().getValues();
        const rowMap = _buildRowMap(sd);  // O(1) lookup
        const rowIndex = rowMap[aparId];
        if (rowIndex) {
          sheet.deleteRow(rowIndex);
          return makeResponse({ success: true, message: 'Deleted' });
        }
      }
      return makeResponse({ success: false, error: 'Not found' });
    }

    // ── WRITE: Simpan hasil inspeksi ──────────────────────────────────
    if (action === 'saveInspection') {
      let inspSheet = ss.getSheetByName(INSPECTION_SHEET_NAME);
      if (!inspSheet) {
        inspSheet = ss.insertSheet(INSPECTION_SHEET_NAME);
        inspSheet.appendRow(['APAR_ID','Standar_Count','Tidak_Standar_Count','Catatan','Detail_JSON','Timestamp']);
        inspSheet.setFrozenRows(1);
      }

      const p = JSON.parse(decodeURIComponent(e.parameter.data));
      inspSheet.appendRow([
        p.aparId,
        p.standarCount,
        p.tidakStandarCount,
        p.note || '',
        JSON.stringify(p.checklist || {}),
        new Date()
      ]);

      inspSheet.getRange(inspSheet.getLastRow(), 6).setNumberFormat('dd/mm/yyyy');

      return makeResponse({ success: true, message: 'Inspection saved' });
    }

    // ── WRITE: Sync semua APAR ────────────────────────────────────────
    if (action === 'syncAll') {
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID','Lokasi','Jenis','Kelas','Kapasitas','ExpRefill','Status','OperationalStatus','LastUpdated']);
        sheet.setFrozenRows(1);
      }

      if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);

      const arr = JSON.parse(decodeURIComponent(e.parameter.data)) || [];
      
      const validJenis = ['CO2', 'Dry Powder', 'Foam'];
      const validKelas = ['BC', 'ABC'];
      const validArr = arr.filter(a => validJenis.includes(a.jenis) && validKelas.includes(a.kelas));
      
      if (validArr.length > 0) {
        const now = new Date();
        const rows = validArr.map(function(a) {
          const expDate = parseTanggal(a.expRefill);
          return [
            a.id, 
            a.lokasi, 
            a.jenis, 
            a.kelas, 
            a.kapasitas,
            expDate || a.expRefill, 
            a.status,
            a.operationalStatus || 'ACTIVE',
            now
          ];
        });
        
        const range = sheet.getRange(2, 1, rows.length, rows[0].length);
        range.setValues(rows);

        sheet.getRange(2, 6, rows.length, 1).setNumberFormat('dd/mm/yyyy');
        sheet.getRange(2, 9, rows.length, 1).setNumberFormat('dd/mm/yyyy');
      }

      return makeResponse({ success: true, message: 'Sync complete', count: validArr.length });
    }

    return makeResponse({ success: false, error: 'Invalid action: ' + action });

  } catch(err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return makeResponse({ success: false, error: 'No post data' });
  }
  try {
    const postData = JSON.parse(e.postData.contents);
    const fakeE = {
      parameter: {
        action: postData.action,
        data: encodeURIComponent(JSON.stringify(postData.apar || postData.aparData || postData)),
        id: postData.id || ''
      }
    };
    return doGet(fakeE);
  } catch(err) {
    return makeResponse({ success: false, error: err.toString() });
  }
}