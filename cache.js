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

function getActiveApars() {
  return aparData.filter(a => OPERATIONAL_STATUS[a.operationalStatus]?.inspectable !== false);
}

function getReminderApars() {
  if (REMINDER_CONFIG.includeBackupInReminder) {
    return aparData;
  }
  return aparData.filter(a => OPERATIONAL_STATUS[a.operationalStatus]?.inspectable !== false);
}

function calculateAutoStatus(apar, inspectionResult = null) {
  if (apar.operationalStatus === 'RETIRED') {
    return 'Retired';
  }
  
  let status = 'Good';
  let score = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseExpRefill(apar.expRefill);
  
  if (isNaN(expDate.getTime())) {
    if (apar.operationalStatus === 'BACKUP') {
      return 'Backup';
    }
    return status;
  }
  
  expDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    status = 'Critical';
    score += 50;
  } else if (diffDays <= REMINDER_CONFIG.criticalDays) {
    if (status === 'Good') status = 'Warning';
    score += 25;
  } else if (diffDays <= REMINDER_CONFIG.warningDays) {
    if (status === 'Good') status = 'Warning';
    score += 15;
  }

  if (OPERATIONAL_STATUS[apar.operationalStatus]?.inspectable !== false) {
    const checklist = getChecklist(apar.jenis);
    const inspData = inspectionResult || (inspectionDetails[apar.id] || {});
    
    let totalItems = checklist.length;
    let tidakStandarCount = 0;
    
    checklist.forEach(item => {
      if (inspData[item.id] === 'tidak_standar') {
        tidakStandarCount++;
      }
    });
    
    if (totalItems > 0) {
      const tidakStandarPercentage = (tidakStandarCount / totalItems) * 100;
      
      if (tidakStandarPercentage >= 50) {
        status = 'Critical';
        score += 50;
      } else if (tidakStandarPercentage >= 25) {
        if (status !== 'Critical') status = 'Warning';
        score += 25;
      } else if (tidakStandarPercentage > 0) {
        if (status === 'Good') status = 'Warning';
        score += 10;
      }
    }
  }
  
  if (score >= 70 && status !== 'Critical') {
    status = 'Replace Required';
  }
  
  if (apar.operationalStatus === 'BACKUP' && status === 'Good') {
    return 'Backup';
  }
  
  return status;
}

/**
 * Update semua status APAR dan sync BATCH ke Google Sheets (hanya 1x request)
 */
async function updateAllAutoStatus() {
  let changes = [];
  
  for (let i = 0; i < aparData.length; i++) {
    const apar = aparData[i];
    const newStatus = calculateAutoStatus(apar);
    
    if (apar.status !== newStatus) {
      console.log(`📊 Status ${apar.id}: ${apar.status} → ${newStatus}`);
      apar.status = newStatus;
      changes.push({ ...apar }); 
    }
  }
  
  if (changes.length > 0) {
    console.log(`🔄 Terdapat ${changes.length} perubahan status, sync batch ke server...`);
    const success = await batchUpdateAparStatus(changes);
    if (success) {
      console.log('✅ Batch update status berhasil');
    } else {
      console.warn('⚠️ Batch update status gagal, reload data dari server');
      await fetchFromGoogleSheets(); 
    }
  }
  
  return changes.length > 0;
}

/**
 * Batch update multiple APAR ke Google Sheets (1 request saja)
 */
async function batchUpdateAparStatus(updatedApars) {
  if (!updatedApars.length) return true;
  
  try {
    const result = await sheetsGET({
      action: 'batchUpdateStatus',
      data: encodeURIComponent(JSON.stringify(updatedApars))
    });
    return result.success;
  } catch (error) {
    console.error('❌ Gagal batch update status:', error);
    return false;
  }
}

/**
 * Batch update operational status multiple APAR
 */
async function batchUpdateOperationalStatus(updates) {
  if (!updates.length) return true;
  
  try {
    const result = await sheetsGET({
      action: 'batchUpdateOperationalStatus',
      data: encodeURIComponent(JSON.stringify(updates))
    });
    return result.success;
  } catch (error) {
    console.error('❌ Gagal batch update operational status:', error);
    return false;
  }
}

/**
 * Update operational status untuk satu APAR
 */
async function updateAparOperationalStatus(aparId, newStatus) {
  const apar = aparData.find(a => a.id === aparId);
  if (!apar) return false;
  
  if (apar.operationalStatus === newStatus) return true;
  
  apar.operationalStatus = newStatus;
  
  const newAutoStatus = calculateAutoStatus(apar);
  apar.status = newAutoStatus;
  
  const success = await pushAparToSheets(apar);
  
  if (success) {
    showToast(`📦 ${aparId}: ${OPERATIONAL_STATUS[newStatus]?.label}`, 'success');
    if (!currentInspectingApar && !editMode) {
      renderPage(currentPage);
    }
    return true;
  }
  
  return false;
}

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
      aparData.forEach(apar => {
        if (!apar.operationalStatus) {
          apar.operationalStatus = 'ACTIVE';
        }
      });
      await updateAllAutoStatusWithoutSync();
      console.log('✅ Data APAR:', aparData.length, 'item');
      console.log('📊 Active:', aparData.filter(a => a.operationalStatus === 'ACTIVE').length);
      console.log('📦 Backup:', aparData.filter(a => a.operationalStatus === 'BACKUP').length);
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

/**
 * Update status tanpa sync ke server (hanya di memory)
 */
async function updateAllAutoStatusWithoutSync() {
  for (let i = 0; i < aparData.length; i++) {
    const apar = aparData[i];
    const newStatus = calculateAutoStatus(apar);
    if (apar.status !== newStatus) {
      console.log(`📊 Status ${apar.id}: ${apar.status} → ${newStatus} (memory only)`);
      apar.status = newStatus;
    }
  }
}

async function fetchInspectionFromSheets() {
  try {
    const result = await sheetsGET({ action: 'getInspectionData' });
    if (result.success && result.data) {
      inspectionThisMonth = result.data.thisMonth || [];
      inspectionDetails   = result.data.details || {};
      await updateAllAutoStatusWithoutSync();
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
    if (result.success) {
      console.log('✅ Inspeksi', aparId, 'disimpan');
      const apar = aparData.find(a => a.id === aparId);
      if (apar) {
        const newStatus = calculateAutoStatus(apar, inspectionDetails[aparId]);
        if (apar.status !== newStatus) {
          apar.status = newStatus;
          await pushAparToSheets(apar);
        }
      }
    }
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

// Fungsi resetData telah dihapus sesuai permintaan

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

setInterval(async () => {
  if (isDataLoaded && !currentInspectingApar && !editMode) {
    await fetchFromGoogleSheets();
    await fetchInspectionFromSheets();
  }
}, 60000);