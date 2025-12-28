import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.js'),
        background: resolve(__dirname, 'src/background/index.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') {
            return 'src/content/index.js';
          }
          if (chunkInfo.name === 'background') {
            return 'src/background/index.js';
          }
          return '[name].js';
        },
        format: 'es',
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
        const dirs = ['dist', 'dist/icons', 'dist/src/styles'];
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

        console.log('Extension files copied to dist/');
      },
    },
  ],
});
