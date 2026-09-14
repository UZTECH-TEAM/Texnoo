
const NAMES = ["Bahodirjonov Sardor", "Bahodirov Asadbek", "Farangiz", "Farxodjon 08", "Ibrohim", "Muhiddinov Nurillo", "Dadajonova Munavvara", "Og'abek", "Omonov Alisher", "Shavkatova Fotima", "Shaxboz", "Tojaliyev G'ayratjon", "Tolipjonov Asadbek", "Tursunaliyev Abdulaziz", "Umaraliyev Ozodbek", "Abdurazoqova Ra'noxon", "Abdulhakimov Sardorbek", "Ahmadjonova Shodiyona", "Hamidov Abdulahat", "Abdumo'minov Muhammadmuhtor", "Hoshimov Abdulhafiz", "Hasanboyev Muhamqodir", "Nurmuhamadov Diyorbek", "Mahamadov Ozodbek", "Shavkatov Abdulatif"];
const SK = "texno_v5";
const DEFAULT_SUPER_ADMIN_PASSWORD = "Admin2026";
const DEFAULT_TEACHER_PASSWORD = "Teacher2026";
const SECURITY_LOCK_MINUTES = 1;
const SEED_VERSION = 1;

let teachers = [];
let students = [];
let txs = [];
let admins = [];
let adminRequests = [];
let messages = [];
let groups = [];
let tests = [];
let nid = 1;
let ntid = 1;
let naid = 1;
let nrid = 1;
let seedVersion = 0;
let curType = null;
let curId = null;
let curTeacherId = null;
let curAdminId = null;
let activeTeacherId = null;
let lbM = "overall", lbM2 = "overall", chart = null;
let _refreshTimer = null;
const medals = ['🥇', '🥈', '🥉'];
const authState = {};
const PREF_SHOW_ID = 'pref_show_id';
const PREF_ANIM = 'pref_anim';

// GROUP PRICING (Guruh narxlari) - Flexible narxi sistema
const GROUP_PRICING = {
  'programmer': 400000,           // Dasturchi - 400,000 so'm
  'computer_literacy': 300000,    // Kompyuter savodxonligi - 300,000 so'm
  'phone_literacy': 250000,       // Telefon savodxonligi - 250,000 so'm
  'default': 250000               // Boshqalar - 250,000 so'm
};

function getGroupPrice(category) { return GROUP_PRICING[category] || GROUP_PRICING['default']; }

function getPrefBool(key, defVal = true) {
  const v = localStorage.getItem(key);
  if (v === null) return defVal;
  return v === '1' || v === 'true';
}
function setPrefBool(key, val) { localStorage.setItem(key, val ? '1' : '0'); }

function nNum(v) { return Number(v); }
function escHtml(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function categoryLabel(cat) {
  if (cat === 'programmer') return 'Dasturchi (Web: HTML, CSS, JS)';
  if (cat === 'computer_literacy') return 'Kompyuter savodxonligi';
  if (cat === 'phone_literacy') return 'Telefon savodxonligi';
  return 'Boshqa yo\'nalish';
}
function categoryBadge(cat) {
  if (cat === 'programmer') return '💻';
  if (cat === 'computer_literacy') return '🖥️';
  if (cat === 'phone_literacy') return '📱';
  return '📘';
}
function togglePwd(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  if (iconEl && iconEl.classList) {
    iconEl.classList.toggle('fa-eye', !isPwd);
    iconEl.classList.toggle('fa-eye-slash', isPwd);
  }
}
function applyTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('theme-light', theme === 'light');
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
}
function toggleTheme() {
  const isLight = !document.body.classList.contains('theme-light');
  document.body.classList.toggle('theme-light', isLight);
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  applyTheme();
}
function genP(seed) {
  const safe = (seed || '').replace(/[^a-zA-Z0-9]/g, '');
  const raw = (safe + 'tex').slice(0, 3);
  const prefix = (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) || "Tex";
  const suffix = (~~(Math.random() * 9000) + 1000);
  return `${prefix}@${suffix}`;
}
function genCode(prefix = 'ADM') { return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function normRefCode(v) { return String(v || '').trim().toUpperCase(); }
function makeRefCode(id) { return `REF${id}${~~(Math.random() * 100)}`; }
function uniqueRefCode(id, used) { let c = makeRefCode(id); while (used.has(c)) { c = makeRefCode(id); } return c; }
window.togglePwd = togglePwd;
window.clearMessageHistory = clearMessageHistory;
window.getGroupPrice = getGroupPrice;
function validStrongPassword(p) { return typeof p === 'string' && p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p); }
function maskPhone(phone) { const raw = String(phone || '').replace(/\D/g, ''); if (!raw) return '-'; if (raw.length <= 4) return raw; return '****' + raw.slice(-4); }
async function sendSmsNotification(phone, message) { if (!phone) return false; try { const res = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, message }) }); const data = await res.json(); if (res.ok) { return true; } console.warn('SMS xato', data); return false; } catch (e) { console.warn('SMS fetch xato', e); return false; } }

function getTeacherById(id) { return teachers.find(t => t.id === nNum(id)); }
function getStudentById(id) { return students.find(s => s.id === nNum(id)); }
function getAdminById(id) { return admins.find(a => a.id === nNum(id)); }
function getSuperAdmin() { return admins.find(a => a.role === 'super'); }
function isAdmin() { return curType === 'admin'; }
function isSuperAdmin() { const a = getAdminById(curAdminId); return !!(a && a.role === 'super' && a.status === 'active'); }
function isTeacherMode() { return curType === 'teacher' || curType === 'admin'; }
function activeAdmins() { return admins.filter(a => a.status === 'active'); }
function activeSubAdmins() { return admins.filter(a => a.status === 'active' && a.role === 'admin'); }
function pendingAdmins() { return admins.filter(a => a.status === 'pending'); }
function adminLabel(a) { return a.role === 'super' ? 'Super Admin' : 'Admin'; }

function scopeStudents(tid) {
  const targetTid = tid || curTeacherId;
  if (curType === 'student') {
    const s = getStudentById(curId);
    if (!s) return [];
    return students.filter(x => (x.teacherIds || [x.teacherId]).includes(targetTid || s.teacherId));
  }
  if (curType === 'teacher') return students.filter(x => (x.teacherIds || [x.teacherId]).includes(targetTid));
  return students;
}
function manageStudents() {
  if (!curType) return [];
  if (curType === 'teacher') return students.filter(s => (s.teacherIds || [s.teacherId]).includes(curTeacherId));
  if (curType === 'admin') return students;
  return [];
}
function canManageStudent(s) {
  if (!s) return false;
  return curType === 'admin' || (curType === 'teacher' && (s.teacherIds || [s.teacherId]).includes(curTeacherId));
}
function byModeValue(sid, mode, tid) {
  const targetTid = tid || curTeacherId;
  if (mode === "weekly") { const w = Date.now() - 7 * 864e5; return txs.filter(t => t.studentId === sid && t.teacherId === targetTid && t.timestamp >= w).reduce((a, b) => a + b.amount, 0); }
  if (mode === "monthly") { const m = Date.now() - 30 * 864e5; return txs.filter(t => t.studentId === sid && t.teacherId === targetTid && t.timestamp >= m).reduce((a, b) => a + b.amount, 0); }
  return getStudentById(sid)?.coins?.[targetTid] || 0;
}
function sorted(mode, tid) { return [...scopeStudents(tid)].map(s => ({ ...s, score: byModeValue(s.id, mode, tid) })).sort((a, b) => b.score - a.score); }
function rank(sid, mode, tid) { const numSid = nNum(sid); return sorted(mode, tid).findIndex(s => s.id === numSid) + 1; }

function canAttempt(key) {
  const now = Date.now();
  const st = authState[key] || { fails: 0, lockUntil: 0 };
  authState[key] = st;
  if (st.lockUntil > now) {
    const sec = Math.ceil((st.lockUntil - now) / 1000);
    toast(`Ko'p urinish. ${sec}s kuting.`, 'error');
    return false;
  }
  return true;
}
function markFail(key) {
  const st = authState[key] || { fails: 0, lockUntil: 0 };
  st.fails += 1;
  if (st.fails >= 5) { st.lockUntil = Date.now() + SECURITY_LOCK_MINUTES * 60 * 1000; st.fails = 0; }
  authState[key] = st;
}
function clearFail(key) { authState[key] = { fails: 0, lockUntil: 0 }; }

function mkDef() {
  seedVersion = SEED_VERSION;
  teachers = [{ id: 1, name: "IT O'qituvchi", subject: "IT", group: "Barcha", password: DEFAULT_TEACHER_PASSWORD, resetCode: genCode('TCH'), isMain: false, logo: null }];
  admins = [{ id: 1, name: 'Super Admin', role: 'super', status: 'active', password: DEFAULT_SUPER_ADMIN_PASSWORD, adminCode: genCode('SPR'), linkedTeacherId: null, createdByAdminId: null, createdAt: Date.now() }];
  adminRequests = [];
  messages = [];
  groups = [];
  tests = [];
  students = [];
  plans = [];
  let id = 1;
  const usedRef = new Set();
  const defaultStudents = [
    { name: 'Bahodirjonov Sardor', coins: 100, group: 'D2' },
    { name: 'Bahodirov Asadbek', coins: 0, group: 'D1' },
    { name: 'Farangiz', coins: 25, group: 'D1' },
    { name: 'Farxodjon 08', coins: 0, group: 'D1' },
    { name: 'Ibrohim', coins: 65, group: 'D1' },
    { name: 'Muhiddinov Nurillo', coins: 0, group: 'D1' },
    { name: 'Dadajonova Munavvara', coins: 15, group: 'D1' },
    { name: 'Og\'abek', coins: 0, group: 'D1' },
    { name: 'Omonov Alisher', coins: 50, group: 'D1' },
    { name: 'Shavkatova Fotima', coins: 50, group: 'D1' },
    { name: 'Shaxboz', coins: 25, group: 'D1' },
    { name: 'Tojaliyev G\'ayratjon', coins: 0, group: 'D1' },
    { name: 'Tolipjonov Asadbek', coins: 26, group: 'D1' },
    { name: 'Tursunaliyev Abdulaziz', coins: 5, group: 'D1' },
    { name: 'Umaraliyev Ozodbek', coins: 50, group: 'D1' },
    { name: 'Abdurazoqova Ra\'noxon', coins: 15, group: 'D1' },
    { name: 'Abdulhakimov Sardorbek', coins: 35, group: 'D1' },
    { name: 'Ahmadjonova Shodiyona', coins: 45, group: 'D1' },
    { name: 'Hamidov Abdulahat', coins: 24, group: 'D1' },
    { name: 'Abdumo\'minov Muhammadmuhtor', coins: 10, group: 'D1' },
    { name: 'Hoshimov Abdulhafiz', coins: 0, group: 'D1' },
    { name: 'Hasanboyev Muhamqodir', coins: 5, group: 'D1' },
    { name: 'Nurmuhamadov Diyorbek', coins: 10, group: 'D1' },
    { name: 'Mahamadov Ozodbek', coins: 5, group: 'D1' },
    { name: 'Shavkatov Abdulatif', coins: 5, group: 'D1' }
  ];
  for (const student of defaultStudents) {
    const curId = id++;
    const p = genP(student.name);
    const refCode = uniqueRefCode(curId, usedRef);
    usedRef.add(refCode);
    students.push({ id: curId, teacherIds: [1], name: student.name, refCode, password: p, phone: '', coins: { 1: student.coins }, totalCoins: student.coins, olmos: 0, streak: 0, lastDailyDate: null, level: 1, badge: 'Starter', group: student.group, inventory: [], activeEffects: {} });
  }
  nid = id; ntid = 2; naid = 2; nrid = 1; txs = [];
}

function normalizeData(d) {
  seedVersion = nNum(d?.seedVersion) || 0;
  teachers = (Array.isArray(d?.teachers) ? d.teachers : []).map(t => ({ id: nNum(t.id), name: t.name || "O'qituvchi", subject: t.subject || "Fan", group: String(t.group || 'Barcha'), password: String(t.password || DEFAULT_TEACHER_PASSWORD), resetCode: String(t.resetCode || genCode('TCH')), isMain: false, logo: t.logo || null }));
  if (!teachers.length) { teachers = [{ id: 1, name: "IT O'qituvchi", subject: "IT", group: "Barcha", password: DEFAULT_TEACHER_PASSWORD, resetCode: genCode('TCH'), isMain: false, logo: null }]; }

  admins = (Array.isArray(d?.admins) ? d.admins : []).map(a => ({ id: nNum(a.id), name: a.name || 'Admin', role: (a.role === 'super' ? 'super' : 'admin'), status: (a.status === 'pending' ? 'pending' : 'active'), password: String(a.password || genP(a.name)), adminCode: String(a.adminCode || genCode('ADM')), linkedTeacherId: a.linkedTeacherId ? nNum(a.linkedTeacherId) : null, createdByAdminId: a.createdByAdminId ? nNum(a.createdByAdminId) : null, createdAt: nNum(a.createdAt) || Date.now() }));
  if (!admins.length) { const legacyPwd = String(d?.adminPassword || DEFAULT_SUPER_ADMIN_PASSWORD); admins = [{ id: 1, name: 'Super Admin', role: 'super', status: 'active', password: legacyPwd, adminCode: genCode('SPR'), linkedTeacherId: null, createdByAdminId: null, createdAt: Date.now() }]; }
  if (!admins.some(a => a.role === 'super')) { const max = Math.max(...admins.map(a => a.id), 0) + 1; admins.push({ id: max, name: 'Super Admin', role: 'super', status: 'active', password: DEFAULT_SUPER_ADMIN_PASSWORD, adminCode: genCode('SPR'), linkedTeacherId: null, createdByAdminId: null, createdAt: Date.now() }); }

  adminRequests = (Array.isArray(d?.adminRequests) ? d.adminRequests : []).map(r => ({ id: nNum(r.id), requesterAdminId: nNum(r.requesterAdminId), candidateAdminId: nNum(r.candidateAdminId), teacherName: r.teacherName || '', createdAt: nNum(r.createdAt) || Date.now(), status: 'pending' })).filter(r => r.candidateAdminId);

  const fallbackTeacherId = teachers[0].id;
  students = (Array.isArray(d?.students) ? d.students : []).map(s => {
    let tIds = Array.isArray(s.teacherIds) ? s.teacherIds : (s.teacherId ? [nNum(s.teacherId)] : [fallbackTeacherId]);
    const coins = s.coins || {};
    if (Object.keys(coins).length === 0 && s.totalCoins > 0) {
      tIds.forEach(tid => coins[tid] = s.totalCoins);
    }
    return { ...s, id: nNum(s.id), teacherIds: tIds, coins, phone: String(s.phone || ''), birthDate: s.birthDate || '', status: s.status || 'active', totalCoins: nNum(s.totalCoins) || 0, olmos: nNum(s.olmos) || 0, streak: nNum(s.streak) || 0, level: nNum(s.level) || 1, refCode: normRefCode(s.refCode), group: String(s.group || 'D1'), absencesCount: nNum(s.absencesCount) || 0, trialDaysCount: nNum(s.trialDaysCount) || 0, inventory: Array.isArray(s.inventory) ? s.inventory : [], activeEffects: s.activeEffects || {} };
  });
  const usedRef = new Set();
  students = students.map(s => { let ref = s.refCode; if (!ref || usedRef.has(ref)) { ref = uniqueRefCode(s.id, usedRef); } usedRef.add(ref); return { ...s, refCode: ref }; });
  messages = (Array.isArray(d?.messages) ? d.messages : []).map(m => ({ id: m.id, fromType: String(m.fromType || ''), fromId: nNum(m.fromId), toType: String(m.toType || ''), toId: m.toId, text: String(m.text || ''), media: m.media || null, timestamp: nNum(m.timestamp) || Date.now(), replyTo: m.replyTo || null }));
  const nowMs = Date.now();
  messages = messages.filter(m => (nowMs - m.timestamp) <= 24 * 60 * 60 * 1000);
  plans = Array.isArray(d?.plans) ? d.plans : [];
  groups = (Array.isArray(d?.groups) ? d.groups : []).map(g => {
    const cat = g.category || 'programmer';
    return { name: String(g.name || ''), teacherId: nNum(g.teacherId), image: g.image || null, createdAt: nNum(g.createdAt) || Date.now(), category: cat, price: getGroupPrice(cat) };
  });
  tests = (Array.isArray(d?.tests) ? d.tests : []).map(t => ({ ...t, id: nNum(t.id), teacherId: nNum(t.teacherId), questions: Array.isArray(t.questions) ? t.questions : [], startTime: nNum(t.startTime) || Date.now() }));
  txs = (Array.isArray(d?.transactions) ? d.transactions : []).map(t => ({ ...t, studentId: nNum(t.studentId), amount: nNum(t.amount) || 0, timestamp: nNum(t.timestamp) || Date.now(), teacherId: t.teacherId ? nNum(t.teacherId) : null, adminId: t.adminId ? nNum(t.adminId) : null }));

  nid = Math.max(nNum(d?.nextStudentId) || 1, (students.length ? Math.max(...students.map(s => s.id)) + 1 : 1));
  ntid = Math.max(nNum(d?.nextTeacherId) || 1, (teachers.length ? Math.max(...teachers.map(t => t.id)) + 1 : 1));
  naid = Math.max(nNum(d?.nextAdminId) || 1, (admins.length ? Math.max(...admins.map(a => a.id)) + 1 : 1));
  nrid = Math.max(nNum(d?.nextRequestId) || 1, (adminRequests.length ? Math.max(...adminRequests.map(r => r.id)) + 1 : 1));
  updBadges();
}

async function save() {
  const d = { seedVersion, students, transactions: txs, nextStudentId: nid, teachers, nextTeacherId: ntid, admins, nextAdminId: naid, adminRequests, nextRequestId: nrid, messages, groups, tests, plans };
  try { await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); } catch (e) { }
  try { localStorage.setItem(SK, JSON.stringify(d)); } catch (e) { }
}
async function load() {
  try { const res = await fetch('/api/data'); if (res.ok) { const d = await res.json(); if (d && Array.isArray(d.students) && Array.isArray(d.transactions)) return d; } } catch (e) { }
  try { const r = localStorage.getItem(SK); if (r) return JSON.parse(r); } catch (e) { }
  return null;
}

function clearMessageHistory() {
  messages = [];
  toast('Xabarlar tarixi o\'chirildi', 'success');
  save();
  const msgHistory = document.getElementById('msgHistory');
  if (msgHistory) msgHistory.innerHTML = '<p style="color:var(--text-dim);padding:20px;text-align:center;">Xabarlar tarixi bo\'sh.</p>';
}

function updBadges() {
  for (const s of students) {
    s.level = ~~(s.totalCoins / 100) + 1;
    s.badge = s.totalCoins < 100 ? "Starter" : s.totalCoins < 300 ? "Active" : s.totalCoins < 600 ? "Pro" : "Elite";
  }

  // Notification Bell Badge
  if (!curType) return;
  const lastSeen = nNum(localStorage.getItem('lastSeenMessageTime')) || 0;
  const myMsgs = messages.filter(m => {
    if (m.fromType === curType && nNum(m.fromId) === (curType === 'student' ? curId : curType === 'teacher' ? curTeacherId : curAdminId)) return false;
    if (m.toType === 'all') return true;
    if (m.toType === 'all_teachers' && (curType === 'admin' || curType === 'teacher')) return true;
    if (m.toType === 'all_students' && curType === 'student') return true;
    if (m.toType === 'teacher_students' && curType === 'student' && nNum(curTeacherId) === nNum(m.toId)) return true;
    if (m.toType === 'specific_teacher' && curType === 'teacher' && nNum(curTeacherId) === nNum(m.toId)) return true;
    if (m.toType === 'specific_student' && curType === 'student' && nNum(curId) === nNum(m.toId)) return true;
    if (m.toType === 'group' && curType === 'student') {
      const s = getStudentById(curId);
      if (s && String(s.group) === String(m.toId)) return true;
    }
    return false;
  });

  const unreadCount = myMsgs.filter(m => m.timestamp > lastSeen).length;
  const bell = document.getElementById('topbarMsgBell');
  if (bell) {
    bell.style.display = 'flex';
    const countEl = bell.querySelector('.bell-count');
    if (countEl) {
      countEl.textContent = unreadCount;
      countEl.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    const anim = getPrefBool(PREF_ANIM, true);
    if (anim && unreadCount > 0) bell.classList.add('notif-pulse');
    else bell.classList.remove('notif-pulse');
  }

  // Sidebar Badges
  ['sNavMsgBadge', 'tNavMsgBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (unreadCount > 0) {
        el.style.display = 'inline-block';
        el.textContent = unreadCount;
      } else {
        el.style.display = 'none';
      }
    }
  });
}

function applyPrefs() {
  const showId = getPrefBool(PREF_SHOW_ID, true);
  const idWrap = document.getElementById('sbIdDisplay');
  if (idWrap && curType === 'student') idWrap.style.display = showId ? 'block' : 'none';
  const anim = getPrefBool(PREF_ANIM, true);
  if (!anim) {
    const bell = document.getElementById('topbarMsgBell');
    if (bell) bell.classList.remove('notif-pulse');
  }
}

function renderSettingsPage() {
  const showId = getPrefBool(PREF_SHOW_ID, true);
  const anim = getPrefBool(PREF_ANIM, true);
  const c1 = document.getElementById('prefShowId'); if (c1) c1.checked = showId;
  const c2 = document.getElementById('prefAnim'); if (c2) c2.checked = anim;
}

function setPrefShowId(val) { setPrefBool(PREF_SHOW_ID, !!val); applyPrefs(); }
function setPrefAnim(val) { setPrefBool(PREF_ANIM, !!val);  applyPrefs();
  updStudentLoginOptions();
  hideLoader();
}

window.setPrefShowId = setPrefShowId;
window.setPrefAnim = setPrefAnim;
function updTeacherLoginOptions() {
  const tOps = teachers.map(t => `<option value="${t.id}">${escHtml(t.name)} (${escHtml(t.subject)}${t.group ? ` / ${escHtml(t.group)}` : ''})</option>`).join('');
  const tLoginSel = document.getElementById('tLoginSel');
  if (tLoginSel) tLoginSel.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  const naTeacher = document.getElementById('naTeacher');
  if (naTeacher) naTeacher.innerHTML = `<option value="">-- O'qituvchi --</option>${tOps}`;
  const fpTeacher = document.getElementById('fpTeacherSel');
  if (fpTeacher) fpTeacher.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  const ftTeacher = document.getElementById('ftTeacherSel');
  if (ftTeacher) ftTeacher.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  const regTeacher = document.getElementById('regTeacherSel');
  if (regTeacher) regTeacher.innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;

  if (teachers.length === 1 && tLoginSel) {
    tLoginSel.value = String(teachers[0].id);
  }
}
function updAdminLoginOptions() {
  const opts = activeSubAdmins().map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
  const el = document.getElementById('aAdminSel');
  if (el) el.innerHTML = `<option value="">-- Admin tanlang --</option>${opts}`;
  const fa = document.getElementById('faAdminSel');
  if (fa) fa.innerHTML = `<option value="">-- Admin tanlang --</option>${opts}`;
}
function toggleAdminLoginType() {
  const typeEl = document.getElementById('aLoginType');
  if (!typeEl) return;
  const type = typeEl.value;
  const showAdmin = (type === 'admin');
  const selWrap = document.getElementById('aAdminSelWrap');
  const codeWrap = document.getElementById('aCodeWrap');
  if (selWrap) selWrap.style.display = showAdmin ? 'block' : 'none';
  if (codeWrap) codeWrap.style.display = showAdmin ? 'block' : 'none';
}
function updStudentLoginOptions() {
  const loginSel = document.getElementById('sLoginSel');
  if (!loginSel) return;
  const o = students.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  loginSel.innerHTML = `<option value="">-- Ismingizni tanlang --</option>${o}`;
}
function updForgotStudentOptions() {
  const teacherEl = document.getElementById('fpTeacherSel');
  const studentEl = document.getElementById('fpStudentSel');
  if (!teacherEl || !studentEl) return;
  const tid = nNum(teacherEl.value);
  const list = students.filter(s => (s.teacherIds || [s.teacherId]).includes(tid));
  const opts = list.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  studentEl.innerHTML = `<option value="">-- Talaba tanlang --</option>${opts}`;
}
function updSels() {
  const vis = manageStudents();
  const stOps = vis.map(s => `<option value="${s.id}">${escHtml(s.name)} (${s.totalCoins}🪙)</option>`).join('');
  ['aSt', 'hSt', 'pSt', 'rSt', 'mSt', 'dSt'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = stOps; });

  const nsTeacher = document.getElementById('nsTeacher');
  if (nsTeacher) {
    if (isAdmin()) {
      nsTeacher.style.display = 'block';
      nsTeacher.innerHTML = `<option value="">-- O'qituvchi --</option>` + teachers.map(t => `<option value="${t.id}">${escHtml(t.name)} (${escHtml(t.subject)}${t.group ? ` / ${escHtml(t.group)}` : ''})</option>`).join('');
    } else {
      nsTeacher.style.display = 'none';
    }
  }
  const newGrpTeacher = document.getElementById('newGrpTeacher');
  if (newGrpTeacher) {
    if (isAdmin()) {
      document.getElementById('newGrpTeacherWrap').style.display = 'block';
      newGrpTeacher.innerHTML = teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
    } else {
      document.getElementById('newGrpTeacherWrap').style.display = 'none';
    }
  }
  updNsGroupOptions();
  updRegGroupOptions();
}

function swTab(t) {
  const sForm = document.getElementById('sLoginForm');
  const tForm = document.getElementById('tLoginForm');
  const aForm = document.getElementById('aLoginForm');
  if (sForm) sForm.style.display = t === 'student' ? 'block' : 'none';
  if (tForm) tForm.style.display = t === 'teacher' ? 'block' : 'none';
  if (aForm) aForm.style.display = t === 'admin' ? 'block' : 'none';
  document.getElementById('tabSBtn')?.classList.toggle('active', t === 'student');
  document.getElementById('tabTBtn')?.classList.toggle('active', t === 'teacher');
  document.getElementById('tabABtn')?.classList.toggle('active', t === 'admin');
  
  if (t === 'teacher') {
    updTeacherLoginOptions();
  } else if (t === 'admin') {
    updAdminLoginOptions();
    toggleAdminLoginType();
  }
}

