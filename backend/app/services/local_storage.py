"""Local-disk storage for uploaded files."""

from pathlib import Path


class LocalStorage:
    """Stores files under a root directory, created on first save."""

    def __init__(self, root: Path):
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        root = self.root.resolve()
        path = (root / key).resolve()
        if path == root or not path.is_relative_to(root):
            raise ValueError("Invalid file key: it must stay inside the uploads folder.")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def open(self, key: str) -> Path:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        return path

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def stats(self) -> dict:
        files = [p for p in self.root.rglob("*") if p.is_file()] if self.root.exists() else []
        return {"files": len(files), "bytes": sum(p.stat().st_size for p in files)}
