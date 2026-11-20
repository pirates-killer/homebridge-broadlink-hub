'use strict';

const BroadlinkRMPlatform = require('./platform');

module.exports = (api) => {
  // Accessories reference these as globals (historical API of this plugin).
  global.Service = api.hap.Service;
  global.Characteristic = api.hap.Characteristic;
  // fakegato is only needed by sensor/AC accessories with history enabled; load lazily.
  let history;
  Object.defineProperty(global, 'HistoryService', {
    configurable: true,
    get: () => (history ||= require('fakegato-history')(api)),
  });

  BroadlinkRMPlatform.setHomebridge(api);
  // "BroadlinkRM" is the platform name homebridge-broadlink-rm used. Homebridge
  // derives accessory IDs from it, so keeping it makes this plugin a drop-in
  // replacement: same config, same HomeKit accessories, rooms and automations.
  api.registerPlatform('BroadlinkRM', BroadlinkRMPlatform);
};
