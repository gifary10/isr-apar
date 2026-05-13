// State navigasi
let currentPage = 'dashboard';
let currentInspectingApar = null;
let editMode = null;

// Data form yang belum disimpan (untuk peringatan)
let hasUnsavedFormChanges = false;

/**
 * Navigasi ke halaman tertentu
 */
function navigateTo(page) {
  // Cek apakah user sedang mengedit dan ada perubahan
  if (currentInspectingApar && hasUnsavedInspectionChanges(currentInspectingApar)) {
    if (!confirm('⚠️ Anda memiliki checklist yang belum disimpan. Yakin ingin meninggalkan halaman?')) {
      return;
    }
  }
  
  if (editMode && hasUnsavedFormChanges) {
    if (!confirm('⚠️ Anda memiliki form yang belum disimpan. Yakin ingin meninggalkan halaman?')) {
      return;
    }
  }
  
  if (!isDataLoaded && page !== 'dashboard') {
    showToast('⏳ Menunggu data selesai dimuat...', 'warning');
    return;
  }
  
  // Hapus event listener beforeunload jika ada
  window.removeEventListener('beforeunload', warnBeforeLeaveInspection);
  
  // Hapus active class dari semua nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
  });
  
  // Tambahkan active class ke nav item yang dituju
  const targetNav = document.querySelector(`[data-page="${page}"]`);
  if (targetNav) {
    targetNav.classList.add('active');
    
    // Efek pulse pada icon
    const icon = targetNav.querySelector('i');
    if (icon) {
      icon.style.transform = 'scale(1.2)';
      setTimeout(() => {
        icon.style.transform = '';
      }, 200);
    }
  }
  
  // Update state
  currentPage = page;
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || 'ISR APAR';
  document.getElementById('backBtn').classList.add('d-none');
  currentInspectingApar = null;
  editMode = null;
  hasUnsavedFormChanges = false;
  
  // Render halaman dengan animasi
  const app = document.getElementById('app');
  if (app) {
    app.style.opacity = '0';
    app.style.transform = 'translateY(10px)';
    app.style.transition = 'all 0.2s ease';
    
    renderPage(page);
    
    requestAnimationFrame(() => {
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
    });
  } else {
    renderPage(page);
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Kembali ke halaman sebelumnya
 */
function goBack() {
  if (currentInspectingApar) {
    // Kembali dari form inspeksi ke list inspeksi
    if (hasUnsavedInspectionChanges(currentInspectingApar)) {
      if (!confirm('⚠️ Anda memiliki checklist yang belum disimpan. Yakin ingin kembali?')) {
        return;
      }
    }
    
    window.removeEventListener('beforeunload', warnBeforeLeaveInspection);
    
    currentInspectingApar = null;
    document.getElementById('backBtn').classList.add('d-none');
    document.getElementById('pageTitle').textContent = PAGE_TITLES['inspection'] || 'Inspeksi Bulanan';
    
    // Render ulang list inspeksi dengan animasi
    const app = document.getElementById('app');
    app.style.opacity = '0';
    app.style.transform = 'translateY(10px)';
    app.style.transition = 'all 0.2s ease';
    app.innerHTML = renderInspectionList();
    
    requestAnimationFrame(() => {
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
    });
  } else if (editMode) {
    // Kembali dari form edit ke master list
    if (hasUnsavedFormChanges) {
      if (!confirm('⚠️ Anda memiliki perubahan yang belum disimpan. Yakin ingin kembali?')) {
        return;
      }
    }
    
    editMode = null;
    hasUnsavedFormChanges = false;
    document.getElementById('backBtn').classList.add('d-none');
    document.getElementById('pageTitle').textContent = PAGE_TITLES['master'] || 'Master APAR';
    
    // Render ulang master list
    const app = document.getElementById('app');
    app.style.opacity = '0';
    app.style.transform = 'translateY(10px)';
    app.style.transition = 'all 0.2s ease';
    app.innerHTML = renderMaster();
    
    requestAnimationFrame(() => {
      app.style.opacity = '1';
      app.style.transform = 'translateY(0)';
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Router halaman - memanggil fungsi render yang sesuai
 */
function renderPage(page) {
  const app = document.getElementById('app');
  if (!app) return;
  
  let content = '';
  
  switch(page) {
    case 'dashboard':
      content = renderDashboard();
      break;
    case 'master':
      content = renderMaster();
      break;
    case 'inspection':
      content = renderInspectionList();
      break;
    case 'monitoring':
      content = renderMonitoring();
      break;
    case 'reminder':
      content = renderReminder();
      break;
    default:
      content = renderDashboard();
  }
  
  app.innerHTML = content;
}

/**
 * Handle navigasi dengan keyboard (aksesibilitas)
 */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (currentInspectingApar || editMode) {
      goBack();
    }
  }
});

/**
 * Handle swipe gesture untuk navigasi mobile
 */
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  const swipeThreshold = 100;
  const diff = touchEndX - touchStartX;
  
  if (Math.abs(diff) < swipeThreshold) return;
  
  // Swipe kanan -> back
  if (diff > 0 && (currentInspectingApar || editMode)) {
    goBack();
  }
}