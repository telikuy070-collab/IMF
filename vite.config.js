import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import {
  collectEntryAssets,
  createReleaseManifest,
  describeScheduleSnapshot,
  injectEntryAssets,
  readPackageVersion,
  readScheduleSnapshot,
  resolveSourceSha,
  stampServiceWorker,
  validateScheduleSnapshot,
} from './scripts/build-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Single source of truth for the application version: package.json.
const APP_VERSION = readPackageVersion(__dirname);

// Build timestamp for SW cache busting and the release manifest.
const BUILD_TIMESTAMP = Date.now();

/** Data files that must be packaged into every production build. */
const SCHEDULE_FILES = ['6 СЖ_МК_26-27_1пг_7_нед_по новому сем ММФ КУМУ (1).xls', 'version.json'];

/**
 * Serves the canonical `data/` snapshot in dev and copies it into `dist/`
 * for production. The production path is fail-closed: an absent or
 * inconsistent snapshot aborts the build instead of shipping a broken PWA.
 */
function scheduleDataPlugin({ isProd }) {
  return {
    name: 'IMF-schedule-data',
    // Dev only: /data/* is served from the tracked canonical sources so the
    // public/ directory does not need a second copy of the workbook.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        const match = /^\/data\/([^/]+)$/.exec(url);
        if (!match) return next();
        const fileName = decodeURIComponent(match[1]);
        if (!SCHEDULE_FILES.includes(fileName)) return next();
        const source = resolve(__dirname, 'data', fileName);
        if (!existsSync(source)) {
          res.statusCode = 404;
          res.end('schedule snapshot is not available');
          return;
        }
        res.setHeader(
          'Content-Type',
          fileName.endsWith('.json') ? 'application/json' : 'application/vnd.ms-excel'
        );
        res.end(readFileSync(source));
      });
    },
    buildStart() {
      if (!isProd) return;
      const read = readScheduleSnapshot(__dirname);
      const { ok, errors } = validateScheduleSnapshot(read);
      if (!ok) {
        this.error(
          `Refusing to build: the tracked schedule snapshot is missing or inconsistent.\n  - ${errors.join(
            '\n  - '
          )}`
        );
      }
      console.log(`[vite] ${describeScheduleSnapshot(read)}`);
    },
    closeBundle() {
      const read = readScheduleSnapshot(__dirname);
      const { ok, errors } = validateScheduleSnapshot(read);
      if (!ok) {
        throw new Error(
          `Build output rejected: schedule snapshot is missing or inconsistent.\n  - ${errors.join(
            '\n  - '
          )}`
        );
      }
      const outDir = resolve(__dirname, 'dist', 'data');
      mkdirSync(outDir, { recursive: true });
      for (const file of SCHEDULE_FILES) {
        copyFileSync(resolve(__dirname, 'data', file), resolve(outDir, file));
      }
      console.log(`[vite] Packaged ${SCHEDULE_FILES[0]} and data/version.json into dist/data`);
    },
  };
}

/** Stamps the Service Worker cache version and writes the release manifest. */
function releaseArtifactPlugin({ isProd }) {
  return {
    name: 'IMF-release-artifacts',
    closeBundle() {
      // Copy 404.html for SPA fallback
      const src404 = resolve(__dirname, 'public/404.html');
      const dest404 = resolve(__dirname, 'dist/404.html');
      if (existsSync(src404)) {
        copyFileSync(src404, dest404);
        console.log('[vite] Copied 404.html for SPA fallback');
      }

      const swPath = resolve(__dirname, 'dist/sw.js');
      if (existsSync(swPath)) {
        const manifestPath = resolve(__dirname, 'dist/.vite/manifest.json');
        if (!existsSync(manifestPath)) {
          const fallback = resolve(__dirname, 'dist/manifest.json');
          if (existsSync(fallback)) {
            mkdirSync(resolve(__dirname, 'dist/.vite'), { recursive: true });
            copyFileSync(fallback, manifestPath);
          } else {
            throw new Error('Build output rejected: manifest.json is missing.');
          }
        }
        const entryAssets = collectEntryAssets(JSON.parse(readFileSync(manifestPath, 'utf-8')));
        for (const asset of entryAssets) {
          if (!existsSync(resolve(__dirname, 'dist', asset))) {
            throw new Error(`Build output rejected: entry asset ${asset} is not in dist/.`);
          }
        }

        let swSource = readFileSync(swPath, 'utf-8');
        swSource = stampServiceWorker(swSource, BUILD_TIMESTAMP);
        if (isProd) {
          swSource = injectEntryAssets(swSource, entryAssets);
        }
        writeFileSync(swPath, swSource);
        console.log(
          `[vite] Stamped SW cache version with build ${BUILD_TIMESTAMP} (${entryAssets.length} entry assets)`
        );
      } else if (isProd) {
        throw new Error('Build output rejected: dist/sw.js is missing (public/sw.js not copied).');
      }

      if (!isProd) return;

      const read = readScheduleSnapshot(__dirname);
      const manifest = createReleaseManifest({
        appVersion: APP_VERSION,
        buildTimestamp: BUILD_TIMESTAMP,
        sourceSha: resolveSourceSha(__dirname),
        schedule: {
          version: read.snapshot.version,
          updated: read.snapshot.updated,
          size: read.fileSize,
          sha256: read.fileSha256,
        },
      });
      writeFileSync(
        resolve(__dirname, 'dist/release-manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf-8'
      );
      console.log(
        `[vite] Wrote release manifest (version=${manifest.appVersion}, sourceSha=${
          manifest.sourceSha ?? 'unknown'
        })`
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    base: isProd ? '/IMF/' : '/',
    root: '.',
    publicDir: 'public',
    server: {
      port: 8080,
      open: true,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProd,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: undefined,
        },
      },
      manifest: true,
    },
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
      __BUILD_DATE__: JSON.stringify(new Date(BUILD_TIMESTAMP).toISOString()),
    },
    resolve: {
      alias: {
        '@core': resolve(__dirname, 'src/core'),
        '@infrastructure': resolve(__dirname, 'src/infrastructure'),
        '@infrastructure/github': resolve(__dirname, 'src/infrastructure/github'),
        '@presentation': resolve(__dirname, 'src/presentation'),
        '@presentation/components': resolve(__dirname, 'src/presentation/components'),
        '@presentation/hooks': resolve(__dirname, 'src/presentation/hooks'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@ui': resolve(__dirname, 'src/ui'),
        '@ui/atoms': resolve(__dirname, 'src/ui/atoms'),
        '@ui/molecules': resolve(__dirname, 'src/ui/molecules'),
        '@ui/organisms': resolve(__dirname, 'src/ui/organisms'),
        '@ui/layout': resolve(__dirname, 'src/ui/layout'),
        '@ui/theme': resolve(__dirname, 'src/ui/theme'),
        '@ui/pages': resolve(__dirname, 'src/ui/pages'),
      },
    },
    plugins: [preact(), scheduleDataPlugin({ isProd }), releaseArtifactPlugin({ isProd })],
  };
});
