# 7. FAQ

## What does t@sk4ce do?

Kids see their chores. Parents approve them. The internet is paused for chosen devices until their chores are approved. Points, levels, badges and rewards make it more fun.

## Does it cost anything?

No. It's free and open source. You supply the small computer.

## Where does my family's information go?

It stays in your home, on the home box. There are no accounts with us, no ads and no tracking. Something only leaves your home if you turn it on:

- **GIFs in chat**: GIF searches go to GIPHY through the box. See [Everyday use](04-everyday-use.md#gifs-off-by-default).
- **Notifications to your chat apps**: pings go to the service you chose. See [Everyday use](04-everyday-use.md#notifications).
- **Instant alerts on iPhones**: a content-free wake-up goes to ntfy.sh. The alert text stays home.
- **Remote access**: Tailscale connects your phone to the box privately. See [Remote access](../remote-access.md).

<a id="can-my-kid-get-around-it"></a>
## Can my kid get around it?

A determined kid can. t@sk4ce is built to stop normal use and to tell you when someone is dodging it. It is not a lock.

- Mobile data and phone hotspots aren't covered. It only works on your home Wi-Fi.
- A new, unregistered device can be used instead, unless you keep "Block new devices" on.
- A kid who changes their device's network settings is usually still stopped, and you get an alert when something gets through.

Talk with your kids. The app helps with that. It can't replace it.

## What if the box is off or breaks?

The internet just works. The box fails open: if it is off, unplugged or crashed, everyone gets their internet back within a minute or two, and the app shows a banner.

## Does it work with my router?

Most routers work. A few, especially some mesh systems, don't. Check the [router list](../routers.md) and press **Test block** on a device.

## Can I use it without pausing the internet?

Yes. Skip the **Devices** step in [first-time setup](03-first-setup.md) and mark every device **Guest** (or don't assign any, and turn off "Block new devices" in Settings). Nothing is paused then. Chores, points, chat and rewards all still work.

## Can I use it with Wi-Fi on my phone only (no box)?

The chore app works, but nothing can be paused without the box.

## How many kids can I add?

As many as you need.

## Do kids need their own phones?

No. A kid can use any device assigned to them, and siblings can share one. A PIN keeps it private.

## Can there be two parents?

Yes. In **Settings → Parents**, tap **Invite a parent** and send them the link.

## What do "First one wins" and "Team effort" mean?

Both give one chore to several kids. With **First one wins**, the first kid to finish it gets the points. With **Team effort**, anyone can do the steps and the points are split evenly. With **Each does it**, every kid has their own copy.

## What ages is it for?

From about 5 up. Each kid gets a look that fits: **Little (5–8)** shows one chore at a time with big buttons, **Kid (9–12)** has big tiles, and **Teen (13+)** is a compact list. See [For kids](05-for-kids.md).

## What are the badge levels?

Copper, silver, gold, platinum and mega-diamond. Doing more moves a badge up a level.

## Can I check in when I'm away from home?

Yes, with a free service called Tailscale. See [Remote access](../remote-access.md) for the steps.

## How do I update?

Run the install line again (see [Install](02-install.md)). Your family, chores and settings are kept. The app saves a copy of your data before it changes anything.

## How do I report a bug or ask for a feature?

Open an issue at https://github.com/sgtslaughta/tskfrce/issues.
