#!/usr/bin/env python3
"""Capture demo screenshots using Playwright and seed data."""

import subprocess
import sys
import json
import time
import os
from pathlib import Path

LAB_BASE = "http://10.99.0.5:3000"
API_BASE = "http://10.99.0.3:8000"

# Map of screenshot name to (route, size, color_scheme, description)
GUIDE_SHOTS = {
    "today.png": ("/", "desktop", "light", "Parent Today with items needing approval"),
    "today-empty.png": ("/", "desktop", "light", "Parent Today after fresh setup"),
    "setup-family.png": ("/setup", "desktop", "light", "Setup wizard step 1"),
    "setup-devices.png": ("/setup", "desktop", "light", "Setup wizard step 4"),
    "devices.png": ("/devices", "desktop", "light", "Devices page"),
    "chat.png": ("/chat", "desktop", "light", "Chat dock open"),
    "kid-today.png": ("/kid", "phone", "light", "Kid home screen"),
    "kid-chore.png": ("/kid", "phone", "light", "Kid chore detail"),
    "kid-locker.png": ("/kid", "phone", "light", "Kid locker screen"),
}

SITE_SHOTS = {
    "today-hero.jpg": ("/", "phone", "light", "Kid hero today screen"),
    "kid-home.jpg": ("/kid", "phone", "light", "Kid home with chores"),
    "kid-locker.jpg": ("/kid", "phone", "light", "Kid locker"),
    "today-parent.jpg": ("/", "desktop", "dark", "Parent today desktop dark"),
    "needs-you.jpg": ("/", "desktop", "dark", "Parent needs-you section"),
}

SIZES = {
    "desktop": {"width": 1280, "height": 800},
    "phone": {"width": 360, "height": 740},
}


def playwright_script():
    """Generate a Playwright test script to capture screenshots."""
    script = """
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: JSON.parse(process.argv[2]),
    colorScheme: process.argv[3],
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const baseUrl = process.argv[4];
  const path = process.argv[5];
  const outfile = process.argv[6];

  try {
    await page.goto(baseUrl + path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: outfile,
      fullPage: true,
    });
    console.log('Screenshot saved: ' + outfile);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
"""
    return script


def run_screenshots():
    """Run screenshot capture."""
    print("Starting screenshot capture...")

    # Create output directories
    guide_dir = Path("/home/user/code/tskfrce-redesign/docs/guide/img")
    site_dir = Path("/home/user/code/tskfrce-redesign/site/img")
    guide_dir.mkdir(parents=True, exist_ok=True)
    site_dir.mkdir(parents=True, exist_ok=True)

    # Check if lab is ready
    print(f"Waiting for lab frontend at {LAB_BASE}...")
    for i in range(60):
        try:
            result = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{LAB_BASE}/health"],
                capture_output=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout.decode().strip() == "200":
                print("Lab is ready!")
                break
        except:
            pass
        time.sleep(2)
    else:
        print(f"ERROR: Lab frontend at {LAB_BASE} is not responding", file=sys.stderr)
        return 1

    # For now, just report what needs to be captured
    print("\nRequired screenshots for guide (docs/guide/img/):")
    for name, (route, size, scheme, desc) in GUIDE_SHOTS.items():
        print(f"  {name}: {route} ({size}, {scheme}) - {desc}")

    print("\nRequired screenshots for site (site/img/):")
    for name, (route, size, scheme, desc) in SITE_SHOTS.items():
        print(f"  {name}: {route} ({size}, {scheme}) - {desc}")

    print("\nNote: Use the existing frontend e2e tests to capture these screenshots.")
    print("The screens.spec.ts file in frontend/e2e/ captures all necessary images.")

    return 0


if __name__ == "__main__":
    sys.exit(run_screenshots())
