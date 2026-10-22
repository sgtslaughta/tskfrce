# 2. Install

One line does it all. You will type it on the home box. After each step we tell you what you should see.

Before you start:

- The box is plugged into **power** and into your **router with a network cable** (see [what you need](01-what-you-need.md)).
- It is switched on, and it has been connected to the internet. Test: it can open a web page.
- If it is a Raspberry Pi, put **Raspberry Pi OS (64-bit)** on its memory card first, using the free [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on another computer. In the Imager's settings, set a user name and password, and turn on **SSH**.
- You can work on the box in two ways: plug a keyboard and screen into it, or sit at another computer on your Wi-Fi and "connect to" the box. For the second way, open Terminal (Mac, Linux) or PowerShell (Windows 10 and 11) and type `ssh <user name>@<box name>`, for example `ssh pat@raspberrypi.local`. Type the password when asked (nothing shows as you type; that is normal).

The **Terminal** is a window where you type commands. On a box with a screen, find it in the menu, or press Ctrl+Alt+T.

## Step 1. Run the installer

In the Terminal on the box, copy this line, paste it (right-click and Paste, or Ctrl+Shift+V), and press Enter:

```bash
curl -fsSL https://sgtslaughta.github.io/tskfrce/install.sh | sh
```

If it asks "Install Docker now?", type `y` and press Enter. It may ask for the box's password. Docker is a free program that runs t@sk4ce. You install it once and then forget it.

This takes a few minutes the first time. Leave it alone until it stops.

You should see: a last message that says **t@sk4ce is running. Open http://192.168.1.50:3000 on your phone or computer.** The numbers will be your box's address.

Write down the address now (or take a photo of the screen). If you lose it, type `hostname -I` in the Terminal on the box: the first number is the box's address, and you add `:3000` after it.

If something goes wrong, the message says what happened and what to do next. Run the same line again after you fix it. It is safe to run again. If the message says it "did not answer within 3 minutes", the box may just be slow (a Raspberry Pi can be). Wait five minutes, then try Step 2 anyway.

## Step 2. Open t@sk4ce

On your phone or another computer **on the same Wi-Fi**, open a web browser (Safari, Chrome and so on). Type the address from the last message into the **address bar** at the top, not into the search box. Include the `http://` and the `:3000`. There is no app to download: t@sk4ce is a web page.

You should see: a page that welcomes you and asks about your family. That is the setup. Go to [First-time setup](03-first-setup.md).

Tip: bookmark this page. On a phone, you can also choose **Add to Home Screen** in the browser's share or menu button, to get an icon. Write the address on a sticky note near the router. The box's address can change if the router is restarted; if the page stops opening, run `hostname -I` on the box again.

## Keeping it running

t@sk4ce restarts by itself after a power cut.

**To update:** run the install line again. Your family, chores and settings are kept. The app saves a copy of your data before it changes anything.

**To stop it:** in the Terminal on the box, type `cd ~/task4ce` and press Enter (that goes to the `task4ce` folder in your home folder), then type `docker compose -f docker-compose.prod.yml down`. To start it again, go to the same folder and type `docker compose -f docker-compose.prod.yml up -d`.

## Do it by hand (for the curious)

The installer does these things. You can do them yourself instead:

1. Install Docker from https://docs.docker.com/engine/install/ and check with `docker --version`.
2. Download the code: `git clone https://github.com/sgtslaughta/tskfrce.git task4ce && cd task4ce`.
3. Write a `.env` file with `SECRET_KEY` and `INTERNAL_TOKEN` (each a long random string, for example from `openssl rand -hex 32`), `BOX_URL=http://<box address>:3000`, `LAN_IFACE=<network name: the word after "dev" in the output of ip route show default, for example eth0>` and `COMPOSE_PROFILES=blocker`.
4. Start it: `docker compose -f docker-compose.prod.yml up -d --build`.

Mac and Windows can run the app to try it out (not the internet pausing): leave out `COMPOSE_PROFILES=blocker`.

> **For the curious.** The `blocker` service uses host networking and the NET_ADMIN/NET_RAW capabilities to do ARP/NDP redirection and nftables rules, so it must run on Linux. It shares the secret `INTERNAL_TOKEN` with the app; the installer writes the same one to both. Updates run database migrations on start and keep a backup in the data volume first (`backups/pre-upgrade-<time>.db`).

Next: [First-time setup](03-first-setup.md). Stuck? See [Troubleshooting](06-troubleshooting.md).