function doSLogin() {
  if (!canAttempt('student')) return;
  const sid = nNum(document.getElementById('sLoginSel').value);
  const pwd = document.getElementById('sPwdIn').value.trim();
  if (!sid) { toast('Talabani tanlang!', 'error'); return; }
  const s = getStudentById(sid);
  if (!s || s.password.trim() !== pwd) { markFail('student'); toast('Parol xato!', 'error'); return; }
  clearFail('student');
  curType = 'student'; curId = sid; curTeacherId = s.teacherId; curAdminId = null; enterS();
}
function doTLogin() {
  if (!canAttempt('teacher')) return;
  const tid = nNum(document.getElementById('tLoginSel').value);
  const pwd = document.getElementById('tPwdIn').value.trim();
  if (!tid) {
    toast("O'qituvchini tanlang!", 'error');
    return;
  }
  const t = getTeacherById(tid);
  if (!t || t.password.trim() !== pwd) {
    markFail('teacher');
    toast("O'qituvchi yoki parol xato", 'error');
    return;
  }
  clearFail('teacher');
  curType = 'teacher';
  curTeacherId = t.id;
  curId = null;
  curAdminId = null;
  enterT();
}
function doALogin() {
  if (!canAttempt('admin')) return;
  const type = document.getElementById('aLoginType').value;
  const pwd = document.getElementById('aPwdIn').value.trim();
  if (type === 'super') {
    const s = getSuperAdmin();
    if (!s || s.password.trim() !== pwd) { markFail('admin'); toast('Super admin paroli xato!', 'error'); return; }
    clearFail('admin');
    curType = 'admin'; curAdminId = s.id; curId = null; curTeacherId = null; enterT();
    return;
  }
  const aid = nNum(document.getElementById('aAdminSel').value);
  const code = String(document.getElementById('aCodeIn').value || '').trim().toUpperCase();
  const a = getAdminById(aid);
  if (!a || a.role !== 'admin' || a.status !== 'active') { markFail('admin'); toast('Admin topilmadi yoki aktiv emas', 'error'); return; }
  if (a.password.trim() !== pwd || String(a.adminCode).toUpperCase() !== code) { markFail('admin'); toast('Maxsus kod yoki parol xato', 'error'); return; }
  clearFail('admin');
  curType = 'admin'; curAdminId = a.id; curId = null; curTeacherId = null; enterT();
}
function openTeacherForgotModal() {
  const ft = document.getElementById('ftTeacherSel');
  const tSel = document.getElementById('tLoginSel');
  if (ft && tSel && tSel.value) ft.value = tSel.value;
  ['ftCodeIn', 'ftNewIn', 'ftCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('ftModal');
}
async function doTeacherForgotReset() {
  const tid = nNum(document.getElementById('ftTeacherSel')?.value);
  const code = String(document.getElementById('ftCodeIn')?.value || '').trim().toUpperCase();
  const np = String(document.getElementById('ftNewIn')?.value || '');
  const cp = String(document.getElementById('ftCnfIn')?.value || '');

  if (!tid) { toast("O'qituvchini tanlang", 'error'); return; }
  const t = getTeacherById(tid);
  if (!t) { toast("O'qituvchi topilmadi", 'error'); return; }
  if (!code) { toast("Maxsus kodni kiriting", 'error'); return; }
  if (String(t.resetCode || '').toUpperCase() !== code) { toast("Maxsus kod noto'g'ri", 'error'); return; }
  if (!validStrongPassword(np)) { toast('Yangi parol kuchsiz (kamida 8, katta-kichik harf va raqam)', 'error'); return; }
  if (np !== cp) { toast('Parollar mos emas', 'error'); return; }

  t.password = np;
  await save();
  closeModal('ftModal');
  const tLoginSel = document.getElementById('tLoginSel');
  if (tLoginSel) tLoginSel.value = String(tid);
  document.getElementById('tPwdIn').value = np;
  toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
}
function toggleAdminForgotType() {
  const type = document.getElementById('faTypeSel')?.value || 'super';
  const showAdmin = (type === 'admin');
  const adminWrap = document.getElementById('faAdminSelWrap');
  if (adminWrap) adminWrap.style.display = showAdmin ? 'block' : 'none';
}
function openAdminForgotModal() {
  const type = document.getElementById('aLoginType')?.value || 'super';
  const faType = document.getElementById('faTypeSel');
  if (faType) faType.value = type;
  const faAdmin = document.getElementById('faAdminSel');
  const aAdmin = document.getElementById('aAdminSel');
  if (faAdmin && aAdmin && aAdmin.value) faAdmin.value = aAdmin.value;
  toggleAdminForgotType();
  ['faCodeIn', 'faNewIn', 'faCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('faModal');
}
async function doAdminForgotReset() {
  const type = document.getElementById('faTypeSel')?.value || 'super';
  const code = String(document.getElementById('faCodeIn')?.value || '').trim().toUpperCase();
  const np = String(document.getElementById('faNewIn')?.value || '');
  const cp = String(document.getElementById('faCnfIn')?.value || '');

  if (!code) { toast("Maxsus kodni kiriting", 'error'); return; }
  if (!validStrongPassword(np)) { toast('Yangi parol kuchsiz (kamida 8, katta-kichik harf va raqam)', 'error'); return; }
  if (np !== cp) { toast('Parollar mos emas', 'error'); return; }

  if (type === 'super') {
    const s = getSuperAdmin();
    if (!s) { toast('Super admin topilmadi', 'error'); return; }
    if (String(s.adminCode || '').toUpperCase() !== code) { toast("Super admin kodi noto'g'ri", 'error'); return; }
    s.password = np;
    await save();
    closeModal('faModal');
    const aType = document.getElementById('aLoginType');
    if (aType) { aType.value = 'super'; toggleAdminLoginType(); }
    document.getElementById('aPwdIn').value = np;
    toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
    return;
  }

  const aid = nNum(document.getElementById('faAdminSel')?.value);
  if (!aid) { toast('Adminni tanlang', 'error'); return; }
  const a = getAdminById(aid);
  if (!a || a.role !== 'admin' || a.status !== 'active') { toast('Admin topilmadi yoki aktiv emas', 'error'); return; }
  if (String(a.adminCode || '').toUpperCase() !== code) { toast("Admin kodi noto'g'ri", 'error'); return; }
  a.password = np;
  await save();
  closeModal('faModal');
  const aType = document.getElementById('aLoginType');
  if (aType) { aType.value = 'admin'; toggleAdminLoginType(); }
  const aSel = document.getElementById('aAdminSel');
  if (aSel) aSel.value = String(aid);
  document.getElementById('aCodeIn').value = code;
  document.getElementById('aPwdIn').value = np;
  toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
}
function openForgotPasswordModal() {
  const teacherEl = document.getElementById('fpTeacherSel');
  const sourceTeacher = document.getElementById('sTeacherSel');
  if (teacherEl && sourceTeacher && sourceTeacher.value) { teacherEl.value = sourceTeacher.value; }
  updForgotStudentOptions();
  ['fpRefIn', 'fpNewIn', 'fpCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  openModal('fpModal');
}
async function doForgotPasswordReset() {
  const tid = nNum(document.getElementById('fpTeacherSel')?.value);
  const sid = nNum(document.getElementById('fpStudentSel')?.value);
  const ref = normRefCode(document.getElementById('fpRefIn')?.value);
  const np = String(document.getElementById('fpNewIn')?.value || '');
  const cp = String(document.getElementById('fpCnfIn')?.value || '');

  if (!tid || !sid) { toast("O'qituvchi va talabani tanlang", 'error'); return; }
  const s = getStudentById(sid);
  if (!s || !(s.teacherIds || [s.teacherId]).includes(tid)) { toast("Talaba topilmadi", 'error'); return; }
  if (!ref) { toast("Referral kod kiriting", 'error'); return; }
  if (normRefCode(s.refCode) !== ref) { toast("Referral kod noto'g'ri", 'error'); return; }
  if (!validStrongPassword(np)) { toast('Yangi parol kuchsiz (kamida 8, katta-kichik harf va raqam)', 'error'); return; }
  if (np !== cp) { toast('Parollar mos emas', 'error'); return; }

  s.password = np;
  await save();
  closeModal('fpModal');
  const sTeacherSel = document.getElementById('sTeacherSel');
  const sLoginSel = document.getElementById('sLoginSel');
  if (sTeacherSel && sLoginSel) {
    sTeacherSel.value = String(tid);
    updStudentLoginOptions();
    sLoginSel.value = String(sid);
  }
  document.getElementById('sPwdIn').value = np;
  toast("Parol yangilandi. Endi 'Kirish'ni bosing.", 'success');
}

function enterS() {
  const s = getStudentById(curId); if (!s) return;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  const brandLogo = document.querySelector('.sb-hex');
  const t = getTeacherById(curTeacherId);
  if (brandLogo) brandLogo.src = (t?.logo || 'teacher.jpg');
  document.getElementById('sbAv').textContent = s.name.slice(0, 2).toUpperCase();
  document.getElementById('sbNm').textContent = s.name;
  document.getElementById('sbRl').textContent = `${s.badge} · D${s.level}`;
  document.getElementById('sNav').style.display = '';
  document.getElementById('tNav').style.display = 'none';
  document.getElementById('studentHeaderMenu').style.display = 'block';
  activeTeacherId = s.teacherIds?.[0] || s.teacherId || teachers[0]?.id;
  updHeaderTeacherMenu();
  document.getElementById('tbRight').innerHTML = '<button id="topbarMsgBell" class="btn btn-outline btn-sm notif-btn" style="position:relative;display:flex;padding:5px 10px;" onclick="showPage(\'msgpg\',document.querySelector(\'#sNav .nav-item:nth-child(5)\'))"><i class="fas fa-bell"></i><span class="bell-count" style="position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-size:10px;border-radius:50%;width:16px;height:16px;display:none;align-items:center;justify-content:center;">0</span></button>';
  renderLb(); renderFLb(); renderHist(); renderProf();
  showPage('dpg', document.querySelector('#sNav .nav-item'));
  startAutoRefresh();
  applyPrefs();
  checkNewMessages();
}

function updHeaderTeacherMenu() {
  const container = document.getElementById('headerTeacherList');
  if (!container || curType !== 'student') return;
  const s = getStudentById(curId);
  if (!s) return;
  const tIds = s.teacherIds || [s.teacherId];
  const myTeachers = teachers.filter(t => tIds.includes(t.id));
  container.innerHTML = myTeachers.map(t => `
    <div class="top-dropdown-item" style="${t.id === activeTeacherId ? 'background:var(--bg-hover); border-left:3px solid var(--gold);' : ''}" onclick="setActiveSubject(${t.id})">
      <img src="${t.logo || 'teacher.jpg'}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
      <div style="flex:1;">
        <div style="font-weight:600; ${t.id === activeTeacherId ? 'color:var(--gold-mid);' : ''}">${escHtml(t.name)}</div>
        <div style="font-size:10px; color:var(--text-dim);">${escHtml(t.subject)}</div>
      </div>
      ${t.id === activeTeacherId ? '<i class="fas fa-check-circle" style="color:var(--green); font-size:12px;"></i>' : ''}
    </div>
  `).join('') || '<div class="top-dropdown-item">O\'qituvchilar topilmadi</div>';
}

window.setActiveSubject = function(tid) {
  activeTeacherId = nNum(tid);
  renderSD(); renderProf(); renderLb(); renderFLb(); renderHist();
  updHeaderTeacherMenu();
  toast(`Fan: ${teachers.find(t => t.id === activeTeacherId)?.subject || 'O\'zgartirildi'}`, 'success');
};

function enterT() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  const brandLogo = document.querySelector('.sb-hex');

  if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId);
    if (brandLogo) brandLogo.src = (t?.logo || 'teacher.jpg');
    document.getElementById('sbAv').textContent = (t?.name || 'OQ').slice(0, 2).toUpperCase();
    document.getElementById('sbNm').textContent = t?.name || "O'qituvchi";
    document.getElementById('sbRl').textContent = t?.subject || "O'qituvchi";
  } else {
    const a = getAdminById(curAdminId);
    if (brandLogo) brandLogo.src = 'teacher.jpg';
    document.getElementById('sbAv').textContent = (a?.name || 'AD').slice(0, 2).toUpperCase();
    document.getElementById('sbNm').textContent = a?.name || 'Admin';
    document.getElementById('sbRl').textContent = isSuperAdmin() ? 'Super Admin' : 'Admin';
  }

  document.getElementById('sNav').style.display = 'none';
  document.getElementById('tNav').style.display = '';
  document.getElementById('studentHeaderMenu').style.display = 'none';
  document.getElementById('tNavTeachers').style.display = isAdmin() ? '' : 'none';
  document.getElementById('tbRight').innerHTML = '<button id="topbarMsgBell" class="btn btn-outline btn-sm notif-btn" style="position:relative;display:flex;padding:5px 10px;" onclick="showPage(\'msgpg\',document.querySelector(\'#tNav .nav-item:nth-child(6)\'))"><i class="fas fa-bell"></i><span class="bell-count" style="position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-size:10px;border-radius:50%;width:16px;height:16px;display:none;align-items:center;justify-content:center;">0</span></button>';
  renderAD(); renderSTbl(); renderTeachersPage(); renderAdminTable(); renderAdminRequests(); renderTeacherProfilePage(); updSels();
  showPage('adpg', document.querySelector('#tNav .nav-item'));
  startAutoRefresh();
  applyPrefs();
  checkNewMessages();
}
function doLogout() {
  stopAutoRefresh();
  const appShell = document.getElementById('appShell');
  if (appShell) {
    appShell.style.opacity = '0';
    appShell.style.transition = 'opacity 0.5s ease-out';
  }
  setTimeout(() => {
    curType = null; curId = null; curTeacherId = null; curAdminId = null;
    const app = document.getElementById('appShell');
    if (app) {
      app.style.display = 'none';
      app.style.opacity = '1';
      app.style.transition = 'none';
    }
    const login = document.getElementById('loginScreen');
    if (login) {
      login.style.display = 'flex';
      login.style.opacity = '0';
      setTimeout(() => {
        if (login) {
          login.style.opacity = '1';
          login.style.transition = 'opacity 0.3s ease-in';
        }
      }, 10);
    }
    ['sPwdIn', 'tPwdIn', 'aPwdIn', 'aCodeIn', 'fpRefIn', 'fpNewIn', 'fpCnfIn', 'ftCodeIn', 'ftNewIn', 'ftCnfIn', 'faCodeIn', 'faNewIn', 'faCnfIn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }, 500);
}

function startAutoRefresh() {
  stopAutoRefresh();
  _refreshTimer = setInterval(async () => {
    if (!curType) return;
    try {
      const d = await load(); if (!d) return;
      normalizeData(d);
      if (curType === 'student' && !getStudentById(curId)) { toast('Hisobingiz topilmadi.', 'error'); doLogout(); return; }
      if (curType === 'teacher' && !getTeacherById(curTeacherId)) { toast("O'qituvchi hisobi topilmadi.", 'error'); doLogout(); return; }
      if (curType === 'admin') { const a = getAdminById(curAdminId); if (!a || a.status !== 'active') { toast('Admin hisobi faol emas', 'error'); doLogout(); return; } }
      refreshCurrentPage();
      checkNewMessages();
      updTeacherLoginOptions(); updAdminLoginOptions(); updStudentLoginOptions(); updSels();
    } catch (e) { }
  }, 30000);
}
function stopAutoRefresh() { if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; } }

function refreshCurrentPage() {
  const activePage = document.querySelector('.page.active')?.id;
  if (activePage === 'dpg') renderSD();
  else if (activePage === 'rpg') { renderLb(); renderFLb(); }
  else if (activePage === 'hpg') renderHist();
  else if (activePage === 'ppg') renderProf();
  else if (activePage === 'adpg') renderAD();
  else if (activePage === 'stpg') renderSTbl();
  else if (activePage === 'tpg') { renderTeachersPage(); renderAdminTable(); renderAdminRequests(); }
  else if (activePage === 'tapg') renderTeacherProfilePage();
  else if (activePage === 'msgpg') renderMessagesPage();
  else if (activePage === 'grppg') renderGroupsPage();
  else if (activePage === 'paypg') renderPaymentReport();
  else if (activePage === 'monitoringpg') renderMonitoringPage();
}

function showPage(pid, el) {
  if (pid === 'tpg' && !isAdmin()) { toast('Bu sahifa faqat adminlar uchun.', 'error'); return; }
  if (pid === 'tapg' && curType === 'student') { toast('Bu sahifa faqat o\'qituvchi/admin uchun.', 'error'); return; }
  if (pid === 'grppg' && curType === 'student') { toast('Bu sahifa faqat o\'qituvchi/admin uchun.', 'error'); return; }
  if (pid === 'paypg' && curType === 'student') { toast('Bu sahifa faqat o\'qituvchi/admin uchun.', 'error'); return; }
  if (pid === 'monitoringpg' && curType === 'student') { toast('Ruxsat berilmagan!', 'error'); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pid)?.classList.add('active');
  const tmap = { dpg: 'Bosh sahifa', rpg: 'Reyting', hpg: 'Faollik tarixi', ppg: 'Profilim', setpg: 'Sozlamalar', adpg: 'Statistika', stpg: 'Talabalar', cpg: 'Tanga boshqaruvi', tpg: "O'qituvchilar va Adminlar", tapg: 'Profil va Xavfsizlik', msgpg: 'Xabarlar', grppg: 'Guruhlar', paypg: 'To\'lov hisoboti', monitoringpg: 'Monitoring', stutpg: "O'qituvchilarim", marketpg: 'Market', planpg: 'Ish rejasi', planmgrpg: 'Ish rejasi boshqaruvi' };
  document.getElementById('tbTitle').textContent = tmap[pid] || '';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  if (pid === 'dpg') renderSD();
  if (pid === 'rpg') renderFLb();
  if (pid === 'hpg') renderHist();
  if (pid === 'ppg') renderProf();
  if (pid === 'setpg') renderSettingsPage();
  if (pid === 'stpg') renderSTbl();
  if (pid === 'adpg') renderAD();
  if (pid === 'tpg') { renderTeachersPage(); renderAdminTable(); renderAdminRequests(); }
  if (pid === 'tapg') renderTeacherProfilePage();
  if (pid === 'msgpg') { renderMessagesPage(); checkNewMessages(); }
  if (pid === 'marketpg' && curType !== 'student') { toast('Market faqat talabalar uchun!', 'error'); return; }
  if (pid === 'marketpg') renderMarketPage();
  if (pid === 'testspg') renderTestsPage();
  if (pid === 'testmgrpg') renderTestMgrPage();
  if (pid === 'stutpg') renderStudentTeachersPage();
  if (pid === 'grppg') renderGroupsPage();
  if (pid === 'paypg') renderPaymentReport();
  if (pid === 'monitoringpg') renderMonitoringPage();
  if (pid === 'marketpg' && curType !== 'student') { toast('Market faqat talabalar uchun!', 'error'); return; }
  if (pid === 'testmgrpg' && curType === 'student') { toast('Ruxsat berilmagan!', 'error'); return; }
  if (pid === 'planpg') renderStudentPlanPage();
  if (pid === 'planmgrpg') renderPlanMgrPage();
  if (pid === 'cpg') updSels();
  closeSB();
}
function renderSD() {
  if (!curId) return;
  const s = getStudentById(curId); if (!s) return;
  const peers = scopeStudents(activeTeacherId);
  document.getElementById('st_c').textContent = s.coins?.[activeTeacherId] || 0;
  document.getElementById('st_l').textContent = s.level;
  document.getElementById('st_b').textContent = s.badge;
  document.getElementById('st_s').textContent = s.streak || 0;
  document.getElementById('st_r').textContent = `#${rank(curId, 'overall', activeTeacherId)}`;
  document.getElementById('st_rs').textContent = `${peers.length} talabadan`;
  if (curType === 'student') {
    document.getElementById('sbIdDisplay').style.display = 'block';
    document.getElementById('sbIdVal').textContent = curId;
  }
  const wk = byModeValue(curId, 'weekly', activeTeacherId);
  document.getElementById('wkf').style.width = Math.min(100, Math.max(0, wk)) + '%';
  document.getElementById('wkt').textContent = `${wk}/100`;
  const l7 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); l7.push(txs.filter(t => t.studentId === curId && t.teacherId === activeTeacherId && t.timestamp >= d.getTime() && t.timestamp < d.getTime() + 86400000).reduce((a, b) => a + b.amount, 0)); }
  const ctx = document.getElementById('wkChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, { type: 'bar', data: { labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'Kecha', 'Bugun'], datasets: [{ label: 'Tanga', data: l7, backgroundColor: 'rgba(43,125,233,.6)', borderColor: '#2b7de9', borderWidth: 1, borderRadius: 5 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#4a5878', font: { size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#4a5878', font: { size: 11 } } } } } });
  const ut = txs.filter(t => t.studentId === curId && t.teacherId === activeTeacherId).slice(0, 8);
  renderNotificationsCard();
  document.getElementById('actList').innerHTML = ut.length ? ut.map(t => `<div class="ai"><span class="at">${escHtml(t.details || 'Faollik')}</span><span class="ac">${t.amount >= 0 ? '+' : ''}${t.amount} 🪙</span></div>`).join('') : '<p style="color:var(--text-dim);text-align:center;padding:14px;font-size:13px;">Hozircha faollik yo\'q</p>';
  document.getElementById('tbRight').innerHTML = `<div class="top-badge tb-gold">🪙 ${s.coins?.[activeTeacherId] || 0}</div><div class="top-badge tb-blue" style="background:rgba(43,233,233,.12);border-color:rgba(43,233,233,.3);color:#80ffff;">💎 ${s.olmos || 0}</div><div class="top-badge tb-blue">🔥 ${s.streak || 0}</div><button id="topbarMsgBell" class="btn btn-outline btn-sm notif-btn" style="position:relative;display:flex;padding:5px 10px;margin-left:6px;" onclick="showPage('msgpg',document.querySelector('#sNav .nav-item:nth-child(5)'))"><i class="fas fa-bell"></i><span class="bell-count" style="position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-size:10px;border-radius:50%;width:16px;height:16px;display:none;align-items:center;justify-content:center;">0</span></button>`;
  checkNewMessages();
}
function renderNotificationsCard() {
  const container = document.getElementById('dashboardNotificationsList');
  if (!container || !curId) return;
  const latest = messages.filter(m => {
    if (m.toType === 'all_students' && curType === 'student') return true;
    if (m.toType === 'specific_student' && nNum(m.toId) === curId) return true;
    if (m.toType === 'teacher_students' && curType === 'student' && nNum(m.toId) === nNum(curTeacherId)) return true;
    if (m.toType === 'all' && curType !== 'student') return true;
    return false;
  }).sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
  if (!latest.length) {
    container.innerHTML = '<p style="color:var(--text-dim);padding:14px;text-align:center;">Yangi bildirishnomalar yo\'q.</p>';
    return;
  }
  container.innerHTML = latest.map(m => {
    const time = new Date(m.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    return `<div style="padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:10px; background:var(--bg-card2);">
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">${time}</div>
      <div style="font-size:13px;color:var(--text);">${escHtml(m.text)}</div>
    </div>`;
  }).join('');
}
window.convertDiamonds = async function () {
  const s = getStudentById(curId);
  if (!s || curType !== 'student') return;
  const today = new Date().toISOString().slice(0, 10);
  if (s.lastDiamondConvertDate === today) { toast('Bugun almashtirish allaqachon bajarildi.', 'error'); return; }
  if ((s.olmos || 0) < 100) { toast('100 olmos yetarli emas!', 'error'); return; }
  s.olmos -= 100;
  s.coins[activeTeacherId] = (s.coins[activeTeacherId] || 0) + 10;
  s.totalCoins += 10;
  s.lastDiamondConvertDate = today;
  txs.push({ id: Date.now(), studentId: s.id, teacherId: activeTeacherId, amount: 10, details: 'Olmosni tangaga almashtirish', timestamp: Date.now() });
  await save();
  renderProf();
  renderSD();
  renderMarketPage();
  toast('100 olmos 10 tangaga almashtirildi!', 'success');
};
function renderLb() {
  const s2 = sorted(lbM, activeTeacherId);
  document.getElementById('lbList').innerHTML = s2.slice(0, 10).map((s, i) => {
    const isTop5 = i < 5;
    const isMe = s.id === curId;
    const topCls = isTop5 ? `top-${i + 1}` : '';
    const meCls = isMe ? 'me' : '';
    return `
      <div class="lb-item ${topCls} ${meCls}">
        <div class="lb-rank">${medals[i] || i + 1}</div>
        <div class="lb-name">${escHtml(s.name)}</div>
        <div class="lb-score">${s.score}🪙</div>
      </div>
    `;
  }).join('');
}
function setLb(mode, btn) { lbM = mode; document.querySelectorAll('.lb1').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderLb(); }
function renderFLb() {
  const s2 = sorted(lbM2, activeTeacherId);
  document.getElementById('flb').innerHTML = `<table style="width:100%"><thead><tr><th>#</th><th>Ism</th><th>Tanga</th><th>Daraja</th><th>Nishon</th></tr></thead><tbody>` +
    s2.map((s, i) => {
      const isTop5 = i < 5;
      const isMe = s.id === curId;
      const rowStyle = isMe ? 'background:rgba(43,125,233,0.15); border:1px solid var(--blue-light);' : (isTop5 ? 'background:rgba(255,215,0,0.03);' : '');
      return `
      <tr style="${rowStyle}">
        <td style="font-family:Rajdhani,sans-serif;font-weight:700;color:${isTop5 ? 'var(--gold)' : 'var(--text-muted)'};">${medals[i] || i + 1}</td>
        <td style="font-weight:${isMe ? 700 : 400};color:${isMe ? 'var(--blue-light)' : 'var(--text)'};">
          ${escHtml(s.name)} ${isMe ? '✓' : ''}
        </td>
        <td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--gold-mid);">${s.score}</td>
        <td><span class="badge bb">D${s.level}</span></td>
        <td><span class="badge bg">${s.badge}</span></td>
      </tr>
    `;
    }).join('') + `</tbody></table>`;
}
function setLb2(mode, btn) { lbM2 = mode; document.querySelectorAll('.lb2').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderFLb(); }
function renderHist() { if (!curId) return; const ut = txs.filter(t => t.studentId === curId && t.teacherId === activeTeacherId); const c = document.getElementById('fhist'); if (!ut.length) { c.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">Faollik yo\'q</p>'; return; } c.innerHTML = ut.map(t => { const dt = new Date(t.timestamp).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }); return `<div class="ai"><div><div class="at">${escHtml(t.details || 'Faollik')}</div><div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${dt}</div></div><span class="ac">${t.amount >= 0 ? '+' : ''}${t.amount} 🪙</span></div>`; }).join(''); }
function renderProf() {
  if (!curId) return;
  const s = getStudentById(curId);
  if (!s) return;
  document.getElementById('pr_n').textContent = s.name;
  document.getElementById('pr_n').className = 'u-nm'; // reset
  document.getElementById('sbNm').className = 'u-nm'; // reset
  document.getElementById('sbAv').className = 'u-av'; // reset

  if (s.inventory) {
    s.inventory.forEach(item => {
      if (item.effect === 'fire-name') { document.getElementById('pr_n').classList.add('fire-name'); document.getElementById('sbNm').classList.add('fire-name'); }
      if (item.effect === 'rainbow-name') { document.getElementById('pr_n').classList.add('rainbow-name'); document.getElementById('sbNm').classList.add('rainbow-name'); }
      if (item.effect === 'thunder-aura') { document.getElementById('sbAv').classList.add('thunder-aura'); }
      if (item.effect === 'diamond-king') { document.getElementById('sbAv').classList.add('diamond-king'); }
      if (item.effect === 'avatar-glow') { document.getElementById('sbAv').style.boxShadow = '0 0 15px var(--blue-light)'; }
      if (item.effect === 'gold-name') { document.getElementById('pr_n').style.color = 'var(--gold)'; document.getElementById('sbNm').style.color = 'var(--gold)'; }
    });
  }

  const currentCoins = s.coins?.[activeTeacherId] || 0;
  document.getElementById('pr_l').innerHTML = `<span class="badge bb">Daraja ${s.level}</span>`;
  document.getElementById('pr_b').innerHTML = `<span class="badge bg">${s.badge}</span>`;
  document.getElementById('pr_c').innerHTML = `${currentCoins} 🪙 | <span style="color:#80ffff;">${s.olmos || 0} 💎</span>`;
  document.getElementById('pr_s').textContent = `🔥 ${s.streak || 0} kun`;
  document.getElementById('pr_w').textContent = byModeValue(curId, 'weekly', activeTeacherId) + ' 🪙';
  document.getElementById('pr_m').textContent = byModeValue(curId, 'monthly', activeTeacherId) + ' 🪙';
  document.getElementById('pr_r').textContent = `#${rank(curId, 'overall', activeTeacherId)} / ${scopeStudents(activeTeacherId).length}`;
  document.getElementById('pr_rc').textContent = s.refCode || `REF${s.id}`;
  document.getElementById('pr_phone').textContent = maskPhone(s.phone);
  document.getElementById('pr_group').textContent = s.group || getTeacherById(s.teacherId)?.group || 'D1';
  document.getElementById('sbRl').textContent = `${s.badge} · D${s.level}`;
  if (curType === 'student') {
    document.getElementById('sbIdDisplay').style.display = 'block';
    document.getElementById('sbIdVal').textContent = curId;
  }
  if (document.getElementById('prNameEdit')) document.getElementById('prNameEdit').value = s.name;
  if (document.getElementById('prPhoneEdit')) document.getElementById('prPhoneEdit').value = s.phone || '';
  renderMessagesPage();
}

function renderStudentTeachersPage() {
  const container = document.getElementById('studentTeachersList');
  if (!container) return;
  if (curType !== 'student') { container.innerHTML = ''; return; }
  const s = getStudentById(curId);
  if (!s) return;
  const tIds = s.teacherIds || [s.teacherId];
  const list = teachers.filter(t => tIds.includes(t.id));
  container.innerHTML = list.map(x => `
    <div class="card" style="display:flex;gap:12px;align-items:center;">
      <img src="${x.logo || 'teacher.jpg'}" alt="Teacher" style="width:64px;height:64px;border-radius:16px;object-fit:cover;border:1px solid var(--border-gold);">
      <div style="flex:1;">
        <div style="font-weight:700;color:var(--gold-light);font-family:Rajdhani,sans-serif;font-size:16px;">${escHtml(x.name || "O'qituvchi")}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${escHtml(x.subject || 'Fan')} ${x.group ? `· ${escHtml(x.group)}` : ''}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="showPage('msgpg', document.querySelector('#sNav .nav-item:nth-child(4)'))"><i class="fas fa-envelope"></i> Xabar</button>
    </div>
  `).join('');
}
function cpRef() { const c = document.getElementById('pr_rc').textContent; navigator.clipboard.writeText(c).then(() => toast('Nusxalandi: ' + c, 'success')); }

async function saveProfileInfo() {
  if (curType === 'student') {
    const s = getStudentById(curId); if (!s) return;
    const name = document.getElementById('prNameEdit')?.value.trim();
    const phone = String(document.getElementById('prPhoneEdit')?.value || '').trim();
    if (!name) { toast('Ismingizni kiriting', 'error'); return; }
    s.name = name; s.phone = phone;
    await save(); renderProf(); renderSTbl(); updStudentLoginOptions(); toast('Profil ma\'lumotlari saqlandi', 'success');
    return;
  }
  if (curType === 'teacher' || curType === 'admin') {
    const name = document.getElementById('tpNameEdit')?.value.trim();
    const group = document.getElementById('tpGroupEdit')?.value.trim();
    if (!name) { toast('Ismingizni kiriting', 'error'); return; }
    if (curType === 'teacher') {
      const t = getTeacherById(curTeacherId); if (!t) return;
      t.name = name; if (group) t.group = group;
      await save(); renderTeacherProfilePage(); renderTeachersPage(); updTeacherLoginOptions(); toast('Profil ma\'lumotlari saqlandi', 'success');
      return;
    }
    const a = getAdminById(curAdminId); if (!a) return;
    a.name = name;
    await save(); renderTeacherProfilePage(); renderAdminTable(); updAdminLoginOptions(); toast('Profil ma\'lumotlari saqlandi', 'success');
    return;
  }
  toast('Avval tizimga kiring', 'error');
}

async function uploadTeacherLogo() {
  if (curType !== 'teacher') { toast('Faqat o\'qituvchi yuklay oladi', 'error'); return; }
  const t = getTeacherById(curTeacherId);
  if (!t) return;
  const input = document.getElementById('tpLogoIn');
  if (!input || !input.files || !input.files.length) { toast('Rasm tanlang', 'error'); return; }
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.status !== 'success') { toast('Yuklashda xato: ' + (data.message || ''), 'error'); return; }
    t.logo = data.url;
    await save();
    const brandLogo = document.querySelector('.sb-hex');
    if (brandLogo) brandLogo.src = t.logo || 'teacher.jpg';
    const prev = document.getElementById('tpLogoPrev');
    if (prev) prev.src = t.logo || 'teacher.jpg';
    toast('Rasm saqlandi!', 'success');
  } catch (e) {
    toast('Yuklashda xato', 'error');
  }
}
window.uploadTeacherLogo = uploadTeacherLogo;

function formatChatMessage(m, currentType, currentId) {
  const fromLabel = m.fromType === 'student' ? 'Talaba' : m.fromType === 'teacher' ? 'O\'qituvchi' : m.fromType === 'admin' ? 'Admin' : escHtml(m.fromType);
  const isMine = m.fromType === currentType && nNum(m.fromId) === nNum(currentId);
  return `<div style="margin-bottom:10px;text-align:${isMine ? 'right' : 'left'}"><div style="display:inline-block;padding:10px;border-radius:12px;background:${isMine ? 'rgba(43,125,233,.9)' : 'rgba(255,255,255,.08)'};color:${isMine ? '#fff' : '#e6eafc'};max-width:85%;line-height:1.4;"><strong style="font-size:12px;display:block;margin-bottom:4px;">${escHtml(fromLabel)}</strong>${escHtml(m.text)}${renderMedia(m)}<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.65);">${new Date(m.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div></div></div>`;
}

function renderStudentChat() {
  if (curType !== 'student') return;
  const s = getStudentById(curId); if (!s) return;
  const msgs = messages.filter(m => {
    if (m.fromType !== 'teacher' && m.fromType !== 'admin') return false;
    if (m.toType === 'student' && nNum(m.toId) === s.id) return true;
    if (m.toType === 'group' && String(m.toId) === String(s.group)) return true;
    if (m.toType === 'all') return true;
    return false;
  }).sort((a, b) => a.timestamp - b.timestamp);
  const box = document.getElementById('studentChatBox'); if (!box) return;
  box.innerHTML = msgs.length ? msgs.map(m => formatChatMessage(m, 'student', s.id)).join('') : '<p style="color:var(--text-dim);padding:12px;">O\'qituvchingizdan xabar yo\'q. Guruh va umumiy xabarlarni tekshiring.</p>';
}

function syncTeacherChatControls() {
  const mode = document.getElementById('tpChatMode')?.value;
  const groupSel = document.getElementById('tpChatGroupSel');
  const studentSel = document.getElementById('tpChatStudentSel');
  if (!groupSel || !studentSel) return;
  groupSel.style.display = mode === 'group' ? '' : 'none';
  studentSel.style.display = mode === 'student' ? '' : 'none';
}

function updateTeacherChatSelect() {
  const studentSel = document.getElementById('tpChatStudentSel');
  const groupSel = document.getElementById('tpChatGroupSel');
  const modeSel = document.getElementById('tpChatMode');
  if (!studentSel || !groupSel || !modeSel) return;
  const list = manageStudents();
  studentSel.innerHTML = list.length ? list.map(s => `<option value="${s.id}">${escHtml(s.name)}${s.group ? ` / ${escHtml(s.group)}` : ''}</option>`).join('') : '<option value="">Talabalar yo\'q</option>';
  const groupNames = Array.from(new Set(list.map(s => String(s.group || '')))).filter(g => g);
  if (curType === 'teacher') {
    const teacher = getTeacherById(curTeacherId);
    if (teacher && teacher.group && !groupNames.includes(teacher.group)) groupNames.unshift(teacher.group);
  }
  groupSel.innerHTML = groupNames.length ? groupNames.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('') : '<option value="">Guruh yo\'q</option>';
  syncTeacherChatControls();
}

function renderTeacherChat() {
  const mode = document.getElementById('tpChatMode')?.value || 'all';
  const studentSel = document.getElementById('tpChatStudentSel');
  const groupSel = document.getElementById('tpChatGroupSel');
  const box = document.getElementById('teacherChatBox');
  if (!studentSel || !groupSel || !box) return;
  const senderType = curType === 'admin' ? 'admin' : 'teacher';
  const senderId = curType === 'admin' ? curAdminId : curTeacherId;
  let targetLabel = 'Barcha talabalar';
  let msgs = [];
  if (mode === 'student') {
    const sid = nNum(studentSel.value) || manageStudents()[0]?.id;
    if (!sid) { box.innerHTML = '<p style="color:var(--text-dim);padding:12px;">Talaba tanlang</p>'; return; }
    studentSel.value = sid;
    const s = getStudentById(sid);
    if (!s) { box.innerHTML = '<p style="color:var(--text-dim);padding:12px;">Talaba topilmadi</p>'; return; }
    targetLabel = `${escHtml(s.name)}`;
    msgs = messages.filter(m => m.fromType === senderType && nNum(m.fromId) === senderId && m.toType === 'student' && nNum(m.toId) === s.id);
  } else if (mode === 'group') {
    const group = String(groupSel.value || getTeacherById(curTeacherId)?.group || '');
    if (!group) { box.innerHTML = '<p style="color:var(--text-dim);padding:12px;">Guruh tanlang</p>'; return; }
    targetLabel = `Guruh: ${escHtml(group)}`;
    msgs = messages.filter(m => m.fromType === senderType && nNum(m.fromId) === senderId && m.toType === 'group' && String(m.toId) === group);
  } else {
    msgs = messages.filter(m => m.fromType === senderType && nNum(m.fromId) === senderId && m.toType === 'all');
  }
  box.innerHTML = `<div style="margin-bottom:12px;color:var(--text-dim);font-size:13px;">${targetLabel}</div>` + (msgs.length ? msgs.map(m => formatChatMessage(m, senderType, senderId)).join('') : '<p style="color:var(--text-dim);padding:12px;">Xabar yo\'q. Yangi xabar yuboring.</p>');
}

async function sendStudentMessage() {
  toast('Faqat o\'qituvchilar xabar yuborishi mumkin.', 'error');
}

async function sendTeacherMessage() {
  if (!isTeacherMode()) { toast('Faqat o\'qituvchi yoki admin xabar yuborishi mumkin.', 'error'); return; }
  const mode = document.getElementById('tpChatMode')?.value || 'all';
  const text = document.getElementById('tpMsgText').value.trim();
  if (!text) { toast('Xabar yozing', 'error'); return; }
  const senderType = curType === 'admin' ? 'admin' : 'teacher';
  const senderId = curType === 'admin' ? curAdminId : curTeacherId;
  let messageRecord = null;
  if (mode === 'student') {
    const sel = document.getElementById('tpChatStudentSel'); if (!sel) return;
    const sid = nNum(sel.value);
    const s = getStudentById(sid);
    if (!s) { toast('Talaba tanlang', 'error'); return; }
    messageRecord = { toType: 'student', toId: s.id };
  } else if (mode === 'group') {
    const sel = document.getElementById('tpChatGroupSel'); if (!sel) return;
    const group = String(sel.value || getTeacherById(curTeacherId)?.group || '');
    if (!group) { toast('Guruh tanlang', 'error'); return; }
    messageRecord = { toType: 'group', toId: group };
  } else {
    messageRecord = { toType: 'all', toId: 0 };
  }
  messages.push({ id: Date.now() + Math.random(), fromType: senderType, fromId: senderId, text, timestamp: Date.now(), ...messageRecord });
  await save(); document.getElementById('tpMsgText').value = ''; renderTeacherChat(); toast('Xabar yuborildi', 'success');
}

function renderAD() {
  const vis = manageStudents();
  const visSet = new Set(vis.map(s => s.id));
  const tc = txs.filter(t => visSet.has(t.studentId)).reduce((a, b) => a + b.amount, 0);
  const ac = vis.filter(s => s.lastDailyDate && ((new Date() - new Date(s.lastDailyDate)) / 864e5 <= 7)).length;
  const rc = txs.filter(t => t.reason === 'referral' && visSet.has(t.studentId)).length;
  document.getElementById('ad_t').textContent = vis.length;
  document.getElementById('ad_c').textContent = tc;
  document.getElementById('ad_a').textContent = ac;
  document.getElementById('ad_r').textContent = rc;
  
  // Salary Calculation (40% of income)
  const incomePerMonth = {};
  txs.filter(t => t.amount > 0 && (t.reason === 'payment' || t.details?.includes('To\'lov'))).forEach(t => {
    const d = new Date(t.timestamp);
    const mKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
    incomePerMonth[mKey] = (incomePerMonth[mKey] || 0) + (t.paySum || (t.amount * 1000)); // fallback to coin amount * 1000 if paySum missing
  });

  const salaryHtml = Object.keys(incomePerMonth).sort().reverse().map(m => {
    const [y, mon] = m.split('-');
    const monthName = new Date(y, mon - 1).toLocaleString('uz-UZ', { month: 'long' });
    const income = incomePerMonth[m];
    const salary = Math.round(income * 0.4);
    return `<div class="ai"><div><div class="at">${monthName} ${y}</div><div style="font-size:10px;color:var(--text-dim);">Jami: ${income.toLocaleString()} so'm</div></div><span class="ac" style="color:var(--gold);">+${salary.toLocaleString()} so'm (40%)</span></div>`;
  }).join('');
  
  const salaryContainer = document.getElementById('adSalaryList');
  if (salaryContainer) salaryContainer.innerHTML = salaryHtml || '<p style="color:var(--text-dim);text-align:center;">Ma\'lumot yo\'q</p>';

  const ranked = sorted('overall', curTeacherId);
  document.getElementById('atop').innerHTML = ranked.slice(0, 18).map((s, i) => `<div class="lb-item"><div class="lb-rank">${medals[i] || i + 1}</div><div class="lb-name">${escHtml(s.name)}</div><div class="lb-score">${s.coins?.[curTeacherId] || 0}🪙</div></div>`).join('');
  document.getElementById('adRankList').innerHTML = ranked.length ? `<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">#</th><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">Ism</th><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">Guruh</th><th style="text-align:right;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);">Tanga</th></tr></thead><tbody>${ranked.map((s, i) => `<tr style="border-bottom:1px solid rgba(255,255,255,.05);"><td style="padding:8px;">${i + 1}</td><td style="padding:8px;">${escHtml(s.name)}</td><td style="padding:8px;">${escHtml(s.group || getTeacherById(s.teacherId)?.group || 'D1')}</td><td style="padding:8px;text-align:right;">${s.coins?.[curTeacherId] || 0} 🪙</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--text-dim);">Talabalar roʻyxati yoʻq</p>';
  
  if (curType === 'admin') { const me = getAdminById(curAdminId); if (me) { const el = document.getElementById('adSelfPass'); if(el){ el.dataset.real = me.password; el.textContent = '******'; el.dataset.visible = '0'; } } }
  else if (curType === 'teacher') { const me = getTeacherById(curTeacherId); if (me) { const el = document.getElementById('adSelfPass'); if(el){ el.dataset.real = me.password; el.textContent = '******'; el.dataset.visible = '0'; } } }
}

let _stFilter = 'active'; // Default to active
window.setStFilter = function (filter, btn) {
  _stFilter = filter;
  document.querySelectorAll('.st-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSTbl();
};

window.toggleStArchive = async function (sid) {
  const s = students.find(x => x.id === sid);
  if (!s) return;
  const isArchiving = s.status !== 'inactive';
  if (isArchiving) {
    if (!confirm(`"${s.name}" arxivga (eski talabalar qatoriga) o'tkazilsinmi?`)) return;
    s.status = 'inactive';
  } else {
    s.status = 'active';
  }
  await save();
  renderSTbl();
  toast(isArchiving ? 'Arxivlandi' : 'Faollashtirildi', 'success');
};

function renderSTbl() {
  let vis = manageStudents();

  if (_stFilter === 'active') vis = vis.filter(s => s.status === 'active' || s.status === 'trial');
  else if (_stFilter === 'trial') vis = vis.filter(s => s.status === 'trial');
  else if (_stFilter === 'inactive') vis = vis.filter(s => s.status === 'inactive');

  const linkedTId = (curType === 'admin') ? (getAdminById(curAdminId)?.linkedTeacherId) : null;
  const sortedStudents = sorted('overall', activeTeacherId);
  let h = '';

  vis.forEach((s, i) => {
    const isMine = linkedTId && (s.teacherIds || [s.teacherId]).includes(linkedTId);
    const isTrial = s.status === 'trial';
    const rowStyle = isMine ? 'style="background:rgba(43, 125, 233, 0.1); border-left: 3px solid var(--blue);"' : (isTrial ? 'style="border-left: 3px solid var(--amber);"' : '');

    const studentRank = sortedStudents.findIndex(x => x.id === s.id) + 1;
    const groupStudents = sortedStudents.filter(x => String(x.group) === String(s.group));
    const groupRank = groupStudents.findIndex(x => x.id === s.id) + 1;
    const rankLabel = groupRank ? `#${studentRank} / #${groupRank}` : `#${studentRank}`;

    // Attendance Calculation (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 864e5;
    const attTxs = txs.filter(t => t.studentId === s.id && t.reason === 'attendance' && t.timestamp >= thirtyDaysAgo).length;
    const attPerc = Math.min(100, Math.round((attTxs / 12) * 100)); // Assuming 12 lessons per month

    // Monthly Payment Status
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();
    const hasPaid = txs.some(t => {
      const d = new Date(t.timestamp);
      return t.studentId === s.id && (t.reason === 'payment' || t.paySum > 0) && d.getMonth() === curMonth && d.getFullYear() === curYear;
    });

    const recentTx = [...txs].reverse().find(t => t.studentId === s.id && t.details);
    const attendanceReason = txs.slice().reverse().find(t => t.studentId === s.id && t.reason && ['attendance', 'manual_minus', 'manual_plus', 'payment'].includes(t.reason));
    const reasonText = attendanceReason?.details || recentTx?.details || (s.status === 'inactive' ? 'Talaba ketdi / arxivlandi' : s.status === 'trial' ? `Sinovda (${s.trialDaysCount || 0}/3)` : 'Oxirgi faoliyat yo‘q');
    const statusLabel = s.status === 'inactive' ? 'Arxivlangan' : s.status === 'trial' ? 'Sinov' : 'Faol';

    const delBtn = isSuperAdmin() ? `<button class="btn btn-danger btn-sm" onclick="delSt(${s.id})" title="O'chirish"><i class="fas fa-trash"></i></button>` : '';
    const archiveBtn = `<button class="btn btn-outline btn-sm" onclick="toggleStArchive(${s.id})" title="${s.status === 'inactive' ? 'Arxivdan chiqarish' : 'Arxivlash'}"><i class="fas ${s.status === 'inactive' ? 'fa-box-open' : 'fa-archive'}"></i></button>`;
    const payBtn = (curType === 'admin') ? `<button class="btn btn-gold btn-sm" onclick="openQuickPay(${s.id})" title="To'lov"><i class="fas fa-money-bill-wave"></i></button>` : '';

    h += `
      <tr ${rowStyle}>
        <td>${i + 1}</td>
        <td>
          <div style="font-weight:600;">${escHtml(s.name)}</div>
          <small style="color:var(--text-dim);">ID: ${s.id}</small>
        </td>
        <td>
          <div class="badge bg">${escHtml(s.group || '-')}</div>
          <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">
            ${(s.teacherIds || [s.teacherId]).map(tid => {
              const t = getTeacherById(tid);
              return t ? escHtml(t.subject) : '';
            }).filter(Boolean).join(', ')}
          </div>
        </td>
        <td>${escHtml(s.phone || '—')}</td>
        <td style="font-family:Rajdhani,sans-serif; font-weight:700; color:var(--gold-mid);">${s.coins?.[activeTeacherId] || 0}</td>
        <td style="font-weight:700; color:var(--cyan);">${rankLabel}</td>
        <td style="font-size:11px; color:var(--text3);">${escHtml(reasonText)}</td>
        <td>
          <span class="status-pill ${s.status === 'inactive' ? 'status-unpaid' : s.status === 'trial' ? 'status-paid' : 'status-paid'}">
            ${statusLabel}
          </span>
        </td>
      </tr>
    `;
  });

  const stBody = document.getElementById('stBody');
  if (stBody) stBody.innerHTML = h || '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-dim);">Talabalar topilmadi</td></tr>';
  renderNewStudents();
}
function renderNewStudents() { const list = manageStudents().slice().sort((a, b) => b.id - a.id).slice(0, 5); const container = document.getElementById('newStudentsList'); if (!container) return; if (!list.length) { container.innerHTML = '<p style="color:var(--text-dim);text-align:center;">Yangi talaba yo\'q</p>'; return; } container.innerHTML = list.map(s => { const t = getTeacherById(s.teacherId); return `<div class="ai" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);"><div><div class="lb-name" style="font-weight:600;">${escHtml(s.name)}</div><div style="font-size:12px;color:var(--text-dim);">${escHtml(t?.name || '')}${t?.group ? ` / ${escHtml(t.group)}` : ''}</div></div><span class="ac">${s.coins?.[activeTeacherId] || 0}🪙</span></div>`; }).join(''); }
async function resetStudentPwd(id) {
  const s = getStudentById(id);
  if (!s) { toast('Talaba topilmadi!', 'error'); return; }
  if (!canManageStudent(s)) { toast("Bu talabaga amalingiz yo'q", 'error'); return; }
  const p = genP(s.name);
  s.password = p;
  await save();
  renderSTbl();
  renderTeacherProfilePage();
  updStudentLoginOptions();
  toast(`${s.name} uchun yangi parol: ${p}`, 'success');
}

function validatePassword(pwd) {
  if (pwd.length < 6) return "Parol kamida 6 ta belgidan iborat bo'lishi kerak.";
  if (!/\d/.test(pwd) || !/[a-zA-Z]/.test(pwd)) return "Parolda ham harf, ham raqam bo'lishi shart.";
  return null;
}

async function doChgPwd() {
  const p1 = document.getElementById('nP').value;
  const p2 = document.getElementById('cnfP').value;
  if (p1 !== p2) { toast('Parollar mos kelmadi', 'error'); return; }
  const err = validatePassword(p1);
  if (err) { toast(err, 'error'); return; }

  if (curType === 'student') {
    const s = getStudentById(curId); if (!s) return;
    s.password = p1;
  } else if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId); if (!t) return;
    t.password = p1;
  }
  await save(); closeModal('cpModal'); toast('Parol yangilandi', 'success');
}

