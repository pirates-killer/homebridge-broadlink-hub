// Accepts the code formats people actually have and returns BroadLink hex:
// - BroadLink hex (what this plugin stores), with or without spaces / 0x
// - base64 BroadLink packets (Home Assistant, SmartIR code files)
// - Pronto hex ("0000 006C 0022 ...")

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const convertProntoCode = require('../helpers/convertProntoCode');

const BROADLINK_FIRST_BYTES = [0x26, 0xb2, 0xd7]; // IR, RF 433 MHz, RF 315 MHz

export function normaliseCode(text) {
  const raw = String(text ?? '').trim();
  if (!raw) {return { ok: false, error: 'empty' };}

  const words = raw.split(/[\s,]+/).filter(Boolean);
  if (words.length >= 6 && words[0] === '0000' && words.every((w) => /^[0-9a-f]{4}$/i.test(w))) {
    const hex = convertProntoCode(words.join(' ').toLowerCase(), () => {});
    return hex ? { ok: true, hex, format: 'pronto' } : { ok: false, error: 'that looks like a Pronto code but it is not valid' };
  }

  const compact = raw.replace(/0x/gi, '').replace(/[\s,:]/g, '');
  if (/^[0-9a-f]+$/i.test(compact) && compact.length % 2 === 0 && compact.length >= 8) {
    return { ok: true, hex: compact.toLowerCase(), format: 'hex' };
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    const buf = Buffer.from(raw.replace(/\s/g, ''), 'base64');
    if (buf.length >= 4 && BROADLINK_FIRST_BYTES.includes(buf[0])) {
      return { ok: true, hex: buf.toString('hex'), format: 'base64' };
    }
  }
  return { ok: false, error: 'not a BroadLink hex, base64 or Pronto code' };
}
