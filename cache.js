// Data APAR (kosong saat inisialisasi, akan diisi dari Google Sheets)
let aparData = [];
let inspectionThisMonth = [];
let inspectionDetails = {};
let isDataLoaded = false;

function getChecklist(jenis) {
  return inspectionChecklists[jenis] || defaultChecklist;
}

function generateId() {
  const maxNum = aparData.reduce((max, a) => {
    const match = a.id.match(/APAR-(\d+)/);
    const num = match ? parseInt(match[1]) : 0;
    return num > max ? num : max;
  }, 0);
  return `APAR-${String(maxNum + 1).padStart(3, '0')}`;
}

// ==================== GOOGLE SHEETS INTEGRATION ====================
// Semua request menggunakan GET untuk menghindari CORS preflight.
// Operasi tulis dikirim via query parameter ?action=...&data=...

/**
 * Helper: fetch dengan follow redirect (solusi utama CORS Apps Script)
 * Google Apps Script redirect GET ke URL final — fetch default handle ini dengan baik.
 */
async function sheetsGET(params) {
  const url = new URL(GOOGLE_SHEETS_CONFIG.appsScriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchFromGoogleSheets() {
  try {
    const result = await sheetsGET({ action: 'getAllApar' });
    if (result.success && result.data) {
      aparData = result.data;
      console.log('✅ Data APAR:', aparData.length, 'item');
      return true;
    }
    console.warn('⚠️ Tidak ada data:', result.error || '');
    return false;
  } catch (error) {
    console.error('❌ Gagal fetch APAR:', error);
    showToast('⚠️ Gagal terhubung ke server.', 'warning');
    return false;
  }
}

async function fetchInspectionFromSheets() {
  try {
    const result = await sheetsGET({ action: 'getInspectionData' });
    if (result.success && result.data) {
      inspectionThisMonth = result.data.thisMonth || [];
      inspectionDetails   = result.data.details   || {};
      console.log('✅ Data inspeksi dimuat');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Gagal fetch inspeksi:', error);
    showToast('⚠️ Gagal memuat data inspeksi.', 'warning');
    return false;
  }
}

async function pushAparToSheets(apar) {
  try {
    const result = await sheetsGET({
      action: 'saveApar',
      data: encodeURIComponent(JSON.stringify(apar))
    });
    if (result.success) console.log('✅', apar.id, 'disimpan');
    return result.success;
  } catch (error) {
    console.error('❌ Gagal simpan APAR:', error);
    showToast('❌ Gagal menyimpan ke server.', 'danger');
    return false;
  }
}

async function pushInspectionToSheets(aparId, standarCount, tidakStandarCount, note) {
  try {
    const payload = {
      aparId,
      standarCount,
      tidakStandarCount,
      note: note || '',
      checklist: inspectionDetails[aparId] || {}
    };
    const result = await sheetsGET({
      action: 'saveInspection',
      data: encodeURIComponent(JSON.stringify(payload))
    });
    if (result.success) console.log('✅ Inspeksi', aparId, 'disimpan');
    return result.success;
  } catch (error) {
    console.error('❌ Gagal simpan inspeksi:', error);
    showToast('❌ Gagal menyimpan inspeksi ke server.', 'danger');
    return false;
  }
}

async function deleteAparFromSheets(aparId) {
  try {
    const result = await sheetsGET({ action: 'deleteApar', id: aparId });
    if (result.success) console.log('🗑️', aparId, 'dihapus');
    return result.success;
  } catch (error) {
    console.error('❌ Gagal hapus APAR:', error);
    showToast('❌ Gagal menghapus data dari server.', 'danger');
    return false;
  }
}

async function refreshDataFromSheets() {
  if (currentInspectingApar || editMode) {
    showToast('⚠️ Tidak dapat refresh saat sedang mengedit data.', 'warning');
    return;
  }
  showToast('🔄 Memperbarui data...', 'info');
  await fetchFromGoogleSheets();
  await fetchInspectionFromSheets();
  if (!currentInspectingApar && !editMode) renderPage(currentPage);
  showToast('✅ Data berhasil diperbarui', 'success');
}

async function resetData() {
  if (currentInspectingApar || editMode) {
    showToast('⚠️ Tidak dapat reset saat sedang mengedit data.', 'warning');
    return;
  }
  if (confirm('⚠️ PERINGATAN: Ini akan menghapus SEMUA data APAR dari Google Sheets.\n\nData tidak dapat dikembalikan. Lanjutkan?')) {
    showToast('🔄 Menghapus semua data...', 'warning');
    for (const apar of [...aparData]) {
      await deleteAparFromSheets(apar.id);
    }
    aparData = [];
    inspectionThisMonth = [];
    inspectionDetails = {};
    renderPage(currentPage);
    showToast('🗑️ Semua data berhasil dihapus', 'danger');
  }
}

async function initializeData() {
  console.log('🔄 Inisialisasi data dari Google Sheets...');
  const aparSuccess = await fetchFromGoogleSheets();
  await fetchInspectionFromSheets();
  isDataLoaded = true;

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }

  if (!aparSuccess) {
    showToast('⚠️ Gagal memuat data. Periksa koneksi internet.', 'warning');
  } else {
    console.log('✅ Inisialisasi selesai. Total APAR:', aparData.length);
  }

  currentPage = 'dashboard';
  renderPage('dashboard');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeData);
} else {
  initializeData();
}

// Auto-refresh setiap 60 detik
setInterval(async () => {
  if (isDataLoaded && !currentInspectingApar && !editMode) {
    await fetchFromGoogleSheets();
    await fetchInspectionFromSheets();
  }
}, 60000);