"""Material Symbols name used for stored icons."""

from typing import Annotated

from pydantic import StringConstraints

Glyph = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-z0-9_]{1,40}$")]
