'use strict';

const broadlink = require('./broadlink');

// address / mac -> device. Devices come from discovery, the "hosts" config,
// or tests (addDevice with a fake).
const devices = new Map();
let listening = false;

const register = (device) => {
  devices.set(device.host.address, device);
  if (device.host.macAddress) {devices.set(device.host.macAddress.toLowerCase(), device);}
};

/**
 * Start device management.
 * @param {boolean} automatic  broadcast discovery (when no "hosts" configured)
 */
const discoverDevices = (automatic = true, log, logLevel, deviceDiscoveryTimeout = 60, deviceOptions = {}) => {
  broadlink.log = log;
  broadlink.debug = logLevel <= 1;
  broadlink.deviceOptions = deviceOptions;

  if (!listening) {
    listening = true;
    broadlink.on('deviceAdded', register);
    broadlink.on('deviceReady', (device) => {
      log(`\x1b[35m[INFO]\x1b[0m Discovered ${device.model} (0x${device.type.toString(16)}) at ${device.host.address} (${device.host.macAddress})`);
      register(device);
    });
  }

  if (automatic) {
    // Broadcast every 2 s for the discovery window; devices that answer are
    // authenticated and then monitored with unicast hellos.
    broadlink.discover();
    // Broadcasts are often dropped by Wi-Fi access points; a one-off unicast
    // sweep of the local subnet finds those devices too.
    broadlink.discoverOnce().catch(() => {});
    const interval = setInterval(() => broadlink.discover(), 2000);
    setTimeout(() => clearInterval(interval), deviceDiscoveryTimeout * 1000).unref();
    interval.unref();
  }
};

const addDevice = (device) => {
  if (!device.isUnitTestDevice && (devices.has(device.host.address) || devices.has(device.host.macAddress))) {return;}
  register(device);
};

const getDevice = ({ host, log, learnOnly }) => {
  if (host) {return devices.get(host) || devices.get(String(host).toLowerCase().replace(/-/g, ':'));}

  // No host given: use the first device (that can learn, if asked).
  const all = [...new Set(devices.values())];
  const device = learnOnly ? all.find((d) => d.enterLearning) : all[0];
  if (!device && log && devices.size) {log(`${learnOnly ? 'Learn Code' : 'Send data'} (no suitable device found)`);}
  return device;
};

module.exports = { getDevice, discoverDevices, addDevice };
