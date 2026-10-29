"""Seed the lab for the browser e2e run, run the given command, then clean up.

Usage: python3 lab/e2e_run.py <command...>
Needs a running lab (scripts/lab.sh up). Seeds one kid on kid1 with two chores that
wait for a parent: "E2E dishes" and "E2E sweep" (both with a photo), plus an open
"E2E photo" chore; its run id and the kid's token go to the command as E2E_KID_RUN and
E2E_KID_TOKEN, plus E2E_JPEG (the photo-through-the-proxy check).
"""

import base64
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../blocker/tests/lab"))
import journey as j  # noqa: E402


def seed() -> dict:
    k = j.make_kid("Pat", "1234", "kid1")
    for title in ("E2E dishes", "E2E sweep"):
        c = j.make_chore([k["id"]], title=title, needs_photo=True)
        j.kid("kid1", k["token"], "POST", f"/chores/{c['id']}/photos", files={"file": j.JPEG})
        j.submit(k, c["id"])
    open_run = j.make_chore([k["id"]], title="E2E photo", needs_photo=True)
    return {
        "E2E_KID_RUN": str(open_run["id"]),
        "E2E_KID_TOKEN": k["token"],
        "E2E_JPEG": base64.b64encode(j.JPEG).decode(),
    }


if __name__ == "__main__":
    try:
        code = subprocess.run(sys.argv[1:], env={**os.environ, **seed()}).returncode
    finally:
        j.cleanup()
        # the e2e container registers as a device (e2e-run...) on every run; drop it
        try:
            for d in j.parent("GET", "/api/v1/devices"):
                if "e2e-run" in d["name"]:
                    j.parent("DELETE", f"/api/v1/devices/{d['id']}")
        except Exception:  # noqa: BLE001, S110 - best effort, never mask the test result
            pass
    sys.exit(code)
