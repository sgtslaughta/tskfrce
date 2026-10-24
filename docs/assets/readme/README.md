# README images

`kids`, `parents` and `devices`, each as `-light.png` and `-dark.png` (transparent corners), picked by the reader's theme with `<picture>` in the top-level README.

Built from the approved v3 mockups (`docs/superpowers/specs/2026-10-24-v3-redesign-mockups/`); the cropped screens live in `src/`, layout and callouts in `collage.html` (`?theme=light` for the light set).

Rebuild:

```sh
cp docs/assets/readme/render.mjs frontend/.render.mjs
(cd frontend && node .render.mjs ../docs/assets/readme/collage.html ../docs/assets/readme; rm .render.mjs)
```
