// ==================== DATE HELPERS ====================
/**
 * Parse expRefill (dd/mm/yyyy ATAU yyyy-mm-dd) ke Date object.
 * Backend mengembalikan dd/mm/yyyy; input[type=date] mengirim yyyy-mm-dd.
 */
function parseExpRefill(str) {
  if (!str) return new Date(NaN);
  str = String(str).trim();
  // dd/mm/yyyy
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  // yyyy-mm-dd
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  return new Date(str); // fallback
}

/**
 * Konversi dd/mm/yyyy → yyyy-mm-dd untuk value <input type="date">
 */
function expRefillToInputValue(str) {
  if (!str) return '';
  const dmy = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  return str; // sudah yyyy-mm-dd atau kosong
}

/**
 * Konversi yyyy-mm-dd (dari input[type=date]) → dd/mm/yyyy untuk disimpan
 */
function inputValueToExpRefill(str) {
  if (!str) return '';
  const ymd = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  return str; // sudah dd/mm/yyyy
}

function renderDashboard() {
  if (!isDataLoaded) {
    return renderLoadingState('Memuat data dari Google Sheets...');
  }
  
  const total = aparData.length;
  const good = aparData.filter(a => a.status === 'Good').length;
  const warning = aparData.filter(a => a.status === 'Warning').length;
  const critical = aparData.filter(a => a.status === 'Critical').length;
  const inspected = inspectionThisMonth.length;
  const notInspected = total - inspected;
  
  return `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h5 class="fw-bold text-navy mb-0">Dashboard</h5>
        <small class="text-muted">Ringkasan APAR</small>
      </div>
      <button class="btn btn-outline-secondary btn-sm rounded-pill" onclick="refreshDataFromSheets()">
        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
      </button>
    </div>
    
    <div class="row g-3 mb-4">
      <div class="col-6">
        <div class="stat-card" style="background: linear-gradient(135deg, var(--navy), var(--navy-light));">
          <div class="stat-label text-white-50">Total APAR</div>
          <div class="stat-value text-white">${total}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">Good</div>
          <div class="stat-value text-success">${good}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">Warning</div>
          <div class="stat-value text-warning">${warning}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">Critical</div>
          <div class="stat-value text-danger">${critical}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">Sudah Inspeksi</div>
          <div class="stat-value text-primary">${inspected}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">Belum Inspeksi</div>
          <div class="stat-value text-secondary">${notInspected}</div>
        </div>
      </div>
    </div>
    
    <div class="mb-3">
      <h6 class="fw-bold text-navy d-flex align-items-center gap-2">
        <i class="bi bi-exclamation-triangle text-orange"></i>
        APAR Critical & Perlu Perhatian
      </h6>
    </div>
    ${renderCriticalAparList()}
    
    ${total === 0 ? renderEmptyState(
      'bi-shield-plus',
      'Belum ada data APAR',
      'Tambahkan data APAR di menu Master',
      { text: 'Tambah APAR', icon: 'bi-plus-lg', action: "navigateTo('master')" }
    ) : ''}
  `;
}

function renderCriticalAparList() {
  const criticalApars = aparData.filter(a => a.status === 'Critical' || a.status === 'Replace Required');
  
  if (criticalApars.length === 0) {
    return `
      <div class="text-center py-4">
        <i class="bi bi-check-circle fs-3 text-success d-block mb-2"></i>
        <p class="text-muted">✅ Tidak ada APAR critical.</p>
      </div>
    `;
  }
  
  return criticalApars.map(a => `
    <div class="list-card" style="border-left: 4px solid var(--critical);">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong class="text-navy">${a.id}</strong>
          <div class="small text-muted mt-1">
            <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
          </div>
        </div>
        <span class="status-badge ${getStatusBadgeClass(a.status)}">
          <i class="bi ${a.status === 'Critical' ? 'bi-exclamation-octagon' : 'bi-arrow-repeat'} me-1"></i>
          ${a.status}
        </span>
      </div>
    </div>
  `).join('');
}

