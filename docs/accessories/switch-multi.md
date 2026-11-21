# Multi-code & repeat switches <span class="badge adv">advanced</span>

Three older switch types for sending several codes or repeats. They still work, but they log a deprecation warning: the same is possible with any accessory using [code sequences](advanced/codes.md), which are more flexible.

| Type | Sends | Replace with |
| --- | --- | --- |
| `switch-multi` | A list of codes, in order, `interval` seconds apart | `switch` with `"on": [ {"data": …, "pause": 1}, {"data": …} ]` |
| `switch-repeat` | One code `sendCount` times, `interval` apart | `switch` with `"on": [ {"data": …, "sendCount": 3, "interval": 1} ]` |
| `switch-multi-repeat` | A list of `{ data, sendCount, interval }` steps | `switch` with the same list |

## Options

| Option | Default | Applies to | Description |
| --- | --- | --- | --- |
| `interval` | `1` | all three | Seconds between sends. |
| `sendCount` | `1` | `switch-repeat` | Number of sends. |
| `onSendCount`, `offSendCount` | — | `switch-repeat` | Separate counts for on and off. |

All [switch options](accessories/switch.md?id=options) apply too.

## Examples

```json
{ "name": "Channel 101", "type": "switch-multi", "interval": 0.4, "stateless": true,
  "data": [ "2600…1…", "2600…0…", "2600…1…" ] }
```

The modern equivalent:

```json
{ "name": "Channel 101", "type": "switch", "stateless": true,
  "data": { "on": [ { "data": "2600…1…", "pause": 0.4 }, { "data": "2600…0…", "pause": 0.4 }, { "data": "2600…1…" } ] } }
```
