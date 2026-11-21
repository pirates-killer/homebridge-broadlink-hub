# Accessory reference <span class="badge adv">advanced</span>

Every accessory has a `type`. The settings page has forms for the common ones; all types and options can be edited in an accessory's **JSON** tab.

| `type` | Home app tile | Main codes (`data`) | Form on the settings page |
| --- | --- | --- | :-: |
| [`switch`](accessories/switch.md) | Switch | `on`, `off` | ✓ |
| [`outlet`](accessories/outlet.md) | Outlet | `on`, `off` | ✓ |
| [`light`](accessories/light.md) | Light bulb | `on`, `off`, `brightnessNN`, `hueNN`, `white` | ✓ |
| [`fan`](accessories/fan.md) | Fan | `on`, `off`, `fanSpeedNN`, `swingToggle`, `clockwise`, `counterClockwise` | ✓ |
| [`fanv1`](accessories/fan.md?id=fanv1) | Fan (old service) | as `fan`, without swing | JSON |
| [`tv`](accessories/tv.md) | Television | `on`, `off`, `inputs`, `volume`, `remote`, `powerMode` | ✓ |
| [`air-conditioner`](accessories/air-conditioner.md) | Thermostat | `off`, `on`, `coolNN` / `heatNN` / `autoNN` / `temperatureNN`, `cool` / `heat` / `auto` | ✓ |
| [`heater-cooler`](accessories/heater-cooler.md) | Heater-cooler | per mode, temperature and fan speed | JSON |
| [`air-purifier`](accessories/air-purifier.md) | Air purifier | `on`, `off`, `fanSpeedNN`, `targetStateAuto` / `targetStateManual`, … | JSON |
| [`humidifier-dehumidifier`](accessories/humidifier-dehumidifier.md) | Humidifier-dehumidifier | `on`, `off`, `targetStateHumidifier` / `targetStateDehumidifier`, … | JSON |
| [`garage-door-opener`](accessories/garage-door-opener.md) | Garage door | `open`, `close`, `lock`, `unlock` | ✓ |
| [`lock`](accessories/lock.md) | Lock | `lock`, `unlock` | ✓ |
| [`window-covering`](accessories/window-covering.md) | Blind / curtain | `open`, `close`, `stop`, `openCompletely`, `closeCompletely` | ✓ |
| [`window`](accessories/window-covering.md?id=window) | Window | as `window-covering` | JSON |
| [`temperatureSensor`](accessories/sensors.md) | Temperature sensor | — | JSON |
| [`humiditySensor`](accessories/sensors.md) | Humidity sensor | — | JSON |
| [`switch-multi`](accessories/switch-multi.md), [`switch-repeat`](accessories/switch-multi.md), [`switch-multi-repeat`](accessories/switch-multi.md) | Switch | lists of codes | JSON |
| [`learn-code`](accessories/learn-code.md) (alias `learn-ir`) | Switch | — | — |

All types also take the [common options](advanced/common-options.md). Wherever a code goes you can use a plain hex string, a Pronto code, or a [list of steps with repeats and pauses](advanced/codes.md).

## Reading the option tables

- **Default** is what you get when the option is left out. `—` means "not set / off".
- Numbers are seconds unless the name says otherwise (`…Temperature` in °C unless you set `units` / `temperatureUnits`).
- Options marked *alias* are older names that still work.
