# Lock <span class="badge adv">advanced</span>

`"type": "lock"`. A lock tile with *locking → locked* and *unlocking → unlocked*.

## Codes

| Key | Description |
| --- | --- |
| `lock` | Sent to lock. |
| `unlock` | Sent to unlock. |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `lockDuration` | `1` | Seconds shown as *locking*. |
| `unlockDuration` | `1` | Seconds shown as *unlocking*. |
| `lockUnlockDuration` | — | Sets both at once. |
| `autoLockDelay` | — | Seconds after unlocking to lock again automatically. Not set = stays unlocked. |

?> HomeKit asks for confirmation (and Face ID / passcode for remote access) before unlocking, like for any lock.

## Example

```json
{ "name": "Gate", "type": "lock", "autoLockDelay": 30, "data": { "lock": "b200…", "unlock": "b200…" } }
```
