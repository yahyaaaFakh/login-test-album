import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(process.env.STATIC_DIR ?? path.join(__dirname, '..', 'dist'));
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const handleApi = createApiHandler();

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const target = path.normalize(path.join(DIST_DIR, decoded));
  if (target !== DIST_DIR && !target.startsWith(DIST_DIR + path.sep)) return null; // cegah keluar folder
  try {
    const info = await stat(target);
    if (info.isFile()) return { file: target, size: info.size };
    const index = path.join(target, 'index.html');
    const indexInfo = await stat(index);
    return { file: index, size: indexInfo.size };
  } catch {
    return null;
  }
}

function sendFile(res, { file, size }) {
  const ext = path.extname(file).toLowerCase();
  const isHashedAsset = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const match = await resolveFile(pathname);
  if (match) return sendFile(res, match);

  // Path yang kelihatannya file (ada ekstensi) tapi tidak ada -> 404. Selain itu balik ke halaman utama.
  if (path.extname(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Tidak ditemukan');
  }
  const fallback = await resolveFile('/index.html');
  if (fallback) return sendFile(res, fallback);

  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Folder dist belum ada. Jalankan "npm run build" dulu.');
});

server.listen(PORT, () => {
  console.log(`Sirkel Suki jalan di http://localhost:${PORT}`);
});
