"""Alembic migrations build the schema from scratch."""

import os
import subprocess
import sys
from pathlib import Path

from app.core.database import Base, _import_all_models
from sqlalchemy import create_engine, inspect

BACKEND = Path(__file__).resolve().parent.parent


def test_alembic_upgrade_creates_tables(tmp_path):
    url = f"sqlite:///{tmp_path / 'mig.db'}"
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )
    tables = set(inspect(create_engine(url)).get_table_names()) - {"alembic_version"}
    _import_all_models()
    assert tables == set(Base.metadata.tables)
