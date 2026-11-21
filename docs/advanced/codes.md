# Codes: formats, repeats, sequences <span class="badge adv">advanced</span>

## The simple case

A code is a string of hex. Wherever a code goes, you can write just the string:

```json
{ "name": "Fan Lamp", "type": "switch", "data": { "on": "2600500000012694…", "off": "2600580000012595…" } }
```

A switch whose single button toggles can even take one string as its whole `data`:

```json
{ "name": "Projector Screen", "type": "switch", "data": "2600500000012694…" }
```

## What's inside a code

BroadLink codes are the raw packet the RM transmits:

| Byte(s) | Meaning |
| --- | --- |
| 0 | Signal type: `26` = infrared, `b2` = RF 433 MHz, `d7` = RF 315 MHz |
| 1 | **Repeat count**: how many extra times the RM itself repeats the signal (`00` = send once) |
| 2–3 | Length of the pulse data, little-endian |
| 4… | Pulse lengths in units of about 30.5 µs (`00 xx xx` for long pulses); IR codes end with `0d 05` |

So `2600…` is an IR code sent once, `b200…` an RF 433 code.

?> **Built-in repeat.** Changing byte 1 makes the BroadLink repeat the signal with exact device-side timing, often more reliable than repeating from Homebridge. `2602…` sends the code three times back to back. Useful for devices that need a held button.

## Repeat a code

Use a **list** of steps. Each step has the code in `data` and optional timing:

| Key | Default | Meaning |
| --- | --- | --- |
| `data` | — | The code (hex string). |
| `sendCount` | `1` | How many times to send it. |
| `interval` | `0.1` when `sendCount` > 1 | Seconds between those sends. |
| `pause` | `0` | Seconds to wait after this step, before the next one. |

```json
"data": {
  "on":  [ { "data": "2600…", "sendCount": 3, "interval": 0.3 } ],
  "off": "2600…"
}
```

!> A step must always be inside a list `[ … ]`, even when there is only one. A bare object (`"on": { "data": "…" }`) sends nothing.

## Send several codes in a row

List several steps. They run in order, each step's `pause` before the next:

```json
"data": {
  "on": [
    { "data": "2600…power…", "pause": 2 },
    { "data": "2600…hdmi2…", "pause": 0.5 },
    { "data": "2600…vol-up…", "sendCount": 5, "interval": 0.2 }
  ],
  "off": "2600…power…"
}
```

This turns a TV on, waits 2 s for it to boot, switches to HDMI 2 and raises the volume five steps.

## Different repeats for on and off

`on` and `off` are independent, so each can have its own list:

```json
"data": {
  "on":  [ { "data": "b200…", "sendCount": 2, "interval": 0.5 } ],
  "off": [ { "data": "b200…", "sendCount": 4, "interval": 0.5 } ]
}
```

## Pronto codes

Pronto hex (`0000 006C 0022 0002 …`) can be used directly in the config; it's converted when sent. Keep the spaces between the 4-digit words. The settings page converts Pronto (and base64) to BroadLink hex for you when you paste.

## Base64 codes (Home Assistant, SmartIR)

Base64 is not accepted directly in the config. Paste it into the code panel on the settings page and it's converted to hex. On the command line:

```bash
echo 'JgBQAAABKJQSOhI6EhMS…' | base64 -d | xxd -p | tr -d '\n'
```

## Where the codes are sent from

Each accessory sends through the BroadLink in its `host` option (IP or MAC), or the first device found when there's no `host`. Codes for the same BroadLink queue up and go out one at a time, each waiting for the device's acknowledgement; `sendGap` adds a minimum pause between them. See [connection options](advanced/platform.md?id=connection-options).
