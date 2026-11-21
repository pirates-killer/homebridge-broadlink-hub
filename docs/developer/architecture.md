# Architecture <span class="badge dev">developer</span>

## Repository layout

```
index.js                 Homebridge entry: registers the BroadlinkRM platform
platform.js              static platform: builds accessories from config, sets up devices
lib/broadlink/           standalone BroadLink RM client (no Homebridge dependency)
  protocol.js            packet codec: framing, AES, checksums, RM sub-commands
  device.js              RMDevice: queue, replies, timeouts, re-auth, keepalive, legacy API
  index.js               Broadlink registry: discovery, scan, probe, manual hosts
  learn.js               IR / RF learning flows
  deviceTypes.js         device type table and families
accessories/             one class per accessory type (inherited from homebridge-broadlink-rm)
base/                    HomebridgeAccessory / HomebridgePlatform base classes, state persistence
helpers/                 getDevice, sendData, Pronto conversion, ping / ARP, learn helpers
homebridge-ui/           settings page: server.js (backend) + public/ (page)
test/                    mocha tests, RM simulator, e2e and UI preview rigs
docs/                    this site (docsify)
```

## Request flow: a tap in the Home app

```
Home app ─▶ HAP-NodeJS ─▶ accessory.setCharacteristicValue()
                             │  updates state, calls the HomeKit callback right away
                             ▼
                         performSend(code | steps[])          accessories/accessory.js
                             ▼
                         sendData({ host, hexData })          helpers/sendData.js   (Pronto → hex)
                             ▼
                         getDevice(host) → RMDevice           helpers/getDevice.js
                             ▼
                         rmCommand(SEND_DATA, buffer)          lib/broadlink/device.js
                             │  queued per device, one in flight
                             ▼
                         encodePacket → UDP ─▶ BroadLink ─▶ reply (counter-matched) ─▶ resolve
```

HomeKit never waits for the BroadLink: the characteristic callback returns immediately and the send happens behind it. Measured plugin time from the HAP request to the UDP packet: about 2 ms.

## Device lifecycle

1. **Registration.** `platform.js` calls `broadlink.addManualHost()` for each `hosts` entry (probe → real type and MAC → `RMDevice`), or `discover()` / `discoverOnce()` for automatic discovery.
2. **`deviceAdded`** is emitted immediately: the device is usable and commands queue behind the first login.
3. **Login** (`_authLoop`) retries with exponential backoff (1 s → 60 s) until it succeeds; `deviceReady` is emitted once.
4. **Keepalive** every 30 s while idle: an authenticated sensor query. Auth errors trigger a re-login inside `rmCommand`; timeouts mark the session stale and count towards *not responding* (3 misses).

## State

Accessory state is a `Proxy` over a plain object: every assignment schedules a write. Writes are coalesced (250 ms) and flushed on exit. The on-disk format is node-persist 2's (one file per accessory, named `md5("<host>-<name>")`, holding `{ key, value }`), so state carries over from homebridge-broadlink-rm.

## Why a static platform

Homebridge derives a static-platform accessory's UUID from `"<platform>:<name>"`. Keeping the static platform and the `BroadlinkRM` name keeps every accessory's identity identical to homebridge-broadlink-rm, so users switching plugins keep their Home app setup. A dynamic platform would mean new UUIDs (or reimplementing the derivation) for no user benefit.

## Dependencies

Runtime: `fakegato-history` (Eve history, loaded lazily), `mqtt` (loaded only when an accessory sets `mqttURL`), `@homebridge/plugin-ui-utils` (settings page backend, only loaded by the Homebridge UI). Everything else is Node's standard library.
