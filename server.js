'use strict';

require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const SCREENSHOT_DIR = path.join(UPLOAD_DIR, 'screenshots');
const DATA_DIR = path.join(ROOT, 'data');
const TOOLS_FILE = path.join(DATA_DIR, 'tools.json');
const MAX_UPLOAD_MB = Math.min(Math.max(Number(process.env.MAX_UPLOAD_MB || 25), 1), 50);
const MAX_SCREENSHOT_MB = Math.min(Math.max(Number(process.env.MAX_SCREENSHOT_MB || 5), 1), 10);
const MAX_SCREENSHOTS = Math.min(Math.max(Number(process.env.MAX_SCREENSHOTS || 4), 1), 8);
const SESSION_TTL_MS = Math.min(Math.max(Number(process.env.SESSION_TTL_HOURS || 8), 1), 48) * 60 * 60 * 1000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const COOKIE_NAME = process.env.COOKIE_NAME || 'c2v3za_admin_session';
const COOKIE_SAME_SITE = ['lax', 'strict', 'none'].includes(String(process.env.COOKIE_SAME_SITE).toLowerCase())
  ? String(process.env.COOKIE_SAME_SITE).toLowerCase()
  : 'lax';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE).toLowerCase() === 'true';
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || '').trim();

if (!process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH === 'replace_me') {
  console.warn('\nADMIN_PASSWORD_HASH is not configured. Login will be disabled until you set it in .env.\n');
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TOOLS_FILE)) fs.writeFileSync(TOOLS_FILE, '[]\n', 'utf8');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", ...(PUBLIC_ORIGIN ? [PUBLIC_ORIGIN] : [])]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// Strict CORS: only the explicitly configured frontend origin may call the API cross-origin.
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (PUBLIC_ORIGIN && origin === PUBLIC_ORIGIN) {
    res.set({
      'Access-Control-Allow-Origin': PUBLIC_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Vary': 'Origin'
    });
  }
  if (req.method === 'OPTIONS') {
    if (PUBLIC_ORIGIN && origin !== PUBLIC_ORIGIN) return res.status(403).end();
    return res.status(204).end();
  }
  next();
});

function safeEqualText(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function verifyPassword(password, encoded) {
  try {
    const [scheme, N, r, p, salt, expectedHex] = String(encoded || '').split('$');
    if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
    const n = Number(N);
    const rr = Number(r);
    const pp = Number(p);
    if (!Number.isInteger(n) || !Number.isInteger(rr) || !Number.isInteger(pp)) return false;
    if (n < 4096 || n > 262144 || rr < 1 || rr > 32 || pp < 1 || pp > 8) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length, { N: n, r: rr, p: pp });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

const sessions = new Map();
const loginAttempts = new Map();

function cleanupMemory() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [key, item] of loginAttempts) {
    if (item.resetAt <= now) loginAttempts.delete(key);
  }
}
setInterval(cleanupMemory, 60_000).unref();

function clientIp(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function authRateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const state = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60_000 };
  if (state.resetAt <= now) {
    state.count = 0;
    state.resetAt = now + 15 * 60_000;
  }
  return state.count >= 8;
}

function registerFailedLogin(req) {
  const key = clientIp(req);
  const now = Date.now();
  const state = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60_000 };
  state.count += 1;
  loginAttempts.set(key, state);
}

function clearFailedLogins(req) {
  loginAttempts.delete(clientIp(req));
}

