'use strict';

// BroadLink local (LAN) protocol codec.
//
// Packet layout matches what the official BroadLink SDK (libNetworkAPI.so) and
// python-broadlink use: a 0x38-byte plaintext header followed by an
// AES-128-CBC encrypted payload. Both header and payload carry 0xBEAF-seeded
// 16-bit checksums, which we validate on receive (the official SDK logs
// "Checksum Fail" / "AES Checksum Fail" and drops such frames).

const crypto = require('crypto');

const MAGIC = Buffer.from('5aa5aa555aa5aa55', 'hex');
const DEFAULT_KEY = Buffer.from('097628343fe99e23765c1513accf8b02', 'hex');
const IV = Buffer.from('562e17996d093d28ddb3ba695a2e6f58', 'hex');

const CMD = Object.freeze({
  HELLO: 0x06,
  HELLO_REPLY: 0x07,
  AUTH: 0x65,
  AUTH_REPLY: 0xe9,
  COMMAND: 0x6a,
  COMMAND_REPLY: 0xee,
});

// RM sub-commands carried inside a 0x6a COMMAND payload.
const RM = Object.freeze({
  SEND_DATA: 0x02,
  ENTER_LEARNING: 0x03,
  CHECK_DATA: 0x04,
  CHECK_TEMPERATURE: 0x01, // RM2/RM3
  CHECK_SENSORS: 0x24, // RM4
  SWEEP_FREQUENCY: 0x19,
  CHECK_FREQUENCY: 0x1a,
  FIND_RF_PACKET: 0x1b,
  CANCEL_SWEEP: 0x1e,
});

// Device error codes (signed int16 at header offset 0x22).
const ERRORS = Object.freeze({
  [-1]: 'Authentication failed',
  [-2]: 'Logged out',
  [-3]: 'Device offline',
  [-4]: 'Command not supported',
  [-5]: 'Storage full',
  [-6]: 'Structure abnormal',
  [-7]: 'Control key expired',
  [-8]: 'Send error',
  [-9]: 'Write error',
  [-10]: 'Read error / nothing learned yet',
  [-11]: 'SSID not found',
});
const AUTH_ERRORS = new Set([-1, -2, -7]);

const checksum = (buf) => {
  let sum = 0xbeaf;
  for (let i = 0; i < buf.length; i++) {sum += buf[i];}
  return sum & 0xffff;
};

const aes = (mode, key, data) => {
  const c = mode === 'enc'
    ? crypto.createCipheriv('aes-128-cbc', key, IV)
    : crypto.createDecipheriv('aes-128-cbc', key, IV);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(data), c.final()]);
};

const padTo16 = (buf) => {
  const pad = (16 - (buf.length % 16)) % 16;
  return pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf;
};

/** Build the broadcast/unicast discovery ("hello") packet. */
const buildHello = (localIp = '0.0.0.0', localPort = 0, now = new Date()) => {
  const p = Buffer.alloc(0x30);
  const tzHours = -now.getTimezoneOffset() / 60;
  p.writeInt32LE(Math.trunc(tzHours), 0x08);
  p.writeUInt16LE(now.getFullYear(), 0x0c);
  p[0x0e] = now.getMinutes();
  p[0x0f] = now.getHours();
  p[0x10] = now.getFullYear() % 100;
  p[0x11] = now.getDay();
  p[0x12] = now.getDate();
  p[0x13] = now.getMonth() + 1;
  const ip = localIp.split('.').map(Number);
  for (let i = 0; i < 4; i++) {p[0x18 + i] = ip[3 - i] || 0;}
  p.writeUInt16LE(localPort & 0xffff, 0x1c);
  p[0x26] = CMD.HELLO;
  p.writeUInt16LE(checksum(p), 0x20);
  return p;
};

/** Parse a discovery reply. Returns null for anything that isn't one. */
const parseHelloReply = (msg) => {
  if (msg.length < 0x40 || msg[0x26] !== CMD.HELLO_REPLY) {return null;}
  const devtype = msg.readUInt16LE(0x34);
  const mac = Buffer.from(msg.subarray(0x3a, 0x40)).reverse();
  let name = '';
  if (msg.length > 0x40) {
    const end = msg.indexOf(0, 0x40);
    name = msg.subarray(0x40, end === -1 ? Math.min(msg.length, 0x7f) : Math.min(end, 0x7f)).toString('utf8');
  }
  const isLocked = msg.length > 0x7f ? Boolean(msg[0x7f]) : false;
  return { devtype, mac, name, isLocked };
};

