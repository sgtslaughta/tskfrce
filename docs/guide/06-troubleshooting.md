# 6. Troubleshooting

Find your problem below. Each fix is one step at a time.

Commands on this page are typed in the Terminal on the home box (see [Install](02-install.md) if you need to know how to open it). First go to the t@sk4ce folder by typing `cd ~/task4ce` and pressing Enter. Every `docker compose` command below must include `-f docker-compose.prod.yml`, exactly as shown.

If a command says "permission denied" for Docker, put `sudo` in front of it. If it says "no configuration file provided" or "no such file", you are not in the `task4ce` folder.

## A banner says the home box is offline

The banner reads something like "The home box went quiet at ..." It means the app has not heard from the box for a few minutes.

**While the box is offline, paused devices may be back online.** The internet just works. Nothing is broken at home.

1. Check the box has power and the network cable is plugged in at both ends.
   You should see: lights on the box and on the router port.
2. Wait two minutes.
   You should see: the banner goes away by itself.
3. If it stays, open the Terminal on the box, go to the folder (`cd ~/task4ce`) and type `docker compose -f docker-compose.prod.yml ps`.
   You should see: `blocker`, `backend` and `frontend` all running.
4. If `blocker` is missing, type `docker compose -f docker-compose.prod.yml up -d blocker`.
   You should see: `Started`.
5. If it keeps stopping, type `docker compose -f docker-compose.prod.yml logs blocker --tail 30` and send it with a new issue on GitHub (see "Still stuck" below).

The most common cause is a wrong network name in the `.env` file. Type `ip route show default`. The word right after `dev` (for example `eth0`) is the network name. Open the file with `nano .env`, fix the `LAN_IFACE=` line, save (Ctrl+O, Enter) and leave (Ctrl+X). Then run `docker compose -f docker-compose.prod.yml up -d blocker`.

## A device isn't being paused

Work through these in order:

1. Is the device **assigned** to a kid? Guests are never paused. New devices are paused only if **Block new devices until I assign them** is on in **Settings → Family**.
2. Are all that kid's chores approved for today? If yes, the internet is on. If the kid has no chores today, it is also on.
3. Is it **Free time** or **Allowed hours** for them? See **Settings → Hours**.
4. Is there a manual unlock? Open the device, **Lock options**, then **Clear** to remove it.
5. Press **Test block** on the device and read the answer:
   - "We haven't seen this device on the network yet": the box can't see it. Wake the device and join your Wi-Fi.
   - "Success": it works.
   - "The device is trying to get around the block. The box is still stopping it, but someone may have changed its network settings.": see below.
   - "We couldn't see this device use the internet during the test.": open a video on the device and test again. If it repeats, your router may be stopping the box. Check the [router list](../routers.md).

## My kid found a way around it

This can happen. t@sk4ce stops normal use, and tells you when it notices. It can't stop everything.

If a paused device keeps reaching the internet, you get a notification, "<device> is getting around the block", and a badge on the device. It clears by itself once the device stops.

What kids try, and what happens (details in [the home box notes](../blocker.md)):

- Changing network settings or using a VPN app: does not work.
- Forgetting the Wi-Fi to get a new address: the new address looks like a new device and starts paused.
- Using a phone hotspot or mobile data: **not covered**. It is only home Wi-Fi.
- Using another device that isn't set up: **not covered**. Put every device on the Devices page.
- Unplugging the box: the internet comes back on, and you get an alert.

The real fix is a talk. If you see the alert, ask. Keep the box out of reach.

## I forgot my password

**If there is another parent:**

1. They sign in and tap **Settings**, then **Parents**.
2. They tap **Reset password** next to your name, then **Copy link**.
   You should see: a link and the words "It works once, for 30 minutes."
3. They send you the link. Open it, type a new password twice and tap **Save password**.
   You should see: the log in page with "Password saved".

**If you are the only parent**, type this on the home box (in the `task4ce` folder), with your username in place of `mom` (the user name you chose in setup, not your display name):

```bash
docker compose -f docker-compose.prod.yml exec backend python -m app.cli reset-password mom
```

You should see: a link. Open it on your phone or computer, and choose a new password. If the name is wrong, the box shows the parent names it knows.

If the link says it has expired, make a new one. Each new link cancels the old one.

## A kid forgot their PIN

1. Sign in as a parent. Tap **Kids & chores**, then **Kids**, then the kid.
2. Set a new PIN or clear it.
   You should see: the kid can sign in with the new PIN.

## A kid can't open their page

1. Make sure the device is assigned to that kid on the **Devices** page. Kids can only sign in from their own devices.
2. After too many wrong PINs the app waits about a minute. Wait and try again.

## Backups

Your family's information lives in one data store on the box. Before any upgrade that changes the database, the app saves a copy in `backups`, named `pre-upgrade-<time>.db`, inside that data store.

To keep your own copy, type this in the `task4ce` folder on the box:

```bash
mkdir -p ~/tskfrce-backup
docker compose -f docker-compose.prod.yml cp backend:/app/data ~/tskfrce-backup/
```

You should see: a folder `~/tskfrce-backup/data` with a file ending `.db`. Copy that folder to a USB stick now and then.

## Start over

This erases everything, including the chores and points. Do this only if you really want to.

```bash
cd ~/task4ce
docker compose -f docker-compose.prod.yml down -v
```

Then run the install line from [Install](02-install.md) again. You will see the setup wizard like the first time.

## Still stuck

Open an issue at https://github.com/sgtslaughta/tskfrce/issues and tell us what you see. For router problems, use the [router report](https://github.com/sgtslaughta/tskfrce/issues/new?labels=router).
