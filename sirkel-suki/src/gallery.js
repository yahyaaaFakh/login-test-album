import { getPhotos, logout } from './api.js';
import { icon } from './icons.js';
import { createLightbox } from './lightbox.js';
import { esc, revealWhenLoaded, sleep, stampHtml } from './utils.js';

// Skeleton tampil minimal selama ini, supaya shimmer-nya sempat terlihat walau koneksi cepat.
const MIN_SKELETON_MS = 900;
const SKELETON_RATIOS = ['4 / 5', '3 / 4', '1 / 1', '3 / 4', '5 / 6', '4 / 5', '3 / 4', '1 / 1', '4 / 5'];

const MAP_SRC =
  'https://www.openstreetmap.org/export/embed.html?bbox=113.1700%2C-7.7900%2C113.2600%2C-7.7200&layer=mapnik&marker=-7.7543%2C113.2159';
const MAPS_LINK = 'https://www.google.com/maps/search/?api=1&query=Probolinggo%2C%20Jawa%20Timur';

export function createGalleryView({ onLogout, onExpired }) {
  const element = document.createElement('div');
  element.className = 'page';
  element.innerHTML = `
    <header class="topbar">
      <a class="topbar__brand" href="#top">
        <img src="/stickers/cihuy.webp" width="360" height="360" alt="" />
        <span>Sirkel Suki</span>
      </a>
      <nav class="topbar__nav" aria-label="Navigasi halaman">
        <a href="#galeri">Galeri</a>
        <a href="#lokasi">Lokasi</a>
      </nav>
      <button class="btn btn--ghost btn--sm" type="button" data-logout>
        <span class="btn__label">Keluar</span>
        <span class="btn__spinner" aria-hidden="true"></span>
      </button>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero__copy">
          <h1>Album sirkel kita</h1>
          <p class="hero__lead">Foto-foto bareng dari nongkrong, jalan-jalan, sampai wisuda. Klik foto mana saja untuk melihatnya lebih besar.</p>
          <div class="hero__actions">
            <a class="btn btn--primary" href="#galeri">
              <span class="btn__label">Lihat galeri</span>
              <span class="btn__icon btn__icon--down">${icon('arrowDown')}</span>
            </a>
            <a class="btn btn--ghost" href="#lokasi">
              <span class="btn__label">Lokasi kita</span>
            </a>
          </div>
        </div>
        <div class="hero__visual" data-hero>
          <div class="hero__photo shimmer" aria-hidden="true"></div>
        </div>
      </section>

      <section class="gallery" id="galeri" aria-labelledby="galeri-title">
        <div class="section-head">
          <h2 id="galeri-title">Galeri</h2>
          <p>Arahkan kursor ke foto untuk membaca ceritanya.</p>
        </div>
        <div class="grid" data-grid aria-busy="true"></div>
      </section>

      <section class="location" id="lokasi" aria-labelledby="lokasi-title">
        <div class="location__card">
          <div class="location__copy">
            <h2 id="lokasi-title">Lokasi kita: Probolinggo</h2>
            <p>Probolinggo, Jawa Timur. Dari sinilah sirkel ini berkumpul.</p>
            <a class="btn btn--primary location__link" href="${MAPS_LINK}" target="_blank" rel="noopener noreferrer">
              <span class="btn__label">Buka di Google Maps</span>
              <span class="btn__icon">${icon('external')}</span>
            </a>
          </div>
          <div class="location__map shimmer" data-map>
            <iframe title="Peta Probolinggo, Jawa Timur" src="${MAP_SRC}" loading="lazy" referrerpolicy="no-referrer"></iframe>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>Cuma buat anak sirkel. Jangan disebar, ya.</p>
    </footer>
  `;

  const grid = element.querySelector('[data-grid]');
  const heroHost = element.querySelector('[data-hero]');
  const logoutButton = element.querySelector('[data-logout]');
  const mapHost = element.querySelector('[data-map]');

  let photos = [];
  let destroyed = false;

  const lightbox = createLightbox({ getPhotos: () => photos });
  element.append(lightbox.element);

  // ---------- peta: shimmer sampai iframe selesai dimuat ----------
  const mapFrame = mapHost.querySelector('iframe');
  mapFrame.addEventListener('load', () => {
    mapFrame.classList.add('is-loaded');
    mapHost.classList.remove('shimmer');
  });

  // ---------- skeleton ----------
  function renderSkeleton() {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = SKELETON_RATIOS.map(
      (ratio) => `
        <div class="card card--skeleton" aria-hidden="true">
          <span class="card__media shimmer" style="--ar: ${ratio}">
            <span class="skeleton-bars"><span></span><span></span></span>
          </span>
        </div>`,
    ).join('');
  }

  // ---------- hero ----------
  function renderHero(photo) {
    heroHost.innerHTML = `
      <button class="hero__photo shimmer" type="button" aria-label="Buka foto: ${esc(photo.title)}" aria-haspopup="dialog">
        <img src="${photo.full}" width="${photo.width}" height="${photo.height}" alt="" decoding="async" />
        <span class="hero__tag">${esc(photo.title)}</span>
      </button>
      ${stampHtml(photo.sticker, 'hero__stamp')}
    `;
    const button = heroHost.querySelector('.hero__photo');
    revealWhenLoaded(button.querySelector('img'), button);
    button.addEventListener('click', () => lightbox.open(0));
  }

  // ---------- kartu foto ----------
  function createCard(photo, index, order) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card card--ready';
    card.dataset.index = String(index);
    card.setAttribute('aria-haspopup', 'dialog');
    card.style.setProperty('--i', String(order));
    card.innerHTML = `
      <span class="card__media shimmer" style="--ar: ${photo.width} / ${photo.height}">
        <img class="card__img" src="${photo.thumb}" width="${photo.width}" height="${photo.height}" alt="" loading="lazy" decoding="async" />
      </span>
      <span class="card__caption">
        <span class="card__title">${esc(photo.title)}</span>
        <span class="card__desc"><span>${esc(photo.description)}</span></span>
      </span>
      ${stampHtml(photo.sticker, 'card__stamp')}
    `;
    const media = card.querySelector('.card__media');
    revealWhenLoaded(card.querySelector('img'), media);
    card.addEventListener('click', () => lightbox.open(index));
    return card;
  }

  function renderPhotos() {
    renderHero(photos[0]);
    const fragment = document.createDocumentFragment();
    photos.slice(1).forEach((photo, order) => fragment.append(createCard(photo, order + 1, order)));
    grid.replaceChildren(fragment);
    grid.setAttribute('aria-busy', 'false');
  }

  function renderError() {
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `
      <div class="state">
        <h3>Foto belum bisa dimuat</h3>
        <p>Cek koneksi internetmu, lalu coba lagi.</p>
        <button class="btn btn--primary" type="button" data-retry>
          <span class="btn__label">Muat ulang foto</span>
        </button>
      </div>`;
    grid.querySelector('[data-retry]').addEventListener('click', load);
  }

  async function load() {
    renderSkeleton();
    const startedAt = performance.now();
    let result = null;
    try {
      result = await getPhotos();
    } catch {
      result = null;
    }
    await sleep(Math.max(0, MIN_SKELETON_MS - (performance.now() - startedAt)));
    if (destroyed) return;

    if (result?.status === 401) return onExpired();
    if (!result?.ok || !Array.isArray(result.data?.photos) || result.data.photos.length === 0) return renderError();

    photos = result.data.photos;
    renderPhotos();
  }

  // ---------- keluar ----------
  logoutButton.addEventListener('click', async () => {
    logoutButton.classList.add('is-loading');
    logoutButton.disabled = true;
    try {
      await logout();
    } catch {
      // kalau gagal, tetap kembali ke halaman login; sesi akan kedaluwarsa sendiri
    }
    onLogout();
  });

  load();

  return {
    element,
    destroy() {
      destroyed = true;
      lightbox.destroy();
    },
  };
}