function renderTeacherProfilePage() {
  if (curType === 'student') return;
  let role = '-', name = '-', code = '-', pwd = '';
  let myStudents = [];
  if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId); if (!t) return;
    role = "O'qituvchi"; name = t.name; pwd = t.password;
    code = t.resetCode || '-';
    myStudents = students.filter(s => (s.teacherIds || [s.teacherId]).includes(t.id));
    const prev = document.getElementById('tpLogoPrev');
    if (prev) prev.src = t.logo || 'teacher.jpg';
  } else {
    const a = getAdminById(curAdminId); if (!a) return;
    role = adminLabel(a); name = a.name; pwd = a.password; code = a.adminCode;
    myStudents = isSuperAdmin() ? students : students.filter(s => (s.teacherIds || [s.teacherId]).includes(a.linkedTeacherId));
    const prev = document.getElementById('tpLogoPrev');
    if (prev) prev.src = 'teacher.jpg';
  }
  document.getElementById('tp_role').textContent = role;
  document.getElementById('tp_name').textContent = name;
  document.getElementById('tp_code').textContent = code;
  const pEl = document.getElementById('tp_pwd'); pEl.dataset.real = pwd; pEl.textContent = '******'; pEl.dataset.visible = '0';
  if (document.getElementById('tpNameEdit')) document.getElementById('tpNameEdit').value = name;
  if (document.getElementById('tpGroupEdit')) document.getElementById('tpGroupEdit').value = curType === 'teacher' ? getTeacherById(curTeacherId)?.group || '' : '';
  const tbody = document.getElementById('tpStudentsBody');
  tbody.innerHTML = myStudents.length ? myStudents.map((s, i) => { const studentGroup = escHtml(s.group || getTeacherById(s.teacherId)?.group || 'D1'); return `<tr><td>${i + 1}</td><td>${escHtml(s.name)}</td><td>${studentGroup}</td><td><code class="pwd-mask" data-real="${escHtml(s.password)}">******</code> <button onclick="toggleRowPassword(this)" class="btn btn-outline btn-sm" style="padding:3px 7px;"><i class="fas fa-eye"></i></button></td></tr>`; }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:18px;">Talabalar yo\'q</td></tr>';
  updateTeacherChatSelect(); renderTeacherChat();
}

