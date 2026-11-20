'use strict';

// Code learning flows, shared by the settings UI (and usable by accessories).
// Each flow reports progress through onStage(stage, info) and resolves with
// the learned code as a hex string, or null when cancelled / timed out.

const P = require('./protocol');

const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  if (signal) {signal.addEventListener('abort', () => {clearTimeout(t); resolve();}, { once: true });}
});

const isNothingYet = (err) => err && (err.code === -10 || err.code === -5);

/** Poll CHECK_DATA until a code arrives. */
const pollCode = async (device, { signal, timeoutMs, intervalMs }) => {
  const end = Date.now() + timeoutMs;
  while (!signal?.aborted && Date.now() < end) {
    try {
      const data = await device.rmCommand(P.RM.CHECK_DATA);
      if (data && data.length && data.some((b) => b !== 0)) {return data.toString('hex');}
    } catch (err) {
      if (!isNothingYet(err) && err.code !== 'ETIMEDOUT') {throw err;}
    }
    await sleep(intervalMs, signal);
  }
  return null;
};

/**
 * Learn an infrared code: point the remote at the RM and press the button.
 * Stages: 'ready' -> 'code' | 'timeout' | 'cancelled'
 */
const learnIR = async (device, { signal, timeoutMs = 30000, intervalMs = 400, onStage = () => {} } = {}) => {
  await device.rmCommand(P.RM.ENTER_LEARNING);
  onStage('ready', { message: 'Point the remote at the BroadLink and press the button once.' });
  const hex = await pollCode(device, { signal, timeoutMs, intervalMs });
  if (hex) {onStage('code', { hex }); return hex;}
  await device.rmCommand(P.RM.CANCEL_SWEEP).catch(() => {});
  onStage(signal?.aborted ? 'cancelled' : 'timeout', {});
  return null;
};

/**
 * Learn a radio (RF 315/433 MHz) code. RF models only.
 * Stages: 'sweeping' (hold the button) -> 'frequency' -> 'press' (short press)
 *         -> 'code' | 'timeout' | 'cancelled'
 */
const learnRF = async (device, { signal, sweepTimeoutMs = 30000, codeTimeoutMs = 20000, intervalMs = 500, onStage = () => {} } = {}) => {
  if (!device.rf) {throw new Error(`${device.model} has no RF radio`);}
  try {
    await device.rmCommand(P.RM.SWEEP_FREQUENCY);
    onStage('sweeping', { message: 'Hold the remote close to the BroadLink and keep the button pressed.' });

    let frequency = null;
    const end = Date.now() + sweepTimeoutMs;
    while (!signal?.aborted && Date.now() < end && frequency === null) {
      try {
        const d = await device.rmCommand(P.RM.CHECK_FREQUENCY);
        if (d && d[0] === 1) {frequency = d.length >= 5 ? d.readUInt32LE(1) / 1000 : 0;}
      } catch (err) {
        if (err.code !== 'ETIMEDOUT') {throw err;}
      }
      if (frequency === null) {await sleep(intervalMs, signal);}
    }
    if (frequency === null) {
      onStage(signal?.aborted ? 'cancelled' : 'timeout', { message: 'No radio signal found.' });
      return null;
    }
    onStage('frequency', { mhz: frequency || null, message: frequency ? `Found ${frequency.toFixed(2)} MHz. Release the button.` : 'Frequency found. Release the button.' });

    await sleep(1000, signal);
    const payload = Buffer.alloc(frequency ? 4 : 0);
    if (frequency) {payload.writeUInt32LE(Math.round(frequency * 1000), 0);}
    await device.rmCommand(P.RM.FIND_RF_PACKET, payload);
    onStage('press', { message: 'Now press the button briefly, once.' });

    const hex = await pollCode(device, { signal, timeoutMs: codeTimeoutMs, intervalMs });
    if (hex) {onStage('code', { hex, mhz: frequency || null}); return hex;}
    onStage(signal?.aborted ? 'cancelled' : 'timeout', {});
    return null;
  } finally {
    await device.rmCommand(P.RM.CANCEL_SWEEP).catch(() => {});
  }
};

module.exports = { learnIR, learnRF };
