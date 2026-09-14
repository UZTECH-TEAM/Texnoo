// ═══════════════════════════════════════════════════════════════════
// EDU-CRM BACKEND SERVER (Express + Node.js built-in SQLite node:sqlite)
// Railway uchun: data.db /app/data papkasida saqlanadi (persist)
// Lokal ishlatishda: ./data/data.db
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const session = require('express-session');
const passport = require('passport');
let GoogleStrategy;
try { GoogleStrategy = require('passport-google-oauth20').Strategy; } catch(e) {}
const jwt = require('jsonwebtoken');

try {
  require('dotenv').config();
} catch(e) {}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
  secret: process.env.JWT_SECRET || 'super_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && GoogleStrategy) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.APP_URL || 'https://texnoo.com'}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }));
} else {
  console.log("⚠️ GOOGLE_CLIENT_ID kiritilmagan yoki kutubxonalar o'rnatilmagan. Google Login ishlamaydi.");
}

// ───────── DATA FOLDER (Railway /app/data | lokal ./data) ─────────
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    '/app/data',
    path.join(__dirname, 'data')
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      const testFile = path.join(p, '.write_test_' + Date.now());
      fs.writeFileSync(testFile, 'ok'); fs.unlinkSync(testFile);
      return p;
    } catch (e) { /* keyingisiga o't */ }
  }
  const fallback = path.join(__dirname, 'data');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}
const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'data.db');
console.log('[DB] Ma\'lumotlar bazasi:', DB_PATH);
const db = new DatabaseSync(DB_PATH);
try { db.exec('PRAGMA journal_mode = WAL'); } catch(e){}
try { db.exec('PRAGMA foreign_keys = ON'); } catch(e){}

