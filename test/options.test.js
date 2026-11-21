'use strict';

// Option handling fixed while writing the documentation.

const assert = require('assert');
require('./helpers/setup');
const { Switch } = require('../accessories');

const make = (extra) => new Switch(() => {}, { name: `Opt ${Math.random()}`, data: { on: 'aa', off: 'bb' }, isUnitTest: true, persistState: false, ...extra }, 'FakeServiceManager');

describe('accessory option aliases', () => {
  it('resendDataAfterReload works (the old name used to overwrite it)', () => {
    assert.strictEqual(make({ resendDataAfterReload: true }).config.resendDataAfterReload, true);
  });

  it('resendHexAfterReload still works', () => {
    assert.strictEqual(make({ resendHexAfterReload: true }).config.resendDataAfterReload, true);
  });

  it('neither set means off', () => {
    assert.strictEqual(make({}).config.resendDataAfterReload, undefined);
  });
});
