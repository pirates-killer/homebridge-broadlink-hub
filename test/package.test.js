'use strict';

// The published package must work on its own: tests and dev files are not
// shipped. (0.1.0 pre-release: helpers/serviceManagerTypes.js required a test
// helper and the plugin failed to load on a real install.)

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
// Relative imports into files that are deliberately not shipped (lazy, test-only).
const ALLOWED_MISSING = new Set(['helpers/serviceManagerTypes.js -> test/helpers/fakeServiceManager']);

describe('published package', function () {
  this.timeout(60000);
  let files;
  let dir;

  before(() => {
    const out = execFileSync('npm', ['pack', '--json', '--pack-destination', os.tmpdir()], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const info = JSON.parse(out)[0];
    files = new Set(info.files.map((f) => f.path));
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brm-pkg-'));
    execFileSync('tar', ['-xzf', path.join(os.tmpdir(), info.filename), '-C', dir, '--strip-components=1']);
    fs.rmSync(path.join(os.tmpdir(), info.filename));
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'));
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('ships the plugin, settings UI and licence files, but no tests', () => {
    for (const f of ['index.js', 'platform.js', 'config.schema.json', 'homebridge-ui/server.js', 'homebridge-ui/public/index.html', 'homebridge-ui/public/app.js', 'LICENSE', 'NOTICE']) {
      assert.ok(files.has(f), `${f} missing from package`);
    }
    assert.ok(![...files].some((f) => f.startsWith('test/')), 'tests must not be shipped');
  });

  it('every relative import points at a shipped file', () => {
    const missing = [];
    for (const f of files) {
      if (!/\.(m?js)$/.test(f)) {continue;}
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const re = /(?:require\(\s*|from\s+|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
      for (const m of src.matchAll(re)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
        const ok = [target, `${target}.js`, `${target}.json`, `${target}/index.js`].some((t) => files.has(t));
        if (!ok && !ALLOWED_MISSING.has(`${f} -> ${target}`)) {missing.push(`${f} -> ${m[1]}`);}
      }
    }
    assert.deepStrictEqual(missing, []);
  });

  it('loads in Homebridge from the unpacked package alone', () => {
    const script = `
      const hap = require('@homebridge/hap-nodejs');
      const registered = [];
      require('./index.js')({ hap, registerPlatform: (...a) => registered.push(a[0]), on() {}, user: { storagePath: () => require('os').tmpdir() } });
      for (const f of require('fs').readdirSync('./accessories')) require('./accessories/' + f);
      process.stdout.write(JSON.stringify(registered));`;
    const out = execFileSync(process.execPath, ['-e', script], { cwd: dir, encoding: 'utf8' });
    assert.deepStrictEqual(JSON.parse(out), ['BroadlinkRM']);
  });
});
