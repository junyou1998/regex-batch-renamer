import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    electron({
      main: {
        // Use rollupOptions to output pure CJS
        vite: {
          build: {
            rollupOptions: {
              input: path.join(__dirname, 'electron/main.ts'),
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'main.cjs',
                esModule: false,
                exports: 'named',
              },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        // Use rollupOptions to output pure CJS for preload
        vite: {
          build: {
            rollupOptions: {
              input: path.join(__dirname, 'electron/preload.ts'),
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
                esModule: false,
                exports: 'named',
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
});
