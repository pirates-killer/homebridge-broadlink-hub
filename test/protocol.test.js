'use strict';

const assert = require('assert');
const P = require('../lib/broadlink/protocol');
const { Broadlink, RMDevice } = require('../lib/broadlink');
const RMSimulator = require('./sim/rmSimulator');
const vectors = require('./fixtures/python-broadlink-vectors.json');

const MAC = Buffer.from(vectors.mac, 'hex');
const CODE = Buffer.from('26001a001d1d1d1d1d3a1d3a1d3a1d1d1d3a1d1d1d1d1d1d1d1d1d3a000d05', 'hex');

describe('protocol codec', () => {
  // Byte-for-byte agreement with python-broadlink 0.19 (independent implementation).
  const encode = (c, sub, data) => P.encodePacket({
    devtype: c.devtype, command: P.CMD.COMMAND, count: c.count, mac: MAC,
    id: Buffer.from(vectors.id, 'hex'), key: Buffer.from(vectors.key, 'hex'),
    payload: P.frameRM(c.devtype === 0x520b, sub, data),
  }).toString('hex');

  const byLabel = Object.fromEntries(vectors.cases.map((c) => [c.label, c]));

  it('RM4 send_data matches python-broadlink', () => {
    const c = byLabel['rm4 send_data'];
    assert.strictEqual(encode(c, P.RM.SEND_DATA, CODE), c.packet);
  });
  it('RM4 check_data matches python-broadlink', () => {
    const c = byLabel['rm4 check_data'];
    assert.strictEqual(encode(c, P.RM.CHECK_DATA), c.packet);
  });
  it('RM4 sweep_frequency matches python-broadlink', () => {
    const c = byLabel['rm4 sweep_frequency'];
    assert.strictEqual(encode(c, P.RM.SWEEP_FREQUENCY), c.packet);
  });
  it('legacy RM send_data matches python-broadlink', () => {
    const c = byLabel['rm send_data'];
    assert.strictEqual(encode(c, P.RM.SEND_DATA, CODE), c.packet);
  });
  it('legacy RM enter_learning matches python-broadlink', () => {
    const c = byLabel['rm enter_learning'];
    assert.strictEqual(encode(c, P.RM.ENTER_LEARNING), c.packet);
  });
  it('auth packet matches python-broadlink', () => {
    const a = vectors.auth;
    const pkt = P.encodePacket({
      devtype: a.devtype, command: P.CMD.AUTH, count: a.count, mac: MAC,
      id: Buffer.alloc(4), key: P.DEFAULT_KEY, payload: P.buildAuthPayload(),
    });
    assert.strictEqual(pkt.toString('hex'), a.packet);
  });

  it('round-trips and rejects corrupted frames', () => {
    const key = Buffer.alloc(16, 7);
    const pkt = P.encodePacket({ devtype: 0x520b, command: 0xee, count: 5, mac: MAC, id: Buffer.alloc(4), key, payload: Buffer.from('hello') });
    const d = P.decodePacket(pkt, key);
    assert.strictEqual(d.count, 5);
    assert.strictEqual(d.payload.subarray(0, 5).toString(), 'hello');
    pkt[0x40] ^= 0xff;
    assert.strictEqual(P.decodePacket(pkt, key), null);
  });

  it('RM4 length field is len(data)+4 (upstream sent a constant 0xda)', () => {
    assert.strictEqual(P.frameRM(true, 2, Buffer.alloc(300)).readUInt16LE(0), 304);
  });
});