async function addSt() {
  if (!isTeacherMode()) { toast("Ruxsat yo'q", 'error'); return; }
  const n = document.getElementById('nsName').value.trim(); if (!n) { toast('Ism kiriting!', 'error'); return; }
  const phone = String(document.getElementById('nsPhone').value || '').trim();
  if (!phone) { toast('Telefon raqam majburiy!', 'error'); return; }
  const birthDate = document.getElementById('nsBirthDate').value;
  const tidSelect = document.getElementById('nsTeacher');
  const tIds = Array.from(tidSelect.selectedOptions).map(opt => nNum(opt.value));
  const group = String(document.getElementById('nsGroup').value || '').trim();
  const payType = document.getElementById('nsPayType').value;
  if (!group || !tIds.length) { toast('Guruh va O\'qituvchini tanlang!', 'error'); return; }
  const paid = document.getElementById('nsPaid')?.checked;
  const refInput = normRefCode(document.getElementById('nsRef').value);
  const id = nid++; const p = genP(n);
  const usedRef = new Set(students.map(s => normRefCode(s.refCode)));
  const myRef = uniqueRefCode(id, usedRef);
  const newStudent = { id, teacherIds: tIds, name: n, refCode: myRef, password: p, phone, birthDate, group, coins: {}, totalCoins: 0, olmos: 0, streak: 0, lastDailyDate: null, level: 1, badge: 'Starter', inventory: [], activeEffects: {}, absencesCount: 0, trialDaysCount: 0, status: 'trial' };
  
  if (paid) {
    tIds.forEach(tid => {
       const amt = 15;
       if (!newStudent.coins[tid]) newStudent.coins[tid] = 0;
       newStudent.coins[tid] += amt;
       newStudent.totalCoins += amt;
       txs.unshift({ id: Date.now() + Math.random(), studentId: id, teacherId: tid, amount: amt, reason: 'payment', timestamp: Date.now(), details: `To'lov (15 tanga, ${payType.toUpperCase()})`, payType });
    });
    showReceipt(newStudent, 15, payType, "Ro'yxatdan o'tish");
  }
  
  students.push(newStudent);
  await save();
  if (refInput) {
    const inviter = students.find(s => normRefCode(s.refCode) === refInput);
    if (inviter) await addCoin(inviter.id, 15, 'referral', n + ' qo\'shilgani uchun referral bonus');
  }
  if (phone) {
    sendSmsNotification(phone, 'Salom ' + n + '! Siz ' + group + ' guruhiga muvaffaqiyatli yozildingiz. Parolingiz: ' + p);
  }
  document.getElementById('nsName').value = ''; document.getElementById('nsPhone').value = ''; document.getElementById('nsRef').value = ''; if (document.getElementById('nsPaid')) document.getElementById('nsPaid').checked = false;
  renderSTbl(); updSels(); renderAD(); updStudentLoginOptions(); renderTeacherProfilePage();
  toast(n + ' qo\'shildi! Guruh: ' + group + ', Paroli: ' + p, 'success');
}

function updNsGroupOptions() {
  const tidSelect = document.getElementById('nsTeacher');
  if (!tidSelect) return;
  const tIds = Array.from(tidSelect.selectedOptions).map(opt => nNum(opt.value));
  const groupSel = document.getElementById('nsGroup');
  if (!groupSel || !tIds.length) return;

  const myGroups = groups.filter(g => tIds.includes(g.teacherId)).map(g => g.name);
  const tStudents = students.filter(s => s.teacherIds.some(id => tIds.includes(id)));
  const sGroups = Array.from(new Set(tStudents.map(s => String(s.group || '')).filter(g => g)));
  const allGroups = Array.from(new Set([...myGroups, ...sGroups]));
  if (!allGroups.length) allGroups.push('D1');
  groupSel.innerHTML = allGroups.map(g => '<option value="' + escHtml(g) + '">' + escHtml(g) + '</option>').join('');
}

function updRegGroupOptions() {
  const tidSelect = document.getElementById('regTeacherSel');
  if (!tidSelect) return;
  const tIds = Array.from(tidSelect.selectedOptions).map(opt => nNum(opt.value));
  const groupSel = document.getElementById('regGroup');
  if (!groupSel || !tIds.length) return;

  const myGroups = groups.filter(g => tIds.includes(g.teacherId)).map(g => g.name);
  const tStudents = students.filter(s => s.teacherIds.some(id => tIds.includes(id)));
  const sGroups = Array.from(new Set(tStudents.map(s => String(s.group || '')).filter(g => g)));
  const allGroups = Array.from(new Set([...myGroups, ...sGroups]));
  if (!allGroups.length) allGroups.push('D1');
  groupSel.innerHTML = allGroups.map(g => '<option value="' + escHtml(g) + '">' + escHtml(g) + '</option>').join('');
}

async function delSt(id) {
  if (!confirm("O'chirilsinmi?")) return;
  const numId = nNum(id); const s = getStudentById(numId); if (!canManageStudent(s)) { toast("Ruxsat yo'q", 'error'); return; }
  students = students.filter(x => x.id !== numId); txs = txs.filter(t => t.studentId !== numId);
  await save(); renderSTbl(); renderAD(); updSels(); updStudentLoginOptions(); renderTeacherProfilePage(); toast("O'chirildi", 'success');
}

window.activateSt = async function (sid) {
  const s = getStudentById(sid);
  if (!s || s.status !== 'trial') return;
  if (!confirm(`${s.name} faollashtirilsinmi?`)) return;
  s.status = 'active';
  await save();
  renderSTbl();
  toast(`${s.name} endi faol talaba!`, 'success');
};

window.toggleAttReason = function() {
  // Not needed if we use select
};

window.doAttendance = async function() {
  const sid = nNum(document.getElementById('aSt').value);
  const type = document.getElementById('attType').value;
  if (!sid) { toast('Talabani tanlang!', 'error'); return; }
  const s = getStudentById(sid);
  if (!s) return;

  let amt = 0;
  let reason = 'attendance';
  let details = '';

  if (type === 'present') {
    amt = 5;
    details = "Davomat: Bor (O'z vaqtida)";
    s.absencesCount = 0; 
    if (s.status === 'trial') {
      s.trialDaysCount = (s.trialDaysCount || 0) + 1;
      if (s.trialDaysCount >= 3) {
        s.status = 'active';
        toast(`${s.name} sinov muddati tugadi va faollashtirildi!`, 'success');
      }
    }
  } else if (type === 'late') {
    amt = 2;
    details = "Davomat: Kech qoldi";
    if (s.status === 'trial') {
      s.trialDaysCount = (s.trialDaysCount || 0) + 1;
      if (s.trialDaysCount >= 3) {
        s.status = 'active';
        toast(`${s.name} sinov muddati tugadi va faollashtirildi!`, 'success');
      }
    }
  } else if (type === 'absent_yes') {
    amt = 0;
    details = "Davomat: Yo'q (Sababli)";
  } else if (type === 'absent_no') {
    s.absencesCount = (s.absencesCount || 0) + 1;
    if (s.absencesCount === 1) amt = -10;
    else if (s.absencesCount === 2) amt = -15;
    else {
       amt = -20;
       toast(`${s.name} 3-marta kelmadi. Arxivga o'tkazish tavsiya etiladi.`, 'warning');
    }
    details = `Davomat: Yo'q (Sababsiz, ${s.absencesCount}-marta)`;
    if (s.absencesCount >= 4) {
       s.status = 'inactive';
       toast(`${s.name} ko'p kelmagani sababli chetlatildi (Arxivlandi)`, 'error');
    }
  }

  const ok = await addCoin(sid, amt, reason, details);
  if (ok) {
    renderAD(); updSels(); renderSTbl();
    toast(`${s.name}: ${details}`, 'success');
  }
};

async function addCoin(sid, amt, reason, details, tid = null) {
  const numSid = nNum(sid); const amount = nNum(amt); const s = getStudentById(numSid);
  if (!s) { toast('Talaba topilmadi', 'error'); return false; }
  if (!canManageStudent(s)) { toast("Ruxsat yo'q", 'error'); return false; }
  if (!Number.isFinite(amount) || amount === 0) { toast("Xato miqdor", 'error'); return false; }
  
  const targetTid = tid || curTeacherId || (curType === 'admin' ? getAdminById(curAdminId)?.linkedTeacherId : null) || s.teacherIds?.[0] || s.teacherId;
  if (!targetTid) { toast("O'qituvchi aniqlanmadi", 'error'); return false; }

  if (!s.coins) s.coins = {};
  s.coins[targetTid] = (s.coins[targetTid] || 0) + amount;
  s.totalCoins = Object.values(s.coins).reduce((a, b) => a + b, 0);

  if (amount > 0) { const td = new Date().toDateString(); if (s.lastDailyDate !== td) { s.streak = (s.streak || 0) + 1; s.lastDailyDate = td; } }
  txs.unshift({ id: Date.now() + Math.random(), studentId: numSid, teacherId: targetTid, adminId: (curType === 'admin' ? curAdminId : null), amount, reason, timestamp: Date.now(), details: details || `${reason} ${amount}` });
  updBadges(); await save(); return true;
}
async function giveC(reason, selId, rangeId, label) { const sid = nNum(document.getElementById(selId).value); const amt = parseInt(document.getElementById(rangeId).value, 10); if (!sid) { toast('Talabani tanlang!', 'error'); return; } const ok = await addCoin(sid, amt, reason, `${label} uchun ${amt} tanga`); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); toast(`${getStudentById(sid)?.name || 'Talaba'}ga ${amt} tanga berildi!`, 'success'); }
async function giveManual() {
  const sid = nNum(document.getElementById('mSt').value);
  const amt = parseInt(document.getElementById('mAmt').value, 10);
  const r = document.getElementById('mReason').value.trim();
  const paySum = nNum(document.getElementById('mPaySum').value) || 0;
  const payType = document.getElementById('mPayType').value;

  if (!sid || !amt || !r) { toast("To'liq ma'lumot kiriting", 'error'); return; }

  const details = r + (paySum > 0 ? ` (To'lov: ${paySum} UZS)` : '') + ` (${payType.toUpperCase()})`;
  const ok = await addCoin(sid, amt, 'manual_plus', details);
  if (!ok) return;

  const s = getStudentById(sid);
  if (paySum > 0) showReceipt(s, amt, payType, r);

  renderAD(); updSels(); renderTeacherProfilePage();
  document.getElementById('mAmt').value = '';
  document.getElementById('mReason').value = '';
  document.getElementById('mPaySum').value = '';
  toast(`${s?.name || 'Talaba'}ga ${amt} tanga berildi!`, 'success');
}

let _smsEnabled = true;
window.toggleSmsNotif = function (enabled) {
  _smsEnabled = enabled;
  toast(enabled ? 'SMS xabarnoma yoqildi' : 'SMS xabarnoma o\'chirildi', 'info');
};
function isSmsEnabled() { return _smsEnabled; }
async function deductManual() { const sid = nNum(document.getElementById('dSt').value); const amt = parseInt(document.getElementById('dAmt').value, 10); const r = document.getElementById('dReason').value.trim(); if (!sid || !amt || !r) { toast("To'liq ma'lumot kiriting", 'error'); return; } const ok = await addCoin(sid, -Math.abs(amt), 'manual_minus', `Ayrildi: ${r}`); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); document.getElementById('dAmt').value = ''; document.getElementById('dReason').value = ''; toast(`${getStudentById(sid)?.name || 'Talaba'}dan ${Math.abs(amt)} tanga ayirildi!`, 'success'); }
async function monthlyBonus() { const vis = manageStudents(); if (!vis.length) { toast("Talaba topilmadi", 'error'); return; } const visSet = new Set(vis.map(s => s.id)); const ms = Date.now() - 30 * 864e5; const top = [...vis].map(s => ({ ...s, earn: txs.filter(t => t.studentId === s.id && t.timestamp >= ms && visSet.has(t.studentId)).reduce((a, b) => a + b.amount, 0) })).sort((a, b) => b.earn - a.earn)[0]; if (!top) { toast("Talaba topilmadi", 'error'); return; } const ok = await addCoin(top.id, 50, 'monthly_bonus', 'Oylik eng yaxshi talaba bonusi'); if (!ok) return; renderAD(); updSels(); renderTeacherProfilePage(); toast(`${top.name}ga 50 tanga sovg'a!`, 'success'); }
async function chgTPwd() {
  if (curType === 'teacher') {
    const t = getTeacherById(curTeacherId); if (!t) return;
    const old = prompt("Joriy o'qituvchi paroli:"); if (old === null) return; if (old !== t.password) { toast('Joriy parol xato!', 'error'); return; }
    const np = prompt("Yangi o'qituvchi paroli (kamida 8, harf+raqam):"); if (np === null) return; if (!validStrongPassword(np)) { toast('Parol kuchsiz', 'error'); return; }
    t.password = np; await save(); renderTeacherProfilePage(); renderAD(); toast("O'qituvchi paroli yangilandi!", 'success');
    return;
  }
  if (curType === 'admin') {
    const a = getAdminById(curAdminId); if (!a) return;
    const old = prompt("Joriy parol:"); if (old === null) return; if (old !== a.password) { toast('Joriy parol xato!', 'error'); return; }
    const np = prompt("Yangi parol (kamida 8, harf+raqam):"); if (np === null) return; if (!validStrongPassword(np)) { toast('Parol kuchsiz', 'error'); return; }
    a.password = np; await save(); renderTeacherProfilePage(); renderAD(); toast("Parol yangilandi!", 'success');
    return;
  }
  toast("Avval o'qituvchi/admin sifatida kiring", 'error');
}

async function doChgPwd() {
  const s = getStudentById(curId); if (!s) { toast('Foydalanuvchi topilmadi!', 'error'); return; }
  const o = document.getElementById('oldP').value, n = document.getElementById('newP').value, c = document.getElementById('cnfP').value;
  if (o !== s.password) { toast('Eski parol xato!', 'error'); return; }
  if (!validStrongPassword(n)) { toast('Parol kuchsiz (kamida 8, harf+raqam)', 'error'); return; }
  if (n !== c) { toast('Parollar mos emas', 'error'); return; }
  s.password = n; await save(); closeModal('cpModal'); toast('Parol yangilandi!', 'success');['oldP', 'newP', 'cnfP'].forEach(id => document.getElementById(id).value = '');
}

async function addTeacher() {
  if (!isAdmin()) { toast("Faqat admin qo'sha oladi", 'error'); return; }
  const n = document.getElementById('ntName').value.trim(); const sub = document.getElementById('ntSubj').value.trim(); const group = document.getElementById('ntGroup').value.trim();
  if (!n || !sub) { toast("Ism va fan kiriting", 'error'); return; }
  const p = genP(n); teachers.push({ id: ntid++, name: n, subject: sub, group: group || 'Barcha', password: p, resetCode: genCode('TCH'), isMain: false });
  await save(); document.getElementById('ntName').value = ''; document.getElementById('ntSubj').value = ''; document.getElementById('ntGroup').value = '';
  renderTeachersPage(); updTeacherLoginOptions(); updSels(); toast(`${n} qo'shildi. O'qituvchi paroli: ${p}`, 'success');
}
async function resetTeacherPwd(id, role = 'teacher') {
  if (!isAdmin()) { toast("Faqat admin", 'error'); return; }
  const t = (role === 'teacher') ? getTeacherById(id) : getAdminById(id);
  if (!t) { toast("Topilmadi", 'error'); return; }
  const p = genP(t.name);
  t.password = p;
  await save();
  renderTeacherProfilePage();
  toast(`${t.name} yangi parol: ${p}`, 'success');
}

async function delTeacher(id, role = 'teacher') {
  if (!isSuperAdmin()) { toast("Faqat super admin o'chira oladi", 'error'); return; }
  const t = (role === 'teacher') ? getTeacherById(id) : getAdminById(id);
  if (!t) { toast("Topilmadi", 'error'); return; }
  
  const tid = (role === 'teacher') ? t.id : t.linkedTeacherId;
  if (students.some(s => (s.teacherIds || [s.teacherId]).includes(tid))) {
    toast("Avval shu shaxsning talabalarini o'tkazing", 'error'); return;
  }
  
  if (!confirm("O'chirilsinmi?")) return;
  
  if (role === 'teacher') {
    teachers = teachers.filter(x => x.id !== t.id);
  } else {
    admins = admins.filter(x => x.id !== t.id);
  }
  
  await save();
  renderTeachersPage();
  updTeacherLoginOptions();
  updAdminLoginOptions();
  updSels();
  toast("O'chirildi", 'success');
}

function openAdvanceModal(id, role) {
  const t = (role === 'teacher') ? getTeacherById(id) : getAdminById(id);
  if (!t) return;
  const amt = prompt(`${t.name} uchun avans miqdorini kiriting (UZS):`);
  if (amt === null || isNaN(amt) || amt <= 0) return;
  
  confirmAdvance(id, role, parseInt(amt));
}

async function confirmAdvance(id, role, amt) {
  txs.unshift({
    id: Date.now() + Math.random(),
    teacherId: (role === 'teacher' ? id : null),
    adminId: (role === 'admin' ? id : null),
    amount: -amt,
    reason: 'advance',
    timestamp: Date.now(),
    details: `Avans berildi: ${amt.toLocaleString()} UZS`
  });
  await save();
  renderTeachersPage();
  toast("Avans saqlandi", 'success');
}

function createAdminRecord({ name, password, linkedTeacherId, role = 'admin', status = 'active', createdByAdminId }) { return { id: naid++, name, role, status, password, adminCode: genCode('ADM'), linkedTeacherId: linkedTeacherId ? nNum(linkedTeacherId) : null, createdByAdminId: createdByAdminId || null, createdAt: Date.now() }; }

async function submitAdminAction() {
  if (!isAdmin()) { toast("Faqat admin", 'error'); return; }
  const name = document.getElementById('naName').value.trim();
  const pwd = document.getElementById('naPwd').value;
  const linkedTeacherId = nNum(document.getElementById('naTeacher').value);
  if (!name || !pwd || !linkedTeacherId) { toast("Ism, parol va o'qituvchi tanlang", 'error'); return; }
  const err = validatePassword(pwd);
  if (err) { toast(err, 'error'); return; }
  if (activeAdmins().some(a => a.name.toLowerCase() === name.toLowerCase())) { toast("Bu nomdagi admin bor", 'error'); return; }
  const t = getTeacherById(linkedTeacherId); if (!t) { toast("O'qituvchi topilmadi", 'error'); return; }

  if (isSuperAdmin()) {
    admins.push(createAdminRecord({ name, password: pwd, linkedTeacherId, role: 'admin', status: 'active', createdByAdminId: curAdminId }));
    await save();
    toast(`${name} admin sifatida qo'shildi`, 'success');
  } else {
    const candidate = createAdminRecord({ name, password: pwd, linkedTeacherId, role: 'admin', status: 'pending', createdByAdminId: curAdminId });
    admins.push(candidate);
    adminRequests.push({ id: nrid++, requesterAdminId: curAdminId, candidateAdminId: candidate.id, teacherName: t.name, createdAt: Date.now(), status: 'pending' });
    await save();
    toast(`So'rov super adminga yuborildi`, 'success');
  }

  document.getElementById('naName').value = ''; document.getElementById('naPwd').value = ''; document.getElementById('naTeacher').value = '';
  renderAdminTable(); renderAdminRequests(); renderTeacherProfilePage(); updAdminLoginOptions();
}
async function approveAdminRequest(id) { if (!isSuperAdmin()) { toast("Faqat super admin", 'error'); return; } const req = adminRequests.find(r => r.id === nNum(id)); if (!req) { toast("So'rov topilmadi", 'error'); return; } const cand = getAdminById(req.candidateAdminId); if (!cand) { adminRequests = adminRequests.filter(r => r.id !== req.id); await save(); renderAdminRequests(); return; } cand.status = 'active'; adminRequests = adminRequests.filter(r => r.id !== req.id); await save(); renderAdminTable(); renderAdminRequests(); updAdminLoginOptions(); toast(`${cand.name} tasdiqlandi`, 'success'); }
async function rejectAdminRequest(id) { if (!isSuperAdmin()) { toast("Faqat super admin", 'error'); return; } const req = adminRequests.find(r => r.id === nNum(id)); if (!req) { toast("So'rov topilmadi", 'error'); return; } admins = admins.filter(a => a.id !== req.candidateAdminId); adminRequests = adminRequests.filter(r => r.id !== req.id); await save(); renderAdminTable(); renderAdminRequests(); updAdminLoginOptions(); toast(`So'rov rad etildi`, 'success'); }
async function disableAdmin(id) { if (!isSuperAdmin()) { toast("Faqat super admin", 'error'); return; } const a = getAdminById(id); if (!a || a.role === 'super') { toast("Bu adminni o'chirib bo'lmaydi", 'error'); return; } if (!confirm("Adminlikdan chiqarilsinmi?")) return; admins = admins.filter(x => x.id !== a.id); adminRequests = adminRequests.filter(r => r.requesterAdminId !== a.id && r.candidateAdminId !== a.id); await save(); renderAdminTable(); renderAdminRequests(); updAdminLoginOptions(); toast(`${a.name} adminlikdan chiqarildi`, 'success'); }

