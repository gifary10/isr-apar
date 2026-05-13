function renderInspectionList() {
  // Hanya APAR dengan status operasional ACTIVE yang perlu diinspeksi
  const inspectableApars = aparData.filter(a => 
    OPERATIONAL_STATUS[a.operationalStatus]?.inspectable !== false
  );
  const total = inspectableApars.length;
  const belumInspeksi = inspectableApars.filter(a => !inspectionThisMonth.includes(a.id));
  const sudahInspeksi = inspectableApars.filter(a => inspectionThisMonth.includes(a.id));
  
  // Hitung APAR yang di-exclude dari inspeksi
  const excludedCount = aparData.length - inspectableApars.length;
  const excludedApars = aparData.filter(a => 
    OPERATIONAL_STATUS[a.operationalStatus]?.inspectable === false
  );
  
  return `
    <div class="row g-3 mb-4">
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">APAR Perlu Inspeksi</div>
          <div class="stat-value">${total}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-card">
          <div class="stat-label">Belum Inspeksi</div>
          <div class="stat-value text-danger">${belumInspeksi.length}</div>
        </div>
      </div>
    </div>
    
    ${excludedCount > 0 ? `
      <div class="alert alert-secondary d-flex align-items-center gap-2 mb-3" style="border-radius: var(--radius);">
        <i class="bi bi-info-circle fs-5"></i>
        <div class="small">
          <strong>${excludedCount} APAR tidak perlu diinspeksi</strong><br>
          ${excludedApars.map(a => `${a.id} (${OPERATIONAL_STATUS[a.operationalStatus]?.label})`).join(', ')}
        </div>
      </div>
    ` : ''}
    
    ${total === 0 ? renderEmptyState(
      'bi-clipboard-check',
      'Tidak ada APAR yang perlu diinspeksi',
      'Semua APAR memiliki status operasional Backup/Maintenance/Retired'
    ) : `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold mb-0 text-navy">
          <i class="bi bi-exclamation-circle text-orange me-2"></i>Belum Diinspeksi
        </h6>
        <span class="badge bg-danger rounded-pill">${belumInspeksi.length} APAR</span>
      </div>
      ${renderBelumInspeksiList(belumInspeksi)}
      
      <div class="d-flex justify-content-between align-items-center mb-3 mt-4">
        <h6 class="fw-bold mb-0 text-navy">
          <i class="bi bi-check-circle text-success me-2"></i>Sudah Diinspeksi
        </h6>
        <span class="badge bg-success rounded-pill">${sudahInspeksi.length} APAR</span>
      </div>
      ${renderSudahInspeksiList(sudahInspeksi)}
      
      ${belumInspeksi.length === 0 && total > 0 ? renderAllInspectedMessage() : ''}
    `}
  `;
}

function renderBelumInspeksiList(list) {
  if (list.length === 0) {
    return `
      <div class="text-center py-4">
        <i class="bi bi-emoji-smile fs-2 text-success d-block mb-2"></i>
        <p class="text-muted">Semua APAR sudah diinspeksi. 😊</p>
      </div>
    `;
  }
  
  return list.map(a => {
    const opStatus = OPERATIONAL_STATUS[a.operationalStatus] || OPERATIONAL_STATUS.ACTIVE;
    return `
    <div class="list-card clickable" onclick="openInspectionForm('${a.id}')">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong class="text-navy">${a.id}</strong>
          <div class="small text-muted mt-1">
            <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
          </div>
          <div class="d-flex gap-1 mt-1">
            <span class="badge bg-light text-navy mt-1">${a.jenis} • ${a.kapasitas}</span>
            <span class="op-status-badge ${opStatus.badge} mt-1">
              <i class="bi ${opStatus.icon} me-1"></i>${opStatus.label}
            </span>
          </div>
        </div>
        <div class="text-end">
          <span class="status-badge badge-not-inspected">Belum</span>
          <div class="mt-2">
            <i class="bi bi-chevron-right text-muted"></i>
          </div>
        </div>
      </div>
    </div>
  `}).join('');
}

