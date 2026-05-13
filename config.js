const inspectionChecklists = {
  'CO2': [
    { id: 'tekanan', label: 'Tekanan Tabung', icon: 'bi-speedometer2', desc: 'Pressure gauge di zona hijau' },
    { id: 'segel', label: 'Segel & Pin', icon: 'bi-shield-lock', desc: 'Segel utuh, pin pengaman ada' },
    { id: 'selang', label: 'Selang & Nozzle', icon: 'bi-droplet', desc: 'Tidak retak, nozzle tidak tersumbat' },
    { id: 'body', label: 'Body Tabung', icon: 'bi-cylinder', desc: 'Tidak ada karat/penyok' },
    { id: 'label', label: 'Label & Instruksi', icon: 'bi-card-text', desc: 'Label terbaca jelas' },
    { id: 'bracket', label: 'Bracket/Hanger', icon: 'bi-pin-angle', desc: 'Terpasang kokoh, mudah dijangkau' },
    { id: 'horn', label: 'Horn/Corong', icon: 'bi-megaphone', desc: 'Tidak retak, terpasang baik' },
  ],
  'Dry Powder': [
    { id: 'tekanan', label: 'Tekanan Tabung', icon: 'bi-speedometer2', desc: 'Pressure gauge di zona hijau' },
    { id: 'segel', label: 'Segel & Pin', icon: 'bi-shield-lock', desc: 'Segel utuh, pin pengaman ada' },
    { id: 'selang', label: 'Selang & Nozzle', icon: 'bi-droplet', desc: 'Tidak retak, nozzle tidak tersumbat' },
    { id: 'body', label: 'Body Tabung', icon: 'bi-cylinder', desc: 'Tidak ada karat/penyok' },
    { id: 'label', label: 'Label & Instruksi', icon: 'bi-card-text', desc: 'Label terbaca jelas' },
    { id: 'bracket', label: 'Bracket/Hanger', icon: 'bi-pin-angle', desc: 'Terpasang kokoh' },
    { id: 'powder', label: 'Kondisi Powder', icon: 'bi-boxes', desc: 'Goyangkan, powder tidak menggumpal' },
    { id: 'expired', label: 'Tanggal Expired', icon: 'bi-calendar-x', desc: 'Belum melewati tanggal expired' },
  ],
  'Foam': [
    { id: 'tekanan', label: 'Tekanan Tabung', icon: 'bi-speedometer2', desc: 'Pressure gauge di zona hijau' },
    { id: 'segel', label: 'Segel & Pin', icon: 'bi-shield-lock', desc: 'Segel utuh, pin pengaman ada' },
    { id: 'selang', label: 'Selang & Nozzle', icon: 'bi-droplet', desc: 'Tidak retak/tersumbat' },
    { id: 'body', label: 'Body Tabung', icon: 'bi-cylinder', desc: 'Tidak karat/penyok' },
    { id: 'label', label: 'Label & Instruksi', icon: 'bi-card-text', desc: 'Label jelas' },
    { id: 'bracket', label: 'Bracket/Hanger', icon: 'bi-pin-angle', desc: 'Kokoh terpasang' },
    { id: 'foam_quality', label: 'Kualitas Foam', icon: 'bi-droplet-fill', desc: 'Tidak ada endapan, masih baik' },
  ],
  'Wet Chemical': [
    { id: 'tekanan', label: 'Tekanan Tabung', icon: 'bi-speedometer2', desc: 'Pressure gauge di zona hijau' },
    { id: 'segel', label: 'Segel & Pin', icon: 'bi-shield-lock', desc: 'Segel utuh' },
    { id: 'selang', label: 'Selang & Wand', icon: 'bi-droplet', desc: 'Selang fleksibel, wand utuh' },
    { id: 'body', label: 'Body Tabung', icon: 'bi-cylinder', desc: 'Tidak karat' },
    { id: 'label', label: 'Label & Instruksi', icon: 'bi-card-text', desc: 'Label jelas' },
    { id: 'bracket', label: 'Bracket/Hanger', icon: 'bi-pin-angle', desc: 'Kokoh' },
    { id: 'chemical', label: 'Larutan Chemical', icon: 'bi-droplet-half', desc: 'Tidak keruh/endapan' },
  ]
};

const defaultChecklist = [
  { id: 'tekanan', label: 'Tekanan Tabung', icon: 'bi-speedometer2', desc: 'Cek pressure gauge' },
  { id: 'segel', label: 'Segel & Pin', icon: 'bi-shield-lock', desc: 'Segel utuh' },
  { id: 'selang', label: 'Selang & Nozzle', icon: 'bi-droplet', desc: 'Kondisi baik' },
  { id: 'body', label: 'Body Tabung', icon: 'bi-cylinder', desc: 'Tidak rusak' },
  { id: 'label', label: 'Label & Instruksi', icon: 'bi-card-text', desc: 'Terbaca' },
  { id: 'bracket', label: 'Bracket/Hanger', icon: 'bi-pin-angle', desc: 'Kokoh' },
  { id: 'expired', label: 'Tanggal Expired', icon: 'bi-calendar-x', desc: 'Belum expired' },
];

const STATUS_CONFIG = {
  'Good': { badge: 'badge-good', label: 'Good' },
  'Warning': { badge: 'badge-warning', label: 'Warning' },
  'Critical': { badge: 'badge-critical', label: 'Critical' },
  'Replace Required': { badge: 'badge-replace', label: 'Replace Required' }
};

const PAGE_TITLES = {
  dashboard: 'Dashboard APAR',
  master: 'Master APAR',
  inspection: 'Inspeksi Bulanan',
  monitoring: 'Monitoring',
  reminder: 'Reminder Expired'
};

const REMINDER_CONFIG = {
  criticalDays: 14,
  warningDays: 30
};

const GOOGLE_SHEETS_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbyjBhGgqc58TRr9l5tYVL39raPdPQaq8POz4XOZaQWUkFJIm-qN42ypSfFYDHh8mTV5fQ/exec'
};