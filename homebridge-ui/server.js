// Backend of the BroadLink Hub settings page. Runs inside the Homebridge UI
// (admin login required), never inside the bridge. It talks to BroadLink
// devices on your LAN directly, with its own session, so it works while the
// bridge is running.

import { HomebridgePluginUiServer } from '@homebridge/plugin-ui-utils';
import { createRequire } from 'node:module';
import { normaliseCode } from './codes.js';

const require = createRequire(import.meta.url);
const { Broadlink, describe, learnIR, learnRF } = require('../lib/broadlink');

function reason(err) {
  if (err?.code === 'ETIMEDOUT') {return 'the BroadLink did not answer: check the IP address and that it is powered on';}
  if (err?.code === -1) {return 'the BroadLink refused to log in: it is probably locked. Turn off "Lock device" in the BroadLink app';}
  return err?.message || String(err);
}

class BroadlinkHubUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();
    this.bl = new Broadlink();
    this.bl.deviceOptions = { monitorInterval: 0 };
    this.learning = null;

    // "Find devices": broadcast plus a unicast sweep of the local subnet.
    this.onRequest('/scan', async ({ sweep = true, timeoutMs = 2500, port = 80, broadcast } = {}) => {
      const devices = await this.bl.scan(Math.min(Number(timeoutMs) || 2500, 8000), { sweep, port: Number(port) || 80, ...(broadcast ? { broadcast } : {}) });
      return { ok: true, devices };
    });

    // "Check" next to an IP address field.
    this.onRequest('/probe', async ({ address, port = 80 } = {}) => {
      if (!address) {return { ok: false, error: 'enter an IP address' };}
      const hello = await this.bl.probe(String(address).trim(), Number(port) || 80, 1500);
      if (!hello) {return { ok: false, error: 'no BroadLink answered at that address' };}
      return { ok: true, device: describe(hello, String(address).trim()) };
    });

    this.onRequest('/convert', async ({ text } = {}) => normaliseCode(text));

    // Test a code: sends it once through the chosen device.
    this.onRequest('/send', async ({ host, code } = {}) => {
      const norm = normaliseCode(code);
      if (!norm.ok) {return norm;}
      try {
        const device = await this.device(host);
        const t0 = performance.now();
        const ok = await device.sendData(Buffer.from(norm.hex, 'hex'));
        return ok ? { ok: true, ms: Math.round(performance.now() - t0) } : { ok: false, error: 'the BroadLink did not acknowledge the code' };
      } catch (err) {
        return { ok: false, error: reason(err) };
      }
    });

    // Learning. Progress arrives as 'learn' push events:
    // { stage: ready|sweeping|frequency|press|code|timeout|cancelled|error, ... }
    this.onRequest('/learn/start', async ({ host, kind = 'ir' } = {}) => {
      this.learning?.abort();
      const ctrl = new AbortController();
      this.learning = ctrl;
      let device;
      try {
        device = await this.device(host);
      } catch (err) {
        return { ok: false, error: reason(err) };
      }
      if (kind === 'rf' && !device.rf) {return { ok: false, error: `${device.model} cannot learn radio (RF) codes; use IR` };}

      const push = (stage, info = {}) => this.pushEvent('learn', { stage, kind, ...info });
      const flow = kind === 'rf' ? learnRF : learnIR;
      flow(device, { signal: ctrl.signal, onStage: push })
        .catch((err) => push('error', { message: reason(err) }))
        .finally(() => {if (this.learning === ctrl) {this.learning = null;}});
      return { ok: true, model: device.model };
    });

    this.onRequest('/learn/cancel', async () => {
      this.learning?.abort();
      return { ok: true };
    });

    this.ready();
  }

  /** A logged-in device for a hosts entry (or an address string). */
  async device(host) {
    const h = typeof host === 'string' ? { address: host } : (host || {});
    if (!h.address) {throw new Error('choose a BroadLink device first');}
    const known = [...this.bl.devices.values()].find((d) => d && d.host && d.host.address === h.address);
    const device = known || await this.bl.addManualHost({
      address: h.address, port: h.port || 80, mac: h.mac || '00:00:00:00:00:00',
      isRM4: h.isRM4, isRFSupported: h.isRFSupported,
    });
    if (!device) {throw new Error('that device is not an RM remote this plugin supports');}
    await device.authenticate();
    return device;
  }
}

(() => new BroadlinkHubUiServer())();
