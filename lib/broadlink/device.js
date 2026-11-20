'use strict';

const dgram = require('dgram');
const dns = require('dns').promises;
const net = require('net');
const { EventEmitter } = require('events');
const P = require('./protocol');
const { lookup } = require('./deviceTypes');

class DeviceError extends Error {
  constructor(code, command) {
    super(`${P.ERRORS[code] || 'Device error'} (${code}) for command 0x${command.toString(16)}`);
    this.code = code;
  }
}

class TimeoutError extends Error {
  constructor(ms) {
    super(`No reply within ${ms} ms`);
    this.code = 'ETIMEDOUT';
  }
}

const formatMac = (mac) => [...mac].map((b) => b.toString(16).padStart(2, '0')).join(':');

/**
 * One BroadLink RM device.
 *
 * Control model (from the official SDK, tuned for latency):
 * - one request in flight per device; each waits for its reply, which is matched
 *   by the echoed packet counter (verified on RM4 Pro firmware), so a late reply
 *   can never be credited to the next command;
 * - the reply timeout adapts to the measured round trip (RFC 6298 style,
 *   clamped to [floor, timeout]); the official SDK uses a fixed 2000 ms, which
 *   is ~100x a real LAN round trip and stalls the queue for 2 s on a lost reply;
 * - codes are sent once (SDK sendcount = 1). With retries > 0 the *identical*
 *   packet (same counter) is resent, like python-broadlink;
 * - an authorisation error means the device rejected the command, so we
 *   re-authenticate and resend it;
 * - the session is kept warm by a cheap authenticated keepalive, so a reboot is
 *   noticed and re-authenticated in the background instead of on the next tap.
 *
 * kiwicam-broadlinkjs-rm method/event names are kept (sendData, enterLearning,
 * checkData, 'rawData', 'temperature', ...) so existing accessories work as-is.
 */
class RMDevice extends EventEmitter {
  constructor({ address, port = 80, mac, devtype, family, log = () => {}, debug = false,
    timeout = 2000, retries = 0, sendGap = 0, monitorInterval = 30000, adaptiveTimeout = true }) {
    super();
    this.setMaxListeners(0);

    const info = lookup(devtype) || family || { model: `Unknown (0x${devtype.toString(16)})`, rm4: false, rf: false };
    this.host = { address, port, macAddress: formatMac(mac) };
    this.mac = Buffer.from(mac);
    this.type = devtype;
    this.model = info.model;
    this.rm4 = Boolean(info.rm4);
    this.rf = Boolean(info.rf);
    this.log = log;
    this.debug = debug;
    this.timeout = timeout;
    this.retries = retries;
    this.sendGap = sendGap;
    this.monitorInterval = monitorInterval;
    this.adaptiveTimeout = adaptiveTimeout;

    this.state = 'unknown';
    this.authenticated = false;
    this.key = P.DEFAULT_KEY;
    this.id = Buffer.alloc(4);
    this.count = Math.floor(Math.random() * 0xffff);
    this.missed = 0;
    this.stats = { requests: 0, timeouts: 0, reauths: 0, lastRtt: null };

    this._rtt = { send: null, ctl: null }; // { srtt, rttvar } per request class
    this._strictCount = false; // set once the device proves it echoes counters
    this._readyEmitted = false;
    this._queue = Promise.resolve();
    this._depth = 0;
    this._pending = null;
    this._lastTx = 0;
    this._closed = false;

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket.on('message', (msg, rinfo) => this._onMessage(msg, rinfo));
    this.socket.on('error', (err) => this.log(`\x1b[31m[ERROR]\x1b[0m ${this.host.address} socket: ${err.message}`));
    // Bind once and resolve a hostname once; replies are filtered by IP.
    this._bound = Promise.all([
      new Promise((resolve) => this.socket.bind(0, resolve)),
      net.isIP(address) ? address : dns.lookup(address, { family: 4 }).then((r) => r.address, () => address),
    ]).then(([, ip]) => {this._ip = ip;});
    this.socket.unref();

    if (!this.rf) {
      // Accessories feature-detect RF support by method presence.
      this.enterRFSweep = undefined;
      this.checkRFData = undefined;
      this.checkRFData2 = undefined;
    }
  }

  // ---------------------------------------------------------------- transport

  _onMessage(msg, rinfo) {
    if (rinfo.address !== (this._ip || this.host.address)) {return;}

    if (msg.length >= 0x30 && msg[0x26] === P.CMD.HELLO_REPLY) {
      this._markAlive();
      return;
    }

    const pending = this._pending;
    if (!pending) {return;}
    const decoded = P.decodePacket(msg, pending.key);
    if (!decoded || decoded.command !== pending.expect) {return;}
    if (decoded.count !== pending.count && this._strictCount) {return;}
    if (pending.expect === P.CMD.AUTH_REPLY) {this._strictCount = decoded.count === pending.count;}

    this._pending = null;
    clearTimeout(pending.timer);
    this._markAlive();
    pending.resolve(decoded);
  }

