import { icon } from './icons.js';

export function createLightbox({ getPhotos }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Pratinjau foto');
  dialog.innerHTML = `
    <button class="icon-btn lightbox__close" type="button" aria-label="Tutup pratinjau">${icon('close', 'icon icon--lg')}</button>
    <div class="lightbox__stage">
      <button class="icon-btn lightbox__nav lightbox__nav--prev" type="button" aria-label="Foto sebelumnya">${icon('chevronLeft', 'icon icon--lg')}</button>
      <figure class="lightbox__figure">
        <div class="lightbox__media shimmer"><img alt="" /></div>
        <figcaption>
          <span class="lightbox__count"></span>
          <h3 class="lightbox__title"></h3>
          <p class="lightbox__desc"></p>
        </figcaption>
      </figure>
      <button class="icon-btn lightbox__nav lightbox__nav--next" type="button" aria-label="Foto berikutnya">${icon('chevronRight', 'icon icon--lg')}</button>
    </div>
  `;

  const stage = dialog.querySelector('.lightbox__stage');
  const figure = dialog.querySelector('.lightbox__figure');
  const media = dialog.querySelector('.lightbox__media');
  const image = media.querySelector('img');
  const countEl = dialog.querySelector('.lightbox__count');
  const titleEl = dialog.querySelector('.lightbox__title');
  const descEl = dialog.querySelector('.lightbox__desc');

  let index = 0;

  // Ukuran bingkai dihitung dari rasio foto, jadi skeleton-nya sudah berbentuk sama dengan fotonya.
  function fit() {
    const photo = getPhotos()[index];
    if (!photo) return;
    const narrow = window.innerWidth < 720;
    const maxWidth = Math.min(window.innerWidth - (narrow ? 32 : 236), 1000);
    const maxHeight = window.innerHeight - (narrow ? 260 : 220);
    const scale = Math.min(maxWidth / photo.width, maxHeight / photo.height, 1.3);
    const width = Math.max(160, Math.round(photo.width * scale));
    const height = Math.max(160, Math.round(photo.height * scale));
    media.style.width = `${width}px`;
    media.style.height = `${height}px`;
    figure.style.width = `${width}px`;
  }

  function show(next) {
    const photos = getPhotos();
    if (photos.length === 0) return;
    index = (next + photos.length) % photos.length;
    const photo = photos[index];

    countEl.textContent = `${index + 1} dari ${photos.length}`;
    titleEl.textContent = photo.title;
    descEl.textContent = photo.description;

    image.classList.remove('is-loaded');
    media.classList.add('shimmer');
    fit();

    image.alt = photo.description;
    image.onload = () => {
      image.classList.add('is-loaded');
      media.classList.remove('shimmer');
      // muat foto di sebelahnya diam-diam supaya geser terasa instan
      const neighbours = [photos[(index + 1) % photos.length], photos[(index - 1 + photos.length) % photos.length]];
      neighbours.forEach((item) => {
        new Image().src = item.full;
      });
    };
    image.onerror = () => media.classList.remove('shimmer');
    image.src = photo.full;
  }

  function open(startIndex) {
    document.body.classList.add('no-scroll');
    if (!dialog.open) dialog.showModal();
    show(startIndex);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', () => document.body.classList.remove('no-scroll'));

  dialog.querySelector('.lightbox__close').addEventListener('click', close);
  dialog.querySelector('.lightbox__nav--prev').addEventListener('click', () => show(index - 1));
  dialog.querySelector('.lightbox__nav--next').addEventListener('click', () => show(index + 1));

  // klik area gelap di luar foto untuk menutup
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target === stage) close();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    else if (event.key === 'ArrowRight') show(index + 1);
  });

  // geser kiri/kanan di layar sentuh
  let touchStartX = null;
  media.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  media.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) > 50) show(index + (delta < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('resize', fit);

  return {
    element: dialog,
    open,
    destroy() {
      window.removeEventListener('resize', fit);
      document.body.classList.remove('no-scroll');
      close();
      dialog.remove();
    },
  };
}
