import { getSession } from './api.js';
import { createLoginView } from './login.js';
import { createGalleryView } from './gallery.js';

const app = document.getElementById('app');
let current = null;

function mount(view) {
  current?.destroy?.();
  current = view;
  app.replaceChildren(view.element);
  window.scrollTo(0, 0);
}

function showLogin(notice = '') {
  mount(createLoginView({ notice, onSuccess: showGallery }));
}

function showGallery() {
  mount(
    createGalleryView({
      onLogout: () => showLogin('Kamu sudah keluar. Sampai ketemu lagi!'),
      onExpired: () => showLogin('Sesi habis. Masuk lagi, ya.'),
    }),
  );
}

async function start() {
  let authenticated = false;
  try {
    authenticated = await getSession();
  } catch {
    // server tidak terjangkau: tampilkan login, error muncul saat submit
  }
  if (authenticated) showGallery();
  else showLogin();
}

start();
