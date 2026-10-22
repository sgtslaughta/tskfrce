#!/usr/bin/env python3
"""How the guide screenshots in docs/guide/img were made (scripts/shots/*.js).

1. Fresh backend on :8777 (DATA_DIR scratch, INTERNAL_TOKEN=shottoken) and `next dev` on :3777.
2. node wiz.js    -> drives the real setup wizard (setup-family, setup-devices, today-empty)
3. python3 scripts/seed_demo.py http://127.0.0.1:8777 <DATA_DIR>/task4ce.db rivera-demo-2026
4. node parent.js / dev.js / chat.js / kid.js -> today, devices, chat, kid-*
Run the .js files with Playwright (see pw.sh); outputs are then palette-optimized with Pillow.
"""
print(__doc__)
