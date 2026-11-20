'use strict';

// End-to-end smoke test: boots the real Homebridge (devDependency) with this
// plugin and a given config, against the UDP RM simulator, then drives
// accessories over HAP (insecure mode) and checks which codes the RM receives.
//
//   node test/e2e/hb2-smoke.js <storage-dir-with-config.json> [--plugin-dir DIR]
//
// The config's first host must point at 127.0.0.1:<port>; the simulator binds
// that port with the host's MAC. Bind the bridge to "lo" so nothing is
// advertised on the LAN.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const RMSimulator = require('../sim/rmSimulator');

const storage = path.resolve(process.argv[2]);
const pluginDirArg = process.argv.indexOf('--plugin-dir');
const pluginDir = path.resolve(pluginDirArg > 0 ? process.argv[pluginDirArg + 1] : path.join(__dirname, '../..'));
const hbBin = path.join(__dirname, '../../node_modules/homebridge/bin/homebridge.js');

const config = JSON.parse(fs.readFileSync(path.join(storage, 'config.json'), 'utf8'));
const platform = config.platforms.find((p) => p.platform === 'BroadlinkRM');
const host = platform.hosts[0];
const pin = config.bridge.pin;
const hapPort = config.bridge.port;

const hap = (method, url, body) => new Promise((resolve, reject) => {
  const data = body ? JSON.stringify(body) : undefined;
  const req = http.request({ host: '127.0.0.1', port: hapPort, method, path: url,
    headers: { Authorization: pin, 'Content-Type': 'application/hap+json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
    let s = '';
    res.on('data', (c) => (s += c));
    res.on('end', () => resolve({ status: res.statusCode, body: s ? JSON.parse(s) : null }));
  });
  req.on('error', reject);
  if (data) {req.write(data);}
  req.end();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const sim = new RMSimulator({ port: host.port, mac: host.mac.replace(/:/g, ''), devtype: 0x520b });
  sim.lenient = process.argv.includes('--lenient'); // old clients send a constant RM4 length field
  await sim.start();

  const plugins = fs.mkdtempSync(path.join(storage, 'plugins-'));
  fs.symlinkSync(pluginDir, path.join(plugins, require(path.join(pluginDir, 'package.json')).name));

  const logLines = [];
  const hb = spawn(process.execPath, [hbBin, '-U', storage, '-P', plugins, '--strict-plugin-resolution', '-I', '-C', '-T'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (d) => String(d).split('\n').filter(Boolean).forEach((l) => logLines.push(l));
  hb.stdout.on('data', onData);
  hb.stderr.on('data', onData);

  const result = { ok: true, checks: [] };
  const check = (name, pass, detail) => {result.checks.push({ name, pass, detail }); if (!pass) {result.ok = false;}};

  try {
    for (let i = 0; i < 60 && !logLines.some((l) => /is running on port/.test(l)); i++) {await sleep(500);}
    check('homebridge started', logLines.some((l) => /is running on port/.test(l)));
    for (let i = 0; i < 20 && !logLines.some((l) => /Discovered .* at 127\.0\.0\.1/.test(l)); i++) {await sleep(250);}
    check('device discovered + authenticated via hosts', logLines.some((l) => /Discovered RM4 Pro \(0x520b\) at 127\.0\.0\.1/.test(l)));

    const { body } = await hap('GET', '/accessories');
    const accessories = body.accessories;
    const nameOf = (acc) => {
      for (const s of acc.services) {for (const c of s.characteristics) {if (c.type === '23') {return c.value;}}}
      return '';
    };
    const find = (name) => accessories.find((a) => nameOf(a) === name);
    const charOf = (acc, type) => {
      for (const s of acc.services) {for (const c of s.characteristics) {if (c.type === type) {return c;}}}
      return null;
    };
    result.bridgedAccessories = accessories.map(nameOf);

    const put = async (acc, type, value) => {
      const c = charOf(acc, type);
      const r = await hap('PUT', '/characteristics', { characteristics: [{ aid: acc.aid, iid: c.iid, value }] });
      return r.status;
    };
    const codesAfter = async (fn, wait = 1200) => {
      const before = sim.sent.length;
      await fn();
      await sleep(wait);
      return sim.sent.slice(before);
    };
    const trim = (c) => (sim.lenient ? c.replace(/(00)+$/, '') : c);
    const expectCodes = (name, got, expected) => check(name, JSON.stringify(got.map(trim)) === JSON.stringify(expected.map(trim)), { got: got.map((c) => c.slice(0, 16)), expected: expected.map((c) => c.slice(0, 16)) });

    const accCfg = (name) => platform.accessories.find((a) => a.name === name);

    // Switch: simple on/off
    const sw = platform.accessories.find((a) => a.type === 'switch' && a.data && a.data.on && a.data.off && !a.enableAutoOff);
    if (sw) {
      const acc = find(sw.name);
      const on = await codesAfter(() => put(acc, '25', true));
      expectCodes(`switch "${sw.name}" on`, on, [sw.data.on]);
      const off = await codesAfter(() => put(acc, '25', false));
      expectCodes(`switch "${sw.name}" off`, off, [sw.data.off]);
    }

    // Auto-off switch: on code then automatically back to off state
    const auto = platform.accessories.find((a) => a.type === 'switch' && a.enableAutoOff && typeof a.data === 'string');
    if (auto) {
      const acc = find(auto.name);
      const got = await codesAfter(() => put(acc, '25', true), 300);
      expectCodes(`auto-off switch "${auto.name}" sends its code`, got, [auto.data]);
      await sleep((auto.onDuration || 1) * 1000 + 800);
      const r = await hap('GET', `/characteristics?id=${acc.aid}.${charOf(acc, '25').iid}`);
      check(`auto-off switch "${auto.name}" turned itself off`, r.body.characteristics[0].value === false || r.body.characteristics[0].value === 0, r.body.characteristics[0]);
    }

    // Fan: Active + speed
    const fanCfg = platform.accessories.find((a) => a.type === 'fan');
    if (fanCfg) {
      const acc = find(fanCfg.name);
      const on = await codesAfter(() => put(acc, 'B0', 1));
      check(`fan "${fanCfg.name}" on sends its on code`, on.includes(fanCfg.data.on), on.map((c) => c.slice(0, 16)));
      const speedChar = charOf(acc, '29');
      const now = (await hap('GET', `/characteristics?id=${acc.aid}.${speedChar.iid}`)).body.characteristics[0].value;
      const target = now === 50 ? 60 : 50; // a value that differs from the persisted one
      const spd = await codesAfter(() => put(acc, '29', target));
      check(`fan "${fanCfg.name}" speed ${target} sends fanSpeed${target}`, spd.includes(fanCfg.data[`fanSpeed${target}`]), spd.map((c) => c.slice(0, 16)));
      const off = await codesAfter(() => put(acc, 'B0', 0));
      check(`fan "${fanCfg.name}" off sends its off code`, off.includes(fanCfg.data.off), off.map((c) => c.slice(0, 16)));
    }

    // Air conditioner: read current temperature (RM4 Pro has no sensor) must not hang
    const acCfg = platform.accessories.find((a) => a.type === 'air-conditioner');
    if (acCfg) {
      const acc = find(acCfg.name);
      const t0 = Date.now();
      const cur = charOf(acc, '11');
      const r = await hap('GET', `/characteristics?id=${acc.aid}.${cur.iid}`);
      check(`AC "${acCfg.name}" CurrentTemperature read answers quickly without a sensor`, r.status === 200 && Date.now() - t0 < 3000, { ms: Date.now() - t0, status: r.status, body: r.body });
      const cool = await codesAfter(() => put(acc, '33', 2), 2500); // TargetHeatingCoolingState COOL
      const acCodes = Object.values(acCfg.data).map((v) => (typeof v === 'string' ? v : v && v.data));
      const coolKey = `cool${acCfg.defaultCoolTemperature}`;
      const expected = acCfg.data[coolKey] ? (acCfg.data[coolKey].data || acCfg.data[coolKey]) : null;
      check(`AC "${acCfg.name}" COOL sends ${expected ? coolKey : 'a known code'}`, cool.length > 0 && cool.every((c) => acCodes.includes(c)) && (!expected || cool.includes(expected)), cool.map((c) => c.slice(0, 16)));
      const off = await codesAfter(() => put(acc, '33', 0), 1500);
      check(`AC "${acCfg.name}" OFF sends the off code`, acCfg.data.off ? off.includes(acCfg.data.off.data || acCfg.data.off) : off.length > 0, off.map((c) => c.slice(0, 16)));
    }

    if (process.argv.includes('--bench')) {
      const pct = (arr, q) => {if (!arr.length) {return null;} const v = [...arr].sort((x, y) => x - y); return +v[Math.min(v.length - 1, Math.floor(v.length * q))].toFixed(1);};
      const timeCode = async (acc, type, value) => {
        const before = (sim.sentAt || []).length;
        const t0 = performance.now();
        await put(acc, type, value);
        const hapMs = performance.now() - t0;
        for (let i = 0; i < 200 && (sim.sentAt || []).length === before; i++) {await sleep(2);}
        const at = (sim.sentAt || [])[before];
        return { tapToRm: at === undefined ? null : at - t0, hapMs };
      };
      const bench = { switch: [], switchHap: [], ac: [], acHap: [] };
      const acc = find(sw.name);
      for (let i = 0; i < 40; i++) {
        const r = await timeCode(acc, '25', i % 2 === 0);
        if (r.tapToRm !== null) {bench.switch.push(r.tapToRm);}
        bench.switchHap.push(r.hapMs);
        await sleep(120);
      }
      if (acCfg) {
        const ac = find(acCfg.name);
        for (let i = 0; i < 6; i++) {
          await put(ac, '33', 0); await sleep(700);
          const r = await timeCode(ac, '33', 2);
          if (r.tapToRm !== null) {bench.ac.push(r.tapToRm);}
          bench.acHap.push(r.hapMs);
          await sleep(700);
        }
        await put(ac, '33', 0);
      }
      result.bench = {
        switchTapToRm: { n: bench.switch.length, p50: pct(bench.switch, 0.5), p90: pct(bench.switch, 0.9), max: pct(bench.switch, 1) },
        switchHapResponse: { p50: pct(bench.switchHap, 0.5), p90: pct(bench.switchHap, 0.9) },
        acCoolTapToRm: bench.ac.length ? { n: bench.ac.length, p50: pct(bench.ac, 0.5), max: pct(bench.ac, 1) } : null,
        acHapResponse: bench.acHap.length ? { p50: pct(bench.acHap, 0.5) } : null,
      };
    }

    // Reboot the RM: next command must still go through (re-auth on -7)
    if (sw) {
      sim.reboot();
      const got = await codesAfter(() => put(find(sw.name), '25', true));
      expectCodes('command after RM reboot (re-auth)', got, [sw.data.on]);
      await put(find(sw.name), '25', false);
    }

    const tvs = platform.accessories.filter((a) => a.type === 'tv').map((a) => a.name);
    check('TVs published as external accessories', tvs.every((n) => logLines.some((l) => l.includes(n))) || logLines.some((l) => /You added TVs/.test(l)), tvs);

    const bad = logLines.filter((l) => /(This plugin generated a warning|SLOW|deprecated|DEP0|TypeError|ReferenceError|Unhandled|characteristic was supplied illegal value|did not respond)/i.test(l));
    check('no HAP/Node warnings or errors in log', bad.length === 0, bad.slice(0, 15));
  } catch (err) {
    check('runner', false, err.stack);
  } finally {
    hb.kill('SIGTERM');
    await sleep(1500);
    await sim.stop();
    fs.rmSync(plugins, { recursive: true, force: true });
    fs.writeFileSync(path.join(storage, 'homebridge.log'), logLines.join('\n'));
  }
  console.log(JSON.stringify(result, null, 1));
  process.exit(result.ok ? 0 : 1);
})();