function renderSudahInspeksiList(list) {
  if (list.length === 0) {
    return `
      <div class="text-center py-3">
        <p class="text-muted small">Belum ada APAR yang diinspeksi bulan ini.</p>
      </div>
    `;
  }
  
  return list.map(a => {
    const opStatus = OPERATIONAL_STATUS[a.operationalStatus] || OPERATIONAL_STATUS.ACTIVE;
    return `
    <div class="list-card" style="border-left: 4px solid var(--good);">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong class="text-navy">${a.id}</strong>
          <div class="small text-muted mt-1">
            <i class="bi bi-geo-alt me-1"></i>${a.lokasi}
          </div>
          <div class="d-flex gap-1 mt-1">
            <span class="badge bg-light text-navy mt-1">${a.jenis} • ${a.kapasitas}</span>
            <span class="op-status-badge ${opStatus.badge} mt-1">
              <i class="bi ${opStatus.icon} me-1"></i>${opStatus.label}
            </span>
          </div>
        </div>
        <span class="status-badge badge-inspected">
          <i class="bi bi-check2-circle me-1"></i>Selesai
        </span>
      </div>
    </div>
  `}).join('');
}

function renderAllInspectedMessage() {
  return renderEmptyState(
    'bi-check-circle-fill',
    'Semua APAR sudah diinspeksi!',
    'Inspeksi bulan ini selesai. ✅'
  );
}

function openInspectionForm(aparId) {
  currentInspectingApar = aparId;
  const apar = aparData.find(a => a.id === aparId);
  
  if (!apar) {
    showToast('APAR tidak ditemukan', 'danger');
    return;
  }
  
  // Cek apakah APAR boleh diinspeksi
  if (OPERATIONAL_STATUS[apar.operationalStatus]?.inspectable === false) {
    showToast(`⚠️ ${apar.id} memiliki status ${OPERATIONAL_STATUS[apar.operationalStatus]?.label} dan tidak perlu diinspeksi.`, 'warning');
    return;
  }
  
  const checklist = getChecklist(apar.jenis);
  const savedData = inspectionDetails[aparId] || {};
  
  document.getElementById('backBtn').classList.remove('d-none');
  document.getElementById('pageTitle').textContent = `Inspeksi ${aparId}`;
  
  const app = document.getElementById('app');
  app.innerHTML = renderInspectionForm(apar, checklist, savedData);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  window.addEventListener('beforeunload', warnBeforeLeaveInspection);
}