describe('RMDevice against simulator', function () {
  this.timeout(10000);
  let sim;
  let device;

  const make = (opts = {}) => new RMDevice({
    address: '127.0.0.1', port: sim.port, mac: sim.mac, devtype: sim.devtype,
    timeout: 300, monitorInterval: 0, ...opts,
  });

  beforeEach(async () => {
    sim = await new RMSimulator().start();
    device = make();
  });
  afterEach(async () => {
    device.close();
    await sim.stop();
  });

  it('authenticates and emits deviceReady once', async () => {
    let ready = 0;
    device.on('deviceReady', () => ready++);
    await device.authenticate();
    await device.authenticate();
    assert.strictEqual(ready, 1);
    assert.ok(device.authenticated);
  });

  it('sends a code and gets it acknowledged', async () => {
    assert.strictEqual(await device.sendData(CODE), true);
    assert.deepStrictEqual(sim.sent, [CODE.toString('hex')]);
    assert.strictEqual(sim.lastLengthField, CODE.length + 4);
  });

  it('re-authenticates transparently after the device reboots (-7)', async () => {
    await device.sendData(CODE);
    sim.reboot();
    assert.strictEqual(await device.sendData(CODE), true);
    assert.strictEqual(sim.sent.length, 2);
    assert.strictEqual(sim.requests.filter((r) => r.command === P.CMD.AUTH).length, 2);
  });

  it('does not resend a code after a lost reply by default (no double toggles)', async () => {
    await device.authenticate();
    sim.dropNext = 1;
    assert.strictEqual(await device.sendData(CODE), false);
    assert.strictEqual(sim.sent.length, 0);
    // Next send recovers (re-auth + send).
    assert.strictEqual(await device.sendData(CODE), true);
  });

  it('retries after a timeout when retries > 0', async () => {
    device.close();
    device = make({ retries: 1 });
    await device.authenticate();
    sim.dropNext = 1;
    assert.strictEqual(await device.sendData(CODE), true);
    assert.strictEqual(sim.sent.length, 1);
  });

  it('serialises concurrent sends in order', async () => {
    const codes = [1, 2, 3, 4, 5].map((n) => Buffer.from([0x26, 0, 1, 0, n]));
    const results = await Promise.all(codes.map((c) => device.sendData(c)));
    assert.deepStrictEqual(results, [true, true, true, true, true]);
    assert.deepStrictEqual(sim.sent, codes.map((c) => c.toString('hex')));
  });

  it('honours sendGap between transmissions', async () => {
    device.close();
    device = make({ sendGap: 120 });
    await device.authenticate();
    const t0 = Date.now();
    await Promise.all([device.sendData(CODE), device.sendData(CODE), device.sendData(CODE)]);
    assert.ok(Date.now() - t0 >= 240, `took ${Date.now() - t0} ms`);
  });

  it('checkData emits rawData only once something was learned', async () => {
    const seen = [];
    device.on('rawData', (d) => seen.push(d.toString('hex')));
    await device.checkData();
    assert.deepStrictEqual(seen, []);
    sim.learned = 'b2000a0102030405';
    await device.checkData();
    assert.deepStrictEqual(seen, ['b2000a0102030405']);
  });

  it('reads RM4 sensors (including negative values) and stays quiet without one', async () => {
    const logs = [];
    device.log = (m) => logs.push(m);
    assert.strictEqual(await device.checkTemperature(), null);
    assert.deepStrictEqual(logs, []);
    sim.sensor = { temperature: 23.5, humidity: 41.25 };
    const r = await device.checkTemperature();
    assert.strictEqual(r.temperature, 23.5);
    assert.strictEqual(r.humidity, 41.25);
  });

  it('exposes RF methods only on RF-capable models', () => {
    assert.strictEqual(typeof device.enterRFSweep, 'function');
    const ir = new RMDevice({ address: '127.0.0.1', mac: MAC, devtype: 0x51da, monitorInterval: 0 });
    assert.strictEqual(ir.enterRFSweep, undefined);
    ir.close();
  });
});

describe('Broadlink registry', function () {
  this.timeout(10000);
  let sim;
  let bl;
  beforeEach(async () => {
    sim = await new RMSimulator({ devtype: 0x6026 }).start();
    bl = new Broadlink();
    bl.deviceOptions = { timeout: 300, monitorInterval: 0 };
  });
  afterEach(async () => {
    bl.close();
    await sim.stop();
  });

  it('manual host uses the real devtype reported by hello', async () => {
    const ready = new Promise((r) => bl.once('deviceReady', r));
    const d = await bl.addManualHost({ address: '127.0.0.1', port: sim.port, mac: '34:ea:34:5a:c0:de', isRM4: true, isRFSupported: true });
    await ready;
    assert.strictEqual(d.type, 0x6026);
    assert.ok(sim.requests.every((r) => r.devtype === 0x6026));
  });

  it('probe resends when the first hello gets no answer (RM waking up)', async () => {
    sim.dropHellos = 2;
    const hello = await bl.probe('127.0.0.1', sim.port);
    assert.ok(hello, 'probe should succeed on a resend');
    assert.strictEqual(hello.devtype, 0x6026);
  });

  it('warns about locked devices', async () => {
    sim.locked = true;
    const logs = [];
    bl.log = (m) => logs.push(m);
    await bl.addManualHost({ address: '127.0.0.1', port: sim.port, mac: '34:ea:34:5a:c0:de', isRM4: true });
    assert.ok(logs.some((l) => /locked/.test(l)));
  });

  it('falls back to configured flags when hello gets no answer', async () => {
    const logs = [];
    bl.log = (m) => logs.push(m);
    const d = await bl.addManualHost({ address: '127.0.0.1', port: 9, mac: '34:ea:34:5a:c0:df', isRM4: true, isRFSupported: true });
    assert.strictEqual(d.type, 0x520b);
    assert.ok(d.rf && d.rm4);
  });
});

