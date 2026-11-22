import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_DIR = path.join(__dirname, 'private', 'photos');
const PHOTO_DATA = path.join(__dirname, 'data', 'photos.json');

// Kredensial login. Bisa diganti lewat environment variable tanpa ubah kode.
const USERNAME = process.env.SUKI_USER ?? 'sukiprobolinggo';
const PASSWORD = process.env.SUKI_PASS ?? 'kapalkaram';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;
const COOKIE_NAME = 'suki_sid';

const sessions = new Map(); // token -> waktu kedaluwarsa
const attempts = new Map(); // ip -> { count, lockedUntil }

const sha256 = (value) => createHash('sha256').update(String(value)).digest();
const safeEqual = (a, b) => timingSafeEqual(sha256(a), sha256(b));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sessionCookie(value, maxAgeSeconds) {
  const flags = ['HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAgeSeconds}`];
  if (process.env.COOKIE_SECURE === 'true') flags.push('Secure');
  return `${COOKIE_NAME}=${value}; ${flags.join('; ')}`;
}

function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function readJson(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(Object.assign(new Error('Body terlalu besar'), { status: 413 }));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('JSON tidak valid'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handleLogin(req, res) {
  const ip = req.socket.remoteAddress ?? 'unknown';
  const record = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return sendJson(res, 429, { error: 'too_many_attempts', retryAfter }, { 'Retry-After': String(retryAfter) });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return sendJson(res, error.status ?? 400, { error: 'bad_request' });
  }

  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 200) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

  // Dua-duanya selalu dibandingkan supaya waktu respons tidak membocorkan mana yang salah.
  const userOk = safeEqual(username, USERNAME);
  const passOk = safeEqual(password, PASSWORD);

  if (!(userOk && passOk)) {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.count = 0;
      record.lockedUntil = Date.now() + LOCK_MS;
    }
    attempts.set(ip, record);
    await sleep(400); // memperlambat tebak-tebakan password
    return sendJson(res, 401, { error: 'invalid_credentials' });
  }

  attempts.delete(ip);
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_MS / 1000) });
}

function handleLogout(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) sessions.delete(token);
  return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
}

async function handlePhotoList(res) {
  const photos = JSON.parse(await readFile(PHOTO_DATA, 'utf8'));
  return sendJson(res, 200, { photos });
}

async function handlePhotoFile(res, variant, name) {
  // Hanya nama file sederhana yang boleh lewat, jadi tidak bisa keluar dari folder foto.
  if (!['thumb', 'full'].includes(variant) || !/^[a-z0-9-]+\.webp$/.test(name)) {
    return sendJson(res, 404, { error: 'not_found' });
  }
  const filePath = path.join(PHOTO_DIR, variant, name);
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return sendJson(res, 404, { error: 'not_found' });
  }
  res.writeHead(200, {
    'Content-Type': 'image/webp',
    'Content-Length': info.size,
    'Cache-Control': 'private, max-age=86400',
  });
  createReadStream(filePath)
    .on('error', () => res.destroy())
    .pipe(res);
}

/**
 * Mengembalikan fungsi (req, res) => Promise<boolean>.
 * true  = request sudah ditangani di sini (/api/* dan /photos/*)
 * false = bukan urusan API, biarkan server lain (Vite / static) yang jawab
 */
export function createApiHandler() {
  return async function handle(req, res) {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const isApi = pathname.startsWith('/api/');
    const isPhoto = pathname.startsWith('/photos/');
    if (!isApi && !isPhoto) return false;

    try {
      if (isApi) {
        const route = `${req.method} ${pathname}`;
        if (route === 'GET /api/session') {
          sendJson(res, 200, { authenticated: isAuthenticated(req) });
        } else if (route === 'POST /api/login') {
          await handleLogin(req, res);
        } else if (route === 'POST /api/logout') {
          handleLogout(req, res);
        } else if (route === 'GET /api/photos') {
          if (!isAuthenticated(req)) sendJson(res, 401, { error: 'unauthorized' });
          else await handlePhotoList(res);
        } else {
          sendJson(res, 404, { error: 'not_found' });
        }
        return true;
      }

      // /photos/<thumb|full>/<nama>.webp, hanya untuk yang sudah login
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method_not_allowed' });
        return true;
      }
      if (!isAuthenticated(req)) {
        sendJson(res, 401, { error: 'unauthorized' });
        return true;
      }
      const [, , variant, name] = pathname.split('/');
      await handlePhotoFile(res, variant, name ?? '');
      return true;
    } catch (error) {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
      else res.end();
      return true;
    }
  };
}