function renderAdminTable() {
  const body = document.getElementById('adminBody'); if (!body) return;
  const rows = admins.filter(a => a.role !== 'super').map((a, i) => { const t = getTeacherById(a.linkedTeacherId); const act = isSuperAdmin() ? `<button class="btn btn-danger btn-sm" onclick="disableAdmin(${a.id})"><i class="fas fa-user-slash"></i></button>` : '-'; return `<tr><td>${i + 1}</td><td>${escHtml(a.name)}</td><td>${escHtml(t?.name || '-')}</td><td>${adminLabel(a)}</td><td><span class="badge ${a.status === 'active' ? 'bgg' : 'bg'}">${a.status === 'active' ? 'Aktiv' : 'Kutilmoqda'}</span></td><td>${act}</td></tr>`; }).join('');
  body.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:18px;">Adminlar yo\'q</td></tr>';
}
function renderAdminRequests() {
  const card = document.getElementById('reqCard'); const body = document.getElementById('reqBody'); if (!card || !body) return;
  if (!isSuperAdmin()) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const rows = adminRequests.map((r, i) => { const requester = getAdminById(r.requesterAdminId); const cand = getAdminById(r.candidateAdminId); const created = new Date(r.createdAt).toLocaleString('uz-UZ'); const teacher = getTeacherById(cand?.linkedTeacherId); return `<tr><td>${i + 1}</td><td>${escHtml(requester?.name || '-')}</td><td>${escHtml(cand?.name || '-')}</td><td>${escHtml(teacher?.name || r.teacherName || '-')}</td><td>${created}</td><td><button class="btn btn-success btn-sm" onclick="approveAdminRequest(${r.id})">Tasdiqlash</button> <button class="btn btn-danger btn-sm" onclick="rejectAdminRequest(${r.id})">Rad etish</button></td></tr>`; }).join('');
  body.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:18px;">So\'rovlar yo\'q</td></tr>';
}
function renderTeachersPage() {
  const el = document.getElementById('tBody'); if (!el) return;
  if (!isAdmin()) { el.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:18px;">Faqat admin ko\'ra oladi</td></tr>'; return; }
  
  // Combine teachers and active admins
  const list = [
    ...teachers.map(t => ({ ...t, role: 'teacher' })),
    ...admins.filter(a => a.status === 'active' && a.role === 'admin').map(a => ({ ...a, role: 'admin' }))
  ];

  const rows = list.map((t, i) => {
    const isTeacher = t.role === 'teacher';
    const tid = isTeacher ? t.id : t.linkedTeacherId;
    const myStudents = students.filter(s => (s.teacherIds || [s.teacherId]).includes(tid));
    const cnt = myStudents.length;

    // Income (Sum of paySum in txs)
    const income = txs.filter(tx => tx.paySum > 0 && myStudents.some(s => s.id === tx.studentId)).reduce((a, b) => a + (b.paySum || 0), 0);
    const salary = Math.round(income * 0.4); // 40% salary
    const advance = txs.filter(tx => tx.reason === 'advance' && (isTeacher ? tx.teacherId === t.id : tx.adminId === t.id)).reduce((a, b) => a + Math.abs(b.amount), 0);

    const act = isSuperAdmin() ? `
      <button class="btn btn-outline btn-sm" onclick="resetTeacherPwd(${t.id}, '${t.role}')" title="Parol reset"><i class="fas fa-key"></i></button> 
      <button class="btn btn-danger btn-sm" onclick="delTeacher(${t.id}, '${t.role}')" title="O'chirish"><i class="fas fa-trash"></i></button>
      <button class="btn btn-gold btn-sm" onclick="openAdvanceModal(${t.id}, '${t.role}')" title="Avans berish"><i class="fas fa-hand-holding-usd"></i></button>
    ` : `
      <button class="btn btn-outline btn-sm" onclick="resetTeacherPwd(${t.id}, '${t.role}')"><i class="fas fa-key"></i></button>
    `;

    return `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight:600;">
          ${escHtml(t.name)}
          <div style="font-size:10px; color:var(--text-dim);">${t.role === 'admin' ? 'ADMIN' : 'O\'QITUVCHI'}</div>
        </td>
        <td>${escHtml(t.subject || 'Admin')}${t.group ? ` / ${escHtml(t.group)}` : ''}</td>
        <td><span class="badge bg">${cnt}</span></td>
        <td style="color:var(--green); font-weight:600;">${salary.toLocaleString()}</td>
        <td style="color:var(--blue-light);">${income.toLocaleString()}</td>
        <td style="color:var(--red);">${advance.toLocaleString()}</td>
        <td><div style="display:flex; gap:5px;">${act}</div></td>
      </tr>
    `;
  }).join('');
  el.innerHTML = rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:18px;">Ma\'lumot topilmadi</td></tr>';
}

function toggleSelfPassword(elId, key) { const el = document.getElementById(elId); if (!el) return; const visible = el.dataset.visible === '1'; if (visible) { el.textContent = '******'; el.dataset.visible = '0'; } else { el.textContent = el.dataset.real || '******'; el.dataset.visible = '1'; setTimeout(() => { if (el.dataset.visible === '1') { el.textContent = '******'; el.dataset.visible = '0'; } }, 10000); } }
function toggleRowPassword(btn) { const code = btn.parentElement.querySelector('.pwd-mask'); if (!code) return; const visible = code.dataset.visible === '1'; if (visible) { code.textContent = '******'; code.dataset.visible = '0'; } else { code.textContent = code.dataset.real || '******'; code.dataset.visible = '1'; setTimeout(() => { if (code.dataset.visible === '1') { code.textContent = '******'; code.dataset.visible = '0'; } }, 8000); } }

window.delSt = delSt;
window.updStudentLoginOptions = updStudentLoginOptions;
window.toggleAdminLoginType = toggleAdminLoginType;
window.submitAdminAction = submitAdminAction;
window.approveAdminRequest = approveAdminRequest;
window.rejectAdminRequest = rejectAdminRequest;
window.disableAdmin = disableAdmin;
window.toggleSelfPassword = toggleSelfPassword;
window.toggleRowPassword = toggleRowPassword;
window.addTeacher = addTeacher;
window.resetTeacherPwd = resetTeacherPwd;
window.delTeacher = delTeacher;
window.openForgotPasswordModal = function () {
  openModal('fpModal');
};

window.contactBotForReset = function () {
  const sid = document.getElementById('fpStudentId').value.trim();
  if (!sid) { toast('ID raqamingizni kiriting!', 'error'); return; }

  const s = students.find(x => String(x.id) === sid);
  if (!s) { toast('Bunday ID raqamli talaba topilmadi!', 'error'); return; }

  // Telegram bot linki (bot nomini foydalanuvchi xohishiga ko'ra o'zgartirish mumkin)
  const botUrl = `https://t.me/texnoocom_bot?start=reset_${sid}`;
  window.open(botUrl, '_blank');
  closeModal('fpModal');
  toast('Botga yo\'naltirildingiz', 'success');
};
window.updForgotStudentOptions = updForgotStudentOptions;
window.doForgotPasswordReset = doForgotPasswordReset;
window.resetStudentPwd = resetStudentPwd;
window.openTeacherForgotModal = openTeacherForgotModal;
window.doTeacherForgotReset = doTeacherForgotReset;
window.openAdminForgotModal = openAdminForgotModal;
window.toggleAdminForgotType = toggleAdminForgotType;
window.doAdminForgotReset = doAdminForgotReset;
window.sendStudentMessage = sendStudentMessage;
window.sendTeacherMessage = sendTeacherMessage;
window.renderTeacherChat = renderTeacherChat;

async function registerNewStudent() {
  const tidSelect = document.getElementById('regTeacherSel');
  const tIds = Array.from(tidSelect.selectedOptions).map(opt => nNum(opt.value));
  const grp = document.getElementById('regGroup').value;
  const name = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const paySum = nNum(document.getElementById('regPayAmount').value) || 0;
  const payType = document.getElementById('regPayType').value;

  if (!tIds.length || !grp || !name || !phone) { toast('Barcha majburiy maydonlarni to\'ldiring', 'error'); return; }

  const day = new Date().getDate();
  let bonusCoins = (day <= 15 && paySum > 0) ? 15 : 0;

  const p = genP(name);
  const sid = nid++;
  const sObj = { id: sid, teacherIds: tIds, name, phone, password: p, totalCoins: bonusCoins, olmos: 0, streak: 0, lastDailyDate: null, level: 1, badge: 'Starter', group: grp, refCode: uniqueRefCode(sid, new Set(students.map(s => s.refCode))), inventory: [], activeEffects: {} };

  students.push(sObj);
  if (paySum > 0) {
    txs.push({
      id: Date.now(),
      studentId: sid,
      amount: bonusCoins,
      details: `Ro'yxatdan o'tish (${paySum} UZS)${bonusCoins > 0 ? ' + 15 tanga bonus' : ''}`,
      timestamp: Date.now(),
      payType: payType,
      paySum: paySum
    });
    showReceipt(sObj, paySum, payType, "Ro'yxatdan o'tish");
  }

  await save();
  closeModal('registerModal');
  toast(`${name} muvaffaqiyatli ro'yxatdan o'tdi. Parol: ${p}`, 'success');
  updStudentLoginOptions();
}

function showReceipt(student, amount, type, reason) {
  const content = document.getElementById('receiptContent');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Sana:</span> <span>${new Date().toLocaleString()}</span></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Talaba:</span> <span>${escHtml(student.name)}</span></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>ID:</span> <span>#${student.id}</span></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>To'lov turi:</span> <span>${type.toUpperCase()}</span></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Sabab:</span> <span>${escHtml(reason)}</span></div>
    <div style="border-top:1px solid #000; margin:10px 0; padding-top:5px; font-weight:bold; display:flex; justify-content:space-between; font-size:16px;">
      <span>JAMI:</span> <span>${amount} Tanga</span>
    </div>
  `;
  openModal('receiptModal');
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg, type = 'info') { const c = document.getElementById('tc'); const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 3500); }
function toggleSB() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sbBg').classList.toggle('open'); }
function closeSB() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sbBg').classList.remove('open'); }
function toggleTopMenu() { document.getElementById('topbarMenu').classList.toggle('show'); }
function closeTopMenu() { document.getElementById('topbarMenu').classList.remove('show'); }
window.addEventListener('click', function (e) { if (!e.target.closest('.menu-container')) { closeTopMenu(); } });

let dp = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); dp = e; document.getElementById('installBanner').classList.add('show'); });
document.getElementById('installBtn').addEventListener('click', async () => { if (!dp) return; dp.prompt(); const { outcome } = await dp.userChoice; dp = null; document.getElementById('installBanner').classList.remove('show'); if (outcome === 'accepted') toast('Ilova o\'rnatildi!', 'success'); });
document.getElementById('installDismiss').addEventListener('click', () => document.getElementById('installBanner').classList.remove('show'));
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => { }); }
const mf = { name: "Teacher_texno", short_name: "T_texno", start_url: "./", display: "standalone", background_color: "#1a2235", theme_color: "#1a2235", orientation: "portrait-primary", icons: [{ src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect fill='%231a2235' width='192' height='192' rx='38'/%3E%3Cpolygon points='96,12 172,52 172,140 96,180 20,140 20,52' fill='none' stroke='%23c8a020' stroke-width='6'/%3E%3Ctext x='96' y='112' font-size='52' font-family='Arial' font-weight='bold' fill='%232b7de9' text-anchor='middle'%3ETT%3C/text%3E%3C/svg%3E", sizes: "192x192", type: "image/svg+xml" }, { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect fill='%231a2235' width='512' height='512' rx='100'/%3E%3Cpolygon points='256,30 460,140 460,372 256,482 52,372 52,140' fill='none' stroke='%23c8a020' stroke-width='12'/%3E%3Ctext x='256' y='296' font-size='130' font-family='Arial' font-weight='bold' fill='%232b7de9' text-anchor='middle'%3ETT%3C/text%3E%3C/svg%3E", sizes: "512x512", type: "image/svg+xml" }] };
const ml = document.createElement('link'); ml.rel = 'manifest'; ml.href = URL.createObjectURL(new Blob([JSON.stringify(mf)], { type: 'application/json' })); document.head.appendChild(ml);

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const ls = document.getElementById('loginScreen');
  if (!ls || ls.style.display === 'none') return;
  const sLogin = document.getElementById('sLoginForm');
  const tLogin = document.getElementById('tLoginForm');
  if (sLogin?.style.display !== 'none') doSLogin();
  else if (tLogin?.style.display !== 'none') doTLogin();
  else doALogin();
});

// --- MESSAGING SYSTEM ---
function swMsgTab(tab) {
  document.getElementById('tabMsgReceiveBtn').classList.toggle('active', tab === 'receive');
  document.getElementById('tabMsgSendBtn').classList.toggle('active', tab === 'send');
  document.getElementById('msgReceiveSec').style.display = tab === 'receive' ? 'block' : 'none';
  document.getElementById('msgSendSec').style.display = tab === 'send' ? 'block' : 'none';
}

function updMsgToOptions() {
  const toType = document.getElementById('msgToType').value;
  const teacherWrap = document.getElementById('msgTeacherSelWrap');
  const studentWrap = document.getElementById('msgStudentSelWrap');
  const groupWrap = document.getElementById('msgGroupSelWrap');

  teacherWrap.style.display = 'none';
  studentWrap.style.display = 'none';
  if (groupWrap) groupWrap.style.display = 'none';

  if (toType === 'teacher_students' || toType === 'specific_teacher') {
    if (curType === 'admin') teacherWrap.style.display = 'block';
  } else if (toType === 'specific_student') {
    studentWrap.style.display = 'block';
    if (curType === 'admin') teacherWrap.style.display = 'block';
  } else if (toType === 'group') {
    if (groupWrap) groupWrap.style.display = 'block';
    // guruhlarni to'ldir
    const groupSel = document.getElementById('msgGroupSel');
    if (groupSel) {
      const list = curType === 'teacher' ? students.filter(s => s.teacherId === curTeacherId) : students;
      const groups = Array.from(new Set(list.map(s => String(s.group || '')).filter(g => g)));
      groupSel.innerHTML = groups.length ? groups.map(g => '<option value="' + escHtml(g) + '">' + escHtml(g) + '</option>').join('') : '<option value="">Guruh yo\'q</option>';
    }
  }

  if (toType === 'specific_student') {
    const tId = curType === 'student' ? curTeacherId : (curType === 'teacher' ? curTeacherId : nNum(document.getElementById('msgTeacherSel').value));
    const list = tId ? students.filter(s => s.teacherId === tId) : students;
    const sel = document.getElementById('msgStudentSel');
    sel.innerHTML = list.length ? list.map(s => '<option value="' + s.id + '">' + escHtml(s.name) + '</option>').join('') : '<option value="">Talaba yo\'q</option>';
  }
}

async function sendGlobalMessage() {
  const toType = document.getElementById('msgToType').value;
  const text = document.getElementById('msgText').value.trim();
  const fileInput = document.getElementById('msgMediaIn');
  let mediaUrl = null;

  if (!text && !fileInput.files.length) {
    toast('Xabar matni yoki media kiriting!', 'error');
    return;
  }

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    document.getElementById('btnSendMsg').disabled = true;
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        mediaUrl = data.url;
      } else {
        toast('Fayl yuklashda xato: ' + data.message, 'error');
        document.getElementById('btnSendMsg').disabled = false;
        return;
      }
    } catch (e) {
      toast('Fayl yuklashda xato', 'error');
      document.getElementById('btnSendMsg').disabled = false;
      return;
    }
    document.getElementById('btnSendMsg').disabled = false;
  }

  const senderType = curType;
  const senderId = curType === 'admin' ? curAdminId : (curType === 'teacher' ? curTeacherId : curId);

  let toId = 0;
  if (toType === 'specific_teacher') {
    if (curType === 'student') {
      toId = curTeacherId;
    } else {
      toId = nNum(document.getElementById('msgTeacherSel').value);
    }
    if (!toId) { toast('O\'qituvchini tanlang', 'error'); return; }
  } else if (toType === 'teacher_students') {
    if (curType === 'teacher') {
      toId = curTeacherId;
    } else {
      toId = nNum(document.getElementById('msgTeacherSel').value);
    }
    if (!toId) { toast('O\'qituvchini tanlang', 'error'); return; }
  } else if (toType === 'group') {
    toId = String(document.getElementById('msgGroupSel')?.value || '');
    if (!toId) { toast('Guruhni tanlang', 'error'); return; }
  } else if (toType === 'specific_student') {
    toId = nNum(document.getElementById('msgStudentSel').value);
    if (!toId) { toast('Talabani tanlang', 'error'); return; }
  }

  const newMsg = {
    id: Date.now() + Math.random(),
    fromType: senderType,
    fromId: senderId,
    toType: toType,
    toId: toId,
    text: text,
    media: mediaUrl,
    timestamp: Date.now()
  };

  messages.push(newMsg);
  await save();

  document.getElementById('msgText').value = '';
  document.getElementById('msgMediaIn').value = '';
  toast('Xabar yuborildi', 'success');
  renderMessagesPage();
}

function getSenderName(m) {
  if (m.fromType === 'super_admin' || m.fromType === 'admin') {
    const a = getAdminById(m.fromId);
    return a ? adminLabel(a) + ' ' + a.name : 'Admin';
  }
  if (m.fromType === 'teacher') {
    const t = getTeacherById(m.fromId);
    return t ? "Ustoz " + t.name : 'O\'qituvchi';
  }
  if (m.fromType === 'student') {
    const s = getStudentById(m.fromId);
    return s ? s.name : 'Talaba';
  }
  return 'Noma\'lum';
}

function renderMessageHtml(m, isSent) {
  const dt = new Date(m.timestamp).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const senderName = getSenderName(m);

  let mediaHtml = '';
  if (m.media) {
    const ext = m.media.split('.').pop().toLowerCase();
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
      mediaHtml = `<video src="${m.media}" controls style="max-width:100%; border-radius:12px; margin-top:8px;"></video>`;
    } else {
      mediaHtml = `<img src="${m.media}" style="max-width:100%; border-radius:12px; margin-top:8px; cursor:pointer;" onclick="window.open(this.src)" />`;
    }
  }

  let replyRefHtml = '';
  if (m.replyTo) {
    const rm = messages.find(x => x.id === m.replyTo);
    if (rm) {
      replyRefHtml = `<div class="chat-reply-ref" onclick="scrollToMsg('${rm.id}')">
        <strong>${getSenderName(rm)}:</strong><br>${escHtml(rm.text || 'Media')}
      </div>`;
    }
  }

  let targetStr = '';
  if (isSent) {
    if (m.toType === 'all') targetStr = '➔ Barchaga';
    else if (m.toType === 'all_teachers') targetStr = '➔ Barcha o\'qituvchilarga';
    else if (m.toType === 'all_students') targetStr = '➔ Barcha talabalarga';
    else if (m.toType === 'teacher_students') targetStr = '➔ ' + (getTeacherById(nNum(m.toId))?.name || '') + ' talabalariga';
    else if (m.toType === 'group') targetStr = '➔ Guruh: ' + String(m.toId);
    else targetStr = '➔ ' + (getStudentById(nNum(m.toId))?.name || getTeacherById(nNum(m.toId))?.name || '');
  }

  return `<div class="chat-bubble ${isSent ? 'sent' : 'received'}" id="msg-${m.id}">
    <div class="chat-content">
      ${!isSent ? `<div style="font-size:11px; font-weight:700; color:var(--gold-mid); margin-bottom:4px;">${senderName}</div>` : ''}
      ${replyRefHtml}
      <div style="white-space:pre-wrap;">${escHtml(m.text)}</div>
      ${mediaHtml}
    </div>
    <div class="chat-meta">
      ${isSent ? `<span style="font-size:9px; opacity:0.7;">${targetStr}</span>` : `<span style="cursor:pointer; color:var(--blue-light);" onclick="replyMsg('${m.id}')"><i class="fas fa-reply"></i> Javob</span>`}
      <span>${dt}</span>
      ${isSent ? '<i class="fas fa-check-double" style="font-size:9px; color:var(--blue-light);"></i>' : ''}
    </div>
  </div>`;
}

let _replyingToId = null;

function replyMsg(id) {
  _replyingToId = id;
  const m = messages.find(x => x.id === id);
  if (!m) return;

  const replyPreview = document.getElementById('replyPreview');
  if (replyPreview) {
    replyPreview.style.display = 'flex';
    replyPreview.innerHTML = `
      <div style="flex:1; border-left:3px solid var(--gold); padding-left:8px; font-size:12px; overflow:hidden;">
        <strong style="color:var(--gold);">${getSenderName(m)}</strong><br>
        <span style="color:var(--text-muted);">${escHtml(m.text || 'Media')}</span>
      </div>
      <button class="btn btn-outline btn-sm" onclick="cancelReply()" style="padding:0 5px; height:24px;">✕</button>
    `;
  }
  document.getElementById('msgText')?.focus();
}

function cancelReply() {
  _replyingToId = null;
  const rp = document.getElementById('replyPreview');
  if (rp) rp.style.display = 'none';
}

function scrollToMsg(id) {
  const el = document.getElementById(`msg-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'background 0.5s';
    const oldBg = el.querySelector('.chat-content').style.background;
    el.querySelector('.chat-content').style.background = 'rgba(200, 160, 32, 0.4)';
    setTimeout(() => {
      el.querySelector('.chat-content').style.background = oldBg;
    }, 1500);
  }
}

let lastSeenMessageTime = nNum(localStorage.getItem('lastSeenMessageTime')) || 0;