// ==================== MASTER APAR ====================
function renderMaster() {
  return `
    <div class="d-flex gap-2 mb-4">
      <div class="flex-grow-1">
        <div class="input-group">
          <span class="input-group-text bg-white border-end-0" style="border-radius: var(--radius-sm) 0 0 var(--radius-sm);">
            <i class="bi bi-search text-muted"></i>
          </span>
          <input class="form-control border-start-0" placeholder="Cari APAR..." oninput="filterMaster(this.value)" id="masterSearch" style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
        </div>
      </div>
      <button class="btn btn-outline-secondary rounded-pill" onclick="refreshDataFromSheets()" title="Refresh Data">
        <i class="bi bi-arrow-clockwise"></i>
      </button>
      <button class="btn btn-outline-danger rounded-pill" onclick="resetData()" title="Hapus Semua Data">
        <i class="bi bi-trash"></i>
      </button>
    </div>
    
    <div id="masterList">
      ${renderMasterList()}
    </div>
    
    ${aparData.length === 0 ? renderEmptyState(
      'bi-database',
      'Database kosong',
      'Tambahkan APAR pertama Anda'
    ) : ''}
    
    <button class="fab-master" onclick="openAddForm()">
      <i class="bi bi-plus-lg"></i>
    </button>
  `;
}

function renderMasterList(filteredData = null) {
  const data = filteredData || aparData;
  if (data.length === 0) return '';
  
  return data.map((a, index) => `
    <div class="list-card" data-id="${a.id}" style="animation-delay: ${index * 0.03}s;">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <strong class="text-navy">${a.id}</strong>
          <div class="small text-muted mt-1">
            <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
          </div>
        </div>
        <span class="status-badge ${getStatusBadgeClass(a.status)}">
          <i class="bi ${getStatusIcon(a.status)} me-1"></i>${a.status}
        </span>
      </div>
      
      <div class="d-flex flex-wrap gap-2 mb-3">
        <span class="badge bg-light text-navy">
          <i class="bi bi-fire me-1"></i>${a.jenis}
        </span>
        <span class="badge bg-light text-navy">
          <i class="bi bi-layers me-1"></i>Kelas ${a.kelas}
        </span>
        <span class="badge bg-light text-navy">
          <i class="bi bi-box me-1"></i>${a.kapasitas}
        </span>
      </div>
      
      <div class="small text-muted mb-2">
        <i class="bi bi-calendar-x me-1"></i>Exp Refill: ${a.expRefill}
      </div>
      
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1" onclick="event.stopPropagation(); openEditForm('${a.id}')">
          <i class="bi bi-pencil me-1"></i> Edit
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="event.stopPropagation(); deleteApar('${a.id}')">
          <i class="bi bi-trash me-1"></i> Hapus
        </button>
      </div>
    </div>
  `).join('');
}

function filterMaster(query) {
  const list = document.getElementById('masterList');
  if (!list) return;
  
  if (!query || query.trim() === '') {
    // Tampilkan semua
    list.innerHTML = renderMasterList();
    return;
  }
  
  const q = query.toLowerCase().trim();
  
  // Filter berdasarkan field yang relevan saja (ID, lokasi, jenis, kelas)
  const filtered = aparData.filter(a => {
    return a.id.toLowerCase().includes(q) ||
           a.lokasi.toLowerCase().includes(q) ||
           a.jenis.toLowerCase().includes(q) ||
           a.kelas.toLowerCase().includes(q) ||
           a.kapasitas.toLowerCase().includes(q);
  });
  
  list.innerHTML = renderMasterList(filtered);
}

