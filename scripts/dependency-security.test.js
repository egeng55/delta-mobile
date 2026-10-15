const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const semver = require('semver');

const root = join(__dirname, '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

describe('mobile dependency security patches', () => {
  test.each([
    ['shell-quote', '>=1.11.0 <2'],
    ['brace-expansion', '>=1.1.21 <2 || >=2.1.7 <3 || >=5.0.12 <6'],
    ['compression', '>=1.8.2 <2'],
    ['source-map-js', '>=1.2.2 <2'],
    ['undici', '>=6.28.1 <7'],
    ['postcss', '>=8.5.23 <9'],
    ['js-yaml', '>=4.3.2 <5'],
  ])('%s stays on its patched compatible release line', (name, range) => {
    const entries = Object.entries(lock.packages).filter(([path]) =>
      path.endsWith(`node_modules/${name}`),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [, dependency] of entries) {
      expect(semver.satisfies(dependency.version, range)).toBe(true);
      expect(dependency.integrity).toMatch(/^sha512-/);
    }
  });

  test('production UUID consumers resolve a patched CommonJS implementation', () => {
    const entries = Object.entries(lock.packages).filter(([path, dependency]) =>
      path.endsWith('node_modules/uuid') && !dependency.dev,
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [, dependency] of entries) {
      expect(semver.satisfies(dependency.version, '>=11.1.1 <12')).toBe(true);
      expect(dependency.integrity).toMatch(/^sha512-/);
    }
  });

  test.each(['sprintf-js', 'image-size'])('%s is removed, not suppressed', name => {
    expect(Object.keys(lock.packages).some(path => path.endsWith(`node_modules/${name}`))).toBe(false);
  });

  test('Metro packages stay aligned on the maintained security patch', () => {
    const entries = Object.entries(lock.packages).filter(([path]) =>
      /node_modules\/metro(?:-[a-z-]+)?$/.test(path),
    );
    expect(entries.length).toBeGreaterThanOrEqual(14);
    for (const [, dependency] of entries) expect(dependency.version).toBe('0.83.8');
  });

  test('Metro reads PNG, JPEG and SVG dimensions through its maintained parsers', () => {
    const result = spawnSync(process.execPath, ['-e', `
      const fs = require('node:fs');
      const { getAssetSize } = require('metro/private/Assets');
      for (const [type, path] of [['png', 'assets/icon.png'], ['jpg', 'assets/backgrounds/aerial-ice.jpg']]) {
        const size = getAssetSize(type, fs.readFileSync(path), path);
        if (!(size.width > 0 && size.height > 0)) throw new Error('Invalid dimensions');
      }
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="34"></svg>');
      const size = getAssetSize('svg', svg, 'fixture.svg');
      if (size.width !== 12 || size.height !== 34) throw new Error('SVG adapter mismatch');
      let rejected = 0;
      for (const content of [Buffer.alloc(0), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])]) {
        try { getAssetSize('jpg', content, 'invalid.jpg'); } catch { rejected++; }
      }
      if (rejected !== 2) throw new Error('Invalid images accepted');
    `], { cwd: root, encoding: 'utf8', timeout: 10000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  test('Xcode tooling parses the native project and generates unique compatible IDs without writes', () => {
    const result = spawnSync(process.execPath, ['-e', `
      const xcode = require('xcode');
      const project = xcode.project('ios/Delta.xcodeproj/project.pbxproj');
      project.parseSync();
      const before = project.writeSync();
      const ids = new Set(Array.from({ length: 100 }, () => project.generateUuid()));
      if (ids.size !== 100 || [...ids].some(id => !/^[A-F0-9]{24}$/.test(id))) {
        throw new Error('Invalid Xcode IDs');
      }
      if (project.writeSync() !== before) throw new Error('Project mutated');
    `], { cwd: root, encoding: 'utf8', timeout: 10000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  test('Metro builds asset metadata from file paths, not just in-memory buffers', () => {
    const result = spawnSync(process.execPath, ['-e', `
      const path = require('node:path');
      const fs = require('node:fs');
      const { getAssetData, getAssetSize } = require('metro/private/Assets');
      (async () => {
        for (const [type, relative] of [['png', 'assets/icon.png'], ['jpg', 'assets/backgrounds/aerial-ice.jpg']]) {
          const file = path.resolve(relative);
          const expected = getAssetSize(type, fs.readFileSync(file), file);
          const data = await getAssetData(file, relative, [], 'ios', '/assets');
          if (data.width !== expected.width || data.height !== expected.height || !data.hash || !data.__packager_asset) {
            throw new Error('Asset metadata mismatch');
          }
        }
      })().catch(() => { process.exitCode = 1; });
    `], { cwd: root, encoding: 'utf8', timeout: 10000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  test('Istanbul loads YAML configuration, including inheritance, with the patched parser', () => {
    const dir = mkdtempSync(join(tmpdir(), 'delta-nyc-'));
    try {
      writeFileSync(join(dir, '.nycrc.yaml'), 'extends: ./base.yaml\nall: true\ninclude:\n  - src/**/*.ts\n');
      writeFileSync(join(dir, 'base.yaml'), 'reporter:\n  - text\nexclude:\n  - fixtures/**\n');
      const result = spawnSync(process.execPath, ['-e', `
        require('@istanbuljs/load-nyc-config').loadNycConfig({ cwd: process.argv[1] })
          .then(config => process.stdout.write(JSON.stringify(config)))
          .catch(() => { process.exitCode = 1; });
      `, dir], { cwd: root, encoding: 'utf8', timeout: 10000 });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        all: true, include: ['src/**/*.ts'], reporter: ['text'], exclude: ['fixtures/**'],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Expo Metro still transforms CSS with the patched PostCSS dependency', () => {
    const dir = mkdtempSync(join(tmpdir(), 'delta-postcss-'));
    try {
      writeFileSync(join(dir, 'postcss.config.js'), `module.exports = {
        plugins: [{ postcssPlugin: 'delta-fixture', Declaration(decl) {
          if (decl.prop === 'color') decl.value = 'blue';
        } }]
      };`);
      const transformer = require.resolve('@expo/metro-config/build/transform-worker/postcss');
      const result = spawnSync(process.execPath, ['-e', `
        const { transformPostCssModule } = require(process.argv[1]);
        const root = process.argv[2];
        transformPostCssModule(root, { src: '.example { color: red }', filename: root + '/fixture.css' })
          .then(result => process.stdout.write(JSON.stringify(result)))
          .catch(() => { process.exitCode = 1; });
      `, transformer, dir], { cwd: root, encoding: 'utf8', timeout: 10000 });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ src: '.example { color: blue }', hasPostcss: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('release audit remains fail closed', () => {
  test.each([
    ['clean audit', { critical: 0, high: 0, moderate: 0, low: 0, total: 0 }, {}, true],
    ['critical finding', { critical: 1, high: 0, moderate: 0, low: 0, total: 1 }, {}, false],
    ['high regression', { critical: 0, high: 10, moderate: 0, low: 0, total: 10 }, {}, false],
    ['new runtime chain', { critical: 0, high: 1, moderate: 0, low: 0, total: 1 }, {
      'react-native': { name: 'react-native', isDirect: true },
    }, false],
  ])('%s', (_label, counts, vulnerabilities, allowed) => {
    const dir = mkdtempSync(join(tmpdir(), 'delta-audit-'));
    try {
      const path = join(dir, 'audit.json');
      writeFileSync(path, JSON.stringify({ metadata: { vulnerabilities: counts }, vulnerabilities }));
      const result = spawnSync(process.execPath, [join(__dirname, 'ci-production-audit-guard.mjs'), path], {
        encoding: 'utf8', timeout: 10000,
      });
      expect(result.status === 0).toBe(allowed);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