function renderGlobalMessagesPage() {
  if (!curType) return;

  const toTypeSel = document.getElementById('msgToType');
  if (curType === 'student') {
    toTypeSel.innerHTML = `
      <option value="specific_teacher">O'z o'qituvchimga</option>
      <option value="all_teachers">Barcha o'qituvchilarga (va Adminlarga)</option>
    `;
    document.getElementById('msgTeacherSelWrap').style.display = 'none';
    document.getElementById('msgStudentSelWrap').style.display = 'none';
    document.getElementById('msgGroupSelWrap').style.display = 'none';
  } else if (curType === 'teacher') {
    toTypeSel.innerHTML = `
      <option value="teacher_students">Mening barcha talabalarimga</option>
      <option value="group">Guruhga xabar</option>
      <option value="specific_student">Bitta talabamga</option>
      <option value="all_teachers">Boshqa o'qituvchilar va Adminlarga</option>
    `;
    const tOps = `<option value="${curTeacherId}">${getTeacherById(curTeacherId)?.name}</option>`;
    document.getElementById('msgTeacherSel').innerHTML = tOps;
    document.getElementById('msgTeacherSel').value = curTeacherId;
    updMsgToOptions();
  } else if (curType === 'admin') {
    toTypeSel.innerHTML = `
      <option value="all">Barchaga (O'qituvchilar va Talabalar)</option>
      <option value="all_teachers">Barcha o'qituvchilarga</option>
      <option value="all_students">Barcha talabalarga</option>
      <option value="teacher_students">Bitta o'qituvchining barcha talabalariga</option>
      <option value="group">Guruhga xabar</option>
      <option value="specific_teacher">Bitta o'qituvchiga</option>
      <option value="specific_student">Bitta talabaga</option>
    `;
    const tOps = teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
    document.getElementById('msgTeacherSel').innerHTML = `<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
    updMsgToOptions();
  }

  const senderId = curType === 'admin' ? curAdminId : (curType === 'teacher' ? curTeacherId : curId);

  const sentMsgs = messages.filter(m => m.fromType === curType && nNum(m.fromId) === senderId).sort((a, b) => b.timestamp - a.timestamp);

  const recMsgs = messages.filter(m => {
    if (m.fromType === curType && nNum(m.fromId) === senderId) return false;
    if (m.toType === 'all') return true;
    if (m.toType === 'all_teachers' && (curType === 'admin' || curType === 'teacher')) return true;
    if (m.toType === 'all_students' && curType === 'student') return true;
    if (m.toType === 'teacher_students' && curType === 'student' && nNum(curTeacherId) === nNum(m.toId)) return true;
    if (m.toType === 'specific_teacher' && curType === 'teacher' && nNum(curTeacherId) === nNum(m.toId)) return true;
    if (m.toType === 'specific_teacher' && curType === 'admin') return true;
    if (m.toType === 'specific_student' && curType === 'student' && nNum(curId) === nNum(m.toId)) return true;
    if (m.toType === 'group' && curType === 'student') {
      const s = getStudentById(curId);
      if (s && String(s.group) === String(m.toId)) return true;
    }
    return false;
  }).sort((a, b) => b.timestamp - a.timestamp);

  const sentList = document.getElementById('msgSentList');
  const recList = document.getElementById('msgReceiveList');

  sentList.innerHTML = sentMsgs.length ? sentMsgs.map(m => renderMessageHtml(m, true)).join('') : '<div style="color:var(--text-dim); text-align:center;">Yuborilgan xabarlar yo\'q.</div>';
  recList.innerHTML = recMsgs.length ? recMsgs.map(m => renderMessageHtml(m, false)).join('') : '<div style="color:var(--text-dim); text-align:center;">Kelgan xabarlar yo\'q.</div>';

  if (document.getElementById('msgpg').classList.contains('active')) {
    if (recMsgs.length > 0 && recMsgs[0].timestamp > lastSeenMessageTime) {
      lastSeenMessageTime = recMsgs[0].timestamp;
      localStorage.setItem('lastSeenMessageTime', lastSeenMessageTime);
    }
    document.getElementById('msgUnreadBadge').style.display = 'none';
  }
}

function checkNewMessages() {
  if (!curType) return;
  const senderId = curType === 'admin' ? curAdminId : (curType === 'teacher' ? curTeacherId : curId);
  const myMsgs = messages.filter(m => {
    if (m.fromType === curType && nNum(m.fromId) === senderId) return false;
    if (m.toType === 'all') return true;
    if (m.toType === 'all_teachers' && (curType === 'admin' || curType === 'teacher')) return true;
    if (m.toType === 'all_students' && curType === 'student') return true;
    if (m.toType === 'teacher_students' && curType === 'student' && nNum(curTeacherId) === nNum(m.toId)) return true;
    if (m.toType === 'specific_teacher' && curType === 'teacher' && nNum(curTeacherId) === nNum(m.toId)) return true;
    if (m.toType === 'specific_teacher' && curType === 'admin') return true;
    if (m.toType === 'specific_student' && curType === 'student' && nNum(curId) === nNum(m.toId)) return true;
    if (m.toType === 'group' && curType === 'student') {
      const s = getStudentById(curId);
      if (s && String(s.group) === String(m.toId)) return true;
    }
    return false;
  });

  const newMsgs = myMsgs.filter(m => m.timestamp > lastSeenMessageTime);
  if (newMsgs.length > 0) {
    const msgPage = document.getElementById('msgpg');
    if (!msgPage || !msgPage.classList.contains('active')) {
      const badge = document.getElementById('msgUnreadBadge');
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = newMsgs.length;
      }
      const topBell = document.getElementById('topbarMsgBell');
      if (topBell) {
        topBell.style.display = 'inline-flex';
        topBell.querySelector('.bell-count').textContent = newMsgs.length;
      }
      toast('Sizda ' + newMsgs.length + ' ta yangi xabar bor!', 'info');
    }
  } else {
    const topBell = document.getElementById('topbarMsgBell');
    if (topBell) topBell.style.display = 'none';
  }
}

// --- LESSON SCHEDULE (DARS VAQTLARI) ---
let _lessonTimers = [];
let _lessonSchedule = null;

function loadLessonSchedule() {
  try {
    const raw = localStorage.getItem('lessonSchedule');
    if (raw) _lessonSchedule = JSON.parse(raw);
  } catch (e) { }
}

function saveLessonSchedule() {
  const start = document.getElementById('lessonStartTime').value;
  const end = document.getElementById('lessonEndTime').value;
  const target = document.getElementById('lessonMsgTarget').value;
  const group = document.getElementById('lessonGroupSel')?.value || '';

  if (!start || !end) { toast('Dars boshlanish va tugash vaqtlarini kiriting', 'error'); return; }

  _lessonSchedule = { start, end, target, group };
  localStorage.setItem('lessonSchedule', JSON.stringify(_lessonSchedule));

  setupLessonTimers();
  updateLessonScheduleStatus();
  toast('Dars vaqtlari saqlandi! Avtomatik bildirishnoma ishga tushdi.', 'success');
}

function cancelLessonSchedule() {
  _lessonSchedule = null;
  localStorage.removeItem('lessonSchedule');
  clearLessonTimers();
  document.getElementById('lessonStartTime').value = '';
  document.getElementById('lessonEndTime').value = '';
  updateLessonScheduleStatus();
  toast('Dars vaqtlari bekor qilindi', 'info');
}

function clearLessonTimers() {
  _lessonTimers.forEach(t => clearTimeout(t));
  _lessonTimers = [];
}

function setupLessonTimers() {
  clearLessonTimers();
  if (!_lessonSchedule || !isTeacherMode()) return;

  const now = new Date();
  const today = now.toDateString();

  function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  const startTime = parseTime(_lessonSchedule.start);
  const endTime = parseTime(_lessonSchedule.end);

  // Dars boshlanishi xabari
  const msToStart = startTime.getTime() - now.getTime();
  if (msToStart > 0) {
    const t1 = setTimeout(() => {
      sendAutoLessonMessage('📚 Dars boshlanmoqda! Vaqt: ' + _lessonSchedule.start + '. Darsga tayyorlanib oling!');
    }, msToStart);
    _lessonTimers.push(t1);
  }

  // Dars tugashi xabari
  const msToEnd = endTime.getTime() - now.getTime();
  if (msToEnd > 0) {
    const t2 = setTimeout(() => {
      sendAutoLessonMessage('✅ Dars tugadi! Vaqt: ' + _lessonSchedule.end + '. Baholash davom etmoqda - ball qo\'yilmagan talabalar, diqqat!');
    }, msToEnd);
    _lessonTimers.push(t2);
  }
}

async function sendAutoLessonMessage(text) {
  if (!isTeacherMode() || !_lessonSchedule) return;

  const senderType = curType === 'admin' ? 'admin' : 'teacher';
  const senderId = curType === 'admin' ? curAdminId : curTeacherId;

  let toType = _lessonSchedule.target || 'teacher_students';
  let toId = 0;

  if (toType === 'teacher_students') {
    toId = curType === 'teacher' ? curTeacherId : nNum(curTeacherId);
  } else if (toType === 'group') {
    toId = _lessonSchedule.group || '';
  }

  const msg = {
    id: Date.now() + Math.random(),
    fromType: senderType,
    fromId: senderId,
    toType: toType,
    toId: toId,
    text: text,
    media: null,
    timestamp: Date.now()
  };

  messages.push(msg);
  await save();
  toast('Avtomatik dars xabari yuborildi!', 'success');
  if (document.getElementById('msgpg')?.classList.contains('active')) {
    renderMessagesPage();
  }
}

function updateLessonScheduleStatus() {
  const statusEl = document.getElementById('lessonScheduleStatus');
  if (!statusEl) return;

  if (_lessonSchedule) {
    statusEl.innerHTML = '<span style="color:var(--green);"><i class="fas fa-check-circle"></i> Faol!</span> Dars: <strong>' + _lessonSchedule.start + '</strong> – <strong>' + _lessonSchedule.end + '</strong> · ' + (_lessonSchedule.target === 'group' ? 'Guruh: ' + _lessonSchedule.group : 'Barcha talabalar');
  } else {
    statusEl.innerHTML = '<span style="color:var(--text-dim);">Dars vaqtlari belgilanmagan.</span>';
  }
}

function initLessonScheduleUI() {
  const card = document.getElementById('lessonScheduleCard');
  if (!card) return;

  // Faqat o'qituvchi va admin ko'ra oladi
  if (curType !== 'teacher' && curType !== 'admin') {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  // Guruh tanlash
  const lessonTarget = document.getElementById('lessonMsgTarget');
  const lessonGroupWrap = document.getElementById('lessonGroupSelWrap');
  const lessonGroupSel = document.getElementById('lessonGroupSel');

  if (lessonTarget) {
    lessonTarget.onchange = function () {
      if (lessonGroupWrap) lessonGroupWrap.style.display = this.value === 'group' ? '' : 'none';
    };
  }

  // Guruh variantlarini to'ldir
  if (lessonGroupSel) {
    const list = curType === 'teacher' ? students.filter(s => s.teacherId === curTeacherId) : students;
    const groups = Array.from(new Set(list.map(s => String(s.group || '')).filter(g => g)));
    lessonGroupSel.innerHTML = groups.length ? groups.map(g => '<option value="' + escHtml(g) + '">' + escHtml(g) + '</option>').join('') : '<option value="">Guruh yo\'q</option>';
  }

  // Agar saqlangan bo'lsa inputlarga joylashtir
  loadLessonSchedule();
  if (_lessonSchedule) {
    document.getElementById('lessonStartTime').value = _lessonSchedule.start || '';
    document.getElementById('lessonEndTime').value = _lessonSchedule.end || '';
    if (lessonTarget) lessonTarget.value = _lessonSchedule.target || 'teacher_students';
    if (lessonGroupSel && _lessonSchedule.group) lessonGroupSel.value = _lessonSchedule.group;
    if (lessonGroupWrap) lessonGroupWrap.style.display = _lessonSchedule.target === 'group' ? '' : 'none';
    setupLessonTimers();
  }
  updateLessonScheduleStatus();
}

// Extend renderMessagesPage to also init lesson schedule UI
const _originalRenderMessagesPage = renderMessagesPage;
renderMessagesPage = function () {
  _originalRenderMessagesPage();
  initLessonScheduleUI();
};

// Hide bell when msgpg opened
const _origShowPage = showPage;
showPage = function (pid, el) {
  _origShowPage(pid, el);
  if (pid === 'msgpg') {
    const topBell = document.getElementById('topbarMsgBell');
    if (topBell) topBell.style.display = 'none';
    const badge = document.getElementById('msgUnreadBadge');
    if (badge) badge.style.display = 'none';
  }
};

// GROUPS MANAGEMENT
function renderGroupsPage() {
  const container = document.getElementById('grpList');
  if (!container) return;

  const myGroups = (curType === 'admin' || isSuperAdmin()) ? groups : groups.filter(g => g.teacherId === curTeacherId);

  if (!myGroups.length) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim);">Hozircha guruhlar yo\'q. Yangi guruh yarating.</div>';
  } else {
    container.innerHTML = myGroups.map(g => {
      const gSts = students.filter(s => String(s.group) === String(g.name));
      const studentCount = gSts.length;
      const totalGroupCoins = gSts.reduce((a, b) => a + (b.totalCoins || 0), 0);
      const tuition = g.tuitionPrice || g.price || 0;
      const teacher = getTeacherById(g.teacherId);
      const teacherPhone = teacher?.phone ? escHtml(teacher.phone) : '—';
      const groupScore = studentCount ? Math.round(totalGroupCoins / studentCount) : 0;
      const groupRatings = myGroups.map(x => {
        const gStudents = students.filter(s => String(s.group) === String(x.name));
        const total = gStudents.reduce((sum, st) => sum + (st.totalCoins || 0), 0);
        return { name: x.name, score: total };
      }).sort((a, b) => b.score - a.score);
      const groupRank = groupRatings.findIndex(x => x.name === g.name) + 1;

      return `
        <div class="card pc" style="margin-bottom:16px; border-left: 4px solid var(--gold);">
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <img src="${g.image || 'teacher.jpg'}" class="group-avatar" alt="Group" style="width:50px; height:50px; border-radius:12px;">
            <div style="flex:1; min-width:200px;">
              <h4 style="margin-bottom:4px; color:var(--gold-mid); font-size:18px;">${escHtml(g.name)}</h4>
              <div style="display:grid; grid-template-columns: repeat(2, minmax(160px, 1fr)); gap:8px; font-size:12px; color:var(--text-muted);">
                <span><i class="fas fa-users"></i> ${studentCount} ta talaba</span>
                <span><i class="fas fa-money-bill-wave" style="color:var(--green);"></i> To'lov: ${tuition.toLocaleString()} UZS</span>
                <span><i class="fas fa-coins" style="color:var(--gold);"></i> ${totalGroupCoins} tanga</span>
                <span><i class="fas fa-phone"></i> ${teacherPhone}</span>
                <span><i class="fas fa-star" style="color:var(--gold);"></i> Reyting: #${groupRank} / ${groupRatings.length}</span>
                <span><i class="fas fa-chart-line"></i> O'rtacha: ${groupScore} 🪙</span>
                <span><i class="fas fa-chalkboard-teacher"></i> ${escHtml(teacher?.name || 'Admin')}</span>
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-outline btn-sm" onclick="setGroupTuitionPrice('${escHtml(g.name)}')" title="To'lov narxini belgilash"><i class="fas fa-hand-holding-usd"></i></button>
              <button class="btn btn-outline btn-sm" onclick="openRenameGroup('${escHtml(g.name)}')" title="Nomini o'zgartirish"><i class="fas fa-edit"></i></button>
              <button class="btn btn-blue btn-sm" onclick="openTransferStudents('${escHtml(g.name)}')" title="Ko'chirish"><i class="fas fa-exchange-alt"></i> Ko'chirish</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

async function createGroup() {
  const name = document.getElementById('newGrpName').value.trim();
  const tid = curType === 'admin' ? nNum(document.getElementById('newGrpTeacher').value) : curTeacherId;
  const cat = document.getElementById('newGrpCategory')?.value || 'programmer';

  if (!name || !tid) { toast('Guruh nomi va o\'qituvchi majburiy!', 'error'); return; }
  if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) { toast('Bunday nomli guruh mavjud', 'error'); return; }

  groups.push({ name, teacherId: tid, image: null, createdAt: Date.now(), category: cat });
  await save();
  document.getElementById('newGrpName').value = '';
  renderGroupsPage();
  toast('Guruh yaratildi!', 'success');
}

window.setGroupTuitionPrice = async function (groupName) {
  const g = groups.find(x => x.name === groupName);
  if (!g) return;
  const price = prompt(`"${groupName}" guruhi uchun oylik to'lov summasini kiriting (UZS):`, g.tuitionPrice || '');
  if (price === null) return;
  const numPrice = nNum(price);
  if (isNaN(numPrice)) { toast('To\'g\'ri summa kiriting', 'error'); return; }

  g.tuitionPrice = numPrice;
  await save();
  renderGroupsPage();
  toast('To\'lov narxi yangilandi!', 'success');
};

let _curTransferFrom = null;
window.openTransferStudents = function (fromGrp) {
  _curTransferFrom = fromGrp;
  const infoEl = document.getElementById('transferGrpInfo');
  if (infoEl) infoEl.textContent = `"${fromGrp}" guruhidagi barcha talabalarni ko'chirish`;

  const sel = document.getElementById('transferGrpTargetSel');
  if (!sel) return;
  sel.innerHTML = groups.filter(g => g.name !== fromGrp).map(g => `<option value="${g.name}">${g.name}</option>`).join('');

  if (!sel.innerHTML) { toast('Ko\'chirish uchun boshqa guruh yo\'q', 'warning'); return; }
  openModal('transferGrpModal');
};

window.confirmTransferStudents = async function () {
  const targetGrp = document.getElementById('transferGrpTargetSel').value;
  if (!targetGrp || targetGrp === _curTransferFrom) return;

  let count = 0;
  students.forEach(s => {
    if (String(s.group) === _curTransferFrom) {
      s.group = targetGrp;
      count++;
    }
  });

  if (count > 0) {
    await save();
    renderGroupsPage();
    closeModal('transferGrpModal');
    toast(`${count} ta talaba "${targetGrp}" guruhiga ko'chirildi`, 'success');
  } else {
    toast('Bu guruhda talabalar yo\'q', 'warning');
  }
};

window.openRenameGroup = async function (oldName) {
  const newName = prompt('Guruhning yangi nomini kiriting:', oldName);
  if (newName && newName !== oldName) {
    const g = groups.find(x => x.name === oldName);
    if (g) {
      g.name = newName;
      students.forEach(s => { if (String(s.group) === oldName) s.group = newName; });
      await save();
      renderGroupsPage();
      toast('Guruh nomi o\'zgartirildi', 'success');
    }
  }
};

// PAYMENT REPORT
function renderPaymentReport() {
  const container = document.getElementById('paymentReportTable');
  if (!container) return;

  const myStudents = manageStudents();
  const groupsInScope = Array.from(new Set(myStudents.map(s => String(s.group || 'D1'))));

  container.innerHTML = groupsInScope.map(grpName => {
    const grpStudents = myStudents.filter(s => String(s.group || 'D1') === grpName);
    const paidCount = grpStudents.filter(s => txs.some(t => t.studentId === s.id && t.reason === 'payment')).length;

    return `
      <div style="margin-bottom:24px;">
        <h4 style="margin-bottom:12px; color:var(--gold); border-left:4px solid var(--gold); padding-left:10px;">${escHtml(grpName)} <span style="font-size:12px; font-weight:400; color:var(--text-dim);">(${paidCount}/${grpStudents.length} to'langan)</span></h4>
        <div class="card" style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th style="padding:10px; text-align:left;">Ism</th>
                <th style="padding:10px; text-align:right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${grpStudents.map(s => {
      const hasPaid = txs.some(t => t.studentId === s.id && t.reason === 'payment');
      return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:10px;">${escHtml(s.name)}</td>
                    <td style="padding:10px; text-align:right;">
                      <span class="payment-status ${hasPaid ? 'payment-paid' : 'payment-unpaid'}">
                        ${hasPaid ? 'To\'langan' : 'To\'lanmagan'}
                      </span>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

// TOP 5 REWARDS (MONTHLY)
async function checkTop5Rewards() {
  const now = new Date();
  const isMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
  if (!isMonthEnd) return;

  const lastRewardMonth = localStorage.getItem('lastRewardMonth');
  const currentMonthStr = `${now.getFullYear()}-${now.getMonth()}`;
  if (lastRewardMonth === currentMonthStr) return;

  const top5 = sorted('monthly').slice(0, 5);
  for (const s of top5) {
    const msg = `Tabriklaymiz! Farzandingiz ${s.name} Teacher_texno tizimida oyning TOP 5 talabasi qatoridan joy oldi. Yutuq: Maxsus sovg'a va 50 tanga bonus! Biz bilan bo'lganingiz uchun rahmat.`;
    if (s.phone && isSmsEnabled()) sendSmsNotification(s.phone, msg);

    // System message
    messages.push({
      id: Date.now() + Math.random(),
      fromType: 'admin',
      fromId: 1,
      toType: 'student',
      toId: s.id,
      text: `TABRIKLAYMIZ! Oy yakuniga ko'ra TOP 5 talaba orasidasiz! Sizga 50 tanga bonus va maxsus sovg'a berildi. 🎉`,
      timestamp: Date.now()
    });

    // Add coins
    await addCoin(s.id, 50, 'bonus', 'TOP 5 talaba (oylik)');
  }

  localStorage.setItem('lastRewardMonth', currentMonthStr);
  await save();
}

// LATE ARRIVAL (30 MIN CHECK)
let _lateCheckTimer = null;
function setupLateArrivalCheck() {
  if (_lateCheckTimer) clearInterval(_lateCheckTimer);
  _lateCheckTimer = setInterval(() => {
    if (!_lessonSchedule) return;
    const now = new Date();
    const [h, m] = _lessonSchedule.start.split(':').map(Number);
    const lessonStart = new Date();
    lessonStart.setHours(h, m, 0, 0);

    const diffMin = (now - lessonStart) / 60000;
    if (diffMin >= 30 && diffMin < 35) { // Check between 30-35 mins
      const targetGrp = _lessonSchedule.group;
      const targetStudents = targetGrp ? students.filter(s => String(s.group) === String(targetGrp)) : students.filter(s => s.teacherId === curTeacherId);

      targetStudents.forEach(s => {
        // Check if student has activity today
        const hasActivity = txs.some(t => t.studentId === s.id && new Date(t.timestamp).toDateString() === now.toDateString());
        if (!hasActivity) {
          const msg = `Salom ${s.name}, dars boshlanganiga 30 minut bo'ldi, lekin siz hali darsda emassiz. Hammasi joyidami? Nima uchun darsga kelmadingiz?`;
          // Prevent spamming
          const alreadySent = messages.some(m => m.toId === s.id && m.text.includes('30 minut bo\'ldi') && new Date(m.timestamp).toDateString() === now.toDateString());
          if (!alreadySent) {
            messages.push({
              id: Date.now() + Math.random(),
              fromType: 'teacher',
              fromId: curTeacherId || 1,
              toType: 'student',
              toId: s.id,
              text: msg,
              timestamp: Date.now()
            });
            if (s.phone) sendSmsNotification(s.phone, msg);
          }
        }
      });
      save();
    }
  }, 300000); // Check every 5 mins
}

// Update setupLessonTimers to include late arrival check
const _origSetupLessonTimers = setupLessonTimers;
setupLessonTimers = function () {
  _origSetupLessonTimers();
  setupLateArrivalCheck();
};

// --- MESSAGING (Telegram Style) ---
let selectedChat = null;
let currentChatTab = 'groups'; // 'groups' | 'personal'

function setChatTab(tab) {
  currentChatTab = tab;
  document.getElementById('btnChatGroups').classList.toggle('active', tab === 'groups');
  document.getElementById('btnChatPersonal').classList.toggle('active', tab === 'personal');
  renderMessagesPage();
}

