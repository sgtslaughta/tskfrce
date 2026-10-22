# Remote access (check in from away from home)

This is optional. By default you reach t@sk4ce only on your home Wi-Fi. A free service called **Tailscale** lets your phone reach the home box from anywhere, privately. Nobody else on the internet can open it.

You need: the box already running t@sk4ce, and about 10 minutes.

## Step 1. Make a Tailscale account

Go to https://login.tailscale.com/start and sign up with Google, Microsoft or Apple. It is free for personal use.

You should see: an empty list of machines.

## Step 2. Put Tailscale on the box

On the home box, open the Terminal and paste this line:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Then:

```bash
sudo tailscale up
```

You should see: a web address. Open it on any device, sign in, and tap **Connect**.

You should see: the box in your Tailscale machine list, with a number like `100.101.102.103`. You can also type `tailscale ip -4` on the box to see it. Write it down.

## Step 3. Put Tailscale on your phone

Install the **Tailscale** app from the App Store or Google Play. Sign in with the same account. Turn it on.

You should see: the box in the app's list.

## Step 4. Open t@sk4ce from anywhere

With Tailscale on, open your phone's browser and type the box's Tailscale number with `:3000`, for example `http://100.101.102.103:3000`.

You should see: the t@sk4ce log in page.

Tip: bookmark it.

## Good to know

- Only people you share your Tailscale account or machine with can reach it.
- Kids do not need this. Their own page works on the home Wi-Fi.
- Password reset links use the address saved as `BOX_URL` in the `.env` file. If you want links that work from away: in the Terminal on the box, type `cd ~/task4ce`, then `nano .env`, change the `BOX_URL=` line to your Tailscale address (for example `BOX_URL=http://100.101.102.103:3000`), save (Ctrl+O, Enter), leave (Ctrl+X), and type `docker compose -f docker-compose.prod.yml up -d` to apply it. Running the install line again does not change this file.
- Turn it off any time: `sudo tailscale down` on the box.
