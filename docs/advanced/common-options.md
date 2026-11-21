# Options every accessory has <span class="badge adv">advanced</span>

These work on every accessory type, in addition to the type's own options in the [accessory reference](accessories/README.md).

| Option | Default | Description |
| --- | --- | --- |
| `name` | — | **Required.** Name in the Home app and for Siri. Must be unique; renaming creates a new HomeKit accessory. |
| `type` | — | **Required.** One of the [accessory types](accessories/README.md). |
| `data` | — | The codes. Shape depends on the type. See [Codes](advanced/codes.md). |
| `host` | first device found | Which BroadLink sends the codes: its IP address or MAC. Needed when you have more than one. |
| `disabled` | `false` | Keep the accessory in the config but don't add it to the Home app. |
| `persistState` | `true` | Remember the accessory's state (on/off, speed, mode, temperature…) across restarts. |
| `resendDataAfterReload` | `false` | After a restart, send the codes for the remembered state again. Needs `persistState`. Old name: `resendHexAfterReload`. |
| `resendDataAfterReloadDelay` | `2` | Seconds to wait after startup before resending (gives the BroadLink time to connect). |
| `allowResend` | `true` | Send the code even if the Home app asks for the state the accessory is already in. `false` skips it. Old name (inverted): `preventResendHex`. |
| `delay` | `0` | Seconds to wait before sending, for every change. |
| `logLevel` | `info` | This accessory's log detail: `trace`, `debug`, `info`, `warning`, `error`, `critical`, `none`. |
| `debug` | `false` | Shortcut for `logLevel: debug`. |
| `disableLogs` | `false` | Shortcut for `logLevel: none`. |
| `noHistory` | `false` | Accessories with Eve history (AC, heater-cooler, humidifier, sensors): don't record history. |

## MQTT options

Accessories that read a temperature or humidity (air conditioner, heater-cooler, humidifier, sensors) can take it from MQTT instead of the BroadLink's sensor. See [Sensors & MQTT](advanced/sensors.md?id=mqtt).

| Option | Description |
| --- | --- |
| `mqttURL` | Broker URL, for example `mqtt://192.168.1.10:1883`. |
| `mqttTopic` | A topic string, or a list of `{ "identifier": "temperature", "topic": "…" }` objects (identifiers: `temperature`, `humidity`, `battery`). |
| `mqttUsername`, `mqttPassword` | Credentials, if the broker needs them. |

## Ping options

Switches, outlets, fans and TVs can follow a device's real power state by pinging it. See [State from ping](advanced/ping.md).

| Option | Default | Description |
| --- | --- | --- |
| `pingIPAddress` | — | IP address of the controlled device (for example a smart TV). |
| `pingFrequency` | `1` | Seconds between checks. |
| `pingGrace` | `10` | Seconds after a tap during which ping results are ignored (the device needs time to boot or shut down). |
| `pingUseArp` | `false` | Check the ARP table instead of sending a ping (for devices that don't answer ping). |
| `pingIPAddressStateOnly` | `false` | Only update the tile; don't send codes when the state changes because of ping. |
