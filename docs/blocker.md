# Home box (blocker)

A small program on an always-on computer at home. It pauses the internet for the devices you choose until their chores are approved. It only works on your own home Wi-Fi.

## What can kids try to get around it?

| Trick | What happens |
|---|---|
| Change DNS / use a VPN | Doesn't work: all internet traffic is dropped |
| Forget the network / rotating private address | A new address looks like a new device, so it starts blocked |
| Set a fixed (static) IP | Doesn't work: the box tracks the device itself, not its number |
| IPv6 | Blocked too |
| Mobile data / hotspot / other Wi-Fi | Not covered (home Wi-Fi only) |
| Unplug the box | Devices come back online; you get an alert |
| Router that resists blocking | Use the "Test block" button to check; see below |
| Tech-savvy laptop admin hardcoding the router's address | Not covered |

## Place the box out of reach

Keep the box somewhere kids can't get to it. Unplugging it turns blocking off.

## If the box is off

It fails open: if the box is off or unplugged, all devices get their internet back.

## Router compatibility

Some routers, especially certain mesh systems (e.g. some Eero or Google Wifi models), resist blocking; press "Test block" to find out if yours works.

## Setup

1. Set `LAN_IFACE` to your box's network name (for example `eth0`).
2. Run `docker compose up -d blocker`.
