# Platform & connection options <span class="badge adv">advanced</span>

## Platform options

| Option | Default | Description |
| --- | --- | --- |
| `platform` | — | **Required.** Must be `BroadlinkRM`. |
| `name` | `BroadlinkRM` | Name used in the Homebridge log. |
| `hosts` | none | Your BroadLink devices, see [below](advanced/platform.md?id=hosts). Without it the plugin discovers devices automatically at startup. |
| `accessories` | `[]` | The accessories, see the [reference](accessories/README.md). |
| `logLevel` | `info` | `trace`, `debug`, `info`, `warning`, `error`, `critical` or `none`. Applies to device handling and discovery; accessories have their own `logLevel`. |
| `debug` | `false` | Shortcut for `logLevel: debug`. |
| `disableLogs` | `false` | Shortcut for `logLevel: none`. |
| `hideLearnButton` | `false` | Don't add the "Learn" switch to the Home app (set by the settings page; it replaces the switch). |
| `hideScanFrequencyButton` | `false` | Don't add the "Scan Frequency" (RF learning) switch. |
| `deviceDiscoveryTimeout` | `60` | Seconds to keep broadcasting discovery when no `hosts` are set. A one-off subnet sweep also runs at startup. |
| `timeout`, `retries`, `sendGap` | see [below](advanced/platform.md?id=connection-options) | Connection options for all devices. Each `hosts` entry can override them. |
| `hideWelcomeMessage` | — | Accepted for compatibility; there is no banner any more. |

## hosts

Each entry describes one BroadLink. Listing devices skips the startup search and works on networks that block discovery.

```json
"hosts": [
  { "address": "192.168.1.50", "mac": "34:ea:34:12:ab:cd", "isRM4": true, "isRFSupported": true },
  { "address": "rm-bedroom.lan", "mac": "34:ea:34:98:76:54", "sendGap": 150 }
]
```

| Key | Required | Description |
| --- | :-: | --- |
| `address` | ✓ | IP address or host name of the BroadLink. Host names are resolved once at startup. |
| `mac` | ✓ | Its MAC address. The device's own MAC is used if it answers with a different one (a warning is logged). |
| `isRM4` | | Fallback only: RM4-style protocol if the device doesn't answer the startup check. |
| `isRFSupported` | | Fallback only: the device has an RF radio. |
| `port` | | UDP port, default `80`. Only needed for special setups (port forwarding, simulators). |
| `timeout`, `retries`, `sendGap` | | Per-device [connection options](advanced/platform.md?id=connection-options). |

?> At startup the plugin asks each host for its real device type and MAC (retrying for up to 1.5 s while the device's Wi-Fi wakes up). The `isRM4` / `isRFSupported` flags are only used if it gets no answer.

## Connection options

Set them at platform level for all devices, or inside a `hosts` entry for one device.

| Option | Default | Description |
| --- | --- | --- |
| `timeout` | `2000` | Upper limit in ms for waiting on a reply. The actual wait adapts to your network: it learns the round trip of real replies (typically 10–30 ms) and waits about 4× that, but at least 250 ms (400 ms for codes). A lost reply therefore holds up the next command for about a quarter of a second, not 2 seconds. |
| `retries` | `0` | How often to resend a code that got no reply. The identical packet is resent. **Keep 0 for toggle codes**: if the code worked but the reply got lost, a resend toggles the device back. Useful for discrete codes (separate on/off) on flaky Wi-Fi. |
| `sendGap` | `0` | Minimum ms between two transmissions through the same BroadLink. Raise it (100–300) if a device misses codes sent in quick succession, for example in scenes. |
| `adaptiveTimeout` | `true` | Set to `false` to always wait the full `timeout`. |

## What happens on the network

| When | What the plugin does |
| --- | --- |
| Startup | Sends a hello to each `hosts` entry (or a broadcast plus a subnet sweep without `hosts`), then logs in. Commands issued meanwhile are queued, not dropped. |
| Every command | One request at a time per BroadLink, each waiting for its acknowledgement, matched by packet counter. |
| Device reports "session expired" | Logs in again and resends; the device had rejected the command, so this can't double-fire. |
| Every 30 s while idle | A tiny authenticated keepalive. If the BroadLink rebooted, the plugin logs back in now, so your next tap doesn't wait. |
| Device stops answering | After 3 missed replies it's logged as not responding; when it answers again it's logged as reachable and logged in again. |
