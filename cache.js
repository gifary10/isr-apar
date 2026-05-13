// ============================================================
//  CACHE LAYER — ISR APAR
//  Optimasi: persistent cache, index map, memoized filter,
//            parallel fetch, smart refresh (ETag-like timestamp)
// ============================================================

// ── In-memory state ──────────────────────────────────────────
let aparData          = [];
let inspectionThisMonth = [];
let inspectionDetails = {};
let isDataLoaded      = false;

// ── Cache keys (localStorage) ────────────────────────────────
const CACHE_KEYS = {
  apar:           'isr_apar_data',
  inspection:     'isr_inspection_data',
  aparTs:         'isr_apar_ts',
  inspectionTs:   'isr_inspection_ts',
};

// TTL: data dianggap segar selama 5 menit
const CACHE_TTL_MS    = 5 * 60 * 1000;
// Interval auto-refresh: setiap 60 detik, tapi hanya fetch jika TTL habis
const REFRESH_INTERVAL_MS = 60 * 1000;

// ── Index map: O(1) lookup by aparId ─────────────────────────
let _aparIndex = new Map();   // aparId → objek apar

function _rebuildIndex() {
  _aparIndex.clear();
  aparData.forEach(a => _aparIndex.set(a.id, a));
}

function _getAparById(id) {
  return _aparIndex.get(id) ?? null;
}

// ── Memoized derived lists ────────────────────────────────────
let _activeAparsCache  = null;
let _reminderAparsCache = null;

function _invalidateDerivedCaches() {
  _activeAparsCache   = null;
  _reminderAparsCache = null;
  _maxIdCache         = -1;
}

function getActiveApars() {
  if (_activeAparsCache) return _activeAparsCache;
  _activeAparsCache = aparData.filter(
    a => OPERATIONAL_STATUS[a.operationalStatus]?.inspectable !== false
  );
  return _activeAparsCache;
}

function getReminderApars() {
  if (_reminderAparsCache) return _reminderAparsCache;
  _reminderAparsCache = REMINDER_CONFIG.includeBackupInReminder
    ? aparData
    : aparData.filter(a => OPERATIONAL_STATUS[a.operationalStatus]?.inspectable !== false);
  return _reminderAparsCache;
}

// ── ID generation: cached max number ─────────────────────────
let _maxIdCache = -1;

function _ensureMaxId() {
  if (_maxIdCache >= 0) return;
  _maxIdCache = aparData.reduce((max, a) => {
    const m = a.id.match(/APAR-(\d+)/);
    const n = m ? parseInt(m[1]) : 0;
    return n > max ? n : max;
  }, 0);
}

function generateId() {
  _ensureMaxId();
  _maxIdCache += 1;
  return `APAR-${String(_maxIdCache).padStart(3, '0')}`;
}

// ── Checklist lookup (config sudah const, tidak perlu cache) ──
function getChecklist(jenis) {
  return inspectionChecklists[jenis] || defaultChecklist;
}

// ── Date memoization: today di-cache per hari ────────────────
let _todayCache    = null;
let _todayDateStr  = '';

function _getToday() {
  const now = new Date();
  const str = now.toDateString();
  if (str !== _todayDateStr) {
    _todayCache   = new Date(now.setHours(0, 0, 0, 0));
    _todayDateStr = str;
  }
  return _todayCache;
}

// ── Status calculation (menggunakan _getToday() bersama) ──────
function calculateAutoStatus(apar, inspectionResult = null) {
  if (apar.operationalStatus === 'RETIRED') return 'Retired';

  let status = 'Good';
  let score  = 0;

  const today   = _getToday();
  const expDate = parseExpRefill(apar.expRefill);

  if (!isNaN(expDate.getTime())) {
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate - today) / 86400000);

    if (diffDays < 0) {
      status = 'Critical'; score += 50;
    } else if (diffDays <= REMINDER_CONFIG.criticalDays) {
      if (status === 'Good') status = 'Warning'; score += 25;
    } else if (diffDays <= REMINDER_CONFIG.warningDays) {
      if (status === 'Good') status = 'Warning'; score += 15;
    }
  } else if (apar.operationalStatus === 'BACKUP') {
    return 'Backup';
  }

  if (OPERATIONAL_STATUS[apar.operationalStatus]?.inspectable !== false) {
    const checklist = getChecklist(apar.jenis);
    const inspData  = inspectionResult || inspectionDetails[apar.id] || {};
    let tidakStandarCount = 0;

    for (let i = 0; i < checklist.length; i++) {
      if (inspData[checklist[i].id] === 'tidak_standar') tidakStandarCount++;
    }

    if (checklist.length > 0) {
      const pct = (tidakStandarCount / checklist.length) * 100;
      if      (pct >= 50) { status = 'Critical'; score += 50; }
      else if (pct >= 25) { if (status !== 'Critical') status = 'Warning'; score += 25; }
      else if (pct > 0)   { if (status === 'Good') status = 'Warning'; score += 10; }
    }
  }

  if (score >= 70 && status !== 'Critical') status = 'Replace Required';
  if (apar.operationalStatus === 'BACKUP' && status === 'Good') return 'Backup';

  return status;
}

