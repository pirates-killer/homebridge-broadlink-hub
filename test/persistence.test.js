'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Fixture files were written by node-persist 2.1 (what <=4.4.21 used).
const FIXTURE = path.join(__dirname, 'fixtures', 'node-persist');

describe('persistentState (node-persist 2.x compatible)', () => {
  let state;
  let dir;
  beforeEach(() => {
    delete require.cache[require.resolve('../base/helpers/persistentState')];
    state = require('../base/helpers/persistentState');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brm-persist-'));
    const target = path.join(dir, 'plugin-persist', 'homebridge-broadlink-rm');
    fs.mkdirSync(target, { recursive: true });
    for (const f of fs.readdirSync(FIXTURE)) {fs.copyFileSync(path.join(FIXTURE, f), path.join(target, f));}
    state.init({ homebridgeDirectory: dir });
  });

  it('reads state written by the previous plugin version', () => {
    assert.deepStrictEqual(state.load({ host: '192.168.1.50', name: 'Living Room AC' }), {
      targetHeatingCoolingState: 2, targetTemperature: 24, currentTemperature: 0, currentHumidity: null,
    });
    assert.deepStrictEqual(state.load({ name: 'Living Room TV' }), { switchState: true, input: 1 });
  });

  it('writes files the previous version can read (same name + shape)', () => {
    state.save({ host: '192.168.1.50', name: 'Living Room AC', state: { targetTemperature: 20 } });
    state.flush();
    const files = fs.readdirSync(path.join(dir, 'plugin-persist', 'homebridge-broadlink-rm'));
    const f = files.find((n) => n === '6fa3f3b9b48a01bd0d2a2d4e0e3d5e1f' || JSON.parse(fs.readFileSync(path.join(dir, 'plugin-persist', 'homebridge-broadlink-rm', n))).key === '192.168.1.50-Living Room AC');
    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'plugin-persist', 'homebridge-broadlink-rm', f)));
    assert.deepStrictEqual(doc, { key: '192.168.1.50-Living Room AC', value: { targetTemperature: 20 } });
    assert.ok(fs.readdirSync(FIXTURE).includes(f), 'file name must equal the md5 name node-persist used');
  });

  it('returns undefined for unknown accessories', () => {
    assert.strictEqual(state.load({ host: 'x', name: 'nope' }), undefined);
  });
});
