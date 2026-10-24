import os


def pytest_configure(config):
    # addopts deselects integration; RUN_INTEGRATION=1 opts back in.
    if os.environ.get("RUN_INTEGRATION") == "1":
        config.option.markexpr = ""
