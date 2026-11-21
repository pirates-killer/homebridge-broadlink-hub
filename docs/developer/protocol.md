# BroadLink protocol <span class="badge dev">developer</span>

The BroadLink LAN protocol as implemented in `lib/broadlink/protocol.js`. Packets were verified byte-for-byte against [python-broadlink](https://github.com/mjg59/python-broadlink) 0.19 (`test/fixtures/python-broadlink-vectors.json`), and the control behaviour (timeouts, send count) was checked against the official BroadLink app's SDK.

All multi-byte integers are little-endian. Devices listen on **UDP port 80**.

## Discovery ("hello")

A 48-byte packet, broadcast to `255.255.255.255:80` or unicast to a device:

| Offset | Size | Content |
| --- | --- | --- |
| `0x08` | 4 | Timezone offset (hours, signed) |
| `0x0c` | 2 | Year |
| `0x0e`–`0x13` | 6 | Minute, hour, year % 100, weekday, day, month |
| `0x18` | 4 | Local IP, reversed byte order |
| `0x1c` | 2 | Local port |
| `0x20` | 2 | Checksum (see below) |
| `0x26` | 1 | Command `0x06` |

The reply (command `0x07`) carries the device type at `0x34`, the MAC at `0x3a`–`0x3f` (reversed), the name from `0x40` and a *locked* flag at `0x7f`.

## Command packets

Every other exchange uses a 56-byte (`0x38`) header plus an AES-128-CBC encrypted payload:

| Offset | Size | Content |
| --- | --- | --- |
| `0x00` | 8 | Magic `5a a5 aa 55 5a a5 aa 55` |
| `0x20` | 2 | Checksum of the whole packet |
| `0x22` | 2 | Error code (replies), signed |
| `0x24` | 2 | Device type |
| `0x26` | 1 | Command: `0x65` auth, `0x6a` RM command; replies `0xe9`, `0xee` |
| `0x28` | 2 | Packet counter (echoed in the reply) |
| `0x2a` | 6 | Device MAC, reversed |
| `0x30` | 4 | Session id |
| `0x34` | 2 | Checksum of the unencrypted payload |
| `0x38` | n | Encrypted payload, zero-padded to 16 bytes |

**Checksum**: 16-bit sum of all bytes, starting at `0xBEAF`.
**Encryption**: AES-128-CBC, no padding, IV `562e17996d093d28ddb3ba695a2e6f58`. The key is `097628343fe99e23765c1513accf8b02` until authenticated, then the session key.

### Authentication

Payload: 80 bytes, `0x31` × 16 at `0x04`, `0x01` at `0x1e` and `0x2d`, the client name `"Test 1"` at `0x30`. The reply payload holds the session id (bytes 0–3) and key (bytes 4–19).

?> Observed on an RM4 Pro: every login gets the **same** id and key, and an earlier session stays valid after another client logs in. Multiple controllers can safely share a device.

### RM sub-commands

The `0x6a` payload wraps an RM sub-command. RM4-family devices prefix a length:

| Family | Request | Reply data |
| --- | --- | --- |
| RM2 / RM3 | `u32 subcommand` + data | payload from byte 4 |
| RM4 | `u16 (len(data) + 4)` + `u32 subcommand` + data | payload bytes 6 … `len + 2` |

| Sub-command | Name | Data | Reply |
| --- | --- | --- | --- |
| `0x01` | check temperature (RM2/3) | — | `int8 °C`, `int8 tenths` |
| `0x02` | send code | code bytes | — |
| `0x03` | enter IR learning | — | — |
| `0x04` | check learned data | — | code, or error −10 when nothing yet |
| `0x19` | RF sweep (start frequency search) | — | — |
| `0x1a` | check frequency | — | `u8 found`, `u32 kHz` (RM4 Pro) |
| `0x1b` | find RF packet | optional `u32 kHz` | `u8` |
| `0x1e` | cancel learning / sweep | — | — |
| `0x24` | check sensors (RM4) | — | `int8 °C`, `int8 hundredths`, `u8 %RH`, `u8 hundredths` |

### Error codes

| Code | Meaning | Plugin reaction |
| --- | --- | --- |
| −1 | Authentication failed | re-login, resend once |
| −2 | Logged out | re-login, resend once |
| −4 | Command not supported (for example no sensor) | ignored for sensor polls |
| −5 | Storage full | logged |
| −7 | Control key expired (device rebooted) | re-login, resend once |
| −10 | Read error / nothing learned yet | normal while polling during learning |

## Code format

Codes sent with `0x02` (and returned by `0x04`): byte 0 type (`0x26` IR, `0xb2` RF 433, `0xd7` RF 315), byte 1 repeat count, bytes 2–3 pulse data length, then pulse durations in units of 2⁻¹⁵ s (≈ 30.5 µs), with `0x00 hi lo` for durations over 255 units. IR codes end with `0x0d 0x05`.

## Timing behaviour

| | Official SDK | BroadLink Hub |
| --- | --- | --- |
| Requests in flight per device | 1 | 1 |
| Reply timeout (local) | 2000 ms fixed | adaptive: ≈ 4 × measured RTT, clamped to 250 ms (400 ms for codes) … `timeout` (2000) |
| Send count | 1 | 1 (`retries` resends the identical packet) |
| Reply matching | message type | packet counter (device echoes it) |

Measured on an RM4 Pro over Wi-Fi: round trip p50 15 ms, p90 20 ms, max 29 ms; login 95 ms.
