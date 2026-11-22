import { defineConfig } from 'vite';
import { createApiHandler } from './server/api.js';

// Saat `npm run dev` / `npm run preview`, API login + foto dipasang langsung di server Vite,
// jadi cukup satu perintah. Untuk produksi, `npm start` menjalankan server/index.js.
function sirkelApi() {
  const handle = createApiHandler();
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      try {
        if (!(await handle(req, res))) next();
      } catch (error) {
        next(error);
      }
    });
  };
  return {
    name: 'sirkel-api',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig({
  plugins: [sirkelApi()],
});
