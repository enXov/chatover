import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content/index.js'),
      name: 'ChatOver',
      formats: ['iife'],
      fileName: () => 'src/content/index.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Ensure dist directories exist
        const dirs = ['dist', 'dist/icons', 'dist/src/styles', 'dist/src/background'];
        dirs.forEach(dir => {
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
        });

        // Copy manifest
        copyFileSync('manifest.json', 'dist/manifest.json');

        // Copy icons
        ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
          if (existsSync(`icons/${icon}`)) {
            copyFileSync(`icons/${icon}`, `dist/icons/${icon}`);
          }
        });

        // Copy CSS
        if (existsSync('src/styles/overlay.css')) {
          copyFileSync('src/styles/overlay.css', 'dist/src/styles/overlay.css');
        }

        // Build background script inline (simple, no bundling needed)
        // Service workers in MV3 support ES modules, but we'll make it self-contained
        const bgSource = readFileSync('src/background/index.js', 'utf-8');
        // Replace import with inline polyfill usage
        const bgOutput = `
// ChatOver Background Service Worker
const browser = typeof chrome !== 'undefined' ? chrome : globalThis.browser;

// Initialize default settings on install
browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('ChatOver: Extension installed');
        browser.storage.sync.set({
            visible: false,
            position: { x: 20, y: 20 },
            size: { width: 350, height: 500 },
            settings: {
                fontSize: 14,
                usernameFontSize: 13,
                messageFontSize: 14,
                transparency: 0.85,
                textOutline: true,
                maxMessages: 50
            }
        });
    }
});

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender) => {
    console.log('ChatOver: Received message', message, 'from', sender);
    switch (message.type) {
        case 'GET_SETTINGS':
            return browser.storage.sync.get('settings');
        case 'SAVE_SETTINGS':
            return browser.storage.sync.set({ settings: message.settings });
        default:
            return Promise.resolve({ error: 'Unknown message type' });
    }
});

console.log('ChatOver: Background service worker started');
`;
        writeFileSync('dist/src/background/index.js', bgOutput);

        console.log('Extension files copied to dist/');
      },
    },
  ],
});
