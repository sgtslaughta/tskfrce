"""Seed the lab for the browser e2e run, run the given command, then clean up.

Usage: python3 lab/e2e_run.py <command...>
Needs a running lab (scripts/lab.sh up). Seeds one kid on kid1 with two chores that
wait for a parent: "E2E dishes" and "E2E sweep" (both with a photo).
"""

import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../blocker/tests/lab"))
import journey as j  # noqa: E402


def seed():
    k = j.make_kid("Pat", "1234", "kid1")
    for title in ("E2E dishes", "E2E sweep"):
        c = j.make_chore([k["id"]], title=title, needs_photo=True)
        j.kid("kid1", k["token"], "POST", f"/chores/{c['id']}/photos", files={"file": j.JPEG})
        j.submit(k, c["id"])


if __name__ == "__main__":
    try:
        seed()
        code = subprocess.run(sys.argv[1:]).returncode
    finally:
        j.cleanup()
    sys.exit(code)
