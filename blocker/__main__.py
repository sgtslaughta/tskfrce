import os

from blocker.api import make_api
from blocker.config import Config


def main() -> None:
    cfg = Config.from_env(os.environ)
    server = make_api(None, cfg.internal_token, lambda *a, **k: None, "127.0.0.1", cfg.blocker_port)
    server.serve_forever()


if __name__ == "__main__":
    main()
