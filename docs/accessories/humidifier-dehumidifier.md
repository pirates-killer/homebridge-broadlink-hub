# Humidifier / dehumidifier <span class="badge adv">advanced</span>

`"type": "humidifier-dehumidifier"`. A humidifier-dehumidifier tile with power, mode, target humidity and the current humidity. Built on the [fan](accessories/fan.md) (speeds, swing). Configured in the JSON tab.

## Codes

| Key | Description |
| --- | --- |
| `on`, `off` | Power. |
| `targetStateHumidifier` | Switch to humidifying. |
| `targetStateDehumidifier` | Switch to dehumidifying. |
| `fanOnly` | Fan-only mode, where the device supports it. |
| `fanSpeedNN`, `swingToggle` | As for the [fan](accessories/fan.md?id=codes). |
| `lockControls`, `unlockControls` | Child lock. |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `humidifierOnly` | `false` | Offer only humidifying. |
| `deHumidifierOnly` | `false` | Offer only dehumidifying. |
| `threshold` | `5` | Accepted for compatibility; currently has no effect. |
| `humidityUpdateFrequency` | `10` | Seconds between humidity readings. |
| `humidityAdjustment` | `0` | Added to every humidity reading. |
| `humidityFilePath` | — | Read humidity from a file instead of the BroadLink ([Sensors](advanced/sensors.md?id=a-file)). |
| `noHumidity` | `false` | Don't show current humidity. |
| `showLockPhysicalControls`, `showSwingMode`, `showRotationDirection` | `true` | Show these controls. |

MQTT can also feed the humidity: see [Sensors & MQTT](advanced/sensors.md?id=mqtt).
