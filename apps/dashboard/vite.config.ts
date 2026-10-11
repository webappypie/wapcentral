import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const rootDir = resolve(__dirname, '../../');
  // Load environment variables from monorepo root and app directory
  const rootEnv = loadEnv(mode, rootDir, '');
  const appEnv = loadEnv(mode, __dirname, '');
  const env = { ...rootEnv, ...appEnv, ...process.env };

  const isProduction = mode === 'production';
  const apiKey = env['VITE_FIREBASE_API_KEY'];

  // Read centralized release version strictly from root version.json
  const versionFile = resolve(rootDir, 'version.json');
  const appVersion = JSON.parse(readFileSync(versionFile, 'utf-8')).version;

  // Determine Git Commit SHA
  let commitSha = '';
  try {
    commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    commitSha = process.env['GITHUB_SHA'] ? process.env['GITHUB_SHA'].slice(0, 7) : '';
  }

  const buildTime = new Date().toISOString();
  const appEnvVal = env['VITE_APP_ENV'] || (isProduction ? 'production' : 'development');

  // Enforce valid API key during production build
  if (isProduction) {
    if (!apiKey || apiKey.includes('Placeholder') || apiKey.includes('Demo')) {
      throw new Error(
        'Production build failed: VITE_FIREBASE_API_KEY is required and must not be a mock or placeholder key.\n' +
          'Ensure a valid Firebase API key is defined in apps/dashboard/.env.production, root .env.production, or environment variables.',
      );
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_ENV': JSON.stringify(appEnvVal),
      'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(commitSha),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(apiKey || ''),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        env['VITE_FIREBASE_AUTH_DOMAIN'] ||
          (isProduction ? 'wapcentral-prod.firebaseapp.com' : 'wapcentral-dev.firebaseapp.com'),
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        env['VITE_FIREBASE_PROJECT_ID'] || (isProduction ? 'wapcentral-prod' : 'wapcentral-dev'),
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        env['VITE_FIREBASE_STORAGE_BUCKET'] ||
          (isProduction ? 'wapcentral-prod.firebasestorage.app' : 'wapcentral-dev.firebasestorage.app'),
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        env['VITE_FIREBASE_MESSAGING_SENDER_ID'] || (isProduction ? '174781611765' : '1234567890'),
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        env['VITE_FIREBASE_APP_ID'] ||
          (isProduction ? '1:174781611765:web:fd2507096f735e053e4fbc' : '1:1234567890:web:abcdef'),
      ),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(
        env['VITE_FIREBASE_MEASUREMENT_ID'] || 'G-GSHK0CCVZ1',
      ),
      'import.meta.env.VITE_USE_FIREBASE_EMULATOR': JSON.stringify(
        env['VITE_USE_FIREBASE_EMULATOR'] || (isProduction ? 'false' : 'true'),
      ),
    },
    server: {
      port: 3000,
      proxy: {
        '/api/admin': {
          target: env['ADMIN_API_URL'] ?? 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/admin/, ''),
        },
        '/api/ai': {
          target: env['AI_GATEWAY_URL'] ?? 'http://localhost:3002',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ai/, ''),
        },
        '/api/promotion': {
          target: env['PROMOTION_API_URL'] ?? 'http://localhost:3003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/promotion/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});

