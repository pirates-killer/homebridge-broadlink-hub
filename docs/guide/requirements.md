# Requirements <span class="badge user">everyone</span>

## What you need

| | |
| --- | --- |
| **A BroadLink RM** | An RM mini 3, RM Pro / Pro+, RM4 mini, RM4C mini, RM4S, RM4 TV mate, RM4 Pro or RM4C Pro. [Full list](guide/requirements.md?id=supported-models). |
| **Homebridge** | Version 1.8 or newer, or 2.x. Most people run it with the [Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x), for example on a Raspberry Pi with the official Homebridge image. |
| **Node.js** | 20.18 or newer (22, 24 and 26 are tested). Homebridge 2.x itself needs 22.12+. |
| **The same network** | Homebridge and the BroadLink must be able to reach each other on the local network (UDP port 80 on the BroadLink). |
| **Your remotes** | To teach the BroadLink each button. Or codes from somewhere else, such as Home Assistant / SmartIR files or Pronto codes. |

### IR or RF?

- **IR (infrared)**: most TVs, air conditioners, fans, soundbars and LED strips. Every RM model can learn and send IR. The remote has to point at the device.
- **RF (radio, 315 / 433 MHz)**: many garage doors, motorised blinds, ceiling fans and wireless sockets. Only the **Pro** models (RM Pro, RM4 Pro, RM4C Pro) have the radio. RF works through walls.

?> Not sure which your remote uses? Point it at a phone camera and press a button. If you see a flashing light on the screen it is IR. If not, it is probably RF.

## Put the BroadLink on your Wi-Fi

Use the official **BroadLink** app once to connect the RM to your Wi-Fi, then:

1. Give it a **fixed IP address** in your router (a "DHCP reservation"). Homebridge then always finds it at the same place.
2. **Unlock it**, see below. This is the most common reason the plugin can't talk to a new device.

## Unlock the device

The BroadLink app "locks" new devices to the cloud. A locked device refuses local control. BroadLink Hub detects this and logs a warning, and the settings page shows a **locked** badge.

1. Open the BroadLink app.
2. Tap your RM on the home screen.
3. Tap **…** (top right).
4. Scroll down and turn **Lock device** off.
5. Confirm with **OK**.

!> Some app versions turn locking back on after a firmware update. If a working device suddenly stops responding, check this setting first.

## Supported models

These device types are recognised automatically. The list is cross-checked against [python-broadlink](https://github.com/mjg59/python-broadlink).

| Family | Models | IR | RF |
| --- | --- | :-: | :-: |
| RM mini 3 | RM3 Mini (A, B, C, D, KR variants), RM Mini Shate | ✓ | |
| RM Pro | RM2, RM Pro / Pro+, RM2 Home Plus, RM3 Pro / Pro Plus, Phicomm RM Pro | ✓ | ✓ |
| RM4 | RM4 mini, RM4C mini, RM4S, RM4 TV mate, RM4C mate, newer RM mini 3 firmware | ✓ | |
| RM4 Pro | RM4 Pro, RM4C Pro | ✓ | ✓ |

An RM that isn't in the table can still be used: add it by IP address and set **RM4 family** / **Has RF** yourself (see [platform options](advanced/platform.md?id=hosts)).

BroadLink smart plugs (SP series), A1 sensors, MP1 strips and similar devices are not remotes and are ignored.
