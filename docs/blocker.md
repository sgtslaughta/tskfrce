# Home box (blocker)

A small program on an always-on computer at home. It pauses the internet for the devices you choose until their chores are approved. It only works on your own home Wi-Fi.

## What it can't do

The home box pauses internet for normal use on your Wi‑Fi. It can't stop a determined kid who changes network settings, uses a phone hotspot, or swaps devices — but it will tell you when a paused device is getting around the block.

Changing the device's own network settings usually doesn't get around the block, and the box tells you when something does. If the box is unplugged or crashes, devices come back online within a minute or two.

- **Test block** checks one device. Press it to see what happened:
  - **We haven't seen this device on the network yet, so we couldn't test it.**
  - **Success — the device lost internet access while blocked.**
  - **The device is trying to get around the block. The box is still stopping it, but someone may have changed its network settings.**
  - **We couldn't see this device use the internet during the test. Open a video on it and test again. If you see this again, your router may be stopping the box — check the router list in the docs.** See [routers.md](routers.md) for routers that resist blocking.
- **Getting-around alert.** If a paused device keeps reaching the internet, you get a notification titled "<device> is getting around the block", and the device shows a "getting around the block" badge on the Devices page. The badge clears on its own once the device stops reaching the internet while paused, or once you unpause it.

Some routers, especially certain mesh systems (e.g. some Eero or Google Wifi models), resist blocking. See the [router compatibility list](routers.md) and press "Test block" to find out if yours works.

For the reasoning behind these limits, see the [blocker enforcement decision record](adr/0001-blocker-enforcement-vs-firewalla.md).

## What can kids try to get around it?

| Trick | What happens |
|---|---|
| Change DNS / use a VPN | Doesn't work: all internet traffic is dropped |
| Forget the network / rotating private address | A new address looks like a new device, so it starts blocked |
| Set a fixed (static) IP | Doesn't work: the box tracks the device itself, not its number |
| IPv6 | Blocked too, as long as the box has IPv6 on your network. If it doesn't, turn IPv6 off on your router to be sure. |
| Mobile data / hotspot / other Wi-Fi | Not covered (home Wi-Fi only) |
| Unplug the box | Devices come back online; you get an alert |
| Router that resists blocking | Use the "Test block" button to check; see below |
| Tech-savvy laptop admin hardcoding the router's address | Usually stopped; flagged if it gets through. |

## Place the box out of reach

Keep the box somewhere kids can't get to it. Unplugging it turns blocking off.

## If the box is off

It fails open: if the box is off or unplugged, all devices get their internet back.

## Setup

The parent-friendly steps are in the [install guide](guide/02-install.md). In short:

1. Put `INTERNAL_TOKEN=temporary` and `LAN_IFACE=<your network name, for example eth0>` in a `.env` file next to `docker-compose.yml` (compose refuses to run without a token).
2. Start the app: `docker compose up -d --build backend frontend`. On its first start the app makes a secret code (the internal token) so the app and the box can trust each other, and stores it in `secrets.json` in its data folder.
3. Read it with `docker compose exec backend python -c "import json; print(json.load(open('/app/data/secrets.json'))['INTERNAL_TOKEN'])"` and put it in `.env` in place of `temporary`.
4. Run `docker compose up -d blocker`. The box needs Linux (it uses host networking).
