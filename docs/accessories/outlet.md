# Outlet <span class="badge adv">advanced</span>

`"type": "outlet"`. Works exactly like a [switch](accessories/switch.md) but appears as a plug/socket in the Home app. Typical for RF-controlled sockets.

## Codes

| Key | Description |
| --- | --- |
| `on` | Sent when turned on. |
| `off` | Sent when turned off. |

## Options

All [switch options](accessories/switch.md?id=options) except `stateless`. With [ping detection](advanced/ping.md), the result drives the outlet's **In Use** state instead of its power state.

## Example

```json
{ "name": "Heater Socket", "type": "outlet", "host": "192.168.1.50",
  "data": { "on": "b200…", "off": "b200…" } }
```