function renderInspectionForm(apar, checklist, savedData) {
  const opStatus = OPERATIONAL_STATUS[apar.operationalStatus] || OPERATIONAL_STATUS.ACTIVE;
  
  return `
    <div class="card shadow-sm border-0 mb-4" style="border-radius: var(--radius-lg); overflow: hidden;">
      <div class="card-body p-3" style="background: linear-gradient(135deg, var(--navy), var(--navy-light));">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 class="text-white mb-1">${apar.id}</h6>
            <div class="small text-white-50">
              <i class="bi bi-geo-alt me-1"></i>${apar.lokasi}
            </div>
          </div>
          <div class="d-flex flex-column align-items-end gap-1">
            <span class="status-badge ${getStatusBadgeClass(apar.status)}">${apar.status}</span>
            <span class="op-status-badge ${opStatus.badge}">
              <i class="bi ${opStatus.icon} me-1"></i>${opStatus.label}
            </span>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <span class="badge bg-light text-navy">
            <i class="bi bi-fire me-1"></i>${apar.jenis}
          </span>
          <span class="badge bg-light text-navy">
            <i class="bi bi-layers me-1"></i>Kelas ${apar.kelas}
          </span>
          <span class="badge bg-light text-navy">
            <i class="bi bi-box me-1"></i>${apar.kapasitas}
          </span>
          <span class="badge bg-light text-navy">
            <i class="bi bi-calendar me-1"></i>Exp: ${apar.expRefill}
          </span>
        </div>
      </div>
    </div>
    
    <div class="mb-4">
      <div class="d-flex align-items-center mb-3">
        <i class="bi bi-clipboard-check text-orange me-2 fs-5"></i>
        <h6 class="fw-bold text-navy mb-0">Checklist Inspeksi ${apar.jenis}</h6>
      </div>
      
      <div class="table-responsive" style="border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-sm);">
        <table class="checklist-table">
          <thead>
            <tr>
              <th style="width: 50%;">Item Pemeriksaan</th>
              <th style="width: 25%; text-align: center;">Standar</th>
              <th style="width: 25%; text-align: center;">Tidak Standar</th>
            </tr>
          </thead>
          <tbody>
            ${renderChecklistItems(checklist, savedData, apar.id)}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="mb-4">
      <div class="d-flex align-items-center mb-2">
        <i class="bi bi-pencil text-orange me-2"></i>
        <label class="form-label-custom mb-0">Catatan</label>
      </div>
      <textarea class="form-control" rows="3" placeholder="Catatan khusus untuk ${apar.id}..." 
                onchange="saveNote('${apar.id}', this.value)"
                style="border-radius: var(--radius);">${savedData['_note'] || ''}</textarea>
    </div>
    
    <div class="mb-4">
      <button class="btn btn-primary btn-xl w-100 shadow" onclick="submitSingleInspection('${apar.id}')">
        <i class="bi bi-check2-circle me-2"></i>Simpan Inspeksi ${apar.id}
      </button>
    </div>
  `;
}

function renderChecklistItems(checklist, savedData, aparId) {
  return checklist.map(item => {
    const val = savedData[item.id] || '';
    return `
      <tr>
        <td>
          <div class="item-name">
            <i class="${item.icon} text-orange me-2"></i>${item.label}
          </div>
          <div class="item-desc">${item.desc}</div>
        </td>
        <td style="text-align: center;">
          <label class="custom-checkbox d-flex align-items-center justify-content-center gap-2">
            <input type="checkbox" name="${item.id}" value="standar" 
                   ${val === 'standar' ? 'checked' : ''} 
                   onchange="handleCheckboxChange('${aparId}', '${item.id}', 'standar', this)">
            <span class="checkbox-label-standar">Standar</span>
          </label>
        </td>
        <td style="text-align: center;">
          <label class="custom-checkbox d-flex align-items-center justify-content-center gap-2">
            <input type="checkbox" name="${item.id}" value="tidak_standar" 
                   ${val === 'tidak_standar' ? 'checked' : ''} 
                   onchange="handleCheckboxChange('${aparId}', '${item.id}', 'tidak_standar', this)">
            <span class="checkbox-label-tidak-standar">Tidak Standar</span>
          </label>
        </td>
      </tr>
    `;
  }).join('');
}

function handleCheckboxChange(aparId, itemId, value, checkbox) {
  if (!inspectionDetails[aparId]) {
    inspectionDetails[aparId] = {};
  }
  
  if (checkbox.checked) {
    inspectionDetails[aparId][itemId] = value;
    
    const row = checkbox.closest('tr');
    const otherValue = value === 'standar' ? 'tidak_standar' : 'standar';
    const otherCheckbox = row.querySelector(`input[value="${otherValue}"]`);
    if (otherCheckbox) {
      otherCheckbox.checked = false;
    }
  } else {
    delete inspectionDetails[aparId][itemId];
  }
}

function saveNote(aparId, note) {
  if (!inspectionDetails[aparId]) {
    inspectionDetails[aparId] = {};
  }
  inspectionDetails[aparId]['_note'] = note;
}

