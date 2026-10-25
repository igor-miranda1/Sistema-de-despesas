import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.API_PORT || '3001';

  return {
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:5173 ws://127.0.0.1:5173; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        'Referrer-Policy': 'no-referrer',
      },
    },
  };
});
