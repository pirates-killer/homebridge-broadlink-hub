# Using lib/broadlink <span class="badge dev">developer</span>

`lib/broadlink` has no Homebridge dependency and can be used on its own: in scripts, other integrations or tests.

```js
const { Broadlink, RMDevice, learnIR, learnRF } = require('homebridge-broadlink-hub/lib/broadlink');
```

## Find devices

```js
const bl = new Broadlink();
const devices = await bl.scan(2500, { sweep: true });
// [{ address: '192.168.1.50', mac: '34:ea:34:12:ab:cd', devtype: 21003, devtypeHex: '0x520b',
//    model: 'RM4 Pro', rm4: true, rf: true, isLocked: false, supported: true, name: 'Universal Remote' }]

const hello = await bl.probe('192.168.1.50');   // one address; null if no answer within 1.5 s
```

`scan()` only lists devices; it doesn't log in to anything. `sweep: true` adds a unicast hello to every address of each local subnet (up to /22) for networks that drop broadcasts.

## Talk to a device

```js
const device = new RMDevice({
  address: '192.168.1.50', mac: Buffer.from('34ea3412abcd', 'hex'), devtype: 0x520b,
  timeout: 2000, retries: 0, sendGap: 0, monitorInterval: 0,
});

await device.authenticate();                          // optional: commands log in on demand
const ok = await device.sendData(Buffer.from('2600…', 'hex'));   // true when acknowledged
const sensors = await device.checkTemperature();      // { temperature, humidity } or null
device.close();
```

### RMDevice options

| Option | Default | Description |
| --- | --- | --- |
| `address`, `port` | —, `80` | Device address (IP or host name, resolved once). |
| `mac` | — | Buffer of 6 bytes, display order. |
| `devtype` | — | Device type from the hello reply. Decides RM4 framing and RF support. |
| `family` | — | `{ model, rm4, rf }` for device types not in the table. |
| `timeout` | `2000` | Upper bound for reply waits (ms). |
| `adaptiveTimeout` | `true` | Learn the round trip and wait ≈ 4 × RTT (min 250 / 400 ms). |
| `retries` | `0` | Resends of the identical packet after a timeout (codes). |
| `sendGap` | `0` | Minimum ms between transmissions. |
| `monitorInterval` | `30000` | Keepalive period while idle; `0` disables it. |
| `log`, `debug` | no-op, `false` | Logging. |

### Methods

| Method | Resolves | Notes |
| --- | --- | --- |
| `authenticate()` | — | Logs in if not already. Emits `deviceReady` the first time. |
| `rmCommand(sub, data?, { retries })` | reply data `Buffer` | Low level. Throws `DeviceError` (`code` = device error) or `TimeoutError` (`code` = `ETIMEDOUT`). |
| `sendData(buffer)` | `true` / `false` | Sends a code; `false` if not acknowledged (logged). |
| `checkTemperature()` / `checkHumidity()` | `{ temperature, humidity }` / `null` | `null` when the model has no sensor. Also emits `temperature`. |
| `enterLearning()`, `checkData()`, `cancelLearn()` | — | Legacy-style learning (emits `rawData`). |
| `enterRFSweep()`, `checkRFData()`, `checkRFData2()` | — | Legacy-style RF learning; only defined on RF models. |
| `startMonitoring()`, `close()` | — | Keepalive on; release the socket. |

`device.state` is `unknown`, `active` or `inactive`. `device.stats` counts requests, timeouts and re-logins and keeps the last round-trip time.

## Learning with progress

```js
const ctrl = new AbortController();
const hex = await learnIR(device, {
  signal: ctrl.signal, timeoutMs: 30000,
  onStage: (stage, info) => console.log(stage, info),   // ready → code | timeout | cancelled
});

const rf = await learnRF(device, { onStage: console.log });   // sweeping → frequency → press → code
```

Both resolve with the code as hex, or `null` on timeout or abort.

## The registry

`new Broadlink()` keeps one `RMDevice` per MAC and emits `deviceAdded` (usable now) and `deviceReady` (logged in). `addManualHost({ address, mac, port, isRM4, isRFSupported, options })` probes first and falls back to the flags. Set `bl.deviceOptions` for defaults applied to every device it creates.