// Small cookie helper: Express does not expose res.cookie until cookie-parser is used,
// so we set the headers ourselves with a strict, limited cookie value.
function setRawCookie(res, name, value, options) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor((options.maxAge || 0) / 1000))}`,
    options.httpOnly ? 'HttpOnly' : '',
    options.secure ? 'Secure' : '',
    options.sameSite ? `SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}` : ''
  ].filter(Boolean);
  res.append('Set-Cookie', attrs.join('; '));
}

function getCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return ''; }
    }
  }
  return '';
}

function createSession() {
  const token = randomToken(32);
  const csrf = randomToken(32);
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, csrf });
  return { token, csrf };
}

function getSession(req) {
  const token = getCookie(req, COOKIE_NAME);
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, ...session };
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.session = session;
  next();
}

function requireCsrf(req, res, next) {
  if (!req.session) return res.status(401).json({ error: 'Unauthorized' });
  const supplied = String(req.headers['x-csrf-token'] || '');
  if (!supplied || !safeEqualText(supplied, req.session.csrf)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

function normalizeToolField(value, maxLength) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function isValidToolName(name) {
  return /^[\p{L}\p{N}][\p{L}\p{N} ._()\-]{0,79}$/u.test(name);
}

function originalZipMime(file) {
  const allowed = new Set(['application/zip', 'application/octet-stream', 'application/x-zip-compressed']);
  return allowed.has(String(file.mimetype || '').toLowerCase());
}

function screenshotMime(file) {
  const allowed = new Map([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp']
  ]);
  return allowed.get(String(file.mimetype || '').toLowerCase()) || '';
}

const storage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, file.fieldname === 'screenshots' ? SCREENSHOT_DIR : UPLOAD_DIR),
  filename: (_req, file, cb) => {
    if (file.fieldname === 'screenshots') {
      const ext = screenshotMime(file) || 'bin';
      return cb(null, `${crypto.randomUUID()}.${ext}`);
    }
    cb(null, `${crypto.randomUUID()}.zip`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 1 + MAX_SCREENSHOTS,
    fields: 4,
    fieldSize: 10 * 1024,
    parts: 8
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'file') {
      return cb(null, originalZipMime(file) && /\.zip$/i.test(file.originalname));
    }
    if (file.fieldname === 'screenshots') {
      const extOk = /\.(png|jpe?g|webp)$/i.test(file.originalname);
      return cb(null, Boolean(screenshotMime(file)) && extOk);
    }
    cb(null, false);
  }
});

async function readTools() {
  try {
    const raw = await fsp.readFile(TOOLS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTools(tools) {
  const temp = `${TOOLS_FILE}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify(tools, null, 2)}\n`, 'utf8');
  await fsp.rename(temp, TOOLS_FILE);
}

async function removeIfExists(filePath) {
  try { await fsp.unlink(filePath); } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function isPng(buffer) {
  return buffer.length >= 8 && Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).equals(buffer.subarray(0,8));
}

function isJpeg(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isWebp(buffer) {
  return buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF'
    && buffer.subarray(8,12).toString('ascii') === 'WEBP';
}

async function detectScreenshotType(filePath) {
  const head = Buffer.alloc(12);
  const handle = await fsp.open(filePath, 'r');
  try { await handle.read(head, 0, 12, 0); } finally { await handle.close(); }
  if (isPng(head)) return 'image/png';
  if (isJpeg(head)) return 'image/jpeg';
  if (isWebp(head)) return 'image/webp';
  return '';
}

function publicTool(tool) {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    originalName: tool.originalName,
    size: tool.size,
    createdAt: tool.createdAt,
    screenshots: Array.isArray(tool.screenshots)
      ? tool.screenshots.map((shot) => ({
          id: shot.id,
          url: `/api/tools/${encodeURIComponent(tool.id)}/screenshots/${encodeURIComponent(shot.id)}`,
          mime: shot.mime,
          size: shot.size
        }))
      : []
  };
}

app.get('/api/tools', async (_req, res) => {
  const tools = await readTools();
  res.set('Cache-Control', 'no-store');
  res.json(tools.filter(Boolean).map(publicTool));
});

app.get('/api/auth/status', (req, res) => {
  const session = getSession(req);
  res.set('Cache-Control', 'no-store');
  res.json({ authenticated: Boolean(session) });
});

app.post('/api/auth/login', (req, res) => {
  if (authRateLimited(req)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  const username = normalizeToolField(req.body?.username, 64);
  const password = String(req.body?.password || '');
  const valid = safeEqualText(username, ADMIN_USERNAME)
    && Boolean(process.env.ADMIN_PASSWORD_HASH)
    && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);

  if (!valid) {
    registerFailedLogin(req);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  clearFailedLogins(req);
  const existing = getCookie(req, COOKIE_NAME);
  if (existing) sessions.delete(existing);
  const session = createSession();
  setRawCookie(res, COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    maxAge: SESSION_TTL_MS
  });
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

app.post('/api/auth/logout', requireAuth, requireCsrf, (req, res) => {
  sessions.delete(req.session.token);
  clearSessionCookieHeader(res);
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

function clearSessionCookieHeader(res) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    COOKIE_SECURE ? 'Secure' : '',
    `SameSite=${COOKIE_SAME_SITE[0].toUpperCase()}${COOKIE_SAME_SITE.slice(1)}`
  ].filter(Boolean);
  res.append('Set-Cookie', attrs.join('; '));
}

app.get('/api/auth/csrf', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ token: req.session.csrf });
});

app.get('/api/tools/:id/screenshots/:screenshotId', async (req, res) => {
  const id = String(req.params.id || '');
  const screenshotId = String(req.params.screenshotId || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(screenshotId)) {
    return res.status(400).send('Invalid id');
  }

  const tools = await readTools();
  const tool = tools.find((item) => item.id === id);
  if (!tool || !Array.isArray(tool.screenshots)) return res.status(404).send('Not found');
  const shot = tool.screenshots.find((item) => item.id === screenshotId);
  if (!shot) return res.status(404).send('Not found');

  const target = path.resolve(SCREENSHOT_DIR, path.basename(String(shot.fileName || '')));
  if (!target.startsWith(path.resolve(SCREENSHOT_DIR) + path.sep)) return res.status(404).send('Not found');
  try { await fsp.access(target, fs.constants.R_OK); } catch { return res.status(404).send('File missing'); }

  const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowedMime.has(String(shot.mime || ''))) return res.status(404).send('Not found');
  res.set({
    'Content-Type': shot.mime,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'public, max-age=86400, immutable'
  });
  res.sendFile(target);
});

app.get('/api/tools/:id/download', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).send('Invalid id');
  const tools = await readTools();
  const tool = tools.find((item) => item.id === id);
  if (!tool) return res.status(404).send('Not found');
  const target = path.resolve(UPLOAD_DIR, tool.fileName);
  if (!target.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return res.status(404).send('Not found');
  try {
    await fsp.access(target, fs.constants.R_OK);
  } catch {
    return res.status(404).send('File missing');
  }
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${String(tool.originalName || 'tool.zip').replace(/[\r\n"\\]/g, '_')}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  res.sendFile(target);
});

app.post('/api/tools', requireAuth, requireCsrf, (req, res) => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'screenshots', maxCount: MAX_SCREENSHOTS }
  ])(req, res, async (err) => {
    const uploadedFiles = [
      ...(req.files?.file || []),
      ...(req.files?.screenshots || [])
    ];

    if (err) {
      for (const file of uploadedFiles) await removeIfExists(file.path).catch(() => {});
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Datei zu groß. ZIP-Limit: ${MAX_UPLOAD_MB} MB, Screenshot-Limit: ${MAX_SCREENSHOT_MB} MB pro Bild.` });
      }
      return res.status(400).json({ error: 'Upload abgelehnt. Erlaubt sind 1 ZIP und bis zu 4 PNG/JPG/WebP-Screenshots.' });
    }

    const zipFile = req.files?.file?.[0];
    const screenshotFiles = req.files?.screenshots || [];
    if (!zipFile) return res.status(400).json({ error: 'Eine ZIP-Datei ist erforderlich.' });

    try {
      const name = normalizeToolField(req.body?.name, 80);
      const description = normalizeToolField(req.body?.description, 280);
      const category = normalizeToolField(req.body?.category, 40);
      if (!isValidToolName(name)) {
        for (const file of uploadedFiles) await removeIfExists(file.path);
        return res.status(400).json({ error: 'Ungültiger Tool-Name.' });
      }
      if (!category || !/^[\p{L}\p{N} _./&+\-]{1,40}$/u.test(category)) {
        for (const file of uploadedFiles) await removeIfExists(file.path);
        return res.status(400).json({ error: 'Ungültige Kategorie.' });
      }

      const head = Buffer.alloc(4);
      const handle = await fsp.open(zipFile.path, 'r');
      try { await handle.read(head, 0, 4, 0); } finally { await handle.close(); }
      if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
        for (const file of uploadedFiles) await removeIfExists(file.path);
        return res.status(400).json({ error: 'Das ZIP-Format konnte nicht validiert werden.' });
      }

      const validatedScreenshots = [];
      for (const shot of screenshotFiles) {
        if (shot.size > MAX_SCREENSHOT_MB * 1024 * 1024) {
          for (const file of uploadedFiles) await removeIfExists(file.path);
          return res.status(413).json({ error: `Screenshot zu groß. Limit: ${MAX_SCREENSHOT_MB} MB pro Bild.` });
        }
        const actualMime = await detectScreenshotType(shot.path);
        if (!actualMime) {
          for (const file of uploadedFiles) await removeIfExists(file.path);
          return res.status(400).json({ error: 'Mindestens ein Screenshot ist kein gültiges PNG/JPG/WebP-Bild.' });
        }
        validatedScreenshots.push({
          id: crypto.randomUUID(),
          fileName: path.basename(shot.filename),
          originalName: path.basename(shot.originalname).replace(/[\r\n\\"/]/g, '_').slice(0, 120),
          mime: actualMime,
          size: shot.size
        });
      }

      const tools = await readTools();
      const record = {
        id: crypto.randomUUID(),
        name,
        description,
        category,
        originalName: path.basename(zipFile.originalname).replace(/[\r\n\\"/]/g, '_').slice(0, 120),
        fileName: path.basename(zipFile.filename),
        size: zipFile.size,
        screenshots: validatedScreenshots,
        createdAt: new Date().toISOString()
      };
      tools.unshift(record);
      try {
        await writeTools(tools);
      } catch (error) {
        for (const file of uploadedFiles) await removeIfExists(file.path).catch(() => {});
        throw error;
      }
      res.status(201).json(publicTool(record));
    } catch (error) {
      for (const file of uploadedFiles) await removeIfExists(file.path).catch(() => {});
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: 'Upload fehlgeschlagen.' });
    }
  });
});

app.delete('/api/tools/:id', requireAuth, requireCsrf, async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const tools = await readTools();
  const index = tools.findIndex((item) => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const [tool] = tools.splice(index, 1);
  await writeTools(tools);
  await removeIfExists(path.join(UPLOAD_DIR, path.basename(tool.fileName)));
  for (const shot of Array.isArray(tool.screenshots) ? tool.screenshots : []) {
    await removeIfExists(path.join(SCREENSHOT_DIR, path.basename(String(shot.fileName || ''))));
  }
  res.json({ ok: true });
});

app.use(express.static(PUBLIC_DIR, {
  etag: true,
  extensions: ['html'],
  index: 'index.html',
  setHeaders(res, filePath) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-cache');
    if (filePath.endsWith('.html')) res.set('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'");
  }
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`C2V3ZA Tools running on http://localhost:${PORT}`);
});
