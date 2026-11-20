const hap = require('@homebridge/hap-nodejs');

const BroadlinkRMPlatform = require('../../platform');
const FakeDevice = require('./fakeDevice')
const { addDevice } = require('../../helpers/getDevice')

global.Service = hap.Service;
global.Characteristic = hap.Characteristic;


const log = (message, more) => {
  if (more) {
    // console.log(message, more)
  } else {
    // console.log(message)
  }
};

const os = require('os');
const path = require('path');
const fs = require('fs');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-brm-test-'));
global.HistoryService = require('fakegato-history')({ hap, user: { storagePath: () => testDir } });

const setup = (config) => {
  config = { homebridgeDirectory: testDir, isUnitTest: true, hideWelcomeMessage: true, ...config };
  const platform = new BroadlinkRMPlatform(log, config);

  const device = new FakeDevice()
  addDevice(device)

  return { platform, device }
}

const getAccessories = (config, replacementLog) => {
  const { platform, device } = setup(config)

  const accessoriesPromise = new Promise((resolve, reject) => {
    platform.accessories(resolve);
  })

  return accessoriesPromise
}

module.exports = { log, setup, getAccessories }