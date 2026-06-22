/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';

// Serve docs/specpad/ at /demo/ in dev and preview, with a generated
// manifest.json, so `npm run dev` + /?demo exercises the real demo flow.
// Production serves the same files from S3 (uploaded by infra/deploy.sh).
function demoContent(): Plugin {
  const root = path.resolve(__dirname, 'docs/specpad');
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = (req.url || '/').split('?')[0];
    try {
      if (url === '/manifest.json') {
        const entries = await fs.readdir(root);
        // Every content document (project index + register types: srs/vtp/prd and any later pillar),
        // excluding the infrastructure sidecars — matches the deploy manifest. Registry-extensible.
        const documents = entries.filter((f) => /\.[a-z]+\.json$/.test(f) && !/\.(job|jobs|releases)\.json$/.test(f) && f !== 'manifest.json');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ documents }));
        return;
      }
      const file = path.normalize(path.join(root, url));
      if (!file.startsWith(root + path.sep) || !file.endsWith('.json')) { next(); return; }
      const data = await fs.readFile(file);
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  };
  return {
    name: 'specpad-demo-content',
    configureServer(server) { server.middlewares.use('/demo', handler); },
    configurePreview(server) { server.middlewares.use('/demo', handler); },
  };
}

// base './' keeps asset URLs relative so the same build works when served
// from specpad.com/v01/ (the versioned deploy path).
export default defineConfig({
  base: './',
  plugins: [react(), demoContent()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'skill/**/*.test.ts', 'site/**/*.test.ts'],
  },
});
