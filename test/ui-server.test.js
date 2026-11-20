'use strict';

// Drives homebridge-ui/server.js the way the Homebridge UI does (IPC child
// process) against the UDP RM simulator.

const assert = require('assert');
const path = require('path');
const { fork } = require('child_process');
const RMSimulator = require('./sim/rmSimulator');

const IR = '26001a001d1d1d1d1d3a1d3a1d3a1d1d1d3a1d1d1d1d1d1d1d1d1d3a000d05';
const RF = 'b2000a0102030405060708';

class UiClient {
  constructor() {
    this.child = fork(path.join(__dirname, '..', 'homebridge-ui', 'server.js'), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    this.pending = new Map();
    this.events = [];
    this.seq = 0;
    this.ready = new Promise((resolve) => {
      this.child.on('message', (m) => {
        if (m.action === 'ready') {resolve();}
        if (m.action === 'response') {
          const p = this.pending.get(m.payload.requestId);
          this.pending.delete(m.payload.requestId);
          if (p) {(m.payload.success ? p.resolve : p.reject)(m.payload.data);}
        }
        if (m.action === 'stream') {this.events.push(m.payload);}
      });
    });
  }

  request(p, body) {
    const requestId = String(++this.seq);
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.child.send({ action: 'request', path: p, body, requestId });
    });
  }

  async waitFor(stage, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const ev = this.events.find((e) => e.event === 'learn' && e.data.stage === stage);
      if (ev) {return ev.data;}
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no "${stage}" event; got ${JSON.stringify(this.events.map((e) => e.data && e.data.stage))}`);
  }

  close() {this.child.kill();}
}

describe('settings UI server', function () {
  this.timeout(20000);
  let sim;
  let ui;
  let host;

  beforeEach(async () => {
    sim = await new RMSimulator({ devtype: 0x520b }).start();
    host = { address: '127.0.0.1', port: sim.port, mac: '34:ea:34:5a:c0:de', isRM4: true, isRFSupported: true };
    ui = new UiClient();
    await ui.ready;
  });
  afterEach(async () => {
    ui.close();
    await sim.stop();
  });

  it('/probe describes the device', async () => {
    const r = await ui.request('/probe', { address: '127.0.0.1', port: sim.port });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.device.model, 'RM4 Pro');
    assert.strictEqual(r.device.mac, '34:ea:34:5a:c0:de');
    assert.strictEqual(r.device.rf, true);
  });

  it('/probe explains when nothing answers', async () => {
    const r = await ui.request('/probe', { address: '127.0.0.1', port: 9 });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /no BroadLink answered/);
  });

  it('/scan finds the device (unicast target for the test)', async () => {
    const r = await ui.request('/scan', { sweep: false, timeoutMs: 800, port: sim.port, broadcast: '127.0.0.1' });
    assert.strictEqual(r.devices.length, 1);
    assert.strictEqual(r.devices[0].model, 'RM4 Pro');
  });

  it('/convert accepts hex, base64 (Home Assistant / SmartIR) and Pronto', async () => {
    assert.deepStrictEqual(await ui.request('/convert', { text: IR.toUpperCase().match(/.{2}/g).join(' ') }), { ok: true, hex: IR, format: 'hex' });
    const b64 = Buffer.from(IR, 'hex').toString('base64');
    assert.deepStrictEqual(await ui.request('/convert', { text: b64 }), { ok: true, hex: IR, format: 'base64' });
    const pronto = '0000 006C 0002 0000 0157 00AC 0015 0689';
    const p = await ui.request('/convert', { text: pronto });
    assert.strictEqual(p.ok, true);
    assert.strictEqual(p.format, 'pronto');
    assert.ok(p.hex.startsWith('26'));
    assert.strictEqual((await ui.request('/convert', { text: 'hello there' })).ok, false);
  });

  it('/send tests a code through the device', async () => {
    const r = await ui.request('/send', { host, code: Buffer.from(IR, 'hex').toString('base64') });
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(sim.sent, [IR]);
  });

  it('learns an IR code with live progress', async () => {
    sim.learned = IR;
    sim.learnAfter = 2; // two polls before the button is pressed
    const r = await ui.request('/learn/start', { host, kind: 'ir' });
    assert.strictEqual(r.ok, true);
    await ui.waitFor('ready');
    const done = await ui.waitFor('code');
    assert.strictEqual(done.hex, IR);
  });

  it('learns an RF code, passing the found frequency back to the device', async () => {
    sim.learned = RF;
    sim.frequency = 433.92;
    sim.frequencyAfter = 2;
    const r = await ui.request('/learn/start', { host, kind: 'rf' });
    assert.strictEqual(r.ok, true);
    await ui.waitFor('sweeping');
    const f = await ui.waitFor('frequency');
    assert.strictEqual(f.mhz, 433.92);
    await ui.waitFor('press');
    const done = await ui.waitFor('code');
    assert.strictEqual(done.hex, RF);
    assert.strictEqual(sim.rfPacketPayload, Buffer.from([0x00, 0x9f, 0x06, 0x00]).toString('hex')); // 433920 LE
  });

  it('learning can be cancelled', async () => {
    const r = await ui.request('/learn/start', { host, kind: 'ir' });
    assert.strictEqual(r.ok, true);
    await ui.waitFor('ready');
    await ui.request('/learn/cancel');
    await ui.waitFor('cancelled');
  });

  it('refuses RF learning on an IR-only model', async () => {
    await sim.stop();
    sim = await new RMSimulator({ devtype: 0x51da, mac: '34ea345ac0df' }).start();
    const r = await ui.request('/learn/start', { host: { address: '127.0.0.1', port: sim.port }, kind: 'rf' });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /cannot learn radio/);
  });
});
