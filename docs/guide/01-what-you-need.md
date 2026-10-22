# 1. What you need

You need three things. You probably have two already.

## 1. A home box

This is a small computer that stays on all the time. It runs t@sk4ce and pauses the internet for the devices you choose.

Good choices:

- **A Raspberry Pi 4 or 5** (best). Small, cheap and uses very little power. Get one with at least 2 GB of memory, a power supply, a memory card (32 GB or more) and a network cable.
- **An old computer that runs Linux** and can stay on all day.

The box must run **Linux** to pause the internet. A Windows PC or a Mac can show you the app, but it cannot pause anything.

**Plug the box into your router with a network cable.** Wi-Fi works less well for this job.

## 2. An ordinary home router

Any normal router from your internet company works. A few kinds, mostly "mesh" Wi-Fi systems, can stop the box from doing its job. See the [router list](../routers.md). You can also just try it: setup includes a "Test block" button that tells you if it works.

## 3. Your kids' devices on your home Wi-Fi

t@sk4ce only works on your **home** Wi-Fi. It cannot control a phone on mobile data or on someone else's Wi-Fi. Read [what it can and cannot do](07-faq.md#can-my-kid-get-around-it) before you start.

## Where to put the box

Put it somewhere your kids can't easily reach, like a shelf in a closet, with the network cable and power plugged in. If someone unplugs it, the internet simply comes back on for everyone.

> **For the curious.** The box redirects the traffic of paused devices to itself and drops it, using ARP/NDP and nftables. It does not replace your router. More in [engineering.md](../engineering.md).

## Time and cost

About 20 minutes. The software is free. You only pay for the box if you don't have one.

Next: [Install](02-install.md).
