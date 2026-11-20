# Homebridge Broadlink RM Pro

**After 7+ years of loyal service from this plugin, I'm an no longer using it. This makes maintaining it now impossible as I have no way to test changes.** 

**I hope that someone will pick this up and build on it, as I did from @lprhodes. If I'm completely honest, I think the next step on this should be a full re-build to smooth out some of the imperfections. That has been my hope for the last two years but unfortunately that remained a hope and I never found the time.**

**Good luck to anyone that can add to this wonderful community and keep this plug in alive. I'm happy to help if I can.**

## Introduction
Welcome to the Broadlink RM Mini and Broadlink RM Pro plugin for [Homebridge](https://github.com/nfarina/homebridge).

This plugin allows you to control your RM Mini and RM Pro with HomeKit using the Home app and Siri.

## Like this plugin?

If you like this plugin and want to show your support then please star the Github repo, or better yet; buy me a drink using [Paypal](https://paypal.me/kiwicamRM).

Thank you!

## Installation

This plugin can be added via the Web interface, or if you perfer the terminal:
   `npm install -g homebridge-broadlink-rm-pro`
For more information, refer to the [documentation](https://broadlink.kiwicam.nz/#installation).

## Documentation

**Documentation can be found [here](https://broadlink.kiwicam.nz).** If you have any trouble after reading through the information please raise an issue and we'll help out as best we can.

If the plugin is unable to discover your device, it's likely you've locked the device with the cloud so it no longer accepts local connections. In this case, follow these steps:
1. Open the [Broadlink app](https://apps.apple.com/us/app/broadlink/id1450257910)
2. From the Home screen, tap on your Broadlink device
3. Tap the ... in the top right
4. Scroll down and toggle "Lock device" to Off
5. Tap OK when prompted "Confirm to unlock the device"

<img src="https://i.imgur.com/DMTUbDo.png" width="40%" height="40%">

This plugin should now be able to discover your device.

## Transport options (5.x)

Set these at platform level or per `hosts` entry:

| Option | Default | Meaning |
| --- | --- | --- |
| `port` | `80` | UDP port of the RM device |
| `timeout` | `2000` | ms to wait for the device's reply to each command |
| `retries` | `0` | resend a code after a timeout. Leave at 0 for toggle codes (a lost *reply* would make the device fire twice) |
| `sendGap` | `0` | minimum ms between two transmissions to the same device |

```json
"hosts": [{ "address": "192.168.1.50", "mac": "34:ea:34:5a:c0:de", "isRM4": true, "isRFSupported": true, "sendGap": 100 }]
```

## Development

```
npm test           # all tests
npm run test:core  # protocol + persistence
node test/sim/rmSimulator.js 47123   # standalone RM simulator
npm run test:e2e -- <storage-dir>    # boots real Homebridge 2 against the simulator
```

## Thanks
Original: Thanks to @tattn (https://github.com/tattn/homebridge-rm-mini3), @PJCzx (https://github.com/PJCzx/homebridge-thermostat), @momodalo (https://github.com/momodalo/broadlinkjs), and @lprhodes (https://github.com/lprhodes/homebridge-broadlink-rm) whose time and effort got this started.

In this fork: Thanks to @kiwi-cam (https://github.com/kiwi-cam), @Cloudore (https://github.com/Cloudore) and @Faisalthe01 (https://github.com/Faisalthe01) for your work!