// ── Batch status update (memory only) ────────────────────────
function updateAllAutoStatusWithoutSync() {
  for (const apar of aparData) {
    const newStatus = calculateAutoStatus(apar);
    if (apar.status !== newStatus) {
      console.log(`📊 Status ${apar.id}: ${apar.status} → ${newStatus} (memory only)`);
      apar.status = newStatus;
    }
  }
}

// ── Batch status update + sync ke server ─────────────────────
async function updateAllAutoStatus() {
  const changes = [];
  for (const apar of aparData) {
    const newStatus = calculateAutoStatus(apar);
    if (apar.status !== newStatus) {
      console.log(`📊 Status ${apar.id}: ${apar.status} → ${newStatus}`);
      apar.status = newStatus;
      changes.push({ ...apar });
    }
  }

  if (changes.length > 0) {
    console.log(`🔄 ${changes.length} perubahan status, sync batch...`);
    const ok = await batchUpdateAparStatus(changes);
    if (!ok) {
      console.warn('⚠️ Batch update gagal, reload dari server');
      await fetchFromGoogleSheets();
    }
  }
  return changes.length > 0;
}

// ── Persistent cache helpers (localStorage) ──────────────────
function _saveToLocalCache(key, tsKey, data) {
  try {
    localStorage.setItem(key,   JSON.stringify(data));
    localStorage.setItem(tsKey, Date.now().toString());
  } catch (e) {
    // Storage penuh atau private mode — abaikan saja
    console.warn('⚠️ Tidak dapat menyimpan ke localStorage:', e.message);
  }
}

