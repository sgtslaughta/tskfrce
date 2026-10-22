# Site images

Images in this directory are used on the GitHub Pages site. They are optimized for web (compressed JPEG/PNG, under 200 KB each).

## Screenshots

- `today-hero.jpg` — A kid's today screen (hero section)
- `kid-home.jpg` — Kid's home screen with daily chores
- `kid-locker.jpg` — Kid's locker showing levels and rewards
- `today-parent.jpg` — Parent's today screen
- `needs-you.jpg` — Parent's "needs you" screen

These are sourced from the app's e2e tests and updated during polish passes.

## Illustrations

- `how-it-works-1.svg` — Step 1: Kid gets chores
- `how-it-works-3.svg` — Step 3: Parent approves, internet back
- `favicon.svg` — Site favicon

## Updating screenshots

Run the app's e2e tests and commit new screenshots from `frontend/e2e-artifacts/` here. Keep filenames stable and dimensions consistent (screenshots should be at 1280px wide or 360px for mobile).

## File size requirements

- Total site weight (including styles.css and HTML): < 1.5 MB
- Individual screenshots: < 200 KB
- Compress with `convert` (ImageMagick) or `cwebp`