// ───────────────────────── TABLELARNI YARATAMIZ ────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS typing_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'default-center',
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  wpm INTEGER DEFAULT 0,
  cpm INTEGER DEFAULT 0,
  accuracy INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  elapsed_sec REAL DEFAULT 0,
  completed INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  best_wpm INTEGER DEFAULT 0,
  best_cpm INTEGER DEFAULT 0,
  best_accuracy INTEGER DEFAULT 0,
  attempted_at INTEGER NOT NULL,
  UNIQUE(tenant, user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS typing_unlocked (
  tenant TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  next_unlocked INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(tenant, user_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  wpm INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  center_name TEXT NOT NULL,
  issued_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups_kv (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS homework_kv (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS races_kv (
  code TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS google_links (
  google_id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  email TEXT,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  app_name TEXT NOT NULL,
  allowed_origins TEXT NOT NULL,
  allowed_callbacks TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  access_token TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tp_u ON typing_progress(tenant, user_id);
CREATE INDEX IF NOT EXISTS idx_certs_u ON certificates(tenant, user_id);
CREATE INDEX IF NOT EXISTS idx_grp_t ON groups_kv(tenant);
CREATE INDEX IF NOT EXISTS idx_hw_t ON homework_kv(tenant);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_u ON oauth_clients(user_id, user_type);
`);

// ───────────────────────── KV HELPERS ───────────────────────────
const getKV = db.prepare('SELECT payload_json FROM app_state WHERE key=?');
const setKV = db.prepare('INSERT INTO app_state(key,payload_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at');

function now() { return Date.now(); }
function readState() {
  const row = getKV.get('main');
  if (!row) return null;
  try { return JSON.parse(row.payload_json); } catch(e){ return null; }
}
function writeState(state) {
  setKV.run('main', JSON.stringify(state), now());
}

// ───────────────────────── UMBRELLA /api/data (FE legacy support) ─────
app.get('/api/data', (req, res) => {
  const data = readState();
  if (!data) return res.json({ seedVersion: 1, students:[], teachers:[], admins:[] });
  res.json(data);
});

app.post('/api/data', (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ ok:false, err:'bad payload' });
  writeState(data);
  res.json({ ok: true, savedAt: now() });
});

// ───────────────────────── TENANT HELPER ─────────────────────────
function tenantOf(req) { return (req.query.tenant || req.body?.tenant || 'default-center').toString().slice(0,64); }

// ════════════════════════════════════════════════════════════════════════
// TYPING PROGRESS
// ════════════════════════════════════════════════════════════════════════
const stGetAll = db.prepare(`SELECT lesson_id, wpm, cpm, accuracy, errors, elapsed_sec, completed, passed, best_wpm, best_cpm, best_accuracy, attempted_at FROM typing_progress WHERE tenant=? AND user_id=?`);
const stUnlockGet = db.prepare(`SELECT next_unlocked FROM typing_unlocked WHERE tenant=? AND user_id=?`);
const stUpsert = db.prepare(`
INSERT INTO typing_progress(tenant,user_id,lesson_id,wpm,cpm,accuracy,errors,elapsed_sec,completed,passed,best_wpm,best_cpm,best_accuracy,attempted_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(tenant,user_id,lesson_id) DO UPDATE SET
  wpm=excluded.wpm, cpm=excluded.cpm, accuracy=excluded.accuracy, errors=excluded.errors, elapsed_sec=excluded.elapsed_sec,
  completed=excluded.completed, passed=excluded.passed, attempted_at=excluded.attempted_at,
  best_wpm=CASE WHEN excluded.best_wpm>typing_progress.best_wpm THEN excluded.best_wpm ELSE typing_progress.best_wpm END,
  best_cpm=CASE WHEN excluded.best_cpm>typing_progress.best_cpm THEN excluded.best_cpm ELSE typing_progress.best_cpm END,
  best_accuracy=CASE WHEN excluded.best_accuracy>typing_progress.best_accuracy THEN excluded.best_accuracy ELSE typing_progress.best_accuracy END`);
const stUnlockUpsert = db.prepare(`INSERT INTO typing_unlocked(tenant,user_id,next_unlocked) VALUES(?,?,?) ON CONFLICT(tenant,user_id) DO UPDATE SET next_unlocked=CASE WHEN excluded.next_unlocked>typing_unlocked.next_unlocked THEN excluded.next_unlocked ELSE typing_unlocked.next_unlocked END`);

app.get('/api/typing/progress', (req, res) => {
  const userId = Number(req.query.userId||0);
  if (!userId) return res.status(400).json({ ok:false, err:'userId required' });
  const tenant = tenantOf(req);
  const out = { userId, tenant, nextUnlockedLesson: 1 };
  for (const r of stGetAll.iterate(tenant, userId)) {
    out[String(r.lesson_id)] = {
      lessonId: r.lesson_id, wpm: r.wpm, cpm: r.cpm, accuracy: r.accuracy, errors: r.errors,
      elapsedSec: r.elapsed_sec, completed: !!r.completed, passed: !!r.passed,
      bestWpm: r.best_wpm||0, bestCpm: r.best_cpm||0, bestAcc: r.best_accuracy||0,
      attemptedAt: r.attempted_at
    };
  }
  const un = stUnlockGet.get(tenant, userId);
  out.nextUnlockedLesson = un?.next_unlocked || 1;
  res.json({ ok:true, data: out });
});

app.post('/api/typing/progress', (req, res) => {
  const { userId, lessonId, record } = req.body || {};
  if (!userId || !lessonId || !record) return res.status(400).json({ ok:false, err:'missing fields' });
  const tenant = tenantOf(req);
  const passed = !!record.passed;
  const bestWpm = Math.max(0, Number(record.wpm||0));
  const bestCpm = Math.max(0, Number(record.cpm||0));
  const bestAcc = Math.max(0, Math.min(100, Number(record.accuracy||0)));
  stUpsert.run(
    tenant, userId, lessonId,
    Number(record.wpm||0), Number(record.cpm||0), Number(record.accuracy||0), Number(record.errors||0),
    Number(record.elapsedSec||0),
    record.completed?1:0, passed?1:0,
    bestWpm, bestCpm, bestAcc,
    record.attemptedAt || now()
  );
  if (passed) stUnlockUpsert.run(tenant, userId, Number(lessonId) + 1);
  const full = {};
  for (const r of stGetAll.iterate(tenant, userId)) full[String(r.lesson_id)] = {
    lessonId: r.lesson_id, wpm:r.wpm, cpm:r.cpm, accuracy:r.accuracy, errors:r.errors,
    elapsedSec:r.elapsed_sec, completed:!!r.completed, passed:!!r.passed,
    bestWpm: r.best_wpm||0, bestCpm: r.best_cpm||0, bestAcc: r.best_accuracy||0, attemptedAt:r.attempted_at
  };
  const un = stUnlockGet.get(tenant, userId);
  full.userId = userId; full.tenant = tenant; full.nextUnlockedLesson = un?.next_unlocked || 1;
  res.json({ ok:true, data: full });
});

// ════════════════════════════════════════════════════════════════════════
// CERTIFICATES
// ════════════════════════════════════════════════════════════════════════
const certListStmt = db.prepare(`SELECT id, student_name, course_name, wpm, accuracy, center_name, issued_at FROM certificates WHERE tenant=? AND user_id=? ORDER BY issued_at DESC`);
const certInsertStmt = db.prepare(`INSERT INTO certificates(id,tenant,user_id,student_name,course_name,wpm,accuracy,center_name,issued_at) VALUES(?,?,?,?,?,?,?,?,?)`);

app.get('/api/certificates', (req, res) => {
  const userId = Number(req.query.userId||0); if (!userId) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  res.json({ ok:true, data: certListStmt.all(tenant, userId).map(r => ({
    id: r.id, studentName: r.student_name, courseName: r.course_name,
    wpm: r.wpm, accuracy: r.accuracy, centerName: r.center_name, issuedAt: r.issued_at
  }))});
});
app.post('/api/certificates', (req, res) => {
  const { userId, certificate } = req.body || {};
  if (!userId || !certificate) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const id = certificate.id || ('CERT-' + Date.now() + '-' + Math.floor(Math.random()*10000));
  certInsertStmt.run(
    id, tenant, userId,
    certificate.studentName || certificate.student_name || 'Talaba',
    certificate.courseName || certificate.course_name || 'Kurs',
    Number(certificate.wpm||0), Number(certificate.accuracy||0),
    certificate.centerName || certificate.center_name || "Texno O'quv Markazi",
    certificate.issuedAt || now()
  );
  res.json({ ok:true, data: { id, tenant, userId, ...certificate, id, issuedAt: certificate.issuedAt || now() } });
});

// ════════════════════════════════════════════════════════════════════════
// GROUPS
// ════════════════════════════════════════════════════════════════════════
const grpAllStmt = db.prepare(`SELECT id, payload_json FROM groups_kv WHERE tenant=?`);
const grpUpsertStmt = db.prepare(`INSERT INTO groups_kv(id,tenant,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json`);
app.get('/api/groups', (req, res) => {
  const tenant = tenantOf(req);
  const tid = req.query.teacherId ? Number(req.query.teacherId) : null;
  const all = grpAllStmt.all(tenant).map(r => { try { return { id:r.id, ...JSON.parse(r.payload_json) }; } catch(e){ return null; } }).filter(Boolean);
  const out = tid ? all.filter(g => Number(g.teacherId) === tid || (Array.isArray(g.teacherIds) && g.teacherIds.includes(tid))) : all;
  res.json({ ok:true, data: out });
});
app.post('/api/groups', (req, res) => {
  const { group } = req.body || {}; if (!group?.id) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  group.tenant = group.tenant || tenant;
  grpUpsertStmt.run(group.id, tenant, JSON.stringify(group));
  res.json({ ok:true, data: group });
});

// ════════════════════════════════════════════════════════════════════════
// HOMEWORK / VAZIFA
// ════════════════════════════════════════════════════════════════════════
const hwAllStmt = db.prepare(`SELECT id, payload_json FROM homework_kv WHERE tenant=?`);
const hwUpsertStmt = db.prepare(`INSERT INTO homework_kv(id,tenant,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json`);
app.get('/api/homework', (req, res) => {
  const tenant = tenantOf(req);
  const sid = req.query.studentId ? String(req.query.studentId) : null;
  const gid = req.query.groupId ? String(req.query.groupId) : null;
  const list = hwAllStmt.all(tenant).map(r => { try { return { id:r.id, ...JSON.parse(r.payload_json) }; } catch(e){ return null; } }).filter(Boolean);
  const out = list.filter(h => {
    const matchesStudent = !sid || (Array.isArray(h.studentIds) && h.studentIds.map(String).includes(sid)) || String(h.studentId) === sid;
    const matchesGroup   = !gid || String(h.groupId) === gid;
    return matchesStudent && matchesGroup;
  });
  res.json({ ok:true, data: out });
});
app.post('/api/homework', (req, res) => {
  const { homework } = req.body || {}; if (!homework?.id) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  homework.tenant = homework.tenant || tenant;
  hwUpsertStmt.run(homework.id, tenant, JSON.stringify(homework));
  res.json({ ok:true, data: homework });
});
app.post('/api/homework/submit', (req, res) => {
  const { homeworkId, studentId, submission } = req.body || {};
  if (!homeworkId || !studentId) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const rows = hwAllStmt.all(tenant);
  const found = rows.find(r => { try { return JSON.parse(r.payload_json).id === homeworkId; } catch(e){ return false; }});
  if (!found) return res.status(404).json({ ok:false });
  const obj = { id: found.id, ...JSON.parse(found.payload_json) };
  obj.submissions = obj.submissions || {};
  obj.submissions[String(studentId)] = { submittedAt: Date.now(), ...(submission || {}) };
  hwUpsertStmt.run(obj.id, tenant, JSON.stringify(obj));
  res.json({ ok:true, data: obj });
});

// ════════════════════════════════════════════════════════════════════════
// TYPING RACE
// ════════════════════════════════════════════════════════════════════════
const raceGetStmt = db.prepare(`SELECT payload_json FROM races_kv WHERE code=? AND tenant=?`);
const raceUpsertStmt = db.prepare(`INSERT INTO races_kv(code,tenant,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(code) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`);
function getRace(code, tenant){ const r = raceGetStmt.get(code, tenant); if (!r) return null; try { return JSON.parse(r.payload_json); } catch(e){ return null; } }
function saveRace(race){ raceUpsertStmt.run(race.code, race.tenant||'default-center', JSON.stringify(race), now()); return race; }

app.get('/api/race', (req, res) => {
  const code = (req.query.code||'').toString().slice(0,16);
  if (!code) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  res.json({ ok:true, data: getRace(code, tenant) });
});
app.post('/api/race/create', (req, res) => {
  const { race } = req.body || {}; if (!race?.code) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  race.tenant = tenant;
  saveRace(race);
  res.json({ ok:true, data: race });
});
app.post('/api/race/join', (req, res) => {
  const { code, player } = req.body || {};
  if (!code || !player?.id) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const race = getRace(code, tenant);
  if (!race) return res.status(404).json({ ok:false });
  if (!race.players.find(p => String(p.id) === String(player.id))) {
    race.players.push({ ...player, progress:0, wpm:0, accuracy:100, done:false, finishedAt:null });
    saveRace(race);
  }
  res.json({ ok:true, data: race });
});
app.post('/api/race/start', (req, res) => {
  const { code } = req.body || {}; if (!code) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const race = getRace(code, tenant); if (!race) return res.status(404).json({ ok:false });
  race.status = 'running'; race.startedAt = now(); saveRace(race);
  res.json({ ok:true, data: race });
});
app.post('/api/race/progress', (req, res) => {
  const { code, playerId, progress } = req.body || {};
  if (!code || !playerId) return res.status(400).json({ ok:false });
  const tenant = tenantOf(req);
  const race = getRace(code, tenant); if (!race) return res.status(404).json({ ok:false });
  const pl = race.players.find(p => String(p.id) === String(playerId));
  if (pl) { Object.assign(pl, progress || {}); saveRace(race); }
  res.json({ ok:true, data: race });
});

// ════════════════════════════════════════════════════════════════════════
// OWASP SECURITY HELPERS & RATE LIMITER
// ════════════════════════════════════════════════════════════════════════
const oauthRateMap = new Map();
function rateLimiter(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'global';
    const key = `${req.path}_${ip}`;
    const currentTime = Date.now();
    const record = oauthRateMap.get(key) || { count: 0, resetAt: currentTime + windowMs };
    if (currentTime > record.resetAt) {
      record.count = 0;
      record.resetAt = currentTime + windowMs;
    }
    record.count++;
    oauthRateMap.set(key, record);
    if (record.count > maxRequests) {
      return res.status(429).json({ ok: false, err: "Juda ko'p so'rov. Biroz kuting (Rate limit exceeded)." });
    }
    next();
  };
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret + 'texnoo_salt_2026').digest('hex');
}

function normalizeUrlOrigin(urlStr) {
  try {
    const u = new URL(urlStr.trim());
    return `${u.protocol}//${u.host}`;
  } catch (e) {
    return null;
  }
}

function isOriginWhitelisted(incomingOrigin, allowedOriginsJson) {
  if (!incomingOrigin) return true;
  let allowed = [];
  try { allowed = JSON.parse(allowedOriginsJson); } catch(e){}
  if (!Array.isArray(allowed)) allowed = [allowedOriginsJson];
  
  const normalizedIncoming = normalizeUrlOrigin(incomingOrigin);
  if (!normalizedIncoming) return false;
  
  return allowed.some(o => {
    const normAllowed = normalizeUrlOrigin(o);
    return normAllowed && normAllowed.toLowerCase() === normalizedIncoming.toLowerCase();
  });
}

function isCallbackWhitelisted(incomingCallback, allowedCallbacksJson) {
  if (!incomingCallback) return false;
  let allowed = [];
  try { allowed = JSON.parse(allowedCallbacksJson); } catch(e){}
  if (!Array.isArray(allowed)) allowed = [allowedCallbacksJson];
  
  return allowed.some(c => {
    try {
      const u1 = new URL(incomingCallback);
      const u2 = new URL(c);
      return u1.href.toLowerCase().replace(/\/$/, '') === u2.href.toLowerCase().replace(/\/$/, '');
    } catch(e) {
      return incomingCallback.trim().toLowerCase() === c.trim().toLowerCase();
    }
  });
}

function getUserProfileInfo(userId, userType) {
  const state = readState() || { students: [], teachers: [], admins: [] };
  let list = [];
  if (userType === 'student') list = state.students || [];
  else if (userType === 'teacher') list = state.teachers || [];
  else if (userType === 'admin') list = state.admins || [];
  else {
    list = [...(state.students || []), ...(state.teachers || []), ...(state.admins || [])];
  }
  
  const u = list.find(x => String(x.id) === String(userId));
  if (!u) return null;
  
  let avatar = u.photo || u.avatar || u.pic || u.profile_picture || '';
  if (avatar && !avatar.startsWith('http') && !avatar.startsWith('data:')) {
    avatar = `/api/photo/${avatar}`;
  }
  if (!avatar) {
    avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=00e5ff&color=000&bold=true`;
  }
  
  return {
    id: u.id,
    name: u.name || u.displayName || u.login || 'Texnoo Foydalanuvchi',
    email: u.email || `${u.login || u.id}@texnoo.com`,
    avatar: avatar,
    type: userType || u.role || 'user'
  };
}

// ════════════════════════════════════════════════════════════════════════
// UNIFIED AUTH & GOOGLE OAUTH ROUTES
// ════════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier) return res.status(400).json({ ok: false, message: 'Identifier kiritilmadi' });

  const state = readState() || { students: [], teachers: [], admins: [] };
  const idNorm = String(identifier).trim().toLowerCase();
  const pwNorm = String(password || '').trim();

  const matches = (u) => {
    if (!u) return false;
    const uId = String(u.id || '').toLowerCase();
    const uPhone = String(u.phone || u.telefon || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();
    const uLogin = String(u.login || '').toLowerCase();
    const isIdMatch = uId === idNorm || uPhone === idNorm || uEmail === idNorm || uLogin === idNorm;
    if (!isIdMatch) return false;
    if (!pwNorm) return true;
    const uPw = String(u.password || u.parol || '');
    return uPw === pwNorm;
  };

  const std = (state.students || []).find(matches);
  if (std) return res.json({ ok: true, role: 'student', user: std });

  const tch = (state.teachers || []).find(matches);
  if (tch) return res.json({ ok: true, role: 'teacher', user: tch });

  const adm = (state.admins || []).find(matches);
  if (adm) return res.json({ ok: true, role: 'admin', user: adm });

  return res.status(401).json({ ok: false, message: "Login yoki parol noto'g'ri" });
});

app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !GoogleStrategy) {
    return res.status(503).send(`
      <!DOCTYPE html>
      <html lang="uz">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google OAuth Sozlanmagan - Texnoo</title>
        <style>
          body { background: #060c18; color: #fff; font-family: 'Segoe UI', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .box { background: #0f172a; border: 1px solid #1e293b; padding: 32px; border-radius: 16px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h2 { color: #00e5ff; margin-top: 0; font-size: 22px; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; text-align: left; }
          .code { background: #020617; padding: 12px; border-radius: 8px; color: #38bdf8; font-family: monospace; font-size: 13px; text-align: left; margin: 15px 0; border: 1px solid #1e293b; word-break: break-all; }
          .btn { display: inline-block; margin-top: 15px; color: #00e5ff; text-decoration: none; font-weight: 600; font-size: 14px; background: rgba(0,229,255,0.1); padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(0,229,255,0.3); transition: 0.2s; }
          .btn:hover { background: rgba(0,229,255,0.2); }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>⚠️ Google OAuth Serverda Sozlanmagan</h2>
          <p>Google orqali kirish ishlashi uchun backend serverda <b>GOOGLE_CLIENT_ID</b> va <b>GOOGLE_CLIENT_SECRET</b> o'zgaruvchilari kiritilgan bo'lishi kerak.</p>
          <p><b>Railway / Hosting Server Environment Variables (Variables):</b></p>
          <div class="code">
            GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com<br>
            GOOGLE_CLIENT_SECRET=GOCSPX-your-secret<br>
            APP_URL=https://texnoo.com
          </div>
          <a href="/" class="btn">← Bosh sahifaga qaytish</a>
        </div>
      </body>
      </html>
    `);
  }
  const action = req.query.action || 'login';
  if (req.session) req.session.oauthAction = action;
  passport.authenticate('google', { scope: ['profile', 'email'], state: action })(req, res, (err) => {
    if (err) {
      console.error('Google Passport Error:', err);
      return res.redirect('/callback.html?error=' + encodeURIComponent(err.message || 'OAuth error'));
    }
    next();
  });
});

app.get('/auth/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !GoogleStrategy) {
    return res.redirect('/callback.html?error=' + encodeURIComponent('Google OAuth is not configured on server'));
  }
  passport.authenticate('google', { failureRedirect: '/callback.html?error=auth_failed' })(req, res, () => {
    const profile = req.user;
    if (!profile) return res.redirect('/callback.html?error=no_profile');
    const action = req.query.state || req.session?.oauthAction || 'login';
    const avatar = profile.photos?.[0]?.value || profile._json?.picture || '';
    const email = profile.emails?.[0]?.value || '';
    const name = profile.displayName || '';

    const token = jwt.sign({ googleId: profile.id, email, name, avatar }, process.env.JWT_SECRET || 'super_secret', { expiresIn: '1h' });
    res.redirect(`/callback.html?token=${token}&action=${action}`);
  });
});

app.post('/api/auth/google-link', (req, res) => {
  const { token, userType, userId } = req.body;
  if (!token || !userType || !userId) return res.status(400).json({ ok: false, err: 'Missing parameters' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret');
    db.prepare(`INSERT INTO google_links (google_id, user_type, user_id, email, name, created_at) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(google_id) DO UPDATE SET user_type=excluded.user_type, user_id=excluded.user_id, email=excluded.email, name=excluded.name`)
      .run(decoded.googleId, userType, userId, decoded.email, decoded.name, now());
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, err: 'Invalid token' });
  }
});

app.post('/api/auth/google-unlink', (req, res) => {
  const { userType, userId } = req.body;
  if (!userType || !userId) return res.status(400).json({ ok: false });
  db.prepare(`DELETE FROM google_links WHERE user_type=? AND user_id=?`).run(userType, userId);
  res.json({ ok: true });
});

app.post('/api/auth/google-login', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ ok: false, err: 'Token missing' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret');
    const link = db.prepare(`SELECT user_type, user_id FROM google_links WHERE google_id=?`).get(decoded.googleId);

    if (link) {
      const userProf = getUserProfileInfo(link.user_id, link.user_type);
      return res.json({ ok: true, data: { type: link.user_type, id: link.user_id, user: userProf } });
    }

    // 1. Try matching existing user by email
    const state = readState() || { students: [], teachers: [], admins: [] };
    const emailNorm = (decoded.email || '').toLowerCase().trim();

    let matchedUser = null;
    let matchedType = 'student';

    if (emailNorm) {
      const std = (state.students || []).find(s => (s.email || '').toLowerCase().trim() === emailNorm || String(s.id || '').toLowerCase() === emailNorm);
      if (std) { matchedUser = std; matchedType = 'student'; }

      if (!matchedUser) {
        const tch = (state.teachers || []).find(t => (t.email || '').toLowerCase().trim() === emailNorm);
        if (tch) { matchedUser = tch; matchedType = 'teacher'; }
      }

      if (!matchedUser) {
        const adm = (state.admins || []).find(a => (a.email || '').toLowerCase().trim() === emailNorm);
        if (adm) { matchedUser = adm; matchedType = 'admin'; }
      }
    }

    // 2. If no existing user matched, automatically create a new student account
    if (!matchedUser) {
      const existingStudents = state.students || [];
      const newNum = 100 + existingStudents.length + Math.floor(Math.random() * 50);
      const newId = `ADM-${newNum}`;
      matchedUser = {
        id: newId,
        name: decoded.name || 'Google Foydalanuvchisi',
        email: decoded.email || '',
        avatar: decoded.avatar || '',
        photo: decoded.avatar || '',
        group: 'D1',
        teacherIds: [1],
        totalCoins: 100,
        olmos: 0,
        streak: 1,
        level: 1,
        badge: 'Starter',
        refCode: `REF-${newId}`
      };
      if (!state.students) state.students = [];
      state.students.push(matchedUser);
      writeState(state);
      matchedType = 'student';
    }

    // 3. Save link to google_links table
    db.prepare(`INSERT INTO google_links (google_id, user_type, user_id, email, name, created_at) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(google_id) DO UPDATE SET user_type=excluded.user_type, user_id=excluded.user_id, email=excluded.email, name=excluded.name`)
      .run(decoded.googleId, matchedType, matchedUser.id, decoded.email, decoded.name, now());

    const userProf = getUserProfileInfo(matchedUser.id, matchedType) || matchedUser;
    return res.json({ ok: true, data: { type: matchedType, id: matchedUser.id, user: userProf } });
  } catch (e) {
    console.error('Google login verification error:', e);
    return res.status(400).json({ ok: false, err: 'Invalid token' });
  }
});

app.get('/api/auth/google-status', (req, res) => {
  const { userType, userId } = req.query;
  const link = db.prepare(`SELECT email FROM google_links WHERE user_type=? AND user_id=?`).get(userType, userId);
  res.json({ ok: true, linked: !!link, email: link?.email });
});

// ════════════════════════════════════════════════════════════════════════
// API GENERATOR (DEVELOPER DASHBOARD) ENDPOINTS
// ════════════════════════════════════════════════════════════════════════
const stOAuthClientCreate = db.prepare(`INSERT INTO oauth_clients (client_id, client_secret_hash, user_id, user_type, app_name, allowed_origins, allowed_callbacks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const stOAuthClientGet = db.prepare(`SELECT * FROM oauth_clients WHERE client_id=?`);
const stOAuthClientList = db.prepare(`SELECT * FROM oauth_clients WHERE user_id=? AND user_type=? ORDER BY created_at DESC`);
const stOAuthClientUpdate = db.prepare(`UPDATE oauth_clients SET app_name=?, allowed_origins=?, allowed_callbacks=?, updated_at=? WHERE client_id=? AND user_id=? AND user_type=?`);
const stOAuthClientRegenSecret = db.prepare(`UPDATE oauth_clients SET client_secret_hash=?, updated_at=? WHERE client_id=? AND user_id=? AND user_type=?`);
const stOAuthClientDelete = db.prepare(`DELETE FROM oauth_clients WHERE client_id=? AND user_id=? AND user_type=?`);

// Create new API Key / OAuth Client
app.post('/api/oauth/apps/create', rateLimiter(20, 60000), (req, res) => {
  const { userId, userType, appName, requestUrl, callbackUrl } = req.body || {};
  if (!userId || !userType || !appName || !requestUrl || !callbackUrl) {
    return res.status(400).json({ ok: false, err: "Barcha maydonlarni to'ldiring (Ilova nomi, So'rov keladigan sayt linki va Callback linki)." });
  }

  const normOrigin = normalizeUrlOrigin(requestUrl);
  if (!normOrigin) {
    return res.status(400).json({ ok: false, err: "So'rov keladigan sayt manzili (Origin URL) noto'g'ri (masalan: https://mysite.com)." });
  }

  let normCallback;
  try { normCallback = new URL(callbackUrl).href; } catch(e) {
    return res.status(400).json({ ok: false, err: "Callback manzili (Redirect URL) noto'g'ri (masalan: https://mysite.com/callback)." });
  }

  const clientId = 'texnoo_client_' + crypto.randomBytes(12).toString('hex');
  const rawSecret = 'texnoo_sec_' + crypto.randomBytes(24).toString('hex');
  const secretHash = hashSecret(rawSecret);

  const originsJson = JSON.stringify([normOrigin]);
  const callbacksJson = JSON.stringify([normCallback]);
  const timestamp = now();

  try {
    stOAuthClientCreate.run(clientId, secretHash, Number(userId), String(userType), String(appName).trim(), originsJson, callbacksJson, timestamp, timestamp);
    res.json({
      ok: true,
      app: {
        clientId,
        clientSecret: rawSecret,
        appName,
        allowedOrigins: [normOrigin],
        allowedCallbacks: [normCallback],
        createdAt: timestamp
      }
    });
  } catch(e) {
    res.status(500).json({ ok: false, err: "API yaratishda xatolik yuz berdi: " + e.message });
  }
});

// List developer's API Keys
app.get('/api/oauth/apps', (req, res) => {
  const userId = Number(req.query.userId || 0);
  const userType = String(req.query.userType || '');
  if (!userId || !userType) return res.status(400).json({ ok: false, err: "Foydalanuvchi ma'lumotlari kiritilmadi." });

  const rows = stOAuthClientList.all(userId, userType);
  const apps = rows.map(r => ({
    clientId: r.client_id,
    appName: r.app_name,
    allowedOrigins: JSON.parse(r.allowed_origins || '[]'),
    allowedCallbacks: JSON.parse(r.allowed_callbacks || '[]'),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
  res.json({ ok: true, data: apps });
});

// Update Whitelisted URLs (Oq ro'yxatni almashtirish / tahrirlash)
app.put('/api/oauth/apps/:clientId', rateLimiter(20, 60000), (req, res) => {
  const { clientId } = req.params;
  const { userId, userType, appName, requestUrl, callbackUrl } = req.body || {};
  if (!userId || !userType || !appName || !requestUrl || !callbackUrl) {
    return res.status(400).json({ ok: false, err: "Barcha maydonlar kiritilishi shart." });
  }

  const normOrigin = normalizeUrlOrigin(requestUrl);
  if (!normOrigin) {
    return res.status(400).json({ ok: false, err: "So'rov keladigan sayt manzili noto'g'ri formatda." });
  }

  let normCallback;
  try { normCallback = new URL(callbackUrl).href; } catch(e) {
    return res.status(400).json({ ok: false, err: "Callback manzili noto'g'ri formatda." });
  }

  const originsJson = JSON.stringify([normOrigin]);
  const callbacksJson = JSON.stringify([normCallback]);
  const timestamp = now();

  const info = stOAuthClientUpdate.run(String(appName).trim(), originsJson, callbacksJson, timestamp, String(clientId), Number(userId), String(userType));
  if (info.changes === 0) {
    return res.status(404).json({ ok: false, err: "API topilmadi yoki sizga tegishli emas." });
  }

  res.json({ ok: true, message: "Oq ro'yxat manzillari va ilova ma'lumotlari muvaffaqiyatli yangilandi!" });
});

// Regenerate Secret
app.post('/api/oauth/apps/:clientId/regenerate-secret', rateLimiter(10, 60000), (req, res) => {
  const { clientId } = req.params;
  const { userId, userType } = req.body || {};
  if (!userId || !userType) return res.status(400).json({ ok: false, err: "Ruxsat berilmadi." });

  const newRawSecret = 'texnoo_sec_' + crypto.randomBytes(24).toString('hex');
  const secretHash = hashSecret(newRawSecret);
  const timestamp = now();

  const info = stOAuthClientRegenSecret.run(secretHash, timestamp, String(clientId), Number(userId), String(userType));
  if (info.changes === 0) return res.status(404).json({ ok: false, err: "API topilmadi." });

  res.json({ ok: true, clientSecret: newRawSecret });
});

// Delete API Key
app.delete('/api/oauth/apps/:clientId', (req, res) => {
  const { clientId } = req.params;
  const userId = Number(req.query.userId || req.body?.userId || 0);
  const userType = String(req.query.userType || req.body?.userType || '');
  if (!userId || !userType) return res.status(400).json({ ok: false, err: "Ruxsat berilmadi." });

  stOAuthClientDelete.run(String(clientId), userId, userType);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════
// OWASP COMPLIANT OAUTH 2.0 & USERINFO ENDPOINTS
// ════════════════════════════════════════════════════════════════════════
const stOAuthCodeSave = db.prepare(`INSERT INTO oauth_codes (code, client_id, user_id, user_type, redirect_uri, code_challenge, code_challenge_method, expires_at, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`);
const stOAuthCodeGet = db.prepare(`SELECT * FROM oauth_codes WHERE code=? AND client_id=?`);
const stOAuthCodeMarkUsed = db.prepare(`UPDATE oauth_codes SET used=1 WHERE code=?`);
const stOAuthTokenSave = db.prepare(`INSERT INTO oauth_tokens (access_token, client_id, user_id, user_type, expires_at) VALUES (?, ?, ?, ?, ?)`);
const stOAuthTokenGet = db.prepare(`SELECT * FROM oauth_tokens WHERE access_token=?`);

// 1. GET /oauth/authorize -> Consent / Login Dialog
app.get('/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, state, code_challenge, code_challenge_method } = req.query;
  if (!client_id || !redirect_uri) {
    return res.status(400).send("<h3>Xatolik: client_id va redirect_uri kiritilishi shart.</h3>");
  }

  const client = stOAuthClientGet.get(String(client_id));
  if (!client) {
    return res.status(400).send("<h3>Xatolik: Noto'g'ri client_id. Texnoo Auth API topilmadi.</h3>");
  }

  // Validate Whitelisted Callback URL (OWASP API3 Open Redirect Protection)
  if (!isCallbackWhitelisted(redirect_uri, client.allowed_callbacks)) {
    return res.status(403).send(`<h3>Security Error (OWASP Whitelist Violation):</h3><p>Redirect URI (<b>${escHtml(redirect_uri)}</b>) ushbu API ning oq ro'yxatiga (whitelisted callbacks) kiritilmagan!</p>`);
  }

  // Validate Origin header if present
  const reqOrigin = req.headers['origin'] || req.headers['referer'];
  if (reqOrigin && !isOriginWhitelisted(reqOrigin, client.allowed_origins)) {
    return res.status(403).send(`<h3>Security Error (OWASP Whitelist Violation):</h3><p>So'rov yuborilgan domen (<b>${escHtml(reqOrigin)}</b>) ushbu API ning oq ro'yxatiga kiritilmagan!</p>`);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Texnoo Auth Authorization</title>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Exo+2:wght@400;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        body { background: #060c18; color: #e2eaff; font-family: 'Exo 2', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .auth-card { background: #0d1628; border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center; }
        .logo { font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 800; color: #00e5ff; letter-spacing: 2px; margin-bottom: 8px; }
        .app-box { background: rgba(0, 229, 255, 0.06); border: 1px dashed rgba(0, 229, 255, 0.3); border-radius: 12px; padding: 16px; margin: 20px 0; text-align: left; }
        .app-title { font-weight: 700; font-size: 16px; color: #fff; margin-bottom: 4px; }
        .app-url { font-size: 12px; color: #8a9cc5; word-break: break-all; }
        .scope-list { text-align: left; margin: 16px 0; font-size: 13px; color: #8a9cc5; }
        .scope-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; color: #e2eaff; }
        .scope-item i { color: #00ff88; }
        .btn-group { display: flex; gap: 12px; margin-top: 24px; }
        .btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; font-size: 14px; transition: .2s; }
        .btn-allow { background: #00e5ff; color: #060c18; }
        .btn-allow:hover { background: #35ff9f; }
        .btn-deny { background: rgba(255, 56, 96, 0.15); color: #ff3860; border: 1px solid #ff3860; }
        .btn-deny:hover { background: rgba(255, 56, 96, 0.3); }
        .btn-google { width: 100%; background: #ffffff; color: #333; margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 13px; box-sizing: border-box; }
      </style>
    </head>
    <body>
      <div class="auth-card">
        <div class="logo"><i class="fas fa-shield-halved"></i> TEXNOO AUTH</div>
        <p style="font-size:13px;color:#8a9cc5;">Ushbu dastur sizning Texnoo profilingizga kirish ruxsatini so'ramoqda:</p>
        
        <div class="app-box">
          <div class="app-title"><i class="fas fa-laptop-code" style="color:#00e5ff;"></i> ${escHtml(client.app_name)}</div>
          <div class="app-url"><i class="fas fa-link"></i> ${escHtml(redirect_uri)}</div>
        </div>

        <div class="scope-list">
          <div style="font-weight:700;color:#fff;margin-bottom:8px;">So'ralayotgan ma'lumotlar:</div>
          <div class="scope-item"><i class="fas fa-check-circle"></i> Profil rasmi (Avatar)</div>
          <div class="scope-item"><i class="fas fa-check-circle"></i> Ism va Familiya</div>
          <div class="scope-item"><i class="fas fa-check-circle"></i> Email manzili</div>
        </div>

        <form method="POST" action="/oauth/authorize/confirm">
          <input type="hidden" name="client_id" value="${escHtml(client_id)}">
          <input type="hidden" name="redirect_uri" value="${escHtml(redirect_uri)}">
          <input type="hidden" name="state" value="${escHtml(state || '')}">
          <input type="hidden" name="code_challenge" value="${escHtml(code_challenge || '')}">
          <input type="hidden" name="code_challenge_method" value="${escHtml(code_challenge_method || '')}">
          
          <div class="btn-group">
            <button type="submit" name="decision" value="deny" class="btn btn-deny">Rad etish</button>
            <button type="submit" name="decision" value="allow" class="btn btn-allow">Ruxsat berish</button>
          </div>
        </form>

        <a href="/auth/google?action=oauth_sso" class="btn-google">
          <i class="fab fa-google" style="color:#DB4437;font-size:16px;"></i> Google orqali kirish
        </a>
      </div>
    </body>
    </html>
  `);
});

// Authorization Decision confirmation
app.post('/oauth/authorize/confirm', express.urlencoded({ extended: true }), (req, res) => {
  const { client_id, redirect_uri, state, decision, code_challenge, code_challenge_method } = req.body;
  if (!client_id || !redirect_uri) return res.status(400).send("Xato so'rov");

  const client = stOAuthClientGet.get(String(client_id));
  if (!client || !isCallbackWhitelisted(redirect_uri, client.allowed_callbacks)) {
    return res.status(403).send("Whitelist error");
  }

  if (decision !== 'allow') {
    const denyUrl = new URL(redirect_uri);
    denyUrl.searchParams.set('error', 'access_denied');
    if (state) denyUrl.searchParams.set('state', state);
    return res.redirect(denyUrl.href);
  }

  const userId = req.session?.user?.id || client.user_id || 1;
  const userType = req.session?.user?.type || client.user_type || 'student';

  const code = 'code_' + crypto.randomBytes(18).toString('hex');
  const expiresAt = now() + 5 * 60 * 1000;

  stOAuthCodeSave.run(code, client_id, userId, userType, redirect_uri, code_challenge || null, code_challenge_method || null, expiresAt);

  const targetUrl = new URL(redirect_uri);
  targetUrl.searchParams.set('code', code);
  if (state) targetUrl.searchParams.set('state', state);

  res.redirect(targetUrl.href);
});

// 2. POST /oauth/token -> Exchange Code for Access Token
app.post('/oauth/token', rateLimiter(30, 60000), (req, res) => {
  const { client_id, client_secret, code, redirect_uri, grant_type } = req.body || {};
  if (grant_type !== 'authorization_code' || !client_id || !code) {
    return res.status(400).json({ ok: false, error: "invalid_request", error_description: "grant_type=authorization_code, client_id va code talab qilinadi." });
  }

  const client = stOAuthClientGet.get(String(client_id));
  if (!client) return res.status(400).json({ ok: false, error: "invalid_client", error_description: "Client ID topilmadi." });

  if (client_secret) {
    const checkHash = hashSecret(client_secret);
    if (checkHash !== client.client_secret_hash) {
      return res.status(401).json({ ok: false, error: "invalid_client", error_description: "Client secret noto'g'ri." });
    }
  }

  const incomingOrigin = req.headers['origin'] || req.headers['referer'];
  if (incomingOrigin && !isOriginWhitelisted(incomingOrigin, client.allowed_origins)) {
    return res.status(403).json({ ok: false, error: "invalid_origin", error_description: `So'rov yuborilgan origin (${incomingOrigin}) oq ro'yxatga kiritilmagan.` });
  }

  const codeRecord = stOAuthCodeGet.get(String(code), String(client_id));
  if (!codeRecord) {
    return res.status(400).json({ ok: false, error: "invalid_grant", error_description: "Authorization code noto'g'ri." });
  }

  if (codeRecord.used) {
    return res.status(400).json({ ok: false, error: "invalid_grant", error_description: "Authorization code allaqachon ishlatilgan." });
  }

  if (now() > codeRecord.expires_at) {
    return res.status(400).json({ ok: false, error: "invalid_grant", error_description: "Authorization code muddati o'tgan." });
  }

  stOAuthCodeMarkUsed.run(String(code));

  const accessToken = 'texnoo_at_' + crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = now() + 30 * 24 * 60 * 60 * 1000;

  stOAuthTokenSave.run(accessToken, client_id, codeRecord.user_id, codeRecord.user_type, tokenExpiresAt);

  res.json({
    ok: true,
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 2592000
  });
});

// 3. GET/POST /oauth/userinfo -> Return Avatar, Name, Email
app.all('/oauth/userinfo', rateLimiter(60, 60000), (req, res) => {
  const incomingOrigin = req.headers['origin'] || req.headers['referer'];
  if (incomingOrigin) {
    res.setHeader('Access-Control-Allow-Origin', incomingOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();

  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) token = token.slice(7);
  if (!token) token = req.query.access_token || req.body?.access_token;

  if (!token) {
    return res.status(401).json({ ok: false, error: "unauthorized", error_description: "Access token kiritilmadi (Authorization: Bearer <token>)." });
  }

  const tokenRec = stOAuthTokenGet.get(String(token));
  if (!tokenRec || now() > tokenRec.expires_at) {
    return res.status(401).json({ ok: false, error: "invalid_token", error_description: "Access token eskirgan yoki topilmadi." });
  }

  const client = stOAuthClientGet.get(tokenRec.client_id);
  if (client && incomingOrigin && !isOriginWhitelisted(incomingOrigin, client.allowed_origins)) {
    return res.status(403).json({ ok: false, error: "invalid_origin", error_description: "Origin ushbu API ning oq ro'yxatida yo'q." });
  }

  const userProfile = getUserProfileInfo(tokenRec.user_id, tokenRec.user_type);
  if (!userProfile) {
    return res.status(404).json({ ok: false, error: "user_not_found", error_description: "Foydalanuvchi ma'lumoti topilmadi." });
  }

  res.json({
    ok: true,
    user: {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      avatar: userProfile.avatar,
      type: userProfile.type
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TELEGRAM PHOTO PROXY
// ════════════════════════════════════════════════════════════════════════
app.post('/api/upload-photo', async (req, res) => {
  const { base64 } = req.body;
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.PHOTO_CHAT_ID;
  if (!botToken || !chatId || !base64) return res.status(400).json({ ok: false, err: 'Configuration or image missing' });

  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', blob, 'photo.jpg');

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const data = await tgRes.json();
    if (!data.ok) return res.status(400).json({ ok: false, err: data.description });
    
    // Eng katta rasmni tanlash
    const photos = data.result.photo;
    const fileId = photos[photos.length - 1].file_id;
    res.json({ ok: true, file_id: fileId });
  } catch (e) {
    console.error('Photo upload error:', e);
    res.status(500).json({ ok: false, err: e.message });
  }
});

app.get('/api/photo/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return res.status(404).end();
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) return res.status(404).end();
    
    const filePath = fileData.result.file_path;
    const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Keshda 1 yil
    imgRes.body.pipe(res);
  } catch (e) {
    res.status(500).end();
  }
});

// ════════════════════════════════════════════════════════════════════════
// STATIC + SPA FALLBACK
// ════════════════════════════════════════════════════════════════════════
app.use(express.static(__dirname, { index: ['index.html'] }));

app.get('/callback', (req, res) => res.sendFile(path.join(__dirname, 'callback.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ───────────────────────── SERVER START ─────────────────────────
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[EDU-CRM] Server ishlayapti → http://localhost:${PORT}`);
  console.log(`[EDU-CRM] SQLite DB → ${DB_PATH}`);
  console.log(`[EDU-CRM] DATA_DIR   → ${DATA_DIR}`);
  console.log(`[EDU-CRM] Backend ishlayapti · Ma'lumotlar data.db'ga yoziladi (local/localStorage emas!)`);
});