function renderMessagesPage() {
  const chatList = document.getElementById('chatList');
  if (!chatList) return;

  let html = '';

  if (currentChatTab === 'groups') {
    groups.forEach(g => {
      const lastMsg = messages.filter(m => m.toType === 'group' && String(m.toId) === String(g.name)).pop();
      html += `
        <div class="lb-item chat-item ${selectedChat?.type === 'group' && selectedChat?.id === g.name ? 'me' : ''}" onclick="selectChat('group', '${g.name}')" style="cursor:pointer; padding:12px; margin:0; border-bottom:1px solid var(--border);">
          <div class="u-av" style="background:var(--gold);">${g.name[0]}</div>
          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="u-nm" style="font-size:14px;">${escHtml(g.name)}</div>
              <div style="font-size:10px; color:var(--text-dim);">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${lastMsg ? escHtml(lastMsg.text) : 'Xabarlar yo\'q'}
            </div>
          </div>
        </div>
      `;
    });
  } else if (currentChatTab === 'personal') {
    const sSelf = curType === 'student' ? getStudentById(curId) : null;
    const vis = manageStudents();
    vis.forEach(s => {
      if (curType === 'student' && s.id === curId) return;
      const isFriend = sSelf ? (sSelf.friends || []).includes(s.id) : true;
      const hasSent = sSelf ? (sSelf.friendRequestsSent || []).includes(s.id) : false;
      const hasReceived = sSelf ? (sSelf.friendRequests || []).some(r => r.fromId === s.id) : false;

      const lastMsg = messages.filter(m => (m.toType === 'specific_student' && nNum(m.toId) === s.id && nNum(m.fromId) === curId) || (m.fromType === 'student' && nNum(m.fromId) === s.id && nNum(m.toId) === curId)).pop();

      let statusText = 'Suhbatni boshlash';
      let actionHtml = `onclick="selectChat('student', ${s.id})"`;

      if (curType === 'student' && !isFriend) {
        if (hasReceived) {
          statusText = '<span style="color:var(--gold);">Dostlik so\'rovi yuborgan</span>';
          actionHtml = `onclick="acceptFriendRequest(${s.id})"`;
        } else if (hasSent) {
          statusText = 'So\'rov yuborilgan...';
          actionHtml = ``;
        } else {
          statusText = '<span style="color:var(--blue-light);">Dostlik so\'rovi yuboring</span>';
          actionHtml = `onclick="sendFriendRequest(${s.id})"`;
        }
      }

      const sAv = s.avatar ? `<img src="${s.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : s.name[0];
      html += `
        <div class="lb-item chat-item ${selectedChat?.type === 'student' && selectedChat?.id === s.id ? 'me' : ''}" ${actionHtml} style="cursor:pointer; padding:12px; margin:0; border-bottom:1px solid var(--border);">
          <div class="u-av">${sAv}</div>
          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="u-nm" style="font-size:14px;">${escHtml(s.name)} ${s.username ? `<small style="color:var(--text-dim);">(${escHtml(s.username)})</small>` : ''}</div>
              <div style="font-size:10px; color:var(--text-dim);">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${lastMsg ? escHtml(lastMsg.text) : statusText}
            </div>
          </div>
        </div>
      `;
    });
  } else if (currentChatTab === 'teachers') {
    teachers.forEach(t => {
      const lastMsg = messages.filter(m => (m.fromType === 'teacher' && nNum(m.fromId) === t.id && nNum(m.toId) === curId) || (m.toType === 'teacher' && nNum(m.toId) === t.id && nNum(m.fromId) === curId)).pop();
      html += `
        <div class="lb-item chat-item ${selectedChat?.type === 'teacher' && selectedChat?.id === t.id ? 'me' : ''}" onclick="selectChat('teacher', ${t.id})" style="cursor:pointer; padding:12px; margin:0; border-bottom:1px solid var(--border);">
          <div class="u-av" style="background:var(--blue);">${t.name[0]}</div>
          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="u-nm" style="font-size:14px;">${escHtml(t.name)} (Ustoz)</div>
              <div style="font-size:10px; color:var(--text-dim);">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${lastMsg ? escHtml(lastMsg.text) : 'O\'qituvchi bilan bog\'lanish'}
            </div>
          </div>
        </div>
      `;
    });
  } else if (currentChatTab === 'admins') {
    admins.filter(a => a.status === 'active').forEach(a => {
      const lastMsg = messages.filter(m => (m.fromType === 'admin' && nNum(m.fromId) === a.id && nNum(m.toId) === curId) || (m.toType === 'admin' && nNum(m.toId) === a.id && nNum(m.fromId) === curId)).pop();
      html += `
        <div class="lb-item chat-item ${selectedChat?.type === 'admin' && selectedChat?.id === a.id ? 'me' : ''}" onclick="selectChat('admin', ${a.id})" style="cursor:pointer; padding:12px; margin:0; border-bottom:1px solid var(--border);">
          <div class="u-av" style="background:var(--red);">${a.name[0]}</div>
          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="u-nm" style="font-size:14px;">${escHtml(a.name)} (Admin)</div>
              <div style="font-size:10px; color:var(--text-dim);">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${lastMsg ? escHtml(lastMsg.text) : 'Ma\'muriyat bilan bog\'lanish'}
            </div>
          </div>
        </div>
      `;
    });
  }

  chatList.innerHTML = html || '<div style="padding:20px; text-align:center; color:var(--text-dim);">Chatlar mavjud emas</div>';
  if (selectedChat) renderChatHistory();
}

function selectChat(type, id) {
  selectedChat = { type, id };
  document.getElementById('chatHeader').style.display = 'flex';
  document.getElementById('msgInputArea').style.display = 'block';

  let name = '', status = 'online';
  if (type === 'group') name = id;
  else if (type === 'student') name = getStudentById(id)?.name || 'Talaba';
  else if (type === 'teacher') name = getTeacherById(id)?.name || 'O\'qituvchi';

  document.getElementById('chatHeaderNm').textContent = name;
  document.getElementById('chatHeaderAv').textContent = name[0];
  if (type === 'admin') {
    name = getAdminById(id)?.name || 'Admin';
    document.getElementById('chatHeaderNm').textContent = name + ' (Admin)';
    document.getElementById('chatHeaderAv').textContent = 'A';
  }

  renderMessagesPage(); // Update active state
  renderChatHistory();
}

function renderChatHistory() {
  const history = document.getElementById('msgHistory');
  if (!history || !selectedChat) return;

  const sSelf = curType === 'student' ? getStudentById(curId) : null;
  const isBlocked = sSelf && (sSelf.blockedUsers || []).includes(selectedChat.id);
  const amIBlocked = selectedChat.type === 'student' && (getStudentById(selectedChat.id)?.blockedUsers || []).includes(curId);

  if (isBlocked) {
    history.innerHTML = `<div style="margin:auto; text-align:center; color:var(--red); font-size:13px;"><i class="fas fa-ban" style="font-size:32px; margin-bottom:10px;"></i><p>Siz ushbu foydalanuvchini bloklagansiz</p></div>`;
    document.getElementById('msgInputArea').style.display = 'none';
    return;
  }

  if (amIBlocked) {
    history.innerHTML = `<div style="margin:auto; text-align:center; color:var(--text-dim); font-size:13px;"><i class="fas fa-user-slash" style="font-size:32px; margin-bottom:10px;"></i><p>Sizga xabar yuborish taqiqlangan</p></div>`;
    document.getElementById('msgInputArea').style.display = 'none';
    return;
  }

  let msgs = [];
  if (selectedChat.type === 'group') {
    msgs = messages.filter(m => m.toType === 'group' && String(m.toId) === String(selectedChat.id));
  } else if (selectedChat.type === 'student') {
    msgs = messages.filter(m => (m.toType === 'specific_student' && nNum(m.toId) === nNum(selectedChat.id)) || (m.fromType === 'student' && nNum(m.fromId) === nNum(selectedChat.id)));
  } else if (selectedChat.type === 'teacher') {
    msgs = messages.filter(m => (m.toType === 'specific_teacher' && nNum(m.toId) === nNum(selectedChat.id) && nNum(m.fromId) === curId) || (m.fromType === 'teacher' && nNum(m.fromId) === nNum(selectedChat.id) && nNum(m.toId) === curId));
  } else if (selectedChat.type === 'admin') {
    msgs = messages.filter(m => (m.toType === 'admin' && nNum(m.toId) === nNum(selectedChat.id) && nNum(m.fromId) === curId) || (m.fromType === 'admin' && nNum(m.fromId) === nNum(selectedChat.id) && nNum(m.toId) === curId));
  }

  history.innerHTML = msgs.map(m => {
    const isMine = (m.fromType === curType && nNum(m.fromId) === (curType === 'student' ? curId : curType === 'teacher' ? curTeacherId : curAdminId));
    return `
      <div class="chat-bubble ${isMine ? 'sent' : 'received'}">
        <div class="chat-content">
          ${m.replyTo ? `<div class="chat-reply-ref">${escHtml(messages.find(rm => rm.id === m.replyTo)?.text || 'Xabar o\'chirilgan')}</div>` : ''}
          ${escHtml(m.text)}
        </div>
        <div class="chat-meta">
          ${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          ${isMine ? (m.isRead ? '<i class="fas fa-check-double" style="color:var(--blue-light);"></i>' : '<i class="fas fa-check"></i>') : ''}
        </div>
      </div>
    `;
  }).join('');
  history.scrollTop = history.scrollHeight;
}

async function sendMsg() {
  const txt = document.getElementById('msgText').value.trim();
  const fileIn = document.getElementById('msgMediaIn');
  if (!txt && (!fileIn || !fileIn.files[0])) return;
  if (!selectedChat) return;

  const m = {
    id: Date.now() + Math.random(),
    fromType: curType,
    fromId: curType === 'student' ? curId : curType === 'teacher' ? curTeacherId : curAdminId,
    text: txt,
    timestamp: Date.now(),
    toType: selectedChat.type === 'group' ? 'group' : (selectedChat.type === 'admin' ? 'admin' : (selectedChat.type === 'student' ? 'specific_student' : 'specific_teacher')),
    toId: selectedChat.id,
    media: null
  };

  if (fileIn && fileIn.files[0]) {
    const f = fileIn.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      m.media = { type: f.type, data: e.target.result };
      messages.push(m);
      document.getElementById('msgText').value = '';
      fileIn.value = '';
      await save();
      renderChatHistory();
      renderMessagesPage();
    };
    reader.readAsDataURL(f);
  } else {
    messages.push(m);
    document.getElementById('msgText').value = '';
    await save();
    renderChatHistory();
    renderMessagesPage();
  }
}

function renderMedia(m) {
  if (!m.media) return '';
  if (m.media.type.startsWith('image/')) return `<div style="margin-top:8px;"><img src="${m.media.data}" style="max-width:100%;border-radius:8px;"></div>`;
  if (m.media.type.startsWith('video/')) return `<div style="margin-top:8px;"><video src="${m.media.data}" controls style="max-width:100%;border-radius:8px;"></video></div>`;
  if (m.media.type.startsWith('audio/')) return `<div style="margin-top:8px;"><audio src="${m.media.data}" controls style="width:100%;"></audio></div>`;
  return '';
}

// --- TESTS & EXAMS ---
let currentTest = null;
let currentQuestionIndex = 0;
let studentAnswers = [];
let testTimerInterval = null;

function renderTestMgrPage() {
  const grpSel = document.getElementById('newTestGroup');
  if (grpSel) {
    grpSel.innerHTML = groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
  }

  const list = document.getElementById('teacherTestsList');
  if (!list) return;

  const myTests = tests.filter(t => t.teacherId === curTeacherId || isAdmin());
  list.innerHTML = myTests.map(t => `
    <div class="ai" style="padding:15px;">
      <div>
        <div style="font-weight:600;">${escHtml(t.title)}</div>
        <div style="font-size:11px; color:var(--text-dim);">${new Date(t.startTime).toLocaleString()} | ${categoryLabel(t.category)}</div>
      </div>
      <div class="badge bg">${t.questions.length} savol</div>
    </div>
  `).join('') || '<p style="text-align:center; padding:20px; color:var(--text-dim);">Siz yaratgan testlar yo\'q</p>';
}

function generateQuestionInputs() {
  const container = document.getElementById('newTestQuestions');
  let html = '<div style="max-height:400px; overflow-y:auto; padding-right:10px;">';
  for (let i = 1; i <= 20; i++) {
    html += `
      <div class="card pc" style="margin-bottom:10px; background:var(--bg-deep);">
        <label style="font-size:11px; color:var(--gold);">SAVOL ${i}</label>
        <input type="text" class="form-control q-text" placeholder="Savol matni" style="margin-bottom:8px;">
        <div class="g2">
          <input type="text" class="form-control q-a" placeholder="Variant A">
          <input type="text" class="form-control q-b" placeholder="Variant B">
          <input type="text" class="form-control q-c" placeholder="Variant C">
          <select class="form-control q-correct">
            <option value="A">To'g'ri javob: A</option>
            <option value="B">To'g'ri javob: B</option>
            <option value="C">To'g'ri javob: C</option>
          </select>
        </div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

async function saveNewTest() {
  const title = document.getElementById('newTestTitle').value.trim();
  const cat = document.getElementById('newTestCategory').value;
  const start = new Date(document.getElementById('newTestStartTime').value).getTime();
  const group = document.getElementById('newTestGroup').value;

  if (!title || isNaN(start)) { toast('Barcha maydonlarni to\'ldiring', 'error'); return; }

  const qElements = document.querySelectorAll('#newTestQuestions .card');
  const qs = [];
  qElements.forEach(el => {
    qs.push({
      text: el.querySelector('.q-text').value,
      a: el.querySelector('.q-a').value,
      b: el.querySelector('.q-b').value,
      c: el.querySelector('.q-c').value,
      correct: el.querySelector('.q-correct').value
    });
  });

  if (qs.length < 20) { toast('20 ta savol kiritish majburiy!', 'error'); return; }

  tests.push({
    id: Date.now(),
    teacherId: curTeacherId || curAdminId,
    title,
    category: cat,
    startTime: start,
    group,
    questions: qs
  });

  await save();
  toast('Test muvaffaqiyatli yaratildi', 'success');
  showPage('adpg');
}

function renderTestsPage() {
  const container = document.getElementById('availableTests');
  if (!container) return;

  const s = getStudentById(curId);
  const now = Date.now();

  const myTests = tests.filter(t => t.group === s.group);
  container.innerHTML = myTests.map(t => {
    const isStarted = now >= t.startTime;
    const isFinished = now > t.startTime + (2 * 60 * 60 * 1000);

    return `
      <div class="card pc">
        <h4>${escHtml(t.title)}</h4>
        <p style="font-size:12px; color:var(--text-muted);"><span class="category-pill">${categoryBadge(t.category)} ${categoryLabel(t.category)}</span></p>
        <div style="margin-top:10px;">
          <div style="font-size:11px; color:var(--text-dim);">Vaqti: ${new Date(t.startTime).toLocaleString()}</div>
          ${isStarted && !isFinished ? `<button class="btn btn-blue btn-sm btn-block" style="margin-top:10px;" onclick="startTest(${t.id})">Testni boshlash</button>` :
        isFinished ? '<div class="badge red" style="margin-top:10px; width:100%; justify-content:center;">Tugagan</div>' :
          '<div class="badge bg" style="margin-top:10px; width:100%; justify-content:center;">Hali boshlanmagan</div>'}
        </div>
      </div>
    `;
  }).join('') || '<p style="text-align:center; padding:20px; color:var(--text-dim);">Hozircha siz uchun testlar yo\'q</p>';
}

function startTest(id) {
  const t = tests.find(x => x.id === id);
  if (!t) return;

  currentTest = t;
  currentQuestionIndex = 0;
  studentAnswers = new Array(t.questions.length).fill(null);

  document.getElementById('availableTests').style.display = 'none';
  document.getElementById('testTakingView').style.display = 'block';
  document.getElementById('testActiveTitle').textContent = t.title;

  // 2 hour timer
  let timeLeft = 2 * 60 * 60;
  clearInterval(testTimerInterval);
  testTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(testTimerInterval);
      finishTest();
    }
    const h = ~~(timeLeft / 3600);
    const m = ~~((timeLeft % 3600) / 60);
    const s = timeLeft % 60;
    document.getElementById('testTimer').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);

  renderQuestion();
}

function renderQuestion() {
  const q = currentTest.questions[currentQuestionIndex];
  const area = document.getElementById('testQuestionArea');

  area.innerHTML = `
    <div style="margin-bottom:20px; font-size:16px; font-weight:600;">${currentQuestionIndex + 1}. ${escHtml(q.text)}</div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <button class="btn btn-outline chat-item ${studentAnswers[currentQuestionIndex] === 'A' ? 'active' : ''}" onclick="selectAnswer('A')" style="justify-content:flex-start; text-align:left;">A: ${escHtml(q.a)}</button>
      <button class="btn btn-outline chat-item ${studentAnswers[currentQuestionIndex] === 'B' ? 'active' : ''}" onclick="selectAnswer('B')" style="justify-content:flex-start; text-align:left;">B: ${escHtml(q.b)}</button>
      <button class="btn btn-outline chat-item ${studentAnswers[currentQuestionIndex] === 'C' ? 'active' : ''}" onclick="selectAnswer('C')" style="justify-content:flex-start; text-align:left;">C: ${escHtml(q.c)}</button>
    </div>
  `;

  document.getElementById('nextQueBtn').style.display = currentQuestionIndex < 19 ? 'inline-flex' : 'none';
  document.getElementById('finishTestBtn').style.display = currentQuestionIndex === 19 ? 'inline-flex' : 'none';
}

function selectAnswer(ans) {
  studentAnswers[currentQuestionIndex] = ans;
  renderQuestion();
}

function nextQuestion() {
  if (currentQuestionIndex < 19) {
    currentQuestionIndex++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}

async function finishTest() {
  clearInterval(testTimerInterval);
  const t = currentTest;
  let correctCount = 0;

  t.questions.forEach((q, i) => {
    if (studentAnswers[i] === q.correct) correctCount++;
  });

  const diamondsWon = correctCount * 5;
  const examPassed = correctCount >= 16; // Example pass threshold
  const bonusCoins = examPassed ? 20 : 0;
  const bonusDiamonds = examPassed ? 20 : 0;

  const s = getStudentById(curId);
  s.olmos = (s.olmos || 0) + diamondsWon + bonusDiamonds;
  s.totalCoins = (s.totalCoins || 0) + bonusCoins;

  txs.push({
    id: Date.now(),
    studentId: s.id,
    amount: bonusCoins,
    details: `Imtihon natijasi: ${correctCount}/20. Yutilgan: ${diamondsWon + bonusDiamonds}💎`,
    timestamp: Date.now()
  });

  await save();

  alert(`Test yakunlandi!\nTo'g'ri javoblar: ${correctCount}/20\nOlmoslar: +${diamondsWon}${examPassed ? ' + 20 (Bonus)' : ''}\nTangalar: +${bonusCoins}`);

  document.getElementById('testTakingView').style.display = 'none';
  document.getElementById('availableTests').style.display = 'grid';
  currentTest = null;
  showPage('dpg');
}

let marketItems = [
  { id: 1, name: 'Gold Profile', price: 100, type: 'profile_skin', description: 'Profil ismingiz oltin rangda tovlanadi.', effect: 'gold-name', image: 'market_items_pack_1778038942742.png' },
  { id: 2, name: 'Glow Effect', price: 150, type: 'avatar_effect', description: 'Profil rasmingiz atrofida nur paydo bo\'ladi.', effect: 'avatar-glow', image: 'market_items_pack_1778038942742.png' },
  { id: 3, name: 'VIP Badge', price: 200, type: 'badge', description: 'Profilga maxsus VIP nishoni qo\'shiladi.', effect: 'vip-badge', image: 'market_items_pack_1778038942742.png' },
  { id: 4, name: 'Neon Name', price: 120, type: 'profile_skin', description: 'Ismingiz neon rangda porlaydi.', effect: 'neon-name', image: 'market_items_pack_1778038942742.png' },
  { id: 5, name: 'Animated Border', price: 250, type: 'avatar_effect', description: 'Harakatlanuvchi avatar ramkasi.', effect: 'anim-border', image: 'market_items_pack_1778038942742.png' },
  { id: 7, name: 'Fire Profile', price: 400, type: 'profile_skin', description: 'Profil ismingiz olov kabi yonadi.', effect: 'fire-name', image: 'market_items_pack_1778038942742.png' },
  { id: 8, name: 'Rainbow Name', price: 500, type: 'profile_skin', description: 'Ismingiz kamalak ranglarida tovlanadi.', effect: 'rainbow-name', image: 'market_items_pack_1778038942742.png' },
  { id: 9, name: 'Diamond King', price: 700, type: 'badge', description: 'Olmos Qiroli nishoni va maxsus effekt.', effect: 'diamond-king', image: 'market_items_pack_1778038942742.png' },
  { id: 10, name: 'Thunder Aura', price: 600, type: 'avatar_effect', description: 'Avatar atrofida chaqmoqlar chaqadi.', effect: 'thunder-aura', image: 'market_items_pack_1778038942742.png' }
];
const marketEarnTasks = [
  { id: 'phone', title: 'Telefon mini-vazifa', reward: 18, platform: 'Telefon', description: 'Telefon uchun maxsus mini-vazifani bajaring.' },
  { id: 'web', title: 'Web mashqlar', reward: 22, platform: 'Web', description: 'Web bo\'limida tez sinovdan o\'ting.' },
  { id: 'computer', title: 'Kompyuter sinovi', reward: 30, platform: 'Kompyuter', description: 'Kompyuter savodxonligi bo\'yicha bilimlaringizni sinab ko\'ring.' }
];
let mkPage = 1;
const MK_PAGE_SIZE = 24;

function ensureMarketItems() {
  if (!Array.isArray(marketItems)) marketItems = [];
  if (marketItems.length >= 200) return;
  const nextId = Math.max(...marketItems.map(x => nNum(x.id) || 0), 0) + 1;
  const types = ['consumable', 'profile_skin', 'badge', 'avatar_effect'];
  const adjectives = ['Pro', 'Ultra', 'Neo', 'Prime', 'Elite', 'Turbo', 'Aqua', 'Solar', 'Lunar', 'Cyber'];
  const nouns = ['Boost', 'Frame', 'Theme', 'Badge', 'Aura', 'Sticker', 'Glow', 'Spark', 'Trail', 'Token'];
  for (let i = 0; i < 210; i++) {
    const id = nextId + i;
    const type = types[i % types.length];
    const name = `${adjectives[i % adjectives.length]} ${nouns[i % nouns.length]} #${id}`;
    const price = 20 + ((i * 7) % 180); // 20..199
    marketItems.push({
      id,
      name,
      price,
      type,
      description: 'Market mahsuloti. Sotib olib inventory\'ga qo\'shing.',
      effect: `item-${id}`,
      image: 'market_items_pack_1778038942742.png'
    });
  }
}
function mkPrevPage() { mkPage = Math.max(1, mkPage - 1); renderMarketPage(); }
function mkNextPage() { mkPage = mkPage + 1; renderMarketPage(); }
window.mkPrevPage = mkPrevPage;
window.mkNextPage = mkNextPage;

function renderMarketPage() {
  ensureMarketItems();
  const container = document.getElementById('marketItemsList');
  if (!container) return;
  const s = getStudentById(curId);
  document.getElementById('mk_diamonds').textContent = (s?.olmos || 0) + ' 💎';
  const convertInfo = document.getElementById('mkConvertInfo');
  if (convertInfo) {
    const last = s?.lastDiamondConvertDate;
    convertInfo.textContent = last ? `Oxirgi almashtirish: ${last}` : 'Almashtirish amalga oshirilmagan';
  }

  const q = String(document.getElementById('mkSearch')?.value || '').trim().toLowerCase();
  const type = String(document.getElementById('mkType')?.value || 'all');
  const ownedOnly = !!document.getElementById('mkOwnedOnly')?.checked;
  const ownedIds = new Set((s?.inventory || []).map(x => nNum(x.id)));

  const list = marketItems.filter(item => {
    if (type !== 'all' && item.type !== type) return false;
    if (q && !(String(item.name).toLowerCase().includes(q) || String(item.description).toLowerCase().includes(q))) return false;
    if (ownedOnly && !ownedIds.has(nNum(item.id))) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(list.length / MK_PAGE_SIZE));
  if (mkPage > totalPages) mkPage = totalPages;
  if (mkPage < 1) mkPage = 1;
  const pageInfo = document.getElementById('mkPageInfo');
  if (pageInfo) pageInfo.textContent = `${mkPage}/${totalPages}`;

  const start = (mkPage - 1) * MK_PAGE_SIZE;
  const paged = list.slice(start, start + MK_PAGE_SIZE);

  container.innerHTML = paged.map(item => {
    const owned = ownedIds.has(nNum(item.id));
    const btn = owned
      ? `<button class="btn btn-outline btn-sm btn-block" disabled>Olingan</button>`
      : `<button class="btn btn-gold btn-sm btn-block" onclick="buyItem(${item.id})">Sotib olish</button>`;
    const ownedBadge = owned ? `<span class="badge bb" style="position:absolute;top:10px;left:10px;">MENIKI</span>` : '';
    return `
      <div class="card" style="text-align:center; display:flex; flex-direction:column; justify-content:space-between; padding:15px; border:1px solid ${owned ? 'rgba(43,125,233,.35)' : 'var(--border-gold)'}; transition: transform 0.3s; background:var(--bg-card2); position:relative;">
        ${ownedBadge}
        <div style="height:100px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
          <img src="${item.image}" alt="${escHtml(item.name)}" style="max-height:100%; border-radius:8px; object-fit:contain;">
        </div>
        <h4 style="margin-bottom:5px; color:${owned ? 'var(--blue-light)' : 'var(--gold-mid)'};">${escHtml(item.name)}</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:10px; height:30px; overflow:hidden;">${escHtml(item.description)}</p>
        <div style="font-family:Rajdhani,sans-serif; font-weight:700; color:#80ffff; margin-bottom:10px;">${item.price} 💎</div>
        ${btn}
      </div>
    `;
  }).join('') || '<p style="color:var(--text-dim);text-align:center;padding:14px;">Hech narsa topilmadi</p>';
  updateEarnCards();
}

function getEarnStatus(s, id) {
  const today = new Date().toISOString().slice(0, 10);
  return s?.lastEarn?.[id] === today ? false : true;
}

function updateEarnCards() {
  const s = getStudentById(curId);
  if (!s) return;
  const today = new Date().toISOString().slice(0, 10);
  const taskMap = {
    phone: { reward: 18, label: 'Telefon' },
    web: { reward: 22, label: 'Web' },
    computer: { reward: 30, label: 'Kompyuter' }
  };
  Object.keys(taskMap).forEach(key => {
    const id = `earn${key.charAt(0).toUpperCase() + key.slice(1)}Btn`;
    const statusId = `earn${key.charAt(0).toUpperCase() + key.slice(1)}Status`;
    const btn = document.getElementById(id);
    const status = document.getElementById(statusId);
    if (!btn || !status) return;
    const available = getEarnStatus(s, key);
    btn.disabled = !available;
    btn.textContent = available ? `Olish +${taskMap[key].reward} 💎` : 'Bugun bajarildi';
    status.textContent = available ? `Kunlik ${taskMap[key].label}` : `Bugun olindi (${today})`;
  });
}

window.claimEarn = async function (type) {
  const s = getStudentById(curId);
  if (!s) return;
  const taskMap = {
    phone: { reward: 18, name: 'Telefon mini-vazifa' },
    web: { reward: 22, name: 'Web mashqlar' },
    computer: { reward: 30, name: 'Kompyuter sinovi' }
  };
  const task = taskMap[type];
  if (!task) return;
  if (!s.lastEarn) s.lastEarn = {};
  const today = new Date().toISOString().slice(0, 10);
  if (s.lastEarn[type] === today) { toast('Bugun bu vazifa allaqachon bajarildi.', 'error'); return; }
  s.lastEarn[type] = today;
  s.olmos = (s.olmos || 0) + task.reward;
  txs.push({ id: Date.now() + Math.random(), studentId: s.id, amount: task.reward, details: `${task.name} uchun olmos`, timestamp: Date.now() });
  await save();
  renderMarketPage();
  renderProf();
  toast(`${task.name} bajarildi, +${task.reward} 💎 olindi`, 'success');
}

async function buyItem(id) {
  const item = marketItems.find(x => x.id === id);
  if (!item) return;
  const s = getStudentById(curId);
  if (!s) return;
  if ((s.olmos || 0) < item.price) { toast('Olmoslar yetarli emas!', 'error'); return; }
  if (!confirm(`${item.name}ni ${item.price} olmosga sotib olasizmi?`)) return;

  s.olmos -= item.price;
  if (!s.inventory) s.inventory = [];
  s.inventory.push({ ...item, boughtAt: Date.now() });

  await save();
  renderMarketPage();
  renderProf();
  toast(`${item.name} sotib olindi!`, 'success');
}

let _curMoveSid = null;
window.openMoveStudent = function (id) {
  _curMoveSid = id;
  const s = getStudentById(id);
  if (!s) return;
  document.getElementById('moveStudentInfo').textContent = `${s.name} (Guruh: ${s.group || 'D1'})`;
  const sel = document.getElementById('moveStudentGroupSel');
  sel.innerHTML = groups.map(g => `<option value="${g.name}" ${g.name === s.group ? 'selected' : ''}>${g.name}</option>`).join('');
  openModal('moveStudentModal');
};

window.confirmMoveStudent = async function () {
  if (!_curMoveSid) return;
  const s = getStudentById(_curMoveSid);
  const newGrp = document.getElementById('moveStudentGroupSel').value;
  if (!s || !newGrp) return;
  s.group = newGrp;
  await save();
  closeModal('moveStudentModal');
  renderSTbl();
  toast(`${s.name} ${newGrp} guruhiga ko'chirildi`, 'success');
};

let _curPaySid = null;
window.openQuickPay = function (id) {
  _curPaySid = id;
  const s = getStudentById(id);
  if (!s) return;
  document.getElementById('quickPayInfo').textContent = `${s.name} uchun to'lov qabul qilish`;
  openModal('quickPayModal');
};

window.confirmQuickPay = async function () {
  if (!_curPaySid) return;
  const s = getStudentById(_curPaySid);
  const paySum = nNum(document.getElementById('quickPayAmt').value);
  const type = document.getElementById('quickPayType').value;
  if (!s || paySum <= 0) { toast('To\'g\'ri summa kiriting', 'error'); return; }

  const day = new Date().getDate();
  let bonusCoins = 0;
  let bonusDetails = "";
  if (day <= 15) {
    bonusCoins = 15;
    bonusDetails = " (15 tanga bonus)";
    s.totalCoins = (s.totalCoins || 0) + bonusCoins;
  }

  txs.push({
    id: Date.now(),
    studentId: s.id,
    amount: bonusCoins,
    details: `To'lov: ${paySum} UZS${bonusDetails}`,
    timestamp: Date.now(),
    payType: type,
    paySum: paySum
  });

  await save();
  showReceipt(s, paySum, type, "Oylik to'lov");
  closeModal('quickPayModal');
  renderSTbl();
  toast(`To'lov saqlandi: ${paySum} UZS` + (bonusCoins > 0 ? ` + ${bonusCoins} tanga bonus!` : ''), 'success');
};

window.renderMonitoringPage = function () {
  const container = document.getElementById('monitoringList');
  if (!container) return;
  const sortedMsgs = [...messages].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  container.innerHTML = sortedMsgs.map(m => {
    let from = 'Noma\'lum', to = 'Noma\'lum';
    if (m.fromType === 'student') from = getStudentById(m.fromId)?.name || 'Talaba';
    else if (m.fromType === 'teacher') from = getTeacherById(m.fromId)?.name || 'O\'qituvchi';
    else if (m.fromType === 'admin') from = getAdminById(m.fromId)?.name || 'Admin';
    if (m.toType === 'group') to = `Guruh: ${m.toId}`;
    else if (m.toType === 'specific_student') to = getStudentById(m.toId)?.name || 'Talaba';
    else if (m.toType === 'teacher') to = getTeacherById(m.toId)?.name || 'O\'qituvchi';
    else if (m.toType === 'admin') to = getAdminById(m.toId)?.name || 'Admin';
    const time = new Date(m.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    return `<tr><td style="font-size:11px; color:var(--text-dim);">${time}</td><td style="font-weight:600; color:var(--blue-light);">${escHtml(from)}</td><td style="font-weight:600; color:var(--gold-mid);">${escHtml(to)}</td><td style="font-size:13px;">${escHtml(m.text)}</td></tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-dim);">Xabarlar yo\'q</td></tr>';
};

window.sendFriendRequest = async function (toId) {
  const s = getStudentById(curId);
  if (!s.friendRequestsSent) s.friendRequestsSent = [];
  if (s.friendRequestsSent.includes(toId)) { toast('So\'rov yuborilgan', 'warning'); return; }
  const target = getStudentById(toId);
  if (!target.friendRequests) target.friendRequests = [];
  target.friendRequests.push({ fromId: curId, timestamp: Date.now() });
  s.friendRequestsSent.push(toId);
  await save();
  renderMessagesPage();
  toast('Do\'stlik so\'rovi yuborildi', 'success');
};

window.acceptFriendRequest = async function (fromId) {
  const s = getStudentById(curId);
  if (!s.friends) s.friends = [];
  s.friends.push(fromId);
  s.friendRequests = (s.friendRequests || []).filter(r => r.fromId !== fromId);
  const sender = getStudentById(fromId);
  if (!sender.friends) sender.friends = [];
  sender.friends.push(curId);
  await save();
  renderMessagesPage();
  toast('Do\'stlik so\'rovi qabul qilindi', 'success');
};

window.openTransferModal = function () {
  if (selectedChat?.type !== 'student') return;
  const s = getStudentById(curId);
  document.getElementById('transferDiaLimit').textContent = `Mavjud olmoslar: ${s?.olmos || 0} 💎`;
  openModal('transferDiamondModal');
};

window.confirmTransferDiamond = async function () {
  const amt = nNum(document.getElementById('transferDiaAmt').value);
  if (amt <= 0) { toast('To\'g\'ri miqdor kiriting', 'error'); return; }

  const sSender = getStudentById(curId);
  const sReceiver = getStudentById(selectedChat.id);

  if (!sSender || !sReceiver) return;
  if ((sSender.olmos || 0) < amt) { toast('Olmoslar yetarli emas!', 'error'); return; }

  sSender.olmos -= amt;
  sReceiver.olmos = (sReceiver.olmos || 0) + amt;

  // Record transaction
  txs.push({
    id: Date.now(),
    studentId: sSender.id,
    amount: -amt,
    details: `${sReceiver.name}ga olmos yuborildi`,
    timestamp: Date.now(),
    isDiamond: true
  });
  txs.push({
    id: Date.now() + 1,
    studentId: sReceiver.id,
    amount: amt,
    details: `${sSender.name}dan olmos qabul qilindi`,
    timestamp: Date.now(),
    isDiamond: true
  });

  // Send notification message
  messages.push({
    id: Date.now() + 2,
    fromType: 'admin',
    fromId: 1,
    toType: 'specific_student',
    toId: sReceiver.id,
    text: `Sizga ${sSender.name}dan ${amt} 💎 sovg'a qilindi!`,
    timestamp: Date.now()
  });

  await save();
  closeModal('transferDiamondModal');
  renderProf();
  toast('Olmos muvaffaqiyatli yuborildi!', 'success');
};

window.toggleBlockUser = async function () {
  if (selectedChat?.type !== 'student') return;
  const s = getStudentById(curId);
  if (!s.blockedUsers) s.blockedUsers = [];

  const idx = s.blockedUsers.indexOf(selectedChat.id);
  if (idx > -1) {
    s.blockedUsers.splice(idx, 1);
    toast('Foydalanuvchi blokdan chiqarildi', 'info');
  } else {
    if (!confirm('Ushbu foydalanuvchini bloklamoqchimisiz? U sizga xabar yubora olmaydi.')) return;
    s.blockedUsers.push(selectedChat.id);
    toast('Foydalanuvchi bloklandi', 'warning');
  }

  await save();
  renderMessagesPage();
  renderChatHistory();
};

const _origSelectChat = typeof selectChat !== 'undefined' ? selectChat : function () { };
selectChat = function (type, id) {
  _origSelectChat(type, id);
  const actions = document.getElementById('chatHeaderActions');
  if (actions) {
    actions.style.display = (type === 'student' && curType === 'student') ? 'flex' : 'none';
    if (type === 'student' && curType === 'student') {
      const s = getStudentById(curId);
      const isBlocked = s && (s.blockedUsers || []).includes(id);
      document.getElementById('btnBlockUser').innerHTML = isBlocked ? '<i class="fas fa-user-check"></i>' : '<i class="fas fa-user-slash"></i>';
      document.getElementById('btnBlockUser').title = isBlocked ? 'Blokdan chiqarish' : 'Bloklash';
    }
  }
}

// Mark messages as seen when opening msgpg
const _origShowPageNotif = showPage;
showPage = function (pid, el) {
  _origShowPageNotif(pid, el);
  if (pid === 'msgpg') {
    localStorage.setItem('lastSeenMessageTime', Date.now());
    updBadges();
  }
}


window.previewAvatar = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('prAvatarPreview').style.backgroundImage = `url(${e.target.result})`;
      document.getElementById('prAvatarPreview').style.backgroundSize = 'cover';
      document.getElementById('prAvatarPreview').textContent = '';
      _tempAvatar = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
};
let _tempAvatar = null;

const _origSaveProf = saveProfileInfo;
saveProfileInfo = async function () {
  const s = getStudentById(curId);
  if (!s) return;
  const username = document.getElementById('prUsernameEdit').value.trim();
  if (username) s.username = username;
  if (_tempAvatar) s.avatar = _tempAvatar;
  await _origSaveProf();
  renderProf();
};

const _origSelectChatRead = selectChat;
selectChat = function (type, id) {
  _origSelectChatRead(type, id);
  // Mark messages as read
  let changed = false;
  messages.forEach(m => {
    if (!m.isRead && m.toType === (curType === 'student' ? 'specific_student' : (curType === 'teacher' ? 'specific_teacher' : 'admin')) && nNum(m.toId) === curId && nNum(m.fromId) === id) {
      m.isRead = true;
      changed = true;
    }
  });
  if (changed) {
    save();
    renderChatHistory();
  }
};

const _origRenderProf = renderProf;
renderProf = function () {
  _origRenderProf();
  const s = getStudentById(curId);
  if (s) {
    const el = document.getElementById('prAvatarPreview');
    if (el) {
      if (s.avatar) {
        el.style.backgroundImage = `url(${s.avatar})`;
        el.style.backgroundSize = 'cover';
        el.textContent = '';
      } else {
        el.style.backgroundImage = 'none';
        el.textContent = s.name ? s.name[0] : '?';
      }
    }
    const sbAv = document.getElementById('sbAv');
    if (sbAv) {
      if (s.avatar) {
        sbAv.style.backgroundImage = `url(${s.avatar})`;
        sbAv.style.backgroundSize = 'cover';
        sbAv.textContent = '';
      } else {
        sbAv.style.backgroundImage = 'none';
        sbAv.textContent = s.name ? s.name[0] : '?';
      }
    }
    const inventoryEl = document.getElementById('prInventoryList');
    if (inventoryEl) {
      const inv = Array.isArray(s.inventory) ? s.inventory : [];
      inventoryEl.innerHTML = inv.length ? inv.map(item => `
        <div style="border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--bg-card2);min-height:90px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-weight:700;color:var(--gold);">${escHtml(item.name)}</div>
            <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${escHtml(item.type.replace('_', ' '))}</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${escHtml(item.description || '')}</div>
        </div>
      `).join('') : '<p style="color:var(--text-dim);padding:14px;text-align:center;grid-column:1/-1;">Sizning inventoringiz bo\'sh.</p>';
    }
  }
  if (s && s.username) {
    const un = document.getElementById('prUsernameEdit');
    if (un) un.value = s.username;
  }
};
async function init() {
  const hideLoader = () => {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
    try { if (window._loadingInterval) clearInterval(window._loadingInterval); } catch (e) { }
  };

  try {
    const d = await load();
    const shouldSeed = !d || (
      Array.isArray(d.students) && d.students.length === 0 &&
      Array.isArray(d.transactions) && d.transactions.length === 0 &&
      !d.seedVersion
    );
    if (shouldSeed) { mkDef(); await save(); }
    else { normalizeData(d); }
    updTeacherLoginOptions(); updAdminLoginOptions(); updStudentLoginOptions(); toggleAdminLoginType(); updSels();
    applyTheme();
    checkTop5Rewards();
  } catch (e) {
    console.error('Init xato:', e);
    try { toast('Xatolik: sayt yuklanmadi. Console ni tekshiring.', 'error'); } catch (e2) { }
  } finally {
    hideLoader();
    // HTML dagi fallback uchun ham
    try { if (window.__hideLoader) window.__hideLoader(); } catch (e3) { }
  }
}
init();

// WORK PLAN (ISH REJASI)

// WORK PLAN (ISH REJASI)
function renderPlanMgrPage() {
  const t = getTeacherById(curTeacherId) || getTeacherById(getAdminById(curAdminId)?.linkedTeacherId);
  const myStudents = manageStudents();
  const groupNames = Array.from(new Set(myStudents.map(s => String(s.group || '')))).filter(g => g);
  if (t && t.group && !groupNames.includes(t.group)) groupNames.unshift(t.group);
  
  const sel = document.getElementById('planGroup');
  if (sel) {
    sel.innerHTML = groupNames.length ? groupNames.map(g => '<option value="' + escHtml(g) + '">' + escHtml(g) + '</option>').join('') : '<option value="">Guruh yo\'q</option>';
  }
  
  renderTeacherPlans();
}

function renderTeacherPlans() {
  const container = document.getElementById('teacherPlanList');
  if (!container) return;
  const tId = curType === 'teacher' ? curTeacherId : (getAdminById(curAdminId)?.linkedTeacherId || 0);
  const myPlans = plans.filter(p => p.teacherId === tId).sort((a,b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = myPlans.length ? myPlans.map(p => 
    '<div style="border:1px solid var(--border);border-radius:var(--r);padding:10px;margin-bottom:10px;display:flex;justify-content:space-between;">' +
      '<div>' +
        '<div style="font-size:12px;color:var(--text-dim);">' + escHtml(p.date) + ' - ' + escHtml(p.group) + '</div>' +
        '<div style="font-weight:bold;margin-top:4px;">' + escHtml(p.topic) + '</div>' +
        '<div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Vazifa: ' + escHtml(p.hw) + '</div>' +
      '</div>' +
      '<div>' +
        '<button class="btn btn-xs btn-danger" onclick="delPlan(' + p.id + ')"><i class="fas fa-trash"></i></button>' +
      '</div>' +
    '</div>'
  ).join('') : '<p style="color:var(--text-dim);">Hech qanday reja kiritilmagan</p>';
}

window.addPlan = async function() {
  const group = document.getElementById('planGroup').value;
  const date = document.getElementById('planDate').value;
  const topic = document.getElementById('planTopic').value.trim();
  const hw = document.getElementById('planHw').value.trim();
  if (!group || !date || !topic || !hw) { toast('Barcha maydonlarni to\'ldiring', 'error'); return; }
  const tId = curType === 'teacher' ? curTeacherId : (getAdminById(curAdminId)?.linkedTeacherId || 0);
  plans.push({ id: Date.now(), teacherId: tId, group, date, topic, hw });
  await save();
  document.getElementById('planTopic').value = '';
  document.getElementById('planHw').value = '';
  renderTeacherPlans();
  toast('Reja qo\'shildi', 'success');
}

window.delPlan = async function(id) {
  if (!confirm("O\'chirishni tasdiqlaysizmi?")) return;
  plans = plans.filter(p => p.id !== id);
  await save();
  renderTeacherPlans();
  toast('Reja o\'chirildi', 'success');
}

function renderStudentPlanPage() {
  const container = document.getElementById('studentPlanList');
  if (!container) return;
  const me = getStudentById(curId);
  if (!me) return;
  const myPlans = plans.filter(p => p.teacherId === me.teacherId && p.group === me.group).sort((a,b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = myPlans.length ? myPlans.map(p => 
    '<div style="border:1px solid var(--border-gold);border-radius:var(--r);padding:12px;margin-bottom:10px;background:rgba(200,160,32,0.05);">' +
      '<div style="font-size:12px;color:var(--gold-mid);"><i class="fas fa-calendar-day"></i> ' + escHtml(p.date) + '</div>' +
      '<div style="font-size:15px;font-weight:bold;margin-top:4px;color:var(--text);">' + escHtml(p.topic) + '</div>' +
      '<div style="color:var(--text-muted);font-size:13px;margin-top:6px;"><i class="fas fa-book-open"></i> Uy vazifasi: ' + escHtml(p.hw) + '</div>' +
    '</div>'
  ).join('') : '<p style="color:var(--text-dim);">Hali dars rejasi kiritilmagan</p>';
}

// DROPDOWN TOP MENU LOGIC
window.toggleTopDropdown = function() {
  const dd = document.getElementById('topMenuDropdown');
  if (dd.style.display === 'none') {
    // Populate
    let html = '';
    const items = curType === 'teacher' || curType === 'admin' ? document.querySelectorAll('#tNav .nav-item') : document.querySelectorAll('#sNav .nav-item');
    items.forEach(el => {
      if (el.style.display !== 'none') {
        const text = el.innerText;
        const icon = el.querySelector('i')?.outerHTML || '';
        const onclick = el.getAttribute('onclick');
        html += '<div style="padding:12px 16px; border-bottom:1px solid var(--border); cursor:pointer; color:var(--text); transition:background 0.2s;" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'" onclick="' + onclick + '; toggleTopDropdown();">' + icon + ' ' + text + '</div>';
      }
    });
    dd.innerHTML = html;
    dd.style.display = 'block';
  } else {
    dd.style.display = 'none';
  }
}
// ── Global funksiyalar ── (Ensuring remaining exports if needed)
window.renderPlanMgrPage = renderPlanMgrPage;
window.renderTeacherPlans = renderTeacherPlans;
window.renderStudentPlanPage = renderStudentPlanPage;

// ───────── GOOGLE OAUTH & PASSKEY LOGIC ─────────
window.uploadProfilePhoto = async function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result;
    toast('Rasm yuklanmoqda... biroz kuting', 'info');
    try {
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 })
      });
      const data = await res.json();
      if (data.ok) {
        const s = getStudentById(curId);
        if (s) {
          s.photoFileId = data.file_id;
          await save();
          if (typeof renderProfileV2 === 'function') renderProfileV2();
          toast('Rasm muvaffaqiyatli saqlandi!', 'success');
        }
      } else {
        toast('Rasm yuklashda xatolik: ' + data.err, 'error');
      }
    } catch (e) {
      toast('Tarmoq xatosi', 'error');
    }
  };
  reader.readAsDataURL(file);
};

window.checkGooglePasskeyStatus = async function() {
  const btn = document.getElementById('googlePasskeyBtn');
  const unlinkBtn = document.getElementById('googlePasskeyUnlinkBtn');
  const statusEl = document.getElementById('googlePasskeyStatus');
  if (!btn || !unlinkBtn || !statusEl) return;
  
  if (!curId) return;

  try {
    const res = await fetch(`/api/auth/google-status?userType=${curType}&userId=${curId}`);
    const data = await res.json();
    if (data.ok && data.linked) {
      statusEl.innerHTML = `<span style="color:#4caf50;">✅ Bog'langan:</span> ${data.email}`;
      btn.style.display = 'none';
      unlinkBtn.style.display = 'block';
    } else {
      statusEl.innerHTML = `Siz parolsiz, Google akauntingiz bilan tizimga kira olasiz.`;
      btn.style.display = 'block';
      unlinkBtn.style.display = 'none';
    }
  } catch (e) {
    statusEl.innerHTML = `Tarmoq xatosi.`;
  }
};

window.linkGoogleAccount = function() {
  window.location.href = '/auth/google?action=link';
};

window.unlinkGoogleAccount = async function() {
  if (!confirm("Google hisob bilan bog'lanishni uzmoqchimisiz?")) return;
  try {
    const res = await fetch('/api/auth/google-unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userType: curType, userId: curId })
    });
    if (res.ok) {
      toast("Bog'lanish uzildi!", "success");
      checkGooglePasskeyStatus();
    }
  } catch (e) {
    toast('Xatolik', 'error');
  }
};

window.handleGoogleCallback = async function() {
  const token = localStorage.getItem('google_auth_token');
  if (token) {
    localStorage.removeItem('google_auth_token');
    
    // Check if user is trying to link or login
    // If we have a curType/curId, we are already logged in (maybe redirect back to profile)
    const ls = document.getElementById('loginScreen');
    if (!ls || ls.style.display === 'none') {
      // User is already logged in, they were linking
      if (curId) {
        try {
          const res = await fetch('/api/auth/google-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userType: curType, userId: curId })
          });
          if (res.ok) {
            toast("Google hisob bog'landi!", 'success');
            if (typeof renderProfileV2 === 'function') renderProfileV2();
          } else {
            toast("Bog'lashda xatolik", 'error');
          }
        } catch(e) {}
      }
    } else {
      // User is logging in
      try {
        const res = await fetch('/api/auth/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (data.ok && data.data) {
          const { type, id } = data.data;
          curType = type;
          if (type === 'student') { curId = id; enterS(); }
          else if (type === 'teacher') { curTeacherId = id; enterT(); }
          else if (type === 'admin') { curAdminId = id; enterA(); }
          toast('Google orqali kirdingiz!', 'success');
        } else {
          toast(data.err || "Bunday profil topilmadi. Avval profilingiz sozlamalaridan Google'ni bog'lang.", 'error');
        }
      } catch (e) {
        toast('Tarmoq xatosi', 'error');
      }
    }
  }
};

// Patch renderProfileV2 to check status after rendering
const _origRP = window.renderProfileV2;
if (_origRP) {
  window.renderProfileV2 = function() {
    _origRP();
    setTimeout(checkGooglePasskeyStatus, 100);
  };
}

// Call on init
setTimeout(handleGoogleCallback, 1000);

// ════════════════════════════════════════════════════════════════════════
// API GENERATOR & TEXNOO AUTH FRONTEND LOGIC
// ════════════════════════════════════════════════════════════════════════
window.loadOAuthApps = async function() {
  const container = document.getElementById('oauthAppList');
  if (!container) return;

  const uId = curId || curTeacherId || curAdminId;
  const uType = curType || 'student';
  if (!uId || !uType) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3);">API generator ishlatish uchun avval tizimga kiring.</div>`;
    return;
  }

  container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text2);"><i class="fas fa-spinner fa-spin"></i> API kalitlar yuklanmoqda...</div>`;

  try {
    const res = await fetch(`/api/oauth/apps?userId=${uId}&userType=${uType}`);
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.data) || data.data.length === 0) {
      container.innerHTML = `
        <div style="padding:30px;text-align:center;color:var(--text3);border:1px dashed var(--bor);border-radius:12px;">
          <i class="fas fa-key" style="font-size:32px;opacity:.3;margin-bottom:8px;"></i>
          <div>Hozircha hech qanday API kalit yaratilmagan. Yuqoridagi forma orqali birinchi API kalitingizni yarating.</div>
        </div>`;
      return;
    }

    container.innerHTML = data.data.map(app => {
      const origins = app.allowedOrigins.join(', ');
      const callbacks = app.allowedCallbacks.join(', ');
      const createdDate = new Date(app.createdAt).toLocaleDateString('uz-UZ', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

      return `
        <div style="background:var(--card2);border:1px solid var(--bor);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:16px;font-weight:800;color:#fff;"><i class="fas fa-laptop-code" style="color:var(--cyan);"></i> ${escHtml(app.appName)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">Yaratilgan: ${createdDate}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-sm" onclick="showOAuthSdkCodeModal('${escHtml(app.clientId)}')" style="background:rgba(0,229,255,0.1);color:var(--cyan);border:1px solid rgba(0,229,255,0.3);"><i class="fas fa-code"></i> SDK Ulanish kodi</button>
              <button class="btn btn-sm" onclick="openEditOAuthAppModal('${escHtml(app.clientId)}', '${escHtml(app.appName)}', '${escHtml(origins)}', '${escHtml(callbacks)}')" style="background:rgba(255,204,0,0.1);color:var(--gold);border:1px solid rgba(255,204,0,0.3);"><i class="fas fa-edit"></i> Oq ro'yxatni almashtirish / Tahrirlash</button>
              <button class="btn btn-sm" onclick="deleteOAuthApp('${escHtml(app.clientId)}')" style="background:rgba(255,56,96,0.1);color:var(--red);border:1px solid rgba(255,56,96,0.3);"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;background:var(--bg);padding:14px;border-radius:8px;font-size:12px;">
            <div>
              <span style="color:var(--text3);display:block;margin-bottom:2px;font-weight:600;">Client ID (Public Key):</span>
              <div style="font-family:monospace;color:var(--cyan);word-break:break-all;display:flex;align-items:center;gap:6px;">
                <span>${escHtml(app.clientId)}</span>
                <i class="fas fa-copy" style="cursor:pointer;" onclick="copyToClipboard('${escHtml(app.clientId)}')" title="Nusxalash"></i>
              </div>
            </div>
            <div>
              <span style="color:var(--text3);display:block;margin-bottom:2px;font-weight:600;">Oq ro'yxat: So'rov keladigan domen (Origin URL):</span>
              <div style="color:var(--green);word-break:break-all;"><i class="fas fa-shield-halved"></i> ${escHtml(origins)}</div>
            </div>
            <div>
              <span style="color:var(--text3);display:block;margin-bottom:2px;font-weight:600;">Oq ro'yxat: Callback (Redirect URL):</span>
              <div style="color:#e2eaff;word-break:break-all;"><i class="fas fa-link"></i> ${escHtml(callbacks)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--red);">API ro'yxatini yuklashda xatolik yuz berdi.</div>`;
  }
};

window.createOAuthApp = async function() {
  const appName = (document.getElementById('apiAppName')?.value || '').trim();
  const requestUrl = (document.getElementById('apiRequestUrl')?.value || '').trim();
  const callbackUrl = (document.getElementById('apiCallbackUrl')?.value || '').trim();

  const uId = curId || curTeacherId || curAdminId;
  const uType = curType || 'student';

  if (!appName || !requestUrl || !callbackUrl) {
    toast("Barcha maydonlarni to'ldiring (Ilova nomi, So'rov keladigan sayt linki va Callback linki).", "error");
    return;
  }

  try {
    const res = await fetch('/api/oauth/apps/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uId, userType: uType, appName, requestUrl, callbackUrl })
    });
    const data = await res.json();
    if (data.ok && data.app) {
      toast("API Muvaffaqiyatli yaratildi va Oq ro'yxatga qo'shildi!", "success");
      document.getElementById('apiAppName').value = '';
      document.getElementById('apiRequestUrl').value = '';
      document.getElementById('apiCallbackUrl').value = '';
      
      openGlobalModal(`
        <div style="padding:10px;">
          <h3 style="color:var(--cyan);margin-bottom:12px;"><i class="fas fa-check-circle"></i> API Kalit Muvaffaqiyatli Yaratildi!</h3>
          <p style="font-size:13px;color:var(--text2);margin-bottom:16px;">Quyidagi Client Secret faqat <b>bir marta</b> ko'rsatiladi. Uni xavfsiz joyda saqlang!</p>
          
          <div style="background:var(--bg);padding:14px;border-radius:10px;margin-bottom:14px;font-size:13px;">
            <div style="margin-bottom:10px;">
              <strong style="color:var(--text3);">Client ID:</strong>
              <div style="font-family:monospace;color:var(--cyan);word-break:break-all;">${escHtml(data.app.clientId)}</div>
            </div>
            <div>
              <strong style="color:var(--text3);">Client Secret:</strong>
              <div style="font-family:monospace;color:var(--gold);word-break:break-all;">${escHtml(data.app.clientSecret)}</div>
            </div>
          </div>
          <button class="btn btn-cyan btn-block" onclick="closeGlobalModal();loadOAuthApps();">Tushunarli</button>
        </div>
      `);
      loadOAuthApps();
    } else {
      toast(data.err || "API yaratishda xatolik yuz berdi.", "error");
    }
  } catch(e) {
    toast("Tarmoq xatosi", "error");
  }
};

