export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const STICKERS = {
  cihuy: { src: '/stickers/cihuy.webp', width: 360, height: 360 },
  'ketar-ketir': { src: '/stickers/ketar-ketir.webp', width: 360, height: 348 },
};

export function stampHtml(name, className = '') {
  const sticker = STICKERS[name];
  if (!sticker) return '';
  return `<img class="stamp ${className}" src="${sticker.src}" width="${sticker.width}" height="${sticker.height}" alt="" decoding="async" />`;
}

/**
 * Menghilangkan efek shimmer di `host` begitu gambar selesai dimuat (atau gagal),
 * lalu menampilkan gambarnya dengan fade-in.
 */
export function revealWhenLoaded(img, host) {
  const ready = () => {
    img.classList.add('is-loaded');
    host.classList.remove('shimmer');
  };
  const failed = () => {
    host.classList.remove('shimmer');
    host.classList.add('is-broken');
  };
  if (img.complete && img.naturalWidth > 0) ready();
  else {
    img.addEventListener('load', ready, { once: true });
    img.addEventListener('error', failed, { once: true });
  }
}
