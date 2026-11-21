'use strict';

// 0.1.1: codes are paced by their airtime. Reproduces the field report: one
// Home-app tap sent "fan speed" + "fan on" (two ~370 ms RF codes) back to back;
// the second reached the RM4 while it was still transmitting the first, was
// answered late and logged as "code not acknowledged" (and an RM that drops
// requests while busy would not have sent it at all).

const assert = require('assert');
const P = require('../lib/broadlink/protocol');
const { RMDevice } = require('../lib/broadlink');
const RMSimulator = require('./sim/rmSimulator');

/** A code of `pulses` pulses of `units` ticks each (1 tick = 2^-15 s). */
const code = (type, repeat, pulses, units = 200) => {
  const body = Buffer.alloc(pulses, units);
  const head = Buffer.from([type, repeat, 0, 0]);
  head.writeUInt16LE(body.length, 2);
  return Buffer.concat([head, body]);
};
const rfFanCode = (n) => {const c = code(0xb1, 0xc0, 60); c[4] = n; return c;}; // ≈ 370 ms on air
const shortIr = () => code(0x26, 0x00, 20, 20); // ≈ 12 ms on air

describe('code airtime', () => {
  it('estimates IR airtime from pulses and the repeat byte', () => {
    assert.strictEqual(Math.round(P.estimateAirtime(code(0x26, 0, 10, 100))), 31); // 1000 ticks
    assert.strictEqual(Math.round(P.estimateAirtime(code(0x26, 2, 10, 100))), 92); // 3 frames
  });

  it('decodes long pulses (00 hi lo)', () => {
    const c = Buffer.from([0x26, 0, 4, 0, 0x00, 0x01, 0x00, 0x00]); // 256 ticks + 0
    assert.strictEqual(Math.round(P.estimateAirtime(c)), 8);
  });

  it('counts one frame for RF codes (their second byte is firmware-specific)', () => {
    const c = rfFanCode(1);
    assert.ok(Math.abs(P.estimateAirtime(c) - 360) < 2, String(P.estimateAirtime(c))); // 59 x 200 ticks + 1
  });

  it('is capped and safe on junk', () => {
    assert.strictEqual(P.estimateAirtime(code(0x26, 255, 600, 255)), P.MAX_AIRTIME_MS);
    assert.strictEqual(P.estimateAirtime(Buffer.from([0x26])), 0);
    assert.strictEqual(P.estimateAirtime(null), 0);
  });
});

for (const mode of ['reply-after', 'reply-before']) {
  describe(`back-to-back RF codes (RM ${mode.replace('-', 's ')} transmitting)`, function () {
    this.timeout(15000);
    let sim;
    let device;

    beforeEach(async () => {
      sim = await new RMSimulator().start();
      sim.airtimeMode = mode;
      device = new RMDevice({ address: '127.0.0.1', port: sim.port, mac: sim.mac, devtype: sim.devtype, monitorInterval: 0 });
      // Warm up so the adaptive reply timeout is at its 400 ms floor, as on the real Pi.
      for (let i = 0; i < 8; i++) {await device.sendData(shortIr());}
      assert.strictEqual(device._timeoutFor('send'), 400);
    });
    afterEach(async () => {device.close(); await sim.stop();});

    it('both codes are acknowledged and never overlap on air', async () => {
      const results = await Promise.all([device.sendData(rfFanCode(1)), device.sendData(rfFanCode(2))]);
      assert.deepStrictEqual(results, [true, true]);
      assert.strictEqual(sim.overlapped, 0, 'second code must wait until the first has been transmitted');
      assert.deepStrictEqual(sim.sent.slice(-2), [rfFanCode(1).toString('hex'), rfFanCode(2).toString('hex')]);
    });

    it('control: without airtime awareness the 0.1.0 failure comes back', async () => {
      const real = P.estimateAirtime;
      P.estimateAirtime = () => 0;
      const logs = [];
      device.log = (m) => logs.push(m);
      try {
        if (mode === 'reply-before') {
          // The RM answers at once, so the second code reaches it mid-transmission.
          await Promise.all([device.sendData(rfFanCode(1)), device.sendData(rfFanCode(2))]);
          assert.ok(sim.overlapped >= 1, 'second code reached a busy RM');
        } else {
          // The RM answers after transmitting: a fan code with 423 ms of airtime
          // (the longest in the field config) outlasts the learned 400 ms floor.
          assert.strictEqual(await device.sendData(code(0xb1, 0xc0, 69)), false);
          assert.ok(logs.some((l) => /not acknowledged/.test(l)), 'reproduces the field log');
        }
      } finally {
        P.estimateAirtime = real;
      }
    });

    it('a long code alone is acknowledged (reply may take its airtime)', async () => {
      assert.strictEqual(await device.sendData(code(0xb2, 0, 140)), true); // ≈ 850 ms
      assert.strictEqual(await device.sendData(code(0xb2, 0, 400, 200)), true); // ≈ 2.4 s, beyond the 2 s cap
    });

    it('short IR codes keep their fast pace', async () => {
      const t0 = Date.now();
      for (let i = 0; i < 5; i++) {assert.strictEqual(await device.sendData(shortIr()), true);}
      assert.ok(Date.now() - t0 < 500, `took ${Date.now() - t0} ms`);
    });
  });
}
