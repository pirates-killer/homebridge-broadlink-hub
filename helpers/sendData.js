'use strict';

const { getDevice } = require('./getDevice');
const convertProntoCode = require('./convertProntoCode');

/** Send one IR/RF hex code. Resolves true if the device acknowledged it. */
module.exports = async ({ host, hexData, log, name, logLevel }) => {
  if (!hexData || typeof hexData !== 'string') {
    log(`\x1b[31m[ERROR]: \x1b[0m${name} sendData (HEX value is missing)`);
    return false;
  }

  if (hexData.startsWith('0000')) {
    if (logLevel <= 1) {log(`\x1b[33m[DEBUG]\x1b[0m ${name} sendHex (Converting Pronto code "${hexData}" to Broadlink code)`);}
    hexData = convertProntoCode(hexData, log);
    if (!hexData) {
      log(`\x1b[31m[ERROR] \x1b[0m${name} sendData (A Pronto code was detected however its conversion to a Broadlink code failed.)`);
      return false;
    }
    if (logLevel <= 1) {log(`\x1b[33m[DEBUG]\x1b[0m ${name} sendHex (Pronto code successfully converted: "${hexData}")`);}
  }

  const device = getDevice({ host, log });
  if (!device) {
    log(`\x1b[31m[ERROR] \x1b[0m${name} sendData (no device found${host ? ` at ${host}` : ''}, ensure the device is not locked)`);
    return false;
  }
  if (!device.sendData) {
    log(`\x1b[31m[ERROR] \x1b[0mThe device at ${device.host.address} (${device.host.macAddress}) doesn't support the sending of IR or RF codes.`);
    return false;
  }
  if (hexData.includes('5aa5aa555')) {
    log(`\x1b[31m[ERROR] \x1b[0mThis type of hex code (5aa5aa555...) is no longer valid. Use the included "Learn Code" accessory to find new (decrypted) codes.`);
    return false;
  }

  const ok = await device.sendData(Buffer.from(hexData, 'hex'), logLevel, hexData);
  if (logLevel <= 2) {log(`${name} sendHex (${device.host.address}; ${device.host.macAddress}) ${hexData}${ok === false ? ' [not acknowledged]' : ''}`);}
  return ok !== false;
};
