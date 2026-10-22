# 2. Install

One line does it all. You will type it on the home box. After each step we tell you what you should see.

You need to be at the box with a keyboard and screen, or connected to it from another computer. If you set up a Raspberry Pi, install **Raspberry Pi OS (64-bit)** on it first, using the free [Raspberry Pi Imager](https://www.raspberrypi.com/software/). Turn on SSH or connect a keyboard and screen.

## Step 1. Run the installer

Open the Terminal on the box. Copy this line, paste it, and press Enter:

```bash
curl -fsSL https://sgtslaughta.github.io/tskfrce/install.sh | sh
```

If it asks "Install Docker now?", type `y` and press Enter. Docker is a free program that runs t@sk4ce. You install it once and then forget it.

This takes a few minutes the first time. Leave it alone until it stops.

You should see: a last message that says **t@sk4ce is running. Open http://192.168.1.50:3000 on your phone or computer.** The numbers will be your box's address.

If something goes wrong, the message says what happened and what to do next. Run the same line again after you fix it. It is safe to run again.

## Step 2. Open t@sk4ce

On your phone or another computer **on the same Wi-Fi**, open a web browser and type the address from the last message.

You should see: a page that welcomes you and asks about your family. That is the setup. Go to [First-time setup](03-first-setup.md).

Tip: bookmark this page, and write the address on a sticky note near the router.

## Keeping it running

t@sk4ce restarts by itself after a power cut.

**To update:** run the install line again. Your family, chores and settings are kept. The app saves a copy of your data before it changes anything.

**To stop it:** in the `task4ce` folder (in your home folder), type `docker compose -f docker-compose.prod.yml down`. To start it again, type `docker compose -f docker-compose.prod.yml up -d`.

## Do it by hand (for the curious)

The installer does these things. You can do them yourself instead:

1. Install Docker from https://docs.docker.com/engine/install/ and check with `docker --version`.
2. Download the code: `git clone https://github.com/sgtslaughta/tskfrce.git task4ce && cd task4ce`.
3. Write a `.env` file with `SECRET_KEY` and `INTERNAL_TOKEN` (each a long random string, for example from `openssl rand -hex 32`), `BOX_URL=http://<box address>:3000`, `LAN_IFACE=<network name from ip route show default>` and `COMPOSE_PROFILES=blocker`.
4. Start it: `docker compose -f docker-compose.prod.yml up -d --build`.

Mac and Windows can run the app to try it out (not the internet pausing): leave out `COMPOSE_PROFILES=blocker`.

> **For the curious.** The `blocker` service uses host networking and the NET_ADMIN/NET_RAW capabilities to do ARP/NDP redirection and nftables rules, so it must run on Linux. It shares the secret `INTERNAL_TOKEN` with the app; the installer writes the same one to both. Updates run database migrations on start and keep a backup in the data volume first (`backups/pre-upgrade-<time>.db`).

Next: [First-time setup](03-first-setup.md). Stuck? See [Troubleshooting](06-troubleshooting.md).
