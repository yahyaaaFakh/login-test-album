import { login } from './api.js';
import { icon } from './icons.js';
import { sleep } from './utils.js';

export function createLoginView({ notice = '', onSuccess }) {
  const element = document.createElement('main');
  element.className = 'login';
  element.innerHTML = `
    <section class="login__art">
      <div class="login__sun" aria-hidden="true"></div>
      <img class="sticker sticker--cihuy" src="/stickers/cihuy.webp" width="360" height="360" alt="" />
      <img class="sticker sticker--ketar" src="/stickers/ketar-ketir.webp" width="360" height="348" alt="" />
      <div class="login__brand">
        <h1>Sirkel<br />Suki</h1>
        <p>Foto-foto kita, disimpan di satu tempat.</p>
      </div>
    </section>

    <section class="login__panel">
      <form class="login-card" novalidate>
        <div class="login-card__head">
          <h2>Masuk dulu, ya</h2>
          <p>Album ini khusus anak sirkel. Isi username dan password untuk lanjut.</p>
        </div>

        <p class="notice" data-notice></p>

        <div class="field">
          <label for="username">Username</label>
          <input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <div class="field__control">
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            <button class="field__toggle" type="button" aria-label="Tampilkan password" aria-pressed="false">
              ${icon('eye')}
            </button>
          </div>
        </div>

        <p class="form-error" role="alert" data-error></p>

        <button class="btn btn--primary btn--block" type="submit">
          <span class="btn__label">Masuk</span>
          <span class="btn__icon">${icon('arrowRight')}</span>
          <span class="btn__spinner" aria-hidden="true"></span>
        </button>

        <p class="login-card__hint">Lupa password? Tanya anggota sirkel yang lain.</p>
      </form>
    </section>
  `;

  const card = element.querySelector('.login-card');
  const usernameInput = element.querySelector('#username');
  const passwordInput = element.querySelector('#password');
  const toggle = element.querySelector('.field__toggle');
  const errorEl = element.querySelector('[data-error]');
  const submit = element.querySelector('button[type="submit"]');
  const label = submit.querySelector('.btn__label');

  element.querySelector('[data-notice]').textContent = notice;

  let busy = false;

  function showError(message, { shake = true } = {}) {
    errorEl.textContent = message;
    if (shake) {
      card.classList.remove('shake');
      void card.offsetWidth; // restart animasi
      card.classList.add('shake');
    }
  }

  function clearError() {
    errorEl.textContent = '';
    usernameInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');
  }

  function setBusy(value) {
    busy = value;
    submit.classList.toggle('is-loading', value);
    submit.toggleAttribute('aria-busy', value);
    label.textContent = value ? 'Memeriksa' : 'Masuk';
  }

  card.addEventListener('animationend', () => card.classList.remove('shake'));
  usernameInput.addEventListener('input', clearError);
  passwordInput.addEventListener('input', clearError);

  toggle.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    toggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
    passwordInput.focus();
  });

  card.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    clearError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      const empty = !username ? usernameInput : passwordInput;
      empty.setAttribute('aria-invalid', 'true');
      showError(!username ? 'Isi username dulu.' : 'Isi password dulu.');
      empty.focus();
      return;
    }

    setBusy(true);
    try {
      const { ok, status, data } = await login(username, password);

      if (ok) {
        submit.classList.remove('is-loading');
        submit.classList.add('is-success');
        label.textContent = 'Berhasil';
        await sleep(700);
        element.classList.add('is-leaving');
        await sleep(450);
        onSuccess();
        return;
      }

      if (status === 429) {
        showError(`Terlalu banyak percobaan. Coba lagi dalam ${data?.retryAfter ?? 60} detik.`);
      } else {
        usernameInput.setAttribute('aria-invalid', 'true');
        passwordInput.setAttribute('aria-invalid', 'true');
        showError('Username atau password salah. Coba lagi.');
        passwordInput.select();
      }
    } catch {
      showError('Tidak bisa terhubung ke server. Cek koneksi, lalu coba lagi.');
    }
    setBusy(false);
  });

  // Fokus ke username setelah animasi pembuka selesai, supaya keyboard HP tidak langsung menutupi layar.
  if (window.matchMedia('(pointer: fine)').matches) {
    setTimeout(() => usernameInput.focus({ preventScroll: true }), 300);
  }

  return { element };
}
