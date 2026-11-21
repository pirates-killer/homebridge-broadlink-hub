# Blind / curtain <span class="badge adv">advanced</span>

`"type": "window-covering"`. A blind tile with a position slider (0 % closed … 100 % open). The plugin can't know the real position, so it times the movement: to go from 0 % to 50 % it sends `open`, waits half of `totalDurationOpen`, then sends `stop`.

## Codes

| Key | Description |
| --- | --- |
| `open` | Starts opening. |
| `close` | Starts closing. |
| `stop` | Stops the motor (needed for in-between positions). |
| `openCompletely` | Optional: used instead of `open` when the target is 100 %. |
| `closeCompletely` | Optional: used instead of `close` when the target is 0 %. |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `totalDurationOpen` | — | **Required.** Seconds from fully closed to fully open. Time it with a stopwatch. |
| `totalDurationClose` | — | **Required.** Seconds from fully open to fully closed. |
| `initialDelay` | `0.1` | Seconds to wait before moving. Give several blinds different values so their RF signals don't collide when a scene moves them together. |
| `sendStopAt0` | `false` | Also send `stop` on reaching fully closed. |
| `sendStopAt100` | `false` | Also send `stop` on reaching fully open. |

## Example

```json
{ "name": "Living Room Blinds", "type": "window-covering",
  "totalDurationOpen": 18, "totalDurationClose": 17, "initialDelay": 0.4,
  "data": { "open": "b200…", "close": "b200…", "stop": "b200…" } }
```

## window

`"type": "window"` is identical but appears as a window (for motorised windows or skylights).
