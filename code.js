// ==================== GOOGLE APPS SCRIPT BACKEND ====================
// Deploy sebagai Web App: Execute as "Me", Access "Anyone"
// Spreadsheet ID: 1IkAumjEeLSaXCsdbIVZYtpC0VHIgheBVwWWhhl7xoVg

const SHEET_NAME = 'DATA';
const INSPECTION_SHEET_NAME = 'INSPECTION';
const SPREADSHEET_ID = '1IkAumjEeLSaXCsdbIVZYtpC0VHIgheBVwWWhhl7xoVg';

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Format tanggal ke dd/mm/yyyy (string) untuk disimpan ke sel sheet.
 * Google Sheets dengan locale Indonesia akan mengenali format ini sebagai Date.
 */
function formatTanggal(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

/**
 * Parse string tanggal (dd/mm/yyyy ATAU yyyy-mm-dd) ke Date object.
 * Frontend mengirim yyyy-mm-dd dari <input type="date">.
 */
function parseTanggal(str) {
  if (!str) return null;
  str = String(str).trim();

  // Format dd/mm/yyyy
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));

  // Format yyyy-mm-dd
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));

  // Fallback: Date constructor
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Baca nilai sel tanggal dari sheet dan kembalikan sebagai string dd/mm/yyyy.
 * Sheets menyimpan tanggal sebagai Date object — perlu diformat.
 */
function readTanggal(cellValue) {
  if (!cellValue) return '';
  if (cellValue instanceof Date) return formatTanggal(cellValue);
  // Jika sudah string dd/mm/yyyy, kembalikan langsung
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(cellValue))) return String(cellValue);
  // Coba parse ISO / format lain
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
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) {
          aparList.push({
            id:        String(data[i][0] || ''),
            lokasi:    String(data[i][1] || ''),
            jenis:     String(data[i][2] || ''),
            kelas:     String(data[i][3] || ''),
            kapasitas: String(data[i][4] || ''),
            expRefill: readTanggal(data[i][5]),   // → dd/mm/yyyy
            status:    String(data[i][6] || 'Good')
            // kolom 7 = LastUpdated, tidak perlu dikirim ke frontend
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

        // Kolom 5 = Timestamp (Date object dari sheet)
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
        sheet.appendRow(['ID','Lokasi','Jenis','Kelas','Kapasitas','ExpRefill','Status','LastUpdated']);
        sheet.setFrozenRows(1);
      }

      const apar = JSON.parse(decodeURIComponent(e.parameter.data));

      // Konversi expRefill: frontend kirim yyyy-mm-dd atau dd/mm/yyyy → simpan sebagai Date object
      const expDate = parseTanggal(apar.expRefill);
      const expValue = expDate ? expDate : (apar.expRefill || '');

      const sd = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < sd.length; i++) {
        if (String(sd[i][0]) === apar.id) { rowIndex = i + 1; break; }
      }

      const row = [
        apar.id, apar.lokasi, apar.jenis, apar.kelas,
        apar.kapasitas,
        expValue,          // Date object → Sheets format sesuai locale
        apar.status,
        new Date()         // LastUpdated sebagai Date object
      ];

      if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      else sheet.appendRow(row);

      // Format kolom ExpRefill (col 6) dan LastUpdated (col 8) sebagai tanggal dd/mm/yyyy
      const lastRow = rowIndex > 0 ? rowIndex : sheet.getLastRow();
      sheet.getRange(lastRow, 6).setNumberFormat('dd/mm/yyyy');
      sheet.getRange(lastRow, 8).setNumberFormat('dd/mm/yyyy');

      return makeResponse({ success: true, message: 'Data saved' });
    }

    // ── WRITE: Hapus APAR ─────────────────────────────────────────────
    if (action === 'deleteApar') {
      const aparId = e.parameter.id;
      const sheet  = ss.getSheetByName(SHEET_NAME);
      if (sheet) {
        const sd = sheet.getDataRange().getValues();
        for (let i = 1; i < sd.length; i++) {
          if (String(sd[i][0]) === aparId) {
            sheet.deleteRow(i + 1);
            return makeResponse({ success: true, message: 'Deleted' });
          }
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
        new Date()    // Timestamp sebagai Date object
      ]);

      // Format kolom Timestamp (col 6) sebagai dd/mm/yyyy
      inspSheet.getRange(inspSheet.getLastRow(), 6).setNumberFormat('dd/mm/yyyy');

      return makeResponse({ success: true, message: 'Inspection saved' });
    }

    // ── WRITE: Sync semua APAR ────────────────────────────────────────
    if (action === 'syncAll') {
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID','Lokasi','Jenis','Kelas','Kapasitas','ExpRefill','Status','LastUpdated']);
        sheet.setFrozenRows(1);
      }

      if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);

      const arr = JSON.parse(decodeURIComponent(e.parameter.data)) || [];
      if (arr.length > 0) {
        const now = new Date();
        const rows = arr.map(function(a) {
          const expDate = parseTanggal(a.expRefill);
          return [a.id, a.lokasi, a.jenis, a.kelas, a.kapasitas,
                  expDate || a.expRefill, a.status, now];
        });
        const range = sheet.getRange(2, 1, rows.length, rows[0].length);
        range.setValues(rows);

        // Format kolom ExpRefill (col 6) dan LastUpdated (col 8) untuk semua baris
        sheet.getRange(2, 6, rows.length, 1).setNumberFormat('dd/mm/yyyy');
        sheet.getRange(2, 8, rows.length, 1).setNumberFormat('dd/mm/yyyy');
      }

      return makeResponse({ success: true, message: 'Sync complete' });
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
