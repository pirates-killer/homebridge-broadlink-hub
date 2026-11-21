# Garage door <span class="badge adv">advanced</span>

`"type": "garage-door-opener"`. A garage door tile that shows *opening → open* and *closing → closed*. Usually RF (Pro models).

!> Most modern garage door remotes use **rolling codes**, which can't be recorded and replayed. Fixed-code remotes and gate motors with a "learn" button for extra remotes work.

## Codes

| Key | Description |
| --- | --- |
| `open` | Sent to open. |
| `close` | Sent to close. For single-button remotes, use the same code as `open`. |
| `lock`, `unlock` | Optional: the door's lock control in the Home app. |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `openDuration` | `8` | Seconds the tile shows *opening* before *open*. |
| `closeDuration` | `8` | Seconds it shows *closing* before *closed*. |
| `openCloseDuration` | `8` | Sets both at once (used when `openDuration` / `closeDuration` aren't set). |
| `autoCloseDelay` | — | Seconds after opening to close automatically (sends `close`). Not set = never auto-closes. |

## Example

```json
{ "name": "Garage Door", "type": "garage-door-opener", "host": "192.168.1.50",
  "openDuration": 12, "closeDuration": 12, "autoCloseDelay": 300,
  "data": { "open": "b200…", "close": "b200…" } }
```