  _markAlive() {
    this.missed = 0;
    if (this.state === 'active') {return;}
    const wasInactive = this.state === 'inactive';
    this.state = 'active';
    if (wasInactive) {
      this.log(`\x1b[35m[INFO]\x1b[0m Broadlink RM device at ${this.host.address} (${this.host.macAddress}) is reachable again.`);
      // It most likely rebooted: get a fresh session now, not on the next tap.
      this.authenticated = false;
      this.authenticate().catch(() => {});
    }
  }

  _markMissed() {
    this.missed += 1;
    this.stats.timeouts += 1;
    if (this.missed >= 3 && this.state !== 'inactive') {
      this.state = 'inactive';
      this.log(`\x1b[33m[WARNING]\x1b[0m Broadlink RM device at ${this.host.address} (${this.host.macAddress}) is not responding.`);
    }
  }

  /** Reply timeout for a request class: learned from round trips, clamped. */
  _timeoutFor(kind) {
    const r = this._rtt[kind];
    if (!this.adaptiveTimeout || !r || kind === 'auth') {return this.timeout;}
    const floor = kind === 'send' ? 400 : 250;
    return Math.round(Math.min(this.timeout, Math.max(floor, r.srtt + 4 * r.rttvar)));
  }

  _sampleRtt(kind, ms) {
    this.stats.lastRtt = ms;
    if (kind === 'auth') {return;}
    const r = this._rtt[kind];
    if (!r) {
      this._rtt[kind] = { srtt: ms, rttvar: ms / 2 };
    } else {
      r.rttvar = 0.75 * r.rttvar + 0.25 * Math.abs(r.srtt - ms);
      r.srtt = 0.875 * r.srtt + 0.125 * ms;
    }
  }

  _build(command, payload, key) {
    this.count = (this.count + 1) & 0xffff;
    const packet = P.encodePacket({
      devtype: this.type, command, count: this.count, mac: this.mac, id: this.id, key, payload,
    });
    return { packet, count: this.count, command, key };
  }

  /** Send a built packet and wait for its reply. */
  async _exchange({ packet, count, command, key }, kind) {
    await this._bound;
    const gap = this.sendGap - (Date.now() - this._lastTx);
    if (gap > 0) {await new Promise((r) => setTimeout(r, gap));}

    const expect = command === P.CMD.AUTH ? P.CMD.AUTH_REPLY : P.CMD.COMMAND_REPLY;
    const ms = this._timeoutFor(kind);
    this.stats.requests += 1;

    return new Promise((resolve, reject) => {
      const t0 = process.hrtime.bigint();
      const timer = setTimeout(() => {
        this._pending = null;
        reject(new TimeoutError(ms));
      }, ms);
      this._pending = {
        expect, key, count, timer,
        resolve: (reply) => {
          const rtt = Number(process.hrtime.bigint() - t0) / 1e6;
          this._sampleRtt(kind, rtt);
          if (this.debug) {this.log(`\x1b[33m[DEBUG]\x1b[0m ${this.host.address} <- 0x${reply.command.toString(16)} #${count} err=${reply.error} ${rtt.toFixed(1)} ms`);}
          resolve(reply);
        },
      };
      this._lastTx = Date.now();
      this.socket.send(packet, this.host.port, this._ip, (err) => {
        if (!err) {return;}
        clearTimeout(timer);
        this._pending = null;
        reject(err);
      });
    });
  }

  /** Serialise work on this device. */
  _enqueue(fn) {
    this._depth += 1;
    const run = this._queue.then(fn, fn).finally(() => {this._depth -= 1;});
    this._queue = run.catch(() => {});
    return run;
  }

  async _authenticateNow() {
    this.key = P.DEFAULT_KEY;
    this.id = Buffer.alloc(4);
    let reply;
    try {
      reply = await this._exchange(this._build(P.CMD.AUTH, P.buildAuthPayload(), P.DEFAULT_KEY), 'auth');
    } catch (err) {
      if (err.code === 'ETIMEDOUT') {this._markMissed();}
      throw err;
    }
    if (reply.error !== 0) {throw new DeviceError(reply.error, P.CMD.AUTH);}
    const auth = P.parseAuthReply(reply.payload);
    if (!auth) {throw new Error('Malformed auth reply');}
    this.id = auth.id;
    this.key = auth.key;
    this.authenticated = true;
    if (!this._readyEmitted) {
      this._readyEmitted = true;
      this.emit('deviceReady', this);
    }
  }

  authenticate() {
    return this._enqueue(() => (this.authenticated ? undefined : this._authenticateNow()));
  }

