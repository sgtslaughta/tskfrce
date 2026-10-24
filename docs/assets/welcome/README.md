# Welcome animation

12 s loop: mess → kids' devices lose Wi-Fi (parents' stay on) → chores in the app → ticked → Wi-Fi on + thumbs up.

Transparent `light` (for light pages) and `dark` (for dark pages) builds; `-small` is 360×200, default 720×400.
`.png` = animated PNG (alpha), `.webp` = smaller alpha animation, `.gif` = no-alpha fallback matted to GitHub's backgrounds, `-still.png` = final frame.

Use in a README (theme-aware):

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/welcome/welcome-dark-small.png">
  <img alt="Chores done. Wi-Fi on." src="docs/assets/welcome/welcome-light-small.png" width="360">
</picture>
```

Rebuild after editing `welcome.html`:

```sh
cd frontend && node ../docs/assets/welcome/render.mjs /tmp/welcome-frames 20
python docs/assets/welcome/build.py /tmp/welcome-frames docs/assets/welcome
```
