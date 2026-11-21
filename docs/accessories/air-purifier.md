# Air purifier <span class="badge adv">advanced</span>

`"type": "air-purifier"`. An air purifier tile with power, speed, Auto/Manual mode and optional swing, direction and child lock. Built on the [fan](accessories/fan.md), so all fan codes and options apply. Configured in the JSON tab.

## Codes

| Key | Description |
| --- | --- |
| `on`, `off` | Power. |
| `fanSpeedNN` | Speeds, as for the [fan](accessories/fan.md?id=codes). |
| `targetStateAuto`, `targetStateManual` | Sent when switching between Auto and Manual mode. |
| `swingToggle` | Swing / oscillation. |
| `lockControls`, `unlockControls` | Child lock (physical controls). |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `showSwingMode` | `true` | Show the swing control. |
| `showRotationDirection` | `true` | Show the direction control. |
| `showLockPhysicalControls` | `true` | Show the child-lock control. |
| fan options | | `stepSize`, `speedSteps`, `speedCycle`, … from [Fan](accessories/fan.md?id=options). |

## Example

```json
{ "name": "Purifier", "type": "air-purifier", "showRotationDirection": false,
  "data": { "on": "2600…", "off": "2600…", "fanSpeed33": "2600…", "fanSpeed66": "2600…", "fanSpeed100": "2600…",
            "targetStateAuto": "2600…", "targetStateManual": "2600…" } }
```
