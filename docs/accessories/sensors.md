# Temperature & humidity sensors <span class="badge adv">advanced</span>

`"type": "temperatureSensor"` and `"type": "humiditySensor"`. Sensor tiles that show the BroadLink's own sensor (RM4 Pro, RM4 mini with cable) or another [source](advanced/sensors.md). They send no codes, so `data` isn't needed. Useful as triggers for HomeKit automations ("When the living room is above 27 °C, turn on the AC").

## temperatureSensor

| Option | Default | Description |
| --- | --- | --- |
| `temperatureUpdateFrequency` | `10` | Seconds between readings. |
| `temperatureAdjustment` | `0` | Added to every temperature reading. |
| `humidityAdjustment` | `0` | Added to every humidity reading. |
| `noHumidity` | `false` | Temperature only. |
| `units` | `c` | Display units: `c` or `f`. |
| `batteryAlerts` | `false` | Show a battery level / low-battery warning when the source reports one. |
| sources | | `pseudoDeviceTemperature`, `temperatureFilePath`, `w1DeviceID`, MQTT, `tempSourceUnits`: see [Sensors & MQTT](advanced/sensors.md). |

## humiditySensor

| Option | Default | Description |
| --- | --- | --- |
| `humidityUpdateFrequency` | `10` | Seconds between readings. |
| `humidityAdjustment` | `0` | Added to every reading. |
| `humidityFilePath` | — | Read from a file instead. |
| `batteryAlerts` | `false` | As above. |
| MQTT | | See [Sensors & MQTT](advanced/sensors.md?id=mqtt). |

## Example

```json
{ "name": "Living Room Climate", "type": "temperatureSensor", "host": "192.168.1.50", "temperatureAdjustment": -0.8 }
```
