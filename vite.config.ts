import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverApiKey = env.SOCLAAS_API_KEY || process.env.SOCLAAS_API_KEY;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared'),
      },
    },
    server: {
      proxy: {
        '/api/soclaas': {
          target: 'https://soclaas-api.comp.nus.edu.sg/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/soclaas/, ''),
          headers: serverApiKey
            ? {
                Authorization: `Bearer ${serverApiKey}`,
              }
            : undefined,
        },
      },
    },
  };
});
