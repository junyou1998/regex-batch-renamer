import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import tauriConfig from './src-tauri/tauri.conf.json';

/**
 * Demo mode (`pnpm demo`) runs in a normal browser. Inject the same CSP the
 * Tauri webview uses so CSP regressions (eval, inline scripts, workers) show up
 * here too. Demo-only extra: the marketplace is fetched directly.
 */
function demoCsp(): Plugin {
  const csp: Record<string, string> = { ...tauriConfig.app.security.devCsp };
  csp['connect-src'] += ' ws://localhost:1421 http://localhost:1421 https://raw.githubusercontent.com';
  const value = Object.entries(csp)
    .filter(([directive]) => directive !== 'frame-ancestors')
    .map(([directive, sources]) => `${directive} ${sources}`)
    .join('; ');
  return {
    name: 'demo-csp',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${value}">`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    ...(mode === 'demo' ? [demoCsp()] : []),
  ],
  server: {
    port: mode === 'demo' ? 1421 : 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_'],
  define: {
    // Compile i18n messages to an AST instead of `new Function`, so the app
    // runs under a CSP without 'unsafe-eval'.
    __INTLIFY_JIT_COMPILATION__: true,
    __INTLIFY_DROP_MESSAGE_COMPILER__: false,
  },
}));
