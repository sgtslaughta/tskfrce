# 2. Install

You will type a few lines on the home box. Each step is one action. After each, we tell you what you should see.

You need to be at the box with a keyboard and screen, or connected to it from another computer. If you set up a Raspberry Pi, install **Raspberry Pi OS (64-bit)** on it first, using the free [Raspberry Pi Imager](https://www.raspberrypi.com/software/). Turn on SSH or connect a keyboard and screen.

## Step 1. Install Docker

Docker is a free program that runs t@sk4ce. You install it once and then forget it.

Open the official instructions for your box and follow them:

- Raspberry Pi OS: https://docs.docker.com/engine/install/raspberry-pi-os/
- Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Debian: https://docs.docker.com/engine/install/debian/
- Other Linux: https://docs.docker.com/engine/install/
- Mac (to try the app only, it cannot pause the internet): https://docs.docker.com/desktop/setup/install/mac-install/
- Windows (to try the app only): https://docs.docker.com/desktop/setup/install/windows-install/

Then check it works. Type this and press Enter:

```bash
docker --version
```

You should see: a line like `Docker version 27.1.1, build ...`. The numbers can be different.

## Step 2. Download t@sk4ce

```bash
git clone https://github.com/sgtslaughta/tskfrce.git
cd tskfrce
```

If it says `git: command not found`, type `sudo apt install git` and try again.

You should see: a few lines ending in `done.`, then you are inside a folder called `tskfrce`.

## Step 3. Find your network name

```bash
ip route show default
```

You should see: a line like `default via 192.168.1.1 dev eth0 ...`. The word after `dev` is your network name. Here it is `eth0`. Remember yours.

## Step 4. Write a settings file

Replace `eth0` below if yours is different.

```bash
printf 'INTERNAL_TOKEN=temporary\nLAN_IFACE=eth0\n' > .env
```

You should see: nothing. That is normal. A file called `.env` now exists.

## Step 5. Start t@sk4ce

```bash
docker compose up -d --build backend frontend
```

This takes a few minutes the first time.

You should see: lines about building, ending with `Started` for `backend` and `frontend`.

## Step 6. Check that it is running

```bash
docker compose ps
```

You should see: two lines, both saying `running` (or `healthy`) in the status column. If the second says `starting`, wait a minute and try again.

## Step 7. Get the box's secret code

The app and the pausing part need to share a secret code. The app makes it the first time it starts. Type this:

```bash
docker compose exec backend python -c "import json; print(json.load(open('/app/data/secrets.json'))['INTERNAL_TOKEN'])"
```

You should see: one long line of letters and numbers. Copy it.

## Step 8. Put the code in the settings file

```bash
nano .env
```

Change `temporary` to the code you copied, so the first line reads `INTERNAL_TOKEN=` followed by your code. Press `Ctrl+O`, Enter, then `Ctrl+X` to save and leave.

You should see: you are back at the command line.

## Step 9. Start the part that pauses the internet

```bash
docker compose up -d blocker
```

You should see: `Started` for `blocker` (it may build first).

## Step 10. Find the box's address

```bash
hostname -I
```

You should see: one or more numbers like `192.168.1.50`. The first one is the box's address.

## Step 11. Open t@sk4ce

On your phone or another computer **on the same Wi-Fi**, open a web browser and type the address with `:3000` on the end, for example `http://192.168.1.50:3000`.

You should see: a page that welcomes you and asks about your family. That is the setup. Go to [First-time setup](03-first-setup.md).

Tip: bookmark this page, and write the address on a sticky note near the router.

## Keeping it running

t@sk4ce restarts by itself after a power cut. To stop it: `docker compose down` in the `tskfrce` folder. To start it again: `docker compose up -d`.

> **For the curious.** The `blocker` service uses host networking and the NET_ADMIN/NET_RAW capabilities to do ARP/NDP redirection and nftables rules, so it must run on Linux. If you leave out the secret-code steps the pausing part cannot talk to the app and will be refused. Updates run database migrations on start and keep a backup in the data volume first (`backups/pre-upgrade-<time>.db`).

Next: [First-time setup](03-first-setup.md). Stuck? See [Troubleshooting](06-troubleshooting.md).
