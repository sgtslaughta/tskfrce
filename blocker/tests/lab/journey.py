"""Helpers for lab journeys: act as the parent and as kids from inside the lab."""

import base64
import json as _json
import os
import subprocess
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
LAB = ["bash", os.path.join(ROOT, "scripts/lab.sh")]
COMPOSE = ["docker", "compose", "-f", os.path.join(ROOT, "lab/docker-compose.lab.yml")]
API = "http://10.99.0.3:8000"
HOST_OF = {"kid1": "kid1", "kid2": "kid2"}
JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcp"
    "LDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAA"
    "AgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6"
    "Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG"
    "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA"
    "AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5"
    "OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPE"
    "xcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDFoooryj74/9k="
)
_cleanups: list = []
_tok: dict[str, str] = {}


class HTTPError(AssertionError):
    def __init__(self, status: int, body):
        super().__init__(f"HTTP {status}: {body}")
        self.status, self.body = status, body


def lab(*args, check=False) -> subprocess.CompletedProcess:
    return subprocess.run([*LAB, *args], capture_output=True, text=True, check=check)


def wait_for(pred, timeout=60, every=2):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(every)
    return False


def _http(host, method, path, token=None, json=None, files=None):
    cmd = [*COMPOSE, "exec", "-T", host, "curl", "-s", "-m", "30", "-X", method]
    cmd += ["-w", "\n%{http_code}"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    stdin = b""
    if files is not None:  # {"file": bytes}: one JPEG streamed on stdin
        cmd += ["-F", "file=@-;type=image/jpeg;filename=p.jpg"]
        stdin = files["file"]
    elif json is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", _json.dumps(json)]
    out = subprocess.run([*cmd, API + path], input=stdin, capture_output=True, check=True).stdout
    body, _, code = out.decode().rpartition("\n")
    try:
        data = _json.loads(body) if body.strip() else None
    except ValueError:
        data = body
    status = int(code)
    if status >= 400:
        raise HTTPError(status, data)
    return data


def _login(host, payload, path):
    return _http(host, "POST", path, json=payload)["access_token"]


def parent(method, path, json=None, files=None):
    if "p" not in _tok:
        _tok["p"] = _login(
            "parent", {"username": "labparent", "password": "labpassword1"}, "/api/v1/auth/login"
        )
    try:
        return _http("parent", method, path, _tok["p"], json, files)
    except HTTPError as e:
        if e.status != 401:
            raise
        del _tok["p"]
        return parent(method, path, json, files)


def kid_login(host, kid_id, pin=None) -> str:
    return _login(host, {"kid_id": kid_id, "pin": pin}, "/api/v1/kid/login")


def kid(host, token, method, path, json=None, files=None):
    return _http(host, method, "/api/v1/kid" + path, token, json, files)


def as_kid(host, token, method, path, json=None, files=None):
    """Like kid() but for non-/kid paths (chat) a kid may use."""
    return _http(host, method, path, token, json, files)


def online(host) -> bool:
    return lab("check", host).returncode == 0


def wait_online(host, want: bool, timeout=60):
    assert wait_for(lambda: online(host) == want, timeout), (
        f"{host} never went {'online' if want else 'offline'}"
    )


def on_cleanup(fn):
    _cleanups.append(fn)


def cleanup():
    while _cleanups:
        try:
            _cleanups.pop()()
        except Exception:  # noqa: BLE001, S110 - best effort: later cleanups must still run
            pass


def _device_id(host) -> int:
    return int(lab("device-id", host, check=True).stdout.strip())


def reset_device(host):
    """Delete and rediscover a device: approved screen time leaves a bonus override on it."""
    parent("DELETE", f"/api/v1/devices/{_device_id(host)}")
    assert wait_for(lambda: lab("device-id", host).returncode == 0, 60), f"{host} not rediscovered"
    parent("PATCH", f"/api/v1/devices/{_device_id(host)}", {"status": "guest"})


def make_kid(name, pin, host) -> dict:
    """Create a kid, wait for the host's device, assign it. Returns kid + device_id."""
    k = parent("POST", "/api/v1/kids", {"full_name": name, "pin": pin})
    assert wait_for(lambda: lab("device-id", host).returncode == 0, 60), f"{host} not discovered"
    dev = _device_id(host)
    parent("PATCH", f"/api/v1/devices/{dev}", {"owner_ids": [k["id"]], "status": "assigned"})

    def undo():
        parent("DELETE", f"/api/v1/kids/{k['id']}")
        parent("PATCH", f"/api/v1/devices/{dev}", {"owner_ids": [], "status": "guest"})

    on_cleanup(undo)
    k["device_id"], k["host"], k["pin"] = dev, host, pin
    k["token"] = kid_login(host, k["id"], pin)
    return k


def make_chore(kid_ids, title="Dishes", points=10, **extra) -> dict:
    """Create a daily chore; returns the first instance. Deleted on cleanup."""
    res = parent(
        "POST",
        "/api/v1/chores/",
        {
            "title": title,
            "kid_ids": kid_ids,
            "points": points,
            "repeat": {"type": "daily"},
            **extra,
        },
    )
    on_cleanup(lambda: parent("DELETE", f"/api/v1/chores/{res['definition']['id']}"))
    return res["instance"]


def award(kid_id, amount):
    parent(
        "POST",
        f"/api/v1/gamification/points/award?user_id={kid_id}&amount={amount}&points_type=bonus",
    )


def set_family(**patch):
    """Patch family settings; the previous values come back on cleanup."""
    old = parent("GET", "/api/v1/family")
    parent("PATCH", "/api/v1/family", patch)
    on_cleanup(lambda: parent("PATCH", "/api/v1/family", {k: old[k] for k in patch}))


def chore_of(k, chore_id):
    return next(
        c for c in kid(k["host"], k["token"], "GET", "/today")["chores"] if c["id"] == chore_id
    )


def balance(k) -> int:
    return kid(k["host"], k["token"], "GET", "/today")["points_balance"]


def submit(k, chore_id):
    return kid(k["host"], k["token"], "POST", f"/chores/{chore_id}/done")


def needs_you() -> list:
    return parent("GET", "/api/v1/today")["needs_you"]