function hasUnsavedInspectionChanges(aparId) {
  if (!currentInspectingApar) return false;
  
  const data = inspectionDetails[aparId] || {};
  const hasChecklist = Object.keys(data).some(key => key !== '_note' && data[key]);
  const hasNote = (data['_note'] || '').length > 0;
  
  return hasChecklist || hasNote;
}

function warnBeforeLeaveInspection(event) {
  if (currentInspectingApar && hasUnsavedInspectionChanges(currentInspectingApar)) {
    event.preventDefault();
    event.returnValue = 'Anda memiliki perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
    return event.returnValue;
  }
}

async function submitSingleInspection(aparId) {
  const apar = aparData.find(a => a.id === aparId);
  if (!apar) {
    showToast('APAR tidak ditemukan', 'danger');
    return;
  }
  
  // Cek apakah APAR boleh diinspeksi
  if (OPERATIONAL_STATUS[apar.operationalStatus]?.inspectable === false) {
    showToast(`⚠️ ${apar.id} memiliki status ${OPERATIONAL_STATUS[apar.operationalStatus]?.label} dan tidak perlu diinspeksi.`, 'warning');
    return;
  }
  
  const checklist = getChecklist(apar.jenis);
  const data = inspectionDetails[aparId] || {};
  
  const uncheckedItems = checklist.filter(item => !data[item.id]);
  if (uncheckedItems.length > 0) {
    const itemNames = uncheckedItems.map(i => i.label).join(', ');
    showToast(`⚠️ Lengkapi semua item: ${itemNames}`, 'warning');
    return;
  }
  
  let standarCount = 0;
  let tidakStandarCount = 0;
  checklist.forEach(item => {
    if (data[item.id] === 'standar') standarCount++;
    if (data[item.id] === 'tidak_standar') tidakStandarCount++;
  });
  
  showToast('🔄 Menyimpan inspeksi...', 'info');
  
  if (!inspectionThisMonth.includes(aparId)) {
    inspectionThisMonth.push(aparId);
  }
  
  const note = data['_note'] || '';
  const success = await pushInspectionToSheets(aparId, standarCount, tidakStandarCount, note);
  
  if (success) {
    await fetchInspectionFromSheets();
    
    // Update status otomatis berdasarkan hasil inspeksi
    const updatedApar = aparData.find(a => a.id === aparId);
    if (updatedApar) {
      const newStatus = calculateAutoStatus(updatedApar, inspectionDetails[aparId]);
      if (updatedApar.status !== newStatus) {
        updatedApar.status = newStatus;
        await pushAparToSheets(updatedApar);
        showToast(`📊 Status APAR berubah menjadi ${newStatus}`, 'info');
      }
    }
    
    let statusMessage = '';
    if (tidakStandarCount === 0) {
      statusMessage = '✅ Semua item standar!';
    } else if (tidakStandarCount <= 2) {
      statusMessage = `⚠️ ${tidakStandarCount} item perlu perhatian`;
    } else {
      statusMessage = `❌ ${tidakStandarCount} item tidak standar`;
    }
    
    window.removeEventListener('beforeunload', warnBeforeLeaveInspection);
    
    currentInspectingApar = null;
    document.getElementById('backBtn').classList.add('d-none');
    document.getElementById('pageTitle').textContent = PAGE_TITLES['inspection'] || 'Inspeksi Bulanan';
    
    const app = document.getElementById('app');
    app.style.opacity = '0';
    app.style.transform = 'translateY(10px)';
    app.style.transition = 'all 0.2s ease';
    app.innerHTML = renderInspectionList();
    
    requestAnimationFrame(() => {
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
    });
    
    showToast(`${aparId}: ${standarCount} Standar, ${tidakStandarCount} Tidak Standar. ${statusMessage}`, 
              tidakStandarCount === 0 ? 'success' : 'warning');
  } else {
    showToast('❌ Gagal menyimpan inspeksi', 'danger');
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}