/** Encrypt + frame an outgoing request. `mac` is in display order (aa:bb:...). */
const encodePacket = ({ devtype, command, count, mac, id, key, payload = Buffer.alloc(0) }) => {
  const header = Buffer.alloc(0x38);
  MAGIC.copy(header, 0);
  header.writeUInt16LE(devtype & 0xffff, 0x24);
  header[0x26] = command;
  header.writeUInt16LE(count & 0xffff, 0x28);
  for (let i = 0; i < 6; i++) {header[0x2a + i] = mac[5 - i];}
  id.copy(header, 0x30, 0, 4);
  header.writeUInt16LE(checksum(payload), 0x34);
  const packet = Buffer.concat([header, aes('enc', key, padTo16(payload))]);
  packet.writeUInt16LE(checksum(packet), 0x20);
  return packet;
};

/**
 * Decode a reply. Returns { command, count, error, payload } or null if the
 * frame is malformed / fails its checksum. `payload` is decrypted (may be
 * empty when the device reports an error).
 */
const decodePacket = (msg, key) => {
  if (msg.length < 0x38) {return null;}
  const sent = msg.readUInt16LE(0x20);
  const copy = Buffer.from(msg);
  copy.writeUInt16LE(0, 0x20);
  if (checksum(copy) !== sent) {return null;}

  const error = msg.readInt16LE(0x22);
  const command = msg[0x26];
  const count = msg.readUInt16LE(0x28);
  let payload = Buffer.alloc(0);
  const enc = msg.subarray(0x38);
  if (enc.length && enc.length % 16 === 0) {
    payload = aes('dec', key, enc);
  }
  return { command, count, error, payload };
};

/** Wrap an RM sub-command. RM4-family firmware expects a u16 length prefix. */
const frameRM = (rm4, subcommand, data = Buffer.alloc(0)) => {
  const head = Buffer.alloc(rm4 ? 6 : 4);
  if (rm4) {
    head.writeUInt16LE(data.length + 4, 0);
    head.writeUInt32LE(subcommand, 2);
  } else {
    head.writeUInt32LE(subcommand, 0);
  }
  return Buffer.concat([head, data]);
};

/** Strip the RM framing from a decrypted reply. Returns { subcommand, data }. */
const unframeRM = (rm4, payload) => {
  if (rm4) {
    if (payload.length < 6) {return { subcommand: null, data: Buffer.alloc(0) };}
    const len = payload.readUInt16LE(0);
    const end = Math.min(payload.length, len + 2);
    return { subcommand: payload.readUInt32LE(2), data: payload.subarray(6, Math.max(6, end)) };
  }
  if (payload.length < 4) {return { subcommand: null, data: Buffer.alloc(0) };}
  return { subcommand: payload.readUInt32LE(0), data: payload.subarray(4) };
};

/**
 * How long the RM is busy transmitting a code, in ms (estimate).
 * Codes are [type, repeat, len u16 LE, pulses…]; pulse units are 2^-15 s,
 * and `00 hi lo` encodes a long pulse. The IR repeat byte means extra frames;
 * RF codes' second byte is firmware-specific, so RF counts one frame.
 * Capped at MAX_AIRTIME_MS.
 */
const TICK_MS = 1000 / 32768;
const MAX_AIRTIME_MS = 3000;
const estimateAirtime = (code) => {
  if (!code || code.length < 5) {return 0;}
  const len = code.readUInt16LE(2);
  const end = Math.min(code.length, 4 + len);
  let units = 0;
  for (let i = 4; i < end; i++) {
    let v = code[i];
    if (v === 0 && i + 2 < end) {
      v = code.readUInt16BE(i + 1);
      i += 2;
    }
    units += v;
  }
  const frames = code[0] === 0x26 ? code[1] + 1 : 1;
  return Math.min(units * TICK_MS * frames, MAX_AIRTIME_MS);
};

const buildAuthPayload = () => {
  const p = Buffer.alloc(0x50);
  p.fill(0x31, 0x04, 0x14); // same client identity as python-broadlink / Home Assistant
  p[0x1e] = 0x01;
  p[0x2d] = 0x01;
  p.write('Test 1', 0x30, 'ascii');
  return p;
};

const parseAuthReply = (payload) => {
  if (payload.length < 0x14) {return null;}
  return { id: Buffer.from(payload.subarray(0, 4)), key: Buffer.from(payload.subarray(4, 20)) };
};

module.exports = {
  MAGIC, DEFAULT_KEY, IV, CMD, RM, ERRORS, AUTH_ERRORS,
  checksum, aes, buildHello, parseHelloReply, encodePacket, decodePacket,
  frameRM, unframeRM, buildAuthPayload, parseAuthReply, estimateAirtime, MAX_AIRTIME_MS,
};