// ==================== APAR FORM ====================
function openAddForm() {
  editMode = 'add';
  document.getElementById('backBtn').classList.remove('d-none');
  document.getElementById('pageTitle').textContent = 'Tambah APAR';
  
  const app = document.getElementById('app');
  app.innerHTML = renderAparForm(null);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openEditForm(aparId) {
  editMode = aparId;
  document.getElementById('backBtn').classList.remove('d-none');
  document.getElementById('pageTitle').textContent = `Edit ${aparId}`;
  
  const app = document.getElementById('app');
  app.innerHTML = renderAparForm(aparId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAparForm(aparId) {
  const apar = aparId ? aparData.find(a => a.id === aparId) : null;
  const isEdit = !!apar;
  
  return `
    <div class="card shadow-sm border-0" style="border-radius: var(--radius-lg);">
      <div class="card-body p-4">
        <div class="d-flex align-items-center mb-4">
          <div class="rounded-circle bg-orange bg-opacity-10 p-2 me-3">
            <i class="bi ${isEdit ? 'bi-pencil' : 'bi-plus-lg'} text-orange fs-5"></i>
          </div>
          <div>
            <h6 class="fw-bold text-navy mb-0">${isEdit ? 'Edit Data' : 'Tambah Data'} APAR</h6>
            <small class="text-muted">${isEdit ? 'Perbarui informasi APAR' : 'Isi data APAR baru'}</small>
          </div>
        </div>
        
        <form id="aparForm" onsubmit="saveApar(event, '${aparId || ''}')" oninput="hasUnsavedFormChanges = true">
          <div class="mb-3">
            <label class="form-label-custom">ID APAR</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-upc-scan text-muted"></i>
              </span>
              <input type="text" class="form-control border-start-0" name="id" 
                     value="${apar ? apar.id : generateId()}" 
                     ${isEdit ? 'readonly' : 'required'} placeholder="APAR-001">
            </div>
          </div>
          
          <div class="mb-3">
            <label class="form-label-custom">Lokasi</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-geo-alt text-muted"></i>
              </span>
              <input type="text" class="form-control border-start-0" name="lokasi" 
                     value="${apar ? apar.lokasi : ''}" required placeholder="Gedung A Lantai 1">
            </div>
          </div>
          
          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label-custom">Jenis APAR</label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0">
                  <i class="bi bi-fire text-muted"></i>
                </span>
                <select class="form-select border-start-0" name="jenis" required>
                  <option value="">Pilih Jenis</option>
                  ${renderSelectOptions(['CO2', 'Dry Powder', 'Foam', 'Wet Chemical'], apar?.jenis)}
                </select>
              </div>
            </div>
            <div class="col-6">
              <label class="form-label-custom">Kelas</label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0">
                  <i class="bi bi-layers text-muted"></i>
                </span>
                <select class="form-select border-start-0" name="kelas" required>
                  <option value="">Pilih Kelas</option>
                  ${renderSelectOptions(['A', 'B', 'AB', 'ABC', 'F'], apar?.kelas)}
                </select>
              </div>
            </div>
          </div>
          
          <div class="mb-3">
            <label class="form-label-custom">Kapasitas</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-box text-muted"></i>
              </span>
              <input type="text" class="form-control border-start-0" name="kapasitas" 
                     value="${apar ? apar.kapasitas : ''}" required placeholder="5kg / 6L">
            </div>
          </div>
          
          <div class="mb-3">
            <label class="form-label-custom">Tanggal Expired Refill</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-calendar-x text-muted"></i>
              </span>
              <input type="date" class="form-control border-start-0" name="expRefill" 
                     value="${apar ? expRefillToInputValue(apar.expRefill) : ''}" required>
            </div>
          </div>
          
          <div class="mb-4">
            <label class="form-label-custom">Status</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-flag text-muted"></i>
              </span>
              <select class="form-select border-start-0" name="status" required>
                <option value="">Pilih Status</option>
                ${renderSelectOptions(['Good', 'Warning', 'Critical', 'Replace Required'], apar?.status)}
              </select>
            </div>
          </div>
          
          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-xl flex-grow-1">
              <i class="bi ${isEdit ? 'bi-check-lg' : 'bi-plus-lg'} me-2"></i>
              ${isEdit ? 'Simpan Perubahan' : 'Tambah APAR'}
            </button>
            <button type="button" class="btn btn-outline-secondary btn-xl" onclick="goBack()">
              <i class="bi bi-x-lg me-2"></i>Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function saveApar(event, aparId) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const data = {
    id: formData.get('id'),
    lokasi: formData.get('lokasi'),
    jenis: formData.get('jenis'),
    kelas: formData.get('kelas'),
    kapasitas: formData.get('kapasitas'),
    expRefill: inputValueToExpRefill(formData.get('expRefill')),
    status: formData.get('status')
  };

  // Validasi semua field terisi
  if (!data.id || !data.lokasi || !data.jenis || !data.kelas || !data.kapasitas || !data.expRefill || !data.status) {
    showToast('⚠️ Semua field harus diisi', 'warning');
    return;
  }

  // Validasi format tanggal (dd/mm/yyyy setelah konversi)
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(data.expRefill)) {
    showToast('⚠️ Format tanggal tidak valid', 'warning');
    return;
  }
  const expDate = parseExpRefill(data.expRefill);
  if (isNaN(expDate.getTime())) {
    showToast('⚠️ Tanggal expired tidak valid', 'warning');
    return;
  }

  showToast('🔄 Menyimpan data...', 'info');

  if (aparId) {
    const index = aparData.findIndex(a => a.id === aparId);
    if (index !== -1) aparData[index] = data;
  } else {
    if (aparData.find(a => a.id === data.id)) {
      showToast('⚠️ ID APAR sudah ada', 'warning');
      return;
    }
    aparData.push(data);
  }

  const success = await pushAparToSheets(data);
  
  if (success) {
    await fetchFromGoogleSheets();
    editMode = null;
    hasUnsavedFormChanges = false;
    document.getElementById('backBtn').classList.add('d-none');
    document.getElementById('pageTitle').textContent = 'Master APAR';
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>✅ Berhasil!';
      submitBtn.classList.add('btn-success');
      submitBtn.classList.remove('btn-primary');
      submitBtn.disabled = true;
      
      setTimeout(() => {
        const app = document.getElementById('app');
        app.innerHTML = renderMaster();
      }, 500);
    } else {
      const app = document.getElementById('app');
      app.innerHTML = renderMaster();
    }
    
    showToast(`✅ ${data.id} berhasil ${aparId ? 'diupdate' : 'ditambahkan'}`, 'success');
  } else {
    showToast('❌ Gagal menyimpan ke Google Sheets', 'danger');
    await fetchFromGoogleSheets();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteApar(aparId) {
  const apar = aparData.find(a => a.id === aparId);
  if (!apar) return;
  
  const confirmDelete = confirm(
    `⚠️ Hapus ${aparId}\n\n` +
    `Lokasi: ${apar.lokasi}\n` +
    `Jenis: ${apar.jenis}\n\n` +
    `Data tidak dapat dikembalikan. Lanjutkan?`
  );
  
  if (confirmDelete) {
    showToast('🔄 Menghapus data...', 'warning');
    
    const card = document.querySelector(`.list-card[data-id="${aparId}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      card.style.transition = 'all 0.3s ease';
    }
    
    const success = await deleteAparFromSheets(aparId);
    
    if (success) {
      aparData = aparData.filter(a => a.id !== aparId);
      inspectionThisMonth = inspectionThisMonth.filter(id => id !== aparId);
      delete inspectionDetails[aparId];
      
      await new Promise(resolve => setTimeout(resolve, 300));
      const app = document.getElementById('app');
      app.innerHTML = renderMaster();
      
      showToast(`🗑️ ${aparId} berhasil dihapus`, 'danger');
    } else {
      showToast('❌ Gagal menghapus data', 'danger');
      const app = document.getElementById('app');
      app.innerHTML = renderMaster();
    }
  }
}

// ==================== MONITORING ====================
// Variabel untuk menyimpan state filter
let currentMonitorFilter = {
  lokasi: '',
  status: ''
};

function renderMonitoring() {
  const lokasiList = [...new Set(aparData.map(a => a.lokasi.split(' ')[0]))];
  
  // Reset filter saat render ulang
  currentMonitorFilter = { lokasi: '', status: '' };
  
  return `
    <div class="d-flex gap-2 mb-4">
      <div class="flex-grow-1">
        <div class="input-group">
          <span class="input-group-text bg-white border-end-0" style="border-radius: var(--radius-sm) 0 0 var(--radius-sm);">
            <i class="bi bi-geo-alt text-muted"></i>
          </span>
          <select class="form-select border-start-0 border-end-0" onchange="applyMonitorFilter()" id="monitorFilterLokasi" style="border-radius: 0;">
            <option value="">Semua Lokasi</option>
            ${renderSelectOptions(lokasiList)}
          </select>
          <span class="input-group-text bg-white border-start-0" style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
            <i class="bi bi-chevron-down text-muted"></i>
          </span>
        </div>
      </div>
      <div class="flex-grow-1">
        <div class="input-group">
          <span class="input-group-text bg-white border-end-0" style="border-radius: var(--radius-sm) 0 0 var(--radius-sm);">
            <i class="bi bi-flag text-muted"></i>
          </span>
          <select class="form-select border-start-0 border-end-0" onchange="applyMonitorFilter()" id="monitorFilterStatus" style="border-radius: 0;">
            <option value="">Semua Status</option>
            ${renderSelectOptions(['Good', 'Warning', 'Critical', 'Replace Required'])}
          </select>
          <span class="input-group-text bg-white border-start-0" style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
            <i class="bi bi-chevron-down text-muted"></i>
          </span>
        </div>
      </div>
    </div>
    
    <div id="monitorList">
      ${renderMonitorList()}
    </div>
    
    ${aparData.length === 0 ? renderEmptyState(
      'bi-graph-up',
      'Belum ada data untuk dimonitor'
    ) : ''}
  `;
}

function renderMonitorList() {
  // Terapkan filter gabungan
  let filteredData = aparData;
  
  if (currentMonitorFilter.lokasi) {
    filteredData = filteredData.filter(a => 
      a.lokasi.split(' ')[0] === currentMonitorFilter.lokasi
    );
  }
  
  if (currentMonitorFilter.status) {
    filteredData = filteredData.filter(a => 
      a.status === currentMonitorFilter.status
    );
  }
  
  if (filteredData.length === 0) {
    return `
      <div class="text-center py-4">
        <i class="bi bi-search fs-3 text-muted d-block mb-2"></i>
        <p class="text-muted">Tidak ada APAR dengan filter terpilih.</p>
      </div>
    `;
  }
  
  return filteredData.map((a, index) => `
    <div class="list-card" data-lokasi="${a.lokasi.split(' ')[0]}" data-status="${a.status}" style="animation-delay: ${index * 0.03}s;">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <strong class="text-navy">${a.id}</strong>
        <span class="status-badge ${getStatusBadgeClass(a.status)}">
          <i class="bi ${getStatusIcon(a.status)} me-1"></i>${a.status}
        </span>
      </div>
      <div class="small text-muted mb-1">
        <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
      </div>
      <div class="d-flex gap-2 mb-2">
        <span class="badge bg-light text-navy">
          <i class="bi bi-fire me-1"></i>${a.jenis}
        </span>
        <span class="badge bg-light text-navy">
          <i class="bi bi-calendar me-1"></i>${a.expRefill}
        </span>
      </div>
    </div>
  `).join('');
}

function applyMonitorFilter() {
  const lokasiSelect = document.getElementById('monitorFilterLokasi');
  const statusSelect = document.getElementById('monitorFilterStatus');
  
  currentMonitorFilter.lokasi = lokasiSelect ? lokasiSelect.value : '';
  currentMonitorFilter.status = statusSelect ? statusSelect.value : '';
  
  const monitorList = document.getElementById('monitorList');
  if (monitorList) {
    monitorList.innerHTML = renderMonitorList();
  }
}

// ==================== REMINDER ====================
function renderReminder() {
  const today = new Date();
  const reminders = aparData.filter(a => {
    const expDate = parseExpRefill(a.expRefill);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    return diffDays <= REMINDER_CONFIG.warningDays || 
           a.status === 'Warning' || 
           a.status === 'Critical' || 
           a.status === 'Replace Required';
  }).sort((a, b) => {
    const diffA = Math.ceil((parseExpRefill(a.expRefill) - today) / (1000 * 60 * 60 * 24));
    const diffB = Math.ceil((parseExpRefill(b.expRefill) - today) / (1000 * 60 * 60 * 24));
    return diffA - diffB;
  });
  
  return `
    <div class="d-flex align-items-center mb-4">
      <div class="rounded-circle bg-orange bg-opacity-10 p-2 me-3">
        <i class="bi bi-bell fs-5 text-orange"></i>
      </div>
      <div>
        <h6 class="fw-bold text-navy mb-0">Reminder APAR</h6>
        <small class="text-muted">${reminders.length} APAR perlu perhatian</small>
      </div>
    </div>
    
    ${renderReminderList(reminders, today)}
  `;
}

function renderReminderList(reminders, today) {
  if (reminders.length === 0) {
    return renderEmptyState(
      'bi-bell',
      'Tidak ada reminder',
      'Semua APAR dalam kondisi baik ✅'
    );
  }
  
  return reminders.map((a, index) => {
    const expDate = parseExpRefill(a.expRefill);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    
    let alertConfig = {
      class: '',
      icon: '',
      bgClass: '',
      textClass: '',
      borderClass: ''
    };
    
    if (diffDays < 0) {
      alertConfig = {
        borderClass: 'border-danger',
        icon: 'bi-exclamation-octagon',
        textClass: 'text-danger',
        bgClass: 'bg-danger',
        alertText: 'EXPIRED'
      };
    } else if (diffDays <= REMINDER_CONFIG.criticalDays) {
      alertConfig = {
        borderClass: 'border-warning',
        icon: 'bi-exclamation-triangle',
        textClass: 'text-warning',
        bgClass: 'bg-warning',
        alertText: `Kritis: H-${diffDays}`
      };
    } else if (diffDays <= REMINDER_CONFIG.warningDays) {
      alertConfig = {
        borderClass: 'border-info',
        icon: 'bi-info-circle',
        textClass: 'text-info',
        bgClass: 'bg-info',
        alertText: `Warning: H-${diffDays}`
      };
    }
    
    const daysText = diffDays < 0 
      ? `❌ Lewat ${Math.abs(diffDays)} hari`
      : `⏰ ${diffDays} hari lagi`;
    
    return `
      <div class="list-card mb-3" style="border-left: 4px solid var(--${alertConfig.borderClass === 'border-danger' ? 'critical' : alertConfig.borderClass === 'border-warning' ? 'warning' : 'info'}); animation-delay: ${index * 0.03}s;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <strong class="text-navy">${a.id}</strong>
            <div class="small text-muted mt-1">
              <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
            </div>
          </div>
          <span class="badge ${alertConfig.bgClass} text-white rounded-pill">
            <i class="bi ${alertConfig.icon} me-1"></i>${alertConfig.alertText}
          </span>
        </div>
        
        <div class="d-flex gap-2 mb-2">
          <span class="badge bg-light text-navy">
            <i class="bi bi-fire me-1"></i>${a.jenis}
          </span>
          <span class="badge bg-light text-navy">
            <i class="bi bi-box me-1"></i>${a.kapasitas}
          </span>
        </div>
        
        <div class="d-flex justify-content-between align-items-center">
          <div class="small ${alertConfig.textClass}">
            <i class="bi bi-calendar-x me-1"></i>Exp: ${a.expRefill}
          </div>
          <span class="small ${alertConfig.textClass} fw-bold">${daysText}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== UI HELPERS ====================
function renderLoadingState(message) {
  return `
    <div class="text-center mt-5 pt-5">
      <div class="spinner-border text-orange mb-3" role="status" style="width: 3rem; height: 3rem;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted">${message}</p>
    </div>
  `;
}

function renderEmptyState(icon, title, description, button = null) {
  return `
    <div class="empty-state">
      <i class="bi ${icon} empty-state-icon"></i>
      <h5 class="empty-state-title">${title}</h5>
      <p class="empty-state-text">${description}</p>
      ${button ? `
        <button class="btn btn-primary rounded-pill mt-3" onclick="${button.action}">
          <i class="bi ${button.icon} me-2"></i>${button.text}
        </button>
      ` : ''}
    </div>
  `;
}

function renderSelectOptions(options, selectedValue = null) {
  return options.map(opt => 
    `<option value="${opt}" ${selectedValue === opt ? 'selected' : ''}>${opt}</option>`
  ).join('');
}

function getStatusBadgeClass(status) {
  const mapping = {
    'Good': 'badge-good',
    'Warning': 'badge-warning',
    'Critical': 'badge-critical',
    'Replace Required': 'badge-replace'
  };
  return mapping[status] || 'badge-good';
}

function getStatusIcon(status) {
  const mapping = {
    'Good': 'bi-check-circle',
    'Warning': 'bi-exclamation-triangle',
    'Critical': 'bi-exclamation-octagon',
    'Replace Required': 'bi-arrow-repeat'
  };
  return mapping[status] || 'bi-question-circle';
}

// ==================== TOAST NOTIFICATION ====================
function showToast(msg, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  
  const icons = {
    success: 'bi-check-circle',
    danger: 'bi-x-circle',
    warning: 'bi-exclamation-triangle',
    info: 'bi-info-circle'
  };
  
  // Hapus toast lama jika terlalu banyak (maks 3)
  const existingToasts = container.querySelectorAll('.toast');
  if (existingToasts.length >= 3) {
    existingToasts[0].remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-bg-${type} border-0 show`;
  toast.setAttribute('role', 'alert');
  toast.style.animation = 'fadeUp 0.3s ease';
  
  toast.innerHTML = `
    <div class="d-flex align-items-center">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icons[type] || 'bi-info-circle'} me-2"></i>
        ${msg}
      </div>
      <button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeUp 0.3s ease reverse';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }, 3000);
}