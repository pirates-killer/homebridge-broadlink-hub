'use strict';

// A small UDP BroadLink RM simulator for tests and local Homebridge runs.
// Behaviour knobs let tests reproduce real-world failure modes: dropped
// replies, reboot (session key lost -> error -7), locked devices.

const dgram = require('dgram');
const crypto = require('crypto');
const P = require('../../lib/broadlink/protocol');

class RMSimulator {
  constructor({ devtype = 0x520b, mac = '34ea345ac0de', rm4 = true, locked = false, host = '127.0.0.1', port = 0 } = {}) {
    Object.assign(this, { devtype, rm4, locked, host, port });
    this.mac = Buffer.from(mac, 'hex');
    this.sessions = new Map(); // id hex -> key
    this.sent = []; // codes received via SEND_DATA
    this.learned = null; // code returned by CHECK_DATA
    this.sensor = null; // { temperature, humidity } or null (=> -4)
    this.dropNext = 0; // drop this many incoming requests (never executed)
    this.muteNext = 0; // execute, but don't reply to this many (lost reply)
    this.replyDelay = 0; // ms before replying
    this.lenient = false; // accept any RM4 length field (benchmarking old clients)
    this.requests = []; // { command, devtype, count, sub, t }
  }

  start() {
    this.socket = dgram.createSocket('udp4');
    this.socket.on('message', (m, r) => this._onMessage(m, r));
    return new Promise((resolve) => this.socket.bind(this.port, this.host, () => {
      this.port = this.socket.address().port;
      resolve(this);
    }));
  }

  stop() {
    return new Promise((resolve) => this.socket.close(resolve));
  }

  reboot() {
    this.sessions.clear();
  }

  _reply(rinfo, command, count, error, payload, key) {
    if (command === P.CMD.COMMAND_REPLY && this.muteNext > 0) {this.muteNext -= 1; return;}
    if (this.replyDelay) {
      const delay = this.replyDelay;
      setTimeout(() => this._replyNow(rinfo, command, count, error, payload, key), delay);
      return;
    }
    this._replyNow(rinfo, command, count, error, payload, key);
  }

  _replyNow(rinfo, command, count, error, payload, key) {
    const header = Buffer.alloc(0x38);
    P.MAGIC.copy(header, 0);
    header.writeInt16LE(error, 0x22);
    header.writeUInt16LE(this.devtype, 0x24);
    header[0x26] = command;
    header.writeUInt16LE(count, 0x28);
    let body = Buffer.alloc(0);
    if (payload && payload.length) {
      const pad = (16 - (payload.length % 16)) % 16;
      body = P.aes('enc', key, Buffer.concat([payload, Buffer.alloc(pad)]));
    }
    const pkt = Buffer.concat([header, body]);
    pkt.writeUInt16LE(P.checksum(pkt), 0x20);
    try {this.socket.send(pkt, rinfo.port, rinfo.address);} catch { /* stopped */ }
  }

  _onMessage(msg, rinfo) {
    if (msg.length === 0x30 && msg[0x26] === P.CMD.HELLO) {
      const r = Buffer.alloc(0x80);
      r[0x26] = P.CMD.HELLO_REPLY;
      r.writeUInt16LE(this.devtype, 0x34);
      Buffer.from(this.mac).reverse().copy(r, 0x3a);
      r.write('Sim RM', 0x40);
      r[0x7f] = this.locked ? 1 : 0;
      this.socket.send(r, rinfo.port, rinfo.address);
      return;
    }
    if (msg.length < 0x38) {return;}
    if (this.dropNext > 0) {this.dropNext -= 1; return;}

    const command = msg[0x26];
    const count = msg.readUInt16LE(0x28);
    const idHex = msg.subarray(0x30, 0x34).toString('hex');
    const req = { command, devtype: msg.readUInt16LE(0x24), count, t: performance.now() };
    this.requests.push(req);

    if (command === P.CMD.AUTH) {
      if (this.locked) {return this._reply(rinfo, P.CMD.AUTH_REPLY, count, -1, null);}
      const id = crypto.randomBytes(4);
      const key = crypto.randomBytes(16);
      this.sessions.set(id.toString('hex'), key);
      return this._reply(rinfo, P.CMD.AUTH_REPLY, count, 0, Buffer.concat([id, key, Buffer.alloc(12)]), P.DEFAULT_KEY);
    }
    if (command !== P.CMD.COMMAND) {return;}

    const key = this.sessions.get(idHex);
    if (!key) {return this._reply(rinfo, P.CMD.COMMAND_REPLY, count, -7, null);}
    const payload = P.aes('dec', key, msg.subarray(0x38));
    let { subcommand, data } = P.unframeRM(this.rm4, payload);
    if (this.rm4) {this.lastLengthField = payload.readUInt16LE(0);}
    if (this.lenient && this.rm4) {data = payload.subarray(6);}
    req.sub = subcommand;

    const ok = (out = Buffer.alloc(0)) => this._reply(rinfo, P.CMD.COMMAND_REPLY, count, 0, P.frameRM(this.rm4, subcommand, out), key);
    const fail = (code) => this._reply(rinfo, P.CMD.COMMAND_REPLY, count, code, null);

    switch (subcommand) {
      case P.RM.SEND_DATA:
        this.sent.push(data.toString('hex'));
        this.sentAt = this.sentAt || [];
        this.sentAt.push(req.t);
        return ok();
      case P.RM.ENTER_LEARNING:
      case P.RM.CANCEL_SWEEP:
      case P.RM.SWEEP_FREQUENCY:
        return ok();
      case P.RM.CHECK_DATA:
        return this.learned ? ok(Buffer.from(this.learned, 'hex')) : fail(-10);
      case P.RM.CHECK_FREQUENCY:
      case P.RM.FIND_RF_PACKET:
        return ok(Buffer.from([1]));
      case P.RM.CHECK_SENSORS:
      case P.RM.CHECK_TEMPERATURE: {
        if (!this.sensor) {return fail(-4);}
        const t = this.sensor.temperature;
        const out = Buffer.alloc(4);
        out.writeInt8(Math.trunc(t), 0);
        out.writeInt8(Math.round((t - Math.trunc(t)) * (this.rm4 ? 100 : 10)), 1);
        out[2] = Math.trunc(this.sensor.humidity || 0);
        out[3] = Math.round(((this.sensor.humidity || 0) % 1) * 100);
        return ok(out);
      }
      default:
        return fail(-4);
    }
  }
}

module.exports = RMSimulator;

// `node test/sim/rmSimulator.js [port]` runs a standalone simulator.
if (require.main === module) {
  const sim = new RMSimulator({ port: Number(process.argv[2] || 0) });
  sim.learned = '26001a001d1d1d1d1d3a1d3a1d3a000d05';
  sim.start().then(() => {
    console.log(`RM simulator on ${sim.host}:${sim.port} (devtype 0x${sim.devtype.toString(16)})`);
    const origPush = sim.sent.push.bind(sim.sent);
    sim.sent.push = (c) => {console.log('IR/RF code received:', c); return origPush(c);};
  });
}
