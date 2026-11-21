'use strict';

const assert = require('assert');
const { HomebridgePlatform } = require('./base');

const npmPackage = require('./package.json');
const Accessory = require('./accessories');
const broadlink = require('./helpers/broadlink');
const { discoverDevices } = require('./helpers/getDevice');
const { createAccessory } = require('./helpers/accessoryCreator');

const classTypes = {
  'air-conditioner': Accessory.AirCon,
  'air-purifier': Accessory.AirPurifier,
  'humidifier-dehumidifier': Accessory.HumidifierDehumidifier,
  'learn-ir': Accessory.LearnCode,
  'learn-code': Accessory.LearnCode,
  'switch': Accessory.Switch,
  'garage-door-opener': Accessory.GarageDoorOpener,
  'lock': Accessory.Lock,
  'switch-multi': Accessory.SwitchMulti,
  'switch-multi-repeat': Accessory.SwitchMultiRepeat,
  'switch-repeat': Accessory.SwitchRepeat,
  'fan': Accessory.Fan,
  'fanv1': Accessory.Fanv1,
  'outlet': Accessory.Outlet,
  'light': Accessory.Light,
  'window': Accessory.Window,
  'window-covering': Accessory.WindowCovering,
  'tv': Accessory.TV,
  'temperatureSensor': Accessory.TemperatureSensor,
  'humiditySensor': Accessory.HumiditySensor,
  'heater-cooler': Accessory.HeaterCooler
}

// Transport options accepted at platform level and per hosts entry.
const CONNECTION_OPTIONS = ['timeout', 'retries', 'sendGap', 'adaptiveTimeout'];

let homebridgeRef

const BroadlinkRMPlatform = class extends HomebridgePlatform {

  constructor (log, config = {}) {
    super(log, config, homebridgeRef);
  }

  addAccessories (accessories) {
    const { config, log, logLevel } = this;

    this.discoverBroadlinkDevices();
    this.showMessage();

    if (!config.accessories) {config.accessories = []}

    // Add a Learn Code accessory if none exist in the config
    const learnIRAccessories = (config && config.accessories && Array.isArray(config.accessories)) ? config.accessories.filter((accessory) => (accessory.type === 'learn-ir' || accessory.type === 'learn-code')) : [];

    if (learnIRAccessories.length === 0) {

      if (!config.hideLearnButton) {
        const learnCodeAccessory = new Accessory.LearnCode(log, { name: 'Learn', scanFrequency: false });
        accessories.push(learnCodeAccessory);
      }

      if (!config.hideScanFrequencyButton) {
        const scanFrequencyAccessory = new Accessory.LearnCode(log, { name: 'Scan Frequency', scanFrequency: true });
        accessories.push(scanFrequencyAccessory);
      }
    }

    // Iterate through the config accessories
    const tvs = [];
    config.accessories.forEach((accessory) => {
      if (!accessory.type) {throw new Error(`Each accessory must be configured with a "type". e.g. "switch"`);}
      if (accessory.disabled) {return;}
      if (!classTypes[accessory.type]) {throw new Error(`${npmPackage.displayName} doesn't support accessories of type "${accessory.type}".`);}

      const homeKitAccessory = new classTypes[accessory.type](log, accessory);

      if (classTypes[accessory.type] === classTypes.tv) {
        const subType = String(accessory.subType || '').toLowerCase();
        if(subType === 'stb'){homeKitAccessory.subType = homebridgeRef.hap.Categories.TV_SET_TOP_BOX;}
        if(subType === 'receiver'){homeKitAccessory.subType = homebridgeRef.hap.Categories.AUDIO_RECEIVER;}
        if(subType === 'stick'){homeKitAccessory.subType = homebridgeRef.hap.Categories.TV_STREAMING_STICK;}

        if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m Adding Accessory ${accessory.type} (${accessory.subType})`);}
        tvs.push(homeKitAccessory);
        return;
      }

      if (logLevel <=1) {log(`\x1b[34m[DEBUG]\x1b[0m Adding Accessory ${accessory.type} (${accessory.subType})`);}
      accessories.push(homeKitAccessory);
    });

    if (tvs.length > 0) {
      {
        const TV = homebridgeRef.hap.Categories.TELEVISION;
        homebridgeRef.publishExternalAccessories(npmPackage.name, tvs.map(tv => createAccessory(tv, tv.name, TV, homebridgeRef, tv.subType)));

        log('');
        log(`**************************************************************************************************************`);
        log(`You added TVs in your configuration!`);
        log(`Due to a HomeKit limitation you need to add any TVs to the Home app by using the Add Accessory function.`);
        log(`There you'll find your TVs and you can use the same PIN as you using for this HomeBridge instance.`);
        log(`**************************************************************************************************************`);
        log('');
      }
    }
  }

  discoverBroadlinkDevices () {
    const { config, log, logLevel } = this;
    const { hosts } = config;

    // Platform-wide transport defaults; any host entry may override them.
    const deviceOptions = {};
    for (const k of CONNECTION_OPTIONS) {
      if (config[k] !== undefined) {deviceOptions[k] = config[k];}
    }

    if (!hosts) {
      if (logLevel <=2) {log(`\x1b[35m[INFO]\x1b[0m Automatically discovering Broadlink RM devices.`)}
      discoverDevices(true, log, logLevel, config.deviceDiscoveryTimeout, deviceOptions);
      return;
    }

    discoverDevices(false, log, logLevel, undefined, deviceOptions);
    if (logLevel <=2) {log(`\x1b[35m[INFO]\x1b[0m Automatic Broadlink RM device discovery has been disabled as the "hosts" option has been set.`)}

    assert(Array.isArray(hosts), `\x1b[31m[CONFIG ERROR] \x1b[33mhosts\x1b[0m should be an array of objects.`);

    hosts.forEach((host) => {
      assert(host && typeof host === 'object', `\x1b[31m[CONFIG ERROR] \x1b[0m Each item in the \x1b[33mhosts\x1b[0m array should be an object.`);

      const { address, isRFSupported, isRM4, mac, port } = host;
      assert(address, `\x1b[31m[CONFIG ERROR] \x1b[0m Each object in the \x1b[33mhosts\x1b[0m option should contain a value for \x1b[33maddress\x1b[0m (e.g. "192.168.1.23").`);
      assert(mac, `\x1b[31m[CONFIG ERROR] \x1b[0m Each object in the \x1b[33mhosts\x1b[0m option should contain a unique value for \x1b[33mmac\x1b[0m (e.g. "34:ea:34:e7:d7:28").`);

      const options = {};
      for (const k of CONNECTION_OPTIONS) {
        if (host[k] !== undefined) {options[k] = host[k];}
      }

      // The device is asked for its real type and MAC first; the isRM4 /
      // isRFSupported flags are only a fallback if it doesn't answer.
      broadlink.addManualHost({ address, mac, port: port || 80, isRM4, isRFSupported, options })
        .catch((err) => log(`\x1b[31m[ERROR]\x1b[0m Could not add host ${address}: ${err.message}`));
    });
  }

  showMessage () {
    const { log } = this;
    log(`\x1b[35m[INFO]\x1b[0m ${npmPackage.displayName} ${npmPackage.version}`);
  }
}

BroadlinkRMPlatform.setHomebridge = (homebridge) => {
  homebridgeRef = homebridge
}

module.exports = BroadlinkRMPlatform