function _loadFromLocalCache(key, tsKey) {
  try {
    const ts   = parseInt(localStorage.getItem(tsKey) || '0', 10);
    const age  = Date.now() - ts;
    if (age > CACHE_TTL_MS) return null;  // expired

    const raw  = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _invalidateLocalCache() {
  try {
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
  } catch (_) {}
}

// ── Google Sheets network layer ───────────────────────────────
async function sheetsGET(params) {
  const url = new URL(GOOGLE_SHEETS_CONFIG.appsScriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ── Fetch APAR (cache-first) ──────────────────────────────────
async function fetchFromGoogleSheets({ forceNetwork = false } = {}) {
  // Coba cache dulu
  if (!forceNetwork) {
    const cached = _loadFromLocalCache(CACHE_KEYS.apar, CACHE_KEYS.aparTs);
    if (cached) {
      console.log('📦 APAR dari localStorage cache');
      aparData = cached;
      aparData.forEach(a => { if (!a.operationalStatus) a.operationalStatus = 'ACTIVE'; });
      _rebuildIndex();
      _invalidateDerivedCaches();
      updateAllAutoStatusWithoutSync();
      return true;
    }
  }

  try {
    const result = await sheetsGET({ action: 'getAllApar' });
    if (result.success && result.data) {
      aparData = result.data;
      aparData.forEach(a => { if (!a.operationalStatus) a.operationalStatus = 'ACTIVE'; });
      _rebuildIndex();
      _invalidateDerivedCaches();
      updateAllAutoStatusWithoutSync();
      _saveToLocalCache(CACHE_KEYS.apar, CACHE_KEYS.aparTs, aparData);
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

// ── Fetch Inspection (cache-first) ───────────────────────────
async function fetchInspectionFromSheets({ forceNetwork = false } = {}) {
  if (!forceNetwork) {
    const cached = _loadFromLocalCache(CACHE_KEYS.inspection, CACHE_KEYS.inspectionTs);
    if (cached) {
      console.log('📦 Inspeksi dari localStorage cache');
      inspectionThisMonth = cached.thisMonth || [];
      inspectionDetails   = cached.details   || {};
      updateAllAutoStatusWithoutSync();
      return true;
    }
  }

  try {
    const result = await sheetsGET({ action: 'getInspectionData' });
    if (result.success && result.data) {
      inspectionThisMonth = result.data.thisMonth || [];
      inspectionDetails   = result.data.details   || {};
      updateAllAutoStatusWithoutSync();
      _saveToLocalCache(CACHE_KEYS.inspection, CACHE_KEYS.inspectionTs, result.data);
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

// ── Push / mutate helpers ─────────────────────────────────────
async function batchUpdateAparStatus(updatedApars) {
  if (!updatedApars.length) return true;
  try {
    const result = await sheetsGET({
      action: 'batchUpdateStatus',
      data:   encodeURIComponent(JSON.stringify(updatedApars))
    });
    if (result.success) _saveToLocalCache(CACHE_KEYS.apar, CACHE_KEYS.aparTs, aparData);
    return result.success;
  } catch (error) {
    console.error('❌ Gagal batch update status:', error);
    return false;
  }
}

async function batchUpdateOperationalStatus(updates) {
  if (!updates.length) return true;
  try {
    const result = await sheetsGET({
      action: 'batchUpdateOperationalStatus',
      data:   encodeURIComponent(JSON.stringify(updates))
    });
    return result.success;
  } catch (error) {
    console.error('❌ Gagal batch update operational status:', error);
    return false;
  }
}

async function updateAparOperationalStatus(aparId, newStatus) {
  const apar = _getAparById(aparId);
  if (!apar) return false;
  if (apar.operationalStatus === newStatus) return true;

  apar.operationalStatus = newStatus;
  apar.status = calculateAutoStatus(apar);
  _invalidateDerivedCaches();

  const ok = await pushAparToSheets(apar);
  if (ok) {
    showToast(`📦 ${aparId}: ${OPERATIONAL_STATUS[newStatus]?.label}`, 'success');
    if (!currentInspectingApar && !editMode) renderPage(currentPage);
    return true;
  }
  return false;
}

async function pushAparToSheets(apar) {
  try {
    const result = await sheetsGET({
      action: 'saveApar',
      data:   encodeURIComponent(JSON.stringify(apar))
    });
    if (result.success) {
      console.log('✅', apar.id, 'disimpan');
      // Update cache lokal supaya tidak perlu refetch
      _saveToLocalCache(CACHE_KEYS.apar, CACHE_KEYS.aparTs, aparData);
    }
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
      note:      note || '',
      checklist: inspectionDetails[aparId] || {}
    };
    const result = await sheetsGET({
      action: 'saveInspection',
      data:   encodeURIComponent(JSON.stringify(payload))
    });
    if (result.success) {
      console.log('✅ Inspeksi', aparId, 'disimpan');
      // Update cache inspeksi lokal
      _saveToLocalCache(CACHE_KEYS.inspection, CACHE_KEYS.inspectionTs, {
        thisMonth: inspectionThisMonth,
        details:   inspectionDetails
      });

      const apar = _getAparById(aparId);
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
    if (result.success) {
      console.log('🗑️', aparId, 'dihapus');
      // Hapus dari memory & index
      aparData = aparData.filter(a => a.id !== aparId);
      _rebuildIndex();
      _invalidateDerivedCaches();
      _saveToLocalCache(CACHE_KEYS.apar, CACHE_KEYS.aparTs, aparData);
    }
    return result.success;
  } catch (error) {
    console.error('❌ Gagal hapus APAR:', error);
    showToast('❌ Gagal menghapus data dari server.', 'danger');
    return false;
  }
}

// ── Manual refresh (paksa network) ───────────────────────────
async function refreshDataFromSheets() {
  if (currentInspectingApar || editMode) {
    showToast('⚠️ Tidak dapat refresh saat sedang mengedit data.', 'warning');
    return;
  }
  showToast('Memperbarui data...', 'info');

  // Fetch APAR + Inspeksi secara PARALEL
  await Promise.all([
    fetchFromGoogleSheets({ forceNetwork: true }),
    fetchInspectionFromSheets({ forceNetwork: true })
  ]);

  if (!currentInspectingApar && !editMode) renderPage(currentPage);
  showToast('Data berhasil diperbarui', 'success');
}

// ── Inisialisasi ──────────────────────────────────────────────
async function initializeData() {
  console.log('Inisialisasi data...');

  // Fetch APAR + Inspeksi secara PARALEL (cache-first masing-masing)
  const [aparOk] = await Promise.all([
    fetchFromGoogleSheets(),
    fetchInspectionFromSheets()
  ]);

  isDataLoaded = true;

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.opacity    = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }

  if (!aparOk) {
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

// ── Auto-refresh: hanya fetch jika TTL sudah habis ────────────
setInterval(async () => {
  if (!isDataLoaded || currentInspectingApar || editMode) return;

  const aparAge  = Date.now() - parseInt(localStorage.getItem(CACHE_KEYS.aparTs)  || '0', 10);
  const inspAge  = Date.now() - parseInt(localStorage.getItem(CACHE_KEYS.inspectionTs) || '0', 10);

  const needApar = aparAge  > CACHE_TTL_MS;
  const needInsp = inspAge  > CACHE_TTL_MS;

  if (!needApar && !needInsp) {
    console.log('⏩ Auto-refresh dilewati, cache masih segar');
    return;
  }

  const fetches = [];
  if (needApar) fetches.push(fetchFromGoogleSheets({ forceNetwork: true }));
  if (needInsp) fetches.push(fetchInspectionFromSheets({ forceNetwork: true }));

  await Promise.all(fetches);
  renderPage(currentPage);
}, REFRESH_INTERVAL_MS);