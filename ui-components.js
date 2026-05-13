function parseExpRefill(str) {
  if (!str) return new Date(NaN);
  str = String(str).trim();
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  return new Date(str);
}

function expRefillToInputValue(str) {
  if (!str) return '';
  const dmy = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  return str;
}

function inputValueToExpRefill(str) {
  if (!str) return '';
  const ymd = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  return str;
}

function renderDashboard() {
  if (!isDataLoaded) {
    return renderLoadingState('Memuat data dari Google Sheets...');
  }

  // ── Data kalkulasi ────────────────────────────────────────
  const activeApars      = aparData.filter(a => a.operationalStatus === 'ACTIVE');
  const total            = activeApars.length;
  const good             = activeApars.filter(a => a.status === 'Good').length;
  const warning          = activeApars.filter(a => a.status === 'Warning').length;
  const critical         = activeApars.filter(a => a.status === 'Critical').length;
  const replaceRequired  = activeApars.filter(a => a.status === 'Replace Required').length;

  const backupCount      = aparData.filter(a => a.operationalStatus === 'BACKUP').length;
  const maintenanceCount = aparData.filter(a => a.operationalStatus === 'MAINTENANCE').length;
  const retiredCount     = aparData.filter(a => a.operationalStatus === 'RETIRED').length;

  const inspected    = inspectionThisMonth.filter(id => {
    const a = aparData.find(x => x.id === id);
    return a && a.operationalStatus === 'ACTIVE';
  }).length;
  const notInspected = total - inspected;
  const inspPct      = total > 0 ? Math.round((inspected / total) * 100) : 0;

  // ── Breakdown per jenis ───────────────────────────────────
  const jenisCounts = {};
  activeApars.forEach(a => {
    jenisCounts[a.jenis] = (jenisCounts[a.jenis] || 0) + 1;
  });

  // ── Ekspirasi dalam 30 hari ───────────────────────────────
  const today      = new Date(); today.setHours(0,0,0,0);
  const expiringSoon = aparData.filter(a => {
    if (a.operationalStatus === 'RETIRED') return false;
    const d = parseExpRefill(a.expRefill);
    if (isNaN(d.getTime())) return false;
    d.setHours(0,0,0,0);
    const diff = Math.ceil((d - today) / 86400000);
    return diff >= 0 && diff <= REMINDER_CONFIG.warningDays;
  });
  const expiredNow = aparData.filter(a => {
    if (a.operationalStatus === 'RETIRED') return false;
    const d = parseExpRefill(a.expRefill);
    if (isNaN(d.getTime())) return false;
    d.setHours(0,0,0,0);
    return Math.ceil((d - today) / 86400000) < 0;
  });

  // ── Donut SVG ─────────────────────────────────────────────
  const donutSvg = total > 0 ? _renderDonutChart({ good, warning, critical, replaceRequired }, total) : '';

  // ── Nama bulan ────────────────────────────────────────────
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const nowDate  = new Date();
  const bulanStr = `${bulan[nowDate.getMonth()]} ${nowDate.getFullYear()}`;

  // ── Health score sederhana ────────────────────────────────
  const healthScore = total > 0
    ? Math.round(((good + warning * 0.5) / total) * 100)
    : 0;
  const healthColor = healthScore >= 75 ? 'var(--good)'
                    : healthScore >= 50 ? 'var(--warning)'
                    : 'var(--critical)';
  const healthLabel = healthScore >= 75 ? 'Baik' : healthScore >= 50 ? 'Perlu Perhatian' : 'Kritis';

  return `
    <!-- Header baris -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h5 class="fw-bold text-navy mb-0">Dashboard</h5>
        <div class="small text-muted">${bulanStr}</div>
      </div>
      <button class="btn btn-outline-secondary btn-sm rounded-pill" onclick="refreshDataFromSheets()">
        <i class="bi bi-arrow-clockwise me-1"></i>Refresh
      </button>
    </div>

    <!-- ── HERO CARD ── -->
    <div class="dash-hero mb-3">
      <div class="dash-hero-left">
        <div class="dash-hero-label">Total APAR</div>
        <div class="dash-hero-total">${aparData.length}</div>
        <div class="d-flex flex-wrap gap-1 mt-2">
          <span class="op-status-badge badge-active"><i class="bi bi-play-circle me-1"></i>Aktif ${total}</span>
          ${backupCount  > 0 ? `<span class="op-status-badge badge-backup"><i class="bi bi-archive me-1"></i>${backupCount}</span>` : ''}
          ${maintenanceCount > 0 ? `<span class="op-status-badge badge-maintenance"><i class="bi bi-tools me-1"></i>${maintenanceCount}</span>` : ''}
          ${retiredCount > 0 ? `<span class="op-status-badge badge-retired"><i class="bi bi-x-circle me-1"></i>${retiredCount}</span>` : ''}
        </div>
      </div>
      <div class="dash-hero-right">
        ${donutSvg || `<div class="dash-hero-empty"><i class="bi bi-shield-check fs-3 text-white-50"></i></div>`}
      </div>
    </div>

    <!-- ── HEALTH SCORE ── -->
    <div class="dash-health-card mb-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="small fw-bold text-navy">
          <i class="bi bi-heart-pulse me-1" style="color:${healthColor}"></i>Health Score
        </span>
        <span class="fw-bold" style="color:${healthColor}">${healthScore}% — ${healthLabel}</span>
      </div>
      <div class="dash-progress-track">
        <div class="dash-progress-fill" style="width:${healthScore}%; background:${healthColor};"></div>
      </div>
    </div>

    <!-- ── STAT GRID 4-kotak ── -->
    <div class="row g-2 mb-3">
      <div class="col-6">
        <div class="dash-stat-mini dash-stat-good" onclick="navigateTo('monitoring')">
          <i class="bi bi-check-circle-fill"></i>
          <div class="dash-stat-mini-val">${good}</div>
          <div class="dash-stat-mini-lbl">Good</div>
        </div>
      </div>
      <div class="col-6">
        <div class="dash-stat-mini dash-stat-warning" onclick="navigateTo('monitoring')">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <div class="dash-stat-mini-val">${warning}</div>
          <div class="dash-stat-mini-lbl">Warning</div>
        </div>
      </div>
      <div class="col-6">
        <div class="dash-stat-mini dash-stat-critical" onclick="navigateTo('monitoring')">
          <i class="bi bi-exclamation-octagon-fill"></i>
          <div class="dash-stat-mini-val">${critical}</div>
          <div class="dash-stat-mini-lbl">Critical</div>
        </div>
      </div>
      <div class="col-6">
        <div class="dash-stat-mini dash-stat-replace" onclick="navigateTo('reminder')">
          <i class="bi bi-arrow-repeat"></i>
          <div class="dash-stat-mini-val">${replaceRequired}</div>
          <div class="dash-stat-mini-lbl">Replace</div>
        </div>
      </div>
    </div>

    <!-- ── PROGRESS INSPEKSI BULANAN ── -->
    <div class="list-card mb-3 p-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold text-navy small">
          <i class="bi bi-clipboard-check text-orange me-1"></i>Inspeksi Bulan Ini
        </span>
        <span class="small fw-bold ${inspPct === 100 ? 'text-success' : inspPct >= 50 ? 'text-warning' : 'text-danger'}">
          ${inspected}/${total} (${inspPct}%)
        </span>
      </div>
      <div class="dash-progress-track mb-2">
        <div class="dash-progress-fill" style="width:${inspPct}%; background:${inspPct===100?'var(--good)':inspPct>=50?'var(--warning)':'var(--critical)'};"></div>
      </div>
      <div class="d-flex gap-3">
        <div class="small text-success"><i class="bi bi-check-circle me-1"></i>${inspected} Sudah</div>
        <div class="small text-danger"><i class="bi bi-x-circle me-1"></i>${notInspected} Belum</div>
        ${inspPct < 100 && notInspected > 0 ? `
        <button class="btn btn-sm btn-outline-primary rounded-pill ms-auto px-3 py-0" onclick="navigateTo('inspection')" style="font-size:.72rem;">
          Mulai <i class="bi bi-chevron-right"></i>
        </button>` : ''}
      </div>
    </div>

    <!-- ── EKSPIRASI & REMINDER ── -->
    ${(expiredNow.length > 0 || expiringSoon.length > 0) ? `
    <div class="list-card mb-3 p-3" style="border-left:4px solid var(--critical);">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold text-navy small">
          <i class="bi bi-calendar-x text-danger me-1"></i>Perhatian Ekspirasi
        </span>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-0" onclick="navigateTo('reminder')" style="font-size:.72rem;">
          Lihat semua
        </button>
      </div>
      ${expiredNow.length > 0 ? `
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="badge bg-danger rounded-pill">${expiredNow.length}</span>
          <span class="small text-danger fw-bold">APAR sudah expired</span>
        </div>` : ''}
      ${expiringSoon.length > 0 ? `
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-warning rounded-pill">${expiringSoon.length}</span>
          <span class="small text-warning fw-bold">Akan expired dalam ${REMINDER_CONFIG.warningDays} hari</span>
        </div>` : ''}
    </div>` : `
    <div class="list-card mb-3 p-3" style="border-left:4px solid var(--good);">
      <div class="small text-success fw-bold">
        <i class="bi bi-calendar-check me-1"></i>Semua APAR belum ada yang expired dalam ${REMINDER_CONFIG.warningDays} hari ke depan
      </div>
    </div>`}

    <!-- ── BREAKDOWN JENIS ── -->
    ${Object.keys(jenisCounts).length > 0 ? `
    <div class="list-card mb-3 p-3">
      <div class="fw-bold text-navy small mb-2">
        <i class="bi bi-fire text-orange me-1"></i>Komposisi Jenis APAR Aktif
      </div>
      ${Object.entries(jenisCounts).map(([jenis, count]) => {
        const pct = total > 0 ? Math.round((count/total)*100) : 0;
        const colors = { 'CO2': 'var(--navy)', 'Dry Powder': 'var(--warning)', 'Foam': 'var(--good)' };
        const c = colors[jenis] || 'var(--orange)';
        return `
        <div class="mb-2">
          <div class="d-flex justify-content-between mb-1">
            <span class="small text-navy">${jenis}</span>
            <span class="small text-muted">${count} unit (${pct}%)</span>
          </div>
          <div class="dash-progress-track">
            <div class="dash-progress-fill" style="width:${pct}%;background:${c};"></div>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- ── APAR CRITICAL ── -->
    <div class="section-heading mt-1">
      <i class="bi bi-exclamation-triangle text-orange"></i>
      Perlu Tindakan Segera
    </div>
    ${renderCriticalAparList()}

    <!-- ── QUICK ACTIONS ── -->
    <div class="section-heading mt-3">
      <i class="bi bi-lightning-charge text-orange"></i>
      Quick Actions
    </div>
    <div class="row g-2 mb-4">
      <div class="col-6">
        <button class="dash-qa-btn" onclick="navigateTo('inspection')">
          <i class="bi bi-clipboard-check fs-4"></i>
          <span>Mulai Inspeksi</span>
        </button>
      </div>
      <div class="col-6">
        <button class="dash-qa-btn" onclick="navigateTo('reminder')">
          <i class="bi bi-bell fs-4"></i>
          <span>Lihat Reminder</span>
          ${(expiredNow.length + expiringSoon.length) > 0 ? `<span class="dash-qa-badge">${expiredNow.length + expiringSoon.length}</span>` : ''}
        </button>
      </div>
      <div class="col-6">
        <button class="dash-qa-btn" onclick="navigateTo('master')">
          <i class="bi bi-plus-circle fs-4"></i>
          <span>Tambah APAR</span>
        </button>
      </div>
      <div class="col-6">
        <button class="dash-qa-btn" onclick="navigateTo('monitoring')">
          <i class="bi bi-graph-up fs-4"></i>
          <span>Monitor Status</span>
        </button>
      </div>
    </div>

    ${total === 0 ? renderEmptyState(
      'bi-shield-plus',
      'Belum ada APAR Aktif',
      'Tambahkan data APAR di menu Master',
      { text: 'Tambah APAR', icon: 'bi-plus-lg', action: "navigateTo('master')" }
    ) : ''}
  `;
}

/** Donut chart SVG distribusi status */
function _renderDonutChart({ good, warning, critical, replaceRequired }, total) {
  const cx = 52, cy = 52, r = 38, stroke = 13;
  const circ = 2 * Math.PI * r;

  const segments = [
    { val: good,            color: '#10b981' },
    { val: warning,         color: '#f59e0b' },
    { val: critical,        color: '#ef4444' },
    { val: replaceRequired, color: '#8b5cf6' },
  ];

  let offset = 0;
  // rotate so first segment starts at top
  const startAngle = -90;

  const paths = segments.map(seg => {
    if (seg.val === 0) return '';
    const pct  = seg.val / total;
    const dash = pct * circ;
    const gap  = circ - dash;
    const rotate = startAngle + (offset / total) * 360;
    offset += seg.val;
    return `<circle
      cx="${cx}" cy="${cy}" r="${r}"
      fill="none"
      stroke="${seg.color}"
      stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      transform="rotate(${rotate} ${cx} ${cy})"
      stroke-linecap="butt"
    />`;
  }).join('');

  return `
    <svg viewBox="0 0 104 104" width="90" height="90" style="filter:drop-shadow(0 4px 12px rgba(0,0,0,.25));">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="${stroke}"/>
      ${paths}
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="white" font-size="17" font-weight="800" font-family="Inter,sans-serif">${total}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="rgba(255,255,255,.6)" font-size="7.5" font-weight="600" font-family="Inter,sans-serif" letter-spacing="1">AKTIF</text>
    </svg>`;
}

function renderCriticalAparList() {
  const criticalApars = aparData.filter(a =>
    a.operationalStatus === 'ACTIVE' &&
    (a.status === 'Critical' || a.status === 'Replace Required')
  );

  if (criticalApars.length === 0) {
    return `
      <div class="text-center py-3">
        <i class="bi bi-check-circle fs-3 text-success d-block mb-2"></i>
        <p class="text-muted small mb-0">Tidak ada APAR critical saat ini ✅</p>
      </div>`;
  }

  return criticalApars.map((a, i) => {
    const expDate  = parseExpRefill(a.expRefill);
    const today    = new Date(); today.setHours(0,0,0,0);
    const diffDays = isNaN(expDate.getTime()) ? null : Math.ceil((expDate - today) / 86400000);
    const expStr   = diffDays === null ? '' : diffDays < 0 ? `Expired ${Math.abs(diffDays)} hari lalu` : `Exp: ${a.expRefill}`;

    return `
    <div class="list-card" style="border-left:4px solid var(--${a.status==='Critical'?'critical':'replace'}); animation-delay:${i*0.04}s;">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong class="text-navy">${a.id}</strong>
          <div class="small text-muted mt-1"><i class="bi bi-geo-alt me-1"></i>${a.lokasi}</div>
          ${expStr ? `<div class="small text-danger mt-1"><i class="bi bi-calendar-x me-1"></i>${expStr}</div>` : ''}
        </div>
        <div class="d-flex flex-column align-items-end gap-1">
          <span class="status-badge ${getStatusBadgeClass(a.status)}">
            <i class="bi ${a.status==='Critical'?'bi-exclamation-octagon':'bi-arrow-repeat'} me-1"></i>${a.status}
          </span>
          <span class="badge bg-light text-navy" style="font-size:.65rem;">${a.jenis} · ${a.kapasitas}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

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
    </div>
    
    <div id="masterList">
      ${renderMasterList()}
    </div>
    
    ${aparData.length === 0 ? renderEmptyState(
      'bi-database',
      'Database kosong',
      'Tambahkan APAR pertama Anda'
    ) : ''}
    
    <button class="fab-master" onclick="openAddForm()" id="fabMasterBtn">
      <i class="bi bi-plus-lg"></i>
    </button>
  `;
}

function renderMasterList(filteredData = null) {
  const data = filteredData || aparData;
  if (data.length === 0) return '';
  
  return data.map((a, index) => {
    const opStatus = OPERATIONAL_STATUS[a.operationalStatus] || OPERATIONAL_STATUS.ACTIVE;
    return `
    <div class="list-card" data-id="${a.id}" style="animation-delay: ${index * 0.03}s;">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <strong class="text-navy">${a.id}</strong>
          <div class="small text-muted mt-1">
            <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
          </div>
        </div>
        <div class="d-flex flex-column align-items-end gap-1">
          <span class="status-badge ${getStatusBadgeClass(a.status)}">
            <i class="bi ${getStatusIcon(a.status)} me-1"></i>${a.status}
          </span>
          <span class="op-status-badge ${opStatus.badge}" onclick="event.stopPropagation(); openOperationalStatusModal('${a.id}')" style="cursor: pointer;">
            <i class="bi ${opStatus.icon} me-1"></i>${opStatus.label}
          </span>
        </div>
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
        <button class="btn btn-sm btn-outline-warning rounded-pill" onclick="event.stopPropagation(); openOperationalStatusModal('${a.id}')">
          <i class="bi bi-arrow-repeat me-1"></i> Status
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="event.stopPropagation(); deleteApar('${a.id}')">
          <i class="bi bi-trash me-1"></i> Hapus
        </button>
      </div>
    </div>
  `}).join('');
}

function filterMaster(query) {
  const list = document.getElementById('masterList');
  if (!list) return;
  
  if (!query || query.trim() === '') {
    list.innerHTML = renderMasterList();
    return;
  }
  
  const q = query.toLowerCase().trim();
  const filtered = aparData.filter(a => {
    return a.id.toLowerCase().includes(q) ||
           a.lokasi.toLowerCase().includes(q) ||
           a.jenis.toLowerCase().includes(q) ||
           a.kelas.toLowerCase().includes(q) ||
           a.kapasitas.toLowerCase().includes(q);
  });
  
  list.innerHTML = renderMasterList(filtered);
}

function openOperationalStatusModal(aparId) {
  const apar = aparData.find(a => a.id === aparId);
  if (!apar) return;
  
  const currentStatus = apar.operationalStatus || 'ACTIVE';
  
  const modalHtml = `
    <div class="modal fade" id="opStatusModal" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border-radius: var(--radius-lg);">
          <div class="modal-header border-0" style="background: linear-gradient(135deg, var(--navy), var(--navy-light));">
            <h6 class="modal-title text-white"><i class="bi bi-arrow-repeat me-2"></i>Ubah Status Operasional</h6>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <strong class="text-navy">${apar.id}</strong>
              <div class="small text-muted">${apar.lokasi}</div>
            </div>
            
            <div class="mb-3">
              <label class="form-label-custom">Status Saat Ini</label>
              <div class="p-2 rounded bg-light">
                <span class="op-status-badge ${OPERATIONAL_STATUS[currentStatus]?.badge}">
                  <i class="bi ${OPERATIONAL_STATUS[currentStatus]?.icon} me-1"></i>
                  ${OPERATIONAL_STATUS[currentStatus]?.label}
                </span>
              </div>
            </div>
            
            <div class="mb-2">
              <label class="form-label-custom">Ubah Ke</label>
              <div class="d-flex flex-column gap-2">
                ${OPERATIONAL_STATUS_LIST.map(status => `
                  <button class="btn btn-outline-secondary d-flex justify-content-between align-items-center p-3 op-status-option" 
                          data-status="${status}"
                          onclick="selectOperationalStatus('${aparId}', '${status}')"
                          style="border-radius: var(--radius-sm); text-align: left;">
                    <div>
                      <i class="bi ${OPERATIONAL_STATUS[status].icon} me-2 fs-5"></i>
                      <strong>${OPERATIONAL_STATUS[status].label}</strong>
                      <div class="small text-muted mt-1">
                        ${status === 'ACTIVE' ? 'APAR terpasang, perlu inspeksi rutin' : 
                          status === 'BACKUP' ? 'APAR cadangan, tidak perlu inspeksi rutin' :
                          status === 'MAINTENANCE' ? 'APAR sedang dalam perbaikan' :
                          'APAR sudah tidak digunakan'}
                      </div>
                    </div>
                    <i class="bi bi-chevron-right text-muted"></i>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-outline-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('opStatusModal');
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = new bootstrap.Modal(document.getElementById('opStatusModal'));
  modal.show();
  
  document.getElementById('opStatusModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

async function selectOperationalStatus(aparId, newStatus) {
  const modal = bootstrap.Modal.getInstance(document.getElementById('opStatusModal'));
  if (modal) modal.hide();
  
  showToast('🔄 Mengubah status operasional...', 'info');
  const success = await updateAparOperationalStatus(aparId, newStatus);
  
  if (success) {
    await fetchFromGoogleSheets();
    if (!currentInspectingApar && !editMode) {
      renderPage(currentPage);
    }
  }
}

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
  
  const kelasOptions = ['BC', 'ABC'];
  const jenisOptions = ['CO2', 'Dry Powder', 'Foam'];
  const currentOpStatus = apar ? (apar.operationalStatus || 'ACTIVE') : 'ACTIVE';
  
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
                  ${renderSelectOptions(jenisOptions, apar?.jenis)}
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
                  ${renderSelectOptions(kelasOptions, apar?.kelas)}
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
          
          <div class="mb-3">
            <label class="form-label-custom">Status Operasional</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-archive text-muted"></i>
              </span>
              <select class="form-select border-start-0" name="operationalStatus">
                ${OPERATIONAL_STATUS_LIST.map(status => `
                  <option value="${status}" ${currentOpStatus === status ? 'selected' : ''}>
                    ${OPERATIONAL_STATUS[status].label}
                  </option>
                `).join('')}
              </select>
            </div>
            <small class="text-muted mt-1 d-block">
              <i class="bi bi-info-circle me-1"></i>
              APAR dengan status Backup/Maintenance tidak perlu diinspeksi rutin
            </small>
          </div>
          
          <div class="mb-4">
            <label class="form-label-custom">Status (Otomatis)</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0">
                <i class="bi bi-robot text-muted"></i>
              </span>
              <input type="text" class="form-control border-start-0" 
                     value="${apar ? apar.status : 'Akan dihitung otomatis'}" readonly disabled style="background-color: #f0f4f8;">
            </div>
            <small class="text-muted mt-1 d-block">Status akan dihitung otomatis berdasarkan expired date dan hasil inspeksi</small>
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
  
  const tempStatus = 'Good';
  
  const data = {
    id: formData.get('id'),
    lokasi: formData.get('lokasi'),
    jenis: formData.get('jenis'),
    kelas: formData.get('kelas'),
    kapasitas: formData.get('kapasitas'),
    expRefill: inputValueToExpRefill(formData.get('expRefill')),
    status: tempStatus,
    operationalStatus: formData.get('operationalStatus') || 'ACTIVE'
  };

  if (!data.id || !data.lokasi || !data.jenis || !data.kelas || !data.kapasitas || !data.expRefill) {
    showToast('⚠️ Semua field harus diisi', 'warning');
    return;
  }

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

  const newStatus = calculateAutoStatus(data);
  data.status = newStatus;
  
  const index = aparData.findIndex(a => a.id === data.id);
  if (index !== -1) aparData[index].status = newStatus;

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
        const fabBtn = document.getElementById('fabMasterBtn');
        if (fabBtn) fabBtn.onclick = () => openAddForm();
      }, 500);
    } else {
      const app = document.getElementById('app');
      app.innerHTML = renderMaster();
    }
    
    showToast(`✅ ${data.id} berhasil ${aparId ? 'diupdate' : 'ditambahkan'} dengan status ${newStatus}`, 'success');
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
    `Jenis: ${apar.jenis}\n` +
    `Status Operasional: ${OPERATIONAL_STATUS[apar.operationalStatus]?.label}\n\n` +
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

let currentMonitorFilter = {
  lokasi: '',
  status: '',
  operationalStatus: ''
};

function renderMonitoring() {
  const lokasiList = [...new Set(aparData.map(a => a.lokasi.split(' ')[0]))];
  
  currentMonitorFilter = { lokasi: '', status: '', operationalStatus: '' };
  
  return `
    <div class="d-flex flex-column gap-3 mb-4">
      <div class="d-flex gap-2">
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
      <div>
        <div class="input-group">
          <span class="input-group-text bg-white border-end-0" style="border-radius: var(--radius-sm) 0 0 var(--radius-sm);">
            <i class="bi bi-archive text-muted"></i>
          </span>
          <select class="form-select border-start-0 border-end-0" onchange="applyMonitorFilter()" id="monitorFilterOpStatus" style="border-radius: 0;">
            <option value="">Semua Status Operasional</option>
            ${OPERATIONAL_STATUS_LIST.map(status => `
              <option value="${status}">${OPERATIONAL_STATUS[status].label}</option>
            `).join('')}
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
  
  if (currentMonitorFilter.operationalStatus) {
    filteredData = filteredData.filter(a => 
      a.operationalStatus === currentMonitorFilter.operationalStatus
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
  
  return filteredData.map((a, index) => {
    const opStatus = OPERATIONAL_STATUS[a.operationalStatus] || OPERATIONAL_STATUS.ACTIVE;
    return `
    <div class="list-card" data-lokasi="${a.lokasi.split(' ')[0]}" data-status="${a.status}" style="animation-delay: ${index * 0.03}s;">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <strong class="text-navy">${a.id}</strong>
        <div class="d-flex gap-1">
          <span class="op-status-badge ${opStatus.badge} small">
            <i class="bi ${opStatus.icon} me-1"></i>${opStatus.label}
          </span>
          <span class="status-badge ${getStatusBadgeClass(a.status)}">
            <i class="bi ${getStatusIcon(a.status)} me-1"></i>${a.status}
          </span>
        </div>
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
  `}).join('');
}

function applyMonitorFilter() {
  const lokasiSelect = document.getElementById('monitorFilterLokasi');
  const statusSelect = document.getElementById('monitorFilterStatus');
  const opStatusSelect = document.getElementById('monitorFilterOpStatus');
  
  currentMonitorFilter.lokasi = lokasiSelect ? lokasiSelect.value : '';
  currentMonitorFilter.status = statusSelect ? statusSelect.value : '';
  currentMonitorFilter.operationalStatus = opStatusSelect ? opStatusSelect.value : '';
  
  const monitorList = document.getElementById('monitorList');
  if (monitorList) {
    monitorList.innerHTML = renderMonitorList();
  }
}

function renderReminder() {
  const today = new Date();
  let reminders = aparData.filter(a => {
    if (!REMINDER_CONFIG.includeBackupInReminder && a.operationalStatus === 'BACKUP') {
      return false;
    }
    if (a.operationalStatus === 'RETIRED') return false;
    
    const expDate = parseExpRefill(a.expRefill);
    if (isNaN(expDate.getTime())) return false;
    
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
  
  const activeReminders = reminders.filter(a => a.operationalStatus === 'ACTIVE');
  const backupReminders = reminders.filter(a => a.operationalStatus === 'BACKUP');
  const maintenanceReminders = reminders.filter(a => a.operationalStatus === 'MAINTENANCE');
  
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
    
    ${activeReminders.length > 0 ? `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-play-circle-fill text-success"></i>
          <span class="fw-bold text-navy">APAR Aktif</span>
          <span class="badge bg-danger rounded-pill">${activeReminders.length}</span>
        </div>
        ${renderReminderList(activeReminders, today)}
      </div>
    ` : ''}
    
    ${backupReminders.length > 0 && REMINDER_CONFIG.includeBackupInReminder ? `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-archive text-secondary"></i>
          <span class="fw-bold text-navy">APAR Backup</span>
          <span class="badge bg-secondary rounded-pill">${backupReminders.length}</span>
        </div>
        ${renderReminderList(backupReminders, today)}
      </div>
    ` : ''}
    
    ${maintenanceReminders.length > 0 ? `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-tools text-warning"></i>
          <span class="fw-bold text-navy">APAR Maintenance</span>
          <span class="badge bg-warning rounded-pill">${maintenanceReminders.length}</span>
        </div>
        ${renderReminderList(maintenanceReminders, today)}
      </div>
    ` : ''}
    
    ${reminders.length === 0 ? renderEmptyState(
      'bi-bell',
      'Tidak ada reminder',
      'Semua APAR dalam kondisi baik ✅'
    ) : ''}
  `;
}

function renderReminderList(reminders, today) {
  if (reminders.length === 0) return '';
  
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
      ? `Lewat ${Math.abs(diffDays)} hari`
      : `${diffDays} hari lagi`;
    
    const opStatus = OPERATIONAL_STATUS[a.operationalStatus] || OPERATIONAL_STATUS.ACTIVE;
    
    return `
      <div class="list-card mb-3" style="border-left: 4px solid var(--${alertConfig.borderClass === 'border-danger' ? 'critical' : alertConfig.borderClass === 'border-warning' ? 'warning' : 'info'}); animation-delay: ${index * 0.03}s;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <strong class="text-navy">${a.id}</strong>
            <div class="small text-muted mt-1">
              <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
            </div>
          </div>
          <div class="d-flex gap-1">
            <span class="op-status-badge ${opStatus.badge} small">
              <i class="bi ${opStatus.icon} me-1"></i>${opStatus.label}
            </span>
            <span class="badge ${alertConfig.bgClass} text-white rounded-pill">
              <i class="bi ${alertConfig.icon} me-1"></i>${alertConfig.alertText}
            </span>
          </div>
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
    'Replace Required': 'badge-replace',
    'Backup': 'badge-backup',
    'Retired': 'badge-retired'
  };
  return mapping[status] || 'badge-good';
}

function getStatusIcon(status) {
  const mapping = {
    'Good': 'bi-check-circle',
    'Warning': 'bi-exclamation-triangle',
    'Critical': 'bi-exclamation-octagon',
    'Replace Required': 'bi-arrow-repeat',
    'Backup': 'bi-archive',
    'Retired': 'bi-x-circle'
  };
  return mapping[status] || 'bi-question-circle';
}

function showToast(msg, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  
  const icons = {
    success: 'bi-check-circle',
    danger: 'bi-x-circle',
    warning: 'bi-exclamation-triangle',
    info: 'bi-info-circle'
  };
  
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