describe('RMDevice responsiveness', function () {
  this.timeout(15000);
  let sim;
  let device;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const auths = () => sim.requests.filter((r) => r.command === P.CMD.AUTH).length;
  const make = (opts = {}) => new RMDevice({
    address: '127.0.0.1', port: sim.port, mac: sim.mac, devtype: sim.devtype, monitorInterval: 0, ...opts,
  });

  beforeEach(async () => {sim = await new RMSimulator().start();});
  afterEach(async () => {device.close(); await sim.stop();});

  it('ignores a late reply to a timed-out request (counter matching)', async () => {
    device = make({ timeout: 300 });
    await device.authenticate();
    sim.learned = 'aa01';
    sim.replyDelay = 400; // first reply arrives after its timeout...
    const first = device.rmCommand(P.RM.CHECK_DATA).catch((e) => e.code);
    await sleep(50);
    sim.learned = 'bb02';
    sim.replyDelay = 200; // ...while the second request is waiting
    const second = await device.rmCommand(P.RM.CHECK_DATA);
    assert.strictEqual(await first, 'ETIMEDOUT');
    assert.strictEqual(second.toString('hex'), 'bb02');
  });

  it('learns the round trip: a lost reply stalls ~250 ms, not 2 s', async () => {
    device = make({ timeout: 2000 });
    for (let i = 0; i < 8; i++) {await device.rmCommand(P.RM.CHECK_SENSORS).catch(() => {});}
    assert.strictEqual(device._timeoutFor('ctl'), 250);
    sim.muteNext = 1;
    const t0 = Date.now();
    await assert.rejects(device.rmCommand(P.RM.CHECK_SENSORS), { code: 'ETIMEDOUT' });
    const stalled = Date.now() - t0;
    assert.ok(stalled < 600, `stalled ${stalled} ms`);
  });

  it('adaptive timeout can be turned off', async () => {
    device = make({ timeout: 700, adaptiveTimeout: false });
    for (let i = 0; i < 4; i++) {await device.rmCommand(P.RM.CHECK_SENSORS).catch(() => {});}
    assert.strictEqual(device._timeoutFor('ctl'), 700);
  });

  it('retries resend the identical packet (same counter)', async () => {
    device = make({ timeout: 300, retries: 1 });
    await device.authenticate();
    sim.muteNext = 1;
    assert.strictEqual(await device.sendData(CODE), true);
    const sends = sim.requests.filter((r) => r.sub === P.RM.SEND_DATA);
    assert.strictEqual(sends.length, 2);
    assert.strictEqual(sends[0].count, sends[1].count);
  });

  it('a lost reply does not cost the next tap a re-login', async () => {
    device = make({ timeout: 300 });
    await device.sendData(CODE);
    const before = auths();
    sim.muteNext = 1;
    assert.strictEqual(await device.sendData(CODE), false);
    await sleep(50); // background session check
    assert.strictEqual(await device.sendData(CODE), true);
    assert.strictEqual(auths(), before);
  });

  it('keepalive re-authenticates after a reboot before the user taps', async () => {
    device = make({ timeout: 300, monitorInterval: 100 });
    await device.authenticate();
    device.startMonitoring();
    sim.reboot();
    await sleep(350);
    assert.ok(device.stats.reauths >= 1);
    const before = auths();
    const t0 = performance.now();
    assert.strictEqual(await device.sendData(CODE), true);
    assert.strictEqual(auths(), before, 'tap must not pay for a login');
    assert.ok(performance.now() - t0 < 50);
  });

  it('accepts a hostname', async () => {
    device = new RMDevice({ address: 'localhost', port: sim.port, mac: sim.mac, devtype: sim.devtype, monitorInterval: 0, timeout: 500 });
    assert.strictEqual(await device.sendData(CODE), true);
  });

  it('commands issued during startup login are queued, not dropped', async () => {
    const bl = new Broadlink();
    bl.deviceOptions = { timeout: 500, monitorInterval: 0 };
    const sent = new Promise((resolve) => bl.once('deviceAdded', (d) => resolve(d.sendData(CODE))));
    await bl.addManualHost({ address: '127.0.0.1', port: sim.port, mac: '34:ea:34:5a:c0:de', isRM4: true, isRFSupported: true });
    assert.strictEqual(await sent, true);
    assert.deepStrictEqual(sim.sent, [CODE.toString('hex')]);
    device = { close: () => bl.close() };
  });
});
