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