window.openEditOAuthAppModal = function(clientId, appName, origins, callbacks) {
  openGlobalModal(`
    <div style="padding:10px;">
      <h3 style="color:var(--gold);margin-bottom:12px;"><i class="fas fa-edit"></i> Oq ro'yxatni almashtirish / Tahrirlash</h3>
      <p style="font-size:12px;color:var(--text2);margin-bottom:16px;">Ushbu API uchun ruxsat berilgan so'rov va callback manzillarini o'zgartirishingiz mumkin.</p>
      
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;">Ilova Nomi</label>
        <input type="text" id="editApiAppName" class="inp" value="${escHtml(appName)}" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--bor);color:#fff;border-radius:8px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;">So'rov keladigan sayt manzili (Origin URL)</label>
        <input type="text" id="editApiRequestUrl" class="inp" value="${escHtml(origins)}" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--bor);color:#fff;border-radius:8px;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;">Callback / Redirect manzili (Callback URL)</label>
        <input type="text" id="editApiCallbackUrl" class="inp" value="${escHtml(callbacks)}" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--bor);color:#fff;border-radius:8px;">
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn" onclick="closeGlobalModal()" style="background:var(--card2);">Bekor qilish</button>
        <button class="btn btn-gold" onclick="saveEditOAuthApp('${escHtml(clientId)}')"><i class="fas fa-save"></i> Saqlash</button>
      </div>
    </div>
  `);
};

window.saveEditOAuthApp = async function(clientId) {
  const appName = (document.getElementById('editApiAppName')?.value || '').trim();
  const requestUrl = (document.getElementById('editApiRequestUrl')?.value || '').trim();
  const callbackUrl = (document.getElementById('editApiCallbackUrl')?.value || '').trim();
  const uId = curId || curTeacherId || curAdminId;
  const uType = curType || 'student';

  if (!appName || !requestUrl || !callbackUrl) {
    toast("Barcha maydonlarni to'ldiring", "error");
    return;
  }

  try {
    const res = await fetch(`/api/oauth/apps/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uId, userType: uType, appName, requestUrl, callbackUrl })
    });
    const data = await res.json();
    if (data.ok) {
      toast("Oq ro'yxat muvaffaqiyatli almashtirildi!", "success");
      closeGlobalModal();
      loadOAuthApps();
    } else {
      toast(data.err || "Yangilashda xatolik", "error");
    }
  } catch(e) {
    toast("Tarmoq xatosi", "error");
  }
};

window.deleteOAuthApp = async function(clientId) {
  if (!confirm("Haqiqatan ham ushbu API kalitini o'chirmoqchimisiz?")) return;
  const uId = curId || curTeacherId || curAdminId;
  const uType = curType || 'student';

  try {
    const res = await fetch(`/api/oauth/apps/${clientId}?userId=${uId}&userType=${uType}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      toast("API o'chirildi", "success");
      loadOAuthApps();
    } else {
      toast(data.err || "O'chirishda xatolik", "error");
    }
  } catch(e) {
    toast("Tarmoq xatosi", "error");
  }
};

window.showOAuthSdkCodeModal = function(clientId) {
  const codeSnippet = `<!-- 1. Texnoo Auth SDK ni yuklang -->\n<script src="${window.location.origin}/sdk/texnoo-auth.js"><\/script>\n\n<!-- 2. Kirish tugmasi va funksiyani chaqiring -->\n<button onclick="loginWithTexnoo()">Texnoo orqali kirish</button>\n\n<script>\nfunction loginWithTexnoo() {\n  TexnooAuth.login({\n    clientId: '${clientId}',\n    redirectUri: window.location.origin + '/callback.html',\n    onSuccess: function(user) {\n      console.log('Avatar URL:', user.avatar);\n      console.log('Ism:', user.name);\n      console.log('Email:', user.email);\n      alert('Xush kelibsiz, ' + user.name);\n    }\n  });\n}\n<\/script>`;

  openGlobalModal(`
    <div style="padding:10px;">
      <h3 style="color:var(--cyan);margin-bottom:12px;"><i class="fas fa-code"></i> Saytingizga Texnoo Auth ni Ulash</h3>
      <p style="font-size:12px;color:var(--text2);margin-bottom:12px;">Quyidagi HTML va JavaScript kodini o'z saytingizga qo'shing:</p>
      
      <textarea readonly style="width:100%;height:220px;background:#060c18;color:#00ff88;font-family:monospace;padding:12px;border:1px solid var(--bor);border-radius:8px;font-size:12px;box-sizing:border-box;white-space:pre;">${escHtml(codeSnippet)}</textarea>
      
      <div style="display:flex;justify-content:space-between;margin-top:14px;align-items:center;">
        <button class="btn btn-cyan btn-sm" onclick="copyToClipboard(\`${escHtml(codeSnippet)}\`)"><i class="fas fa-copy"></i> Kodni Nusxalash</button>
        <button class="btn btn-sm" onclick="closeGlobalModal()">Yopish</button>
      </div>
    </div>
  `);
};

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    toast("Nusxalandi!", "success");
  }).catch(() => {
    toast("Nusxalash imkonsiz", "error");
  });
};