  /**
   * Send an RM sub-command and return the unframed reply data.
   * @param {object} opts  retries: resends of the identical packet after a timeout
   */
  rmCommand(subcommand, data = Buffer.alloc(0), { retries = 0 } = {}) {
    if (this._closed) {return Promise.reject(new Error('Device closed'));}
    const kind = subcommand === P.RM.SEND_DATA ? 'send' : 'ctl';
    return this._enqueue(async () => {
      const payload = P.frameRM(this.rm4, subcommand, data);
      let reauthed = false;
      let built = null;
      for (let attempt = 0; ;) {
        try {
          if (!this.authenticated) {
            await this._authenticateNow();
            built = null;
          }
          built = built || this._build(P.CMD.COMMAND, payload, this.key);
          const reply = await this._exchange(built, kind);
          if (P.AUTH_ERRORS.has(reply.error) && !reauthed) {
            // Rejected before execution, so resending is safe.
            reauthed = true;
            this.stats.reauths += 1;
            this.authenticated = false;
            continue;
          }
          if (reply.error !== 0) {throw new DeviceError(reply.error, subcommand);}
          return P.unframeRM(this.rm4, reply.payload).data;
        } catch (err) {
          if (err.code !== 'ETIMEDOUT') {throw err;}
          this._markMissed();
          if (attempt >= retries) {
            // Check the session in the background so the next command is fast.
            setImmediate(() => this._keepalive());
            throw err;
          }
          attempt += 1;
        }
      }
    });
  }

  // ---------------------------------------------------------------- liveness

  /**
   * Cheap authenticated round trip (sensor query). Any reply proves the device
   * is alive; an auth error triggers a re-auth inside rmCommand; -4 (no sensor)
   * still proves the session is valid.
   */
  async _keepalive() {
    if (this._closed || this._depth > 0) {return;} // busy: real traffic proves liveness
    if (!this.authenticated) {
      await this.authenticate().catch(() => {});
      return;
    }
    const sub = this.rm4 ? P.RM.CHECK_SENSORS : P.RM.CHECK_TEMPERATURE;
    await this.rmCommand(sub).catch((err) => {
      if (err.code === 'ETIMEDOUT') {this.authenticated = false;} // re-auth on the next tick
    });
  }

  startMonitoring() {
    if (this._monitor || !this.monitorInterval) {return;}
    this._monitor = setInterval(() => this._keepalive(), this.monitorInterval);
    this._monitor.unref();
  }

  close() {
    this._closed = true;
    clearInterval(this._monitor);
    try {this.socket.close();} catch { /* already closed */ }
  }

  // ------------------------------------------------- legacy (kiwicam) facade

  _quiet(promise, what, silent = [-10]) {
    return promise.catch((err) => {
      if (silent.includes(err.code)) {return null;} // e.g. -10: nothing learned yet (normal while polling)
      if (this.debug || err.code !== 'ETIMEDOUT') {
        this.log(`\x1b[31m[ERROR]\x1b[0m ${this.host.address} ${what}: ${err.message}`);
      }
      return null;
    });
  }

  /** Send an IR/RF code. Resolves true when the device acknowledged it. */
  async sendData(data) {
    try {
      await this.rmCommand(P.RM.SEND_DATA, data, { retries: this.retries });
      return true;
    } catch (err) {
      this.log(`\x1b[31m[ERROR]\x1b[0m ${this.host.address} (${this.host.macAddress}) code not acknowledged: ${err.message}`);
      return false;
    }
  }

  enterLearning() {
    return this._quiet(this.rmCommand(P.RM.ENTER_LEARNING), 'enterLearning');
  }

  cancelLearn() {
    return this._quiet(this.rmCommand(P.RM.CANCEL_SWEEP), 'cancelLearn');
  }

  async checkData() {
    const data = await this._quiet(this.rmCommand(P.RM.CHECK_DATA), 'checkData');
    if (data && data.length && data.some((b) => b !== 0)) {this.emit('rawData', data);}
    return data;
  }

  async checkTemperature() {
    const sub = this.rm4 ? P.RM.CHECK_SENSORS : P.RM.CHECK_TEMPERATURE;
    // -4: model has no sensor (e.g. RM mini without the sensor cable)
    const data = await this._quiet(this.rmCommand(sub), 'checkTemperature', [-4, -10]);
    if (!data || data.length < 2) {return null;}
    let temperature;
    let humidity;
    if (this.rm4) {
      temperature = data.readInt8(0) + data.readInt8(1) / 100; // signed, as python-broadlink
      if (data.length >= 4) {humidity = data[2] + data[3] / 100;}
    } else {
      temperature = data.readInt8(0) + data.readInt8(1) / 10; // signed, as python-broadlink
    }
    this.emit('temperature', temperature, humidity);
    return { temperature, humidity };
  }

  checkHumidity() {
    return this.checkTemperature();
  }

  enterRFSweep() {
    return this._quiet(this.rmCommand(P.RM.SWEEP_FREQUENCY), 'enterRFSweep');
  }

  async checkRFData() {
    const data = await this._quiet(this.rmCommand(P.RM.CHECK_FREQUENCY), 'checkRFData');
    if (data && data[0] === 1) {this.emit('rawRFData', data.subarray(0, 1));}
    return data;
  }

  async checkRFData2() {
    const data = await this._quiet(this.rmCommand(P.RM.FIND_RF_PACKET), 'checkRFData2');
    if (data && (data[0] === 1 || this.rm4)) {this.emit('rawRFData2', data.subarray(0, 1));}
    return data;
  }
}

module.exports = { RMDevice, DeviceError, TimeoutError, formatMac };
