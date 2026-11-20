'use strict';

const dgram = require('dgram');
const os = require('os');
const { EventEmitter } = require('events');
const P = require('./protocol');
const types = require('./deviceTypes');
const { RMDevice, formatMac } = require('./device');

const UNSUPPORTED = new Set([
  0x0000, 0x2711, 0x2719, 0x7919, 0x271a, 0x791a, 0x2733, 0x273e, 0x2720, 0x7d07,
  0x753e, 0x2728, 0x2736, 0x2714, 0x4eb5, 0x2722, 0x4e4d, 0x4ead, 0x947a,
]);
const isUnsupported = (t) => UNSUPPORTED.has(t) || (t >= 0x7530 && t <= 0x7918);

const localIPv4 = () => Object.values(os.networkInterfaces()).flat()
  .filter((a) => a && (a.family === 'IPv4' || a.family === 4) && !a.internal)
  .map((a) => a.address);

/**
 * Registry + discovery for RM devices.
 * Emits 'deviceReady' (device) once a device has authenticated.
 */
class Broadlink extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
    this.devices = new Map(); // mac hex -> RMDevice | 'unsupported'
    this.log = () => {};
    this.debug = false;
    this.deviceOptions = {};
  }

  /** Broadcast a hello on every local interface. */
  discover(timeoutMs = 2000) {
    for (const ip of localIPv4()) {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      socket.on('error', () => socket.close());
      socket.on('message', (msg, rinfo) => {
        const hello = P.parseHelloReply(msg);
        if (hello) {this._onHello(hello, { address: rinfo.address, port: 80 });}
      });
      socket.bind(0, ip, () => {
        socket.setBroadcast(true);
        if (this.debug) {this.log(`\x1b[35m[INFO]\x1b[0m Listening for Broadlink devices on ${ip}:${socket.address().port} (UDP)`);}
        socket.send(P.buildHello(ip, socket.address().port), 80, '255.255.255.255', () => {});
      });
      setTimeout(() => {try {socket.close();} catch { /* closed */ }}, timeoutMs).unref();
    }
  }

  /** Unicast hello to one address. Resolves the parsed reply or null. */
  probe(address, port = 80, timeoutMs = 1000) {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const done = (v) => {clearTimeout(t); try {socket.close();} catch { /* closed */ } resolve(v);};
      const t = setTimeout(() => done(null), timeoutMs);
      socket.on('error', () => done(null));
      socket.on('message', (msg, rinfo) => {
        if (rinfo.address !== address) {return;}
        const hello = P.parseHelloReply(msg);
        if (hello) {done(hello);}
      });
      socket.bind(0, () => socket.send(P.buildHello('0.0.0.0', socket.address().port), port, address, () => {}));
    });
  }

  _onHello(hello, host) {
    if (hello.isLocked) {
      this.log(`\x1b[33m[WARNING]\x1b[0m Broadlink device at ${host.address} (${formatMac(hello.mac)}) is locked. Turn off "Lock device" in the BroadLink app or it will refuse local control.`);
    }
    this.addDevice(host, hello.mac, hello.devtype, { name: hello.name });
  }

  /**
   * Register a device. `family` lets a hand-configured host override the
   * capabilities of a device type that isn't in our table.
   */
  addDevice(host, mac, devtype, { family } = {}) {
    const macBuf = Buffer.isBuffer(mac) ? mac : Buffer.from(String(mac).replace(/[:-]/g, ''), 'hex');
    const key = macBuf.toString('hex');
    if (this.devices.has(key)) {return this.devices.get(key);}

    if (isUnsupported(devtype)) {
      this.devices.set(key, 'unsupported');
      return null;
    }
    if (!types.lookup(devtype) && !family) {
      this.devices.set(key, 'unsupported');
      this.log(`\x1b[35m[INFO]\x1b[0m Ignoring unknown Broadlink device type 0x${devtype.toString(16)} at ${host.address}. If it is an RM, add it to "hosts" with "isRM4"/"isRFSupported" set.`);
      return null;
    }

    const device = new RMDevice({
      address: host.address, port: host.port || 80, mac: macBuf, devtype, family,
      log: this.log, debug: this.debug, ...this.deviceOptions, ...(host.options || {}),
    });
    this.devices.set(key, device);
    // Usable immediately: commands queue behind the first login instead of
    // being dropped while the plugin starts.
    this.emit('deviceAdded', device);
    device.once('deviceReady', () => this.emit('deviceReady', device));
    device.startMonitoring();
    this._authLoop(device);
    return device;
  }

  /** Keep trying to authenticate with backoff (device may be offline at boot). */
  async _authLoop(device, delay = 1000) {
    try {
      await device.authenticate();
    } catch (err) {
      if (this.debug) {this.log(`\x1b[33m[DEBUG]\x1b[0m auth ${device.host.address} failed: ${err.message}; retrying in ${delay / 1000}s`);}
      const t = setTimeout(() => this._authLoop(device, Math.min(delay * 2, 60000)), delay);
      t.unref();
    }
  }

  /**
   * Add a hand-configured host. Asks the device for its real type first,
   * falling back to a synthetic type built from the config flags.
   */
  async addManualHost({ address, mac, port = 80, isRM4 = false, isRFSupported = false, options }) {
    const hello = await this.probe(address, port);
    const family = { model: 'Manual RM Device', rm4: Boolean(isRM4), rf: Boolean(isRFSupported) };
    if (hello) {
      if (hello.isLocked) {
        this.log(`\x1b[33m[WARNING]\x1b[0m Broadlink device at ${address} (${formatMac(hello.mac)}) is locked. Turn off "Lock device" in the BroadLink app or it will refuse local control.`);
      }
      const configuredMac = mac && mac.replace(/[:-]/g, '').toLowerCase();
      const realMac = hello.mac.toString('hex');
      if (configuredMac && configuredMac !== realMac) {
        this.log(`\x1b[33m[WARNING]\x1b[0m ${address} reports MAC ${formatMac(hello.mac)} but config says ${mac}; using the device's.`);
      }
      return this.addDevice({ address, port, options }, hello.mac, hello.devtype, { family });
    }
    this.log(`\x1b[33m[WARNING]\x1b[0m ${address} did not answer discovery; using configured flags (isRM4=${isRM4}, isRFSupported=${isRFSupported}).`);
    return this.addDevice({ address, port, options }, mac, types.manualType({ isRM4, isRFSupported }), { family });
  }

  close() {
    for (const d of this.devices.values()) {if (d && d.close) {d.close();}}
    this.devices.clear();
  }
}

module.exports = { Broadlink, RMDevice, protocol: P, deviceTypes: types };
