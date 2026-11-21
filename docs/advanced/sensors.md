# Temperature & humidity sources, MQTT <span class="badge adv">advanced</span>

The **air conditioner**, **heater-cooler**, **humidifier-dehumidifier** and the **sensor** accessories show a current temperature and/or humidity. The value can come from several places. The first one configured wins:

| Priority | Source | Option(s) |
| --- | --- | --- |
| 1 | A fixed value | `pseudoDeviceTemperature` |
| 2 | A file | `temperatureFilePath` (humidity accessories: `humidityFilePath`) |
| 3 | A Raspberry Pi 1-Wire sensor (DS18B20) | `w1DeviceID` |
| 4 | MQTT | `mqttURL`, `mqttTopic` |
| 5 | The BroadLink's own sensor (default) | — |

Which accessory supports which source:

| Accessory | Fixed | File | 1-Wire | MQTT | BroadLink |
| --- | :-: | :-: | :-: | :-: | :-: |
| `air-conditioner` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `temperatureSensor` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `heater-cooler` | `defaultNowTemperature` | ✓ | ✓ | ✓ | ✓ |
| `humidifier-dehumidifier`, `humiditySensor` | | ✓ (humidity) | | ✓ | ✓ |

## The BroadLink's own sensor

| Model | Sensor |
| --- | --- |
| RM4 Pro | Temperature and humidity built in |
| RM4 mini / RM4C mini | Only with the optional sensor cable (HTS2) |
| RM2 / RM3 Pro | Temperature on some versions |
| RM mini 3 | None |

Without a sensor the accessory shows its last known value (0 at first) and never waits for one. Check what yours reports in the Homebridge UI **Accessories** page.

## Options shared by all sources

| Option | Default | Description |
| --- | --- | --- |
| `temperatureUpdateFrequency` | `10` (`600` with MQTT) | Seconds between readings. File and 1-Wire sources are read at most once a minute. |
| `temperatureAdjustment` | `0` | Added to every temperature reading, for example `-1.5`. |
| `humidityAdjustment` | `0` | Added to every humidity reading. |
| `tempSourceUnits` | `C` | Set to `F` if the source reports Fahrenheit; it's converted. |
| `noHumidity` | `false` | Don't show humidity. |
| `batteryAlerts` | `false` | Sensors: show a low-battery warning when the source reports a battery level. |
| `noHistory` | `false` | Don't record Eve history. |

## A fixed value

```json
"pseudoDeviceTemperature": 24
```

Useful when nothing measures the room: the AC still works and HomeKit has a sensible value.

## 1-Wire (Raspberry Pi)

Connect a DS18B20 to the Pi's GPIO, enable the 1-Wire interface, then set its ID (the folder name under `/sys/bus/w1/devices/`):

```json
"w1DeviceID": "28-0316a0ae2bff"
```

## A file

Anything that can write a file can feed the temperature: a script, another integration, a cron job. The file contains either just a number:

```
23.5
```

or `key:value` lines:

```
temperature:23.5
humidity:48
battery:91
```

```json
"temperatureFilePath": "/var/lib/homebridge/livingroom-temp.txt"
```

## MQTT

```json
"mqttURL": "mqtt://192.168.1.10:1883",
"mqttUsername": "homebridge",
"mqttPassword": "…",
"mqttTopic": [
  { "identifier": "temperature", "topic": "zigbee2mqtt/livingroom_sensor" },
  { "identifier": "humidity", "topic": "zigbee2mqtt/livingroom_sensor" }
]
```

`mqttTopic` can also be a single topic string. The message can be a plain number (`23.5`) or JSON. In JSON the value is found under any of these keys, nested anywhere:

| Value | Keys searched |
| --- | --- |
| Temperature | `temp`, `Temp`, `temperature`, `Temperature`, `local_temperature` |
| Humidity | `hum`, `Hum`, `humidity`, `Humidity`, `relativehumidity`, `RelativeHumidity` |
| Battery | `batt`, `Batt`, `battery`, `Battery` |

So a Zigbee2MQTT payload like `{"temperature": 22.8, "humidity": 51, "battery": 97}` works as-is.

## Eve history

Accessories with a temperature or humidity record history that the **Eve** app shows as graphs (via fakegato-history). History is stored in the Homebridge storage folder (`RMPro_<name>_persist.json`, first space of the name replaced by `-`). Turn it off per accessory with `"noHistory": true`.
