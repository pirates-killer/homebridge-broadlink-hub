'use strict';

const ServiceManager = require('./serviceManager');

module.exports = {
  ServiceManager,
  // Test-only service manager. Loaded on first use: the test folder is not
  // part of the published package.
  get FakeServiceManager() {
    return require('../test/helpers/fakeServiceManager');
  },
};
