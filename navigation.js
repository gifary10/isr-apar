// State navigasi
let currentPage = 'dashboard';
let currentInspectingApar = null;
let editMode = null;

// Data form yang belum disimpan (untuk peringatan)
let hasUnsavedFormChanges = false;

// Animation cleanup tracking
let _pendingAnimations = [];

function _clearPendingAnimations() {
  _pendingAnimations.forEach(id => clearTimeout(id));
  _pendingAnimations = [];
}

// Utility: Debounce function
function _debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Swipe state dan debounce
let touchStartX = 0;
let touchEndX = 0;
let _lastSwipeTime = 0;
const SWIPE_DEBOUNCE_MS = 300;

function handleSwipe() {
  const now = Date.now();
  if (now - _lastSwipeTime < SWIPE_DEBOUNCE_MS) return;
  
  const swipeThreshold = 100;
  const diff = touchEndX - touchStartX;
  
  if (Math.abs(diff) < swipeThreshold) return;
  
  // Swipe kanan -> back
  if (diff > 0 && (currentInspectingApar || editMode)) {
    _lastSwipeTime = now;
    goBack();
  }
}

// Event handlers (untuk removal nanti)
const _eventHandlers = {
  keydown: null,
  touchstart: null,
  touchend: null
};

function _setupEventListeners() {
  // Remove existing listeners if any
  _removeEventListeners();
  
  // Keydown handler
  _eventHandlers.keydown = function(e) {
    if (e.key === 'Escape') {
      if (currentInspectingApar || editMode) {
        goBack();
      }
    }
  };
  
  // Touch handlers
  _eventHandlers.touchstart = function(e) {
    touchStartX = e.changedTouches[0].screenX;
  };
  
  _eventHandlers.touchend = function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  };
  
  // Add listeners
  document.addEventListener('keydown', _eventHandlers.keydown);
  document.addEventListener('touchstart', _eventHandlers.touchstart, { passive: true });
  document.addEventListener('touchend', _eventHandlers.touchend, { passive: true });
}

function _removeEventListeners() {
  if (_eventHandlers.keydown) {
    document.removeEventListener('keydown', _eventHandlers.keydown);
  }
  if (_eventHandlers.touchstart) {
    document.removeEventListener('touchstart', _eventHandlers.touchstart);
  }
  if (_eventHandlers.touchend) {
    document.removeEventListener('touchend', _eventHandlers.touchend);
  }
}

/**
 * Navigasi ke halaman tertentu
 */
function navigateTo(page) {
  _clearPendingAnimations();
  
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
      const timeoutId = setTimeout(() => {
        icon.style.transform = '';
      }, 200);
      _pendingAnimations.push(timeoutId);
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
    
    const rafId = requestAnimationFrame(() => {
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
  
  // Tampilkan/sembunyikan FAB button berdasarkan halaman
  const fabBtn = document.getElementById('fabMasterBtn');
  if (fabBtn) {
    fabBtn.style.display = (page === 'master') ? 'flex' : 'none';
  }
  
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
// Setup listeners ketika DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _setupEventListeners);
} else {
  _setupEventListeners();
}